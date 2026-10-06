import { ElementConformance, RefElement, STATUS_COLOR, STATUS_ORDER, T, buildTree, localName } from './refArch'

/**
 * The reference architecture drawn from its structured elements (never the
 * source slide): organising elements as boxes, components inside them,
 * coloured by conformance in the assessed architecture state. Every
 * element is a button that opens its details.
 */
export default function ReferenceDiagram({ elements, conformance, selected, onSelect, t, isAR }: {
  elements: RefElement[]
  conformance: Record<string, ElementConformance>
  selected: string | null
  onSelect: (key: string) => void
  t: T
  isAR: boolean
}) {
  const visible = elements.filter(e => e.reviewStatus !== 'REJECTED')
  if (!visible.length) return <p className="ap-empty">{t('refarch.diagram.empty')}</p>
  const { roots, children } = buildTree(visible)
  const statusOf = (k: string) => conformance[k]?.status
  const dot = (k: string) => {
    const s = statusOf(k)
    return s ? <span className="ra-dot" style={{ background: STATUS_COLOR[s] }} title={t(`refarch.conf.${s}`)} aria-hidden="true" /> : null
  }
  const label = (e: RefElement) => {
    const s = statusOf(e.stableKey)
    return `${localName(e, isAR)}${s ? ` - ${t(`refarch.conf.${s}`)}` : ''}${e.reviewStatus === 'PROPOSED' ? ` (${t('refarch.el.proposed')})` : ''}`
  }

  const render = (e: RefElement) => {
    const kids = children.get(e.stableKey) || []
    if (kids.length === 0) {
      return (
        <button key={e.stableKey} type="button" className={`ra-leaf${e.reviewStatus === 'PROPOSED' ? ' ra-leaf-proposed' : ''}`} aria-pressed={selected === e.stableKey} aria-label={label(e)} onClick={() => onSelect(e.stableKey)}>
          {dot(e.stableKey)}<span>{localName(e, isAR)}</span>
        </button>
      )
    }
    return (
      <div key={e.stableKey} className="ra-box" data-testid={`ra-box-${e.stableKey}`}>
        <button type="button" className="ra-box-head" aria-pressed={selected === e.stableKey} aria-label={label(e)} onClick={() => onSelect(e.stableKey)}>
          {dot(e.stableKey)}<span>{localName(e, isAR)}</span>
          <span className="ra-chip">{t(`refarch.ekind.${e.kind}`)}</span>
        </button>
        <div className="ra-box-children">{kids.map(render)}</div>
      </div>
    )
  }

  const present = STATUS_ORDER.filter(s => Object.values(conformance).some(c => c.status === s))
  return (
    <div>
      {present.length > 0 && (
        <div className="ra-legend" aria-label={t('refarch.diagram.legend')}>
          {present.map(s => <span key={s}><span className="ra-dot" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" />{t(`refarch.conf.${s}`)}</span>)}
        </div>
      )}
      <div className="ra-diagram" data-testid="ra-diagram">
        {/* Top-level leaves sit together in one box row so the page reads as a structure. */}
        {roots.filter(r => (children.get(r.stableKey) || []).length > 0).map(render)}
        {roots.some(r => !(children.get(r.stableKey) || []).length) && (
          <div className="ra-box-children">{roots.filter(r => !(children.get(r.stableKey) || []).length).map(render)}</div>
        )}
      </div>
    </div>
  )
}
