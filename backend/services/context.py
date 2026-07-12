"""
services/context.py — Context Management System
Maintains state across multi-turn interactions and cross-node data flow.
Resolves {{node_X.output.field}} templates with actual runtime values.

Author: Shivam Kumar (LLM Systems Developer)
"""

from __future__ import annotations
import json
import re
import logging
from typing import Any, Optional

logger = logging.getLogger("mcp_gateway.context")


class ContextManager:
    """
    Manages execution context across DAG node executions.
    
    Responsibilities:
    1. Store outputs from completed nodes
    2. Resolve template references ({{node_X.output.field}}) in params
    3. Track conversation state across multi-turn interactions
    4. Handle large payloads via summarization threshold
    
    Compatible with both Prerita's template format ({{node_1.field_name}})
    and Grishma's executor format ({{task_1.output.field}}).
    """

    def __init__(self, summarize_threshold: int = 2000):
        self._node_outputs: dict[str, dict[str, Any]] = {}
        self._raw_node_outputs: dict[str, dict[str, Any]] = {}
        self._conversation_history: list[dict] = []
        self._execution_metadata: dict[str, Any] = {}
        self._summarize_threshold = summarize_threshold
        # Regex patterns for template resolution
        # Supports: {{node_1.output.field}}, {{task_1.output.field}}, {{node_1.field}}
        self._template_pattern = re.compile(
            r"\{\{(\w+)(?:\.output)?\.([^}]+)\}\}"
        )

    # ─── Node Output Management ────────────────────────────────────

    def store(self, node_id: str, output: dict[str, Any]) -> None:
        """
        Store the output of a completed node for downstream template resolution.
        If output exceeds threshold, mark it for summarization.
        """
        if not isinstance(output, dict):
            output = {"result": output}

        self._node_outputs[node_id] = output
        self._raw_node_outputs[node_id] = output
        output_size = len(json.dumps(output))
        logger.info(
            f"Stored output for {node_id} ({output_size} chars, "
            f"{'needs summarization' if output_size > self._summarize_threshold else 'ok'})"
        )

    def get_output(self, node_id: str, raw: bool = False) -> Optional[dict[str, Any]]:
        """Retrieve stored output for a specific node."""
        if raw:
            return self._raw_node_outputs.get(node_id)
        return self._node_outputs.get(node_id)

    def has_output(self, node_id: str) -> bool:
        """Check if a node has stored output."""
        return node_id in self._node_outputs

    # ─── Template Resolution ───────────────────────────────────────

    def resolve_params(self, params: dict[str, Any], use_raw: bool = True) -> dict[str, Any]:
        """
        Replace {{node_X.output.field}} or {{node_X.field}} templates 
        with actual values from stored node outputs.
        
        Args:
            params: Raw params dict potentially containing template references
            use_raw: If True, use the unsummarized raw data (best for logic/integrations)
            
        Returns:
            Fully resolved params dict with actual values
        """
        return self._resolve_value(params, use_raw=use_raw)

    def _resolve_value(self, value: Any, use_raw: bool = True) -> Any:
        """Recursively resolve templates in any value type."""
        if isinstance(value, str):
            return self._resolve_string(value, use_raw=use_raw)
        elif isinstance(value, dict):
            return {k: self._resolve_value(v, use_raw=use_raw) for k, v in value.items()}
        elif isinstance(value, list):
            return [self._resolve_value(item, use_raw=use_raw) for item in value]
        return value

    def _resolve_string(self, text: str, use_raw: bool = True) -> str:
        """
        Resolve all template references in a string.
        Supports templates embedded within longer strings.
        """
        def replacer(match: re.Match) -> str:
            node_id = match.group(1)
            raw_field = match.group(2)
            
            # Sub-parse the field to gracefully strip out LLM-generated templates/filters i.e. `| join(' ')`
            parts = raw_field.split('|')
            field = parts[0].strip()
            filter_type = parts[1].strip() if len(parts) > 1 else None

            # Decide which output source to use
            outputs_source = self._raw_node_outputs if use_raw else self._node_outputs

            if node_id not in outputs_source:
                raise ValueError(
                    f"Template resolution failed: node '{node_id}' not found in {'raw ' if use_raw else ''}outputs. "
                    f"Available: {list(outputs_source.keys())}"
                )

            output = outputs_source[node_id]
            val = output
            
            for part in field.split('.'):
                if isinstance(val, dict) and part in val:
                    val = val[part]
                elif hasattr(val, part):
                    val = getattr(val, part)
                else:
                    raise ValueError(
                        f"Template resolution failed: field '{part}' not found in '{field}'. "
                        f"Available: {list(val.keys()) if isinstance(val, dict) else 'Not a dict'}"
                    )
            
            # Simple implementations of filter types
            if filter_type:
                if filter_type.startswith("join"):
                    if isinstance(val, list):
                        return " ".join([str(v) for v in val])
                if filter_type.startswith("length"):
                    if isinstance(val, list):
                        return str(len(val))
            
            if isinstance(val, (dict, list)):
                return json.dumps(val, indent=2)
                
            return str(val)

        return self._template_pattern.sub(replacer, text)

    # ─── Conversation State (Multi-turn) ───────────────────────────

    def add_turn(self, role: str, content: str, metadata: Optional[dict] = None) -> None:
        """Record a conversation turn for multi-turn context."""
        self._conversation_history.append({
            "role": role,
            "content": content,
            "metadata": metadata or {}
        })

    def get_conversation_context(self, max_turns: int = 10) -> list[dict]:
        """Get recent conversation history for LLM context window."""
        return self._conversation_history[-max_turns:]

    # ─── Execution Metadata ────────────────────────────────────────

    def set_metadata(self, key: str, value: Any) -> None:
        """Store execution-level metadata (workflow_id, timestamps, etc.)."""
        self._execution_metadata[key] = value

    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Retrieve execution metadata."""
        return self._execution_metadata.get(key, default)

    # ─── Large Payload Handling ────────────────────────────────────

    def needs_summarization(self, node_id: str) -> bool:
        """Check if a node's output exceeds the summarization threshold."""
        output = self._node_outputs.get(node_id)
        if not output:
            return False
        return len(json.dumps(output)) > self._summarize_threshold

    def store_summarized(self, node_id: str, summary: dict[str, Any]) -> None:
        """Replace a node's full output with a summarized version."""
        if node_id in self._node_outputs:
            self._node_outputs[node_id] = summary
            logger.info(f"Replaced {node_id} output with summarized version")

    # ─── Snapshot & Debug ──────────────────────────────────────────

    def get_execution_context(self, raw: bool = False) -> dict[str, Any]:
        """Return full context snapshot for debugging/observability."""
        source = self._raw_node_outputs if raw else self._node_outputs
        return {
            "node_outputs": {
                nid: {
                    "data": output,
                    "size_chars": len(json.dumps(output))
                }
                for nid, output in source.items()
            },
            "conversation_turns": len(self._conversation_history),
            "metadata": self._execution_metadata,
            "total_stored_nodes": len(source)
        }

    def clear(self) -> None:
        """Reset all state for a fresh execution."""
        self._node_outputs.clear()
        self._raw_node_outputs.clear()
        self._conversation_history.clear()
        self._execution_metadata.clear()
        logger.info("Context manager cleared")

    def get_all(self, raw: bool = True) -> dict:
        """Return all stored node outputs as a flat dict (node_id -> output dict).
        Defaults to raw data for integrations."""
        return dict(self._raw_node_outputs if raw else self._node_outputs)

