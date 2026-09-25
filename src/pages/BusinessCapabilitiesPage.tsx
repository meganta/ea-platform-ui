import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'
import { AssessmentsPanel } from './bcm/Assessments'
import { ModelSuggestions, ModelSources, ReferenceComparison, CurationWorkspace } from './bcm/ReferenceModels'
import { ExecutiveInsights, CapabilityInsight, ImprovementActions, CapabilityAdvisor, ExecutiveOverview, TraceabilityPanel, InitiativeCoverage } from './bcm/Insights'

// Business Capabilities workspace - BCM Phase 1 foundation.
// Capability Map · Capabilities (hierarchy) · Reference Library ·
// Organization Context · Model Setup. Assessment/survey features are later
// phases and intentionally absent. Business wording only: no repository /
// database terminology is shown to users.

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const BASE = `${API}/business-capabilities`

async function call(method: string, path: string, body?: any) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const err: any = new Error((data && (data.message?.message || data.message)) || `HTTP ${res.status}`)
    err.status = res.status
    err.data = data?.message && typeof data.message === 'object' ? data.message : data
    throw err
  }
  return data
}

type Tab = 'overview' | 'map' | 'list' | 'assessments' | 'health' | 'improvement' | 'reference'
type Sub = 'actions' | 'advisor' | 'coverage' | 'library' | 'curation' | 'context' | 'setup'
// Phase 4 navigation: 7 primary sections. Legacy ?tab= values keep working (deep links / bookmarks).
const LEGACY: Record<string, [Tab, Sub?]> = {
  insights: ['health'], actions: ['improvement', 'actions'], advisor: ['improvement', 'advisor'], coverage: ['improvement', 'coverage'],
  library: ['reference', 'library'], curation: ['reference', 'curation'], context: ['reference', 'context'], setup: ['reference', 'setup'],
}
const TABS: Tab[] = ['overview', 'map', 'list', 'assessments', 'health', 'improvement', 'reference']

const CLASS_LABEL: Record<string, [string, string]> = {
  ADMINISTRATIVE: ['Administrative', 'إدارية'],
  CORE: ['Core', 'أساسية'],
  SUPPORTING: ['Supporting', 'مساندة'],
  SUPPORTING_OPERATIONAL: ['Supporting · Operational', 'مساندة · تشغيلية'],
  SUPPORTING_ENABLING: ['Supporting · Enabling', 'مساندة · تمكينية'],
}
const CLASS_COLOR: Record<string, string> = { ADMINISTRATIVE: '#7C3AED', CORE: '#0369A1', SUPPORTING: '#0F766E' }
export function classificationGroup(c?: string | null): 'ADMINISTRATIVE' | 'CORE' | 'SUPPORTING' | null {
  if (!c) return null
  if (c === 'ADMINISTRATIVE' || c === 'CORE') return c
  return 'SUPPORTING'
}

const PROVENANCE: Record<string, { en: string; ar: string; tipEn: string; tipAr: string; color: string }> = {
  OFFICIAL_STANDARD: { en: 'Official standard', ar: 'معيار رسمي', tipEn: 'Published by an official authority (e.g. DGA). Content is imported only from the authoritative source.', tipAr: 'صادر عن جهة رسمية (مثل هيئة الحكومة الرقمية). يُستورد المحتوى من المصدر الرسمي فقط.', color: '#16A34A' },
  PUBLISHED_FRAMEWORK: { en: 'Published framework', ar: 'إطار منشور', tipEn: 'From a recognized published industry framework.', tipAr: 'من إطار صناعي منشور ومعروف.', color: '#0369A1' },
  ARCHMIND_CURATED: { en: 'ArchMind curated', ar: 'منسّق من ArchMind', tipEn: 'Curated by ArchMind as a starting point. Not an official standard.', tipAr: 'نموذج مرجعي أعدّته ArchMind كنقطة انطلاق، وليس معياراً رسمياً.', color: '#B45309' },
  AI_ASSISTED_DRAFT: { en: 'AI-assisted draft', ar: 'مسودة بمساعدة الذكاء الاصطناعي', tipEn: 'Drafted with AI assistance. Requires expert review. Never an official standard.', tipAr: 'مسودة بمساعدة الذكاء الاصطناعي تتطلب مراجعة خبير، وليست معياراً رسمياً.', color: '#DC2626' },
  TENANT_PRIVATE: { en: 'Organization-defined', ar: 'معرّف من الجهة', tipEn: "Your organization's own reference model.", tipAr: 'نموذج مرجعي خاص بجهتكم.', color: '#64748B' },
}

