import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, useFBX, useGLTF } from '@react-three/drei'

const SceneCanvas = ({ containerClassName, children }) => (
  <div className={`w-full rounded-lg bg-slate-100 overflow-hidden ${containerClassName}`}>
    <Canvas style={{ width: '100%', height: '100%' }} frameloop="demand">
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 2, 2]} intensity={0.6} />
      <Suspense fallback={null}>{children}</Suspense>
      <OrbitControls enablePan={false} />
    </Canvas>
  </div>
)

const GLTFViewer = ({ url, containerClassName }) => {
  const model = useGLTF(url)
  return (
    <SceneCanvas containerClassName={containerClassName}>
      <primitive object={model.scene} scale={1} />
    </SceneCanvas>
  )
}

const FBXViewer = ({ url, containerClassName }) => {
  const model = useFBX(url)
  return (
    <SceneCanvas containerClassName={containerClassName}>
      <primitive object={model} scale={1} />
    </SceneCanvas>
  )
}

const ModelViewer = ({ url, format, containerClassName = 'h-40' }) => {
  const formatValue = (format || '').toLowerCase()
  const isFbx = formatValue === 'fbx' || formatValue.endsWith('.fbx')
  if (isFbx) {
    return <FBXViewer url={url} containerClassName={containerClassName} />
  }
  return <GLTFViewer url={url} containerClassName={containerClassName} />
}

export default ModelViewer
