import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { BenchmarksCard } from './IntelligencePanels'
import { FvApi, FvRights, T, day, money } from './fvApi'

export const MARKET_SUBJECTS = ['LICENSE', 'CONTRACT', 'COST_CATEGORY', 'FREE'] as const
export const MARKET_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED', 'NOT_CONFIGURED'] as const
export const PERIODS = ['MONTH', 'YEAR', 'ONE_TIME'] as const
export const GROUNDINGS = ['VERIFIED', 'SOURCE_ONLY'] as const
export const CONCENTRATIONS = ['HIGH', 'MODERATE', 'LOW'] as const

/**
 * Benchmarking in three parts: internal (the organization's own costs compared
 * with each other - works with no other organization), market (published
 * prices found by web research, each with its source and quoted passage) and
 * peers (opt-in, anonymous ratios). Every figure comes from the backend.
 */
export default function BenchmarkPanel({ api, t, rights, isAR }: { api: FvApi; t: T; rights: FvRights; isAR: boolean }) {
  if (!rights.VIEW_FINANCIAL_DATA) return <div data-testid="fv-bench"><div className="rp-card">{t('fv.restricted')}</div><BenchmarksCard api={api} t={t} /></div>
  return (
    <div data-testid="fv-bench">
      <InternalBenchmarks api={api} t={t} />
      <MarketBenchmarks api={api} t={t} rights={rights} isAR={isAR} />
      <BenchmarksCard api={api} t={t} />
    </div>
  )
}

