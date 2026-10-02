import { QUADRANT, label } from './ideaLabels'

export interface MatrixPoint { id: string; title: string; value: number; ease: number; highlight?: boolean }

const THRESHOLD = 60

/**
 * Value vs Ease prioritization matrix (the classic 2x2: quick wins,
 * strategic bets, incremental, deprioritize). Plain SVG that scales to its
 * container; each point is a button so the matrix is keyboard-usable.
 */
export default function IdeaMatrix({ points, isAR, onSelect, compact = false }: { points: MatrixPoint[]; isAR: boolean; onSelect?: (id: string) => void; compact?: boolean }) {
  const W = 400, H = 300, P = 34
  const x = (ease: number) => P + ((W - P - 10) * ease) / 100
  const y = (value: number) => H - P - ((H - P - 10) * value) / 100
  const tx = x(THRESHOLD), ty = y(THRESHOLD)
  const quads: { code: string; x: number; y: number; w: number; h: number }[] = [
    { code: 'STRATEGIC_BET', x: P, y: 10, w: tx - P, h: ty - 10 },
    { code: 'QUICK_WIN', x: tx, y: 10, w: W - 10 - tx, h: ty - 10 },
    { code: 'DEPRIORITIZE', x: P, y: ty, w: tx - P, h: H - P - ty },
    { code: 'INCREMENTAL', x: tx, y: ty, w: W - 10 - tx, h: H - P - ty },
  ]
  const valueLabel = isAR ? 'القيمة' : 'Value'
  const easeLabel = isAR ? 'سهولة التنفيذ' : 'Ease of delivery'

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={isAR ? 'مصفوفة القيمة مقابل سهولة التنفيذ' : 'Value versus ease matrix'} data-testid="idea-matrix"
      style={{ width: '100%', maxWidth: compact ? 320 : 640, height: 'auto', display: 'block', direction: 'ltr' }}>
      {quads.map(q => (
        <g key={q.code}>
          <rect x={q.x} y={q.y} width={q.w} height={q.h} fill={QUADRANT[q.code].color} opacity={0.08} stroke="var(--border)" />
          <text x={q.x + q.w / 2} y={q.y + 16} textAnchor="middle" fontSize={compact ? 10 : 11} fontWeight={600} fill={QUADRANT[q.code].color}>{label(QUADRANT, q.code, isAR)}</text>
        </g>
      ))}
      <text x={12} y={(H - P) / 2} fontSize={10} fill="var(--text-dim)" textAnchor="middle" transform={`rotate(-90 12 ${(H - P) / 2})`}>{valueLabel} →</text>
      <text x={(W + P) / 2} y={H - 8} fontSize={10} fill="var(--text-dim)" textAnchor="middle">{easeLabel} →</text>
      {points.map(p => (
        <g key={p.id} transform={`translate(${x(p.ease)} ${y(p.value)})`}
          role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`${p.title}: ${valueLabel} ${p.value}, ${easeLabel} ${p.ease}`}
          style={{ cursor: onSelect ? 'pointer' : 'default' }}
          onClick={() => onSelect?.(p.id)}
          onKeyDown={e => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(p.id) } }}>
          <title>{`${p.title} (${valueLabel} ${p.value} · ${easeLabel} ${p.ease})`}</title>
          <circle r={p.highlight ? 8 : 6} fill={p.highlight ? 'var(--accent)' : '#38bdf8'} stroke="var(--navy)" strokeWidth={2} />
          {!compact && <text x={9} y={4} fontSize={9.5} fill="var(--text)">{p.title.length > 26 ? `${p.title.slice(0, 25)}…` : p.title}</text>}
        </g>
      ))}
    </svg>
  )
}
