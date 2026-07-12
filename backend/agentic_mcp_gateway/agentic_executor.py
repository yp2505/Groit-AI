"""
agentic_executor.py

Production-ready DAG Executor for the Agentic MCP Gateway.
Features: Cycle detection, async concurrency, exponential backoff, HITL, timeouts, cross-node templating.
"""

import asyncio
import json
import logging
import re
import sys
import time
import os
from typing import Any, Dict, List, Optional, Set

# Ensure the backend root is on sys.path so all imports resolve correctly
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

logger = logging.getLogger("mcp_gateway.agentic_executor")

# Shivam's services
from services.context import ContextManager
from services.llm import get_llm_service

# Ensure UTF-8 output for emojis and formatting
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# --- Data Models ---

class TaskState:
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class Node:
    def __init__(self, data: Dict[str, Any]):
        self.id: str = data["id"]
        self.name: str = data["name"]
        self.tool: str = data["tool"]
        self.action: str = data["action"]
        self.inputs: Dict[str, Any] = data.get("inputs", {})
        self.depends_on: List[str] = data.get("depends_on", [])
        self.requires_approval: bool = data.get("requires_approval", False)
        self.mock_output: Dict[str, Any] = data.get("mock_output", {})
        
        # Reliability Config
        retry = data.get("retry", {})
        self.max_attempts: int = retry.get("max_attempts", 3)
        self.backoff_factor: float = retry.get("backoff_factor", 2.0)
        self.initial_delay: float = retry.get("initial_delay", 1.0)
        self.timeout: int = retry.get("timeout", 10)  # seconds
        
        # State
        self.state: str = TaskState.PENDING
        self.output: Dict[str, Any] = {}
        self.raw_output: Dict[str, Any] = {}
        self.error: Optional[str] = None
        self.attempts: int = 0
        self.logs: List[Dict[str, Any]] = []

# --- System Logger ---

def log_event(status: str, message: str, color_code: str = "0"):
    """Format matching the requested output structure."""
    print(f"[\033[{color_code}m{status}\033[0m] {message}")


# --- MCP Router ---

