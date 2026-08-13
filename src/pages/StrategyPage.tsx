import { useState, useEffect, useCallback } from 'react'
import HelpTip from '../components/HelpTip'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const get = (p: string) => fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
  const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
  const put = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json())
  const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok)
  return { get, post, put, del }
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', background: 'none', border: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? '#0B1929' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const STRATEGY_TYPES = [
  { code: 'BUSINESS_STRATEGY', label: 'Business Strategy', color: '#e74c3c' },
  { code: 'DT_STRATEGY', label: 'Digital Transformation Strategy', color: '#f39c12' },
  { code: 'EA_STRATEGY', label: 'EA Strategy', color: '#3498db' },
  { code: 'VISION_2030', label: 'Vision 2030', color: '#8e44ad' },
  { code: 'NDP', label: 'National Development Plan', color: '#8e44ad' },
  { code: 'NATIONAL', label: 'Other National Strategy', color: '#8e44ad' },
  { code: 'OTHER', label: 'Other', color: '#7f8c8d' },
]
const typeInfo = (code: string) => STRATEGY_TYPES.find(t => t.code === code) || STRATEGY_TYPES[STRATEGY_TYPES.length - 1]
const GAP_COLOR: Record<string, string> = { STRONG: '#2ecc71', PARTIAL: '#f39c12', GAP: '#e74c3c' }

