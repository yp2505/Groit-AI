from fastapi import APIRouter, HTTPException, Request
import logging
from schemas.dag_schema import WorkflowRequest, WorkflowDAG  # type: ignore
from services.models.llm_resolver import generate_dag  # type: ignore
from services.engine.dag_executor import DAGExecutor  # type: ignore

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v3", tags=["Workflow"])

@router.post("/execute")
async def execute_workflow(request: WorkflowRequest, http_request: Request):
    """
    1. Parse natural language into DAG using the Fine-Tuned Model Resolver
    2. Execute DAG using Backend Engine (Composio)
    """
    user_id = http_request.headers.get("X-User-Id", "anonymous")
    logger.info(f"Received execute request for user: {user_id}")
    
    # 1. Parsing layer and LLM model call (or skip if DAG provided)
    try:
        if request.dag:
            dag = request.dag
        elif request.user_input:
            dag_json = generate_dag(request.user_input)
            dag = WorkflowDAG(**dag_json)
        else:
            raise ValueError("Must provide either user_input or dag")
    except Exception as e:
        logger.error(f"Failed to generate or parse DAG: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate or parse DAG: {str(e)}")

    # 2. Execution layer
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
