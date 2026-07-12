"""
hitl.py — Human-in-the-Loop Approval Gate
Pauses execution on sensitive tasks and waits for explicit human approval.
"""

from .models import DAGNode, TaskStatus
from .observability import ExecutionLogger, YELLOW, BOLD, GREEN, RED, RESET


class HITLGate:
    def __init__(self, logger: ExecutionLogger, auto_approve: bool = False):
        """
        auto_approve: Set True in testing/demo mode to bypass prompts.
        In production, this is always False.
        """
        self.logger = logger
        self.auto_approve = auto_approve

    async def check(self, node: DAGNode) -> bool:
        """
        Returns True if execution should proceed, False if rejected.
        Blocks until the user responds (or auto-approves in demo mode).
        """
        if not node.requires_approval:
            return True  # No gate needed — pass through

        node.status = TaskStatus.WAITING_APPROVAL
        self.logger.node_approval_required(node)

        if self.auto_approve:
            print(f"  {GREEN}[AUTO-APPROVED — demo mode]{RESET}\n")
            return True

        while True:
            try:
                response = input(
                    f"\n  {YELLOW}{BOLD}  ➤  Approve this action? [y/n]: {RESET}"
                ).strip().lower()
            except (EOFError, KeyboardInterrupt):
                response = "n"

            if response == "y":
                print(f"  {GREEN}✔  Approved. Proceeding...{RESET}\n")
                return True
            elif response == "n":
                print(f"  {RED}✖  Rejected. Task will be skipped.{RESET}\n")
                return False
            else:
                print(f"  {YELLOW}  Please enter 'y' or 'n'.{RESET}")
