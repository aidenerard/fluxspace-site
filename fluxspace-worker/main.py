import os
import json
import tempfile
import shutil
import zipfile
from typing import Optional, Dict, Any, List

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

CODE_VERSION = "2026-02-17-v8"

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")

RUNS_RAW_BUCKET = os.environ.get("RUNS_RAW_BUCKET", "runs-raw")
RECONSTRUCTED_ZIP_NAME = os.environ.get("RECONSTRUCTED_ZIP_NAME", "input.zip")

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(1024 * 1024 * 1024)))

app = FastAPI()

ALLOWED_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cached after first successful download — either "" or "authenticated/"
_download_prefix: Optional[str] = None


def _auth_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }


def _require_env():
    missing = []
    for k in ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WORKER_SECRET"]:
        if not os.environ.get(k):
            missing.append(k)
    if missing:
        raise HTTPException(status_code=500, detail=f"Worker env missing: {', '.join(missing)}")


# ── DB helpers ────────────────────────────────────────────

def supabase_get_run(run_id: str) -> Optional[dict]:
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/runs",
        headers={**_auth_headers(), "Accept": "application/json"},
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
        headers={**_auth_headers(), "Content-Type": "application/json", "Prefer": "return=minimal"},
        data=json.dumps(patch),
        timeout=20,
    )
    if resp.status_code not in (200, 204):
        print(f"[db] update failed for runId={run_id}: {resp.status_code} {resp.text[:300]}")


# ── Storage helpers ───────────────────────────────────────
#
# Supabase Storage has multiple GET routes for downloading objects from
# private buckets. Different Supabase versions may require different paths:
#   GET /storage/v1/object/{bucket}/{path}                   (some versions)
#   GET /storage/v1/object/authenticated/{bucket}/{path}     (other versions)
#
# On the first download we try both, cache whichever returns 200, and reuse
# that prefix for all subsequent downloads in this process lifetime.

def _build_download_url(bucket: str, object_path: str, prefix: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/{prefix}{bucket}/{object_path}"


def _try_get(url: str, timeout: int = 120, stream: bool = False):
    """Low-level GET that returns the response object (caller must handle)."""
    return requests.get(url, headers=_auth_headers(), stream=stream, timeout=timeout)


def _detect_and_download(bucket: str, object_path: str, timeout: int = 120) -> requests.Response:
    """
    Try downloading with both URL prefixes. Cache whichever works.
    Returns the successful response or raises.
    """
    global _download_prefix

    if _download_prefix is not None:
        url = _build_download_url(bucket, object_path, _download_prefix)
        print(f"[storage] GET (cached prefix='{_download_prefix}') {url}")
        resp = _try_get(url, timeout=timeout)
        if resp.status_code == 200:
            return resp
        print(f"[storage] {resp.status_code} — clearing cached prefix and retrying both patterns")
        _download_prefix = None

    prefixes = ["", "authenticated/"]
    errors = []
    for pfx in prefixes:
        url = _build_download_url(bucket, object_path, pfx)
        print(f"[storage] trying GET prefix='{pfx}' → {url}")
        resp = _try_get(url, timeout=timeout)
        if resp.status_code == 200:
            _download_prefix = pfx
            print(f"[storage] 200 OK — caching prefix='{pfx}' for future downloads")
            return resp
        msg = f"prefix='{pfx}' status={resp.status_code} body={resp.text[:200]}"
        print(f"[storage] FAIL {msg}")
        errors.append(msg)

    detail = (
        f"Storage download failed for all URL patterns. "
        f"bucket={bucket} path={object_path} | "
        + " | ".join(errors)
    )
    raise HTTPException(status_code=500, detail=detail)


def storage_download_bytes(bucket: str, object_path: str, timeout: int = 120) -> bytes:
    """Download a storage object fully into memory."""
    print(f"[storage] download_bytes bucket={bucket} path={object_path}")
    resp = _detect_and_download(bucket, object_path, timeout)
    print(f"[storage] got {len(resp.content)} bytes for {object_path}")
    return resp.content


def storage_stream_to_file(bucket: str, object_path: str, out_fp, timeout: int = 1200) -> int:
    """Stream a storage object to a file handle. Returns bytes written."""
    global _download_prefix
    print(f"[storage] stream_to_file bucket={bucket} path={object_path}")

    # For streaming we need to know which prefix works
    if _download_prefix is None:
        # Do a quick probe with the manifest-sized timeout to detect prefix
        _detect_and_download(bucket, object_path, timeout=30)
        # If we get here, prefix is cached but we consumed the response.
        # Fall through to the streaming download below.

    url = _build_download_url(bucket, object_path, _download_prefix or "")
    print(f"[storage] streaming GET {url}")
    with requests.get(url, headers=_auth_headers(), stream=True, timeout=timeout) as resp:
        if resp.status_code != 200:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Storage stream failed: bucket={bucket} path={object_path} "
                    f"url={url} status={resp.status_code} body={resp.text[:300]}"
                ),
            )
        total = 0
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            if chunk:
                out_fp.write(chunk)
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Reconstructed file too large")
        print(f"[storage] streamed {total} bytes for {object_path}")
        return total


