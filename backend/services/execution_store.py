import os
import json
import logging
from typing import Dict, Optional
from api_schemas.execution import WorkflowExecution, WorkflowStatus
from services.mongodb_client import MongoDBClient

logger = logging.getLogger("mcp_gateway.execution_store")

class ExecutionStore:
    """Hybrid store for workflow execution states (In-memory + MongoDB/JSON fallback)."""
    _instance = None
    _executions: Dict[str, WorkflowExecution] = {}
    _db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "workflows_db.json")

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ExecutionStore, cls).__new__(cls)
            cls._instance._load_initial()
        return cls._instance

    def _load_initial(self):
        """Initial load from JSON (bootstrapping). MongoDB loads happen on-demand or can be added here."""
        if not os.path.exists(self._db_path):
            return
        try:
            with open(self._db_path, "r") as f:
                data = json.load(f)
                for eid, raw in data.items():
                    try:
                        self._executions[eid] = WorkflowExecution(**raw)
                    except Exception as e:
                        logger.error(f"Failed to parse execution {eid}: {e}")
            logger.info(f"Loaded {len(self._executions)} workflows from legacy JSON")
        except Exception as e:
            logger.error(f"Failed to load workflows from JSON fallback: {e}")

    async def save(self, execution: WorkflowExecution):
        """Save execution to memory and persist to MongoDB or JSON."""
        # 1. Update in-memory cache
        self._executions[execution.execution_id] = execution
        
        # 2. Persist to MongoDB if available
        db = MongoDBClient.get_db()
        if db is not None:
            try:
                await db.executions.replace_one(
                    {"execution_id": execution.execution_id},
                    execution.model_dump(),
                    upsert=True
                )
                logger.debug(f"Saved execution {execution.execution_id} to MongoDB")
                return
            except Exception as e:
                logger.error(f"MongoDB save failed: {e}")

        # 3. Fallback to JSON if MongoDB fails or is not connected
        try:
            data = {eid: exec.model_dump() for eid, exec in self._executions.items()}
            with open(self._db_path, "w") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save workflows to JSON fallback: {e}")

    def get(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Synchronous get from memory cache."""
        return self._executions.get(execution_id)

    async def fetch_from_db(self, execution_id: str) -> Optional[WorkflowExecution]:
        """Asynchronous fetch from MongoDB with cache update."""
        db = MongoDBClient.get_db()
        if db is None:
            return self.get(execution_id)
            
        try:
            raw = await db.executions.find_one({"execution_id": execution_id})
            if raw:
                # Remove _id if present from MongoDB
                raw.pop("_id", None)
                execution = WorkflowExecution(**raw)
                self._executions[execution_id] = execution
                return execution
        except Exception as e:
            logger.error(f"MongoDB fetch failed: {e}")
            
        return self.get(execution_id)

    def get_all(self) -> Dict[str, WorkflowExecution]:
        """Synchronous get all from memory cache."""
        return self._executions

    async def refresh_all(self) -> Dict[str, WorkflowExecution]:
        """Refresh memory cache from MongoDB."""
        db = MongoDBClient.get_db()
        if db is None:
            return self.get_all()

        try:
            cursor = db.executions.find({})
            async for raw in cursor:
                raw.pop("_id", None)
                try:
                    execution = WorkflowExecution(**raw)
                    self._executions[execution.execution_id] = execution
                except Exception as e:
                    logger.error(f"Failed to parse execution from MongoDB: {e}")
        except Exception as e:
            logger.error(f"MongoDB refresh_all failed: {e}")
            
        return self._executions

def get_execution_store() -> ExecutionStore:
    return ExecutionStore()
