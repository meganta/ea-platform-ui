import { useCallback, useEffect, useMemo, useState } from 'react'

// BCM Phase 2.1 UI: industry-aware model suggestions, sources & methodology,
// reference-vs-tenant comparison, and the platform curation workspace.
// ArchMind suggests; architects decide. Nothing here adopts or publishes
// anything without an explicit human action.

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const BASE = `${API}/business-capabilities`
type LFn = (en: string, ar: string) => string

export async function bcm(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const m = data?.message
    throw new Error(typeof m === 'string' ? m : m?.message || (Array.isArray(m) ? m.join('; ') : `HTTP ${res.status}`))
  }
  return data
}

const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--navy-light)' }
const nm = (x: any, isAR: boolean) => (isAR && x?.nameAr) || x?.name

// ── Provenance is not status ───────────────────────────────────────────────
const PROV: Record<string, [string, string]> = {
  OFFICIAL_STANDARD: ['Official standard', 'معيار رسمي'], PUBLISHED_FRAMEWORK: ['Published framework', 'إطار منشور'], ARCHMIND_CURATED: ['ArchMind curated', 'منسّق من ArchMind'],
  AI_ASSISTED_DRAFT: ['AI-assisted draft', 'مسودة بمساعدة الذكاء الاصطناعي'], TENANT_PRIVATE: ['Your organization', 'جهتك'],
}
const STATUS_LBL: Record<string, [string, string]> = { DRAFT: ['Draft', 'مسودة'], IN_REVIEW: ['In review', 'قيد المراجعة'], APPROVED: ['Approved', 'معتمد'], PUBLISHED: ['Published', 'منشور'], RETIRED: ['Retired', 'متقاعد'] }
/** Always shows provenance and lifecycle status as two separate facts. Publishing never makes a curated model official. */
export function ProvenanceStatus({ provenance, status, L }: { provenance?: string; status?: string; L: LFn }) {
  return (
    <div data-testid="provenance-status" style={{ fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <span>{L('Provenance', 'المصدر')}: <strong>{provenance && PROV[provenance] ? L(PROV[provenance][0], PROV[provenance][1]) : provenance ?? '—'}</strong></span>
      <span>{L('Status', 'الحالة')}: <strong>{status && STATUS_LBL[status] ? L(STATUS_LBL[status][0], STATUS_LBL[status][1]) : status ?? '—'}</strong></span>
      {provenance === 'ARCHMIND_CURATED' && <span style={{ color: 'var(--text-dim)' }}>{L('Reviewed and approved by ArchMind for use - not an official industry standard.', 'مراجَع ومعتمد من ArchMind للاستخدام - وليس معياراً رسمياً للقطاع.')}</span>}
    </div>
  )
}

// ── Suggestions ────────────────────────────────────────────────────────────
const KIND: Record<string, [string, string]> = {
  OFFICIAL_REFERENCE: ['Official reference', 'مرجع رسمي'], INDUSTRY_MODEL: ['Industry model', 'نموذج قطاعي'],
  CROSS_INDUSTRY: ['Cross-industry', 'عابر للقطاعات'], ORGANIZATION_MODEL: ['Your organization', 'جهتك'],
}

export function ModelSuggestions({ L, onPick }: { L: LFn; onPick: (modelId: string) => void }) {
  const [data, setData] = useState<any>(null)
  useEffect(() => {
    bcm('GET', '/reference-recommendations')
      .then(d => setData({ recommendations: Array.isArray(d?.recommendations) ? d.recommendations : [], limitation: d?.limitation ?? null }))
      .catch(() => setData({ recommendations: [], limitation: null }))
  }, [])
  // Suggestions are an optional aid: never break the library when unavailable.
  if (!data || (!data.recommendations.length && !data.limitation)) return null
  return (
    <section aria-label={L('Suggested for your organization', 'مقترحة لجهتك')} style={{ ...card, marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{L('Suggested for your organization', 'مقترحة لجهتك')}</div>
      {data.limitation && <div data-testid="suggestion-limitation" style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>{data.limitation}</div>}
      {data.recommendations.map((r: any) => (
        <button key={r.modelId} onClick={() => onPick(r.modelId)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', width: '100%', textAlign: 'start', background: 'none', border: 'none', borderTop: '1px solid var(--border)', padding: '6px 0', cursor: 'pointer', color: 'var(--text)' }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
          <span className="badge badge-draft">{KIND[r.kind] ? L(KIND[r.kind][0], KIND[r.kind][1]) : r.kind}</span>
          {r.availability !== 'PUBLISHED' && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('content not yet available', 'المحتوى غير متاح بعد')}</span>}
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.reasons.join(' · ')}</span>
        </button>
      ))}
      {!!data.recommendations.length && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>{L('Suggestions only - nothing is added to your model until you review and adopt individual capabilities.', 'اقتراحات فقط - لا يُضاف شيء لنموذجك حتى تراجع القدرات وتعتمدها.')}</div>}
    </section>
  )
}

// ── Sources & methodology ──────────────────────────────────────────────────
export function ModelSources({ versionId, version, L }: { versionId: string; version?: any; L: LFn }) {
  const [sources, setSources] = useState<any[] | null>(null)
  useEffect(() => { bcm('GET', `/reference-versions/${versionId}/sources`).then(setSources).catch(() => setSources([])) }, [versionId])
  return (
    <div style={{ fontSize: 12, display: 'grid', gap: 10 }} data-testid="model-sources">
      {version && <ProvenanceStatus provenance={version.model?.provenance} status={version.status} L={L} />}
      {version?.methodology && <div><strong>{L('How this model was created', 'كيف أُعدّ هذا النموذج')}</strong><div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{version.methodology}</div></div>}
      {version?.assumptions && <div><strong>{L('Assumptions', 'الافتراضات')}</strong><div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{version.assumptions}</div></div>}
      <div>
        <strong>{L('Sources', 'المصادر')}</strong>
        {!sources ? <div>{L('Loading…', 'جارٍ التحميل…')}</div> : !Array.isArray(sources) || !sources.length ? <div style={{ color: 'var(--text-dim)' }}>{L('No structured sources recorded.', 'لا توجد مصادر مسجلة.')}</div> : sources.map(s => (
          <div key={s.id} style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
            <div><strong>{s.organization}</strong> - {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}</div>
            <div style={{ color: 'var(--text-dim)' }}>{[s.publicationInfo, s.provenanceType].filter(Boolean).join(' · ')}</div>
            {s.informedAreas?.length > 0 && <div style={{ color: 'var(--text-dim)' }}>{L('Informed', 'أسهم في')}: {s.informedAreas.join(', ')}</div>}
            {s.notes && <div style={{ color: 'var(--text-dim)' }}>{s.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Reference vs tenant comparison ─────────────────────────────────────────
const CLS: Record<string, [string, string, string]> = {
  MISSING: ['Missing in your model', 'غير موجودة في نموذجك', 'var(--warning)'],
  POSSIBLE_MATCH: ['Possible match', 'تطابق محتمل', 'var(--accent)'],
  EXISTING: ['Already in your model', 'موجودة في نموذجك', 'var(--success)'],
  POSSIBLE_DUPLICATE: ['Possible duplicate', 'تكرار محتمل', 'var(--danger)'],
  CUSTOM_TENANT_CAPABILITY: ['Only in your model', 'في نموذجك فقط', 'var(--text-dim)'],
}

export function ReferenceComparison({ versionId, L, isAR, onReview }: { versionId: string; L: LFn; isAR: boolean; onReview: (referenceItem: any) => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('MISSING')
  useEffect(() => { setData(null); bcm('GET', `/reference-versions/${versionId}/compare`).then(setData).catch(e => setError(e.message)) }, [versionId])
  if (error) return <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
  if (!data) return <div>{L('Comparing…', 'جارٍ المقارنة…')}</div>
  if (!Array.isArray(data.reference) || !Array.isArray(data.tenant)) return <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{L('Comparison is unavailable right now.', 'المقارنة غير متاحة حالياً.')}</div>
  const reload = () => bcm('GET', `/reference-versions/${versionId}/compare`).then(setData).catch(e => setError(e.message))
  const dispose = async (r: any, disposition: string) => {
    const rationale = window.prompt(L('Rationale (required)', 'المبرر (مطلوب)'))
    if (!rationale) return
    const body: any = { referenceVersionId: versionId, stableKey: r.reference.stableKey, disposition, rationale }
    if (disposition === 'DEFERRED') { const d = window.prompt(L('Review again on (YYYY-MM-DD)', 'المراجعة مجدداً في (YYYY-MM-DD)')); if (!d) return; body.deferUntil = d }
    if (disposition === 'ALREADY_COVERED') { const c = r.candidates?.[0]?.id ?? window.prompt(L('ID of the capability that covers it', 'معرّف القدرة التي تغطيها')); if (!c) return; body.coveredByAssetId = c }
    try { await bcm('POST', '/reference-gap-dispositions', body); await reload() } catch (e: any) { setError(e.message) }
  }
  const DISP: Record<string, [string, string]> = { NOT_APPLICABLE: ['Not applicable', 'غير منطبقة'], DEFERRED: ['Deferred', 'مؤجلة'], ALREADY_COVERED: ['Already covered', 'مغطاة مسبقاً'], RECOMMENDATION_REJECTED: ['Recommendation rejected', 'رُفضت التوصية'] }
  const refRows = data.reference.filter((r: any) => r.cls === filter)
  const tenantRows = data.tenant.filter((r: any) => r.cls === filter)
  return (
    <div>
      <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.keys(CLS).map(k => (
          <button key={k} role="tab" aria-selected={filter === k} className={`btn btn-sm ${filter === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(k)}>
            {L(CLS[k][0], CLS[k][1])} <span data-testid={`count-${k}`}>({data.summary[k] ?? 0})</span>
          </button>
        ))}
      </div>
      <ProvenanceStatus provenance={data.model?.provenance} status={data.version?.status} L={L} />
      {data.versionAwareness?.updateAvailable && <div role="status" data-testid="reference-update" style={{ fontSize: 12, margin: '6px 0', padding: 8, border: '1px solid var(--accent)', borderRadius: 6 }}>{L(`Reference model update: your mappings use ${data.versionAwareness.tenantVersion.version}; ${data.versionAwareness.latestVersion.version} is available. Nothing is migrated automatically.`, `تحديث للنموذج المرجعي: روابطك مبنية على ${data.versionAwareness.tenantVersion.version}، ويتوفر ${data.versionAwareness.latestVersion.version}. لا يُنقل شيء تلقائياً.`)}</div>}
      {data.versionAwareness?.updateAvailable && data.model?.id && <UpgradeReview modelId={data.model.id} L={L} />}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '6px 0 8px' }}>{L('Candidate differences only. A reference gap is not automatically a deficiency - you decide every mapping and disposition.', 'فروقات مرشحة فقط. الفجوة المرجعية ليست قصوراً بالضرورة - أنت من يقرر كل ربط وتصنيف.')} <span data-testid="unresolved-count">{L('Unresolved', 'غير محسومة')}: {data.summary.UNRESOLVED ?? '—'} · {L('Dispositioned', 'مصنّفة')}: {data.summary.DISPOSITIONED ?? '—'}</span></div>
      {refRows.map((r: any) => (
        <div key={r.reference.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderInlineStart: `3px solid ${CLS[r.cls][2]}`, paddingInlineStart: 8 }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13 }}>
            {nm(r.reference, isAR)} <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>L{r.reference.level}{r.reference.isCoreForIndustry ? ` · ${L('core for the industry', 'أساسية للقطاع')}` : ''}</span>
            {r.previouslyRejected && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Previously rejected', 'رُفضت سابقاً')}{r.rejectionRationale ? `: ${r.rejectionRationale}` : ''}</div>}
            {r.candidates?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Resembles', 'تشبه')}: {r.candidates.map((c: any) => c.name).join(', ')}</div>}
          </span>
          {r.disposition && <span data-testid={`disposition-${r.reference.stableKey}`} style={{ fontSize: 11 }}><span className="badge badge-draft">{DISP[r.disposition.disposition] ? L(DISP[r.disposition.disposition][0], DISP[r.disposition.disposition][1]) : r.disposition.disposition}</span>{r.disposition.stale ? ` ${L('- reference changed, review again', '- تغيّر المرجع، أعد المراجعة')}` : ''}</span>}
          {r.cls !== 'EXISTING' && <button className="btn btn-secondary btn-sm" onClick={() => onReview(r.reference)}>{L('Adopt / map', 'اعتماد / ربط')}</button>}
          {r.cls !== 'EXISTING' && (!r.resolved || r.disposition?.stale) && (
            <select aria-label={`${L('Disposition', 'التصنيف')} ${r.reference.name}`} className="form-input" style={{ width: 'auto', fontSize: 12 }} value="" onChange={e => e.target.value && dispose(r, e.target.value)}>
              <option value="">{L('Disposition…', 'تصنيف…')}</option>
              {Object.entries(DISP).map(([k, [en, ar]]) => <option key={k} value={k}>{L(en, ar)}</option>)}
            </select>
          )}
        </div>
      ))}
      {tenantRows.map((r: any) => (
        <div key={r.tenant.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0', fontSize: 13, borderInlineStart: `3px solid ${CLS[r.cls][2]}`, paddingInlineStart: 8 }}>
          {nm(r.tenant, isAR)} <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{r.reason}</div>
        </div>
      ))}
      {!refRows.length && !tenantRows.length && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{L('Nothing in this group.', 'لا شيء في هذه المجموعة.')}</div>}
    </div>
  )
}

// ── Platform curation workspace ────────────────────────────────────────────
const CUR: Record<string, [string, string]> = { PROPOSED: ['Proposed', 'مقترحة'], ACCEPTED: ['Accepted', 'مقبولة'], MODIFIED: ['Modified', 'معدّلة'], REJECTED: ['Rejected', 'مرفوضة'] }
const VST: Record<string, [string, string]> = { DRAFT: ['Draft', 'مسودة'], IN_REVIEW: ['In review', 'قيد المراجعة'], APPROVED: ['Approved', 'معتمد'], PUBLISHED: ['Published', 'منشور'], RETIRED: ['Retired', 'متقاعد'] }

export function CurationWorkspace({ L, isAR, userId }: { L: LFn; isAR: boolean; userId?: string }) {
  const [models, setModels] = useState<any[] | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [tree, setTree] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<any>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const loadModels = useCallback(() => bcm('GET', '/reference-models?applicable=false').then(ms => setModels(ms.filter((m: any) => m.isPlatform && m.provenance !== 'TENANT_PRIVATE'))).catch(e => setMsg({ kind: 'err', text: e.message })), [])
  useEffect(() => { loadModels() }, [loadModels])
  const load = useCallback(async (vid: string) => {
    const [t, s] = await Promise.all([bcm('GET', `/reference-versions/${vid}/tree`), bcm('GET', `/reference-versions/${vid}/curation`)])
    setTree(t); setSummary(s); setSelected(new Set())
  }, [])
  useEffect(() => { if (versionId) load(versionId).catch(e => setMsg({ kind: 'err', text: e.message })) }, [versionId, load])
  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true); setMsg(null)
    try { await fn(); if (versionId) await load(versionId); await loadModels(); if (ok) setMsg({ kind: 'ok', text: ok }) } catch (e: any) { setMsg({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }
  const flat = useMemo(() => { const out: any[] = []; const walk = (ns: any[]) => ns.forEach(n => { out.push(n.item); walk(n.children) }); walk(tree?.tree || []); return out }, [tree])
  const status = summary?.status
  const open = status === 'IN_REVIEW'
  const decide = (keys: string[], decision: 'ACCEPT' | 'REJECT', note?: string) => run(() => bcm('POST', `/reference-versions/${versionId}/curate`, { stableKeys: keys, decision, note }))

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <select aria-label={L('Reference model version', 'إصدار النموذج المرجعي')} className="form-input" style={{ width: 'auto' }} value={versionId ?? ''} onChange={e => setVersionId(e.target.value || null)}>
          <option value="">{L('— Select a version to curate —', '— اختر إصداراً للمراجعة —')}</option>
          {(models || []).flatMap(m => (m.versions || []).map((v: any) => <option key={v.id} value={v.id}>{m.name} · {v.version} · {VST[v.status] ? L(VST[v.status][0], VST[v.status][1]) : v.status}</option>))}
        </select>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => bcm('POST', '/reference-library/curated-drafts/import'), L('Curated drafts imported (or already present).', 'تم استيراد المسودات (أو كانت موجودة).'))}>{L('Import ArchMind curated drafts', 'استيراد مسودات ArchMind')}</button>
        <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => run(() => bcm('POST', '/reference-library/official-drafts/import'), L('NORA draft imported (or already present). Confirm its official source before publishing.', 'تم استيراد مسودة نورا (أو كانت موجودة). أكد المصدر الرسمي قبل النشر.'))}>{L('Import NORA draft', 'استيراد مسودة نورا')}</button>
      </div>
      {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 13, color: msg.kind === 'err' ? 'var(--danger)' : 'var(--success)', marginBottom: 8 }}>{msg.text}</div>}
      {summary && (
        <div style={{ ...card, marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
            <span className="badge badge-draft" data-testid="version-status">{VST[status] ? L(VST[status][0], VST[status][1]) : status}</span>
            {Object.entries(summary.counts || {}).map(([k, n]) => <span key={k}>{CUR[k] ? L(CUR[k][0], CUR[k][1]) : k}: <strong>{n as number}</strong></span>)}
          </div>
          {summary.blockers?.length > 0 && <ul data-testid="approval-blockers" style={{ fontSize: 12, color: 'var(--warning)', margin: '6px 0 0', paddingInlineStart: 18 }}>{summary.blockers.slice(0, 5).map((b: string) => <li key={b}>{b}</li>)}</ul>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {status === 'DRAFT' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(() => bcm('POST', `/reference-versions/${versionId}/submit-for-review`))}>{L('Submit for review', 'إرسال للمراجعة')}</button>}
            {open && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { const note = window.prompt(L('Reason for sending back', 'سبب الإعادة')); if (note) run(() => bcm('POST', `/reference-versions/${versionId}/send-back`, { note })) }}>{L('Send back to draft', 'إعادة إلى المسودة')}</button>}
            {open && (summary.submittedBy === userId
              ? <span data-testid="needs-other-reviewer" style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>{L('You submitted this version, so another platform reviewer must approve it.', 'أرسلت هذا الإصدار، لذا يجب أن يعتمده مراجع آخر.')}</span>
              : <button className="btn btn-primary btn-sm" disabled={busy || summary.blockers?.length > 0} onClick={() => run(() => bcm('POST', `/reference-versions/${versionId}/approve`, {}))}>{L('Approve', 'اعتماد')}</button>)}
            {status === 'APPROVED' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { if (window.confirm(L('Publishing makes this model visible to all matching organizations. Rejected capabilities are excluded. Continue?', 'النشر يجعل النموذج مرئياً للجهات المطابقة، مع استبعاد القدرات المرفوضة. متابعة؟'))) run(() => bcm('POST', `/reference-versions/${versionId}/publish`)) }}>{L('Publish', 'نشر')}</button>}
          </div>
        </div>
      )}
      {tree && versionId && <details style={{ ...card, marginBottom: 10 }}><summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{L('Sources & method', 'المصادر والمنهجية')}</summary><ModelSources versionId={versionId} version={tree.version} L={L} /></details>}
      {tree && versionId && ['DRAFT', 'IN_REVIEW', 'APPROVED'].includes(status) && <SourceConfirmation versionId={versionId} L={L} onSaved={() => load(versionId)} />}
      {open && selected.size > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12 }}>{selected.size} {L('selected', 'محدد')}</span>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide([...selected], 'ACCEPT')}>{L('Accept selected', 'قبول المحدد')}</button>
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { const note = window.prompt(L('Reason for rejecting', 'سبب الرفض')); if (note) decide([...selected], 'REJECT', note) }}>{L('Reject selected', 'رفض المحدد')}</button>
        </div>
      )}
      {flat.map(i => (
        <div key={i.stableKey} role="group" aria-label={nm(i, isAR)} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border)', padding: '6px 0', paddingInlineStart: (i.level - 1) * 18, opacity: i.curationStatus === 'REJECTED' ? 0.55 : 1 }}>
          {open && <input type="checkbox" aria-label={`${L('Select', 'تحديد')} ${i.name}`} checked={selected.has(i.stableKey)} onChange={() => setSelected(s => { const n = new Set(s); n.has(i.stableKey) ? n.delete(i.stableKey) : n.add(i.stableKey); return n })} />}
          <span style={{ flex: 1, minWidth: 220, fontSize: 13 }}>
            <strong>{nm(i, isAR)}</strong> <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{[i.classification, i.businessDomain, i.isCoreForIndustry ? L('core', 'أساسية') : null, i.metadata?.operatingModels?.join('/')].filter(Boolean).join(' · ')}</span>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{i.description}</div>
            {i.curationNote && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Note', 'ملاحظة')}: {i.curationNote}</div>}
            {i.originalSnapshot && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Originally proposed as', 'المقترح الأصلي')}: {i.originalSnapshot.name}</div>}
            {i.metadata?.englishNameProvenance === 'ARCHMIND_TRANSLATION' && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Official name', 'الاسم الرسمي')}: {i.metadata.officialName} · {L('English name is an ArchMind translation', 'الاسم الإنجليزي ترجمة من ArchMind')}</div>}
          </span>
          <span className="badge badge-draft">{CUR[i.curationStatus] ? L(CUR[i.curationStatus][0], CUR[i.curationStatus][1]) : i.curationStatus}</span>
          {open && <>
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => decide([i.stableKey], 'ACCEPT')}>{L('Accept', 'قبول')}</button>
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditing({ ...i, note: '' })}>{L('Modify', 'تعديل')}</button>
            <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { const note = window.prompt(L('Reason for rejecting', 'سبب الرفض')); if (note) decide([i.stableKey], 'REJECT', note) }}>{L('Reject', 'رفض')}</button>
          </>}
        </div>
      ))}
      {editing && (
        <div role="dialog" aria-label={L('Modify capability', 'تعديل القدرة')} style={{ ...card, position: 'fixed', insetInlineEnd: 16, bottom: 16, width: 380, maxWidth: 'calc(100vw - 32px)', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
          <strong style={{ fontSize: 13 }}>{L('Modify capability', 'تعديل القدرة')}</strong>
          {[['name', L('Name', 'الاسم')], ['nameAr', L('Arabic name', 'الاسم بالعربية')], ['description', L('Description', 'الوصف')]].map(([f, label]) => (
            <label key={f} className="form-group" style={{ display: 'block', marginTop: 6 }}><span className="form-label">{label}</span>
              <input className="form-input" value={editing[f] ?? ''} onChange={e => setEditing({ ...editing, [f]: e.target.value })} /></label>
          ))}
          <label className="form-group" style={{ display: 'block', marginTop: 6 }}><span className="form-label">{L('Why (required)', 'السبب (مطلوب)')}</span>
            <input className="form-input" value={editing.note} onChange={e => setEditing({ ...editing, note: e.target.value })} /></label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy || !editing.note.trim()} onClick={() => { const e = editing; setEditing(null); run(() => bcm('POST', `/reference-versions/${versionId}/curate`, { stableKeys: [e.stableKey], decision: 'MODIFY', note: e.note, edits: { name: e.name, nameAr: e.nameAr, description: e.description } })) }}>{L('Save modification', 'حفظ التعديل')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>{L('Cancel', 'إلغاء')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Phase 4: reference upgrade review (current vs latest) ─────────────────
const IMPACT: Record<string, [string, string]> = {
  DECISION_CARRIES_FORWARD: ['Your decision carries forward', 'قرارك ينتقل تلقائياً'], REVIEW_YOUR_DECISION: ['Changed - review your decision', 'تغيّرت - راجع قرارك'],
  REVIEW_OPTIONAL: ['Changed', 'تغيّرت'], IMPACT_REVIEW: ['Removed - review impact on your mapping', 'أُزيلت - راجع الأثر على ربطك'], CONSIDER_NEW_CAPABILITY: ['New - consider', 'جديدة - للدراسة'], NONE: ['No action', 'لا إجراء'],
}
export function UpgradeReview({ modelId, L }: { modelId: string; L: LFn }) {
  const [d, setD] = useState<any>(null)
  const [open, setOpen] = useState(false)
  const load = () => { setOpen(!open); if (!d) bcm('GET', `/reference-models/${modelId}/upgrade`).then(setD).catch(() => setD({ items: [] })) }
  return (
    <div style={{ margin: '6px 0' }}>
      <button className="btn btn-secondary btn-sm" onClick={load}>{open ? L('Hide update review', 'إخفاء مراجعة التحديث') : L('Review what changed', 'مراجعة ما تغيّر')}</button>
      {open && d && (
        <div data-testid="upgrade-review" style={{ ...card, marginTop: 6 }}>
          <div style={{ fontSize: 12 }}>{L('Current', 'الحالي')}: <strong>{d.tenantVersion?.version ?? '—'}</strong> · {L('Latest', 'الأحدث')}: <strong>{d.latestVersion?.version ?? '—'}</strong></div>
          <div style={{ fontSize: 12, margin: '4px 0' }}>{['UNCHANGED', 'MODIFIED', 'NEW', 'REMOVED'].map(k => `${k}: ${d.counts?.[k] ?? 0}`).join(' · ')}</div>
          {(d.items || []).filter((i: any) => i.changeClass !== 'UNCHANGED' || i.impact === 'DECISION_CARRIES_FORWARD').slice(0, 300).map((i: any) => (
            <div key={i.stableKey} style={{ fontSize: 12, borderTop: '1px solid var(--border)', padding: '3px 0' }}>
              <span className="badge badge-draft">{i.changeClass}</span> {i.name}{i.changedFields?.length ? ` (${i.changedFields.join(', ')})` : ''} - {IMPACT[i.impact] ? L(IMPACT[i.impact][0], IMPACT[i.impact][1]) : i.impact}
            </div>
          ))}
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{L('Comparison only. Your capabilities and mappings are never changed automatically.', 'مقارنة فقط. لا تتغير قدراتك أو روابطك تلقائياً.')}</div>
        </div>
      )}
    </div>
  )
}

// Official sources must be fully identified before publication (enforced by the API).
function SourceConfirmation({ versionId, L, onSaved }: { versionId: string; L: LFn; onSaved: () => void }) {
  const [sources, setSources] = useState<any[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { bcm('GET', `/reference-versions/${versionId}/sources`).then(r => setSources(Array.isArray(r) ? r : [])).catch(() => setSources([])) }, [versionId])
  const pending = sources.filter(s => s.provenanceType === 'OFFICIAL_STANDARD' && (!s.publicationInfo || /TO BE CONFIRMED/i.test(s.publicationInfo)))
  if (!pending.length) return null
  return (
    <div data-testid="source-confirmation" style={{ ...card, marginBottom: 10, borderColor: 'var(--warning)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{L('Official source not yet confirmed - publication is blocked', 'لم يتم تأكيد المصدر الرسمي - النشر موقوف')}</div>
      {pending.map(s => (
        <div key={s.id} style={{ fontSize: 12, marginTop: 6 }}>
          {s.title}
          <button className="btn btn-secondary btn-sm" style={{ marginInlineStart: 8 }} onClick={async () => {
            const title = window.prompt(L('Official document title', 'عنوان الوثيقة الرسمية'), s.title); if (!title) return
            const info = window.prompt(L('Version, publication date and page (e.g. "v2.0, 2023, p. 45")', 'الإصدار وتاريخ النشر والصفحة')); if (!info) return
            const url = window.prompt(L('Official URL (optional, https)', 'الرابط الرسمي (اختياري)')) || undefined
            try { await bcm('PUT', `/reference-versions/${versionId}/sources/${s.key}`, { title, publicationInfo: info, ...(url ? { url } : {}) }); setMsg(L('Source confirmed.', 'تم تأكيد المصدر.')); onSaved(); setSources(await bcm('GET', `/reference-versions/${versionId}/sources`)) } catch (e: any) { setMsg(e.message) }
          }}>{L('Confirm source', 'تأكيد المصدر')}</button>
        </div>
      ))}
      {msg && <div role="status" style={{ fontSize: 12, marginTop: 4 }}>{msg}</div>}
    </div>
  )
}
