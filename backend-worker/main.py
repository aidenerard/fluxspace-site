"""
FluxSpace Backend Worker – FastAPI service that processes scan pipeline jobs.

Endpoint:
    POST /process  { scan_id, user_id }
        Downloads the uploaded zip from Supabase Storage, runs the pipeline,
        uploads outputs, and updates the DB.
"""

import os
import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel

from pipeline.runner import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("FluxSpace worker starting up")
    yield
    logger.info("FluxSpace worker shutting down")


app = FastAPI(
    title="FluxSpace Worker",
    version="0.1.0",
    lifespan=lifespan,
)


class ProcessRequest(BaseModel):
    scan_id: str
    user_id: str


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/process")
async def process_scan(
    body: ProcessRequest,
    authorization: str = Header(default=""),
):
    # Validate auth: the Next.js API sends the service role key as Bearer token
    token = authorization.replace("Bearer ", "").strip()
    if not SUPABASE_SERVICE_ROLE_KEY or token != SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")

    logger.info(f"Received process request for scan_id={body.scan_id}")

    # Run pipeline in background so we return 202 quickly
    asyncio.create_task(
        _run_pipeline_task(body.scan_id, body.user_id)
    )

    return {"status": "accepted", "scan_id": body.scan_id}


async def _run_pipeline_task(scan_id: str, user_id: str):
    """Background task wrapper that catches exceptions."""
    try:
        await asyncio.to_thread(run_pipeline, scan_id, user_id)
    except Exception:
        logger.exception(f"Pipeline failed for scan_id={scan_id}")
