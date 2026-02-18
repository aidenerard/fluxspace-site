import os
import json
import tempfile
import shutil
import zipfile
from typing import Optional, Dict, Any, List

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")

# Buckets (change if your bucket names differ)
RUNS_RAW_BUCKET = os.environ.get("RUNS_RAW_BUCKET", "runs-raw")
RUNS_OUT_BUCKET = os.environ.get("RUNS_OUT_BUCKET", "runs-out")  # optional, for outputs later

# Option B storage layout
UPLOAD_PREFIX = os.environ.get("UPLOAD_PREFIX", "upload")
PARTS_DIR = os.environ.get("PARTS_DIR", "parts")
MANIFEST_NAME = os.environ.get("MANIFEST_NAME", "manifest.json")
RECONSTRUCTED_ZIP_NAME = os.environ.get("RECONSTRUCTED_ZIP_NAME", "input.zip")

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(1024 * 1024 * 1024)))  # 1GB default

app = FastAPI()

ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_env():
    missing = []
    for k in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "WORKER_SECRET"]:
        if not os.environ.get(k):
            missing.append(k)
    if missing:
        raise HTTPException(status_code=500, detail=f"Worker env missing: {', '.join(missing)}")


def supabase_get_run(run_id: str) -> Optional[dict]:
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/runs",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Accept": "application/json",
        },
        params={"id": f"eq.{run_id}", "select": "*"},
        timeout=20,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"DB read failed: {resp.status_code} {resp.text}")
    rows = resp.json()
    return rows[0] if rows else None


def supabase_update_run(run_id: str, patch: dict):
    resp = requests.patch(
        f"{SUPABASE_URL}/rest/v1/runs?id=eq.{run_id}",
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        data=json.dumps(patch),
        timeout=20,
    )
    if resp.status_code not in (200, 204):
        raise HTTPException(status_code=500, detail=f"DB update failed: {resp.status_code} {resp.text}")


