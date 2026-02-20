import os
import sys
import json
import asyncio
import tempfile
import shutil
import traceback
import zipfile
from typing import Optional, Dict, Any, List

import requests
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

CODE_VERSION = "2026-02-20-v13"

ASSETS_DIR = os.path.join(os.path.dirname(__file__) or ".", "assets")
PLACEHOLDER_SURFACE = os.path.join(ASSETS_DIR, "placeholder_surface.glb")

try:
    from reconstruct import build_surface_glb
    HAS_RECONSTRUCTION = True
except ImportError as _imp_err:
    HAS_RECONSTRUCTION = False
    build_surface_glb = None  # type: ignore[assignment]
    print(f"[worker] WARNING: reconstruction module unavailable: {_imp_err}")
    print("[worker] Will fall back to placeholder GLB for viewer assets")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")
WORKER_SECRET = os.environ.get("WORKER_SECRET", "")

RUNS_RAW_BUCKET = os.environ.get("RUNS_RAW_BUCKET", "runs-raw")
RUNS_VIEWER_BUCKET = os.environ.get("RUNS_VIEWER_BUCKET", "runs-viewer")
RECONSTRUCTED_ZIP_NAME = os.environ.get("RECONSTRUCTED_ZIP_NAME", "input.zip")

MAX_UPLOAD_BYTES = int(os.environ.get("MAX_UPLOAD_BYTES", str(1024 * 1024 * 1024)))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "2"))

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


def storage_upload_bytes(
    bucket: str,
    object_path: str,
    data: bytes,
    content_type: str = "application/octet-stream",
    step: str = "unknown",
) -> bool:
    """Upload raw bytes to Supabase Storage. Returns True on success."""
    print(
        f"[upload] step={step} bucket={bucket} path={object_path} "
        f"content_type={content_type} size={len(data)} bytes"
    )
    if len(data) > SUPABASE_MAX_OBJECT_BYTES:
        print(f"[upload] skipping {step}: {len(data)} bytes exceeds limit")
        return False

    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    resp = requests.post(
        url,
        headers={**_auth_headers(), "Content-Type": content_type, "x-upsert": "true"},
        data=data,
        timeout=60,
    )
    if resp.status_code not in (200, 201):
        print(
            f"[upload] FAILED step={step} bucket={bucket} path={object_path} "
            f"status={resp.status_code} body={resp.text[:300]}"
        )
        return False
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


# ── Pipeline (shared by HTTP endpoint + poller) ──────────

