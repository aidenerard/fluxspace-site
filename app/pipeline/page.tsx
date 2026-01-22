"use client"

import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, Database, CheckCircle2, TrendingUp, Image as ImageIcon, List } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

export default function PipelinePage() {
  const [activeSection, setActiveSection] = useState("")

  useEffect(() => {
    if (typeof window === "undefined") return

    const handleScroll = () => {
      const sections = ["overview", "workflow", "data-flow", "concepts", "cta"]
      const scrollPosition = window.scrollY + 100

      for (const section of sections) {
        const element = document.getElementById(section)
        if (element) {
          const { offsetTop, offsetHeight } = element
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section)
            break
          }
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    if (typeof window === "undefined") return
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }

  const pipelineSteps = [
    {
      step: 1,
      title: "Data Collection",
      script: "mag_to_csv.py",
      description: "Collect magnetic field measurements from MMC5983MA magnetometer sensor and save to CSV",
      input: "MMC5983MA sensor via I2C",
      output: "data/raw/mag_data.csv",
      icon: Database,
      features: [
        "Auto-grid mode for systematic measurement points",
        "Multiple samples per point with averaging",
        "Records Bx, By, Bz components and B_total",
        "UTC timestamps for all measurements",
        "Configurable grid settings (NX, NY, DX, DY, X0, Y0)"
      ]
    },
    {
      step: 2,
      title: "Validation & Cleaning",
      script: "validate_and_diagnosticsV1.py",
      description: "Validate, clean, and generate diagnostics for magnetometer CSV data",
      input: "data/raw/mag_data.csv",
      output: "data/processed/mag_data_clean.csv",
      icon: CheckCircle2,
      features: [
        "Validates CSV structure and required columns",
        "Cleans missing/invalid data",
        "Detects outliers using robust z-score statistics",
        "Detects spikes (sudden changes between measurements)",
        "Generates diagnostic plots and reports"
      ]
    },
    {
      step: 3,
      title: "Anomaly Detection",
      script: "compute_local_anomaly_v2.py",
      description: "Detect local magnetic anomalies by comparing each point to its neighborhood",
      input: "data/processed/mag_data_clean.csv",
      output: "data/processed/mag_data_anomaly.csv",
      icon: TrendingUp,
      features: [
        "Local anomaly computation (point vs. neighborhood)",
        "Configurable neighborhood radius",
        "Respects quality flags from validation step",
        "Adds local_anomaly, local_anomaly_abs, and local_anomaly_norm columns",
        "Optional scatter plot visualization"
      ]
    },
    {
      step: 4,
      title: "Visualization",
      script: "interpolate_to_heatmapV1.py",
      description: "Interpolate scattered measurement points onto a regular grid and generate heatmap visualizations",
      input: "data/processed/mag_data_anomaly.csv",
      output: "data/exports/mag_data_grid.csv + heatmap.png",
      icon: ImageIcon,
      features: [
        "IDW (Inverse Distance Weighting) interpolation",
        "Configurable grid resolution",
        "Tunable interpolation power parameter",
        "Exports grid data as CSV",
        "Generates heatmap PNG visualization"
      ]
    }
  ]

  const navItems = [
    { id: "overview", label: "Overview" },
    { id: "workflow", label: "Pipeline Workflow" },
    { id: "data-flow", label: "Data Flow" },
    { id: "concepts", label: "Key Concepts" },
    { id: "cta", label: "Next Steps" },
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-7xl px-4">
          {/* Mobile Navigation - Sticky Top */}
          <div className="lg:hidden mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => scrollToSection(item.id)}
                      className={`whitespace-nowrap px-4 py-2 rounded-md text-sm transition-colors flex-shrink-0 ${
                        activeSection === item.id
                          ? "bg-primary text-primary-foreground font-medium"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-8">
            {/* Sidebar Navigation - Desktop */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      <CardTitle className="text-sm">Navigation</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <nav className="space-y-1 p-4">
                      {navItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => scrollToSection(item.id)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                            activeSection === item.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </nav>
                  </CardContent>
                </Card>
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              {/* Hero Section */}
              <section id="overview" className="mb-16">
                <div className="text-center mb-16">
                  <h1 className="text-4xl md:text-5xl font-bold mb-4">
                    Fluxspace Core Pipeline
                  </h1>
                  <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                    A complete workflow for processing magnetic field measurements from sensor data to actionable visualizations
                  </p>
                </div>
              </section>

              {/* Pipeline Workflow */}
              <section id="workflow" className="mb-16">
                <h2 className="text-3xl font-bold mb-8">Pipeline Workflow</h2>
                <div className="space-y-8">
            {pipelineSteps.map((step, index) => (
              <div key={step.step} className="relative">
                {/* Connection Line */}
                {index < pipelineSteps.length - 1 && (
                  <div className="absolute left-6 top-20 bottom-0 w-0.5 bg-border -z-10" />
                )}
                
                <Card>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <step.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Step {step.step}</span>
                          <span className="text-2xl font-bold">{step.title}</span>
                        </div>
                        <CardDescription className="text-base mb-2">
                          <code className="text-sm bg-muted px-2 py-1 rounded">{step.script}</code>
                        </CardDescription>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold mb-2">Input</h4>
                        <p className="text-sm text-muted-foreground mb-4">{step.input}</p>
                        <h4 className="font-semibold mb-2">Output</h4>
                        <p className="text-sm text-muted-foreground">{step.output}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Key Features</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {step.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start">
                              <span className="text-primary mr-2">•</span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
                </div>
              </section>

              {/* Data Flow Diagram */}
              <section id="data-flow" className="mb-16">
                <h2 className="text-3xl font-bold mb-8">Data Flow</h2>
            <Card>
              <CardContent className="p-8">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <p className="font-semibold mb-1">Raw Data</p>
                        <p className="text-sm text-muted-foreground">data/raw/</p>
                      </div>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-[200px]">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <p className="font-semibold mb-1">Processed Data</p>
                        <p className="text-sm text-muted-foreground">data/processed/</p>
                      </div>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-[200px]">
                      <div className="bg-muted rounded-lg p-4 text-center">
                        <p className="font-semibold mb-1">Exports</p>
                        <p className="text-sm text-muted-foreground">data/exports/</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
              </section>

              {/* Key Concepts */}
              <section id="concepts" className="mb-16">
                <h2 className="text-3xl font-bold mb-8">Key Concepts</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Grid Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Systematic measurement collection with configurable grid parameters (NX, NY, DX, DY, X0, Y0). 
                    The script automatically calculates each grid point and prompts you to move the sensor there.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Quality Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Flag columns identify problematic data: outliers (extreme values), spikes (sudden jumps), 
                    and combined flags. These can be used to filter data in subsequent processing steps.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Local Anomalies</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Unlike global anomalies, local anomalies compare each point to nearby neighbors. 
                    This helps detect small-scale variations, regional differences, and localized sources of magnetic disturbance.
                  </p>
                </CardContent>
              </Card>
            </div>
              </section>

              {/* CTA */}
              <section id="cta" className="text-center">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="bg-muted/50">
                    <CardContent className="p-8">
                      <h2 className="text-2xl font-bold mb-4">
                        Ready to dive deeper?
                      </h2>
                      <p className="text-muted-foreground mb-6">
                        View detailed documentation for each script in the pipeline
                      </p>
                      <Link href="/docs/pipeline">
                        <Button size="lg">
                          View Detailed Documentation
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                  <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="p-8">
                      <h2 className="text-2xl font-bold mb-4">
                        See Real Examples
                      </h2>
                      <p className="text-muted-foreground mb-6">
                        Explore actual pipeline results with real data from a complete workflow run
                      </p>
                      <Link href="/docs/examples">
                        <Button size="lg" variant="outline">
                          View Examples & Results
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
