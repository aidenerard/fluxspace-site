import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Upload, Cpu, Eye, Download } from "lucide-react"
import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container max-w-6xl">
          <div className="flex flex-col items-center text-center space-y-8">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Capture, process, and visualize in 3D
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
              Upload a run from your FluxSpace capture rig (Pi + OAK-D RGBD + optional magnetometer), process it in the cloud, and explore the results in an interactive 3D viewer &mdash; no installs required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild>
                <Link href="/dashboard/runs/new">
                  Upload a Run
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/dashboard/runs">View Runs</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-muted/50">
        <div className="container max-w-6xl px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            How it works
          </h2>
          <div className="grid md:grid-cols-4 gap-8">
            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Upload</CardTitle>
                <CardDescription>
                  Drag and drop a .zip file from your FluxSpace capture session
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Process</CardTitle>
                <CardDescription>
                  A background worker runs fluxspace-core to produce 3D meshes and exports
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Eye className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">View</CardTitle>
                <CardDescription>
                  Explore your scene in an interactive Three.js viewer with heatmap overlay
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Download className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Export</CardTitle>
                <CardDescription>
                  Download GLB meshes, logs, and any additional export artifacts
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-24">
        <div className="container max-w-6xl px-4">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Autonomous 3D capture and analysis
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                FluxSpace combines RGBD cameras and optional magnetometry into a single capture rig. Upload your field data and get processed 3D models ready for review in minutes.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Browser-based 3D viewer</span>
                    <span className="text-muted-foreground"> &mdash; no desktop software needed</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Heatmap overlay</span>
                    <span className="text-muted-foreground"> &mdash; toggle and adjust opacity in real time</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Private storage</span>
                    <span className="text-muted-foreground"> &mdash; all data secured with signed URLs and row-level security</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Fast processing</span>
                    <span className="text-muted-foreground"> &mdash; results in minutes, not hours</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-mag-blue via-mag-green to-mag-yellow rounded-lg aspect-square" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container max-w-4xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to get started?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Create an account, upload your first run, and view results in minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
