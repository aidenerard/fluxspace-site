import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { project_id, name, filename, size_bytes } = await request.json()

    if (!project_id || !name || !filename) {
      return NextResponse.json(
        { error: "project_id, name, and filename are required" },
        { status: 400 }
      )
    }

    // Verify user owns the project
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", project_id)
      .eq("user_id", user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Create scan row
    const { data: scan, error: scanError } = await supabase
      .from("scans")
      .insert({
        user_id: user.id,
        project_id,
        name,
        status: "uploaded",
      })
      .select()
      .single()

    if (scanError) {
      return NextResponse.json({ error: scanError.message }, { status: 500 })
    }

    // The upload path in Storage: <user_id>/<scan_id>/upload.zip
    const upload_path = `${user.id}/${scan.id}/upload.zip`

    return NextResponse.json({
      scan_id: scan.id,
      upload_path,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
