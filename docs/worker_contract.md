# Worker Contract

The FluxSpace backend worker is an **external** service (not Vercel) that runs
the Python/Open3D pipeline. This document specifies the exact integration
surface between the Next.js app and the worker.

---

## 1. Trigger

The Next.js API route `POST /api/runs/trigger` calls:

```
POST {WORKER_URL}/jobs/run
Authorization: Bearer {WORKER_SECRET}
Content-Type: application/json

{ "runId": "<uuid>" }
```

The worker **must** return `2xx` (ideally `202 Accepted`) immediately and
process the run asynchronously.

---

## 2. Required Zip Structure

Users upload a single `.zip` containing one top-level run folder:

```
run_YYYYMMDD_HHMM/
├── raw/
│   ├── oak_rgbd/
│   │   ├── color/          # PNG frames
│   │   ├── depth/          # PNG depth frames
│   │   ├── intrinsics.json # {fx, fy, cx, cy, width, height}
│   │   └── timestamps.csv  # optional
│   ├── mag_run.csv         # timestamp, bx, by, bz
│   └── calibration.json    # optional
├── processed/              # may be empty
└── exports/                # may be empty
```

---

## 3. Storage Buckets & Path Contract

All buckets are **private**. The worker authenticates with
`SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS).

| Bucket            | Path pattern                              | Owner      |
|-------------------|-------------------------------------------|------------|
| `runs-raw`        | `{runId}/input.zip`                       | Next.js    |
| `runs-processed`  | `{runId}/viewer/*`, `{runId}/exports/*`   | Worker     |
| `runs-logs`       | `{runId}/pipeline.log`                    | Worker     |

> **No user-id prefix.** Paths are keyed by `runId` only.

### Required viewer assets (in `runs-processed`)

| Path                                | Description                           |
|-------------------------------------|---------------------------------------|
| `{runId}/viewer/manifest.json`      | Viewer manifest (schema below)        |
| `{runId}/viewer/scene.glb`          | Reconstructed surface mesh            |
| `{runId}/viewer/heatmap.glb`        | Heatmap overlay mesh (optional)       |

### Optional exports (in `runs-processed`)

| Path                                | Description                           |
|-------------------------------------|---------------------------------------|
| `{runId}/exports/open3d_mesh.ply`   | Raw PLY mesh                          |
| `{runId}/exports/trajectory.csv`    | Camera trajectory                     |
| `{runId}/exports/mag_world.csv`     | Fused mag readings (world coords)     |
| `{runId}/exports/volume.npz`        | Voxel volume                          |
| `{runId}/exports/heatmap.png`       | Static heatmap screenshot             |
| `{runId}/exports/outputs.zip`       | All-in-one archive                    |

### Log (in `runs-logs`)

| Path                          | Description           |
|-------------------------------|-----------------------|
| `{runId}/pipeline.log`        | Full pipeline log     |

After uploading the log, set the `log_path` column on the `runs` row to
`{runId}/pipeline.log`.

---

## 4. DB Status Updates

The worker **must** update the `runs` table row as it progresses:

| status       | stage           | progress | When                              |
|------------- |-----------------|----------|-----------------------------------|
| `queued`     | `queued`        | 0        | Set by Next.js `/api/runs/trigger`|
| `processing` | `reconstruct`   | 10       | Starting Open3D RGBD              |
| `processing` | `fuse`          | 40       | Fusing mag + trajectory           |
| `processing` | `voxelize`      | 60       | Building voxel volume             |
| `processing` | `visualize`     | 75       | Generating heatmap                |
| `exporting`  | `export`        | 85       | Converting to GLB / packaging     |
| `done`       | *null*          | 100      | All outputs uploaded              |
| `failed`     | *(last stage)*  | —        | On any unrecoverable error        |

On failure, set `error_message` to a **human-readable** string (not a raw
Python traceback).

Optionally set `summary_json` with stats:

```json
{
  "vertices": 142503,
  "faces": 281006,
  "mag_points": 8421,
  "voxel_grid": [128, 94, 112],
  "duration_s": 187
}
```

---

## 5. manifest.json Schema

```json
{
  "version": 1,
  "surface": { "type": "glb", "path": "viewer/scene.glb" },
  "heatmap": { "type": "glb", "path": "viewer/heatmap.glb" },
  "default": {
    "showHeatmap": true,
    "heatmapOpacity": 0.6
  }
}
```

- `heatmap` may be `null` if no heatmap was produced.
- `path` values are relative to `runs-processed/{runId}/`.
- `default.showHeatmap` and `default.heatmapOpacity` control the initial
  viewer state.

---

## 6. How the Next.js API Routes Are Used

| Route                      | Method | Purpose                                          |
|--------------------------- |--------|--------------------------------------------------|
| `/api/runs/create`         | POST   | Insert run row, return signed upload URL          |
| `/api/runs/trigger`        | POST   | Set status=queued, call worker                    |
| `/api/runs/[id]`           | GET    | Return run row + signed viewer/export/log URLs    |

The viewer page (`/viewer/[id]`) calls `GET /api/runs/[id]` to obtain
time-limited signed URLs (10 min TTL) for `manifest.json`, `scene.glb`,
and `heatmap.glb`, then fetches them directly from Supabase Storage.

---

## 7. Authentication

- **Next.js &rarr; Worker:** `Authorization: Bearer {WORKER_SECRET}`
- **Worker &rarr; Supabase:** `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS)
- **Browser &rarr; Storage:** Only via server-signed URLs (never raw keys)
