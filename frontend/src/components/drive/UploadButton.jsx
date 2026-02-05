import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowUpFromBracket } from '@fortawesome/free-solid-svg-icons'

const UploadButton = ({ onUpload }) => {
  return (
    <label className="px-4 py-2 rounded-full border border-slate-300 bg-white text-slate-700 text-sm cursor-pointer hover:bg-slate-50 flex items-center gap-2 shadow-sm">
      <FontAwesomeIcon icon={faArrowUpFromBracket} />
      Upload
      <input type="file" className="hidden" multiple onChange={onUpload} />
    </label>
  )
}

export default UploadButton
