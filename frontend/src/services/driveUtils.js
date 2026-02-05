export const getModelExtension = (filename) => {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.glb')) return 'glb'
  if (lower.endsWith('.gltf')) return 'gltf'
  if (lower.endsWith('.fbx')) return 'fbx'
  return ''
}

export const isModel = (filename) => Boolean(getModelExtension(filename))

const normalizeName = (value) => value.trim().toLowerCase()

const stripIndexSuffix = (value) => {
  const match = value.match(/^(.*)\s\((\d+)\)$/)
  if (!match) return { base: value, index: 0 }
  return { base: match[1], index: Number(match[2]) || 0 }
}

export const getUniqueName = (name, existingNames = []) => {
  const safeName = name?.trim() || 'New Folder'
  const existing = new Set(existingNames.map((item) => normalizeName(item)))
  const { base } = stripIndexSuffix(safeName)
  let index = 0
  let candidate = base
  while (existing.has(normalizeName(candidate))) {
    index += 1
    candidate = `${base} (${index})`
  }
  return candidate
}

export const getUniqueFileName = (filename, existingNames = []) => {
  const safeName = filename?.trim() || 'File'
  const existing = new Set(existingNames.map((item) => normalizeName(item)))
  const lastDot = safeName.lastIndexOf('.')
  const hasExt = lastDot > 0
  const baseWithSuffix = hasExt ? safeName.slice(0, lastDot) : safeName
  const ext = hasExt ? safeName.slice(lastDot) : ''
  const { base } = stripIndexSuffix(baseWithSuffix)
  let index = 0
  let candidate = `${base}${ext}`
  while (existing.has(normalizeName(candidate))) {
    index += 1
    candidate = `${base} (${index})${ext}`
  }
  return candidate
}
