# FluxSpace Backend Worker

Python FastAPI service that processes scan pipeline jobs for the FluxSpace web app.

## Architecture

```
Next.js (Vercel)                 Backend Worker (Fly.io / Render)
┌──────────────┐    POST /process    ┌──────────────────────┐
│ Upload page  │ ──────────────────> │ FastAPI              │
│ /api/scans/* │                     │  ↓ download zip      │
└──────────────┘                     │  ↓ unpack & validate │
       │                             │  ↓ run pipeline      │
       ▼                             │  ↓ upload outputs    │
 Supabase Storage                    │  ↓ update DB         │
 (runs-uploads)                      └──────────────────────┘
                                              │
                                              ▼
                                     Supabase Storage
                                     (runs-outputs)
```

## What User Must Upload

A `.zip` file containing a run folder with this structure:

```
run_YYYYMMDD_HHMM/
├── raw/
│   ├── oak_rgbd/
│   │   ├── color/          # PNG frames from RGB camera
│   │   ├── depth/          # PNG frames from depth camera
│   │   ├── intrinsics.json # Camera intrinsics {fx, fy, cx, cy, width, height}
│   │   └── timestamps.csv  # Frame timestamps (optional)
│   ├── mag_run.csv         # Magnetometer readings (timestamp, bx, by, bz)
│   └── calibration.json    # Mag sensor calibration (recommended)
├── processed/              # (optional, created by pipeline)
└── exports/                # (optional, created by pipeline)
```

**Important:**
- The canonical path is `raw/oak_rgbd/` (NOT `raw/raw/oak_rgbd/`)
- `mag_run.csv` must have columns: `timestamp` (or `time`), `bx` (or `mag_x`), `by`, `bz`
- `intrinsics.json` must have: `fx`, `fy`, `cx`, `cy`, `width`, `height`

## Expected Outputs

After processing, the pipeline produces:

| File | Location | Description |
|------|----------|-------------|
| `open3d_mesh.ply` | `processed/` | Reconstructed 3D mesh |
| `trajectory.csv` | `processed/` | Camera trajectory (frame, tx, ty, tz, rotation) |
| `extrinsics.json` | `processed/` | Mag-to-camera transform (auto-created if missing) |
| `mag_world_m.csv` | `processed/` | Magnetometer readings in world coordinates (meters) |
| `volume.npz` | `exports/` | 3D voxel volume of magnetic field |
| `heatmap.png` | `exports/` | 3D heatmap screenshot |
| `outputs.zip` | `exports/` | All outputs packaged for download |

## Pipeline Steps

1. **Open3D Reconstruct** — RGBD odometry + TSDF fusion → mesh + trajectory
2. **Create Extrinsics** — Auto-generate `extrinsics.json` if missing (mag 2cm behind, 10cm below camera)
3. **Fuse Mag + Trajectory** — Interpolate camera poses at mag timestamps, apply extrinsics
4. **Mag to Voxel Volume** — Voxelize world-frame mag readings (voxel_size=0.02m, max 256³)
5. **Visualize Heatmap** — Headless matplotlib 3D scatter plot → PNG screenshot
6. **Package Outputs** — Zip all artifacts for download

## Setup

### Local Development

```bash
cd backend-worker

# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run the server
uvicorn main:app --reload --port 8000
```

### Run Pipeline Locally (CLI)

```bash
# Process a local run folder (no Supabase upload)
python process_scan.py --run-dir /path/to/run_20250217_1430 --no-upload

# Process and upload to Supabase
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=eyJ...
python process_scan.py --run-dir /path/to/run_20250217_1430 --scan-id <uuid>

# Skip reconstruction (if mesh already exists)
python process_scan.py --run-dir /path/to/run_20250217_1430 --no-upload --skip-reconstruct

# Custom voxel parameters
python process_scan.py --run-dir /path/to/run_20250217_1430 --no-upload --voxel-size 0.01 --max-dim 512
```

### Deploy to Render

1. Create a new "Web Service" on Render
2. Point to this repo, set root directory to `backend-worker`
3. Set environment: Docker
4. Add env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
5. Set the `WORKER_URL` env var in your Vercel deployment to the Render URL

### Deploy to Fly.io

```bash
cd backend-worker
fly launch --no-deploy
fly secrets set SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=eyJ...
fly deploy
```

Then set `WORKER_URL=https://your-app.fly.dev` in Vercel env vars.

## Extrinsics Convention

The `extrinsics.json` file describes the rigid transform from the magnetometer sensor to the camera frame.

**Camera frame (OpenCV / Open3D convention):**
- X = right
- Y = down  
- Z = forward (into the scene)

**Default values (our hardware):**
```json
{
  "description": "Magnetometer-to-camera extrinsics. Camera frame: X=right, Y=down, Z=forward.",
  "translation_m": [0.0, 0.10, -0.02],
  "quaternion_xyzw": [0.0, 0.0, 0.0, 1.0]
}
```

- `translation_m[1] = +0.10` → mag is 10cm below camera (Y points down)
- `translation_m[2] = -0.02` → mag is 2cm behind camera (Z points forward)

## Memory Safety

The voxelization step has built-in protections:
- Default `voxel_size = 0.02m` (2cm resolution)
- Grid dimensions clamped to `max_dim = 256` per axis
- Maximum memory: ~64 MB for the volume array (256³ × 4 bytes)
