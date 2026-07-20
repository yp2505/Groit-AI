import os
import asyncio
import json
import logging
from typing import Optional, Any
from dotenv import load_dotenv
import yaml
from groq import Groq


try:
    from composio import Composio
except ImportError:
    Composio = None

load_dotenv()
logger = logging.getLogger("mcp_gateway.composio_integration")

# Module-level singletons
_composio_client = None
_toolkits_config = None

# ── Rate-limit resilience helpers ────────────────────────────────────────────

_groq_key_pool: list[str] = []
_groq_key_index: int = 0


def _build_key_pool() -> list[str]:
    """Collect all GROQ_API_KEY, GROQ_API_KEY_2 … GROQ_API_KEY_N from env."""
    keys: list[str] = []
    primary = os.getenv("GROQ_API_KEY", "").strip()
    if primary:
        keys.append(primary)
    i = 2
    while True:
        extra = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
        if not extra:
            break
        keys.append(extra)
        i += 1
    return keys


def get_next_available_key() -> str:
    """
    Round-robin across the Groq API key pool.
    Returns the next key in the rotation so callers get a fresh key each call.
    Falls back gracefully if the pool is empty (callers will get an auth error
    from Groq, which is better than a silent KeyError here).
    """
    global _groq_key_pool, _groq_key_index
    if not _groq_key_pool:
        _groq_key_pool = _build_key_pool()
    if not _groq_key_pool:
        # No keys at all — return empty string; Groq will return an auth error
        return os.getenv("GROQ_API_KEY", "")
    key = _groq_key_pool[_groq_key_index % len(_groq_key_pool)]
    _groq_key_index += 1
    return key


