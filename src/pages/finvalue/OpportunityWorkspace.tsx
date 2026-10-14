import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { BASES, EVIDENCE_KINDS, FvApi, FvRights, ONE_TIME_CATEGORIES, T, day, money, num, saveBlob } from './fvApi'
import { StatusChip } from './Overview'
import { AlternativesPanel, AssumptionSuggestions, CompliancePanel, NarrativeCard, PrintableBusinessCase, ScenarioClaims } from './OpportunityExtras'

type Tab = 'summary' | 'financials' | 'alternatives' | 'evidence' | 'decisions' | 'execution' | 'history'
const TABS: Tab[] = ['summary', 'financials', 'alternatives', 'evidence', 'decisions', 'execution', 'history']

function Kv({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return <dl className="fv-kv">{rows.map(([k, v], i) => <div key={i} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
}

/** One savings opportunity: everything needed to decide, execute and verify it. */
export default function OpportunityWorkspace({ api, t, rights, isAR, id, onBack }: { api: FvApi; t: T; rights: FvRights; isAR: boolean; id: string; onBack: () => void }) {
  const [o, setO] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('summary')
  const load = useCallback(() => { api.get(`/financial-value/opportunities/${encodeURIComponent(id)}`).then(setO).catch(e => setError(e.message)) }, [api, id])
  useEffect(() => { setO(null); load() }, [load])
  const act = (p: Promise<any>, ok?: string) => { setMsg(null); return p.then(r => { if (r && r.id === id && r.actions) setO(r); else load(); if (ok) setMsg(ok) }).catch(e => setMsg(e.message)) }

  if (error) return <div className="rp-card" role="alert">{error}</div>
  if (!o) return <div className="rp-card">{t('common.loading')}</div>
  const cur = o.settings?.baseCurrency || 'SAR'
  const c = o.calculation || {}

  return (
    <div data-testid="fv-workspace">
      <button type="button" className="ah-link-btn fv-back" onClick={onBack}>{isAR ? '→' : '←'} {t('fv.back')}</button>
      <div className="rp-card">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 17, flex: 1, minWidth: 200 }}>{o.title}</h2>
          <StatusChip status={o.status} t={t} />
          <span className="fv-chip">{t(`fv.engine.${o.engine}`)}</span>
          <span className="fv-chip">{t(`fv.benefit.${o.benefitType}`)}</span>
        </div>
        <div className="ah-dim" style={{ marginTop: 4 }}>{t(`fv.action.${o.action}`)} · {t(`fv.source.${o.sourceKind}`)}{o.stale ? ` · ${t('fv.stale')}` : ''}</div>
      </div>
      <div className="ap-tabs" role="tablist" aria-label={t('fv.workspace.tabs')}>
        {TABS.map(x => <button key={x} type="button" role="tab" className="ap-tab" aria-selected={tab === x} onClick={() => setTab(x)}>{t(`fv.ws.${x}`)}</button>)}
      </div>
      {msg && <div className="rp-banner" role="status" style={{ marginTop: 12 }}>{msg}</div>}
      <div style={{ marginTop: 16 }}>
        {tab === 'summary' && <SummaryTab o={o} c={c} cur={cur} t={t} api={api} rights={rights} act={act} />}
        {tab === 'summary' && <NarrativeCard o={o} t={t} api={api} rights={rights} act={act} isAR={isAR} />}
        {tab === 'financials' && <FinancialsTab o={o} c={c} cur={cur} t={t} api={api} rights={rights} act={act} />}
        {tab === 'alternatives' && <AlternativesPanel o={o} t={t} api={api} rights={rights} act={act} cur={cur} />}
        {tab === 'evidence' && <EvidenceTab o={o} c={c} t={t} api={api} rights={rights} act={act} />}
        {tab === 'decisions' && <DecisionsTab o={o} t={t} api={api} rights={rights} act={act} isAR={isAR} />}
        {tab === 'execution' && <ExecutionTab o={o} cur={cur} t={t} api={api} rights={rights} act={act} />}
        {tab === 'history' && (
          <div className="rp-card">
            <ul className="ah-list">{o.events.map((e: any) => <li key={e.id}>{day(e.createdAt)} · {t(`fv.event.${e.eventType}`) === `fv.event.${e.eventType}` ? e.eventType : t(`fv.event.${e.eventType}`)}{e.toStatus ? ` → ${t(`fv.status.${e.toStatus}`)}` : ''}{e.note ? <div className="ah-dim">{e.note}</div> : null}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  )
}

type TabProps = { o: any; c?: any; cur?: string; t: T; api: FvApi; rights: FvRights; act: (p: Promise<any>, ok?: string) => Promise<any> }

function SummaryTab({ o, c, cur, t, api, rights, act }: TabProps) {
  const [details, setDetails] = useState({ ownerUserId: o.ownerUserId || '', targetImplementationDate: day(o.targetImplementationDate) === '—' ? '' : day(o.targetImplementationDate), savingsStartDate: day(o.savingsStartDate) === '—' ? '' : day(o.savingsStartDate), approvalAuthority: o.approvalAuthority || '' })
  const [users, setUsers] = useState<any[]>([])
  useEffect(() => { api.get('/users').then((d: any) => setUsers(Array.isArray(d) ? d : [])).catch(() => setUsers([])) }, [api])
  const editable = rights.MANAGE_OPPORTUNITIES && !['REJECTED', 'CANCELLED', 'REALIZED', 'CLOSED_WITHOUT_SAVINGS'].includes(o.status)
  const sourceLink = (s: any) => s.kind === 'GOVERNANCE_FINDING' && s.reviewId ? `/governance?review=${encodeURIComponent(s.reviewId)}` : s.kind === 'ARCHITECTURE_HEALTH' && s.domainCode ? `/architecture-health?domain=${encodeURIComponent(s.domainCode)}` : s.kind === 'REPOSITORY' ? `/repository?asset=${encodeURIComponent(s.id)}` : s.kind === 'REFERENCE_ARCHITECTURE' && s.id ? `/reference-architectures?ra=${encodeURIComponent(String(s.id).split(':')[0])}` : null
  return (
    <>
      <div className="ah-tiles">
        <div className="ah-tile"><div className="ah-tile-label">{t('fv.current_annual')}</div><div className="ah-tile-value">{money(c.currentAnnualCost, cur)}</div></div>
        <div className="ah-tile"><div className="ah-tile-label">{t('fv.target_annual')}</div><div className="ah-tile-value">{money(c.targetAnnualCost, cur)}</div></div>
        <div className="ah-tile"><div className="ah-tile-label">{o.benefitType === 'COST_AVOIDANCE' ? t('fv.avoidance') : t('fv.net_annual')}<HelpTip text={t('fv.net_annual.help')} /></div><div className="ah-tile-value">{o.benefitType === 'COST_AVOIDANCE' ? money(o.costAvoidance, cur) : o.netAnnualSaving === null ? t('fv.not_quantified') : money(o.netAnnualSaving, cur)}</div></div>
        <div className="ah-tile"><div className="ah-tile-label">{t('fv.one_time')}</div><div className="ah-tile-value">{money(o.oneTimeCost, cur)}</div></div>
        <div className="ah-tile"><div className="ah-tile-label">{t('fv.payback')}</div><div className="ah-tile-value">{o.paybackMonths === null ? '—' : `${o.paybackMonths} ${t('fv.months')}`}</div></div>
        <div className="ah-tile"><div className="ah-tile-label">{t('fv.confidence')}<HelpTip text={t('fv.confidence.help')} /></div><div className="ah-tile-value" style={{ fontSize: 18 }}>{t(`fv.confidence.${o.confidence}`)}</div><div className="ah-tile-sub">{t('fv.evidence_completeness')} {num(o.evidenceCompleteness, '%')}</div></div>
        <div className="ah-tile fv-realized"><div className="ah-tile-label">{t('fv.realized')}</div><div className="ah-tile-value">{money(o.realizedAmount, cur)}</div></div>
      </div>
      {o.indicativeAnnualSaving ? <div className="fv-note">{t('fv.indicative_note').replace('{amount}', money(o.indicativeAnnualSaving, cur)).replace('{source}', o.indicativeSource || '')}</div> : null}
      <div className="ah-grid-2" style={{ marginTop: 16 }}>
        <div className="rp-card">
          <div className="rp-card-title">{t('fv.why')}</div>
          {o.description && <p style={{ marginTop: 0 }}>{o.description}</p>}
          {o.rationale && <p className="ah-dim">{o.rationale}</p>}
          <div className="rp-card-title" style={{ marginTop: 12 }}>{t('fv.sources')}<HelpTip text={t('fv.sources.help')} /></div>
          <ul className="ah-list">{o.sources.map((s: any, i: number) => {
            const href = sourceLink(s)
            return <li key={i}>{href ? <a href={href}>{s.label}</a> : s.label}{s.detail ? <div className="ah-dim">{s.detail}</div> : null}
              {s.live && <div className="ah-dim">{Object.entries(s.live).filter(([k]) => k !== 'reviewId' && k !== 'architectureId').map(([k, v]) => `${t(`fv.live.${k}`)}: ${v ?? '—'}`).join(' · ')}</div>}</li>
          })}</ul>
        </div>
        <div className="rp-card">
          <div className="rp-card-title">{t('fv.objects')}</div>
          {o.assets.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : <ul className="ah-list">{o.assets.map((a: any) => <li key={a.id}><a href={`/repository?asset=${encodeURIComponent(a.id)}`}>{a.name}</a> <span className="ah-dim">{a.assetType}{a.lifecycleStatus ? ` · ${a.lifecycleStatus}` : ''}{a.id === o.subjectAssetId ? ` · ${t('fv.subject')}` : ''}</span></li>)}</ul>}
          {o.dependencies?.length > 0 && <><div className="rp-card-title" style={{ marginTop: 12 }}>{t('fv.dependencies')}<HelpTip text={t('fv.dependencies.help')} /></div><ul className="ah-list">{o.dependencies.map((d: any, i: number) => <li key={i}>{d.assetId ? <a href={`/repository?asset=${encodeURIComponent(d.assetId)}`}>{d.name}</a> : d.name} <span className="ah-dim">{d.relation}</span></li>)}</ul></>}
          {o.overlaps?.length > 0 && <div className="rp-banner" style={{ marginTop: 12 }}>{o.overlaps.map((g: any) => t('fv.overlap.asset').replace('{asset}', g.assetName).replace('{others}', g.opportunities.map((x: any) => x.title).join(', '))).join(' ')}</div>}
          {o.scenario && <div className="ah-dim" style={{ marginTop: 8 }}>{t('fv.scenario')}: {o.scenario.name}</div>}
        </div>
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.details')}</div>
        <div className="fv-form">
          <div className="form-group"><label className="form-label" htmlFor="fv-d-owner">{t('fv.field.owner')}</label>
            {users.length ? <select id="fv-d-owner" className="form-input" value={details.ownerUserId} disabled={!editable} onChange={e => setDetails(d => ({ ...d, ownerUserId: e.target.value }))}><option value="">—</option>{users.map(u => <option key={u.id} value={u.id}>{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</option>)}</select>
              : <input id="fv-d-owner" className="form-input" value={details.ownerUserId} disabled={!editable} onChange={e => setDetails(d => ({ ...d, ownerUserId: e.target.value }))} />}
          </div>
          <div className="form-group"><label className="form-label" htmlFor="fv-d-target">{t('fv.field.target_date')}</label><input id="fv-d-target" type="date" className="form-input" value={details.targetImplementationDate} disabled={!editable} onChange={e => setDetails(d => ({ ...d, targetImplementationDate: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label" htmlFor="fv-d-start">{t('fv.field.savings_start')}</label><input id="fv-d-start" type="date" className="form-input" value={details.savingsStartDate} disabled={!editable} onChange={e => setDetails(d => ({ ...d, savingsStartDate: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label" htmlFor="fv-d-authority">{t('fv.field.authority')}</label><input id="fv-d-authority" className="form-input" value={details.approvalAuthority} disabled={!editable} onChange={e => setDetails(d => ({ ...d, approvalAuthority: e.target.value }))} /></div>
        </div>
        {editable && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={() => act(api.put(`/financial-value/opportunities/${o.id}`, { ownerUserId: details.ownerUserId || null, targetImplementationDate: details.targetImplementationDate || null, savingsStartDate: details.savingsStartDate || null, approvalAuthority: details.approvalAuthority || null }), t('fv.saved'))}>{t('fv.save')}</button>}
      </div>
    </>
  )
}

// ── Financial model ─────────────────────────────────────────────────────────

type Line = { label: string; amount?: number | string; annualAmount?: number | string; currency: string; basis: string; category?: string; year?: number | string; recurring?: boolean; startMonth?: number | string }

function LineEditor({ title, lines, setLines, kind, t, cur, disabled }: { title: string; lines: Line[]; setLines: (l: Line[]) => void; kind: 'oneTime' | 'newRecurring' | 'avoided'; t: T; cur: string; disabled: boolean }) {
  const amountKey = kind === 'newRecurring' ? 'annualAmount' : 'amount'
  const update = (i: number, k: string, v: any) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)))
  return (
    <div style={{ marginTop: 12 }}>
      <div className="rp-card-title">{title}</div>
      <div className="fv-lines">
        {lines.map((l, i) => (
          <div key={i} className="fv-line">
            <input aria-label={t('fv.line.label')} className="form-input" value={l.label} disabled={disabled} onChange={e => update(i, 'label', e.target.value)} placeholder={t('fv.line.label')} />
            <input aria-label={t('fv.line.amount')} className="form-input" type="number" min={0} value={(l as any)[amountKey] ?? ''} disabled={disabled} onChange={e => update(i, amountKey, e.target.value)} placeholder={t('fv.line.amount')} />
            {kind === 'oneTime'
              ? <select aria-label={t('fv.line.category')} className="form-input" value={l.category || 'IMPLEMENTATION'} disabled={disabled} onChange={e => update(i, 'category', e.target.value)}>{ONE_TIME_CATEGORIES.map(x => <option key={x} value={x}>{t(`fv.onetime.${x}`)}</option>)}</select>
              : kind === 'avoided'
                ? <label className="ah-dim"><input type="checkbox" checked={!!l.recurring} disabled={disabled} onChange={e => update(i, 'recurring', e.target.checked)} /> {t('fv.line.recurring')}</label>
                : <input aria-label={t('fv.line.start_month')} className="form-input" type="number" min={0} value={l.startMonth ?? 0} disabled={disabled} onChange={e => update(i, 'startMonth', e.target.value)} />}
            <input aria-label={t('fv.line.currency')} className="form-input" value={l.currency} disabled={disabled} onChange={e => update(i, 'currency', e.target.value.toUpperCase())} />
            <select aria-label={t('fv.line.basis')} className="form-input" value={l.basis} disabled={disabled} onChange={e => update(i, 'basis', e.target.value)}>{BASES.map(b => <option key={b} value={b}>{t(`fv.basis.${b}`)}</option>)}{l.basis === 'AI_SUGGESTED' && <option value="AI_SUGGESTED">{t('fv.basis.AI_SUGGESTED')}</option>}</select>
            {!disabled && <button type="button" className="ah-link-btn" aria-label={t('fv.remove')} onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
      </div>
      {!disabled && <button type="button" className="ah-link-btn" style={{ marginTop: 6 }} onClick={() => setLines([...lines, { label: '', currency: cur, basis: kind === 'avoided' ? 'QUOTE' : 'ESTIMATE', ...(kind === 'oneTime' ? { category: 'IMPLEMENTATION', year: 0 } : {}), ...(kind === 'avoided' ? { recurring: false, year: 0 } : {}) }])}>+ {t('fv.line.add')}</button>}
    </div>
  )
}

function FinancialsTab({ o, c, cur = 'SAR', t, api, rights, act }: TabProps) {
  const editable = rights.MANAGE_OPPORTUNITIES && ['DISCOVERED', 'EVIDENCE_REQUIRED', 'VALIDATED', 'BUSINESS_CASE_PREPARED'].includes(o.status)
  const m = o.model || {}
  const [oneTime, setOneTime] = useState<Line[]>(m.oneTime || [])
  const [newRecurring, setNewRecurring] = useState<Line[]>(m.newRecurring || [])
  const [avoided, setAvoided] = useState<Line[]>(m.avoided || [])
  const [startMonth, setStartMonth] = useState<number>(m.savingsStartMonth || 0)
  const [noOneTime, setNoOneTime] = useState<boolean>(!!m.noOneTimeCost)
  const [costs, setCosts] = useState<any[] | null>(null)
  const [claims, setClaims] = useState<Record<string, number>>(Object.fromEntries((o.claims || []).map((x: any) => [x.costItemId, x.reductionPct])))
  const [ratings, setRatings] = useState<Record<string, number | null>>(o.ratings || {})
  useEffect(() => {
    if (!rights.VIEW_FINANCIAL_DATA) { setCosts([]); return }
    Promise.all((o.assets || []).map((a: any) => api.get(`/financial-value/costs?assetId=${encodeURIComponent(a.id)}`).catch(() => [])))
      .then(lists => { const all = new Map<string, any>(); lists.flat().forEach((x: any) => all.set(x.id, x)); (o.claims || []).forEach((x: any) => x.costItem && !all.has(x.costItemId) && all.set(x.costItemId, { ...x.costItem })); setCosts([...all.values()].filter(x => x.status !== 'REJECTED' && x.status !== 'SUPERSEDED')) })
  }, [api, o.assets, o.claims, rights.VIEW_FINANCIAL_DATA])
  const toNum = (l: Line) => ({ ...l, amount: l.amount === undefined ? undefined : Number(l.amount), annualAmount: l.annualAmount === undefined ? undefined : Number(l.annualAmount), year: Number(l.year || 0), startMonth: Number(l.startMonth || 0) })
  const saveModel = () => act(api.put(`/financial-value/opportunities/${o.id}/model`, { ...m, savingsStartMonth: Number(startMonth) || 0, oneTime: oneTime.map(toNum), newRecurring: newRecurring.map(toNum), avoided: avoided.map(toNum), noOneTimeCost: noOneTime }), t('fv.recalculated'))
  const saveClaims = () => act(api.put(`/financial-value/opportunities/${o.id}/claims`, { claims: Object.entries(claims).filter(([, p]) => Number(p) > 0).map(([costItemId, reductionPct]) => ({ costItemId, reductionPct: Number(reductionPct) })) }), t('fv.recalculated'))
  const sim = c.simulation
  const score = o.score
  return (
    <>
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.claims.title')}<HelpTip text={t('fv.claims.help')} /></div>
        {o.financialDataRestricted ? <div className="ah-dim">{t('fv.restricted')}</div> : !costs ? t('common.loading') : costs.length === 0 ? <div className="ah-dim">{t('fv.claims.no_costs')}</div> : (
          <div className="rp-table-wrap"><table className="ah-table" data-testid="fv-claims"><thead><tr><th>{t('fv.cost_item')}</th><th>{t('fv.annual_amount')}</th><th>{t('fv.basis')}</th><th>{t('fv.data_status')}</th><th>{t('fv.claims.share')}</th><th>{t('fv.claims.allocated')}</th></tr></thead>
            <tbody>{costs.map(ci => { const claim = (o.claims || []).find((x: any) => x.costItemId === ci.id); return (
              <tr key={ci.id}><td>{ci.description || t(`fv.cost.${ci.category}`)}<div className="ah-dim">{ci.asset?.name || ''}</div></td><td>{money(ci.annualAmount, ci.currency)}</td><td>{t(`fv.basis.${ci.basis}`)}</td><td>{t(`fv.data.${ci.status}`)}</td>
                <td><input aria-label={`${t('fv.claims.share')} ${ci.description || ci.category}`} className="form-input" type="number" min={0} max={100} style={{ maxWidth: 90 }} disabled={!editable} value={claims[ci.id] ?? ''} onChange={e => setClaims(cl => ({ ...cl, [ci.id]: Number(e.target.value) }))} /></td>
                <td>{claim ? `${claim.allocatedPct}%` : '—'}{claim?.sharedWith?.length ? <div className="ah-dim">{t('fv.claims.shared').replace('{titles}', claim.sharedWith.map((s: any) => s.title).join(', '))}</div> : null}</td></tr>) })}</tbody></table></div>
        )}
        {editable && costs && costs.length > 0 && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={saveClaims}>{t('fv.claims.save')}</button>}
        {editable && <ScenarioClaims o={o} t={t} api={api} onUse={(proposed, rows) => { setClaims(cl => ({ ...cl, ...proposed })); setCosts(cs => [...(cs || []), ...rows.filter(r => !(cs || []).some(x => x.id === r.costItemId)).map(r => ({ id: r.costItemId, category: r.category, description: r.description, basis: r.basis, annualAmount: r.annualAmount, currency: r.currency, status: r.status, asset: { name: r.assetName } }))]) }} />}
      </div>

      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.model.title')}<HelpTip text={t('fv.model.help')} /></div>
        <div className="fv-form">
          <div className="form-group"><label className="form-label" htmlFor="fv-m-start">{t('fv.model.start_month')}</label><input id="fv-m-start" type="number" min={0} className="form-input" value={startMonth} disabled={!editable} onChange={e => setStartMonth(Number(e.target.value))} /></div>
          <div className="form-group"><label className="ah-dim" htmlFor="fv-m-noone"><input id="fv-m-noone" type="checkbox" checked={noOneTime} disabled={!editable} onChange={e => setNoOneTime(e.target.checked)} /> {t('fv.model.no_one_time')}</label></div>
        </div>
        {editable && <AssumptionSuggestions o={o} t={t} api={api} onAdd={sg => (sg.kind === 'RECURRING'
          ? setNewRecurring(l => [...l, { label: sg.label, currency: cur, basis: 'AI_SUGGESTED', startMonth: 0 }])
          : setOneTime(l => [...l, { label: sg.label, currency: cur, basis: 'AI_SUGGESTED', category: sg.category, year: 0 }]))} />}
        <LineEditor title={t('fv.model.one_time')} lines={oneTime} setLines={setOneTime} kind="oneTime" t={t} cur={cur} disabled={!editable} />
        <LineEditor title={t('fv.model.new_recurring')} lines={newRecurring} setLines={setNewRecurring} kind="newRecurring" t={t} cur={cur} disabled={!editable} />
        <LineEditor title={t('fv.model.avoided')} lines={avoided} setLines={setAvoided} kind="avoided" t={t} cur={cur} disabled={!editable} />
        {editable ? <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={saveModel}>{t('fv.model.save')}</button> : <div className="ah-dim" style={{ marginTop: 8 }}>{t('fv.model.frozen')}</div>}
      </div>

      <div className="rp-card rp-card-gap" data-testid="fv-calculation">
        <div className="rp-card-title">{t('fv.calc.title')}<HelpTip text={t('fv.calc.help')} /></div>
        {!c.method ? <div className="ah-dim">{t('fv.calc.none')}</div> : (
          <>
            <Kv rows={[
              [t('fv.current_annual'), money(c.currentAnnualCost, cur)], [t('fv.calc.gross'), money(c.grossAnnualSaving, cur)], [t('fv.calc.new_recurring'), money(c.newRecurringAnnual, cur)],
              [t('fv.net_annual'), money(c.netAnnualSaving, cur)], [t('fv.target_annual'), money(c.targetAnnualCost, cur)], [t('fv.one_time'), money(c.oneTimeTotal, cur)],
              [t('fv.calc.parallel'), money(c.parallelRunCost, cur)], [t('fv.avoidance'), money(c.costAvoidanceTotal, cur)], [t('fv.calc.npv'), money(c.npv, cur)],
              [t('fv.calc.roi'), c.roiPct === null ? '—' : `${c.roiPct}%`], [t('fv.payback'), c.paybackMonths === null ? t('fv.calc.no_payback') : `${c.paybackMonths} ${t('fv.months')}`],
              [t('fv.calc.tco3'), `${money(c.tco.current3, cur)} → ${money(c.tco.target3, cur)}`], [t('fv.calc.tco5'), `${money(c.tco.current5, cur)} → ${money(c.tco.target5, cur)}`],
              [t('fv.calc.method'), `${c.method} · ${c.inputHash}`],
            ]} />
            {c.overlapReduction > 0 && <div className="rp-banner" style={{ marginTop: 8 }}>{t('fv.calc.overlap').replace('{amount}', money(c.overlapReduction, cur))}</div>}
            {(c.excluded || []).length > 0 && <div className="rp-banner" style={{ marginTop: 8 }}>{t('fv.calc.excluded')}: {c.excluded.join('; ')}</div>}
            <div className="rp-table-wrap" style={{ marginTop: 12 }}><table className="ah-table"><thead><tr><th>{t('fv.calc.year')}</th><th>{t('fv.calc.savings')}</th><th>{t('fv.calc.new_costs')}</th><th>{t('fv.one_time')}</th><th>{t('fv.avoidance')}</th><th>{t('fv.calc.net')}</th><th>{t('fv.calc.cumulative')}</th></tr></thead>
              <tbody>{c.flows.map((f: any) => <tr key={f.year}><td>{f.year}</td><td>{money(f.savings, cur)}</td><td>{money(f.newCosts, cur)}</td><td>{money(f.oneTime, cur)}</td><td>{money(f.avoided, cur)}</td><td>{money(f.net, cur)}</td><td>{money(f.cumulativeNet, cur)}</td></tr>)}</tbody></table></div>
            <details style={{ marginTop: 8 }}><summary className="ah-dim">{t('fv.calc.formulas')}</summary><ul className="ah-list">{Object.entries(c.formulas || {}).map(([k, v]) => <li key={k}><strong>{k}</strong>: {String(v)}</li>)}</ul></details>
          </>
        )}
      </div>

      {sim && (
        <div className="rp-card rp-card-gap" data-testid="fv-scenarios">
          <div className="rp-card-title">{t('fv.sim.title')}<HelpTip text={t('fv.sim.help')} /></div>
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th /><th>{t('fv.net_annual')}</th><th>{t('fv.one_time')}</th><th>{t('fv.calc.npv')}</th><th>{t('fv.payback')}</th></tr></thead>
            <tbody>
              <tr><td>{t('fv.sim.baseline')}</td><td colSpan={4}>{t('fv.sim.baseline_text').replace('{annual}', money(sim.baseline.annualCost, cur)).replace('{horizon}', money(sim.baseline.horizonCost, cur))}</td></tr>
              {sim.scenarios.map((s: any) => <tr key={s.code}><td>{t(`fv.sim.${s.code}`)}</td><td>{money(s.netAnnualSaving, cur)}</td><td>{money(s.oneTimeTotal, cur)}</td><td>{money(s.npv, cur)}</td><td>{s.paybackMonths === null ? '—' : `${s.paybackMonths} ${t('fv.months')}`}</td></tr>)}
            </tbody></table></div>
          <div className="rp-card-title" style={{ marginTop: 12 }}>{t('fv.sim.sensitivity')}</div>
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.sim.variable')}</th><th>{t('fv.sim.change')}</th><th>{t('fv.calc.npv')}</th></tr></thead>
            <tbody>{sim.sensitivity.map((s: any, i: number) => <tr key={i}><td>{t(`fv.sim.var.${s.variable}`)}</td><td>{s.change}</td><td>{money(s.npv, cur)}</td></tr>)}</tbody></table></div>
        </div>
      )}

      {score && (
        <div className="rp-card rp-card-gap" data-testid="fv-priority">
          <div className="rp-card-title">{t('fv.prio.title')}: {t(`fv.class.${score.priorityClass}`)} {score.score !== null && `· ${score.score}`}<HelpTip text={t('fv.prio.help')} /></div>
          <ul className="ah-list">{score.gates.map((g: any) => <li key={g.code}>{g.passed ? '✓' : '✗'} {t(`fv.gate.${g.code}`)} <span className="ah-dim">{g.reason}</span></li>)}</ul>
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.prio.criterion')}</th><th>{t('fv.prio.weight')}</th><th>{t('fv.prio.score')}</th><th>{t('fv.prio.rationale')}</th></tr></thead>
            <tbody>{score.criteria.map((x: any) => <tr key={x.code}><td>{t(`fv.crit.${x.code}`)}</td><td>{x.weight}{x.effectiveWeight ? <span className="ah-dim"> ({x.effectiveWeight})</span> : null}</td><td>{x.status === 'ASSESSED' ? `${x.score}/5` : <span className="ah-chip">{t('fv.not_assessed')}</span>}</td><td className="ah-dim">{x.rationale}</td></tr>)}</tbody></table></div>
          <div className="ah-dim" style={{ marginTop: 6 }}>{score.rule}</div>
          {(rights.MANAGE_OPPORTUNITIES || rights.ASSESS_FEASIBILITY) && (
            <div className="fv-form" style={{ marginTop: 10 }}>
              {['IMPLEMENTATION_COMPLEXITY', 'BUSINESS_IMPACT', 'STRATEGIC_ALIGNMENT', 'ARCHITECTURE_ALIGNMENT'].map(k => (
                <div className="form-group" key={k}><label className="form-label" htmlFor={`fv-r-${k}`}>{t(`fv.crit.${k}`)}</label>
                  <select id={`fv-r-${k}`} className="form-input" value={ratings[k] ?? ''} onChange={e => setRatings(r => ({ ...r, [k]: e.target.value ? Number(e.target.value) : null }))}><option value="">{t('fv.not_rated')}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              ))}
              <div><button type="button" className="btn btn-secondary btn-sm" onClick={() => act(api.put(`/financial-value/opportunities/${o.id}/ratings`, { ratings }), t('fv.saved'))}>{t('fv.prio.save_ratings')}</button></div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

// ── Evidence and data ───────────────────────────────────────────────────────

function EvidenceTab({ o, c, t, api, rights, act }: TabProps) {
  const [ev, setEv] = useState({ kind: 'INVOICE', title: '', url: '' })
  const [file, setFile] = useState<File | null>(null)
  const canAdd = rights.MANAGE_OPPORTUNITIES || rights.MANAGE_DATA
  const addLink = () => act(api.post('/financial-value/evidence/link', { opportunityId: o.id, ...ev }), t('fv.evidence.added')).then(() => setEv({ kind: ev.kind, title: '', url: '' }))
  const addFile = () => file && act(api.upload('/financial-value/evidence/file', file, { opportunityId: o.id, kind: ev.kind, title: ev.title || file.name }), t('fv.evidence.added')).then(() => setFile(null))
  return (
    <>
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.req.title')}<HelpTip text={t('fv.req.help')} /></div>
        <ul className="ah-list" data-testid="fv-requirements">{(c.requirements || []).map((r: any) => <li key={r.code}>{r.satisfied ? '✓' : '○'} {t(`fv.reqcode.${r.code}`)} <span className="ah-dim">— {r.detail}</span></li>)}</ul>
        {rights.MANAGE_OPPORTUNITIES && (c.requirements || []).some((r: any) => !r.satisfied) && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => act(api.post(`/financial-value/opportunities/${o.id}/data-requests`).then((r: any) => r), t('fv.req.requested'))}>{t('fv.req.request')}</button>
        )}
        {o.dataRequests.length > 0 && (
          <div className="rp-table-wrap" style={{ marginTop: 10 }}><table className="ah-table"><thead><tr><th>{t('fv.request')}</th><th>{t('fv.status')}</th><th>{t('fv.due')}</th></tr></thead>
            <tbody>{o.dataRequests.map((r: any) => <tr key={r.id}><td>{r.label}<div className="ah-dim">{r.reason}</div></td><td>{t(`fv.reqstatus.${r.status}`)}{r.reviewNote ? <div className="ah-dim">{r.reviewNote}</div> : null}</td><td>{day(r.dueDate)}</td></tr>)}</tbody></table></div>
        )}
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.evidence.title')}<HelpTip text={t('fv.evidence.help')} /></div>
        {o.evidence.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : (
          <ul className="ah-list">{o.evidence.map((e: any) => <li key={e.id}>{t(`fv.evkind.${e.kind}`)} · {e.url ? <a href={e.url} target="_blank" rel="noreferrer noopener">{e.title}</a> : e.hasFile ? <button type="button" className="ah-link-btn" onClick={() => api.blob(`/financial-value/evidence/${e.id}/content`).then(b => saveBlob(b, e.fileName || e.title))}>{e.title}</button> : e.title} <span className="ah-dim">{day(e.createdAt)}{e.realizationId ? ` · ${t('fv.evidence.for_realization')}` : ''}</span></li>)}</ul>
        )}
        {canAdd && (
          <div className="fv-form" style={{ marginTop: 10 }}>
            <div className="form-group"><label className="form-label" htmlFor="fv-e-kind">{t('fv.evidence.kind')}</label><select id="fv-e-kind" className="form-input" value={ev.kind} onChange={e => setEv(v => ({ ...v, kind: e.target.value }))}>{EVIDENCE_KINDS.map(k => <option key={k} value={k}>{t(`fv.evkind.${k}`)}</option>)}</select></div>
            <div className="form-group"><label className="form-label" htmlFor="fv-e-title">{t('fv.evidence.name')}</label><input id="fv-e-title" className="form-input" value={ev.title} onChange={e => setEv(v => ({ ...v, title: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label" htmlFor="fv-e-url">{t('fv.evidence.url')}</label><input id="fv-e-url" className="form-input" value={ev.url} onChange={e => setEv(v => ({ ...v, url: e.target.value }))} /></div>
            <div><button type="button" className="btn btn-secondary btn-sm" disabled={!ev.title || !ev.url} onClick={addLink}>{t('fv.evidence.add_link')}</button></div>
            <div className="form-group"><label className="form-label" htmlFor="fv-e-file">{t('fv.evidence.file')}</label><input id="fv-e-file" type="file" className="form-input" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
            <div><button type="button" className="btn btn-secondary btn-sm" disabled={!file} onClick={addFile}>{t('fv.evidence.add_file')}</button></div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Decisions ───────────────────────────────────────────────────────────────

const AREAS: Array<{ area: 'architecture' | 'business' | 'security' | 'finance'; statuses: string[]; right: keyof FvRights }> = [
  { area: 'architecture', statuses: ['FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE'], right: 'ASSESS_FEASIBILITY' },
  { area: 'business', statuses: ['CONFIRMED', 'CONDITIONAL', 'NOT_FEASIBLE'], right: 'ASSESS_FEASIBILITY' },
  { area: 'security', statuses: ['FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE'], right: 'ASSESS_FEASIBILITY' },
  { area: 'finance', statuses: ['CONFIRMED', 'NOT_CONFIRMED'], right: 'VALIDATE_FINANCE' },
]

function DecisionsTab({ o, t, api, rights, act, isAR }: TabProps & { isAR: boolean }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [choice, setChoice] = useState<Record<string, string>>({})
  const frozen = ['APPROVED', 'PLANNED', 'IN_EXECUTION', 'IMPLEMENTED', 'VERIFICATION', 'REALIZED', 'PARTIALLY_REALIZED', 'CLOSED_WITHOUT_SAVINGS'].includes(o.status)
  return (
    <>
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.feas.title')}<HelpTip text={t('fv.feas.help')} /></div>
        <div className="fv-action-row">
          {AREAS.map(a => {
            const rec = (o.feasibility || {})[a.area]
            const canEdit = rights[a.right] && !frozen && (a.area !== 'finance' || o.status === 'BUSINESS_CASE_PREPARED')
            return (
              <div key={a.area} className="fv-action" data-testid={`fv-feas-${a.area}`}>
                <strong>{t(`fv.feas.${a.area}`)}</strong>
                <div className="ah-dim">{rec ? `${t(`fv.feasstatus.${rec.status}`)} · ${day(rec.at)}` : t('fv.feasstatus.NOT_ASSESSED')}</div>
                {rec?.note && <div className="ah-dim">{rec.note}</div>}
                {canEdit && (
                  <div style={{ marginTop: 6 }}>
                    <label className="form-label" htmlFor={`fv-fs-${a.area}`}>{t('fv.feas.record')}</label>
                    <select id={`fv-fs-${a.area}`} className="form-input" value={choice[a.area] || ''} onChange={e => setChoice(c => ({ ...c, [a.area]: e.target.value }))}><option value="" />{a.statuses.map(s => <option key={s} value={s}>{t(`fv.feasstatus.${s}`)}</option>)}</select>
                    <label className="form-label" htmlFor={`fv-fn-${a.area}`} style={{ marginTop: 4 }}>{t('fv.note')}</label>
                    <input id={`fv-fn-${a.area}`} className="form-input" value={notes[a.area] || ''} onChange={e => setNotes(n => ({ ...n, [a.area]: e.target.value }))} />
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} disabled={!choice[a.area]} onClick={() => act(api.post(`/financial-value/opportunities/${o.id}/feasibility`, { area: a.area, status: choice[a.area], note: notes[a.area] || undefined }), t('fv.saved'))}>{t('fv.save')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <CompliancePanel o={o} t={t} api={api} rights={rights} act={act} isAR={isAR} />
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.actions.title')}<HelpTip text={t('fv.actions.help')} /></div>
        {o.actions.length === 0 ? <div className="ah-dim">{t('fv.actions.none')}</div> : (
          <div className="fv-action-row" data-testid="fv-actions">
            {o.actions.map((a: any) => (
              <div key={a.action} className="fv-action">
                <strong>{t(`fv.act.${a.action}`)}</strong>
                {!a.permitted && <div className="ah-dim">{t('fv.actions.no_right')}</div>}
                {a.blockers.length > 0 && <ul className="fv-blockers">{a.blockers.map((b: any) => <li key={b.code}>{b.message}</li>)}</ul>}
                {a.permitted && a.blockers.length === 0 && (
                  <div style={{ marginTop: 6 }}>
                    {a.noteRequired && <><label className="form-label" htmlFor={`fv-an-${a.action}`}>{t('fv.reason')}</label><input id={`fv-an-${a.action}`} className="form-input" value={notes[a.action] || ''} onChange={e => setNotes(n => ({ ...n, [a.action]: e.target.value }))} /></>}
                    <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 6 }} disabled={a.noteRequired && !(notes[a.action] || '').trim()} onClick={() => act(api.post(`/financial-value/opportunities/${o.id}/transition`, { action: a.action, note: notes[a.action] || undefined }), t('fv.actions.done'))}>{t(`fv.act.${a.action}`)}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {o.businessCase && <button type="button" className="ah-btn" style={{ marginTop: 12 }} onClick={() => api.blob(`/financial-value/opportunities/${o.id}/business-case.docx?lang=${isAR ? 'AR' : 'EN'}`).then(b => saveBlob(b, `business-case-${o.title}.docx`))}>📄 {t('fv.business_case.download')} (v{o.businessCaseVersion})</button>}
        {o.businessCase && <PrintableBusinessCase o={o} t={t} api={api} isAR={isAR} />}
        {o.settings?.segregationOfDuties && <div className="fv-note">{t('fv.sod_note')}</div>}
      </div>
    </>
  )
}

// ── Execution and realization ───────────────────────────────────────────────

function ExecutionTab({ o, cur = 'SAR', t, api, rights, act }: TabProps) {
  const [plans, setPlans] = useState<any[]>([])
  const [planId, setPlanId] = useState('')
  const [r, setR] = useState({ periodStart: '', periodEnd: '', actualAmount: '', baselineAmount: '', scopeAdjustment: '', method: '', note: '' })
  const [evidenceIds, setEvidenceIds] = useState<string[]>([])
  const [verifyNote, setVerifyNote] = useState<Record<string, string>>({})
  useEffect(() => { api.get('/ea-planning/plans').then((d: any) => setPlans(Array.isArray(d) ? d : [])).catch(() => setPlans([])) }, [api])
  const canLink = rights.MANAGE_OPPORTUNITIES && ['APPROVED', 'PLANNED', 'IN_EXECUTION'].includes(o.status)
  const canRealize = rights.MANAGE_OPPORTUNITIES && ['IMPLEMENTED', 'VERIFICATION', 'PARTIALLY_REALIZED'].includes(o.status)
  const unattached = o.evidence.filter((e: any) => !e.realizationId)
  const submit = () => act(api.post(`/financial-value/opportunities/${o.id}/realizations`, {
    periodStart: r.periodStart, periodEnd: r.periodEnd, actualAmount: Number(r.actualAmount), method: r.method, evidenceIds, note: r.note || undefined,
    ...(r.baselineAmount !== '' ? { baselineAmount: Number(r.baselineAmount) } : {}), ...(r.scopeAdjustment !== '' ? { scopeAdjustment: Number(r.scopeAdjustment) } : {}),
  }), t('fv.realization.submitted'))
  return (
    <>
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.roadmap.title')}<HelpTip text={t('fv.roadmap.help')} /></div>
        {o.roadmap ? <div>{t('fv.roadmap.linked').replace('{plan}', o.roadmap.plan.name)} · {o.roadmap.activity ? t('fv.roadmap.activity_status').replace('{status}', String(o.roadmap.activity.status)) : t('fv.roadmap.activity_missing')} <a href="/ea-planning">{t('fv.open')}</a></div>
          : canLink ? (
            <div className="fv-toolbar"><label className="ah-dim" htmlFor="fv-plan">{t('fv.roadmap.plan')}</label><select id="fv-plan" className="form-input" value={planId} onChange={e => setPlanId(e.target.value)}><option value="" />{plans.map(p => <option key={p.id} value={p.id}>{p.nameEn}</option>)}</select>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!planId} onClick={() => act(api.post(`/financial-value/opportunities/${o.id}/roadmap`, { planId }), t('fv.roadmap.done'))}>{t('fv.roadmap.link')}</button></div>
          ) : <div className="ah-dim">{t('fv.roadmap.only_approved')}</div>}
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.research.title')}<HelpTip text={t('fv.research.help')} /></div>
        {o.research ? <div>{o.research.title} · {t(`fv.research.status.${o.research.status}`)}{o.research.decision ? ` · ${o.research.decision}` : ''}</div> : <div className="ah-dim">{t('fv.research.none')}</div>}
        {rights.RUN_RESEARCH && (!o.research || o.research.status === 'FAILED') && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => act(api.post(`/financial-value/opportunities/${o.id}/research`, {}), t('fv.research.started'))}>{t('fv.research.start')}</button>}
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.realization.title')}<HelpTip text={t('fv.realization.help')} /></div>
        {o.realizations.length === 0 ? <div className="ah-dim">{t('fv.realization.none')}</div> : (
          <div className="rp-table-wrap"><table className="ah-table" data-testid="fv-realizations"><thead><tr><th>{t('fv.period')}</th><th>{t('fv.baseline')}</th><th>{t('fv.actual')}</th><th>{t('fv.adjustment')}</th><th>{t('fv.realized')}</th><th>{t('fv.status')}</th></tr></thead>
            <tbody>{o.realizations.map((x: any) => (
              <tr key={x.id}><td>{day(x.periodStart)} – {day(x.periodEnd)}<div className="ah-dim">{x.method}</div></td><td>{money(x.baselineAmount, x.currency)}</td><td>{money(x.actualAmount, x.currency)}</td><td>{money(x.scopeAdjustment, x.currency)}</td><td>{money(x.realizedAmount, x.currency)}</td>
                <td>{t(`fv.realstatus.${x.status}`)}{x.verificationNote ? <div className="ah-dim">{x.verificationNote}</div> : null}
                  {x.status === 'SUBMITTED' && rights.VERIFY_SAVINGS && (
                    <div style={{ marginTop: 4 }}>
                      <label className="form-label" htmlFor={`fv-vn-${x.id}`}>{t('fv.verify.note')}</label>
                      <input id={`fv-vn-${x.id}`} className="form-input" value={verifyNote[x.id] || ''} onChange={e => setVerifyNote(v => ({ ...v, [x.id]: e.target.value }))} />
                      <div className="fv-toolbar" style={{ marginTop: 4 }}>
                        <button type="button" className="btn btn-primary btn-sm" disabled={!(verifyNote[x.id] || '').trim()} onClick={() => act(api.post(`/financial-value/realizations/${x.id}/verify`, { decision: 'VERIFIED', note: verifyNote[x.id] }), t('fv.verify.done'))}>{t('fv.verify.verify')}</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!(verifyNote[x.id] || '').trim()} onClick={() => act(api.post(`/financial-value/realizations/${x.id}/verify`, { decision: 'REJECTED', note: verifyNote[x.id] }), t('fv.verify.done'))}>{t('fv.verify.reject')}</button>
                      </div>
                    </div>
                  )}
                </td></tr>
            ))}</tbody></table></div>
        )}
        {canRealize && (
          <div style={{ marginTop: 12 }} data-testid="fv-realize-form">
            <div className="fv-form">
              <div className="form-group"><label className="form-label" htmlFor="fv-r-start">{t('fv.realization.from')}</label><input id="fv-r-start" type="date" className="form-input" value={r.periodStart} onChange={e => setR(v => ({ ...v, periodStart: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-r-end">{t('fv.realization.to')}</label><input id="fv-r-end" type="date" className="form-input" value={r.periodEnd} onChange={e => setR(v => ({ ...v, periodEnd: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-r-actual">{t('fv.realization.actual')}</label><input id="fv-r-actual" type="number" min={0} className="form-input" value={r.actualAmount} onChange={e => setR(v => ({ ...v, actualAmount: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-r-baseline">{t('fv.realization.baseline')}</label><input id="fv-r-baseline" type="number" min={0} className="form-input" placeholder={t('fv.realization.baseline_default')} value={r.baselineAmount} onChange={e => setR(v => ({ ...v, baselineAmount: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-r-adj">{t('fv.adjustment')}</label><input id="fv-r-adj" type="number" className="form-input" value={r.scopeAdjustment} onChange={e => setR(v => ({ ...v, scopeAdjustment: e.target.value }))} /></div>
              <div className="form-group fv-form-wide"><label className="form-label" htmlFor="fv-r-method">{t('fv.realization.method')}</label><input id="fv-r-method" className="form-input" value={r.method} onChange={e => setR(v => ({ ...v, method: e.target.value }))} /></div>
            </div>
            <fieldset style={{ border: 'none', padding: 0, margin: '8px 0' }}>
              <legend className="form-label">{t('fv.realization.evidence')}</legend>
              {unattached.length === 0 ? <div className="ah-dim">{t('fv.realization.no_evidence')}</div> : unattached.map((e: any) => (
                <label key={e.id} className="ah-dim" style={{ display: 'block' }}><input type="checkbox" checked={evidenceIds.includes(e.id)} onChange={ev => setEvidenceIds(ids => (ev.target.checked ? [...ids, e.id] : ids.filter(x => x !== e.id)))} /> {t(`fv.evkind.${e.kind}`)} · {e.title}</label>
              ))}
            </fieldset>
            <button type="button" className="btn btn-primary btn-sm" disabled={!r.periodStart || !r.periodEnd || r.actualAmount === '' || r.method.trim().length < 10 || evidenceIds.length === 0} onClick={submit}>{t('fv.realization.submit')}</button>
            <div className="fv-note">{t('fv.realization.rule').replace('{currency}', cur)}</div>
          </div>
        )}
      </div>
    </>
  )
}
