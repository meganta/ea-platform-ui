import { useState, useEffect, useCallback, useMemo } from 'react'
import HelpTip from '../components/HelpTip'
import { useLang } from '../contexts/LangContext'
import { enumLabel } from '../lib/enumLabels'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (p: string) => fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const patch = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
    const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok)
    const tok = () => token()
    return { get, post, patch, del, tok }
  }, [])
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const STATUS_COLOR: Record<string, string> = { DRAFT: '#7f8c8d', ACTIVE: '#2ecc71', COMPLETED: '#3498db', CANCELLED: '#e74c3c' }
const FREQ_LABEL: Record<string, string> = { ANNUAL: 'Annual', SEMI_ANNUAL: 'Semi-Annual', QUARTERLY: 'Quarterly', ON_DEMAND: 'On-Demand' }
const FREQ_LABEL_AR: Record<string, string> = { ANNUAL: 'سنوية', SEMI_ANNUAL: 'نصف سنوية', QUARTERLY: 'ربعية', ON_DEMAND: 'عند الطلب' }
const DOMAIN_LABEL: Record<string, [string, string]> = { BUSINESS: ['Business', 'الأعمال'], BENEFICIARY_EXPERIENCE: ['Beneficiary Experience', 'تجربة المستفيد'], APPLICATIONS: ['Applications', 'التطبيقات'], DATA: ['Data', 'البيانات'], TECHNOLOGY: ['Technology', 'التقنية'], SECURITY: ['Security', 'الأمن'] }
const domainName = (d: string, isAR: boolean) => (DOMAIN_LABEL[d] ? DOMAIN_LABEL[d][isAR ? 1 : 0] : d)
const localName = (x: any, isAR: boolean) => (isAR ? (x?.nameAr || x?.nameEn) : x?.nameEn) || ''
const DOMAINS = ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY']
const PRIORITY_COLOR: Record<string, string> = { HIGH: '#e74c3c', MEDIUM: '#f39c12', LOW: '#2ecc71' }

