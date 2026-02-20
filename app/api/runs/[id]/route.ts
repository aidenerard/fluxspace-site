import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

const SIGNED_TTL = 3600 // 60 minutes

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
    // Viewer assets live in runs-viewer at deterministic paths derived from runId.
    // Convention: runs/<runId>/surface.glb, heatmap.png, viewer_manifest.json
    const VIEWER_BUCKET = "runs-viewer"
    const runId = params.id

    const surfacePath = `runs/${runId}/surface.glb`
    const heatmapPath = `runs/${runId}/heatmap.png`
    const manifestPath = `runs/${runId}/viewer_manifest.json`

    // createSignedUrl returns { data: { signedUrl } | null, error }
    // If the object doesn't exist the signed URL is still generated (it will 404
    // when fetched). To avoid that we could list first, but for speed we just sign
    // and let the viewer handle a 404 gracefully.
    const [surfaceRes, heatmapRes, manifestRes] = await Promise.all([
      admin.storage.from(VIEWER_BUCKET).createSignedUrl(surfacePath, SIGNED_TTL),
      admin.storage.from(VIEWER_BUCKET).createSignedUrl(heatmapPath, SIGNED_TTL),
      admin.storage.from(VIEWER_BUCKET).createSignedUrl(manifestPath, SIGNED_TTL),
    ])

    viewer.surfaceUrl = surfaceRes.data?.signedUrl ?? null
    viewer.heatmapUrl = heatmapRes.data?.signedUrl ?? null
    viewer.manifestUrl = manifestRes.data?.signedUrl ?? null

    // --- Log file (best-effort) ---
    const { data: logFiles } = await admin.storage
      .from("runs-logs")
      .list(runId)
    if (logFiles) {
      const logFile = logFiles.find((f: any) => f.name === "pipeline.log")
      if (logFile) {
        const { data } = await admin.storage
          .from("runs-logs")
          .createSignedUrl(`${runId}/pipeline.log`, SIGNED_TTL)
        downloads.logUrl = data?.signedUrl ?? null
      }
    }
  }

  return NextResponse.json({ run, viewer, downloads })
}
