# Processing Pipeline Setup

This document describes how to set up the automatic processing pipeline for magnetic data.

## Overview

The processing pipeline allows users to upload `mag_data.csv` files and automatically run the complete processing workflow:
1. Validation and cleaning (`validate_and_diagnosticsV1.py`)
2. Anomaly detection (`compute_local_anomaly_v2.py`)
3. Heatmap generation (`interpolate_to_heatmapV1.py`)

## Environment Variables

Add these to your `.env.local` file:

```bash
# Path to fluxspace-core repository (where Python scripts are located)
FLUXSPACE_CORE_PATH=/path/to/fluxspace-core

# Python executable path (default: python3)
PYTHON_PATH=python3
```

### Example

```bash
FLUXSPACE_CORE_PATH=/Users/aidenerard/Desktop/fluxspace/fluxspace-core
PYTHON_PATH=python3
```

## Requirements

1. **Python Environment**: The Python scripts require:
   - Python 3.8+
   - numpy
   - pandas
   - matplotlib
   - Other dependencies as specified in fluxspace-core

2. **Fluxspace-Core Repository**: The Python scripts must be available at the path specified in `FLUXSPACE_CORE_PATH`. The expected structure is:
   ```
   fluxspace-core/
   ├── scripts/
   │   ├── validate_and_diagnosticsV1.py
   │   ├── compute_local_anomaly_v2.py
   │   └── interpolate_to_heatmapV1.py
   ```

3. **File System Access**: The API route needs write access to `/tmp` for temporary file processing.

## Usage

1. Navigate to `/process` in your application
2. Upload a `mag_data.csv` file
3. Select a project
4. Configure processing parameters:
   - **Anomaly Radius**: Neighborhood radius for anomaly computation (default: 0.10m)
   - **Grid Step**: Grid spacing for heatmap interpolation (default: 0.01m)
   - **Value Column**: Which anomaly column to use for visualization
     - `local_anomaly_norm`: Normalized (0-1 scale) - Recommended
     - `local_anomaly`: Raw anomaly value
     - `local_anomaly_abs`: Absolute value
   - **Drop Outliers**: Remove outliers during validation
   - **Drop Flagged Points**: Remove points flagged as outliers or spikes
   - **Generate Plots**: Create diagnostic plots
5. Click "Start Processing"

## Processing Flow

1. File is uploaded to Supabase Storage
2. Upload record is created in database
3. Job record is created with status "processing"
4. Python scripts are executed in sequence:
   - Validation → `mag_data_clean.csv`
   - Anomaly computation → `mag_data_anomaly.csv`
   - Heatmap generation → `*_grid.csv` and `*_heatmap.png`
5. Results are uploaded to Supabase Storage
6. Job status is updated to "done" or "failed"

## Output Files

After processing completes, the following files are available:

- **Grid CSV**: Interpolated grid data (`grid.csv`)
- **Heatmap PNG**: Visual heatmap (`heatmap.png`)
- **Diagnostic Images**: Various diagnostic plots (if enabled)

All files are stored in Supabase Storage under `{userId}/{jobId}/`.

## Troubleshooting

### "Script not found" errors

- Verify `FLUXSPACE_CORE_PATH` points to the correct directory
- Ensure the scripts directory exists and contains the Python files

### "Permission denied" errors

- Check that the application has write access to `/tmp`
- Verify Python executable permissions

### Processing fails silently

- Check the job logs in the database
- Verify Python dependencies are installed
- Check server logs for detailed error messages

## Production Considerations

1. **Queue System**: For production, replace the inline processing with a proper job queue (e.g., Bull, BullMQ, or a cloud service)

2. **Resource Limits**: Set appropriate timeouts and resource limits for processing jobs

3. **Cleanup**: Implement a cleanup job to remove temporary files after processing

4. **Monitoring**: Add monitoring and alerting for failed jobs

5. **Scaling**: Consider using serverless functions or containerized processing for better scalability

## API Endpoint

The processing API is available at `/api/process`:

**POST /api/process**

Form data:
- `file`: CSV file (multipart/form-data)
- `project_id`: Project UUID
- `radius`: Anomaly radius (optional, default: 0.10)
- `grid_step`: Grid step size (optional, default: 0.01)
- `value_col`: Value column name (optional, default: local_anomaly_norm)
- `drop_outliers`: Boolean (optional, default: false)
- `drop_flag_any`: Boolean (optional, default: false)
- `plot`: Boolean (optional, default: true)

Response:
```json
{
  "job_id": "uuid",
  "status": "processing"
}
```