def call_with_fallback(
    model: str,
    messages: Any,
    tools: Any,
    tool_choice: Any = "required",
    temperature: float = 0,
    max_tokens: int = 512,
) -> Any:
    """
    Synchronous (blocking) wrapper that tries every key in the pool for a
    single `model`. On a 429 (rate-limit) it rotates to the next key and
    retries immediately. On any other error it re-raises so the caller can
    move on to the next model in the fallback list.

    Must be called inside asyncio.to_thread() since it is blocking.
    """
    global _groq_key_pool
    if not _groq_key_pool:
        _groq_key_pool = _build_key_pool()

    keys_to_try = _groq_key_pool if _groq_key_pool else [os.getenv("GROQ_API_KEY", "")]
    last_err: Exception | None = None

    for key in keys_to_try:
        try:
            client = Groq(api_key=key)
            return client.chat.completions.create(
                model=model,
                messages=messages,
                tools=tools,
                tool_choice=tool_choice,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as exc:
            err_str = str(exc)
            if "429" in err_str or "rate_limit" in err_str.lower() or "rate limit" in err_str.lower():
                logger.warning(
                    f"call_with_fallback: 429 on key ...{key[-4:]} for model '{model}', rotating key"
                )
                last_err = exc
                continue  # try next key
            # Non-429 error — re-raise so the model loop can skip to next model
            raise

    # Every key exhausted for this model
    raise RuntimeError(
        f"All {len(keys_to_try)} Groq key(s) are rate-limited for model '{model}'"
    ) from last_err


def _get_config():
    global _toolkits_config
    if _toolkits_config is None:
        try:
            config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config", "toolkits.yaml")
            with open(config_path, "r") as f:
                _toolkits_config = yaml.safe_load(f)
        except Exception as e:
            logger.warning(f"Failed to load toolkits.yaml: {e}. Using empty config.")
            _toolkits_config = {"defaults": {}, "toolkits": {}}
    return _toolkits_config


def _get_client():
    global _composio_client
    if _composio_client is None:
        api_key = os.getenv("COMPOSIO_API_KEY")
        if not api_key:
            raise ValueError("COMPOSIO_API_KEY is missing. Please connect your Composio account.")
        if Composio is None:
            raise ImportError("composio is not installed. Run pip install composio.")
        _composio_client = Composio(
            api_key=api_key,
            dangerously_allow_auto_upload_download_files=True,
            file_upload_dirs=['/tmp', '/tmp/']
        )
    return _composio_client


async def get_composio_tools(
    user_id: str,
    toolkits: Optional[list[str]] = None,
) -> list[Any]:
    """
    Fetches live Composio tool schemas for the given user.
    Each tool is already an OpenAI/Groq function-calling dict:
      {"type": "function", "function": {"name": "...", "description": "...", "parameters": {...}}}

    Args:
        user_id:   Composio entity / user identifier.
        toolkits:  Optional list of toolkit slugs to filter by (e.g. ["github"]).
    """
    client = _get_client()
    logger.info(f"Fetching Composio tool schemas for user_id={user_id}, toolkits={toolkits}")

    def _fetch():
        config = _get_config()
        limit = config.get("defaults", {}).get("schema_search_limit", 100)
        kwargs: dict[str, Any] = {"user_id": user_id, "limit": limit}
        if toolkits:
            kwargs["toolkits"] = toolkits
        return client.tools.get(**kwargs)

    tools = await asyncio.to_thread(_fetch)
    logger.info(f"Fetched {len(tools)} Composio tool schema(s) for user={user_id}")
    return tools


async def list_connected_toolkits(user_id: str) -> list[str]:
    """
    Returns a deduplicated list of app/toolkit slug strings that the given
    user has connected on Composio (e.g. ["linear", "notion", "google-calendar"]).

    Falls back to an empty list on any error so it never blocks the LLM call.
    """
    try:
        client = _get_client()

        def _fetch():
            try:
                res = client.connected_accounts.list(user_ids=[user_id]).items
                slugs = []
                for conn in res:
                    dump = conn.model_dump() if hasattr(conn, "model_dump") else getattr(conn, "dict", lambda: {})()
                    
                    # Only return toolkits that the user has fully authenticated
                    status = dump.get("status", "").upper()
                    if status != "ACTIVE":
                        continue

                    toolkit_info = dump.get("toolkit", {}) or getattr(conn, "toolkit", {})
                    slug = (
                        toolkit_info.get("slug") if isinstance(toolkit_info, dict) else getattr(toolkit_info, "slug", None)
                        or getattr(conn, "app_name", None)
                        or getattr(conn, "appName", None)
                    )
                    if slug:
                        slugs.append(slug.lower())
                return list(dict.fromkeys(slugs))  # deduplicate, preserve order
            except Exception as inner:
                logger.warning(f"list_connected_toolkits inner fetch failed: {inner}")
                return []

        slugs = await asyncio.to_thread(_fetch)
        logger.info(f"Composio connected toolkits for {user_id}: {slugs}")
        return slugs

    except Exception as e:
        logger.warning(f"list_connected_toolkits failed (non-fatal): {e}")
        return []


async def composio_llm_dispatch(
    tool_slug: str,
    action: str,
    node_intent: str,
    params: dict,
    user_id: str,
    groq_client,
    model: str,
) -> dict:
    """
    Two-step LLM-guided Composio dispatch — mirrors runNodeRequest() from kiwiChat:

    1. Fetch live tool schemas for `tool_slug` from Composio (user-scoped).
    2. Ask Groq to pick the correct function + arguments from those schemas.
    3. Execute the LLM-chosen function via Composio.

    This prevents the 404 "tool not found" error caused by blindly forwarding
    the planner's guessed action name.

    Args:
        tool_slug:   The toolkit identifier (e.g. "github", "linear").
        action:      The raw action string from the DAG (e.g. "send_email") used for searching schemas.
        node_intent: Natural-language description of what to do (action + params).
        params:      Raw params dict from the DAG node (used as hint context).
        user_id:     Composio entity identifier for the authenticated user.
        groq_client: Live Groq client instance (from LLMService.client).
        model:       Groq model name to use for the tool-selection call.

    Returns:
        Standard integration dict: {"status": "success"|"error", "tool": ...,
                                    "action": <chosen_slug>, "output": ...}
    """
    client = _get_client()

    # ── Normalize tool slug to the exact Composio toolkit name ────────────────
    COMPOSIO_SLUG_ALIASES: dict[str, str] = {
        # Jira variants
        "jira":             "jira",
        "atlassian_jira":   "jira",
        "atlassian-jira":   "jira",
        "jirasoftware":     "jira",
        # Google Sheets variants
        "sheets":           "googlesheets",
        "google_sheet":     "googlesheets",
        "google_sheets":    "googlesheets",
        "googlesheets":     "googlesheets",
        "google-sheets":    "googlesheets",
        # Gmail variants
        "gmail":            "gmail",
        "google_mail":      "gmail",
        # Calendar variants
        "googlecalendar":   "googlecalendar",
        "google_calendar":  "googlecalendar",
        "google-calendar":  "googlecalendar",
        "calendar":         "googlecalendar",
        # GitHub variants
        "github":           "github",
        "git_hub":          "github",
        # Slack variants
        "slack":            "slack",
        # Notion variants
        "notion":           "notion",
    }
    normalized_slug = COMPOSIO_SLUG_ALIASES.get(tool_slug.lower().replace("-", "_"), tool_slug)
    logger.info(f"composio_llm_dispatch: slug '{tool_slug}' → normalized '{normalized_slug}'")

    # Load YAML Config
    config = _get_config()
    defaults = config.get("defaults", {})
    tool_config = config.get("toolkits", {}).get(normalized_slug, {})

    # ── Step 1: Fetch live tool schemas scoped to this toolkit ──────────────────
    try:
        raw_schemas = await get_composio_tools(
            user_id=user_id,
            toolkits=[normalized_slug]
        )
        safe_action = action or ""
        clean_action = safe_action.lower().replace("-", "_")
        synonyms = [s.lower().replace("-", "_") for s in tool_config.get("action_synonyms", {}).get(clean_action, [])]
        
        tool_schemas = []
        slug_clean = normalized_slug.lower().replace("-", "_")
        
        for schema in raw_schemas:
            if isinstance(schema, dict) and "function" in schema:
                raw_name = schema["function"]["name"].lower()
                # Clean name: remove toolkit prefix/infix, e.g. "notion_create_notion_page" -> "create_page"
                clean_name = raw_name.replace(f"{slug_clean}_", "").replace(f"_{slug_clean}", "")
                for part in slug_clean.split("_"):
                    if len(part) > 2:
                        clean_name = clean_name.replace(f"{part}_", "").replace(f"_{part}", "")
                
                # Check match
                is_match = (
                    clean_name == clean_action or 
                    clean_action in clean_name or 
                    any(syn == clean_name or syn in clean_name for syn in synonyms)
                )
                if is_match:
                    tool_schemas.append(schema)
                    
        # Fallback if filter was too strict (cap at 3 to fit token limits on Groq)
        if not tool_schemas:
            tool_schemas = raw_schemas[:3]
        else:
            tool_schemas = tool_schemas[:3]
            
    except Exception as fetch_err:
        logger.error(f"composio_llm_dispatch: failed to fetch schemas for '{tool_slug}': {fetch_err}")
        return {
            "status": "error",
            "tool": tool_slug,
            "action": None,
            "error": f"Could not fetch tool schemas for '{tool_slug}': {fetch_err}",
        }

    if not tool_schemas:
        return {
            "status": "error",
            "tool": normalized_slug,
            "action": action,
            "error": (
                f"No Composio tool schemas found for '{normalized_slug}' (user={user_id}). "
                f"Please connect '{normalized_slug}' via the Available Toolkits panel first."
            ),
        }

    logger.info(
        f"composio_llm_dispatch: {len(tool_schemas)} schema(s) for '{tool_slug}' — "
        f"asking LLM to select one"
    )

    # ── Step 2: Let Groq pick the correct function + arguments ─────────────────
    
    # Dynamic Prefer/Avoid rules from config
    prefer_rules = tool_config.get("prefer_keywords", defaults.get("prefer_keywords", {}))
    rule_str = ""
    if prefer_rules:
        rule_str = "\nCRITICAL RULES for action selection:\n"
        for rule_name, rule_data in prefer_rules.items():
            prefer = ", ".join(rule_data.get("prefer", []))
            avoid = ", ".join(rule_data.get("avoid", []))
            rule_str += f"- Prefer actions containing words like [{prefer}] over actions containing words like [{avoid}], unless explicitly requested.\n"

    user_message = (
        f"Using the '{tool_slug}' toolkit, please perform the following action:\n"
        f"{node_intent}\n\n"
        f"Parameter hints from the workflow planner: {json.dumps(params)}\n\n"
        f"CRITICAL: You MUST strictly select a valid tool name from the provided tool schemas. "
        f"DO NOT use the fuzzy action name from the prompt if it does not exist in the schemas. "
        f"Map the requested action to the absolute closest valid tool name in the schemas.\n"
        f"{rule_str}"
    )

    # Sanitize the schemas to remove 'strict' if it's None (Groq API rejects this)
    for schema in tool_schemas:
        if isinstance(schema, dict) and "function" in schema:
            if schema["function"].get("strict") is None:
                schema["function"].pop("strict", None)

    resolver_models = defaults.get("resolver_models", [model])
    lm_response = None

    for current_model in resolver_models:
        try:
            # call_with_fallback rotates Groq API keys on 429 before giving up
            # on this model, then the outer loop moves on to the next model.
            lm_response = await asyncio.to_thread(
                call_with_fallback,
                current_model,
                [{"role": "user", "content": user_message}],
                tool_schemas,
                "required",   # tool_choice: force a tool call; never allow a plain-text reply
                0,            # temperature
                512,          # max_tokens
            )
            logger.info(
                f"composio_llm_dispatch: tool-selection succeeded with model '{current_model}' "
                f"(key ...{get_next_available_key()[-4:]})"
            )
            break  # Success — exit fallback loop
        except Exception as llm_err:
            logger.warning(
                f"composio_llm_dispatch: model '{current_model}' exhausted all keys — "
                f"moving to next model. Error: {llm_err}"
            )

    if not lm_response:
        return {
            "status": "error",
            "tool": tool_slug,
            "action": None,
            "error": "LLM tool-selection failed for all fallback models (all keys rate-limited).",
        }

    tool_calls = getattr(lm_response.choices[0].message, "tool_calls", None)
    if not tool_calls:
        return {
            "status": "error",
            "tool": tool_slug,
            "action": None,
            "error": "LLM returned no tool call despite tool_choice='required'.",
        }

    chosen_slug: str = tool_calls[0].function.name
    try:
        arguments: dict = json.loads(tool_calls[0].function.arguments)
    except json.JSONDecodeError:
        arguments = {}

    logger.info(
        f"composio_llm_dispatch: LLM chose '{chosen_slug}' with args {arguments}"
    )

    # ── Step 3: Execute the LLM-chosen function via Composio ───────────────────
    try:
        output = await asyncio.to_thread(
            client.tools.execute,
            slug=chosen_slug,
            arguments=arguments,
            user_id=user_id,
            dangerously_skip_version_check=True,
        )
        # Check if Composio returned a logical error even if the HTTP request succeeded
        is_successful = True
        error_msg = None
        
        if isinstance(output, dict):
            is_successful = output.get("successful", True)
            error_msg = output.get("error")
        elif hasattr(output, "successful"):
            is_successful = getattr(output, "successful")
            error_msg = getattr(output, "error", None)
            
        if not is_successful:
            logger.error(f"composio_llm_dispatch: execute '{chosen_slug}' failed logically: {error_msg}")
            return {
                "status": "error",
                "tool": tool_slug,
                "action": chosen_slug,
                "error": error_msg or "Unknown Composio execution error",
                "output": output,
            }

        logger.info(f"composio_llm_dispatch: '{chosen_slug}' executed successfully")
        return {
            "status": "success",
            "tool": tool_slug,
            "action": chosen_slug,
            "output": output,
        }
    except Exception as exec_err:
        error_msg = getattr(exec_err, "message", None) or repr(exec_err) or str(exec_err)
        logger.error(f"composio_llm_dispatch: execute '{chosen_slug}' failed: {error_msg}")
        return {
            "status": "error",
            "tool": tool_slug,
            "action": chosen_slug,
            "error": error_msg,
        }


async def execute_composio_action(tool_slug: str, action: str, inputs: dict, user_id: str) -> dict:
    """
    Direct (non-LLM-guided) Composio action execution.
    Kept for backwards-compatibility; composio_llm_dispatch is preferred for production.
    """
    try:
        client = _get_client()
        logger.info(f"Executing Composio action '{action}' for tool '{tool_slug}' (user: {user_id})")
        
        output = await asyncio.to_thread(
            client.tools.execute,
            slug=action,
            arguments=inputs,
            user_id=user_id,
            dangerously_skip_version_check=True,
        )

        is_successful = True
        error_msg = None
        
        if isinstance(output, dict):
            is_successful = output.get("successful", True)
            error_msg = output.get("error")
        elif hasattr(output, "successful"):
            is_successful = getattr(output, "successful")
            error_msg = getattr(output, "error", None)
            
        if not is_successful:
            logger.error(f"execute_composio_action '{action}' failed logically: {error_msg}")
            return {
                "status": "error",
                "tool": tool_slug,
                "action": action,
                "error": error_msg or "Unknown Composio execution error",
                "output": output,
            }

        return {
            "status": "success",
            "tool": tool_slug,
            "action": action,
            "output": output,
        }
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Composio execution failed [{tool_slug}.{action}]: {error_msg}")
        return {
            "status": "error",
            "tool": tool_slug,
            "action": action,
            "error": error_msg,
        }
