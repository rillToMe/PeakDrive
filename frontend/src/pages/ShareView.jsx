import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload, faFileLines, faShareNodes } from '@fortawesome/free-solid-svg-icons'
import ModelViewer from '../components/ModelViewer.jsx'
import ShareSkeleton from '../components/skeleton/ShareSkeleton.jsx'

const ShareView = () => {
  const { token } = useParams()
  const location = useLocation()
  const isFolderShare = location.pathname.startsWith('/s/folder/')
  const [blobUrl, setBlobUrl] = useState('')
  const [fileType, setFileType] = useState('')
  const [filename, setFilename] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl = ''
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const endpoint = isFolderShare ? `/s/folder/${token}` : `/s/${token}`
        const response = await fetch(endpoint)
        if (!response.ok) {
          throw new Error('Share link tidak valid.')
        }
        const type = response.headers.get('content-type') || ''
        const disposition = response.headers.get('content-disposition') || ''
        const fileNameMatch = disposition.match(/filename="(.+)"/)
        const nameFromHeader = fileNameMatch ? fileNameMatch[1] : ''
        const blob = await response.blob()
        objectUrl = URL.createObjectURL(blob)
        setBlobUrl(objectUrl)
        setFileType(type)
        const fallbackName = isFolderShare ? 'shared-folder.zip' : 'shared-file'
        setFilename(nameFromHeader || fallbackName)
        setFileSize(blob.size)
      } catch (err) {
        setError(err.message || 'Gagal membuka share link.')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [token, isFolderShare])

  const lowerName = filename.toLowerCase()
  const isModel = lowerName.endsWith('.glb') || lowerName.endsWith('.gltf') || lowerName.endsWith('.fbx')
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  const isLargeModel = fileSize > 200 * 1024 * 1024
  const disableModelPreview = isMobile || isLargeModel
  const title = isFolderShare ? 'Share Folder' : 'Share File'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-3xl bg-white shadow-sm rounded-2xl p-6 border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
            <FontAwesomeIcon icon={faShareNodes} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            <p className="text-sm text-slate-500">{filename}</p>
          </div>
        </div>

        {loading && <ShareSkeleton />}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-4">
            {fileType.startsWith('image/') && (
              <img src={blobUrl} alt={filename} className="w-full max-h-[420px] object-contain rounded-2xl" />
            )}
            {fileType.startsWith('video/') && (
              <video src={blobUrl} controls className="w-full rounded-2xl bg-black" />
            )}
            {isModel && !disableModelPreview && (
              <ModelViewer url={blobUrl} format={lowerName} containerClassName="h-64" />
            )}
            {isModel && disableModelPreview && (
              <div className="h-48 w-full rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
                <FontAwesomeIcon icon={faFileLines} />
                Preview 3D dinonaktifkan
              </div>
            )}
            {!fileType.startsWith('image/') && !fileType.startsWith('video/') && !isModel && (
              <div className="h-48 w-full rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center justify-center text-sm text-slate-500 gap-2">
                <FontAwesomeIcon icon={faFileLines} />
                Preview tidak tersedia
              </div>
            )}
            <a
              href={blobUrl}
              download={filename}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm hover:bg-slate-800 gap-2"
            >
              <FontAwesomeIcon icon={faDownload} />
              Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

export default ShareView
