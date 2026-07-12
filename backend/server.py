from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Adjust path so we can import from agentic_mcp_gateway and prompt_engine
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "agentic_mcp_gateway"))

from prompt_engine import generate_dag as llm_generate_dag
from agentic_mcp_gateway.models import dag_from_dict, TaskStatus
from agentic_mcp_gateway.observability import ExecutionLogger
from agentic_mcp_gateway.hitl_async import AsyncHITLGate
from agentic_mcp_gateway.executor import DAGExecutor
from agentic_mcp_gateway.agentic_executor import dispatch_mcp

app = FastAPI(title="Workflow Maestro API")

@app.get("/health")
async def health_check():
    """Liveness probe — frontend polls this to confirm backend is ready."""
    return {"status": "ok"}

# Allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Since it's local hackathon
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory state for active workflows
# Format: { workflow_id: { "dag_obj": DAG, "logger": Logger, "hitl": AsyncHITLGate, "title": "..." } }
ACTIVE_WORKFLOWS: Dict[str, Dict[str, Any]] = {}

class PlanRequest(BaseModel):
    input: str

class PlanResponse(BaseModel):
    workflow_id: str
    message: str

class ApproveRequest(BaseModel):
    workflow_id: str
    node_id: str
    approved: bool

@app.post("/plan", response_model=PlanResponse)
async def plan_workflow(req: PlanRequest):
    # 1. Call prompt engine
    raw_dag_json = llm_generate_dag(req.input)
    
    # Generate an ID if one isn't provided by the prompt engine
    import uuid
    wf_id = raw_dag_json.get("workflow_id", f"wf-{uuid.uuid4().hex[:8]}")
    title = raw_dag_json.get("title", raw_dag_json.get("name", req.input))
    raw_dag_json["workflow_id"] = wf_id
    # Ensure workflow_name exists for dag_from_dict
    if "workflow_name" not in raw_dag_json:
        raw_dag_json["workflow_name"] = title

    # 2. Parse DAG into python objects
    if "error" in raw_dag_json:
        raise HTTPException(
            status_code=500, 
            detail=f"LLM Generation Error: {raw_dag_json['error']}. Check if GROQ_API_KEY is set in backend/.env"
        )

    try:
        dag = dag_from_dict(raw_dag_json)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"DAG Parsing failed: {str(e)}")

    # 3. Setup observability and async HITL
    logger = ExecutionLogger(workflow_id=dag.workflow_id)
    hitl = AsyncHITLGate(logger=logger, auto_approve=False)

    executor = DAGExecutor(
        dag=dag,
        mcp_dispatcher=dispatch_mcp,
        hitl=hitl,
        logger=logger,
        original_prompt=req.input
    )

    # 4. Store in memory
    ACTIVE_WORKFLOWS[wf_id] = {
        "dag_obj": dag,
        "logger": logger,
        "hitl": hitl,
        "title": title
    }

    # 5. Kick off run in the background
    asyncio.create_task(executor.run())

    return PlanResponse(workflow_id=wf_id, message="Execution started")

@app.get("/mock-db")
async def get_mock_db():
    """Returns the mock database for frontend simulation views like Slack/GitHub."""
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mock_database.json")
    if os.path.exists(db_path):
        import json
        try:
            with open(db_path, "r") as f:
                return json.load(f)
        except:
            return []
    return []

@app.get("/active-workflows")
async def get_active_workflows():
    """Return status of all active workflows for the logs page."""
    workflows = []
    for wf_id, wf in ACTIVE_WORKFLOWS.items():
        dag = wf["dag_obj"]
        nodes_out = []
        for node in dag.nodes:
            raw_status = node.status.value.lower()
            if raw_status == 'waiting approval':
                raw_status = 'waiting_approval'

            tool_name = "generic"
            if "jira" in str(node.tool).lower(): tool_name = "jira"
            if "github" in str(node.tool).lower(): tool_name = "github"
            if "slack" in str(node.tool).lower(): tool_name = "slack"
            if "sheet" in str(node.tool).lower(): tool_name = "sheets"

            nodes_out.append({
                "id": node.id,
                "title": node.name or node.action,
                "description": f"Tool: {node.tool} Action: {node.action}",
                "status": raw_status,
                "tool": tool_name,
            })
        workflows.append({
            "workflow_id": wf_id,
            "title": wf.get("title", wf_id),
            "nodes": nodes_out
        })
    return {"workflows": workflows}

