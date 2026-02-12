const readEntries = (reader) =>
  new Promise((resolve) => {
    reader.readEntries((entries) => resolve(entries || []))
  })

const readFileEntry = (entry) =>
  new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    )
  })

const buildNode = async (entry, parentPath) => {
  if (entry.isFile) {
    const file = await readFileEntry(entry)
    if (!file) return null
    const name = entry.name || file.name || 'File'
    const relativePath = parentPath ? `${parentPath}/${name}` : name
    return { type: 'file', name, file, relativePath }
  }
  if (entry.isDirectory) {
    const reader = entry.createReader()
    const children = []
    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
    let entries = await readEntries(reader)
    while (entries.length > 0) {
      for (const child of entries) {
        const node = await buildNode(child, currentPath)
        if (node) children.push(node)
      }
      entries = await readEntries(reader)
    }
    return { type: 'folder', name: entry.name, children }
  }
  return null
}

const flattenItems = async (items) => {
  const entries = []
  for (const item of items) {
    if (item.kind !== 'file') continue
    const entry = item.webkitGetAsEntry?.()
    if (entry) {
      const node = await buildNode(entry, '')
      if (node) entries.push(node)
      continue
    }
    const file = item.getAsFile?.()
    if (file) {
      entries.push({ type: 'file', name: file.name || 'File', file, relativePath: file.name || 'File' })
    }
  }
  return entries
}

const hasWebkitEntrySupport = (items) => items.some((item) => typeof item.webkitGetAsEntry === 'function')

const readDroppedEntries = async (dataTransfer) => {
  const items = Array.from(dataTransfer?.items || [])
  const files = Array.from(dataTransfer?.files || [])
  const supportsFolders = items.length === 0 ? true : hasWebkitEntrySupport(items)
  if (items.length === 0) {
    return {
      supportsFolders,
      entries: files.map((file) => ({
        type: 'file',
        name: file.name || 'File',
        file,
        relativePath: file.name || 'File'
      }))
    }
  }
  if (!supportsFolders) {
    return {
      supportsFolders,
      entries: files.map((file) => ({
        type: 'file',
        name: file.name || 'File',
        file,
        relativePath: file.name || 'File'
      }))
    }
  }
  const entries = await flattenItems(items)
  if (entries.length === 0 && files.length > 0) {
    return {
      supportsFolders,
      entries: files.map((file) => ({
        type: 'file',
        name: file.name || 'File',
        file,
        relativePath: file.name || 'File'
      }))
    }
  }
  return { supportsFolders, entries }
}

export default readDroppedEntries
