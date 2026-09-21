import { useState, useEffect, useCallback, useMemo } from 'react'
import HelpTip from '../components/HelpTip'
import { useLang } from '../contexts/LangContext'

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
const DOMAINS = ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY']
const PRIORITY_COLOR: Record<string, string> = { HIGH: '#e74c3c', MEDIUM: '#f39c12', LOW: '#2ecc71' }
const HEALTH_COLOR: Record<string, string> = { ON_TRACK: '#2ecc71', AT_RISK: '#f39c12', DELAYED: '#e67e22', BLOCKED: '#e74c3c' }
const OBJ_STATUS_COLOR: Record<string, string> = { NOT_STARTED: '#7f8c8d', IN_PROGRESS: '#3498db', ACHIEVED: '#2ecc71', AT_RISK: '#e74c3c' }
const INIT_STATUS_COLOR: Record<string, string> = { DRAFT: '#7f8c8d', APPROVED: '#3498db', IN_PROGRESS: '#9b59b6', COMPLETED: '#2ecc71', CANCELLED: '#e74c3c' }
const NEEDS_ATTENTION_LABEL: Record<string, string> = {
  BLOCKED_INITIATIVE: '🚫 Blocked', DELAYED_INITIATIVE: '⏱ Delayed', OVERDUE_INITIATIVE: '📅 Overdue', UNASSIGNED_OWNER: '👤 No owner assigned',
}

export default function EaPlanningPage() {
  const api = useApi()
  const { t } = useLang()
  const [tab, setTab] = useState<'dashboard'|'plans'|'roadmap'>('dashboard')
  const [dashboard, setDashboard] = useState<any>(null)
  const [planTypes, setPlanTypes] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [selectedInitialTab, setSelectedInitialTab] = useState<string>('overview')
  const [creating, setCreating] = useState(false)

  const loadDashboard = useCallback(() => { api.get('/ea-planning/dashboard').then(setDashboard) }, [api])
  const loadPlanTypes = useCallback(() => { api.get('/ea-planning/plan-types').then((d: any) => setPlanTypes(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { loadDashboard(); loadPlanTypes() }, [loadDashboard, loadPlanTypes])

  const openPlan = async (id: string, initialTab?: string) => { const full = await api.get(`/ea-planning/plans/${id}`); setSelected(full); setSelectedInitialTab(initialTab || 'overview') }

  if (selected) return <PlanDetail api={api} plan={selected} initialTab={selectedInitialTab} onBack={() => { setSelected(null); loadDashboard() }} onRefresh={() => openPlan(selected.id, undefined)} />
  if (creating) return <NewPlanWizard api={api} planTypes={planTypes} onCreated={(p: any) => { setCreating(false); loadDashboard(); openPlan(p.id) }} onCancel={() => setCreating(false)} />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center' }}>🗓 EA Planning<HelpTip text="Create and track the plans that guide the EA practice's work over time - like an annual roadmap or a quarterly focus plan. You can write these yourself or have AI draft a starting point based on your goals." /></div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Strategic and operational plans for the EA practice</div>
        </div>
        <button style={S.btn('primary')} onClick={() => setCreating(true)}>+ New Plan</button>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'dashboard')} onClick={() => setTab('dashboard')}>📊 Dashboard</button>
        <button style={S.tab(tab === 'plans')} onClick={() => setTab('plans')}>📋 All Plans</button>
        <button style={S.tab(tab === 'roadmap')} onClick={() => setTab('roadmap')}>{t('planning.tab_roadmap')}</button>
      </div>
      <div style={S.content}>
        {tab === 'dashboard' && <DashboardTab dashboard={dashboard} onOpenPlans={() => setTab('plans')} onOpenInitiative={(planId: string) => openPlan(planId, 'initiatives')} />}
        {tab === 'plans' && <PlansListTab api={api} onOpen={openPlan} />}
        {tab === 'roadmap' && <RoadmapTab api={api} t={t} />}
      </div>
    </div>
  )
}

