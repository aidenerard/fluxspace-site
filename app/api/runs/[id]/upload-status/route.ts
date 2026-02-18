import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const runId = params.id
  const admin = createAdminClient()

  const { data: run } = await admin
    .from("runs")
    .select("user_id")
    .eq("id", runId)
    .single()

  if (!run || run.user_id !== user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  // List parts
  const partsDir = `runs/${runId}/upload/parts`
  const { data: partFiles, error: listErr } = await admin.storage
    .from("runs-raw")
    .list(partsDir, { limit: 1000, sortBy: { column: "name", order: "asc" } })

  const parts = (partFiles ?? [])
    .filter((f: { name: string }) => f.name.endsWith(".bin"))
    .map((f: { name: string; metadata?: { size?: number } }) => ({
      name: f.name,
      key: `${partsDir}/${f.name}`,
      sizeBytes: f.metadata?.size ?? 0,
    }))

  // Check manifest
  const manifestDir = `runs/${runId}/upload`
  const { data: manifestFiles } = await admin.storage
    .from("runs-raw")
    .list(manifestDir, { limit: 100 })

  const manifestExists =
    (manifestFiles ?? []).some(
      (f: { name: string }) => f.name === "manifest.json",
    )

  return NextResponse.json({
    runId,
    parts,
    manifestExists,
    error: listErr?.message ?? null,
  })
}
