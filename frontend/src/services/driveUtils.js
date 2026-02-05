export const getModelExtension = (filename) => {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.glb')) return 'glb'
  if (lower.endsWith('.gltf')) return 'gltf'
  if (lower.endsWith('.fbx')) return 'fbx'
  return ''
}

export const isModel = (filename) => Boolean(getModelExtension(filename))
