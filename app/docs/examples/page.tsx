"use client"

import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, TrendingUp, CheckCircle2, Image as ImageIcon, Database, Upload } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

export default function ExamplesPage() {
  const rawDataSample = `time,x,y,Bx,By,Bz,B_total,units
2026-01-13T19:52:50.143+00:00,0.0,0.0,4.328137817382813,0.2996209716796875,0.7353729248046875,4.400377601009411,gauss
2026-01-13T19:52:53.462+00:00,0.05,0.0,0.01,-0.018399658203125,-0.106656494140625,0.10869293980917528,gauss
2026-01-13T19:52:56.630+00:00,0.1,0.0,0.0124932861328125,0.006651611328125,-0.07955078125,0.08080008000702794,gauss
2026-01-13T19:52:59.675+00:00,0.15000000000000002,0.0,0.0114398193359375,0.00701171875,-0.0683447265625,0.06964937411901764,gauss
2026-01-13T19:53:02.631+00:00,0.2,0.0,0.006602783203125,0.0071014404296875,-0.076580810546875,0.07719227776287102,gauss
2026-01-13T19:53:05.735+00:00,0.0,0.05,0.008687744140625,-0.0266925048828125,-0.0593548583984375,0.06565794643963897,gauss
...`

  const cleanedDataSample = `time,x,y,Bx,By,Bz,B_total,units,_time_utc,_flag_outlier,_flag_spike,_flag_any
2026-01-13T19:52:53.462+00:00,0.05,0.0,0.01,-0.018399658203125,-0.106656494140625,0.1086929398091752,gauss,2026-01-13 19:52:53.462000+00:00,False,False,False
2026-01-13T19:52:56.630+00:00,0.1,0.0,0.0124932861328125,0.006651611328125,-0.07955078125,0.0808000800070279,gauss,2026-01-13 19:52:56.630000+00:00,False,False,False
2026-01-13T19:52:59.675+00:00,0.15,0.0,0.0114398193359375,0.00701171875,-0.0683447265625,0.0696493741190176,gauss,2026-01-13 19:52:59.675000+00:00,False,False,False
...`

  const anomalyDataSample = `time,x,y,Bx,By,Bz,B_total,units,_time_utc,_flag_outlier,_flag_spike,_flag_any,local_anomaly,local_anomaly_abs,local_anomaly_norm
2026-01-13T19:52:53.462+00:00,0.05,0.0,0.01,-0.018399658203125,-0.106656494140625,0.1086929398091752,gauss,2026-01-13 19:52:53.462000+00:00,False,False,False,-0.2185578102616949,0.2185578102616949,-0.13485824132575147
2026-01-13T19:52:56.630+00:00,0.1,0.0,0.0124932861328125,0.006651611328125,-0.07955078125,0.0808000800070279,gauss,2026-01-13 19:52:56.630000+00:00,False,False,False,-0.23376565643511524,0.23376565643511524,-0.14424204411387573
...`

  const reportStats = {
    rows_total: 50,
    rows_after_nan_drop: 50,
    rows_dropped_nan: 0,
    rows_flagged_outlier_or_spike: 3,
    rows_flagged_pct: 6,
    rows_after_flag_drop: 47,
    rows_dropped_flagged: 3,
    B_total_min: 0.0299297,
    B_total_mean: 0.466998,
    B_total_max: 4.40038,
    B_total_std: 0.886531,
    x_min: 0,
    x_max: 0.2,
    y_min: 0,
    y_max: 0.2,
    dt_mean_s: 237.374,
    dt_median_s: 3.298,
    sample_rate_hz_est: 0.303214
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-6xl px-4">
          <div className="mb-8">
            <Link href="/docs/pipeline" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
              ← Back to Pipeline Documentation
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Pipeline Examples & Results
            </h1>
            <p className="text-xl text-muted-foreground">
              Real-world example showing the complete pipeline workflow with actual data
            </p>
          </div>

          {/* Overview */}
          <section className="mb-16">
            <Card>
              <CardHeader>
                <CardTitle>Example Dataset Overview</CardTitle>
                <CardDescription>
                  This example demonstrates a complete pipeline run from January 13, 2026
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3">Data Collection</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Grid size: 5×5 points (0.0 to 0.2m in both X and Y)</li>
                      <li>• Total measurements: {reportStats.rows_total} points</li>
                      <li>• Measurement spacing: 0.05m intervals</li>
                      <li>• Coverage area: {reportStats.x_max - reportStats.x_min}m × {reportStats.y_max - reportStats.y_min}m</li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3">Data Quality</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li>• Valid measurements: {reportStats.rows_after_nan_drop} ({((reportStats.rows_after_nan_drop / reportStats.rows_total) * 100).toFixed(0)}%)</li>
                      <li>• Flagged points: {reportStats.rows_flagged_outlier_or_spike} ({reportStats.rows_flagged_pct}%)</li>
                      <li>• Final clean data: {reportStats.rows_after_flag_drop} points</li>
                      <li>• Sample rate: {reportStats.sample_rate_hz_est.toFixed(3)} Hz</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Pipeline Steps with Data */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold mb-8">Pipeline Steps with Example Data</h2>
            
            <div className="space-y-8">
              {/* Step 1: Raw Data */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Database className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Raw Data Collection (mag_to_csv.py)</CardTitle>
                        <CardDescription>Initial sensor measurements from MMC5983MA magnetometer</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Data Structure</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        The raw data contains timestamped measurements with spatial coordinates (x, y) and magnetic field components (Bx, By, Bz) along with computed B_total.
                      </p>
                      <div className="bg-muted rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs">
                          <code>{rawDataSample}</code>
                        </pre>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-muted rounded-lg p-4">
                        <div className="text-sm font-semibold mb-1">Total Points</div>
                        <div className="text-2xl font-bold">{reportStats.rows_total}</div>
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <div className="text-sm font-semibold mb-1">B_total Range</div>
                        <div className="text-sm">{reportStats.B_total_min.toFixed(4)} - {reportStats.B_total_max.toFixed(4)} gauss</div>
                      </div>
                      <div className="bg-muted rounded-lg p-4">
                        <div className="text-sm font-semibold mb-1">Grid Coverage</div>
                        <div className="text-sm">{reportStats.x_max - reportStats.x_min}m × {reportStats.y_max - reportStats.y_min}m</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Step 2: Cleaned Data */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Validated & Cleaned Data (validate_and_diagnosticsV1.py)</CardTitle>
                        <CardDescription>Data after validation, outlier detection, and spike detection</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Quality Flags Added</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        The validation script adds three flag columns to identify problematic data points:
                      </p>
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        <li>• <code className="bg-background px-1 rounded">_flag_outlier</code>: {reportStats.rows_flagged_outlier_or_spike} points with extreme B_total values</li>
                        <li>• <code className="bg-background px-1 rounded">_flag_spike</code>: Points with sudden jumps between consecutive measurements</li>
                        <li>• <code className="bg-background px-1 rounded">_flag_any</code>: Combined flag (outlier OR spike)</li>
                      </ul>
                      <div className="bg-muted rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs">
                          <code>{cleanedDataSample}</code>
                        </pre>
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Validation Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Rows after NaN drop:</span>
                            <span className="font-semibold">{reportStats.rows_after_nan_drop}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Flagged points:</span>
                            <span className="font-semibold">{reportStats.rows_flagged_outlier_or_spike} ({reportStats.rows_flagged_pct}%)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Final clean rows:</span>
                            <span className="font-semibold">{reportStats.rows_after_flag_drop}</span>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">B_total Statistics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Mean:</span>
                            <span className="font-semibold">{reportStats.B_total_mean.toFixed(4)} gauss</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Std Dev:</span>
                            <span className="font-semibold">{reportStats.B_total_std.toFixed(4)} gauss</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Range:</span>
                            <span className="font-semibold">{reportStats.B_total_min.toFixed(4)} - {reportStats.B_total_max.toFixed(4)}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Diagnostic Plots Generated</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        The validation script automatically generates several diagnostic visualizations:
                      </p>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• B_total vs time - Time series showing magnetic field over measurement period</li>
                        <li>• Histogram of B_total - Distribution of magnetic field values</li>
                        <li>• XY scatter plot colored by B_total - Spatial distribution of measurements</li>
                        <li>• Spike deltas plot - Identification of sudden changes between measurements</li>
                      </ul>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="text-sm font-semibold mb-2">B_total over time</h5>
                          <div className="w-full h-48 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/pipeline/btotal_vs_time.png"
                              alt="B_total over time showing magnetic field variation"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = '<p class="text-xs text-muted-foreground p-2 text-center">Image placeholder</p>'
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold mb-2">Histogram of B_total</h5>
                          <div className="w-full h-48 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/pipeline/btotal_hist.png"
                              alt="Histogram showing distribution of B_total values"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = '<p class="text-xs text-muted-foreground p-2 text-center">Image placeholder</p>'
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold mb-2">XY scatter plot colored by B_total</h5>
                          <div className="w-full h-48 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/pipeline/scatter_xy_colored.png"
                              alt="Spatial distribution of measurements colored by B_total"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = '<p class="text-xs text-muted-foreground p-2 text-center">Image placeholder</p>'
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <h5 className="text-sm font-semibold mb-2">Per-sample |ΔB_total| (spike check)</h5>
                          <div className="w-full h-48 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/images/pipeline/spike_deltas.png"
                              alt="Spike detection showing sudden changes between measurements"
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement
                                target.style.display = 'none'
                                if (target.parentElement) {
                                  target.parentElement.innerHTML = '<p class="text-xs text-muted-foreground p-2 text-center">Image placeholder</p>'
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Step 3: Anomaly Detection */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Anomaly Detection (compute_local_anomaly_v2.py)</CardTitle>
                        <CardDescription>Local anomaly computation comparing each point to its neighborhood</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Anomaly Columns Added</h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        The anomaly detection script adds three new columns to the cleaned data:
                      </p>
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        <li>• <code className="bg-background px-1 rounded">local_anomaly</code>: Raw anomaly value (B_total - local_mean)</li>
                        <li>• <code className="bg-background px-1 rounded">local_anomaly_abs</code>: Absolute value of the anomaly</li>
                        <li>• <code className="bg-background px-1 rounded">local_anomaly_norm</code>: Normalized anomaly (0-1 scale)</li>
                      </ul>
                      <div className="bg-muted rounded-lg p-4 overflow-x-auto">
                        <pre className="text-xs">
                          <code>{anomalyDataSample}</code>
                        </pre>
                      </div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Key Insight</h4>
                      <p className="text-sm text-muted-foreground">
                        In this example dataset, one point at (0.05, 0.05) shows a significant positive anomaly with a local_anomaly value of 1.62 gauss and a normalized value of 1.0 (maximum). This indicates a strong local magnetic disturbance compared to surrounding measurements, which could indicate a structural anomaly, rebar concentration, or other subsurface feature.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Step 4: Visualization */}
              <div>
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle>Heatmap Visualization (interpolate_to_heatmapV1.py)</CardTitle>
                        <CardDescription>IDW interpolation and heatmap generation</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">Output Files</h3>
                      <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                        <li>• <code className="bg-background px-1 rounded">mag_data_grid.csv</code>: Regular grid with interpolated local_anomaly values</li>
                        <li>• <code className="bg-background px-1 rounded">mag_data_heatmap.png</code>: Visual heatmap showing spatial distribution of anomalies</li>
                      </ul>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-4">
                      <h4 className="font-semibold mb-2">Heatmap Interpretation</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        The heatmap visualizes the spatial distribution of local magnetic anomalies using a color gradient:
                      </p>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        <li>• <strong>Yellow/Red regions:</strong> High positive anomalies (stronger magnetic field than neighbors)</li>
                        <li>• <strong>Green regions:</strong> Neutral anomalies (similar to neighborhood average)</li>
                        <li>• <strong>Blue/Purple regions:</strong> Low negative anomalies (weaker magnetic field than neighbors)</li>
                      </ul>
                      <div className="mt-4">
                        <h5 className="text-sm font-semibold mb-2">Heatmap (IDW) of local_anomaly</h5>
                        <div className="w-full h-96 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src="/images/pipeline/heatmap_anomaly.png"
                            alt="Heatmap showing spatial distribution of local magnetic anomalies using IDW interpolation"
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              if (target.parentElement) {
                                target.parentElement.innerHTML = '<p class="text-sm text-muted-foreground p-4 text-center">Image will appear here once heatmap_anomaly.png is added to /public/images/pipeline/</p>'
                              }
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          The heatmap shows distinct anomaly patterns with several hotspots (yellow) and coldspots (blue/purple) distributed across the measurement grid.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>

          {/* Complete Workflow Summary */}
          <section className="mb-16">
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle>Complete Workflow Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Data Collection</h3>
                      <p className="text-sm text-muted-foreground">
                        Collected {reportStats.rows_total} measurements across a {reportStats.x_max - reportStats.x_min}m × {reportStats.y_max - reportStats.y_min}m grid using auto-grid mode.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Validation & Cleaning</h3>
                      <p className="text-sm text-muted-foreground">
                        Identified and flagged {reportStats.rows_flagged_outlier_or_spike} problematic points ({reportStats.rows_flagged_pct}%), resulting in {reportStats.rows_after_flag_drop} clean data points ready for analysis.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Anomaly Detection</h3>
                      <p className="text-sm text-muted-foreground">
                        Computed local anomalies for all {reportStats.rows_after_flag_drop} points, identifying significant magnetic disturbances including a major anomaly at (0.05, 0.05) with normalized value of 1.0.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-sm font-bold text-primary">4</span>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Visualization</h3>
                      <p className="text-sm text-muted-foreground">
                        Generated interpolated grid and heatmap visualization showing spatial distribution of anomalies, ready for interpretation and further analysis.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Navigation */}
          <section>
            <div className="grid md:grid-cols-3 gap-4">
              <Link href="/process" className="flex-1">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">Process Your Data</h3>
                        <p className="text-sm text-muted-foreground">Upload and process mag_data.csv</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/docs/pipeline" className="flex-1">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">Pipeline Documentation</h3>
                        <p className="text-sm text-muted-foreground">Detailed script documentation</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Link href="/pipeline" className="flex-1">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3">
                      <Database className="h-5 w-5 text-primary" />
                      <div>
                        <h3 className="font-semibold">Pipeline Overview</h3>
                        <p className="text-sm text-muted-foreground">High-level workflow overview</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </section>
        </div>
      </div>

      <Footer />
    </div>
  )
}