def storage_download_to_bytes(bucket: str, object_path: str, timeout: int = 60) -> bytes:
    """
    Download small file fully into memory (manifest.json).
    """
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    resp = requests.get(
        url,
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
        timeout=timeout,
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Storage download failed: {resp.status_code} {resp.text}")
    return resp.content


def storage_stream_download_to_file(bucket: str, object_path: str, out_fp, timeout: int = 1200) -> int:
    """
    Stream download large file (part_*.bin) into an open file handle.
    Returns bytes written.
    """
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    with requests.get(
        url,
        headers={
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        },
        stream=True,
        timeout=timeout,
    ) as resp:
        if resp.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Storage download failed for {object_path}: {resp.status_code} {resp.text}")
        total = 0
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            if chunk:
                out_fp.write(chunk)
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Reconstructed file too large")
        return total


def storage_upload_file(bucket: str, object_path: str, file_path: str, content_type: str = "application/zip"):
    """
    Upload using Storage REST API with service role.
    """
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    with open(file_path, "rb") as f:
        resp = requests.post(
            url,
            headers={
                "apikey": SUPABASE_SERVICE_ROLE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            data=f,
            timeout=1200,
        )
    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {resp.status_code} {resp.text}")


def expected_manifest_path(run_id: str) -> str:
    # runs-raw/<runId>/upload/manifest.json
    return f"{run_id}/{UPLOAD_PREFIX}/{MANIFEST_NAME}"


def expected_part_path(run_id: str, key: str) -> str:
    # manifest contains keys like "upload/parts/part_00001.bin" or "parts/part_00001.bin"
    # Normalize to ensure correct prefix under runId/
    key = key.lstrip("/")
    # If client stores full "upload/parts/..." keys, keep it.
    # If it stores only "part_00001.bin" or "parts/...", handle that too.
    if key.startswith(f"{UPLOAD_PREFIX}/"):
        return f"{run_id}/{key}"
    if key.startswith(f"{PARTS_DIR}/"):
        return f"{run_id}/{UPLOAD_PREFIX}/{key}"
    if key.startswith("part_"):
        return f"{run_id}/{UPLOAD_PREFIX}/{PARTS_DIR}/{key}"
    return f"{run_id}/{UPLOAD_PREFIX}/{PARTS_DIR}/{key}"


def load_manifest(run_id: str) -> Dict[str, Any]:
    raw = storage_download_to_bytes(RUNS_RAW_BUCKET, expected_manifest_path(run_id))
    try:
        m = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=500, detail="Invalid manifest.json (not valid JSON)")
    return m


def validate_manifest(manifest: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    We expect something like:
      { "parts": [ { "key": "...", "size": 12345 }, ... ], "totalBytes": 123, "chunkSize": 49MB }
    """
    parts = manifest.get("parts")
    if not isinstance(parts, list) or not parts:
        raise HTTPException(status_code=500, detail="manifest.json missing parts[]")

    cleaned = []
    total = 0
    for i, p in enumerate(parts):
        if not isinstance(p, dict):
            raise HTTPException(status_code=500, detail=f"manifest.json parts[{i}] invalid")
        key = p.get("key")
        size = p.get("size")
        if not isinstance(key, str) or not key:
            raise HTTPException(status_code=500, detail=f"manifest.json parts[{i}].key missing")
        if not isinstance(size, int) or size <= 0:
            raise HTTPException(status_code=500, detail=f"manifest.json parts[{i}].size missing/invalid")
        total += size
        cleaned.append({"key": key, "size": size})

    if total > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="manifest totalBytes exceeds MAX_UPLOAD_BYTES")

    return cleaned


def unzip_smoke_test(zip_path: str, out_dir: str):
    """
    Ensures zip is valid and can be extracted.
    """
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            bad = z.testzip()
            if bad:
                raise HTTPException(status_code=500, detail=f"Corrupt zip entry: {bad}")
            z.extractall(out_dir)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=500, detail="Reconstructed zip is not a valid zip (BadZipFile)")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/jobs/run")
def jobs_run(payload: dict, authorization: Optional[str] = Header(default=None)):
    """
    Option B worker entrypoint:
      - Validate worker secret
      - Read run
      - Download manifest + parts from Storage
      - Reconstruct input.zip
      - (Optional) upload reconstructed zip back to Storage for debugging
      - Smoke-test unzip
      - Update run status
    """
    _require_env()

    if not authorization or authorization != f"Bearer {WORKER_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    run_id = payload.get("runId")
    if not run_id:
        raise HTTPException(status_code=400, detail="Missing runId")

    run = supabase_get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Mark as queued/processing
    supabase_update_run(run_id, {
        "status": "processing",
        "stage": "worker_reassemble",
        "progress": 10,
        "error": None,
    })

    workdir = tempfile.mkdtemp(prefix=f"fluxspace_{run_id}_")
    zip_path = os.path.join(workdir, RECONSTRUCTED_ZIP_NAME)
    extract_dir = os.path.join(workdir, "unzipped")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        manifest = load_manifest(run_id)
        parts = validate_manifest(manifest)

        # Reassemble zip
        bytes_written = 0
        with open(zip_path, "wb") as out:
            for idx, p in enumerate(parts):
                part_object_path = expected_part_path(run_id, p["key"])
                # progress from 10 -> 70 while downloading parts
                prog = 10 + int(60 * (idx / max(1, len(parts))))
                supabase_update_run(run_id, {
                    "stage": f"downloading_part_{idx+1}_of_{len(parts)}",
                    "progress": prog,
                })
                bytes_written += storage_stream_download_to_file(RUNS_RAW_BUCKET, part_object_path, out)

        if bytes_written <= 0:
            raise HTTPException(status_code=500, detail="Reassembly produced empty zip")

        # Optional: store reconstructed zip where the rest of your system expects it
        # runs-raw/<runId>/input.zip
        raw_zip_object = f"{run_id}/{RECONSTRUCTED_ZIP_NAME}"
        supabase_update_run(run_id, {"stage": "uploading_reconstructed_zip", "progress": 75})
        storage_upload_file(RUNS_RAW_BUCKET, raw_zip_object, zip_path, content_type="application/zip")
        supabase_update_run(run_id, {"raw_zip_path": raw_zip_object})

        # Smoke-test unzip
        supabase_update_run(run_id, {"stage": "validating_zip", "progress": 85})
        unzip_smoke_test(zip_path, extract_dir)

        # ✅ If you get here, the upload + reassembly path works.
        # Next step: call fluxspace-core processing using files in extract_dir,
        # then upload outputs and update run stage/status accordingly.
        supabase_update_run(run_id, {"stage": "ready_for_processing", "progress": 90})

        return {
            "ok": True,
            "runId": run_id,
            "message": "Reassembled zip and unzip validated. Ready for processing.",
            "bytes": bytes_written,
            "rawZipPath": raw_zip_object,
        }

    except HTTPException as e:
        # Write error into run row so UI can show it
        try:
            supabase_update_run(run_id, {
                "status": "failed",
                "stage": "failed",
                "progress": 0,
                "error": str(e.detail),
            })
        except Exception:
            pass
        raise

    except Exception as e:
        try:
            supabase_update_run(run_id, {
                "status": "failed",
                "stage": "failed",
                "progress": 0,
                "error": f"Worker exception: {type(e).__name__}: {e}",
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Worker exception: {type(e).__name__}: {e}")

    finally:
        shutil.rmtree(workdir, ignore_errors=True)
