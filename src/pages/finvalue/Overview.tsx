import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { FvApi, FvRights, T, VALUE_STAGES, day, money, num, openPrintable, saveBlob, statusTone } from './fvApi'
import { BenchmarksCard } from './IntelligencePanels'

type View = 'EXECUTIVE' | 'ARCHITECTURE' | 'FINANCE'

function Tile({ label, value, sub, help, className = '' }: { label: string; value: string; sub?: string; help?: string; className?: string }) {
  return (
    <div className={`ah-tile ${className}`}>
      <div className="ah-tile-label">{label}{help && <HelpTip text={help} />}</div>
      <div className="ah-tile-value">{value}</div>
      {sub && <div className="ah-tile-sub">{sub}</div>}
    </div>
  )
}

export function StatusChip({ status, t }: { status: string; t: T }) {
  return <span className={`fv-chip ${statusTone(status)}`}>{t(`fv.status.${status}`)}</span>
}

/** Role-based dashboards built only from the backend summary (no figure is computed here). */
export default function Overview({ api, t, rights, isAR, onOpen, onTab }: { api: FvApi; t: T; rights: FvRights; isAR: boolean; onOpen: (id: string) => void; onTab: (tab: string) => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const defaultView: View = rights.VERIFY_SAVINGS || rights.VALIDATE_FINANCE ? 'FINANCE' : rights.MANAGE_OPPORTUNITIES ? 'ARCHITECTURE' : 'EXECUTIVE'
  const [view, setView] = useState<View>(defaultView)

  const load = useCallback(() => { api.get('/financial-value/summary').then(setData).catch(e => setError(e.message)) }, [api])
  useEffect(() => { load() }, [load])

  const run = () => {
    setRunning(true); setMsg(null)
    api.post('/financial-value/discovery/run')
      .then((r: any) => { setMsg(r?.alreadyRunning ? t('fv.discovery.already') : t('fv.discovery.done').replace('{created}', String(r?.summary?.created ?? 0)).replace('{refreshed}', String(r?.summary?.refreshed ?? 0))); load() })
      .catch(e => setMsg(e.message))
      .finally(() => setRunning(false))
  }
  const [year, setYear] = useState(new Date().getFullYear() + 1)
  const lang = isAR ? 'AR' : 'EN'
  const download = (path: string, name: string) => api.blob(`${path}${path.includes('?') ? '&' : '?'}lang=${lang}`).then(b => saveBlob(b, name)).catch(e => setMsg(e.message))
  const print = () => openPrintable(api, `/financial-value/reports/executive.html?lang=${lang}`).catch(e => setMsg(e.message))

  if (error) return <div className="rp-card" role="alert">{error}</div>
  if (!data) return <div className="rp-card">{t('common.loading')}</div>
  const cur = data.currency
  const q = data.queues || {}

  return (
    <div data-testid="fv-overview">
      <div className="fv-toolbar">
        <div className="ah-domains" role="group" aria-label={t('fv.view.label')} style={{ margin: 0 }}>
          {(['EXECUTIVE', 'ARCHITECTURE', 'FINANCE'] as View[]).map(v => (
            <button key={v} type="button" className="ah-domain-btn" aria-pressed={view === v} onClick={() => setView(v)}>{t(`fv.view.${v}`)}</button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="ah-btn" onClick={() => download('/financial-value/reports/executive.docx', 'financial-optimization-executive-report.docx')}>📄 {t('fv.report.executive')}</button>
        <button type="button" className="ah-btn" onClick={() => download('/financial-value/reports/register.xlsx', 'savings-opportunity-register.xlsx')}>📊 {t('fv.report.register')}</button>
        <details className="fv-more">
          <summary className="ah-btn">{t('fv.report.more')}</summary>
          <div className="fv-more-menu" data-testid="fv-more-reports">
            <button type="button" className="ah-link-btn" onClick={() => download('/financial-value/reports/executive.pptx', 'financial-optimization-executive.pptx')}>📽 {t('fv.report.pptx')}</button>
            <button type="button" className="ah-link-btn" onClick={print}>🖨 {t('fv.report.print')}</button>
            <button type="button" className="ah-link-btn" onClick={() => download('/financial-value/reports/cost-avoidance.docx', 'cost-avoidance-report.docx')}>📄 {t('fv.report.avoidance')}</button>
            <span className="fv-toolbar" style={{ margin: 0 }}>
              <label className="ah-dim" htmlFor="fv-plan-year">{t('fv.report.plan_year')}</label>
              <input id="fv-plan-year" type="number" className="form-input" style={{ maxWidth: 90 }} value={year} onChange={e => setYear(Number(e.target.value))} />
              <button type="button" className="ah-link-btn" onClick={() => download(`/financial-value/reports/annual-plan.docx?year=${year}`, `annual-savings-plan-${year}.docx`)}>📄 {t('fv.report.plan')}</button>
            </span>
          </div>
        </details>
      </div>
      {msg && <div className="rp-banner" role="status">{msg}</div>}

      <div className="rp-card-title">{t('fv.cash.title')}<HelpTip text={t('fv.cash.help')} /></div>
      <div className="fv-buckets" data-testid="fv-cash">
        {VALUE_STAGES.map(s => (
          <Tile key={s} label={t(`fv.stage.${s}`)} value={money(data.cashSavings[s].amount, cur)}
            sub={`${data.cashSavings[s].count} ${t('fv.opportunities')}${data.cashSavings[s].unquantified ? ` · ${data.cashSavings[s].unquantified} ${t('fv.unquantified')}` : ''}`} help={t(`fv.stage.${s}.help`)} />
        ))}
      </div>
      <div className="ah-tiles">
        <Tile className="fv-realized" label={t('fv.realized')} value={money(data.realized.amount, cur)} sub={`${data.realized.verifiedRealizations} ${t('fv.verified_measurements')}`} help={t('fv.realized.help')} />
        <Tile label={t('fv.realization_rate')} value={data.realizationRate === null ? t('fv.na') : `${data.realizationRate}%`} help={t('fv.realization_rate.help')} />
        <Tile label={t('fv.avoidance')} value={money(data.costAvoidance.APPROVED.amount + data.costAvoidance.IMPLEMENTED.amount, cur)} sub={`${t('fv.stage.POTENTIAL')}: ${money(data.costAvoidance.POTENTIAL.amount, cur)} · ${t('fv.stage.VALIDATED')}: ${money(data.costAvoidance.VALIDATED.amount, cur)}`} help={t('fv.avoidance.help')} />
        <Tile label={t('fv.productivity')} value={data.productivity.hoursPerYear ? `${Math.round(data.productivity.hoursPerYear).toLocaleString('en-US')} ${t('fv.hours_year')}` : String(data.productivity.count)}
          sub={`${data.productivity.count} ${t('fv.opportunities')}${data.productivity.value ? ` · ${t('fv.productivity.value')} ${money(data.productivity.value, cur)}` : ''} · ${t('fv.productivity.sub')}`} help={t('fv.productivity.help')} />
      </div>

      {view === 'EXECUTIVE' && (
        <>
          <div className="ah-grid-2">
            <Breakdown title={t('fv.by_domain')} rows={data.byDomain} cur={cur} t={t} label={k => (k === 'UNASSIGNED' ? t('fv.unassigned') : k)} />
            <Breakdown title={t('fv.by_engine')} rows={data.byEngine} cur={cur} t={t} label={k => t(`fv.engine.${k}`)} />
          </div>
          {data.byCapability?.length > 0 && (
            <div className="rp-card rp-card-gap">
              <div className="rp-card-title">{t('fv.by_capability')}</div>
              <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.capability')}</th><th>{t('fv.opportunities')}</th><th>{t('fv.net_annual')}</th><th>{t('fv.realized')}</th></tr></thead>
                <tbody>{data.byCapability.map((c: any) => <tr key={c.id}><td>{c.name}</td><td>{c.count}</td><td>{money(c.netAnnualSaving, cur)}</td><td>{money(c.realized, cur)}</td></tr>)}</tbody></table></div>
            </div>
          )}
          <Departments data={data} cur={cur} t={t} />
          <TopList data={data} cur={cur} t={t} onOpen={onOpen} />
          <Milestones data={data} t={t} onOpen={onOpen} />
          <BenchmarksCard api={api} t={t} />
        </>
      )}

      {view === 'ARCHITECTURE' && (
        <>
          <div className="ah-tiles">
            <Tile label={t('fv.q.awaiting_architecture')} value={String(q.awaitingArchitectureAssessment ?? 0)} help={t('fv.q.awaiting_architecture.help')} />
            <Tile label={t('fv.q.from_health')} value={String(q.sourcedFromHealth ?? 0)} />
            <Tile label={t('fv.q.from_governance')} value={String(q.sourcedFromGovernance ?? 0)} />
            <Tile label={t('fv.q.stale')} value={String(q.staleCandidates ?? 0)} help={t('fv.q.stale.help')} />
            <Tile label={t('fv.q.open_requests')} value={String(q.openDataRequests ?? 0)} />
          </div>
          <div className="rp-card">
            <div className="rp-card-title">{t('fv.discovery.title')}<HelpTip text={t('fv.discovery.help')} /></div>
            {rights.MANAGE_OPPORTUNITIES && <button type="button" className="ah-btn ah-btn-primary" onClick={run} disabled={running}>{running ? t('fv.discovery.running') : t('fv.discovery.run')}</button>}
            {data.lastDiscovery ? (
              <div className="ah-dim" style={{ marginTop: 8 }}>
                {t('fv.discovery.last').replace('{date}', day(data.lastDiscovery.completedAt || data.lastDiscovery.startedAt)).replace('{status}', t(`fv.run.${data.lastDiscovery.status}`))}
                {data.lastDiscovery.summary?.candidates !== undefined && ` · ${t('fv.discovery.candidates').replace('{n}', String(data.lastDiscovery.summary.candidates))}`}
                {(data.lastDiscovery.summary?.limitations || []).length > 0 && <ul className="ah-list" style={{ marginTop: 6 }}>{data.lastDiscovery.summary.limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>}
              </div>
            ) : <div className="ah-dim" style={{ marginTop: 8 }}>{t('fv.discovery.never')}</div>}
          </div>
          <Breakdown title={t('fv.by_engine')} rows={data.byEngine} cur={cur} t={t} label={k => t(`fv.engine.${k}`)} />
          <DataGaps data={data} t={t} onTab={onTab} />
          <TopList data={data} cur={cur} t={t} onOpen={onOpen} />
        </>
      )}

      {view === 'FINANCE' && (
        <>
          <div className="ah-tiles">
            <button type="button" className="rp-stat" onClick={() => onTab('data')}><div className="rp-stat-label">{t('fv.q.data_validation')}</div><div className="rp-stat-value">{q.dataAwaitingValidation ?? 0}</div></button>
            <button type="button" className="rp-stat" onClick={() => onTab('verification')}><div className="rp-stat-label">{t('fv.q.business_cases')}</div><div className="rp-stat-value">{q.businessCasesAwaitingFinance ?? 0}</div></button>
            <button type="button" className="rp-stat" onClick={() => onTab('verification')}><div className="rp-stat-label">{t('fv.q.verification')}</div><div className="rp-stat-value">{q.realizationsAwaitingVerification ?? 0}</div></button>
            <button type="button" className="rp-stat" onClick={() => onTab('requests')}><div className="rp-stat-label">{t('fv.q.open_requests')}</div><div className="rp-stat-value">{q.openDataRequests ?? 0}</div></button>
          </div>
          <Renewals data={data} cur={cur} t={t} />
          <Departments data={data} cur={cur} t={t} />
          <DataGaps data={data} t={t} onTab={onTab} />
          <BenchmarksCard api={api} t={t} />
          {(rights.VIEW_FINANCIAL_DATA || rights.VERIFY_SAVINGS) && (
            <button type="button" className="ah-btn" onClick={() => download('/financial-value/reports/verification.docx', 'finance-verification-report.docx')}>📄 {t('fv.report.verification')}</button>
          )}
        </>
      )}
      {view !== 'FINANCE' && <Renewals data={data} cur={cur} t={t} />}

      <div className="fv-note" data-testid="fv-notes">
        <strong>{t('fv.notes.title')}</strong>
        <ul className="ah-list" style={{ marginTop: 6 }}>{['fv.notes.1', 'fv.notes.2', 'fv.notes.3', 'fv.notes.4'].map(k => <li key={k}>{t(k)}</li>)}</ul>
      </div>
    </div>
  )
}

function Breakdown({ title, rows, cur, t, label }: { title: string; rows: any[]; cur: string; t: T; label: (k: string) => string }) {
  return (
    <div className="rp-card rp-card-gap">
      <div className="rp-card-title">{title}</div>
      {!rows?.length ? <div className="ah-dim">{t('fv.none')}</div> : (
        <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th /><th>{t('fv.potential_validated')}</th><th>{t('fv.approved_implemented')}</th><th>{t('fv.realized')}</th><th>{t('fv.opportunities')}</th></tr></thead>
          <tbody>{rows.map(r => <tr key={r.key}><td>{label(r.key)}</td><td>{money(r.potential, cur)}</td><td>{money(r.approved, cur)}</td><td>{money(r.realized, cur)}</td><td>{r.count}</td></tr>)}</tbody></table></div>
      )}
    </div>
  )
}

function TopList({ data, cur, t, onOpen }: { data: any; cur: string; t: T; onOpen: (id: string) => void }) {
  return (
    <div className="rp-card rp-card-gap">
      <div className="rp-card-title">{t('fv.top')}<HelpTip text={t('fv.top.help')} /></div>
      {!data.top?.length ? <div className="ah-dim">{t('fv.none_yet')}</div> : (
        <div className="rp-table-wrap"><table className="ah-table" data-testid="fv-top"><thead><tr><th>{t('fv.opportunity')}</th><th>{t('fv.status')}</th><th>{t('fv.net_annual')}</th><th>{t('fv.confidence')}</th><th>{t('fv.priority')}</th></tr></thead>
          <tbody>{data.top.map((o: any) => (
            <tr key={o.id}><td><button type="button" className="ah-link-btn" onClick={() => onOpen(o.id)}>{o.title}</button></td><td><StatusChip status={o.status} t={t} /></td>
              <td>{o.benefitType === 'COST_AVOIDANCE' ? `${money(o.costAvoidance, cur)} (${t('fv.benefit.COST_AVOIDANCE')})` : money(o.netAnnualSaving, cur)}</td>
              <td>{t(`fv.confidence.${o.confidence}`)}</td><td>{o.priorityClass ? t(`fv.class.${o.priorityClass}`) : '—'} {o.priorityScore !== null && <span className="ah-dim">{num(o.priorityScore)}</span>}</td></tr>
          ))}</tbody></table></div>
      )}
    </div>
  )
}

function Milestones({ data, t, onOpen }: { data: any; t: T; onOpen: (id: string) => void }) {
  if (!data.milestones?.length) return null
  return (
    <div className="rp-card rp-card-gap">
      <div className="rp-card-title">{t('fv.milestones')}</div>
      <ul className="ah-list">{data.milestones.map((m: any, i: number) => <li key={i}>{m.date} · {t(`fv.milestone.${m.kind}`)} · <button type="button" className="ah-link-btn" onClick={() => onOpen(m.id)}>{m.title}</button></li>)}</ul>
    </div>
  )
}

function Renewals({ data, cur, t }: { data: any; cur: string; t: T }) {
  return (
    <div className="rp-card rp-card-gap">
      <div className="rp-card-title">{t('fv.renewals')}<HelpTip text={t('fv.renewals.help')} /></div>
      {!data.renewals?.length ? <div className="ah-dim">{t('fv.renewals.none')}</div> : (
        <div className="rp-table-wrap"><table className="ah-table" data-testid="fv-renewals"><thead><tr><th>{t('fv.contract')}</th><th>{t('fv.vendor')}</th><th>{t('fv.renewal_date')}</th><th>{t('fv.notice_by')}</th><th>{t('fv.annual_value')}</th></tr></thead>
          <tbody>{data.renewals.map((c: any) => <tr key={c.id}><td>{c.title}</td><td>{c.vendor || '—'}</td><td>{day(c.renewalDate)}</td><td>{day(c.noticeBy)}</td><td>{money(c.annualValue, c.currency || cur)}</td></tr>)}</tbody></table></div>
      )}
    </div>
  )
}

function Departments({ data, cur, t }: { data: any; cur: string; t: T }) {
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-departments">
      <div className="rp-card-title">{t('fv.by_department')}<HelpTip text={t('fv.by_department.help')} /></div>
      {!data.byDepartment?.length ? <div className="ah-dim">{t('fv.by_department.none')}</div> : (
        <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.department')}</th><th>{t('fv.opportunities')}</th><th>{t('fv.net_annual')}</th><th>{t('fv.realized')}</th></tr></thead>
          <tbody>{data.byDepartment.map((d: any) => <tr key={d.key}><td>{d.key === 'UNASSIGNED' ? t('fv.unassigned') : d.key}</td><td>{d.count}</td><td>{money(d.netAnnualSaving, cur)}</td><td>{money(d.realized, cur)}</td></tr>)}</tbody></table></div>
      )}
    </div>
  )
}

function DataGaps({ data, t, onTab }: { data: any; t: T; onTab: (tab: string) => void }) {
  const g = data.dataGaps
  if (!g) return null
  const pct = g.objects ? Math.round((1000 * g.withCost) / g.objects) / 10 : null
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-data-gaps">
      <div className="rp-card-title">{t('fv.gaps.title')}<HelpTip text={t('fv.gaps.help')} /></div>
      <div>{t('fv.gaps.summary').replace('{n}', String(g.withCost)).replace('{m}', String(g.objects)).replace('{pct}', pct === null ? '—' : String(pct))}</div>
      {g.byType?.length > 0 && (
        <div className="rp-table-wrap" style={{ marginTop: 8 }}><table className="ah-table"><thead><tr><th>{t('fv.gaps.type')}</th><th>{t('fv.gaps.objects')}</th><th>{t('fv.gaps.with_cost')}</th><th>{t('fv.gaps.missing')}</th></tr></thead>
          <tbody>{g.byType.map((x: any) => <tr key={x.code}><td>{x.name}</td><td>{x.objects}</td><td>{x.withCost}</td><td>{x.objects - x.withCost}</td></tr>)}</tbody></table></div>
      )}
      <button type="button" className="ah-link-btn" style={{ marginTop: 6 }} onClick={() => onTab('data')}>{t('fv.gaps.record')}</button>
    </div>
  )
}
