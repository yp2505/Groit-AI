import logging
import asyncio
import os
from composio import Composio
from typing import Optional, Dict, Any
from schemas.dag_schema import WorkflowDAG  # type: ignore
from config.settings import settings  # type: ignore
from groq import Groq
from services.integrations.composio_integration import composio_llm_dispatch  # type: ignore

logger = logging.getLogger(__name__)

class DAGExecutor:
    def __init__(self, dag: WorkflowDAG, user_id: str, credentials: Optional[Dict[str, Any]] = None):
        self.dag = dag
        self.user_id = user_id
        self.credentials = credentials or {}
        # Use existing Composio credentials
        self.client = Composio(
            api_key=os.getenv("COMPOSIO_API_KEY") or "",
            dangerously_allow_auto_upload_download_files=True
        )

    async def execute(self):
        """
        Executes the workflow nodes in topological order.
        """
        logger.info(f"Executing DAG: {self.dag.workflow_name} for user: {self.user_id}")
        
        node_map = {node.id: node for node in self.dag.nodes}
        in_degree = {node.id: len(node.depends_on) for node in self.dag.nodes}
        adj = {node.id: [] for node in self.dag.nodes}
        
        for node in self.dag.nodes:
            for dep in node.depends_on:
                adj[dep].append(node.id)

        queue = [n_id for n_id, deg in in_degree.items() if deg == 0]
        results = {}
        
        while queue:
            current_id = queue.pop(0)
            node = node_map[current_id]
            
            logger.info(f"Running node {current_id} ({node.tool}.{node.action})")
            
            try:
                # Dynamic context parameter resolution substitution
                resolved_params = self._resolve_params(node.params, results)
                node_intent = f"Execute action '{node.action}' with params: {resolved_params}"
                tool_lower = node.tool.lower()
                
                groq_client = Groq(api_key=settings.GROQ_API_KEY)
                response_dict = await composio_llm_dispatch(
                    tool_slug=tool_lower,
                    action=node.action,
                    node_intent=node_intent,
                    params=resolved_params,
                    user_id=self.user_id,
                    groq_client=groq_client,
                    model="llama-3.3-70b-versatile"
                )
                
                if response_dict.get("status") == "error":
                    raise ValueError(response_dict.get("error", "Unknown dispatch error"))
                
                results[current_id] = {"status": "success", "output": response_dict.get("output", {})}
                logger.info(f"Node {current_id} succeeded.")
                
            except Exception as e:
                logger.error(f"Node {current_id} failed after recovery attempts: {e}")
                results[current_id] = {"status": "error", "error": str(e)}
            
            for neighbor in adj[current_id]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        return {
            "workflow_name": self.dag.workflow_name,
            "status": "completed",
            "results": results
        }
        
    def _resolve_params(self, params: dict, context: dict) -> dict:
        """
        Substitute reference parameters dynamically with actual values from previous outputs.
        """
        resolved = {}
        for k, v in params.items():
            if isinstance(v, str) and v.startswith("${") and v.endswith("}"):
                ref_path = v[2:-1].split(".")
                ref_node = ref_path[0]
                if ref_node in context and context[ref_node]["status"] == "success":
                    val = context[ref_node]["output"]
                    try:
                        for path_part in ref_path[1:]:
                            if isinstance(val, dict):
                                val = val.get(path_part, val)
                            elif hasattr(val, path_part):
                                val = getattr(val, path_part)
                        resolved[k] = val
                    except Exception:
                        resolved[k] = v
                else:
                    resolved[k] = v
            else:
                resolved[k] = v
        return resolved
