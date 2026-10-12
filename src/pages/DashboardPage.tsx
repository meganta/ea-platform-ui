import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { useBranding } from '../contexts/BrandingContext'
import { getToken } from '../lib/api'
import HelpTip from '../components/HelpTip'
import {
  AttentionItem, DECISION_ORDER, GovStats, HealthDomain, Insight, SEVERITY_ORDER, TopAction,
  attentionItems, decisionShares, enterpriseCompleteness, enterpriseMaturity, pct, rankDomains,
} from './dashboard/dashboardModel'
import './dashboard/Dashboard.css'
import { DashboardRoadmapCard } from '../components/RoadmapContextPanels'

const API = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

// Status colours (validated as a set for colour-vision deficiency): best -> worst outcome.
const DECISION_COLOR: Record<string, string> = { APPROVED: '#15803D', APPROVED_WITH_CONDITIONS: '#D9A300', REQUIRES_CHANGES: '#E8590C', REJECTED: '#9F1239' }
const SEVERITY_COLOR: Record<string, string> = { CRITICAL: '#9F1239', HIGH: '#E8590C', MEDIUM: '#D9A300', LOW: '#64748B', POSITIVE: '#15803D' }

interface Data {
  summary: any | null
  health: { domains: HealthDomain[]; topActions?: TopAction[] } | null
  insights: Insight[] | null
  gov: GovStats | null
  reviews: any[] | null
  plans: any | null
  cycles: any[] | null
}
const EMPTY: Data = { summary: null, health: null, insights: null, gov: null, reviews: null, plans: null, cycles: null }

function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString())
}

