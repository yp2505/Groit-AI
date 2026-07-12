"""
models/execution.py — Execution State Models
Tracks runtime state of each node and the overall workflow execution.

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
import uuid
from .dag import WorkflowDAG


class NodeStatus(str, Enum):
    """Lifecycle states for a DAG node during execution."""
    PENDING           = "pending"
    RUNNING           = "running"
    SUCCESS           = "success"
    FAILED            = "failed"
    AWAITING_APPROVAL = "awaiting_approval"
    SKIPPED           = "skipped"
    RETRYING          = "retrying"


class WorkflowStatus(str, Enum):
    """Overall workflow execution status."""
    PENDING    = "pending"
    RUNNING    = "running"
    COMPLETED  = "completed"
    FAILED     = "failed"
    PARTIAL    = "partial"  # Some nodes succeeded, some failed


class NodeExecutionResult(BaseModel):
    """Result of executing a single DAG node."""
    node_id: str
    node_name: Optional[str] = None
    tool: str
    action: str
    status: NodeStatus = NodeStatus.PENDING
    output: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    retries: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    requires_approval: bool = False
    approved: Optional[bool] = None


class WorkflowExecution(BaseModel):
    """Full state of a workflow execution session."""
    execution_id: str = Field(default_factory=lambda: f"exec-{uuid.uuid4().hex[:12]}")
    workflow_name: str = ""
    dag: Optional[WorkflowDAG] = None
    status: WorkflowStatus = WorkflowStatus.PENDING
    node_results: dict[str, NodeExecutionResult] = Field(default_factory=dict)
    chat_history: list[dict[str, str]] = Field(default_factory=list)
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    completed_at: Optional[str] = None
    total_nodes: int = 0
    succeeded: int = 0
    failed: int = 0
    skipped: int = 0

    def mark_complete(self):
        """Finalize execution state based on node results."""
        self.completed_at = datetime.now(timezone.utc).isoformat()
        self.succeeded = sum(1 for r in self.node_results.values() if r.status == NodeStatus.SUCCESS)
        self.failed = sum(1 for r in self.node_results.values() if r.status == NodeStatus.FAILED)
        self.skipped = sum(1 for r in self.node_results.values() if r.status == NodeStatus.SKIPPED)

        if self.failed == 0 and self.skipped == 0:
            self.status = WorkflowStatus.COMPLETED
        elif self.succeeded > 0:
            self.status = WorkflowStatus.PARTIAL
        else:
            self.status = WorkflowStatus.FAILED

    def to_sse_event(self, node_id: str, event_type: str = "node_update") -> dict:
        """Format a node result as an SSE-friendly event."""
        result = self.node_results.get(node_id)
        return {
            "event": event_type,
            "data": {
                "execution_id": self.execution_id,
                "node_id": node_id,
                "status": result.status.value if result else "unknown",
                "output": result.output if result else None,
                "error": result.error if result else None,
                "duration_ms": result.duration_ms if result else 0,
            }
        }
