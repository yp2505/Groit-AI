"""
routers/langchain_execute.py — POST /v2/execute Endpoint

Isolated LangChain + Composio plan-and-execute endpoint.
Follows the same APIRouter / X-User-Id header / PlanRequest-style Pydantic
model pattern as routers/plan.py.

DO NOT modify any existing router or service — this is purely additive.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

from services.langchain_agent import run_langchain_workflow

logger = logging.getLogger("mcp_gateway.router.langchain_execute")

router = APIRouter(prefix="/v2", tags=["LangChain"])


class V2ExecuteRequest(BaseModel):
    user_input: str


@router.post(
    "/execute",
    summary="LangChain + Composio plan-and-execute (v2)",
    description=(
        "Accepts a natural-language instruction, builds a fresh LangChain "
        "AgentExecutor scoped to the authenticated user's Composio connections, "
        "and executes the instruction end-to-end. "
        "Completely isolated from the existing /plan and /execute pipeline."
    ),
    responses={
        200: {"description": "Agent completed successfully"},
        500: {"description": "Agent or LLM error"},
    },
)
async def v2_execute(request: V2ExecuteRequest, http_request: Request) -> dict:
    """
    POST /v2/execute

    Headers:
        X-User-Id : Composio entity/user identifier (e.g. thehackhub07@gmail.com)
                    Falls back to "anonymous" if omitted.

    Body:
        { "user_input": "post the list of my repos on slack channel kiwi-chat" }
    """
    user_id: str = http_request.headers.get("X-User-Id") or "anonymous"
    logger.info(
        "POST /v2/execute — user_id=%s input=%.120s", user_id, request.user_input
    )
    return await run_langchain_workflow(request.user_input, user_id)
