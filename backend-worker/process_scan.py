#!/usr/bin/env python3
"""
CLI tool to run the FluxSpace pipeline locally.

Usage:
    python process_scan.py --run-dir /path/to/run_20250217_1430

    # With Supabase upload:
    python process_scan.py --run-dir /path/to/run_20250217_1430 --scan-id <uuid>

    # Skip upload (local-only):
    python process_scan.py --run-dir /path/to/run_20250217_1430 --no-upload
"""

import argparse
import logging
import sys
from pathlib import Path

# Add parent dir to path so we can import pipeline modules
sys.path.insert(0, str(Path(__file__).parent))

from pipeline.steps.open3d_reconstruct import run_open3d_reconstruct
from pipeline.steps.create_extrinsics import ensure_extrinsics
from pipeline.steps.fuse_mag_trajectory import run_fuse_mag_trajectory
from pipeline.steps.mag_to_voxel import run_mag_to_voxel
from pipeline.steps.visualize_heatmap import run_visualize_heatmap
from pipeline.steps.package_outputs import run_package_outputs

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("process_scan")


def main():
    parser = argparse.ArgumentParser(
        description="Run the FluxSpace scan pipeline locally."
    )
    parser.add_argument(
        "--run-dir",
        required=True,
        type=Path,
        help="Path to the run folder (e.g., run_20250217_1430/)",
    )
    parser.add_argument(
        "--scan-id",
        type=str,
        default=None,
        help="Scan UUID for Supabase upload (optional)",
    )
    parser.add_argument(
        "--no-upload",
        action="store_true",
        help="Skip uploading results to Supabase",
    )
    parser.add_argument(
        "--voxel-size",
        type=float,
        default=0.02,
        help="Voxel size in meters (default: 0.02)",
    )
    parser.add_argument(
        "--max-dim",
        type=int,
        default=256,
        help="Maximum grid dimension per axis (default: 256)",
    )
    parser.add_argument(
        "--skip-reconstruct",
        action="store_true",
        help="Skip Open3D reconstruction (use existing mesh/trajectory)",
    )

    args = parser.parse_args()
    run_dir = args.run_dir.resolve()

    if not run_dir.is_dir():
        logger.error(f"Run directory does not exist: {run_dir}")
        sys.exit(1)

    # Validate structure
    raw_dir = run_dir / "raw"
    if not raw_dir.is_dir():
        logger.error(f"Missing raw/ directory in {run_dir}")
        sys.exit(1)

    # Ensure output directories
    (run_dir / "processed").mkdir(exist_ok=True)
    (run_dir / "exports").mkdir(exist_ok=True)

    try:
        # Step 1: Open3D Reconstruction
        if not args.skip_reconstruct:
            logger.info("=" * 60)
            logger.info("Step 1/6: Open3D RGBD Reconstruction")
            logger.info("=" * 60)
            run_open3d_reconstruct(run_dir)
        else:
            logger.info("Skipping Open3D reconstruction (--skip-reconstruct)")

        # Step 2: Create extrinsics
        logger.info("=" * 60)
        logger.info("Step 2/6: Ensure extrinsics.json")
        logger.info("=" * 60)
        ensure_extrinsics(run_dir)

        # Step 3: Fuse mag with trajectory
        logger.info("=" * 60)
        logger.info("Step 3/6: Fuse magnetometer with trajectory")
        logger.info("=" * 60)
        run_fuse_mag_trajectory(run_dir)

        # Step 4: Voxel volume
        logger.info("=" * 60)
        logger.info("Step 4/6: Mag world to voxel volume")
        logger.info("=" * 60)
        run_mag_to_voxel(run_dir, voxel_size=args.voxel_size, max_dim=args.max_dim)

        # Step 5: Visualize heatmap
        logger.info("=" * 60)
        logger.info("Step 5/6: Visualize 3D heatmap (screenshot)")
        logger.info("=" * 60)
        run_visualize_heatmap(run_dir)

        # Step 6: Package outputs
        logger.info("=" * 60)
        logger.info("Step 6/6: Package outputs")
        logger.info("=" * 60)
        run_package_outputs(run_dir)

        logger.info("=" * 60)
        logger.info("Pipeline complete!")
        logger.info("=" * 60)
        logger.info(f"Outputs in: {run_dir / 'processed'}")
        logger.info(f"Exports in: {run_dir / 'exports'}")

        # Optional: upload to Supabase
        if args.scan_id and not args.no_upload:
            logger.info("Uploading results to Supabase...")
            _upload_to_supabase(args.scan_id, run_dir)
            logger.info("Upload complete.")

    except Exception as e:
        logger.exception(f"Pipeline failed: {e}")
        sys.exit(1)


def _upload_to_supabase(scan_id: str, run_dir: Path):
    """Upload outputs to Supabase storage and update DB."""
    import os
    os.environ.setdefault("SUPABASE_URL", "")
    os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "")

    if not os.environ["SUPABASE_URL"] or not os.environ["SUPABASE_SERVICE_ROLE_KEY"]:
        logger.warning(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set, skipping upload. "
            "Set these environment variables or use --no-upload."
        )
        return

    from pipeline.supabase_client import get_supabase
    from pipeline.runner import _upload_outputs, _update_status

    sb = get_supabase()

    # Get user_id from scan
    result = sb.table("scans").select("user_id").eq("id", scan_id).single().execute()
    user_id = result.data["user_id"]

    artifacts = _upload_outputs(sb, scan_id, user_id, run_dir)
    for art in artifacts:
        sb.table("scan_artifacts").insert({
            "scan_id": scan_id,
            "kind": art["kind"],
            "storage_path": art["storage_path"],
            "size_bytes": art.get("size_bytes"),
        }).execute()

    _update_status(sb, scan_id, "done")


if __name__ == "__main__":
    main()
