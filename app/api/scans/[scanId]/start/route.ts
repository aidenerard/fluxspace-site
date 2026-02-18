import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8000"

export async function POST(
  request: Request,
  { params }: { params: { scanId: string } }
) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { scanId } = params

  // Verify user owns the scan
  const { data: scan } = await supabase
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .single()

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 })
  }

  if (scan.status !== "uploaded" && scan.status !== "failed") {
    return NextResponse.json(
      { error: `Scan is already ${scan.status}` },
      { status: 400 }
    )
  }

  // Update status to processing
  await supabase
    .from("scans")
    .update({ status: "processing", error: null })
    .eq("id", scanId)

  // Call backend worker to start pipeline
  try {
    const workerRes = await fetch(`${WORKER_URL}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        scan_id: scanId,
        user_id: user.id,
      }),
    })

    if (!workerRes.ok) {
      const errBody = await workerRes.text()
      // Revert status on failure to reach worker
      await supabase
        .from("scans")
        .update({ status: "failed", error: `Worker error: ${errBody}` })
        .eq("id", scanId)

      return NextResponse.json(
        { error: `Worker returned ${workerRes.status}: ${errBody}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ status: "processing", scan_id: scanId })
  } catch (err: any) {
    // Worker unreachable - revert status
    await supabase
      .from("scans")
      .update({
        status: "failed",
        error: `Could not reach worker: ${err.message}`,
      })
      .eq("id", scanId)

    return NextResponse.json(
      { error: `Could not reach worker: ${err.message}` },
      { status: 502 }
    )
  }
}