export default function BusinessCapabilitiesPage() {
  const { hasPermission, user } = useAuth()
  const [insightCap, setInsightCap] = useState<string | null>(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('cap') : null))
  const { isAR } = useLang()
  const L = useCallback((en: string, ar: string) => (isAR ? ar : en), [isAR])
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const initial = (() => { const q = params.get('tab') || ''; if (TABS.includes(q as Tab)) return [q as Tab, (params.get('sub') as Sub) || undefined] as [Tab, Sub?]; if (LEGACY[q]) return LEGACY[q]; if (params.get('cap')) return ['health'] as [Tab]; return ['map'] as [Tab] })()
  const [tab, setTab] = useState<Tab>(initial[0])
  const [sub, setSub] = useState<Sub | undefined>(initial[1])
  const [ctx, setCtx] = useState<any>(null)

  const can = {
    manage: hasPermission('BusinessCapability.Manage'),
    adopt: hasPermission('BusinessCapability.AdoptReference'),
    org: hasPermission('BusinessCapability.ManageOrgContext'),
    pack: hasPermission('BusinessCapability.ManageAttributePack'),
    assess: hasPermission('BusinessCapability.Assess'),
    validate: hasPermission('BusinessCapability.ValidateAssessment'),
    approve: hasPermission('BusinessCapability.ApproveAssessment'),
    publish: hasPermission('BusinessCapability.PublishAssessment'),
    respond: hasPermission('Surveys.Respond'),
    manageActions: hasPermission('BusinessCapability.ManageImprovementActions'),
    approveActions: hasPermission('BusinessCapability.ApproveImprovementActions'),
    linkInitiatives: hasPermission('BusinessCapability.LinkInitiatives'),
    useAdvisor: hasPermission('BusinessCapability.UseAdvisor'),
    decideRecs: hasPermission('BusinessCapability.DecideRecommendations'),
  }

  const loadCtx = useCallback(() => { call('GET', '/organization-context').then(setCtx).catch(() => setCtx(null)) }, [])
  useEffect(() => { loadCtx() }, [loadCtx])

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: 'overview', label: L('Overview', 'نظرة عامة'), show: true },
    { id: 'map', label: L('Capability Map', 'خريطة القدرات'), show: true },
    { id: 'list', label: L('Capabilities', 'القدرات'), show: true },
    { id: 'assessments', label: L('Assessments', 'التقييمات'), show: true },
    { id: 'health', label: L('Health & Gaps', 'السلامة والفجوات'), show: true },
    { id: 'improvement', label: L('Improvement', 'التحسين'), show: true },
    { id: 'reference', label: L('Reference Models', 'النماذج المرجعية'), show: true },
  ]
  const subTabs: Record<string, Array<{ id: Sub; label: string; show: boolean }>> = {
    improvement: [
      { id: 'actions', label: L('Improvement actions', 'إجراءات التحسين'), show: true },
      { id: 'advisor', label: L('Advisor', 'المستشار'), show: true },
      { id: 'coverage', label: L('Initiative coverage', 'تغطية المبادرات'), show: true },
    ],
    reference: [
      { id: 'library', label: L('Reference Library', 'المكتبة المرجعية'), show: true },
      { id: 'curation', label: L('Model curation', 'مراجعة النماذج'), show: !!user?.isPlatformAdmin },
      { id: 'context', label: L('Organization Context', 'سياق الجهة'), show: true },
      { id: 'setup', label: L('Model Setup', 'إعداد النموذج'), show: can.pack },
    ],
  }
  const activeSub: Sub | undefined = subTabs[tab] ? (subTabs[tab].find(x => x.id === sub && x.show)?.id ?? subTabs[tab][0].id) : undefined
  const openCapability = (id: string) => { setTab('health'); setInsightCap(id) }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('Business Capabilities', 'قدرات الأعمال')}</div>
        <div className="page-subtitle">{L('What your organization does, independent of how it is organized or delivered', 'ما تقوم به الجهة بمعزل عن هيكلها التنظيمي أو طريقة التنفيذ')}</div>
        {can.respond && <a href="/my-surveys" style={{ fontSize: 12, color: 'var(--accent)' }}>{L('My Surveys', 'استبياناتي')} →</a>}
        {ctx && ctx.classificationStatus !== 'CONFIRMED' && (
          <div role="status" data-testid="classification-banner" style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)', fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>
              {ctx.classificationStatus === 'NEEDS_ADMIN_CONFIRMATION'
                ? L('Your organization type and industry need confirmation. Reference models are shown unfiltered until then.', 'يلزم تأكيد نوع الجهة والقطاع. تُعرض النماذج المرجعية دون تصفية حتى يتم التأكيد.')
                : L('Your organization type and industry are not set yet.', 'لم يتم تحديد نوع الجهة والقطاع بعد.')}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={() => { setTab('reference'); setSub('context') }}>{L('Review', 'مراجعة')}</button>
          </div>
        )}
        <div className="page-tabs" role="tablist" style={{ overflowX: 'auto' }}>
          {tabs.filter(t => t.show).map(t => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => { setTab(t.id); if (t.id !== 'health') setInsightCap(null) }}>{t.label}</button>
          ))}
        </div>
        {activeSub && (
          <div role="tablist" aria-label={L('Sections', 'الأقسام')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {subTabs[tab].filter(x => x.show).map(x => <button key={x.id} role="tab" aria-selected={activeSub === x.id} className={`btn btn-sm ${activeSub === x.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSub(x.id)}>{x.label}</button>)}
          </div>
        )}
      </div>
      <div className="page-body">
        {tab === 'map' && <CapabilityMap L={L} isAR={isAR} />}
        {tab === 'overview' && <ExecutiveOverview L={L} onOpenCapability={openCapability} />}
        {tab === 'health' && (insightCap ? <CapabilityInsight id={insightCap} L={L} isAR={isAR} onClose={() => setInsightCap(null)} /> : <><ExecutiveInsights L={L} onOpenCapability={setInsightCap} /><TraceabilityPanel L={L} onOpenCapability={setInsightCap} /></>)}
        {tab === 'improvement' && activeSub === 'actions' && <ImprovementActions L={L} can={{ manage: can.manageActions, approve: can.approveActions, link: can.linkInitiatives }} userId={user?.userId} />}
        {tab === 'improvement' && activeSub === 'advisor' && <CapabilityAdvisor L={L} can={{ run: can.useAdvisor, decide: can.decideRecs }} />}
        {tab === 'improvement' && activeSub === 'coverage' && <InitiativeCoverage L={L} />}
        {tab === 'list' && <CapabilityList L={L} isAR={isAR} canManage={can.manage} />}
        {tab === 'assessments' && <AssessmentsPanel L={L} isAR={isAR} can={{ assess: can.assess, validate: can.validate, approve: can.approve, publish: can.publish }} />}
        {tab === 'reference' && activeSub === 'library' && <ReferenceLibrary L={L} isAR={isAR} canAdopt={can.adopt} />}
        {tab === 'reference' && activeSub === 'curation' && user?.isPlatformAdmin && <CurationWorkspace L={L} isAR={isAR} userId={user?.userId} />}
        {tab === 'reference' && activeSub === 'context' && <OrganizationContext L={L} isAR={isAR} ctx={ctx} canEdit={can.org} onSaved={loadCtx} />}
        {tab === 'reference' && activeSub === 'setup' && can.pack && <ModelSetup L={L} isAR={isAR} />}
      </div>
    </div>
  )
}

type LFn = (en: string, ar: string) => string
const nameOf = (x: any, isAR: boolean) => (isAR && x?.nameAr) || x?.name || ''

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null
  return <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '8px 0' }}>{error}</div>
}

function ClassBadge({ c, L }: { c?: string | null; L: LFn }) {
  if (!c || !CLASS_LABEL[c]) return <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
  const g = classificationGroup(c) as string
  return <span className="badge" style={{ background: `${CLASS_COLOR[g]}14`, color: CLASS_COLOR[g], border: `1px solid ${CLASS_COLOR[g]}40` }}>{L(CLASS_LABEL[c][0], CLASS_LABEL[c][1])}</span>
}

function ProvenanceBadge({ p, L }: { p: string; L: LFn }) {
  const d = PROVENANCE[p]
  if (!d) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span className="badge" style={{ background: `${d.color}14`, color: d.color, border: `1px solid ${d.color}40` }}>{L(d.en, d.ar)}</span>
      <HelpTip text={L(d.tipEn, d.tipAr)} />
    </span>
  )
}

// ── Capability Map ─────────────────────────────────────────────────────────
function CapabilityMap({ L, isAR }: { L: LFn; isAR: boolean }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('ALL')
  useEffect(() => { call('GET', '/capabilities/tree').then(setData).catch(e => setError(e.message)) }, [])
  if (error) return <ErrorLine error={error} />
  if (!data) return <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div>
  if (!data.total) return <EmptyState L={L} />
  const roots = data.roots.filter((r: any) => filter === 'ALL' || classificationGroup(r.asset.attributes?.bcmClassification) === filter)
  const countDesc = (n: any): number => n.children.reduce((s: number, c: any) => s + 1 + countDesc(c), 0)
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Show', 'عرض')}:</span>
        {['ALL', 'ADMINISTRATIVE', 'CORE', 'SUPPORTING'].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
            {f === 'ALL' ? L('All', 'الكل') : L(CLASS_LABEL[f][0], CLASS_LABEL[f][1])}
          </button>
        ))}
        <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--text-dim)' }}>{data.total} {L('capabilities', 'قدرة')}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {roots.map((r: any) => {
          const g = classificationGroup(r.asset.attributes?.bcmClassification)
          return (
            <section key={r.asset.id} aria-label={nameOf(r.asset, isAR)} style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--navy-light)', borderTop: `3px solid ${g ? CLASS_COLOR[g] : 'var(--border)'}` }}>
              <div style={{ padding: '10px 12px', fontWeight: 600, fontSize: 13 }}>{nameOf(r.asset, isAR)}</div>
              <div style={{ padding: '0 8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {r.children.map((c: any) => (
                  <div key={c.asset.id} style={{ fontSize: 12, padding: '5px 8px', borderRadius: 4, background: 'var(--navy-mid)', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    <span>{nameOf(c.asset, isAR)}</span>
                    {c.children.length > 0 && <span style={{ color: 'var(--text-dim)' }}>+{countDesc(c)}</span>}
                  </div>
                ))}
                {!r.children.length && <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '0 4px' }}>{L('No sub-capabilities', 'لا توجد قدرات فرعية')}</div>}
              </div>
            </section>
          )
        })}
      </div>
      {(data.orphanIds.length > 0 || data.cycleIds.length > 0) && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--warning)' }}>
          {L(`${data.orphanIds.length + data.cycleIds.length} capabilities have a missing or looping parent and are shown at the top level.`, `${data.orphanIds.length + data.cycleIds.length} قدرات لها أصل مفقود أو متكرر وتظهر في المستوى الأعلى.`)}
        </div>
      )}
    </div>
  )
}

function EmptyState({ L }: { L: LFn }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-dim)', border: '1px dashed var(--border)', borderRadius: 8 }}>
      <div style={{ fontSize: 15, color: 'var(--text)', marginBottom: 6 }}>{L('No business capabilities yet', 'لا توجد قدرات أعمال بعد')}</div>
      <div style={{ fontSize: 13 }}>{L('Adopt capabilities from the Reference Library, or add your own under Capabilities.', 'اعتمد قدرات من المكتبة المرجعية، أو أضف قدراتك في تبويب القدرات.')}</div>
    </div>
  )
}

// ── Capability list / hierarchy ────────────────────────────────────────────
function CapabilityList({ L, isAR, canManage }: { L: LFn; isAR: boolean; canManage: boolean }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<any>(null)
  const [adding, setAdding] = useState(false)
  const [dupes, setDupes] = useState<any[] | null>(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => { call('GET', '/capabilities/tree').then(setData).catch(e => setError(e.message)) }, [])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    if (!data) return []
    const out: any[] = []
    const q = search.trim().toLowerCase()
    const walk = (nodes: any[], depth: number) => nodes.forEach(n => {
      const match = !q || [n.asset.name, n.asset.nameAr].some((s: string) => s && s.toLowerCase().includes(q))
      if (match) out.push({ ...n, depth })
      if (q || !collapsed.has(n.asset.id)) walk(n.children, q ? depth : depth + 1)
    })
    walk(data.roots, 0)
    return out
  }, [data, collapsed, search])

  const open = async (id: string) => {
    try { setSelected(await call('GET', `/capabilities/${id}`)) } catch (e: any) { setError(e.message) }
  }

  if (error && !data) return <ErrorLine error={error} />
  if (!data) return <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div>

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 480px', minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="form-input" style={{ maxWidth: 260 }} placeholder={L('Search capabilities', 'بحث في القدرات')} value={search} onChange={e => setSearch(e.target.value)} aria-label={L('Search capabilities', 'بحث في القدرات')} />
          {canManage && <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ {L('Add capability', 'إضافة قدرة')}</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => call('GET', '/capabilities/duplicates').then(setDupes).catch(e => setError(e.message))}>{L('Check for possible duplicates', 'فحص التكرارات المحتملة')}</button>
        </div>
        <ErrorLine error={error} />
        {dupes && <DuplicatePairs pairs={dupes} L={L} isAR={isAR} onClose={() => setDupes(null)} />}
        {adding && <AddCapabilityForm L={L} isAR={isAR} parents={data.roots} onDone={(ok) => { setAdding(false); if (ok) load() }} />}
        {!data.total ? <EmptyState L={L} /> : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--navy-mid)', textAlign: 'start' }}>
                  <th style={th}>{L('Capability', 'القدرة')}</th>
                  <th style={th}>{L('Classification', 'التصنيف')}</th>
                  <th style={th}>{L('Owner', 'المالك')}</th>
                  <th style={th}>{L('Status', 'الحالة')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.asset.id} onClick={() => open(r.asset.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer', background: selected?.id === r.asset.id ? 'rgba(3,105,161,0.06)' : undefined }}>
                    <td style={{ ...td, paddingInlineStart: 10 + r.depth * 18 }}>
                      {r.children.length > 0 && !search && (
                        <button aria-label={collapsed.has(r.asset.id) ? L('Expand', 'توسيع') : L('Collapse', 'طي')} onClick={e => { e.stopPropagation(); setCollapsed(s => { const n = new Set(s); n.has(r.asset.id) ? n.delete(r.asset.id) : n.add(r.asset.id); return n }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', width: 16 }}>{collapsed.has(r.asset.id) ? (isAR ? '◂' : '▸') : '▾'}</button>
                      )}
                      {nameOf(r.asset, isAR)}
                      {r.asset.source === 'REFERENCE_MODEL' && <span title={L('Adopted from a reference model', 'معتمدة من نموذج مرجعي')} style={{ marginInlineStart: 6, color: 'var(--text-dim)', fontSize: 11 }}>↳ {L('reference', 'مرجعي')}</span>}
                    </td>
                    <td style={td}><ClassBadge c={r.asset.attributes?.bcmClassification} L={L} /></td>
                    <td style={td}>{r.asset.owner || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td style={td}><span className={`badge ${r.asset.status === 'APPROVED' ? 'badge-approved' : r.asset.status === 'UNDER_REVIEW' ? 'badge-review' : 'badge-draft'}`}>{statusLabel(r.asset.status, L)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {selected && <CapabilityDetail cap={selected} L={L} isAR={isAR} canManage={canManage} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); load() }} />}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textAlign: 'start' }
const td: React.CSSProperties = { padding: '8px 10px', verticalAlign: 'middle' }

function statusLabel(s: string, L: LFn) {
  const m: Record<string, [string, string]> = { DRAFT: ['Draft', 'مسودة'], UNDER_REVIEW: ['In review', 'قيد المراجعة'], APPROVED: ['Approved', 'معتمدة'], DEPRECATED: ['Archived', 'مؤرشفة'] }
  return m[s] ? L(m[s][0], m[s][1]) : s
}

function DuplicatePairs({ pairs, L, isAR, onClose }: { pairs: any[]; L: LFn; isAR: boolean; onClose: () => void }) {
  return (
    <div style={{ border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.05)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>{L('Possible duplicates', 'تكرارات محتملة')} ({pairs.length}) <HelpTip text={L('Similar names only suggest a possible duplicate. Review each pair - nothing is merged automatically.', 'تشابه الأسماء يشير فقط إلى تكرار محتمل. راجع كل زوج - لا يتم الدمج تلقائياً.')} /></strong>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>{L('Close', 'إغلاق')}</button>
      </div>
      {!pairs.length && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{L('No possible duplicates found.', 'لم يتم العثور على تكرارات محتملة.')}</div>}
      {pairs.slice(0, 50).map((p, i) => (
        <div key={i} style={{ fontSize: 13, padding: '4px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>{nameOf(p.a, isAR)}</span><span style={{ color: 'var(--text-dim)' }}>≈</span><span>{nameOf(p.b, isAR)}</span>
          <span className={`badge ${p.strength === 'HIGH' ? 'badge-review' : 'badge-draft'}`}>{p.strength === 'HIGH' ? L('Likely', 'مرجح') : L('Possible', 'محتمل')}</span>
        </div>
      ))}
    </div>
  )
}

function AddCapabilityForm({ L, isAR, parents, onDone }: { L: LFn; isAR: boolean; parents: any[]; onDone: (ok: boolean) => void }) {
  const [form, setForm] = useState<any>({ name: '', nameAr: '', description: '', parentId: '' })
  const [dupes, setDupes] = useState<any[] | null>(null)
  const [ack, setAck] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const flat = useMemo(() => {
    const out: any[] = []
    const walk = (ns: any[], d: number) => ns.forEach(n => { out.push({ id: n.asset.id, label: `${'— '.repeat(d)}${nameOf(n.asset, isAR)}` }); walk(n.children, d + 1) })
    walk(parents, 0)
    return out
  }, [parents, isAR])

  const submit = async () => {
    setError(null)
    if (!form.name.trim()) { setError(L('Name is required', 'الاسم مطلوب')); return }
    setBusy(true)
    try {
      if (dupes === null) {
        const d = await call('POST', '/capabilities/duplicates/check', { name: form.name, nameAr: form.nameAr || undefined })
        if (d.length) { setDupes(d); setBusy(false); return }
      } else if (dupes.length && !ack) { setBusy(false); return }
      await call('POST', '/capabilities', { name: form.name.trim(), nameAr: form.nameAr || undefined, description: form.description || undefined, parentId: form.parentId || undefined })
      onDone(true)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-title" style={{ marginBottom: 10 }}>{L('New capability', 'قدرة جديدة')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        <label className="form-group"><span className="form-label">{L('Name (English)', 'الاسم (إنجليزي)')}</span><input className="form-input" value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setDupes(null); setAck(false) }} /></label>
        <label className="form-group"><span className="form-label">{L('Name (Arabic)', 'الاسم (عربي)')}</span><input className="form-input" dir="rtl" value={form.nameAr} onChange={e => { setForm({ ...form, nameAr: e.target.value }); setDupes(null); setAck(false) }} /></label>
        <label className="form-group"><span className="form-label">{L('Parent capability', 'القدرة الأم')}</span>
          <select className="form-input" value={form.parentId} onChange={e => setForm({ ...form, parentId: e.target.value })}>
            <option value="">{L('— Top level —', '— المستوى الأعلى —')}</option>
            {flat.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      </div>
      <label className="form-group" style={{ display: 'block' }}><span className="form-label">{L('Description', 'الوصف')}</span><textarea className="form-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      {dupes && dupes.length > 0 && (
        <div data-testid="duplicate-warning" style={{ border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.05)', borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 13 }}>
          <div style={{ marginBottom: 6 }}>{L('Possible duplicates already exist:', 'توجد قدرات مشابهة قد تكون مكررة:')}</div>
          {dupes.map(d => <div key={d.assetId}>• {nameOf(d, isAR)} <span style={{ color: 'var(--text-dim)' }}>({d.strength === 'HIGH' ? L('likely', 'مرجح') : L('possible', 'محتمل')})</span></div>)}
          <label style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />{L('This is a distinct capability', 'هذه قدرة مختلفة')}</label>
        </div>
      )}
      <ErrorLine error={error} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-sm" disabled={busy || (!!dupes?.length && !ack)} onClick={submit}>{L('Save', 'حفظ')}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onDone(false)}>{L('Cancel', 'إلغاء')}</button>
      </div>
    </div>
  )
}

function CapabilityDetail({ cap, L, isAR, canManage, onClose, onChanged }: { cap: any; L: LFn; isAR: boolean; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const a = cap.attributes || {}
  const prov = cap.provenance?.[0]
  const archive = async () => {
    if (!window.confirm(L('Archive this capability?', 'أرشفة هذه القدرة؟'))) return
    try { await call('POST', `/capabilities/${cap.id}/archive`); onChanged() } catch (e: any) { setError(e.message) }
  }
  const health: Array<[string, string, string]> = [
    ['bcmStrategicImportance', 'Strategic importance', 'الأهمية الاستراتيجية'],
    ['bcmBusinessCriticality', 'Business criticality', 'الأهمية التشغيلية'],
    ['bcmCurrentMaturity', 'Current maturity', 'النضج الحالي'],
    ['bcmTargetMaturity', 'Target maturity', 'النضج المستهدف'],
    ['bcmPerformance', 'Performance', 'الأداء'],
    ['bcmArchitectureHealth', 'Architecture health', 'سلامة البنية'],
    ['bcmRiskExposure', 'Risk exposure', 'التعرض للمخاطر'],
  ]
  return (
    <aside aria-label={L('Capability details', 'تفاصيل القدرة')} style={{ flex: '0 1 340px', minWidth: 280, border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--navy-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>{nameOf(cap, isAR)}</div>
        <button className="btn btn-secondary btn-sm" onClick={onClose} aria-label={L('Close', 'إغلاق')}>✕</button>
      </div>
      {cap.description && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{isAR && cap.descriptionAr ? cap.descriptionAr : cap.description}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 12px', fontSize: 12, margin: '10px 0' }}>
        <span style={{ color: 'var(--text-dim)' }}>{L('Classification', 'التصنيف')}</span><ClassBadge c={a.bcmClassification} L={L} />
        <span style={{ color: 'var(--text-dim)' }}>{L('Owner', 'المالك')}</span><span>{cap.owner || '—'}</span>
        <span style={{ color: 'var(--text-dim)' }}>{L('Sub-capabilities', 'القدرات الفرعية')}</span><span>{cap.children?.length ?? 0}</span>
      </div>
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{L('Capability health', 'سلامة القدرة')}</summary>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', margin: '6px 0' }}>{L('Maturity is one health perspective. Most values are set by later assessments.', 'النضج أحد أبعاد سلامة القدرة. تُحدَّد معظم القيم عبر التقييمات لاحقاً.')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 12 }}>
          {health.map(([k, en, ar]) => <FragmentRow key={k} label={L(en, ar)} value={a[k]} />)}
        </div>
      </details>
      {prov && (
        <details style={{ marginTop: 10 }} open>
          <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{L('Reference source', 'المصدر المرجعي')}</summary>
          <div style={{ fontSize: 12, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div>{prov.model?.name} · {L('version', 'الإصدار')} {prov.version?.version} {prov.model?.provenance && <ProvenanceBadge p={prov.model.provenance} L={L} />}</div>
            <div style={{ color: 'var(--text-dim)' }}>{decisionLabel(prov.decision, L)}</div>
            {prov.modifiedFields?.length > 0 && (
              <div data-testid="reference-vs-adopted" style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                {prov.modifiedFields.map((f: string) => (
                  <div key={f}><span style={{ color: 'var(--text-dim)' }}>{L('Reference', 'المرجع')}:</span> {String(prov.referenceValue?.[f] ?? '—')} → <strong>{String(prov.adoptedValue?.[f] ?? '—')}</strong></div>
                ))}
              </div>
            )}
          </div>
        </details>
      )}
      <ErrorLine error={error} />
      {canManage && cap.status !== 'DEPRECATED' && <button className="btn btn-secondary btn-sm" style={{ marginTop: 12 }} onClick={archive}>{L('Archive', 'أرشفة')}</button>}
    </aside>
  )
}

function FragmentRow({ label, value }: { label: string; value: any }) {
  return (<><span style={{ color: 'var(--text-dim)' }}>{label}</span><span>{value === null || value === undefined || value === '' ? '—' : String(value)}</span></>)
}

function decisionLabel(d: string, L: LFn) {
  const m: Record<string, [string, string]> = {
    ADOPTED_AS_IS: ['Adopted as published', 'معتمدة كما هي'],
    ADOPTED_MODIFIED: ['Adopted with changes', 'معتمدة مع تعديلات'],
    MAPPED_TO_EXISTING: ['Mapped to an existing capability', 'مربوطة بقدرة قائمة'],
    REJECTED: ['Not adopted', 'غير معتمدة'],
  }
  return m[d] ? L(m[d][0], m[d][1]) : d
}

// ── Reference Library ──────────────────────────────────────────────────────
function ReferenceLibrary({ L, isAR, canAdopt }: { L: LFn; isAR: boolean; canAdopt: boolean }) {
  const [models, setModels] = useState<any[] | null>(null)
  const [onlyApplicable, setOnlyApplicable] = useState(true)
  const [modelId, setModelId] = useState<string | null>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [tree, setTree] = useState<any>(null)
  const [decisions, setDecisions] = useState<any[]>([])
  const [item, setItem] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'tree' | 'compare' | 'sources'>('tree')

  useEffect(() => { call('GET', `/reference-models?applicable=${onlyApplicable}`).then((ms: any) => setModels(Array.isArray(ms) ? ms : [])).catch(e => setError(e.message)) }, [onlyApplicable])
  const model = models?.find(m => m.id === modelId)
  const publishedVersions = (model?.versions || []).filter((v: any) => v.status === 'PUBLISHED')

  useEffect(() => { setVersionId(publishedVersions[0]?.id ?? null); setTree(null); setItem(null) }, [modelId]) // eslint-disable-line react-hooks/exhaustive-deps
  const loadDecisions = useCallback(() => { if (modelId) call('GET', `/adoption/decisions?referenceModelId=${modelId}`).then(setDecisions).catch(() => setDecisions([])) }, [modelId])
  useEffect(() => { if (versionId) call('GET', `/reference-versions/${versionId}/tree`).then(setTree).catch(e => setError(e.message)); loadDecisions() }, [versionId, loadDecisions])

  const decisionFor = (key: string) => decisions.find(d => d.stableKey === key)

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '0 1 300px', minWidth: 240 }}>
        <ModelSuggestions L={L} onPick={(id) => { setModelId(id); setView('tree') }} />
        <label style={{ display: 'flex', gap: 6, fontSize: 12, alignItems: 'center', marginBottom: 8 }}>
          <input type="checkbox" checked={onlyApplicable} onChange={e => setOnlyApplicable(e.target.checked)} />
          {L('Only models relevant to my organization', 'النماذج ذات الصلة بجهتي فقط')}
        </label>
        <ErrorLine error={error} />
        {!models ? <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div> : !models.length ? (
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{L('No reference models available.', 'لا توجد نماذج مرجعية متاحة.')}</div>
        ) : (
          <div role="listbox" aria-label={L('Reference models', 'النماذج المرجعية')} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {models.map(m => {
              const pub = (m.versions || []).filter((v: any) => v.status === 'PUBLISHED').length
              return (
                <button key={m.id} role="option" aria-selected={m.id === modelId} onClick={() => setModelId(m.id)} style={{ display: 'block', width: '100%', textAlign: 'start', padding: '10px 12px', border: 'none', borderBottom: '1px solid var(--border)', background: m.id === modelId ? 'rgba(3,105,161,0.06)' : 'var(--navy-light)', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{nameOf(m, isAR)}</div>
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: 'var(--text-dim)' }}>
                    <ProvenanceBadge p={m.provenance} L={L} />
                    {pub ? `${pub} ${L('published version(s)', 'إصدار منشور')}` : L('Content not yet available', 'المحتوى غير متاح بعد')}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ flex: '1 1 420px', minWidth: 0 }}>
        {!model ? <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{L('Select a reference model to browse its capabilities.', 'اختر نموذجاً مرجعياً لاستعراض قدراته.')}</div> : (
          <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{nameOf(model, isAR)}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{isAR && model.descriptionAr ? model.descriptionAr : model.description}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{[model.publisher, model.jurisdiction, model.sourceReference].filter(Boolean).join(' · ')}</div>
            </div>
            {!publishedVersions.length ? (
              <div data-testid="no-published-content" style={{ padding: 16, border: '1px dashed var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-dim)' }}>
                {model.provenance === 'OFFICIAL_STANDARD'
                  ? L('This official model will be available once its content is imported from the authoritative source. No capabilities are shown until then.', 'سيتاح هذا النموذج الرسمي بعد استيراد محتواه من المصدر الرسمي. لا تُعرض أي قدرات قبل ذلك.')
                  : L('No published version yet.', 'لا يوجد إصدار منشور بعد.')}
              </div>
            ) : (
              <>
                <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  {L('Version', 'الإصدار')}
                  <select className="form-input" style={{ width: 'auto', padding: '4px 8px' }} value={versionId ?? ''} onChange={e => setVersionId(e.target.value)}>
                    {publishedVersions.map((v: any) => <option key={v.id} value={v.id}>{v.version}</option>)}
                  </select>
                </label>
                <div role="tablist" aria-label={L('Model views', 'طرق العرض')} style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  {([['tree', L('Capabilities', 'القدرات')], ['compare', L('Compare with our model', 'مقارنة بنموذجنا')], ['sources', L('Sources & method', 'المصادر والمنهجية')]] as const).map(([k, label]) => (
                    <button key={k} role="tab" aria-selected={view === k} className={`btn btn-sm ${view === k ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setView(k)}>{label}</button>
                  ))}
                </div>
                {view === 'tree' && tree && <RefTree nodes={tree.tree} L={L} isAR={isAR} decisionFor={decisionFor} onSelect={setItem} selectedId={item?.id} />}
                {view === 'compare' && versionId && <ReferenceComparison versionId={versionId} L={L} isAR={isAR} onReview={setItem} />}
                {view === 'sources' && versionId && <ModelSources versionId={versionId} version={tree?.version} L={L} />}
              </>
            )}
          </>
        )}
      </div>
      {item && <AdoptionPanel item={item} L={L} isAR={isAR} canAdopt={canAdopt} current={decisionFor(item.stableKey)} onClose={() => setItem(null)} onDecided={() => { loadDecisions(); setItem(null) }} />}
    </div>
  )
}

