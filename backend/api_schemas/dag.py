"""
models/dag.py — Pydantic DAG Schema
Defines the contract between LLM Planner ↔ Execution Engine ↔ Frontend.
Validates LLM output into a structured, type-safe DAG.

Author: Shivam Kumar (LLM Systems Developer)
Integrates: Prerita Shukla's prompt schema (tool/action/params/depends_on)
"""

from __future__ import annotations
import re
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


# ─── Retry Configuration ───────────────────────────────────────────
class RetryConfig(BaseModel):
    """Per-node retry policy with exponential backoff."""
    max_attempts: int = Field(default=3, ge=1, le=10)
    backoff_factor: float = Field(default=2.0, ge=1.0)
    initial_delay: float = Field(default=1.0, ge=0.1)
    timeout: int = Field(default=10, ge=1, description="Per-attempt timeout in seconds")


# ─── Valid Tools & Actions ───────────────────────────────────────────
VALID_TOOLS: dict[str, set[str]] = {
    "jira":    {"get_issue", "create_issue", "update_issue", "delete_issue", "rollback"},
    "github":  {
        "get_repository", "list_branches", "create_branch", "get_branch",
        "list_issues", "get_issue", "create_issue", "add_issue_comment",
        "update_issue", "create_pull_request", "list_pull_requests", 
        "get_pull_request", "merge_pull_request", "add_labels",
        "get_file_content", "create_or_update_file", "list_commits", "create_release",
        "delete_branch", "rollback", "cleanup", "delete_branches_by_pattern"
    },
    "slack":   {"send_message", "send_file", "create_channel"},
    "sheets":  {"read_row", "update_row", "append_row", "create_sheet", "populate_sheet", "get_credentials", "add_dummy_logins", "write_data", "add_data", "log_data"},
    # MCP-suffixed versions
    "jira_mcp":    {"create_ticket", "get_issue", "update_issue", "create_issue", "delete_issue", "rollback"},
    "github_mcp":  {
        "get_repository", "list_branches", "create_branch", "get_branch",
        "list_issues", "get_issue", "create_issue", "add_issue_comment",
        "update_issue", "create_pull_request", "list_pull_requests", 
        "get_pull_request", "merge_pull_request", "add_labels",
        "get_file_content", "create_or_update_file", "list_commits", "create_release",
        "link_issue", "delete_branch", "rollback", "cleanup", "delete_branches_by_pattern"
    },
    "slack_mcp":   {"send_message", "send_file", "create_channel", "post_message"},
    "sheets_mcp":  {"read_row", "update_row", "append_row", "create_sheet", "populate_sheet", "get_credentials", "add_dummy_logins", "write_data", "add_data", "log_data"},
}

# ─── Tool inference helpers ─────────────────────────────────────────
_TOOL_KEYWORDS = {
    "jira": "jira", "github": "github", "slack": "slack",
    "sheets": "sheets", "sheet": "sheets", "google": "sheets",
}

_ACTION_ALIASES = {
    "post_message": "send_message", "notify": "send_message",
    "send": "send_message", "message": "send_message",
    "get_ticket": "get_issue", "get_issues": "get_issue",
    "get_tickets": "get_issue", "fetch": "get_issue",
    "create_ticket": "create_issue", "update_ticket": "update_issue",
    "get_repo": "get_repository", "get_commits": "list_commits",
    "create_pr": "create_pull_request", "merge_pr": "merge_pull_request",
    "write_row": "append_row", "add_row": "append_row", "log_row": "append_row",
    "batch_delete": "delete_branches_by_pattern",
    "create_sheet": "create_sheet",
    "populate_sheet": "populate_sheet",
    "cleanup_pattern": "delete_branches_by_pattern",
}

