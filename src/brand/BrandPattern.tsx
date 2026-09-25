import { useId } from 'react'

interface BrandPatternProps {
  /** flow = layered architectural contours; topology = connected capability nodes */
  variant?: 'flow' | 'topology'
  /** Overall opacity of the pattern (keep subtle: 0.15–0.6). */
  intensity?: number
  className?: string
}

// Layered contour lines: each line is a gentle, rising curve; together they read as
// architectural layers flowing toward a target state. Deterministic, no randomness.
const FLOW_LINES = Array.from({ length: 14 }, (_, i) => {
  const y = 520 - i * 18
  const lift = 150 + i * 9
  return `M-40 ${y + 60} C 260 ${y + 40}, 420 ${y - lift * 0.35}, 700 ${y - lift * 0.55} S 1120 ${y - lift * 0.2}, 1480 ${y - lift * 0.62}`
})

// Capability nodes on an orthogonal grid, joined by relationship paths.
const NODES: Array<[number, number]> = [[180, 140], [420, 90], [660, 190], [900, 110], [1140, 210], [300, 330], [560, 380], [820, 320], [1060, 400], [1300, 300]]
const LINKS: Array<[number, number]> = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [8, 9], [2, 7], [4, 9], [1, 6]]

/** Decorative supporting pattern derived from the brand idea (architecture + flow + intelligence). Never a logo substitute. */
export default function BrandPattern({ variant = 'flow', intensity = 0.4, className = '' }: BrandPatternProps) {
  const id = useId().replace(/:/g, '')
  return (
    <div className={`am-pattern ${className}`} aria-hidden="true" style={{ opacity: intensity }}>
      <svg viewBox="0 0 1440 600" preserveAspectRatio="xMidYMid slice" focusable="false">
        <defs>
          <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="0.35" stopColor="#2563EB" />
            <stop offset="0.7" stopColor="#06B6D4" />
            <stop offset="1" stopColor="#14B8A6" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {variant === 'flow'
          ? <g fill="none" stroke={`url(#g-${id})`} strokeWidth="1.1">{FLOW_LINES.map((d, i) => <path key={i} d={d} strokeOpacity={0.25 + (i / FLOW_LINES.length) * 0.6} />)}</g>
          : <g>
              <g fill="none" stroke={`url(#g-${id})`} strokeWidth="1">
                {LINKS.map(([a, b], i) => { const [x1, y1] = NODES[a]; const [x2, y2] = NODES[b]; const mx = (x1 + x2) / 2; return <path key={i} d={`M${x1} ${y1} H${mx} V${y2} H${x2}`} strokeOpacity="0.55" /> })}
              </g>
              {NODES.map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="9" fill="none" stroke="#67E8F9" strokeOpacity="0.5" /><circle cx={x} cy={y} r="3" fill={i % 3 === 0 ? '#14B8A6' : '#2563EB'} /></g>)}
            </g>}
      </svg>
    </div>
  )
}
