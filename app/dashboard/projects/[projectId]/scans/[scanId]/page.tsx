"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import NextImage from "next/image"
import { createBrowserSupabaseClient } from "@/lib/supabase-client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
  ArrowLeft, Download, CheckCircle2, XCircle,
  Loader2, Clock, FileBox, Image, FileText, Package,
  RefreshCw
} from "lucide-react"
import { formatDate, formatBytes } from "@/lib/utils"
import type { ScanStatus, ArtifactKind } from "@/lib/supabase"

const statusConfig: Record<ScanStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  uploaded: { label: "Uploaded", variant: "outline", icon: Clock },
  processing: { label: "Processing", variant: "secondary", icon: Loader2 },
  done: { label: "Complete", variant: "default", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
}

const artifactLabels: Record<ArtifactKind, { label: string; icon: typeof FileBox }> = {
  mesh_ply: { label: "3D Mesh (.ply)", icon: FileBox },
  trajectory_csv: { label: "Trajectory (.csv)", icon: FileText },
  mag_world_csv: { label: "Mag World Coords (.csv)", icon: FileText },
  volume_npz: { label: "Voxel Volume (.npz)", icon: Package },
  screenshot_png: { label: "Heatmap Screenshot (.png)", icon: Image },
  outputs_zip: { label: "All Outputs (.zip)", icon: Package },
  extrinsics_json: { label: "Extrinsics (.json)", icon: FileText },
}

interface Scan {
  id: string
  name: string
  status: ScanStatus
  error: string | null
  created_at: string
  updated_at: string
}

interface Artifact {
  id: string
  kind: ArtifactKind
  storage_path: string
  size_bytes: number | null
  created_at: string
}

export default function ScanDetailPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const scanId = params.scanId as string

  const [scan, setScan] = useState<Scan | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)

  const supabase = createBrowserSupabaseClient()

  const fetchData = useCallback(async () => {
    const { data: scanData } = await supabase
      .from("scans")
      .select("*")
      .eq("id", scanId)
      .single()

    if (scanData) {
      setScan(scanData as Scan)
    }

    const { data: artifactData } = await supabase
      .from("scan_artifacts")
      .select("*")
      .eq("scan_id", scanId)
      .order("created_at", { ascending: true })

    if (artifactData) {
      setArtifacts(artifactData as Artifact[])

      // Get signed URL for screenshot preview
      const screenshot = artifactData.find((a: any) => a.kind === "screenshot_png")
      if (screenshot) {
        const { data } = await supabase.storage
          .from("runs-outputs")
          .createSignedUrl((screenshot as any).storage_path, 3600)
        if (data?.signedUrl) {
          setScreenshotUrl(data.signedUrl)
        }
      }
    }

    setLoading(false)
  }, [scanId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Poll for updates while processing
  useEffect(() => {
    if (!scan || scan.status !== "processing") return

    const interval = setInterval(() => {
      fetchData()
    }, 5000)

    return () => clearInterval(interval)
  }, [scan, fetchData])

  const handleDownload = async (artifact: Artifact) => {
    const { data } = await supabase.storage
      .from("runs-outputs")
      .createSignedUrl(artifact.storage_path, 3600)

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!scan) {
    return (
      <div className="min-h-screen bg-muted/50 flex items-center justify-center">
        <p className="text-muted-foreground">Scan not found</p>
      </div>
    )
  }

  const config = statusConfig[scan.status] || statusConfig.uploaded
  const StatusIcon = config.icon

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">FluxSpace</Link>
          <Link href="/account" className="text-sm font-medium">Account</Link>
        </div>
      </header>

      <div className="container max-w-4xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Project
            </Link>
          </Button>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{scan.name}</h1>
            <p className="text-muted-foreground mt-1">
              Created {formatDate(scan.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {scan.status === "processing" && (
              <Button variant="outline" size="sm" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            )}
            <Badge variant={config.variant} className="flex items-center gap-1 text-sm px-3 py-1">
              <StatusIcon className={`h-4 w-4 ${scan.status === "processing" ? "animate-spin" : ""}`} />
              {config.label}
            </Badge>
          </div>
        </div>

        {/* Processing status */}
        {scan.status === "processing" && (
          <Card className="mb-6 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <div>
                  <p className="font-medium">Pipeline is running...</p>
                  <p className="text-sm text-muted-foreground">
                    This typically takes 2-10 minutes depending on the size of your dataset.
                    This page auto-refreshes every 5 seconds.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {scan.status === "failed" && scan.error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Processing failed</p>
                  <pre className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap font-mono bg-muted p-3 rounded">
                    {scan.error}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Heatmap preview */}
        {screenshotUrl && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>3D Heatmap Preview</CardTitle>
              <CardDescription>
                Magnetic field anomaly overlaid on the reconstructed mesh
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg overflow-hidden border bg-black">
                <NextImage
                  src={screenshotUrl}
                  alt="3D heatmap visualization"
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="w-full h-auto"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Artifacts */}
        {artifacts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Output Artifacts</CardTitle>
              <CardDescription>
                Download individual files or the full output package
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {artifacts.map((artifact) => {
                  const meta = artifactLabels[artifact.kind] || {
                    label: artifact.kind,
                    icon: FileText,
                  }
                  const ArtifactIcon = meta.icon
                  return (
                    <div
                      key={artifact.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <ArtifactIcon className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{meta.label}</div>
                          {artifact.size_bytes && (
                            <div className="text-xs text-muted-foreground">
                              {formatBytes(artifact.size_bytes)}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(artifact)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state for uploaded/no artifacts */}
        {scan.status === "uploaded" && artifacts.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="font-medium">Waiting to process</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Your scan has been uploaded and is queued for processing.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
