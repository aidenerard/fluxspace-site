"""
Auto-create extrinsics.json if it does not exist.

The extrinsics describe the rigid transform from the magnetometer sensor
frame to the camera frame.

Default values (for our hardware):
  - Magnetometer is 2 cm behind the camera center (negative Z in camera frame)
  - Magnetometer is 10 cm below the camera center (negative Y in camera frame)

Coordinate convention (camera frame, OpenCV / Open3D):
  X = right
  Y = down
  Z = forward (into the scene)

So:
  translation_m = [0.0, 0.10, -0.02]
    → X: 0 (no lateral offset)
    → Y: +0.10 (10 cm down in camera frame, since Y points down)
    → Z: -0.02 (2 cm behind, i.e. negative Z since Z points forward)

Quaternion (identity – assuming aligned orientation):
  quaternion_xyzw = [0.0, 0.0, 0.0, 1.0]

Output: <run>/processed/extrinsics.json
"""

import json
import logging
from pathlib import Path

logger = logging.getLogger("worker.create_extrinsics")

DEFAULT_EXTRINSICS = {
    "description": "Magnetometer-to-camera extrinsics. Camera frame: X=right, Y=down, Z=forward (OpenCV convention).",
    "translation_m": [0.0, 0.10, -0.02],
    "quaternion_xyzw": [0.0, 0.0, 0.0, 1.0],
}


def ensure_extrinsics(run_dir: Path) -> Path:
    """Create extrinsics.json in processed/ if it doesn't exist. Returns the path."""
    processed_dir = run_dir / "processed"
    processed_dir.mkdir(exist_ok=True)
    extrinsics_path = processed_dir / "extrinsics.json"

    if extrinsics_path.is_file():
        logger.info(f"Extrinsics already exists at {extrinsics_path}")
        # Validate it has required keys
        with open(extrinsics_path) as f:
            data = json.load(f)
        if "translation_m" not in data or "quaternion_xyzw" not in data:
            raise ValueError(
                f"extrinsics.json missing required keys. "
                f"Need 'translation_m' and 'quaternion_xyzw'. Got: {list(data.keys())}"
            )
        return extrinsics_path

    logger.info(f"Creating default extrinsics.json at {extrinsics_path}")
    with open(extrinsics_path, "w") as f:
        json.dump(DEFAULT_EXTRINSICS, f, indent=2)

    return extrinsics_path
