import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import HelpTip from '../components/HelpTip'
import { RoadmapConfigPanel, RoadmapTimeline } from './eaviews/RoadmapView'
import { DashboardBuilder, DashboardGrid, DashboardWidget } from './eaviews/DashboardBuilder'

import { PathBuilder, RelationshipHop } from './eaviews/PathBuilder'
import { useSearchParams } from 'react-router-dom'
import { CollectionsPanel } from './eaviews/CollectionsPanel'
import { exportAsJSON, exportNodesAsCSV, exportMatrixAsCSV, exportRoadmapAsCSV, exportGraphAsSVG, exportGraphAsPNG, exportGraphAsPDF, exportNodesAsPDF, exportMatrixAsPDF, exportRoadmapAsPDF, exportGraphAsPPTX, exportNodesAsPPTX, exportMatrixAsPPTX, exportRoadmapAsPPTX } from './eaviews/exportUtils'
import { determineTableMode, buildRelationshipTable, buildMatrix } from './eaviews/tableMatrixUtils'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useViewsApi() {
  const { token } = useAuth() as any
  const h = () => ({ Authorization: `Bearer ${token || localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' })
  const get = (p: string) => fetch(`${API}${p}`, { headers: h() }).then(r => r.json())
  const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: h(), body: b ? JSON.stringify(b) : undefined }).then(r => r.json())
  const put = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PUT', headers: h(), body: JSON.stringify(b) }).then(r => r.json())
  const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: h() }).then(r => r.ok)
  return { get, post, put, del }
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (a: boolean) => ({ padding: '10px 18px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const VIZ_ICONS: Record<string,string> = { GRAPH:'🕸', MATRIX:'⊞', HEATMAP:'🔥', CAPABILITY_MAP:'⬛', TABLE:'≡', ROADMAP:'🗺', LANDSCAPE:'🗾', DASHBOARD:'📊' }
const CATEGORY_COLOR: Record<string,string> = { Business:'#3498db', Application:'#e67e22', Data:'#1abc9c', Technology:'#e74c3c', Security:'#9b59b6', 'Cross-Domain':'#f39c12', Strategic:'#2ecc71', Governance:'#7f8c8d', Custom:'#64748B' }
const STATE_COLOR: Record<string,string> = { CURRENT:'#2ecc71', TARGET:'#3498db', TRANSITION:'#f39c12', BASELINE:'#7f8c8d', PLANNED:'#9b59b6' }
const STATUS_COLOR: Record<string,string> = { DRAFT:'#f39c12', PUBLISHED:'#2ecc71', ARCHIVED:'#7f8c8d' }
const DOMAIN_COLOR: Record<string,string> = { BUSINESS:'#3498db', APPLICATION:'#e67e22', DATA:'#1abc9c', TECHNOLOGY:'#e74c3c', SECURITY:'#9b59b6', STRATEGIC:'#2ecc71', BENEFICIARY_EXPERIENCE:'#16a085', CROSS_CUTTING:'#7f8c8d' }
const TYPE_COLOR: Record<string,string> = { CAPABILITY:'#3498db', APPLICATION:'#e67e22', DATA_ENTITY:'#1abc9c', TECH_COMPONENT:'#e74c3c', SECURITY_CONTROL:'#9b59b6', EA_PRINCIPLE:'#2ecc71', INTEGRATION:'#f39c12' }

// ── Force-directed auto-layout ──────────────────────────────────────────────
//
// A hand-rolled physics simulation (repulsion between every node pair,
// spring attraction along edges) rather than a library dependency - kept
// intentionally simple and synchronous. Capped to graphs of
// FORCE_LAYOUT_MAX_NODES or fewer: beyond that, an O(n²)-per-iteration
// simulation would visibly block the main thread regardless of
// implementation quality, and a genuinely non-blocking version would need
// Web Workers - out of scope for a first version. Iteration count also
// scales down as node count grows, so mid-size graphs (dozens of nodes)
// stay responsive without needing the hard cutoff.
const FORCE_LAYOUT_MAX_NODES = 150
function computeForceLayout(nodes: any[], edges: any[], existingPositions: Record<string, { x: number; y: number }>): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {}
  nodes.forEach((n, i) => {
    const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2
    pos[n.id] = existingPositions[n.id] ? { ...existingPositions[n.id] } : { x: 500 + Math.cos(angle) * 250, y: 350 + Math.sin(angle) * 250 }
  })
  const iterations = Math.max(30, Math.min(200, Math.round(15000 / Math.max(1, nodes.length))))
  const IDEAL_EDGE_LENGTH = 190
  const REPULSION = 14000
  for (let iter = 0; iter < iterations; iter++) {
    const forces: Record<string, { x: number; y: number }> = {}
    nodes.forEach(n => { forces[n.id] = { x: 0, y: 0 } })
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].id, b = nodes[j].id
        const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = REPULSION / (dist * dist)
        const fx = (dx / dist) * force, fy = (dy / dist) * force
        forces[a].x += fx; forces[a].y += fy
        forces[b].x -= fx; forces[b].y -= fy
      }
    }
    for (const e of edges) {
      if (!pos[e.sourceId] || !pos[e.targetId]) continue
      const dx = pos[e.targetId].x - pos[e.sourceId].x, dy = pos[e.targetId].y - pos[e.sourceId].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - IDEAL_EDGE_LENGTH) * 0.02
      const fx = (dx / dist) * force, fy = (dy / dist) * force
      forces[e.sourceId].x += fx; forces[e.sourceId].y += fy
      forces[e.targetId].x -= fx; forces[e.targetId].y -= fy
    }
    for (const n of nodes) {
      pos[n.id].x += Math.max(-30, Math.min(30, forces[n.id].x)) * 0.5
      pos[n.id].y += Math.max(-30, Math.min(30, forces[n.id].y)) * 0.5
    }
  }
  return pos
}

// ── View Library (predefined viewpoints) ──────────────────────────────────────
function ViewLibrary({ api, onCreate }: { api: any, onCreate: (v: any) => void }) {
  const [viewpoints, setViewpoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterStakeholder, setFilterStakeholder] = useState('')
  const [compatibility, setCompatibility] = useState<Record<string, any>>({})

  useEffect(() => {
    Promise.all([api.get('/ea-views/viewpoints'), api.post('/ea-views/viewpoints/seed')]).then(([vps]: any[]) => {
      const list = Array.isArray(vps) ? vps : []
      setViewpoints(list)
      setLoading(false)
      // Fired once per viewpoint after the list itself has loaded, not
      // blocking the initial render - compatibility badges fill in
      // progressively rather than delaying the whole library.
      list.forEach((vp: any) => {
        api.get(`/ea-views/viewpoints/${vp.id}/compatibility`).then((c: any) => {
          if (c) setCompatibility(prev => ({ ...prev, [vp.id]: c }))
        }).catch(() => {})
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const categories = Array.from(new Set(viewpoints.map(v => v.category)))
  const allStakeholders = Array.from(new Set(viewpoints.flatMap(v => v.stakeholders || []))).sort()
  const filtered = viewpoints.filter(v => (!filterCat || v.category === filterCat) && (!filterStakeholder || (v.stakeholders || []).includes(filterStakeholder)))

  const COMPAT_BADGE: Record<string, { label: string; color: string }> = {
    COMPATIBLE: { label: '✓ Compatible', color: '#2ecc71' },
    PARTIAL: { label: '! Partial', color: '#f39c12' },
    NOT_COMPATIBLE: { label: '✕ Not Compatible', color: '#e74c3c' },
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>View Library</div><div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Browse predefined EA views — select one to activate or customize</div></div>
        <button style={S.btn('primary')} onClick={() => onCreate(null)}>+ Custom View</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' }}>
        <button style={{ ...S.btn(), background: !filterCat ? 'var(--accent)' : undefined, color: !filterCat ? 'var(--navy)' : undefined }} onClick={() => setFilterCat('')}>All</button>
        {categories.map(c => <button key={c} style={{ ...S.btn(), background: filterCat === c ? CATEGORY_COLOR[c] : undefined, color: filterCat === c ? '#fff' : undefined }} onClick={() => setFilterCat(c)}>{c}</button>)}
        {allStakeholders.length > 0 && (
          <select style={{ ...S.input, maxWidth: 180, marginLeft: 'auto' }} value={filterStakeholder} onChange={e => setFilterStakeholder(e.target.value)}>
            <option value="">All Stakeholders</option>
            {allStakeholders.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {filtered.map(vp => {
            const compat = compatibility[vp.id]
            const badge = compat ? COMPAT_BADGE[compat.status] : null
            return (
            <div key={vp.id} style={{ ...S.card, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = CATEGORY_COLOR[vp.category] || 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: (CATEGORY_COLOR[vp.category] || '#3498db') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {VIZ_ICONS[vp.defaultVisualization] || '📊'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{vp.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' as const }}>
                    <span style={S.badge(CATEGORY_COLOR[vp.category] || '#3498db')}>{vp.category}</span>
                    <span style={S.badge('#7f8c8d')}>{(vp.defaultVisualization||'').replace(/_/g,' ')}</span>
                    {badge && <span style={S.badge(badge.color)} title={compat.status === 'PARTIAL' || compat.status === 'NOT_COMPATIBLE' ? `Missing data for: ${compat.missingRootTypes.join(', ')}` : undefined}>{badge.label}</span>}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>{vp.description}</div>
              {vp.purpose && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 12 }}>Purpose: {vp.purpose}</div>}
              {(vp.stakeholders?.length > 0 || vp.concerns?.length > 0) && (
                <div style={{ marginBottom: 12 }}>
                  {vp.stakeholders?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>👤 {vp.stakeholders.join(', ')}</div>}
                  {vp.concerns?.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' as const }}>{vp.concerns.map((c: string) => <span key={c} style={{ ...S.badge('#9b59b6'), fontSize: 10 }}>{c}</span>)}</div>}
                </div>
              )}
              <button style={{ ...S.btn('primary'), width: '100%', fontSize: 12 }} onClick={() => onCreate(vp)}>▶ Activate View</button>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── My Views list ─────────────────────────────────────────────────────────────
function MyViews({ api, onOpen, initialArchitectureState }: { api: any, onOpen: (v: any) => void, initialArchitectureState?: string }) {
  const [views, setViews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterArchState, setFilterArchState] = useState(initialArchitectureState || '')
  const [favOnly, setFavOnly] = useState(false)

  // Syncs to a CHANGED initialArchitectureState, not just its value at
  // first mount - matching ObjectContextViewer's prop-sync pattern
  // (assetId in its useCallback dependency array) rather than a plain
  // useState initial value, which would silently miss a second "Related
  // Architecture Views" link click from ADM while already on this tab
  // (setTab('my-views') to an already-current value doesn't force a
  // remount, so a useState-only initial value would never update).
  useEffect(() => { if (initialArchitectureState) setFilterArchState(initialArchitectureState) }, [initialArchitectureState])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/ea-views').then((d: any) => { setViews(Array.isArray(d) ? d : []); setLoading(false) })
  }, [api])

  useEffect(() => { load() }, [load])

  const toggleFav = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await api.post(`/ea-views/${id}/favorite`)
    load()
  }

  const deleteView = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this view?')) return
    await api.del(`/ea-views/${id}`)
    load()
  }

  const cloneView = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await api.post(`/ea-views/${id}/clone`)
    load()
  }

  const filtered = views.filter(v =>
    (!filterCat || v.category === filterCat) &&
    (!filterStatus || v.status === filterStatus) &&
    (!filterArchState || v.architectureState === filterArchState) &&
    (!favOnly || v.isFavorite)
  )
  const categories = [...new Set(views.map(v => v.category))]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>My Views</div>
        <div style={S.row}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>{filtered.length} / {views.length}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select style={{ ...S.input, maxWidth: 160 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...S.input, maxWidth: 140 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
        </select>
        <select style={{ ...S.input, maxWidth: 150 }} value={filterArchState} onChange={e => setFilterArchState(e.target.value)}>
          <option value="">All Architecture States</option>
          {['BASELINE', 'CURRENT', 'TARGET', 'TRANSITION', 'PLANNED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button style={{ ...S.btn(), background: favOnly ? '#f39c1222' : undefined, color: favOnly ? '#f39c12' : undefined }} onClick={() => setFavOnly(!favOnly)}>⭐ Favorites</button>
      </div>

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {filtered.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No views yet. Go to View Library to activate a predefined view, or create a custom view.</div>}
          {filtered.map(v => (
            <div key={v.id} onClick={() => onOpen(v)} style={{ ...S.card, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: (CATEGORY_COLOR[v.category] || '#3498db') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {VIZ_ICONS[v.visualization] || '📊'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {v.isFavorite && <span style={{ color: '#f39c12' }}>⭐</span>}
                  {v.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', display: 'flex', gap: 8, marginTop: 2 }}>
                  <span style={S.badge(CATEGORY_COLOR[v.category] || '#3498db')}>{v.category}</span>
                  <span style={S.badge(STATUS_COLOR[v.status])}>{v.status}</span>
                  <span style={S.badge(STATE_COLOR[v.architectureState] || '#7f8c8d')}>{v.architectureState}</span>
                  <span style={{ color: 'var(--text-dim)' }}>👁 {v.viewCount}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={e => toggleFav(e, v.id)}>⭐</button>
                <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={e => cloneView(e, v.id)} title="Clone this view">⧉</button>
                <button style={{ ...S.btn('danger'), padding: '3px 10px', fontSize: 12 }} onClick={e => deleteView(e, v.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── View Viewer (graph + matrix + heatmap + capability map) ───────────────────
function ViewViewer({ api, view: viewProp, onBack, onRefresh }: { api: any, view: any, onBack: () => void, onRefresh: () => void }) {
  // publish()/approveView()/rejectView()/requestApproval() all return the
  // updated view from the backend, but the parent's onRefresh only
  // refreshes dashboard stats, not this specific view object it passed
  // down as a prop - without this, clicking e.g. Approve would show no
  // visible change until navigating away and back, which looks like the
  // action silently failed. viewOverrides holds whatever fields the most
  // recent action changed, merged over the (possibly stale) prop for
  // display; reset whenever the user opens a genuinely different view.
  const [viewOverrides, setViewOverrides] = useState<Partial<any>>({})
  useEffect(() => { setViewOverrides({}) }, [viewProp.id])
  const view = { ...viewProp, ...viewOverrides }

  const [data, setData] = useState<any>(null)
  // Phase 4A: canonical ViewDataset + its eligibility evaluation, fetched
  // in the SAME call as `data` (see load() below) - avoids a second,
  // duplicate fetch. Only Table and Matrix consume these; every other
  // renderer (Graph/CapabilityMap/Heatmap/Tree/Cards) continues reading
  // `data` exactly as before, completely unaware this exists.
  const [dataset, setDataset] = useState<any>(null)
  const [eligibility, setEligibility] = useState<any>(null)
  // Phase 4A: which matrix cell is currently drilled into (Section 10) -
  // null when no drill-down panel is open. Holds the cell's row/column
  // object plus its real backing items (relationships for DIRECT, paths
  // for PATH) - never re-queried, reused directly from the already-built
  // matrix.
  const [matrixDrilldown, setMatrixDrilldown] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [vizMode, setVizMode] = useState<string>(view.visualization || 'GRAPH')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [savedFilters, setSavedFilters] = useState<any[]>([])
  const [showSaveFilterBox, setShowSaveFilterBox] = useState(false)
  const [saveFilterName, setSaveFilterName] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [shareData, setShareData] = useState<any>(null)
  const [heatmapField, setHeatmapField] = useState('status')
  const [heatmapFields, setHeatmapFields] = useState<{ code: string; name: string; declaredType: string }[]>([{ code: 'status', name: 'Status', declaredType: 'ENUM' }])
  const [collapsedTreeNodes, setCollapsedTreeNodes] = useState<Set<string>>(new Set())

  // Roadmap-specific state. Always declared (Rules of Hooks), only
  // exercised when view.visualization === 'ROADMAP' - see the isRoadmap
  // branch near the bottom of this component's render.
  const isRoadmap = view.visualization === 'ROADMAP'
  const [roadmapItems, setRoadmapItems] = useState<any[]>([])
  const [roadmapLoading, setRoadmapLoading] = useState(true)
  const [roadmapNeedsConfig, setRoadmapNeedsConfig] = useState(false)

  const loadRoadmap = useCallback(() => {
    if (!isRoadmap) return
    setRoadmapLoading(true)
    setRoadmapNeedsConfig(false)
    api.get(`/ea-views/${view.id}/roadmap`)
      .then((d: any) => {
        if (d?.error || d?.statusCode === 400) { setRoadmapNeedsConfig(true); setRoadmapLoading(false); return }
        setRoadmapItems(d?.items || [])
        setRoadmapLoading(false)
      })
      .catch(() => { setRoadmapNeedsConfig(true); setRoadmapLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id, isRoadmap])

  useEffect(() => { if (isRoadmap) loadRoadmap() }, [isRoadmap, loadRoadmap])

  const saveRoadmapConfig = async (cfg: { startField: string; endField: string; groupByField?: string }) => {
    await api.put(`/ea-views/${view.id}`, { roadmapConfig: cfg })
    loadRoadmap()
  }

  // Dashboard-specific state. Same always-declared-unconditionally
  // approach as the roadmap state above (Rules of Hooks).
  const isDashboard = view.visualization === 'DASHBOARD'
  const [dashboardWidgets, setDashboardWidgets] = useState<DashboardWidget[]>([])
  const [dashboardResults, setDashboardResults] = useState<Record<string, any>>({})
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [editingDashboard, setEditingDashboard] = useState(false)

  const loadDashboard = useCallback(() => {
    if (!isDashboard) return
    setDashboardLoading(true)
    api.get(`/ea-views/${view.id}/dashboard`)
      .then((d: any) => {
        setDashboardWidgets(d?.widgets || [])
        setDashboardResults(d?.results || {})
        setDashboardLoading(false)
      })
      .catch(() => { setDashboardWidgets([]); setDashboardResults({}); setDashboardLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.id, isDashboard])

  useEffect(() => { if (isDashboard) loadDashboard() }, [isDashboard, loadDashboard])

  const saveDashboardWidgets = async (widgets: DashboardWidget[]) => {
    await api.put(`/ea-views/${view.id}`, { dashboardConfig: { widgets } })
    setEditingDashboard(false)
    loadDashboard()
  }

  // Graph canvas state
  const [positions, setPositions] = useState<Record<string,{x:number,y:number}>>({})
  const [dragging, setDragging] = useState<{id:string,ox:number,oy:number}|null>(null)
  const [pan, setPan] = useState({x:0,y:0})
  const [panStart, setPanStart] = useState<{mx:number,my:number,px:number,py:number}|null>(null)
  const [zoom, setZoom] = useState(1)
  const [graphSearch, setGraphSearch] = useState('')
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set())
  const [expandingNodeId, setExpandingNodeId] = useState<string | null>(null)
  const [layoutRunning, setLayoutRunning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const graphContainerRef = React.useRef<HTMLDivElement>(null)
  const graphSvgRef = React.useRef<SVGSVGElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showVersionHistory, setShowVersionHistory] = useState(false)
  const [versions, setVersions] = useState<any[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    // Phase 4A: single fetch to the new /dataset endpoint, not a second
    // call alongside /execute - `d.legacy` is byte-compatible with what
    // /execute always returned (verified by a dedicated backend test),
    // so every existing renderer below reading `data` is completely
    // unaffected. `d.dataset`/`d.eligibility` are new, additive state
    // only Table/Matrix read.
    api.post(`/ea-views/${view.id}/dataset`, {}).then((d: any) => {
      setData(d?.legacy ?? d)
      setDataset(d?.dataset ?? null)
      setEligibility(d?.eligibility ?? null)
      const legacyNodes = d?.legacy?.nodes
      if (legacyNodes) {
        // Auto-layout by domain in columns
        const domGroups: Record<string,any[]> = {}
        for (const n of legacyNodes) { const dk = n.domain||'Other'; if(!domGroups[dk])domGroups[dk]=[]; domGroups[dk].push(n) }
        const pos: Record<string,{x:number,y:number}> = {}
        let colX = 60
        for (const [,ns] of Object.entries(domGroups)) {
          const x = colX
          ns.forEach((n,i) => { pos[n.id] = {x, y:60+i*80} })
          colX += 220
        }
        setPositions(pos)
      }
      setLoading(false)
    })
  }, [view.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/ea-views/saved-filters').then((f: any) => setSavedFilters(Array.isArray(f) ? f : [])).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applySavedFilter = (filterId: string) => {
    const f = savedFilters.find((sf: any) => sf.id === filterId)
    if (!f) return
    const cfg = f.filterConfig || {}
    setFilterDomain(cfg.domain || '')
    setFilterType(cfg.assetType || '')
    setFilterStatus(cfg.status || '')
    setSearch(cfg.search || '')
  }

  const saveCurrentFilters = async () => {
    if (!saveFilterName.trim()) return
    const filterConfig = { domain: filterDomain || undefined, assetType: filterType || undefined, status: filterStatus || undefined, search: search || undefined }
    const created = await api.post('/ea-views/saved-filters', { name: saveFilterName.trim(), filterConfig })
    if (created?.id) setSavedFilters(prev => [...prev, created])
    setShowSaveFilterBox(false)
    setSaveFilterName('')
  }

  const deleteSavedFilter = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await api.del(`/ea-views/saved-filters/${id}`)
    setSavedFilters(prev => prev.filter((f: any) => f.id !== id))
  }

  const publish = async () => {
    const updated = await api.post(`/ea-views/${view.id}/publish`)
    setViewOverrides(prev => ({ ...prev, ...updated }))
    onRefresh()
  }

  // ── Version History ───────────────────────────────────────────────────
  const loadVersions = async () => {
    setVersionsLoading(true)
    const v = await api.get(`/ea-views/${view.id}/versions`)
    setVersions(Array.isArray(v) ? v : [])
    setVersionsLoading(false)
  }
  const openVersionHistory = () => { setShowVersionHistory(true); loadVersions() }
  const restoreVersion = async (versionId: string) => {
    if (!window.confirm('Restore this version? Your current configuration will be saved as a new version first, so nothing is lost.')) return
    const updated = await api.post(`/ea-views/${view.id}/versions/${versionId}/restore`)
    setViewOverrides(prev => ({ ...prev, ...updated }))
    setShowVersionHistory(false)
    load()
  }

  // ── AI Explanation (Copilot integration) ─────────────────────────────────
  //
  // api.post() never rejects on an HTTP error status (only a genuine
  // network failure - fetch itself only rejects for that, not for a 4xx/
  // 5xx response), so a try/catch alone would never actually surface a
  // 400/500 here; the response still "resolves" with an error-shaped
  // body ({statusCode, message}) that has no analysis field. Checking for
  // that explicitly, same reasoning as the Roadmap "needs config" 400
  // case handled the same way earlier this session.
  const runAiAction = async (action: 'explain' | 'risks' | 'gaps' | 'duplicates') => {
    setAiLoading(true)
    setAiError('')
    setAiAnalysis('')
    try {
      const result = await api.post(`/ea-views/${view.id}/ai-explain`, { action })
      if (result?.statusCode >= 400 || !result?.analysis) { setAiError(result?.message || 'The AI assistant could not analyze this view. Please try again.'); return }
      setAiAnalysis(result.analysis)
    } catch (e: any) {
      setAiError('Something went wrong asking the AI about this view. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }
  const askAiQuestion = async () => {
    if (!aiQuestion.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiAnalysis('')
    try {
      const result = await api.post(`/ea-views/${view.id}/ai-explain`, { question: aiQuestion.trim() })
      if (result?.statusCode >= 400 || !result?.analysis) { setAiError(result?.message || 'The AI assistant could not analyze this view. Please try again.'); return }
      setAiAnalysis(result.analysis)
    } catch (e: any) {
      setAiError('Something went wrong asking the AI about this view. Please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  // ── Approval Workflow ─────────────────────────────────────────────────
  const requestApproval = async () => {
    const updated = await api.post(`/ea-views/${view.id}/request-approval`)
    setViewOverrides(prev => ({ ...prev, ...updated }))
  }
  const approveView = async () => {
    const notes = window.prompt('Approval notes (optional):') || undefined
    const updated = await api.post(`/ea-views/${view.id}/approve`, { notes })
    setViewOverrides(prev => ({ ...prev, ...updated }))
    onRefresh()
  }
  const rejectView = async () => {
    const notes = window.prompt('Reason for rejection:')
    if (notes === null) return // cancelled
    const updated = await api.post(`/ea-views/${view.id}/reject`, { notes })
    setViewOverrides(prev => ({ ...prev, ...updated }))
  }

  const takeSnapshot = async () => {
    const name = window.prompt('Snapshot name:', `${view.name} - ${new Date().toLocaleDateString()}`)
    if (!name) return
    await api.post(`/ea-views/${view.id}/snapshots`, { name })
    alert('Snapshot saved!')
  }

  const shareView = async () => {
    const result = await api.post(`/ea-views/${view.id}/share`, { expiryDays: 30 })
    setShareData(result)
    setShowSharePanel(true)
  }

  // Filter nodes
  const filteredNodes = (data?.nodes || []).filter((n: any) =>
    (!filterDomain || n.domain === filterDomain) &&
    (!filterType || n.assetType === filterType) &&
    (!filterStatus || n.status === filterStatus) &&
    (!search || n.name.toLowerCase().includes(search.toLowerCase()))
  )

  const domains = [...new Set((data?.nodes||[]).map((n: any) => n.domain))] as string[]
  const types = [...new Set((data?.nodes||[]).map((n: any) => n.assetType))] as string[]

  // Heatmap field discovery: fields are per-object-type, so this fetches
  // the available attributes for whichever asset type is most common in
  // the current result set (a heatmap over a mixed-type result still gets
  // a sensible field list rather than none at all - see the backend's
  // getHeatmapFields() doc comment for why any attribute, not just
  // declared ENUM/numeric ones, is offered).
  useEffect(() => {
    if (vizMode !== 'HEATMAP' || !data?.nodes?.length) return
    const counts: Record<string, number> = {}
    for (const n of data.nodes) counts[n.assetType] = (counts[n.assetType] || 0) + 1
    const primaryType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    if (!primaryType) return
    api.get(`/ea-views/heatmap-fields?assetType=${encodeURIComponent(primaryType)}`)
      .then((fields: any) => setHeatmapFields(Array.isArray(fields) && fields.length ? fields : [{ code: 'status', name: 'Status', declaredType: 'ENUM' }]))
      .catch(() => setHeatmapFields([{ code: 'status', name: 'Status', declaredType: 'ENUM' }]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vizMode, data])

  // Mirrors the backend's computeHeatmapColorStrategy() exactly (see that
  // method's doc comment) so the frontend can color cells immediately from
  // data it already has, without a round trip per field change.
  const HEATMAP_CATEGORICAL_PALETTE = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b']
  function computeColorStrategy(nodes: any[], field: string): { strategy: 'numeric' | 'categorical' | 'status'; colorByValue: Record<string, string>; min?: number; max?: number } {
    if (field === 'status') return { strategy: 'status', colorByValue: {} }
    const rawValues = nodes.map(n => (n.metadata || {})[field]).filter((v: any) => v !== undefined && v !== null && v !== '')
    const numericValues = rawValues.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v))
    if (rawValues.length > 0 && numericValues.length >= rawValues.length * 0.9) {
      return { strategy: 'numeric', colorByValue: {}, min: Math.min(...numericValues), max: Math.max(...numericValues) }
    }
    const distinctValues = [...new Set(rawValues.map((v: any) => String(v)))].sort()
    const colorByValue: Record<string, string> = {}
    distinctValues.forEach((v, i) => { colorByValue[v as string] = HEATMAP_CATEGORICAL_PALETTE[i % HEATMAP_CATEGORICAL_PALETTE.length] })
    return { strategy: 'categorical', colorByValue }
  }
  function numericGradientColor(value: number, min: number, max: number): string {
    // Green (low) -> amber -> red (high), a common risk/intensity ramp.
    const t = max === min ? 0.5 : (value - min) / (max - min)
    if (t < 0.5) {
      const s = t / 0.5
      return `rgb(${Math.round(46 + s * (243 - 46))}, ${Math.round(204 + s * (156 - 204))}, ${Math.round(113 + s * (18 - 113))})`
    }
    const s = (t - 0.5) / 0.5
    return `rgb(${Math.round(243 + s * (231 - 243))}, ${Math.round(156 + s * (76 - 156))}, ${Math.round(18 + s * (60 - 18))})`
  }

  // Graph handlers
  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const p = positions[id]||{x:100,y:100}
    setDragging({id, ox:e.clientX-p.x, oy:e.clientY-p.y})
    setSelected(data?.nodes?.find((n: any) => n.id===id)||null)
  }
  const onSvgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    setPanStart({mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y})
    setSelected(null)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) setPositions(p=>({...p,[dragging.id]:{x:(e.clientX-dragging.ox)/zoom,y:(e.clientY-dragging.oy)/zoom}}))
    else if (panStart) setPan({x:panStart.px+e.clientX-panStart.mx,y:panStart.py+e.clientY-panStart.my})
  }
  const onMouseUp = () => { setDragging(null); setPanStart(null) }
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom(z=>Math.max(0.25,Math.min(2.5,z-e.deltaY*0.001))) }

  const getEdgePath = (e: any) => {
    const s=positions[e.sourceId]||{x:0,y:0}; const t=positions[e.targetId]||{x:0,y:0}
    return `M ${s.x+80} ${s.y+20} Q ${(s.x+80+t.x)/2} ${(s.y+20+t.y+20)/2} ${t.x} ${t.y+20}`
  }

  // ── Graph: expand a node to reveal its neighbors on demand ─────────────
  //
  // Uses the object-context endpoint (depth=1: just this node's direct
  // relationships) rather than trying to grow the saved view's own query -
  // an expand action is inherently ad-hoc exploration, not something that
  // should change what the saved view itself returns on every load.
  const expandNode = async (nodeId: string) => {
    if (expandedNodeIds.has(nodeId) || expandingNodeId) return
    setExpandingNodeId(nodeId)
    try {
      const result = await api.get(`/ea-views/object-context/${nodeId}?depth=1`)
      if (result?.nodes?.length) {
        setData((prev: any) => {
          const existingIds = new Set((prev?.nodes || []).map((n: any) => n.id))
          const existingEdgeIds = new Set((prev?.edges || []).map((e: any) => e.id))
          const newNodes = result.nodes.filter((n: any) => !existingIds.has(n.id))
          const newEdges = result.edges.filter((e: any) => !existingEdgeIds.has(e.id))
          return { ...prev, nodes: [...(prev?.nodes || []), ...newNodes], edges: [...(prev?.edges || []), ...newEdges] }
        })
        // Place newly-revealed nodes near the node that was expanded, so
        // they don't all stack at the default (100,100) origin before the
        // next auto-layout run.
        const origin = positions[nodeId] || { x: 400, y: 300 }
        setPositions(prev => {
          const next = { ...prev }
          result.nodes.forEach((n: any, i: number) => {
            if (!next[n.id]) { const a = (i / result.nodes.length) * Math.PI * 2; next[n.id] = { x: origin.x + Math.cos(a) * 140, y: origin.y + Math.sin(a) * 140 } }
          })
          return next
        })
      }
      setExpandedNodeIds(prev => new Set(prev).add(nodeId))
    } finally {
      setExpandingNodeId(null)
    }
  }

  const runAutoLayout = () => {
    if (filteredNodes.length > FORCE_LAYOUT_MAX_NODES) {
      alert(`Auto-layout works best under ${FORCE_LAYOUT_MAX_NODES} objects (currently ${filteredNodes.length}). Try narrowing the filters first.`)
      return
    }
    setLayoutRunning(true)
    // A setTimeout(0) so the "Computing..." state actually paints before
    // the synchronous simulation below blocks the thread - the simulation
    // itself is still a single blocking pass (see computeForceLayout's doc
    // comment on why this isn't fully async).
    setTimeout(() => {
      const newPositions = computeForceLayout(filteredNodes, (data?.edges || []).filter((e: any) => filteredNodes.find((n: any) => n.id === e.sourceId) && filteredNodes.find((n: any) => n.id === e.targetId)), positions)
      setPositions(newPositions)
      setLayoutRunning(false)
    }, 0)
  }

  const graphSearchMatches = graphSearch.trim()
    ? filteredNodes.filter((n: any) => n.name.toLowerCase().includes(graphSearch.trim().toLowerCase()))
    : []
  const focusOnNode = (n: any) => {
    setSelected(n)
    const p = positions[n.id]
    if (p && graphContainerRef.current) {
      const rect = graphContainerRef.current.getBoundingClientRect()
      setPan({ x: rect.width / 2 - (p.x + 80) * zoom, y: rect.height / 2 - (p.y + 22) * zoom })
    }
  }

  const toggleFullscreen = () => {
    if (!graphContainerRef.current) return
    if (!document.fullscreenElement) { graphContainerRef.current.requestFullscreen(); setIsFullscreen(true) }
    else { document.exitFullscreen(); setIsFullscreen(false) }
  }

  // ── Export (JSON/CSV/SVG/PNG/PDF/PPTX - true binary XLSX remains
  // deferred, see exportUtils.ts's header comment for why). Every format's
  // content comes only from state already held by this component
  // (filteredNodes, data, view) - no export triggers a fresh fetch of its
  // own. Options offered depend on the active vizMode, since a roadmap-
  // shaped export doesn't make sense from graph data and vice versa.
  // PDF/PPTX/PNG generation is async (canvas rasterization, dynamic
  // library import) - exportingFormat tracks which one is in flight so
  // the menu can show a spinner and avoid double-clicks. ──────────────────
  const [exportingFormat, setExportingFormat] = useState<string | null>(null)
  const exportMeta = { viewName: view.name, architectureState: view.architectureState }
  const getMatrixSourcesTargets = () => {
    const sources = filteredNodes.filter((n: any) => view.rootObjectTypes?.includes(n.assetType))
    const targets = filteredNodes.filter((n: any) => view.relatedObjectTypes?.includes(n.assetType))
    const displayTargets = targets.length > 0 ? targets : filteredNodes.filter((n: any) => !view.rootObjectTypes?.includes(n.assetType))
    return { sources, targets: displayTargets }
  }
  const runExport = async (format: 'json' | 'csv' | 'svg' | 'png' | 'pdf' | 'pptx') => {
    setShowExportMenu(false)
    if (format === 'json') {
      const payload = isRoadmap ? { items: roadmapItems } : isDashboard ? { widgets: dashboardWidgets, results: dashboardResults } : { nodes: filteredNodes, edges: data?.edges || [] }
      exportAsJSON(payload, exportMeta)
      return
    }
    if (format === 'csv') {
      if (isRoadmap) { exportRoadmapAsCSV(roadmapItems, exportMeta); return }
      if (vizMode === 'MATRIX') { const { sources, targets } = getMatrixSourcesTargets(); exportMatrixAsCSV(sources, targets, data?.edges || [], exportMeta); return }
      exportNodesAsCSV(filteredNodes, exportMeta)
      return
    }
    // svg/png/pdf/pptx: graph-shaped formats need the live SVG element;
    // table-shaped formats (pdf/pptx only - svg/png are graph-only, see
    // the menu's own conditional rendering below) work from the same
    // node/matrix/roadmap data CSV already uses.
    setExportingFormat(format)
    try {
      if (format === 'svg') { if (graphSvgRef.current) exportGraphAsSVG(graphSvgRef.current, exportMeta); return }
      if (format === 'png') { if (graphSvgRef.current) await exportGraphAsPNG(graphSvgRef.current, exportMeta); return }
      if (format === 'pdf') {
        if (isRoadmap) { await exportRoadmapAsPDF(roadmapItems, exportMeta); return }
        if (vizMode === 'MATRIX') { const { sources, targets } = getMatrixSourcesTargets(); await exportMatrixAsPDF(sources, targets, data?.edges || [], exportMeta); return }
        if (vizMode === 'GRAPH' && graphSvgRef.current) { await exportGraphAsPDF(graphSvgRef.current, exportMeta); return }
        await exportNodesAsPDF(filteredNodes, exportMeta)
        return
      }
      if (format === 'pptx') {
        if (isRoadmap) { await exportRoadmapAsPPTX(roadmapItems, exportMeta); return }
        if (vizMode === 'MATRIX') { const { sources, targets } = getMatrixSourcesTargets(); await exportMatrixAsPPTX(sources, targets, data?.edges || [], exportMeta); return }
        if (vizMode === 'GRAPH' && graphSvgRef.current) { await exportGraphAsPPTX(graphSvgRef.current, exportMeta); return }
        await exportNodesAsPPTX(filteredNodes, exportMeta)
        return
      }
    } catch (e: any) {
      alert(`Export failed: ${e.message || 'unknown error'}`)
    } finally {
      setExportingFormat(null)
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Mini-map: nodes scaled into a small fixed box, plus a rectangle
  // showing the current viewport within the full node bounding box.
  const graphBounds = (() => {
    const pts = filteredNodes.map((n: any) => positions[n.id]).filter(Boolean) as { x: number; y: number }[]
    if (pts.length === 0) return { minX: 0, minY: 0, maxX: 1000, maxY: 1000 }
    return {
      minX: Math.min(...pts.map(p => p.x)) - 40, minY: Math.min(...pts.map(p => p.y)) - 40,
      maxX: Math.max(...pts.map(p => p.x)) + 200, maxY: Math.max(...pts.map(p => p.y)) + 80,
    }
  })()

  // ── Capability Map ──────────────────────────────────────────────────────────
  const renderCapabilityMap = () => {
    // Filters on semanticType (resolved server-side against the tenant's
    // actual published meta-model, or the legacy generic-type fallback -
    // see view-query.service.ts / semantic-type-resolver.ts) rather than
    // a hardcoded assetType string like 'CAPABILITY'. Framework-typed
    // capability data (e.g. NORA 2.0's GovCapability, TOGAF's Capability)
    // and legacy generic-typed data both resolve to the same
    // 'BusinessCapability' semanticType, so this works regardless of
    // which framework the tenant has published or how the asset was
    // created.
    const caps = filteredNodes.filter((n: any) => n.semanticType === 'BusinessCapability')
    const l1 = caps.filter((c: any) => !c.metadata?.parentId || c.metadata?.level === 1)
    const l2 = caps.filter((c: any) => c.metadata?.parentId && c.metadata?.level !== 1)

    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 12, minWidth: 800 }}>
          {l1.map((cap: any) => {
            const children = l2.filter((c: any) => c.metadata?.parentId === cap.id)
            return (
              <div key={cap.id} style={{ flex: 1, minWidth: 160 }}>
                <div style={{ background: '#3498db22', border: '2px solid #3498db44', borderRadius: 8, padding: '8px 12px', marginBottom: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13, textAlign: 'center', color: '#3498db' }}
                  onClick={() => setSelected(cap)}>{cap.name}</div>
                {children.map((child: any) => (
                  <div key={child.id} style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', marginBottom: 6, cursor: 'pointer', fontSize: 12 }}
                    onClick={() => setSelected(child)}>{child.name}</div>
                ))}
              </div>
            )
          })}
        </div>
        {l1.length === 0 && <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>No capability data. Add capabilities to the EA Repository first.</div>}
      </div>
    )
  }

  // ── Heatmap ─────────────────────────────────────────────────────────────────
  const HEATMAP_STATUS: Record<string,string> = { APPROVED:'#2ecc71', ACTIVE:'#2ecc71', UNDER_REVIEW:'#f39c12', DRAFT:'#e67e22', DEPRECATED:'#e74c3c', PLANNED:'#3498db' }
  const renderHeatmap = () => {
    const strategy = computeColorStrategy(filteredNodes, heatmapField)
    const getColor = (n: any): string => {
      if (strategy.strategy === 'status') return HEATMAP_STATUS[n.status] || '#7f8c8d'
      const raw = (n.metadata || {})[heatmapField]
      if (raw === undefined || raw === null || raw === '') return '#4b5563' // muted gray for "no value"
      if (strategy.strategy === 'numeric') {
        const v = Number(raw)
        return Number.isNaN(v) ? '#4b5563' : numericGradientColor(v, strategy.min!, strategy.max!)
      }
      return strategy.colorByValue[String(raw)] || '#7f8c8d'
    }
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <label style={{ ...S.label, marginBottom: 0 }}>Color by:</label>
          <select style={{ ...S.input, maxWidth: 220 }} value={heatmapField} onChange={e => setHeatmapField(e.target.value)}>
            <option value="domain">Domain</option>
            <option value="assetType">Asset Type</option>
            {heatmapFields.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' as const, maxWidth: '60%' }}>
            {strategy.strategy === 'status' && Object.entries(HEATMAP_STATUS).map(([k,c]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{k}</div>)}
            {strategy.strategy === 'categorical' && Object.entries(strategy.colorByValue).map(([k,c]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{k}</div>)}
            {strategy.strategy === 'numeric' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                <span>{strategy.min}</span>
                <div style={{ width: 100, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, #2ecc71, #f39c12, #e74c3c)' }} />
                <span>{strategy.max}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {filteredNodes.map((n: any) => {
            const color = getColor(n)
            const rawVal = heatmapField === 'status' ? n.status : heatmapField === 'domain' ? n.domain : heatmapField === 'assetType' ? n.assetType : (n.metadata || {})[heatmapField]
            return (
              <div key={n.id} onClick={() => setSelected(n)} style={{ padding: '10px 12px', borderRadius: 8, background: color+'22', border: `1px solid ${color}44`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = color+'44')}
                onMouseLeave={e => (e.currentTarget.style.background = color+'22')}>
                <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{n.assetType.replace(/_/g,' ')}</div>
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{n.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{rawVal === undefined || rawVal === null || rawVal === '' ? '—' : String(rawVal)}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Matrix ───────────────────────────────────────────────────────────────────
  // ── Matrix (Phase 4A - DIRECT/PATH semantic matrix) ─────────────────────
  //
  // Consumes buildMatrix(dataset, eligibility) - never independently
  // invents row/column axes (Section 6). Ineligibility shows the
  // deterministic reason, not an empty grid that looks broken (Section
  // 11). Row/column limits are explicit ("Showing X of Y"), never a
  // silent slice (Section 12) - the old implementation's silent
  // .slice(0,30)/.slice(0,20) is exactly what this replaces.
  const MATRIX_ROW_LIMIT = 30
  const MATRIX_COL_LIMIT = 20
  const renderMatrix = () => {
    const result = buildMatrix(dataset, eligibility)
    if (!result.eligible) {
      return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⊞</div>
        <div>{result.reason}</div>
      </div>
    }
    const allRows = result.rows ?? []
    const allCols = result.columns ?? []
    const rows = allRows.slice(0, MATRIX_ROW_LIMIT)
    const cols = allCols.slice(0, MATRIX_COL_LIMIT)
    const cell = (rowId: string, colId: string) => result.cells?.get(`${rowId}::${colId}`)

    return (
      <div>
        {result.relationMode === 'PATH' && result.pathSteps && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, padding: '6px 10px', background: 'var(--navy-mid)', borderRadius: 6, display: 'inline-block' }}>
            Path-based Matrix ({result.pathSteps.length} hops) — Derived through: {[result.pathSteps[0].from, ...result.pathSteps.map(s => s.to)].join(' → ')}
          </div>
        )}
        {(allRows.length > MATRIX_ROW_LIMIT || allCols.length > MATRIX_COL_LIMIT) && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>
            Showing {rows.length} of {allRows.length} {result.rowType} × {cols.length} of {allCols.length} {result.columnType}
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ padding: '8px 12px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, position: 'sticky', left: 0, minWidth: 140 }}>{result.rowType} ↓ / {result.columnType} →</th>
                {cols.map((c: any) => (
                  <th key={c.id} style={{ padding: '6px 10px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: TYPE_COLOR[c.assetType]||'var(--text)', whiteSpace: 'nowrap', minWidth: 100, maxWidth: 140 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any, ri: number) => (
                <tr key={r.id} style={{ background: ri % 2 === 0 ? 'var(--navy-light)' : 'transparent' }}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, position: 'sticky', left: 0, background: ri % 2 === 0 ? 'var(--navy-light)' : 'var(--navy)', maxWidth: 140 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TYPE_COLOR[r.assetType]||'var(--text)' }}>{r.name}</div>
                  </td>
                  {cols.map((c: any) => {
                    const populated = cell(r.id, c.id)
                    return (
                      <td key={c.id}
                        onClick={() => populated && setMatrixDrilldown({ rowObj: r, colObj: c, relationMode: result.relationMode, items: populated.items })}
                        style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', textAlign: 'center', cursor: populated ? 'pointer' : 'default', background: populated ? 'rgba(3,105,161,0.12)' : 'transparent' }}>
                        {populated && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)' }}>{populated.count > 1 ? `${populated.count} ${result.relationMode === 'PATH' ? 'paths' : ''}`.trim() : (result.relationMode === 'PATH' ? '1 path' : '●')}</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {matrixDrilldown && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setMatrixDrilldown(null)}>
            <div style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, maxWidth: 500, maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{matrixDrilldown.rowObj.name} × {matrixDrilldown.colObj.name}</div>
              {matrixDrilldown.relationMode === 'DIRECT' ? (
                <div>
                  {matrixDrilldown.items.map((rel: any) => (
                    <div key={rel.id} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>{matrixDrilldown.rowObj.name} —{rel.label || rel.relationshipType}→ {matrixDrilldown.colObj.name}</div>
                  ))}
                </div>
              ) : (
                <div>
                  {matrixDrilldown.items.map((path: any) => (
                    <div key={path.id} style={{ fontSize: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      {path.objectIds.map((oid: string) => (dataset?.objects ?? []).find((o: any) => o.id === oid)?.name || oid).join(' → ')}
                    </div>
                  ))}
                </div>
              )}
              <button style={{ ...S.btn(), marginTop: 12 }} onClick={() => setMatrixDrilldown(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Table ────────────────────────────────────────────────────────────────────
  // ── Table (Phase 4A - relationship-aware, with inventory fallback) ──────
  //
  // determineTableMode/buildRelationshipTable consume ViewDataset directly
  // (Section 1) - the inventory branch below (unchanged JSX) is the
  // genuine fallback for a single-object-set view, not the default for a
  // relational one.
  const renderTable = () => {
    const mode = determineTableMode(dataset)
    if (mode === 'relationship') {
      const table = buildRelationshipTable(dataset)
      // Interleaves object columns with the relationship label between
      // each consecutive pair, matching the spec's own worked example:
      // Business Capability | supported_by | Application | hosted_on | Technology
      const headerCells: string[] = []
      table.columns.forEach((c, i) => { headerCells.push(c); if (i < table.relationLabels.length) headerCells.push(table.relationLabels[i]) })
      return (
        <div style={{ overflowX: 'auto' }}>
          {dataset?.provenance?.truncated && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>This result was truncated by a traversal size limit - not every matching path is shown.</div>
          )}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {headerCells.map((h, i) => (
                  <th key={i} style={{ padding: '8px 12px', background: i % 2 === 1 ? 'transparent' : 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: i % 2 === 1 ? 10 : 11, color: 'var(--text-dim)', fontWeight: i % 2 === 1 ? 400 : 600, fontStyle: i % 2 === 1 ? 'italic' : 'normal' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, ri) => {
                const cells: any[] = []
                row.values.forEach((v, i) => {
                  cells.push(<td key={`o${i}`} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 500, cursor: 'pointer' }} onClick={() => setSelected((dataset?.objects ?? []).find((o: any) => o.id === v.id))}>{v.name}</td>)
                  if (i < table.relationLabels.length) cells.push(<td key={`r${i}`} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>{table.relationLabels[i]}</td>)
                })
                return <tr key={row.id} style={{ background: ri % 2 === 0 ? 'var(--navy-light)' : 'transparent' }}>{cells}</tr>
              })}
            </tbody>
          </table>
        </div>
      )
    }
    // Inventory fallback - unchanged from before Phase 4A.
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name','Type','Domain','Status','Owner','Tags'].map(h => <th key={h} style={{ padding: '8px 12px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filteredNodes.map((n: any, i: number) => (
              <tr key={n.id} onClick={() => setSelected(n)} style={{ cursor: 'pointer', background: i%2===0?'var(--navy-light)':'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = i%2===0?'var(--navy-light)':'transparent')}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{n.name}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><span style={S.badge(TYPE_COLOR[n.assetType]||'#7f8c8d')}>{n.assetType.replace(/_/g,' ')}</span></td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)' }}>{n.domain}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><span style={S.badge(HEATMAP_STATUS[n.status]||'#7f8c8d')}>{n.status}</span></td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)' }}>{n.owner||'—'}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{(n.tags||[]).slice(0,2).map((t: string) => <span key={t} style={{ ...S.badge('#7f8c8d'), marginRight: 4, fontSize: 10 }}>{t}</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Tree/Hierarchy (uses metadata.parentId - the same convention the
  // capability hierarchy edges already rely on in the backend) ─────────────
  const renderTree = () => {
    const byParent = new Map<string, any[]>()
    const roots: any[] = []
    const nodeIds = new Set(filteredNodes.map((n: any) => n.id))
    for (const n of filteredNodes) {
      const parentId = n.metadata?.parentId
      if (parentId && nodeIds.has(parentId)) {
        if (!byParent.has(parentId)) byParent.set(parentId, [])
        byParent.get(parentId)!.push(n)
      } else {
        roots.push(n)
      }
    }
    const [collapsed, setLocalCollapsed] = [collapsedTreeNodes, setCollapsedTreeNodes] as const
    const toggle = (id: string) => setLocalCollapsed(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    const renderNode = (n: any, depth: number): React.ReactNode => {
      const children = byParent.get(n.id) || []
      const hasChildren = children.length > 0
      const isCollapsed = collapsed.has(n.id)
      const color = TYPE_COLOR[n.assetType] || '#7f8c8d'
      return (
        <div key={n.id}>
          <div onClick={() => setSelected(n)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginLeft: depth * 22, borderRadius: 6, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {hasChildren ? (
              <span onClick={e => { e.stopPropagation(); toggle(n.id) }} style={{ width: 16, textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer' }}>{isCollapsed ? '▶' : '▼'}</span>
            ) : <span style={{ width: 16 }} />}
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: depth === 0 ? 600 : 400 }}>{n.name}</span>
            <span style={{ ...S.badge(HEATMAP_STATUS[n.status] || '#7f8c8d'), fontSize: 10, marginLeft: 'auto' }}>{n.status}</span>
          </div>
          {hasChildren && !isCollapsed && children.map(c => renderNode(c, depth + 1))}
        </div>
      )
    }
    if (roots.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>No data. This visualization needs objects with a metadata.parentId hierarchy (e.g. capability levels).</div>
    return <div style={S.card}>{roots.map(n => renderNode(n, 0))}</div>
  }

  // ── Cards ─────────────────────────────────────────────────────────────────
  const renderCards = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
      {filteredNodes.map((n: any) => {
        const color = TYPE_COLOR[n.assetType] || '#7f8c8d'
        return (
          <div key={n.id} onClick={() => setSelected(n)} style={{ ...S.card, cursor: 'pointer', borderLeft: `3px solid ${color}` }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--navy-light)')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={S.badge(color)}>{n.assetType.replace(/_/g, ' ')}</span>
              <span style={S.badge(HEATMAP_STATUS[n.status] || '#7f8c8d')}>{n.status}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{n.name}</div>
            {n.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.4, marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{n.description}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
              <span>{n.domain}</span>
              <span>{n.owner || '—'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── Graph ────────────────────────────────────────────────────────────────────
  const renderGraph = () => (
    <div ref={graphContainerRef} style={{ display: 'flex', height: isFullscreen ? '100vh' : 'calc(100vh - 280px)', gap: 0, background: isFullscreen ? 'var(--navy)' : 'transparent' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, maxWidth: 'calc(100% - 200px)' }}>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.min(2.5,z+0.15))}>+</button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 6px' }}>{Math.round(zoom*100)}%</span>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.max(0.25,z-0.15))}>−</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => { setZoom(1); setPan({x:0,y:0}) }}>⊡</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} disabled={layoutRunning} onClick={runAutoLayout}>{layoutRunning ? '⏳ Laying out...' : '🧭 Auto-Layout'}</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={toggleFullscreen}>{isFullscreen ? '⤢ Exit Fullscreen' : '⛶ Fullscreen'}</button>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '3px 6px' }}>{filteredNodes.length} objects</span>
          <div style={{ position: 'relative' }}>
            <input value={graphSearch} onChange={e => setGraphSearch(e.target.value)} placeholder="🔍 Find node..." style={{ ...S.input, width: 150, padding: '4px 8px', fontSize: 12 }} />
            {graphSearch.trim() && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' as const, width: 220, zIndex: 20 }}>
                {graphSearchMatches.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--text-dim)' }}>No matches</div>}
                {graphSearchMatches.slice(0, 8).map((n: any) => (
                  <div key={n.id} onClick={() => { focusOnNode(n); setGraphSearch('') }} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{n.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>
        {loading ? <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-dim)' }}>Loading view data...</div> : (
          <svg ref={graphSvgRef} style={{ width:'100%', height:'100%', cursor: panStart?'grabbing':dragging?'grabbing':'grab' }}
            onMouseDown={onSvgMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
            <defs><marker id="arrow2" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgba(3,105,161,0.4)" /></marker></defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {(data?.edges||[]).filter((e: any) => filteredNodes.find((n: any)=>n.id===e.sourceId) && filteredNodes.find((n: any)=>n.id===e.targetId)).map((e: any) => (
                <g key={e.id}>
                  <path d={getEdgePath(e)} stroke="rgba(3,105,161,0.25)" strokeWidth={1.5} fill="none" markerEnd="url(#arrow2)" />
                </g>
              ))}
              {filteredNodes.map((n: any) => {
                const pos=positions[n.id]||{x:100,y:100}
                const isSel=selected?.id===n.id
                const isMatch = graphSearch.trim() && n.name.toLowerCase().includes(graphSearch.trim().toLowerCase())
                const isExpanded = expandedNodeIds.has(n.id)
                const isExpanding = expandingNodeId === n.id
                const dc=DOMAIN_COLOR[n.domain]||'#3498db'
                return (
                  <g key={n.id} data-node="true" transform={`translate(${pos.x},${pos.y})`} onMouseDown={e=>onNodeMouseDown(e,n.id)} onDoubleClick={() => expandNode(n.id)} style={{cursor: isExpanding ? 'wait' : 'grab'}}>
                    <rect width={160} height={44} rx={8} fill="var(--navy-light)" stroke={isSel?'var(--accent)':isMatch?'#f39c12':dc+'55'} strokeWidth={isSel||isMatch?2:1.5} />
                    <rect width={5} height={44} rx={2} fill={dc} />
                    <text x={16} y={18} fontSize={11} fontWeight={600} fill="var(--text)">{n.name.length>17?n.name.slice(0,16)+'…':n.name}</text>
                    <text x={16} y={32} fontSize={9} fill="rgba(100,116,139,0.7)">{n.assetType.replace(/_/g,' ')} · {n.domain}</text>
                    <circle cx={148} cy={10} r={5} fill={HEATMAP_STATUS[n.status]||'#7f8c8d'} />
                    {isExpanding ? <text x={148} y={38} fontSize={9} fill="var(--accent)">⏳</text> : !isExpanded && <text x={148} y={38} fontSize={9} fill="rgba(100,116,139,0.6)">⊕<title>Double-click to expand</title></text>}
                  </g>
                )
              })}
            </g>
          </svg>
        )}
        {/* Mini-map */}
        {!loading && filteredNodes.length > 0 && (
          <svg width={140} height={100} style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(15,23,42,0.85)', border: '1px solid var(--border)', borderRadius: 8 }}
            viewBox={`${graphBounds.minX} ${graphBounds.minY} ${graphBounds.maxX - graphBounds.minX} ${graphBounds.maxY - graphBounds.minY}`}>
            {filteredNodes.map((n: any) => { const p = positions[n.id]; if (!p) return null; return <rect key={n.id} x={p.x} y={p.y} width={160} height={44} fill={DOMAIN_COLOR[n.domain] || '#3498db'} opacity={0.7} /> })}
          </svg>
        )}
      </div>
      {selected && (
        <div style={{ width: 240, background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, marginLeft:12, padding:16, overflowY:'auto' as const, flexShrink:0 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>{selected.name}</div>
          {[{l:'Type',v:selected.assetType?.replace(/_/g,' ')},{l:'Domain',v:selected.domain},{l:'Status',v:selected.status},{l:'Owner',v:selected.owner||'—'}].map(f=>(
            <div key={f.l} style={{ marginBottom:10 }}><div style={S.label}>{f.l}</div><div style={{fontSize:13}}>{f.v}</div></div>
          ))}
          {selected.description && <><div style={S.label}>Description</div><div style={{fontSize:12,color:'var(--text-dim)',lineHeight:1.6}}>{selected.description}</div></>}
          {selected.tags?.length > 0 && <><div style={{...S.label,marginTop:8}}>Tags</div><div style={{display:'flex',gap:4,flexWrap:'wrap' as const}}>{selected.tags.map((t:string)=><span key={t} style={{...S.badge('#7f8c8d'),fontSize:10}}>{t}</span>)}</div></>}
          <button style={{...S.btn(),marginTop:16,fontSize:12,width:'100%'}} onClick={()=>setSelected(null)}>Close</button>
        </div>
      )}
    </div>
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button style={{ ...S.btn(), padding:'6px 12px' }} onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{view.name}</div>
          <div style={{ display:'flex', gap:6, marginTop:2 }}>
            <span style={S.badge(CATEGORY_COLOR[view.category]||'#3498db')}>{view.category}</span>
            <span style={S.badge(STATUS_COLOR[view.status])}>{view.status}</span>
            <span style={S.badge(STATE_COLOR[view.architectureState]||'#7f8c8d')}>{view.architectureState}</span>
            {view.approvalStatus && view.approvalStatus !== 'NOT_REQUIRED' && (
              <span style={S.badge(view.approvalStatus === 'APPROVED' ? '#2ecc71' : view.approvalStatus === 'REJECTED' ? '#e74c3c' : '#f39c12')}>
                {view.approvalStatus === 'PENDING' ? '⏳ Pending Approval' : view.approvalStatus === 'APPROVED' ? '✓ Approved' : '✕ Rejected'}
              </span>
            )}
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={isRoadmap ? loadRoadmap : isDashboard ? loadDashboard : load}>↻ Refresh</button>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={takeSnapshot}>📸 Snapshot</button>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={openVersionHistory}>🕐 History</button>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={() => { setShowAiPanel(v => !v); setAiAnalysis(''); setAiError(''); setAiQuestion('') }}>🤖 Ask AI</button>
          <div style={{ position:'relative' }}>
            <button style={{ ...S.btn(), fontSize:12 }} disabled={!!exportingFormat} onClick={() => setShowExportMenu(v => !v)}>{exportingFormat ? `⏳ Exporting ${exportingFormat.toUpperCase()}...` : '⬇ Export'}</button>
            {showExportMenu && (() => {
              const isGraphMode = vizMode === 'GRAPH' && !isRoadmap && !isDashboard
              const itemStyle = { display:'block' as const, width:'100%', textAlign:'left' as const, padding:'8px 12px', fontSize:12, background:'none', border:'none', color:'var(--text)', cursor:'pointer' }
              const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'rgba(3,105,161,0.1)')
              const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'none')
              return (
                <div style={{ position:'absolute', top:'100%', right:0, marginTop:4, background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:8, zIndex:20, minWidth:130, overflow:'hidden' }}>
                  <button style={itemStyle} onClick={() => runExport('json')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>JSON</button>
                  {!isDashboard && <button style={itemStyle} onClick={() => runExport('csv')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>CSV</button>}
                  {isGraphMode && <button style={itemStyle} onClick={() => runExport('svg')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>SVG</button>}
                  {isGraphMode && <button style={itemStyle} onClick={() => runExport('png')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>PNG</button>}
                  {!isDashboard && <button style={itemStyle} onClick={() => runExport('pdf')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>PDF</button>}
                  {!isDashboard && <button style={itemStyle} onClick={() => runExport('pptx')} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>PPTX</button>}
                </div>
              )
            })()}
          </div>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={shareView}>🔗 Share</button>
          {isDashboard && <button style={{ ...S.btn(), fontSize:12 }} onClick={() => setEditingDashboard(true)}>⚙ Edit Widgets</button>}
          {view.status === 'DRAFT' && view.approvalStatus === 'PENDING' && (
            <>
              <button style={{ ...S.btn(), fontSize:12, color:'#2ecc71' }} onClick={approveView}>✓ Approve</button>
              <button style={{ ...S.btn(), fontSize:12, color:'#e74c3c' }} onClick={rejectView}>✕ Reject</button>
            </>
          )}
          {view.status === 'DRAFT' && view.approvalStatus !== 'PENDING' && (
            <button style={{ ...S.btn(), fontSize:12 }} onClick={requestApproval}>📝 Request Approval</button>
          )}
          {view.status === 'DRAFT' && <button style={{ ...S.btn('primary'), fontSize:12 }} onClick={publish}>🚀 Publish</button>}
        </div>
      </div>

      {showVersionHistory && (
        <div style={{ ...S.card, marginBottom:16, borderColor:'var(--accent)' }}>
          <div style={{ display:'flex', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontWeight:600 }}>🕐 Version History</div>
            <button style={{ ...S.btn(), fontSize:11, marginLeft:'auto' }} onClick={() => setShowVersionHistory(false)}>Close</button>
          </div>
          {versionsLoading ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:20 }}>Loading...</div>
            : versions.length === 0 ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:20 }}>No version history yet.</div>
            : (
              <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
                {versions.map((v: any) => (
                  <div key={v.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 10px', borderRadius:6, background:'var(--navy-mid)' }}>
                    <span style={S.badge('#3498db')}>v{v.versionNumber}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13 }}>{v.changeReason || '(no reason given)'}</div>
                      <div style={{ fontSize:11, color:'var(--text-dim)' }}>{new Date(v.createdAt).toLocaleString()} · {v.status}</div>
                    </div>
                    {v.versionNumber !== view.currentVersionNumber && (
                      <button style={{ ...S.btn(), fontSize:11 }} onClick={() => restoreVersion(v.id)}>Restore</button>
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {showAiPanel && (
        <div style={{ ...S.card, marginBottom:16, borderColor:'var(--accent)' }}>
          <div style={{ display:'flex', alignItems:'center', marginBottom:12 }}>
            <div style={{ fontWeight:600 }}>🤖 Ask AI About This View</div>
            <button style={{ ...S.btn(), fontSize:11, marginLeft:'auto' }} onClick={() => setShowAiPanel(false)}>Close</button>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const, marginBottom:12 }}>
            <button style={{ ...S.btn(), fontSize:12 }} disabled={aiLoading} onClick={() => runAiAction('explain')}>Explain this View</button>
            <button style={{ ...S.btn(), fontSize:12 }} disabled={aiLoading} onClick={() => runAiAction('risks')}>Identify Risks</button>
            <button style={{ ...S.btn(), fontSize:12 }} disabled={aiLoading} onClick={() => runAiAction('gaps')}>Identify Gaps</button>
            <button style={{ ...S.btn(), fontSize:12 }} disabled={aiLoading} onClick={() => runAiAction('duplicates')}>Find Duplicates</button>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:12 }}>
            <input style={{ ...S.input, flex:1 }} value={aiQuestion} onChange={e => setAiQuestion(e.target.value)} placeholder="Or ask your own question, e.g. What stands out here?"
              onKeyDown={e => { if (e.key === 'Enter') askAiQuestion() }} />
            <button style={{ ...S.btn('primary'), fontSize:12 }} disabled={aiLoading || !aiQuestion.trim()} onClick={askAiQuestion}>Ask</button>
          </div>
          {aiLoading && <div style={{ color:'var(--text-dim)', textAlign:'center', padding:20 }}>Thinking...</div>}
          {aiError && <div style={{ color:'#e74c3c', fontSize:13, padding:'8px 0' }}>⚠ {aiError}</div>}
          {aiAnalysis && !aiLoading && (
            <div style={{ background:'var(--navy-mid)', borderRadius:8, padding:14, fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap' as const }}>{aiAnalysis}</div>
          )}
        </div>
      )}

      {isDashboard ? (
        editingDashboard ? (
          <DashboardBuilder widgets={dashboardWidgets} onSave={saveDashboardWidgets} onCancel={() => setEditingDashboard(false)} />
        ) : dashboardLoading ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:60 }}>Loading dashboard...</div>
        : (
          <DashboardGrid widgets={dashboardWidgets} results={dashboardResults} onEdit={() => setEditingDashboard(true)} />
        )
      ) : isRoadmap ? (
        roadmapLoading ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:60 }}>Loading roadmap...</div>
        : roadmapNeedsConfig ? (
          <RoadmapConfigPanel api={api} assetType={view.rootObjectTypes?.[0] || ''} initial={view.roadmapConfig || {}} onSave={saveRoadmapConfig} onCancel={onBack} />
        ) : (
          <RoadmapTimeline items={roadmapItems} onSelect={(item) => setSelected({ ...item, assetType: item.assetType, tags: [] })} />
        )
      ) : (
      <>
      {/* Viz mode selector */}
      <div style={{ display:'flex', gap:2, background:'var(--navy-light)', borderRadius:8, padding:3, marginBottom:16, width:'fit-content' }}>
        {['GRAPH','CAPABILITY_MAP','HEATMAP','MATRIX','TREE','CARDS','TABLE'].map(m => (
          <button key={m} style={{ ...S.btn(), padding:'5px 12px', fontSize:12, background:vizMode===m?'var(--accent)':'none', color:vizMode===m?'var(--navy)':'var(--text-dim)' }} onClick={()=>setVizMode(m)}>
            {VIZ_ICONS[m]} {m.replace(/_/g,' ')}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' as const }}>
        <input style={{ ...S.input, maxWidth:200 }} placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)} />
        <select style={{ ...S.input, maxWidth:150 }} value={filterDomain} onChange={e=>setFilterDomain(e.target.value)}>
          <option value="">All Domains</option>
          {domains.map(d=><option key={d} value={d}>{d}</option>)}
        </select>
        <select style={{ ...S.input, maxWidth:160 }} value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
        </select>
        <select style={{ ...S.input, maxWidth:140 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          {['APPROVED','ACTIVE','UNDER_REVIEW','DRAFT','PLANNED','DEPRECATED'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {savedFilters.length > 0 && (
          <select style={{ ...S.input, maxWidth:170 }} value="" onChange={e => { if (e.target.value) applySavedFilter(e.target.value) }}>
            <option value="">📁 Apply Saved Filter...</option>
            {savedFilters.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        )}
        <button style={{ ...S.btn(), fontSize:12 }} onClick={() => setShowSaveFilterBox(v => !v)}>💾 Save Filters</button>
        <div style={{ marginLeft:'auto', fontSize:13, color:'var(--text-dim)', display:'flex', alignItems:'center' }}>{filteredNodes.length} / {data?.nodes?.length||0} objects</div>
      </div>

      {showSaveFilterBox && (
        <div style={{ ...S.card, marginBottom:16, padding:12, display:'flex', gap:8, alignItems:'center' }}>
          <input style={{ ...S.input, maxWidth:220 }} placeholder="e.g. Critical Applications" value={saveFilterName} onChange={e => setSaveFilterName(e.target.value)} autoFocus />
          <button style={{ ...S.btn('primary'), fontSize:12 }} disabled={!saveFilterName.trim()} onClick={saveCurrentFilters}>Save Current Filters</button>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={() => { setShowSaveFilterBox(false); setSaveFilterName('') }}>Cancel</button>
        </div>
      )}

      {savedFilters.length > 0 && (
        <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' as const }}>
          {savedFilters.map((f: any) => (
            <span key={f.id} style={{ ...S.badge('#7f8c8d'), display:'flex', alignItems:'center', gap:6, cursor:'pointer' }} onClick={() => applySavedFilter(f.id)}>
              📁 {f.name}
              <span onClick={(e) => deleteSavedFilter(e, f.id)} style={{ opacity:0.6 }} title="Delete this saved filter">✕</span>
            </span>
          ))}
        </div>
      )}

      {/* Share panel */}
      {showSharePanel && shareData && (
        <div style={{ ...S.card, marginBottom:16, borderColor:'var(--accent)' }}>
          <div style={{ fontWeight:600, marginBottom:8 }}>🔗 Share Link Generated</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <input style={{ ...S.input, fontFamily:'monospace', fontSize:12 }} readOnly value={`${window.location.origin}/shared/${shareData.token}`} />
            <button style={{ ...S.btn('primary'), whiteSpace:'nowrap' as const }} onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/shared/${shareData.token}`); alert('Copied!') }}>Copy</button>
          </div>
          <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:8 }}>Expires: {shareData.expiry ? new Date(shareData.expiry).toLocaleDateString() : 'Never'}</div>
          <button style={{ ...S.btn(), marginTop:8, fontSize:12 }} onClick={()=>setShowSharePanel(false)}>Close</button>
        </div>
      )}

      {/* Visualization */}
      {loading ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:60 }}>Loading view data...</div>
        : vizMode === 'GRAPH' ? renderGraph()
        : vizMode === 'CAPABILITY_MAP' ? renderCapabilityMap()
        : vizMode === 'HEATMAP' ? renderHeatmap()
        : vizMode === 'MATRIX' ? renderMatrix()
        : vizMode === 'TREE' ? renderTree()
        : vizMode === 'CARDS' ? renderCards()
        : renderTable()}
      </>
      )}
    </div>
  )
}

