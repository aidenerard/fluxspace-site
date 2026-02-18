"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { ArrowLeft, Layers, Eye, EyeOff, Loader2 } from "lucide-react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

interface Props {
  runId: string
  manifestUrl: string | null
  sceneUrl: string
  heatmapUrl: string | null
}

export default function ViewerClient({
  runId,
  manifestUrl,
  sceneUrl,
  heatmapUrl,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)

  const [loading, setLoading] = useState(true)
  const [showHeatmap, setShowHeatmap] = useState(true)
  const [heatmapOpacity, setHeatmapOpacity] = useState(0.6)

  const surfaceRef = useRef<THREE.Group | null>(null)
  const heatmapRef = useRef<THREE.Group | null>(null)

  // Apply manifest defaults once loaded
  const applyManifestDefaults = useCallback(async () => {
    if (!manifestUrl) return
    try {
      const res = await fetch(manifestUrl)
      if (!res.ok) return
      const manifest = await res.json()
      if (manifest.default?.showHeatmap !== undefined)
        setShowHeatmap(manifest.default.showHeatmap)
      if (manifest.default?.heatmapOpacity !== undefined)
        setHeatmapOpacity(manifest.default.heatmapOpacity)
    } catch {
      // non-critical
    }
  }, [manifestUrl])

  useEffect(() => {
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
    rendererRef.current = renderer

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

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambient)
    const dir1 = new THREE.DirectionalLight(0xffffff, 1.0)
    dir1.position.set(5, 10, 7)
    scene.add(dir1)
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.4)
    dir2.position.set(-5, -3, -5)
    scene.add(dir2)

    // Grid helper (subtle)
    const grid = new THREE.GridHelper(20, 40, 0x444444, 0x333333)
    scene.add(grid)

    // GLB loader
    const loader = new GLTFLoader()

    let loadedCount = 0
    const totalToLoad = heatmapUrl ? 2 : 1

    const onLoaded = () => {
      loadedCount++
      if (loadedCount >= totalToLoad) {
        // Auto-frame the scene
        const box = new THREE.Box3()
        if (surfaceRef.current) box.expandByObject(surfaceRef.current)
        if (heatmapRef.current) box.expandByObject(heatmapRef.current)

        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3())
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const dist = maxDim * 1.5

          controls.target.copy(center)
          camera.position.copy(center.clone().add(new THREE.Vector3(dist, dist * 0.6, dist)))
          camera.lookAt(center)
          controls.update()
        }

        setLoading(false)
      }
    }

    // Load surface mesh
    loader.load(sceneUrl, (gltf) => {
      surfaceRef.current = gltf.scene
      scene.add(gltf.scene)
      onLoaded()
    })

    // Load heatmap overlay
    if (heatmapUrl) {
      loader.load(heatmapUrl, (gltf) => {
        heatmapRef.current = gltf.scene
        scene.add(gltf.scene)
        onLoaded()
      })
    }

    // Apply manifest defaults
    applyManifestDefaults()

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
      if (!container) return
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
  }, [sceneUrl, heatmapUrl, applyManifestDefaults])

  // Sync heatmap visibility
  useEffect(() => {
    if (heatmapRef.current) {
      heatmapRef.current.visible = showHeatmap
    }
  }, [showHeatmap])

  // Sync heatmap opacity
  useEffect(() => {
    if (!heatmapRef.current) return
    heatmapRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial
        mat.transparent = true
        mat.opacity = heatmapOpacity
        mat.needsUpdate = true
      }
    })
  }, [heatmapOpacity])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2 bg-background shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/dashboard/runs/${runId}`}>
              <ArrowLeft className="h-4 w-4 mr-1" />Back
            </Link>
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            Run {runId.slice(0, 8)}
          </span>
        </div>

        {heatmapUrl && (
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHeatmap((v) => !v)}
            >
              {showHeatmap ? (
                <><Eye className="h-4 w-4 mr-1" />Heatmap</>
              ) : (
                <><EyeOff className="h-4 w-4 mr-1" />Heatmap</>
              )}
            </Button>

            <div className="flex items-center gap-2 w-40">
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
          </div>
        )}
      </div>

      {/* canvas container */}
      <div ref={containerRef} className="flex-1 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading 3D scene&hellip;</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
