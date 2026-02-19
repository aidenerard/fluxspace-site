import { createClient } from "@/lib/supabase"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse, type NextRequest } from "next/server"

const SIGN_TTL = 600 // 10 minutes

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { objectPath, contentType } = (await request.json()) as {
    objectPath?: string
    contentType?: string
  }
  if (!objectPath || !contentType) {
    return NextResponse.json(
      { error: "objectPath and contentType are required" },
      { status: 400 },
    )
  }

  const runId = params.id
  const allowedPrefix = `runs/${runId}/upload/`
  if (!objectPath.startsWith(allowedPrefix)) {
    return NextResponse.json(
      { error: "objectPath must be under the run upload prefix" },
      { status: 403 },
    )
  }

  const admin = createAdminClient()

  const { data: run } = await admin
    .from("runs")
    .select("user_id")
    .eq("id", runId)
    .single()

  if (!run || run.user_id !== user.id) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  console.log(`[sign-upload] runId=${runId} objectPath=${objectPath}`)

  const signEndpointUrl = `${supabaseUrl}/storage/v1/object/upload/sign/runs-raw/${objectPath}`

  const signRes = await fetch(signEndpointUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: SIGN_TTL }),
  })

  if (!signRes.ok) {
    const body = await signRes.text()
    return NextResponse.json(
      { error: `Failed to sign upload URL: ${body}` },
      { status: signRes.status },
    )
  }

  // Supabase returns a path relative to the storage service root,
  // e.g. "/object/upload/sign/runs-raw/...?token=eyJ..."
  // We must prepend the project URL + /storage/v1 to make it a full URL.
  const { url: signedPath } = await signRes.json()
  const signedUrl = `${supabaseUrl}/storage/v1${signedPath}`

  return NextResponse.json({ signedUrl })
}
