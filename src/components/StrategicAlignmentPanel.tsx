import { useCallback, useEffect, useMemo, useState } from 'react'
import HelpTip from './HelpTip'
import { AlignmentLevel, AlignmentLink, AlignmentNode, AlignmentState, CHAIN_COLUMNS, LINK_RULES, alignmentApi } from '../lib/strategy-alignment'

type T = (key: string) => string
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), text)
const ROLES = ['BUSINESS', 'DIGITAL', 'EA', 'OPERATING_MODEL'] as const
type View = 'matrix' | 'links' | 'gaps' | 'results'

/**
 * Strategic alignment: business -> digital -> EA goals -> EA value / functions / services / procedures,
 * with KPIs. ArchMind proposes the links; people confirm, reject or add them; the sheet exports in the
 * organization's own four-sheet format.
 */
export default function StrategicAlignmentPanel({ t, canPrepare, canReview }: { t: T; canPrepare: boolean; canReview: boolean }) {
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [data, setData] = useState<AlignmentState | null>(null)
  const [view, setView] = useState<View>('matrix')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [note, setNote] = useState('')
  const load = useCallback(() => alignmentApi.latest(year).then(setData).catch((e: any) => setError(e.message)), [year])
  useEffect(() => { load() }, [load])
  const status = data?.run?.status
  useEffect(() => {
    if (status !== 'QUEUED' && status !== 'PROCESSING') return
    const timer = window.setInterval(() => { load() }, 5000)
    return () => window.clearInterval(timer)
  }, [status, load])
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); try { await fn(); await load() } catch (e: any) { setError(e.message) } finally { setBusy(false) } }

  const nodes = useMemo(() => data?.nodes || [], [data])
  const links = data?.links || []
  const title = (key: string, fallback?: string | null) => nodes.find(n => n.key === key)?.title || fallback || key.split(':').slice(1).join(':')
  const level = (l: AlignmentLevel) => t(`strategy.align.level.${l}`)
  const fromOptions = nodes.filter(n => LINK_RULES.some(([a]) => a === n.level))
  const fromNode = nodes.find(n => n.key === from)
  const toOptions = fromNode ? nodes.filter(n => LINK_RULES.some(([a, b]) => a === fromNode.level && b === n.level)) : []
  const result = (key: string, period: string) => data?.results?.find(r => r.nodeKey === key && r.period === period)?.value || ''

  return <section className="alignment-panel">
    <div className="panel-head">
      <div><h2>{t('strategy.align.title')}<HelpTip text={t('strategy.align.help')} /></h2><p className="impact-note">{t('strategy.align.intro')}</p></div>
      <div className="panel-actions">
        <label htmlFor="align-year">{t('strategy.align.year')}<select id="align-year" value={year} onChange={e => setYear(Number(e.target.value))}>{[thisYear - 1, thisYear, thisYear + 1].map(y => <option key={y} value={y}>{y}</option>)}</select></label>
        {canPrepare && <button className="primary" disabled={busy || status === 'QUEUED' || status === 'PROCESSING'} onClick={() => act(() => alignmentApi.start())}>{t(data?.run ? 'strategy.align.regenerate' : 'strategy.align.prepare')}</button>}
        {status === 'READY' && <button disabled={busy} onClick={() => act(() => alignmentApi.export(year))}>{t('strategy.align.export')}</button>}
      </div>
    </div>
    {error && <div role="alert" className="error">{error}</div>}
    {!data?.run ? <p className="changes-empty">{t('strategy.align.empty')}</p>
      : status === 'QUEUED' || status === 'PROCESSING' ? <p className="changes-empty" role="status">{t('strategy.align.working')}</p>
      : status === 'FAILED' ? <div className="status error"><p>{t('strategy.align.failed')}</p><details><summary>{t('strategy.refresh.technical_details')}</summary><code>{data.run.failureCode}</code></details></div>
      : <>
        <ul className="align-sources">{ROLES.map(role => { const s = data.run!.sources?.[role]; return <li key={role}><strong>{t(`strategy.align.role.${role}`)}:</strong> {!s ? <span className="impact-note">{t('strategy.align.source.none')}</span> : s.kind === 'REPOSITORY' ? t('strategy.align.source.repository') : <>{s.strategyName}{s.provisional && <span className="align-provisional">{t('strategy.align.provisional')}</span>}</>}{s?.proceduresFrom === 'REPOSITORY' && <span className="impact-note"> · {t('strategy.align.source.ea_unit')}</span>}</li> })}</ul>
        {data.run.summary && (data.run.summary.kept + data.run.summary.flagged + data.run.summary.rejectedKept) > 0 && <p className="impact-note" role="status">{fill(t('strategy.align.carried'), { kept: data.run.summary.kept, flagged: data.run.summary.flagged, added: data.run.summary.added })}</p>}
        {!!data.run.warnings?.length && <details className="analysis-limits"><summary>{t('strategy.align.notes')} ({data.run.warnings.length})</summary><ul>{data.run.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details>}
        <nav className="align-views" aria-label={t('strategy.align.title')}>{(['matrix', 'links', 'gaps', 'results'] as View[]).map(v => <button key={v} aria-current={view === v ? 'page' : undefined} onClick={() => setView(v)}>{t(`strategy.align.view.${v}`)}{v === 'gaps' ? ` (${data.gaps?.length || 0})` : v === 'links' ? ` (${links.filter(l => l.status === 'PROPOSED').length})` : ''}</button>)}</nav>

        {view === 'matrix' && <div className="impact-table-wrap align-matrix"><table>
          <thead><tr>{CHAIN_COLUMNS.map(c => <th key={c} scope="col">{level(c)}</th>)}</tr></thead>
          <tbody>{(data.rows || []).map((row, i) => <tr key={i}>{CHAIN_COLUMNS.map(c => <td key={c}>{row[c]}</td>)}</tr>)}</tbody>
        </table></div>}

        {view === 'links' && <div className="align-links">
          {LINK_RULES.map(([a, b]) => { const list = links.filter(l => l.fromLevel === a && l.toLevel === b); if (!list.length) return null; return <div key={`${a}>${b}`} className="review-group">
            <h3>{level(a)} → {level(b)} ({list.length})</h3>
            {list.map((l: AlignmentLink) => <article key={l.id} className={`align-link status-${l.status}`} data-testid={`link-${l.id}`}>
              <div className="finding-meta"><span>{t(`strategy.align.status.${l.status}`)}</span>{l.status === 'PROPOSED' && <span>{Math.round(l.confidence * 100)}%</span>}</div>
              <p><strong>{title(l.fromKey, l.fromTitle)}</strong> → <strong>{title(l.toKey, l.toTitle)}</strong></p>
              <p className="impact-note">{l.rationale}</p>
              {l.status === 'FLAGGED' && <p className="limitation">{t(`strategy.align.flag.${l.flagReason || 'TO_REMOVED'}`)}</p>}
              {canReview && <div className="actions">
                {l.status !== 'CONFIRMED' && <button disabled={busy} onClick={() => act(() => alignmentApi.decide(l.id, 'CONFIRMED'))}>{t('strategy.align.confirm')}</button>}
                {l.status !== 'REJECTED' && <button disabled={busy} onClick={() => act(() => alignmentApi.decide(l.id, 'REJECTED'))}>{t('strategy.align.reject')}</button>}
              </div>}
            </article>)}
          </div> })}
          {!links.length && <p className="impact-note">{t('strategy.align.no_links')}</p>}
          {canReview && <div className="align-add">
            <h3>{t('strategy.align.add')}<HelpTip text={t('strategy.align.add_help')} /></h3>
            <label htmlFor="align-from">{t('strategy.align.add_from')}<select id="align-from" value={from} onChange={e => { setFrom(e.target.value); setTo('') }}><option value="">—</option>{fromOptions.map(n => <option key={n.key} value={n.key}>{level(n.level)} · {n.title}</option>)}</select></label>
            <label htmlFor="align-to">{t('strategy.align.add_to')}<select id="align-to" value={to} disabled={!fromNode} onChange={e => setTo(e.target.value)}><option value="">—</option>{toOptions.map(n => <option key={n.key} value={n.key}>{level(n.level)} · {n.title}</option>)}</select></label>
            <label htmlFor="align-note">{t('strategy.align.add_note')}<input id="align-note" value={note} maxLength={600} onChange={e => setNote(e.target.value)} /></label>
            <button disabled={busy || !from || !to} onClick={() => act(async () => { await alignmentApi.addLink(from, to, note.trim() || undefined); setFrom(''); setTo(''); setNote('') })}>{t('strategy.align.add_button')}</button>
          </div>}
        </div>}

        {view === 'gaps' && <div className="align-gaps">{(data.gaps || []).length ? <ul>{data.gaps!.map((g, i) => <li key={i}><strong>{level(g.level)} · {g.title}</strong> — {t(`strategy.align.gap.${g.code}`)}</li>)}</ul> : <p className="impact-note">{t('strategy.align.no_gaps')}</p>}</div>}

        {view === 'results' && <div className="align-results">
          <h3>{t('strategy.align.results.ea_kpis')}<HelpTip text={t('strategy.align.results.ea_kpis_help')} /></h3>
          <ResultTable t={t} nodes={nodes.filter(n => n.level === 'EA_KPI')} periods={['FORMULA', 'Q1', 'Q2', 'Q3']} value={result} canEdit={canReview} onSave={(key, period, v) => act(() => alignmentApi.setValue(key, year, period, v))} />
          <h3>{t('strategy.align.results.roadmap')}<HelpTip text={t('strategy.align.results.roadmap_help')} /></h3>
          <ResultTable t={t} nodes={nodes.filter(n => n.level === 'DT_INITIATIVE')} periods={['PROGRESS']} value={result} canEdit={canReview} onSave={(key, period, v) => act(() => alignmentApi.setValue(key, year, period, v))} />
          <p className="impact-note">{t('strategy.align.results.op_kpis')}</p>
        </div>}
      </>}
  </section>
}

function ResultTable({ t, nodes, periods, value, canEdit, onSave }: { t: T; nodes: AlignmentNode[]; periods: string[]; value: (key: string, period: string) => string; canEdit: boolean; onSave: (key: string, period: string, value: string) => void }) {
  if (!nodes.length) return <p className="impact-note">{t('strategy.align.results.none')}</p>
  return <div className="impact-table-wrap"><table>
    <thead><tr><th scope="col">{t('strategy.align.results.element')}</th>{periods.map(p => <th key={p} scope="col">{t(`strategy.align.period.${p}`)}</th>)}</tr></thead>
    <tbody>{nodes.map(n => <tr key={n.key}><td>{n.title}</td>{periods.map(p => {
      const current = value(n.key, p) || (p === 'FORMULA' ? n.formula || '' : '')
      return <td key={p}>{canEdit ? <input aria-label={`${n.title} ${t(`strategy.align.period.${p}`)}`} defaultValue={current} onBlur={e => { if (e.target.value !== current) onSave(n.key, p, e.target.value) }} /> : current}</td>
    })}</tr>)}</tbody>
  </table></div>
}
