import { createClient } from "@/lib/supabase"
import { redirect, notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { ArrowLeft, Plus, Scan, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { formatDate } from "@/lib/utils"
import type { ScanStatus } from "@/lib/supabase"

const statusConfig: Record<ScanStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  uploaded: { label: "Uploaded", variant: "outline", icon: Clock },
  processing: { label: "Processing", variant: "secondary", icon: Loader2 },
  done: { label: "Complete", variant: "default", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { projectId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/signin")
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.projectId)
    .eq("user_id", user.id)
    .single()

  if (!project) {
    notFound()
  }

  const { data: scans } = await supabase
    .from("scans")
    .select("*")
    .eq("project_id", params.projectId)
    .order("created_at", { ascending: false })

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="border-b bg-background">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-bold">FluxSpace</Link>
          <Link href="/account" className="text-sm font-medium">Account</Link>
        </div>
      </header>

      <div className="container max-w-7xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Dashboard
            </Link>
          </Button>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground mt-1">
              Created {formatDate(project.created_at)}
            </p>
          </div>
          <Button asChild>
            <Link href={`/dashboard/projects/${params.projectId}/scans/new`}>
              <Plus className="h-4 w-4 mr-2" />
              New Scan
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scans</CardTitle>
            <CardDescription>
              Upload a run folder (.zip) to process with the FluxSpace pipeline
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scans && scans.length > 0 ? (
              <div className="space-y-3">
                {scans.map((scan: any) => {
                  const config = statusConfig[scan.status as ScanStatus] || statusConfig.uploaded
                  const StatusIcon = config.icon
                  return (
                    <Link
                      key={scan.id}
                      href={`/dashboard/projects/${params.projectId}/scans/${scan.id}`}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Scan className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{scan.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(scan.created_at)}
                          </div>
                        </div>
                      </div>
                      <Badge variant={config.variant} className="flex items-center gap-1">
                        <StatusIcon className={`h-3 w-3 ${scan.status === 'processing' ? 'animate-spin' : ''}`} />
                        {config.label}
                      </Badge>
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Scan className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">No scans yet</p>
                <Button asChild>
                  <Link href={`/dashboard/projects/${params.projectId}/scans/new`}>
                    Upload your first scan
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
