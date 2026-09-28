import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCube, faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { viewFileBlob } from '../../services/driveService'
import { getModelExtension } from '../../services/driveUtils'
import type { FileItem } from '../../types'

const disposeMaterial = (material: THREE.Material): void => {
  Object.values(material as unknown as Record<string, unknown>).forEach((value) => {
    if (value && (value as { isTexture?: boolean }).isTexture) {
      ;(value as THREE.Texture).dispose()
    }
  })
  material.dispose()
}

interface ModelPreviewModalProps {
  open: boolean
  file: FileItem | null
  onClose: () => void
  openAt: number
  disabled?: boolean
}

const ModelPreviewModal = ({ open, file, onClose, openAt, disabled }: ModelPreviewModalProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const name = file?.filename || file?.originalName || file?.name || ''
  const format = useMemo(() => getModelExtension(name), [name])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, open])

  useEffect(() => {
    if (!open || !file || disabled) return
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let renderer: THREE.WebGLRenderer | null = null
    let scene: THREE.Scene | null = null
    let camera: THREE.PerspectiveCamera | null = null
    let controls: OrbitControls | null = null
    let frameId: number | null = null
    let resizeObserver: ResizeObserver | null = null
    let modelUrl: string | null = null

    const cleanup = () => {
      if (frameId) cancelAnimationFrame(frameId)
      if (resizeObserver) resizeObserver.disconnect()
      if (controls) controls.dispose()
      if (scene) {
        scene.traverse((child) => {
          const mesh = child as THREE.Mesh
          if (mesh.isMesh) {
            if (mesh.geometry) mesh.geometry.dispose()
            const material = mesh.material
            if (Array.isArray(material)) {
              material.forEach((item) => item && disposeMaterial(item))
            } else if (material) {
              disposeMaterial(material)
            }
          }
        })
      }
      if (renderer) {
        renderer.dispose()
        if (renderer.domElement?.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement)
        }
      }
      if (modelUrl) {
        URL.revokeObjectURL(modelUrl)
      }
    }

    const loadModel = async () => {
      setLoading(true)
      setError('')
      try {
        const blob = await viewFileBlob(file.publicId)
        if (cancelled) return
        modelUrl = URL.createObjectURL(blob)
        if (cancelled) return
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        renderer.setPixelRatio(window.devicePixelRatio || 1)
        renderer.setSize(container.clientWidth, container.clientHeight)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1
        renderer.setClearColor(0xf5f6f8, 1)
        container.appendChild(renderer.domElement)
        scene = new THREE.Scene()
        camera = new THREE.PerspectiveCamera(
          45,
          container.clientWidth / Math.max(container.clientHeight, 1),
          0.1,
          1000
        )
        camera.position.set(0, 1.5, 3)
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enablePan = false
        controls.enableDamping = true
        controls.dampingFactor = 0.08
        scene.add(new THREE.AmbientLight(0xffffff, 0.8))
        const dir = new THREE.DirectionalLight(0xffffff, 0.8)
        dir.position.set(2, 2, 2)
        scene.add(dir)

        const handleLoaded = (object: THREE.Object3D) => {
          if (cancelled || !scene || !camera || !controls || !renderer) return
          object.traverse((child) => {
            const mesh = child as THREE.Mesh
            if (!mesh.isMesh) return
            const material = mesh.material
            const syncMaterial = (item: THREE.Material) => {
              const std = item as THREE.MeshStandardMaterial
              if (std?.map) std.map.colorSpace = THREE.SRGBColorSpace
              if (std?.emissiveMap) std.emissiveMap.colorSpace = THREE.SRGBColorSpace
              item.needsUpdate = true
            }
            if (Array.isArray(material)) {
              material.forEach(syncMaterial)
            } else if (material) {
              syncMaterial(material)
            }
          })
          scene.add(object)
          const box = new THREE.Box3().setFromObject(object)
          const size = box.getSize(new THREE.Vector3())
          const center = box.getCenter(new THREE.Vector3())
          object.position.sub(center)
          const maxDim = Math.max(size.x, size.y, size.z) || 1
          const fov = (camera.fov * Math.PI) / 180
          let cameraZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)))
          cameraZ *= 1.4
          camera.position.set(0, Math.max(size.y * 0.4, 0.6), cameraZ)
          camera.near = Math.max(cameraZ / 100, 0.01)
          camera.far = cameraZ * 100
          camera.updateProjectionMatrix()
          controls.target.set(0, 0, 0)
          controls.update()
          setLoading(false)
          const animate = () => {
            frameId = requestAnimationFrame(animate)
            if (!controls || !renderer || !scene || !camera) return
            controls.update()
            renderer.render(scene, camera)
          }
          animate()
        }

        const handleError = () => {
          if (cancelled) return
          setError('Gagal memuat preview 3D.')
          setLoading(false)
        }

        if (format === 'fbx') {
          const loader = new FBXLoader()
          loader.load(modelUrl, handleLoaded, undefined, handleError)
        } else if (format === 'obj') {
          const loader = new OBJLoader()
          loader.load(modelUrl, handleLoaded, undefined, handleError)
        } else {
          const loader = new GLTFLoader()
          loader.load(modelUrl, (data) => handleLoaded(data.scene), undefined, handleError)
        }

        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0]
          if (!entry || !renderer || !camera) return
          const { width, height } = entry.contentRect
          renderer.setSize(width, height)
          camera.aspect = width / Math.max(height, 1)
          camera.updateProjectionMatrix()
        })
        resizeObserver.observe(container)
      } catch {
        if (cancelled) return
        setError('Gagal memuat preview 3D.')
        setLoading(false)
      }
    }

    loadModel()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [disabled, file, format, open])

  if (!open || !file) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={() => {
        if (Date.now() - openAt < 300) return
        onClose()
      }}
    >
      <div
        className="relative w-[95vw] max-w-6xl h-[80vh] bg-white rounded-2xl p-6 dark:bg-[#202225]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-10 w-10 rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white dark:hover:bg-[#2a2c30]"
        >
          <FontAwesomeIcon icon={faXmark} />
        </button>
        <div className="mb-4">
          <div className="text-lg font-semibold text-slate-900 truncate dark:text-slate-100">{name}</div>
        </div>
        {disabled ? (
          <div className="h-full w-full rounded-xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2 dark:bg-[#1F2023] dark:border-slate-700 dark:text-slate-400">
            <FontAwesomeIcon icon={faCube} />
            Preview 3D dinonaktifkan
          </div>
        ) : (
          <div className="relative h-[65vh] w-full">
            <div ref={containerRef} className="h-full w-full rounded-xl bg-slate-50 dark:bg-[#1F2023]" />
            {(loading || error) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/70 text-sm text-slate-600 dark:bg-[#202225]/80 dark:text-slate-300">
                {loading && (
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    Memuat preview 3D...
                  </div>
                )}
                {!loading && error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default ModelPreviewModal
