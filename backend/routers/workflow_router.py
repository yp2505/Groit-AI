from fastapi import APIRouter, HTTPException, Request
import logging
import re
import base64
import os
import tempfile
import uuid
from typing import cast, List, Any
from schemas.dag_schema import WorkflowRequest, WorkflowDAG  # type: ignore
from services.models.llm_resolver import generate_dag  # type: ignore
from services.engine.dag_executor import DAGExecutor  # type: ignore
from config.settings import settings  # type: ignore
from groq import Groq
from groq.types.chat import ChatCompletionMessageParam

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
            messages=cast(List[ChatCompletionMessageParam], messages)
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

    if getattr(request, "attached_file_data", None) and getattr(request, "attached_file_name", None):
        try:
            data_str = request.attached_file_data
            encoded = data_str.split(",", 1)[1] if "," in data_str else data_str
            file_bytes = base64.b64decode(encoded)
            file_ext = os.path.splitext(request.attached_file_name)[1]
            unique_filename = f"{uuid.uuid4().hex}{file_ext}"
            file_path = os.path.join(tempfile.gettempdir(), unique_filename)
            with open(file_path, "wb") as f:
                f.write(file_bytes)
            
            sys_info = f"\n\n[SYSTEM INFO: The user attached a file named '{request.attached_file_name}'. It is saved locally at '{file_path}'. If you use a tool to send this file (like Gmail), you MUST pass this exact file path in the tool arguments. Also, you MUST always include a 'subject' and 'body' (e.g. 'File Attached' and 'Please find the attached file.') if the user did not specify one. Do not leave them empty.]"
            user_input += sys_info
            logger.info(f"Saved attached file to {file_path}")
        except Exception as e:
            logger.error(f"Failed to process attached file: {e}")

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
