"""
Pipeline runner – orchestrates the full scan processing pipeline.

Steps:
  1. Download zip from Supabase Storage
  2. Unpack and validate folder structure
  3. Run open3d_reconstruct
  4. Auto-create extrinsics.json if missing
  5. Run fuse_mag_with_trajectory
  6. Run mag_world_to_voxel_volume
  7. Run visualize_3d_heatmap (headless / screenshot)
  8. Package outputs
  9. Upload outputs to Supabase Storage
  10. Update DB rows (scan status + scan_artifacts)
"""

import json
import logging
import os
import shutil
import tempfile
import zipfile
from pathlib import Path

from pipeline.supabase_client import get_supabase
from pipeline.steps.open3d_reconstruct import run_open3d_reconstruct
from pipeline.steps.create_extrinsics import ensure_extrinsics
from pipeline.steps.fuse_mag_trajectory import run_fuse_mag_trajectory
from pipeline.steps.mag_to_voxel import run_mag_to_voxel
from pipeline.steps.visualize_heatmap import run_visualize_heatmap
from pipeline.steps.package_outputs import run_package_outputs

logger = logging.getLogger("worker.runner")


def run_pipeline(scan_id: str, user_id: str) -> None:
    """
    Main entry point called from the FastAPI background task.
    Downloads, processes, uploads results, updates DB.
    """
    sb = get_supabase()
    work_dir = None

    try:
        _update_status(sb, scan_id, "processing")

        # 1. Create temp working directory
        work_dir = Path(tempfile.mkdtemp(prefix=f"fluxspace-{scan_id[:8]}-"))
        logger.info(f"Working directory: {work_dir}")

        # 2. Download zip from storage
        upload_path = f"{user_id}/{scan_id}/upload.zip"
        zip_path = work_dir / "upload.zip"
        logger.info(f"Downloading {upload_path} from runs-uploads...")
        data = sb.storage.from_("runs-uploads").download(upload_path)
        zip_path.write_bytes(data)
        logger.info(f"Downloaded {len(data)} bytes")

        # 3. Unpack zip
        run_dir = _unpack_zip(zip_path, work_dir)
        logger.info(f"Run directory resolved to: {run_dir}")

        # 4. Validate folder structure
        _validate_structure(run_dir)

        # Ensure processed/ and exports/ exist
        (run_dir / "processed").mkdir(exist_ok=True)
        (run_dir / "exports").mkdir(exist_ok=True)

        # 5. Pipeline steps
        logger.info("Step 1/6: Open3D reconstruct")
        run_open3d_reconstruct(run_dir)

        logger.info("Step 2/6: Create extrinsics if missing")
        ensure_extrinsics(run_dir)

        logger.info("Step 3/6: Fuse magnetometer with trajectory")
        run_fuse_mag_trajectory(run_dir)

        logger.info("Step 4/6: Mag world to voxel volume")
        run_mag_to_voxel(run_dir)

        logger.info("Step 5/6: Visualize 3D heatmap (screenshot)")
        run_visualize_heatmap(run_dir)

        logger.info("Step 6/6: Package outputs")
        run_package_outputs(run_dir)

        # 6. Upload outputs
        logger.info("Uploading outputs to Supabase Storage...")
        artifacts = _upload_outputs(sb, scan_id, user_id, run_dir)

        # 7. Insert artifact rows
        for art in artifacts:
            sb.table("scan_artifacts").insert({
                "scan_id": scan_id,
                "kind": art["kind"],
                "storage_path": art["storage_path"],
                "size_bytes": art.get("size_bytes"),
            }).execute()

        # 8. Mark done
        _update_status(sb, scan_id, "done")
        logger.info(f"Pipeline complete for scan_id={scan_id}")

    except Exception as e:
        logger.exception(f"Pipeline failed for scan_id={scan_id}")
        _update_status(sb, scan_id, "failed", error=str(e))

    finally:
        # Cleanup temp dir
        if work_dir and work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)


def _update_status(sb, scan_id: str, status: str, error: str | None = None):
    update = {"status": status}
    if error:
        update["error"] = error[:4000]  # truncate
    elif status != "failed":
        update["error"] = None
    sb.table("scans").update(update).eq("id", scan_id).execute()