// ── View Builder ──────────────────────────────────────────────────────────────
function ViewBuilder({ api, viewpoint, onCreated, onCancel }: { api: any, viewpoint: any, onCreated: (v: any) => void, onCancel: () => void }) {
  const ASSET_TYPES = ['CAPABILITY','APPLICATION','DATA_ENTITY','TECH_COMPONENT','SECURITY_CONTROL','EA_PRINCIPLE','INTEGRATION','PROCESS','ORG_UNIT','RISK']
  const DOMAINS = ['BUSINESS','APPLICATION','DATA','TECHNOLOGY','SECURITY','STRATEGIC','BENEFICIARY_EXPERIENCE','CROSS_CUTTING']
  const VIZS = ['GRAPH','CAPABILITY_MAP','HEATMAP','MATRIX','TREE','CARDS','TABLE','ROADMAP','DASHBOARD','LANDSCAPE']
  const STATES = ['CURRENT','TARGET','TRANSITION','BASELINE','PLANNED']
  const CATS = ['Business','Application','Data','Technology','Security','Cross-Domain','Strategic','Governance','Custom']

  const [form, setForm] = useState<{
    name: string
    description: string
    category: string
    visualization: string
    architectureState: string
    rootObjectTypes: string[]
    relatedObjectTypes: string[]
    domains: string[]
    viewpointId: string | undefined
    relationshipPath: RelationshipHop[]
  }>({
    name: viewpoint?.name || '',
    description: viewpoint?.description || '',
    category: viewpoint?.category || 'Custom',
    visualization: viewpoint?.defaultVisualization || 'GRAPH',
    architectureState: 'CURRENT',
    rootObjectTypes: viewpoint?.rootObjectTypes || [],
    relatedObjectTypes: viewpoint?.relatedObjectTypes || [],
    domains: viewpoint?.requiredDomains || [],
    viewpointId: viewpoint?.id || undefined,
    relationshipPath: [],
  })
  const [saving, setSaving] = useState(false)

  const toggleArr = (arr: string[], val: string) => arr.includes(val) ? arr.filter(v=>v!==val) : [...arr, val]

  const save = async () => {
    if (!form.name) return
    setSaving(true)
    const result = await api.post('/ea-views', form)
    setSaving(false)
    if (result?.id) onCreated(result)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button style={{ ...S.btn(), padding:'6px 12px' }} onClick={onCancel}>← Back</button>
        <div style={{ fontSize:18, fontWeight:700 }}>{viewpoint ? `Configure: ${viewpoint.name}` : 'New Custom View'}</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }}>
        <div style={{ display:'flex', flexDirection:'column' as const, gap:16 }}>
          <div style={S.card}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Identity</div>
            <div style={S.grid2}>
              <div style={{ gridColumn:'1/-1' }}><label style={S.label}>View Name *</label><input style={S.input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Q4 2026 Application Portfolio" /></div>
              <div><label style={S.label}>Category</label>
                <select style={S.input} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label style={S.label}>Architecture State</label>
                <select style={S.input} value={form.architectureState} onChange={e=>setForm(f=>({...f,architectureState:e.target.value}))}>
                  {STATES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Visualization</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
              {VIZS.map(v=>(
                <div key={v} onClick={()=>setForm(f=>({...f,visualization:v}))} style={{ padding:'10px 12px', borderRadius:8, border:`2px solid ${form.visualization===v?'var(--accent)':'var(--border)'}`, cursor:'pointer', textAlign:'center', background:form.visualization===v?'rgba(3,105,161,0.08)':'transparent' }}>
                  <div style={{ fontSize:20 }}>{VIZ_ICONS[v]}</div>
                  <div style={{ fontSize:11, fontWeight:500, marginTop:4 }}>{v.replace(/_/g,' ')}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Object Types</div>
            <div style={{ marginBottom:12 }}><label style={S.label}>Primary Object Types (root)</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                {ASSET_TYPES.map(t=><span key={t} onClick={()=>setForm(f=>({...f,rootObjectTypes:toggleArr(f.rootObjectTypes,t)}))} style={{ ...S.badge(form.rootObjectTypes.includes(t)?TYPE_COLOR[t]||'var(--accent)':'#7f8c8d'), cursor:'pointer', opacity:form.rootObjectTypes.includes(t)?1:0.5 }}>{t.replace(/_/g,' ')}</span>)}
              </div>
            </div>
            {/* Progressive disclosure: hidden until at least one root type
                is picked. Before that, the exclusion filter below has
                nothing to exclude yet, so every type would render
                identically (same unselected styling) in both this section
                and Primary Object Types above - confusingly duplicated and
                genuinely ambiguous to click, caught by a test asserting on
                a single "CAPABILITY" badge finding two matches instead of
                one. */}
            {form.rootObjectTypes.length > 0 && (
              <div><label style={S.label}>Related Object Types</label>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                  {ASSET_TYPES.filter(t=>!form.rootObjectTypes.includes(t)).map(t=><span key={t} onClick={()=>setForm(f=>({...f,relatedObjectTypes:toggleArr(f.relatedObjectTypes,t)}))} style={{ ...S.badge(form.relatedObjectTypes.includes(t)?'#f39c12':'#7f8c8d'), cursor:'pointer', opacity:form.relatedObjectTypes.includes(t)?1:0.5 }}>{t.replace(/_/g,' ')}</span>)}
                </div>
              </div>
            )}
          </div>

          {/* Progressive disclosure: the Path Builder only appears once a
              root type is picked - a single-level view (the pre-existing,
              simpler flow) doesn't need it at all. */}
          {form.rootObjectTypes.length > 0 && (
            <div style={S.card}>
              <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Relationship Path <span style={{ fontWeight:400, fontSize:12, color:'var(--text-dim)' }}>(optional - walk multiple hops instead of a single-level view)</span></div>
              <PathBuilder api={api} rootType={form.rootObjectTypes[0]} initialPath={form.relationshipPath} onChange={(path) => setForm(f => ({ ...f, relationshipPath: path }))} />
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Domains</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
              {DOMAINS.map(d=><span key={d} onClick={()=>setForm(f=>({...f,domains:toggleArr(f.domains,d)}))} style={{ ...S.badge(form.domains.includes(d)?DOMAIN_COLOR[d]||'var(--accent)':'#7f8c8d'), cursor:'pointer', opacity:form.domains.includes(d)?1:0.5 }}>{d.replace(/_/g,' ')}</span>)}
            </div>
            <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:8 }}>Leave empty to include all domains</div>
          </div>
        </div>

        {/* Preview panel */}
        <div style={{ display:'flex', flexDirection:'column' as const, gap:12 }}>
          <div style={{ ...S.card, position:'sticky', top:0 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Summary</div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
              <div><div style={S.label}>View Name</div><div style={{ fontSize:13, fontWeight:500 }}>{form.name || '—'}</div></div>
              <div><div style={S.label}>Visualization</div><div style={{ fontSize:13 }}>{VIZ_ICONS[form.visualization]} {form.visualization.replace(/_/g,' ')}</div></div>
              <div><div style={S.label}>State</div><div style={{ ...S.badge(STATE_COLOR[form.architectureState]||'#7f8c8d'), display:'inline-flex' }}>{form.architectureState}</div></div>
              <div><div style={S.label}>Primary Types</div><div style={{ display:'flex', gap:4, flexWrap:'wrap' as const }}>
                {form.rootObjectTypes.length ? form.rootObjectTypes.map((t: string)=><span key={t} style={{ ...S.badge(TYPE_COLOR[t]||'#3498db'), fontSize:10 }}>{t.replace(/_/g,' ')}</span>) : <span style={{ fontSize:12, color:'var(--text-dim)' }}>None selected</span>}
              </div></div>
              <div><div style={S.label}>Domains</div><div style={{ display:'flex', gap:4, flexWrap:'wrap' as const }}>
                {form.domains.length ? form.domains.map((d: string)=><span key={d} style={{ ...S.badge(DOMAIN_COLOR[d]||'#3498db'), fontSize:10 }}>{d}</span>) : <span style={{ fontSize:12, color:'var(--text-dim)' }}>All domains</span>}
              </div></div>
            </div>
            <button style={{ ...S.btn('primary'), width:'100%', marginTop:16 }} onClick={save} disabled={!form.name||saving}>{saving?'Creating...':'✅ Create View'}</button>
            <button style={{ ...S.btn(), width:'100%', marginTop:8 }} onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Snapshots ─────────────────────────────────────────────────────────────────
function SnapshotsPanel({ api }: { api: any }) {
  const [views, setViews] = useState<any[]>([])
  const [snapshots, setSnapshots] = useState<any[]>([])
  const [selectedView, setSelectedView] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/ea-views').then((d: any) => setViews(Array.isArray(d)?d:[])) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!selectedView) return
    setLoading(true)
    api.get(`/ea-views/${selectedView}/snapshots`).then((d: any) => { setSnapshots(Array.isArray(d)?d:[]); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedView])

  return (
    <div>
      <div style={{ fontSize:18, fontWeight:700, marginBottom:6 }}>Snapshots</div>
      <div style={{ fontSize:13, color:'var(--text-dim)', marginBottom:20 }}>Immutable point-in-time captures of view data for audit and comparison</div>
      <div style={{ marginBottom:16 }}>
        <label style={S.label}>Select View</label>
        <select style={{ ...S.input, maxWidth:300 }} value={selectedView} onChange={e=>setSelectedView(e.target.value)}>
          <option value="">Choose a view...</option>
          {views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      {loading ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:40 }}>Loading...</div>
        : snapshots.length === 0 && selectedView ? <div style={{ ...S.card, textAlign:'center', color:'var(--text-dim)', padding:40 }}>No snapshots for this view yet. Open the view and click 📸 Snapshot.</div>
        : snapshots.map(s => (
          <div key={s.id} style={{ ...S.card, marginBottom:8, display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:40, height:40, borderRadius:8, background:'rgba(3,105,161,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📸</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:600 }}>{s.name}</div>
              <div style={{ fontSize:12, color:'var(--text-dim)' }}>{s.objectCount} objects · {s.relationshipCount} relationships · {new Date(s.takenAt).toLocaleString()}</div>
            </div>
            <span style={S.badge(STATE_COLOR[s.architectureState]||'#7f8c8d')}>{s.architectureState}</span>
          </div>
        ))
      }
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function ViewsDashboard({ api, stats, onTab, onOpenView }: { api: any, stats: any, onTab: (t:string)=>void, onOpenView: (v:any)=>void }) {
  const [recent, setRecent] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])

  useEffect(() => {
    api.get('/ea-views').then((d: any) => {
      const views = Array.isArray(d) ? d : []
      setRecent(views.sort((a: any,b: any) => new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime()).slice(0,4))
      setFavorites(views.filter((v: any) => v.isFavorite).slice(0,4))
    })
  }, [api])

  const repo = stats?.repositoryObjects || {}
  return (
    <div style={{ display:'flex', flexDirection:'column' as const, gap:20 }}>
      {/* Stats */}
      <div style={S.grid3}>
        {[
          { icon:'📊', label:'Total Views', value:stats?.total||0, color:'var(--accent)', tab:'my-views' },
          { icon:'🚀', label:'Published', value:stats?.published||0, color:'#2ecc71', tab:'my-views' },
          { icon:'⭐', label:'Favorites', value:stats?.favorites||0, color:'#f39c12', tab:'my-views' },
          { icon:'⬛', label:'Capabilities', value:repo.capabilities||0, color:'#3498db', tab:'' },
          { icon:'💻', label:'Applications', value:repo.applications||0, color:'#e67e22', tab:'' },
          { icon:'🗄', label:'Data Entities', value:repo.dataEntities||0, color:'#1abc9c', tab:'' },
        ].map(s=>(
          <div key={s.label} style={{ ...S.statCard, cursor:s.tab?'pointer':'default' }} onClick={()=>s.tab&&onTab(s.tab)}>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}><span style={{fontSize:20}}>{s.icon}</span><span style={{fontSize:11,color:'var(--text-dim)',fontWeight:600}}>{s.label}</span></div>
            <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={S.card}>
        <div style={{ fontSize:13, fontWeight:600, color:'var(--text-dim)', marginBottom:12 }}>QUICK ACTIONS</div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap' as const }}>
          <button style={S.btn('primary')} onClick={()=>onTab('library')}>📚 Browse View Library</button>
          <button style={S.btn()} onClick={()=>onTab('builder')}>+ Custom View</button>
          <button style={S.btn()} onClick={()=>onTab('my-views')}>📋 My Views</button>
          <button style={S.btn()} onClick={()=>onTab('snapshots')}>📸 Snapshots</button>
        </div>
      </div>

      {/* Favorites */}
      {favorites.length > 0 && (
        <div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>⭐ Favorites</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            {favorites.map(v=>(
              <div key={v.id} onClick={()=>onOpenView(v)} style={{ ...S.card, cursor:'pointer', display:'flex', gap:12, alignItems:'center', padding:'12px 16px' }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--accent)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                <div style={{ fontSize:22 }}>{VIZ_ICONS[v.visualization]||'📊'}</div>
                <div><div style={{ fontWeight:600 }}>{v.name}</div><div style={{ fontSize:11, color:'var(--text-dim)' }}>{v.category} · {v.architectureState}</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div>
          <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>🕐 Recently Updated</div>
          <div style={{ display:'flex', flexDirection:'column' as const, gap:6 }}>
            {recent.map(v=>(
              <div key={v.id} onClick={()=>onOpenView(v)} style={{ ...S.card, cursor:'pointer', display:'flex', gap:12, alignItems:'center', padding:'10px 16px' }}
                onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--accent)')}
                onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                <div style={{ fontSize:18 }}>{VIZ_ICONS[v.visualization]||'📊'}</div>
                <div style={{ flex:1 }}><div style={{ fontWeight:500 }}>{v.name}</div><div style={{ fontSize:11, color:'var(--text-dim)' }}>{v.category} · {new Date(v.updatedAt).toLocaleDateString()}</div></div>
                <span style={S.badge(STATUS_COLOR[v.status])}>{v.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
// ── Object Context Viewer ("Open in View" from a repository asset) ────────
//
// Deliberately NOT reusing ViewViewer - that component's snapshot/share/
// publish/edit machinery is all saved-view concepts that don't apply to
// an ad-hoc "show me this object's dependencies" query. This is a smaller,
// standalone viewer: fetch, force-layout, pan/zoom/click - the exploration
// primitives, without the full Studio chrome around them.
function ObjectContextViewer({ api, assetId, onBack }: { api: any; assetId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [depth, setDepth] = useState(2)
  const [direction, setDirection] = useState<'BOTH'|'UPSTREAM'|'DOWNSTREAM'>('BOTH')
  const [relTypeFilter, setRelTypeFilter] = useState<Set<string>>(new Set())
  const [positions, setPositions] = useState<Record<string,{x:number,y:number}>>({})
  const [selected, setSelected] = useState<any>(null)
  const [dragging, setDragging] = useState<{id:string,ox:number,oy:number}|null>(null)
  const [pan, setPan] = useState({x:0,y:0})
  const [panStart, setPanStart] = useState<{mx:number,my:number,px:number,py:number}|null>(null)
  const [zoom, setZoom] = useState(1)
  const [pathTargetSearch, setPathTargetSearch] = useState('')
  const [pathTargetOptions, setPathTargetOptions] = useState<any[]>([])
  const [pathResult, setPathResult] = useState<any>(null)
  const [pathSearching, setPathSearching] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ depth: String(depth), direction })
    if (relTypeFilter.size > 0) params.set('relationshipTypes', [...relTypeFilter].join(','))
    api.get(`/ea-views/object-context/${assetId}?${params.toString()}`).then((d: any) => {
      setData(d)
      if (d?.nodes?.length) setPositions(computeForceLayout(d.nodes, d.edges || [], {}))
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId, depth, direction, relTypeFilter])

  useEffect(() => { load() }, [load])

  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const p = positions[id]||{x:100,y:100}
    setDragging({id, ox:e.clientX-p.x, oy:e.clientY-p.y})
    setSelected(data?.nodes?.find((n: any) => n.id===id)||null)
  }
  const onSvgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    setPanStart({mx:e.clientX,my:e.clientY,px:pan.x,py:pan.y})
    setSelected(null)
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) setPositions(p=>({...p,[dragging.id]:{x:(e.clientX-dragging.ox)/zoom,y:(e.clientY-dragging.oy)/zoom}}))
    else if (panStart) setPan({x:panStart.px+e.clientX-panStart.mx,y:panStart.py+e.clientY-panStart.my})
  }
  const onMouseUp = () => { setDragging(null); setPanStart(null) }
  const getEdgePath = (e: any) => {
    const s=positions[e.sourceId]||{x:0,y:0}; const t=positions[e.targetId]||{x:0,y:0}
    return `M ${s.x+80} ${s.y+20} Q ${(s.x+80+t.x)/2} ${(s.y+20+t.y+20)/2} ${t.x} ${t.y+20}`
  }

  const toggleRelType = (type: string) => setRelTypeFilter(prev => { const next = new Set(prev); next.has(type) ? next.delete(type) : next.add(type); return next })
  // Populated from the full-graph relationship types actually observed
  // once (not re-derived from the currently-filtered result, which would
  // shrink the checklist itself as filters get applied) - a simple
  // client-side cache of the type names seen the first time this
  // assetId+depth+direction combination loaded with no filter.
  const [knownRelTypes, setKnownRelTypes] = useState<string[]>([])
  useEffect(() => {
    if (relTypeFilter.size === 0 && data?.edges?.length) {
      setKnownRelTypes(prev => [...new Set([...prev, ...data.edges.map((e: any) => e.relationshipType)])])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  const searchPathTargets = async (q: string) => {
    setPathTargetSearch(q)
    if (q.trim().length < 2) { setPathTargetOptions([]); return }
    // Searches the full repository, not just objects already loaded in
    // this exploration - a genuinely useful dependency-path question is
    // often "is there a path between this and something I haven't
    // navigated to yet", not just between two objects already on screen.
    const results = await api.get(`/ea-repository/assets?search=${encodeURIComponent(q.trim())}`)
    setPathTargetOptions((Array.isArray(results) ? results : []).filter((n: any) => n.id !== assetId).slice(0, 8))
  }
  const findPathTo = async (targetId: string) => {
    setPathSearching(true)
    setPathTargetOptions([])
    try {
      const result = await api.get(`/ea-views/shortest-path?from=${assetId}&to=${targetId}`)
      setPathResult(result)
    } finally {
      setPathSearching(false)
    }
  }

  const rootNode = (data?.nodes || []).find((n: any) => n.id === assetId)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button style={{ ...S.btn(), padding:'6px 12px' }} onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{rootNode ? `Dependencies of ${rootNode.name}` : 'Object Context'}</div>
          <div style={{ fontSize:12, color:'var(--text-dim)' }}>Ad-hoc exploration - not a saved view</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', gap:2, background:'var(--navy-light)', borderRadius:8, padding:2 }}>
            {(['BOTH','UPSTREAM','DOWNSTREAM'] as const).map(d => (
              <button key={d} style={{ ...S.btn(), padding:'4px 10px', fontSize:11, background:direction===d?'var(--accent)':'none', color:direction===d?'var(--navy)':'var(--text-dim)' }} onClick={()=>setDirection(d)} title={d==='UPSTREAM'?'What feeds into this object':d==='DOWNSTREAM'?'What this object feeds into':'Both directions'}>
                {d==='UPSTREAM'?'⬅ Upstream':d==='DOWNSTREAM'?'Downstream ➡':'↔ Both'}
              </button>
            ))}
          </div>
          <label style={{ fontSize:12, color:'var(--text-dim)' }}>Depth:</label>
          <select style={{ ...S.input, width:70 }} value={depth} onChange={e => setDepth(parseInt(e.target.value, 10))}>
            {[1,2,3,4].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={load}>↻ Refresh</button>
        </div>
      </div>
      {knownRelTypes.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, flexWrap:'wrap' as const }}>
          <span style={{ fontSize:11, color:'var(--text-dim)' }}>Filter relationship types:</span>
          {knownRelTypes.map(t => (
            <span key={t} onClick={()=>toggleRelType(t)} style={{ ...S.badge(relTypeFilter.has(t)?'var(--accent)':'#7f8c8d'), cursor:'pointer', opacity:relTypeFilter.size===0||relTypeFilter.has(t)?1:0.5 }}>{t}</span>
          ))}
          {relTypeFilter.size > 0 && <button style={{ ...S.btn(), padding:'2px 8px', fontSize:10 }} onClick={()=>setRelTypeFilter(new Set())}>Clear</button>}
        </div>
      )}
      <div style={{ ...S.card, marginBottom:16, padding:12 }}>
        <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>🔍 Find shortest path to another object</div>
        <div style={{ position:'relative', maxWidth:320 }}>
          <input style={S.input} value={pathTargetSearch} onChange={e => searchPathTargets(e.target.value)} placeholder="Search for an object by name..." />
          {pathTargetOptions.length > 0 && (
            <div style={{ position:'absolute', top:'100%', left:0, marginTop:4, background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:8, width:'100%', zIndex:20, maxHeight:200, overflowY:'auto' as const }}>
              {pathTargetOptions.map((n: any) => (
                <div key={n.id} onClick={() => { setPathTargetSearch(n.name); findPathTo(n.id) }} style={{ padding:'6px 10px', fontSize:12, cursor:'pointer', borderBottom:'1px solid var(--border)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{n.name}</div>
              ))}
            </div>
          )}
        </div>
        {pathSearching && <div style={{ fontSize:12, color:'var(--text-dim)', marginTop:8 }}>Searching...</div>}
        {pathResult && !pathSearching && (
          pathResult.found ? (
            <div style={{ marginTop:10, fontSize:12 }}>
              <strong>Path found</strong> ({pathResult.nodes.length} objects, {pathResult.edges.length} hops):
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' as const, marginTop:6 }}>
                {pathResult.nodes.map((n: any, i: number) => (
                  <React.Fragment key={n.id}>
                    {i > 0 && <span style={{ color:'var(--text-dim)' }}>→ {pathResult.edges[i-1]?.label} →</span>}
                    <span style={S.badge(TYPE_COLOR[n.assetType]||'var(--accent)')}>{n.name}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginTop:10, fontSize:12, color:'var(--text-dim)' }}>No connecting path found between these two objects.</div>
          )
        )}
      </div>
      {data?.truncated && (
        <div style={{ ...S.card, borderColor:'#f39c12', marginBottom:16, fontSize:12 }}>⚠ This object has more connections than can be shown at once - results were truncated. Try a lower depth.</div>
      )}
      <div style={{ display: 'flex', height: 'calc(100vh - 280px)', gap: 0 }}>
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6 }}>
            <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.min(2.5,z+0.15))}>+</button>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 6px' }}>{Math.round(zoom*100)}%</span>
            <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.max(0.25,z-0.15))}>−</button>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '3px 6px' }}>{data?.nodes?.length||0} objects</span>
          </div>
          {loading ? <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-dim)' }}>Loading...</div> : (
            <svg style={{ width:'100%', height:'100%', cursor: panStart?'grabbing':dragging?'grabbing':'grab' }}
              onMouseDown={onSvgMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
              <defs><marker id="arrow3" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgba(3,105,161,0.4)" /></marker></defs>
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {(data?.edges||[]).map((e: any) => <path key={e.id} d={getEdgePath(e)} stroke="rgba(3,105,161,0.25)" strokeWidth={1.5} fill="none" markerEnd="url(#arrow3)" />)}
                {(data?.nodes||[]).map((n: any) => {
                  const pos=positions[n.id]||{x:100,y:100}
                  const isSel=selected?.id===n.id
                  const isRoot = n.id === assetId
                  const dc=DOMAIN_COLOR[n.domain]||'#3498db'
                  return (
                    <g key={n.id} data-node="true" transform={`translate(${pos.x},${pos.y})`} onMouseDown={e=>onNodeMouseDown(e,n.id)} style={{cursor:'grab'}}>
                      <rect width={160} height={44} rx={8} fill="var(--navy-light)" stroke={isRoot?'var(--accent)':isSel?'#f39c12':dc+'55'} strokeWidth={isRoot||isSel?2.5:1.5} />
                      <rect width={5} height={44} rx={2} fill={dc} />
                      <text x={16} y={18} fontSize={11} fontWeight={600} fill="var(--text)">{n.name.length>17?n.name.slice(0,16)+'…':n.name}</text>
                      <text x={16} y={32} fontSize={9} fill="rgba(100,116,139,0.7)">{n.assetType.replace(/_/g,' ')} · {n.domain}</text>
                    </g>
                  )
                })}
              </g>
            </svg>
          )}
        </div>
        {selected && (
          <div style={{ width: 240, background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, marginLeft:12, padding:16, overflowY:'auto' as const, flexShrink:0 }}>
            <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>{selected.name}</div>
            {[{l:'Type',v:selected.assetType?.replace(/_/g,' ')},{l:'Domain',v:selected.domain},{l:'Status',v:selected.status},{l:'Owner',v:selected.owner||'—'}].map(f=>(
              <div key={f.l} style={{ marginBottom:10 }}><div style={S.label}>{f.l}</div><div style={{fontSize:13}}>{f.v}</div></div>
            ))}
            <button style={{...S.btn(),marginTop:16,fontSize:12,width:'100%'}} onClick={()=>setSelected(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function EaViewsPage() {
  const api = useViewsApi()
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [activeView, setActiveView] = useState<any>(null)
  const [selectedViewpoint, setSelectedViewpoint] = useState<any>(null)
  const [, setShowBuilder] = useState(false)
  const [objectContextId, setObjectContextId] = useState<string | null>(null)
  const [initialArchState, setInitialArchState] = useState<string | undefined>(undefined)
  const [searchParams, setSearchParams] = useSearchParams()

  // "Open in View" entry point from repository asset pages (Object Context
  // View, spec section 51) - reacts to the objectContext query param via
  // useSearchParams (not a mount-only window.location.search read), so
  // clicking "Show Dependencies" for a different asset while already on
  // this page works correctly too, not just on the initial navigation in.
  useEffect(() => {
    const id = searchParams.get('objectContext')
    if (id) { setObjectContextId(id); setTab('object-context') }
  }, [searchParams])

  // "Related Architecture Views" entry point from ADM cycle pages (spec
  // section 70) - lands on My Views pre-filtered to the requested state.
  useEffect(() => {
    const state = searchParams.get('architectureState')
    if (state) { setInitialArchState(state); setTab('my-views') }
  }, [searchParams])

  const loadStats = useCallback(() => { api.get('/ea-views/stats').then(setStats) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadStats() }, [loadStats])

  const openView = (v: any) => { setActiveView(v); setTab('viewer') }

  const handleLibraryCreate = (viewpoint: any) => {
    setSelectedViewpoint(viewpoint)
    setShowBuilder(true)
    setTab('builder')
  }

  const handleViewCreated = (v: any) => {
    setShowBuilder(false)
    setSelectedViewpoint(null)
    loadStats()
    openView(v)
  }

  const TABS = [
    { id:'dashboard', label:'🏠 Dashboard' },
    { id:'library', label:'📚 View Library' },
    { id:'my-views', label:'📋 My Views' },
    { id:'packs', label:'📦 Architecture Packs' },
    { id:'snapshots', label:'📸 Snapshots' },
  ]

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:20, fontWeight:700 }}>🗺 EA Views & Viewpoints Studio</div>
          <div style={{ fontSize:12, color:'var(--text-dim)' }}>Dynamic architecture views powered by your EA repository</div>
        </div>
        <button style={S.btn('primary')} onClick={()=>{ setSelectedViewpoint(null); setShowBuilder(true); setTab('builder') }}>+ New View</button>
      </div>

      {tab !== 'viewer' && tab !== 'builder' && tab !== 'object-context' && (
        <div style={S.tabs}>
          {TABS.map(t=><button key={t.id} style={S.tab(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}
        </div>
      )}
      {tab !== 'viewer' && tab !== 'builder' && tab !== 'object-context' && (() => {
        const TAB_HELP: Record<string, string> = {
          dashboard: "A quick summary of the diagrams and views that have been created from your architecture data.",
          library: "Ready-made templates for common types of diagrams - pick one to quickly build a view without starting from scratch.",
          'my-views': "The diagrams and views you've already created. Open one to view, edit, or export it.",
          snapshots: "A saved copy of a view at a specific point in time, so you can look back at how something looked before it changed.",
        }
        return TAB_HELP[tab] ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 20px 0', display: 'flex', alignItems: 'center' }}>
            <HelpTip text={TAB_HELP[tab]} />
          </div>
        ) : null
      })()}

      <div style={S.content}>
        {tab === 'dashboard' && <ViewsDashboard api={api} stats={stats} onTab={setTab} onOpenView={openView} />}
        {tab === 'library' && <ViewLibrary api={api} onCreate={handleLibraryCreate} />}
        {tab === 'my-views' && <MyViews api={api} onOpen={openView} initialArchitectureState={initialArchState} />}
        {tab === 'packs' && <CollectionsPanel api={api} onOpenView={openView} />}
        {tab === 'snapshots' && <SnapshotsPanel api={api} />}
        {tab === 'builder' && <ViewBuilder api={api} viewpoint={selectedViewpoint} onCreated={handleViewCreated} onCancel={()=>setTab('my-views')} />}
        {tab === 'viewer' && activeView && <ViewViewer api={api} view={activeView} onBack={()=>setTab('my-views')} onRefresh={loadStats} />}
        {tab === 'object-context' && objectContextId && <ObjectContextViewer api={api} assetId={objectContextId} onBack={() => { setTab('dashboard'); setSearchParams({}) }} />}
      </div>
    </div>
  )
}
