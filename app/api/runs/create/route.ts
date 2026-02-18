import { createClient, createServiceClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const runId = crypto.randomUUID()
  const rawZipPath = `${user.id}/${runId}/input.zip`
  const processedPrefix = `${user.id}/${runId}/`

  // Insert run row (uses anon key – RLS allows insert for own user_id)
  const { error: insertErr } = await supabase.from("runs").insert({
    id: runId,
    user_id: user.id,
    status: "uploaded",
    raw_zip_path: rawZipPath,
    processed_prefix: processedPrefix,
  })

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  // Generate a signed upload URL (requires service role for createSignedUploadUrl)
  const service = createServiceClient()
  const { data: signed, error: signErr } = await service.storage
    .from("runs-raw")
    .createSignedUploadUrl(rawZipPath)

  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "Failed to create signed URL" },
      { status: 500 },
    )
  }

  return NextResponse.json({
    runId,
    uploadUrl: signed.signedUrl,
    rawZipPath,
  })
}
