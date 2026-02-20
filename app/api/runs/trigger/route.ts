import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  /* ── auth ──────────────────────────────────────────────── */
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { runId } = (await request.json()) as { runId?: string }
  if (!runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 })
  }

  const admin = createAdminClient()

  /* ── ownership check (RLS on anon client) ──────────────── */
  const { data: run } = await supabase
    .from("runs")
    .select("id, status")
    .eq("id", runId)
    .single()

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }
  if (run.status !== "uploaded" && run.status !== "failed") {
    return NextResponse.json(
      { error: `Run is already ${run.status}` },
      { status: 409 },
    )
  }

  /* ── Mark ready for the worker background poller to pick up ── */
  const { error: updateErr } = await admin
    .from("runs")
    .update({
      status: "uploaded",
      stage: "ready_for_processing",
      progress: 90,
      error_message: null,
    })
    .eq("id", runId)

  if (updateErr) {
    console.error(`[trigger] DB update failed: ${updateErr.message}`)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  console.log(`[trigger] runId=${runId} marked ready_for_processing — worker poller will pick it up`)
  return NextResponse.json({ status: "queued", runId })
}
