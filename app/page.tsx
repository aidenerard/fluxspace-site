import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Upload, Cpu, Map, Download } from "lucide-react"
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
              Map hidden structural issues from the air
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl">
              Upload your drone$apos;s magnetometer logs and get a georeferenced anomaly map ready to review in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/signup">
                <Button size="lg">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline">View docs</Button>
              </Link>
            </div>

            {/* CSV Schema Example */}
            <div className="w-full max-w-2xl mt-12">
              <div className="bg-muted rounded-lg p-6 text-left">
                <div className="text-xs text-muted-foreground mb-2">CSV Schema</div>
                <pre className="text-xs overflow-x-auto">
                  <code>{`time,lat,lon,alt,roll,pitch,yaw,Bx,By,Bz
1678901234.5,37.7749,-122.4194,100.0,0.1,-0.2,45.3,25000,1500,-40000
1678901235.0,37.7750,-122.4193,100.5,0.2,-0.1,45.5,25100,1450,-39900`}</code>
                </pre>
              </div>
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
                <CardTitle className="text-xl">Capture</CardTitle>
                <CardDescription>
                  Fly your drone with a magnetometer sensor over the survey area
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Upload</CardTitle>
                <CardDescription>
                  Drop your CSV flight log into FluxSpace
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
                  Automatic frame rotation, filtering, and gridding in minutes
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Map className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Visualize</CardTitle>
                <CardDescription>
                  Interactive map with heatmap overlay and export options
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
                Autonomous magnetic mapping for structural assessment
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Detect hidden structural anomalies, rebar defects, and subsurface features without contact. Perfect for infrastructure inspection, archaeological surveys, and forensic engineering.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">High-resolution anomaly detection</span>
                    <span className="text-muted-foreground"> — 10-25cm pixel resolution</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Gradiometer support</span>
                    <span className="text-muted-foreground"> — Dual-sensor ΔB calculation</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">WGS84 & UTM projection</span>
                    <span className="text-muted-foreground"> — Georeferenced GeoTIFF output</span>
                  </div>
                </li>
                <li className="flex items-start">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 mr-3 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Fast processing</span>
                    <span className="text-muted-foreground"> — Results in minutes, not hours</span>
                  </div>
                </li>
              </ul>
            </div>
            <div className="bg-gradient-to-br from-mag-blue via-mag-green to-mag-yellow rounded-lg aspect-square" />
          </div>
        </div>
      </section>

      {/* Customer Logos */}
      <section className="py-16 bg-muted/50">
        <div className="container max-w-6xl px-4">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Trusted by leading inspection and engineering firms
          </p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-50">
            {['Company A', 'Company B', 'Company C', 'Company D'].map((company) => (
              <div key={company} className="text-xl font-semibold">
                {company}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="container max-w-4xl px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Start mapping anomalies today
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Free trial includes 3 processing jobs and 2GB of storage. No credit card required.
          </p>
          <Button size="lg" asChild>
            <Link href="/signup">
              Get started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  )
}
