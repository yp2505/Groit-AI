"""
services/langchain_agent.py — LangChain + Composio Plan-and-Execute Agent (v2)

Completely isolated from the existing pipeline. Uses:
  - composio 0.17.1 Sessions API (composio.sessions.create / session.tools())
  - composio_langchain.LangchainProvider for LangChain-native StructuredTool wrappers
  - langchain-openai ChatOpenAI (openai/gpt-4o-mini; uses OPENROUTER_API_KEY from .env with OpenRouter base_url)
  - langgraph create_react_agent (replaces the now-removed AgentExecutor in LangChain 1.x)

API discovery notes (verified against installed versions):
  • langchain==1.3.13 / langchain-core==1.4.9:
      AgentExecutor and create_tool_calling_agent are NO LONGER exported from langchain.agents.
      The modern replacement is langgraph.prebuilt.create_react_agent, which is part of the
      installed langgraph==1.2.9 + langgraph-prebuilt==1.1.0.

  • composio==0.17.1 / composio-langchain==0.17.1:
      ComposioToolSet is NOT exported from composio_langchain in this version.
      The correct entrypoint is:
          from composio import Composio
          from composio_langchain import LangchainProvider

          composio_client = Composio(provider=LangchainProvider(), api_key=<key>)
          session = composio_client.sessions.create(user_id=<user_id>)
          tools: List[StructuredTool] = session.tools()   # LangChain StructuredTool objects

  • create_react_agent usage:
          from langgraph.prebuilt import create_react_agent
          app = create_react_agent(model=llm, tools=tools, prompt=system_message)
          result = await app.ainvoke({"messages": [("human", user_input)]})
          # Final AI message is result["messages"][-1].content

DO NOT import anything from this module in the existing pipeline files.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langgraph.prebuilt import create_react_agent

logger = logging.getLogger("mcp_gateway.langchain_agent")

_SYSTEM_PROMPT_TEMPLATE = """You are an agentic orchestrator.
You have access to a suite of tools via the Composio platform. 
To use these tools, you MUST first use COMPOSIO_SEARCH_TOOLS to find the exact, uppercase tool slug (e.g., GMAIL_SEND_EMAIL) and retrieve its schema. DO NOT hallucinate tool names or use lowercase slugs in COMPOSIO_MULTI_EXECUTE_TOOL.

CRITICAL INSTRUCTION REGARDING AUTHENTICATION:
The user currently has these apps fully connected and authenticated: [{connected_apps}].
Trust this list as absolute ground truth. 
- If an app is in this list, YOU ARE ALREADY AUTHENTICATED. Do NOT use COMPOSIO_MANAGE_CONNECTIONS for it, even if a meta-tool's output vaguely suggests otherwise. Proceed directly to executing the tool via COMPOSIO_MULTI_EXECUTE_TOOL.
- Only use COMPOSIO_MANAGE_CONNECTIONS if the user specifically requests to connect a NEW app that is NOT in the list above.

Always provide a concise summary of your actions once completed.
"""


def _get_langchain_tools(user_id: str) -> list:
    """
    Fetch LangChain-wrapped Composio tools scoped to *user_id*.

    Uses the composio 0.17.1 Sessions API:
        composio.sessions.create(user_id=...) → session
        session.tools()                        → List[StructuredTool]

    The session is ephemeral (created fresh per-request) so each invocation
    picks up the user's current set of connected toolkits without caching stale state.
    """
    from composio import Composio
    from composio_langchain import LangchainProvider

    api_key = os.getenv("COMPOSIO_API_KEY")
    if not api_key:
        raise ValueError("COMPOSIO_API_KEY is not set. Cannot initialise Composio client.")

    composio_client = Composio(provider=LangchainProvider(), api_key=api_key)
    session = composio_client.sessions.create(user_id=user_id)
    tools = session.tools()
    logger.info(
        "LangChain agent: fetched %d Composio tool(s) for user_id=%s",
        len(tools),
        user_id,
    )
    return tools


async def _build_graph(user_id: str):
    """
    Build a LangGraph ReAct agent graph for the given user.

    Returns the compiled LangGraph app (CompiledStateGraph).
    """
    # Fetch tools via a thread to avoid blocking the event loop on Composio's HTTP calls
    tools = await asyncio.to_thread(_get_langchain_tools, user_id)

    llm = ChatOpenAI(
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-4o-mini",
        api_key=os.getenv("OPENROUTER_API_KEY"),
        max_tokens=1000,
        temperature=0,
        default_headers={
            "HTTP-Referer": "https://groit.ai",
            "X-OpenRouter-Title": "Groit Agent",
        }
    )

    from services.integrations.composio_integration import list_connected_toolkits
    connected_slugs = await list_connected_toolkits(user_id)
    connected_str = ", ".join(connected_slugs) if connected_slugs else "None"
    
    system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(connected_apps=connected_str)

    # create_agent is the LangChain 1.x / LangGraph-native replacement
    # for the removed AgentExecutor + create_tool_calling_agent pattern.
    graph = create_agent(
        model=llm,
        tools=tools,
        system_prompt=system_prompt,
    )
    return graph, tools


def _extract_intermediate_steps(messages: list) -> list[dict[str, Any]]:
    """
    Parse the LangGraph message trace into the intermediate_steps format
    expected by the /v2/execute response contract.

    Each AI message that contains tool_calls contributes one entry per call,
    paired with the subsequent ToolMessage result.
    """
    steps = []
    # Build a lookup: tool_call_id → ToolMessage content
    from langchain_core.messages import ToolMessage

    tool_results: dict[str, str] = {}
    for msg in messages:
        if isinstance(msg, ToolMessage):
            tool_results[msg.tool_call_id] = str(msg.content)

    for msg in messages:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                steps.append(
                    {
                        "tool": tc.get("name", ""),
                        "input": tc.get("args", {}),
                        "result": tool_results.get(tc.get("id") or "", ""),
                    }
                )
    return steps


async def run_langchain_workflow(user_input: str, user_id: str) -> dict:
    """
    Entry point called by the /v2/execute router.

    Builds a fresh LangGraph ReAct agent in a thread (blocking I/O for
    Composio session creation), then invokes it asynchronously.

    Returns a dict with:
        success            : bool
        output             : str — the agent's final answer
        intermediate_steps : list[dict] — each tool call with tool name, input, and result
    """
    logger.info(
        "run_langchain_workflow: user_id=%s input=%.120s", user_id, user_input
    )

    try:
        # Build graph asynchronously (it internally runs Composio tool fetch in a thread)
        graph, _tools = await _build_graph(user_id)

        logger.info(f"LangChain graph initialized with tools: {[t.name for t in _tools]}")
        result: dict = await graph.ainvoke(
            {"messages": [HumanMessage(content=user_input)]},
            config={"recursion_limit": 15}
        )

        messages = result.get("messages", [])
        # Final answer is the last AIMessage in the trace
        final_output = ""
        for msg in reversed(messages):
            if isinstance(msg, AIMessage) and not getattr(msg, "tool_calls", None):
                final_output = str(msg.content)
                break

        steps = _extract_intermediate_steps(messages)

        logger.info(
            "run_langchain_workflow: completed — %d step(s), output=%.120s",
            len(steps),
            final_output,
        )
        return {
            "success": True,
            "output": final_output,
            "intermediate_steps": steps,
        }

    except Exception as exc:
        logger.exception("run_langchain_workflow: unhandled error: %s", exc)
        return {
            "success": False,
            "output": None,
            "error": str(exc),
            "intermediate_steps": [],
        }
