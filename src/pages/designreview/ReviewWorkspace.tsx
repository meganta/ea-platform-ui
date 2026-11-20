import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import HelpTip from '../../components/HelpTip'
import RowsEditor, { FieldSpec, commaList, linesToList, listToLines } from './RowsEditor'
import {
  DOMAINS, LEVELS, RATINGS, REC_GROUPS, RatedRow, Review, ReviewResult, SEVERITIES, STAGES, VERDICTS, designReviewApi,
} from './designReviewApi'

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''))
export const verdictClass = (v: string) => (v === 'APPROVED' ? 'dr-good' : v === 'CONDITIONAL' ? 'dr-warn' : 'dr-bad')
const ratingClass = (r: string) => (r === 'ALIGNED' ? 'dr-good' : r === 'PARTIAL' ? 'dr-warn' : r === 'NOT_ALIGNED' || r === 'NOT_ADDRESSED' ? 'dr-bad' : 'dr-neutral')
const levelClass = (l: string) => (l === 'HIGH' || l === 'CRITICAL' ? 'dr-bad' : l === 'MEDIUM' ? 'dr-warn' : l === 'LOW' ? 'dr-good' : 'dr-neutral')

type Tab = 'summary' | 'strategy' | 'principles' | 'impact' | 'gaps' | 'recs' | 'limits'
const TABS: Tab[] = ['summary', 'strategy', 'principles', 'impact', 'gaps', 'recs', 'limits']

