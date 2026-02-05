import SkeletonBlock from './SkeletonBlock.jsx'

const AdminSkeleton = () => {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={`admin-row-${index}`} className="flex items-center gap-3">
          <SkeletonBlock className="h-4 w-12 rounded-full" />
          <SkeletonBlock className="h-4 w-44 rounded-full" />
          <SkeletonBlock className="h-4 w-16 rounded-full" />
          <SkeletonBlock className="h-4 w-24 rounded-full" />
          <SkeletonBlock className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default AdminSkeleton
