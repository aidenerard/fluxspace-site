import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function DELETE(
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

  // List and delete parts
  const partsDir = `runs/${runId}/upload/parts`
  const { data: partFiles } = await admin.storage
    .from("runs-raw")
    .list(partsDir, { limit: 1000 })

  if (partFiles && partFiles.length > 0) {
    const paths = partFiles.map(
      (f: { name: string }) => `${partsDir}/${f.name}`,
    )
    await admin.storage.from("runs-raw").remove(paths)
  }

  // Delete manifest if present
  const manifestPath = `runs/${runId}/upload/manifest.json`
  await admin.storage.from("runs-raw").remove([manifestPath])

  return NextResponse.json({ ok: true })
}
