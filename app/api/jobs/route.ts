import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const supabase = createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { project_id, upload_id, params } = await request.json()

  // Check usage limits
  const currentMonth = new Date().toISOString().slice(0, 7)
  const { data: usage } = await supabase
    .from("usage_counters")
    .select("*")
    .eq("user_id", user.id)
    .eq("month", currentMonth)
    .single()

  // Basic limit check (extend with plan-specific limits)
  if (usage && usage.jobs_used >= 3) {
    return NextResponse.json(
      { error: "Monthly job limit reached. Please upgrade your plan." },
      { status: 429 }
    )
  }

  // Create job
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      project_id,
      upload_id,
      status: "queued",
      params: params || {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Update usage counter
  if (usage) {
    await supabase
      .from("usage_counters")
      .update({ jobs_used: usage.jobs_used + 1 })
      .eq("user_id", user.id)
      .eq("month", currentMonth)
  } else {
    await supabase
      .from("usage_counters")
      .insert({
        user_id: user.id,
        month: currentMonth,
        jobs_used: 1,
        storage_used_bytes: 0,
      })
  }

  // In production, trigger processing job here (queue system, serverless function, etc.)
  // For now, return the created job
  return NextResponse.json(data)
}
