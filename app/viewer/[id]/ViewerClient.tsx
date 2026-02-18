"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  ArrowLeft,
  Layers,
  Eye,
  EyeOff,
  Loader2,
  Maximize,
  AlertTriangle,
} from "lucide-react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

interface ViewerUrls {
  manifestUrl: string | null
  surfaceUrl: string | null
  heatmapUrl: string | null
}

export default function ViewerClient({ runId }: { runId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const [urls, setUrls] = useState<ViewerUrls | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.6)

  // Three.js refs kept outside React render cycle
  const surfaceRef = useRef<THREE.Group | null>(null)
  const heatmapRef = useRef<THREE.Group | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const sceneBoundsRef = useRef<THREE.Box3 | null>(null)

  /* ── 1. Fetch signed URLs from our API route ────────────── */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}`)
        if (!res.ok) throw new Error("Could not load run data")
        const json = await res.json()

        if (json.run.status !== "done") {
          setError("This run hasn't finished processing yet.")
          setLoading(false)
          return
        }

        const v = json.viewer as ViewerUrls
        if (!v.surfaceUrl) {
          setError(
            "The worker hasn't uploaded viewer assets yet. " +
              "Check the run status page and try again later.",
          )
          setLoading(false)
          return
        }

        if (!cancelled) setUrls(v)
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message ?? "Failed to load viewer data")
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [runId])

  /* ── 2. Apply manifest defaults ─────────────────────────── */
  const applyManifest = useCallback(async (manifestUrl: string | null) => {
    if (!manifestUrl) return
    try {
      const res = await fetch(manifestUrl)
      if (!res.ok) return
      const m = await res.json()
      if (m.default?.showHeatmap !== undefined)
        setShowHeatmap(m.default.showHeatmap)
      if (m.default?.heatmapOpacity !== undefined)
        setHeatmapOpacity(m.default.heatmapOpacity)
    } catch {
      /* non-critical */
    }
  }, [])

  /* ── 3. Build Three.js scene once URLs are available ────── */
  useEffect(() => {
    if (!urls) return
    const container = containerRef.current
    if (!container) return

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    // Camera
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.01,
      1000,
    )
    camera.position.set(2, 2, 2)
    cameraRef.current = camera

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controlsRef.current = controls

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const d1 = new THREE.DirectionalLight(0xffffff, 1.0)
    d1.position.set(5, 10, 7)
    scene.add(d1)
    const d2 = new THREE.DirectionalLight(0xffffff, 0.4)
    d2.position.set(-5, -3, -5)
    scene.add(d2)

    // Grid
    scene.add(new THREE.GridHelper(20, 40, 0x444444, 0x333333))

    // Load GLBs
    const loader = new GLTFLoader()
    let loadedCount = 0
    const totalToLoad = urls.heatmapUrl ? 2 : 1

    const fitCamera = () => {
      const box = new THREE.Box3()
      if (surfaceRef.current) box.expandByObject(surfaceRef.current)
      if (heatmapRef.current) box.expandByObject(heatmapRef.current)
      if (box.isEmpty()) return
      sceneBoundsRef.current = box
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const dist = maxDim * 1.5
      controls.target.copy(center)
      camera.position.copy(
        center.clone().add(new THREE.Vector3(dist, dist * 0.6, dist)),
      )
      camera.lookAt(center)
      controls.update()
    }

    const onLoaded = () => {
      loadedCount++
      if (loadedCount >= totalToLoad) {
        fitCamera()
        setLoading(false)
      }
    }

    const onError = (url: string) => () => {
      setError(`Failed to load 3D model from storage. URL: ${url.slice(0, 60)}...`)
      setLoading(false)
    }

    loader.load(urls.surfaceUrl!, (gltf) => {
      surfaceRef.current = gltf.scene
      scene.add(gltf.scene)
      onLoaded()
    }, undefined, onError(urls.surfaceUrl!))

    if (urls.heatmapUrl) {
      loader.load(urls.heatmapUrl, (gltf) => {
        heatmapRef.current = gltf.scene
        scene.add(gltf.scene)
        onLoaded()
      }, undefined, onError(urls.heatmapUrl))
    }

    applyManifest(urls.manifestUrl)

    // Render loop
    let frameId: number
    const animate = () => {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // Resize
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener("resize", onResize)
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [urls, applyManifest])

  /* ── Sync heatmap visibility ────────────────────────────── */
  useEffect(() => {
    if (heatmapRef.current) heatmapRef.current.visible = showHeatmap
  }, [showHeatmap])

  /* ── Sync heatmap opacity ───────────────────────────────── */
  useEffect(() => {
    if (!heatmapRef.current) return
    heatmapRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial
        mat.transparent = true
        mat.opacity = heatmapOpacity
        mat.depthWrite = heatmapOpacity > 0.95
        mat.needsUpdate = true
      }
    })
  }, [heatmapOpacity])

  /* ── Reset camera ───────────────────────────────────────── */
  const resetCamera = useCallback(() => {
    const box = sceneBoundsRef.current
    const camera = cameraRef.current
    const controls = controlsRef.current
    if (!box || !camera || !controls) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const dist = maxDim * 1.5
    controls.target.copy(center)
    camera.position.copy(
      center.clone().add(new THREE.Vector3(dist, dist * 0.6, dist)),
    )
    camera.lookAt(center)
    controls.update()
  }, [])

  /* ── Error state ────────────────────────────────────────── */
  if (error) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <Toolbar runId={runId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Viewer unavailable</h2>
            <p className="text-sm text-muted-foreground mb-6">{error}</p>
            <Button variant="outline" asChild>
              <Link href={`/dashboard/runs/${runId}`}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to run
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ── Main render ────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/runs/${runId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Run {runId.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Reset camera */}
          <Button variant="outline" size="sm" onClick={resetCamera}>
            <Maximize className="h-4 w-4 mr-1" />
            Reset
          </Button>

          {/* Heatmap controls — only when a heatmap was loaded */}
          {urls?.heatmapUrl && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHeatmap((v) => !v)}
              >
                {showHeatmap ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Heatmap
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Heatmap
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2 w-36">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                <Slider
                  min={0}
                  max={100}
                  step={1}
                  value={[Math.round(heatmapOpacity * 100)]}
                  onValueChange={([v]) => setHeatmapOpacity(v / 100)}
                  disabled={!showHeatmap}
                />
                <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                  {Math.round(heatmapOpacity * 100)}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* canvas */}
      <div ref={containerRef} className="flex-1 relative">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Loading 3D scene&hellip;
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Minimal toolbar for error state ─────────────────────── */
function Toolbar({ runId }: { runId: string }) {
  return (
    <div className="flex items-center border-b px-4 py-2 bg-background shrink-0">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/dashboard/runs/${runId}`}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Link>
      </Button>
      <span className="ml-3 text-sm font-medium text-muted-foreground">
        Run {runId.slice(0, 8)}
      </span>
    </div>
  )
}
