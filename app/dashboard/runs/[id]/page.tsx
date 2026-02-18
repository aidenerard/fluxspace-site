import { createClient } from "@/lib/supabase"
import { redirect, notFound } from "next/navigation"
import RunDetailClient from "./RunDetailClient"

export default async function RunDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signin")

  // Quick ownership check via RLS
  const { data: run } = await supabase
    .from("runs")
    .select("id")
    .eq("id", params.id)
    .single()

  if (!run) notFound()

  return <RunDetailClient runId={params.id} />
}
