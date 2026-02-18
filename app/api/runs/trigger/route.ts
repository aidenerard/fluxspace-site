import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

/**
 * Normalize WORKER_URL so that `http://localhost:…` becomes
 * `http://127.0.0.1:…`. On many machines (especially macOS)
 * localhost resolves to IPv6 ::1 while Docker only publishes
 * on 127.0.0.1, causing "fetch failed" from the Next.js server.
 */
function resolveWorkerUrl(raw: string): string {
  try {
    const u = new URL(raw)
    if (u.hostname === "localhost") {
      u.hostname = "127.0.0.1"
    }
    return u.toString().replace(/\/$/, "")
  } catch {
    return raw.replace(/\/$/, "")
  }
}

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

  /* ── resolve worker URL ────────────────────────────────── */
  const rawWorkerUrl = process.env.WORKER_URL
  const WORKER_SECRET = process.env.WORKER_SECRET
  if (!rawWorkerUrl || !WORKER_SECRET) {
    const msg = "WORKER_URL or WORKER_SECRET not configured"
    console.error(`[trigger] ${msg}`)
    await admin
      .from("runs")
      .update({ status: "failed", stage: "trigger_failed", error_message: msg })
      .eq("id", runId)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const workerUrl = resolveWorkerUrl(rawWorkerUrl)
  console.log(`[trigger] runId=${runId} workerUrl=${workerUrl}`)

  /* ── health check ──────────────────────────────────────── */
  try {
    const healthRes = await fetch(`${workerUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    })
    console.log(`[trigger] worker /health → ${healthRes.status}`)
  } catch (healthErr: any) {
    const msg =
      `Worker health check failed (${workerUrl}/health): ${healthErr.message}. ` +
      `Is the worker running? If using Docker, ensure it publishes on 127.0.0.1, not just ::1.`
    console.error(`[trigger] ${msg}`)
    await admin
      .from("runs")
      .update({ status: "failed", stage: "trigger_failed", error_message: msg })
      .eq("id", runId)
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  /* ── call worker ───────────────────────────────────────── */
  try {
    const res = await fetch(`${workerUrl}/jobs/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WORKER_SECRET}`,
      },
      body: JSON.stringify({ runId }),
    })

    if (!res.ok) {
      const body = await res.text()
      const msg = `Worker responded ${res.status}: ${body}`
      console.error(`[trigger] ${msg}`)
      await admin
        .from("runs")
        .update({ status: "failed", stage: "trigger_failed", error_message: msg })
        .eq("id", runId)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    console.log(`[trigger] runId=${runId} queued successfully`)
    return NextResponse.json({ status: "queued", runId })
  } catch (err: any) {
    const msg = `Worker unreachable at ${workerUrl}/jobs/run: ${err.message}`
    console.error(`[trigger] ${msg}`)
    await admin
      .from("runs")
      .update({ status: "failed", stage: "trigger_failed", error_message: msg })
      .eq("id", runId)
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
