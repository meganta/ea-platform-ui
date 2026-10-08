import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { CLASSIFICATION_COLOR, ENRICHMENT_SCOPES, PIPELINE_STAGES, RUNNING_JOB_STATUSES, fmtDate, ownerApi, pct } from './ownerApi'
import { ErrorBox, fill, Loading, Pill, StepUpModal } from './ownerUi'

/**
 * AI organization discovery for one tenant: launch, follow the leased job
 * (the panel keeps asking the server to run the next stage), review every
 * staged item with its evidence, decide, and commit. Nothing is written to
 * the repository before commit.
 */
/** True when only AI model knowledge (no real source) supports the item. */
export function aiKnowledgeOnly(i: any): boolean {
  const found = (i?.evidence || []).filter((e: any) => e.found)
  return found.length > 0 && found.every((e: any) => e.sourceKind === 'AI_KNOWLEDGE')
}

/** How many Meta Model attribute values discovery found for an item. */
const metaCount = (i: any) => Object.entries(i.attributes || {}).filter(([k, v]: any) => k !== '_rejected' && v?.metaModel).length

export default function EnrichmentPanel({ tenantId, website, webSearch, aiKnowledge, onCommitted }: { tenantId: string; website?: string | null; webSearch?: boolean; aiKnowledge?: boolean; onCommitted?: () => void }) {
  const { t, isAR } = useLang()
  const [jobs, setJobs] = useState<any[] | null>(null)
  const [job, setJob] = useState<any>(null)
  const [error, setError] = useState('')
  const [scopes, setScopes] = useState<string[]>(['FULL'])
  const [site, setSite] = useState(website || '')
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const loadJobs = useCallback(async () => {
    try {
      const list = await ownerApi.enrichmentJobs(tenantId)
      if (!alive.current) return
      setJobs(list)
      if (list[0]) setJob(await ownerApi.job(list[0].id))
    } catch (e: any) { setError(e.message) }
  }, [tenantId])
  useEffect(() => { loadJobs() }, [loadJobs])

  // While a job runs, ask the server to run its next stage (and pick up progress).
  useEffect(() => {
    if (!job || !RUNNING_JOB_STATUSES.includes(job.status)) return
    let cancelled = false
    const step = async () => {
      try {
        const next = await ownerApi.advance(job.id)
        if (!cancelled && alive.current) setJob(next)
      } catch (e: any) {
        if (!cancelled) setError(e.message)
      }
    }
    const h = setTimeout(step, 1500)
    return () => { cancelled = true; clearTimeout(h) }
  }, [job])

  const launch = async () => {
    setBusy(true); setError('')
    try {
      const created = await ownerApi.launchEnrichment(tenantId, { scopes, ...(site ? { website: site } : {}) })
      setJob(await ownerApi.job(created.id))
      setJobs(await ownerApi.enrichmentJobs(tenantId))
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  // FULL is exclusive; unticking the last specific scope falls back to FULL.
  const toggleScope = (s: string) => setScopes(cur => {
    if (s === 'FULL') return ['FULL']
    const next = cur.includes(s) ? cur.filter(x => x !== s) : [...cur.filter(x => x !== 'FULL'), s]
    return next.length ? next : ['FULL']
  })
  const canLaunch = !job || ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)

  return (
    <div>
      <div className="oc-section-title">{t('owner.enrich.title')}<HelpTip text={t('owner.enrich.help')} /></div>
      {error && <ErrorBox error={error} />}
      {canLaunch && (
        <div className="oc-card" style={{ marginBottom: 14 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="owner-enrich-website">{t('owner.enrich.website')}</label>
            <input id="owner-enrich-website" className="form-input" value={site} onChange={e => setSite(e.target.value)} placeholder="https://" />
            <div className="oc-muted">{webSearch ? t('owner.enrich.web_search_on') : t('owner.enrich.web_search_off')}</div>
            {aiKnowledge && <div className="oc-muted">{t('owner.enrich.ai_knowledge_on')}<HelpTip text={t('owner.enrich.ai_knowledge_help')} /></div>}
          </div>
          <fieldset style={{ border: 'none' }}>
            <legend className="form-label">{t('owner.enrich.scopes')}</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {ENRICHMENT_SCOPES.map(s => (
                <label key={s} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
                  <input id={`owner-scope-${s}`} type="checkbox" checked={scopes.includes(s)} onChange={() => toggleScope(s)} />
                  {t(`owner.enrich.scope.${s}`)}
                  {s === 'ATTRIBUTES' && <HelpTip text={t('owner.enrich.scope_attributes_help')} />}
                </label>
              ))}
            </div>
          </fieldset>
          <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} disabled={busy} onClick={launch}>{t('owner.enrich.launch')}</button>
        </div>
      )}
      {!jobs && !error && <Loading />}
      {jobs && jobs.length === 0 && !job && <div className="oc-muted">{t('owner.enrich.no_jobs')}</div>}
      {job && <JobView job={job} setJob={setJob} onCommitted={() => { loadJobs(); onCommitted?.() }} />}
      {jobs && jobs.length > 1 && (
        <div className="oc-section">
          <div className="oc-section-title">{t('owner.enrich.history')}</div>
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th>{t('owner.col.created')}</th><th>{t('owner.col.status')}</th><th>{t('owner.enrich.scopes')}</th><th>{t('owner.enrich.objects')}</th><th>{t('owner.enrich.relationships')}</th><th /></tr></thead>
              <tbody>
                {jobs.map(j => (
                  <tr key={j.id}>
                    <td>{fmtDate(j.createdAt, isAR)}</td>
                    <td>{t(`owner.stage.${j.status}`)}</td>
                    <td className="oc-muted">{(j.scopes || []).map((s: string) => t(`owner.enrich.scope.${s}`)).join(', ')}</td>
                    <td>{j.counts?.objects ?? '—'}</td>
                    <td>{j.counts?.relationships ?? '—'}</td>
                    <td><button type="button" className="btn btn-sm btn-secondary" onClick={async () => setJob(await ownerApi.job(j.id))}>{t('owner.enrich.review')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function JobView({ job, setJob, onCommitted }: { job: any; setJob: (j: any) => void; onCommitted: () => void }) {
  const { t } = useLang()
  const done: string[] = job.progress?.stagesDone || []
  const running = RUNNING_JOB_STATUSES.includes(job.status)
  const [committing, setCommitting] = useState(false)
  const [applyProfile, setApplyProfile] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const u = job.usage || {}

  return (
    <div className="oc-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{t('owner.enrich.progress')}: {t(`owner.stage.${job.status}`)}</h3>
        {(running || job.status === 'READY_FOR_REVIEW') && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={async () => { try { await ownerApi.cancel(job.id); setJob(await ownerApi.job(job.id)) } catch (e: any) { setError(e.message) } }}>{t('owner.enrich.cancel')}</button>
        )}
      </div>
      <div className="oc-stepper" aria-label={t('owner.enrich.progress')}>
        {PIPELINE_STAGES.map(s => (
          <span key={s} className={`oc-step${done.includes(s) || (s === 'READY_FOR_REVIEW' && ['READY_FOR_REVIEW', 'COMMITTING', 'COMPLETED'].includes(job.status)) || (s === 'COMPLETED' && job.status === 'COMPLETED') ? ' done' : job.stage === s || job.status === s ? ' current' : ''}`}>{t(`owner.stage.${s}`)}</span>
        ))}
      </div>
      {running && <p className="oc-muted" style={{ marginTop: 8 }}>{job.progress?.message ? `${job.progress.message} · ` : ''}{t('owner.enrich.running')}</p>}
      {job.status === 'FAILED' && <div className="oc-error" style={{ marginTop: 8 }}>{t('owner.enrich.failed')}: {job.errorMessage || job.errorCode}</div>}
      {error && <ErrorBox error={error} />}
      {job.errorMessage && job.status === 'READY_FOR_REVIEW' && <div className="oc-error" style={{ marginTop: 8 }}>{job.errorMessage}</div>}

      <div className="oc-muted" style={{ marginTop: 8 }}>
        {t('owner.enrich.usage')}: {fill(t('owner.enrich.usage_line'), { calls: u.aiCalls || 0, tokens: (u.inputTokens || 0) + (u.outputTokens || 0), searches: u.searches || 0, pages: u.pagesFetched || 0, credits: u.estimatedCredits ?? '—' })}{u.model ? ` · ${u.provider}/${u.model}` : ''}
      </div>
      {(job.limitations || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          <strong style={{ fontSize: 13 }}>{t('owner.enrich.limitations')}</strong>
          <ul style={{ paddingInlineStart: 18, fontSize: 12 }}>{job.limitations.map((l: string, i: number) => <li key={i}>{l}</li>)}</ul>
        </div>
      )}
      {(job.sources || []).length > 0 && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13 }}>{t('owner.enrich.sources')} ({job.sources.length})</summary>
          <ul style={{ paddingInlineStart: 18, fontSize: 12 }}>
            {job.sources.map((s: any) => <li key={s.id}><strong>{s.id}</strong> {s.kind === 'AI_KNOWLEDGE' ? <span style={{ color: 'var(--warning)' }}>{t('owner.enrich.ai_knowledge_source')}</span> : <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>} <span className="oc-muted">· {s.publisher} · {s.tierLabel}</span></li>)}
          </ul>
        </details>
      )}

      {job.status === 'COMPLETED' && job.commitResult && (
        <div className="oc-ok" style={{ marginTop: 10 }}>{fill(t('owner.enrich.committed'), job.commitResult)}</div>
      )}
      {result && <div className="oc-ok" style={{ marginTop: 10 }}>{fill(t('owner.enrich.committed'), result)}</div>}

      {['READY_FOR_REVIEW', 'COMPLETED'].includes(job.status) && (
        <>
          <ProfileAndLogo job={job} setJob={setJob} />
          {(job.viewProjection || []).length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong style={{ fontSize: 13 }}>{t('owner.enrich.views_projection')}</strong>
              <ul style={{ paddingInlineStart: 18, fontSize: 12 }}>{job.viewProjection.map((v: any) => <li key={v.viewpointId}>{v.name}: {t(`owner.views.status.${v.projected}`)}{v.stillMissing?.length ? ` (${v.stillMissing.join(', ')})` : ''}</li>)}</ul>
            </div>
          )}
          <ItemReview job={job} readOnly={job.status !== 'READY_FOR_REVIEW'} />
          {job.status === 'READY_FOR_REVIEW' && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={() => setCommitting(true)}>{t('owner.enrich.commit')}</button>
              <HelpTip text={t('owner.enrich.commit_help')} />
            </div>
          )}
        </>
      )}
      {committing && (
        <StepUpModal title={t('owner.enrich.commit')} help={t('owner.enrich.commit_help')} confirmLabel={t('owner.enrich.commit')}
          extra={<label style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 10 }}><input id="owner-apply-profile" type="checkbox" checked={applyProfile} onChange={e => setApplyProfile(e.target.checked)} />{t('owner.enrich.apply_profile')}</label>}
          onCancel={() => setCommitting(false)}
          onConfirm={async ({ password }) => {
            const r = await ownerApi.commit(job.id, { password, applyProfile })
            setResult(r.result)
            setCommitting(false)
            setJob(await ownerApi.job(job.id))
            onCommitted()
          }} />
      )}
    </div>
  )
}

function ProfileAndLogo({ job, setJob }: { job: any; setJob: (j: any) => void }) {
  const { t } = useLang()
  const profile = job.profile || {}
  const fields = Object.entries(profile)
  return (
    <div className="oc-grid-2" style={{ marginTop: 12 }}>
      {fields.length > 0 && (
        <div>
          <strong style={{ fontSize: 13 }}>{t('owner.enrich.profile')}</strong>
          <dl className="oc-kv" style={{ marginTop: 6 }}>
            {fields.map(([k, v]: any) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{k}</dt>
                <dd>{v.value} <Pill text={t(`owner.class.${v.classification}`)} color={CLASSIFICATION_COLOR[v.classification]} /></dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {job.logo && (
        <div>
          <strong style={{ fontSize: 13 }}>{t('owner.enrich.logo')}</strong><HelpTip text={t('owner.enrich.logo_help')} />
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
            <img src={job.logo.url} alt={t('owner.enrich.logo')} style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', background: '#fff', border: '1px solid var(--border)', padding: 4 }} />
            <div className="oc-muted" style={{ wordBreak: 'break-all' }}>{job.logo.sourceUrl}</div>
          </div>
          {job.status === 'READY_FOR_REVIEW' && (
            <div className="flex gap-2" style={{ marginTop: 6 }}>
              {(['APPROVED', 'REJECTED'] as const).map(d => (
                <button key={d} type="button" className={`btn btn-sm ${job.logo.decision === d ? 'btn-primary' : 'btn-secondary'}`} aria-pressed={job.logo.decision === d}
                  onClick={async () => { await ownerApi.logo(job.id, d); setJob(await ownerApi.job(job.id)) }}>{d === 'APPROVED' ? t('owner.enrich.approve') : t('owner.enrich.reject')}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemReview({ job, readOnly }: { job: any; readOnly: boolean }) {
  const { t, isAR } = useLang()
  const [items, setItems] = useState<any[] | null>(null)
  const [kind, setKind] = useState('OBJECT')
  const [classification, setClassification] = useState('')
  const [changeType, setChangeType] = useState('')
  const [decision, setDecision] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(() => {
    ownerApi.items(job.id, { kind }).then(setItems).catch((e: any) => setError(e.message))
  }, [job.id, kind])
  useEffect(() => { load() }, [load])

  const [basis, setBasis] = useState('')
  const shown = useMemo(() => (items || []).filter(i => (!classification || i.classification === classification) && (!changeType || i.changeType === changeType) && (!decision || i.decision === decision)
    && (!basis || (basis === 'AI_KNOWLEDGE' ? aiKnowledgeOnly(i) : !aiKnowledgeOnly(i)))), [items, classification, changeType, decision, basis])
  const decide = async (decisions: Array<{ itemId: string; decision: string; mergeTargetId?: string }>) => {
    setError('')
    try { await ownerApi.decide(job.id, decisions); load() } catch (e: any) { setError(e.message) }
  }
  const approvable = (i: any) => i.mappingStatus === 'MAPPED' && i.classification !== 'INSUFFICIENT_EVIDENCE'
  const pendingVerified = shown.filter(i => i.decision === 'PENDING' && i.classification === 'VERIFIED' && approvable(i))

  return (
    <div style={{ marginTop: 14 }}>
      <div className="oc-tabs" role="tablist">
        {['OBJECT', 'RELATIONSHIP'].map(k => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} className={`oc-tab${kind === k ? ' active' : ''}`} onClick={() => { setKind(k); setItems(null) }}>{k === 'OBJECT' ? t('owner.enrich.objects') : t('owner.enrich.relationships')}</button>
        ))}
      </div>
      <div className="oc-toolbar">
        <label htmlFor="owner-items-class" className="oc-muted">{t('owner.enrich.confidence')}</label>
        <select id="owner-items-class" className="form-input" value={classification} onChange={e => setClassification(e.target.value)}>
          <option value="">{t('owner.enrich.filter_all')}</option>
          {Object.keys(CLASSIFICATION_COLOR).map(c => <option key={c} value={c}>{t(`owner.class.${c}`)}</option>)}
        </select>
        <label htmlFor="owner-items-change" className="oc-muted">{t('owner.col.status')}</label>
        <select id="owner-items-change" className="form-input" value={changeType} onChange={e => setChangeType(e.target.value)}>
          <option value="">{t('owner.enrich.filter_all')}</option>
          {['NEW', 'ENRICH_EXISTING', 'RELATIONSHIP', 'POSSIBLE_DUPLICATE', 'CONFLICT', 'NO_CHANGE'].map(c => <option key={c} value={c}>{t(`owner.change.${c}`)}</option>)}
        </select>
        <label htmlFor="owner-items-decision" className="oc-muted">{t('owner.enrich.review')}</label>
        <select id="owner-items-decision" className="form-input" value={decision} onChange={e => setDecision(e.target.value)}>
          <option value="">{t('owner.enrich.filter_all')}</option>
          {['PENDING', 'APPROVED', 'REJECTED', 'MERGE'].map(c => <option key={c} value={c}>{t(`owner.decision.${c}`)}</option>)}
        </select>
        <label htmlFor="owner-items-basis" className="oc-muted">{t('owner.enrich.basis')}</label>
        <select id="owner-items-basis" className="form-input" value={basis} onChange={e => setBasis(e.target.value)}>
          <option value="">{t('owner.enrich.filter_all')}</option>
          <option value="SOURCED">{t('owner.enrich.basis_sourced')}</option>
          <option value="AI_KNOWLEDGE">{t('owner.enrich.basis_ai')}</option>
        </select>
        {!readOnly && pendingVerified.length > 0 && (
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => decide(pendingVerified.map(i => ({ itemId: i.id, decision: 'APPROVED' })))}>{t('owner.enrich.approve_verified')} ({pendingVerified.length})</button>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      {!items ? <Loading /> : shown.length === 0 ? <div className="oc-muted">{t('owner.enrich.no_items')}</div> : (
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead><tr><th>{kind === 'OBJECT' ? t('owner.enrich.objects') : t('owner.enrich.relationships')}</th><th>{t('owner.enrich.type')}</th><th>{t('owner.enrich.evidence')}</th><th>{t('owner.col.status')}</th><th>{t('owner.enrich.review')}</th></tr></thead>
            <tbody>
              {shown.map(i => (
                <tr key={i.id}>
                  <td style={{ minWidth: 220 }}>
                    <strong>{isAR && i.nameAr ? i.nameAr : i.name}</strong>
                    {i.kind === 'RELATIONSHIP' && <div className="oc-muted">{i.sourceName || i.sourceKey} → {i.relationshipLabel} → {i.targetName || i.targetKey}</div>}
                    {i.description && <div className="oc-muted">{i.description}</div>}
                    {i.mappingStatus !== 'MAPPED' && <div style={{ color: 'var(--warning)', fontSize: 12 }}>{t(`owner.mapping.${i.mappingStatus}`)}</div>}
                    {i.commitStatus && <div className="oc-muted">{t('owner.enrich.commit_result')}: {i.commitStatus}{i.commitMessage ? ` — ${i.commitMessage}` : ''}</div>}
                  </td>
                  <td className="oc-muted">{i.kind === 'OBJECT' ? <>{t(`owner.concept.${i.concept}`)}<br />{i.objectTypeCode || '—'}</> : (i.relationshipDefinitionCode || '—')}</td>
                  <td style={{ minWidth: 200 }}>
                    <Pill text={t(`owner.class.${i.classification}`)} color={CLASSIFICATION_COLOR[i.classification]} />
                    {aiKnowledgeOnly(i) && <div style={{ marginTop: 4 }}><Pill text={t('owner.enrich.ai_knowledge_badge')} color="var(--warning)" /><div className="oc-muted">{t('owner.enrich.ai_knowledge_verify')}</div></div>}
                    <div className="oc-muted">{t(`owner.fact.${i.factType}`)} · {t('owner.enrich.confidence')} {pct(i.confidence)}</div>
                    {metaCount(i) > 0 && <div className="oc-muted">{fill(t('owner.enrich.meta_count'), { n: metaCount(i) })}</div>}
                    <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 4 }} aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>{t('owner.enrich.evidence')} ({(i.evidence || []).length})</button>
                    {open === i.id && (
                      <div>
                        {(i.evidence || []).map((e: any, k: number) => (
                          <div key={k} className={`oc-evidence${e.found ? '' : ' missing'}`}>
                            “{e.excerpt}”
                            <div className="oc-muted">{e.sourceKind === 'AI_KNOWLEDGE' ? <span style={{ color: 'var(--warning)' }}>{t('owner.enrich.ai_knowledge_source')}</span> : e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title || e.url}</a> : e.sourceId} · {e.publisher} · {e.found ? t('owner.enrich.excerpt_found') : t('owner.enrich.excerpt_missing')}</div>
                          </div>
                        ))}
                        {Object.entries(i.attributes || {}).some(([k, v]: any) => k !== '_rejected' && v?.metaModel) && (
                          <div className="oc-evidence"><strong>{t('owner.enrich.meta_attributes')}<HelpTip text={t('owner.enrich.meta_attributes_help')} />:</strong> {Object.entries(i.attributes).filter(([k, v]: any) => k !== '_rejected' && v?.metaModel).map(([k, v]: any) => `${(isAR && v.labelAr) || v.label || k}: ${Array.isArray(v.value) ? v.value.join(', ') : String(v.value)}${v.raw && String(v.raw) !== String(v.value) ? ` (${v.raw})` : ''}`).join(' · ')}</div>
                        )}
                        {Object.entries(i.attributes || {}).filter(([k, v]: any) => k !== '_rejected' && !v?.metaModel).length > 0 && (
                          <div className="oc-evidence"><strong>{t('owner.enrich.attributes')}:</strong> {Object.entries(i.attributes).filter(([k, v]: any) => k !== '_rejected' && !v?.metaModel).map(([k, v]: any) => `${k}: ${v.value}`).join(' · ')}</div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {t(`owner.change.${i.changeType}`)}
                    {i.matchedAssetId && <div className="oc-muted">{t('owner.enrich.matched')}: {i.matchedAssetId.slice(0, 8)}</div>}
                    {(i.duplicateCandidates || []).length > 0 && <div className="oc-muted">{t('owner.enrich.duplicates')}: {i.duplicateCandidates.map((d: any) => `${d.name} (${pct(d.similarity)})`).join(', ')}</div>}
                  </td>
                  <td style={{ minWidth: 150 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{t(`owner.decision.${i.decision}`)}</div>
                    {!readOnly && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {approvable(i) && i.decision !== 'APPROVED' && <button type="button" className="btn btn-sm btn-primary" onClick={() => decide([{ itemId: i.id, decision: 'APPROVED' }])}>{t('owner.enrich.approve')}</button>}
                        {i.decision !== 'REJECTED' && <button type="button" className="btn btn-sm btn-secondary" onClick={() => decide([{ itemId: i.id, decision: 'REJECTED' }])}>{t('owner.enrich.reject')}</button>}
                        {approvable(i) && i.kind === 'OBJECT' && (i.duplicateCandidates || []).length > 0 && i.decision !== 'MERGE' && (
                          <button type="button" className="btn btn-sm btn-secondary" onClick={() => decide([{ itemId: i.id, decision: 'MERGE', mergeTargetId: i.duplicateCandidates[0].id }])}>{t('owner.enrich.merge')}</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