def _unpack_zip(zip_path: Path, work_dir: Path) -> Path:
    """
    Unpack the zip and find the run directory.
    Handles both cases:
      - zip contains a top-level folder (run_YYYYMMDD_HHMM/raw/...)
      - zip contains raw/ directly at the top level
    """
    extract_dir = work_dir / "extracted"
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)

    # Remove __MACOSX if present
    macosx = extract_dir / "__MACOSX"
    if macosx.exists():
        shutil.rmtree(macosx)

    # Check if there's a single top-level directory
    top_items = [p for p in extract_dir.iterdir() if not p.name.startswith(".")]
    if len(top_items) == 1 and top_items[0].is_dir():
        candidate = top_items[0]
        # If that directory has raw/ inside, use it as the run directory
        if (candidate / "raw").is_dir():
            return candidate
        # Otherwise check one more level (zip of zip scenario)
        sub_items = [p for p in candidate.iterdir() if not p.name.startswith(".")]
        if len(sub_items) == 1 and sub_items[0].is_dir() and (sub_items[0] / "raw").is_dir():
            return sub_items[0]
        return candidate
    elif (extract_dir / "raw").is_dir():
        return extract_dir
    else:
        raise ValueError(
            f"Could not find run directory with raw/ folder. "
            f"Top-level contents: {[p.name for p in top_items]}"
        )


def _validate_structure(run_dir: Path):
    """Validate the expected folder structure."""
    raw = run_dir / "raw"
    if not raw.is_dir():
        raise ValueError(f"Missing raw/ directory in {run_dir}")

    oak_rgbd = raw / "oak_rgbd"
    if not oak_rgbd.is_dir():
        raise ValueError(f"Missing raw/oak_rgbd/ directory")

    required_in_oak = ["color", "depth", "intrinsics.json"]
    for item in required_in_oak:
        p = oak_rgbd / item
        if not p.exists():
            raise ValueError(f"Missing raw/oak_rgbd/{item}")

    mag_run = raw / "mag_run.csv"
    if not mag_run.is_file():
        raise ValueError(f"Missing raw/mag_run.csv")

    # calibration.json is recommended but not strictly required
    calib = raw / "calibration.json"
    if not calib.is_file():
        logger.warning("raw/calibration.json not found – some steps may use defaults")


def _upload_outputs(sb, scan_id: str, user_id: str, run_dir: Path) -> list[dict]:
    """Upload processed and export files to Supabase Storage."""
    artifacts = []
    base_path = f"{user_id}/{scan_id}"

    file_map = {
        "mesh_ply": run_dir / "processed" / "open3d_mesh.ply",
        "trajectory_csv": run_dir / "processed" / "trajectory.csv",
        "mag_world_csv": run_dir / "processed" / "mag_world_m.csv",
        "extrinsics_json": run_dir / "processed" / "extrinsics.json",
        "volume_npz": run_dir / "exports" / "volume.npz",
        "screenshot_png": run_dir / "exports" / "heatmap.png",
        "outputs_zip": run_dir / "exports" / "outputs.zip",
    }

    for kind, filepath in file_map.items():
        if filepath.is_file():
            storage_path = f"{base_path}/{filepath.name}"
            file_bytes = filepath.read_bytes()

            content_type = _guess_content_type(filepath.name)
            sb.storage.from_("runs-outputs").upload(
                storage_path,
                file_bytes,
                file_options={"content-type": content_type, "upsert": "true"},
            )

            artifacts.append({
                "kind": kind,
                "storage_path": storage_path,
                "size_bytes": len(file_bytes),
            })
            logger.info(f"  Uploaded {kind}: {storage_path} ({len(file_bytes)} bytes)")
        else:
            logger.warning(f"  Artifact not found: {filepath}")

    return artifacts


def _guess_content_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower()
    return {
        "ply": "application/octet-stream",
        "csv": "text/csv",
        "json": "application/json",
        "npz": "application/octet-stream",
        "png": "image/png",
        "zip": "application/zip",
    }.get(ext, "application/octet-stream")
