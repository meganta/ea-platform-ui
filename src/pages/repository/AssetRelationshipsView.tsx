import { useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { AssetProfile, RelationshipSlot, displayValue, localName } from './assetProfile'

type T = (k: string) => string
const PREVIEW = 12

export const slotLabel = (s: RelationshipSlot, isAR: boolean) => (isAR && s.labelAr) || s.label
export const arrow = (direction: string, isAR: boolean) => (direction === 'OUTGOING' ? (isAR ? '←' : '→') : (isAR ? '→' : '←'))

/**
 * Every relationship the Meta Model allows for the object's type, in each
 * direction, with the objects actually linked (or "none recorded"); then the
 * links that match no current definition. A linked object opens on click.
 */
export default function AssetRelationshipsView({ profile, t, isAR, onOpenAsset }: { profile: AssetProfile; t: T; isAR: boolean; onOpenAsset: (id: string, name: string) => void }) {
  const [filter, setFilter] = useState('')
  const [hideEmpty, setHideEmpty] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const q = filter.trim().toLowerCase()
  const match = (name: string, nameAr?: string | null) => !q || name.toLowerCase().includes(q) || (nameAr || '').toLowerCase().includes(q)
  const slots = (profile.relationshipSlots || []).filter(s => !hideEmpty || s.count > 0)
  const other = (profile.otherRelationships || []).filter(o => match(o.relatedAsset.name, o.relatedAsset.nameAr))

  if (!profile.relationshipSlots?.length && !profile.otherRelationships?.length) {
    return <p className="ap-empty">{t(profile.resolution === 'RESOLVED' ? 'repository.profile.no_relationship_types' : 'repository.profile.type_unresolved')}</p>
  }
  return (
    <div>
      <div className="ap-toolbar">
        <label htmlFor="ap-rel-filter" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('repository.profile.filter_related')}</label>
        <input id="ap-rel-filter" className="form-input" placeholder={t('repository.profile.filter_related')} value={filter} onChange={e => setFilter(e.target.value)} />
        <label className="ap-toggle" htmlFor="ap-hide-empty">
          <input id="ap-hide-empty" type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} />
          {t('repository.profile.hide_empty_relationships')}
        </label>
        <HelpTip text={t('repository.profile.relationships_help')} />
      </div>
      {profile.relationshipTotals?.truncated && <div className="ap-banner">{t('repository.profile.relationships_truncated')}</div>}
      {slots.map(s => {
        const key = `${s.definitionId}:${s.direction}`
        const items = s.items.filter(i => match(i.relatedAsset.name, i.relatedAsset.nameAr))
        if (q && !items.length) return null
        const shown = expanded[key] || q ? items : items.slice(0, PREVIEW)
        return (
          <section key={key} className="ap-slot" data-testid={`slot-${s.code}-${s.direction}`} aria-label={`${slotLabel(s, isAR)} ${localName(s.otherType, isAR)}`}>
            <div className="ap-slot-head">
              <div className="ap-slot-name">
                <span aria-hidden>{arrow(s.direction, isAR)}</span>
                <span>{slotLabel(s, isAR)}</span>
                <span className="ap-chip">{s.otherType?.icon ? `${s.otherType.icon} ` : ''}{localName(s.otherType, isAR) || '—'}</span>
                {s.isRequired && <span className={`ap-chip${s.count ? '' : ' ap-chip-warn'}`}>{t('repository.profile.required')}</span>}
                {s.single && <span className="ap-chip">{t('repository.profile.single')}</span>}
              </div>
              <span className="ap-slot-meta">{s.count}</span>
            </div>
            <div className="ap-slot-body">
              {!s.count ? <div className="ap-empty" style={{ fontSize: 12 }}>{t('repository.profile.none_recorded')}</div> : (
                <ul className="ap-items">
                  {shown.map(i => (
                    <li key={i.relationshipId} className="ap-item">
                      <div className="ap-item-main">
                        <button type="button" className="ap-link" onClick={() => onOpenAsset(i.relatedAsset.id, i.relatedAsset.name)}>{localName(i.relatedAsset, isAR)}</button>
                        {i.relatedAsset.status && <span className="ap-chip">{i.relatedAsset.status}</span>}
                      </div>
                      {s.attributes.length > 0 && (
                        <span className="ap-item-attrs">
                          {s.attributes.map(a => { const v = displayValue(a, i.metadata?.[a.code], isAR); return v ? `${localName(a, isAR)}: ${v}` : null }).filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!q && items.length > PREVIEW && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} aria-expanded={!!expanded[key]} onClick={() => setExpanded(e => ({ ...e, [key]: !e[key] }))}>
                  {expanded[key] ? t('repository.profile.show_less') : t('repository.profile.show_all').replace('{count}', String(items.length))}
                </button>
              )}
              {s.truncated && <div className="ap-slot-meta" style={{ marginTop: 6 }}>{t('repository.profile.slot_truncated').replace('{count}', String(s.count))}</div>}
            </div>
          </section>
        )
      })}
      {other.length > 0 && (
        <section className="ap-slot" aria-label={t('repository.profile.other_relationships')}>
          <div className="ap-slot-head"><div className="ap-slot-name">{t('repository.profile.other_relationships')}<HelpTip text={t('repository.profile.other_relationships_help')} /></div><span className="ap-slot-meta">{other.length}</span></div>
          <div className="ap-slot-body">
            <ul className="ap-items">
              {other.map(o => (
                <li key={o.relationshipId} className="ap-item">
                  <div className="ap-item-main">
                    <span aria-hidden>{arrow(o.direction, isAR)}</span>
                    <span className="ap-slot-meta">{o.label}</span>
                    <button type="button" className="ap-link" onClick={() => onOpenAsset(o.relatedAsset.id, o.relatedAsset.name)}>{localName(o.relatedAsset, isAR)}</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}
