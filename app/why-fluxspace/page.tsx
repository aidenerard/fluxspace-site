import { NavBar } from "@/components/navbar-new"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Zap, Shield, Users, TrendingUp, Globe } from "lucide-react"

export default function WhyFluxSpacePage() {
  const reasons = [
    {
      icon: Zap,
      title: "Speed & Efficiency",
      description: "Process magnetometer data in minutes, not hours. Our automated pipeline handles frame rotation, filtering, and gridding instantly."
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption, row-level security policies, and signed URLs ensure your sensitive structural data stays protected."
    },
    {
      icon: Users,
      title: "Built for Professionals",
      description: "Designed by engineers, for engineers. Supports industry-standard formats (GeoTIFF, WGS84/UTM) and integrates with your GIS workflow."
    },
    {
      icon: TrendingUp,
      title: "Scalable Solutions",
      description: "From small inspections to large infrastructure projects. Our plans grow with your needs, from 3 jobs/month to 150+."
    },
    {
      icon: Globe,
      title: "Cloud-Based Access",
      description: "Access your projects from anywhere. No complex software installations or updates required. Just upload and visualize."
    },
    {
      icon: CheckCircle2,
      title: "Proven Results",
      description: "10-25cm pixel resolution with automatic quality checks. Trusted by leading inspection and engineering firms worldwide."
    }
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          {/* Hero */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Why FluxSpace?
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              The most efficient way to process drone magnetometer data for structural assessment.
            </p>
          </div>

          {/* Reasons Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {reasons.map((reason) => (
              <Card key={reason.title}>
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <reason.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{reason.title}</CardTitle>
                  <CardDescription>{reason.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* Comparison Section */}
          <div className="bg-muted rounded-lg p-8 mb-16">
            <h2 className="text-3xl font-bold text-center mb-8">Traditional vs FluxSpace</h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4 text-muted-foreground">Traditional Processing</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span>Manual frame rotation calculations</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span>Hours of data processing time</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span>Complex software installations</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span>Inconsistent output formats</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✗</span>
                    <span>Limited visualization options</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-4 text-primary">FluxSpace</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Automatic quaternion-based rotation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Results in 2-5 minutes</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Web-based, zero installation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Standard GeoTIFF with CRS metadata</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                    <span>Interactive map viewer with controls</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Use Cases */}
          <div>
            <h2 className="text-3xl font-bold text-center mb-8">Perfect For</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Infrastructure Inspection</CardTitle>
                  <CardDescription>
                    Detect rebar defects, corrosion, and structural weaknesses in bridges, buildings, and concrete structures.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Archaeological Surveys</CardTitle>
                  <CardDescription>
                    Map subsurface features and buried structures without excavation. Non-invasive site assessment.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Forensic Engineering</CardTitle>
                  <CardDescription>
                    Investigate failure causes, document anomalies, and provide evidence for structural assessments.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
