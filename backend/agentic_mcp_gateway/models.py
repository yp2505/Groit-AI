"""
models.py — DAG Schema Definition
Defines the data structures for workflow nodes, retry config, and the full DAG.
"""

from dataclasses import dataclass, field
from typing import Any, Optional
from enum import Enum


class TaskStatus(str, Enum):
    PENDING           = "pending"
    WAITING_APPROVAL  = "waiting_approval"
    RUNNING           = "running"
    SUCCESS           = "success"
    FAILED            = "failed"
    SKIPPED           = "skipped"


@dataclass
class RetryConfig:
    max_attempts: int = 3
    backoff_factor: float = 2.0
    initial_delay: float = 0.2  # seconds


@dataclass
class DAGNode:
    id: str
    name: str
    tool: str                           # e.g. "jira_mcp", "github_mcp"
    action: str                         # e.g. "create_ticket"
    inputs: dict[str, Any]             # can contain {{task_x.output.field}} templates
    depends_on: list[str] = field(default_factory=list)
    requires_approval: bool = False
    retry: RetryConfig = field(default_factory=RetryConfig)

    # Runtime state (populated during execution)
    status: TaskStatus = TaskStatus.PENDING
    output: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    attempts: int = 0
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


@dataclass
class DAG:
    workflow_id: str
    description: str
    nodes: list[DAGNode]

    def node_map(self) -> dict[str, DAGNode]:
        return {n.id: n for n in self.nodes}


def dag_from_dict(data: dict) -> DAG:
    """Parse a raw DAG JSON dict into a DAG dataclass."""
    nodes = []
    
    # Support both 'steps' (new schema) and 'nodes' (old schema)
    raw_nodes = data.get("steps") or data.get("nodes") or []
    
    for n in raw_nodes:
        retry_data = n.get("retry", {})
        retry = RetryConfig(
            max_attempts=retry_data.get("max_attempts", 3),
            backoff_factor=retry_data.get("backoff_factor", 2.0),
            initial_delay=retry_data.get("initial_delay", 1.0),
        )
        
        # Mapping from new schema to internal model
        # New schema: service="github", tool="github.get_repository"
        # Old schema: tool="github_mcp", action="get_repository"
        
        service = n.get("service")
        tool_raw = n.get("tool")
        
        if service and "." in str(tool_raw):
            # New schema format
            tool = f"{service}_mcp"
            action = tool_raw.split(".")[-1]
        else:
            # Fallback to old schema format
            tool = n.get("tool", "unknown_mcp")
            action = n.get("action", "unknown_action")

        # Flexibly handle both 'inputs' (internal model) and 'params' (LLM terminology)
        inputs = n.get("inputs") or n.get("params") or {}
        
        # Robust ID extraction: if 'id' is missing, fallback to 'name' or index
        node_id = n.get("id") or n.get("name") or f"node_{raw_nodes.index(n)}"
        
        node = DAGNode(
            id=str(node_id),
            name=n.get("name") or n.get("title") or f"{tool} → {action}",
            tool=tool,
            action=action,
            inputs=inputs,
            depends_on=n.get("depends_on", []),
            requires_approval=n.get("requires_approval", False),
            retry=retry,
        )
        nodes.append(node)

    return DAG(
        workflow_id=data.get("workflow_id", data.get("workflow_name", "unknown-wf")),
        description=data.get("description", "Generated AI Workflow"),
        nodes=nodes,
    )
