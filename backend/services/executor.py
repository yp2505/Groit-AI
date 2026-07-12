"""
services/executor.py — Execution Bridge (HTTP Adapter)
Bridges the FastAPI HTTP layer with Grishma's DAG Execution Engine.
This is NOT a standalone executor — it adapts Grishma's executor for HTTP/SSE use.

Author: Shivam Kumar (LLM Systems Developer)
Execution Engine: Grishma (agentic_mcp_gateway/executor.py, agentic_executor.py)

Shivam's role: Convert HTTP request → Grishma's executor format → HTTP response + SSE
Grishma's role: Core execution logic (retry, HITL, parallel scheduling, template resolution)
"""

from __future__ import annotations
import asyncio
import json
import sys
import os
import time
import logging
import uuid
from typing import Any, AsyncGenerator, Optional

# Add Grishma's module to path at the end to avoid shadowing root packages (like models/)
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "agentic_mcp_gateway"))

from api_schemas.dag import WorkflowDAG, DAGNode
from api_schemas.execution import (
    NodeStatus, NodeExecutionResult, WorkflowExecution, WorkflowStatus
)
from services.context import ContextManager
from services.audit import get_audit_logger
from services.execution_store import get_execution_store

logger = logging.getLogger("mcp_gateway.execution_bridge")


def _convert_dag_for_grishma(dag: WorkflowDAG) -> dict:
    """
    Convert Pydantic WorkflowDAG (from Shivam's /plan endpoint)
    into the dict format Grishma's executor expects.

    Grishma's format uses: id, name, tool, action, inputs, depends_on,
    requires_approval, retry{max_attempts, backoff_factor, initial_delay, timeout}
    """
    nodes = []
    for node in dag.nodes:
        grishma_node = {
            "id": node.id,
            "name": node.name or f"{node.tool}.{node.action}",
            "tool": node.tool,
            "action": node.action,
            "inputs": node.params,  # Shivam uses 'params', Grishma uses 'inputs'
            "depends_on": node.depends_on,
            "requires_approval": node.requires_approval,
            "retry": {
                "max_attempts": node.retry.max_attempts,
                "backoff_factor": node.retry.backoff_factor,
                "initial_delay": node.retry.initial_delay,
                "timeout": node.retry.timeout,
            },
        }
        if node.mock_output:
            grishma_node["mock_output"] = node.mock_output
        nodes.append(grishma_node)

    return {
        "workflow_id": dag.workflow_id or f"wf-{uuid.uuid4().hex[:12]}",
        "name": dag.workflow_name,
        "description": dag.description or dag.workflow_name,
        "nodes": nodes,
    }


