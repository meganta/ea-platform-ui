import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { api, getToken } from '../lib/api'

const GOV_API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

const DECISION_COLOR: Record<string, string> = {
  APPROVED: '#2ecc71',
  APPROVED_WITH_CONDITIONS: '#f39c12',
  REQUIRES_CHANGES: '#e67e22',
  REJECTED: '#e74c3c',
  REQUIRES_EXCEPTION: '#9b59b6',
  PENDING: '#8baac8',
}

export default function DashboardPage() {
  const nav = useNavigate()
  const { t, isAR } = useLang()
  const [cycles, setCycles] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [govStats, setGovStats] = useState<any>(null)

  useEffect(() => {
    api.getCycles().then(setCycles).catch(() => {})
    api.getCapabilities().then(setCapabilities).catch(() => {})
    api.getDocuments().then(setDocs).catch(() => {})
    const token = getToken() || ''
    // Load reviews list for recent reviews section
    fetch(GOV_API + '/governance/reviews?page=1&limit=10', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then((r: any) => setReviews(Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []))).catch(() => {})
    // Load aggregated stats from dedicated endpoint
    fetch(GOV_API + '/governance/stats', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json()).then(setGovStats).catch(() => {})
  }, [])

  const activeCycles = cycles.filter(c => c.status === 'ACTIVE').length
  const readyDocs = docs.filter(d => d.status === 'READY').length

  // Use stats endpoint data when available, fall back to manual calculation
  const statsTotal    = govStats?.summary?.totalReviews     ?? reviews.length
  const statsComplete = govStats?.summary?.completedReviews ?? reviews.filter(r => r.status === 'COMPLETED').length
  const statsPending  = govStats?.summary?.inProgressReviews ?? reviews.filter(r => ['DRAFT','IN_PROGRESS','PROCESSING'].includes(r.status)).length
  const statsAvgScore = govStats?.summary?.avgOverallScore  ?? 0
  const statsCriticalOpen = govStats?.summary?.criticalOpenFindings ?? 0
  const statsOpenFindings = govStats?.summary?.openFindings ?? 0
  const decisionCounts = govStats?.decisions ?? {}
  const monthlyTrend  = govStats?.monthlyTrend ?? []
  const findingsBySev = govStats?.findingsBySeverity ?? {}
  const scoreAvgs     = govStats?.scoreAverages ?? null

  // Keep for pending alert
  const pendingReviews = reviews.filter(r => ['DRAFT', 'IN_PROGRESS'].includes(r.status))

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: 24 }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">{t('dash.title')}</div>
            <div className="page-subtitle">{t('dash.subtitle')}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{t('dash.status')}</div>
        </div>
      </div>
      <div className="page-body">

        {/* Platform stats */}
        <div className="grid-4 mb-6">
          <div className="stat-card"><div className="stat-value">{cycles.length}</div><div className="stat-label">{t('dash.adm_cycles')}</div><div className="stat-delta">{activeCycles} {t('dash.active')}</div></div>
          <div className="stat-card"><div className="stat-value">{capabilities.length}</div><div className="stat-label">{t('dash.capabilities')}</div></div>
          <div className="stat-card"><div className="stat-value">{docs.length}</div><div className="stat-label">{t('dash.documents')}</div><div className="stat-delta">{readyDocs} {t('dash.indexed')}</div></div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => nav('/governance')}>
            <div className="stat-value">{statsTotal}</div>
            <div className="stat-label">{t('gov.reviews')}</div>
            <div className="stat-delta" style={{ color: statsPending > 0 ? '#f39c12' : 'var(--success)' }}>
              {statsPending} {t('gov.pending')}
            </div>
          </div>
        </div>

        {/* Governance Dashboard */}
        {statsTotal > 0 && (
          <div className="card mb-6">
            <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
              <div className="section-title">🏛 {t('gov.dashboard')}</div>
              <button onClick={() => nav('/governance')} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {t('gov.view_all')} →
              </button>
            </div>

            {/* Governance KPIs */}
            <div className="stat-grid-3" style={{ marginBottom: 16 }}>
              {[
                { label: t('gov.total_reviews'), value: statsTotal, sub: statsComplete + ' completed', color: '#8baac8' },
                { label: t('gov.avg_score'), value: statsAvgScore || '—', sub: scoreAvgs ? `C:${scoreAvgs.compliance} S:${scoreAvgs.strategic} R:${scoreAvgs.risk}` : '', color: statsAvgScore >= 70 ? '#2ecc71' : statsAvgScore >= 50 ? '#f39c12' : '#e74c3c' },
                { label: 'Open Findings', value: statsOpenFindings, sub: statsCriticalOpen > 0 ? statsCriticalOpen + ' critical' : 'none critical', color: statsCriticalOpen > 0 ? '#e74c3c' : '#2ecc71' },
              ].map((s: any) => (
                <div key={s.label} style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  {s.sub && <div style={{ fontSize: 10, color: s.color + 'aa', marginTop: 2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>

            {/* Findings by severity */}
            {(findingsBySev.CRITICAL > 0 || findingsBySev.HIGH > 0) && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {[['CRITICAL','#e74c3c'],['HIGH','#e67e22'],['MEDIUM','#f39c12'],['LOW','#3498db']].map(([sev,col]) =>
                  findingsBySev[sev] ? (
                    <div key={sev} style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: col + '22', color: col, border: '1px solid ' + col + '44' }}>
                      {findingsBySev[sev]} {sev}
                    </div>
                  ) : null
                )}
              </div>
            )}

            {/* Monthly trend */}
            {monthlyTrend.length > 0 && monthlyTrend.some((m: any) => m.count > 0) && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Monthly Reviews & Avg Score</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 64 }}>
                  {monthlyTrend.map((m: any, i: number) => {
                    const h = Math.max(4, ((m.count / Math.max(...monthlyTrend.map((x:any)=>x.count), 1)) * 48))
                    const scoreColor = m.avgScore >= 70 ? '#2ecc71' : m.avgScore >= 50 ? '#f39c12' : m.avgScore ? '#e74c3c' : '#8baac8'
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {m.avgScore && <div style={{ fontSize: 9, color: scoreColor, fontWeight: 600 }}>{m.avgScore}</div>}
                        <div style={{ width: '100%', height: h, background: m.count > 0 ? scoreColor + '88' : 'var(--navy-light)', borderRadius: 3, border: '1px solid ' + (m.count > 0 ? scoreColor : 'var(--navy-light)') }} title={m.count + ' reviews'} />
                        <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Decision breakdown */}
            {statsComplete > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{t('gov.decision_breakdown')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(decisionCounts).map(([d, n]: any) => (
                    <div key={d} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: (DECISION_COLOR[d] || '#8baac8') + '22',
                      color: DECISION_COLOR[d] || '#8baac8',
                      border: '1px solid ' + (DECISION_COLOR[d] || '#8baac8') + '44'
                    }}>{n} {d.replace(/_/g, ' ')}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Score trend from monthly stats */}
            {monthlyTrend.length > 0 && monthlyTrend.some((m: any) => m.count > 0) && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{t('gov.score_trend')} (last 6 months)</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
                  {monthlyTrend.map((m: any, i: number) => {
                    const h = Math.max(4, ((m.count / Math.max(...monthlyTrend.map((x:any) => x.count), 1)) * 48))
                    const color = m.avgScore >= 70 ? '#2ecc71' : m.avgScore >= 50 ? '#f39c12' : m.avgScore ? '#e74c3c' : '#8baac8'
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        {m.avgScore && <div style={{ fontSize: 9, color, fontWeight: 600 }}>{m.avgScore}</div>}
                        <div style={{ width: '100%', height: h, background: m.count > 0 ? color + '88' : 'var(--navy-light)', borderRadius: 3, border: '1px solid ' + (m.count > 0 ? color : 'var(--navy-light)') }} title={m.count + ' reviews'} />
                        <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Recent reviews */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{t('gov.recent_reviews')}</div>
              {reviews.slice(0, 5).map((r: any) => (
                <div key={r.id} onClick={() => nav('/governance')} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0',
                  borderBottom: '1px solid var(--navy-light)', cursor: 'pointer'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                      {r.reviewType?.replace(/_/g, ' ')} · {new Date(r.createdAt).toLocaleDateString(isAR ? 'ar-SA' : 'en-US')}
                    </div>
                  </div>
                  {r.overallScore != null && r.status === 'COMPLETED' && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: r.overallScore >= 70 ? '#2ecc71' : r.overallScore >= 50 ? '#f39c12' : '#e74c3c', minWidth: 30, textAlign: 'right' }}>
                      {r.overallScore}
                    </div>
                  )}
                  <div style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                    background: (r.status === 'COMPLETED' ? (DECISION_COLOR[r.decision] || '#2ecc71') : '#f39c12') + '22',
                    color: r.status === 'COMPLETED' ? (DECISION_COLOR[r.decision] || '#2ecc71') : '#f39c12',
                  }}>{r.status === 'COMPLETED' ? (r.decision?.replace(/_/g, ' ') || 'COMPLETED') : r.status}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending reviews alert */}
        {pendingReviews.length > 0 && (
          <div style={{ background: '#f39c1211', border: '1px solid #f39c1244', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>⏳</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f39c12' }}>{pendingReviews.length} {t('gov.reviews_pending_action')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pendingReviews.map((r: any) => r.title).join(', ')}</div>
            </div>
            <button onClick={() => nav('/governance')} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #f39c12', background: 'transparent', color: '#f39c12', fontSize: 12, cursor: 'pointer' }}>{t('gov.review_now')}</button>
          </div>
        )}

        <div className="grid-2 mb-6">
          <div className="card">
            <div className="section-title">⚙ {t('dash.active_cycles')}</div>
            {cycles.length === 0
              ? <div className="empty" style={{ padding: '24px 0' }}><div className="empty-title">{t('dash.no_cycles')}</div><button className="btn btn-primary btn-sm mt-4" onClick={() => nav('/adm')}>{t('dash.create_cycle')}</button></div>
              : cycles.slice(0, 4).map(c => (
                <div key={c.id} className="flex items-center justify-between" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div><div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>Phase {c.currentPhase} · {c.frameworkType}</div></div>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </div>
              ))
            }
          </div>
          <div className="card">
            <div className="section-title">{t('dash.quick_actions')}</div>
            {[
              { icon: '⚙', label: t('qa.adm'), sub: t('qa.adm_sub'), path: '/adm' },
              { icon: '💬', label: t('qa.copilot'), sub: t('qa.copilot_sub'), path: '/copilot' },
              { icon: '🗄', label: t('qa.repo'), sub: t('qa.repo_sub'), path: '/repository' },
              { icon: '🏛', label: t('gov.dashboard'), sub: t('gov.start_review'), path: '/governance' },
            ].map(a => (
              <button key={a.path} onClick={() => nav(a.path)} style={{ width: '100%', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <div><div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{a.label}</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.sub}</div></div>
              </button>
            ))}
          </div>
        </div>

        {cycles[0] && cycles[0].frameworkType === 'NORA' && (
          <div className="card">
            <div className="section-title">{t('dash.latest_cycle')} — {cycles[0].name}</div>
            <div className="phase-track">
              {['1', '2', '3', '4', '5', '6', '7'].map(p => {
                const ph = cycles[0].phases?.find((x: any) => x.phase === p); const s = ph?.status || 'NOT_STARTED'
                return <div key={p} className="phase-step"><div className={`phase-dot${s === 'COMPLETE' ? ' done' : s === 'IN_PROGRESS' ? ' active' : ''}`}>{p}</div><div className="phase-label">{s === 'COMPLETE' ? '✓' : s === 'IN_PROGRESS' ? '→' : '·'}</div></div>
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

