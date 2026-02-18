import { createClient } from "@/lib/supabase"
import { redirect, notFound } from "next/navigation"
import ViewerClient from "./ViewerClient"

export default async function ViewerPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/signin")

  // RLS check — user can only see their own runs
  const { data: run } = await supabase
    .from("runs")
    .select("id")
    .eq("id", params.id)
    .single()

  if (!run) notFound()

  return <ViewerClient runId={params.id} />
}
