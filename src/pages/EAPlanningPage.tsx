import { useEffect, useState, useCallback } from 'react'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const h = (json = true) => {
    const headers: Record<string, string> = { Authorization: 'Bearer ' + token() }
    if (json) headers['Content-Type'] = 'application/json'
    return headers
  }
  const get  = (p: string) => fetch(API_URL + p, { headers: h(false) }).then(r => r.json())
  const post = (p: string, b?: any) => fetch(API_URL + p, { method: 'POST',  headers: h(), body: b ? JSON.stringify(b) : undefined }).then(r => r.json())
  const patch= (p: string, b?: any) => fetch(API_URL + p, { method: 'PATCH', headers: h(), body: b ? JSON.stringify(b) : undefined }).then(r => r.json())
  const del  = (p: string) => fetch(API_URL + p, { method: 'DELETE', headers: h(false) })
  const dl   = (p: string, name: string) => fetch(API_URL + p, { headers: h(false) })
    .then(r => r.blob()).then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click() })
  return { get, post, patch, del, dl }
}

const EA_DOMAINS = ['Business Architecture','Application Architecture','Data Architecture','Technology Architecture','Security Architecture','Integration Architecture']
const FREQUENCIES = ['ANNUAL','SEMI_ANNUAL','QUARTERLY','ON_DEMAND']
const FREQ_LABEL: Record<string,string> = { ANNUAL:'Annual', SEMI_ANNUAL:'Semi-Annual', QUARTERLY:'Quarterly', ON_DEMAND:'On-Demand' }
const STATUSES = ['DRAFT','ACTIVE','COMPLETED','CANCELLED']
const STATUS_COLOR: Record<string,string> = { DRAFT:'var(--text-dim)', ACTIVE:'var(--success)', COMPLETED:'var(--accent)', CANCELLED:'var(--danger)' }
const STATUS_BADGE: Record<string,string> = { DRAFT:'badge-draft', ACTIVE:'badge-active', COMPLETED:'badge-complete', CANCELLED:'badge-draft' }
const RISK_COLOR: Record<string,string> = { LOW:'var(--success)', MEDIUM:'var(--warning)', HIGH:'#e67e22', CRITICAL:'var(--danger)' }
const PRIORITY_COLOR: Record<string,string> = { LOW:'var(--text-dim)', MEDIUM:'var(--warning)', HIGH:'#e67e22', CRITICAL:'var(--danger)' }

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: 'var(--navy)', borderRadius: 2, height: 6, width: '100%' }}>
      <div style={{ width: Math.min(100, pct || 0) + '%', height: '100%', background: pct >= 100 ? 'var(--success)' : 'var(--accent)', transition: 'width 0.3s' }} />
    </div>
  )
}

function StatCard({ label, value, color }: { label: string, value: any, color?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}

function DashboardView({ onNew }: { onNew: () => void }) {
  const api = useApi()
  const [stats, setStats] = useState<any>(null)
  useEffect(() => { api.get('/ea-planning/dashboard').then(setStats) }, [])
  if (!stats) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  return (
    <div className="page-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div className="section-title">EA Planning Overview</div>
          <div className="text-dim text-sm">Real-time view of all EA plans</div>
        </div>
        <button className="btn btn-primary" onClick={onNew}>+ New EA Plan</button>
      </div>
      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard label="Total Plans"  value={stats.total} />
        <StatCard label="Active Plans" value={stats.active}    color="var(--success)" />
        <StatCard label="Completed"    value={stats.completed} color="var(--accent)" />
        <StatCard label="Avg Progress" value={stats.avgProgress + '%'} />
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Plans by Status</div>
          {Object.entries(stats.byStatus || {}).map(([s, c]: any) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLOR[s] || 'var(--text-dim)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, flex: 1 }}>{s.replace(/_/g,' ')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent)' }}>{c}</span>
              <div style={{ width: 80 }}><ProgressBar pct={stats.total ? (c / stats.total) * 100 : 0} /></div>
            </div>
          ))}
          {stats.highRisk > 0 && (
            <div style={{ marginTop: 16, padding: '8px 12px', background: 'rgba(231,76,60,0.1)', border: '1px solid rgba(231,76,60,0.2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--danger)' }}>
              {stats.highRisk} plan{stats.highRisk > 1 ? 's' : ''} with high/critical risks
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}>Plans by Type</div>
          {Object.keys(stats.byType || {}).length === 0
            ? <div className="text-dim text-sm">No plans yet</div>
            : Object.entries(stats.byType || {}).map(([t, c]: any) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, flex: 1, color: 'var(--text-dim)' }}>{t}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--gold)' }}>{c}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}

