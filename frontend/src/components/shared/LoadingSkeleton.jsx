export default function LoadingSkeleton({ type = 'card', count = 3 }) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-stagger">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-surface-lowest rounded-2xl overflow-hidden shadow-ambient">
            <div className="skeleton h-48 w-full" />
            <div className="p-5 space-y-3">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-16 rounded-full" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
              <div className="skeleton h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-surface-lowest rounded-2xl shadow-ambient overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="skeleton h-10 w-full rounded-lg" />
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="skeleton h-8 w-8 rounded-full" />
              <div className="skeleton h-4 flex-1" />
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="bg-surface-lowest rounded-2xl p-6 shadow-ambient animate-fade-in">
        <div className="flex items-center gap-5 mb-6">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="space-y-2">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-4 w-56" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="skeleton h-11 w-full rounded-lg" />
          <div className="grid grid-cols-2 gap-4">
            <div className="skeleton h-11 w-full rounded-lg" />
            <div className="skeleton h-11 w-full rounded-lg" />
          </div>
          <div className="skeleton h-10 w-32 rounded-xl" />
        </div>
      </div>
    );
  }

  return null;
}