export default function EaPlanningPage() {
  const api = useApi()
  const { t, isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [tab, setTab] = useState<'dashboard'|'plans'|'roadmap'>('dashboard')
  const [dashboard, setDashboard] = useState<any>(null)
  const [planTypes, setPlanTypes] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [creating, setCreating] = useState(false)

  const loadDashboard = useCallback(() => { api.get('/ea-planning/dashboard').then(setDashboard) }, [api])
  const loadPlanTypes = useCallback(() => { api.get('/ea-planning/plan-types').then((d: any) => setPlanTypes(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { loadDashboard(); loadPlanTypes() }, [loadDashboard, loadPlanTypes])

  const openPlan = async (id: string) => { const full = await api.get(`/ea-planning/plans/${id}`); setSelected(full) }

  if (selected) return <PlanDetail api={api} plan={selected} onBack={() => { setSelected(null); loadDashboard() }} onRefresh={() => openPlan(selected.id)} />
  if (creating) return <NewPlanWizard api={api} planTypes={planTypes} onCreated={(p: any) => { setCreating(false); loadDashboard(); openPlan(p.id) }} onCancel={() => setCreating(false)} />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{L('🗓 EA Planning', '🗓 تخطيط البنية المؤسسية')}<HelpTip text={L('Create and track the plans that guide the EA practice\'s work over time - like an annual roadmap or a quarterly focus plan. You can write these yourself or have AI draft a starting point based on your goals.', 'أنشئ الخطط التي توجّه عمل ممارسة البنية المؤسسية وتابعها بمرور الوقت، مثل خارطة طريق سنوية أو خطة تركيز ربعية. يمكنك كتابتها بنفسك أو جعل الذكاء الاصطناعي يعدّ مسودة أولية بناءً على أهدافك.')} /></div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Strategic and operational plans for the EA practice', 'الخطط الاستراتيجية والتشغيلية لممارسة البنية المؤسسية')}</div>
        </div>
        <button style={S.btn('primary')} onClick={() => setCreating(true)}>{L('+ New Plan', '+ خطة جديدة')}</button>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'dashboard')} onClick={() => setTab('dashboard')}>{L('📊 Dashboard', '📊 لوحة المعلومات')}</button>
        <button style={S.tab(tab === 'plans')} onClick={() => setTab('plans')}>{L('📋 All Plans', '📋 كل الخطط')}</button>
        <button style={S.tab(tab === 'roadmap')} onClick={() => setTab('roadmap')}>{t('planning.tab_roadmap')}</button>
      </div>
      <div style={S.content}>
        {tab === 'dashboard' && <DashboardTab dashboard={dashboard} onOpenPlans={() => setTab('plans')} />}
        {tab === 'plans' && <PlansListTab api={api} onOpen={openPlan} />}
        {tab === 'roadmap' && <RoadmapTab api={api} t={t} />}
      </div>
    </div>
  )
}

// ── Roadmap ──────────────────────────────────────────────────────────────────
function RoadmapTab({ api, t }: { api: any, t: (k: string) => string }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [domain, setDomain] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const q = domain ? `?domain=${encodeURIComponent(domain)}` : ''
    api.get(`/ea-planning/roadmap${q}`).then((d: any) => setItems(Array.isArray(d?.items) ? d.items : [])).finally(() => setLoading(false))
  }, [api, domain])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{t('planning.roadmap_filter_domain')}<HelpTip text={t('planning.roadmap_help')} /></div>
        <select style={{ ...S.input, width: 200, marginBottom: 0 }} value={domain} onChange={e => setDomain(e.target.value)}>
          <option value="">{L('All', 'الكل')}</option>
          {DOMAINS.map(d => <option key={d} value={d}>{domainName(d, isAR)}</option>)}
        </select>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div>
      ) : items.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('planning.roadmap_empty')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((item: any, i: number) => (
            <div key={i} style={{ ...S.card, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={S.badge(item.itemType === 'activity' ? '#00b4d8' : '#9b59b6')}>{item.itemType === 'activity' ? t('repository.roadmap_activity') : t('repository.roadmap_deliverable')}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{item.assetName} ({item.assetType}) · {item.planName}</div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' as const }}>
                {item.periodLabel || '—'}
                {item.periodStart && <div>{new Date(item.periodStart).toLocaleDateString(isAR ? 'ar' : 'en-US')} → {item.periodEnd ? new Date(item.periodEnd).toLocaleDateString(isAR ? 'ar' : 'en-US') : '?'}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Asset picker (used to link a plan activity/deliverable to a real EA asset)
function AssetPicker({ api, t, onPick, onCancel }: { api: any, t: (k: string) => string, onPick: (asset: any) => void, onCancel: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const handle = setTimeout(() => {
      api.get(`/ea-repository/assets?search=${encodeURIComponent(query)}`).then((r: any) => setResults(Array.isArray(r) ? r.slice(0, 8) : [])).catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(handle)
  }, [api, query])

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <input autoFocus style={{ ...S.input, marginBottom: 0, width: 240 }} placeholder={t('planning.search_asset')} value={query} onChange={e => setQuery(e.target.value)} onBlur={() => setTimeout(onCancel, 150)} />
      {query.trim() && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, width: 280, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 220, overflow: 'auto' }}>
          {results.length === 0 ? (
            <div style={{ padding: 10, fontSize: 12, color: 'var(--text-dim)' }}>{t('planning.no_asset_results')}</div>
          ) : results.map(a => (
            <div key={a.id} style={{ padding: '8px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }} onMouseDown={() => onPick(a)}>
              <div style={{ fontWeight: 600 }}>{a.name}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>{a.canonicalDisplayLabel || a.assetType}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function DashboardTab({ dashboard, onOpenPlans }: { dashboard: any, onOpenPlans: () => void }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  if (!dashboard) return <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div>
  return (
    <div>
      <div className="stat-grid-4">
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Total Plans', 'إجمالي الخطط')}</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard.total}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Active', 'نشطة')}</div><div style={{ fontSize: 28, fontWeight: 700, color: '#2ecc71' }}>{dashboard.active}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Avg Progress', 'متوسط التقدم')}</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard.avgProgress}%</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('High-Risk Plans', 'خطط عالية المخاطر')}</div><div style={{ fontSize: 28, fontWeight: 700, color: dashboard.highRisk > 0 ? '#e74c3c' : undefined }}>{dashboard.highRisk}</div></div>
      </div>
      <div style={{ ...S.grid2, marginTop: 16 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{L('By Status', 'حسب الحالة')}</div>
          {Object.entries(dashboard.byStatus).map(([status, count]: any) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={S.badge(STATUS_COLOR[status])}>{enumLabel(status, isAR)}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--navy)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${dashboard.total ? (count / dashboard.total) * 100 : 0}%`, height: '100%', background: STATUS_COLOR[status] }} />
              </div>
              <div style={{ fontSize: 12, width: 24, textAlign: 'right' }}>{count}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>{L('By Plan Type', 'حسب نوع الخطة')}</div>
          {Object.entries(dashboard.byType).length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('No plans yet.', 'لا توجد خطط بعد.')}</div> : Object.entries(dashboard.byType).map(([type, count]: any) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
              <div>{type}</div><div style={{ fontWeight: 600 }}>{count}</div>
            </div>
          ))}
        </div>
      </div>
      <button style={{ ...S.btn(), marginTop: 16 }} onClick={onOpenPlans}>{L('View All Plans →', 'عرض كل الخطط ←')}</button>
    </div>
  )
}

// ── Plans List ───────────────────────────────────────────────────────────────
function PlansListTab({ api, onOpen }: { api: any, onOpen: (id: string) => void }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [plans, setPlans] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    const q = statusFilter ? `?status=${statusFilter}` : ''
    api.get(`/ea-planning/plans${q}`).then((d: any) => setPlans(Array.isArray(d) ? d : []))
  }, [api, statusFilter])
  useEffect(() => { load() }, [load])

  const remove = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (!window.confirm(L('Delete this plan?', 'حذف هذه الخطة؟'))) return; await api.del(`/ea-planning/plans/${id}`); load() }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select style={{ ...S.input, width: 200, marginBottom: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{L('All Statuses', 'كل الحالات')}</option>
          {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{enumLabel(s, isAR)}</option>)}
        </select>
      </div>
      {plans.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{L('No plans found.', 'لا توجد خطط.')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map(p => (
            <div key={p.id} style={{ ...S.card, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => onOpen(p.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{localName(p, isAR)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{localName(p.planType, isAR)} · {p.periodLabel || L('No period set', 'لم تُحدد فترة')} · {(isAR ? FREQ_LABEL_AR : FREQ_LABEL)[p.frequency] || p.frequency}</div>
              </div>
              <div style={{ width: 80 }}>
                <div style={{ height: 6, background: 'var(--navy)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${p.progressPct || 0}%`, height: '100%', background: 'var(--accent)' }} /></div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, textAlign: 'center' }}>{p.progressPct || 0}%</div>
              </div>
              <span style={S.badge(STATUS_COLOR[p.status])}>{enumLabel(p.status, isAR)}</span>
              <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={e => remove(e, p.id)}>{L('Delete', 'حذف')}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── New Plan Wizard (with AI generation) ─────────────────────────────────────
function NewPlanWizard({ api, planTypes, onCreated, onCancel }: { api: any, planTypes: any[], onCreated: (p: any) => void, onCancel: () => void }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [form, setForm] = useState({ planTypeId: '', nameEn: '', nameAr: '', frequency: 'ANNUAL', periodLabel: '', domains: [] as string[], userContext: '' })
  const [generated, setGenerated] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedType = planTypes.find(t => t.id === form.planTypeId)

  const toggleDomain = (d: string) => setForm(f => ({ ...f, domains: f.domains.includes(d) ? f.domains.filter(x => x !== d) : [...f.domains, d] }))

  const generate = async () => {
    if (!selectedType) return alert(L('Select a plan type first', 'اختر نوع الخطة أولاً'))
    setGenerating(true)
    try {
      const result = await api.post('/ea-planning/generate', { planTypeId: form.planTypeId, planTypeName: selectedType.nameEn, frequency: form.frequency, periodLabel: form.periodLabel, domains: form.domains, userContext: form.userContext })
      setGenerated(result)
      if (!form.nameEn) setForm(f => ({ ...f, nameEn: `${selectedType.nameEn} — ${form.periodLabel || new Date().getFullYear()}` }))
    } catch (e: any) { alert(e.message) } finally { setGenerating(false) }
  }

  const create = async () => {
    if (!form.planTypeId || !form.nameEn) return alert(L('Plan type and name are required', 'نوع الخطة والاسم مطلوبان'))
    setSaving(true)
    try {
      const created = await api.post('/ea-planning/plans', {
        planTypeId: form.planTypeId, nameEn: form.nameEn, nameAr: form.nameAr || undefined,
        frequency: form.frequency, periodLabel: form.periodLabel || undefined, domains: form.domains,
        objectives: generated?.objectives, scope: generated?.scope,
        activities: generated?.activities || [], deliverables: generated?.deliverables || [],
        kpis: generated?.kpis || [], risks: generated?.risks || [],
      })
      onCreated(created)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onCancel}>{L('← Cancel', '→ إلغاء')}</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{L('New EA Plan', 'خطة بنية مؤسسية جديدة')}</div>
      </div>
      <div style={S.content}>
        <div style={{ maxWidth: 720 }}>
          <div style={S.card}>
            <div style={S.grid2}>
              <div>
                <div style={S.label}>{L('Plan Type *', 'نوع الخطة *')}</div>
                <select style={S.input} value={form.planTypeId} onChange={e => setForm(f => ({ ...f, planTypeId: e.target.value }))}>
                  <option value="">{L('Select…', 'اختر…')}</option>
                  {planTypes.map(t => <option key={t.id} value={t.id}>{localName(t, isAR)}</option>)}
                </select>
              </div>
              <div><div style={S.label}>{L('Frequency', 'التكرار')}</div>
                <select style={S.input} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  {Object.entries(FREQ_LABEL).map(([k, l]) => <option key={k} value={k}>{isAR ? FREQ_LABEL_AR[k] : l}</option>)}
                </select>
              </div>
              <div><div style={S.label}>{L('Period Label', 'تسمية الفترة')}</div><input style={S.input} placeholder={L('e.g. FY2026', 'مثال: السنة المالية 2026')} value={form.periodLabel} onChange={e => setForm(f => ({ ...f, periodLabel: e.target.value }))} /></div>
              <div><div style={S.label}>{L('Name (EN) *', 'الاسم (بالإنجليزية) *')}</div><input style={S.input} value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} /></div>
            </div>
            <div style={S.label}>{L('EA Domains in Scope', 'مجالات البنية المؤسسية ضمن النطاق')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
              {DOMAINS.map(d => (
                <button key={d} style={{ ...S.badge(form.domains.includes(d) ? '#00b4d8' : '#7f8c8d'), cursor: 'pointer', border: 'none' }} onClick={() => toggleDomain(d)}>{domainName(d, isAR)}</button>
              ))}
            </div>
            <div style={S.label}>{L('Additional Context (optional, for AI generation)', 'سياق إضافي (اختياري، لإنشاء الذكاء الاصطناعي)')}</div>
            <input style={S.input} placeholder={L('Any specific focus areas or constraints…', 'أي مجالات تركيز أو قيود محددة…')} value={form.userContext} onChange={e => setForm(f => ({ ...f, userContext: e.target.value }))} />

            <button style={{ ...S.btn('primary'), marginBottom: 10 }} onClick={generate} disabled={generating || !form.planTypeId}>{generating ? L('⏳ Generating with AI…', '⏳ جارٍ الإنشاء بالذكاء الاصطناعي…') : L('✨ Generate Plan Content with AI', '✨ إنشاء محتوى الخطة بالذكاء الاصطناعي')}</button>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Generates objectives, activities, deliverables, KPIs, and risks aligned to NORA 2.0. You can review and edit everything after creating the plan.', 'يُنشئ الأهداف والأنشطة والمخرجات ومؤشرات الأداء والمخاطر بما يتوافق مع نورة 2.0. يمكنك مراجعة كل شيء وتعديله بعد إنشاء الخطة.')}</div>
          </div>

          {generated && (
            <div style={S.card}>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>{L('✨ AI-Generated Preview', '✨ معاينة ما أنشأه الذكاء الاصطناعي')}</div>
              <div style={S.label}>{L('Objectives', 'الأهداف')}</div><div style={{ fontSize: 12, marginBottom: 10 }}>{generated.objectives}</div>
              <div style={S.label}>{L('Scope', 'النطاق')}</div><div style={{ fontSize: 12, marginBottom: 10 }}>{generated.scope}</div>
              <div style={S.label}>{(generated.activities || []).length} {L('activities ·', 'نشاط ·')} {(generated.deliverables || []).length} {L('deliverables ·', 'مخرج ·')} {(generated.kpis || []).length} {L('KPIs ·', 'مؤشر أداء ·')} {(generated.risks || []).length} {L('risks generated', 'خطر مُنشأ')}</div>
            </div>
          )}

          <button style={S.btn('primary')} onClick={create} disabled={saving}>{saving ? L('Creating…', 'جارٍ الإنشاء…') : generated ? L('💾 Create Plan with Generated Content', '💾 إنشاء الخطة بالمحتوى المُنشأ') : L('💾 Create Blank Plan', '💾 إنشاء خطة فارغة')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Asset link control (shown inline on an activity/deliverable row in
// view mode - linking targets the persisted item by its stable id, so
// this deliberately isn't shown on unsaved edit-mode drafts) ────────────
function AssetLinkControl({ item, isPicking, onStartPick, onPick, onCancelPick, onUnlink, api, t }: {
  item: any, field: string, isPicking: boolean,
  onStartPick: () => void, onPick: (asset: any) => void, onCancelPick: () => void, onUnlink: () => void,
  api: any, t: (k: string) => string,
}) {
  if (isPicking) return <AssetPicker api={api} t={t} onPick={onPick} onCancel={onCancelPick} />
  if (item.assetId) {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
        <span style={{ padding: '1px 8px', borderRadius: 2, background: 'rgba(3,105,161,0.1)', color: 'var(--accent)' }} title={`${t('planning.linked_to')}: ${item.assetName}`}>🔗 {item.assetName}</span>
        <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 10 }} onClick={onUnlink}>{t('planning.unlink')}</button>
      </span>
    )
  }
  return <button style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 10, whiteSpace: 'nowrap' as const }} onClick={onStartPick}>{t('planning.link_asset')}</button>
}

// ── Plan Detail ──────────────────────────────────────────────────────────────
function PlanDetail({ api, plan, onBack, onRefresh }: { api: any, plan: any, onBack: () => void, onRefresh: () => void }) {
  const { t, isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({ ...plan })
  const [saving, setSaving] = useState(false)
  const [scenarios, setScenarios] = useState<any[]>([])
  const [scenarioPick, setScenarioPick] = useState('')
  const [pickingAssetFor, setPickingAssetFor] = useState<{ field: 'activities' | 'deliverables', itemId: string } | null>(null)

  useEffect(() => { api.get('/ea-views/scenarios').then((s: any) => setScenarios(Array.isArray(s) ? s : [])).catch(() => setScenarios([])) }, [api])
  const linkedScenario = scenarios.find(s => s.id === plan.scenarioId)

  const linkScenario = async () => {
    if (!scenarioPick) return
    await api.patch(`/ea-planning/plans/${plan.id}/scenario`, { scenarioId: scenarioPick })
    setScenarioPick(''); onRefresh()
  }
  const unlinkScenario = async () => { await api.del(`/ea-planning/plans/${plan.id}/scenario`); onRefresh() }

  const linkItemAsset = async (field: 'activities' | 'deliverables', itemId: string, asset: any) => {
    setPickingAssetFor(null)
    await api.patch(`/ea-planning/plans/${plan.id}/${field}/${itemId}/asset`, { assetId: asset.id })
    onRefresh()
  }
  const unlinkItemAsset = async (field: 'activities' | 'deliverables', itemId: string) => {
    await api.del(`/ea-planning/plans/${plan.id}/${field}/${itemId}/asset`)
    onRefresh()
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch(`/ea-planning/plans/${plan.id}`, {
        nameEn: form.nameEn, nameAr: form.nameAr, status: form.status, frequency: form.frequency,
        periodLabel: form.periodLabel, owner: form.owner, objectives: form.objectives, scope: form.scope,
        notes: form.notes, progressPct: form.progressPct,
        activities: form.activities, deliverables: form.deliverables, kpis: form.kpis, risks: form.risks,
      })
      setEditing(false); onRefresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const downloadFile = async (format: 'docx' | 'pptx') => {
    const res = await fetch(`${API}/ea-planning/plans/${plan.id}/export/${format}`, { headers: { Authorization: `Bearer ${api.tok()}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ea-plan-${plan.id}.${format}`
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 1500)
  }

  const updateListItem = (field: 'activities'|'deliverables'|'kpis'|'risks', idx: number, patch: any) => {
    setForm((f: any) => ({ ...f, [field]: (f[field] || []).map((item: any, i: number) => i === idx ? { ...item, ...patch } : item) }))
  }
  const addListItem = (field: 'activities'|'deliverables'|'kpis'|'risks', blank: any) => {
    // Every activity/deliverable needs a stable id for asset linking
    // (PATCH /ea-planning/plans/:id/activities/:itemId/asset) - AI-generated
    // items already carry one (see the generation prompt), but a manually
    // added item previously had none.
    setForm((f: any) => ({ ...f, [field]: [...(f[field] || []), { id: `${field[0].toUpperCase()}${Date.now()}`, ...blank }] }))
  }
  const removeListItem = (field: 'activities'|'deliverables'|'kpis'|'risks', idx: number) => {
    setForm((f: any) => ({ ...f, [field]: (f[field] || []).filter((_: any, i: number) => i !== idx) }))
  }

  const activities = (editing ? form.activities : plan.activities) || []
  const deliverables = (editing ? form.deliverables : plan.deliverables) || []
  const kpis = (editing ? form.kpis : plan.kpis) || []
  const risks = (editing ? form.risks : plan.risks) || []

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>{L('← Back', '→ رجوع')}</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{localName(plan, isAR)}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={S.badge(STATUS_COLOR[plan.status])}>{enumLabel(plan.status, isAR)}</span>
            <span style={S.badge('#7f8c8d')}>{localName(plan.planType, isAR)}</span>
          </div>
        </div>
        <div style={S.row}>
          <button style={S.btn()} onClick={() => downloadFile('docx')}>{L('📄 Export Word', '📄 تصدير Word')}</button>
          <button style={S.btn()} onClick={() => downloadFile('pptx')}>{L('📊 Export PowerPoint', '📊 تصدير PowerPoint')}</button>
          {!editing ? <button style={S.btn('primary')} onClick={() => { setForm({ ...plan }); setEditing(true) }}>{L('✏ Edit', '✏ تعديل')}</button> : (
            <>
              <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? L('Saving…', 'جارٍ الحفظ…') : L('💾 Save', '💾 حفظ')}</button>
              <button style={S.btn()} onClick={() => setEditing(false)}>{L('Cancel', 'إلغاء')}</button>
            </>
          )}
        </div>
      </div>
      <div style={S.content}>
        <div style={S.grid3}>
          <div style={S.card}>
            <div style={S.label}>{L('Status', 'الحالة')}</div>
            {editing ? <select style={S.input} value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>{Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{enumLabel(s, isAR)}</option>)}</select> : <div style={{ fontSize: 13 }}>{plan.status}</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>{L('Owner', 'المالك')}</div>
            {editing ? <input style={S.input} value={form.owner || ''} onChange={e => setForm((f: any) => ({ ...f, owner: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.owner || '—'}</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>{L('Progress (', 'التقدم (')}{editing ? form.progressPct : plan.progressPct}%)</div>
            {editing ? <input style={S.input} type="range" min={0} max={100} value={form.progressPct || 0} onChange={e => setForm((f: any) => ({ ...f, progressPct: parseInt(e.target.value, 10) }))} /> : (
              <div style={{ height: 8, background: 'var(--navy)', borderRadius: 4, overflow: 'hidden', marginTop: 6 }}><div style={{ width: `${plan.progressPct || 0}%`, height: '100%', background: 'var(--accent)' }} /></div>
            )}
          </div>
        </div>

        <div style={S.card}>
          <div style={{ ...S.label, display: 'flex', alignItems: 'center' }}>{t('planning.scenario_title')}<HelpTip text={t('planning.scenario_help')} /></div>
          {linkedScenario ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13 }}>{linkedScenario.name}</span>
              <button style={{ ...S.btn(), fontSize: 11 }} onClick={unlinkScenario}>{t('planning.scenario_unlink')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select aria-label="scenario-select" style={{ ...S.input, marginBottom: 0, width: 260 }} value={scenarioPick} onChange={e => setScenarioPick(e.target.value)}>
                <option value="">{t('planning.scenario_select')}</option>
                {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button style={{ ...S.btn('primary'), fontSize: 11 }} onClick={linkScenario} disabled={!scenarioPick}>{t('planning.scenario_link')}</button>
            </div>
          )}
          {scenarios.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>{t('planning.scenario_none')}</div>}
        </div>

        <div style={S.card}>
          <div style={S.label}>{L('Objectives', 'الأهداف')}</div>
          {editing ? <textarea style={{ ...S.input, minHeight: 60 }} value={form.objectives || ''} onChange={e => setForm((f: any) => ({ ...f, objectives: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.objectives || L('Not defined.', 'غير محدد.')}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>{L('Scope', 'النطاق')}</div>
          {editing ? <textarea style={{ ...S.input, minHeight: 60 }} value={form.scope || ''} onChange={e => setForm((f: any) => ({ ...f, scope: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.scope || L('Not defined.', 'غير محدد.')}</div>}
        </div>

        {/* Activities */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{L('Key Activities (', 'الأنشطة الرئيسية (')}{activities.length})</div>
          {activities.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={a.name || ''} onChange={e => updateListItem('activities', i, { name: e.target.value })} placeholder={L('Activity name', 'اسم النشاط')} />
                <select style={{ ...S.input, marginBottom: 0, width: 100 }} value={a.priority || 'MEDIUM'} onChange={e => updateListItem('activities', i, { priority: e.target.value })}>{['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{enumLabel(p, isAR)}</option>)}</select>
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('activities', i)}>✕</button>
              </> : <>
                <span style={S.badge(PRIORITY_COLOR[a.priority] || '#7f8c8d')}>{enumLabel(a.priority || 'MEDIUM', isAR)}</span>
                <div style={{ flex: 1 }}>{a.name}{a.timeframe ? ` (${a.timeframe})` : ''}{a.description ? ` — ${a.description}` : ''}</div>
                <AssetLinkControl item={a} field="activities" isPicking={pickingAssetFor?.field === 'activities' && pickingAssetFor?.itemId === a.id}
                  onStartPick={() => setPickingAssetFor({ field: 'activities', itemId: a.id })}
                  onPick={(asset) => linkItemAsset('activities', a.id, asset)}
                  onCancelPick={() => setPickingAssetFor(null)}
                  onUnlink={() => unlinkItemAsset('activities', a.id)}
                  api={api} t={t} />
              </>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('activities', { name: '', priority: 'MEDIUM' })}>{L('+ Add Activity', '+ إضافة نشاط')}</button>}
        </div>

        {/* Deliverables */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{L('Expected Deliverables (', 'المخرجات المتوقعة (')}{deliverables.length})</div>
          {deliverables.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={d.name || ''} onChange={e => updateListItem('deliverables', i, { name: e.target.value })} placeholder={L('Deliverable name', 'اسم المخرج')} />
                <input style={{ ...S.input, marginBottom: 0, width: 120 }} value={d.dueTimeframe || ''} onChange={e => updateListItem('deliverables', i, { dueTimeframe: e.target.value })} placeholder={L('Due', 'الاستحقاق')} />
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('deliverables', i)}>✕</button>
              </> : <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{d.name} {d.type ? `— ${d.type}` : ''}{d.dueTimeframe ? L(`, due ${d.dueTimeframe}`, `، تستحق ${d.dueTimeframe}`) : ''}</span>
                <AssetLinkControl item={d} field="deliverables" isPicking={pickingAssetFor?.field === 'deliverables' && pickingAssetFor?.itemId === d.id}
                  onStartPick={() => setPickingAssetFor({ field: 'deliverables', itemId: d.id })}
                  onPick={(asset) => linkItemAsset('deliverables', d.id, asset)}
                  onCancelPick={() => setPickingAssetFor(null)}
                  onUnlink={() => unlinkItemAsset('deliverables', d.id)}
                  api={api} t={t} />
              </div>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('deliverables', { name: '' })}>{L('+ Add Deliverable', '+ إضافة مخرج')}</button>}
        </div>

        {/* KPIs */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{L('KPIs (', 'مؤشرات الأداء (')}{kpis.length})</div>
          {kpis.map((k: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={k.name || ''} onChange={e => updateListItem('kpis', i, { name: e.target.value })} placeholder={L('KPI name', 'اسم المؤشر')} />
                <input style={{ ...S.input, marginBottom: 0, width: 100 }} value={k.target || ''} onChange={e => updateListItem('kpis', i, { target: e.target.value })} placeholder={L('Target', 'المستهدف')} />
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('kpis', i)}>✕</button>
              </> : <div style={{ flex: 1 }}>{k.name} {L('| Target:', '| المستهدف:')} {k.target || 'TBD'}</div>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('kpis', { name: '' })}>{L('+ Add KPI', '+ إضافة مؤشر')}</button>}
        </div>

        {/* Risks */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>{L('Risks (', 'المخاطر (')}{risks.length})</div>
          {risks.map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={r.name || ''} onChange={e => updateListItem('risks', i, { name: e.target.value })} placeholder={L('Risk name', 'اسم الخطر')} />
                <select style={{ ...S.input, marginBottom: 0, width: 100 }} value={r.severity || 'MEDIUM'} onChange={e => updateListItem('risks', i, { severity: e.target.value })}>{['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{enumLabel(p, isAR)}</option>)}</select>
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('risks', i)}>✕</button>
              </> : <>
                <span style={S.badge(PRIORITY_COLOR[r.severity] || '#7f8c8d')}>{r.severity || 'MEDIUM'}</span>
                <div style={{ flex: 1 }}>{r.name}{r.mitigation ? L(` — Mitigation: ${r.mitigation}`, `— المعالجة: ${r.mitigation}`) : ''}</div>
              </>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('risks', { name: '', severity: 'MEDIUM' })}>{L('+ Add Risk', '+ إضافة خطر')}</button>}
        </div>

        <div style={S.card}>
          <div style={S.label}>{L('Notes', 'ملاحظات')}</div>
          {editing ? <textarea style={{ ...S.input, minHeight: 60 }} value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.notes || L('None.', 'لا يوجد.')}</div>}
        </div>
      </div>
    </div>
  )
}
