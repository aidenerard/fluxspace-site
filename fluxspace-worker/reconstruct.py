"""
RGBD → TSDF → mesh → GLB reconstruction pipeline.

Uses Open3D for TSDF integration + mesh extraction,
trimesh for Three.js-compatible GLB export.

All tunables are configurable via environment variables.
"""

import os
import json
import traceback
import numpy as np
from typing import Optional, Callable, Tuple, List

# ── Tunables (env-configurable) ──────────────────────────────────────────────

EVERY_N = int(os.environ.get("RECON_EVERY_N", "5"))
MAX_FRAMES = int(os.environ.get("RECON_MAX_FRAMES", "200"))
DEPTH_SCALE = float(os.environ.get("RECON_DEPTH_SCALE", "1000.0"))
DEPTH_TRUNC = float(os.environ.get("RECON_DEPTH_TRUNC", "3.0"))
VOXEL_LENGTH = float(os.environ.get("RECON_VOXEL_LENGTH", "0.006"))
SDF_TRUNC = float(os.environ.get("RECON_SDF_TRUNC", "0.04"))
TARGET_TRIANGLES = int(os.environ.get("RECON_TARGET_TRIANGLES", "200000"))
MAX_GLB_BYTES = int(os.environ.get("RECON_MAX_GLB_BYTES", str(45 * 1024 * 1024)))

# OAK-D 640×480 fallback intrinsics
_DEFAULT_INTRINSICS = {
    "fx": 400.0, "fy": 400.0,
    "cx": 320.0, "cy": 240.0,
    "width": 640, "height": 480,
}

_IMG_EXTS = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def find_rgbd_dirs(extract_dir: str) -> Tuple[str, str, Optional[str]]:
    """
    Locate color/, depth/, intrinsics.json within extracted zip.
    Handles zips with or without a top-level directory wrapper.
    Returns (color_dir, depth_dir, intrinsics_path | None).
    """
    bases = [extract_dir]
    try:
        for name in sorted(os.listdir(extract_dir)):
            p = os.path.join(extract_dir, name)
            if os.path.isdir(p):
                bases.append(p)
    except OSError:
        pass

    for base in bases:
        color = os.path.join(base, "raw", "oak_rgbd", "color")
        depth = os.path.join(base, "raw", "oak_rgbd", "depth")
        intr = os.path.join(base, "raw", "oak_rgbd", "intrinsics.json")
        if os.path.isdir(color) and os.path.isdir(depth):
            return color, depth, intr if os.path.isfile(intr) else None

    previews = []
    for b in bases[:3]:
        try:
            previews.append(f"  {b}: {os.listdir(b)[:15]}")
        except OSError:
            pass
    raise FileNotFoundError(
        "Cannot find raw/oak_rgbd/{color,depth} in extracted zip.\n"
        + "\n".join(previews)
    )


def parse_intrinsics(path: Optional[str]) -> dict:
    """Parse intrinsics.json with multiple schema fallbacks."""
    if not path or not os.path.isfile(path):
        print("[recon] no intrinsics.json — using OAK-D 640×480 defaults")
        return dict(_DEFAULT_INTRINSICS)

    try:
        with open(path) as f:
            data = json.load(f)
    except Exception as exc:
        print(f"[recon] bad intrinsics.json ({exc}), using defaults")
        return dict(_DEFAULT_INTRINSICS)

    fx = data.get("fx") or data.get("focal_length_x") or data.get("focalLengthX")
    fy = data.get("fy") or data.get("focal_length_y") or data.get("focalLengthY")
    cx = data.get("cx") or data.get("principal_point_x") or data.get("principalPointX")
    cy = data.get("cy") or data.get("principal_point_y") or data.get("principalPointY")
    w = data.get("width") or data.get("image_width") or data.get("imageWidth")
    h = data.get("height") or data.get("image_height") or data.get("imageHeight")

    if all(v is not None for v in [fx, fy, cx, cy, w, h]):
        r = {"fx": float(fx), "fy": float(fy), "cx": float(cx), "cy": float(cy),
             "width": int(w), "height": int(h)}
        print(f"[recon] intrinsics: {r}")
        return r

    print(f"[recon] intrinsics.json incomplete (keys={list(data.keys())}), using defaults")
    return dict(_DEFAULT_INTRINSICS)


def _sorted_images(d: str) -> List[str]:
    return sorted(
        f for f in os.listdir(d)
        if os.path.splitext(f)[1].lower() in _IMG_EXTS
    )


