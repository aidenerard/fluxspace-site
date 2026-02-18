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

  const { data: run } = await supabase
    .from("runs")
    .select("id, status, processed_prefix")
    .eq("id", params.id)
    .single()

  if (!run || run.status !== "done") notFound()

  const prefix = run.processed_prefix as string

  // Signed URLs valid for 1 hour
  const [manifestRes, sceneRes, heatmapRes] = await Promise.all([
    supabase.storage.from("runs-processed").createSignedUrl(`${prefix}viewer/manifest.json`, 3600),
    supabase.storage.from("runs-processed").createSignedUrl(`${prefix}viewer/scene.glb`, 3600),
    supabase.storage.from("runs-processed").createSignedUrl(`${prefix}viewer/heatmap.glb`, 3600),
  ])

  const manifestUrl = manifestRes.data?.signedUrl ?? null
  const sceneUrl = sceneRes.data?.signedUrl ?? null
  const heatmapUrl = heatmapRes.data?.signedUrl ?? null

  if (!sceneUrl) notFound()

  return (
    <ViewerClient
      runId={run.id}
      manifestUrl={manifestUrl}
      sceneUrl={sceneUrl}
      heatmapUrl={heatmapUrl}
    />
  )
}