function InternalBenchmarks({ api, t }: { api: FvApi; t: T }) {
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { api.get('/financial-value/benchmarks/internal').then(setD).catch(e => setErr(e.message)) }, [api])
  if (err) return <div className="rp-card" role="alert">{err}</div>
  if (!d) return <div className="rp-card">{t('common.loading')}</div>
  const cur = d.currency
  const vc = d.vendorConcentration
  return (
    <>
      <div className="rp-card" data-testid="fv-bench-types">
        <div className="rp-card-title">{t('fv.bi.types')}<HelpTip text={t('fv.bi.types.help')} /></div>
        {!d.unitCostByType.length ? <div className="ah-dim">{t('fv.bi.no_costs')}</div> : (
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.gaps.type')}</th><th>{t('fv.gaps.objects')}</th><th>{t('fv.bench.p25')}</th><th>{t('fv.bench.median')}</th><th>{t('fv.bench.p75')}</th><th>{t('fv.bi.total')}</th><th>{t('fv.bi.outliers')}</th></tr></thead>
            <tbody>{d.unitCostByType.map((g: any) => (
              <tr key={g.type}><td>{g.typeName}</td><td>{g.objects}</td>
                {g.enoughData ? <><td>{money(g.p25, cur)}</td><td>{money(g.median, cur)}</td><td>{money(g.p75, cur)}</td></> : <td colSpan={3} className="ah-dim">{t('fv.bi.too_few')}</td>}
                <td>{money(g.total, cur)}</td>
                <td>{g.outliers.length === 0 ? '—' : <ul className="ah-list" style={{ margin: 0 }}>{g.outliers.map((o: any) => <li key={o.id}><a href={`/repository?asset=${encodeURIComponent(o.id)}`}>{o.name}</a> {money(o.annual, cur)} <span className="ah-dim">({t('fv.bi.times_median').replace('{x}', String(o.timesMedian))})</span></li>)}</ul>}</td></tr>
            ))}</tbody></table></div>
        )}
      </div>

      <div className="rp-card rp-card-gap" data-testid="fv-bench-licenses">
        <div className="rp-card-title">{t('fv.bi.licenses')}<HelpTip text={t('fv.bi.licenses.help')} /></div>
        <div className="ah-dim">{t('fv.bi.lic_summary').replace('{median}', d.licenseUtilization.median === null ? '—' : `${d.licenseUtilization.median}%`).replace('{n}', String(d.licenseUtilization.measured)).replace('{m}', String(d.licenseUtilization.notMeasured))}</div>
        {d.licenseUtilization.rows.length > 0 && (
          <div className="rp-table-wrap" style={{ marginTop: 8 }}><table className="ah-table"><thead><tr><th>{t('fv.bi.product')}</th><th>{t('fv.vendor')}</th><th>{t('fv.bi.used')}</th><th>{t('fv.bi.utilization')}</th><th>{t('fv.bi.below_median')}</th><th>{t('fv.bi.unused_cost')}</th></tr></thead>
            <tbody>{d.licenseUtilization.rows.map((r: any) => <tr key={r.id}><td>{r.productName}</td><td>{r.vendor || '—'}</td><td>{r.used} / {r.quantity}</td><td>{r.utilizationPct}%</td><td>{r.belowMedianBy === null ? '—' : `${r.belowMedianBy} pt`}</td><td>{money(r.unusedCost, cur)}</td></tr>)}</tbody></table></div>
        )}
      </div>

      <div className="rp-card rp-card-gap" data-testid="fv-bench-prices">
        <div className="rp-card-title">{t('fv.bi.prices')}<HelpTip text={t('fv.bi.prices.help')} /></div>
        {!d.priceVariance.length ? <div className="ah-dim">{t('fv.bi.prices.none')}</div> : d.priceVariance.map((p: any, i: number) => (
          <div key={i} className="fv-alt">
            <strong>{p.productName}</strong> <span className="ah-dim">{p.metric}</span>
            <div>{t('fv.bi.price_range').replace('{low}', money(p.lowestUnitCost, cur)).replace('{high}', money(p.highestUnitCost, cur)).replace('{spread}', String(p.spreadPct ?? '—'))} · {t('fv.bi.gap')}: <strong>{money(p.gapToLowest, cur)}</strong></div>
            <ul className="ah-list">{p.entries.map((e: any) => <li key={e.id}>{e.vendor || '—'} · {e.quantity} × {money(e.unitCost, cur)}</li>)}</ul>
          </div>
        ))}
      </div>

      <div className="rp-card rp-card-gap" data-testid="fv-bench-vendors">
        <div className="rp-card-title">{t('fv.bi.vendors')}<HelpTip text={t('fv.bi.vendors.help')} /></div>
        {!vc.vendors.length ? <div className="ah-dim">{t('fv.bi.vendors.none')}</div> : (
          <>
            <div className="ah-tiles">
              <div className="ah-tile"><div className="ah-tile-label">{t('fv.bi.top_share')}</div><div className="ah-tile-value">{vc.topVendorSharePct}%</div><div className="ah-tile-sub">{vc.vendors[0].vendor}</div></div>
              <div className="ah-tile"><div className="ah-tile-label">{t('fv.bi.concentration')}</div><div className="ah-tile-value" style={{ fontSize: 18 }}>{t(`fv.bi.conc.${vc.concentration}`)}</div><div className="ah-tile-sub">HHI {vc.hhi}</div></div>
              <div className="ah-tile"><div className="ah-tile-label">{t('fv.bi.vendor_spend')}</div><div className="ah-tile-value">{money(vc.total, cur)}</div></div>
            </div>
            <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.vendor')}</th><th>{t('fv.annual_amount')}</th><th>{t('fv.bi.share')}</th></tr></thead>
              <tbody>{vc.vendors.slice(0, 15).map((v: any) => <tr key={v.vendor}><td>{v.vendor}</td><td>{money(v.annual, cur)}</td><td>{v.sharePct}%</td></tr>)}</tbody></table></div>
          </>
        )}
        {d.costCentres.length > 0 && (
          <div className="rp-table-wrap" style={{ marginTop: 10 }}><table className="ah-table"><thead><tr><th>{t('fv.department')}</th><th>{t('fv.annual_amount')}</th><th>{t('fv.bi.share')}</th></tr></thead>
            <tbody>{d.costCentres.map((c: any) => <tr key={c.key}><td>{c.key === 'UNASSIGNED' ? t('fv.unassigned') : c.key}</td><td>{money(c.annual, cur)}</td><td>{c.sharePct}%</td></tr>)}</tbody></table></div>
        )}
        <ul className="ah-list" style={{ marginTop: 8 }}>{d.notes.map((n: string, i: number) => <li key={i} className="ah-dim">{n}</li>)}</ul>
      </div>
    </>
  )
}