// ── Roadmap ──────────────────────────────────────────────────────────────────
function RoadmapTab({ api, t }: { api: any, t: (k: string) => string }) {
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
          <option value="">All</option>
          {DOMAINS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
        </select>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-dim)' }}>Loading…</div>
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
                {item.periodStart && <div>{new Date(item.periodStart).toLocaleDateString()} → {item.periodEnd ? new Date(item.periodEnd).toLocaleDateString() : '?'}</div>}
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
function DashboardTab({ dashboard, onOpenPlans, onOpenInitiative }: { dashboard: any, onOpenPlans: () => void, onOpenInitiative: (planId: string) => void }) {
  if (!dashboard) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>
  const needsAttention: any[] = dashboard.needsAttention || []
  return (
    <div>
      <div className="stat-grid-4">
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Total Plans</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard.total}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Active</div><div style={{ fontSize: 28, fontWeight: 700, color: '#2ecc71' }}>{dashboard.active}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Avg Progress</div><div style={{ fontSize: 28, fontWeight: 700 }}>{dashboard.avgProgress}%</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Needs Attention</div><div style={{ fontSize: 28, fontWeight: 700, color: needsAttention.length > 0 ? '#e74c3c' : undefined }}>{needsAttention.length}</div></div>
      </div>

      {dashboard.initiativesTotal > 0 && (
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Initiative Health ({dashboard.initiativesTotal} initiatives across all plans)</div>
          <div style={{ display: 'flex', gap: 8, height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 10 }}>
            {Object.entries(dashboard.initiativesByHealth || {}).map(([h, c]: any) => c > 0 && (
              <div key={h} title={`${h}: ${c}`} style={{ flex: c, background: HEALTH_COLOR[h] }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {Object.entries(dashboard.initiativesByHealth || {}).map(([h, c]: any) => (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: HEALTH_COLOR[h] }} />{h.replace('_', ' ')}: <b>{c}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>⚠ Needs Attention</div>
        {needsAttention.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Nothing needs attention right now.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {needsAttention.slice(0, 12).map((n: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }} onClick={() => onOpenInitiative(n.planId)}>
                <span style={S.badge(n.type === 'UNASSIGNED_OWNER' ? '#7f8c8d' : '#e74c3c')}>{NEEDS_ATTENTION_LABEL[n.type] || n.type}</span>
                <div style={{ flex: 1 }}>{n.title}</div>
                <div style={{ color: 'var(--text-dim)' }}>{n.planName}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...S.grid2, marginTop: 16 }}>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>By Status</div>
          {Object.entries(dashboard.byStatus).map(([status, count]: any) => (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={S.badge(STATUS_COLOR[status])}>{status}</span>
              <div style={{ flex: 1, height: 6, background: 'var(--navy)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${dashboard.total ? (count / dashboard.total) * 100 : 0}%`, height: '100%', background: STATUS_COLOR[status] }} />
              </div>
              <div style={{ fontSize: 12, width: 24, textAlign: 'right' }}>{count}</div>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>By Plan Type</div>
          {Object.entries(dashboard.byType).length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No plans yet.</div> : Object.entries(dashboard.byType).map(([type, count]: any) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
              <div>{type}</div><div style={{ fontWeight: 600 }}>{count}</div>
            </div>
          ))}
        </div>
      </div>
      <button style={{ ...S.btn(), marginTop: 16 }} onClick={onOpenPlans}>View All Plans →</button>
    </div>
  )
}

// ── Plans List ───────────────────────────────────────────────────────────────
function PlansListTab({ api, onOpen }: { api: any, onOpen: (id: string) => void }) {
  const [plans, setPlans] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')

  const load = useCallback(() => {
    const q = statusFilter ? `?status=${statusFilter}` : ''
    api.get(`/ea-planning/plans${q}`).then((d: any) => setPlans(Array.isArray(d) ? d : []))
  }, [api, statusFilter])
  useEffect(() => { load() }, [load])

  const remove = async (e: React.MouseEvent, id: string) => { e.stopPropagation(); if (!window.confirm('Delete this plan?')) return; await api.del(`/ea-planning/plans/${id}`); load() }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <select style={{ ...S.input, width: 200, marginBottom: 0 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {plans.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No plans found.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {plans.map(p => (
            <div key={p.id} style={{ ...S.card, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => onOpen(p.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{p.nameEn}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{p.planType?.nameEn} · {p.periodLabel || 'No period set'} · {FREQ_LABEL[p.frequency] || p.frequency}</div>
              </div>
              <div style={{ width: 80 }}>
                <div style={{ height: 6, background: 'var(--navy)', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${p.progressPct || 0}%`, height: '100%', background: 'var(--accent)' }} /></div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, textAlign: 'center' }}>{p.progressPct || 0}%</div>
              </div>
              <span style={S.badge(STATUS_COLOR[p.status])}>{p.status}</span>
              <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={e => remove(e, p.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── New Plan Wizard (type cards → context → import previous → AI/create) ────
function NewPlanWizard({ api, planTypes, onCreated, onCancel }: { api: any, planTypes: any[], onCreated: (p: any) => void, onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ planTypeId: '', nameEn: '', nameAr: '', frequency: 'ANNUAL', periodLabel: '', domains: [] as string[], userContext: '' })
  const [generated, setGenerated] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [previousPlans, setPreviousPlans] = useState<any[]>([])
  const [importFromId, setImportFromId] = useState('')
  const [importObjectives, setImportObjectives] = useState<any[]>([])
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())
  const [importIncludeInitiatives, setImportIncludeInitiatives] = useState(true)

  const selectedType = planTypes.find(t => t.id === form.planTypeId)

  const toggleDomain = (d: string) => setForm(f => ({ ...f, domains: f.domains.includes(d) ? f.domains.filter(x => x !== d) : [...f.domains, d] }))

  useEffect(() => {
    if (step !== 3 || !form.planTypeId) return
    api.get(`/ea-planning/plans?planTypeId=${form.planTypeId}`).then((d: any) => setPreviousPlans(Array.isArray(d) ? d.filter((p: any) => p.status !== 'CANCELLED') : []))
  }, [api, step, form.planTypeId])

  const pickImportSource = async (fromId: string) => {
    setImportFromId(fromId); setImportSelected(new Set())
    if (!fromId) { setImportObjectives([]); return }
    const objs = await api.get(`/ea-planning/plans/${fromId}/objectives`)
    setImportObjectives(Array.isArray(objs) ? objs : [])
  }
  const toggleImportObjective = (id: string) => setImportSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const generate = async () => {
    if (!selectedType) return alert('Select a plan type first')
    setGenerating(true)
    try {
      const result = await api.post('/ea-planning/generate', { planTypeId: form.planTypeId, planTypeName: selectedType.nameEn, frequency: form.frequency, periodLabel: form.periodLabel, domains: form.domains, userContext: form.userContext })
      setGenerated(result)
      if (!form.nameEn) setForm(f => ({ ...f, nameEn: `${selectedType.nameEn} — ${form.periodLabel || new Date().getFullYear()}` }))
    } catch (e: any) { alert(e.message) } finally { setGenerating(false) }
  }

  const create = async () => {
    if (!form.planTypeId || !form.nameEn) return alert('Plan type and name are required')
    setSaving(true)
    try {
      const created = await api.post('/ea-planning/plans', {
        planTypeId: form.planTypeId, nameEn: form.nameEn, nameAr: form.nameAr || undefined,
        frequency: form.frequency, periodLabel: form.periodLabel || undefined, domains: form.domains,
        objectives: generated?.objectives, scope: generated?.scope,
        activities: generated?.activities || [], deliverables: generated?.deliverables || [],
        kpis: generated?.kpis || [], risks: generated?.risks || [],
      })
      if (importFromId && importSelected.size > 0) {
        await api.post(`/ea-planning/plans/${created.id}/import-objectives`, {
          fromPlanId: importFromId, objectiveIds: Array.from(importSelected), includeInitiatives: importIncludeInitiatives,
        })
      }
      onCreated(created)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const StepBar = () => (
    <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
      {['Plan Type', 'Context', 'Import Previous Work', 'Review & Create'].map((label, i) => (
        <div key={label} style={{ flex: 1, textAlign: 'center' as const, fontSize: 11, padding: '6px 4px', borderRadius: 6, background: step === i + 1 ? 'var(--accent)' : 'var(--navy-mid)', color: step === i + 1 ? 'var(--navy)' : 'var(--text-dim)', fontWeight: step === i + 1 ? 700 : 400 }}>
          {i + 1 < step ? '✓ ' : ''}{label}
        </div>
      ))}
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onCancel}>← Cancel</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>New EA Plan</div>
      </div>
      <div style={S.content}>
        <div style={{ maxWidth: 720 }}>
          <StepBar />

          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 12 }}>What kind of plan are you creating?</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {planTypes.map(t => (
                  <div key={t.id} style={{ ...S.card, marginBottom: 0, cursor: 'pointer', border: form.planTypeId === t.id ? '2px solid var(--accent)' : '1px solid var(--border)' }} onClick={() => setForm(f => ({ ...f, planTypeId: t.id }))}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.nameEn}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{t.nameAr}</div>
                  </div>
                ))}
              </div>
              <button style={S.btn('primary')} disabled={!form.planTypeId} onClick={() => setStep(2)}>Next: Define Context →</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={S.card}>
                <div style={S.grid2}>
                  <div><div style={S.label}>Frequency</div>
                    <select style={S.input} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                      {Object.entries(FREQ_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </div>
                  <div><div style={S.label}>Period Label</div><input style={S.input} placeholder="e.g. FY2026" value={form.periodLabel} onChange={e => setForm(f => ({ ...f, periodLabel: e.target.value }))} /></div>
                  <div><div style={S.label}>Name (EN) *</div><input style={S.input} placeholder="Plan name" value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} /></div>
                  <div><div style={S.label}>Name (AR)</div><input style={S.input} dir="rtl" placeholder="اسم الخطة" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
                </div>
                <div style={S.label}>EA Domains in Scope</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                  {DOMAINS.map(d => (
                    <button key={d} style={{ ...S.badge(form.domains.includes(d) ? '#00b4d8' : '#7f8c8d'), cursor: 'pointer', border: 'none' }} onClick={() => toggleDomain(d)}>{d.replace('_', ' ')}</button>
                  ))}
                </div>
                <div style={S.label}>Additional Context (optional, for AI generation)</div>
                <input style={S.input} placeholder="Any specific focus areas or constraints…" value={form.userContext} onChange={e => setForm(f => ({ ...f, userContext: e.target.value }))} />
              </div>
              <div style={S.row}>
                <button style={S.btn()} onClick={() => setStep(1)}>← Back</button>
                <button style={S.btn('primary')} disabled={!form.nameEn} onClick={() => setStep(3)}>Next: Import Previous Work →</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={S.card}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Import outstanding objectives from a previous plan</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 10 }}>Optional. You choose exactly what comes across - nothing is copied automatically.</div>
                {previousPlans.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No previous plans of this type to import from.</div>
                ) : (
                  <>
                    <select style={S.input} value={importFromId} onChange={e => pickImportSource(e.target.value)}>
                      <option value="">Don't import - start fresh</option>
                      {previousPlans.map(p => <option key={p.id} value={p.id}>{p.nameEn} ({p.periodLabel || p.status})</option>)}
                    </select>
                    {importFromId && (
                      <>
                        {importObjectives.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>That plan has no objectives to import.</div> : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                            {importObjectives.map((o: any) => (
                              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0' }}>
                                <input type="checkbox" checked={importSelected.has(o.id)} onChange={() => toggleImportObjective(o.id)} />
                                {o.title} <span style={{ color: 'var(--text-dim)' }}>({o.status.replace('_', ' ')})</span>
                              </label>
                            ))}
                          </div>
                        )}
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <input type="checkbox" checked={importIncludeInitiatives} onChange={e => setImportIncludeInitiatives(e.target.checked)} />
                          Also bring across their open (not completed/cancelled) initiatives
                        </label>
                      </>
                    )}
                  </>
                )}
              </div>
              <div style={S.row}>
                <button style={S.btn()} onClick={() => setStep(2)}>← Back</button>
                <button style={S.btn('primary')} onClick={() => setStep(4)}>Next: Review & Create →</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={S.card}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>{form.nameEn}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{selectedType?.nameEn} · {FREQ_LABEL[form.frequency]} · {form.periodLabel || 'No period set'}</div>
                {importSelected.size > 0 && <div style={{ fontSize: 12, marginTop: 6 }}>Will import {importSelected.size} objective{importSelected.size === 1 ? '' : 's'} from {previousPlans.find(p => p.id === importFromId)?.nameEn}</div>}
                <button style={{ ...S.btn('primary'), marginTop: 12, marginBottom: 10 }} onClick={generate} disabled={generating}>{generating ? '⏳ Generating with AI…' : '✨ Generate Plan Content with AI'}</button>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Generates objectives, activities, deliverables, KPIs, and risks aligned to NORA 2.0. You can review and edit everything after creating the plan.</div>
              </div>

              {generated && (
                <div style={S.card}>
                  <div style={{ fontWeight: 600, marginBottom: 10 }}>✨ AI-Generated Preview</div>
                  <div style={S.label}>Objectives</div><div style={{ fontSize: 12, marginBottom: 10 }}>{generated.objectives}</div>
                  <div style={S.label}>Scope</div><div style={{ fontSize: 12, marginBottom: 10 }}>{generated.scope}</div>
                  <div style={S.label}>{(generated.activities || []).length} activities · {(generated.deliverables || []).length} deliverables · {(generated.kpis || []).length} KPIs · {(generated.risks || []).length} risks generated</div>
                </div>
              )}
              <div style={S.row}>
                <button style={S.btn()} onClick={() => setStep(3)}>← Back</button>
                <button style={S.btn('primary')} onClick={create} disabled={saving}>{saving ? 'Creating…' : generated ? '💾 Create Plan with Generated Content' : '💾 Create Plan'}</button>
              </div>
            </div>
          )}
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
function PlanDetail({ api, plan, initialTab, onBack, onRefresh }: { api: any, plan: any, initialTab?: string, onBack: () => void, onRefresh: () => void }) {
  const { t } = useLang()
  const [detailTab, setDetailTab] = useState<'overview' | 'objectives' | 'initiatives' | 'kpis' | 'content'>((initialTab as any) || 'overview')
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
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{plan.nameEn}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={S.badge(STATUS_COLOR[plan.status])}>{plan.status}</span>
            <span style={S.badge('#7f8c8d')}>{plan.planType?.nameEn}</span>
          </div>
        </div>
        <div style={S.row}>
          <button style={S.btn()} onClick={() => downloadFile('docx')}>📄 Export Word</button>
          <button style={S.btn()} onClick={() => downloadFile('pptx')}>📊 Export PowerPoint</button>
          {!editing ? <button style={S.btn('primary')} onClick={() => { setForm({ ...plan }); setEditing(true) }}>✏ Edit</button> : (
            <>
              <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? 'Saving…' : '💾 Save'}</button>
              <button style={S.btn()} onClick={() => setEditing(false)}>Cancel</button>
            </>
          )}
        </div>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(detailTab === 'overview')} onClick={() => setDetailTab('overview')}>Overview</button>
        <button style={S.tab(detailTab === 'objectives')} onClick={() => setDetailTab('objectives')}>🎯 Objectives ({plan.objectiveItems?.length ?? 0})</button>
        <button style={S.tab(detailTab === 'initiatives')} onClick={() => setDetailTab('initiatives')}>🚀 Initiatives ({plan.initiatives?.length ?? 0})</button>
        <button style={S.tab(detailTab === 'kpis')} onClick={() => setDetailTab('kpis')}>📈 KPIs ({plan.kpiItems?.length ?? 0})</button>
        <button style={S.tab(detailTab === 'content')} onClick={() => setDetailTab('content')}>📋 Plan Content</button>
      </div>
      {detailTab === 'objectives' && <div style={S.content}><ObjectivesTab api={api} plan={plan} onRefresh={onRefresh} /></div>}
      {detailTab === 'initiatives' && <div style={S.content}><InitiativesTab api={api} plan={plan} onRefresh={onRefresh} t={t} /></div>}
      {detailTab === 'kpis' && <div style={S.content}><KPIsTab api={api} plan={plan} onRefresh={onRefresh} /></div>}
      {detailTab === 'overview' && (
      <div style={S.content}>
        <div style={S.grid3}>
          <div style={S.card}>
            <div style={S.label}>Status</div>
            {editing ? <select style={S.input} value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}>{Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s}</option>)}</select> : <div style={{ fontSize: 13 }}>{plan.status}</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>Owner</div>
            {editing ? <input style={S.input} value={form.owner || ''} onChange={e => setForm((f: any) => ({ ...f, owner: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.owner || '—'}</div>}
          </div>
          <div style={S.card}>
            <div style={S.label}>Progress ({editing ? form.progressPct : plan.progressPct}%)</div>
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
          <div style={S.label}>Objectives Narrative <span style={{ fontWeight: 400, color: 'var(--text-dim)' }}>(free-form summary - see the Objectives tab for trackable objectives)</span></div>
          {editing ? <textarea style={{ ...S.input, minHeight: 60 }} value={form.objectives || ''} onChange={e => setForm((f: any) => ({ ...f, objectives: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.objectives || 'Not defined.'}</div>}
        </div>
        <div style={S.card}>
          <div style={S.label}>Scope</div>
          {editing ? <textarea style={{ ...S.input, minHeight: 60 }} value={form.scope || ''} onChange={e => setForm((f: any) => ({ ...f, scope: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.scope || 'Not defined.'}</div>}
        </div>
      </div>
      )}
      {detailTab === 'content' && (
      <div style={S.content}>
        {/* Activities */}
        <div style={{ ...S.card, marginTop: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Key Activities ({activities.length})</div>
          {activities.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={a.name || ''} onChange={e => updateListItem('activities', i, { name: e.target.value })} placeholder="Activity name" />
                <select style={{ ...S.input, marginBottom: 0, width: 100 }} value={a.priority || 'MEDIUM'} onChange={e => updateListItem('activities', i, { priority: e.target.value })}>{['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{p}</option>)}</select>
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('activities', i)}>✕</button>
              </> : <>
                <span style={S.badge(PRIORITY_COLOR[a.priority] || '#7f8c8d')}>{a.priority || 'MEDIUM'}</span>
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
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('activities', { name: '', priority: 'MEDIUM' })}>+ Add Activity</button>}
        </div>

        {/* Deliverables */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Expected Deliverables ({deliverables.length})</div>
          {deliverables.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={d.name || ''} onChange={e => updateListItem('deliverables', i, { name: e.target.value })} placeholder="Deliverable name" />
                <input style={{ ...S.input, marginBottom: 0, width: 120 }} value={d.dueTimeframe || ''} onChange={e => updateListItem('deliverables', i, { dueTimeframe: e.target.value })} placeholder="Due" />
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('deliverables', i)}>✕</button>
              </> : <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1 }}>{d.name} {d.type ? `— ${d.type}` : ''}{d.dueTimeframe ? `, due ${d.dueTimeframe}` : ''}</span>
                <AssetLinkControl item={d} field="deliverables" isPicking={pickingAssetFor?.field === 'deliverables' && pickingAssetFor?.itemId === d.id}
                  onStartPick={() => setPickingAssetFor({ field: 'deliverables', itemId: d.id })}
                  onPick={(asset) => linkItemAsset('deliverables', d.id, asset)}
                  onCancelPick={() => setPickingAssetFor(null)}
                  onUnlink={() => unlinkItemAsset('deliverables', d.id)}
                  api={api} t={t} />
              </div>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('deliverables', { name: '' })}>+ Add Deliverable</button>}
        </div>

        {/* KPIs */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>KPIs ({kpis.length})</div>
          {kpis.map((k: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={k.name || ''} onChange={e => updateListItem('kpis', i, { name: e.target.value })} placeholder="KPI name" />
                <input style={{ ...S.input, marginBottom: 0, width: 100 }} value={k.target || ''} onChange={e => updateListItem('kpis', i, { target: e.target.value })} placeholder="Target" />
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('kpis', i)}>✕</button>
              </> : <div style={{ flex: 1 }}>{k.name} | Target: {k.target || 'TBD'}</div>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('kpis', { name: '' })}>+ Add KPI</button>}
        </div>

        {/* Risks */}
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Risks ({risks.length})</div>
          {risks.map((r: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              {editing ? <>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} value={r.name || ''} onChange={e => updateListItem('risks', i, { name: e.target.value })} placeholder="Risk name" />
                <select style={{ ...S.input, marginBottom: 0, width: 100 }} value={r.severity || 'MEDIUM'} onChange={e => updateListItem('risks', i, { severity: e.target.value })}>{['HIGH','MEDIUM','LOW'].map(p => <option key={p} value={p}>{p}</option>)}</select>
                <button style={{ ...S.btn('danger'), fontSize: 10, padding: '4px 8px' }} onClick={() => removeListItem('risks', i)}>✕</button>
              </> : <>
                <span style={S.badge(PRIORITY_COLOR[r.severity] || '#7f8c8d')}>{r.severity || 'MEDIUM'}</span>
                <div style={{ flex: 1 }}>{r.name}{r.mitigation ? ` — Mitigation: ${r.mitigation}` : ''}</div>
              </>}
            </div>
          ))}
          {editing && <button style={{ ...S.btn(), fontSize: 11, marginTop: 8 }} onClick={() => addListItem('risks', { name: '', severity: 'MEDIUM' })}>+ Add Risk</button>}
        </div>

        <div style={S.card}>
          <div style={S.label}>Notes</div>
          {editing ? <textarea style={{ ...S.input, minHeight: 60 }} value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /> : <div style={{ fontSize: 13 }}>{plan.notes || 'None.'}</div>}
        </div>
      </div>
      )}
    </div>
  )
}

// ── Objectives Tab ───────────────────────────────────────────────────────────
function ObjectivesTab({ api, plan, onRefresh }: { api: any, plan: any, onRefresh: () => void }) {
  const objectives: any[] = plan.objectiveItems || []
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!title.trim()) return
    setSaving(true)
    try { await api.post(`/ea-planning/plans/${plan.id}/objectives`, { title }); setTitle(''); setAdding(false); onRefresh() }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  const setStatus = async (id: string, status: string) => { await api.patch(`/ea-planning/plans/${plan.id}/objectives/${id}`, { status }); onRefresh() }
  const remove = async (id: string) => { if (!window.confirm('Delete this objective? Initiatives pursuing it will be unlinked, not deleted.')) return; await api.del(`/ea-planning/plans/${plan.id}/objectives/${id}`); onRefresh() }

  return (
    <div>
      {objectives.length === 0 && !adding ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No objectives defined yet. Objectives are the "what are we trying to achieve" for this plan - initiatives then pursue them.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {objectives.map((o: any) => {
            const initiativeCount = (plan.initiatives || []).filter((i: any) => i.objectiveId === o.id).length
            return (
              <div key={o.id} style={{ ...S.card, marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{o.title}</div>
                    {o.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{o.description}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{initiativeCount} initiative{initiativeCount === 1 ? '' : 's'}{o.ownerId ? ` · Owner: ${o.ownerId}` : ''}</div>
                  </div>
                  <select style={{ ...S.input, marginBottom: 0, width: 140 }} value={o.status} onChange={e => setStatus(o.id, e.target.value)}>
                    {Object.keys(OBJ_STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => remove(o.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {adding ? (
        <div style={S.card}>
          <input style={S.input} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Objective title" onKeyDown={e => e.key === 'Enter' && create()} />
          <div style={S.row}>
            <button style={S.btn('primary')} onClick={create} disabled={saving || !title.trim()}>{saving ? 'Adding…' : 'Add Objective'}</button>
            <button style={S.btn()} onClick={() => { setAdding(false); setTitle('') }}>Cancel</button>
          </div>
        </div>
      ) : <button style={S.btn('primary')} onClick={() => setAdding(true)}>+ Add Objective</button>}
    </div>
  )
}

// ── KPIs Tab ─────────────────────────────────────────────────────────────────
const KPI_STATUS_COLOR: Record<string, string> = { ON_TRACK: '#2ecc71', AT_RISK: '#f39c12', ACHIEVED: '#3498db', MISSED: '#e74c3c' }
function KPIsTab({ api, plan, onRefresh }: { api: any, plan: any, onRefresh: () => void }) {
  const kpis: any[] = plan.kpiItems || []
  const [adding, setAdding] = useState(false)
  const [metric, setMetric] = useState('')
  const [target, setTarget] = useState('')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!metric.trim()) return
    setSaving(true)
    try {
      await api.post(`/ea-planning/plans/${plan.id}/kpis`, { metric, unit: unit || undefined, target: target ? Number(target) : undefined })
      setMetric(''); setTarget(''); setUnit(''); setAdding(false); onRefresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  const patch = async (id: string, data: any) => { await api.patch(`/ea-planning/plans/${plan.id}/kpis/${id}`, data); onRefresh() }
  const remove = async (id: string) => { if (!window.confirm('Delete this KPI?')) return; await api.del(`/ea-planning/plans/${plan.id}/kpis/${id}`); onRefresh() }

  return (
    <div>
      {kpis.length === 0 && !adding ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No KPIs defined yet. KPIs measure whether this plan is actually achieving its intended outcomes.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {kpis.map((k: any) => {
            const pct = (k.target != null && k.baseline != null && k.target !== k.baseline)
              ? Math.max(0, Math.min(100, Math.round(((k.currentValue ?? k.baseline) - k.baseline) / (k.target - k.baseline) * 100)))
              : null
            return (
              <div key={k.id} style={{ ...S.card, marginBottom: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{k.metric}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {k.baseline != null ? `Baseline ${k.baseline}${k.unit || ''} · ` : ''}
                      Current {k.currentValue != null ? `${k.currentValue}${k.unit || ''}` : '—'} · Target {k.target != null ? `${k.target}${k.unit || ''}` : 'TBD'}
                    </div>
                    {pct != null && <div style={{ height: 6, background: 'var(--navy)', borderRadius: 3, overflow: 'hidden', marginTop: 6, width: 200 }}><div style={{ width: `${pct}%`, height: '100%', background: KPI_STATUS_COLOR[k.status] }} /></div>}
                  </div>
                  <input style={{ ...S.input, marginBottom: 0, width: 90 }} type="number" placeholder="Current" defaultValue={k.currentValue ?? ''} onBlur={e => { const v = e.target.value; if (v !== '' && Number(v) !== k.currentValue) patch(k.id, { currentValue: Number(v) }) }} />
                  <select style={{ ...S.input, marginBottom: 0, width: 120 }} value={k.status} onChange={e => patch(k.id, { status: e.target.value })}>
                    {Object.keys(KPI_STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => remove(k.id)}>Delete</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {adding ? (
        <div style={S.card}>
          <input style={S.input} autoFocus value={metric} onChange={e => setMetric(e.target.value)} placeholder="Metric, e.g. % exceptions via governed workflow" onKeyDown={e => e.key === 'Enter' && create()} />
          <div style={S.grid2}>
            <input style={S.input} value={target} onChange={e => setTarget(e.target.value)} placeholder="Target value" type="number" />
            <input style={S.input} value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unit, e.g. %" />
          </div>
          <div style={S.row}>
            <button style={S.btn('primary')} onClick={create} disabled={saving || !metric.trim()}>{saving ? 'Adding…' : 'Add KPI'}</button>
            <button style={S.btn()} onClick={() => { setAdding(false); setMetric('') }}>Cancel</button>
          </div>
        </div>
      ) : <button style={S.btn('primary')} onClick={() => setAdding(true)}>+ Add KPI</button>}
    </div>
  )
}

// ── Prioritization panel (shown when an initiative row is expanded) ─────────
function PrioritizationPanel({ api, plan, initiative, onRefresh }: { api: any, plan: any, initiative: any, onRefresh: () => void }) {
  const [criteria, setCriteria] = useState<any[]>([])
  const [scores, setScores] = useState<Record<string, number>>(initiative.criterionScores || {})
  const [saving, setSaving] = useState(false)

  useEffect(() => { api.get('/ea-planning/prioritization-criteria').then((c: any) => setCriteria(Array.isArray(c) ? c : [])) }, [api])

  const save = async () => {
    setSaving(true)
    try { await api.patch(`/ea-planning/plans/${plan.id}/initiatives/${initiative.id}/score`, { criterionScores: scores }); onRefresh() }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, display: 'flex', alignItems: 'center' }}>⭐ Prioritization {initiative.priorityScore != null && <span style={{ ...S.badge('#00b4d8'), marginLeft: 8 }}>Score: {initiative.priorityScore}</span>}</div>
      {criteria.length === 0 ? <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading criteria…</div> : (
        <>
          {criteria.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ flex: 1, fontSize: 11 }}>{c.nameEn} <span style={{ color: 'var(--text-dim)' }}>(weight {c.weight})</span></div>
              <input type="range" min={0} max={100} value={scores[c.id] ?? 0} onChange={e => setScores(s => ({ ...s, [c.id]: Number(e.target.value) }))} style={{ width: 100 }} />
              <span style={{ fontSize: 11, width: 24, textAlign: 'right' as const }}>{scores[c.id] ?? 0}</span>
            </div>
          ))}
          <button style={{ ...S.btn('primary'), fontSize: 11, marginTop: 6 }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Score'}</button>
        </>
      )}
    </div>
  )
}

// ── Architecture Impact panel (shown when an initiative row is expanded) ────
function ArchitectureImpactPanel({ api, plan, initiative, onRefresh, t }: { api: any, plan: any, initiative: any, onRefresh: () => void, t: (k: string) => string }) {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/ea-planning/plans/${plan.id}/initiatives/${initiative.id}/impact`).then((r: any) => setAssets(r?.assets || [])).finally(() => setLoading(false))
  }, [api, plan.id, initiative.id])
  useEffect(() => { load() }, [load])

  const add = async (asset: any) => {
    setPicking(false)
    await api.post(`/ea-planning/plans/${plan.id}/initiatives/${initiative.id}/assets`, { assetId: asset.id })
    load(); onRefresh()
  }
  const remove = async (assetId: string) => {
    await api.del(`/ea-planning/plans/${plan.id}/initiatives/${initiative.id}/assets/${assetId}`)
    load(); onRefresh()
  }

  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>🏛 Architecture Impact</div>
      {loading ? <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading…</div> : (
        <>
          {assets.length === 0 ? <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>No architecture assets linked yet.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {assets.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ flex: 1 }}>{a.name}</span>
                  <span style={{ color: 'var(--text-dim)' }}>{a.assetType}</span>
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 11 }} onClick={() => remove(a.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
          {picking ? <AssetPicker api={api} t={t} onPick={add} onCancel={() => setPicking(false)} /> : (
            <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => setPicking(true)}>+ Link Asset</button>
          )}
        </>
      )}
    </div>
  )
}

// ── Initiatives Tab ──────────────────────────────────────────────────────────
function InitiativesTab({ api, plan, onRefresh, t }: { api: any, plan: any, onRefresh: () => void, t: (k: string) => string }) {
  const initiatives: any[] = plan.initiatives || []
  const objectives: any[] = plan.objectiveItems || []
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [objectiveId, setObjectiveId] = useState('')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const create = async () => {
    if (!title.trim()) return
    setSaving(true)
    try { await api.post(`/ea-planning/plans/${plan.id}/initiatives`, { title, objectiveId: objectiveId || undefined }); setTitle(''); setObjectiveId(''); setAdding(false); onRefresh() }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  const patch = async (id: string, data: any) => { await api.patch(`/ea-planning/plans/${plan.id}/initiatives/${id}`, data); onRefresh() }
  const remove = async (id: string) => { if (!window.confirm('Delete this initiative?')) return; await api.del(`/ea-planning/plans/${plan.id}/initiatives/${id}`); onRefresh() }
  const objectiveTitle = (id?: string) => objectives.find(o => o.id === id)?.title

  return (
    <div>
      {initiatives.length === 0 && !adding ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No initiatives yet. Initiatives are the concrete work items pursuing this plan's objectives.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {initiatives.map((i: any) => (
            <div key={i.id} style={{ ...S.card, marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpanded(expanded === i.id ? null : i.id)}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{expanded === i.id ? '▾' : '▸'} {i.title}</div>
                  {i.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{i.description}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, display: 'flex', gap: 10 }}>
                    {i.objectiveId && <span>🎯 {objectiveTitle(i.objectiveId) || 'Linked objective'}</span>}
                    {i.ownerId ? <span>👤 {i.ownerId}</span> : <span style={{ color: '#e74c3c' }}>👤 No owner</span>}
                    {i.endDate && <span>📅 Due {new Date(i.endDate).toLocaleDateString()}</span>}
                    {i.priorityScore != null && <span>⭐ Priority {i.priorityScore}</span>}
                    {(i.linkedAssetIds || []).length > 0 && <span>🏛 {i.linkedAssetIds.length} asset{i.linkedAssetIds.length === 1 ? '' : 's'}</span>}
                  </div>
                </div>
                <span style={S.badge(HEALTH_COLOR[i.health] || '#7f8c8d')}>{i.health.replace('_', ' ')}</span>
                <select style={{ ...S.input, marginBottom: 0, width: 130 }} value={i.status} onChange={e => patch(i.id, { status: e.target.value })}>
                  {Object.keys(INIT_STATUS_COLOR).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
                <select style={{ ...S.input, marginBottom: 0, width: 110 }} value={i.health} onChange={e => patch(i.id, { health: e.target.value })}>
                  {Object.keys(HEALTH_COLOR).map(h => <option key={h} value={h}>{h.replace('_', ' ')}</option>)}
                </select>
                <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => remove(i.id)}>Delete</button>
              </div>
              {expanded === i.id && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <PrioritizationPanel api={api} plan={plan} initiative={i} onRefresh={onRefresh} />
                  <ArchitectureImpactPanel api={api} plan={plan} initiative={i} onRefresh={onRefresh} t={t} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {adding ? (
        <div style={S.card}>
          <input style={S.input} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Initiative title" onKeyDown={e => e.key === 'Enter' && create()} />
          {objectives.length > 0 && (
            <select style={S.input} value={objectiveId} onChange={e => setObjectiveId(e.target.value)}>
              <option value="">No linked objective</option>
              {objectives.map(o => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          )}
          <div style={S.row}>
            <button style={S.btn('primary')} onClick={create} disabled={saving || !title.trim()}>{saving ? 'Adding…' : 'Add Initiative'}</button>
            <button style={S.btn()} onClick={() => { setAdding(false); setTitle(''); setObjectiveId('') }}>Cancel</button>
          </div>
        </div>
      ) : <button style={S.btn('primary')} onClick={() => setAdding(true)}>+ Add Initiative</button>}
    </div>
  )
}