async def dispatch_mcp(tool: str, action: str, inputs: Dict[str, Any], credentials: Dict[str, Any] = None, context: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Acts as the router hitting the various MCP Servers or local service integrations.
    Uses provided credentials first, falling back to environment variables.
    """
    log_event("DISPATCH", f"{tool}.{action}", "35")
    print(f"ACTUAL_PARAMS_USED = {json.dumps(inputs, indent=2)}")
    
    # Extract tool-specific credentials if available
    tool_creds = (credentials or {}).get(tool.split('_')[0], {})
    if isinstance(tool_creds, str):
        try:
            tool_creds = json.loads(tool_creds)
        except:
            tool_creds = {"token": tool_creds}

    # Normalize action aliases so LLM output variations all resolve
    action_aliases = {
        "post_message": "send_message",
        "notify": "send_message",
        "send": "send_message",
        "get_ticket": "get_issue",
        "create_ticket": "create_issue",
        "update_ticket": "update_issue",
        "get_repo": "get_repository",
        "get_commits": "list_commits",
        "create_pr": "create_pull_request",
        "merge_pr": "merge_pull_request",
        "write_row": "append_row",
        "add_row": "append_row",
        "log_row": "append_row",
        "get_current_branch": "get_branch",
    }
    action = action_aliases.get(action, action)

    # 1. Composio — LLM-guided universal dispatch for ALL tools
    #
    # We:
    #   a) Fetch the live Composio tool schemas for this toolkit + user
    #   b) Let Groq pick the correct function slug + arguments from those schemas
    #   c) Execute the LLM-chosen function via Composio
    try:
        from services.integrations.composio_integration import composio_llm_dispatch
        user_id = (credentials or {}).get("user_id", "anonymous")

        # Build a natural-language intent string from action + inputs
        node_intent = f"{action}: {json.dumps(inputs)}" if inputs else action

        log_event("DISPATCH", f"Composio[LLM-guided].{tool}.{action} → schema-select via Groq", "36")

        result = await composio_llm_dispatch(
            tool_slug=tool,
            action=action,
            node_intent=node_intent,
            params=inputs,
            user_id=user_id,
            groq_client=get_llm_service().client,
            model=get_llm_service().model,
        )
        print(f"DEBUG: Composio LLM-dispatch RESPONSE for {tool}.{action}:", result)

        if result.get("status") == "success":
            output = result.get("output", {})
            chosen = result.get("action", action)
            if output is None:
                raise Exception(
                    f"Composio.{tool}.{chosen} failed validation: No output returned."
                )
            log_event("VERIFIED", f"Composio.{tool}.{chosen} confirmed in real-world", "32")
            return output if isinstance(output, dict) else {"result": output}

        raise Exception(result.get("error", f"Unknown Composio error for tool '{tool}'"))

    except Exception as e:
        log_event("ERROR", f"Composio.{tool}.{action} failed: {e}", "31")
        raise


# --- Core Executor Engine ---

class DAGExecutor:
    def __init__(self, dag_json: Dict[str, Any], credentials: Dict[str, Any] = None, auto_approve: bool = False, context: ContextManager = None):
        self.credentials = credentials or {}
        self.auto_approve = auto_approve
        self.nodes: Dict[str, Node] = {}
        for n in dag_json["nodes"]:
            if n["id"] in self.nodes:
                raise ValueError(f"Duplicate Node ID detected: {n['id']}")
            self.nodes[n["id"]] = Node(n)
            
        self.completed: Set[str] = set()
        self.failed: Set[str] = set()
        self.skipped: Set[str] = set()
        self.execution_id = f"exec-{int(time.time())}"
        
        # Shivam's context manager (unifies template resolution)
        self.context = context or ContextManager(
            summarize_threshold=int(os.getenv("SUMMARIZE_THRESHOLD", "2000"))
        )
        
        self._validate_dag()

    def _validate_dag(self):
        """Perform topological sort check to detect cycles."""
        visited = set()
        path = set()

        def visit(node_id):
            if node_id in path:
                raise ValueError(f"Cyclic dependency detected involving node: {node_id}")
            if node_id in visited:
                return
            
            path.add(node_id)
            for dep in self.nodes[node_id].depends_on:
                if dep not in self.nodes:
                    raise ValueError(f"Node {node_id} depends on missing node {dep}")
                visit(dep)
            path.remove(node_id)
            visited.add(node_id)

        for n_id in self.nodes:
            visit(n_id)

    def _resolve_templates(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve templated variables via Shivam's ContextManager."""
        return self.context.resolve_params(payload)

    async def _execute_with_retry(self, node: Node, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Executes the specific MCP router with exponential backoff and timeout."""
        delay = node.initial_delay
        
        while node.attempts < node.max_attempts:
            node.attempts += 1
            try:
                # Prepare generic mock output if provided in DAG
                context_data = {n_id: n.raw_output for n_id, n in self.nodes.items() if n.state == TaskState.SUCCESS}
                return await asyncio.wait_for(
                    dispatch_mcp(node.tool, node.action, inputs, credentials=self.credentials, context=context_data),
                    timeout=node.timeout
                )
            except Exception as e:
                is_last_attempt = node.attempts >= node.max_attempts
                if not is_last_attempt:
                    log_event("FAILED", f"{node.id} (Attempt {node.attempts})", "31")
                    log_event("RETRY", f"Retrying in {delay}s...", "33")
                    await asyncio.sleep(delay)
                    delay *= node.backoff_factor
                else:
                    raise e

    async def _run_node(self, node: Node):
        """Task lifecycle manager: state updates, HITL, retries, and failure capture."""
        node.state = TaskState.RUNNING
        log_event("RUNNING", f"{node.id}: {node.name}", "36")
        
        # Human-In-The-Loop Breakpoint
        if node.requires_approval and not self.auto_approve:
            log_event("WAITING", f"{node.id} requires approval", "33")
            node.state = TaskState.SKIPPED
            node.error = "Pending human approval (HITL)"
            log_event("WAITING", f"{node.id} (Paused for HITL)", "33")
            self.skipped.add(node.id) 
            return

        # Resolve templates & execution Context
        try:
            inputs = self._resolve_templates(node.inputs)
            output = await self._execute_with_retry(node, inputs)
            
            node.output = output
            node.raw_output = output
            node.state = TaskState.SUCCESS
            self.completed.add(node.id)

            # CRITICAL: Store in context and check for summarization
            # 1. Add a basic default summary if not present
            if "summary" not in output:
                output["summary"] = f"Action {node.tool}.{node.action} completed successfully."

            self.context.store(node.id, output)
            
            if self.context.needs_summarization(node.id):
                try:
                    llm = get_llm_service()
                    summary_text = await llm.summarize_payload(json.dumps(output))
                    
                    # PURGE: Keep ONLY the summary and truncated fields for non-tech friendliness
                    clean_output = {"summary": summary_text}
                    for k, v in output.items():
                        if k == "summary": continue
                        val_str = str(v)
                        if len(val_str) > 500:
                            clean_output[k] = f"[Technical data truncated — See summary]"
                        else:
                            clean_output[k] = v
                    
                    self.context.store_summarized(node.id, clean_output)
                    node.output = clean_output
                except Exception as e:
                    logger.warning(f"Auto-summarization failed for {node.id}: {e}")
            else:
                node.output = output

            log_event("SUCCESS", node.id, "32")
            
        except Exception as e:
            node.state = TaskState.FAILED
            node.error = str(e)
            self.failed.add(node.id)
            log_event("FAILED", f"{node.id} (Terminal: {str(e)})", "31")

    # ─── Automatic Rollback Engine ──────────────────────────────────────
    ROLLBACK_MAP = {
        # tool: { action: (reverse_action, param_extractor) }
        "github": {
            "create_branch": ("delete_branch", lambda out: {"branch_name": out.get("branch_name", "")}),
            "create_issue": ("update_issue", lambda out: {"issue_number": out.get("issue_number"), "state": "closed"}),
            "create_pull_request": ("update_issue", lambda out: {"issue_number": out.get("pr_number"), "state": "closed"}),
        },
        "github_mcp": {
            "create_branch": ("delete_branch", lambda out: {"branch_name": out.get("branch_name", "")}),
        },
        "jira": {
            "create_issue": ("rollback", lambda out: {"issue_id": out.get("key") or out.get("issue_id", "")}),
        },
        "jira_mcp": {
            "create_issue": ("rollback", lambda out: {"issue_id": out.get("key") or out.get("issue_id", "")}),
        },
        "slack": {
            # Can't unsend a message, but we log it
        },
        "sheets": {
            # Can't easily undo an append, skip
        },
    }

    async def _auto_rollback(self):
        """Automatically undo all successfully completed nodes in reverse order."""
        # Collect nodes that completed successfully and have a known rollback action
        rollback_targets = []
        for node_id in self.completed:
            node = self.nodes[node_id]
            tool_map = self.ROLLBACK_MAP.get(node.tool, {})
            if node.action in tool_map:
                rollback_targets.append(node)
        
        if not rollback_targets:
            log_event("ROLLBACK", "No rollback-able actions found among completed steps.", "33")
            return
        
        # Reverse order: undo the last successful step first
        rollback_targets.reverse()
        
        print(f"\n{'='*60}")
        log_event("ROLLBACK", f"🔄 AUTO-ROLLBACK INITIATED — Undoing {len(rollback_targets)} completed step(s)", "33")
        print(f"{'='*60}\n")
        
        rollback_results = []
        for node in rollback_targets:
            tool_map = self.ROLLBACK_MAP[node.tool]
            reverse_action, param_fn = tool_map[node.action]
            reverse_params = param_fn(node.output)
            
            log_event("ROLLBACK", f"Undoing {node.id}: {node.tool}.{node.action} → {node.tool}.{reverse_action}", "33")
            
            try:
                result = await dispatch_mcp(node.tool, reverse_action, reverse_params, credentials=self.credentials)
                log_event("ROLLED_BACK", f"✅ {node.id} successfully reversed", "32")
                rollback_results.append({"node": node.id, "status": "rolled_back", "result": result})
            except Exception as e:
                log_event("ROLLBACK_FAIL", f"⚠️ Could not rollback {node.id}: {e}", "31")
                rollback_results.append({"node": node.id, "status": "rollback_failed", "error": str(e)})
        
        self._rollback_results = rollback_results

    async def run(self):
        """Topological event loop capable of resolving concurrent async events."""
        log_event("PLANNER", f"DAG loaded: {len(self.nodes)} tasks\n", "34")
        
        self._rollback_results = []
        pending_ids = set(self.nodes.keys())
        running_tasks = set()
        
        while pending_ids or running_tasks:
            ready_to_run = []
            
            for n_id in list(pending_ids):
                node = self.nodes[n_id]
                
                # Fast fail downstream nodes if dependency crashed or was skipped
                # BUT: Rollback/cleanup actions should STILL execute even on failure
                ROLLBACK_ACTIONS = {"rollback", "cleanup", "delete_branch", "delete_issue", "delete_branches_by_pattern"}
                is_rollback_node = node.action in ROLLBACK_ACTIONS
                
                if any(dep in self.failed or dep in self.skipped for dep in node.depends_on):
                    if is_rollback_node:
                        # Rollback nodes execute regardless — they clean up after failures
                        log_event("ROLLBACK", f"{node.id} executing despite upstream failure (cleanup mode)", "33")
                    else:
                        node.state = TaskState.SKIPPED
                        node.error = "Upstream dependency failed"
                        self.skipped.add(n_id)
                        pending_ids.remove(n_id)
                        log_event("SKIPPED", f"{node.id} (Dependency failure)", "90")
                        continue
                
                # Check if all dependencies are resolved (completed for normal, completed OR failed/skipped for rollback)
                if is_rollback_node:
                    deps_resolved = all(dep in self.completed or dep in self.failed or dep in self.skipped for dep in node.depends_on)
                else:
                    deps_resolved = all(dep in self.completed for dep in node.depends_on)
                
                if deps_resolved:
                    ready_to_run.append(n_id)
                    pending_ids.remove(n_id)
            
            # Submits newly unblocked tasks onto asyncio event loop
            for n_id in ready_to_run:
                task = asyncio.create_task(self._run_node(self.nodes[n_id]))
                running_tasks.add(task)
                
            # Yield control, wait for at least one routine to finish
            if running_tasks:
                done, running_tasks = await asyncio.wait(
                    running_tasks, return_when=asyncio.FIRST_COMPLETED
                )
            elif pending_ids:
                # If no tasks are running and we couldn't unblock any more, it's a real deadlock
                raise RuntimeError(f"Deadlock detected! Blocked nodes: {pending_ids}")

        # ─── AUTO-ROLLBACK on failure ───────────────────────────────────
        if self.failed:
            await self._auto_rollback()
        
        print("\n\033[1m[WORKFLOW COMPLETE]\033[0m")

# --- Runner ---
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Agentic DAG Executor")
    parser.add_argument("dag_file", nargs="?", default="sample_dag.json", help="Path to JSON DAG")
    args = parser.parse_args()

    with open(args.dag_file) as f:
        dag_data = json.load(f)
    try:
        asyncio.run(DAGExecutor(dag_data).run())
    except KeyboardInterrupt:
        print("\n[TERMINATED] Execution aborted by user.")