function MarketBenchmarks({ api, t, rights, isAR }: { api: FvApi; t: T; rights: FvRights; isAR: boolean }) {
  const [runs, setRuns] = useState<any[] | null>(null)
  const [open, setOpen] = useState<any>(null)
  const [form, setForm] = useState({ subjectKind: 'LICENSE', subjectId: '', subject: '', question: '' })
  const [options, setOptions] = useState<{ licenses: any[]; contracts: any[] }>({ licenses: [], contracts: [] })
  const [msg, setMsg] = useState<string | null>(null)
  const canRun = rights.MANAGE_DATA || rights.MANAGE_OPPORTUNITIES
  const load = useCallback(() => api.get('/financial-value/benchmarks/market').then((r: any) => setRuns(Array.isArray(r) ? r : [])).catch(e => { setMsg(e.message); setRuns([]) }), [api])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    Promise.all([api.get('/financial-value/licenses').catch(() => []), api.get('/financial-value/contracts').catch(() => [])])
      .then(([l, c]: any[]) => setOptions({ licenses: Array.isArray(l) ? l : [], contracts: Array.isArray(c) ? c : [] }))
  }, [api])
  useEffect(() => {
    if (!open || open.status !== 'RUNNING') return
    const h = setTimeout(() => api.get(`/financial-value/benchmarks/market/${open.id}`).then((r: any) => { setOpen(r); if (r.status !== 'RUNNING') load() }).catch(() => undefined), 4000)
    return () => clearTimeout(h)
  }, [api, open, load])
  const needsRef = form.subjectKind === 'LICENSE' || form.subjectKind === 'CONTRACT'
  const ready = needsRef ? !!form.subjectId : form.subject.trim().length >= 3
  const run = () => {
    setMsg(null)
    api.post('/financial-value/benchmarks/market', { subjectKind: form.subjectKind, subjectId: needsRef ? form.subjectId : null, subject: needsRef ? null : form.subject.trim(), question: form.question.trim() || null, language: isAR ? 'AR' : 'EN' })
      .then((r: any) => { setOpen(r); load() }).catch(e => setMsg(e.message))
  }
  const list = form.subjectKind === 'LICENSE' ? options.licenses : options.contracts
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-bench-market">
      <div className="rp-card-title">{t('fv.bm.title')}<HelpTip text={t('fv.bm.help')} /></div>
      {msg && <div className="rp-banner" role="alert">{msg}</div>}
      {canRun && (
        <div className="fv-form">
          <div className="form-group"><label className="form-label" htmlFor="fv-bm-kind">{t('fv.bm.kind')}</label>
            <select id="fv-bm-kind" className="form-input" value={form.subjectKind} onChange={e => setForm(f => ({ ...f, subjectKind: e.target.value, subjectId: '' }))}>{MARKET_SUBJECTS.map(k => <option key={k} value={k}>{t(`fv.bm.kind.${k}`)}</option>)}</select></div>
          {needsRef ? (
            <div className="form-group"><label className="form-label" htmlFor="fv-bm-ref">{t(`fv.bm.kind.${form.subjectKind}`)}</label>
              <select id="fv-bm-ref" className="form-input" value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}><option value="">—</option>{list.map((x: any) => <option key={x.id} value={x.id}>{x.productName || x.title}{x.vendor ? ` · ${x.vendor}` : ''}</option>)}</select></div>
          ) : (
            <div className="form-group"><label className="form-label" htmlFor="fv-bm-subject">{t('fv.bm.subject')}</label><input id="fv-bm-subject" className="form-input" value={form.subject} placeholder={t('fv.bm.subject.placeholder')} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} /></div>
          )}
          <div className="form-group fv-form-wide"><label className="form-label" htmlFor="fv-bm-q">{t('fv.bm.question')}</label><input id="fv-bm-q" className="form-input" value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} /></div>
          <div><button type="button" className="btn btn-primary btn-sm" disabled={!ready} onClick={run}>{t('fv.bm.run')}</button></div>
        </div>
      )}
      {!runs ? t('common.loading') : runs.length === 0 ? <div className="ah-dim" style={{ marginTop: 8 }}>{t('fv.bm.none')}</div> : (
        <ul className="ah-list" style={{ marginTop: 10 }}>{runs.map(r => (
          <li key={r.id}><button type="button" className="ah-link-btn" onClick={() => setOpen(r)}>{r.subject}</button> <span className={`fv-chip ${r.status === 'COMPLETED' ? 'fv-tone-good' : r.status === 'FAILED' ? 'fv-tone-bad' : 'fv-tone-neutral'}`}>{t(`fv.bm.status.${r.status}`)}</span> <span className="ah-dim">{day(r.createdAt)}{r.status === 'COMPLETED' ? ` · ${t('fv.bm.figures_n').replace('{n}', String((r.figures || []).length))}` : ''}</span></li>
        ))}</ul>
      )}
      {open && <MarketResult r={open} t={t} />}
    </div>
  )
}