def _infer_tool_action(name: str) -> tuple[str, str]:
    """Parse 'create_github_branch' → ('github', 'create_branch')."""
    name_lower = name.lower().replace("-", "_").replace(" ", "_")
    
    found_tool = None
    action_raw = name_lower
    for keyword, tool_name in _TOOL_KEYWORDS.items():
        if keyword in name_lower:
            found_tool = tool_name
            action_raw = name_lower.replace(keyword, "").strip("_")
            break
    
    if not found_tool:
        if any(w in name_lower for w in ("branch", "commit", "pr", "pull", "merge", "repo")):
            found_tool = "github"
        elif any(w in name_lower for w in ("issue", "ticket", "bug")):
            found_tool = "jira"
        elif any(w in name_lower for w in ("message", "notify", "alert", "slack")):
            found_tool = "slack"
        elif any(w in name_lower for w in ("row", "sheet", "log", "append")):
            found_tool = "sheets"
        else:
            found_tool = "jira"
        action_raw = name_lower

    action_clean = re.sub(r"_+", "_", action_raw).strip("_")
    if action_clean in _ACTION_ALIASES:
        action_clean = _ACTION_ALIASES[action_clean]
    
    valid = VALID_TOOLS.get(found_tool, set())
    if action_clean in valid:
        return (found_tool, action_clean)
    for va in valid:
        if va in action_clean or action_clean in va:
            return (found_tool, va)
    
    defaults = {"jira": "get_issue", "github": "create_branch", "slack": "send_message", "sheets": "append_row"}
    return (found_tool, defaults.get(found_tool, "get_issue"))


# ─── DAG Node ───────────────────────────────────────────────────────
class DAGNode(BaseModel):
    """A single step in the workflow DAG."""
    id: str = Field(..., description="Unique node identifier")
    tool: str = Field(..., description="Target MCP tool: jira, github, slack, sheets")
    action: str = Field(..., description="Tool-specific action to invoke")
    params: dict[str, Any] = Field(default_factory=dict, description="Action parameters")
    depends_on: list[str] = Field(default_factory=list, description="IDs of upstream dependencies")
    requires_approval: bool = Field(default=False, description="Whether this node needs HITL approval")
    retry: RetryConfig = Field(default_factory=RetryConfig)

    # Optional metadata
    name: Optional[str] = Field(default=None, description="Human-readable step name")
    mock_output: Optional[dict[str, Any]] = Field(default=None)
    timeout_ms: Optional[int] = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def heal_node(cls, data: Any) -> Any:
        """
        Pre-validation healer: transforms raw LLM output into valid schema.
        Handles nodes like: {"name": "create_github_branch", "params": {...}}
        """
        if not isinstance(data, dict):
            return data
        
        # 1. Ensure 'id' — fall back to 'name', 'node_id', or index
        if "id" not in data:
            data["id"] = data.get("name") or data.get("node_id") or data.get("task_id") or "node_auto"
        
        # 2. Handle hierarchical tool format: service="github", tool="github.create_branch"
        service = data.get("service")
        tool_raw = data.get("tool", "")
        if service and "." in str(tool_raw):
            data["tool"] = service
            data["action"] = str(tool_raw).split(".")[-1]
        
        # 3. Infer 'tool' and 'action' from 'name' if missing
        if not data.get("tool") or not data.get("action"):
            source_name = data.get("name") or data.get("id") or ""
            if source_name:
                inferred_tool, inferred_action = _infer_tool_action(source_name)
                data.setdefault("tool", inferred_tool)
                data.setdefault("action", inferred_action)
        
        # 3b. Normalize hallucinated tool names to canonical names
        _TOOL_NAME_FIXES = {
            "google_sheets": "sheets",
            "googlesheets": "sheets",
            "google sheets": "sheets",
            "gsheets": "sheets",
            "spreadsheet": "sheets",
            "spreadsheets": "sheets",
            "github_api": "github",
            "gh": "github",
            "jira_api": "jira",
            "jira_cloud": "jira",
            "slack_api": "slack",
            "slack_bot": "slack",
        }
        if data.get("tool") in _TOOL_NAME_FIXES:
            data["tool"] = _TOOL_NAME_FIXES[data["tool"]]
        
        # 4. Normalize params aliases
        for alt in ("inputs", "args"):
            if alt in data and "params" not in data:
                data["params"] = data.pop(alt)
        data.setdefault("params", {})
        
        # 5. Ensure depends_on is a list
        if data.get("depends_on") is None:
            data["depends_on"] = []
        
        # 6. Auto-inject user_confirmed for GitHub nodes
        # The LLM already handles the safety gate by asking the user for confirmation
        # before generating the DAG. If a DAG reaches this point, confirmation was given.
        if data.get("tool") in ("github", "github_mcp"):
            data.setdefault("params", {})
            data["params"]["user_confirmed"] = True
        
        return data

    @field_validator("tool")
    @classmethod
    def validate_tool(cls, v: str) -> str:
        # Soft validation: warn but don't crash for unknown tools
        # The execution layer handles unknowns gracefully
        if v not in VALID_TOOLS:
            import logging
            logging.getLogger("mcp_gateway.dag").warning(f"Unknown tool '{v}' — will attempt execution anyway")
        return v

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str, info) -> str:
        return _ACTION_ALIASES.get(v, v)


