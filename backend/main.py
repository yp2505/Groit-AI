"""
main.py — Agentic MCP Gateway FastAPI Application
Entry point for the backend API server.

Author: Shivam Kumar (LLM Systems Developer)
Team: Quintessential Quincoders — Tic Tech Toe '26

Endpoints:
  GET  /health          — Health check + system status
  POST /plan            — Generate DAG from natural language
  POST /plan/validate   — Validate an existing DAG
  POST /execute         — Execute DAG (synchronous response)
  POST /execute/stream  — Execute DAG (SSE streaming)
  POST /execute/approve — HITL approval gate
  GET  /audit/logs      — Retrieve audit trail
  GET  /audit/stats     — Audit statistics
"""

from __future__ import annotations
import os
import asyncio
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from routers.plan import router as plan_router
from routers.execute import router as execute_router
from routers.auth import router as auth_router
from routers.integrations import router as integrations_router
from routers.slack import router as slack_router
from routers.langchain_execute import router as langchain_execute_router  # v2 isolated endpoint
from services.audit import get_audit_logger
from services.execution_store import get_execution_store
from services.mongodb_client import MongoDBClient
from api_schemas.execution import WorkflowStatus

# ─── Environment & Logging ─────────────────────────────────────────
# Load .env from backend/ or from parent project root
if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")
else:
    load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-28s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("mcp_gateway")


# ─── Application Lifespan ──────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle hooks."""
    # ── Startup ──
    logger.info("=" * 60)
    logger.info("  Agentic MCP Gateway — Starting Up")
    logger.info("=" * 60)

    # Validate critical environment
    groq_key = os.getenv("GROQ_API_KEY", "")
    if not groq_key or groq_key == "your_groq_api_key_here":
        logger.warning("⚠  GROQ_API_KEY not configured! POST /plan will fail.")
        logger.warning("   Get your free key at https://console.groq.com")
    else:
        logger.info(f"✅ GROQ_API_KEY configured (ends with ...{groq_key[-4:]})")

    model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
    logger.info(f"✅ LLM Model: {model}")
    logger.info(f"✅ CORS Origins: {os.getenv('CORS_ORIGINS', 'http://localhost:3000')}")
    logger.info("✅ Audit logger initialized")
    logger.info("─" * 60)
    logger.info("  Server ready — Endpoints:")
    logger.info("    POST /plan           → Generate DAG from NL")
    logger.info("    POST /plan/validate  → Validate DAG schema")
    logger.info("    POST /execute        → Run DAG (sync)")
    logger.info("    POST /execute/stream → Run DAG (SSE)")
    logger.info("    GET  /health         → System health")
    logger.info("    GET  /audit/logs     → Audit trail")
    logger.info("─" * 60)

    # Initialize MongoDB if URI is provided
    await MongoDBClient.connect()

    yield

    # ── Shutdown ──
    await MongoDBClient.close()
    logger.info("Agentic MCP Gateway — Shutting down")


