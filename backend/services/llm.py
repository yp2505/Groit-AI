"""
services/llm.py — Groq LLM Integration Service
Replaces Anthropic/Claude with Groq Llama 3.3-70B for ultra-fast DAG generation.
Consumes Prerita Shukla's system prompt. Returns validated DAG via Pydantic models.

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
import json
import re
import os
import time
import asyncio
import logging
from typing import Optional

from groq import Groq
from dotenv import load_dotenv

from api_schemas.dag import WorkflowDAG
from prompts.system_prompt import SYSTEM_PROMPT, RETRY_SUFFIX

load_dotenv()
logger = logging.getLogger("mcp_gateway.llm")

_toolkits_config = None

def _get_config():
    global _toolkits_config
    if _toolkits_config is None:
        try:
            import yaml
            config_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "toolkits.yaml")
            with open(config_path, "r") as f:
                _toolkits_config = yaml.safe_load(f)
        except Exception as e:
            logger.warning(f"Failed to load toolkits.yaml: {e}. Using empty config.")
            _toolkits_config = {"defaults": {}, "toolkits": {}}
    return _toolkits_config



# Fallback model order — tried in sequence when the primary model hits a rate-limit.
# Configured via GROQ_FALLBACK_MODELS env (comma-separated) or hardcoded defaults.
_DEFAULT_FALLBACK_MODELS = [
    "llama-3.3-70b-versatile",
    "llama3-8b-8192",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
]


def _get_groq_clients() -> list[tuple[str, Groq]]:
    """
    Build (model, Groq-client) pairs for every available key+model combination.
    Primary key gets all fallback models; extra keys (GROQ_API_KEY_2 …) also
    contribute the full model list so exhausting one key automatically rotates
    to the next.
    """
    # Collect all API keys from env
    keys: list[str] = []
    primary = os.getenv("GROQ_API_KEY", "").strip()
    if primary and primary != "your_groq_api_key_here":
        keys.append(primary)
    i = 2
    while True:
        extra = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
        if not extra:
            break
        keys.append(extra)
        i += 1

    if not keys:
        return []

    # Fallback models from env or defaults
    fallback_str = os.getenv("GROQ_FALLBACK_MODELS", "")
    models = [m.strip() for m in fallback_str.split(",") if m.strip()] if fallback_str else _DEFAULT_FALLBACK_MODELS

    # Produce pairs: first cycle through models on primary key, then repeat for extra keys
    pairs: list[tuple[str, Groq]] = []
    for key in keys:
        client = Groq(api_key=key)
        for model in models:
            pairs.append((model, client))
    return pairs


class LLMService:
    """
    Groq-powered LLM service for workflow DAG generation.

    Features:
    - Multi-model + multi-key fallback (rotates on 429 / rate-limit)
    - Calls Groq with Prerita's system prompt
    - JSON extraction from markdown-fenced or raw responses
    - Auto-retry with enhanced prompt on JSON parse failures
    - Pydantic validation of generated DAGs
    - Full audit trail of LLM calls
    """

    def __init__(self):
        api_key = os.getenv("GROQ_API_KEY", "")
        self.is_mock = not api_key or api_key == "your_groq_api_key_here"

        if self.is_mock:
            logger.warning("Using MOCK LLM Service - GROQ_API_KEY not set!")
            self.client = None
        else:
            self.client = Groq(api_key=api_key)
        self.model = os.getenv("LLM_MODEL", "llama-3.3-70b-versatile")
        self.max_tokens = int(os.getenv("LLM_MAX_TOKENS", "2048"))
        self.temperature = float(os.getenv("LLM_TEMPERATURE", "0.1"))
        self._call_history: list[dict] = []
        logger.info(f"LLM Service initialized — model={self.model}")

    # ─── Public API ────────────────────────────────────────────────

    async def generate_dag(
        self,
        user_input: str,
        context: Optional[dict] = None,
        max_retries: int = 2,
        user_id: Optional[str] = None,
    ) -> dict:
        if self.is_mock:
            # Return a standard sample DAG for the demo
            return self._generate_mock_dag(user_input)

        errors: list[str] = []
        raw_output = ""
        last_dag = None

        for attempt in range(1, max_retries + 2):
            try:
                # Build the prompt — append retry suffix on subsequent attempts
                system_content = SYSTEM_PROMPT
                if attempt > 1:
                    system_content += RETRY_SUFFIX

                # ── Dynamically append connected Composio toolkits ─────────
                # Fetched at request time so the LLM always sees the user's
                # current connections. Errors are silently ignored so they
                # never break DAG generation.
                if user_id:
                    try:
                        from services.integrations.composio_integration import list_connected_toolkits
                        composio_slugs = await list_connected_toolkits(user_id)
                        if composio_slugs:
                            slug_list = ", ".join(composio_slugs)
                            system_content += (
                                f"\n\nAvailable tools: {slug_list}\n"
                                f"Only use tools from the 'Available tools' list above. Never invent a tool name that isn't listed."
                            )
                            
                            # ── Dynamic Missing Info Rules ───────────────────
                            config = _get_config()
                            tool_configs = config.get("toolkits", {})
                            for slug in composio_slugs:
                                t_config = tool_configs.get(slug, {})
                                if t_config.get("requires_explicit_recipient"):
                                    system_content += (
                                        f"\n\n4. **NO {slug.upper()} HALLUCINATIONS**: If the user's request involves sending a message via `{slug}`, "
                                        f"they MUST explicitly state the recipient. If omitted, you MUST NOT guess or invent a placeholder. "
                                        f"Instead, output ONLY this single line:\n`MISSING_INFO: Please provide the recipient for {slug}.`"
                                    )
                                    
                            logger.info(f"Injected {len(composio_slugs)} Composio tools into prompt for user={user_id}")
                    except Exception as _ce:
                        logger.warning(f"Composio toolkit injection skipped: {_ce}")
                # ──────────────────────────────────────────────────────────

                user_content = user_input
                if context:
                    history = context.get("history", [])
                    if history:
                        hist_str = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in history])
                        user_content = f"=== Previous Conversation ===\n{hist_str}\n=============================\n\nUser: {user_input}"
                    else:
                        user_content += f"\n\nAdditional context: {json.dumps(context)}"


                # ── Groq call with multi-model / multi-key rate-limit fallback ────────
                # Build fallback pairs once per process (lazy singleton inside helper)
                groq_pairs = _get_groq_clients()
                if not groq_pairs:
                    logger.warning("No Groq clients available. Falling back to MOCK DAG.")
                    return self._generate_mock_dag(user_input)

                # Primary model first, then fallbacks
                primary_model = self.model
                ordered_pairs = sorted(
                    groq_pairs,
                    key=lambda p: (0 if p[0] == primary_model else 1)
                )

                response = None
                used_model = primary_model
                start_time = time.time()

                for try_model, try_client in ordered_pairs:
                    try:
                        logger.info(f"[Attempt {attempt}] Calling Groq model '{try_model}'...")
                        response = await asyncio.wait_for(
                            asyncio.to_thread(
                                try_client.chat.completions.create,
                                model=try_model,
                                max_tokens=self.max_tokens,
                                temperature=self.temperature,
                                messages=[
                                    {"role": "system", "content": system_content},
                                    {"role": "user", "content": user_content}
                                ]
                            ),
                            timeout=20.0
                        )
                        used_model = try_model
                        break  # Success — stop trying fallbacks
                    except Exception as ex:
                        err_str = str(ex)
                        is_rate_limit = (
                            "429" in err_str
                            or "rate_limit" in err_str.lower()
                            or "rate limit" in err_str.lower()
                            or "RateLimitError" in type(ex).__name__
                        )
                        if is_rate_limit:
                            logger.warning(
                                f"[Attempt {attempt}] Rate-limited on model '{try_model}', "
                                f"trying next fallback..."
                            )
                            continue
                        # Non-rate-limit error — give up on this Groq call
                        logger.warning(f"[Attempt {attempt}] Groq error on model '{try_model}': {ex}")
                        break

                if response is None:
                    logger.warning(f"[Attempt {attempt}] All Groq models exhausted. Falling back to MOCK DAG.")
                    return self._generate_mock_dag(user_input)

                elapsed_ms = (time.time() - start_time) * 1000
                raw_output = response.choices[0].message.content
                logger.info(f"[Attempt {attempt}] Groq '{used_model}' responded in {elapsed_ms:.0f}ms ({len(raw_output)} chars)")
                self.model = used_model  # update active model for audit log

                # Log the call
                self._log_call(attempt, user_input, raw_output, elapsed_ms)

                # Extract JSON from potential markdown fences
                clean_json = self._extract_json(raw_output)

                # Check for intentional non-JSON signals from system prompt rules
                clean_stripped = clean_json.strip()
                if clean_stripped.startswith(("MISSING_INFO:", "CONNECT_TOOLKIT:")):
                    logger.info(f"[Attempt {attempt}] Caught intentional LLM signal: {clean_stripped}")
                    return {
                        "success": False,
                        "dag": None,
                        "raw": clean_stripped,
                        "errors": [],
                        "attempts": attempt,
                        "model": self.model,
                    }

                # Parse JSON
                try:
                    dag_dict = json.loads(clean_json)
                except json.JSONDecodeError as e:
                    error_msg = f"Attempt {attempt}: JSON parse error — {e}"
                    errors.append(error_msg)
                    logger.warning(error_msg)
                    continue

                # Normalize LLM output to match our schema
                dag_dict = self._normalize_dag(dag_dict)

                # Validate through Pydantic
                try:
                    dag = WorkflowDAG(**dag_dict)
                    logger.info(f"[Attempt {attempt}] ✅ DAG validated — {len(dag.nodes)} nodes")
                    return {
                        "success": True,
                        "dag": dag,
                        "raw": raw_output,
                        "errors": [],
                        "attempts": attempt,
                        "model": self.model,
                        "latency_ms": elapsed_ms
                    }
                except Exception as e:
                    error_msg = f"Attempt {attempt}: Pydantic validation error — {e}"
                    errors.append(error_msg)
                    logger.warning(error_msg)
                    last_dag = dag_dict
                    continue

            except Exception as e:
                error_msg = f"Attempt {attempt}: Groq API error — {e}"
                errors.append(error_msg)
                logger.error(error_msg)
                # Don't retry on auth errors
                if "auth" in str(e).lower() or "api_key" in str(e).lower():
                    break

        # All attempts failed — return structured error
        logger.error(f"All {max_retries + 1} attempts failed for: {user_input[:100]}")
        return {
            "success": False,
            "dag": None,
            "raw": raw_output,
            "errors": errors,
            "attempts": max_retries + 1,
            "model": self.model,
            "latency_ms": 0
        }

    async def summarize_payload(self, text: str, max_chars: int = 2000) -> str:
        """
        Summarize a large API response via LLM before passing to context.
        Used when tool output exceeds SUMMARIZE_THRESHOLD.
        """
        if len(text) <= max_chars:
            return text

        from prompts.system_prompt import SUMMARIZE_PROMPT
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=512,
                temperature=0.0,
                messages=[
                    {"role": "user", "content": SUMMARIZE_PROMPT.format(response_text=text[:4000])}
                ]
            )
            summary = response.choices[0].message.content
            logger.info(f"Summarized payload: {len(text)} → {len(summary)} chars")
            return summary
        except Exception as e:
            logger.warning(f"Summarization failed, truncating: {e}")
            return text[:max_chars] + "...[truncated]"

    def get_call_history(self) -> list[dict]:
        """Return full LLM call history for audit."""
        return self._call_history.copy()

    # ─── Private Helpers ───────────────────────────────────────────

    @staticmethod
    def _extract_json(text: str) -> str:
        """
        Extract JSON from LLM output that may be wrapped in markdown fences.
        Handles: ```json ... ```, ``` ... ```, or raw JSON.
        """
        # Try markdown code fence extraction
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            return match.group(1).strip()

        # Try to find raw JSON object
        text = text.strip()
        brace_start = text.find("{")
        if brace_start != -1:
            # Find the matching closing brace
            depth = 0
            for i in range(brace_start, len(text)):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        return text[brace_start:i + 1]

        return text

    # Known tool keywords for parsing composite names like "create_github_branch"
    _TOOL_KEYWORDS = {
        "jira": "jira",
        "github": "github",
        "slack": "slack",
        "sheets": "sheets",
        "sheet": "sheets",
        "google": "sheets",
    }

    _ACTION_ALIASES = {
        "notify": "send_message",
        "send": "send_message",
        "post": "send_message",
        "message": "send_message",
        "get_ticket": "get_issue",
        "fetch": "get_issue",
        "create_ticket": "create_issue",
        "create_pr": "create_pull_request",
        "merge_pr": "merge_pull_request",
        "get_commits": "list_commits",
        "get_repo": "get_repository",
    }

    @classmethod
    def _infer_tool_action_from_name(cls, name: str) -> tuple[str, str]:
        """
        Parse a composite node name like 'create_github_branch' or 'get_jira_issue'
        into (tool, action).
        
        Strategy:
        1. Check if the name contains a known tool keyword.
        2. Remove the tool keyword to derive the action.
        3. Verify the action exists in VALID_TOOLS; if not, fuzzy-match.
        """
        from api_schemas.dag import VALID_TOOLS
        
        name_lower = name.lower().replace("-", "_").replace(" ", "_")
        
        # Try to find a tool keyword embedded in the name
        found_tool = None
        for keyword, tool_name in cls._TOOL_KEYWORDS.items():
            if keyword in name_lower:
                found_tool = tool_name
                # Remove the keyword from the name to get the action
                action_raw = name_lower.replace(keyword, "").strip("_")
                break
        
        if not found_tool:
            # Fallback: guess from the action name
            if any(w in name_lower for w in ["branch", "commit", "pr", "pull", "merge", "repo"]):
                found_tool = "github"
                action_raw = name_lower
            elif any(w in name_lower for w in ["issue", "ticket", "bug"]):
                found_tool = "jira"
                action_raw = name_lower
            elif any(w in name_lower for w in ["message", "notify", "alert", "slack"]):
                found_tool = "slack"
                action_raw = name_lower
            elif any(w in name_lower for w in ["row", "sheet", "log", "append"]):
                found_tool = "sheets"
                action_raw = name_lower
            else:
                return ("jira", "get_issue")  # Safe default
        
        # Clean up the action: "create__branch" -> "create_branch"
        action_clean = re.sub(r"_+", "_", action_raw).strip("_")
        
        # Check if action_clean is in our alias map
        if action_clean in cls._ACTION_ALIASES:
            action_clean = cls._ACTION_ALIASES[action_clean]
        
        # Check if the exact action is valid for this tool
        valid_actions = VALID_TOOLS.get(found_tool, set())
        if action_clean in valid_actions:
            return (found_tool, action_clean)
        
        # Fuzzy match: find the best matching valid action
        for valid_action in valid_actions:
            if valid_action in action_clean or action_clean in valid_action:
                return (found_tool, valid_action)
        
        # Last resort: pick a sensible default for the tool
        defaults = {
            "jira": "get_issue",
            "github": "create_branch",
            "slack": "send_message",
            "sheets": "append_row",
        }
        return (found_tool, defaults.get(found_tool, "get_issue"))

    @classmethod
    def _normalize_dag(cls, dag_dict: dict) -> dict:
        """
        Normalize LLM output to match WorkflowDAG schema.
        
        Handles multiple LLM output styles:
        - Standard: {id, tool, action, params}
        - Name-only: {name: "create_github_branch", params: {...}}
        - Hierarchical: {service: "github", tool: "github.create_branch"}
        """
        # Ensure workflow_name exists
        if "workflow_name" not in dag_dict:
            dag_dict["workflow_name"] = dag_dict.get(
                "title", dag_dict.get("name", dag_dict.get("workflow_id", "unnamed_workflow"))
            )

        # Map 'steps'/'tasks' to 'nodes'
        for alt_key in ("steps", "tasks"):
            if alt_key in dag_dict and "nodes" not in dag_dict:
                dag_dict["nodes"] = dag_dict.pop(alt_key)

        # Normalize each node
        nodes = dag_dict.get("nodes", [])
        for i, node in enumerate(nodes):
            # ── 1. Ensure 'id' exists ─────────────────────────────────────
            if "id" not in node:
                node["id"] = node.get("name", node.get("node_id", f"node_{i+1}"))
            
            # ── 2. Ensure 'tool' and 'action' exist ──────────────────────
            has_tool = "tool" in node and node["tool"]
            has_action = "action" in node and node["action"]
            
            # Case A: Hierarchical schema (service + dotted tool)
            service = node.get("service")
            tool_raw = node.get("tool", "")
            if service and "." in str(tool_raw):
                node["tool"] = service
                node["action"] = str(tool_raw).split(".")[-1]
                has_tool = True
                has_action = True
            
            # Case B: Missing tool/action — infer from 'name'
            if not has_tool or not has_action:
                node_name = node.get("name", "") or node.get("id", "")
                if node_name:
                    inferred_tool, inferred_action = cls._infer_tool_action_from_name(node_name)
                    if not has_tool:
                        node["tool"] = inferred_tool
                    if not has_action:
                        node["action"] = inferred_action
            
            # ── 3. Normalize params ───────────────────────────────────────
            for alt in ("inputs", "args"):
                if alt in node and "params" not in node:
                    node["params"] = node.pop(alt)
            if "params" not in node:
                node["params"] = {}

            # ── 4. Force HITL for sensitive operations ────────────────────
            config = _get_config()
            destructive_keywords = config.get("defaults", {}).get("destructive_keywords", [])
            
            action_name = node.get("action", "").lower()
            if action_name and any(kw in action_name for kw in destructive_keywords):
                node["requires_approval"] = True

            
            # ── 5. Ensure depends_on is a list ────────────────────────────
            if "depends_on" not in node or node["depends_on"] is None:
                node["depends_on"] = []

        return dag_dict

    def _log_call(self, attempt: int, user_input: str, output: str, latency_ms: float):
        """Record LLM call for audit trail."""
        self._call_history.append({
            "attempt": attempt,
            "model": self.model,
            "input_preview": user_input[:200],
            "output_length": len(output),
            "latency_ms": round(latency_ms, 1),
            "timestamp": time.time()
        })


    def _generate_mock_dag(self, user_input: str) -> dict:
        """Generates a static dummy DAG for demonstration when no LLM key is present."""
        logger.info(f"Generating mock DAG for input: {user_input}")
        
        # Simple heuristic to pick a template
        dag_dict = {
            "workflow_id": "wf-mock-" + str(int(time.time())),
            "workflow_name": "Demo: " + user_input[:30],
            "description": f"Mock workflow generated for: {user_input}",
            "nodes": [
                {
                    "id": "task_1",
                    "name": "Scan Input",
                    "tool": "jira",
                    "action": "get_issue",
                    "params": {"issue_id": "MOCK-101"},
                    "depends_on": [],
                    "requires_approval": False,
                    "retry": {"max_attempts": 3, "backoff_factor": 2.0, "initial_delay": 1.0, "timeout": 10}
                },
                {
                    "id": "task_2",
                    "name": "Sync with Github",
                    "tool": "github",
                    "action": "create_branch",
                    "params": {"branch_name": "fix/mock-101", "ref": "{{task_1.output.key}}", "user_confirmed": True},
                    "depends_on": ["task_1"],
                    "requires_approval": False,
                    "retry": {"max_attempts": 3, "backoff_factor": 2.0, "initial_delay": 1.0, "timeout": 10}
                },
                {
                    "id": "task_3",
                    "name": "Notify Team",
                    "tool": "slack",
                    "action": "send_message",
                    "params": {"channel": "#alerts", "message": "Started work on {{task_1.output.summary}}"},
                    "depends_on": ["task_1"],
                    "requires_approval": False,
                    "retry": {"max_attempts": 3, "backoff_factor": 2.0, "initial_delay": 1.0, "timeout": 10}
                }
            ]
        }
        
        return {
            "success": True,
            "dag": WorkflowDAG(**dag_dict),
            "raw": json.dumps(dag_dict, indent=2),
            "errors": [],
            "attempts": 1,
            "model": "mock-mode",
            "latency_ms": 150.0
        }


# ─── Module-level convenience (backward compatible with prompt_engine.py) ───

_service: Optional[LLMService] = None

def get_llm_service() -> LLMService:
    """Singleton accessor for the LLM service."""
    global _service
    if _service is None:
        _service = LLMService()
    return _service
