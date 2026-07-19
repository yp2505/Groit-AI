import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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
# Check both relative (local dev) and absolute (Railway monorepo build) paths
_script_dir = os.path.dirname(os.path.abspath(__file__))
frontend_path = os.path.join(_script_dir, "..", "frontend", "dist")
frontend_path = os.path.abspath(frontend_path)

if os.path.isdir(frontend_path):
    logger.info(f"Serving frontend from: {frontend_path}")
    # Mount the assets directory directly
    assets_path = os.path.join(frontend_path, "assets")
    if os.path.isdir(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    # ── Catch-all route to serve index.html for SPA routing ──
    # IMPORTANT: API routes are registered ABOVE this, so FastAPI will match
    # them first. This only catches truly unknown paths (frontend page routes).
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Hard-guard: never serve HTML for API/WS paths
        API_PREFIXES = ("api/", "api", "ws/", "ws", "docs", "redoc", "openapi")
        if any(full_path == p or full_path.startswith(p + "/") or full_path.startswith(p) for p in API_PREFIXES):
            return JSONResponse(status_code=404, content={"error": "Not found"})

        file_path = os.path.join(frontend_path, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # SPA fallback
        return FileResponse(os.path.join(frontend_path, "index.html"))
else:
    logger.warning(f"Frontend dist not found at {frontend_path} — serving API only.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
