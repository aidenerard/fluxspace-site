import { NavBar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent } from "@/components/ui/card"

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
                FluxSpace processes drone magnetometer data to generate magnetic anomaly maps for structural assessment.
              </p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Create an account and sign in</li>
                <li>Create a new project</li>
                <li>Upload your CSV flight log</li>
                <li>Start a processing job</li>
                <li>View results in the interactive map viewer</li>
                <li>Download GeoTIFF, PNG, or CSV outputs</li>
              </ol>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">CSV Schema</h2>
              <p className="text-muted-foreground mb-4">
                Your CSV file must contain the following columns:
              </p>
              <Card>
                <CardContent className="p-6">
                  <pre className="text-sm overflow-x-auto">
                    <code>{`time       - Unix timestamp (seconds)
lat        - Latitude (WGS84 decimal degrees)
lon        - Longitude (WGS84 decimal degrees)
alt        - Altitude (meters)
roll       - Roll angle (degrees)
pitch      - Pitch angle (degrees)
yaw        - Yaw angle (degrees)
Bx         - Magnetic field X component (nT, body frame)
By         - Magnetic field Y component (nT, body frame)
Bz         - Magnetic field Z component (nT, body frame)`}</code>
                  </pre>
                </CardContent>
              </Card>
              <p className="text-muted-foreground mt-4">
                Optional columns for dual-sensor gradiometer configuration:
              </p>
              <Card className="mt-2">
                <CardContent className="p-6">
                  <pre className="text-sm">
                    <code>Bx2, By2, Bz2  - Second sensor readings</code>
                  </pre>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Coordinate Systems</h2>
              <p className="text-muted-foreground mb-4">
                FluxSpace uses standard coordinate reference systems:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>WGS84</strong> - Input lat/lon in decimal degrees</li>
                <li><strong>UTM</strong> - Automatic zone selection for local metric grid</li>
                <li><strong>GeoTIFF CRS</strong> - Embedded metadata for GIS integration</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Processing Pipeline</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">1. Frame Rotation</h3>
                  <p className="text-muted-foreground">
                    Convert body-frame magnetic vectors to earth frame using quaternion rotation with roll, pitch, yaw.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">2. Magnetic Field Calculation</h3>
                  <p className="text-muted-foreground">
                    Compute total field |B| or gradiometer ΔB = |B_lower| - |B_upper| for dual sensors.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">3. Filtering</h3>
                  <p className="text-muted-foreground">
                    Apply low-pass filter and rolling baseline removal to enhance anomaly detection.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">4. Gridding</h3>
                  <p className="text-muted-foreground">
                    Project to local UTM and interpolate using IDW or scipy griddata at 10-25cm resolution.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Export Formats</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>GeoTIFF</strong> - Georeferenced raster with embedded CRS</li>
                <li><strong>PNG</strong> - Preview image with color ramp</li>
                <li><strong>CSV</strong> - Gridded values (x, y, anomaly_value)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">FAQs</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">What file size limits apply?</h3>
                  <p className="text-muted-foreground">
                    Maximum 2 GB per file upload. Contact support for larger datasets.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">How long does processing take?</h3>
                  <p className="text-muted-foreground">
                    Typical processing time is 2-5 minutes depending on data size and complexity.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Can I process orthomosaics?</h3>
                  <p className="text-muted-foreground">
                    Yes, you can optionally upload a GeoTIFF orthomosaic for alignment with the magnetic anomaly layer.
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
