"""
hitl_async.py — Asynchronous Human-in-the-Loop Approval Gate for FastAPI
"""

import asyncio
from typing import Dict
from .models import DAGNode, TaskStatus
from .observability import ExecutionLogger, YELLOW, BOLD, GREEN, RED, RESET


class AsyncHITLGate:
    def __init__(self, logger: ExecutionLogger, auto_approve: bool = False):
        self.logger = logger
        self.auto_approve = auto_approve
        # Dictionary bridging node_id to an asyncio.Event that executor waits on
        self.pending_approvals: Dict[str, asyncio.Event] = {}
        # Stores the boolean result of the approval (True/False)
        self.approval_results: Dict[str, bool] = {}

    async def check(self, node: DAGNode) -> bool:
        if not node.requires_approval:
            return True

        node.status = TaskStatus.WAITING_APPROVAL
        self.logger.node_approval_required(node)

        if self.auto_approve:
            print(f"  {GREEN}[AUTO-APPROVED — demo mode]{RESET}\n")
            return True

        # Create an event to wait on for this node
        event = asyncio.Event()
        self.pending_approvals[node.id] = event

        print(f"\n  {YELLOW}{BOLD}  ➤  Waiting for API approval on node '{node.id}'...{RESET}")
        
        # Block this task's execution until the API triggers the event
        await event.wait()

        # Retrieve the result set by the API
        result = self.approval_results.get(node.id, False)

        # Cleanup memory
        self.pending_approvals.pop(node.id, None)
        self.approval_results.pop(node.id, None)

        if result:
            print(f"  {GREEN}✔  Node '{node.id}' approved via API. Proceeding...{RESET}\n")
            return True
        else:
            print(f"  {RED}✖  Node '{node.id}' rejected via API. Skipping task...{RESET}\n")
            return False

    def trigger_approval(self, node_id: str, approved: bool):
        """Called by FastAPI endpoints to resolve the pending gate."""
        if node_id in self.pending_approvals:
            self.approval_results[node_id] = approved
            self.pending_approvals[node_id].set()
            return True
        return False
