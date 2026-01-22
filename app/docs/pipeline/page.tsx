import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Code, FileText, Image as ImageIcon, TrendingUp, Database, CheckCircle2, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function PipelineDocsPage() {
  const scripts = [
    {
      name: "mag_to_csv.py",
      icon: Database,
      purpose: "Collect magnetic field measurements from an MMC5983MA magnetometer sensor and save them to CSV",
      description: "Connects to MMC5983MA sensor via I2C and operates in auto-grid mode, automatically generating a grid of measurement points. At each grid point, prompts user to move sensor and press Enter. Takes multiple samples per point and averages them for accuracy.",
      features: [
        "Configurable grid settings (NX, NY, DX, DY, X0, Y0)",
        "Error handling with specific exit codes",
        "Audio feedback (beep) after each measurement",
        "Automatic CSV header creation",
        "Records Bx, By, Bz components and computes B_total",
        "Saves data with UTC timestamps"
      ],
      output: "data/raw/mag_data.csv (or custom path)",
      usage: "python3 scripts/mag_to_csv.py"
    },
    {
      name: "validate_and_diagnosticsV1.py",
      icon: CheckCircle2,
      purpose: "Validate, clean, and generate diagnostics for magnetometer CSV data",
      description: "Validates CSV structure and required columns (x, y, B_total). Cleans missing/invalid data and detects outliers using robust z-score statistics (MAD-based). Detects spikes (sudden changes between consecutive measurements) and generates comprehensive diagnostic plots and reports.",
      features: [
        "Automatic B_total computation if missing (from Bx, By, Bz)",
        "Time column detection and parsing",
        "Quality flag columns: _flag_outlier, _flag_spike, _flag_any",
        "Optional outlier removal with --drop-outliers flag",
        "Configurable thresholds for outlier and spike detection",
        "Generates diagnostic plots: B_total vs time, histogram, XY scatter, spike deltas"
      ],
      output: "data/processed/<stem>_clean.csv, <stem>_report.txt, and diagnostic plots",
      usage: "python3 scripts/validate_and_diagnosticsV1.py --in data/raw/mag_data.csv --drop-outliers --z-thresh 5.0"
    },
    {
      name: "compute_local_anomaly_v2.py",
      icon: TrendingUp,
      purpose: "Detect local magnetic anomalies by comparing each point to its neighborhood rather than the global average",
      description: "For each point, finds all neighbors within a specified radius and computes local mean B_total from neighbors. Calculates anomaly as: local_anomaly = B_total - local_mean. Optionally filters out flagged rows (outliers/spikes) and adds three anomaly columns.",
      features: [
        "Command-line interface with flexible arguments",
        "Respects quality flags from validation step",
        "Configurable neighborhood radius",
        "Optional plotting for quick visualization",
        "Adds local_anomaly, local_anomaly_abs, and local_anomaly_norm columns",
        "Better error handling than v1"
      ],
      output: "data/processed/<input_stem>_anomaly.csv",
      usage: "python3 scripts/compute_local_anomaly_v2.py --in data/processed/mag_data_clean.csv --radius 0.30 --plot"
    },
    {
      name: "interpolate_to_heatmapV1.py",
      icon: ImageIcon,
      purpose: "Interpolate scattered measurement points onto a regular grid and generate heatmap visualizations",
      description: "Takes scattered (x, y, value) points from CSV and interpolates values onto a regular grid using IDW (Inverse Distance Weighting). Exports grid data as CSV and generates heatmap PNG visualization with configurable grid resolution and interpolation power.",
      features: [
        "Lightweight IDW interpolator (no SciPy required)",
        "Flexible grid spacing options",
        "Tunable interpolation power parameter",
        "Quick preview heatmap generation",
        "Exports grid data as CSV",
        "Generates heatmap PNG visualization"
      ],
      output: "data/exports/<stem>_grid.csv, <stem>_heatmap.png",
      usage: "python3 scripts/interpolate_to_heatmapV1.py --in data/processed/mag_data_anomaly.csv --value-col local_anomaly --grid-step 0.05"
    }
  ]

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          <div className="mb-8">
            <Link href="/pipeline" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
              ← Back to Pipeline Overview
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Pipeline Documentation
            </h1>
            <p className="text-xl text-muted-foreground">
              Detailed documentation for all scripts in the Fluxspace Core pipeline
            </p>
          </div>

          {/* Complete Workflow Example */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6">Complete Workflow Example</h2>
            <Card>
              <CardHeader>
                <CardTitle>Running the Entire Pipeline</CardTitle>
                <CardDescription>
                  Follow these steps to process data from collection to visualization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Step 1: Collect data</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`python3 scripts/mag_to_csv.py
# Output: data/raw/mag_data.csv`}</code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Step 2: Validate and clean</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`python3 scripts/validate_and_diagnosticsV1.py --in data/raw/mag_data.csv --drop-outliers
# Output: data/processed/mag_data_clean.csv + diagnostics`}</code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Step 3: Compute anomalies</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`python3 scripts/compute_local_anomaly_v2.py --in data/processed/mag_data_clean.csv --radius 0.30 --plot
# Output: data/processed/mag_data_anomaly.csv`}</code>
                    </pre>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Step 4: Create heatmap</h3>
                    <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                      <code>{`python3 scripts/interpolate_to_heatmapV1.py --in data/processed/mag_data_anomaly.csv --value-col local_anomaly --grid-step 0.05
# Output: data/exports/mag_data_grid.csv + mag_data_heatmap.png`}</code>
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Script Documentation */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Script Documentation</h2>
            <div className="space-y-8">
              {scripts.map((script, index) => (
                <Card key={script.name}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <script.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Script {index + 1}</span>
                          <CardTitle className="text-2xl">{script.name}</CardTitle>
                        </div>
                        <CardDescription className="text-base">{script.purpose}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold mb-2">Description</h3>
                      <p className="text-sm text-muted-foreground">{script.description}</p>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold mb-2">Key Features</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {script.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="text-primary mr-2">•</span>
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h3 className="font-semibold mb-2">Output</h3>
                        <p className="text-sm text-muted-foreground">{script.output}</p>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-2">Example Usage</h3>
                        <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto">
                          <code>{script.usage}</code>
                        </pre>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Data Directory Structure */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6">Data Directory Structure</h2>
            <Card>
              <CardHeader>
                <CardTitle>Organized Data Flow</CardTitle>
                <CardDescription>
                  The pipeline follows a clear data flow through organized directories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`data/
├── raw/              # Original sensor data (from mag_to_csv.py)
├── processed/        # Cleaned and analyzed data (from validate + anomaly scripts)
└── exports/          # Final outputs (grids, heatmaps)

Flow: raw/ → processed/ → exports/`}</code>
                </pre>
              </CardContent>
            </Card>
          </section>

          {/* Key Concepts */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Key Concepts Explained</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Grid Mode</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    <code>mag_to_csv.py</code> uses an auto-grid system where you configure:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong>NX, NY:</strong> Number of points in X and Y directions</li>
                    <li>• <strong>DX, DY:</strong> Spacing between points (in meters)</li>
                    <li>• <strong>X0, Y0:</strong> Starting coordinates</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4">
                    The script automatically calculates each grid point and prompts you to move the sensor there.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quality Flags</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    <code>validate_and_diagnosticsV1.py</code> adds flag columns to identify problematic data:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• <strong>_flag_outlier:</strong> Points with extreme B_total values (robust z-score)</li>
                    <li>• <strong>_flag_spike:</strong> Points with sudden jumps between consecutive measurements</li>
                    <li>• <strong>_flag_any:</strong> Combined flag (outlier OR spike)</li>
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4">
                    These flags can be used to filter data in subsequent steps.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Local Anomalies</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Unlike global anomalies (comparing to overall mean), local anomalies compare each point to its nearby neighbors. This helps detect:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground mt-4">
                    <li>• Small-scale variations hidden by global trends</li>
                    <li>• Regional magnetic field differences</li>
                    <li>• Localized sources of magnetic disturbance</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>IDW Interpolation</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Inverse Distance Weighting assigns values to grid points based on:
                  </p>
                  <ul className="space-y-2 text-sm text-muted-foreground mt-4">
                    <li>• Distance to nearby measurement points</li>
                    <li>• A power parameter (default: 2.0) that controls influence decay</li>
                    <li>• Closer points have more influence than distant ones</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Additional Scripts */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-6">Additional Scripts</h2>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>compute_local_anomaly_v1.py</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Original version of local anomaly computation (simpler, no CLI). 
                    <strong className="text-foreground"> Status: Superseded by compute_local_anomaly_v2.py</strong> (recommended to use v2)
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>calibrate_magnetometerV1.py</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Placeholder - functionality to be implemented
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>run_metadataV1.py</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Placeholder - functionality to be implemented
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Notes */}
          <section className="mb-16">
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Important Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• All scripts use Python 3 and require various dependencies (pandas, numpy, matplotlib, etc.)</li>
                  <li>• Scripts are designed to be run from the command line</li>
                  <li>• Most scripts support <code className="bg-background px-1 rounded">--help</code> flag for argument information</li>
                  <li>• Error handling includes specific exit codes for automation/scripting</li>
                  <li>• Output file naming follows consistent patterns (e.g., <code className="bg-background px-1 rounded">&lt;stem&gt;_clean.csv</code>, <code className="bg-background px-1 rounded">&lt;stem&gt;_anomaly.csv</code>)</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          {/* Examples Link */}
          <section>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-4">
                    See the Pipeline in Action
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    View a complete real-world example with actual data from a pipeline run, including raw data, cleaned data, anomaly detection results, and visualizations.
                  </p>
                  <Link href="/docs/examples">
                    <Button size="lg">
                      View Examples & Results
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  )
}
