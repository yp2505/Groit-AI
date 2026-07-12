"""
routers/plan.py — POST /plan Endpoint
Takes natural language workflow description → returns validated DAG JSON.
This is the primary interface for Tejas's Next.js frontend.

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, Request

from api_schemas.requests import PlanRequest, PlanResponse
from api_schemas.dag import WorkflowDAG
from services.llm import get_llm_service
from services.audit import get_audit_logger

logger = logging.getLogger("mcp_gateway.router.plan")

router = APIRouter(prefix="/plan", tags=["Planning"])


@router.post(
    "",
    response_model=PlanResponse,
    summary="Generate workflow DAG from natural language",
    description=(
        "Takes a natural language workflow description and generates a validated "
        "DAG (Directed Acyclic Graph) using Groq Llama 3.3-70B. "
        "The DAG can then be passed to POST /execute for execution."
    ),
    responses={
        200: {"description": "DAG generated successfully"},
        422: {"description": "Invalid input"},
        500: {"description": "LLM service error"},
    }
)
async def create_plan(request: PlanRequest, http_request: Request) -> PlanResponse:
    """
    POST /plan
    
    Calls Prerita's prompt → Groq Llama → validated DAG JSON.
    
    Example request body:
    {
        "user_input": "Critical bug filed in Jira → Create GitHub branch → Notify Slack → Update incident tracker"
    }
    """
    logger.info(f"Plan request: {request.user_input[:100]}...")
    audit = get_audit_logger()

    try:
        llm = get_llm_service()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Call LLM to generate DAG (pass user_id so Composio tools are injected)
    user_id = http_request.headers.get("X-User-Id") or "anonymous"
    result = await llm.generate_dag(
        user_input=request.user_input,
        context=request.context,
        user_id=user_id,
    )

    # Log LLM call to audit
    audit.log_llm_call(
        execution_id="plan-request",
        model=result.get("model", "unknown"),
        input_preview=request.user_input[:200],
        output_length=len(result.get("raw", "")),
        latency_ms=result.get("latency_ms", 0),
        attempt=result.get("attempts", 1)
    )

    if result["success"]:
        dag: WorkflowDAG = result["dag"]
        logger.info(f"✅ DAG generated: {dag.workflow_name} ({len(dag.nodes)} nodes)")
        return PlanResponse(
            success=True,
            dag=dag,
            raw_llm_output=result.get("raw"),
            errors=[],
            attempts=result["attempts"],
            model_used=result["model"]
        )
    else:
        logger.warning(f"❌ DAG generation failed after {result['attempts']} attempts")
        return PlanResponse(
            success=False,
            dag=None,
            raw_llm_output=result.get("raw"),
            errors=result["errors"],
            attempts=result["attempts"],
            model_used=result["model"]
        )


@router.post(
    "/validate",
    summary="Validate a DAG without generating one",
    description="Validates an existing DAG JSON against the schema."
)
async def validate_dag(dag: WorkflowDAG) -> dict:
    """
    POST /plan/validate
    
    Validates DAG structure: tool/action pairs, dependencies, cycles.
    Returns execution order layers showing parallelism.
    """
    execution_order = dag.get_execution_order()
    return {
        "valid": True,
        "workflow_name": dag.workflow_name,
        "total_nodes": len(dag.nodes),
        "execution_layers": execution_order,
        "parallel_opportunities": sum(1 for layer in execution_order if len(layer) > 1),
        "nodes": [
            {
                "id": n.id,
                "tool": n.tool,
                "action": n.action,
                "depends_on": n.depends_on,
                "requires_approval": n.requires_approval
            }
            for n in dag.nodes
        ]
    }
