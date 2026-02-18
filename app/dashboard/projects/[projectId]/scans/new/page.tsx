"use client"

import { useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { createBrowserSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowLeft, Upload, FileArchive, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { formatBytes } from "@/lib/utils"

type UploadState = "idle" | "uploading" | "starting" | "done" | "error"

export default function NewScanPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string

  const [scanName, setScanName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (f) {
      setFile(f)
      if (!scanName) {
        const name = f.name.replace(/\.zip$/i, "")
        setScanName(name)
      }
      setError(null)
    }
  }, [scanName])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
    multiple: false,
  })

  const handleSubmit = async () => {
    if (!file || !scanName.trim()) {
      setError("Please provide a scan name and upload a .zip file")
      return
    }

    try {
      setState("uploading")
      setError(null)
      setProgress(0)

      // Step 1: Create scan and get signed upload URL
      const createRes = await fetch("/api/scans/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          name: scanName.trim(),
          filename: file.name,
          size_bytes: file.size,
        }),
      })

      if (!createRes.ok) {
        const err = await createRes.json()
        throw new Error(err.error || "Failed to create scan")
      }

      const { scan_id, upload_path } = await createRes.json()

      // Step 2: Upload zip to Supabase Storage directly
      setProgress(10)
      const supabase = createBrowserSupabaseClient()
      const { error: uploadError } = await supabase.storage
        .from("runs-uploads")
        .upload(upload_path, file, {
          contentType: "application/zip",
          upsert: false,
        })

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      setProgress(80)

      // Step 3: Kick off processing
      setState("starting")
      const startRes = await fetch(`/api/scans/${scan_id}/start`, {
        method: "POST",
      })

      if (!startRes.ok) {
        const err = await startRes.json()
        throw new Error(err.error || "Failed to start processing")
      }

      setProgress(100)
      setState("done")

      // Navigate to scan detail after short delay
      setTimeout(() => {
        router.push(`/dashboard/projects/${projectId}/scans/${scan_id}`)
      }, 1500)
    } catch (err: any) {
      setState("error")
      setError(err.message || "Something went wrong")
    }
  }

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">FluxSpace</Link>
          <Link href="/account" className="text-sm font-medium">Account</Link>
        </div>
      </header>

      <div className="container max-w-2xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New Scan</CardTitle>
            <CardDescription>
              Upload a run folder as a .zip file. The zip should contain:
              <code className="block mt-2 p-3 bg-muted rounded text-xs font-mono leading-relaxed">
                run_YYYYMMDD_HHMM/<br />
                ├── raw/<br />
                │   ├── oak_rgbd/<br />
                │   │   ├── color/  (PNG frames)<br />
                │   │   ├── depth/  (PNG frames)<br />
                │   │   ├── intrinsics.json<br />
                │   │   └── timestamps.csv<br />
                │   ├── mag_run.csv<br />
                │   └── calibration.json<br />
                ├── processed/  (optional)<br />
                └── exports/    (optional)
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="scan-name">Scan Name</Label>
              <Input
                id="scan-name"
                placeholder="e.g. run_20250217_1430"
                value={scanName}
                onChange={(e) => setScanName(e.target.value)}
                disabled={state !== "idle" && state !== "error"}
              />
            </div>

            <div className="space-y-2">
              <Label>Run Folder (.zip)</Label>
              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                  ${file ? "border-primary/50 bg-primary/5" : ""}
                  ${(state !== "idle" && state !== "error") ? "pointer-events-none opacity-60" : ""}
                `}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileArchive className="h-10 w-10 text-primary" />
                    <div className="font-medium">{file.name}</div>
                    <div className="text-sm text-muted-foreground">{formatBytes(file.size)}</div>
                    <div className="text-xs text-muted-foreground">Click or drag to replace</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <div className="font-medium">
                      {isDragActive ? "Drop your zip here" : "Drag & drop a .zip file"}
                    </div>
                    <div className="text-sm text-muted-foreground">or click to browse</div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {state === "uploading" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading zip file...
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {state === "starting" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting pipeline processing...
              </div>
            )}

            {state === "done" && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Scan created! Redirecting to results...
              </div>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={!file || !scanName.trim() || (state !== "idle" && state !== "error")}
            >
              {state === "idle" || state === "error" ? (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Process
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
