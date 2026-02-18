import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: run, error } = await supabase
    .from("runs")
    .select("*")
    .eq("id", params.id)
    .single()

  if (error || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  // Build signed URLs for key assets when the run is done
  const assets: Record<string, string> = {}

  if (run.status === "done") {
    const prefix = run.processed_prefix as string // e.g. "{userId}/{runId}/"

    const assetPaths: Record<string, string> = {
      manifest: `${prefix}viewer/manifest.json`,
      scene: `${prefix}viewer/scene.glb`,
      heatmap: `${prefix}viewer/heatmap.glb`,
      outputsZip: `${prefix}exports/outputs.zip`,
      screenshotPng: `${prefix}exports/heatmap.png`,
      trajectoryCsv: `${prefix}exports/trajectory.csv`,
      magWorldCsv: `${prefix}exports/mag_world.csv`,
      meshPly: `${prefix}exports/open3d_mesh.ply`,
    }

    const signPromises = Object.entries(assetPaths).map(
      async ([key, path]) => {
        const { data } = await supabase.storage
          .from("runs-processed")
          .createSignedUrl(path, 3600)
        if (data?.signedUrl) {
          assets[key] = data.signedUrl
        }
      },
    )
    await Promise.all(signPromises)
  }

  return NextResponse.json({ run, assets })
}
