"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowLeft, Upload, FileArchive, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react"
import { formatBytes } from "@/lib/utils"

type Stage = "idle" | "creating" | "uploading" | "triggering" | "done" | "error"

export default function NewRunPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setFile(accepted[0])
      setError("")
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
    multiple: false,
  })

  const submit = async () => {
    if (!file) return
    try {
      setError("")

      // 1 — create run & get signed upload URL
      setStage("creating")
      const createRes = await fetch("/api/runs/create", { method: "POST" })
      if (!createRes.ok) throw new Error((await createRes.json()).error ?? "Create failed")
      const { runId, uploadUrl } = await createRes.json()

      // 2 — PUT zip to the signed URL
      setStage("uploading")
      setProgress(0)

      const xhr = new XMLHttpRequest()
      await new Promise<void>((resolve, reject) => {
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", "application/zip")
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload HTTP ${xhr.status}`)))
        xhr.onerror = () => reject(new Error("Upload network error"))
        xhr.send(file)
      })

      // 3 — trigger worker
      setStage("triggering")
      const triggerRes = await fetch("/api/runs/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      })
      if (!triggerRes.ok) throw new Error((await triggerRes.json()).error ?? "Trigger failed")

      setStage("done")
      setTimeout(() => router.push(`/dashboard/runs/${runId}`), 1200)
    } catch (err: any) {
      setStage("error")
      setError(err.message ?? "Something went wrong")
    }
  }

  const busy = stage !== "idle" && stage !== "error" && stage !== "done"

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">FluxSpace</Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard/runs/new" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Upload</Link>
            <Link href="/dashboard/runs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Runs</Link>
            <Link href="/account" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Account</Link>
          </nav>
        </div>
      </header>

      <div className="container max-w-2xl px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link href="/dashboard/runs"><ArrowLeft className="h-4 w-4 mr-1" />Runs</Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>New Run</CardTitle>
            <CardDescription>
              Upload a <code className="font-mono text-xs bg-muted px-1 rounded">run_YYYYMMDD_HHMM.zip</code> containing
              your raw scan data.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* dropzone */}
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
                ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                ${file ? "border-primary/50 bg-primary/5" : ""}
                ${busy ? "pointer-events-none opacity-60" : ""}
              `}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileArchive className="h-10 w-10 text-primary" />
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">{isDragActive ? "Drop it here" : "Drag & drop a .zip"}</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
              )}
            </div>

            {/* progress / status */}
            {stage === "uploading" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading&hellip; {progress}%
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {stage === "creating" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating run&hellip;
              </p>
            )}
            {stage === "triggering" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Starting pipeline&hellip;
              </p>
            )}
            {stage === "done" && (
              <p className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Run queued — redirecting&hellip;
              </p>
            )}
            {error && (
              <p className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
              </p>
            )}

            <Button className="w-full" size="lg" disabled={!file || busy} onClick={submit}>
              {busy ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Working&hellip;</> : <><Upload className="h-4 w-4 mr-2" />Upload &amp; Process</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
