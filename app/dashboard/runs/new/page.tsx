"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowLeft, Upload, FileArchive, Loader2, CheckCircle2,
  AlertCircle, XCircle, RotateCcw,
} from "lucide-react"
import { formatBytes } from "@/lib/utils"
import { NavBar } from "@/components/navbar"

/* ── constants ──────────────────────────────────────────── */

const MAX_PART_BYTES = 49 * 1024 * 1024 // 49 MB (safety margin below 50 MB limit)
const MAX_FILE_BYTES = 1024 * 1024 * 1024 // 1 GB
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 3000, 5000]
const STORAGE_KEY = "fluxspace_pending_upload"

type Stage =
  | "idle"
  | "creating"
  | "uploading"
  | "manifest"
  | "triggering"
  | "done"
  | "error"
  | "cancelled"

interface PartPlan {
  index: number
  start: number
  end: number
  size: number
  key: string
}

interface PendingUpload {
  runId: string
  fileName: string
  fileSize: number
  lastModified: number
  totalParts: number
}

/* ── helpers ────────────────────────────────────────────── */

function buildPartPlans(fileSize: number, runId: string): PartPlan[] {
  const parts: PartPlan[] = []
  let offset = 0
  let idx = 1
  while (offset < fileSize) {
    const end = Math.min(offset + MAX_PART_BYTES, fileSize)
    const padded = String(idx).padStart(5, "0")
    parts.push({
      index: idx,
      start: offset,
      end,
      size: end - offset,
      key: `runs/${runId}/upload/parts/part_${padded}.bin`,
    })
    offset = end
    idx++
  }
  return parts
}

function savePending(p: PendingUpload) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {}
}

function loadPending(): PendingUpload | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingUpload) : null
  } catch {
    return null
  }
}

function clearPending() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function stripToken(url: string): string {
  try {
    const u = new URL(url)
    u.searchParams.delete("token")
    return u.toString()
  } catch {
    return url.replace(/token=[^&]+/, "token=***")
  }
}

/**
 * Call our Next.js API to obtain a Supabase Storage signed upload URL.
 * This is the ONLY request that carries auth (via session cookies).
 */
