import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

const SIGNED_TTL = 600 // 10 minutes

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  /* ── auth (anon client — respects RLS so user can only see own rows) ── */
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  /* ── load run via service role for reliable reads ──────── */
  const admin = createAdminClient()
  const { data: run, error } = await admin
    .from("runs")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  // Verify ownership (run.user_id must match authed user)
  if (run.user_id !== user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  /* ── build signed viewer URLs (only when done) ─────────── */
  const viewer: { manifestUrl: string | null; surfaceUrl: string | null; heatmapUrl: string | null } = {
    manifestUrl: null,
    surfaceUrl: null,
    heatmapUrl: null,
  }

  const downloads: { logUrl: string | null; exports: { name: string; url: string }[] } = {
    logUrl: null,
    exports: [],
  }

  if (run.status === "done") {
    const prefix = run.processed_prefix as string // "{runId}/"

    // Check which viewer files actually exist before signing
    const viewerDir = `${prefix}viewer`
    const { data: viewerFiles } = await admin.storage
      .from("runs-processed")
      .list(viewerDir)

    if (viewerFiles) {
      const names = new Set(viewerFiles.map((f: any) => f.name))

      if (names.has("manifest.json")) {
        const { data } = await admin.storage
          .from("runs-processed")
          .createSignedUrl(`${viewerDir}/manifest.json`, SIGNED_TTL)
        viewer.manifestUrl = data?.signedUrl ?? null
      }
      if (names.has("scene.glb")) {
        const { data } = await admin.storage
          .from("runs-processed")
          .createSignedUrl(`${viewerDir}/scene.glb`, SIGNED_TTL)
        viewer.surfaceUrl = data?.signedUrl ?? null
      }
      if (names.has("heatmap.glb")) {
        const { data } = await admin.storage
          .from("runs-processed")
          .createSignedUrl(`${viewerDir}/heatmap.glb`, SIGNED_TTL)
        viewer.heatmapUrl = data?.signedUrl ?? null
      }
    }

    // Exports directory
    const exportsDir = `${prefix}exports`
    const { data: exportFiles } = await admin.storage
      .from("runs-processed")
      .list(exportsDir, { limit: 50 })

    if (exportFiles) {
      const signedExports = await Promise.all(
        exportFiles.map(async (f: any) => {
          const { data } = await admin.storage
            .from("runs-processed")
            .createSignedUrl(`${exportsDir}/${f.name}`, SIGNED_TTL)
          return data?.signedUrl
            ? { name: f.name as string, url: data.signedUrl }
            : null
        }),
      )
      downloads.exports = signedExports.filter(
        (e): e is { name: string; url: string } => e !== null,
      )
    }

    // Log file
    const logDir = `${run.id}`
    const { data: logFiles } = await admin.storage
      .from("runs-logs")
      .list(logDir)

    if (logFiles) {
      const logFile = logFiles.find((f: any) => f.name === "pipeline.log")
      if (logFile) {
        const { data } = await admin.storage
          .from("runs-logs")
          .createSignedUrl(`${logDir}/pipeline.log`, SIGNED_TTL)
        downloads.logUrl = data?.signedUrl ?? null
      }
    }
  }

  return NextResponse.json({ run, viewer, downloads })
}
