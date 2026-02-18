"""
Step 4: Convert world-frame magnetometer readings to a 3D voxel volume.

Input:  <run>/processed/mag_world_m.csv
Output: <run>/exports/volume.npz
  Contains:
    - volume: 3D float32 array (magnetic field magnitude per voxel)
    - origin: [ox, oy, oz] world-coordinate origin of the volume
    - voxel_size: float (meters)

IMPORTANT: Memory protection
  - Default voxel_size = 0.02 m (2 cm)
  - Max grid dimension clamped to 256 per axis
  - This limits memory to ~64 MB for the volume array
"""

import csv
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger("worker.mag_to_voxel")

DEFAULT_VOXEL_SIZE = 0.02  # meters
MAX_DIM = 256  # max voxels per axis


def run_mag_to_voxel(
    run_dir: Path,
    voxel_size: float = DEFAULT_VOXEL_SIZE,
    max_dim: int = MAX_DIM,
) -> None:
    processed = run_dir / "processed"
    exports = run_dir / "exports"
    exports.mkdir(exist_ok=True)

    input_path = processed / "mag_world_m.csv"
    output_path = exports / "volume.npz"

    if not input_path.is_file():
        raise FileNotFoundError(f"mag_world_m.csv not found at {input_path}")

    # Load data
    points = []
    values = []

    with open(input_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                x = float(row["wx"])
                y = float(row["wy"])
                z = float(row["wz"])
                v = float(row["bmag"])
                points.append([x, y, z])
                values.append(v)
            except (ValueError, KeyError):
                continue

    if not points:
        raise ValueError("No valid data points in mag_world_m.csv")

    points = np.array(points, dtype=np.float64)
    values = np.array(values, dtype=np.float64)
    logger.info(f"Loaded {len(points)} points for voxelization")

    # Compute bounding box
    p_min = points.min(axis=0)
    p_max = points.max(axis=0)
    extent = p_max - p_min

    # Determine grid dimensions
    grid_dims = np.ceil(extent / voxel_size).astype(int) + 1
    grid_dims = np.clip(grid_dims, 1, max_dim)

    # Adjust voxel size if grid was clamped
    actual_voxel = np.where(
        grid_dims >= max_dim,
        extent / (max_dim - 1),
        voxel_size,
    )

    logger.info(
        f"Grid dimensions: {grid_dims}, "
        f"voxel_size: {actual_voxel}, "
        f"extent: {extent}"
    )

    # Allocate volume
    volume = np.zeros(tuple(grid_dims), dtype=np.float32)
    counts = np.zeros(tuple(grid_dims), dtype=np.int32)

    # Map points to voxel indices
    indices = ((points - p_min) / actual_voxel).astype(int)
    indices = np.clip(indices, 0, grid_dims - 1)

    # Accumulate values
    for idx, val in zip(indices, values):
        i, j, k = idx
        volume[i, j, k] += val
        counts[i, j, k] += 1

    # Average where we have data
    mask = counts > 0
    volume[mask] /= counts[mask]

    # Save
    np.savez_compressed(
        output_path,
        volume=volume,
        origin=p_min,
        voxel_size=actual_voxel,
        grid_dims=grid_dims,
        counts=counts,
    )

    total_voxels = int(mask.sum())
    logger.info(
        f"Volume saved to {output_path}: "
        f"shape={volume.shape}, filled_voxels={total_voxels}"
    )