function PlansListView({ onNew, onView }: { onNew: () => void, onView: (p: any) => void }) {
  const api = useApi()
  const [plans, setPlans]     = useState<any[]>([])
  const [types, setTypes]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFT]   = useState('')
  const [filterStatus, setFS] = useState('')
  const [filterDomain, setFD] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType)   params.set('planTypeId', filterType)
    if (filterStatus) params.set('status', filterStatus)
    if (filterDomain) params.set('domain', filterDomain)
    const qs = params.toString()
    Promise.all([
      api.get('/ea-planning/plans' + (qs ? '?' + qs : '')),
      api.get('/ea-planning/plan-types'),
    ]).then(([p, t]) => { setPlans(Array.isArray(p) ? p : []); setTypes(Array.isArray(t) ? t : []) })
      .finally(() => setLoading(false))
  }, [filterType, filterStatus, filterDomain])

  useEffect(() => { load() }, [load])

  const deletePlan = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this plan?')) return
    await api.del('/ea-planning/plans/' + id)
    load()
  }

  return (
    <div className="page-body">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="section-title">EA Plans</div>
        <button className="btn btn-primary" onClick={onNew}>+ New EA Plan</button>
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select className="form-input" style={{ width: 200 }} value={filterType} onChange={e => setFT(e.target.value)}>
          <option value="">All Plan Types</option>
          {types.map((t: any) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}
        </select>
        <select className="form-input" style={{ width: 160 }} value={filterStatus} onChange={e => setFS(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
        <select className="form-input" style={{ width: 220 }} value={filterDomain} onChange={e => setFD(e.target.value)}>
          <option value="">All Domains</option>
          {EA_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {loading
        ? <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        : plans.length === 0
          ? <div className="empty">
              <div style={{ fontSize: 40 }}>📋</div>
              <div className="empty-title">No EA Plans Yet</div>
              <div className="empty-sub">Create your first EA plan to get started</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onNew}>+ New EA Plan</button>
            </div>
          : <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Plan Name</th><th>Type</th><th>Period</th><th>Owner</th><th>Status</th><th>Progress</th><th>Updated</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p: any) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => onView(p)}>
                      <td style={{ fontWeight: 500, maxWidth: 220 }}>
                        <div className="truncate">{p.nameEn}</div>
                        {p.domains?.length > 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{p.domains.slice(0,2).join(', ')}{p.domains.length > 2 ? ' +' + (p.domains.length - 2) : ''}</div>}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 160 }}><div className="truncate">{p.planType?.nameEn || '—'}</div></td>
                      <td style={{ fontSize: 12 }}>{p.periodLabel || '—'}</td>
                      <td style={{ fontSize: 12 }}>{p.owner || '—'}</td>
                      <td><span className={'badge ' + (STATUS_BADGE[p.status] || 'badge-draft')}>{p.status}</span></td>
                      <td style={{ minWidth: 100 }}>
                        <div style={{ fontSize: 11, marginBottom: 4 }}>{p.progressPct || 0}%</div>
                        <ProgressBar pct={p.progressPct || 0} />
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(p.updatedAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onView(p) }}>View</button>
                          <button className="btn btn-sm" style={{ background: 'rgba(231,76,60,0.1)', color: 'var(--danger)', border: '1px solid rgba(231,76,60,0.2)' }} onClick={e => deletePlan(e, p.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
      }
    </div>
  )
}

