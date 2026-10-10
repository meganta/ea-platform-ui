import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { FvApi, FvRights, T, VALUE_STAGES, day, money, num, saveBlob, statusTone } from './fvApi'

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
  const download = (path: string, name: string) => api.blob(`${path}?lang=${isAR ? 'AR' : 'EN'}`).then(b => saveBlob(b, name)).catch(e => setMsg(e.message))

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
        <Tile label={t('fv.productivity')} value={String(data.productivity.count)} sub={t('fv.productivity.sub')} help={t('fv.productivity.help')} />
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
          <TopList data={data} cur={cur} t={t} onOpen={onOpen} />
          <Milestones data={data} t={t} onOpen={onOpen} />
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
