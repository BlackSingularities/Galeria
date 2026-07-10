const HEIGHTS = [280, 340, 220, 380, 260, 320, 240, 300, 360, 220, 280, 340]

export default function SkeletonGrid({ count = 12 }) {
  return (
    <div className="photo-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-item" style={{ height: HEIGHTS[i % HEIGHTS.length] }} />
      ))}
    </div>
  )
}
