import { createClient } from "@/lib/supabase"
import { redirect } from "next/navigation"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Plus, ArrowLeft } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { RunStatus } from "@/lib/supabase"
import { NavBar } from "@/components/navbar"

const statusBadge: Record<RunStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploaded:   { label: "Uploaded",   variant: "outline" },
  queued:     { label: "Queued",     variant: "outline" },
  processing: { label: "Processing", variant: "secondary" },
  exporting:  { label: "Exporting",  variant: "secondary" },
  done:       { label: "Done",       variant: "default" },
  failed:     { label: "Failed",     variant: "destructive" },
}

export default async function RunsListPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/signin")

  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-muted/50">
      <NavBar />

      <div className="container max-w-5xl px-4 py-8">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" />Dashboard</Link>
        </Button>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Runs</h1>
          <Button asChild>
            <Link href="/dashboard/runs/new">
              <Plus className="h-4 w-4 mr-2" />New Run
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Runs</CardTitle>
            <CardDescription>Upload a zip to start a new pipeline run</CardDescription>
          </CardHeader>
          <CardContent>
            {runs && runs.length > 0 ? (
              <div className="divide-y">
                {runs.map((r: any) => {
                  const badge = statusBadge[r.status as RunStatus] ?? statusBadge.uploaded
                  return (
                    <Link
                      key={r.id}
                      href={`/dashboard/runs/${r.id}`}
                      className="flex items-center justify-between py-3 px-2 -mx-2 rounded hover:bg-muted/60 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {(r.status === "processing" || r.status === "exporting") && (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {r.progress}%
                          </span>
                        )}
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="mb-4">No runs yet</p>
                <Button asChild><Link href="/dashboard/runs/new">Create your first run</Link></Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