export default function DashboardPage() {
  const nav = useNavigate()
  const { t, isAR } = useLang()
  const { hasPermission } = useAuth()
  const { branding } = useBranding()
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  const can = useMemo(() => ({
    repository: hasPermission('Repository.View'),
    health: hasPermission('ArchitectureHealth.View'),
    reviews: hasPermission('Reviews.View'),
    copilot: hasPermission('AIArchitect.Use'),
    views: hasPermission('Views.View'),
  }), [hasPermission])

  // Each source is fetched only with its module's permission (the menu's rules), and a failing source never blanks the page.
  const load = useCallback(async () => {
    setLoading(true)
    const get = (path: string) => fetch(API + path, { headers: { Authorization: 'Bearer ' + (getToken() || '') } }).then(r => (r.ok ? r.json() : null)).catch(() => null)
    const asList = (d: any) => (Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : null)
    const [summary, health, insights, gov, reviews, plans, cycles] = await Promise.all([
      can.repository ? get('/ea-repository/summary') : null,
      can.health ? get('/architecture-health/enterprise') : null,
      can.health ? get('/architecture-health/insights') : null,
      can.reviews ? get('/governance/stats') : null,
      can.reviews ? get('/governance/reviews?page=1&limit=5') : null,
      can.repository ? get('/ea-planning/dashboard') : null,
      can.repository ? get('/adm/cycles') : null,
    ])
    setData({
      summary, health: health && Array.isArray(health.domains) ? health : null,
      insights: insights && Array.isArray(insights.insights) ? insights.insights : null,
      gov, reviews: asList(reviews), plans, cycles: asList(cycles),
    })
    setUpdatedAt(new Date())
    setLoading(false)
  }, [can])
  useEffect(() => { load() }, [load])

  const domains = data.health?.domains || []
  const maturity = enterpriseMaturity(domains)
  const completeness = enterpriseCompleteness(domains)
  const attention = attentionItems({ insights: data.insights || [], topActions: data.health?.topActions, gov: data.gov })
  const orgName = isAR ? (branding?.organizationNameAr || branding?.organizationNameEn) : (branding?.organizationNameEn || branding?.organizationNameAr)
  // Latin digits in both languages, so counts, percentages and scores read the same way everywhere on the page.
  const numLocale = isAR ? 'ar-SA-u-nu-latn' : 'en-US'
  const fmtNum = (n: number) => n.toLocaleString(numLocale)

  return (
    <div className="dsh" dir={isAR ? 'rtl' : 'ltr'}>
      <header className="dsh-hero">
        <div className="dsh-hero-text">
          <h1 className="dsh-title">{t('dashboard.title')}</h1>
          <p className="dsh-subtitle">{orgName ? `${orgName} · ` : ''}{t('dashboard.subtitle')}</p>
        </div>
        <div className="dsh-hero-actions">
          {can.copilot && <button type="button" className="btn btn-primary btn-sm" onClick={() => nav('/copilot')}>{t('dashboard.qa.copilot')}</button>}
          {can.repository && <button type="button" className="btn btn-secondary btn-sm" onClick={() => nav('/repository')}>{t('dashboard.qa.repository')}</button>}
          {can.views && <button type="button" className="btn btn-secondary btn-sm" onClick={() => nav('/ea-views')}>{t('dashboard.qa.views')}</button>}
          {can.reviews && <button type="button" className="btn btn-secondary btn-sm" onClick={() => nav('/governance')}>{t('dashboard.qa.review')}</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={load} disabled={loading} aria-label={t('dashboard.refresh')}>⟳ {t('dashboard.refresh')}</button>
        </div>
        {updatedAt && <div className="dsh-updated">{t('dashboard.updated')}: {updatedAt.toLocaleTimeString(numLocale, { hour: '2-digit', minute: '2-digit' })}</div>}
      </header>

      {loading && !updatedAt && <div className="dsh-loading" aria-busy="true">{t('dashboard.loading')}</div>}

      {updatedAt && <>
        <section className="dsh-kpis" aria-label={t('dashboard.title')}>
          {can.repository && data.summary && (
            <Kpi label={t('dashboard.kpi.objects')} help={t('dashboard.kpi.objects_help')} value={fmtNum(data.summary.total ?? 0)} onOpen={() => nav('/repository')}
              sub={fill(t('dashboard.kpi.objects_sub'), { approved: fmtNum(statusCount(data.summary, 'APPROVED')), deprecated: fmtNum(statusCount(data.summary, 'DEPRECATED')) })} />
          )}
          {can.health && maturity && (
            <Kpi label={t('dashboard.kpi.maturity')} help={t('dashboard.kpi.maturity_help')} value={fill(t('dashboard.kpi.maturity_value'), { level: maturity.level })} onOpen={() => nav('/architecture-health')}
              meter={{ value: maturity.score, target: maturity.targetLevel ? (maturity.targetLevel - 1) * 20 : null }}
              sub={fill(t('dashboard.kpi.maturity_sub'), { score: Math.round(maturity.score), target: maturity.targetLevel ?? '—', below: maturity.belowTarget, measured: maturity.measured })} />
          )}
          {can.health && completeness != null && (
            <Kpi label={t('dashboard.kpi.completeness')} help={t('dashboard.kpi.completeness_help')} value={pct(completeness)} meter={{ value: completeness, target: null }} sub={t('dashboard.kpi.completeness_sub')} onOpen={() => nav('/architecture-health')} />
          )}
          {can.reviews && data.gov?.summary && (data.gov.summary.completedReviews ?? 0) > 0 && (
            <Kpi label={t('dashboard.kpi.governance')} help={t('dashboard.kpi.governance_help')} value={`${data.gov.summary.avgOverallScore ?? '—'}/100`} onOpen={() => nav('/governance')}
              tone={(data.gov.summary.criticalOpenFindings ?? 0) > 0 ? 'critical' : undefined}
              sub={fill(t('dashboard.kpi.governance_sub'), { critical: fmtNum(data.gov.summary.criticalOpenFindings ?? 0) })} />
          )}
          {can.repository && data.plans && (data.plans.total ?? 0) > 0 && (
            <Kpi label={t('dashboard.kpi.plans')} help={t('dashboard.kpi.plans_help')} value={pct(data.plans.avgProgress)} meter={{ value: data.plans.avgProgress ?? 0, target: null }} onOpen={() => nav('/ea-planning')}
              sub={fill(t('dashboard.kpi.plans_sub'), { active: data.plans.active ?? 0, risk: data.plans.highRisk ?? 0 })} />
          )}
        </section>

        {can.health && (
          <div className="dsh-row dsh-row-main">
            <section className="card dsh-card">
              <CardHead title={t('dashboard.domains.title')} help={t('dashboard.domains.help')} action={{ label: t('dashboard.open'), onClick: () => nav('/architecture-health') }} />
              {!data.health ? <p className="dsh-muted">{t('dashboard.unavailable')}</p> : domains.length === 0 ? <p className="dsh-muted">{t('dashboard.domains.empty')}</p> : (
                <div className="dsh-table-wrap">
                  <table className="dsh-table">
                    <thead><tr>
                      <th scope="col">{t('dashboard.domains.domain')}</th>
                      <th scope="col" className="num">{t('dashboard.domains.objects')}</th>
                      <th scope="col">{t('dashboard.domains.maturity')}</th>
                      <th scope="col">{t('dashboard.domains.completeness')}</th>
                      <th scope="col">{t('dashboard.domains.relationships')}</th>
                      <th scope="col">{t('dashboard.domains.reference')}</th>
                    </tr></thead>
                    <tbody>
                      {rankDomains(domains).map(d => {
                        const name = (isAR && d.domain.nameAr) || d.domain.name
                        const m = d.maturity
                        const below = m.level != null && m.targetLevel != null && m.level < m.targetLevel
                        return (
                          <tr key={d.domain.code} className="dsh-clickable" tabIndex={0} onClick={() => nav(`/architecture-health?domain=${d.domain.code}`)}
                            onKeyDown={e => { if (e.key === 'Enter') nav(`/architecture-health?domain=${d.domain.code}`) }}>
                            <th scope="row">{name}</th>
                            <td className="num">{fmtNum(d.objectCount)}</td>
                            <td>
                              <div className="dsh-cell-bar">
                                <Bar value={m.score} target={m.targetLevel ? (m.targetLevel - 1) * 20 : null} label={`${name}: ${Math.round(m.score ?? 0)}`} />
                                <span className={`dsh-level${below ? ' below' : ''}`}>{m.level != null ? fill(t('dashboard.domains.level'), { level: m.level, target: m.targetLevel ?? '—' }) : '—'}</span>
                              </div>
                            </td>
                            <td><BarCell value={d.completeness} name={name} /></td>
                            <td><BarCell value={d.relationshipCompleteness} name={name} /></td>
                            <td><BarCell value={d.referenceCoverage} name={name} /></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="card dsh-card">
              <CardHead title={t('dashboard.attention.title')} help={t('dashboard.attention.help')} />
              {attention.items.length === 0 ? <p className="dsh-muted">{t('dashboard.attention.none')}</p> : (
                <ul className="dsh-attention">
                  {attention.items.map(item => <AttentionRow key={item.key} item={item} t={t} fmtNum={fmtNum} onOpen={() => nav(item.link)} />)}
                </ul>
              )}
              {attention.more > 0 && <button type="button" className="dsh-link" onClick={() => nav('/architecture-health')}>{fill(t('dashboard.attention.more'), { count: attention.more })} →</button>}
              {attention.positive.length > 0 && (
                <div className="dsh-good">
                  <div className="dsh-mini-title">{t('dashboard.attention.good_news')}</div>
                  <ul>{attention.positive.slice(0, 3).map(p => <li key={p.key}><span aria-hidden="true">▲</span> {p.title}</li>)}</ul>
                </div>
              )}
            </section>
          </div>
        )}

        <div className="dsh-row dsh-row-split">
          {can.reviews && (
            <section className="card dsh-card">
              <CardHead title={t('dashboard.gov.title')} help={t('dashboard.gov.help')} action={{ label: t('dashboard.view_all'), onClick: () => nav('/governance') }} />
              {!data.gov?.summary || !(data.gov.summary.completedReviews ?? 0) ? <p className="dsh-muted">{t('dashboard.gov.none')}</p> : <Governance gov={data.gov} reviews={data.reviews || []} t={t} isAR={isAR} fmtNum={fmtNum} onOpen={() => nav('/governance')} />}
            </section>
          )}
          <div className="dsh-stack">
            <DashboardRoadmapCard onOpen={() => nav('/ea-planning?tab=target')} />
            {can.repository && data.summary?.byDomain?.length > 0 && (
              <section className="card dsh-card">
                <CardHead title={t('dashboard.repo.title')} help={t('dashboard.repo.help')} action={{ label: t('dashboard.open'), onClick: () => nav('/repository') }} />
                <RepositoryBars rows={data.summary.byDomain} fmtNum={fmtNum} />
              </section>
            )}
            {can.repository && (data.plans || data.cycles) && (
              <section className="card dsh-card">
                <CardHead title={t('dashboard.delivery.title')} help={t('dashboard.delivery.help')} />
                <Delivery plans={data.plans} cycles={data.cycles || []} t={t} onPlans={() => nav('/ea-planning')} onCycles={() => nav('/adm')} />
              </section>
            )}
          </div>
        </div>
      </>}
    </div>
  )
}

function statusCount(summary: any, status: string): number {
  return (summary?.byStatus || []).find((s: any) => s.status === status)?.count ?? 0
}

function CardHead({ title, help, action }: { title: string; help: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="dsh-card-head">
      <h2 className="dsh-card-title">{title}<HelpTip text={help} /></h2>
      {action && <button type="button" className="dsh-link" onClick={action.onClick}>{action.label} →</button>}
    </div>
  )
}

function Kpi({ label, value, sub, help, onOpen, meter, tone }: { label: string; value: string; sub?: string; help: string; onOpen: () => void; meter?: { value: number; target: number | null }; tone?: 'critical' }) {
  return (
    <div className={`dsh-kpi${tone ? ` ${tone}` : ''}`}>
      <span className="dsh-kpi-label">{label}<HelpTip text={help} /></span>
      <button type="button" className="dsh-kpi-body" onClick={onOpen} aria-label={`${label}: ${value}`}>
        <span className="dsh-kpi-value">{value}</span>
        {meter && <Bar value={meter.value} target={meter.target} label={`${label}: ${Math.round(meter.value)}`} />}
        {sub && <span className="dsh-kpi-sub">{sub}</span>}
      </button>
    </div>
  )
}

/** A 0-100 bar on a recessive track, with an optional target tick. */
function Bar({ value, target, label }: { value: number | null | undefined; target?: number | null; label: string }) {
  const v = value == null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <span className="dsh-bar" role="img" aria-label={label} title={label}>
      <span className="dsh-bar-fill" style={{ width: `${v}%` }} />
      {target != null && <span className="dsh-bar-target" style={{ insetInlineStart: `${Math.min(100, target)}%` }} />}
    </span>
  )
}

function BarCell({ value, name }: { value: number | null; name: string }) {
  if (value == null) return <span className="dsh-muted">—</span>
  return <div className="dsh-cell-bar"><Bar value={value} label={`${name}: ${pct(value)}`} /><span className="dsh-pct">{pct(value)}</span></div>
}

function AttentionRow({ item, t, fmtNum, onOpen }: { item: AttentionItem; t: (k: string) => string; fmtNum: (n: number) => string; onOpen: () => void }) {
  const title = item.source === 'GOVERNANCE' ? fill(t('dashboard.attention.critical_findings'), { count: fmtNum(Number(item.title)) }) : item.title
  return (
    <li>
      <button type="button" className="dsh-attention-item" onClick={onOpen}>
        <span className="dsh-sev" style={{ background: SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.LOW }}>{t(`dashboard.severity.${item.severity}`)}</span>
        <span className="dsh-attention-text">
          <span className="dsh-attention-title">{title}</span>
          {item.detail && <span className="dsh-attention-detail">{item.detail}</span>}
        </span>
      </button>
    </li>
  )
}

function Governance({ gov, reviews, t, isAR, fmtNum, onOpen }: { gov: GovStats; reviews: any[]; t: (k: string) => string; isAR: boolean; fmtNum: (n: number) => string; onOpen: () => void }) {
  const shares = decisionShares(gov.decisions)
  const sev = gov.findingsBySeverity || {}
  const sevMax = Math.max(1, ...SEVERITY_ORDER.map(s => sev[s] || 0))
  const trend = (gov.monthlyTrend || [])
  const trendMax = Math.max(1, ...trend.map(m => m.count))
  return (
    <div className="dsh-gov">
      {shares.total > 0 && (
        <div>
          <div className="dsh-mini-title">{t('dashboard.gov.decisions')}</div>
          <div className="dsh-stack-bar" role="img" aria-label={shares.parts.map(p => `${t(`dashboard.decision.${p.key}`)} ${p.count}`).join(', ')}>
            {shares.parts.filter(p => p.count > 0).map(p => (
              <span key={p.key} style={{ width: `${p.pct}%`, background: DECISION_COLOR[p.key] }} title={`${t(`dashboard.decision.${p.key}`)}: ${p.count} (${p.pct}%)`} />
            ))}
          </div>
          <ul className="dsh-legend">
            {DECISION_ORDER.map(d => (
              <li key={d}><span className="dsh-swatch" style={{ background: DECISION_COLOR[d] }} />{t(`dashboard.decision.${d}`)} <strong>{fmtNum(gov.decisions?.[d] || 0)}</strong></li>
            ))}
          </ul>
        </div>
      )}
      <div className="dsh-gov-grid">
        <div>
          <div className="dsh-mini-title">{t('dashboard.gov.findings')}</div>
          <ul className="dsh-hbars">
            {SEVERITY_ORDER.map(s => (
              <li key={s} title={`${t(`dashboard.severity.${s}`)}: ${sev[s] || 0}`}>
                <span className="dsh-hbar-label">{t(`dashboard.severity.${s}`)}</span>
                <span className="dsh-hbar-track"><span className="dsh-hbar-fill" style={{ width: `${((sev[s] || 0) / sevMax) * 100}%`, background: SEVERITY_COLOR[s] }} /></span>
                <span className="dsh-hbar-value">{fmtNum(sev[s] || 0)}</span>
              </li>
            ))}
          </ul>
        </div>
        {trend.some(m => m.count > 0) && (
          <div>
            <div className="dsh-mini-title">{t('dashboard.gov.trend')}</div>
            <div className="dsh-columns" role="img" aria-label={trend.map(m => `${m.label}: ${m.count}`).join(', ')}>
              {trend.map(m => (
                <div key={m.label} className="dsh-column" title={`${m.label}: ${m.count}${m.avgScore != null ? ` · ${fill(t('dashboard.gov.trend_avg'), { score: m.avgScore })}` : ''}`}>
                  <span className="dsh-column-value">{m.count || ''}</span>
                  <span className="dsh-column-bar" style={{ height: `${Math.max(m.count ? 4 : 0, (m.count / trendMax) * 64)}px` }} />
                  <span className="dsh-column-label">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {reviews.length > 0 && (
        <div>
          <div className="dsh-mini-title">{t('dashboard.gov.recent')}</div>
          <ul className="dsh-list">
            {reviews.slice(0, 5).map(r => (
              <li key={r.id}>
                <button type="button" className="dsh-list-item" onClick={onOpen}>
                  <span className="dsh-list-main">
                    <span className="dsh-list-title">{r.title}</span>
                    <span className="dsh-list-sub">{String(r.reviewType || '').replace(/_/g, ' ')} · {new Date(r.createdAt).toLocaleDateString(isAR ? 'ar-SA-u-nu-latn' : 'en-US')}</span>
                  </span>
                  {r.status === 'COMPLETED' && r.decision && <span className="dsh-chip" style={{ borderColor: DECISION_COLOR[r.decision] || '#64748B' }}><span className="dsh-swatch" style={{ background: DECISION_COLOR[r.decision] || '#64748B' }} />{t(`dashboard.decision.${r.decision}`) !== `dashboard.decision.${r.decision}` ? t(`dashboard.decision.${r.decision}`) : String(r.decision).replace(/_/g, ' ')}</span>}
                  {r.status === 'COMPLETED' && r.overallScore != null && <span className="dsh-score">{r.reviewType === 'HLD_REVIEW' ? Math.round(r.overallScore) : r.overallScore}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function RepositoryBars({ rows, fmtNum }: { rows: Array<{ domain: string; operatingDomainDisplayName?: string; count: number }>; fmtNum: (n: number) => string }) {
  const sorted = [...rows].sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...sorted.map(r => r.count))
  return (
    <ul className="dsh-hbars">
      {sorted.map(r => (
        <li key={r.domain} title={`${r.operatingDomainDisplayName || r.domain}: ${r.count}`}>
          <span className="dsh-hbar-label">{r.operatingDomainDisplayName || r.domain}</span>
          <span className="dsh-hbar-track"><span className="dsh-hbar-fill" style={{ width: `${(r.count / max) * 100}%` }} /></span>
          <span className="dsh-hbar-value">{fmtNum(r.count)}</span>
        </li>
      ))}
    </ul>
  )
}

function Delivery({ plans, cycles, t, onPlans, onCycles }: { plans: any; cycles: any[]; t: (k: string) => string; onPlans: () => void; onCycles: () => void }) {
  return (
    <div className="dsh-delivery">
      {plans && (plans.total ?? 0) > 0 && (
        <button type="button" className="dsh-delivery-block" onClick={onPlans}>
          <span className="dsh-mini-title">{t('dashboard.delivery.plans')}</span>
          <span className="dsh-plan-counts">
            {['ACTIVE', 'DRAFT', 'COMPLETED'].map(s => <span key={s}><strong>{plans.byStatus?.[s] ?? 0}</strong> {t(`dashboard.delivery.plan_status.${s}`)}</span>)}
          </span>
          <span className="dsh-cell-bar"><Bar value={plans.avgProgress ?? 0} label={`${t('dashboard.delivery.avg_progress')}: ${pct(plans.avgProgress)}`} /><span className="dsh-pct">{pct(plans.avgProgress)}</span></span>
        </button>
      )}
      <div className="dsh-delivery-block">
        <span className="dsh-mini-title">{t('dashboard.delivery.cycles')}</span>
        {cycles.length === 0 ? (
          <span className="dsh-muted">{t('dashboard.delivery.no_cycles')} <button type="button" className="dsh-link" onClick={onCycles}>{t('dashboard.delivery.start_cycle')} →</button></span>
        ) : (
          <ul className="dsh-list">
            {cycles.slice(0, 4).map(c => {
              const phases: any[] = Array.isArray(c.phases) ? c.phases : []
              const total = phases.length
              const done = phases.filter(p => p.status === 'COMPLETE').length
              return (
                <li key={c.id}>
                  <button type="button" className="dsh-list-item" onClick={onCycles}>
                    <span className="dsh-list-main">
                      <span className="dsh-list-title">{c.name}</span>
                      <span className="dsh-list-sub">{c.frameworkType}{total > 0 ? ` · ${fill(t('dashboard.delivery.phase'), { done, total })}` : ''}</span>
                    </span>
                    {total > 0 && <span className="dsh-cell-bar dsh-cycle-bar"><Bar value={(done / total) * 100} label={`${c.name}: ${done}/${total}`} /></span>}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