async function getSignedUploadUrl(
  runId: string,
  objectPath: string,
  contentType: string,
): Promise<string> {
  const res = await fetch(`/api/runs/${runId}/sign-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objectPath, contentType }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(body.error ?? `Sign failed (${res.status})`)
  }
  const { signedUrl } = await res.json()
  if (!signedUrl || typeof signedUrl !== "string") {
    throw new Error("Server returned an empty or invalid signed URL")
  }
  return signedUrl
}

/**
 * PUT a blob to a Supabase Storage signed URL using XMLHttpRequest.
 *
 * We use XHR instead of fetch() because XHR provides upload.onprogress
 * events, giving smooth incremental progress during large part uploads.
 *
 * IMPORTANT — CORS rules for this request:
 *   • Do NOT include Authorization, apikey, x-upsert, or any custom header.
 *     The signed token embedded in the query string is the sole auth mechanism.
 *   • withCredentials = false so the browser never attaches cookies.
 *   • Send zero explicit headers so the preflight (OPTIONS) only needs the
 *     server to allow the PUT method, not any extra header names.
 */
function putToSignedUrl(
  signedUrl: string,
  blob: Blob,
  signal: AbortSignal,
  onProgress?: (bytesUploaded: number) => void,
): Promise<void> {
  const safeUrl = stripToken(signedUrl)
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", signedUrl)
    xhr.withCredentials = false

    const onAbort = () => {
      xhr.abort()
      reject(new DOMException("Upload aborted", "AbortError"))
    }
    signal.addEventListener("abort", onAbort, { once: true })

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded)
      }
    }

    xhr.onload = () => {
      signal.removeEventListener("abort", onAbort)
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(blob.size)
        resolve()
      } else {
        const text = xhr.responseText ?? ""
        console.error(`[upload] PUT ${xhr.status} ${safeUrl}:`, text.slice(0, 300))
        if (xhr.status === 413 || text.includes("Maximum size exceeded")) {
          reject(
            new Error(
              "Supabase Free plan limits uploads to 50 MB per file. " +
                "This part exceeded the limit.",
            ),
          )
        } else {
          reject(
            new Error(
              `Upload failed (HTTP ${xhr.status}): ${text || xhr.statusText}. ` +
                `PUT target: ${safeUrl}`,
            ),
          )
        }
      }
    }

    xhr.onerror = () => {
      signal.removeEventListener("abort", onAbort)
      console.error("[upload] PUT network error:", safeUrl)
      reject(
        new Error(
          `Upload network error. ` +
            `Verify the signed URL points to /storage/v1/object/… ` +
            `and that your Supabase project CORS allows your origin. ` +
            `PUT target: ${safeUrl}`,
        ),
      )
    }

    xhr.send(blob)
  })
}

/**
 * Upload a blob with retry + re-signing.
 * Each retry requests a fresh signed URL so that expired or
 * single-use tokens don't cause permanent failures.
 */
async function uploadPartWithRetry(
  runId: string,
  objectPath: string,
  contentType: string,
  blob: Blob,
  signal: AbortSignal,
  onProgress?: (bytesUploaded: number) => void,
) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const signedUrl = await getSignedUploadUrl(runId, objectPath, contentType)
      await putToSignedUrl(signedUrl, blob, signal, onProgress)
      return
    } catch (err: any) {
      if (signal.aborted) throw err
      if (attempt === MAX_RETRIES) throw err
      if (
        err.message?.includes("50 MB") ||
        err.message?.includes("Maximum size")
      ) {
        throw err
      }
      onProgress?.(0)
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] ?? 5000))
    }
  }
}

/* ── component ──────────────────────────────────────────── */

export default function NewRunPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>("idle")
  const [progress, setProgress] = useState(0)
  const [currentPart, setCurrentPart] = useState(0)
  const [totalParts, setTotalParts] = useState(0)
  const [error, setError] = useState("")
  const [showResume, setShowResume] = useState(false)
  const [pendingRunId, setPendingRunId] = useState<string | null>(null)

  const cancelledRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const uploadLockRef = useRef(false)
  const activeRunIdRef = useRef<string | null>(null)

  /* ── detect pending upload on file selection ─────────── */
  useEffect(() => {
    if (!file) {
      setShowResume(false)
      setPendingRunId(null)
      return
    }
    const p = loadPending()
    if (
      p &&
      p.fileName === file.name &&
      p.fileSize === file.size &&
      p.lastModified === file.lastModified
    ) {
      setPendingRunId(p.runId)
      setShowResume(true)
    } else {
      setPendingRunId(null)
      setShowResume(false)
    }
  }, [file])

  /* ── file drop ───────────────────────────────────────── */
  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith(".zip")) {
      setError("Only .zip files are supported.")
      return
    }
    if (f.size === 0) {
      setError("File is empty.")
      return
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(
        `File is too large (${formatBytes(f.size)}). Maximum upload size is ${formatBytes(MAX_FILE_BYTES)}.`,
      )
      return
    }
    setFile(f)
    setError("")
    setStage("idle")
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"] },
    maxFiles: 1,
    multiple: false,
  })

  /* ── cancel handler ──────────────────────────────────── */
  const handleCancel = useCallback(() => {
    cancelledRef.current = true
    abortRef.current?.abort()
    setStage("cancelled")
    setError("Upload cancelled.")
  }, [])

  /* ── core upload logic ───────────────────────────────── */
  const doUpload = useCallback(
    async (resumeRunId: string | null) => {
      if (!file) return

      // Synchronous lock — prevents double-click / StrictMode from
      // spawning a second concurrent flow with a different runId.
      if (uploadLockRef.current) {
        console.warn("[upload] already in progress, ignoring duplicate call")
        return
      }
      uploadLockRef.current = true

      cancelledRef.current = false
      abortRef.current = new AbortController()
      const signal = abortRef.current.signal

      try {
        setError("")

        // 1 — Create or reuse run (single source of truth for runId)
        let runId: string
        if (resumeRunId) {
          runId = resumeRunId
          console.log(`[upload] resuming runId=${runId}`)
        } else {
          setStage("creating")
          const createRes = await fetch("/api/runs/create", { method: "POST" })
          if (!createRes.ok) {
            const body = await createRes.json().catch(() => ({}))
            throw new Error(body.error ?? "Failed to create run")
          }
          const data = await createRes.json()
          runId = data.runId
          console.log(`[upload] created runId=${runId}`)
        }

        // Pin runId in a ref so nothing can drift
        activeRunIdRef.current = runId

        // 2 — Build part plans
        const parts = buildPartPlans(file.size, runId)
        setTotalParts(parts.length)

        // Save pending state for resume
        savePending({
          runId,
          fileName: file.name,
          fileSize: file.size,
          lastModified: file.lastModified,
          totalParts: parts.length,
        })

        // 3 — Check which parts already exist (for resume)
        let completedKeys = new Map<string, number>()
        if (resumeRunId) {
          try {
            const statusRes = await fetch(
              `/api/runs/${runId}/upload-status`,
            )
            if (statusRes.ok) {
              const data = await statusRes.json()
              for (const p of data.parts ?? []) {
                completedKeys.set(p.key, p.sizeBytes)
              }
            }
          } catch {}
        }

        // 4 — Upload parts sequentially
        setStage("uploading")
        let completedBytes = 0

        for (const part of parts) {
          const existingSize = completedKeys.get(part.key)
          if (existingSize !== undefined && existingSize === part.size) {
            completedBytes += part.size
          }
        }
        setProgress(
          file.size > 0 ? Math.round((completedBytes / file.size) * 100) : 0,
        )

        for (const part of parts) {
          if (cancelledRef.current) throw new Error("Upload cancelled")

          const existingSize = completedKeys.get(part.key)
          if (existingSize !== undefined && existingSize === part.size) {
            setCurrentPart(part.index)
            continue
          }

          console.log(`[upload] part ${part.index}/${parts.length} runId=${runId} key=${part.key}`)

          setCurrentPart(part.index)

          const baseBytes = completedBytes
          const blob = file.slice(part.start, part.end)
          await uploadPartWithRetry(
            runId, part.key, "application/octet-stream", blob, signal,
            (partUploaded) => {
              const total = baseBytes + partUploaded
              setProgress(file.size > 0 ? Math.round((total / file.size) * 100) : 0)
            },
          )

          completedBytes += part.size
          setProgress(
            file.size > 0
              ? Math.round((completedBytes / file.size) * 100)
              : 100,
          )
        }

        if (cancelledRef.current) throw new Error("Upload cancelled")

        // 5 — Upload manifest
        setStage("manifest")
        console.log(`[upload] manifest runId=${runId} parts=${parts.length}`)
        const manifest = {
          version: 1,
          runId,
          originalFileName: file.name,
          originalSizeBytes: file.size,
          chunkSizeBytes: MAX_PART_BYTES,
          parts: parts.map((p) => ({
            index: p.index,
            key: p.key,
            sizeBytes: p.size,
          })),
        }
        const manifestKey = `runs/${runId}/upload/manifest.json`
        const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)])
        await uploadPartWithRetry(runId, manifestKey, "application/json", manifestBlob, signal)

        if (cancelledRef.current) throw new Error("Upload cancelled")

        // 6 — Defensive check: the runId we're about to trigger MUST
        //     match the one we uploaded parts under.
        if (activeRunIdRef.current !== runId) {
          throw new Error(
            `runId mismatch: upload used ${runId} but active ref is ${activeRunIdRef.current}. Aborting trigger.`,
          )
        }

        // 7 — Trigger worker
        setStage("triggering")
        console.log(`[upload] trigger runId=${runId}`)
        const triggerRes = await fetch("/api/runs/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ runId }),
        })
        if (!triggerRes.ok) {
          const body = await triggerRes.json().catch(() => ({}))
          throw new Error(body.error ?? "Failed to start processing")
        }

        // 8 — Done
        clearPending()
        setStage("done")
        setTimeout(() => router.push(`/dashboard/runs/${runId}`), 1200)
      } catch (err: any) {
        if (cancelledRef.current) {
          setStage("cancelled")
          setError("Upload cancelled. You can resume or start over.")
        } else {
          setStage("error")
          setError(err.message ?? "Something went wrong")
        }
      } finally {
        uploadLockRef.current = false
      }
    },
    [file, router],
  )

  const handleStartFresh = useCallback(() => {
    setShowResume(false)
    setPendingRunId(null)
    doUpload(null)
  }, [doUpload])

  const handleResume = useCallback(() => {
    setShowResume(false)
    doUpload(pendingRunId)
  }, [doUpload, pendingRunId])

  const handleStartOver = useCallback(async () => {
    if (pendingRunId) {
      try {
        await fetch(`/api/runs/${pendingRunId}/cleanup-parts`, {
          method: "DELETE",
        })
      } catch {}
    }
    clearPending()
    setShowResume(false)
    setPendingRunId(null)
    doUpload(null)
  }, [pendingRunId, doUpload])

  const handleRetry = useCallback(() => {
    const p = loadPending()
    if (p && file && p.fileName === file.name) {
      doUpload(p.runId)
    } else {
      doUpload(null)
    }
  }, [doUpload, file])

  const busy =
    stage === "creating" ||
    stage === "uploading" ||
    stage === "manifest" ||
    stage === "triggering"

  return (
    <div className="min-h-screen bg-muted/50">
      <NavBar />

      <div className="container max-w-2xl px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link href="/dashboard/runs">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Runs
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>New Run</CardTitle>
            <CardDescription>
              Upload a{" "}
              <code className="font-mono text-xs bg-muted px-1 rounded">
                run_YYYYMMDD_HHMM.zip
              </code>{" "}
              containing your raw scan data. Max {formatBytes(MAX_FILE_BYTES)}.
              Files over 50 MB are automatically uploaded in parts.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* ── dropzone ─────────────────────────────── */}
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
                  <p className="text-sm text-muted-foreground">
                    {formatBytes(file.size)}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">
                    {isDragActive ? "Drop it here" : "Drag & drop a .zip"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse
                  </p>
                </div>
              )}
            </div>

            {/* ── resume prompt ─────────────────────────── */}
            {showResume && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Found a previous upload for this file. Resume where you left
                  off?
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleResume}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Resume
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleStartOver}
                  >
                    Start Over
                  </Button>
                </div>
              </div>
            )}

            {/* ── progress ─────────────────────────────── */}
            {stage === "uploading" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading part {currentPart}/{totalParts}&hellip;
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {stage === "creating" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating
                run&hellip;
              </p>
            )}
            {stage === "manifest" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Writing
                manifest&hellip;
              </p>
            )}
            {stage === "triggering" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Starting
                pipeline&hellip;
              </p>
            )}
            {stage === "done" && (
              <p className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" /> Run queued &mdash;
                redirecting&hellip;
              </p>
            )}
            {stage === "cancelled" && (
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p>Upload cancelled. You can resume or start a new upload.</p>
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" onClick={handleRetry}>
                      <RotateCcw className="h-3 w-3 mr-1" /> Retry
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {error && stage === "error" && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg break-all">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p>{error}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={handleRetry}
                  >
                    <RotateCcw className="h-3 w-3 mr-1" /> Retry Failed Parts
                  </Button>
                </div>
              </div>
            )}

            {/* ── action buttons ───────────────────────── */}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                size="lg"
                disabled={!file || busy || showResume}
                onClick={handleStartFresh}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Working&hellip;
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload &amp; Process
                  </>
                )}
              </Button>
              {busy && (
                <Button size="lg" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
