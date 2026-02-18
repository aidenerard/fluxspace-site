import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST() {
  /* ── auth ──────────────────────────────────────────────── */
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminClient()
  const runId = crypto.randomUUID()
  const rawZipPath = `${runId}/input.zip`
  const processedPrefix = `${runId}/`

  /* ── insert row ────────────────────────────────────────── */
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

  /* ── signed upload URL ─────────────────────────────────── */
  const { data: signed, error: signErr } = await admin.storage
    .from("runs-raw")
    .createSignedUploadUrl(rawZipPath)

  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "Failed to create upload URL" },
      { status: 500 },
    )
  }

  return NextResponse.json({
    runId,
    uploadUrl: signed.signedUrl,
    rawZipPath,
  })
}
