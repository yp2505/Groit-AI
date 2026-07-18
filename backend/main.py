from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from routers.workflow_router import router as workflow_router
from routers.integrations_router import router as integrations_router

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(name)-28s │ %(levelname)-7s │ %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("backend_v2")

app = FastAPI(
    title="DAG Resolver API",
    description="Backend for interpreting natural language into DAG pipelines and executing them.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workflow_router)
app.include_router(integrations_router)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
