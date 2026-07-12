"""
observability.py — Structured Execution Logger
Tracks every node's lifecycle: status, timing, inputs, outputs, errors.
"""

import json
from datetime import datetime, timezone
from .models import DAGNode, TaskStatus

RESET   = "\033[0m"
BOLD    = "\033[1m"
GREEN   = "\033[92m"
YELLOW  = "\033[93m"
RED     = "\033[91m"
CYAN    = "\033[96m"
MAGENTA = "\033[95m"
BLUE    = "\033[94m"
DIM     = "\033[2m"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _status_color(status: TaskStatus) -> str:
    return {
        TaskStatus.PENDING:          DIM + "⏳ PENDING",
        TaskStatus.WAITING_APPROVAL: YELLOW + "🔒 APPROVAL",
        TaskStatus.RUNNING:          CYAN + "🔄 RUNNING",
        TaskStatus.SUCCESS:          GREEN + "✅ SUCCESS",
        TaskStatus.FAILED:           RED + "❌ FAILED",
        TaskStatus.SKIPPED:          DIM + "⏭  SKIPPED",
    }.get(status, status.value) + RESET


class ExecutionLogger:
    def __init__(self, workflow_id: str):
        self.workflow_id = workflow_id
        self.logs: list[dict] = []

    def _print_banner(self, text: str, color: str = CYAN):
        print(f"\n{color}{BOLD}{'─'*60}{RESET}")
        print(f"{color}{BOLD}  {text}{RESET}")
        print(f"{color}{BOLD}{'─'*60}{RESET}")

    def workflow_start(self, description: str):
        self._print_banner(f"🚀 WORKFLOW STARTED: {self.workflow_id}")
        print(f"  {DIM}{description}{RESET}\n")

    def workflow_complete(self, succeeded: int, failed: int, total: int):
        color = GREEN if failed == 0 else RED
        self._print_banner(
            f"🏁 WORKFLOW COMPLETE  |  ✅ {succeeded}/{total}  ❌ {failed}/{total}",
            color=color
        )

    def node_start(self, node: DAGNode):
        ts = _now()
        node.started_at = ts
        print(f"  {CYAN}▶ [{node.id}]{RESET} {BOLD}{node.name}{RESET}")
        print(f"    {DIM}Tool: {node.tool} → {node.action}{RESET}")
        self._log(node, "started", ts)

    def node_approval_required(self, node: DAGNode):
        print(f"\n  {YELLOW}{BOLD}🔒 APPROVAL GATE: {node.name}{RESET}")
        print(f"  {YELLOW}Tool   : {node.tool}{RESET}")
        print(f"  {YELLOW}Action : {node.action}{RESET}")
        print(f"  {YELLOW}Inputs : {json.dumps(node.inputs, indent=5)}{RESET}")

    def node_retry(self, node: DAGNode, attempt: int, delay: float, error: str):
        print(f"    {YELLOW}⚠  Attempt {attempt} failed → retrying in {delay:.1f}s{RESET}")
        print(f"    {DIM}   Reason: {error}{RESET}")

    def node_success(self, node: DAGNode):
        ts = _now()
        node.completed_at = ts
        node.status = TaskStatus.SUCCESS
        print(f"  {GREEN}✅ [{node.id}] {node.name} — SUCCESS{RESET}")
        if node.output:
            print(f"    {DIM}Output: {json.dumps(node.output)}{RESET}")
        self._log(node, "success", ts)

    def node_failed(self, node: DAGNode, error: str):
        ts = _now()
        node.completed_at = ts
        node.status = TaskStatus.FAILED
        node.error = error
        print(f"  {RED}❌ [{node.id}] {node.name} — FAILED after {node.attempts} attempt(s){RESET}")
        print(f"    {DIM}Error: {error}{RESET}")
        self._log(node, "failed", ts)

    def node_skipped(self, node: DAGNode, reason: str):
        ts = _now()
        node.status = TaskStatus.SKIPPED
        print(f"  {DIM}⏭  [{node.id}] {node.name} — SKIPPED ({reason}){RESET}")
        self._log(node, "skipped", ts)

    def print_summary(self):
        self._print_banner("📋 EXECUTION SUMMARY", color=BLUE)
        print(f"  {'Task ID':<12} {'Name':<28} {'Status':<22} {'Attempts'}")
        print(f"  {'─'*12} {'─'*28} {'─'*22} {'─'*8}")
        for log in self.logs:
            if log["event"] in ("success", "failed", "skipped"):
                status_str = _status_color(TaskStatus(log["status"]))
                print(f"  {log['task_id']:<12} {log['task_name']:<28} {status_str:<30} {log['attempts']}")
        print()

    def export_logs(self) -> list[dict]:
        """Return structured logs — can be sent to a DB, Grafana, etc."""
        return self.logs

    def _log(self, node: DAGNode, event: str, ts: str):
        self.logs.append({
            "workflow_id":  self.workflow_id,
            "task_id":      node.id,
            "task_name":    node.name,
            "tool":         node.tool,
            "action":       node.action,
            "event":        event,
            "status":       node.status.value,
            "attempts":     node.attempts,
            "timestamp":    ts,
            "output":       node.output,
            "error":        node.error,
        })
