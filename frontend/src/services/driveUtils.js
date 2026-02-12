export const getModelExtension = (filename) => {
  const lower = filename.toLowerCase()
  if (lower.endsWith('.glb')) return 'glb'
  if (lower.endsWith('.gltf')) return 'gltf'
  if (lower.endsWith('.fbx')) return 'fbx'
  return ''
}

export const isModel = (filename) => Boolean(getModelExtension(filename))

export const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const decimals = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(decimals)} ${units[unitIndex]}`
}

const normalizeName = (value) => value.trim().toLowerCase()

export const getUniqueName = (name, existingNames = []) => {
  const safeName = name?.trim() || 'New Folder'
  const existing = new Set(existingNames.map((item) => normalizeName(item)))
  let index = 0
  let candidate = safeName
  while (existing.has(normalizeName(candidate))) {
    index += 1
    candidate = `${safeName} (${index})`
  }
  return candidate
}

export const getUniqueFileName = (filename, existingNames = []) => {
  const safeName = filename?.trim() || 'File'
  const existing = new Set(existingNames.map((item) => normalizeName(item)))
  const lastDot = safeName.lastIndexOf('.')
  const hasExt = lastDot > 0
  const base = hasExt ? safeName.slice(0, lastDot) : safeName
  const ext = hasExt ? safeName.slice(lastDot) : ''
  let index = 0
  let candidate = `${base}${ext}`
  while (existing.has(normalizeName(candidate))) {
    index += 1
    candidate = `${base} (${index})${ext}`
  }
  return candidate
}