SUPABASE_MAX_OBJECT_BYTES = int(os.environ.get("SUPABASE_MAX_OBJECT_BYTES", str(50 * 1024 * 1024)))


def storage_upload_file(
    bucket: str,
    object_path: str,
    file_path: str,
    content_type: str = "application/zip",
    step: str = "unknown",
):
    file_size = os.path.getsize(file_path)
    print(
        f"[upload] step={step} bucket={bucket} path={object_path} "
        f"content_type={content_type} size={file_size} bytes "
        f"({file_size / (1024*1024):.1f} MB)"
    )
    if file_size > SUPABASE_MAX_OBJECT_BYTES:
        msg = (
            f"Skipping upload: file too large for Supabase Free plan. "
            f"step={step} path={object_path} size={file_size} bytes "
            f"({file_size / (1024*1024):.1f} MB) limit={SUPABASE_MAX_OBJECT_BYTES} bytes "
            f"({SUPABASE_MAX_OBJECT_BYTES / (1024*1024):.0f} MB)"
        )
        print(f"[upload] {msg}")
        return False

    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    with open(file_path, "rb") as f:
        resp = requests.post(
            url,
            headers={**_auth_headers(), "Content-Type": content_type, "x-upsert": "true"},
            data=f,
            timeout=1200,
        )
    if resp.status_code not in (200, 201):
        detail = (
            f"Storage upload failed: step={step} bucket={bucket} path={object_path} "
            f"size={file_size} status={resp.status_code} body={resp.text[:300]}"
        )
        raise HTTPException(status_code=500, detail=detail)
    print(f"[upload] OK step={step} path={object_path}")
    return True


# ── Manifest + parts ─────────────────────────────────────

def manifest_path(run_id: str) -> str:
    return f"runs/{run_id}/upload/manifest.json"


def validate_manifest(manifest: Dict[str, Any], run_id: str) -> List[Dict[str, Any]]:
    parts = manifest.get("parts")
    if not isinstance(parts, list) or not parts:
        raise HTTPException(status_code=500, detail="manifest.json missing parts[]")

    cleaned = []
    total = 0
    for i, p in enumerate(parts):
        if not isinstance(p, dict):
            raise HTTPException(status_code=500, detail=f"manifest parts[{i}] invalid")
        key = p.get("key")
        size = p.get("sizeBytes") or p.get("size")
        if not isinstance(key, str) or not key:
            raise HTTPException(status_code=500, detail=f"manifest parts[{i}].key missing")
        if not isinstance(size, int) or size <= 0:
            raise HTTPException(status_code=500, detail=f"manifest parts[{i}] size missing")
        total += size
        cleaned.append({"key": key, "size": size})

    if total > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Total size exceeds MAX_UPLOAD_BYTES")

    print(f"[manifest] validated {len(cleaned)} parts, {total} bytes total for runId={run_id}")
    for c in cleaned:
        print(f"[manifest]   key={c['key']}  size={c['size']}")
    return cleaned


def unzip_smoke_test(zip_path: str, out_dir: str):
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            bad = z.testzip()
            if bad:
                raise HTTPException(status_code=500, detail=f"Corrupt zip entry: {bad}")
            z.extractall(out_dir)
    except zipfile.BadZipFile:
        raise HTTPException(status_code=500, detail="Reconstructed file is not a valid zip")


# ── Endpoints ─────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    print(f"[worker] code_version={CODE_VERSION}")
    print(f"[worker] SUPABASE_URL={SUPABASE_URL}")
    print(f"[worker] RUNS_RAW_BUCKET={RUNS_RAW_BUCKET}")
    print(f"[worker] SERVICE_ROLE_KEY={'set (' + SUPABASE_SERVICE_ROLE_KEY[:20] + '...)' if SUPABASE_SERVICE_ROLE_KEY else 'MISSING'}")
    print(f"[worker] WORKER_SECRET={'set' if WORKER_SECRET else 'MISSING'}")


@app.get("/health")
def health():
    return {"ok": True, "version": CODE_VERSION}


