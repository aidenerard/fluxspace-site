import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const runId = crypto.randomUUID()
  const rawZipPath = `runs/${runId}/upload/manifest.json`
  const processedPrefix = `${runId}/`

  const { error: insertErr } = await admin.from("runs").insert({
    id: runId,
    user_id: user.id,
    status: "uploaded",
    stage: "created",
    progress: 0,
    raw_zip_path: rawZipPath,
    processed_prefix: processedPrefix,
  })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({ runId })
}