class ExecutionBridge:
    """
    HTTP/SSE adapter for Grishma's execution engine.

    This bridge does NOT re-implement execution logic. It:
    1. Converts Shivam's Pydantic DAG → Grishma's executor format
    2. Runs Grishma's DAGExecutor
    3. Collects results into HTTP-friendly structured JSON
    4. Streams SSE events for Tejas's frontend
    5. Logs to Shivam's audit system

    If Grishma's executor is not available (import fails), falls back
    to a lightweight internal runner for demo purposes.
    """

    def __init__(
        self,
        dag: WorkflowDAG,
        auto_approve: bool = True,
        dry_run: bool = False,
        credentials: Optional[dict] = None,
        chat_history: Optional[list] = None
    ):
        self.dag = dag
        self.auto_approve = auto_approve
        self.dry_run = dry_run
        self.credentials = credentials or {}
        self.chat_history = chat_history or []

        # Shivam's context manager — template resolution + state
        self.context = ContextManager(
            summarize_threshold=int(os.getenv("SUMMARIZE_THRESHOLD", "2000"))
        )
        self.audit = get_audit_logger()
        self.execution = WorkflowExecution(
            workflow_name=dag.workflow_name,
            dag=dag,
            total_nodes=len(dag.nodes),
            chat_history=self.chat_history
        )

        # SSE event queue for streaming to Tejas's frontend
        self._event_queue: asyncio.Queue = asyncio.Queue()

    # ─── Primary Execution Path (uses Grishma's engine) ────────────

    async def run(self) -> WorkflowExecution:
        """
        Execute the DAG via Grishma's engine, wrapped for HTTP response.
        Falls back to internal runner if Grishma's module isn't importable.
        """
        exec_id = self.execution.execution_id
        start_time = time.time()

        # Save to store so /status endpoint can find it
        await get_execution_store().save(self.execution)

        self.audit.log_workflow_start(exec_id, self.dag.workflow_name, str(self.dag.nodes))
        self.execution.status = WorkflowStatus.RUNNING
        await get_execution_store().save(self.execution)
        await self._emit("workflow_start", {
            "execution_id": exec_id,
            "workflow_name": self.dag.workflow_name,
            "total_nodes": len(self.dag.nodes),
        })

        try:
            if self.dry_run:
                print(f"EXECUTION_PATH = Fallback (internal runner) [dry_run=True]")
                await self._run_internal_fallback(exec_id)
            else:
                # Try to use Grishma's production executor
                print(f"EXECUTION_PATH = Production (agentic_executor.DAGExecutor)")
                await self._run_with_grishma_executor(exec_id)
        except ImportError:
            print(f"EXECUTION_PATH = Fallback (internal runner) [ImportError]")
            logger.warning("Grishma's executor not importable — using internal fallback runner")
            await self._run_internal_fallback(exec_id)
        except Exception as e:
            # Any other exception from Grishma's executor → fall back to internal runner
            # This ensures real integrations still fire even if the production executor fails
            print(f"EXECUTION_PATH = Fallback (internal runner) [Exception: {e}]")
            logger.warning(f"Grishma's executor threw exception ({e}) — falling back to internal runner")
            self.audit.log_error(exec_id, f"Production executor failed, using fallback: {e}")
            await self._run_internal_fallback(exec_id)
        finally:
            # Finalize results collection regardless of success/error
            self.execution.mark_complete()
            await get_execution_store().save(self.execution)

        # Finalize
        elapsed_ms = (time.time() - start_time) * 1000
        self.audit.log_workflow_complete(
            exec_id, self.execution.succeeded,
            self.execution.failed, self.execution.total_nodes, elapsed_ms,
        )
        await self._emit("workflow_complete", {
            "execution_id": exec_id,
            "status": self.execution.status.value,
            "succeeded": self.execution.succeeded,
            "failed": self.execution.failed,
            "skipped": self.execution.skipped,
            "duration_ms": round(elapsed_ms, 1),
        })

        logger.info(
            f"[{exec_id}] Done — ✅ {self.execution.succeeded} | "
            f"❌ {self.execution.failed} | ⏭ {self.execution.skipped} | "
            f"⏱ {elapsed_ms:.0f}ms"
        )
        return self.execution

    async def _run_with_grishma_executor(self, exec_id: str) -> None:
        """
        Import and run Grishma's agentic_executor.DAGExecutor.
        Wraps her console-based executor for HTTP compatibility.
        """
        from agentic_executor import DAGExecutor as GrishmaExecutor

        # Convert to Grishma's format
        dag_dict = _convert_dag_for_grishma(self.dag)
        logger.info(f"[{exec_id}] Using Grishma's DAGExecutor ({len(dag_dict['nodes'])} nodes)")

        executor = GrishmaExecutor(dag_dict, credentials=self.credentials, 
                                   auto_approve=self.auto_approve, context=self.context)
        await executor.run()

        # Collect results from Grishma's executor nodes
        for node_id, node in executor.nodes.items():
            status = NodeStatus.SUCCESS if node_id in executor.completed else (
                NodeStatus.FAILED if node_id in executor.failed else (
                    NodeStatus.SKIPPED if node_id in executor.skipped else NodeStatus.PENDING
                )
            )
            result = NodeExecutionResult(
                node_id=node_id,
                node_name=node.name,
                tool=node.tool,
                action=node.action,
                status=status,
                output=node.output if hasattr(node, "output") else {},
                error=node.error if hasattr(node, "error") else None,
                retries=node.attempts - 1 if hasattr(node, "attempts") else 0,
            )
            self.execution.node_results[node_id] = result

            # Store output in Shivam's context manager for cross-node resolution
            if status == NodeStatus.SUCCESS and hasattr(node, "output") and node.output:
                self.context.store(node_id, node.output)

            if status == NodeStatus.SUCCESS:
                self.audit.log_tool_success(
                    exec_id, node_id, node.tool, node.action,
                    node.output if hasattr(node, "output") else {}, 0,
                )
            elif status == NodeStatus.FAILED:
                self.audit.log_tool_failure(
                    exec_id, node_id, node.tool, node.action,
                    node.error if hasattr(node, "error") else "Unknown error",
                    node.attempts if hasattr(node, "attempts") else 1
                )

            await self._emit("node_update", {
                "node_id": node_id,
                "status": status.value,
                "output": node.output if hasattr(node, "output") else None,
            })

        # ─── Surface Auto-Rollback Results to Frontend ──────────────
        rollback_results = getattr(executor, "_rollback_results", [])
        if rollback_results:
            for i, rb in enumerate(rollback_results):
                rb_node_id = f"rollback_{rb['node']}"
                rb_status = NodeStatus.SUCCESS if rb["status"] == "rolled_back" else NodeStatus.FAILED
                rb_output = rb.get("result", {})
                rb_error = rb.get("error")
                
                # Find original node to get tool info
                original_node = executor.nodes.get(rb["node"])
                rb_tool = original_node.tool if original_node else "system"
                
                rb_result = NodeExecutionResult(
                    node_id=rb_node_id,
                    node_name=f"🔄 Rollback: {rb['node']}",
                    tool=rb_tool,
                    action="rollback",
                    status=rb_status,
                    output=rb_output if isinstance(rb_output, dict) else {},
                    error=rb_error,
                )
                self.execution.node_results[rb_node_id] = rb_result
                
                self.audit.log_tool_success(
                    exec_id, rb_node_id, rb_tool, "auto_rollback",
                    rb_output if isinstance(rb_output, dict) else {}, 0,
                )
                
                await self._emit("node_update", {
                    "node_id": rb_node_id,
                    "status": rb_status.value,
                    "output": rb_output if isinstance(rb_output, dict) else {},
                    "is_rollback": True,
                })

    # ─── Fallback Runner (when Grishma's executor not available) ───

    async def _run_internal_fallback(self, exec_id: str) -> None:
        """
        Lightweight fallback runner using mock tool dispatch.
        Only used when Grishma's executor module cannot be imported.
        This keeps the /execute endpoint functional for demo.
        """
        import random

        node_map = self.dag.node_map()
        completed: set[str] = set()
        failed: set[str] = set()
        skipped: set[str] = set()

        # Topological layers for parallel execution
        layers = self.dag.get_execution_order()
        logger.info(f"[{exec_id}] Fallback runner — {len(layers)} layers: {layers}")

        for layer_idx, layer in enumerate(layers):
            tasks = []
            for node_id in layer:
                node = node_map[node_id]
                # Skip if upstream failed
                if any(dep in failed or dep in skipped for dep in node.depends_on):
                    self._record_result(node_id, node, NodeStatus.SKIPPED,
                                        error="upstream dependency failed")
                    skipped.add(node_id)
                    await self._emit("node_skipped", {"node_id": node_id,
                                                       "reason": "upstream failed"})
                    continue
                tasks.append(self._execute_fallback_node(exec_id, node, completed, failed, skipped))

            if tasks:
                await asyncio.gather(*tasks)

    async def _execute_fallback_node(
        self, exec_id: str, node: DAGNode,
        completed: set, failed: set, skipped: set
    ) -> None:
        """Execute a single node using mock dispatch (fallback mode)."""
        import random

        node_id = node.id
        start = time.time()

        # Resolve templates via Shivam's context manager
        try:
            resolved_params = self.context.resolve_params(node.params)
        except ValueError as e:
            self._record_result(node_id, node, NodeStatus.FAILED, error=str(e))
            failed.add(node_id)
            return

        self.audit.log_tool_invocation(exec_id, node_id, node.tool, node.action, resolved_params)
        await self._emit("node_running", {"node_id": node_id, "tool": node.tool, "action": node.action})

        # HITL check
        if node.requires_approval and not self.auto_approve:
            self._record_result(node_id, node, NodeStatus.SKIPPED, error="HITL not approved")
            skipped.add(node_id)
            self.audit.log_hitl_request(exec_id, node_id, node.tool, node.action)
            return

        # Mock execution with simulated latency
        delay = node.retry.initial_delay
        for attempt in range(1, node.retry.max_attempts + 1):
            try:
                await asyncio.sleep(random.uniform(0.2, 0.6))

                # 10% transient failure rate for demo
                if random.random() < 0.10 and attempt < node.retry.max_attempts:
                    raise ConnectionError(f"{node.tool}.{node.action}: transient 502")

                if self.dry_run:
                    output = _mock_tool_output(node.tool, node.action, resolved_params)
                elif node.tool in ["slack", "slack_mcp"]:
                    from services.integrations.slack_integration import execute_slack
                    result = await execute_slack(node.action, resolved_params, self.context.get_all())
                    if result.get("status") == "error":
                        raise Exception(result.get("error"))
                    output = result.get("output", {})
                elif node.tool in ["sheets", "sheets_mcp"]:
                    from services.integrations.sheets_integration import execute_sheets
                    sheets_res = await execute_sheets(node.action, resolved_params, self.context.get_all())
                    if sheets_res.get("status") == "error":
                        raise Exception(sheets_res.get("error"))
                    output = sheets_res.get("output", sheets_res.get("data", {}))
                elif node.tool in ["github", "github_mcp"]:
                    from agentic_mcp_gateway.agentic_executor import dispatch_mcp as _dispatch
                    result = await _dispatch("github", node.action, resolved_params, self.credentials)
                    output = result if isinstance(result, dict) else {"result": str(result)}
                elif node.tool in ["jira", "jira_mcp"]:
                    from services.integrations.jira_integration import execute_jira
                    jira_res = await execute_jira(node.action, resolved_params, self.context.get_all())
                    if jira_res.get("status") == "error":
                        raise Exception(jira_res.get("error"))
                    output = jira_res.get("output", jira_res)
                else:
                    output = _mock_tool_output(node.tool, node.action, resolved_params)
                
                elapsed = (time.time() - start) * 1000

                self.context.store(node_id, output)
                completed.add(node_id)
                self._record_result(node_id, node, NodeStatus.SUCCESS,
                                    output=output, duration_ms=elapsed, retries=attempt - 1)
                self.audit.log_tool_success(exec_id, node_id, node.tool, node.action, output, elapsed)
                await self._emit("node_success", {
                    "node_id": node_id, "output": output,
                    "duration_ms": round(elapsed, 1),
                })
                return

            except Exception as e:
                if attempt < node.retry.max_attempts:
                    self.audit.log_tool_retry(exec_id, node_id, node.tool,
                                              node.action, attempt, delay, str(e))
                    await self._emit("node_retry", {
                        "node_id": node_id, "attempt": attempt, "error": str(e),
                    })
                    await asyncio.sleep(delay)
                    delay *= node.retry.backoff_factor
                else:
                    elapsed = (time.time() - start) * 1000
                    failed.add(node_id)
                    self._record_result(node_id, node, NodeStatus.FAILED,
                                        error=str(e), duration_ms=elapsed, retries=attempt - 1)
                    self.audit.log_tool_failure(exec_id, node_id, node.tool,
                                               node.action, str(e), attempt)
                    await self._emit("node_failed", {"node_id": node_id, "error": str(e)})

    # ─── SSE Streaming ─────────────────────────────────────────────

    async def stream_events(self) -> AsyncGenerator[dict, None]:
        """Async generator for SSE events — consumed by routers/execute.py."""
        while True:
            event = await self._event_queue.get()
            yield event
            if event.get("event") == "workflow_complete":
                break

    # ─── Helpers ───────────────────────────────────────────────────

    def _record_result(
        self, node_id: str, node: DAGNode, status: NodeStatus,
        output: dict = None, error: str = None,
        duration_ms: float = 0, retries: int = 0,
    ) -> None:
        self.execution.node_results[node_id] = NodeExecutionResult(
            node_id=node_id,
            node_name=node.name or f"{node.tool}.{node.action}",
            tool=node.tool,
            action=node.action,
            status=status,
            output=output,
            error=error,
            duration_ms=duration_ms,
            retries=retries,
            requires_approval=node.requires_approval,
        )

    async def _emit(self, event_type: str, data: dict) -> None:
        await self._event_queue.put({"event": event_type, "data": json.dumps(data)})

    @staticmethod
    def _now() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()


