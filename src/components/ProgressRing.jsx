function polarToCartesian(cx, cy, radius, angleDegrees) {
  const angleRadians = ((angleDegrees - 90) * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy + radius * Math.sin(angleRadians),
  }
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle)
  const end = polarToCartesian(cx, cy, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'

  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ')
}

export default function ProgressRing({ percent }) {
  const clamped = Math.max(0, Math.min(100, percent))
  const endAngle = (clamped / 100) * 359.99

  return (
    <div className="relative h-16 w-16">
      <svg viewBox="0 0 120 120" className="h-full w-full">
        <circle cx="60" cy="60" r="48" className="fill-none stroke-[var(--ring-bg)]" strokeWidth="12" />
        {clamped > 0 && (
          <path
            d={describeArc(60, 60, 48, 0, endAngle)}
            className="fill-none stroke-[var(--ring-fg)]"
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold text-[var(--text)]">
        {Math.round(clamped)}%
      </div>
    </div>
  )
}
