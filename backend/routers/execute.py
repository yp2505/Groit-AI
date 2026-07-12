"""
routers/execute.py — POST /execute Endpoint + SSE Streaming
Triggers Grishma's DAG Execution Engine via HTTP/SSE adapter bridge.

Shivam's role: HTTP layer + SSE streaming + audit logging.
Grishma's role: Core execution logic (retry, HITL, parallel scheduling).

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from api_schemas.requests import ExecuteRequest, ExecuteResponse
from api_schemas.dag import WorkflowDAG
from services.executor import ExecutionBridge
from services.audit import get_audit_logger
from services.execution_store import get_execution_store

logger = logging.getLogger("mcp_gateway.router.execute")

router = APIRouter(prefix="/execute", tags=["Execution"])


@router.post(
    "",
    response_model=ExecuteResponse,
    summary="Execute a workflow DAG",
    description=(
        "Executes a validated DAG through the execution engine. "
        "Runs nodes in topological order with parallelism for independent nodes. "
        "Returns final execution results with per-node status."
    )
)
async def execute_workflow(request: ExecuteRequest, http_request: Request) -> ExecuteResponse:
    """
    POST /execute (synchronous response)
    
    Runs the DAG and returns results after all nodes complete.
    For real-time updates, use POST /execute/stream instead.
    """
    # FRONTEND_PAYLOAD Capture
    print("\n" + "="*50)
    print("FRONTEND_TRIGGERED_EXECUTION")
    print(f"FRONTEND_PAYLOAD = {request.model_dump_json(indent=2)}")
    print("="*50 + "\n")

    logger.info(f"Execute request: {request.dag.workflow_name} ({len(request.dag.nodes)} nodes)")

    # Inject user_id into credentials so Composio calls are scoped per-user.
    # Priority: X-User-Id header > existing credentials.user_id > "anonymous"
    credentials = dict(request.credentials or {})
    user_id = (
        http_request.headers.get("X-User-Id")
        or credentials.get("user_id")
        or "anonymous"
    )
    credentials["user_id"] = user_id
    logger.info(f"Execute: resolved user_id={user_id}")

    # Bridge to Grishma's execution engine via HTTP adapter
    bridge = ExecutionBridge(
        dag=request.dag,
        auto_approve=request.auto_approve,
        dry_run=request.dry_run,
        credentials=credentials,
        chat_history=request.chat_history
    )

    # BACKEND_RECEIVED_PAYLOAD Trace
    print(f"BACKEND_RECEIVED_PAYLOAD = {request.model_dump_json(indent=2)}\n")

    try:
        execution = await bridge.run()
    except Exception as e:
        logger.error(f"Execution engine error: {e}")
        raise HTTPException(status_code=500, detail=f"Execution failed: {e}")

    return ExecuteResponse(
        execution_id=execution.execution_id,
        success=execution.failed == 0,
        total_nodes=execution.total_nodes,
        succeeded=execution.succeeded,
        failed=execution.failed,
        skipped=execution.skipped,
        results=[
            {
                "node_id": r.node_id,
                "name": r.node_name,
                "tool": r.tool,
                "action": r.action,
                "status": r.status.value,
                "output": r.output,
                "error": r.error,
                "duration_ms": round(r.duration_ms, 1),
                "retries": r.retries
            }
            for r in execution.node_results.values()
        ],
        audit_log=get_audit_logger().get_logs_by_execution(execution.execution_id)
    )


@router.post(
    "/stream",
    summary="Execute DAG with SSE streaming",
    description=(
        "Executes a validated DAG and streams real-time events via Server-Sent Events. "
        "Events include: workflow_start, node_start, node_running, node_success, "
        "node_failed, node_retry, node_skipped, hitl_required, workflow_complete."
    )
)
async def execute_workflow_stream(request: ExecuteRequest, http_request: Request) -> StreamingResponse:
    """
    POST /execute/stream (SSE streaming response)
    
    Frontend connects with:
      const source = new EventSource('/execute/stream');
      
    Or using fetch with ReadableStream for POST body support.
    """
    logger.info(f"Stream execute: {request.dag.workflow_name} ({len(request.dag.nodes)} nodes)")

    # Inject user_id into credentials so Composio calls are scoped per-user.
    # Priority: X-User-Id header > existing credentials.user_id > "anonymous"
    credentials = dict(request.credentials or {})
    user_id = (
        http_request.headers.get("X-User-Id")
        or credentials.get("user_id")
        or "anonymous"
    )
    credentials["user_id"] = user_id
    logger.info(f"Stream execute: resolved user_id={user_id}")

    # Bridge to Grishma's execution engine via HTTP adapter
    bridge = ExecutionBridge(
        dag=request.dag,
        auto_approve=request.auto_approve,
        dry_run=request.dry_run,
        credentials=credentials,
        chat_history=request.chat_history
    )

    async def event_generator():
        """Generate SSE events bridged from Grishma's executor."""
        # Start execution in background
        exec_task = asyncio.create_task(bridge.run())

        # Stream events as they arrive
        try:
            async for event in bridge.stream_events():
                event_type = event.get("event", "message")
                data = event.get("data", "{}")
                yield f"event: {event_type}\ndata: {data}\n\n"
        except asyncio.CancelledError:
            logger.warning("SSE stream cancelled by client")
            exec_task.cancel()
            return

        # Wait for execution to finish
        try:
            execution = await exec_task
            # Send final summary
            summary = {
                "execution_id": execution.execution_id,
                "status": execution.status.value,
                "succeeded": execution.succeeded,
                "failed": execution.failed,
                "skipped": execution.skipped,
                "results": [
                    {
                        "node_id": r.node_id,
                        "status": r.status.value,
                        "output": r.output,
                        "error": r.error
                    }
                    for r in execution.node_results.values()
                ]
            }
            yield f"event: execution_summary\ndata: {json.dumps(summary)}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@router.get(
    "/status",
    summary="Get execution status",
    description="Retrieves the current status and results of a workflow execution by ID."
)
async def get_execution_status(id: str = Query(..., description="Execution ID")) -> dict:
    """
    GET /execute/status?id={execution_id}
    
    Returns the current execution status, node results, and audit log.
    Called by frontend to poll execution progress.
    Also searches by workflow_id if execution_id not found.
    """
    store = get_execution_store()
    execution = await store.fetch_from_db(id)
    
    # If not found by execution_id, try searching by workflow_id
    if not execution:
        executions = await store.refresh_all()
        for exec_id, exec_record in executions.items():
            if exec_record.execution_id == id or (hasattr(exec_record, 'dag') and exec_record.dag.workflow_id == id):
                execution = exec_record
                break
    
    if not execution:
        raise HTTPException(status_code=404, detail=f"Execution {id} not found")
    
    return {
        "execution_id": execution.execution_id,
        "workflow_id": execution.dag.workflow_id if execution.dag else id,
        "status": execution.status.value,
        "succeeded": execution.succeeded,
        "failed": execution.failed,
        "skipped": execution.skipped,
        "total_nodes": execution.total_nodes,
        "results": [
            {
                "node_id": r.node_id,
                "name": r.node_name,
                "tool": r.tool,
                "action": r.action,
                "status": r.status.value,
                "output": r.output,
                "error": r.error,
                "duration_ms": round(r.duration_ms, 1),
                "retries": r.retries
            }
            for r in execution.node_results.values()
        ],
        "audit_log": get_audit_logger().get_logs_by_execution(execution.execution_id),
        "chat_history": execution.chat_history
    }


@router.post(
    "/approve/{execution_id}/{node_id}",
    summary="Approve a HITL gate",
    description="Approves a pending human-in-the-loop approval for a specific node."
)
async def approve_hitl(execution_id: str, node_id: str, approved: bool = True) -> dict:
    """
    POST /execute/approve/{execution_id}/{node_id}
    
    Called by frontend when user approves/rejects a sensitive operation.
    In the current hackathon demo, HITL is handled via auto_approve flag.
    This endpoint is scaffolded for production use.
    """
    audit = get_audit_logger()
    audit.log_hitl_decision(execution_id, node_id, "unknown", "unknown", approved)

    return {
        "execution_id": execution_id,
        "node_id": node_id,
        "approved": approved,
        "message": f"Node {node_id} {'approved' if approved else 'rejected'}"
    }
