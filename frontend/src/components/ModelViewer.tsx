import { Suspense } from 'react'
import type { ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useFBX, useGLTF } from '@react-three/drei'
import type { Object3D } from 'three'

interface SceneCanvasProps {
  containerClassName?: string
  children: ReactNode
}

const SceneCanvas = ({ containerClassName, children }: SceneCanvasProps) => (
  <div className={`w-full rounded-lg bg-slate-100 overflow-hidden ${containerClassName ?? ''}`}>
    <Canvas style={{ width: '100%', height: '100%' }} frameloop="demand">
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 2, 2]} intensity={0.6} />
      <Suspense fallback={null}>{children}</Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  </div>
)

interface ViewerProps {
  url: string
  containerClassName?: string
}

const GLTFViewer = ({ url, containerClassName }: ViewerProps) => {
  const model = useGLTF(url)
  return (
    <SceneCanvas containerClassName={containerClassName}>
      <primitive object={model.scene} scale={1} />
    </SceneCanvas>
  )
}

const FBXViewer = ({ url, containerClassName }: ViewerProps) => {
  const model = useFBX(url) as unknown as Object3D
  return (
    <SceneCanvas containerClassName={containerClassName}>
      <primitive object={model} scale={1} />
    </SceneCanvas>
  )
}

interface ModelViewerProps {
  url: string
  format: string
  containerClassName?: string
}

const ModelViewer = ({ url, format, containerClassName = 'h-40' }: ModelViewerProps) => {
  const formatValue = (format || '').toLowerCase()
  const isFbx = formatValue === 'fbx' || formatValue.endsWith('.fbx')
  if (isFbx) {
    return <FBXViewer url={url} containerClassName={containerClassName} />
  }
  return <GLTFViewer url={url} containerClassName={containerClassName} />
}

export default ModelViewer
