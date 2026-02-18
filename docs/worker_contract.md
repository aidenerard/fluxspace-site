# Worker Contract

The FluxSpace backend worker is an external service (not hosted on Vercel) that
runs the heavy Python/Open3D pipeline.

## Trigger

The Next.js app calls:

```
POST {WORKER_URL}/jobs/run
Authorization: Bearer {WORKER_SECRET}
Content-Type: application/json

{ "runId": "<uuid>" }
```

The worker should return `202 Accepted` immediately and process
asynchronously.

## Input

The worker reads the run row from Supabase (`runs` table) using the
service-role key to obtain `raw_zip_path`.

It then downloads the zip from Supabase Storage:

```
bucket: runs-raw
path:   {raw_zip_path}        (e.g. "{userId}/{runId}/input.zip")
```

## Processing Stages

The worker **must** update the `runs` row as it progresses:

| status       | stage               | progress | When                         |
|------------- |---------------------|----------|------------------------------|
| `queued`     | `null`              | 0        | Set by Next.js /api/runs/trigger |
| `processing` | `reconstruct`       | 10       | Starting Open3D RGBD         |
| `processing` | `fuse`              | 40       | Fusing mag + trajectory      |
| `processing` | `voxelize`          | 60       | Building voxel volume        |
| `processing` | `visualize`         | 75       | Generating heatmap           |
| `exporting`  | `export`            | 85       | Converting to GLB / packaging|
| `done`       | `null`              | 100      | All outputs uploaded         |
| `failed`     | last stage reached  | —        | On any unrecoverable error   |

On failure set `error_message` to a human-readable string.

## Output Files

Upload all outputs under the processed prefix in Supabase Storage:

```
bucket: runs-processed
prefix: {userId}/{runId}/
```

### Required viewer assets

| File                           | Description                              |
|-------------------------------|------------------------------------------|
| `viewer/manifest.json`        | Viewer manifest (schema below)           |
| `viewer/scene.glb`            | Reconstructed surface mesh               |
| `viewer/heatmap.glb`          | Heatmap overlay mesh (vertex-colored)    |

### Optional exports

| File                           | Description                              |
|-------------------------------|------------------------------------------|
| `exports/open3d_mesh.ply`     | Raw PLY mesh                             |
| `exports/trajectory.csv`      | Camera trajectory                        |
| `exports/mag_world.csv`       | Fused magnetometer readings              |
| `exports/volume.npz`          | Voxel volume                             |
| `exports/heatmap.png`         | Static heatmap screenshot                |
| `exports/outputs.zip`         | All-in-one download archive              |
| `logs/pipeline.log`           | Full pipeline log                        |

After uploading `logs/pipeline.log`, set `log_path` on the runs row to
`{userId}/{runId}/logs/pipeline.log`.

Optionally set `summary_json` to a JSON object, e.g.:

```json
{
  "vertices": 142503,
  "faces": 281006,
  "mag_points": 8421,
  "voxel_grid": [128, 94, 112],
  "duration_s": 187
}
```

## manifest.json Schema

```json
{
  "version": 1,
  "surface": {
    "type": "glb",
    "path": "viewer/scene.glb"
  },
  "heatmap": {
    "type": "glb",
    "path": "viewer/heatmap.glb"
  },
  "default": {
    "showHeatmap": true,
    "heatmapOpacity": 0.6
  }
}
```

`path` values are relative to `runs-processed/{userId}/{runId}/`.

## Authentication

The worker authenticates itself to Supabase using the
`SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS).

The Next.js app authenticates to the worker using `WORKER_SECRET` sent
as a Bearer token.
