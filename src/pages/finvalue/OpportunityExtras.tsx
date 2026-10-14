import { useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { FvApi, FvRights, T, day, money, openPrintable } from './fvApi'

// Opportunity workspace additions: alternatives and 5-year TCO comparison
// (Engine J), the regulatory review checklist, the AI executive summary,
// AI suggestions of what to estimate, and claims proposed from the linked
// architecture scenario. Every figure is the backend's; nothing is computed here.

export const ALT_COSTS = ['annualLicense', 'annualSupport', 'annualInfrastructure', 'annualOperations', 'implementation', 'migration', 'exit', 'training'] as const
export const ALT_SCORES = ['functionalFit', 'compatibility', 'maturity', 'vendorSupport', 'operationalSimplicity', 'migrationEase'] as const
export const ALT_GATES = ['securityApproved', 'regulatoryCompliant', 'architectureCompatible'] as const
export const PRICE_BASES = ['CONTRACT', 'QUOTE', 'PUBLISHED_PRICE', 'ESTIMATE', 'UNKNOWN'] as const
export const REVIEW_STATUSES = ['NOT_REVIEWED', 'MET', 'MET_WITH_CONDITIONS', 'NOT_APPLICABLE', 'BLOCKS'] as const

type Act = (p: Promise<any>, ok?: string) => Promise<any>
type Cost = { amount: string; currency: string; basis: string; source: string }
interface AltDraft {
  key: string; name: string; kind: 'CURRENT' | 'ALTERNATIVE'; vendor: string; researchCandidate?: string | null; assetId?: string | null
  costs: Record<string, Cost>; gates: Record<string, '' | 'yes' | 'no'>; scores: Record<string, string>; sources: string; notes: string
}

function toDraft(a: any, cur: string): AltDraft {
  return {
    key: a.key, name: a.name || '', kind: a.kind === 'CURRENT' ? 'CURRENT' : 'ALTERNATIVE', vendor: a.vendor || '', researchCandidate: a.researchCandidate || null, assetId: a.assetId || null,
    costs: Object.fromEntries(ALT_COSTS.filter(k => a.costs?.[k]).map(k => [k, { amount: a.costs[k].amount === null || a.costs[k].amount === undefined ? '' : String(a.costs[k].amount), currency: a.costs[k].currency || cur, basis: a.costs[k].basis || 'ESTIMATE', source: a.costs[k].source || '' }])),
    gates: Object.fromEntries(ALT_GATES.map(g => [g, a.gates?.[g] === true ? 'yes' : a.gates?.[g] === false ? 'no' : ''])) as any,
    scores: Object.fromEntries(ALT_SCORES.map(s => [s, a.scores?.[s] ? String(a.scores[s]) : ''])),
    sources: (a.sources || []).map((s: any) => s.url).join('\n'), notes: a.notes || '',
  }
}

function fromDraft(d: AltDraft) {
  return {
    key: d.key, name: d.name.trim(), kind: d.kind, vendor: d.vendor || null, researchCandidate: d.researchCandidate || null, assetId: d.assetId || null,
    costs: Object.fromEntries(Object.entries(d.costs).filter(([, c]) => c.amount !== '' || c.basis === 'UNKNOWN' || c.source).map(([k, c]) => [k, { amount: c.amount === '' ? null : Number(c.amount), currency: c.currency, basis: c.amount === '' ? 'UNKNOWN' : c.basis, source: c.source || null }])),
    gates: Object.fromEntries(ALT_GATES.map(g => [g, d.gates[g] === 'yes' ? true : d.gates[g] === 'no' ? false : null])),
    scores: Object.fromEntries(ALT_SCORES.filter(s => d.scores[s]).map(s => [s, Number(d.scores[s])])),
    sources: d.sources.split(/\s+/).filter(u => /^https?:\/\//i.test(u)).map(url => ({ url })), notes: d.notes || null,
  }
}

/** Engine J: the current solution and its alternatives with costs, mandatory gates and quality scores; the backend ranks them by 5-year TCO. */
export function AlternativesPanel({ o, t, api, rights, act, cur }: { o: any; t: T; api: FvApi; rights: FvRights; act: Act; cur: string }) {
  const editable = rights.MANAGE_OPPORTUNITIES && ['DISCOVERED', 'EVIDENCE_REQUIRED', 'VALIDATED', 'BUSINESS_CASE_PREPARED'].includes(o.status)
  const [list, setList] = useState<AltDraft[]>(() => (o.alternatives || []).map((a: any) => toDraft(a, cur)))
  const [open, setOpen] = useState<string | null>(null)
  const cmp = o.alternativesComparison
  const update = (key: string, f: (d: AltDraft) => AltDraft) => setList(l => l.map(d => (d.key === key ? f(d) : d)))
  const add = (kind: 'CURRENT' | 'ALTERNATIVE') => {
    const used = new Set(list.map(d => d.key))
    let n = list.length + 1
    while (used.has(`alt-${n}`)) n++
    const d: AltDraft = { key: `alt-${n}`, name: '', kind, vendor: '', costs: {}, gates: { securityApproved: '', regulatoryCompliant: '', architectureCompatible: '' }, scores: {}, sources: '', notes: '' }
    setList(l => [...l, d]); setOpen(d.key)
  }
  const save = () => act(api.put(`/financial-value/opportunities/${o.id}/alternatives`, { alternatives: list.map(fromDraft) }), t('fv.recalculated'))
  const fromResearch = () => act(api.post(`/financial-value/opportunities/${o.id}/alternatives/from-research`).then((r: any) => { if (r?.alternatives) setList(r.alternatives.map((a: any) => toDraft(a, cur))); return r }), t('fv.alt.imported'))
  const hasCurrent = list.some(d => d.kind === 'CURRENT')

  return (
    <>
      <div className="rp-card" data-testid="fv-alternatives">
        <div className="rp-card-title">{t('fv.alt.title')}<HelpTip text={t('fv.alt.help')} /></div>
        {list.length === 0 && <div className="ah-dim">{t('fv.alt.none')}</div>}
        {list.map(d => (
          <div key={d.key} className="fv-alt">
            <div className="fv-alt-head">
              <button type="button" className="ah-link-btn" aria-expanded={open === d.key} onClick={() => setOpen(open === d.key ? null : d.key)}>{open === d.key ? '▾' : '▸'} {d.name || t('fv.alt.unnamed')}</button>
              <span className="fv-chip">{d.kind === 'CURRENT' ? t('fv.alt.current') : t('fv.alt.alternative')}</span>
              {d.researchCandidate && <span className="fv-chip">{t('fv.alt.from_research_badge')}</span>}
              {editable && <button type="button" className="ah-link-btn" aria-label={`${t('fv.remove')} ${d.name}`} onClick={() => setList(l => l.filter(x => x.key !== d.key))}>×</button>}
            </div>
            {open === d.key && (
              <div className="fv-alt-body">
                <div className="fv-form">
                  <div className="form-group"><label className="form-label" htmlFor={`fv-alt-name-${d.key}`}>{t('fv.alt.name')}</label><input id={`fv-alt-name-${d.key}`} className="form-input" disabled={!editable} value={d.name} onChange={e => update(d.key, x => ({ ...x, name: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label" htmlFor={`fv-alt-vendor-${d.key}`}>{t('fv.vendor')}</label><input id={`fv-alt-vendor-${d.key}`} className="form-input" disabled={!editable} value={d.vendor} onChange={e => update(d.key, x => ({ ...x, vendor: e.target.value }))} /></div>
                  <div className="form-group"><label className="form-label" htmlFor={`fv-alt-kind-${d.key}`}>{t('fv.alt.kind')}</label>
                    <select id={`fv-alt-kind-${d.key}`} className="form-input" disabled={!editable} value={d.kind} onChange={e => update(d.key, x => ({ ...x, kind: e.target.value as any }))}>
                      <option value="ALTERNATIVE">{t('fv.alt.alternative')}</option>
                      {(d.kind === 'CURRENT' || !hasCurrent) && <option value="CURRENT">{t('fv.alt.current')}</option>}
                    </select></div>
                </div>
                <div className="rp-card-title" style={{ marginTop: 10 }}>{t('fv.alt.costs')}<HelpTip text={t('fv.alt.costs.help')} /></div>
                <div className="fv-lines">
                  {ALT_COSTS.map(k => {
                    const c = d.costs[k] || { amount: '', currency: cur, basis: 'ESTIMATE', source: '' }
                    const set = (patch: Partial<Cost>) => update(d.key, x => ({ ...x, costs: { ...x.costs, [k]: { ...c, ...patch } } }))
                    return (
                      <div key={k} className="fv-alt-cost">
                        <span>{t(`fv.alt.cost.${k}`)}</span>
                        <input aria-label={`${t(`fv.alt.cost.${k}`)} ${t('fv.line.amount')}`} type="number" min={0} className="form-input" disabled={!editable} value={c.amount} onChange={e => set({ amount: e.target.value })} />
                        <input aria-label={`${t(`fv.alt.cost.${k}`)} ${t('fv.line.currency')}`} className="form-input" disabled={!editable} value={c.currency} onChange={e => set({ currency: e.target.value.toUpperCase() })} />
                        <select aria-label={`${t(`fv.alt.cost.${k}`)} ${t('fv.line.basis')}`} className="form-input" disabled={!editable} value={c.basis} onChange={e => set({ basis: e.target.value })}>{PRICE_BASES.map(b => <option key={b} value={b}>{t(`fv.pbasis.${b}`)}</option>)}</select>
                        <input aria-label={`${t(`fv.alt.cost.${k}`)} ${t('fv.alt.source')}`} className="form-input" disabled={!editable} placeholder={t('fv.alt.source')} value={c.source} onChange={e => set({ source: e.target.value })} />
                      </div>
                    )
                  })}
                </div>
                <div className="fv-form" style={{ marginTop: 10 }}>
                  {ALT_GATES.map(g => (
                    <div className="form-group" key={g}><label className="form-label" htmlFor={`fv-alt-${g}-${d.key}`}>{t(`fv.alt.gate.${g}`)}</label>
                      <select id={`fv-alt-${g}-${d.key}`} className="form-input" disabled={!editable} value={d.gates[g]} onChange={e => update(d.key, x => ({ ...x, gates: { ...x.gates, [g]: e.target.value as any } }))}>
                        <option value="">{t('fv.alt.gate_unknown')}</option><option value="yes">{t('fv.alt.gate_yes')}</option><option value="no">{t('fv.alt.gate_no')}</option>
                      </select></div>
                  ))}
                  {ALT_SCORES.map(s => (
                    <div className="form-group" key={s}><label className="form-label" htmlFor={`fv-alt-${s}-${d.key}`}>{t(`fv.alt.score.${s}`)}</label>
                      <select id={`fv-alt-${s}-${d.key}`} className="form-input" disabled={!editable} value={d.scores[s] || ''} onChange={e => update(d.key, x => ({ ...x, scores: { ...x.scores, [s]: e.target.value } }))}>
                        <option value="">{t('fv.not_rated')}</option>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select></div>
                  ))}
                  <div className="form-group fv-form-wide"><label className="form-label" htmlFor={`fv-alt-src-${d.key}`}>{t('fv.alt.sources')}</label><textarea id={`fv-alt-src-${d.key}`} className="form-input" rows={2} disabled={!editable} value={d.sources} onChange={e => update(d.key, x => ({ ...x, sources: e.target.value }))} /></div>
                  <div className="form-group fv-form-wide"><label className="form-label" htmlFor={`fv-alt-notes-${d.key}`}>{t('fv.alt.notes')}</label><textarea id={`fv-alt-notes-${d.key}`} className="form-input" rows={2} disabled={!editable} value={d.notes} onChange={e => update(d.key, x => ({ ...x, notes: e.target.value }))} /></div>
                </div>
              </div>
            )}
          </div>
        ))}
        {editable && (
          <div className="fv-toolbar" style={{ marginTop: 10 }}>
            {!hasCurrent && <button type="button" className="ah-link-btn" onClick={() => add('CURRENT')}>+ {t('fv.alt.add_current')}</button>}
            <button type="button" className="ah-link-btn" onClick={() => add('ALTERNATIVE')}>+ {t('fv.alt.add')}</button>
            {o.research?.status === 'COMPLETED' && <button type="button" className="btn btn-secondary btn-sm" onClick={fromResearch}>{t('fv.alt.from_research')}</button>}
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-primary btn-sm" disabled={list.some(d => !d.name.trim())} onClick={save}>{t('fv.alt.save')}</button>
          </div>
        )}
        {!editable && <div className="ah-dim" style={{ marginTop: 8 }}>{t('fv.model.frozen')}</div>}
      </div>

      {cmp && (
        <div className="rp-card rp-card-gap" data-testid="fv-alt-comparison">
          <div className="rp-card-title">{t('fv.alt.comparison')}<HelpTip text={t('fv.alt.comparison.help')} /></div>
          <div className={`rp-banner ${cmp.recommendation.key ? '' : 'fv-tone-neutral'}`}>
            <strong>{t('fv.alt.recommendation')}:</strong> {cmp.recommendation.statement} <span className="fv-chip">{t(`fv.confidence.${cmp.recommendation.confidence}`)}</span>
          </div>
          <div className="rp-table-wrap" style={{ marginTop: 8 }}><table className="ah-table"><thead><tr>
            <th>{t('fv.alt.name')}</th><th>{t('fv.alt.rank')}</th><th>{t('fv.alt.annual')}</th><th>{t('fv.one_time')}</th><th>{t('fv.calc.tco3')}</th><th>{t('fv.calc.tco5')}</th><th>{t('fv.alt.pv5')}</th><th>{t('fv.alt.saving5')}</th><th>{t('fv.alt.quality')}</th><th>{t('fv.alt.eligibility')}</th>
          </tr></thead>
            <tbody>{cmp.results.map((r: any) => (
              <tr key={r.key}>
                <td>{r.name}{r.kind === 'CURRENT' && <div className="ah-dim">{t('fv.alt.current')}</div>}</td>
                <td>{r.rank ?? '—'}</td><td>{money(r.annualRecurring, cmp.currency)}</td><td>{money(r.oneTime, cmp.currency)}</td><td>{money(r.tco3, cmp.currency)}</td><td>{money(r.tco5, cmp.currency)}</td><td>{money(r.pv5, cmp.currency)}</td>
                <td>{money(r.saving5VsCurrent, cmp.currency)}</td><td>{r.qualityScore ?? '—'}</td>
                <td><span className={`fv-chip ${r.eligibility === 'ELIGIBLE' ? 'fv-tone-good' : r.eligibility === 'EXCLUDED' ? 'fv-tone-bad' : 'fv-tone-neutral'}`}>{t(`fv.alt.elig.${r.eligibility}`)}</span>
                  {r.excludedBy.length > 0 && <div className="ah-dim">{t('fv.alt.failed')}: {r.excludedBy.map((g: string) => t(`fv.alt.gate.${g}`)).join(', ')}</div>}
                  {r.unverifiedGates.length > 0 && <div className="ah-dim">{t('fv.alt.unverified')}: {r.unverifiedGates.map((g: string) => t(`fv.alt.gate.${g}`)).join(', ')}</div>}
                  {r.unpricedLines.length > 0 && <div className="ah-dim">{t('fv.alt.unpriced')}: {r.unpricedLines.map((k: string) => t(`fv.alt.cost.${k}`)).join(', ')}</div>}
                  {r.excludedLines.length > 0 && <div className="ah-dim">{r.excludedLines.join('; ')}</div>}
                </td>
              </tr>
            ))}</tbody></table></div>
          <div className="ah-dim" style={{ marginTop: 6 }}>{cmp.method} · {cmp.rule}</div>
        </div>
      )}
    </>
  )
}

/** Regulatory obligations that apply to the change; reviewed by people (the platform never asserts compliance). Approval waits for every review. */
export function CompliancePanel({ o, t, api, rights, act, isAR }: { o: any; t: T; api: FvApi; rights: FvRights; act: Act; isAR: boolean }) {
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [urls, setUrls] = useState<Record<string, string>>({})
  const checks: any[] = o.complianceChecks || []
  const frozen = ['APPROVED', 'PLANNED', 'IN_EXECUTION', 'IMPLEMENTED', 'VERIFICATION', 'REALIZED', 'PARTIALLY_REALIZED', 'REJECTED', 'CANCELLED', 'CLOSED_WITHOUT_SAVINGS'].includes(o.status)
  const tone = (s: string) => (s === 'MET' || s === 'NOT_APPLICABLE' ? 'fv-tone-good' : s === 'BLOCKS' ? 'fv-tone-bad' : s === 'MET_WITH_CONDITIONS' ? 'fv-tone-go' : 'fv-tone-neutral')
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-compliance">
      <div className="rp-card-title">{t('fv.comp.title')}<HelpTip text={t('fv.comp.help')} /></div>
      {checks.length === 0 ? <div className="ah-dim">{t('fv.comp.none')}</div> : (
        <div className="fv-action-row">
          {checks.map(c => {
            const canEdit = rights.ASSESS_FEASIBILITY && !frozen
            const needsNote = ['MET_WITH_CONDITIONS', 'NOT_APPLICABLE', 'BLOCKS'].includes(choice[c.code] || '')
            return (
              <div key={c.code} className="fv-action">
                <strong>{isAR ? c.nameAr : c.name}</strong> <span className={`fv-chip ${tone(c.status)}`}>{t(`fv.comp.status.${c.status}`)}</span>
                <div className="ah-dim">{c.authority}</div>
                <div className="ah-dim" style={{ marginTop: 4 }}>{t('fv.comp.why')}: {c.why}</div>
                {c.at && <div className="ah-dim">{day(c.at)}{c.note ? ` · ${c.note}` : ''}</div>}
                {c.evidenceUrl && <a href={c.evidenceUrl} target="_blank" rel="noreferrer noopener">{t('fv.comp.evidence_link')}</a>}
                {canEdit && (
                  <div style={{ marginTop: 6 }}>
                    <label className="form-label" htmlFor={`fv-cs-${c.code}`}>{t('fv.comp.record')}</label>
                    <select id={`fv-cs-${c.code}`} className="form-input" value={choice[c.code] || ''} onChange={e => setChoice(x => ({ ...x, [c.code]: e.target.value }))}><option value="" />{REVIEW_STATUSES.filter(s => s !== 'NOT_REVIEWED').map(s => <option key={s} value={s}>{t(`fv.comp.status.${s}`)}</option>)}</select>
                    <label className="form-label" htmlFor={`fv-cn-${c.code}`} style={{ marginTop: 4 }}>{needsNote ? t('fv.reason') : t('fv.note')}</label>
                    <input id={`fv-cn-${c.code}`} className="form-input" value={notes[c.code] || ''} onChange={e => setNotes(x => ({ ...x, [c.code]: e.target.value }))} />
                    <label className="form-label" htmlFor={`fv-cu-${c.code}`} style={{ marginTop: 4 }}>{t('fv.comp.evidence_url')}</label>
                    <input id={`fv-cu-${c.code}`} className="form-input" value={urls[c.code] || ''} onChange={e => setUrls(x => ({ ...x, [c.code]: e.target.value }))} />
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} disabled={!choice[c.code] || (needsNote && !(notes[c.code] || '').trim())}
                      onClick={() => act(api.post(`/financial-value/opportunities/${o.id}/compliance`, { code: c.code, status: choice[c.code], note: notes[c.code] || undefined, evidenceUrl: urls[c.code] || null }), t('fv.saved'))}>{t('fv.save')}</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="fv-note">{t('fv.comp.disclaimer')}</div>
    </div>
  )
}

/** AI executive summary written from the calculated facts; the backend discards it when it states a figure the facts do not contain. */
export function NarrativeCard({ o, t, api, rights, act, isAR }: { o: any; t: T; api: FvApi; rights: FvRights; act: Act; isAR: boolean }) {
  const [busy, setBusy] = useState(false)
  const n = o.narrative
  const outdated = n && n.basisHash && o.calculation?.inputHash && n.basisHash !== o.calculation.inputHash
  const write = () => { setBusy(true); act(api.post(`/financial-value/opportunities/${o.id}/narrative`, { language: isAR ? 'AR' : 'EN' }), t('fv.narr.done')).finally(() => setBusy(false)) }
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-narrative">
      <div className="rp-card-title">{t('fv.narr.title')}<HelpTip text={t('fv.narr.help')} /></div>
      {n?.text ? (
        <>
          <div dir={n.language === 'AR' ? 'rtl' : 'ltr'} style={{ whiteSpace: 'pre-wrap' }}>{n.text}</div>
          <div className="ah-dim" style={{ marginTop: 6 }}>{t('fv.narr.generated').replace('{date}', day(n.generatedAt))} · {t('fv.narr.checked')}</div>
          {outdated && <div className="rp-banner" style={{ marginTop: 6 }}>{t('fv.narr.outdated')}</div>}
        </>
      ) : <div className="ah-dim">{t('fv.narr.none')}</div>}
      {rights.MANAGE_OPPORTUNITIES && <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={write}>{busy ? t('fv.narr.writing') : n?.text ? t('fv.narr.rewrite') : t('fv.narr.write')}</button>}
    </div>
  )
}

export interface Suggestion { kind: 'ONE_TIME' | 'RECURRING'; category: string; label: string; why: string }

/** AI names the cost lines usually needed for this kind of change (never amounts); people add them and enter the amounts. */
export function AssumptionSuggestions({ o, t, api, onAdd }: { o: any; t: T; api: FvApi; onAdd: (s: Suggestion) => void }) {
  const [list, setList] = useState<Suggestion[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [added, setAdded] = useState<number[]>([])
  const run = () => { setBusy(true); setErr(null); api.post(`/financial-value/opportunities/${o.id}/suggest-assumptions`).then((r: any) => { setList(r?.suggestions || []); setAdded([]) }).catch(e => setErr(e.message)).finally(() => setBusy(false)) }
  return (
    <div className="fv-note" data-testid="fv-suggestions">
      <strong>{t('fv.suggest.title')}</strong><HelpTip text={t('fv.suggest.help')} />
      <div><button type="button" className="ah-link-btn" disabled={busy} onClick={run}>{busy ? t('fv.suggest.running') : t('fv.suggest.run')}</button></div>
      {err && <div role="alert">{err}</div>}
      {list && list.length === 0 && <div>{t('fv.suggest.none')}</div>}
      {list && list.length > 0 && (
        <ul className="ah-list">{list.map((s, i) => (
          <li key={i}>{s.label} <span className="fv-chip">{s.kind === 'RECURRING' ? t('fv.model.new_recurring') : t(`fv.onetime.${s.category}`)}</span> <span>— {s.why}</span>{' '}
            {added.includes(i) ? <span>✓</span> : <button type="button" className="ah-link-btn" onClick={() => { onAdd(s); setAdded(a => [...a, i]) }}>{t('fv.suggest.add')}</button>}</li>
        ))}</ul>
      )}
    </div>
  )
}

/** Cost items the opportunity could claim because its architecture scenario removes their objects; a proposal people accept into the claims. */
export function ScenarioClaims({ o, t, api, onUse }: { o: any; t: T; api: FvApi; onUse: (claims: Record<string, number>, proposals: any[]) => void }) {
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  if (!o.architectureScenarioId) return null
  const load = () => api.get(`/financial-value/opportunities/${o.id}/scenario-claims`).then(setData).catch(e => setErr(e.message))
  return (
    <div className="fv-note" data-testid="fv-scenario-claims">
      <strong>{t('fv.scnclaims.title')}</strong><HelpTip text={t('fv.scnclaims.help')} />
      {!data ? <div><button type="button" className="ah-link-btn" onClick={load}>{t('fv.scnclaims.load')}</button></div> : data.proposals.length === 0 ? <div>{t('fv.scnclaims.none')}</div> : (
        <>
          <ul className="ah-list">{data.proposals.map((p: any) => <li key={p.costItemId}>{p.assetName} · {t(`fv.cost.${p.category}`)} · {money(p.annualAmount, p.currency)} · {t(`fv.data.${p.status}`)}</li>)}</ul>
          <button type="button" className="ah-link-btn" onClick={() => onUse(Object.fromEntries(data.proposals.map((p: any) => [p.costItemId, p.reductionPct])), data.proposals)}>{t('fv.scnclaims.use')}</button>
        </>
      )}
      {err && <div role="alert">{err}</div>}
    </div>
  )
}

/** Opens the printable business case (the browser's print dialog saves it as PDF). */
export function PrintableBusinessCase({ o, t, api, isAR }: { o: any; t: T; api: FvApi; isAR: boolean }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      <button type="button" className="ah-btn" style={{ marginTop: 12 }} onClick={() => openPrintable(api, `/financial-value/opportunities/${o.id}/business-case.html?lang=${isAR ? 'AR' : 'EN'}`).catch(e => setErr(e.message))}>🖨 {t('fv.print.business_case')}</button>
      {err && <div role="alert">{err}</div>}
    </>
  )
}
