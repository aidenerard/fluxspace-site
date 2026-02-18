"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowLeft,
  Download,
  Eye,
  Loader2,
  XCircle,
  Clock,
  FileText,
  RefreshCw,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { RunRow, RunStatus } from "@/lib/supabase"

const statusMeta: Record<
  RunStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  uploaded: { label: "Uploaded", variant: "outline" },
  queued: { label: "Queued", variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  exporting: { label: "Exporting", variant: "secondary" },
  done: { label: "Done", variant: "default" },
  failed: { label: "Failed", variant: "destructive" },
}

interface Viewer {
  manifestUrl: string | null
  surfaceUrl: string | null
  heatmapUrl: string | null
}

interface Downloads {
  logUrl: string | null
  exports: { name: string; url: string }[]
}

interface ApiResponse {
  run: RunRow
  viewer: Viewer
  downloads: Downloads
}

export default function RunDetailClient({ runId }: { runId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/runs/${runId}`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    load()
  }, [load])

  // Poll every 2 s while in-progress
  useEffect(() => {
    if (!data) return
    const s = data.run.status
    if (s === "done" || s === "failed") return
    const t = setInterval(load, 2000)
    return () => clearInterval(t)
  }, [data, load])

  /* ── loading / not found ───────────────────────────────── */
  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    )
  }
  if (!data) {
    return (
      <Shell>
        <p className="text-center py-24 text-muted-foreground">Run not found</p>
      </Shell>
    )
  }

  const { run, viewer, downloads } = data
  const meta = statusMeta[run.status] ?? statusMeta.uploaded
  const inProgress = ["queued", "processing", "exporting"].includes(run.status)

  return (
    <Shell>
      {/* nav */}
      <Button variant="ghost" size="sm" asChild className="mb-6">
        <Link href="/dashboard/runs">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Runs
        </Link>
      </Button>

      {/* header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">
            Run {run.id.slice(0, 8)}&hellip;
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(run.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {inProgress && (
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          )}
          <Badge variant={meta.variant} className="px-3 py-1 text-sm">
            {meta.label}
          </Badge>
        </div>
      </div>

      {/* progress bar */}
      {inProgress && (
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <p className="font-medium">
                  {run.stage ? `Stage: ${run.stage}` : "Starting\u2026"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Auto-refreshes every 2 s
                </p>
              </div>
              <span className="ml-auto text-sm tabular-nums font-medium">
                {run.progress}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${run.progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* error */}
      {run.status === "failed" && run.error_message && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium text-destructive mb-1">
                  Processing failed
                </p>
                <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded overflow-x-auto">
                  {run.error_message}
                </pre>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* done: viewer + downloads */}
      {run.status === "done" && (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>3D Viewer</CardTitle>
                <Button asChild>
                  <Link href={`/viewer/${run.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Open Viewer
                  </Link>
                </Button>
              </div>
              <CardDescription>
                Interactive Three.js viewer with surface mesh and magnetic
                heatmap overlay
              </CardDescription>
            </CardHeader>
          </Card>

          {/* downloads */}
          {(downloads.exports.length > 0 || downloads.logUrl) && (
            <Card>
              <CardHeader>
                <CardTitle>Downloads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-2">
                  {downloads.exports.map((exp) => (
                    <DownloadLink
                      key={exp.name}
                      href={exp.url}
                      label={exp.name}
                    />
                  ))}
                  {downloads.logUrl && (
                    <a
                      href={downloads.logUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 border rounded-lg px-4 py-3 text-sm hover:bg-muted/60 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">pipeline.log</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* uploaded / waiting */}
      {run.status === "uploaded" && (
        <Card>
          <CardContent className="pt-6 text-center py-12 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3" />
            <p className="font-medium">
              Uploaded — waiting to be triggered
            </p>
          </CardContent>
        </Card>
      )}
    </Shell>
  )
}

/* ── shared layout shell ─────────────────────────────────── */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">
            FluxSpace
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard/runs/new" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Upload</Link>
            <Link href="/dashboard/runs" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Runs</Link>
            <Link href="/account" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">Account</Link>
          </nav>
        </div>
      </header>
      <div className="container max-w-4xl px-4 py-8">{children}</div>
    </div>
  )
}

function DownloadLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 border rounded-lg px-4 py-3 text-sm hover:bg-muted/60 transition-colors"
    >
      <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="truncate">{label}</span>
    </a>
  )
}
