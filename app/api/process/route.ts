import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"
import { writeFile, mkdir, readFile, unlink, readdir } from "fs/promises"
import { join } from "path"
import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

// Configuration: Path to fluxspace-core scripts
// In production, this should be an environment variable
const FLUXSPACE_CORE_PATH = process.env.FLUXSPACE_CORE_PATH || "/Users/aidenerard/Desktop/fluxspace/fluxspace-core"
const PYTHON_PATH = process.env.PYTHON_PATH || "python3"

interface ProcessParams {
  radius?: number
  gridStep?: number
  valueCol?: "local_anomaly" | "local_anomaly_norm" | "local_anomaly_abs"
  dropOutliers?: boolean
  dropFlagAny?: boolean
  plot?: boolean
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const projectId = formData.get("project_id") as string
    const params: ProcessParams = {
      radius: formData.get("radius") ? parseFloat(formData.get("radius") as string) : 0.10,
      gridStep: formData.get("grid_step") ? parseFloat(formData.get("grid_step") as string) : 0.01,
      valueCol: (formData.get("value_col") as ProcessParams["valueCol"]) || "local_anomaly_norm",
      dropOutliers: formData.get("drop_outliers") === "true",
      dropFlagAny: formData.get("drop_flag_any") === "true",
      plot: formData.get("plot") === "true",
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "No project ID provided" }, { status: 400 })
    }

    // Get file buffer and metadata
    const userId = user.id
    const filename = file.name
    const fileBuffer = await file.arrayBuffer()
    const sizeBytes = fileBuffer.byteLength

    // Create temporary directory for processing
    const tempDir = join("/tmp", `fluxspace-${Date.now()}-${Math.random().toString(36).substring(7)}`)
    await mkdir(tempDir, { recursive: true })
    await mkdir(join(tempDir, "data", "raw"), { recursive: true })
    await mkdir(join(tempDir, "data", "processed"), { recursive: true })
    await mkdir(join(tempDir, "data", "exports"), { recursive: true })

    // Save uploaded file to temp directory
    const inputPath = join(tempDir, "data", "raw", "mag_data.csv")
    await writeFile(inputPath, Buffer.from(fileBuffer))

    // Upload file to storage
    const storagePath = `${userId}/uploads/${Date.now()}-${filename}`
    const { error: uploadError } = await supabase.storage
      .from("uploads")
      .upload(storagePath, Buffer.from(fileBuffer), {
        contentType: "text/csv",
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Create upload record
    const { data: upload, error: uploadRecordError } = await supabase
      .from("uploads")
      .insert({
        project_id: projectId,
        filename: filename,
        size_bytes: sizeBytes,
        storage_url: storagePath,
      })
      .select()
      .single()

    if (uploadRecordError) {
      return NextResponse.json({ error: uploadRecordError.message }, { status: 500 })
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .insert({
        project_id: projectId,
        upload_id: upload.id,
        status: "processing",
        params: params,
      })
      .select()
      .single()

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 })
    }

    // Process in background (in production, use a queue system)
    processPipeline(tempDir, inputPath, params, job.id, supabase, userId).catch((error) => {
      console.error("Pipeline processing error:", error)
      supabase
        .from("jobs")
        .update({ status: "failed", logs: error.message })
        .eq("id", job.id)
    })

    return NextResponse.json({ job_id: job.id, status: "processing" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function processPipeline(
  tempDir: string,
  inputPath: string,
  params: ProcessParams,
  jobId: string,
  supabase: ReturnType<typeof createClient>,
  userId: string
) {
  const logs: string[] = []
  
  try {
    // Step 1: Validate and clean
    logs.push("Step 1: Validating and cleaning data...")
    await supabase
      .from("jobs")
      .update({ logs: logs.join("\n") })
      .eq("id", jobId)

    const validateCmd = [
      PYTHON_PATH,
      join(FLUXSPACE_CORE_PATH, "scripts", "validate_and_diagnosticsV1.py"),
      "--in", inputPath,
      ...(params.dropOutliers ? ["--drop-outliers"] : []),
    ].join(" ")

    const { stdout: validateOut, stderr: validateErr } = await execAsync(validateCmd, {
      cwd: tempDir,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    })

    logs.push(validateOut)
    if (validateErr) logs.push(`WARNING: ${validateErr}`)

    const cleanPath = join(tempDir, "data", "processed", "mag_data_clean.csv")
    
    // Step 2: Compute local anomaly
    logs.push("\nStep 2: Computing local anomalies...")
    await supabase
      .from("jobs")
      .update({ logs: logs.join("\n") })
      .eq("id", jobId)

    const anomalyCmd = [
      PYTHON_PATH,
      join(FLUXSPACE_CORE_PATH, "scripts", "compute_local_anomaly_v2.py"),
      "--in", cleanPath,
      "--radius", params.radius?.toString() || "0.10",
      ...(params.dropFlagAny ? ["--drop-flag-any"] : []),
      ...(params.plot ? ["--plot"] : []),
    ].join(" ")

    const { stdout: anomalyOut, stderr: anomalyErr } = await execAsync(anomalyCmd, {
      cwd: tempDir,
      maxBuffer: 10 * 1024 * 1024,
    })

    logs.push(anomalyOut)
    if (anomalyErr) logs.push(`WARNING: ${anomalyErr}`)

    const anomalyPath = join(tempDir, "data", "processed", "mag_data_anomaly.csv")

    // Step 3: Generate heatmap
    logs.push("\nStep 3: Generating heatmap...")
    await supabase
      .from("jobs")
      .update({ logs: logs.join("\n") })
      .eq("id", jobId)

    const heatmapCmd = [
      PYTHON_PATH,
      join(FLUXSPACE_CORE_PATH, "scripts", "interpolate_to_heatmapV1.py"),
      "--in", anomalyPath,
      "--value-col", params.valueCol || "local_anomaly_norm",
      "--grid-step", params.gridStep?.toString() || "0.01",
    ].join(" ")

    const { stdout: heatmapOut, stderr: heatmapErr } = await execAsync(heatmapCmd, {
      cwd: tempDir,
      maxBuffer: 10 * 1024 * 1024,
    })

    logs.push(heatmapOut)
    if (heatmapErr) logs.push(`WARNING: ${heatmapErr}`)

    // Find generated files
    const exportsDir = join(tempDir, "data", "exports")
    const files = await readdir(exportsDir)
    
    const gridCsv = files.find(f => f.endsWith("_grid.csv"))
    const heatmapPng = files.find(f => f.endsWith("_heatmap.png"))

    // Upload results to Supabase Storage

    const results: { gridCsv?: string; heatmapPng?: string; diagnosticPngs?: string[] } = {}

    if (gridCsv) {
      const gridContent = await readFile(join(exportsDir, gridCsv))
      const { data: gridUpload, error: gridError } = await supabase.storage
        .from("results")
        .upload(`${userId}/${jobId}/grid.csv`, gridContent, {
          contentType: "text/csv",
          upsert: true,
        })
      if (!gridError) {
        const { data: { publicUrl } } = supabase.storage
          .from("results")
          .getPublicUrl(`${userId}/${jobId}/grid.csv`)
        results.gridCsv = publicUrl
      }
    }

    if (heatmapPng) {
      const heatmapContent = await readFile(join(exportsDir, heatmapPng))
      const { data: heatmapUpload, error: heatmapError } = await supabase.storage
        .from("results")
        .upload(`${userId}/${jobId}/heatmap.png`, heatmapContent, {
          contentType: "image/png",
          upsert: true,
        })
      if (!heatmapError) {
        const { data: { publicUrl } } = supabase.storage
          .from("results")
          .getPublicUrl(`${userId}/${jobId}/heatmap.png`)
        results.heatmapPng = publicUrl
      }
    }

    // Upload diagnostic images
    const processedDir = join(tempDir, "data", "processed")
    const processedFiles = await readdir(processedDir)
    const diagnosticPngs = processedFiles.filter(f => f.endsWith(".png"))
    const diagnosticUrls: string[] = []

    for (const png of diagnosticPngs) {
      const pngContent = await readFile(join(processedDir, png))
      const { error: pngError } = await supabase.storage
        .from("results")
        .upload(`${userId}/${jobId}/diagnostics/${png}`, pngContent, {
          contentType: "image/png",
          upsert: true,
        })
      if (!pngError) {
        const { data: { publicUrl } } = supabase.storage
          .from("results")
          .getPublicUrl(`${userId}/${jobId}/diagnostics/${png}`)
        diagnosticUrls.push(publicUrl)
      }
    }

    results.diagnosticPngs = diagnosticUrls

    // Update job status
    await supabase
      .from("jobs")
      .update({
        status: "done",
        result_csv_url: results.gridCsv,
        result_png_url: results.heatmapPng,
        logs: logs.join("\n"),
      })
      .eq("id", jobId)

    // Cleanup temp directory
    // Note: In production, schedule cleanup job instead of immediate deletion
    // await execAsync(`rm -rf ${tempDir}`)

  } catch (error: any) {
    logs.push(`\nERROR: ${error.message}`)
    await supabase
      .from("jobs")
      .update({ status: "failed", logs: logs.join("\n") })
      .eq("id", jobId)
    throw error
  }
}