# ─── FastAPI Application ───────────────────────────────────────────
app = FastAPI(
    title="Agentic MCP Gateway",
    description=(
        "AI-powered orchestration layer that connects to multiple third-party services "
        "via MCP servers, understands natural language workflow descriptions, decomposes "
        "them into executable DAG steps, and orchestrates cross-service operations."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ─── CORS Middleware (for Tejas's Next.js frontend) ────────────────
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Mount Routers ─────────────────────────────────────────────────
app.include_router(plan_router)
app.include_router(execute_router)
app.include_router(auth_router)
app.include_router(integrations_router)
app.include_router(slack_router)
app.include_router(langchain_execute_router)  # v2 — LangChain+Composio (isolated, additive)


# ─── Root Endpoint ────────────────────────────────────────────────
@app.get("/", tags=["System"])
async def root():
    """Welcome endpoint with API information."""
    return {
        "message": "🚀 Agentic MCP Gateway",
        "version": "1.0.0",
        "status": "running",
        "documentation": {
            "swagger": "http://localhost:8000/docs",
            "redoc": "http://localhost:8000/redoc"
        },
        "endpoints": {
            "plan": {"method": "POST", "path": "/plan", "description": "Generate DAG from natural language"},
            "plan_validate": {"method": "POST", "path": "/plan/validate", "description": "Validate DAG schema"},
            "execute": {"method": "POST", "path": "/execute", "description": "Execute DAG (sync)"},
            "execute_stream": {"method": "POST", "path": "/execute/stream", "description": "Execute DAG (SSE streaming)"},
            "health": {"method": "GET", "path": "/health", "description": "System health check"},
            "audit_logs": {"method": "GET", "path": "/audit/logs", "description": "Audit trail"}
        }
    }


# ─── Health Check ──────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """System health check with service status."""
    groq_key = os.getenv("GROQ_API_KEY", "")
    groq_ok = bool(groq_key and groq_key != "your_groq_api_key_here")

    return {
        "status": "healthy",
        "version": "1.0.0",
        "llm_model": os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
        "services": {
            "groq_api": "connected" if groq_ok else "not_configured",
            "jira_mcp": "live",
            "github_mcp": "live",
            "slack_mcp": "live",
            "sheets_mcp": "live",
        },
        "features": {
            "dag_generation": True,
            "parallel_execution": True,
            "retry_with_backoff": True,
            "hitl_approval": True,
            "sse_streaming": True,
            "audit_logging": True,
            "context_management": True,
            "payload_summarization": groq_ok,
        }
    }


@app.get("/status", tags=["Execution"])
async def get_execution_status(id: str):
    """Retrieve the current status of a workflow execution by ID."""
    store = get_execution_store()
    execution = await store.fetch_from_db(id)
    
    if not execution:
        # If not found in live store, check audit logs or return 404
        logger.warning(f"Status requested for unknown execution: {id}")
        raise HTTPException(status_code=404, detail="Workflow execution not found")

    return {
        "execution_id": execution.execution_id,
        "status": execution.status.value,
        "title": execution.workflow_name,
        "nodes": [
            {
                "id": r.node_id,
                "title": r.node_name or r.node_id,
                "tool": r.tool,
                "action": r.action,
                "status": r.status.value,
                "output": r.output,
                "error": r.error,
                "duration": f"{round(r.duration_ms / 1000, 1)}s" if r.duration_ms > 0 else None,
                "retries": r.retries
            }
            for r in execution.node_results.values()
        ],
        "audit_log": get_audit_logger().get_logs_by_execution(execution.execution_id),
        "edges": [
            {"source": dep, "target": n.id}
            for n in execution.dag.nodes
            for dep in n.depends_on
        ] if execution.dag else [],
        "total_nodes": execution.total_nodes,
        "succeeded": execution.succeeded,
        "failed": execution.failed,
        "skipped": execution.skipped,
        "created_at": execution.started_at
    }


@app.get("/active-workflows", tags=["Execution"])
async def get_active_workflows():
    """Retrieve all currently active workflow executions."""
    store = get_execution_store()
    executions = await store.refresh_all()
    return {
        "workflows": [
            {
                "workflow_id": e.execution_id,
                "status": e.status.value,
                "title": e.dag.workflow_name if e.dag else "Unnamed Workflow",
                "created_at": e.start_time if hasattr(e, 'start_time') else e.started_at,
                "nodes": [
                    {
                        "id": r.node_id,
                        "status": r.status.value,
                        "tool": r.tool,
                        "action": r.action
                    }
                    for r in e.node_results.values()
                ]
            }
            for e in executions.values()
        ]
    }


@app.websocket("/ws/status/{execution_id}")
async def websocket_endpoint(websocket: WebSocket, execution_id: str):
    """
    WebSocket endpoint for real-time execution status updates.
    Frontend connects to receive live updates as the DAG runs.
    """
    await websocket.accept()
    logger.info(f"WebSocket connected: {execution_id}")
    
    store = get_execution_store()
    
    try:
        while True:
            # Check for updates in the store
            execution = await store.fetch_from_db(execution_id)
            if execution:
                # Send current status
                await websocket.send_json({
                    "execution_id": execution.execution_id,
                    "status": execution.status.value,
                    "title": execution.workflow_name,
                    "nodes": [
                        {
                            "id": r.node_id,
                            "title": r.node_name or r.node_id,
                            "status": r.status.value,
                            "outputs": r.output,
                            "error": r.error
                        }
                        for r in execution.node_results.values()
                    ],
                    "edges": [
                        {"source": dep, "target": n.id}
                        for n in execution.dag.nodes
                        for dep in n.depends_on
                    ] if execution.dag else []
                })
                
                # If terminal state, close connection after a short delay
                if execution.status in [WorkflowStatus.COMPLETED, WorkflowStatus.FAILED]:
                    await asyncio.sleep(2)
                    await websocket.close()
                    break
            
            # Simple polling interval for the websocket broadcast loop
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {execution_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


# ─── Audit Endpoints ──────────────────────────────────────────────
@app.get("/audit/logs", tags=["Audit"])
async def get_audit_logs(
    execution_id: str | None = None,
    event_type: str | None = None
):
    """Retrieve audit logs, optionally filtered by execution_id or event_type."""
    audit = get_audit_logger()

    if execution_id:
        return {"logs": audit.get_logs_by_execution(execution_id)}

    if event_type:
        from services.audit import AuditEventType
        try:
            et = AuditEventType(event_type)
            return {"logs": audit.get_logs_by_type(et)}
        except ValueError:
            return {"error": f"Unknown event type: {event_type}", "valid_types": [e.value for e in AuditEventType]}

    return {"logs": audit.get_all_logs()}


@app.get("/audit/stats", tags=["Audit"])
async def get_audit_stats():
    """Get audit event statistics."""
    return get_audit_logger().get_stats()


@app.get("/audit/security", tags=["Audit"])
async def get_security_events():
    """Get security-relevant events (HITL, permissions, errors)."""
    return {"events": get_audit_logger().get_security_events()}


# ─── Run with Uvicorn (if executed directly) ──────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
        log_level="info"
    )