function RefTree({ nodes, L, isAR, decisionFor, onSelect, selectedId, depth = 0 }: { nodes: any[]; L: LFn; isAR: boolean; decisionFor: (k: string) => any; onSelect: (i: any) => void; selectedId?: string; depth?: number }) {
  return (
    <div role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map(n => {
        const d = decisionFor(n.item.stableKey)
        return (
          <div key={n.item.id} role="treeitem" aria-selected={selectedId === n.item.id}>
            <button onClick={() => onSelect(n.item)} style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'center', textAlign: 'start', padding: '6px 8px', paddingInlineStart: 8 + depth * 18, border: 'none', borderBottom: '1px solid var(--border)', background: selectedId === n.item.id ? 'rgba(3,105,161,0.06)' : 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
              <span style={{ flex: 1 }}>{nameOf(n.item, isAR)}</span>
              <ClassBadge c={n.item.classification} L={L} />
              {n.item.effectiveProvenance && n.item.provenance && <ProvenanceBadge p={n.item.effectiveProvenance} L={L} />}
              {d && <span className={`badge ${d.decision === 'REJECTED' ? 'badge-draft' : 'badge-approved'}`}>{decisionLabel(d.decision, L)}</span>}
            </button>
            {n.children.length > 0 && <RefTree nodes={n.children} L={L} isAR={isAR} decisionFor={decisionFor} onSelect={onSelect} selectedId={selectedId} depth={depth + 1} />}
          </div>
        )
      })}
    </div>
  )
}