function MarketResult({ r, t }: { r: any; t: T }) {
  const c = r.comparison
  return (
    <div className="fv-alt" data-testid="fv-bench-result" style={{ marginTop: 10 }}>
      <strong>{r.subject}</strong> <span className="fv-chip">{t(`fv.bm.status.${r.status}`)}</span>
      {r.status === 'RUNNING' && <div className="ah-dim">{t('fv.bm.running')}</div>}
      {r.error && <div className="rp-banner" role="alert">{r.error}</div>}
      {(r.figures || []).length > 0 && (
        <div className="rp-table-wrap" style={{ marginTop: 6 }}><table className="ah-table"><thead><tr><th>{t('fv.bm.figure')}</th><th>{t('fv.bm.price')}</th><th>{t('fv.bm.grounding')}</th><th>{t('fv.bm.source')}</th></tr></thead>
          <tbody>{r.figures.map((f: any, i: number) => (
            <tr key={i}><td>{f.label}<div className="ah-dim">“{f.quote}”</div></td>
              <td>{f.value.toLocaleString('en-US')} {f.currency} {f.unit} · {t(`fv.bm.period.${f.period}`)}</td>
              <td><span className={`fv-chip ${f.grounding === 'VERIFIED' ? 'fv-tone-good' : 'fv-tone-neutral'}`}>{t(`fv.bm.ground.${f.grounding}`)}</span></td>
              <td><a href={f.sourceUrl} target="_blank" rel="noreferrer noopener">{f.sourceTitle || f.sourceUrl}</a>{f.publishedAt ? <div className="ah-dim">{f.publishedAt}</div> : null}</td></tr>
          ))}</tbody></table></div>
      )}
      {r.status === 'COMPLETED' && !(r.figures || []).length && <div className="ah-dim">{t('fv.bm.no_figures')}</div>}
      {c && (
        <div style={{ marginTop: 8 }} data-testid="fv-bench-compare">
          <div className="rp-card-title">{t('fv.bm.compare').replace('{price}', money(c.ownAnnualUnitCost, c.currency))}</div>
          <ul className="ah-list">{c.rows.map((x: any, i: number) => <li key={i}>{x.label}: {x.marketAnnual === null ? (x.note || '—') : `${money(x.marketAnnual, c.currency)} · ${x.differencePct > 0 ? t('fv.bm.above').replace('{pct}', String(x.differencePct)) : t('fv.bm.below').replace('{pct}', String(Math.abs(x.differencePct)))}`}</li>)}</ul>
          <div className="ah-dim">{c.rule}</div>
        </div>
      )}
      {(r.dropped || []).length > 0 && <details style={{ marginTop: 6 }}><summary className="ah-dim">{t('fv.bm.dropped').replace('{n}', String(r.dropped.length))}</summary><ul className="ah-list">{r.dropped.map((x: any, i: number) => <li key={i}>{x.label}: {x.reason}</li>)}</ul></details>}
      {r.notes && <div className="ah-dim" style={{ marginTop: 6 }}>{r.notes}</div>}
    </div>
  )
}
