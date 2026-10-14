import { useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { FvApi, FvRights, T, money, saveBlob } from './fvApi'

export const AGENT_CODES = ['CHIEF', 'APPLICATION_SAVINGS', 'TECHNOLOGY_LICENSE', 'INFRASTRUCTURE_FINOPS', 'CONTRACT_INTELLIGENCE', 'PROCESS_OPTIMIZATION', 'FINANCIAL_VALIDATION', 'SAVINGS_REALIZATION'] as const
export const OBSERVATION_ACTORS = ['ARCHITECT', 'FINANCE', 'APPROVER', 'OWNER', 'DATA_OWNER', 'SECURITY', 'PROCUREMENT'] as const
export const AGENT_FIGURES = ['open', 'quantifiedAnnual', 'costAvoidance', 'realized'] as const

/**
 * Financial agents: each reviews its part of the register deterministically
 * (observations, recommended action, who acts). They propose only - they never
 * approve, validate, cancel a contract or certify a saving. The optional AI
 * narrative is kept only when every figure in it comes from the observations.
 */
export function AgentsPanel({ api, t, rights, isAR, onOpen }: { api: FvApi; t: T; rights: FvRights; isAR: boolean; onOpen: (id: string) => void }) {
  const [code, setCode] = useState<string>('CHIEF')
  const [narrate, setNarrate] = useState(false)
  const [data, setData] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const canNarrate = rights.MANAGE_OPPORTUNITIES || rights.VALIDATE_FINANCE || rights.VERIFY_SAVINGS
  const run = (c = code, n = narrate) => {
    setBusy(true); setErr(null)
    api.post(`/financial-value/agents/${c}/brief`, { narrate: n && canNarrate, language: isAR ? 'AR' : 'EN' }).then(setData).catch(e => setErr(e.message)).finally(() => setBusy(false))
  }
  useEffect(() => { run('CHIEF', false) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const b = data?.brief
  const sevTone = (s: string) => (s === 'HIGH' ? 'fv-tone-bad' : s === 'MEDIUM' ? 'fv-tone-go' : 'fv-tone-neutral')
  return (
    <div data-testid="fv-agents">
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.agents.title')}<HelpTip text={t('fv.agents.help')} /></div>
        <div className="ah-domains" role="group" aria-label={t('fv.agents.title')}>
          {AGENT_CODES.map(c => <button key={c} type="button" className="ah-domain-btn" aria-pressed={code === c} onClick={() => { setCode(c); run(c, false) }}>{t(`fv.agent.${c}`)}</button>)}
        </div>
        <div className="ah-dim" style={{ marginTop: 6 }}>{t(`fv.agent.${code}.help`)}</div>
        <div className="fv-toolbar" style={{ marginTop: 8 }}>
          {canNarrate && <label className="ah-dim" htmlFor="fv-ag-narrate"><input id="fv-ag-narrate" type="checkbox" checked={narrate} onChange={e => setNarrate(e.target.checked)} /> {t('fv.agents.narrate')}</label>}
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run()}>{busy ? t('fv.agents.running') : t('fv.agents.run')}</button>
        </div>
        {err && <div className="rp-banner" role="alert">{err}</div>}
      </div>
      {b && (
        <>
          <div className="ah-tiles" style={{ marginTop: 12 }}>
            <div className="ah-tile"><div className="ah-tile-label">{t('fv.agents.in_scope')}</div><div className="ah-tile-value">{b.scope.opportunities}</div></div>
            {AGENT_FIGURES.map(k => <div key={k} className="ah-tile"><div className="ah-tile-label">{t(`fv.agents.fig.${k}`)}</div><div className="ah-tile-value">{k === 'open' ? String(b.figures[k] ?? 0) : money(b.figures[k])}</div></div>)}
          </div>
          {data.narrative && (
            <div className="rp-card rp-card-gap">
              <div className="rp-card-title">{t('fv.agents.narrative')}</div>
              {data.narrative.grounded && data.narrative.text ? <div style={{ whiteSpace: 'pre-wrap' }}>{data.narrative.text}</div> : <div className="ah-dim">{t('fv.agents.narrative_discarded')}</div>}
            </div>
          )}
          <div className="rp-card rp-card-gap">
            <div className="rp-card-title">{t('fv.agents.observations')} ({b.observations.length})</div>
            {b.observations.length === 0 ? <div className="ah-dim">{t('fv.agents.nothing')}</div> : (
              <div className="rp-table-wrap"><table className="ah-table" data-testid="fv-observations"><thead><tr><th>{t('fv.agents.severity')}</th><th>{t('fv.agents.finding')}</th><th>{t('fv.agents.action')}</th><th>{t('fv.agents.actor')}</th></tr></thead>
                <tbody>{b.observations.map((x: any, i: number) => (
                  <tr key={i}>
                    <td><span className={`fv-chip ${sevTone(x.severity)}`}>{t(`fv.agents.sev.${x.severity}`)}</span></td>
                    <td>{x.opportunityId ? <button type="button" className="ah-link-btn" onClick={() => onOpen(x.opportunityId)}>{x.title}</button> : x.title}<div className="ah-dim">{x.detail}</div></td>
                    <td>{x.action}</td>
                    <td>{t(`fv.agents.actor.${x.actor}`)}</td>
                  </tr>
                ))}</tbody></table></div>
            )}
            {b.limits.length > 0 && <ul className="ah-list" style={{ marginTop: 6 }}>{b.limits.map((l: string, i: number) => <li key={i} className="ah-dim">{l}</li>)}</ul>}
            <div className="fv-note">{t('fv.agents.rule')}</div>
          </div>
        </>
      )}
    </div>
  )
}

/** Running cost of the Current architecture against a scenario (Transition / Target / alternative), from recorded costs only. */
export function ScenarioCostPanel({ api, t, rights, isAR }: { api: FvApi; t: T; rights: FvRights; isAR: boolean }) {
  const [scenarios, setScenarios] = useState<any[] | null>(null)
  const [id, setId] = useState('')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { api.get('/financial-value/scenarios').then((r: any) => setScenarios(Array.isArray(r) ? r : [])).catch(e => { setErr(e.message); setScenarios([]) }) }, [api])
  useEffect(() => {
    if (!id || !rights.VIEW_FINANCIAL_DATA) { setData(null); return }
    setData(null); setErr(null)
    api.get(`/financial-value/scenarios/${encodeURIComponent(id)}/cost`).then(setData).catch(e => setErr(e.message))
  }, [api, id, rights.VIEW_FINANCIAL_DATA])
  const cur = data?.currency || 'SAR'
  const report = () => api.blob(`/financial-value/reports/scenario/${encodeURIComponent(id)}.docx?lang=${isAR ? 'AR' : 'EN'}`).then(b => saveBlob(b, `scenario-cost-${data?.scenario?.name || id}.docx`)).catch(e => setErr(e.message))
  return (
    <div data-testid="fv-scenario-cost">
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.scn.title')}<HelpTip text={t('fv.scn.help')} /></div>
        {!rights.VIEW_FINANCIAL_DATA ? <div className="ah-dim">{t('fv.restricted')}</div> : !scenarios ? t('common.loading') : scenarios.length === 0 ? <div className="ah-dim">{t('fv.scn.none')}</div> : (
          <div className="fv-toolbar">
            <label className="ah-dim" htmlFor="fv-scn">{t('fv.scenario')}</label>
            <select id="fv-scn" className="form-input" value={id} onChange={e => setId(e.target.value)}><option value="">—</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}</select>
            {data && <button type="button" className="ah-btn" onClick={report}>📄 {t('fv.scn.report')}</button>}
          </div>
        )}
        {err && <div className="rp-banner" role="alert">{err}</div>}
      </div>
      {data && (
        <>
          <div className="ah-tiles" style={{ marginTop: 12 }}>
            <div className="ah-tile"><div className="ah-tile-label">{t('fv.scn.current')}</div><div className="ah-tile-value">{money(data.current.annual, cur)}</div><div className="ah-tile-sub">{t('fv.scn.costed').replace('{n}', String(data.current.objectsWithCost)).replace('{m}', String(data.current.objects))}</div></div>
            <div className="ah-tile"><div className="ah-tile-label">{data.scenario.name}</div><div className="ah-tile-value">{money(data.target.annual, cur)}</div><div className="ah-tile-sub">{t('fv.scn.costed').replace('{n}', String(data.target.objectsWithCost)).replace('{m}', String(data.target.objects))}</div></div>
            <div className="ah-tile"><div className="ah-tile-label">{t('fv.scn.difference')}<HelpTip text={t('fv.scn.difference.help')} /></div><div className={`ah-tile-value ${data.difference < 0 ? 'fv-tone-good' : data.difference > 0 ? 'fv-tone-bad' : ''}`}>{money(data.difference, cur)}</div></div>
            <div className="ah-tile"><div className="ah-tile-label">{t('fv.scn.coverage')}</div><div className="ah-tile-value" style={{ fontSize: 18 }}>{data.coverage.currentPct ?? '—'}% / {data.coverage.scenarioPct ?? '—'}%</div></div>
          </div>
          {data.notes.length > 0 && <ul className="ah-list" style={{ marginTop: 8 }}>{data.notes.map((n: string, i: number) => <li key={i} className="ah-dim">{n}</li>)}</ul>}
          <div className="ah-grid-2" style={{ marginTop: 12 }}>
            <div className="rp-card">
              <div className="rp-card-title">{t('fv.scn.removed')}</div>
              {data.removed.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : <ul className="ah-list">{data.removed.map((r: any) => <li key={r.id}><a href={`/repository?asset=${encodeURIComponent(r.id)}`}>{r.name}</a> · {money(r.annual, cur)} <span className="ah-dim">{r.domain}</span></li>)}</ul>}
            </div>
            <div className="rp-card">
              <div className="rp-card-title">{t('fv.scn.introduced')}</div>
              {data.introduced.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : <ul className="ah-list">{data.introduced.map((r: any) => <li key={r.id}><a href={`/repository?asset=${encodeURIComponent(r.id)}`}>{r.name}</a> · {r.annual === null ? t('fv.scn.no_cost') : money(r.annual, cur)} <span className="ah-dim">{r.domain}</span></li>)}</ul>}
            </div>
          </div>
          <div className="rp-card rp-card-gap">
            <div className="rp-card-title">{t('fv.by_domain')}</div>
            {data.byDomain.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : (
              <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th /><th>{t('fv.scn.current')}</th><th>{data.scenario.name}</th><th>{t('fv.scn.difference')}</th></tr></thead>
                <tbody>{data.byDomain.map((d: any) => <tr key={d.domain}><td>{d.domain === 'UNASSIGNED' ? t('fv.unassigned') : d.domain}</td><td>{money(d.current, cur)}</td><td>{money(d.scenario, cur)}</td><td>{money(d.difference, cur)}</td></tr>)}</tbody></table></div>
            )}
          </div>
          {data.opportunities?.length > 0 && (
            <div className="rp-card rp-card-gap">
              <div className="rp-card-title">{t('fv.scn.opportunities')}</div>
              <ul className="ah-list">{data.opportunities.map((x: any) => <li key={x.opportunityId}>{x.title} · {t('fv.scn.new_recurring')} {money(x.annual, cur)}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Opt-in cross-organization benchmarking: ratios only, shown when at least 5 peers contributed. */
export function BenchmarksCard({ api, t }: { api: FvApi; t: T }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.get('/financial-value/benchmarks').then(setData).catch(() => setData(null)) }, [api])
  if (!data) return null
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-benchmarks">
      <div className="rp-card-title">{t('fv.bench.title')}<HelpTip text={t('fv.bench.help')} /></div>
      {!data.optedIn ? <div className="ah-dim">{t('fv.bench.off')}</div> : (
        <>
          <div className="ah-dim">{t('fv.bench.peers').replace('{n}', String(data.contributingPeers))}</div>
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.bench.metric')}</th><th>{t('fv.bench.own')}</th><th>{t('fv.bench.p25')}</th><th>{t('fv.bench.median')}</th><th>{t('fv.bench.p75')}</th></tr></thead>
            <tbody>{data.metrics.map((m: any) => <tr key={m.metric}><td>{t(`fv.bench.m.${m.metric}`)}</td><td>{m.own ?? t('fv.na')}</td>
              {m.peers ? <><td>{m.peers.p25}</td><td>{m.peers.median}</td><td>{m.peers.p75}</td></> : <td colSpan={3} className="ah-dim">{t('fv.bench.too_few').replace('{n}', String(data.minPeers))}</td>}</tr>)}</tbody></table></div>
        </>
      )}
    </div>
  )
}