function AdoptionPanel({ item, L, isAR, canAdopt, current, onClose, onDecided }: { item: any; L: LFn; isAR: boolean; canAdopt: boolean; current: any; onClose: () => void; onDecided: () => void }) {
  const [preview, setPreview] = useState<any>(null)
  const [mode, setMode] = useState<'ADOPT' | 'ADOPT_MODIFIED' | 'MAP_TO_EXISTING' | 'REJECT'>('ADOPT')
  const [mods, setMods] = useState<any>({ name: item.name, nameAr: item.nameAr || '' })
  const [target, setTarget] = useState('')
  const [ack, setAck] = useState(false)
  const [rationale, setRationale] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (canAdopt) call('POST', '/adoption/preview', { referenceCapabilityIds: [item.id] }).then(r => setPreview(r[0])).catch(e => setError(e.message)) }, [item.id, canAdopt])
  const dupes = preview?.possibleDuplicates || []
  const creates = mode === 'ADOPT' || mode === 'ADOPT_MODIFIED'

  const submit = async () => {
    setBusy(true); setError(null)
    try {
      const body: any = { referenceCapabilityId: item.id, action: mode, rationale: rationale || undefined }
      if (mode === 'ADOPT_MODIFIED') body.modifications = { name: mods.name, nameAr: mods.nameAr || undefined }
      if (mode === 'MAP_TO_EXISTING') body.targetAssetId = target
      if (creates && dupes.length) body.acknowledgeDuplicates = ack
      await call('POST', '/adoption/decisions', body)
      onDecided()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <aside aria-label={L('Adoption decision', 'قرار الاعتماد')} style={{ flex: '0 1 340px', minWidth: 280, border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--navy-light)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>{nameOf(item, isAR)}</div>
        <button className="btn btn-secondary btn-sm" onClick={onClose} aria-label={L('Close', 'إغلاق')}>✕</button>
      </div>
      {item.description && <p style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isAR && item.descriptionAr ? item.descriptionAr : item.description}</p>}
      {current && <div style={{ fontSize: 12, marginBottom: 8 }}>{L('Current decision', 'القرار الحالي')}: <strong>{decisionLabel(current.decision, L)}</strong></div>}
      {!canAdopt ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('You can browse but not adopt reference capabilities.', 'يمكنك الاستعراض دون صلاحية الاعتماد.')}</div> : (
        <>
          {preview?.parent && !preview.parent.adoptedAssetId && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 8 }}>{L('Its parent capability has not been adopted yet; it will be placed at the top level.', 'لم تُعتمد القدرة الأم بعد؛ ستوضع في المستوى الأعلى.')}</div>}
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <legend className="form-label">{L('Decision', 'القرار')}</legend>
            {([['ADOPT', 'Adopt as published', 'اعتماد كما هي'], ['ADOPT_MODIFIED', 'Adopt with changes', 'اعتماد مع تعديل'], ['MAP_TO_EXISTING', 'Same as an existing capability', 'مطابقة لقدرة قائمة'], ['REJECT', 'Not applicable to us', 'غير منطبقة علينا']] as const).map(([v, en, ar]) => (
              <label key={v} style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="radio" name="decision" checked={mode === v} onChange={() => setMode(v)} />{L(en, ar)}</label>
            ))}
          </fieldset>
          {mode === 'ADOPT_MODIFIED' && (
            <div>
              <label className="form-group" style={{ display: 'block' }}><span className="form-label">{L('Name (English)', 'الاسم (إنجليزي)')}</span><input className="form-input" value={mods.name} onChange={e => setMods({ ...mods, name: e.target.value })} /></label>
              <label className="form-group" style={{ display: 'block' }}><span className="form-label">{L('Name (Arabic)', 'الاسم (عربي)')}</span><input className="form-input" dir="rtl" value={mods.nameAr} onChange={e => setMods({ ...mods, nameAr: e.target.value })} /></label>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{L('The reference value is kept alongside your version for traceability.', 'تُحفظ القيمة المرجعية مع نسختكم لأغراض التتبع.')}</div>
            </div>
          )}
          {mode === 'MAP_TO_EXISTING' && (
            <label className="form-group" style={{ display: 'block' }}><span className="form-label">{L('Existing capability', 'القدرة القائمة')}</span>
              <select className="form-input" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="">{L('— Select —', '— اختر —')}</option>
                {dupes.map((d: any) => <option key={d.assetId} value={d.assetId}>{nameOf(d, isAR)}</option>)}
              </select>
              {!dupes.length && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('No similar capabilities found to map to.', 'لا توجد قدرات مشابهة للربط.')}</span>}
            </label>
          )}
          {creates && dupes.length > 0 && (
            <div data-testid="adoption-duplicates" style={{ border: '1px solid rgba(217,119,6,0.3)', background: 'rgba(217,119,6,0.05)', borderRadius: 6, padding: 10, marginBottom: 10, fontSize: 12 }}>
              <div>{L('Possible duplicates in your capabilities:', 'تكرارات محتملة ضمن قدراتكم:')}</div>
              {dupes.map((d: any) => <div key={d.assetId}>• {nameOf(d, isAR)}</div>)}
              <label style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />{L('This is a distinct capability', 'هذه قدرة مختلفة')}</label>
            </div>
          )}
          <label className="form-group" style={{ display: 'block' }}><span className="form-label">{L('Rationale (optional)', 'المبرر (اختياري)')}</span><textarea className="form-input" rows={2} value={rationale} onChange={e => setRationale(e.target.value)} /></label>
          <ErrorLine error={error} />
          <button className="btn btn-primary btn-sm" disabled={busy || (creates && dupes.length > 0 && !ack) || (mode === 'MAP_TO_EXISTING' && !target)} onClick={submit}>{L('Record decision', 'تسجيل القرار')}</button>
        </>
      )}
    </aside>
  )
}

