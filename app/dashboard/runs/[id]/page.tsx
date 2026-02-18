"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowLeft, Download, Eye, Loader2, CheckCircle2,
  XCircle, Clock, RefreshCw,
} from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { RunRow, RunStatus } from "@/lib/supabase"

const statusMeta: Record<RunStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploaded:   { label: "Uploaded",   variant: "outline" },
  queued:     { label: "Queued",     variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  exporting:  { label: "Exporting",  variant: "secondary" },
  done:       { label: "Done",       variant: "default" },
  failed:     { label: "Failed",     variant: "destructive" },
}

interface FetchResult {
  run: RunRow
  assets: Record<string, string>
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<FetchResult | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const res = await fetch(`/api/runs/${id}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Poll while still in-progress
  useEffect(() => {
    if (!data) return
    const s = data.run.status
    if (s === "done" || s === "failed") return
    const t = setInterval(load, 4000)
    return () => clearInterval(t)
  }, [data, load])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <p className="text-muted-foreground">Run not found</p>
      </div>
    )
  }

  const { run, assets } = data
  const meta = statusMeta[run.status] ?? statusMeta.uploaded
  const inProgress = !["done", "failed", "uploaded"].includes(run.status)

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">FluxSpace</Link>
          <Link href="/account" className="text-sm font-medium">Account</Link>
        </div>
      </header>

      <div className="container max-w-4xl px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-6">
          <Link href="/dashboard/runs"><ArrowLeft className="h-4 w-4 mr-1" />Runs</Link>
        </Button>

        {/* header row */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold truncate">Run {run.id.slice(0, 8)}&hellip;</h1>
            <p className="text-sm text-muted-foreground">{formatDate(run.created_at)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {inProgress && (
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="h-4 w-4 mr-1" />Refresh
              </Button>
            )}
            <Badge variant={meta.variant} className="px-3 py-1 text-sm">
              {meta.label}
            </Badge>
          </div>
        </div>

        {/* progress */}
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
                    Auto-refreshes every 4 s
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
                  <p className="font-medium text-destructive mb-1">Processing failed</p>
                  <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-3 rounded overflow-x-auto">
                    {run.error_message}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* done: viewer link + screenshot */}
        {run.status === "done" && (
          <>
            <Card className="mb-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>3D Viewer</CardTitle>
                  <Button asChild>
                    <Link href={`/viewer/${run.id}`}>
                      <Eye className="h-4 w-4 mr-2" />Open Viewer
                    </Link>
                  </Button>
                </div>
                <CardDescription>
                  Interactive Three.js viewer with surface mesh and magnetic heatmap overlay
                </CardDescription>
              </CardHeader>
              {assets.screenshotPng && (
                <CardContent>
                  <div className="rounded-lg overflow-hidden border bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assets.screenshotPng} alt="Heatmap preview" className="w-full h-auto" />
                  </div>
                </CardContent>
              )}
            </Card>

            {/* downloads */}
            <Card>
              <CardHeader>
                <CardTitle>Downloads</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-2">
                  {assets.outputsZip && (
                    <DownloadLink href={assets.outputsZip} label="All Outputs (.zip)" />
                  )}
                  {assets.meshPly && (
                    <DownloadLink href={assets.meshPly} label="Mesh (.ply)" />
                  )}
                  {assets.trajectoryCsv && (
                    <DownloadLink href={assets.trajectoryCsv} label="Trajectory (.csv)" />
                  )}
                  {assets.magWorldCsv && (
                    <DownloadLink href={assets.magWorldCsv} label="Mag World (.csv)" />
                  )}
                  {assets.screenshotPng && (
                    <DownloadLink href={assets.screenshotPng} label="Heatmap (.png)" />
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* uploaded / waiting */}
        {run.status === "uploaded" && (
          <Card>
            <CardContent className="pt-6 text-center py-12 text-muted-foreground">
              <Clock className="h-10 w-10 mx-auto mb-3" />
              <p className="font-medium">Uploaded — waiting to be triggered</p>
            </CardContent>
          </Card>
        )}
      </div>
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