def pair_frames(color_dir: str, depth_dir: str) -> List[Tuple[str, str]]:
    """Pair color + depth images by sorted filename index."""
    color_files = _sorted_images(color_dir)
    depth_files = _sorted_images(depth_dir)
    n = min(len(color_files), len(depth_files))
    if n == 0:
        raise ValueError(
            f"No frame pairs found (color={len(color_files)}, depth={len(depth_files)})"
        )
    return [
        (os.path.join(color_dir, color_files[i]),
         os.path.join(depth_dir, depth_files[i]))
        for i in range(n)
    ]


# ── GLB Export ───────────────────────────────────────────────────────────────

def _export_glb(o3d_mesh, output_path: str):
    """Export Open3D TriangleMesh → GLB via trimesh (Three.js-compatible)."""
    import trimesh

    verts = np.asarray(o3d_mesh.vertices)
    faces = np.asarray(o3d_mesh.triangles)
    normals = np.asarray(o3d_mesh.vertex_normals) if o3d_mesh.has_vertex_normals() else None

    vertex_colors = None
    if o3d_mesh.has_vertex_colors():
        rgb = (np.asarray(o3d_mesh.vertex_colors) * 255).clip(0, 255).astype(np.uint8)
        alpha = np.full((len(rgb), 1), 255, dtype=np.uint8)
        vertex_colors = np.hstack([rgb, alpha])

    tm = trimesh.Trimesh(
        vertices=verts,
        faces=faces,
        vertex_normals=normals,
        vertex_colors=vertex_colors,
        process=False,
    )
    tm.export(output_path, file_type="glb")


# ── Main pipeline ────────────────────────────────────────────────────────────

