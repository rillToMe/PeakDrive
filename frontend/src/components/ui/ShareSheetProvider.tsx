import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ShareSheetContext } from './shareSheetContext'
import type { ShareSheetContextValue } from './shareSheetContext'
import ShareSheet from './ShareSheet'
import useShare from './useShare'

interface ShareSheetProviderProps {
  children: ReactNode
}

const ShareSheetProvider = ({ children }: ShareSheetProviderProps) => {
  const { sheetOpen, shareUrl, loading, error, toast, copySuccess, platforms, openShare, closeSheet, handleCopy } =
    useShare()

  const value = useMemo<ShareSheetContextValue>(
    () => ({
      openShare
    }),
    [openShare]
  )

  return (
    <ShareSheetContext.Provider value={value}>
      {children}
      <ShareSheet
        open={sheetOpen}
        shareUrl={shareUrl}
        loading={loading}
        error={error}
        copySuccess={copySuccess}
        onClose={closeSheet}
        onCopy={handleCopy}
        platforms={platforms}
      />
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[130] px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm shadow-lg dark:bg-slate-100 dark:text-slate-900">
          {toast}
        </div>
      )}
    </ShareSheetContext.Provider>
  )
}

export default ShareSheetProvider
