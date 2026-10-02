import { Fragment, useCallback, useEffect, useState } from 'react'
import HelpTip from './HelpTip'
import { KpiFrequency, KpiReport, KpiUnit, TrackedKpi, alignmentApi } from '../lib/strategy-alignment'

type T = (key: string) => string
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), text)
const FREQUENCIES: KpiFrequency[] = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL']
const MONTHS = Array.from({ length: 12 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`)
const REPORT_PERIODS = [...MONTHS, 'Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Y']

/** The period a report most likely wants: the quarter that just ended. */
function lastQuarter(today = new Date()) { const q = Math.floor(today.getMonth() / 3); return q === 0 ? 'Q4' : `Q${q}` }

/**
 * KPI measurement for the KPIs an organization unit owns in the Repository (the EA department by default):
 * pick which are reported, record measures when each period ends (and monthly measures at any time),
 * and produce monthly / quarterly / half-yearly / annual reports.
 */
export default function KpiMeasurementPanel({ t, canEdit }: { t: T; canEdit: boolean }) {
  const thisYear = new Date().getFullYear()
  const [units, setUnits] = useState<KpiUnit[]>([])
  const [unitId, setUnitId] = useState('')
  const [year, setYear] = useState(thisYear)
  const [kpis, setKpis] = useState<TrackedKpi[]>([])
  const [monthly, setMonthly] = useState<string | null>(null)
  const [period, setPeriod] = useState(lastQuarter())
  const [report, setReport] = useState<KpiReport | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { alignmentApi.units().then(list => { setUnits(list); if (list.length) setUnitId(list[0].id) }).catch((e: any) => setError(e.message)) }, [])
  const load = useCallback(() => unitId ? alignmentApi.kpis(unitId, year).then(setKpis).catch((e: any) => setError(e.message)) : Promise.resolve(), [unitId, year])
  useEffect(() => { load(); setReport(null) }, [load])
  const act = async (fn: () => Promise<unknown>, reload = true) => { setBusy(true); setError(''); try { await fn(); if (reload) await load() } catch (e: any) { setError(e.message) } finally { setBusy(false) } }
  const due = kpis.filter(k => k.reported).flatMap(k => k.schedule.filter(s => s.status === 'DUE'))
  const overdue = kpis.filter(k => k.reported).flatMap(k => k.schedule.filter(s => s.status === 'OVERDUE'))
  const save = (k: TrackedKpi, p: string, value: string) => { if ((k.measures[p]?.value || '') !== value) act(() => alignmentApi.measure(k.id, year, p, value)) }

  return <section className="kpi-panel">
    <div className="panel-head">
      <div><h2>{t('strategy.kpi.title')}<HelpTip text={t('strategy.kpi.help')} /></h2><p className="impact-note">{t('strategy.kpi.intro')}</p></div>
      <div className="panel-actions">
        <label htmlFor="kpi-unit">{t('strategy.kpi.unit')}<select id="kpi-unit" value={unitId} onChange={e => setUnitId(e.target.value)}>{units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.kpis})</option>)}</select></label>
        <label htmlFor="kpi-year">{t('strategy.align.year')}<select id="kpi-year" value={year} onChange={e => setYear(Number(e.target.value))}>{[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
      </div>
    </div>
    {error && <div role="alert" className="error">{error}</div>}
    {!units.length ? <p className="changes-empty">{t('strategy.kpi.no_units')}</p> : <>
      <div className="impact-totals">
        <div><strong>{kpis.filter(k => k.reported).length}</strong><span>{t('strategy.kpi.reported_count')}</span></div>
        <div><strong>{due.length}</strong><span>{t('strategy.kpi.due_count')}</span></div>
        <div><strong>{overdue.length}</strong><span>{t('strategy.kpi.overdue_count')}</span></div>
      </div>
      <div className="impact-table-wrap"><table className="kpi-table">
        <thead><tr>
          <th scope="col">{t('strategy.kpi.col.kpi')}</th><th scope="col">{t('strategy.kpi.col.reported')}</th><th scope="col">{t('strategy.kpi.col.frequency')}</th><th scope="col">{t('strategy.kpi.col.target')}</th><th scope="col">{t('strategy.kpi.col.measures')}<HelpTip text={t('strategy.kpi.measures_help')} /></th>
        </tr></thead>
        <tbody>{kpis.map(k => <Fragment key={k.id}>
          <tr className={k.reported ? '' : 'kpi-muted'} data-testid={`kpi-${k.id}`}>
            <td><strong>{k.name}</strong>{k.formula && <small className="kpi-formula">{k.formula}</small>}</td>
            <td><input type="checkbox" aria-label={fill(t('strategy.kpi.reported_label'), { name: k.name })} checked={k.reported} disabled={!canEdit || busy} onChange={e => act(() => alignmentApi.tracking(k.id, { reported: e.target.checked }))} /></td>
            <td><select aria-label={fill(t('strategy.kpi.frequency_label'), { name: k.name })} value={k.frequency} disabled={!canEdit || busy} onChange={e => act(() => alignmentApi.tracking(k.id, { frequency: e.target.value as KpiFrequency }))}>{FREQUENCIES.map(f => <option key={f} value={f}>{t(`strategy.kpi.frequency.${f}`)}</option>)}</select></td>
            <td><input aria-label={fill(t('strategy.kpi.target_label'), { name: k.name })} defaultValue={k.target || ''} disabled={!canEdit} onBlur={e => { if (e.target.value !== (k.target || '')) act(() => alignmentApi.tracking(k.id, { target: e.target.value || null })) }} /></td>
            <td><div className="kpi-periods">{k.schedule.map(s => <label key={s.period} className={`kpi-period kpi-${s.status}`} title={fill(t('strategy.kpi.due_on'), { date: s.dueDate })}>
              <span>{t(`strategy.align.period.${s.period}`)} · {t(`strategy.kpi.status.${s.status}`)}</span>
              <input aria-label={`${k.name} ${t(`strategy.align.period.${s.period}`)}`} defaultValue={k.measures[s.period]?.value || ''} disabled={!canEdit} onBlur={e => save(k, s.period, e.target.value)} />
            </label>)}{k.frequency !== 'MONTHLY' && <button className="kpi-monthly-toggle" aria-expanded={monthly === k.id} onClick={() => setMonthly(monthly === k.id ? null : k.id)}>{t('strategy.kpi.monthly')}</button>}</div></td>
          </tr>
          {monthly === k.id && <tr className="kpi-monthly-row"><td colSpan={5}><div className="kpi-periods">{MONTHS.map(m => <label key={m} className="kpi-period"><span>{t(`strategy.align.period.${m}`)}</span><input aria-label={`${k.name} ${t(`strategy.align.period.${m}`)}`} defaultValue={k.measures[m]?.value || ''} disabled={!canEdit} onBlur={e => save(k, m, e.target.value)} /></label>)}</div></td></tr>}
        </Fragment>)}</tbody>
      </table></div>
      {!kpis.length && <p className="impact-note">{t('strategy.kpi.no_kpis')}</p>}

      <div className="kpi-report">
        <h3>{t('strategy.kpi.report')}<HelpTip text={t('strategy.kpi.report_help')} /></h3>
        <div className="panel-actions">
          <label htmlFor="kpi-period">{t('strategy.kpi.period')}<select id="kpi-period" value={period} onChange={e => { setPeriod(e.target.value); setReport(null) }}>{REPORT_PERIODS.map(p => <option key={p} value={p}>{t(`strategy.align.period.${p}`)}</option>)}</select></label>
          <button disabled={busy || !unitId} onClick={() => act(async () => setReport(await alignmentApi.report(unitId, year, period)), false)}>{t('strategy.kpi.show_report')}</button>
          <button disabled={busy || !unitId} onClick={() => act(() => alignmentApi.exportReport(unitId, year, period), false)}>{t('strategy.kpi.export_report')}</button>
        </div>
        {report && <>
          <p className="impact-note" role="status">{fill(t('strategy.kpi.report_summary'), { measured: report.measured, missing: report.missing })}</p>
          <div className="impact-table-wrap"><table>
            <thead><tr><th scope="col">{t('strategy.kpi.col.kpi')}</th><th scope="col">{t('strategy.kpi.col.target')}</th><th scope="col">{t('strategy.kpi.col.value')}</th><th scope="col">{t('strategy.kpi.col.previous')}</th><th scope="col">{t('strategy.kpi.col.trend')}</th><th scope="col">{t('strategy.kpi.col.on_target')}</th></tr></thead>
            <tbody>{report.rows.map(r => <tr key={r.id} className={r.status === 'MISSING' ? 'kpi-missing' : ''}>
              <td>{r.name}</td><td>{r.target}{r.unit ? ` ${r.unit}` : ''}</td>
              <td>{r.value || t('strategy.kpi.not_measured')}{r.derived && <small> {t('strategy.kpi.from_monthly')}</small>}</td>
              <td>{r.previous}</td><td>{r.trend ? t(`strategy.kpi.trend.${r.trend}`) : ''}</td>
              <td>{r.onTarget === null ? '' : t(r.onTarget ? 'strategy.kpi.on_target' : 'strategy.kpi.off_target')}</td>
            </tr>)}</tbody>
          </table></div>
        </>}
      </div>
    </>}
  </section>
}
