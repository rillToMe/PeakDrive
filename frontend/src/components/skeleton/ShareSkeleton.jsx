import SkeletonBlock from './SkeletonBlock.jsx'

const ShareSkeleton = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SkeletonBlock className="h-12 w-12 rounded-2xl" />
        <div className="space-y-2">
          <SkeletonBlock className="h-5 w-40 rounded-full" />
          <SkeletonBlock className="h-3 w-64 rounded-full" />
        </div>
      </div>
      <SkeletonBlock className="h-64 w-full rounded-2xl" />
      <SkeletonBlock className="h-10 w-32 rounded-xl" />
    </div>
  )
}

export default ShareSkeleton