def build_surface_glb(
    extract_dir: str,
    output_glb_path: str,
    progress_fn: Optional[Callable[[str, int], None]] = None,
) -> str:
    """
    Full RGBD → TSDF → mesh → GLB pipeline (headless).

    Returns path to the output GLB on success.
    Raises with a descriptive message on failure.
    """
    import open3d as o3d
    import cv2

    def _progress(msg: str, pct: int = 0):
        print(f"[recon] {msg}")
        if progress_fn:
            progress_fn(msg, pct)

    # ── 1. Locate data ──────────────────────────────────────────
    _progress("locating RGBD directories", 0)
    color_dir, depth_dir, intrinsics_path = find_rgbd_dirs(extract_dir)
    print(f"[recon]   color_dir  = {color_dir}")
    print(f"[recon]   depth_dir  = {depth_dir}")
    print(f"[recon]   intrinsics = {intrinsics_path}")

    # ── 2. Parse intrinsics ─────────────────────────────────────
    intr = parse_intrinsics(intrinsics_path)
    o3d_intr = o3d.camera.PinholeCameraIntrinsic(
        intr["width"], intr["height"],
        intr["fx"], intr["fy"], intr["cx"], intr["cy"],
    )

    # ── 3. Pair + subsample frames ──────────────────────────────
    all_pairs = pair_frames(color_dir, depth_dir)
    pairs = all_pairs[::EVERY_N][:MAX_FRAMES]
    print(
        f"[recon] total frames={len(all_pairs)}, using={len(pairs)} "
        f"(every_n={EVERY_N}, max_frames={MAX_FRAMES})"
    )
    if len(pairs) < 2:
        raise ValueError(f"Need >= 2 frame pairs, got {len(pairs)}")

    # ── 4. TSDF integration with RGBD odometry ─────────────────
    _progress(f"integrating {len(pairs)} frames into TSDF volume", 5)

    volume = o3d.pipelines.integration.ScalableTSDFVolume(
        voxel_length=VOXEL_LENGTH,
        sdf_trunc=SDF_TRUNC,
        color_type=o3d.pipelines.integration.TSDFVolumeColorType.RGB8,
    )

    poses: List[np.ndarray] = [np.eye(4)]
    prev_rgbd = None
    integrated = 0
    odo_ok = 0
    odo_fail = 0
    tw, th = intr["width"], intr["height"]

    odo_option = o3d.pipelines.odometry.OdometryOption(
        max_depth_diff=0.07,
        min_depth=0.1,
        max_depth=DEPTH_TRUNC,
    )

    for idx, (color_path, depth_path) in enumerate(pairs):
        color_bgr = cv2.imread(color_path, cv2.IMREAD_COLOR)
        depth_raw = cv2.imread(depth_path, cv2.IMREAD_ANYDEPTH)

        if color_bgr is None or depth_raw is None:
            print(f"[recon] frame {idx}: skipping (read failed)")
            if prev_rgbd is not None:
                poses.append(poses[-1])
            continue

        h, w = depth_raw.shape[:2]
        if (w, h) != (tw, th):
            color_bgr = cv2.resize(color_bgr, (tw, th))
            depth_raw = cv2.resize(depth_raw, (tw, th), interpolation=cv2.INTER_NEAREST)

        color_o3d = o3d.geometry.Image(cv2.cvtColor(color_bgr, cv2.COLOR_BGR2RGB))
        depth_o3d = o3d.geometry.Image(depth_raw.astype(np.uint16))

        rgbd = o3d.geometry.RGBDImage.create_from_color_and_depth(
            color_o3d, depth_o3d,
            depth_scale=DEPTH_SCALE,
            depth_trunc=DEPTH_TRUNC,
            convert_rgb_to_intensity=False,
        )

        # Frame-to-frame odometry (source=prev, target=current).
        # compute_rgbd_odometry returns trans such that p_target = trans @ p_source.
        # Camera pose update: P_i = P_{i-1} @ inv(trans)
        if prev_rgbd is not None:
            try:
                success, trans, _ = o3d.pipelines.odometry.compute_rgbd_odometry(
                    prev_rgbd, rgbd, o3d_intr,
                    np.eye(4),
                    o3d.pipelines.odometry.RGBDOdometryJacobianFromHybridTerm(),
                    odo_option,
                )
                if success:
                    poses.append(poses[-1] @ np.linalg.inv(trans))
                    odo_ok += 1
                else:
                    poses.append(poses[-1])
                    odo_fail += 1
            except Exception as exc:
                print(f"[recon] frame {idx}: odometry error: {exc}")
                poses.append(poses[-1])
                odo_fail += 1

        # Integrate (extrinsic = world-to-camera = inv(pose))
        volume.integrate(rgbd, o3d_intr, np.linalg.inv(poses[-1]))
        integrated += 1
        prev_rgbd = rgbd

        if idx % 20 == 0 or idx == len(pairs) - 1:
            pct = 5 + int(55 * (idx + 1) / len(pairs))
            _progress(f"frame {idx + 1}/{len(pairs)}", pct)

    print(
        f"[recon] integration done: {integrated} frames, "
        f"odometry ok={odo_ok}, fail={odo_fail}"
    )
    if integrated < 2:
        raise ValueError(f"Only {integrated} frames integrated — insufficient for reconstruction")

    # ── 5. Extract mesh ─────────────────────────────────────────
    _progress("extracting triangle mesh from TSDF", 65)
    mesh = volume.extract_triangle_mesh()
    mesh.compute_vertex_normals()

    n_verts = len(mesh.vertices)
    n_tris = len(mesh.triangles)
    print(f"[recon] raw mesh: {n_verts} vertices, {n_tris} triangles")
    if n_tris == 0:
        raise ValueError("TSDF produced empty mesh — depth data may be invalid")

    # ── 6. Clean ────────────────────────────────────────────────
    mesh.remove_degenerate_triangles()
    mesh.remove_duplicated_triangles()
    mesh.remove_duplicated_vertices()
    mesh.remove_unreferenced_vertices()
    n_tris = len(mesh.triangles)
    print(f"[recon] cleaned mesh: {len(mesh.vertices)} verts, {n_tris} tris")

    # ── 7. Decimate ─────────────────────────────────────────────
    target = TARGET_TRIANGLES
    if n_tris > target:
        _progress(f"decimating {n_tris} → {target} triangles", 75)
        mesh = mesh.simplify_quadric_decimation(target_number_of_triangles=target)
        mesh.compute_vertex_normals()
        print(f"[recon] decimated: {len(mesh.vertices)} verts, {len(mesh.triangles)} tris")

    # ── 8. Export GLB ───────────────────────────────────────────
    _progress("exporting GLB", 85)
    _export_glb(mesh, output_glb_path)
    glb_size = os.path.getsize(output_glb_path)
    print(f"[recon] GLB: {glb_size} bytes ({glb_size / (1024 * 1024):.1f} MB)")

    # ── 9. Re-decimate if GLB exceeds Supabase 50 MB limit ─────
    attempt = 0
    cur_target = target
    while glb_size > MAX_GLB_BYTES and attempt < 5:
        attempt += 1
        cur_target = max(int(cur_target * 0.5), 1000)
        print(f"[recon] GLB too large, re-decimating to {cur_target} tris (attempt {attempt})")
        mesh_d = mesh.simplify_quadric_decimation(target_number_of_triangles=cur_target)
        mesh_d.compute_vertex_normals()
        _export_glb(mesh_d, output_glb_path)
        glb_size = os.path.getsize(output_glb_path)
        print(f"[recon] GLB now {glb_size / (1024 * 1024):.1f} MB")

    if glb_size > MAX_GLB_BYTES:
        raise ValueError(
            f"GLB still {glb_size / (1024 * 1024):.1f} MB after {attempt} decimation rounds "
            f"(limit {MAX_GLB_BYTES / (1024 * 1024):.0f} MB)"
        )
    if glb_size == 0:
        raise ValueError("GLB export produced an empty file")

    _progress("reconstruction complete", 95)
    return output_glb_path
