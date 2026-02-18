"""
Step 1: Open3D RGBD Reconstruction

Input:  <run>/raw/oak_rgbd/  (color/, depth/, intrinsics.json, timestamps.csv)
Output: <run>/processed/open3d_mesh.ply
        <run>/processed/trajectory.csv

Uses Open3D's RGBD integration pipeline to create a mesh and extract
camera trajectory. Trajectory is written to processed/ (NOT raw/).
"""

import json
import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger("worker.open3d_reconstruct")


def run_open3d_reconstruct(run_dir: Path) -> None:
    import open3d as o3d

    oak_dir = run_dir / "raw" / "oak_rgbd"
    processed_dir = run_dir / "processed"
    processed_dir.mkdir(exist_ok=True)

    color_dir = oak_dir / "color"
    depth_dir = oak_dir / "depth"
    intrinsics_path = oak_dir / "intrinsics.json"

    # Load intrinsics
    with open(intrinsics_path) as f:
        intr_data = json.load(f)

    width = int(intr_data.get("width", 640))
    height = int(intr_data.get("height", 480))
    fx = float(intr_data.get("fx", intr_data.get("focal_length_x", 500)))
    fy = float(intr_data.get("fy", intr_data.get("focal_length_y", 500)))
    cx = float(intr_data.get("cx", intr_data.get("principal_point_x", width / 2)))
    cy = float(intr_data.get("cy", intr_data.get("principal_point_y", height / 2)))

    intrinsic = o3d.camera.PinholeCameraIntrinsic(width, height, fx, fy, cx, cy)

    # Collect frame pairs sorted by name
    color_files = sorted(color_dir.glob("*.png"))
    depth_files = sorted(depth_dir.glob("*.png"))

    if not color_files:
        raise FileNotFoundError(f"No color frames found in {color_dir}")
    if not depth_files:
        raise FileNotFoundError(f"No depth frames found in {depth_dir}")

    # Match by filename stem
    color_map = {f.stem: f for f in color_files}
    depth_map = {f.stem: f for f in depth_files}
    common_stems = sorted(set(color_map.keys()) & set(depth_map.keys()))

    if not common_stems:
        raise ValueError("No matching color/depth frame pairs found")

    logger.info(f"Found {len(common_stems)} matched frame pairs")

    # Build RGBD images
    volume = o3d.pipelines.integration.ScalableTSDFVolume(
        voxel_length=0.005,
        sdf_trunc=0.04,
        color_type=o3d.pipelines.integration.TSDFVolumeColorType.RGB8,
    )

    trajectory_poses = []
    prev_rgbd = None
    current_pose = np.eye(4)

    # Odometry setup
    option = o3d.pipelines.odometry.OdometryOption()
    odo_init = np.eye(4)

    for i, stem in enumerate(common_stems):
        color_img = o3d.io.read_image(str(color_map[stem]))
        depth_img = o3d.io.read_image(str(depth_map[stem]))

        rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
            color_img,
            depth_img,
            depth_trunc=3.0,
            convert_rgb_to_intensity=False,
        )

        if prev_rgbd is not None:
            success, trans, info = o3d.pipelines.odometry.compute_rgbd_odometry(
                rgbd,
                prev_rgbd,
                intrinsic,
                odo_init,
                o3d.pipelines.odometry.RGBDOdometryJacobianFromHybridTerm(),
                option,
            )
            if success:
                current_pose = current_pose @ np.linalg.inv(trans)

        volume.integrate(rgbd, intrinsic, np.linalg.inv(current_pose))
        trajectory_poses.append(current_pose.copy())
        prev_rgbd = rgbd

        if (i + 1) % 50 == 0:
            logger.info(f"  Processed {i + 1}/{len(common_stems)} frames")

    # Extract mesh
    logger.info("Extracting mesh from TSDF volume...")
    mesh = volume.extract_triangle_mesh()
    mesh.compute_vertex_normals()

    mesh_path = processed_dir / "open3d_mesh.ply"
    o3d.io.write_triangle_mesh(str(mesh_path), mesh)
    logger.info(f"Mesh saved to {mesh_path} ({len(mesh.vertices)} vertices)")

    # Write trajectory to processed/trajectory.csv
    traj_path = processed_dir / "trajectory.csv"
    _write_trajectory_csv(traj_path, trajectory_poses, common_stems)
    logger.info(f"Trajectory saved to {traj_path} ({len(trajectory_poses)} poses)")


def _write_trajectory_csv(path: Path, poses: list, stems: list):
    """Write camera trajectory as CSV with columns:
    frame, tx, ty, tz, r00..r22 (flattened 3x3 rotation)
    """
    import csv

    with open(path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "frame", "tx", "ty", "tz",
            "r00", "r01", "r02",
            "r10", "r11", "r12",
            "r20", "r21", "r22",
        ])
        for stem, pose in zip(stems, poses):
            t = pose[:3, 3]
            r = pose[:3, :3]
            writer.writerow([
                stem,
                f"{t[0]:.6f}", f"{t[1]:.6f}", f"{t[2]:.6f}",
                f"{r[0,0]:.6f}", f"{r[0,1]:.6f}", f"{r[0,2]:.6f}",
                f"{r[1,0]:.6f}", f"{r[1,1]:.6f}", f"{r[1,2]:.6f}",
                f"{r[2,0]:.6f}", f"{r[2,1]:.6f}", f"{r[2,2]:.6f}",
            ])
