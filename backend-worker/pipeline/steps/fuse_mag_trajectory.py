"""
Step 3: Fuse magnetometer readings with camera trajectory.

Inputs:
  <run>/processed/trajectory.csv     – camera poses (frame, tx, ty, tz, r00..r22)
  <run>/raw/mag_run.csv              – magnetometer readings (timestamp, bx, by, bz, ...)
  <run>/processed/extrinsics.json    – sensor-to-camera transform

Output:
  <run>/processed/mag_world_m.csv    – magnetometer in world coords (meters)
    Columns: timestamp, wx, wy, wz, bx, by, bz, bmag

The fusion:
  1. Interpolate camera pose at each mag timestamp
  2. Apply extrinsics transform to get mag sensor position in world frame
  3. Write world-frame positions + mag readings
"""

import csv
import json
import logging
from pathlib import Path

import numpy as np
from scipy.spatial.transform import Rotation

logger = logging.getLogger("worker.fuse_mag")


def run_fuse_mag_trajectory(run_dir: Path) -> None:
    processed = run_dir / "processed"
    raw = run_dir / "raw"

    traj_path = processed / "trajectory.csv"
    mag_path = raw / "mag_run.csv"
    extrinsics_path = processed / "extrinsics.json"
    output_path = processed / "mag_world_m.csv"

    if not traj_path.is_file():
        raise FileNotFoundError(f"trajectory.csv not found at {traj_path}")
    if not mag_path.is_file():
        raise FileNotFoundError(f"mag_run.csv not found at {mag_path}")
    if not extrinsics_path.is_file():
        raise FileNotFoundError(f"extrinsics.json not found at {extrinsics_path}")

    # Load extrinsics
    with open(extrinsics_path) as f:
        ext = json.load(f)
    t_sensor = np.array(ext["translation_m"], dtype=np.float64)
    q_sensor = np.array(ext["quaternion_xyzw"], dtype=np.float64)
    R_sensor = Rotation.from_quat(q_sensor).as_matrix()

    # Load trajectory (frame index as time proxy)
    traj_frames, traj_positions, traj_rotations = _load_trajectory(traj_path)

    if len(traj_frames) < 2:
        raise ValueError("Trajectory has fewer than 2 poses, cannot interpolate")

    # Load magnetometer data
    mag_rows = _load_mag_csv(mag_path)
    logger.info(f"Loaded {len(mag_rows)} mag readings, {len(traj_frames)} trajectory poses")

    # Create normalized time arrays for interpolation
    # Map mag timestamps to trajectory frame indices
    traj_times = np.array(traj_frames, dtype=np.float64)
    mag_times = np.array([r["timestamp"] for r in mag_rows], dtype=np.float64)

    # Normalize mag times to trajectory range
    t_min, t_max = traj_times[0], traj_times[-1]
    mag_t_min, mag_t_max = mag_times[0], mag_times[-1]

    # Linear mapping: mag time → trajectory frame index
    if mag_t_max > mag_t_min:
        mag_normalized = t_min + (mag_times - mag_t_min) / (mag_t_max - mag_t_min) * (t_max - t_min)
    else:
        mag_normalized = np.full_like(mag_times, t_min)

    # Interpolate camera positions at mag timestamps
    interp_x = np.interp(mag_normalized, traj_times, traj_positions[:, 0])
    interp_y = np.interp(mag_normalized, traj_times, traj_positions[:, 1])
    interp_z = np.interp(mag_normalized, traj_times, traj_positions[:, 2])

    # For rotation, use nearest-neighbor (SLERP would be better but this is simpler)
    nearest_indices = np.searchsorted(traj_times, mag_normalized).clip(0, len(traj_times) - 1)

    # Write output
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["timestamp", "wx", "wy", "wz", "bx", "by", "bz", "bmag"])

        for i, row in enumerate(mag_rows):
            cam_pos = np.array([interp_x[i], interp_y[i], interp_z[i]])
            R_cam = traj_rotations[nearest_indices[i]]

            # Sensor world position = cam_pos + R_cam @ t_sensor
            sensor_world = cam_pos + R_cam @ t_sensor

            bx = row.get("bx", 0.0)
            by = row.get("by", 0.0)
            bz = row.get("bz", 0.0)
            bmag = np.sqrt(bx**2 + by**2 + bz**2)

            writer.writerow([
                f"{row['timestamp']:.6f}",
                f"{sensor_world[0]:.6f}",
                f"{sensor_world[1]:.6f}",
                f"{sensor_world[2]:.6f}",
                f"{bx:.4f}",
                f"{by:.4f}",
                f"{bz:.4f}",
                f"{bmag:.4f}",
            ])

    logger.info(f"Wrote {len(mag_rows)} fused readings to {output_path}")


def _load_trajectory(path: Path):
    """Load trajectory.csv → (frame_indices, positions [N,3], rotations [N,3,3])"""
    frames = []
    positions = []
    rotations = []

    with open(path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                frame_val = float(row["frame"]) if row["frame"].replace(".", "").replace("-", "").isdigit() else len(frames)
            except (ValueError, KeyError):
                frame_val = float(len(frames))

            frames.append(frame_val)
            positions.append([float(row["tx"]), float(row["ty"]), float(row["tz"])])
            rotations.append([
                [float(row["r00"]), float(row["r01"]), float(row["r02"])],
                [float(row["r10"]), float(row["r11"]), float(row["r12"])],
                [float(row["r20"]), float(row["r21"]), float(row["r22"])],
            ])

    return frames, np.array(positions), np.array(rotations)


def _load_mag_csv(path: Path) -> list[dict]:
    """
    Load mag_run.csv. Expects at minimum columns for timestamp and
    magnetic field components (bx/by/bz or mag_x/mag_y/mag_z).
    """
    rows = []
    with open(path) as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []

        # Find column names
        ts_col = _find_col(headers, ["timestamp", "time", "ts", "epoch"])
        bx_col = _find_col(headers, ["bx", "mag_x", "magnetic_x", "field_x"])
        by_col = _find_col(headers, ["by", "mag_y", "magnetic_y", "field_y"])
        bz_col = _find_col(headers, ["bz", "mag_z", "magnetic_z", "field_z"])

        if not ts_col:
            raise ValueError(f"Could not find timestamp column in mag_run.csv. Headers: {headers}")
        if not bx_col:
            raise ValueError(f"Could not find bx/mag_x column in mag_run.csv. Headers: {headers}")

        for row in reader:
            try:
                rows.append({
                    "timestamp": float(row[ts_col]),
                    "bx": float(row[bx_col]) if bx_col else 0.0,
                    "by": float(row[by_col]) if by_col else 0.0,
                    "bz": float(row[bz_col]) if bz_col else 0.0,
                })
            except (ValueError, KeyError):
                continue

    return rows


def _find_col(headers: list[str], candidates: list[str]) -> str | None:
    """Find a column name from headers matching any candidate (case-insensitive)."""
    header_lower = {h.lower().strip(): h for h in headers}
    for c in candidates:
        if c.lower() in header_lower:
            return header_lower[c.lower()]
    return None
