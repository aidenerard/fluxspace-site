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

  /* ── set queued ────────────────────────────────────────── */
  await admin
    .from("runs")
    .update({
      status: "queued",
      stage: "queued",
      progress: 0,
      error_message: null,
    })
    .eq("id", runId)

  /* ── call worker ───────────────────────────────────────── */
  const WORKER_URL = process.env.WORKER_URL
  const WORKER_SECRET = process.env.WORKER_SECRET
  if (!WORKER_URL || !WORKER_SECRET) {
    await admin
      .from("runs")
      .update({
        status: "failed",
        stage: "trigger_failed",
        error_message: "WORKER_URL or WORKER_SECRET not configured",
      })
      .eq("id", runId)
    return NextResponse.json(
      { error: "Worker not configured" },
      { status: 500 },
    )
  }

  try {
    const res = await fetch(`${WORKER_URL}/jobs/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({ runId }),
    })

    if (!res.ok) {
      const body = await res.text()
      await admin
        .from("runs")
        .update({
          status: "failed",
          stage: "trigger_failed",
          error_message: `Worker responded ${res.status}: ${body}`,
        })
        .eq("id", runId)
      return NextResponse.json({ error: body }, { status: 502 })
    }

    return NextResponse.json({ status: "queued", runId })
  } catch (err: any) {
    await admin
      .from("runs")
      .update({
        status: "failed",
        stage: "trigger_failed",
        error_message: `Worker unreachable: ${err.message}`,
      })
      .eq("id", runId)
    return NextResponse.json(
      { error: `Worker unreachable: ${err.message}` },
      { status: 502 },
    )
  }
}