function PlanForm({ plan, onSave, onCancel }: { plan?: any, onSave: (p: any) => void, onCancel: () => void }) {
  const api = useApi()
  const [types, setTypes]     = useState<any[]>([])
  const [saving, setSaving]   = useState(false)
  const [generating, setGen]  = useState(false)
  const [aiContext, setAiCtx] = useState('')
  const [aiError, setAiError] = useState('')
  const [form, setForm] = useState({
    planTypeId:   plan?.planTypeId   || '',
    nameEn:       plan?.nameEn       || '',
    nameAr:       plan?.nameAr       || '',
    status:       plan?.status       || 'DRAFT',
    frequency:    plan?.frequency    || 'ANNUAL',
    periodLabel:  plan?.periodLabel  || '',
    owner:        plan?.owner        || '',
    domains:      (plan?.domains     || []) as string[],
    objectives:   plan?.objectives   || '',
    scope:        plan?.scope        || '',
    activities:   (plan?.activities  || []) as any[],
    deliverables: (plan?.deliverables|| []) as any[],
    kpis:         (plan?.kpis        || []) as any[],
    risks:        (plan?.risks       || []) as any[],
    notes:        plan?.notes        || '',
    progressPct:  plan?.progressPct  ?? 0,
  })

  useEffect(() => { api.get('/ea-planning/plan-types').then(t => setTypes(Array.isArray(t) ? t : [])) }, [])

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const toggleDomain = (d: string) =>
    set('domains', form.domains.includes(d) ? form.domains.filter((x: string) => x !== d) : [...form.domains, d])

  const generateWithAI = async () => {
    if (!form.planTypeId) { setAiError('Select a plan type first'); return }
    const pt = types.find(t => t.id === form.planTypeId)
    setGen(true); setAiError('')
    try {
      const result = await api.post('/ea-planning/generate', {
        planTypeId: form.planTypeId, planTypeName: pt?.nameEn || '',
        frequency: form.frequency, periodLabel: form.periodLabel,
        domains: form.domains, userContext: aiContext,
      })
      if (result.objectives)   set('objectives',  result.objectives)
      if (result.scope)        set('scope',        result.scope)
      if (result.activities)   set('activities',   result.activities)
      if (result.deliverables) set('deliverables', result.deliverables)
      if (result.kpis)         set('kpis',         result.kpis)
      if (result.risks)        set('risks',        result.risks)
      if (result.progressTrackingApproach && !form.notes)
        set('notes', 'Progress Tracking Approach:
' + result.progressTrackingApproach)
    } catch (e: any) {
      setAiError('AI generation failed: ' + e.message)
    } finally { setGen(false) }
  }

  const submit = async () => {
    if (!form.planTypeId || !form.nameEn) return
    setSaving(true)
    try {
      const result = plan?.id
        ? await api.patch('/ea-planning/plans/' + plan.id, form)
        : await api.post('/ea-planning/plans', form)
      onSave(result)
    } finally { setSaving(false) }
  }

  const selectedType = types.find(t => t.id === form.planTypeId)
  const arrSet = (field: string, arr: any[], i: number, patch: any) => {
    const next = [...arr]; next[i] = { ...next[i], ...patch }; set(field, next)
  }
  const arrDel = (field: string, arr: any[], i: number) => set(field, arr.filter((_: any, j: number) => j !== i))

  return (
    <div className="page-body">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>Back</button>
        <div className="section-title" style={{ margin: 0 }}>{plan?.id ? 'Edit EA Plan' : 'New EA Plan'}</div>
      </div>
      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 16 }}>Plan Identity</div>
            <div className="form-group">
              <label className="form-label">Plan Type *</label>
              <select className="form-input" value={form.planTypeId} onChange={e => set('planTypeId', e.target.value)}>
                <option value="">Select plan type...</option>
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.nameEn}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Plan Name (EN) *</label>
              <input className="form-input" value={form.nameEn} onChange={e => set('nameEn', e.target.value)} placeholder="e.g. Annual EA Master Plan 2025" />
            </div>
            <div className="form-group">
              <label className="form-label">Plan Name (AR)</label>
              <input className="form-input" value={form.nameAr} onChange={e => set('nameAr', e.target.value)} placeholder="اسم الخطة بالعربية" dir="rtl" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frequency</label>
                <select className="form-input" value={form.frequency} onChange={e => set('frequency', e.target.value)}>
                  {FREQUENCIES.map(f => <option key={f} value={f}>{FREQ_LABEL[f]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Planning Period</label>
                <input className="form-input" value={form.periodLabel} onChange={e => set('periodLabel', e.target.value)} placeholder="e.g. 2025 / Q1 2025" />
              </div>
              <div className="form-group">
                <label className="form-label">Owner</label>
                <input className="form-input" value={form.owner} onChange={e => set('owner', e.target.value)} placeholder="EA Manager" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Progress ({form.progressPct}%)</label>
              <input type="range" min={0} max={100} value={form.progressPct} onChange={e => set('progressPct', parseInt(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
            </div>
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>EA Domains in Scope</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {EA_DOMAINS.map(d => (
                <button key={d} onClick={() => toggleDomain(d)} style={{
                  padding: '5px 12px', borderRadius: 'var(--radius)', fontSize: 12, cursor: 'pointer',
                  background: form.domains.includes(d) ? 'rgba(0,180,216,0.2)' : 'var(--navy)',
                  border: '1px solid ' + (form.domains.includes(d) ? 'var(--accent)' : 'var(--border)'),
                  color: form.domains.includes(d) ? 'var(--accent)' : 'var(--text-dim)',
                }}>{d}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="card" style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>✨</span>
            <div className="card-title" style={{ color: 'var(--gold)' }}>AI Plan Generator</div>
          </div>
          <div className="card-subtitle" style={{ marginBottom: 16 }}>Generate structured plan content aligned with NORA 2.0</div>
          {selectedType && (
            <div style={{ padding: '8px 12px', background: 'rgba(0,180,216,0.08)', borderRadius: 'var(--radius)', fontSize: 12, marginBottom: 12, color: 'var(--accent)' }}>
              {selectedType.nameEn}
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Additional Context (optional)</label>
            <textarea className="form-input" rows={5} value={aiContext} onChange={e => setAiCtx(e.target.value)}
              placeholder="Describe your organization context, current EA maturity, specific challenges, strategic priorities..." />
          </div>
          {aiError && <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{aiError}</div>}
          <button className="btn" style={{ width: '100%', background: generating ? 'transparent' : 'var(--gold)', color: generating ? 'var(--gold)' : 'var(--navy)', border: '1px solid var(--gold)' }}
            onClick={generateWithAI} disabled={generating || !form.planTypeId}>
            {generating ? 'Generating plan...' : 'Generate Plan with AI'}
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>Populates: Objectives, Scope, Activities, Deliverables, KPIs, Risks</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Objectives</div>
          <textarea className="form-input" rows={5} value={form.objectives} onChange={e => set('objectives', e.target.value)} placeholder="What are the main objectives of this EA plan?" />
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Scope</div>
          <textarea className="form-input" rows={5} value={form.scope} onChange={e => set('scope', e.target.value)} placeholder="What is in scope for this plan?" />
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">Key Activities ({form.activities.length})</div>
          <button className="btn btn-secondary btn-sm" onClick={() => set('activities', [...form.activities, { id: 'A' + Date.now(), name: '', description: '', owner: '', timeframe: '', priority: 'MEDIUM' }])}>+ Add</button>
        </div>
        {form.activities.length === 0
          ? <div className="text-dim text-sm">No activities yet. Use AI generation or add manually.</div>
          : form.activities.map((a: any, i: number) => (
            <div key={i} style={{ padding: 12, background: 'var(--navy)', borderRadius: 'var(--radius)', marginBottom: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input className="form-input" style={{ flex: 2 }} value={a.name} onChange={e => arrSet('activities', form.activities, i, { name: e.target.value })} placeholder="Activity name" />
                <input className="form-input" style={{ flex: 1 }} value={a.timeframe} onChange={e => arrSet('activities', form.activities, i, { timeframe: e.target.value })} placeholder="Timeframe" />
                <select className="form-input" style={{ width: 110 }} value={a.priority} onChange={e => arrSet('activities', form.activities, i, { priority: e.target.value })}>
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <button onClick={() => arrDel('activities', form.activities, i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>x</button>
              </div>
              <input className="form-input" value={a.description} onChange={e => arrSet('activities', form.activities, i, { description: e.target.value })} placeholder="Description" />
            </div>
          ))
        }
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">Expected Deliverables ({form.deliverables.length})</div>
          <button className="btn btn-secondary btn-sm" onClick={() => set('deliverables', [...form.deliverables, { id: 'D' + Date.now(), name: '', type: 'REPORT', dueTimeframe: '', description: '' }])}>+ Add</button>
        </div>
        {form.deliverables.length === 0
          ? <div className="text-dim text-sm">No deliverables yet.</div>
          : form.deliverables.map((d: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="form-input" style={{ flex: 2 }} value={d.name} onChange={e => arrSet('deliverables', form.deliverables, i, { name: e.target.value })} placeholder="Deliverable name" />
              <input className="form-input" style={{ flex: 1 }} value={d.type} onChange={e => arrSet('deliverables', form.deliverables, i, { type: e.target.value })} placeholder="Type" />
              <input className="form-input" style={{ width: 120 }} value={d.dueTimeframe} onChange={e => arrSet('deliverables', form.deliverables, i, { dueTimeframe: e.target.value })} placeholder="Due (e.g. Q2)" />
              <button onClick={() => arrDel('deliverables', form.deliverables, i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>x</button>
            </div>
          ))
        }
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">KPIs ({form.kpis.length})</div>
          <button className="btn btn-secondary btn-sm" onClick={() => set('kpis', [...form.kpis, { id: 'K' + Date.now(), name: '', target: '', baseline: '', measurementMethod: '', frequency: 'Quarterly' }])}>+ Add</button>
        </div>
        {form.kpis.length === 0
          ? <div className="text-dim text-sm">No KPIs yet.</div>
          : form.kpis.map((k: any, i: number) => (
            <div key={i} style={{ padding: 12, background: 'var(--navy)', borderRadius: 'var(--radius)', marginBottom: 8, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input className="form-input" style={{ flex: 2 }} value={k.name} onChange={e => arrSet('kpis', form.kpis, i, { name: e.target.value })} placeholder="KPI name" />
                <input className="form-input" style={{ flex: 1 }} value={k.target} onChange={e => arrSet('kpis', form.kpis, i, { target: e.target.value })} placeholder="Target" />
                <input className="form-input" style={{ flex: 1 }} value={k.baseline} onChange={e => arrSet('kpis', form.kpis, i, { baseline: e.target.value })} placeholder="Baseline" />
                <button onClick={() => arrDel('kpis', form.kpis, i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>x</button>
              </div>
              <input className="form-input" value={k.measurementMethod} onChange={e => arrSet('kpis', form.kpis, i, { measurementMethod: e.target.value })} placeholder="Measurement method" />
            </div>
          ))
        }
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title">Risks ({form.risks.length})</div>
          <button className="btn btn-secondary btn-sm" onClick={() => set('risks', [...form.risks, { id: 'R' + Date.now(), name: '', description: '', severity: 'MEDIUM', mitigation: '' }])}>+ Add</button>
        </div>
        {form.risks.length === 0
          ? <div className="text-dim text-sm">No risks defined yet.</div>
          : form.risks.map((r: any, i: number) => (
            <div key={i} style={{ padding: 12, background: 'var(--navy)', borderRadius: 'var(--radius)', marginBottom: 8, border: '1px solid var(--border)', borderLeft: '3px solid ' + (RISK_COLOR[r.severity] || 'var(--border)') }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input className="form-input" style={{ flex: 2 }} value={r.name} onChange={e => arrSet('risks', form.risks, i, { name: e.target.value })} placeholder="Risk name" />
                <select className="form-input" style={{ width: 120 }} value={r.severity} onChange={e => arrSet('risks', form.risks, i, { severity: e.target.value })}>
                  {['LOW','MEDIUM','HIGH','CRITICAL'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <button onClick={() => arrDel('risks', form.risks, i)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 18 }}>x</button>
              </div>
              <input className="form-input" style={{ marginBottom: 6 }} value={r.description} onChange={e => arrSet('risks', form.risks, i, { description: e.target.value })} placeholder="Risk description" />
              <input className="form-input" value={r.mitigation} onChange={e => arrSet('risks', form.risks, i, { mitigation: e.target.value })} placeholder="Mitigation strategy" />
            </div>
          ))
        }
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Notes</div>
        <textarea className="form-input" rows={4} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Additional notes, assumptions, or context..." />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={saving || !form.planTypeId || !form.nameEn}>
          {saving ? 'Saving...' : (plan?.id ? 'Save Changes' : 'Create Plan')}
        </button>
      </div>
    </div>
  )
}

function PlanDetailView({ planId, onBack, onEdit }: { planId: string, onBack: () => void, onEdit: (p: any) => void }) {
  const api = useApi()
  const [plan, setPlan]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExp]   = useState('')
  const [report, setReport]   = useState('')
  const [showReport, setSR]   = useState(false)

  useEffect(() => {
    api.get('/ea-planning/plans/' + planId).then(setPlan).finally(() => setLoading(false))
  }, [planId])

  const exportFile = async (type: 'docx' | 'pptx') => {
    setExp(type)
    try { await api.dl('/ea-planning/plans/' + planId + '/export/' + type, 'ea-plan.' + type) }
    finally { setExp('') }
  }

  const loadReport = async () => {
    const r = await api.get('/ea-planning/plans/' + planId + '/report')
    setReport(r.report || '')
    setSR(true)
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
  if (!plan) return <div className="page-body"><div className="text-dim">Plan not found</div></div>

  const activities   = plan.activities   || []
  const deliverables = plan.deliverables || []
  const kpis         = plan.kpis         || []
  const risks        = plan.risks        || []

  return (
    <div className="page-body">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>Back</button>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{plan.nameEn}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{plan.planType?.nameEn} · {plan.periodLabel || '—'} · {FREQ_LABEL[plan.frequency] || plan.frequency}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => onEdit(plan)}>Edit</button>
          <button className="btn btn-secondary btn-sm" onClick={loadReport}>Report</button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportFile('docx')} disabled={exporting === 'docx'}>{exporting === 'docx' ? 'Exporting...' : 'Word'}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportFile('pptx')} disabled={exporting === 'pptx'}>{exporting === 'pptx' ? 'Exporting...' : 'PPT'}</button>
        </div>
      </div>

      {showReport && (
        <div className="modal-overlay" onClick={() => setSR(false)}>
          <div className="modal" style={{ width: 700, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title">Plan Summary Report</div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSR(false)}>Close</button>
            </div>
            <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', color: 'var(--text)', lineHeight: 1.6 }}>{report}</pre>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Status',    value: <span className={'badge ' + (STATUS_BADGE[plan.status] || 'badge-draft')}>{plan.status}</span> },
          { label: 'Owner',     value: plan.owner || '—' },
          { label: 'Period',    value: plan.periodLabel || '—' },
          { label: 'Frequency', value: FREQ_LABEL[plan.frequency] || plan.frequency },
          { label: 'Progress',  value: (plan.progressPct || 0) + '%' },
        ].map(item => (
          <div key={item.label} className="card" style={{ padding: 12 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{item.value}</div>
          </div>
        ))}
      </div>

      {plan.domains?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {plan.domains.map((d: string) => (
            <span key={d} style={{ padding: '3px 10px', background: 'rgba(0,180,216,0.1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--accent)' }}>{d}</span>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 16 }}><ProgressBar pct={plan.progressPct || 0} /></div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Objectives</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{plan.objectives || <span className="text-dim">Not defined</span>}</div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Scope</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{plan.scope || <span className="text-dim">Not defined</span>}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Key Activities ({activities.length})</div>
        {activities.length === 0
          ? <div className="text-dim text-sm">No activities defined</div>
          : activities.map((a: any, i: number) => (
            <div key={i} style={{ padding: '10px 12px', background: 'var(--navy)', borderRadius: 'var(--radius)', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start', borderLeft: '3px solid ' + (PRIORITY_COLOR[a.priority] || 'var(--border)') }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                {a.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{a.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {a.timeframe && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(0,180,216,0.1)', borderRadius: 2, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{a.timeframe}</span>}
                <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(0,0,0,0.2)', borderRadius: 2, color: PRIORITY_COLOR[a.priority] || 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{a.priority || 'MEDIUM'}</span>
              </div>
            </div>
          ))
        }
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>Deliverables ({deliverables.length})</div>
          {deliverables.length === 0
            ? <div className="text-dim text-sm">No deliverables defined</div>
            : deliverables.map((d: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13 }}>{d.name}</div>
                  {d.description && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{d.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {d.type && <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{d.type}</span>}
                  {d.dueTimeframe && <span style={{ fontSize: 10, padding: '2px 6px', background: 'rgba(243,156,18,0.1)', borderRadius: 2, color: 'var(--warning)', fontFamily: 'var(--font-mono)' }}>{d.dueTimeframe}</span>}
                </div>
              </div>
            ))
          }
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>KPIs ({kpis.length})</div>
          {kpis.length === 0
            ? <div className="text-dim text-sm">No KPIs defined</div>
            : kpis.map((k: any, i: number) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{k.name}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Target: <span style={{ color: 'var(--success)' }}>{k.target || 'TBD'}</span></span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Baseline: {k.baseline || 'TBD'}</span>
                </div>
                {k.measurementMethod && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{k.measurementMethod}</div>}
              </div>
            ))
          }
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Risks ({risks.length})</div>
        {risks.length === 0
          ? <div className="text-dim text-sm">No risks defined</div>
          : risks.map((r: any, i: number) => (
            <div key={i} style={{ padding: '10px 12px', background: 'var(--navy)', borderRadius: 'var(--radius)', marginBottom: 8, borderLeft: '3px solid ' + (RISK_COLOR[r.severity] || 'var(--border)') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 2, fontFamily: 'var(--font-mono)', background: (RISK_COLOR[r.severity] || 'var(--border)') + '22', color: RISK_COLOR[r.severity] || 'var(--text-dim)' }}>{r.severity || 'MEDIUM'}</span>
              </div>
              {r.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>{r.description}</div>}
              {r.mitigation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Mitigation: {r.mitigation}</div>}
            </div>
          ))
        }
      </div>

      {plan.notes && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Notes</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>{plan.notes}</div>
        </div>
      )}
    </div>
  )
}

type View = 'dashboard' | 'list' | 'create' | 'edit' | 'detail'

export default function EAPlanningPage() {
  const [view, setView]         = useState<View>('dashboard')
  const [editPlan, setEditPlan] = useState<any>(null)
  const [detailId, setDetailId] = useState<string>('')
  const [activeTab, setTab]     = useState<'dashboard' | 'plans'>('dashboard')

  const goNew    = ()       => { setEditPlan(null); setView('create') }
  const goEdit   = (p: any) => { setEditPlan(p);   setView('edit') }
  const goDetail = (p: any) => { setDetailId(p.id); setView('detail') }
  const goBack   = ()       => { setView(activeTab); setEditPlan(null) }
  const onSaved  = (p: any) => { setDetailId(p.id); setView('detail') }

  if (view === 'create' || view === 'edit') {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">EA Planning</div>
          <div className="page-subtitle">Enterprise Architecture Planning — NORA 2.0 Aligned</div>
        </div>
        <PlanForm plan={editPlan} onSave={onSaved} onCancel={goBack} />
      </div>
    )
  }

  if (view === 'detail') {
    return (
      <div>
        <div className="page-header">
          <div className="page-title">EA Planning</div>
          <div className="page-subtitle">Enterprise Architecture Planning — NORA 2.0 Aligned</div>
        </div>
        <PlanDetailView planId={detailId} onBack={goBack} onEdit={goEdit} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title">EA Planning</div>
        <div className="page-subtitle">Enterprise Architecture Planning — NORA 2.0 Aligned</div>
        <div className="page-tabs">
          <button className={'tab-btn' + (activeTab === 'dashboard' ? ' active' : '')} onClick={() => { setTab('dashboard'); setView('dashboard') }}>Dashboard</button>
          <button className={'tab-btn' + (activeTab === 'plans' ? ' active' : '')} onClick={() => { setTab('plans'); setView('list') }}>Plans</button>
        </div>
      </div>
      {view === 'dashboard' && <DashboardView onNew={goNew} />}
      {view === 'list'      && <PlansListView onNew={goNew} onView={goDetail} />}
    </div>
  )
}
