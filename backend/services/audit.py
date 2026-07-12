"""
services/audit.py — Audit Logger & Security Compliance
Logs every API call, LLM invocation, and tool execution for audit trail.
Implements the security requirement: "all API calls are logged for audit purposes."

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
import json
import time
import logging
import asyncio
from datetime import datetime, timezone
from typing import Any, Optional
from enum import Enum
from services.mongodb_client import MongoDBClient

logger = logging.getLogger("mcp_gateway.audit")


class AuditEventType(str, Enum):
    """Categories of auditable events."""
    LLM_CALL        = "llm_call"
    TOOL_INVOCATION  = "tool_invocation"
    TOOL_SUCCESS     = "tool_success"
    TOOL_FAILURE     = "tool_failure"
    TOOL_RETRY       = "tool_retry"
    HITL_REQUESTED   = "hitl_requested"
    HITL_APPROVED    = "hitl_approved"
    HITL_REJECTED    = "hitl_rejected"
    WORKFLOW_START   = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    CONTEXT_STORE    = "context_store"
    PERMISSION_CHECK = "permission_check"
    ERROR            = "error"


class AuditEntry:
    """A single audit log entry."""

    def __init__(
        self,
        event_type: AuditEventType,
        details: dict[str, Any],
        execution_id: Optional[str] = None,
        node_id: Optional[str] = None,
        tool: Optional[str] = None,
        action: Optional[str] = None,
        user_id: str = "system"
    ):
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.event_type = event_type
        self.execution_id = execution_id
        self.node_id = node_id
        self.tool = tool
        self.action = action
        self.user_id = user_id
        self.details = details

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "event_type": self.event_type.value,
            "execution_id": self.execution_id,
            "node_id": self.node_id,
            "tool": self.tool,
            "action": self.action,
            "user_id": self.user_id,
            "details": self.details
        }


class AuditLogger:
    """
    In-memory audit logger with structured event recording.
    
    Security compliance features:
    - Every tool invocation logged with params and response
    - HITL approval/rejection tracked
    - LLM calls recorded with latency and token usage
    - Permission checks audited
    - Full query support for audit review
    """

    def __init__(self):
        self._entries: list[AuditEntry] = []
        self._start_time = time.time()

    # ─── Event Recording ───────────────────────────────────────────

    def log_workflow_start(self, execution_id: str, workflow_name: str, user_input: str) -> None:
        self._record(AuditEventType.WORKFLOW_START, {
            "workflow_name": workflow_name,
            "user_input_preview": user_input[:500],
            "user_input_length": len(user_input)
        }, execution_id=execution_id)

    def log_workflow_complete(
        self, execution_id: str, succeeded: int, failed: int, total: int, duration_ms: float
    ) -> None:
        self._record(AuditEventType.WORKFLOW_COMPLETE, {
            "succeeded": succeeded,
            "failed": failed,
            "total": total,
            "duration_ms": round(duration_ms, 1)
        }, execution_id=execution_id)

    def log_llm_call(
        self, execution_id: str, model: str, input_preview: str,
        output_length: int, latency_ms: float, attempt: int
    ) -> None:
        self._record(AuditEventType.LLM_CALL, {
            "model": model,
            "input_preview": input_preview[:200],
            "output_length": output_length,
            "latency_ms": round(latency_ms, 1),
            "attempt": attempt
        }, execution_id=execution_id)

    def log_tool_invocation(
        self, execution_id: str, node_id: str, tool: str, action: str,
        params: dict[str, Any]
    ) -> None:
        # Sanitize sensitive params before logging
        sanitized = self._sanitize_params(params)
        self._record(AuditEventType.TOOL_INVOCATION, {
            "params": sanitized
        }, execution_id=execution_id, node_id=node_id, tool=tool, action=action)

    def log_tool_success(
        self, execution_id: str, node_id: str, tool: str, action: str,
        output: dict[str, Any], duration_ms: float
    ) -> None:
        self._record(AuditEventType.TOOL_SUCCESS, {
            "output_preview": str(output)[:500],
            "duration_ms": round(duration_ms, 1)
        }, execution_id=execution_id, node_id=node_id, tool=tool, action=action)

    def log_tool_failure(
        self, execution_id: str, node_id: str, tool: str, action: str,
        error: str, attempt: int
    ) -> None:
        self._record(AuditEventType.TOOL_FAILURE, {
            "error": error,
            "attempt": attempt
        }, execution_id=execution_id, node_id=node_id, tool=tool, action=action)

    def log_tool_retry(
        self, execution_id: str, node_id: str, tool: str, action: str,
        attempt: int, delay: float, error: str
    ) -> None:
        self._record(AuditEventType.TOOL_RETRY, {
            "attempt": attempt,
            "delay_seconds": delay,
            "error": error
        }, execution_id=execution_id, node_id=node_id, tool=tool, action=action)

    def log_hitl_request(self, execution_id: str, node_id: str, tool: str, action: str) -> None:
        self._record(AuditEventType.HITL_REQUESTED, {
            "message": "Human approval required for sensitive operation"
        }, execution_id=execution_id, node_id=node_id, tool=tool, action=action)

    def log_hitl_decision(
        self, execution_id: str, node_id: str, tool: str, action: str, approved: bool
    ) -> None:
        event_type = AuditEventType.HITL_APPROVED if approved else AuditEventType.HITL_REJECTED
        self._record(event_type, {
            "decision": "approved" if approved else "rejected"
        }, execution_id=execution_id, node_id=node_id, tool=tool, action=action)

    def log_error(self, execution_id: str, error: str, context: Optional[dict] = None) -> None:
        self._record(AuditEventType.ERROR, {
            "error": error,
            "context": context or {}
        }, execution_id=execution_id)

    # ─── Query API ─────────────────────────────────────────────────

    def get_all_logs(self) -> list[dict[str, Any]]:
        """Return all audit entries as dicts."""
        return [e.to_dict() for e in self._entries]

    def get_logs_by_execution(self, execution_id: str) -> list[dict[str, Any]]:
        """Get logs for a specific workflow execution."""
        return [
            e.to_dict() for e in self._entries
            if e.execution_id == execution_id
        ]

    def get_logs_by_type(self, event_type: AuditEventType) -> list[dict[str, Any]]:
        """Get logs filtered by event type."""
        return [
            e.to_dict() for e in self._entries
            if e.event_type == event_type
        ]

    def get_security_events(self) -> list[dict[str, Any]]:
        """Get all security-relevant events (HITL, permissions, errors)."""
        security_types = {
            AuditEventType.HITL_REQUESTED,
            AuditEventType.HITL_APPROVED,
            AuditEventType.HITL_REJECTED,
            AuditEventType.PERMISSION_CHECK,
            AuditEventType.ERROR,
        }
        return [
            e.to_dict() for e in self._entries
            if e.event_type in security_types
        ]

    def get_stats(self) -> dict[str, Any]:
        """Return summary statistics of all audit events."""
        type_counts: dict[str, int] = {}
        for e in self._entries:
            key = e.event_type.value
            type_counts[key] = type_counts.get(key, 0) + 1

        return {
            "total_events": len(self._entries),
            "events_by_type": type_counts,
            "uptime_seconds": round(time.time() - self._start_time, 1)
        }

    # ─── Private ───────────────────────────────────────────────────

    def _record(self, event_type: AuditEventType, details: dict[str, Any], **kwargs) -> None:
        entry = AuditEntry(event_type=event_type, details=details, **kwargs)
        self._entries.append(entry)

        # Fire-and-forget to MongoDB
        db = MongoDBClient.get_db()
        if db is not None:
            try:
                # We use create_task because this method is called from synchronous context
                # and we don't want to block the execution flow for logging.
                asyncio.create_task(db.audit_logs.insert_one(entry.to_dict()))
            except Exception as e:
                logger.error(f"Failed to queue audit log to MongoDB: {e}")

        logger.debug(f"[AUDIT] {event_type.value}: {json.dumps(details)[:200]}")

    @staticmethod
    def _sanitize_params(params: dict[str, Any]) -> dict[str, Any]:
        """Remove sensitive values from params before logging."""
        sensitive_keys = {"password", "token", "secret", "api_key", "credential"}
        sanitized = {}
        for k, v in params.items():
            if any(s in k.lower() for s in sensitive_keys):
                sanitized[k] = "***REDACTED***"
            else:
                sanitized[k] = v
        return sanitized


# ─── Global audit logger singleton ─────────────────────────────────
_audit_logger: Optional[AuditLogger] = None

def get_audit_logger() -> AuditLogger:
    global _audit_logger
    if _audit_logger is None:
        _audit_logger = AuditLogger()
    return _audit_logger
