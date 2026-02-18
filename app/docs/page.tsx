import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"

export default function DocsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      
      <div className="flex-1 py-24">
        <div className="container max-w-4xl px-4">
          <h1 className="text-4xl font-bold mb-8">Documentation</h1>

          <div className="space-y-12">
            <section>
              <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
              <p className="text-muted-foreground mb-4">
                FluxSpace turns raw field captures into interactive 3D visualizations you can explore in the browser. The pipeline is simple: upload a zip, let the worker process it, then view the results.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Create an account and sign in</li>
                <li>
                  Go to{" "}
                  <Link href="/dashboard/runs/new" className="text-primary hover:underline">
                    Upload
                  </Link>{" "}
                  and drop your <code className="font-mono text-xs bg-muted px-1 rounded">.zip</code> file
                </li>
                <li>The file is stored securely and a background worker begins processing</li>
                <li>
                  Track progress on the{" "}
                  <Link href="/dashboard/runs" className="text-primary hover:underline">
                    Runs
                  </Link>{" "}
                  page
                </li>
                <li>When processing is complete, open the interactive 3D viewer</li>
                <li>Download GLB meshes, logs, or additional exports</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">What Is a &ldquo;Run&rdquo;?</h2>
              <p className="text-muted-foreground mb-4">
                A run represents a single zipped capture folder exported from the FluxSpace capture rig (Raspberry Pi + OAK-D RGBD camera + optional magnetometer). The zip typically contains raw sensor data, images, and metadata from a field session.
              </p>
              <Card>
                <CardContent className="p-6">
                  <pre className="text-sm overflow-x-auto">
                    <code>{`run_20260115_1430.zip
├── metadata.json        # session info, timestamps, sensor config
├── images/              # RGBD frames from OAK-D
│   ├── 000001_rgb.png
│   ├── 000001_depth.png
│   └── ...
├── imu/                 # IMU readings (optional)
│   └── imu.csv
└── mag/                 # magnetometer readings (optional)
    └── mag.csv`}</code>
                  </pre>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Upload</h2>
              <p className="text-muted-foreground mb-4">
                Navigate to <Link href="/dashboard/runs/new" className="text-primary hover:underline">/dashboard/runs/new</Link> and drag your <code className="font-mono text-xs bg-muted px-1 rounded">.zip</code> file onto the dropzone. The file is uploaded directly to private storage via a signed URL &mdash; it never passes through the application server. Maximum file size is 2&nbsp;GB.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Processing Pipeline</h2>
              <p className="text-muted-foreground mb-4">
                After upload, a background Python worker picks up the run and executes the <code className="font-mono text-xs bg-muted px-1 rounded">fluxspace-core</code> pipeline. Heavy compute runs outside of the web server on a dedicated worker instance.
              </p>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">1. Ingest</h3>
                  <p className="text-muted-foreground">
                    The worker downloads the zip from private storage, extracts it, and validates the contents.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. Reconstruct</h3>
                  <p className="text-muted-foreground">
                    RGBD frames are fused into a 3D surface mesh. If magnetometer data is present, a magnetic heatmap mesh is generated and aligned to the surface.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. Export</h3>
                  <p className="text-muted-foreground">
                    The worker writes viewer assets (<code className="font-mono text-xs bg-muted px-1 rounded">manifest.json</code>, <code className="font-mono text-xs bg-muted px-1 rounded">scene.glb</code>, optional <code className="font-mono text-xs bg-muted px-1 rounded">heatmap.glb</code>) and any additional export files back to private storage, then marks the run as done.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Outputs</h2>
              <p className="text-muted-foreground mb-4">
                When processing completes, the following assets are available:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>
                  <strong>Viewer assets</strong> &mdash;{" "}
                  <code className="font-mono text-xs bg-muted px-1 rounded">manifest.json</code>,{" "}
                  <code className="font-mono text-xs bg-muted px-1 rounded">scene.glb</code>,{" "}
                  and optional <code className="font-mono text-xs bg-muted px-1 rounded">heatmap.glb</code> loaded by the in-browser 3D viewer
                </li>
                <li>
                  <strong>Exports folder</strong> &mdash; any extra output files (point clouds, measurements, reports) placed in the exports directory
                </li>
                <li>
                  <strong>Pipeline log</strong> &mdash;{" "}
                  <code className="font-mono text-xs bg-muted px-1 rounded">pipeline.log</code> with timestamped processing details
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3D Viewer</h2>
              <p className="text-muted-foreground mb-4">
                The viewer is a Three.js scene that loads GLB models via short-lived signed URLs. No plugins or desktop software required.
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Orbit controls</strong> &mdash; rotate, pan, and zoom around the scene</li>
                <li><strong>Heatmap toggle</strong> &mdash; show or hide the magnetic overlay</li>
                <li><strong>Opacity slider</strong> &mdash; adjust heatmap transparency in real time</li>
                <li><strong>Reset camera</strong> &mdash; fit the view to the scene bounds</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Status Lifecycle</h2>
              <p className="text-muted-foreground mb-4">
                Each run progresses through a well-defined set of states:
              </p>
              <Card>
                <CardContent className="p-6">
                  <pre className="text-sm overflow-x-auto">
                    <code>{`uploaded → queued → processing → exporting → done
                                    ↘                         ↘
                                   failed                    failed`}</code>
                  </pre>
                </CardContent>
              </Card>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
                <li><strong>uploaded</strong> &mdash; zip stored, awaiting trigger</li>
                <li><strong>queued</strong> &mdash; worker has been notified</li>
                <li><strong>processing</strong> &mdash; reconstruction in progress (progress bar updates live)</li>
                <li><strong>exporting</strong> &mdash; writing output files to storage</li>
                <li><strong>done</strong> &mdash; viewer and downloads are ready</li>
                <li><strong>failed</strong> &mdash; error details shown on the run page</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Storage</h2>
              <p className="text-muted-foreground mb-4">
                All data is stored in three private Supabase Storage buckets:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>runs-raw</strong> &mdash; uploaded zip files</li>
                <li><strong>runs-processed</strong> &mdash; viewer assets, exports, and worker output</li>
                <li><strong>runs-logs</strong> &mdash; pipeline logs</li>
              </ul>
              <p className="text-muted-foreground mt-4">
                Buckets are private. All browser access uses short-lived signed URLs generated server-side after ownership verification.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">FAQs</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">What file size limits apply?</h3>
                  <p className="text-muted-foreground">
                    Maximum 2&nbsp;GB per zip upload. Contact support for larger datasets.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">How long does processing take?</h3>
                  <p className="text-muted-foreground">
                    Typical processing time is 2&ndash;10 minutes depending on the number of frames and sensor data included in the run.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Do I need a magnetometer?</h3>
                  <p className="text-muted-foreground">
                    No. The magnetometer is optional. Without it, you still get a 3D surface mesh from the RGBD data; the heatmap overlay will simply be absent.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Can I download the raw outputs?</h3>
                  <p className="text-muted-foreground">
                    Yes. GLB files, export artifacts, and the pipeline log are all downloadable from the run detail page once processing completes.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