// ── Organization context ───────────────────────────────────────────────────
function OrganizationContext({ L, isAR, ctx, canEdit, onSaved }: { L: LFn; isAR: boolean; ctx: any; canEdit: boolean; onSaved: () => void }) {
  const [taxonomy, setTaxonomy] = useState<any[]>([])
  const [form, setForm] = useState<any>({ organizationType: '', industryCode: '', subSectorCode: '', jurisdiction: 'SA' })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (ctx) setForm({ organizationType: ctx.organizationType || '', industryCode: ctx.industry?.code || '', subSectorCode: ctx.subSector?.code || '', jurisdiction: ctx.jurisdiction || 'SA' })
  }, [ctx])
  useEffect(() => { call('GET', `/taxonomy${form.organizationType ? `?organizationType=${form.organizationType}` : ''}`).then(setTaxonomy).catch(() => setTaxonomy([])) }, [form.organizationType])

  const industry = taxonomy.find(t => t.code === form.industryCode)
  const label = (n: any) => (isAR && n.labelAr) || n.labelEn
  const types: Array<[string, string, string]> = [['GOVERNMENT', 'Government', 'حكومية'], ['SEMI_GOVERNMENT', 'Semi-government', 'شبه حكومية'], ['PRIVATE', 'Private sector', 'قطاع خاص']]
  const hint = ctx?.legacySectorHint

  const save = async () => {
    setError(null); setSaved(false)
    try {
      await call('PUT', '/organization-context', { organizationType: form.organizationType, industryCode: form.industryCode || undefined, subSectorCode: form.subSectorCode || undefined, jurisdiction: form.jurisdiction || undefined })
      setSaved(true); onSaved()
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>
        {L('Used to suggest relevant reference capability models. Core capabilities remain specific to your organization.', 'تُستخدم لاقتراح النماذج المرجعية المناسبة. تبقى القدرات الأساسية خاصة بجهتكم.')}
      </p>
      {hint && (
        <div data-testid="legacy-hint" style={{ padding: 10, borderRadius: 6, background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.3)', fontSize: 13, marginBottom: 12 }}>
          {L(`Your previous setting was "${hint.legacySector}". It did not distinguish organization type from industry, so it was not converted automatically. Please confirm below.`, `كان الإعداد السابق "${hint.legacySector}" ولم يكن يميز بين نوع الجهة والقطاع، لذا لم يُحوَّل تلقائياً. يرجى التأكيد أدناه.`)}
        </div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="form-group"><span className="form-label">{L('Organization type', 'نوع الجهة')}</span>
          <select className="form-input" disabled={!canEdit} value={form.organizationType} onChange={e => setForm({ ...form, organizationType: e.target.value, industryCode: '', subSectorCode: '' })}>
            <option value="">{L('— Select —', '— اختر —')}</option>
            {types.map(([v, en, ar]) => <option key={v} value={v}>{L(en, ar)}</option>)}
          </select>
        </label>
        <label className="form-group"><span className="form-label">{L('Industry / sector', 'القطاع')}</span>
          <select className="form-input" disabled={!canEdit || !form.organizationType} value={form.industryCode} onChange={e => setForm({ ...form, industryCode: e.target.value, subSectorCode: '' })}>
            <option value="">{L('— Select —', '— اختر —')}</option>
            {taxonomy.map(t => <option key={t.code} value={t.code}>{label(t)}</option>)}
          </select>
        </label>
        {industry?.subSectors?.length > 0 && (
          <label className="form-group"><span className="form-label">{L('Sub-sector', 'القطاع الفرعي')}</span>
            <select className="form-input" disabled={!canEdit} value={form.subSectorCode} onChange={e => setForm({ ...form, subSectorCode: e.target.value })}>
              <option value="">{L('— None —', '— لا يوجد —')}</option>
              {industry.subSectors.map((s: any) => <option key={s.code} value={s.code}>{label(s)}</option>)}
            </select>
          </label>
        )}
        <label className="form-group"><span className="form-label">{L('Country', 'الدولة')} <HelpTip text={L('Two-letter country code, e.g. SA', 'رمز الدولة المكون من حرفين، مثل SA')} /></span>
          <input className="form-input" disabled={!canEdit} maxLength={2} value={form.jurisdiction} onChange={e => setForm({ ...form, jurisdiction: e.target.value.toUpperCase() })} style={{ maxWidth: 80 }} />
        </label>
      </div>
      <ErrorLine error={error} />
      {saved && <div role="status" style={{ color: 'var(--success)', fontSize: 13 }}>{L('Saved and confirmed.', 'تم الحفظ والتأكيد.')}</div>}
      {canEdit ? <button className="btn btn-primary btn-sm" disabled={!form.organizationType} onClick={save}>{L('Confirm classification', 'تأكيد التصنيف')}</button>
        : <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Only an administrator can change the organization classification.', 'يمكن للمسؤول فقط تغيير تصنيف الجهة.')}</div>}
    </div>
  )
}

// ── Model setup (attribute pack rollout) ───────────────────────────────────
function ModelSetup({ L, isAR }: { L: LFn; isAR: boolean }) {
  const [result, setResult] = useState<any>(null)
  const [decisions, setDecisions] = useState<Record<string, any>>({})
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyze = async (withDecisions = decisions) => {
    setBusy(true); setError(null)
    try { setResult(await call('POST', '/setup/attribute-pack', { dryRun: true, decisions: withDecisions })) } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const apply = async () => {
    setBusy(true); setError(null)
    try { setResult(await call('POST', '/setup/attribute-pack', { dryRun: false, confirm: true, decisions })); setConfirm(false) } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const statusText: Record<string, [string, string]> = {
    WOULD_APPLY: ['Ready to apply. Review the proposed changes below.', 'جاهز للتطبيق. راجع التغييرات المقترحة أدناه.'],
    UP_TO_DATE: ['Capability Management attributes are already in place.', 'سمات إدارة القدرات مفعّلة بالفعل.'],
    APPLIED: ['Applied. A new meta-model version was published; the previous version is preserved.', 'تم التطبيق. نُشر إصدار جديد من النموذج الوصفي مع الاحتفاظ بالإصدار السابق.'],
    REVIEW_REQUIRED: ['Some attributes may already exist under other names. Decide for each before applying.', 'قد تكون بعض السمات موجودة بأسماء أخرى. حدّد القرار لكل منها قبل التطبيق.'],
    BLOCKED_CONFLICTS: ['Blocked: existing attributes use the same code with a different type. Resolve them in Meta-Model Studio first.', 'متوقف: توجد سمات بالرمز نفسه ونوع مختلف. عالجها في استوديو النموذج الوصفي أولاً.'],
    BLOCKED_PENDING_DRAFT: ['Blocked: a meta-model draft is in progress. Publish or discard it first - nothing was changed.', 'متوقف: توجد مسودة نموذج وصفي قيد العمل. انشرها أو تجاهلها أولاً - لم يتم أي تغيير.'],
    NO_META_MODEL: ['No meta-model is configured for your organization yet.', 'لا يوجد نموذج وصفي لجهتكم بعد.'],
    NO_PUBLISHED_VERSION: ['No published meta-model version yet.', 'لا يوجد إصدار منشور من النموذج الوصفي بعد.'],
    NO_TARGET_TYPES: ['No business capability types found in your meta-model.', 'لا توجد أنواع قدرات أعمال في النموذج الوصفي.'],
    VALIDATION_FAILED: ['Validation failed; nothing was published.', 'فشل التحقق؛ لم يُنشر شيء.'],
    CONCURRENT_DRAFT: ['Another change started at the same time; nothing was applied. Try again.', 'بدأ تغيير آخر في الوقت نفسه؛ لم يُطبّق شيء. حاول مجدداً.'],
  }
  const canApply = result && (result.status === 'WOULD_APPLY')

  return (
    <div style={{ maxWidth: 860 }}>
      <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 0 }}>
        {L('Adds the Capability Management attributes (classification, importance, maturity, health…) to your business capability types through a new meta-model version. Nothing changes until you apply.', 'يضيف سمات إدارة القدرات (التصنيف، الأهمية، النضج، السلامة…) إلى أنواع قدرات الأعمال عبر إصدار جديد من النموذج الوصفي. لا يحدث أي تغيير قبل التطبيق.')}
      </p>
      <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => analyze()}>{L('Analyze', 'تحليل')}</button>
      <ErrorLine error={error} />
      {result && (
        <div style={{ marginTop: 16 }}>
          <div data-testid="pack-status" style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{statusText[result.status] ? L(statusText[result.status][0], statusText[result.status][1]) : result.status}</div>
          {result.plan?.targets?.map((t: any) => (
            <div key={t.objectTypeCode} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{t.objectTypeCode}</div>
              {t.toAdd?.length > 0 && <div style={{ fontSize: 12, marginTop: 6 }}>{L('Will add', 'ستُضاف')}: {t.toAdd.map((a: any) => (isAR && a.nameAr) || a.name).join(isAR ? '، ' : ', ')}</div>}
              {t.conflicts?.length > 0 && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--danger)' }}>{L('Conflicts', 'تعارضات')}: {t.conflicts.map((c: any) => `${c.code} (${c.existingType} ≠ ${c.packType})`).join(', ')}</div>}
              {t.possibleEquivalents?.map((pe: any) => {
                const key = `${t.objectTypeCode}.${pe.packAttributeCode}`
                const cur = decisions[key]
                const value = cur ? ('useExisting' in cur ? `use:${cur.useExisting}` : 'add') : ''
                return (
                  <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ minWidth: 160 }}>{pe.packAttributeCode}</span>
                    <select className="form-input" style={{ width: 'auto', padding: '4px 8px' }} value={value} onChange={e => {
                      const v = e.target.value
                      const next = { ...decisions }
                      if (!v) delete next[key]; else next[key] = v === 'add' ? { addPackAttribute: true } : { useExisting: v.slice(4) }
                      setDecisions(next)
                    }}>
                      <option value="">{L('— Decide —', '— حدّد —')}</option>
                      {pe.candidates.filter((c: any) => c.typeCompatible).map((c: any) => <option key={c.code} value={`use:${c.code}`}>{L('Use existing', 'استخدام الموجود')}: {c.name || c.code}</option>)}
                      <option value="add">{L('Add as a new attribute', 'إضافة كسمة جديدة')}</option>
                    </select>
                  </label>
                )
              })}
            </div>
          ))}
          {result.status === 'REVIEW_REQUIRED' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => analyze(decisions)}>{L('Re-check with my decisions', 'إعادة الفحص بقراراتي')}</button>}
          {canApply && (
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', gap: 6, fontSize: 13, alignItems: 'center' }}><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} />{L('I understand this publishes a new meta-model version', 'أدرك أن هذا ينشر إصداراً جديداً من النموذج الوصفي')}</label>
              <button className="btn btn-primary btn-sm" disabled={!confirm || busy} onClick={apply}>{L('Apply', 'تطبيق')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