@app.get("/debug/test-storage/{run_id}")
def debug_test_storage(run_id: str, authorization: Optional[str] = Header(default=None)):
    """Manual test endpoint: try to download the manifest for a runId."""
    if not authorization or authorization != f"Bearer {WORKER_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    _require_env()
    mpath = manifest_path(run_id)
    bucket = RUNS_RAW_BUCKET

    results = []
    for pfx in ["", "authenticated/"]:
        url = _build_download_url(bucket, mpath, pfx)
        try:
            resp = requests.get(url, headers=_auth_headers(), timeout=15)
            results.append({
                "prefix": pfx or "(none)",
                "url": url,
                "status": resp.status_code,
                "body_preview": resp.text[:200] if resp.status_code != 200 else f"OK ({len(resp.content)} bytes)",
            })
        except Exception as e:
            results.append({"prefix": pfx or "(none)", "url": url, "error": str(e)})

    return {
        "run_id": run_id,
        "bucket": bucket,
        "object_path": mpath,
        "results": results,
    }


@app.post("/jobs/run")
def jobs_run(payload: dict, authorization: Optional[str] = Header(default=None)):
    _require_env()

    if not authorization or authorization != f"Bearer {WORKER_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    run_id = payload.get("runId")
    if not run_id:
        raise HTTPException(status_code=400, detail="Missing runId")

    print(f"[jobs/run] ======== START runId={run_id} version={CODE_VERSION} ========")

    run = supabase_get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run not found: {run_id}")

    supabase_update_run(run_id, {
        "status": "processing",
        "stage": "worker_reassemble",
        "progress": 10,
        "error_message": None,
    })

    workdir = tempfile.mkdtemp(prefix=f"fluxspace_{run_id}_")
    zip_path = os.path.join(workdir, RECONSTRUCTED_ZIP_NAME)
    extract_dir = os.path.join(workdir, "unzipped")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        # 1 — Download manifest
        mpath = manifest_path(run_id)
        print(f"[jobs/run] manifest: bucket={RUNS_RAW_BUCKET} path={mpath}")
        raw = storage_download_bytes(RUNS_RAW_BUCKET, mpath)
        try:
            manifest = json.loads(raw.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=500, detail="manifest.json is not valid JSON")

        parts = validate_manifest(manifest, run_id)

        # 2 — Download each part (keys come straight from the manifest)
        bytes_written = 0
        with open(zip_path, "wb") as out:
            for idx, p in enumerate(parts):
                part_key = p["key"]
                print(f"[jobs/run] part {idx+1}/{len(parts)}: bucket={RUNS_RAW_BUCKET} path={part_key}")

                prog = 10 + int(60 * (idx / max(1, len(parts))))
                supabase_update_run(run_id, {
                    "stage": f"downloading_part_{idx+1}_of_{len(parts)}",
                    "progress": prog,
                })
                bytes_written += storage_stream_to_file(RUNS_RAW_BUCKET, part_key, out)

        if bytes_written <= 0:
            raise HTTPException(status_code=500, detail="Reassembly produced empty zip")
        print(f"[jobs/run] reassembled {bytes_written} bytes")

        # 3 — Optionally upload reconstructed zip (skipped if > 50 MB)
        raw_zip_object = f"runs/{run_id}/{RECONSTRUCTED_ZIP_NAME}"
        supabase_update_run(run_id, {"stage": "uploading_reconstructed_zip", "progress": 75})
        uploaded = storage_upload_file(
            RUNS_RAW_BUCKET, raw_zip_object, zip_path,
            content_type="application/zip", step="reconstructed_zip",
        )
        if uploaded:
            supabase_update_run(run_id, {"raw_zip_path": raw_zip_object})
        else:
            supabase_update_run(run_id, {"raw_zip_path": manifest_path(run_id)})

        # 4 — Smoke-test unzip
        supabase_update_run(run_id, {"stage": "validating_zip", "progress": 85})
        unzip_smoke_test(zip_path, extract_dir)

        supabase_update_run(run_id, {"stage": "ready_for_processing", "progress": 90})
        print(f"[jobs/run] ======== SUCCESS runId={run_id} ========")

        return {
            "ok": True,
            "runId": run_id,
            "message": "Reassembled and validated. Ready for processing.",
            "bytes": bytes_written,
        }

    except HTTPException as e:
        print(f"[jobs/run] FAILED runId={run_id}: {e.detail}")
        try:
            supabase_update_run(run_id, {
                "status": "failed",
                "stage": "failed",
                "progress": 0,
                "error_message": str(e.detail),
            })
        except Exception:
            pass
        raise

    except Exception as e:
        msg = f"Worker exception: {type(e).__name__}: {e}"
        print(f"[jobs/run] FAILED runId={run_id}: {msg}")
        try:
            supabase_update_run(run_id, {
                "status": "failed",
                "stage": "failed",
                "progress": 0,
                "error_message": msg,
            })
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=msg)

    finally:
        shutil.rmtree(workdir, ignore_errors=True)
