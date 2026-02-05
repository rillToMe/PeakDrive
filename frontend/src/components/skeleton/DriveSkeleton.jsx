import SkeletonBlock from './SkeletonBlock.jsx'

const DriveSkeleton = () => {
  return (
    <div className="grid gap-6">
      <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm dark:bg-[#202225] dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock className="h-4 w-24 rounded-full" />
          <SkeletonBlock className="h-3 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`folder-skel-${index}`}
              className="p-3 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2 dark:bg-[#1F2023] dark:border-slate-700"
            >
              <SkeletonBlock className="h-4 w-20 rounded-full" />
              <SkeletonBlock className="h-3 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </section>
      <section className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm dark:bg-[#202225] dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <SkeletonBlock className="h-4 w-20 rounded-full" />
          <SkeletonBlock className="h-3 w-16 rounded-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`file-skel-${index}`}
              className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3 dark:bg-[#1F2023] dark:border-slate-700"
            >
              <div className="flex items-center justify-between">
                <SkeletonBlock className="h-4 w-40 rounded-full" />
                <SkeletonBlock className="h-8 w-8 rounded-full" />
              </div>
              <SkeletonBlock className="h-32 w-full rounded-xl" />
              <SkeletonBlock className="h-3 w-24 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default DriveSkeleton
