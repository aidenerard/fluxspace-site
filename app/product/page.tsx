import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Activity, Map, Download, Layers, Zap, Shield } from "lucide-react"

export default function ProductPage() {
  const features = [
    {
      icon: Activity,
      title: "Magnetic Anomaly Detection",
      description: "Identify hidden structural defects, rebar issues, and subsurface features with high-resolution magnetometer data processing.",
    },
    {
      icon: Layers,
      title: "Gradiometer Support",
      description: "Dual-sensor configuration for enhanced anomaly detection. Automatic ΔB calculation removes background field variations.",
    },
    {
      icon: Map,
      title: "3D Map Visualization",
      description: "Interactive map viewer with basemap options, orthomosaic overlays, and customizable heatmap color ramps.",
    },
    {
      icon: Download,
      title: "Multiple Export Formats",
      description: "Download georeferenced GeoTIFF with CRS metadata, PNG previews, and CSV gridded data for GIS integration.",
    },
    {
      icon: Zap,
      title: "Fast Processing",
      description: "Automated frame rotation, filtering, and gridding. Get results in minutes with 10-25cm pixel resolution.",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with encrypted storage, signed URLs, and row-level access controls.",
    },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Enterprise-grade magnetic mapping
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              FluxSpace automates the entire workflow from drone data to actionable insights.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
