from fastapi import APIRouter, HTTPException, Request
import logging
import re
from schemas.dag_schema import WorkflowRequest, WorkflowDAG  # type: ignore
from services.models.llm_resolver import generate_dag  # type: ignore
from services.engine.dag_executor import DAGExecutor  # type: ignore
from config.settings import settings  # type: ignore
from groq import Groq

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v3", tags=["Workflow"])

# ─── Keywords that signal an actual workflow / agentic task ───────────────────
WORKFLOW_KEYWORDS = [
    "send", "create", "post", "fetch", "get", "update", "delete", "schedule",
    "email", "message", "slack", "github", "jira", "notion", "calendar",
    "sheet", "notify", "commit", "branch", "issue", "ticket", "event",
    "meeting", "reminder", "report", "workflow", "task", "draft", "reply",
    "forward", "close", "open", "assign", "merge", "push", "pull",
]

def is_workflow_request(text: str) -> bool:
    """Returns True if the input looks like an agentic workflow command."""
    lower = text.lower().strip()
    # Short messages (< 5 words) with no workflow keywords are conversational
    word_count = len(lower.split())
    has_keyword = any(kw in lower for kw in WORKFLOW_KEYWORDS)
    if word_count <= 4 and not has_keyword:
        return False
    return has_keyword or word_count > 8


def chat_with_groq(user_input: str, chat_history: list) -> str:
    """Use Groq to respond conversationally when no workflow is detected."""
    groq_client = Groq(api_key=settings.GROQ_API_KEY)
    messages = [
        {
            "role": "system",
            "content": (
                "You are Groit AI, an intelligent agentic assistant that can execute "
                "workflows across Gmail, Slack, GitHub, Jira, Google Calendar, Notion, "
                "and more via Composio. When users greet you or ask general questions, "
                "respond helpfully and suggest what workflows you can run for them. "
                "Keep responses concise and friendly."
            )
        }
    ]
    # Add last few turns of chat history
    for turn in (chat_history or [])[-6:]:
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_input})

    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            max_tokens=512,
            messages=messages
        )
        return response.choices[0].message.content or "Hello! How can I help you today?"
    except Exception as e:
        logger.error(f"Groq chat failed: {e}")
        return "Hello! I'm Groit AI. Tell me a workflow to execute, like 'Send a Slack message to #general' or 'Create a GitHub issue'."


@router.post("/execute")
async def execute_workflow(request: WorkflowRequest, http_request: Request):
    """
    1. If input is conversational → respond with Groq chat directly
    2. If input is a workflow command → parse DAG → execute via Composio
    """
    user_id = http_request.headers.get("X-User-Id", "anonymous")
    user_input = (request.user_input or "").strip()
    chat_history = getattr(request, "chat_history", []) or []

    logger.info(f"Received execute request: '{user_input[:60]}' from user: {user_id}")

    # ── Step 1: Detect conversational vs workflow ──────────────────────────────
    if not request.dag and not is_workflow_request(user_input):
        logger.info("Detected conversational message — responding with Groq chat.")
        reply = chat_with_groq(user_input, chat_history)
        return {
            "dag": {"workflow_name": "chat", "nodes": []},
            "execution": {
                "workflow_name": "chat",
                "status": "completed",
                "results": {},
                "chat_reply": reply
            }
        }

    # ── Step 2: Parse natural language into DAG ───────────────────────────────
    try:
        if request.dag:
            dag = request.dag
        elif user_input:
            dag_json = generate_dag(user_input)
            dag = WorkflowDAG(**dag_json)
        else:
            raise ValueError("Must provide either user_input or dag")
    except Exception as e:
        logger.error(f"Failed to generate or parse DAG: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate or parse DAG: {str(e)}")

    # ── Step 3: Execute DAG ───────────────────────────────────────────────────
    try:
        executor = DAGExecutor(dag=dag, user_id=user_id, credentials=request.credentials)
        results = await executor.execute()
        return {
            "dag": dag.model_dump(),
            "execution": results
        }
    except Exception as e:
        logger.error(f"Failed to execute DAG: {e}")
        raise HTTPException(status_code=500, detail=f"Execution engine failure: {str(e)}")