def process_run(run_id: str) -> dict:
    """
    Full pipeline: download parts → reassemble → unzip → reconstruct/placeholder → upload → done.
    Updates DB throughout. On failure, marks run as failed then re-raises.
    """
    print(f"[process] ======== START runId={run_id} version={CODE_VERSION} ========")

    run = supabase_get_run(run_id)
    if not run:
        raise ValueError(f"Run not found: {run_id}")

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
        print(f"[process] manifest: bucket={RUNS_RAW_BUCKET} path={mpath}")
        raw = storage_download_bytes(RUNS_RAW_BUCKET, mpath)
        try:
            manifest = json.loads(raw.decode("utf-8"))
        except Exception:
            raise RuntimeError("manifest.json is not valid JSON")

        parts = validate_manifest(manifest, run_id)

        # 2 — Download each part
        bytes_written = 0
        with open(zip_path, "wb") as out:
            for idx, p in enumerate(parts):
                part_key = p["key"]
                print(f"[process] part {idx+1}/{len(parts)}: bucket={RUNS_RAW_BUCKET} path={part_key}")
                prog = 10 + int(60 * (idx / max(1, len(parts))))
                supabase_update_run(run_id, {
                    "stage": f"downloading_part_{idx+1}_of_{len(parts)}",
                    "progress": prog,
                })
                bytes_written += storage_stream_to_file(RUNS_RAW_BUCKET, part_key, out)

        if bytes_written <= 0:
            raise RuntimeError("Reassembly produced empty zip")
        print(f"[process] reassembled {bytes_written} bytes")

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

        # 5 — Build viewer GLB from RGBD data (or fall back to placeholder)
        vb = RUNS_VIEWER_BUCKET
        surface_key = f"runs/{run_id}/surface.glb"
        vm_key = f"runs/{run_id}/viewer_manifest.json"
        viewer_out = os.path.join(workdir, "viewer_out")
        os.makedirs(viewer_out, exist_ok=True)
        glb_path = os.path.join(viewer_out, "surface.glb")
        used_reconstruction = False

        if HAS_RECONSTRUCTION:
            supabase_update_run(run_id, {"stage": "build_viewer_assets", "progress": 88})
            print("[process] running RGBD → TSDF → GLB reconstruction...")
            try:
                def _recon_progress(msg, pct):
                    mapped = 88 + int(pct * 0.07)
                    supabase_update_run(run_id, {"stage": msg, "progress": min(mapped, 95)})

                build_surface_glb(extract_dir, glb_path, progress_fn=_recon_progress)
                used_reconstruction = True
            except Exception as recon_exc:
                tb = traceback.format_exc()
                print(f"[process] reconstruction FAILED: {recon_exc}\n{tb}")
                raise RuntimeError(f"Reconstruction failed: {recon_exc}\n{tb[-500:]}")
        else:
            supabase_update_run(run_id, {"stage": "uploading_viewer_assets", "progress": 92})
            if not os.path.isfile(PLACEHOLDER_SURFACE):
                raise RuntimeError("Reconstruction module unavailable and placeholder GLB missing")
            shutil.copy2(PLACEHOLDER_SURFACE, glb_path)
            print("[process] WARNING: using placeholder GLB (reconstruction module not available)")

        glb_size = os.path.getsize(glb_path)
        print(f"[process] GLB ready: {glb_size} bytes ({glb_size / (1024*1024):.1f} MB, "
              f"reconstructed={used_reconstruction})")

        # 6 — Upload viewer assets to runs-viewer
        supabase_update_run(run_id, {"stage": "uploading_viewer_assets", "progress": 96})

        glb_ok = storage_upload_file(
            vb, surface_key, glb_path,
            content_type="model/gltf-binary", step="viewer_surface",
        )
        if not glb_ok:
            raise RuntimeError(f"Failed to upload surface GLB to {vb}/{surface_key} ({glb_size} bytes)")

        vm_doc = {
            "surface_path": surface_key,
            "version": CODE_VERSION,
            "reconstructed": used_reconstruction,
        }
        storage_upload_bytes(
            vb, vm_key,
            json.dumps(vm_doc, indent=2).encode(),
            content_type="application/json", step="viewer_manifest",
        )

        # 7 — Mark run as done
        supabase_update_run(run_id, {
            "status": "done",
            "stage": "done",
            "progress": 100,
            "error_message": None,
        })
        supabase_update_run(run_id, {"viewer_surface_path": surface_key})

        print(f"[process] ======== SUCCESS runId={run_id} ========")

        return {
            "ok": True,
            "runId": run_id,
            "message": "Viewer assets generated and uploaded.",
            "bytes": bytes_written,
            "reconstructed": used_reconstruction,
            "glb_size": glb_size,
        }

    except Exception as exc:
        err_detail = getattr(exc, "detail", str(exc))
        tb = traceback.format_exc()
        full_msg = f"{err_detail}\n{tb}"[:8000]
        print(f"[process] FAILED runId={run_id}: {err_detail}")
        try:
            supabase_update_run(run_id, {
                "status": "failed",
                "stage": "failed",
                "progress": 0,
                "error_message": full_msg,
            })
        except Exception:
            pass
        raise

    finally:
        shutil.rmtree(workdir, ignore_errors=True)


# ── Background Poller ─────────────────────────────────────

def _poller_find_ready_run() -> Optional[str]:
    """Query Supabase for one run where stage=ready_for_processing."""
    resp = requests.get(
        f"{SUPABASE_URL}/rest/v1/runs",
        headers={**_auth_headers(), "Accept": "application/json"},
        params={
            "stage": "eq.ready_for_processing",
            "status": "in.(uploaded,queued)",
            "order": "created_at.asc",
            "limit": "1",
            "select": "id",
        },
        timeout=10,
    )
    if resp.status_code != 200:
        print(f"[poller] query error: {resp.status_code} {resp.text[:200]}")
        return None
    rows = resp.json()
    return rows[0]["id"] if rows else None


def _poller_claim_run(run_id: str) -> bool:
    """
    Atomically claim a run by PATCHing only if stage is still ready_for_processing.
    Returns True if this worker won the race.
    """
    resp = requests.patch(
        (
            f"{SUPABASE_URL}/rest/v1/runs"
            f"?id=eq.{run_id}"
            f"&stage=eq.ready_for_processing"
        ),
        headers={
            **_auth_headers(),
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        },
        data=json.dumps({
            "status": "processing",
            "stage": "claimed_by_worker",
            "progress": 5,
            "error_message": None,
        }),
        timeout=10,
    )
    if resp.status_code not in (200, 204):
        print(f"[poller] claim PATCH error: {resp.status_code} {resp.text[:200]}")
        return False
    rows = resp.json() if resp.text.strip() else []
    return len(rows) > 0


