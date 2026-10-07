import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useAuth } from '../../contexts/AuthContext'
import { HealthApi, T, fmt, heatColor } from './health'

// Architecture Health panels for what the Copilot domain architects add on top
// of the assessment: the domain backlog (with remembered decisions),
// rationalisation candidates, the Chief Architect's cross-domain intelligence
// and proactive insights. Every number comes from the backend; nothing is
// recomputed here.


// ── Insights ────────────────────────────────────────────────────────────────

const SEVERITY_ICON: Record<string, string> = { HIGH: '🔴', MEDIUM: '🟠', LOW: '⚪', POSITIVE: '🟢' }

export function InsightsPanel({ api, t, domains, compact, limit = 8 }: { api: HealthApi; t: T; domains?: string[]; compact?: boolean; limit?: number }) {
  const [list, setList] = useState<any[] | null>(null)
  const key = (domains || []).join(',')
  useEffect(() => {
    let cancelled = false
    api.get(`/architecture-health/insights${key ? `?domain=${encodeURIComponent(key)}` : ''}`)
      .then(r => { if (!cancelled) setList(Array.isArray(r?.insights) ? r.insights : []) })
      .catch(() => { if (!cancelled) setList([]) })
    return () => { cancelled = true }
  }, [api, key])
  if (!list) return compact ? null : <div className="rp-card">{t('common.loading')}</div>
  if (compact && list.length === 0) return null
  return (
    <div className={compact ? 'ah-insights ah-insights-compact' : 'rp-card'} data-testid="health-insights">
      <div className="rp-card-title">💡 {t('health.insights.title')}<HelpTip text={t('health.insights.help')} /></div>
      {list.length === 0 ? <div className="ah-dim">{t('health.insights.none')}</div> : (
        <ul className="ah-insight-list">
          {list.slice(0, limit).map(i => (
            <li key={i.key} className={`ah-insight ah-insight-${String(i.severity).toLowerCase()}`}>
              <span aria-hidden="true">{SEVERITY_ICON[i.severity] || '•'}</span>
              <div>
                <a href={i.link} className="ah-insight-title">{i.title}</a>
                <div className="ah-dim">{i.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list.length > limit && <div className="ah-dim">{t('health.insights.more').replace('{count}', String(list.length - limit))}</div>}
    </div>
  )
}

// ── Domain backlog ──────────────────────────────────────────────────────────

export function BacklogPanel({ api, t, code }: { api: HealthApi; t: T; code: string }) {
  const { hasPermission } = useAuth()
  const [data, setData] = useState<any>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const base = `/architecture-health/domains/${encodeURIComponent(code)}`
  const load = useCallback(() => { api.get(`${base}/backlog`).then(r => setData({ actions: Array.isArray(r?.actions) ? r.actions : [], remembered: Array.isArray(r?.remembered) ? r.remembered : [] })).catch(e => setMsg(e.message)) }, [api, base])
  useEffect(() => { load() }, [load])

  const run = (id: string, p: Promise<any>, done?: (r: any) => void) => {
    setBusy(id); setMsg(null)
    p.then(r => { done?.(r); load() }).catch(e => setMsg(e.message)).finally(() => setBusy(null))
  }
  const propose = () => run('propose', api.post(`${base}/backlog/propose`), r => setMsg(t('health.backlog.proposed').replace('{count}', String(r.created?.length ?? 0)).replace('{remembered}', String(r.rememberedRejections?.length ?? 0))))
  const decide = (id: string, decision: 'ACCEPTED' | 'REJECTED', rationale?: string) => run(id, api.post(`/architecture-health/backlog/${id}/decision`, { decision, rationale }), () => { setRejecting(null); setReason('') })
  const progress = (id: string, status: string) => run(id, api.post(`/architecture-health/backlog/${id}/progress`, { status }))

  const canPropose = hasPermission('ArchitectureHealth.ManageBacklog')
  const canDecide = hasPermission('ArchitectureHealth.DecideActions')
  const NEXT: Record<string, string[]> = { ACCEPTED: ['PLANNED', 'IN_PROGRESS', 'CANCELLED'], PLANNED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'] }

  return (
    <div className="rp-card" style={{ marginTop: 16 }} id="backlog" data-testid="health-backlog">
      <div className="rp-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}>📋 {t('health.backlog.title')}<HelpTip text={t('health.backlog.help')} /></span>
        {canPropose && <button type="button" className="ah-btn ah-btn-primary" disabled={busy === 'propose'} onClick={propose}>{busy === 'propose' ? t('health.backlog.proposing') : t('health.backlog.propose')}</button>}
      </div>
      {msg && <div role="status" className="ah-dim" style={{ marginBottom: 8 }}>{msg}</div>}
      {!data ? <div className="ah-dim">{t('common.loading')}</div> : data.actions.length === 0 ? <div className="ah-dim">{t('health.backlog.empty')}</div> : (
        <div className="rp-table-wrap">
          <table className="ah-table">
            <thead><tr><th>{t('health.gaps.priority')}</th><th>{t('health.backlog.action')}</th><th>{t('health.backlog.impact')}</th><th>{t('health.backlog.status')}</th><th /></tr></thead>
            <tbody>
              {data.actions.map((a: any) => (
                <tr key={a.id}>
                  <td><span className={`ah-chip ah-prio-${a.priority}`}>{t(`health.priority.${a.priority}`)}</span></td>
                  <td><strong>{a.recommendedAction}</strong><div className="ah-dim">{a.gapDescription}</div></td>
                  <td>{a.expectedImpact?.gainPoints != null ? `+${a.expectedImpact.gainPoints}` : '—'}{a.expectedImpact?.effort != null && <div className="ah-dim">{t('health.backlog.effort').replace('{count}', String(a.expectedImpact.effort))}</div>}</td>
                  <td><span className="ah-chip">{t(`health.backlog.s.${a.status}`)}</span>{a.overdue && <div className="ah-dim" style={{ color: 'var(--danger)' }}>{t('health.backlog.overdue')}</div>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {a.status === 'PROPOSED' && canDecide && rejecting !== a.id && (
                      <>
                        <button type="button" className="ah-link-btn" disabled={busy === a.id} onClick={() => decide(a.id, 'ACCEPTED')}>{t('health.backlog.accept')}</button>{' · '}
                        <button type="button" className="ah-link-btn" disabled={busy === a.id} onClick={() => { setRejecting(a.id); setReason('') }}>{t('health.backlog.reject')}</button>
                      </>
                    )}
                    {rejecting === a.id && (
                      <div>
                        <label htmlFor={`reject-${a.id}`} className="ah-dim">{t('health.backlog.reason')}</label>
                        <input id={`reject-${a.id}`} className="form-input" value={reason} onChange={e => setReason(e.target.value)} />
                        <button type="button" className="ah-btn" disabled={!reason.trim() || busy === a.id} onClick={() => decide(a.id, 'REJECTED', reason)}>{t('health.backlog.confirm_reject')}</button>
                        <button type="button" className="ah-link-btn" onClick={() => setRejecting(null)}>{t('common.cancel')}</button>
                      </div>
                    )}
                    {NEXT[a.status] && hasPermission('ArchitectureHealth.ManageBacklog') && (
                      <select aria-label={t('health.backlog.move')} className="form-input" value="" disabled={busy === a.id} onChange={e => e.target.value && progress(a.id, e.target.value)}>
                        <option value="">{t('health.backlog.move')}</option>
                        {NEXT[a.status].map(s => <option key={s} value={s}>{t(`health.backlog.s.${s}`)}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.remembered?.length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary>{t('health.backlog.remembered').replace('{count}', String(data.remembered.length))}</summary>
          <ul className="ah-list">{data.remembered.map((r: any) => <li key={r.id}>{r.action}{r.reason && <div className="ah-dim">{t('health.backlog.because')} {r.reason}</div>}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

// ── Rationalisation ─────────────────────────────────────────────────────────

const REC_ICON: Record<string, string> = { CONSOLIDATE: '🔗', REPLACE: '🔁', RETIRE: '⏹', INVESTIGATE: '🔍', RETAIN: '✔' }

export function RationalisationPanel({ api, t, code }: { api: HealthApi; t: T; code: string }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showMatrix, setShowMatrix] = useState(false)
  useEffect(() => { api.get(`/architecture-health/domains/${encodeURIComponent(code)}/rationalisation`).then(r => setData({ analysedObjects: 0, pairs: [], byRecommendation: {}, limitations: [], ...(r || {}) })).catch(e => setError(e.message)) }, [api, code])
  return (
    <div className="rp-card" style={{ marginTop: 16 }} id="rationalisation" data-testid="health-rationalisation">
      <div className="rp-card-title">🧩 {t('health.rat.title')}<HelpTip text={t('health.rat.help')} /></div>
      {error ? <div role="alert">{error}</div> : !data ? <div className="ah-dim">{t('common.loading')}</div> : data.analysedObjects === 0 ? <div className="ah-dim">{t('health.rat.nothing')}</div> : (
        <>
          <div className="stat-grid-4" style={{ marginBottom: 12 }}>
            {['CONSOLIDATE', 'REPLACE', 'RETIRE', 'INVESTIGATE'].map(k => (
              <div key={k} className="ah-tile"><div className="ah-tile-label">{REC_ICON[k]} {t(`health.rat.r.${k}`)}</div><div className="ah-tile-value">{data.byRecommendation?.[k] ?? 0}</div></div>
            ))}
          </div>
          {data.pairs.length === 0 ? <div className="ah-dim">{t('health.rat.none').replace('{count}', String(data.analysedObjects))}</div> : (
            <div className="rp-table-wrap">
              <table className="ah-table">
                <thead><tr><th>{t('health.rat.pair')}</th><th>{t('health.rat.recommendation')}</th><th>{t('health.rat.evidence')}</th></tr></thead>
                <tbody>
                  {data.pairs.slice(0, 30).map((p: any) => (
                    <tr key={p.key}>
                      <td><a href={`/repository?asset=${encodeURIComponent(p.a.id)}`}>{p.a.name}</a> · <a href={`/repository?asset=${encodeURIComponent(p.b.id)}`}>{p.b.name}</a><div className="ah-dim">{p.typeName}</div></td>
                      <td><span className="ah-chip">{REC_ICON[p.recommendation]} {t(`health.rat.r.${p.recommendation}`)}</span><div className="ah-dim">{t(`health.rat.s.${p.strength}`)}</div></td>
                      <td>{p.reason}<div className="ah-dim">{t('health.rat.shared').replace('{caps}', String(p.sharedCapabilities.length)).replace('{other}', String(p.sharedOther))}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.matrix?.capabilities?.length > 0 && (
            <>
              <button type="button" className="ah-link-btn" style={{ marginTop: 8 }} aria-expanded={showMatrix} onClick={() => setShowMatrix(s => !s)}>{showMatrix ? t('health.rat.hide_matrix') : t('health.rat.show_matrix')}</button>
              {showMatrix && (
                <div className="rp-table-wrap" style={{ marginTop: 8 }}>
                  <table className="ah-table" data-testid="health-rat-matrix">
                    <thead><tr><th />{data.matrix.capabilities.map((c: any) => <th key={c.id} style={{ fontSize: 11 }}>{c.name}</th>)}</tr></thead>
                    <tbody>{data.matrix.objects.map((o: any) => <tr key={o.id}><td>{o.name}</td>{data.matrix.capabilities.map((c: any) => <td key={c.id} style={{ textAlign: 'center' }}>{o.capabilityIds.includes(c.id) ? '●' : ''}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {data.limitations?.map((l: string, i: number) => <div key={i} className="ah-dim" style={{ marginTop: 6 }}>⚠ {l}</div>)}
          <div className="ah-dim" style={{ marginTop: 8 }}>{data.rule}</div>
        </>
      )}
    </div>
  )
}

// ── Chief Architect: cross-domain intelligence ─────────────────────────────

export function EnterpriseIntelligencePanel({ api, t }: { api: HealthApi; t: T }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    api.get('/architecture-health/enterprise/intelligence').then(r => setData(r?.traceability && r?.debt ? r : { traceability: { steps: [], endToEnd: { coverage: null, statement: '' } }, debt: { items: [], rule: '' } })).catch(e => setError(e.message))
  }, [api])
  return (
    <div className="ah-grid-2" id="intelligence" data-testid="health-intelligence">
      <div className="rp-card" style={{ marginTop: 16 }}>
        <div className="rp-card-title">🧭 {t('health.intel.trace')}<HelpTip text={t('health.intel.trace_help')} /></div>
        {error ? <div role="alert">{error}</div> : !data ? <div className="ah-dim">{t('common.loading')}</div> : (
          <>
            <div className="ah-tile" style={{ marginBottom: 10 }}>
              <div className="ah-tile-label">{t('health.intel.end_to_end')}</div>
              <div className="ah-tile-value"><span className="ah-heat" style={{ background: heatColor(data.traceability.endToEnd.coverage) }}>{fmt(data.traceability.endToEnd.coverage, '%')}</span></div>
              <div className="ah-tile-sub">{data.traceability.endToEnd.statement}</div>
            </div>
            <ol className="ah-list">
              {data.traceability.steps.map((s: any) => (
                <li key={`${s.from}-${s.to}`}>
                  <strong>{t(`health.intel.level.${s.from}`)} → {t(`health.intel.level.${s.to}`)}</strong>{' '}
                  {s.status === 'MEASURED' ? <span className="ah-heat" style={{ background: heatColor(s.coverage) }}>{fmt(s.coverage, '%')}</span> : <span className="ah-chip">{t('health.not_assessed')}</span>}
                  <div className="ah-dim">{s.statement}</div>
                  {s.unlinkedSample?.length > 0 && <div className="ah-dim">{t('health.intel.unlinked')}: {s.unlinkedSample.slice(0, 5).map((o: any) => o.name).join(', ')}</div>}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
      <div className="rp-card" style={{ marginTop: 16 }}>
        <div className="rp-card-title">🏚 {t('health.intel.debt')}<HelpTip text={t('health.intel.debt_help')} /></div>
        {!data ? (!error && <div className="ah-dim">{t('common.loading')}</div>) : data.debt.items.length === 0 ? <div className="ah-dim">{t('health.intel.no_debt')}</div> : (
          <ul className="ah-list">
            {data.debt.items.map((d: any) => (
              <li key={d.code}>
                <span className={`ah-chip ah-prio-${d.severity}`}>{d.count}</span> <strong>{t(`health.intel.d.${d.code}`)}</strong>
                <div className="ah-dim">{d.statement}</div>
                {d.sample?.length > 0 && <div className="ah-dim">{d.sample.slice(0, 5).map((o: any) => o.name).join(', ')}</div>}
              </li>
            ))}
          </ul>
        )}
        {data && <div className="ah-dim" style={{ marginTop: 8 }}>{data.debt.rule}</div>}
      </div>
    </div>
  )
}