# ─── Mock Tool Output (only used in fallback mode) ────────────────

def _mock_tool_output(tool: str, action: str, params: dict) -> dict:
    """Simple mock responses — real execution handled by Grishma's engine."""
    import random
    rand = str(random.randint(100, 999))
    mocks = {
        ("jira", "get_issue"):       {"issue_id": params.get("issue_id", f"JIRA-{rand}"), "title": "Critical Bug", "status": "Open", "priority": "Critical", "assignee": "dev-team"},
        ("jira", "create_issue"):    {"issue_id": f"JIRA-{rand}", "issue_url": f"https://jira.company.com/browse/JIRA-{rand}"},
        ("jira", "update_issue"):    {"success": True},
        ("github", "create_branch"): {"branch_name": params.get("branch_name", f"fix/{rand}"), "branch_url": f"https://github.com/org/repo/tree/fix/{rand}"},
        ("github", "create_pr"):     {"pr_number": int(rand), "pr_url": f"https://github.com/org/repo/pull/{rand}"},
        ("github", "merge_pr"):      {"merged": True, "sha": f"a1b2c3{rand}"},
        ("slack", "send_message"):   {"delivered": True, "timestamp": "1684562000.123", "channel": params.get("channel", "#general")},
        ("slack", "create_channel"): {"channel_id": f"C0{rand}", "channel_name": params.get("name", "new-channel")},
        ("sheets", "read_row"):      {"data": {"col_a": "value1", "col_b": "value2"}},
        ("sheets", "update_row"):    {"success": True, "row_updated": random.randint(1, 100)},
        ("sheets", "append_row"):    {"success": True, "row_id": random.randint(40, 100)},
    }
    return mocks.get((tool, action), {"status": "ok", "action": action})