def _poll_once():
    """One poll cycle: find a ready run, claim it, process it."""
    run_id = _poller_find_ready_run()
    if not run_id:
        return

    print(f"[poller] found run={run_id}")

    if not _poller_claim_run(run_id):
        print(f"[poller] run={run_id} already claimed by another worker")
        return

    print(f"[poller] claimed run={run_id}")

    try:
        process_run(run_id)
        print(f"[poller] done run={run_id}")
    except Exception as exc:
        print(f"[poller] failed run={run_id} err={exc}")


async def _poller_loop():
    """Background async loop that polls Supabase every POLL_INTERVAL seconds."""
    print(f"[poller] started (interval={POLL_INTERVAL}s)")
    loop = asyncio.get_event_loop()
    while True:
        try:
            await loop.run_in_executor(None, _poll_once)
        except Exception as exc:
            print(f"[poller] unexpected error (will keep polling): {exc}")
        await asyncio.sleep(POLL_INTERVAL)


# ── Endpoints ─────────────────────────────────────────────

@app.on_event("startup")
async def on_startup():
    print(f"[worker] code_version={CODE_VERSION}")
    print(f"[worker] HAS_RECONSTRUCTION={HAS_RECONSTRUCTION}")
    print(f"[worker] SUPABASE_URL={SUPABASE_URL}")
    print(f"[worker] RUNS_RAW_BUCKET={RUNS_RAW_BUCKET}")
    print(f"[worker] RUNS_VIEWER_BUCKET={RUNS_VIEWER_BUCKET}")
    srk = SUPABASE_SERVICE_ROLE_KEY
    print(f"[worker] SERVICE_ROLE_KEY={'set (' + srk[:20] + '...)' if srk else 'MISSING'}")
    print(f"[worker] WORKER_SECRET={'set' if WORKER_SECRET else 'MISSING'}")
    if os.path.isfile(PLACEHOLDER_SURFACE):
        print(f"[worker] placeholder_surface={PLACEHOLDER_SURFACE} "
              f"({os.path.getsize(PLACEHOLDER_SURFACE)} bytes)")
    else:
        print(f"[worker] WARNING: placeholder_surface NOT FOUND at {PLACEHOLDER_SURFACE}")

    # LOCAL_TEST_RUN_ZIP: run reconstruction on a local zip then exit (no DB/storage)
    test_zip = os.environ.get("LOCAL_TEST_RUN_ZIP")
    if test_zip:
        _local_smoke_test(test_zip)

    # Start background poller
    asyncio.create_task(_poller_loop())


def _local_smoke_test(zip_path: str):
    """
    Reconstruct a GLB from a local zip, write it to /tmp, and exit.
    Useful for testing without the full upload pipeline.
    Mount the zip into the container and set LOCAL_TEST_RUN_ZIP=/path/to/run.zip.
    """
    print(f"\n[local_test] ======== LOCAL SMOKE TEST ========")
    print(f"[local_test] zip: {zip_path}")
    if not os.path.isfile(zip_path):
        print(f"[local_test] FAIL: file not found")
        sys.exit(1)

    workdir = tempfile.mkdtemp(prefix="fluxspace_local_test_")
    extract_dir = os.path.join(workdir, "unzipped")
    os.makedirs(extract_dir, exist_ok=True)
    output_glb = os.path.join(workdir, "surface.glb")

    try:
        print("[local_test] extracting zip...")
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(extract_dir)

        if not HAS_RECONSTRUCTION:
            print("[local_test] FAIL: reconstruction module not available (missing open3d/trimesh/cv2)")
            sys.exit(1)

        print("[local_test] running reconstruction pipeline...")
        result = build_surface_glb(extract_dir, output_glb)
        size = os.path.getsize(result)
        print(f"[local_test] SUCCESS: {result} ({size} bytes, {size / (1024*1024):.1f} MB)")
    except Exception as exc:
        print(f"[local_test] FAIL: {exc}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)
    sys.exit(0)


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
    """Direct HTTP trigger — kept for backwards compatibility and manual testing."""
    _require_env()

    if not authorization or authorization != f"Bearer {WORKER_SECRET}":
        raise HTTPException(status_code=401, detail="Unauthorized")

    run_id = payload.get("runId")
    if not run_id:
        raise HTTPException(status_code=400, detail="Missing runId")

    try:
        result = process_run(run_id)
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
