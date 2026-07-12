"""
executor.py — The Core DAG Execution Engine

Responsible for:
1. Resolving dependencies (is this node ready?)
2. Resolving input templates {{task_1.output.id}}
3. Handling parallel execution
4. Managing HITL approvals
5. Handling failures with exponential backoff
"""

import asyncio
import re
from typing import Callable, Awaitable

from .models import DAG, DAGNode, TaskStatus
from .hitl import HITLGate
from .observability import ExecutionLogger

# Typedef for the MCP caller function signature
MCPDispatcherType = Callable[[str, str, dict], Awaitable[dict]]

class DAGExecutor:
    def __init__(self, dag: DAG, mcp_dispatcher: MCPDispatcherType, hitl: HITLGate, logger: ExecutionLogger, original_prompt: str = ""):
        self.dag = dag
        self.mcp_dispatcher = mcp_dispatcher
        self.hitl = hitl
        self.logger = logger
        self.original_prompt = original_prompt
        
        self.nodes = self.dag.node_map()
        self.completed_nodes: dict[str, DAGNode] = {}
        self.failed_nodes: set[str] = set()
        self.skipped_nodes: set[str] = set()
        
        # Initially, all nodes are pending
        self.pending_node_ids = set(self.nodes.keys())

    def _is_ready(self, node: DAGNode) -> bool:
        """A node is ready when all its dependencies have SUCCESSFULLY completed."""
        for dep_id in node.depends_on:
            if dep_id not in self.completed_nodes:
                return False
        return True

    def _has_failed_dependency(self, node: DAGNode) -> bool:
        """Check if any upstream dependency failed or was skipped."""
        for dep_id in node.depends_on:
            if dep_id in self.failed_nodes or dep_id in self.skipped_nodes:
                return True
        return False

    def _resolve_inputs(self, node: DAGNode) -> dict:
        """
        Parses inputs for templates like {{task_id.output.field}}
        and replaces them with actual values from completed nodes.
        Supports templates embedded within longer strings.
        """
        resolved = {}
        pattern = re.compile(r"\{\{([^.]+)\.([^}]+)\}\}")
        
        def repl(match):
            ref_task, field = match.groups()
            if ref_task in self.completed_nodes:
                val = self.completed_nodes[ref_task].output.get(field)
                if val is None:
                    return f"[missing {field}]"
                return str(val)
            else:
                return f"[{ref_task} not run]"

        for key, value in node.inputs.items():
            if isinstance(value, str):
                resolved[key] = pattern.sub(repl, value)
            else:
                resolved[key] = value
                
        return resolved

    async def _execute_with_retry(self, node: DAGNode, resolved_inputs: dict) -> dict:
        """Executes the task using the provided MCP dispatcher, handling retries."""
        delay = node.retry.initial_delay
        
        while node.attempts < node.retry.max_attempts:
            node.attempts += 1
            try:
                node.status = TaskStatus.RUNNING
                result = await self.mcp_dispatcher(node.tool, node.action, resolved_inputs)
                return result
            except Exception as e:
                # If we've reached max attempts, raise
                if node.attempts >= node.retry.max_attempts:
                    raise e
                    
                # SELF-HEALING via LLM
                import sys, os
                prompt_engine_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                if prompt_engine_dir not in sys.path:
                    sys.path.append(prompt_engine_dir)
                try:
                    from prompt_engine import generate_recovery_params
                    # Ask LLM to fix parameters based on the error
                    resolved_inputs = generate_recovery_params(
                        tool=node.tool, 
                        action=node.action, 
                        failed_inputs=resolved_inputs, 
                        error_message=str(e), 
                        original_prompt=self.original_prompt
                    )
                    self.logger.node_retry(node, node.attempts, delay, f"Self-healing injected params: {resolved_inputs}")
                except Exception as he:
                    self.logger.node_retry(node, node.attempts, delay, f"Self-healing failed: {he}")

                # Otherwise back off
                await asyncio.sleep(delay)
                delay *= node.retry.backoff_factor

    async def _run_node(self, node_id: str):
        """Worker task to execute a single node lifecycle."""
        node = self.nodes[node_id]
        
        # 1. Start logging
        self.logger.node_start(node)
        
        # 2. Wait for HITL context if required
        approved = await self.hitl.check(node)
        if not approved:
            self.skipped_nodes.add(node_id)
            self.logger.node_skipped(node, "rejected by user")
            return

        # 3. Resolve inputs
        try:
            resolved_inputs = self._resolve_inputs(node)
        except Exception as e:
            self.failed_nodes.add(node_id)
            self.logger.node_failed(node, f"Input resolution failed: {e}")
            return

        # 4. Execute with retries
        try:
            output = await self._execute_with_retry(node, resolved_inputs)
            node.output = output
            self.completed_nodes[node_id] = node
            self.logger.node_success(node)
        except Exception as e:
            self.failed_nodes.add(node_id)
            self.logger.node_failed(node, str(e))

    async def run(self):
        """Main coordinator loops until all tasks are done or blocked."""
        self.logger.workflow_start(self.dag.description)
        
        while self.pending_node_ids:
            ready_to_run = []
            
            # Identify nodes that can run right now or need to be skipped
            for node_id in list(self.pending_node_ids):
                node = self.nodes[node_id]
                
                # Check for skipped dependencies (fail fast)
                if self._has_failed_dependency(node):
                    self.pending_node_ids.remove(node_id)
                    self.skipped_nodes.add(node_id)
                    self.logger.node_skipped(node, "upstream dependency failed/skipped")
                    continue
                    
                if self._is_ready(node):
                    self.pending_node_ids.remove(node_id)
                    ready_to_run.append(node_id)

            if not ready_to_run:
                # We have pending nodes but none are ready. And none were just skipped.
                # This implies a cyclic dependency or unresolvable wait loop.
                if self.pending_node_ids:
                    print(f"Deadlock detected! Pending tasks: {self.pending_node_ids}")
                    break

            # Execute the ready nodes in parallel
            await asyncio.gather(*(self._run_node(nid) for nid in ready_to_run))

        self.logger.workflow_complete(
            succeeded=len(self.completed_nodes),
            failed=len(self.failed_nodes),
            total=len(self.nodes)
        )
