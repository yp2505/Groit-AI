"""
models/requests.py — API Request/Response Schemas
Defines the FastAPI endpoint contracts for /plan and /execute.

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field
from .dag import WorkflowDAG


# ─── Plan Endpoint ──────────────────────────────────────────────────

class PlanRequest(BaseModel):
    """POST /plan — request body."""
    user_input: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Natural language workflow description",
        json_schema_extra={"examples": [
            "Critical bug filed in Jira → Create GitHub branch → Notify Slack → Update incident tracker"
        ]}
    )
    context: Optional[dict[str, Any]] = Field(
        default=None,
        description="Optional context from previous interactions"
    )
    chat_history: Optional[list[dict[str, str]]] = Field(
        default_factory=list,
        description="Leading conversation history to be saved with the workflow"
    )


class PlanResponse(BaseModel):
    """POST /plan — response body."""
    success: bool = Field(..., description="Whether DAG generation succeeded")
    dag: Optional[WorkflowDAG] = Field(default=None, description="Generated workflow DAG")
    raw_llm_output: Optional[str] = Field(default=None, description="Raw LLM response for debugging")
    errors: list[str] = Field(default_factory=list, description="Validation or generation errors")
    attempts: int = Field(default=1, description="Number of LLM attempts made")
    model_used: str = Field(default="llama-3.3-70b-versatile", description="LLM model used")


# ─── Execute Endpoint ───────────────────────────────────────────────

class ExecuteRequest(BaseModel):
    """POST /execute — request body."""
    dag: WorkflowDAG = Field(..., description="The DAG to execute")
    auto_approve: bool = Field(
        default=True,
        description="If True, skip HITL approval gates (demo mode)"
    )
    dry_run: bool = Field(
        default=False,
        description="If True, simulate execution without calling real tools"
    )
    credentials: Optional[dict[str, Any]] = Field(
        default=None,
        description="User-specific credentials from the ConnectTools dashboard"
    )
    chat_history: Optional[list[dict[str, str]]] = Field(
        default_factory=list,
        description="Full conversation history to persist"
    )


class ExecuteResponse(BaseModel):
    """POST /execute — final response (non-streaming)."""
    execution_id: str
    success: bool
    total_nodes: int
    succeeded: int
    failed: int
    skipped: int
    results: list[dict[str, Any]] = Field(default_factory=list)
    audit_log: list[dict[str, Any]] = Field(default_factory=list)


# ─── Health Endpoint ────────────────────────────────────────────────

class HealthResponse(BaseModel):
    """GET /health — response body."""
    status: str = "healthy"
    version: str = "1.0.0"
    llm_model: str = ""
    services: dict[str, str] = Field(default_factory=dict)
