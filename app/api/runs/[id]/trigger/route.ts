import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const runId = params.id

  /* ── auth ──────────────────────────────────────────────── */
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  /* ── ownership check via RLS (anon client) ─────────────── */
  const { data: run } = await supabase
    .from("runs")
    .select("id, status, stage")
    .eq("id", runId)
    .single()

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  if (["processing", "exporting", "done"].includes(run.status)) {
    return NextResponse.json(
      { error: `Run is already ${run.status}` },
      { status: 409 },
    )
  }

  /* ── transition to ready_for_processing ────────────────── */
  const admin = createAdminClient()
  const { error: updateErr } = await admin
    .from("runs")
    .update({
      status: "queued",
      stage: "ready_for_processing",
      progress: 90,
      error_message: null,
    })
    .eq("id", runId)

  if (updateErr) {
    console.error(`[trigger/${runId}] DB update failed: ${updateErr.message}`)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  console.log(
    `[trigger/${runId}] marked ready_for_processing (was status=${run.status} stage=${run.stage})`,
  )
  return NextResponse.json({ ok: true, runId })
}