/** One review: progress while it is written, then its content to read, edit, approve and export. */
export default function ReviewWorkspace({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useLang()
  const { hasPermission } = useAuth() as any
  const can = (p: string) => !!hasPermission?.(`DesignReview.${p}`)
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)
  const [tab, setTab] = useState<Tab>('summary')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(() => designReviewApi.get(id).then(r => { setReview(r); setError(null) }).catch(e => setError(e.message)), [id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (review?.status !== 'RUNNING') return
    const h = setInterval(load, 4000)
    return () => clearInterval(h)
  }, [review?.status, load])

  const act = async (key: string, task: () => Promise<any>, done?: (r: any) => void) => {
    setBusy(key); setNotice(null)
    try { const r = await task(); done ? done(r) : setReview(r) } catch (e: any) { setNotice({ ok: false, text: e.message }) } finally { setBusy(null) }
  }
  const save = (section: string, value: unknown) => act(`save-${section}`, () => designReviewApi.edit(id, section, value))

  if (error && !review) return <div role="alert" className="dr-error">{t('dr.load_failed')}: {error} <button className="btn btn-ghost" onClick={onBack}>{t('dr.back')}</button></div>
  if (!review) return <p>{t('dr.loading')}</p>
  const r = review.result
  const editable = review.status === 'READY' && can('Edit')
  const ready = review.status === 'READY' || review.status === 'APPROVED'

  return (
    <>
      <button className="btn btn-ghost" onClick={onBack}>← {t('dr.back')}</button>
      <header className="dr-header">
        <div>
          <h1 className="dr-title">{review.title}</h1>
          <p className="dr-subtitle">{t(`dr.type.${review.reviewType}`)} · {t('dr.document')}: {review.documentName} · {fill(t('dr.chars'), { n: review.documentChars })}</p>
        </div>
        <div className="dr-actions">
          <span className={`dr-badge ${review.status === 'FAILED' ? 'dr-bad' : review.status === 'APPROVED' ? 'dr-good' : 'dr-neutral'}`}>{t(`dr.status.${review.status}`)}</span>
          {ready && <>
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => act('pptx', () => designReviewApi.download(id, 'pptx', review.title), name => setNotice({ ok: true, text: fill(t('dr.downloaded'), { name }) }))}>{t('dr.export_pptx')}</button>
            <button className="btn btn-secondary" disabled={!!busy} onClick={() => act('docx', () => designReviewApi.download(id, 'docx', review.title), name => setNotice({ ok: true, text: fill(t('dr.downloaded'), { name }) }))}>{t('dr.export_docx')}</button>
            <HelpTip text={t('dr.export_help')} />
          </>}
          {review.status === 'READY' && can('Approve') && <><button className="btn btn-primary" disabled={!!busy} onClick={() => act('approve', () => designReviewApi.approve(id))}>{t('dr.approve')}</button><HelpTip text={t('dr.approve_help')} /></>}
          {review.status === 'APPROVED' && can('Approve') && <button className="btn btn-secondary" disabled={!!busy} onClick={() => act('reopen', () => designReviewApi.reopen(id))}>{t('dr.reopen')}</button>}
          {(review.status === 'READY' || review.status === 'FAILED') && can('Run') && <button className="btn btn-secondary" disabled={!!busy} onClick={() => { if (window.confirm(t('dr.rerun_confirm'))) act('rerun', () => designReviewApi.rerun(id)) }}>{t('dr.rerun')}</button>}
          {review.status !== 'APPROVED' && review.status !== 'RUNNING' && can('Edit') && <button className="btn btn-ghost" disabled={!!busy} onClick={() => { if (window.confirm(t('dr.delete_confirm'))) act('delete', () => designReviewApi.remove(id), () => onBack()) }}>{t('dr.delete')}</button>}
        </div>
      </header>
      {notice && <div role={notice.ok ? 'status' : 'alert'} className={notice.ok ? 'dr-ok' : 'dr-error'}>{notice.text}</div>}
      {review.status === 'APPROVED' && <p className="dr-dim">{t('dr.locked')}</p>}

      {(review.status === 'RUNNING' || review.status === 'FAILED') && (
        <section className="dr-card" aria-live="polite">
          {review.status === 'RUNNING' ? <p>{t('dr.running')}</p> : <div role="alert" className="dr-error">{t('dr.failed')}: {review.error}</div>}
          <ol className="dr-steps">
            {STAGES.filter(s => s !== 'DONE').map((s, i) => {
              const now = STAGES.indexOf(review.stage)
              return <li key={s} className={i < now ? 'dr-step-done' : i === now ? 'dr-step-now' : ''}>{i < now ? '✓ ' : ''}{t(`dr.stage.${s}`)}</li>
            })}
          </ol>
          {review.status === 'FAILED' && can('Run') && <div className="dr-edit-bar"><button className="btn btn-primary" disabled={!!busy} onClick={() => act('resume', () => designReviewApi.resume(id))}>{t('dr.resume')}</button></div>}
        </section>
      )}

      {r && ready && (
        <>
          <nav className="dr-tabs" role="tablist">
            {TABS.map(x => <button key={x} role="tab" aria-selected={tab === x} className={`dr-tab ${tab === x ? 'dr-tab-active' : ''}`} onClick={() => setTab(x)}>{t(`dr.tab.${x}`)}</button>)}
          </nav>
          {tab === 'summary' && <SummaryTab review={review} r={r} editable={editable} save={save} busy={busy} />}
          {tab === 'strategy' && (
            <>
              <p className="dr-dim">{t('dr.strategy_help')}</p>
              {r.strategy.length === 0 && <p className="dr-dim">{t('dr.none')}</p>}
              {r.strategy.map(g => (
                <RatedTable key={g.key} idPrefix={`st-${g.key}`} title={`${t('dr.tab.strategy')} - ${g.label}`} nameLabel={t('dr.col.objective')} rows={g.rows} showPillar editable={editable} busy={busy === 'save-strategy'}
                  onSave={rows => save('strategy', r.strategy.map(x => (x.key === g.key ? { key: x.key, rows } : { key: x.key, rows: x.rows })))} />
              ))}
            </>
          )}
          {tab === 'principles' && (
            <>
              <RatedTable idPrefix="pr" title={t('dr.sec.principles')} nameLabel={t('dr.col.principle')} rows={r.principles} editable={editable} busy={busy === 'save-principles'} onSave={rows => save('principles', rows)} />
              <RatedTable idPrefix="sd" title={t('dr.sec.standards')} help={t('dr.standards_help')} nameLabel={t('dr.col.standard')} rows={r.standards} editable={editable} busy={busy === 'save-standards'} onSave={rows => save('standards', rows)}
                addable={(review.candidates?.standards || []).filter(c => !r.standards.some(s => s.ref === c.ref))} />
            </>
          )}
          {tab === 'impact' && <ImpactTab review={review} r={r} editable={editable} save={save} busy={busy} />}
          {tab === 'gaps' && <GapsTab r={r} editable={editable} save={save} busy={busy} />}
          {tab === 'recs' && <RecsTab review={review} r={r} editable={editable} save={save} busy={busy} />}
          {tab === 'limits' && (
            <section className="dr-card">
              <div className="dr-card-head"><h2>{t('dr.sec.limits')} <HelpTip text={t('dr.limits_help')} /></h2></div>
              {r.limitations.length ? <ul className="dr-list">{r.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="dr-dim">{t('dr.no_limits')}</p>}
            </section>
          )}
        </>
      )}
    </>
  )
}

