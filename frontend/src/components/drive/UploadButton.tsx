import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpFromBracket } from '@fortawesome/free-solid-svg-icons'
import type { ChangeEvent } from 'react'

interface UploadButtonProps {
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
}

const UploadButton = ({ onUpload }: UploadButtonProps) => {
  return (
    <label className="px-4 py-2 rounded-full bg-sky-600 text-white text-sm font-medium cursor-pointer hover:bg-sky-500 flex items-center gap-2 shadow-sm ring-1 ring-sky-200/60 dark:ring-sky-500/40">
      <FontAwesomeIcon icon={faArrowUpFromBracket} />
      Upload
      <input type="file" className="hidden" multiple onChange={onUpload} />
    </label>
  )
}

export default UploadButton