export default function StrategyPage() {
  const api = useApi()
  const [strategies, setStrategies] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [newStrategy, setNewStrategy] = useState({ name: '', nameAr: '', description: '', vision: '', timeframe: '', strategyType: 'EA_STRATEGY' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => { api.get('/strategy').then((d: any) => setStrategies(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { load() }, [load])

  const open = async (s: any) => { const full = await api.get(`/strategy/${s.id}`); setSelected(full) }

  const create = async () => {
    if (!newStrategy.name) return alert('Name is required')
    setSaving(true)
    try { const created = await api.post('/strategy', newStrategy); setCreating(false); setNewStrategy({ name: '', nameAr: '', description: '', vision: '', timeframe: '', strategyType: 'EA_STRATEGY' }); load(); open(created) } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (id: string) => { if (!window.confirm('Delete this strategy and all its goals/alignments?')) return; await api.del(`/strategy/${id}`); load() }

  if (selected) return <StrategyDetail api={api} strategy={selected} onBack={() => { setSelected(null); load() }} onRefresh={() => open(selected)} />

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center' }}>🎯 Strategy<HelpTip text="Record your organization's strategic goals here, then connect each one to the specific capabilities that support it. This helps show whether your architecture is actually working toward what the organization is trying to achieve, and highlights any gaps." /></div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Strategic goals, capability alignment, and gap analysis</div>
        </div>
        <button style={S.btn('primary')} onClick={() => setCreating(true)}>+ New Strategy</button>
      </div>
      <div style={S.content}>
        {creating && (
          <div style={S.card}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>New Strategy</div>
            <div style={S.grid2}>
              <div><div style={S.label}>Name (EN) *</div><input style={S.input} value={newStrategy.name} onChange={e => setNewStrategy(s => ({ ...s, name: e.target.value }))} /></div>
              <div><div style={S.label}>Name (AR)</div><input style={S.input} dir="rtl" value={newStrategy.nameAr} onChange={e => setNewStrategy(s => ({ ...s, nameAr: e.target.value }))} /></div>
              <div>
                <div style={S.label}>Type</div>
                <select style={S.input} value={newStrategy.strategyType} onChange={e => setNewStrategy(s => ({ ...s, strategyType: e.target.value }))}>
                  {STRATEGY_TYPES.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div><div style={S.label}>Timeframe</div><input style={S.input} placeholder="e.g. 2026-2030" value={newStrategy.timeframe} onChange={e => setNewStrategy(s => ({ ...s, timeframe: e.target.value }))} /></div>
            </div>
            <div style={S.label}>Vision</div><input style={S.input} value={newStrategy.vision} onChange={e => setNewStrategy(s => ({ ...s, vision: e.target.value }))} />
            <div style={S.label}>Description</div><input style={S.input} value={newStrategy.description} onChange={e => setNewStrategy(s => ({ ...s, description: e.target.value }))} />
            <div style={S.row}><button style={S.btn('primary')} onClick={create} disabled={saving}>{saving ? 'Creating…' : 'Create'}</button><button style={S.btn()} onClick={() => setCreating(false)}>Cancel</button></div>
          </div>
        )}
        {strategies.length === 0 && !creating ? (
          <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No strategies yet. Create one to start mapping goals to EA capabilities.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {strategies.map(s => {
              const ti = typeInfo(s.strategyType)
              return (
                <div key={s.id} style={{ ...S.card, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }} onClick={() => open(s)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{s.timeframe || 'No timeframe set'} · {s._count?.goals ?? 0} goal(s)</div>
                  </div>
                  <span style={S.badge(ti.color)}>{ti.label}</span>
                  <span style={S.badge(s.status === 'ACTIVE' ? '#2ecc71' : '#7f8c8d')}>{s.status}</span>
                  <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={e => { e.stopPropagation(); remove(s.id) }}>Delete</button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Strategy Detail ──────────────────────────────────────────────────────────
function StrategyDetail({ api, strategy, onBack, onRefresh }: { api: any, strategy: any, onBack: () => void, onRefresh: () => void }) {
  const [tab, setTab] = useState<'overview'|'goals'|'gap'|'matrix'>('overview')
  const ti = typeInfo(strategy.strategyType)

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{strategy.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={S.badge(ti.color)}>{ti.label}</span>
            <span style={S.badge('#2ecc71')}>{strategy.status}</span>
          </div>
        </div>
      </div>
      <div style={S.tabs}>
        {(['overview','goals','gap','matrix'] as const).map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'overview' ? '📋 Overview' : t === 'goals' ? `🎯 Goals (${strategy.goals?.length || 0})` : t === 'gap' ? '📊 Gap Score' : '🗺 Alignment Matrix'}
          </button>
        ))}
      </div>
      <div style={S.content}>
        {tab === 'overview' && (
          <div style={S.grid2}>
            <div style={S.card}><div style={S.label}>Vision</div><div style={{ fontSize: 13 }}>{strategy.vision || '—'}</div></div>
            <div style={S.card}><div style={S.label}>Timeframe</div><div style={{ fontSize: 13 }}>{strategy.timeframe || '—'}</div></div>
            <div style={{ ...S.card, gridColumn: '1/-1' }}><div style={S.label}>Description</div><div style={{ fontSize: 13 }}>{strategy.description || '—'}</div></div>
          </div>
        )}
        {tab === 'goals' && <GoalsTab api={api} strategy={strategy} onRefresh={onRefresh} />}
        {tab === 'gap' && <GapScoreTab api={api} strategyId={strategy.id} />}
        {tab === 'matrix' && <AlignmentMatrixTab api={api} strategyId={strategy.id} />}
      </div>
    </div>
  )
}

// ── Goals Tab ────────────────────────────────────────────────────────────────
function GoalsTab({ api, strategy, onRefresh }: { api: any, strategy: any, onRefresh: () => void }) {
  const [creating, setCreating] = useState(false)
  const [newGoal, setNewGoal] = useState({ title: '', titleAr: '', description: '', pillar: '', targetYear: '', kpis: '' })
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const createGoal = async () => {
    if (!newGoal.title) return alert('Title is required')
    setSaving(true)
    try {
      await api.post(`/strategy/${strategy.id}/goals`, {
        title: newGoal.title, titleAr: newGoal.titleAr || undefined, description: newGoal.description || undefined,
        pillar: newGoal.pillar || undefined, targetYear: newGoal.targetYear ? parseInt(newGoal.targetYear, 10) : undefined,
        kpis: newGoal.kpis ? newGoal.kpis.split(',').map(k => k.trim()).filter(Boolean) : [],
      })
      setCreating(false); setNewGoal({ title: '', titleAr: '', description: '', pillar: '', targetYear: '', kpis: '' }); onRefresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const deleteGoal = async (goalId: string) => { if (!window.confirm('Delete this goal and its alignments?')) return; await api.del(`/strategy/${strategy.id}/goals/${goalId}`); onRefresh() }

  return (
    <div>
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setCreating(true)}>+ Add Goal</button>
      {creating && (
        <div style={S.card}>
          <div style={S.grid2}>
            <div><div style={S.label}>Title *</div><input style={S.input} value={newGoal.title} onChange={e => setNewGoal(g => ({ ...g, title: e.target.value }))} /></div>
            <div><div style={S.label}>Title (AR)</div><input style={S.input} dir="rtl" value={newGoal.titleAr} onChange={e => setNewGoal(g => ({ ...g, titleAr: e.target.value }))} /></div>
            <div><div style={S.label}>Pillar</div><input style={S.input} placeholder="e.g. Digital Excellence" value={newGoal.pillar} onChange={e => setNewGoal(g => ({ ...g, pillar: e.target.value }))} /></div>
            <div><div style={S.label}>Target Year</div><input style={S.input} type="number" value={newGoal.targetYear} onChange={e => setNewGoal(g => ({ ...g, targetYear: e.target.value }))} /></div>
          </div>
          <div style={S.label}>Description</div><input style={S.input} value={newGoal.description} onChange={e => setNewGoal(g => ({ ...g, description: e.target.value }))} />
          <div style={S.label}>KPIs (comma-separated)</div><input style={S.input} value={newGoal.kpis} onChange={e => setNewGoal(g => ({ ...g, kpis: e.target.value }))} />
          <div style={S.row}><button style={S.btn('primary')} onClick={createGoal} disabled={saving}>{saving ? 'Saving…' : 'Add Goal'}</button><button style={S.btn()} onClick={() => setCreating(false)}>Cancel</button></div>
        </div>
      )}
      {(!strategy.goals || strategy.goals.length === 0) ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No goals defined yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {strategy.goals.map((g: any) => (
            <div key={g.id} style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedGoal(expandedGoal === g.id ? null : g.id)}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{g.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{g.pillar || 'No pillar'} {g.targetYear ? `· Target: ${g.targetYear}` : ''} · {g.alignments?.length || 0} capability alignment(s)</div>
                </div>
                <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => setExpandedGoal(expandedGoal === g.id ? null : g.id)}>{expandedGoal === g.id ? 'Collapse' : 'Manage Alignments'}</button>
                <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => deleteGoal(g.id)}>Delete</button>
              </div>
              {g.kpis?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>KPIs: {g.kpis.join(', ')}</div>}
              {expandedGoal === g.id && <AlignmentsPanel api={api} strategyId={strategy.id} goal={g} onRefresh={onRefresh} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Alignments Panel (per goal) ──────────────────────────────────────────────
function AlignmentsPanel({ api, strategyId, goal, onRefresh }: { api: any, strategyId: string, goal: any, onRefresh: () => void }) {
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[] | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [manualCapId, setManualCapId] = useState('')
  const [manualScore, setManualScore] = useState('75')

  useEffect(() => { api.get('/ea-repository/capabilities').then((d: any) => setCapabilities(Array.isArray(d) ? d : [])) }, [api])

  const suggest = async () => {
    setSuggesting(true); setSuggestions(null)
    try {
      const result = await api.post(`/strategy/${strategyId}/goals/${goal.id}/suggest-alignments`)
      if (result.message) alert(result.message)
      setSuggestions(result.suggestions || [])
    } catch (e: any) { alert(e.message) } finally { setSuggesting(false) }
  }

  const confirmSuggestion = async (s: any) => {
    await api.post(`/strategy/${strategyId}/goals/${goal.id}/alignments`, { goalId: goal.id, capabilityId: s.capabilityId, score: s.score, notes: s.justification })
    setSuggestions(prev => prev ? prev.filter(x => x.capabilityId !== s.capabilityId) : prev)
    onRefresh()
  }

  const addManual = async () => {
    if (!manualCapId) return
    await api.post(`/strategy/${strategyId}/goals/${goal.id}/alignments`, { goalId: goal.id, capabilityId: manualCapId, score: parseInt(manualScore, 10) || 75 })
    setManualCapId(''); onRefresh()
  }

  const removeAlignment = async (alignmentId: string) => { await api.del(`/strategy/${strategyId}/goals/${goal.id}/alignments/${alignmentId}`); onRefresh() }

  const capName = (id: string) => capabilities.find(c => c.id === id)?.name || id

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8 }}>Current Alignments</div>
      {(!goal.alignments || goal.alignments.length === 0) ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>No capabilities aligned yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
          {goal.alignments.map((a: any) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '4px 0' }}>
              <div style={{ flex: 1 }}>{a.capability?.name || capName(a.capabilityId)}</div>
              <span style={S.badge(a.score >= 70 ? '#2ecc71' : a.score >= 40 ? '#f39c12' : '#e74c3c')}>{a.score}%</span>
              <button style={{ ...S.btn('danger'), fontSize: 10, padding: '3px 8px' }} onClick={() => removeAlignment(a.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <select style={{ ...S.input, marginBottom: 0, flex: 1 }} value={manualCapId} onChange={e => setManualCapId(e.target.value)}>
          <option value="">Add capability manually…</option>
          {capabilities.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input style={{ ...S.input, marginBottom: 0, width: 70 }} type="number" min={0} max={100} value={manualScore} onChange={e => setManualScore(e.target.value)} />
        <button style={S.btn()} onClick={addManual}>Add</button>
      </div>

      <button style={{ ...S.btn('primary'), fontSize: 11 }} onClick={suggest} disabled={suggesting}>{suggesting ? '⏳ Analyzing…' : '✨ AI-Suggest Alignments'}</button>

      {suggestions && suggestions.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s: any) => (
            <div key={s.capabilityId} style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, fontWeight: 600 }}>{capName(s.capabilityId)}</div>
                <span style={S.badge(s.score >= 70 ? '#2ecc71' : '#f39c12')}>{s.score}%</span>
                <button style={{ ...S.btn('primary'), fontSize: 10, padding: '3px 10px' }} onClick={() => confirmSuggestion(s)}>Confirm</button>
              </div>
              <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>{s.justification}</div>
            </div>
          ))}
        </div>
      )}
      {suggestions && suggestions.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>No new suggestions — all relevant capabilities may already be aligned.</div>}
    </div>
  )
}

// ── Gap Score Tab ────────────────────────────────────────────────────────────
function GapScoreTab({ api, strategyId }: { api: any, strategyId: string }) {
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const calculate = useCallback(() => {
    setLoading(true)
    api.post(`/strategy/${strategyId}/gap-score`).then(setResult).finally(() => setLoading(false))
  }, [api, strategyId])
  useEffect(() => { calculate() }, [calculate])

  if (loading && !result) return <div style={{ color: 'var(--text-dim)' }}>Calculating…</div>
  if (!result) return null

  return (
    <div>
      <div style={S.grid3}>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Overall Score</div><div style={{ fontSize: 28, fontWeight: 700, color: GAP_COLOR[result.overallStatus] }}>{result.overallScore}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Strong Goals</div><div style={{ fontSize: 28, fontWeight: 700, color: GAP_COLOR.STRONG }}>{result.summary.strong}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Goals with Gaps</div><div style={{ fontSize: 28, fontWeight: 700, color: GAP_COLOR.GAP }}>{result.summary.gap}</div></div>
      </div>
      <button style={{ ...S.btn(), marginTop: 16, marginBottom: 16 }} onClick={calculate}>🔄 Recalculate</button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {result.goalScores.map((g: any) => (
          <div key={g.goalId} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={S.badge(GAP_COLOR[g.status])}>{g.status}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{g.goalTitle}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{g.alignedCapabilityCount}/{g.totalCapabilities} capabilities aligned · avg score {g.avgAlignmentScore}%</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: GAP_COLOR[g.status] }}>{g.gapScore}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Alignment Matrix Tab ─────────────────────────────────────────────────────
function AlignmentMatrixTab({ api, strategyId }: { api: any, strategyId: string }) {
  const [matrix, setMatrix] = useState<any>(null)

  useEffect(() => { api.get(`/strategy/${strategyId}/alignment-matrix`).then(setMatrix) }, [api, strategyId])

  if (!matrix) return <div style={{ color: 'var(--text-dim)' }}>Loading…</div>
  if (matrix.capabilities.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No capabilities in the EA Repository yet — add some to see the alignment matrix.</div>
  if (matrix.goals.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No goals defined yet.</div>

  const cellColor = (score: number) => score === 0 ? 'var(--navy)' : score >= 70 ? '#2ecc7133' : score >= 40 ? '#f39c1233' : '#e74c3c33'
  const textColor = (score: number) => score === 0 ? 'var(--text-dim)' : score >= 70 ? '#2ecc71' : score >= 40 ? '#f39c12' : '#e74c3c'

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...S.label, textAlign: 'left', padding: 8, position: 'sticky', left: 0, background: 'var(--navy)' }}>Goal \ Capability</th>
            {matrix.capabilities.map((c: any) => (
              <th key={c.id} style={{ padding: 8, fontSize: 10, color: 'var(--text-dim)', writingMode: 'vertical-rl' as const, textOrientation: 'mixed' as const, maxHeight: 100, fontWeight: 500 }}>{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.matrix.map((row: any) => (
            <tr key={row.goalId}>
              <td style={{ padding: 8, fontWeight: 600, position: 'sticky', left: 0, background: 'var(--navy)', whiteSpace: 'nowrap' as const, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.goalTitle}</td>
              {matrix.capabilities.map((c: any) => (
                <td key={c.id} style={{ padding: 4, textAlign: 'center' }}>
                  <div style={{ width: 36, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cellColor(row[c.id]), color: textColor(row[c.id]), borderRadius: 4, fontWeight: 600, fontSize: 11 }}>
                    {row[c.id] || '—'}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
