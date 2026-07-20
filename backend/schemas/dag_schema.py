from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class DAGNode(BaseModel):
    id: str = Field(..., description="Unique node identifier")
    tool: str = Field(..., description="Target Composio tool")
    action: str = Field(..., description="Tool-specific action to invoke")
    params: Dict[str, Any] = Field(default_factory=dict, description="Action parameters")
    depends_on: List[str] = Field(default_factory=list, description="IDs of upstream dependencies")

class WorkflowDAG(BaseModel):
    workflow_name: str
    nodes: List[DAGNode]

class WorkflowRequest(BaseModel):
    user_input: Optional[str] = None
    dag: Optional[WorkflowDAG] = None
    chat_history: Optional[List[Dict[str, Any]]] = None
    credentials: Optional[Dict[str, Any]] = None
    attached_file_data: Optional[str] = None
    attached_file_name: Optional[str] = None