type SaveFn = (section: string, value: unknown) => void

/** A card with an Edit toggle; `editor` gets the draft and a setter. */
function EditableCard<T>({ title, help, value, editable, busy, onSave, view, editor }: {
  title: string; help?: string; value: T; editable: boolean; busy: boolean; onSave: (v: T) => void
  view: React.ReactNode; editor: (draft: T, set: (v: T) => void) => React.ReactNode
}) {
  const { t } = useLang()
  const [draft, setDraft] = useState<T | null>(null)
  const stamp = JSON.stringify(value)
  // A saved or reloaded value closes the editor (compared by content, not identity).
  useEffect(() => { setDraft(null) }, [stamp])
  return (
    <section className="dr-card">
      <div className="dr-card-head">
        <h2>{title}{help && <HelpTip text={help} />}</h2>
        {editable && draft === null && <button className="btn btn-ghost" onClick={() => setDraft(JSON.parse(JSON.stringify(value)))}>{t('dr.edit')}</button>}
      </div>
      {draft === null ? view : (
        <>
          {editor(draft, setDraft)}
          <div className="dr-edit-bar">
            <button className="btn btn-primary" disabled={busy} onClick={() => onSave(draft)}>{busy ? t('dr.saving') : t('dr.save')}</button>
            <button className="btn btn-secondary" onClick={() => setDraft(null)}>{t('dr.cancel')}</button>
          </div>
        </>
      )}
    </section>
  )
}

