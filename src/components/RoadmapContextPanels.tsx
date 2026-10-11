import { useEffect, useMemo, useState } from 'react'
import HelpTip from './HelpTip'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { day, fill, makeRoadmapApi, STATUS_TONE } from '../pages/planning/roadmapModel'
import { Chip } from '../pages/planning/RoadmapChip'
import '../pages/planning/Roadmap.css'

// Architecture roadmap context shown inside other modules - read from
// /architecture-roadmap, never recomputed here. Hidden without Roadmap.View.

const box: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--navy-light)', marginTop: 12 }
const ROADMAP_LINK = '/ea-planning?tab=target'

function useRoadmap<T>(path: string | null) {
  const { hasPermission } = useAuth()
  const allowed = hasPermission?.('Roadmap.View') ?? false
  const api = useMemo(() => makeRoadmapApi(), [])
  const [data, setData] = useState<T | null>(null)
  useEffect(() => { if (allowed && path) api.get(path).then(setData).catch(() => setData(null)) }, [api, path, allowed])
  return allowed ? data : null
}

/** Governance: a review's Repository objects against the enterprise roadmap. */
export function GovernanceTargetPanel({ reviewId }: { reviewId: string }) {
  const { t } = useLang()
  const data = useRoadmap<any>(`/architecture-roadmap/governance-reviews/${reviewId}/target-alignment`)
  if (!data) return null
  return (
    <section style={box} aria-label={t('roadmap.align.title')} data-testid="gov-roadmap">
      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>🎯 {t('roadmap.align.title')}<HelpTip text={t('roadmap.align.help')} /></div>
      {!data.roadmap ? <p className="rm-muted" style={{ marginTop: 6 }}>{t('roadmap.align.none')}</p> : data.objects.length === 0 ? <p className="rm-muted" style={{ marginTop: 6 }}>{t('roadmap.align.no_objects')}</p> : (
        <>
          <div className="rm-row" style={{ margin: '8px 0' }}>
            {(['RETIRING', 'PLANNED_NEW', 'CHANGING', 'STAYS'] as const).map(k => {
              const n = data.objects.filter((o: any) => o.classification === k).length
              return n ? <Chip key={k} tone={STATUS_TONE[k]}>{t(`roadmap.align.class.${k}`)}: {n}</Chip> : null
            })}
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {data.objects.filter((o: any) => o.classification !== 'STAYS').map((o: any) => (
              <li key={o.objectId} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                <Chip tone={STATUS_TONE[o.classification]}>{t(`roadmap.align.class.${o.classification}`)}</Chip>{' '}
                <a href={`/repository?asset=${o.objectId}`}>{o.objectName}</a> <span className="rm-muted">{o.objectType}</span>
                {o.stateName && <span className="rm-muted"> · {fill(t('roadmap.align.in_state'), { state: o.stateName, date: day(o.horizonDate) || t('roadmap.not_set') })}{o.workPackageName ? ` · ${o.workPackageName}` : ''}</span>}
                {o.introducedInSameState?.length > 0 && <div className="rm-muted">{fill(t('roadmap.align.same_state_new'), { names: o.introducedInSameState.map((x: any) => x.name).join(', ') })}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** Architecture Health domain view: what the roadmap changes in the domain. */
export function HealthDomainRoadmap({ domainCode }: { domainCode: string }) {
  const { t } = useLang()
  const data = useRoadmap<any>(`/architecture-roadmap/domains/${encodeURIComponent(domainCode)}`)
  if (!data?.roadmap) return null
  const s = data.summary
  return (
    <section style={box} aria-label={t('roadmap.health.title')} data-testid="health-roadmap">
      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span>🎯 {t('roadmap.health.title')}</span><a className="btn btn-secondary btn-sm" href={ROADMAP_LINK}>{t('roadmap.health.open')}</a>
      </div>
      <p className="rm-muted" style={{ marginTop: 6 }}>{s.total ? fill(t('roadmap.health.summary'), { ...s, date: day(data.roadmap.targetDate) }) : t('roadmap.health.none')}</p>
      {data.measures?.map((m: any) => (
        <div key={m.id} className="rm-row" style={{ fontSize: 13 }}>
          <Chip tone={STATUS_TONE[m.status]}>{t(`roadmap.m.status.${m.status}`)}</Chip> {t('roadmap.m.target')}: {m.targetValue} · {t('roadmap.m.current')}: {m.current ?? '—'} · {m.stateName} {day(m.dueDate)}
        </div>
      ))}
    </section>
  )
}

/** Repository object page: what the roadmap does to this object. */
export function AssetFutureState({ assetId }: { assetId: string }) {
  const { t } = useLang()
  const data = useRoadmap<any>(`/architecture-roadmap/assets/${assetId}`)
  if (!data?.roadmap) return null
  const a = data.asset
  return (
    <section className="ap-section" aria-label={t('roadmap.asset.title')} data-testid="asset-roadmap">
      <div className="ap-section-title">🎯 {t('roadmap.asset.title')}</div>
      {(a?.effectiveFrom || a?.effectiveUntil) && <p className="rm-muted" style={{ margin: '0 0 6px' }}>{fill(t('roadmap.asset.dates'), { from: day(a.effectiveFrom) || '—', until: day(a.effectiveUntil) || '—' })}</p>}
      {data.changes.length === 0 ? <p className="ap-empty" style={{ margin: 0 }}>{t('roadmap.asset.stays')}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.changes.map((c: any, i: number) => (
            <li key={i} style={{ padding: '5px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <Chip tone={c.change === 'RETIRE' || c.change === 'LINK_REMOVE' ? 'warn' : 'info'}>{t(`roadmap.change.${c.change}`)}</Chip>{' '}
              {c.other && <>{c.relationshipType} · <a href={`/repository?asset=${c.other.id}`}>{c.other.name}</a> · </>}
              {c.stateName} <span className="rm-muted">{day(c.horizonDate)}{c.workPackageName ? ` · ${c.workPackageName}` : ` · ${t('roadmap.changes.unplanned')}`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Dashboard card: progress towards the enterprise Target. */
export function DashboardRoadmapCard({ onOpen }: { onOpen: () => void }) {
  const { t } = useLang()
  const data = useRoadmap<any>('/architecture-roadmap/summary')
  if (!data) return null
  return (
    <section className="card dsh-card" aria-label={t('roadmap.dash.title')} data-testid="dash-roadmap">
      <div className="dsh-card-head">
        <h2 className="dsh-card-title">{t('roadmap.dash.title')}<HelpTip text={t('roadmap.dash.help')} /></h2>
        <button type="button" className="dsh-link" onClick={onOpen}>{t('dashboard.open')}</button>
      </div>
      {!data.roadmap ? <p className="dsh-muted">{t('roadmap.dash.none')}</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="rm-line" role="list" style={{ padding: 0 }}>
            {data.line.map((s: any) => (
              <div key={s.id} role="listitem" className={`rm-state ${s.label}`} style={{ flexBasis: 120, padding: '8px 10px' }}>
                <div className="rm-state-kicker">{fill(t(`roadmap.label.${s.label}`), { n: s.transitionNumber ?? '' })}</div>
                <div className="rm-state-meta">{day(s.horizonDate) || (s.label === 'CURRENT' ? '' : t('roadmap.not_set'))}{s.label !== 'CURRENT' ? ` · ${fill(t('roadmap.state.changes'), { n: s.changes })}` : ''}</div>
                {data.inEffect?.state?.id === s.id && <Chip tone="info">{t('roadmap.dash.in_effect')}</Chip>}
              </div>
            ))}
          </div>
          <div className="dsh-muted" style={{ fontSize: 12 }}>
            {fill(t('roadmap.kpi.delivered_sub'), { delivered: data.progress.changes.delivered, remaining: data.progress.changes.remaining })}{data.progress.deliveredShare != null ? ` (${data.progress.deliveredShare}%)` : ''} · {t('roadmap.kpi.unplanned')}: {data.progress.changes.unplanned}
          </div>
          {data.upcoming?.length > 0 && <div>
            <span className="dsh-mini-title">{t('roadmap.dash.upcoming')}</span>
            <ul className="dsh-list">{data.upcoming.map((w: any) => (
              <li key={w.id}><button type="button" className="dsh-list-item" onClick={onOpen}>
                <span className="dsh-list-main"><span className="dsh-list-title">{w.name}</span><span className="dsh-list-sub">{t(`roadmap.wp.status.${w.status}`)}</span></span>
                <span className={`rm-chip ${w.overdue ? 'bad' : 'muted'}`}>{day(w.endDate)}</span>
              </button></li>
            ))}</ul>
          </div>}
        </div>
      )}
    </section>
  )
}
