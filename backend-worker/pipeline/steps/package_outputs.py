"""
Step 6: Package pipeline outputs into a single downloadable zip.

Includes:
  - processed/open3d_mesh.ply
  - processed/trajectory.csv
  - processed/mag_world_m.csv
  - processed/extrinsics.json
  - exports/volume.npz
  - exports/heatmap.png

Output: <run>/exports/outputs.zip
"""

import logging
import zipfile
from pathlib import Path

logger = logging.getLogger("worker.package_outputs")


def run_package_outputs(run_dir: Path) -> None:
    exports = run_dir / "exports"
    processed = run_dir / "processed"
    exports.mkdir(exist_ok=True)

    output_path = exports / "outputs.zip"

    files_to_include = [
        (processed / "open3d_mesh.ply", "processed/open3d_mesh.ply"),
        (processed / "trajectory.csv", "processed/trajectory.csv"),
        (processed / "mag_world_m.csv", "processed/mag_world_m.csv"),
        (processed / "extrinsics.json", "processed/extrinsics.json"),
        (exports / "volume.npz", "exports/volume.npz"),
        (exports / "heatmap.png", "exports/heatmap.png"),
    ]

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for filepath, arcname in files_to_include:
            if filepath.is_file():
                zf.write(filepath, arcname)
                logger.info(f"  Added {arcname} ({filepath.stat().st_size} bytes)")
            else:
                logger.warning(f"  Skipped {arcname} (not found)")

    logger.info(f"Outputs packaged to {output_path} ({output_path.stat().st_size} bytes)")
