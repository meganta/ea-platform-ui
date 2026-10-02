import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { RefreshFinding, StrategyRefresh, strategyRefreshApi } from '../lib/strategy-refresh'
import './StrategyRefreshPage.css'
import { ASSESSMENT_TYPES, CONCLUSION_TAB, factType, ReviewSteps, STRUCTURE_TYPES, StrategyLimitsPanel, StrategyMap, StrategySummaryGroups } from '../components/StrategyRefreshSections'
import { publishEffect, StrategyFindingCard } from '../components/StrategyFindingCard'
import { StrategyPublicationDialog } from '../components/StrategyPublicationDialog'
import { StrategyImpactOverview, StrategyImpactRegister } from '../components/StrategyImpactRegister'
import HelpTip from '../components/HelpTip'

const tabs = ['overview', 'map', 'changes', 'impact', 'execution', 'review'] as const
type Tab = typeof tabs[number]
const label = (value: string) => value.replace(/_/g, ' ').toLowerCase()
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), text)

export default function StrategyRefreshPage() {
  const { t, isAR } = useLang()
  const displayLabel = (value: string) => {
    const key = `strategy.refresh.label.${value}`
    const translated = t(key)
    return translated === key || translated === `[${key}]` ? label(value) : translated
  }
  const { hasPermission } = useAuth()
  const [list, setList] = useState<StrategyRefresh[]>([])
  const [refresh, setRefresh] = useState<StrategyRefresh | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [category, setCategory] = useState<string | null>(null)
  const [impactDomain, setImpactDomain] = useState('')
  const [mapType, setMapType] = useState('')
  const [drivenBy, setDrivenBy] = useState<RefreshFinding | null>(null)
  const [summaryFindingIds, setSummaryFindingIds] = useState<string[] | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [strategyId, setStrategyId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [evidence, setEvidence] = useState<RefreshFinding | null>(null)
  const [publication, setPublication] = useState<RefreshFinding | null>(null)
  const [review, setReview] = useState<{ finding: RefreshFinding; action: 'APPROVE' | 'REJECT' | 'AMEND' } | null>(null)
  const [reason, setReason] = useState('')
  const [bulk, setBulk] = useState<{ label: string; items: RefreshFinding[] } | null>(null)
  const [amendTitle, setAmendTitle] = useState('')
  const [amendDescription, setAmendDescription] = useState('')
  const selection = useRef<string | null>(null)
  const root = useRef<HTMLElement>(null)
  const modalOpen = createOpen || !!review || !!evidence || !!bulk
  useEffect(() => {
    if (!modalOpen) return
    const dialog = root.current?.querySelector<HTMLElement>('[role="dialog"]')
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'))
    dialog.tabIndex = -1
    ;(focusable()[0] || dialog).focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); setCreateOpen(false); setReview(null); setEvidence(null); setBulk(null) }
      if (event.key !== 'Tab') return
      const controls = focusable()
      const first = controls[0] || dialog
      const last = controls[controls.length - 1] || dialog
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus() }
    }
    dialog.addEventListener('keydown', onKey)
    return () => { dialog.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
  }, [modalOpen, busy, evidence?.id, review?.finding.id, bulk])
  const loadList = useCallback(() => strategyRefreshApi.list().then(setList), [])
  useEffect(() => { loadList().catch(e => setError(e.message)) }, [loadList])
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('refreshId')
    if (!id) return
    let cancelled = false
    selection.current = id
    strategyRefreshApi.get(id).then(result => { if (!cancelled && selection.current === id) setRefresh(result) }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])
  const open = async (id: string) => {
    selection.current = id
    setError('')
    try { const result = await strategyRefreshApi.get(id); if (selection.current === id) { setRefresh(result); setTab('overview'); setCategory(null); setImpactDomain(''); setMapType(''); setDrivenBy(null) } }
    catch (e: any) { setError(e.message) }
  }
  const reload = async () => {
    const id = selection.current
    if (!id) return
    const result = await strategyRefreshApi.get(id)
    if (selection.current === id) setRefresh(result)
  }
  const refreshId = refresh?.id
  const analysisStatus = refresh?.analysisStatus
  const publicationPending = refresh?.findings?.some(item => ['QUEUED', 'PROCESSING'].includes(item.publicationStatus || '')) || false
  useEffect(() => {
    if (!refreshId || !analysisStatus || (!['QUEUED', 'PROCESSING'].includes(analysisStatus) && !publicationPending)) return
    let cancelled = false
    const id = refreshId
    const timer = window.setInterval(() => {
      strategyRefreshApi.get(id).then(result => { if (!cancelled && selection.current === id) setRefresh(result) }).catch(e => { if (!cancelled) setError(e.message) })
    }, 4000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [refreshId, analysisStatus, publicationPending])

  const execute = async (action: () => Promise<void>) => {
    setBusy(true); setError('')
    try { await action() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const create = () => execute(async () => {
    if (!title.trim() || !files.length) throw new Error(t('strategy.refresh.documents_required'))
    const created = await strategyRefreshApi.create(title.trim(), strategyId || undefined)
    selection.current = created.id
    setRefresh(created)
    setCreateOpen(false)
    // A failed upload leaves a recoverable draft, not an orphaned in-memory job.
    for (const file of files) await strategyRefreshApi.upload(created.id, file)
    await strategyRefreshApi.analyze(created.id)
    setFiles([]); setTitle(''); setStrategyId('')
    await reload(); await loadList()
  })
  const rerun = () => execute(async () => {
    if (!refresh) return
    const created = await strategyRefreshApi.rerun(refresh.id)
    selection.current = created.id
    const result = await strategyRefreshApi.get(created.id)
    if (selection.current === created.id) { setRefresh(result); setTab('overview'); setCategory(null); setImpactDomain(''); setMapType(''); setDrivenBy(null) }
    await loadList()
  })
  const openSource = (sourceId: string) => execute(async () => {
    const blob = await strategyRefreshApi.source(refresh!.id, sourceId)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.target = '_blank'; link.rel = 'noopener'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  })
  const findings = refresh?.findings || []
  const visible = findings.filter(f => {
    if (category && summaryFindingIds) return summaryFindingIds.includes(f.id)
    if (category) return f.category === category
    if (tab === 'map') return false
    if (tab === 'changes') return f.category === 'STRATEGIC_CHANGE'
    if (tab === 'impact') return ['STRATEGY_ALIGNMENT', 'CAPABILITY_IMPACT', 'ARCHITECTURE_IMPACT', 'ARCHITECTURE_GAP', 'TARGET_REASSESSMENT', 'GOVERNANCE_REVIEW'].includes(f.category)
    if (tab === 'execution') return ['INITIATIVE_REVIEW', 'ADM_REVALIDATION', 'OUTCOME_TRACEABILITY'].includes(f.category)
    if (tab === 'review') return f.decision !== 'INFORMATIONAL'
    return false
  })
  const startReview = (finding: RefreshFinding, action: 'APPROVE' | 'REJECT' | 'AMEND') => { setReview({ finding, action }); setReason(''); setAmendTitle(finding.title); setAmendDescription(finding.payload.description || '') }
  const saveReview = () => execute(async () => {
    if (!refresh || !review || !reason.trim()) return
    await strategyRefreshApi.decide(refresh.id, review.finding, review.action, reason.trim(), review.action === 'AMEND' ? { title: amendTitle, description: amendDescription } : undefined)
    setReview(null); await reload()
  })
  const canDecide = (finding: RefreshFinding) => !finding.publishedAt && !['QUEUED', 'PROCESSING'].includes(finding.publicationStatus || '') && (finding.category !== 'STRATEGY_STRUCTURE' || refresh?.strategyStatus === 'DRAFT')
  const reviewable = findings.filter(f => f.decision !== 'INFORMATIONAL')
  const reviewGroups = [
    ...[...STRUCTURE_TYPES, ...ASSESSMENT_TYPES, ...new Set(reviewable.filter(f => f.category === 'STRATEGY_STRUCTURE').map(factType))].filter((k, i, a) => a.indexOf(k) === i)
      .map(k => ({ key: `fact-${k}`, label: t(`strategy.refresh.fact_group.${k}`) === `strategy.refresh.fact_group.${k}` ? k : t(`strategy.refresh.fact_group.${k}`), items: reviewable.filter(f => f.category === 'STRATEGY_STRUCTURE' && factType(f) === k) })),
    ...Object.keys(CONCLUSION_TAB).map(c => ({ key: c, label: displayLabel(c), items: reviewable.filter(f => f.category === c) })),
  ].filter(g => g.items.length)
  const card = (finding: RefreshFinding) => <StrategyFindingCard key={finding.id} finding={finding} t={t} findings={findings} evidence={refresh?.context?.evidence || []} onWhy={setEvidence}>
    {tab === 'review' && hasPermission('Strategy.Review') && canDecide(finding) && (['APPROVE', 'REJECT', 'AMEND'] as const).map(action => <button disabled={busy} key={action} onClick={() => startReview(finding, action)}>{t(`strategy.refresh.${action.toLowerCase()}`)}</button>)}
    {tab === 'review' && refresh?.strategyStatus === 'ACTIVE' && finding.decision === 'APPROVED' && publishEffect(finding) !== 'NONE' && hasPermission('Strategy.Publish') && <span className="publish-controls"><span>{displayLabel(finding.publicationStatus || 'NOT_REQUESTED')}</span>{finding.publicationFailureCode && <span role="alert">{t('strategy.refresh.publication.failed')}</span>}{!finding.publishedAt && !['QUEUED', 'PROCESSING'].includes(finding.publicationStatus || '') && <button disabled={busy} onClick={() => setPublication(finding)}>{t('strategy.refresh.publish')}</button>}{['QUEUED', 'FAILED'].includes(finding.publicationStatus || '') && <button disabled={busy} onClick={() => execute(async () => { await strategyRefreshApi.cancelPublication(refresh!.id, finding.id); await reload() })}>{t('strategy.refresh.publication.withdraw')}</button>}</span>}
  </StrategyFindingCard>
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const saveBulk = () => execute(async () => {
    if (!refresh || !bulk || !reason.trim()) return
    setBulkProgress({ done: 0, total: bulk.items.length })
    try {
      for (const [index, item] of bulk.items.entries()) {
        await strategyRefreshApi.decide(refresh.id, item, 'APPROVE', reason.trim())
        setBulkProgress({ done: index + 1, total: bulk.items.length })
      }
      setBulk(null)
    } finally { setBulkProgress(null); await reload() }
  })
  const sourceQuotes = Array.isArray(evidence?.evidence) ? evidence!.evidence : []
  const linkedFacts = findings.filter(f => evidence?.evidence?.factIds?.includes(f.id))
  const linkedPrevious = refresh?.context?.previous?.filter(f => evidence?.evidence?.previousFactIds?.includes(f.id)) || []
  const linkedTenant = refresh?.context?.evidence.filter(e => evidence?.evidence?.tenantEvidenceIds?.includes(e.id)) || []

  return <main ref={root} className="strategy-refresh" dir={isAR ? 'rtl' : 'ltr'}>
    <header><div><h1>{t('strategy.refresh.heading')}</h1><p>{t('strategy.refresh.intro')}</p></div>{hasPermission('Strategy.Refresh') && <button className="primary" disabled={busy} onClick={() => setCreateOpen(true)}>{t('strategy.refresh.start')}</button>}</header>
    {error && <div role="alert" className="error">{error}</div>}
    {!refresh ? <section className="refresh-list"><h2>{t('strategy.refresh.history')}</h2>{list.length ? list.map(item => <button className="refresh-card" key={item.id} onClick={() => open(item.id)}><strong>{item.title}</strong><span>{displayLabel(item.analysisStatus)} · {displayLabel(item.strategyStatus)}</span></button>) : <p>{t('strategy.refresh.empty')}</p>}</section> : <>
      <div className="refresh-title"><button onClick={() => { selection.current = null; setRefresh(null); loadList().catch(e => setError(e.message)) }}>{t('strategy.refresh.back')}</button><h2>{refresh.title}</h2><span>{displayLabel(refresh.strategyStatus)}</span>{['READY', 'FAILED'].includes(refresh.analysisStatus) && hasPermission('Strategy.Refresh') && <span className="rerun"><button disabled={busy} onClick={rerun}>{t('strategy.refresh.rerun')}</button><HelpTip text={t('strategy.refresh.rerun_help')} /></span>}</div>
      <div className="response-progress"><span>{t('strategy.refresh.response')}: {refresh.responseProgress?.published || 0} / {refresh.responseProgress?.total || 0}</span><span>{t('strategy.refresh.pending')}: {refresh.responseProgress?.pending || 0}</span></div>
{refresh.analysisStatus !== 'READY' ? <section className={refresh.analysisStatus === 'FAILED' ? 'status error' : 'status'} aria-live="polite"><h2>{['QUEUED', 'PROCESSING'].includes(refresh.analysisStatus) ? t('strategy.refresh.working') : refresh.analysisStatus === 'FAILED' ? t('strategy.refresh.failed') : displayLabel(refresh.analysisStatus)}</h2><p>{t(refresh.analysisStatus === 'FAILED' ? 'strategy.refresh.failed_hint' : 'strategy.refresh.provisional')}</p>{refresh.failureCode === 'AI_RESPONSE_INVALID' && <p>{t('strategy.refresh.invalid_hint')}</p>}{refresh.failureCode === 'AI_CITATION_INVALID' && <p>{t('strategy.refresh.citation_hint')}</p>}{refresh.failureCode && <details><summary>{t('strategy.refresh.technical_details')}</summary><code>{refresh.failureCode}</code></details>}{['FAILED', 'UPLOADING'].includes(refresh.analysisStatus) && hasPermission('Strategy.Refresh') && <>{refresh.analysisStatus === 'UPLOADING' && <input aria-label={t('strategy.refresh.documents')} type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.md" onChange={event => setFiles(Array.from(event.target.files || []))}/>}<button disabled={busy} onClick={() => execute(async () => { for (const file of files) await strategyRefreshApi.upload(refresh.id, file); const queued = await strategyRefreshApi.analyze(refresh.id); if (selection.current === refresh.id) setRefresh(queued); setFiles([]); await reload() })}>{t(refresh.analysisStatus === 'FAILED' ? 'strategy.refresh.retry' : 'strategy.refresh.analyze')}</button></>}</section> : <>
        <nav aria-label={t('strategy.refresh.workspace')}>{tabs.map(item => <button key={item} aria-current={tab === item ? 'page' : undefined} onClick={() => { setTab(item); setCategory(null); setDrivenBy(null) }}>{t(`strategy.refresh.tab.${item}`)}</button>)}</nav>
        {tab === 'overview' && !category && (refresh.impact ? <StrategyImpactOverview impact={refresh.impact} t={t} onOpenDomain={domain => { setTab('impact'); setCategory(null); setDrivenBy(null); setImpactDomain(domain) }} /> : <p className="limitation">{t('strategy.refresh.impact.legacy')}</p>)}
        {tab === 'impact' && !category && refresh.impact && <StrategyImpactRegister impact={refresh.impact} findings={findings} t={t} domain={impactDomain} onDomainChange={setImpactDomain} onShowFact={setEvidence} factFilter={drivenBy} onClearFact={() => setDrivenBy(null)} />}
        {tab === 'overview' && !category && <section><h2>{t('strategy.refresh.summary')}</h2><p>{t('strategy.refresh.provisional')}</p><StrategySummaryGroups findings={findings} t={t} onOpenFacts={type => { setTab('map'); setCategory(null); setMapType(type) }} onOpenConclusions={c => { setTab(CONCLUSION_TAB[c] || 'review'); setCategory(c); setSummaryFindingIds(null) }} /><StrategyLimitsPanel limits={refresh.limits || []} t={t} /></section>}
        {tab === 'map' && !category && <StrategyMap findings={findings} impact={refresh.impact} t={t} type={mapType} onTypeChange={setMapType} onShowFact={setEvidence} onOpenDriven={f => { setDrivenBy(f); setImpactDomain(''); setTab('impact') }} />}
        {tab === 'changes' && !category && !findings.some(f => f.category === 'STRATEGIC_CHANGE') && <p className="changes-empty" role="status">{t(refresh.baseRefreshId ? 'strategy.refresh.changes.none' : 'strategy.refresh.changes.no_baseline')}</p>}
        {category && <button onClick={() => setCategory(null)}>{t('strategy.refresh.back')}</button>}
        {((tab !== 'overview' && tab !== 'map' && tab !== 'execution' && tab !== 'review' && !(tab === 'changes' && !visible.length)) || category) && <section className="finding-list">{visible.length ? visible.map(card) : <p>{t('strategy.refresh.no_findings')}</p>}</section>}
        {tab === 'execution' && !category && <section className="execution-sections">{(['INITIATIVE_REVIEW', 'ADM_REVALIDATION', 'OUTCOME_TRACEABILITY'] as const).map(c => { const items = findings.filter(f => f.category === c); return <div key={c} className="execution-section" data-testid={`execution-${c}`}><h2>{t(`strategy.refresh.execution.${c}`)}</h2><p className="impact-note">{t(`strategy.refresh.execution.${c}.help`)}</p>{items.length ? items.map(card) : <p className="impact-note">{t('strategy.refresh.execution.none')}</p>}</div> })}</section>}
        {tab === 'review' && !category && <ReviewSteps refresh={refresh} t={t} />}
        {tab === 'review' && !category && reviewGroups.map(group => { const pending = group.items.filter(f => f.decision === 'PENDING' && canDecide(f)); return <section key={group.key} className="review-group" data-testid={`review-group-${group.key}`}><div className="review-group-head"><h3>{group.label} ({group.items.length})</h3>{pending.length > 1 && hasPermission('Strategy.Review') && <button disabled={busy} onClick={() => { setBulk({ label: group.label, items: pending }); setReason('') }}>{fill(t('strategy.refresh.review.approve_group'), { n: pending.length })}</button>}</div>{group.items.map(card)}</section> })}
        {tab === 'review' && !category && !reviewGroups.length && <p>{t('strategy.refresh.no_findings')}</p>}
        {tab === 'review' && refresh.strategyStatus === 'DRAFT' && hasPermission('Strategy.Activate') && <section><h2>{t('strategy.refresh.activate')}</h2><p>{t('strategy.refresh.activation_note')}</p><button disabled={busy} onClick={() => execute(async () => { await strategyRefreshApi.activate(refresh.id); await reload() })}>{t('strategy.refresh.activate')}</button></section>}
      </>}
    </>}
    {createOpen && <div className="modal-backdrop"><section className="refresh-modal" role="dialog" aria-modal="true" aria-label={t('strategy.refresh.start')}><h2>{t('strategy.refresh.start')}</h2><label>{t('strategy.refresh.title')}<input value={title} maxLength={300} onChange={event => setTitle(event.target.value)} /></label><label>{t('strategy.refresh.identity')}<select value={strategyId} onChange={event => setStrategyId(event.target.value)}><option value="">{t('strategy.refresh.new_identity')}</option>{Array.from(new Map(list.map(item => [item.strategyId, item])).values()).map(item => <option key={item.strategyId} value={item.strategyId}>{item.strategy?.name || item.title}</option>)}</select></label><label>{t('strategy.refresh.documents')}<input type="file" multiple accept=".pdf,.docx,.xlsx,.txt,.md" onChange={event => setFiles(Array.from(event.target.files || []))}/></label><p>{t('strategy.refresh.upload_note')}</p><div className="actions"><button onClick={() => setCreateOpen(false)} disabled={busy}>{t('strategy.refresh.cancel')}</button><button className="primary" onClick={create} disabled={busy || !title.trim() || !files.length}>{t('strategy.refresh.analyze')}</button></div></section></div>}
    {review && <div className="modal-backdrop"><section className="refresh-modal" role="dialog" aria-modal="true" aria-label={t('strategy.refresh.review_decision')}><h2>{review.finding.title}</h2><p>{t('strategy.refresh.authority_note')}</p>{review.action === 'AMEND' && <><label>{t('strategy.refresh.title')}<input value={amendTitle} onChange={e => setAmendTitle(e.target.value)} /></label><label>{t('strategy.refresh.description')}<textarea value={amendDescription} onChange={e => setAmendDescription(e.target.value)} /></label></>}<label>{t('strategy.refresh.reason')}<textarea value={reason} maxLength={4000} onChange={e => setReason(e.target.value)}/></label><div className="actions"><button disabled={busy} onClick={() => setReview(null)}>{t('strategy.refresh.cancel')}</button><button disabled={busy || !reason.trim() || (review.action === 'AMEND' && !amendTitle.trim())} onClick={saveReview}>{t(`strategy.refresh.${review.action.toLowerCase()}`)}</button></div></section></div>}
    {bulk && <div className="modal-backdrop"><section className="refresh-modal" role="dialog" aria-modal="true" aria-label={t('strategy.refresh.review.bulk_title')}><h2>{t('strategy.refresh.review.bulk_title')}</h2><p>{fill(t('strategy.refresh.review.bulk_note'), { n: bulk.items.length, group: bulk.label })}</p><label htmlFor="bulk-reason">{t('strategy.refresh.reason')}<textarea id="bulk-reason" value={reason} maxLength={4000} onChange={e => setReason(e.target.value)} /></label>{bulkProgress && <p role="status">{fill(t('strategy.refresh.review.bulk_progress'), { done: bulkProgress.done, total: bulkProgress.total })}</p>}<div className="actions"><button disabled={busy} onClick={() => setBulk(null)}>{t('strategy.refresh.cancel')}</button><button className="primary" disabled={busy || !reason.trim()} onClick={saveBulk}>{fill(t('strategy.refresh.review.approve_group'), { n: bulk.items.length })}</button></div></section></div>}
    {evidence && <div className="modal-backdrop"><aside className="evidence-drawer" role="dialog" aria-modal="true" aria-label={t('strategy.refresh.why')}><button onClick={() => setEvidence(null)}>{t('strategy.refresh.close')}</button><h2>{evidence.title}</h2><p>{t('strategy.refresh.authority')}: {displayLabel(evidence.authority)}</p>{evidence.confidence !== null && <p>{t('strategy.refresh.confidence')}: {evidence.confidence}</p>}<p>{t('strategy.refresh.authority_note')}</p>{!!evidence.payload.attributes?.length && <section><h3>{t('strategy.refresh.declared_attributes')}</h3><dl>{evidence.payload.attributes.map((attribute, index) => <div key={`${attribute.name}:${index}`}><dt>{attribute.name}</dt><dd>{attribute.value}<blockquote>{attribute.quote}</blockquote></dd></div>)}</dl></section>}{sourceQuotes.map((quote: any, index: number) => <section key={index}><blockquote>{quote.quote}</blockquote><p>{quote.section}{quote.page ? ` · ${quote.page}` : ''}</p><button onClick={() => openSource(quote.sourceId)}>{refresh?.sources?.find(s => s.id === quote.sourceId)?.filename || t('strategy.refresh.source')}</button></section>)}{linkedFacts.map(f => <section key={f.id}><h3>{f.title}</h3><p>{displayLabel(f.authority)}</p><button onClick={() => setEvidence(f)}>{t('strategy.refresh.source')}</button></section>)}{linkedPrevious.map(previous => <section key={previous.id}><h3>{t('strategy.refresh.previous_evidence')}: {previous.title}</h3>{Array.isArray(previous.evidence) && previous.evidence.map((quote: any, index: number) => <blockquote key={index}>{quote.quote}</blockquote>)}{refresh?.baseRefreshId && <a href={`/strategy?refreshId=${encodeURIComponent(refresh.baseRefreshId)}`}>{t('strategy.refresh.open_baseline')}</a>}</section>)}{linkedTenant.map(item => <section key={item.id}><p>{item.module} · {displayLabel(item.authority)}</p><h3>{item.data.name || item.data.title || item.data.nameEn || item.id}</h3><p>{item.data.description}</p>{item.data.sourceId && <p>{item.data.sourceId} → {item.data.targetId} · {item.data.relationshipType}</p>}{item.data.finalScore !== undefined && <p>{t('strategy.refresh.published_maturity')}: {item.data.finalScore} · {item.data.validationNote}</p>}</section>)}</aside></div>}
    {publication && refresh && <StrategyPublicationDialog refreshId={refresh.id} finding={publication} onClose={() => setPublication(null)} onPublished={reload} />}
  </main>
}
