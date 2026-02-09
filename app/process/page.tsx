"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, FileText, Settings, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { createBrowserSupabaseClient } from "@/lib/supabase-client"
import { useRouter } from "next/navigation"

export default function ProcessPage() {
  const [file, setFile] = useState<File | null>(null)
  const [projectId, setProjectId] = useState<string>("")
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "failed">("idle")
  
  // Configuration parameters
  const [radius, setRadius] = useState("0.10")
  const [gridStep, setGridStep] = useState("0.01")
  const [valueCol, setValueCol] = useState<"local_anomaly" | "local_anomaly_norm" | "local_anomaly_abs">("local_anomaly_norm")
  const [dropOutliers, setDropOutliers] = useState(false)
  const [dropFlagAny, setDropFlagAny] = useState(false)
  const [plot, setPlot] = useState(true)

  const { toast } = useToast()
  const router = useRouter()

  // Load projects on mount
  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadProjects = async () => {
    try {
      const supabase = createBrowserSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        router.push("/signin")
        return
      }

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        toast({
          title: "Error",
          description: "Failed to load projects",
          variant: "destructive",
        })
      } else {
        setProjects(data || [])
        if (data && data.length > 0) {
          setProjectId(data[0].id)
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load projects",
        variant: "destructive",
      })
    }
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0]
      if (selectedFile.name.endsWith(".csv")) {
        setFile(selectedFile)
        toast({
          title: "File selected",
          description: selectedFile.name,
        })
      } else {
        toast({
          title: "Invalid file",
          description: "Please upload a CSV file",
          variant: "destructive",
        })
      }
    }
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  })

  const handleProcess = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to process",
        variant: "destructive",
      })
      return
    }

    if (!projectId) {
      toast({
        title: "No project selected",
        description: "Please select a project",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setStatus("processing")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("project_id", projectId)
      formData.append("radius", radius)
      formData.append("grid_step", gridStep)
      formData.append("value_col", valueCol)
      formData.append("drop_outliers", dropOutliers.toString())
      formData.append("drop_flag_any", dropFlagAny.toString())
      formData.append("plot", plot.toString())

      const response = await fetch("/api/process", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Processing failed")
      }

      setJobId(data.job_id)
      toast({
        title: "Processing started",
        description: "Your file is being processed. This may take a few minutes.",
      })

      // Poll for status updates
      pollJobStatus(data.job_id)
    } catch (error: any) {
      setStatus("failed")
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
      setLoading(false)
    }
  }

  const pollJobStatus = async (id: string) => {
    const supabase = createBrowserSupabaseClient()
    const maxAttempts = 120 // 10 minutes max (5 second intervals)
    let attempts = 0

    const interval = setInterval(async () => {
      attempts++
      
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single()

      if (error || !data) {
        clearInterval(interval)
        setStatus("failed")
        setLoading(false)
        return
      }

      if (data.status === "done") {
        clearInterval(interval)
        setStatus("done")
        setLoading(false)
        toast({
          title: "Processing complete",
          description: "Your data has been processed successfully!",
        })
      } else if (data.status === "failed") {
        clearInterval(interval)
        setStatus("failed")
        setLoading(false)
        toast({
          title: "Processing failed",
          description: data.logs || "An error occurred during processing",
          variant: "destructive",
        })
      } else if (attempts >= maxAttempts) {
        clearInterval(interval)
        setStatus("failed")
        setLoading(false)
        toast({
          title: "Timeout",
          description: "Processing took too long. Please try again.",
          variant: "destructive",
        })
      }
    }, 5000) // Poll every 5 seconds
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-12">
        <div className="container max-w-4xl px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Process Magnetic Data</h1>
            <p className="text-muted-foreground">
              Upload your mag_data.csv file and configure processing parameters
            </p>
          </div>

          <div className="space-y-6">
            {/* File Upload */}
            <Card>
              <CardHeader>
                <CardTitle>Upload CSV File</CardTitle>
                <CardDescription>
                  Select your mag_data.csv file to process through the pipeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {file ? (
                    <div>
                      <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="font-medium">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-lg font-medium mb-2">
                        {isDragActive ? "Drop the file here" : "Drag & drop your CSV file here"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Project</CardTitle>
                <CardDescription>Select the project for this processing job</CardDescription>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      No projects found. Please create a project first.
                    </p>
                    <Button variant="outline" onClick={() => router.push("/dashboard")}>
                      Go to Dashboard
                    </Button>
                  </div>
                ) : (
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>

            {/* Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  <CardTitle>Processing Configuration</CardTitle>
                </div>
                <CardDescription>
                  Configure the pipeline parameters for your data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="radius">Anomaly Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      step="0.01"
                      value={radius}
                      onChange={(e) => setRadius(e.target.value)}
                      placeholder="0.10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Neighborhood radius for anomaly computation (default: 0.10m)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="grid-step">Grid Step (meters)</Label>
                    <Input
                      id="grid-step"
                      type="number"
                      step="0.01"
                      value={gridStep}
                      onChange={(e) => setGridStep(e.target.value)}
                      placeholder="0.01"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Grid spacing for heatmap interpolation (default: 0.01m)
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="value-col">Value Column</Label>
                  <Select value={valueCol} onValueChange={(v) => setValueCol(v as typeof valueCol)}>
                    <SelectTrigger id="value-col">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local_anomaly_norm">local_anomaly_norm (Normalized, 0-1)</SelectItem>
                      <SelectItem value="local_anomaly">local_anomaly (Raw anomaly)</SelectItem>
                      <SelectItem value="local_anomaly_abs">local_anomaly_abs (Absolute value)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Column to use for heatmap visualization
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="drop-outliers"
                      checked={dropOutliers}
                      onChange={(e) => setDropOutliers(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="drop-outliers" className="cursor-pointer">
                      Drop outliers during validation
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="drop-flag-any"
                      checked={dropFlagAny}
                      onChange={(e) => setDropFlagAny(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="drop-flag-any" className="cursor-pointer">
                      Drop flagged points (outliers or spikes)
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="plot"
                      checked={plot}
                      onChange={(e) => setPlot(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="plot" className="cursor-pointer">
                      Generate diagnostic plots
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            {status !== "idle" && (
              <Card>
                <CardHeader>
                  <CardTitle>Processing Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {status === "processing" && (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        <div>
                          <p className="font-medium">Processing...</p>
                          <p className="text-sm text-muted-foreground">
                            This may take a few minutes. Please don&apos;t close this page.
                          </p>
                        </div>
                      </>
                    )}
                    {status === "done" && (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <div>
                          <p className="font-medium text-green-500">Processing Complete!</p>
                          {jobId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => router.push(`/dashboard/jobs/${jobId}`)}
                            >
                              View Results
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                    {status === "failed" && (
                      <>
                        <XCircle className="h-5 w-5 text-red-500" />
                        <div>
                          <p className="font-medium text-red-500">Processing Failed</p>
                          <p className="text-sm text-muted-foreground">
                            Please check your file format and try again.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Process Button */}
            <Button
              onClick={handleProcess}
              disabled={!file || !projectId || loading || projects.length === 0}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Start Processing
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