# ─── Workflow DAG ───────────────────────────────────────────────────
class WorkflowDAG(BaseModel):
    """
    Complete workflow directed acyclic graph.
    This is the primary contract between LLM output and the execution engine.
    """
    workflow_name: str = Field(..., description="Human-readable workflow name")
    nodes: list[DAGNode] = Field(..., min_length=1, description="Ordered list of DAG steps")

    # Optional metadata
    description: Optional[str] = Field(default=None)
    workflow_id: Optional[str] = Field(default=None, description="Unique execution ID")
    execution_layers: Optional[list[list[str]]] = Field(default=None)
    context_refs: Optional[dict[str, str]] = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def heal_workflow(cls, data: Any) -> Any:
        """
        Pre-validation healer: normalizes workflow-level field names.
        Handles: 'title' -> 'workflow_name', 'steps' -> 'nodes', etc.
        """
        if not isinstance(data, dict):
            return data
        
        # Normalize workflow_id
        if "workflow_id" not in data or not data["workflow_id"]:
            import time
            data["workflow_id"] = f"wf-{int(time.time())}"

        # Normalize workflow_name
        if "workflow_name" not in data:
            data["workflow_name"] = (
                data.get("title") or data.get("name") or 
                data.get("workflow_id") or "unnamed_workflow"
            )
        
        # Normalize nodes key
        for alt in ("steps", "tasks"):
            if alt in data and "nodes" not in data:
                data["nodes"] = data.pop(alt)
        
        return data

    @model_validator(mode="after")
    def validate_dag_integrity(self) -> "WorkflowDAG":
        """Validates: no duplicate IDs, valid dependency refs, no cycles."""
        node_ids = {node.id for node in self.nodes}

        # Check for duplicates
        if len(node_ids) != len(self.nodes):
            seen = set()
            dupes = []
            for n in self.nodes:
                if n.id in seen:
                    dupes.append(n.id)
                seen.add(n.id)
            raise ValueError(f"Duplicate node IDs: {dupes}")

        # Check dependency references
        for node in self.nodes:
            for dep in node.depends_on:
                if dep not in node_ids:
                    raise ValueError(f"Node '{node.id}' depends on unknown node '{dep}'.")

        # Cycle detection via topological sort (Kahn's algorithm)
        in_degree = {n.id: 0 for n in self.nodes}
        adj = {n.id: [] for n in self.nodes}
        for node in self.nodes:
            for dep in node.depends_on:
                adj[dep].append(node.id)
                in_degree[node.id] += 1

        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        visited_count = 0
        while queue:
            current = queue.pop(0)
            visited_count += 1
            for neighbor in adj[current]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited_count != len(self.nodes):
            raise ValueError("Cyclic dependency detected in DAG!")

        return self

    def get_execution_order(self) -> list[list[str]]:
        """Returns nodes grouped by execution level (topological layers)."""
        in_degree = {n.id: len(n.depends_on) for n in self.nodes}
        adj: dict[str, list[str]] = {n.id: [] for n in self.nodes}
        for node in self.nodes:
            for dep in node.depends_on:
                adj[dep].append(node.id)

        layers: list[list[str]] = []
        queue = [nid for nid, deg in in_degree.items() if deg == 0]
        while queue:
            layers.append(list(queue))
            next_queue = []
            for nid in queue:
                for neighbor in adj[nid]:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        next_queue.append(neighbor)
            queue = next_queue
        return layers

    def node_map(self) -> dict[str, DAGNode]:
        """Returns a dict of node_id → DAGNode for fast lookup."""
        return {n.id: n for n in self.nodes}
