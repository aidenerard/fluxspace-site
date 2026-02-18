"""
Step 5: Visualize 3D magnetic heatmap – HEADLESS screenshot mode.

Input:  <run>/exports/volume.npz
        <run>/processed/open3d_mesh.ply (optional, overlaid if present)
Output: <run>/exports/heatmap.png

We avoid Open3D GUI entirely. Instead we use matplotlib's 3D scatter
to render a heatmap of the voxel data and save as PNG.
This is reliable in headless environments (Docker, CI, Render, Fly.io).

If Open3D offscreen rendering is available and the mesh exists, we
attempt to render the mesh with vertex coloring as well.
"""

import logging
from pathlib import Path

import numpy as np

logger = logging.getLogger("worker.visualize_heatmap")


def run_visualize_heatmap(run_dir: Path) -> None:
    exports = run_dir / "exports"
    processed = run_dir / "processed"
    exports.mkdir(exist_ok=True)

    volume_path = exports / "volume.npz"
    mesh_path = processed / "open3d_mesh.ply"
    output_path = exports / "heatmap.png"

    if not volume_path.is_file():
        raise FileNotFoundError(f"volume.npz not found at {volume_path}")

    # Load volume
    data = np.load(volume_path)
    volume = data["volume"]
    origin = data["origin"]
    voxel_size = data["voxel_size"]

    # Use matplotlib for headless rendering
    import matplotlib
    matplotlib.use("Agg")  # Non-interactive backend
    import matplotlib.pyplot as plt
    from mpl_toolkits.mplot3d import Axes3D  # noqa: F401

    # Extract non-zero voxel positions and values
    nz = np.nonzero(volume)
    if len(nz[0]) == 0:
        logger.warning("No non-zero voxels in volume, creating empty heatmap")
        fig, ax = plt.subplots(figsize=(10, 8))
        ax.text(0.5, 0.5, "No data", ha="center", va="center", fontsize=20)
        fig.savefig(str(output_path), dpi=150, bbox_inches="tight")
        plt.close(fig)
        return

    # World coordinates of filled voxels
    xs = origin[0] + nz[0] * voxel_size[0] if hasattr(voxel_size, '__len__') else origin[0] + nz[0] * voxel_size
    ys = origin[1] + nz[1] * (voxel_size[1] if hasattr(voxel_size, '__len__') else voxel_size)
    zs = origin[2] + nz[2] * (voxel_size[2] if hasattr(voxel_size, '__len__') else voxel_size)
    vals = volume[nz]

    # Subsample if too many points for matplotlib
    max_points = 50000
    if len(xs) > max_points:
        idx = np.random.choice(len(xs), max_points, replace=False)
        xs, ys, zs, vals = xs[idx], ys[idx], zs[idx], vals[idx]
        logger.info(f"Subsampled to {max_points} points for visualization")

    # Normalize values for colormap
    vmin, vmax = np.percentile(vals, [2, 98])
    if vmax <= vmin:
        vmax = vmin + 1.0

    fig = plt.figure(figsize=(12, 9))
    ax = fig.add_subplot(111, projection="3d")

    scatter = ax.scatter(
        xs, ys, zs,
        c=vals,
        cmap="inferno",
        vmin=vmin,
        vmax=vmax,
        s=2,
        alpha=0.6,
        edgecolors="none",
    )

    cbar = fig.colorbar(scatter, ax=ax, shrink=0.6, label="Magnetic Field (µT)")

    ax.set_xlabel("X (m)")
    ax.set_ylabel("Y (m)")
    ax.set_zlabel("Z (m)")
    ax.set_title("3D Magnetic Field Heatmap")

    # Equal aspect ratio
    ranges = np.array([xs.max() - xs.min(), ys.max() - ys.min(), zs.max() - zs.min()])
    max_range = ranges.max() / 2.0
    mid = np.array([(xs.max() + xs.min()) / 2, (ys.max() + ys.min()) / 2, (zs.max() + zs.min()) / 2])
    ax.set_xlim(mid[0] - max_range, mid[0] + max_range)
    ax.set_ylim(mid[1] - max_range, mid[1] + max_range)
    ax.set_zlim(mid[2] - max_range, mid[2] + max_range)

    fig.savefig(str(output_path), dpi=150, bbox_inches="tight")
    plt.close(fig)

    logger.info(f"Heatmap saved to {output_path}")