@app.get("/status")
async def get_status(id: str):
    if id not in ACTIVE_WORKFLOWS:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    wf = ACTIVE_WORKFLOWS[id]
    dag = wf["dag_obj"]

    # Map backend Python state to frontend JSON contract
    nodes = []
    edges = []

    for node in dag.nodes:
        # Map python enum value to lowercase (WAITING_APPROVAL -> waiting_approval)
        raw_status = node.status.value.lower()
        if raw_status == 'waiting approval':
            raw_status = 'waiting_approval'

        # Infer tool name cleanly for icons
        tool_name = "generic"
        if "jira" in str(node.tool).lower(): tool_name = "jira"
        if "github" in str(node.tool).lower(): tool_name = "github"
        if "slack" in str(node.tool).lower(): tool_name = "slack"
        if "sheet" in str(node.tool).lower(): tool_name = "sheets"
        if "system" in str(node.tool).lower(): tool_name = "system"

        frontend_node = {
            "id": node.id,
            "title": node.name or node.action,
            "description": f"Tool: {node.tool} Action: {node.action}",
            "status": raw_status,
            "tool": tool_name,
            "inputs": node.inputs,
            "outputs": node.output
        }
        nodes.append(frontend_node)

        # Build edges based on depends_on array
        for dep in getattr(node, 'depends_on', []):
            edges.append({
                "source": dep,
                "target": node.id
            })

    return {
        "workflow_id": id,
        "title": wf.get("title", id),
        "nodes": nodes,
        "edges": edges
    }

@app.post("/approve")
async def approve_node(req: ApproveRequest):
    if req.workflow_id not in ACTIVE_WORKFLOWS:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    wf = ACTIVE_WORKFLOWS[req.workflow_id]
    hitl: AsyncHITLGate = wf["hitl"]
    
    success = hitl.trigger_approval(req.node_id, req.approved)
    
    if not success:
        raise HTTPException(status_code=400, detail="Node is not pending approval")
        
    return {"status": "ok", "message": f"Approval ({req.approved}) registered for {req.node_id}"}


@app.websocket("/ws/status/{id}")
async def websocket_status(websocket: WebSocket, id: str):
    await websocket.accept()
    if id not in ACTIVE_WORKFLOWS:
        await websocket.close(code=1008)
        return
        
    try:
        while True:
            # Reusing the existing generic status generator format
            wf = ACTIVE_WORKFLOWS[id]
            dag = wf["dag_obj"]
            nodes_out = []
            edges_out = []

            for node in dag.nodes:
                raw_status = node.status.value.lower()
                if raw_status == 'waiting approval':
                    raw_status = 'waiting_approval'

                tool_name = "generic"
                if "jira" in str(node.tool).lower(): tool_name = "jira"
                if "github" in str(node.tool).lower(): tool_name = "github"
                if "slack" in str(node.tool).lower(): tool_name = "slack"
                if "sheet" in str(node.tool).lower(): tool_name = "sheets"

                nodes_out.append({
                    "id": node.id,
                    "title": node.name or node.action,
                    "description": f"Tool: {node.tool} Action: {node.action}",
                    "status": raw_status,
                    "tool": tool_name,
                    "inputs": node.inputs,
                    "outputs": node.output
                })

                for dep in getattr(node, 'depends_on', []):
                    edges_out.append({"source": dep, "target": node.id})

            payload = {
                "workflow_id": id,
                "title": wf.get("title", id),
                "nodes": nodes_out,
                "edges": edges_out
            }
            
            await websocket.send_json(payload)
            await asyncio.sleep(0.5) # Send updates every 500ms for smooth real-time UI UI
            
    except WebSocketDisconnect:
        pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