function SummaryTab({ review, r, editable, save, busy }: { review: Review; r: ReviewResult; editable: boolean; save: SaveFn; busy: string | null }) {
  const { t } = useLang()
  const c = review.counts || {}
  return (
    <>
      <EditableCard title={t('dr.sec.verdict')} help={t('dr.sec.verdict_help')} value={{ value: r.verdict.value, reason: r.verdict.basis === 'REVIEWER' ? '' : '', basis: r.verdict.basis }} editable={editable} busy={busy === 'save-verdict'}
        onSave={v => save('verdict', v)}
        view={(
          <div className="dr-verdict">
            <span className={`dr-verdict-pill ${verdictClass(r.verdict.value)}`} data-testid="verdict">{t(`dr.verdict.${r.verdict.value}`)}</span>
            <div className="dr-stats">
              <div className="dr-stat"><strong>{r.counts.gaps}</strong><span>{t('dr.sec.gaps')}</span></div>
              <div className="dr-stat"><strong>{r.counts.risks}</strong><span>{t('dr.sec.risks')}</span></div>
              <div className="dr-stat"><strong>{r.counts.recommendations}</strong><span>{t('dr.sec.recs')}</span></div>
            </div>
            <div style={{ flexBasis: '100%' }}>
              <div className="dr-dim">{t('dr.verdict.basis')}: {r.verdict.basis === 'REVIEWER' ? t('dr.verdict.reviewer') : t('dr.verdict.rule')} - {r.verdict.reason}</div>
              {r.executive.aiVerdict && <div className="dr-dim">{t('dr.verdict.ai')}: {t(`dr.verdict.${r.executive.aiVerdict}`)}{r.executive.aiVerdictReason ? ` - ${r.executive.aiVerdictReason}` : ''}</div>}
            </div>
          </div>
        )}
        editor={(d: any, set) => (
          <div className="dr-form">
            <div>
              <label className="form-label" htmlFor="dr-verdict-value">{t('dr.sec.verdict')}</label>
              <select id="dr-verdict-value" className="form-input" value={d.value} onChange={e => set({ ...d, value: e.target.value, basis: 'REVIEWER' })}>
                {VERDICTS.map(v => <option key={v} value={v}>{t(`dr.verdict.${v}`)}</option>)}
              </select>
            </div>
            <div className="dr-wide">
              <label className="form-label" htmlFor="dr-verdict-reason">{t('dr.verdict.reason')}</label>
              <textarea id="dr-verdict-reason" className="form-input" rows={2} value={d.reason} onChange={e => set({ ...d, reason: e.target.value, basis: 'REVIEWER' })} />
            </div>
            <div><button type="button" className="btn btn-secondary" onClick={() => save('verdict', { basis: 'RULE' })}>{t('dr.verdict.use_rule')} ({t(`dr.verdict.${r.verdict.ruleValue}`)})</button></div>
          </div>
        )} />

      <EditableCard title={t('dr.sec.executive')} value={{ headline: r.executive.headline, keyMessages: listToLines(r.executive.keyMessages) }} editable={editable} busy={busy === 'save-executive'}
        onSave={v => save('executive', { headline: v.headline, keyMessages: linesToList(v.keyMessages) })}
        view={<>{r.executive.headline && <p><strong>{r.executive.headline}</strong></p>}<ul className="dr-list">{r.executive.keyMessages.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
        editor={(d, set) => (
          <div className="dr-form">
            <div className="dr-wide"><label className="form-label" htmlFor="dr-headline">{t('dr.headline')}</label><input id="dr-headline" className="form-input" value={d.headline} onChange={e => set({ ...d, headline: e.target.value })} /></div>
            <div className="dr-wide"><label className="form-label" htmlFor="dr-messages">{t('dr.key_messages')} ({t('dr.one_per_line')})</label><textarea id="dr-messages" className="form-input" rows={5} value={d.keyMessages} onChange={e => set({ ...d, keyMessages: e.target.value })} /></div>
          </div>
        )} />

      <EditableCard title={t('dr.sec.scope')} value={{ summary: r.scope.summary, items: listToLines(r.scope.items), deliverables: listToLines(r.scope.deliverables) }} editable={editable} busy={busy === 'save-scope'}
        onSave={v => save('scope', { summary: v.summary, items: linesToList(v.items), deliverables: linesToList(v.deliverables) })}
        view={<>
          <p>{r.scope.summary}</p>
          {r.scope.items.length > 0 && <><h3 className="dr-dim">{t('dr.scope.items')}</h3><ul className="dr-list">{r.scope.items.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
          {r.scope.deliverables.length > 0 && <><h3 className="dr-dim">{t('dr.scope.deliverables')}</h3><ul className="dr-list">{r.scope.deliverables.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        </>}
        editor={(d, set) => (
          <div className="dr-form">
            <div className="dr-wide"><label className="form-label" htmlFor="dr-scope-summary">{t('dr.scope.summary')}</label><textarea id="dr-scope-summary" className="form-input" rows={3} value={d.summary} onChange={e => set({ ...d, summary: e.target.value })} /></div>
            <div><label className="form-label" htmlFor="dr-scope-items">{t('dr.scope.items')} ({t('dr.one_per_line')})</label><textarea id="dr-scope-items" className="form-input" rows={6} value={d.items} onChange={e => set({ ...d, items: e.target.value })} /></div>
            <div><label className="form-label" htmlFor="dr-scope-deliv">{t('dr.scope.deliverables')} ({t('dr.one_per_line')})</label><textarea id="dr-scope-deliv" className="form-input" rows={6} value={d.deliverables} onChange={e => set({ ...d, deliverables: e.target.value })} /></div>
          </div>
        )} />

      <EditableCard title={t('dr.sec.method')} value={listToLines(r.documentReferences)} editable={editable} busy={busy === 'save-documentReferences'}
        onSave={v => save('documentReferences', linesToList(v))}
        view={<>
          <p className="dr-dim">{t('dr.method.grounding')}: {fill(t('dr.method.counts'), { landscape: c.landscape ?? 0, projects: c.projects ?? 0, objectives: c.objectives ?? 0, principles: c.principles ?? 0, standards: c.standards ?? 0, ras: c.referenceArchitectures ?? 0 })}</p>
          {r.documentReferences.length > 0 && <><h3 className="dr-dim">{t('dr.method.cited')}</h3><ul className="dr-list">{r.documentReferences.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        </>}
        editor={(d, set) => (<><label className="form-label" htmlFor="dr-refs">{t('dr.method.cited')} ({t('dr.one_per_line')})</label><textarea id="dr-refs" className="form-input" rows={5} value={d} onChange={e => set(e.target.value)} /></>)} />
    </>
  )
}

function RatedTable({ idPrefix, title, help, nameLabel, rows, showPillar, editable, busy, onSave, addable }: {
  idPrefix: string; title: string; help?: string; nameLabel: string; rows: RatedRow[]; showPillar?: boolean; editable: boolean; busy: boolean
  onSave: (rows: Array<{ ref: string; rating: string; justification: string }>) => void; addable?: Array<{ ref: string; name: string }>
}) {
  const { t } = useLang()
  const [pick, setPick] = useState('')
  return (
    <EditableCard title={title} help={help} value={rows} editable={editable} busy={busy}
      onSave={v => onSave(v.map(x => ({ ref: x.ref, rating: x.rating, justification: x.justification })))}
      view={rows.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
        <div className="dr-table-wrap">
          <table className="dr-table">
            <thead><tr><th>{nameLabel}</th>{showPillar && <th>{t('dr.col.pillar')}</th>}<th>{t('dr.col.rating')}</th><th>{t('dr.col.justification')}</th></tr></thead>
            <tbody>{rows.map(x => (
              <tr key={x.ref}><td>{x.name}</td>{showPillar && <td>{x.pillar || '—'}</td>}<td><span className={`dr-badge ${ratingClass(x.rating)}`}>{t(`dr.rating.${x.rating}`)}</span></td><td>{x.justification}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
      editor={(d, set) => (
        <div className="dr-rows">
          {d.map((x, i) => (
            <fieldset key={x.ref} className="dr-row-edit">
              <legend className="dr-dim">{x.name}</legend>
              <div className="dr-field">
                <label className="form-label" htmlFor={`${idPrefix}-${i}-rating`}>{t('dr.col.rating')}</label>
                <select id={`${idPrefix}-${i}-rating`} className="form-input" value={x.rating} onChange={e => set(d.map((y, j) => (j === i ? { ...y, rating: e.target.value as any } : y)))}>
                  {RATINGS.map(o => <option key={o} value={o}>{t(`dr.rating.${o}`)}</option>)}
                </select>
              </div>
              <div className="dr-field dr-field-area">
                <label className="form-label" htmlFor={`${idPrefix}-${i}-just`}>{t('dr.col.justification')}</label>
                <textarea id={`${idPrefix}-${i}-just`} className="form-input" rows={2} value={x.justification} onChange={e => set(d.map((y, j) => (j === i ? { ...y, justification: e.target.value } : y)))} />
              </div>
              {addable && <button type="button" className="btn btn-ghost dr-remove" onClick={() => set(d.filter((_, j) => j !== i))}>{t('dr.remove')}</button>}
            </fieldset>
          ))}
          {addable && addable.length > 0 && (
            <div className="dr-actions">
              <label className="form-label" htmlFor={`${idPrefix}-add`}>{t('dr.add_standard')}</label>
              <select id={`${idPrefix}-add`} className="form-input" value={pick} onChange={e => setPick(e.target.value)}>
                <option value="">—</option>
                {addable.filter(a => !d.some(x => x.ref === a.ref)).map(a => <option key={a.ref} value={a.ref}>{a.name}</option>)}
              </select>
              <button type="button" className="btn btn-secondary" disabled={!pick} onClick={() => { const a = addable.find(x => x.ref === pick)!; set([...d, { ref: a.ref, id: '', name: a.name, rating: 'NOT_ASSESSED', justification: '' }]); setPick('') }}>{t('dr.add')}</button>
            </div>
          )}
        </div>
      )} />
  )
}

function ImpactTab({ review, r, editable, save, busy }: { review: Review; r: ReviewResult; editable: boolean; save: SaveFn; busy: string | null }) {
  const { t } = useLang()
  const [pick, setPick] = useState('')
  const candidates = review.candidates?.landscape || []
  return (
    <>
      <EditableCard title={t('dr.sec.domains')} value={DOMAINS.map(d => { const x = r.domains.find(y => y.domain === d); return { domain: d, level: x?.level || 'NOT_ASSESSED', points: listToLines(x?.points) } })}
        editable={editable} busy={busy === 'save-domains'} onSave={v => save('domains', v.map(x => ({ domain: x.domain, level: x.level, points: linesToList(x.points) })))}
        view={(
          <div className="dr-domains">
            {r.domains.map(d => (
              <div key={d.domain} className="dr-domain">
                <h4>{t(`dr.domain.${d.domain}`)} <span className={`dr-badge ${levelClass(d.level)}`}>{t(`dr.level.${d.level}`)}</span></h4>
                <ul className="dr-list">{d.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
              </div>
            ))}
          </div>
        )}
        editor={(d, set) => (
          <RowsEditor idPrefix="dom" rows={d} onChange={set} fixed legend={row => t(`dr.domain.${row.domain}`)} fields={[
            { key: 'level', label: t('dr.col.impact'), kind: 'select', options: [...LEVELS, 'NOT_ASSESSED'].map(x => ({ value: x, label: t(`dr.level.${x}`) })) },
            { key: 'points', label: t('dr.domain_points'), kind: 'area' },
          ]} />
        )} />

      <EditableCard title={t('dr.sec.landscape')} help={t('dr.landscape_help')} value={r.landscape} editable={editable} busy={busy === 'save-landscape'} onSave={v => save('landscape', v)}
        view={r.landscape.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
          <div className="dr-table-wrap">
            <table className="dr-table">
              <thead><tr><th>{t('dr.col.system')}</th><th>{t('dr.col.repo_status')}</th><th>{t('dr.col.owner')}</th><th>{t('dr.col.relation')}</th></tr></thead>
              <tbody>{r.landscape.map((l, i) => (
                <tr key={`${l.ref || l.name}-${i}`}>
                  <td>{l.name}{l.nameInDocument && l.nameInDocument !== l.name && <div className="dr-dim">{l.nameInDocument}</div>}</td>
                  <td>{l.inRepository ? [l.lifecycle || l.status, l.typeLabel].filter(Boolean).join(' - ') : <span className="dr-badge dr-warn">{t('dr.not_recorded')}</span>}</td>
                  <td>{l.owner || '—'}</td>
                  <td>{l.relation}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        editor={(d, set) => (
          <>
            <RowsEditor idPrefix="land" rows={d} onChange={set} fields={[
              { key: 'name', label: t('dr.col.system'), kind: 'text' },
              { key: 'relation', label: t('dr.col.relation'), kind: 'area' },
            ] as FieldSpec[]} blank={() => ({ ref: null, name: '', nameInDocument: '', inRepository: false, relation: '' })} addLabel={t('dr.system_unrecorded')} />
            {candidates.length > 0 && (
              <div className="dr-actions" style={{ marginTop: 8 }}>
                <label className="form-label" htmlFor="land-add">{t('dr.add_system')}</label>
                <select id="land-add" className="form-input" value={pick} onChange={e => setPick(e.target.value)}>
                  <option value="">—</option>
                  {candidates.filter(c => !d.some(x => x.ref === c.ref)).map(c => <option key={c.ref} value={c.ref}>{c.name} ({c.type})</option>)}
                </select>
                <button type="button" className="btn btn-secondary" disabled={!pick} onClick={() => { const c = candidates.find(x => x.ref === pick)!; set([...d, { ref: c.ref, id: null, name: c.name, nameInDocument: c.name, inRepository: true, relation: '' }]); setPick('') }}>{t('dr.add')}</button>
              </div>
            )}
          </>
        )} />

      <EditableCard title={t('dr.sec.projects')} value={r.projects} editable={editable} busy={busy === 'save-projects'} onSave={v => save('projects', v)}
        view={r.projects.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
          <div className="dr-table-wrap"><table className="dr-table">
            <thead><tr><th>{t('dr.col.project')}</th><th>{t('dr.col.status')}</th><th>{t('dr.col.relation')}</th></tr></thead>
            <tbody>{r.projects.map(p => <tr key={p.ref}><td>{p.name}</td><td>{p.status || '—'}</td><td>{p.relation}</td></tr>)}</tbody>
          </table></div>
        )}
        editor={(d, set) => <RowsEditor idPrefix="proj" rows={d} onChange={set} fields={[{ key: 'relation', label: t('dr.col.relation'), kind: 'area' }]} />} />
    </>
  )
}

function GapsTab({ r, editable, save, busy }: { r: ReviewResult; editable: boolean; save: SaveFn; busy: string | null }) {
  const { t } = useLang()
  const lv = LEVELS.map(x => ({ value: x, label: t(`dr.level.${x}`) }))
  return (
    <>
      <EditableCard title={t('dr.sec.gaps')} value={r.gaps} editable={editable} busy={busy === 'save-gaps'} onSave={v => save('gaps', v)}
        view={r.gaps.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
          <div className="dr-table-wrap"><table className="dr-table">
            <thead><tr><th>#</th><th>{t('dr.col.gap')}</th><th>{t('dr.col.description')}</th><th>{t('dr.col.severity')}</th><th>{t('dr.col.records')}</th></tr></thead>
            <tbody>{r.gaps.map(g => (
              <tr key={g.id}><td>{g.id}</td><td>{g.title}</td><td>{g.description}</td><td><span className={`dr-badge ${levelClass(g.severity)}`}>{t(`dr.severity.${g.severity}`)}</span></td><td>{g.refs.map(x => x.name).join(', ') || '—'}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        editor={(d, set) => (
          <RowsEditor idPrefix="gap" rows={d} onChange={set} blank={() => ({ title: '', description: '', severity: 'MEDIUM', refs: [] })} fields={[
            { key: 'title', label: t('dr.col.gap'), kind: 'text' },
            { key: 'severity', label: t('dr.col.severity'), kind: 'select', options: SEVERITIES.map(x => ({ value: x, label: t(`dr.severity.${x}`) })) },
            { key: 'description', label: t('dr.col.description'), kind: 'area' },
          ]} />
        )} />
      <EditableCard title={t('dr.sec.risks')} value={r.risks} editable={editable} busy={busy === 'save-risks'} onSave={v => save('risks', v)}
        view={r.risks.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
          <div className="dr-table-wrap"><table className="dr-table">
            <thead><tr><th>#</th><th>{t('dr.col.risk')}</th><th>{t('dr.col.impact')}</th><th>{t('dr.col.likelihood')}</th><th>{t('dr.col.mitigation')}</th></tr></thead>
            <tbody>{r.risks.map(k => (
              <tr key={k.id}><td>{k.id}</td><td><strong>{k.title}</strong>{k.description && <div className="dr-dim">{k.description}</div>}</td>
                <td><span className={`dr-badge ${levelClass(k.impact)}`}>{t(`dr.level.${k.impact}`)}</span></td><td><span className={`dr-badge ${levelClass(k.likelihood)}`}>{t(`dr.level.${k.likelihood}`)}</span></td><td>{k.mitigation}</td></tr>
            ))}</tbody>
          </table></div>
        )}
        editor={(d, set) => (
          <RowsEditor idPrefix="risk" rows={d} onChange={set} blank={() => ({ title: '', description: '', impact: 'MEDIUM', likelihood: 'MEDIUM', mitigation: '' })} fields={[
            { key: 'title', label: t('dr.col.risk'), kind: 'text' },
            { key: 'impact', label: t('dr.col.impact'), kind: 'select', options: lv },
            { key: 'likelihood', label: t('dr.col.likelihood'), kind: 'select', options: lv },
            { key: 'description', label: t('dr.col.description'), kind: 'area' },
            { key: 'mitigation', label: t('dr.col.mitigation'), kind: 'area' },
          ]} />
        )} />
    </>
  )
}

function RecsTab({ review, r, editable, save, busy }: { review: Review; r: ReviewResult; editable: boolean; save: SaveFn; busy: string | null }) {
  const { t } = useLang()
  const kind = review.reviewType === 'RFP' ? 'RFP' : 'DESIGN'
  const groupName = (g: string) => t(`dr.group.${g}.${kind}`)
  return (
    <>
      <EditableCard title={t('dr.sec.recs')} value={r.recommendations} editable={editable} busy={busy === 'save-recommendations'} onSave={v => save('recommendations', v.map(c => ({ ...c, gaps: commaList(c.gaps) })))}
        view={r.recommendations.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
          <>{REC_GROUPS.map(g => {
            const list = r.recommendations.filter(c => c.group === g)
            if (!list.length) return null
            return (
              <div key={g} className="dr-table-wrap">
                <h3 className="dr-dim">{groupName(g)}</h3>
                <table className="dr-table">
                  <thead><tr><th>#</th><th>{t('dr.col.recommendation')}</th><th>{t('dr.col.closes')}</th></tr></thead>
                  <tbody>{list.map(c => <tr key={c.id}><td>{c.id}</td><td>{c.text}</td><td>{c.gaps.join(', ') || '—'}</td></tr>)}</tbody>
                </table>
              </div>
            )
          })}</>
        )}
        editor={(d, set) => (
          <RowsEditor idPrefix="rec" rows={d} onChange={set} blank={() => ({ group: 'SCOPE', text: '', gaps: [] })} fields={[
            { key: 'group', label: t('dr.col.group'), kind: 'select', options: REC_GROUPS.map(g => ({ value: g, label: groupName(g) })) },
            { key: 'gaps', label: t('dr.col.closes'), kind: 'list', placeholder: t('dr.closes_ph') },
            { key: 'text', label: t('dr.col.recommendation'), kind: 'area' },
          ]} />
        )} />
      <EditableCard title={t('dr.sec.next')} value={r.nextSteps} editable={editable} busy={busy === 'save-nextSteps'} onSave={v => save('nextSteps', v)}
        view={r.nextSteps.length === 0 ? <p className="dr-dim">{t('dr.none')}</p> : (
          <div className="dr-table-wrap"><table className="dr-table">
            <thead><tr><th>{t('dr.col.step')}</th><th>{t('dr.col.owner')}</th><th>{t('dr.col.timing')}</th></tr></thead>
            <tbody>{r.nextSteps.map((s, i) => <tr key={i}><td>{s.step}</td><td>{s.owner}</td><td>{s.timing}</td></tr>)}</tbody>
          </table></div>
        )}
        editor={(d, set) => (
          <RowsEditor idPrefix="next" rows={d} onChange={set} blank={() => ({ step: '', owner: '', timing: '' })} fields={[
            { key: 'step', label: t('dr.col.step'), kind: 'text' }, { key: 'owner', label: t('dr.col.owner'), kind: 'text' }, { key: 'timing', label: t('dr.col.timing'), kind: 'text' },
          ]} />
        )} />
    </>
  )
}
