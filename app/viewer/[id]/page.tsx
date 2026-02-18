import { createClient } from "@/lib/supabase"
import { redirect, notFound } from "next/navigation"
import { NavBar } from "@/components/navbar"
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

  const { data: run } = await supabase
    .from("runs")
    .select("id")
    .eq("id", params.id)
    .single()

  if (!run) notFound()

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <ViewerClient runId={params.id} />
    </div>
  )
}
