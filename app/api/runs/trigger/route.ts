import { createClient, createServiceClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const WORKER_URL = process.env.WORKER_URL!
const WORKER_SECRET = process.env.WORKER_SECRET!

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { runId } = (await request.json()) as { runId: string }
  if (!runId) {
    return NextResponse.json({ error: "runId is required" }, { status: 400 })
  }

  // Verify the user owns this run
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

  // Set status to queued (service role to bypass RLS update restriction)
  const service = createServiceClient()
  await service
    .from("runs")
    .update({ status: "queued", stage: null, progress: 0, error_message: null })
    .eq("id", runId)

  // Call the external worker
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
      await service
        .from("runs")
        .update({ status: "failed", error_message: `Worker ${res.status}: ${body}` })
        .eq("id", runId)
      return NextResponse.json({ error: body }, { status: 502 })
    }

    return NextResponse.json({ status: "queued", runId })
  } catch (err: any) {
    await service
      .from("runs")
      .update({ status: "failed", error_message: `Worker unreachable: ${err.message}` })
      .eq("id", runId)
    return NextResponse.json(
      { error: `Worker unreachable: ${err.message}` },
      { status: 502 },
    )
  }
}
