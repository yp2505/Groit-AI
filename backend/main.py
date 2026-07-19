import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import logging
from routers.workflow_router import router as workflow_router # type: ignore
from routers.integrations_router import router as integrations_router # type: ignore

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

app.include_router(workflow_router, prefix="/api")
app.include_router(integrations_router, prefix="/api")

@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

# Serve Frontend static files if they exist
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_path):
    # Mount the assets directory directly
    assets_path = os.path.join(frontend_path, "assets")
    if os.path.isdir(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
    
    # Catch-all route to serve index.html for SPA routing
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Prevent API routes from falling through to frontend
        if full_path.startswith("api/") or full_path.startswith("integrations/") or full_path.startswith("workflow/"):
            return {"error": "Not found"}
            
        file_path = os.path.join(frontend_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
