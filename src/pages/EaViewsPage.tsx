import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import HelpTip from '../components/HelpTip'
import { RoadmapConfigPanel, RoadmapTimeline } from './eaviews/RoadmapView'
import { DashboardBuilder, DashboardGrid, DashboardWidget } from './eaviews/DashboardBuilder'

import { PathBuilder, RelationshipHop } from './eaviews/PathBuilder'
import { useSearchParams } from 'react-router-dom'
import { CollectionsPanel } from './eaviews/CollectionsPanel'
import { exportAsJSON, exportNodesAsCSV, exportMatrixAsCSV, exportRoadmapAsCSV, exportGraphAsSVG, exportGraphAsPNG, exportGraphAsPDF, exportNodesAsPDF, exportMatrixAsPDF, exportRoadmapAsPDF, exportGraphAsPPTX, exportNodesAsPPTX, exportMatrixAsPPTX, exportRoadmapAsPPTX } from './eaviews/exportUtils'
import { determineTableMode, buildRelationshipTable, buildMatrix } from './eaviews/tableMatrixUtils'
import { buildCapabilityMapDisplay, computeCapabilityOverlayCount, buildCapabilityDrilldown, buildHeatmapDisplay, buildTreeDisplay, buildCardContext } from './eaviews/capabilityHeatmapTreeCardsUtils'
import { buildGraphIndexes, chooseFocusObject, computeInitialVisibleSet, expandNeighbors, expandAllNextPathHops, collapseBranch, pruneDanglingRelationships, computePathHighlight, applyGraphFilters, ExpandDirection } from './eaviews/graphDisclosureUtils'
import { buildScenarioLineageTree, getScenarioLineagePath, chooseVisualizationAfterScenarioSwitch } from './eaviews/scenarioSelectorUtils'
import { buildChangeSummaryRows, buildRelationshipChangeRows, buildComparisonMatrix, applyComparisonFilters } from './eaviews/comparisonUtils'

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
  // Phase 5A Section 10: ?scenario=<id> URL state - read once on mount as
  // the initial scenario override (falls back safely to the view's own
  // saved scenario if the id is invalid/cross-tenant, since the backend
  // still validates it), updated on every successful switch so a
  // refresh/shared link reopens the same scenario. Kept lightweight
  // (this component's own useSearchParams call, same hook already used
  // elsewhere in this file) rather than threading scenario state through
  // routing config.
  const [searchParams, setSearchParams] = useSearchParams()

  const [data, setData] = useState<any>(null)
  // Phase 4A: canonical ViewDataset + its eligibility evaluation, fetched
  // in the SAME call as `data` (see load() below) - avoids a second,
  // duplicate fetch. Only Table and Matrix consume these; every other
  // renderer (Graph/CapabilityMap/Heatmap/Tree/Cards) continues reading
  // `data` exactly as before, completely unaware this exists.
  const [dataset, setDataset] = useState<any>(null)
  const [eligibility, setEligibility] = useState<any>(null)
  // Phase 5A: scenario selector state. The "saved/default" scenario
  // lives on `view.scenarioId` itself (already in scope, via
  // viewOverrides for optimistic updates after Set-as-Default) - not
  // duplicated here. `committedScenarioId`/`committedData*` are only
  // ever updated together, atomically, when a scenario-switch request
  // both succeeds AND is still the latest one issued (Section 4's
  // "transactional state transition" - the label the user sees and the
  // dataset actually displayed must never disagree). `pendingScenarioId`
  // is shown as a loading indicator on the requested-but-not-yet-
  // committed scenario; `scenarioSwitchError` surfaces a failed switch
  // without ever touching the still-valid committed state.
  const [scenarios, setScenarios] = useState<any[]>([])
  const [committedScenarioId, setCommittedScenarioId] = useState<string | null>(null)
  const [pendingScenarioId, setPendingScenarioId] = useState<string | null>(null)
  const [scenarioSwitchError, setScenarioSwitchError] = useState<string | null>(null)
  const [vizAutoSwitchNotice, setVizAutoSwitchNotice] = useState<string | null>(null)
  const [savingDefaultScenario, setSavingDefaultScenario] = useState(false)
  // Race-condition protection (Section F/3): a ref, not state, since the
  // "is my response still the latest?" check inside an async callback
  // needs a synchronous read of the CURRENT value at resolution time -
  // state updates are batched/async and cannot give that guarantee, a
  // ref can. Incremented once per switchScenario() call; a response only
  // commits if its own captured token still matches this ref's current
  // value when the fetch resolves.
  const scenarioRequestTokenRef = React.useRef(0)
  // Phase 4A: which matrix cell is currently drilled into (Section 10) -
  // null when no drill-down panel is open. Holds the cell's row/column
  // object plus its real backing items (relationships for DIRECT, paths
  // for PATH) - never re-queried, reused directly from the already-built
  // matrix.
  const [matrixDrilldown, setMatrixDrilldown] = useState<any>(null)
  // ── Comparison mode (Phase 5B) ────────────────────────────────────────
  //
  // Entirely separate from the single-scenario viewer state above -
  // comparisonMode toggles a distinct rendering path, never mutating
  // dataset/eligibility/committedScenarioId. Race protection uses the
  // exact same ref-token pattern as switchScenario (Section F/3 -
  // "highest-risk part") - a comparison request's response only commits
  // if its captured token still matches the latest issued one.
  const [comparisonMode, setComparisonMode] = useState(false)
  const [comparisonLeftId, setComparisonLeftId] = useState<string | null>(null)
  const [comparisonRightId, setComparisonRightId] = useState<string | null>(null)
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const [comparisonView, setComparisonView] = useState<'TABLE' | 'MATRIX'>('TABLE')
  // Section 21: default emphasizes changes - UNCHANGED excluded from the
  // initial filter set (unlike the empty-set-means-"show all" convention
  // used elsewhere in this component for object/relationship-type
  // filters), since a comparison view's whole purpose is surfacing what
  // changed. The user can still check UNCHANGED explicitly.
  const [comparisonChangeFilter, setComparisonChangeFilter] = useState<Set<string>>(new Set(['ADDED', 'REMOVED', 'MODIFIED']))
  const comparisonRequestTokenRef = React.useRef(0)
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
  const [collapsedTreeNodes, setCollapsedTreeNodes] = useState<Set<string>>(new Set())
  // Phase 4B: which related-object type Capability Map's overlay counts
  // (Section 2's "Applications supporting capability: N" example) - a
  // single selectable overlay at a time, matching "prefer one selected
  // metric/overlay at a time" rather than a full analytics designer.
  const [capabilityOverlayType, setCapabilityOverlayType] = useState('Application')
  const [capabilityDrilldown, setCapabilityDrilldown] = useState<any>(null)

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
  // Phase 4C: progressive disclosure state - visibleObjectIds/
  // visibleRelationshipIds/revealedBy from graphDisclosureUtils, built
  // purely client-side over the already-fetched dataset. null means "not
  // yet initialized for this dataset" (see the useEffect below), not
  // "empty" - an empty Set is a valid, real state.
  const [graphVisibleState, setGraphVisibleState] = useState<any>(null)
  const [graphFocusId, setGraphFocusId] = useState<string | null>(null)
  const [graphRelTypeFilter, setGraphRelTypeFilter] = useState<Set<string>>(new Set())
  const [graphObjectTypeFilter, setGraphObjectTypeFilter] = useState<Set<string>>(new Set())
  const [graphHighlightedPathId, setGraphHighlightedPathId] = useState<string | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set())
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
    setScenarioSwitchError(null)
    setVizAutoSwitchNotice(null)
    // Section 3/16: one list call for the selector, alongside the one
    // /dataset call for the initial scenario-resolved result - never a
    // per-scenario or per-renderer fetch. A fresh view load always
    // starts a new "latest wins" token generation too, so any switch
    // request left over from a previous view can never commit here.
    const myToken = ++scenarioRequestTokenRef.current
    api.get('/ea-views/scenarios').then((s: any) => { if (myToken === scenarioRequestTokenRef.current) setScenarios(Array.isArray(s) ? s : []) })
    // Phase 4A: single fetch to the new /dataset endpoint, not a second
    // call alongside /execute - `d.legacy` is byte-compatible with what
    // /execute always returned (verified by a dedicated backend test),
    // so every existing renderer below reading `data` is completely
    // unaffected. `d.dataset`/`d.eligibility` are new, additive state
    // only Table/Matrix read. Phase 5A: ?scenario=<id> from the URL, if
    // present, is sent as the initial scenarioId override - api.post
    // never rejects on an HTTP error status (the backend's own 404 for
    // an invalid/cross-tenant id resolves normally), so failure is
    // detected the same way switchScenario does (!d?.dataset), then
    // safely retried without the override rather than leaving the
    // viewer stuck on an error for what's still a perfectly valid View.
    const urlScenarioId = searchParams.get('scenario')
    const fetchDataset = (scenarioOverride?: string) => api.post(`/ea-views/${view.id}/dataset`, scenarioOverride ? { scenarioId: scenarioOverride } : {})
    const applyDatasetResult = (d: any) => {
      if (myToken !== scenarioRequestTokenRef.current) return // a newer load()/switchScenario() has already superseded this
      setData(d?.legacy ?? d)
      setDataset(d?.dataset ?? null)
      setEligibility(d?.eligibility ?? null)
      setCommittedScenarioId(d?.dataset?.context?.scenario?.id ?? null)
      // Phase 4B: initialize the selected heatmap metric from
      // VisualizationEligibility's own recommendation rather than a fixed
      // 'status' default - 'status' isn't guaranteed to be a metric this
      // dataset actually offers, and the eligibility engine already
      // picked the best candidate.
      const heatmapRecommendedMetric = d?.eligibility?.eligible?.find((v: any) => v.visualization === 'HEATMAP')?.recommendedConfig?.metricKey
      if (heatmapRecommendedMetric) setHeatmapField(heatmapRecommendedMetric)
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
    }
    fetchDataset(urlScenarioId || undefined).then((d: any) => {
      if (urlScenarioId && !d?.dataset) { fetchDataset().then(applyDatasetResult); return } // invalid/cross-tenant URL scenario - fall back safely to the view's own default rather than getting stuck
      applyDatasetResult(d)
    })
  }, [view.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  // ── Scenario switching (Phase 5A) ────────────────────────────────────
  //
  // Section 3/4's core requirements: latest-request-wins race safety, and
  // a strictly transactional commit - the scenario label and the
  // displayed dataset are only ever updated TOGETHER, in the same commit,
  // never independently. A failed or superseded request never touches
  // committedScenarioId/data/dataset/eligibility at all, so a still-valid
  // prior scenario stays fully displayed and correctly labeled.
  const switchScenario = (scenarioId: string) => {
    const myToken = ++scenarioRequestTokenRef.current
    setPendingScenarioId(scenarioId)
    setScenarioSwitchError(null)
    setVizAutoSwitchNotice(null)
    api.post(`/ea-views/${view.id}/dataset`, { scenarioId }).then((d: any) => {
      if (myToken !== scenarioRequestTokenRef.current) return // superseded by a newer switch - never commit a stale response, even a successful one
      if (!d?.dataset) { setScenarioSwitchError('Failed to switch scenario. Showing the previous scenario.'); setPendingScenarioId(null); return }
      // Single, atomic commit - every piece of "what's currently shown"
      // updates together, in one React batch, so there is never a render
      // where the label and the data disagree (Section 4).
      setData(d.legacy ?? d)
      setDataset(d.dataset)
      setEligibility(d.eligibility ?? null)
      setCommittedScenarioId(d.dataset?.context?.scenario?.id ?? scenarioId)
      setPendingScenarioId(null)
      // Phase 5A Section 10: URL reflects the committed scenario only -
      // never the requested-but-not-yet-resolved one, keeping the same
      // label/data-never-disagree guarantee extended to the URL too.
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('scenario', d.dataset?.context?.scenario?.id ?? scenarioId); return next })
      // Section 7: eligibility fallback with an unobtrusive, specific
      // explanation - never a silent renderer swap, never leaving the
      // user on an invalid one either.
      const { vizMode: nextVizMode, changed } = chooseVisualizationAfterScenarioSwitch(d.eligibility, vizMode)
      if (changed) {
        const scenarioName = scenarios.find(s => s.id === (d.dataset?.context?.scenario?.id ?? scenarioId))?.name || 'this scenario'
        setVizAutoSwitchNotice(nextVizMode
          ? `${VIZ_ICONS[vizMode] ? vizMode.replace(/_/g, ' ') : vizMode} is unavailable for ${scenarioName}. Switched to ${nextVizMode.replace(/_/g, ' ')}.`
          : `No visualization is available for ${scenarioName}.`)
        if (nextVizMode) setVizMode(nextVizMode)
      }
      // Section 6/H: reset stale, scenario-specific selections rather than
      // carrying old object IDs into a new scenario's data. Matrix drill-
      // down and heatmap metric are handled here since they reference
      // specific dataset content directly; Graph's own focus/highlight
      // reset already happens via its existing dataset-driven useEffect
      // (chooseFocusObject already prefers retaining the prior focus only
      // when it still exists in the new dataset - see that effect).
      const newObjectIds = new Set((d.dataset?.objects ?? []).map((o: any) => o.id))
      if (selected && !newObjectIds.has(selected.id)) setSelected(null)
      if (matrixDrilldown && (!newObjectIds.has(matrixDrilldown.rowObj?.id) || !newObjectIds.has(matrixDrilldown.colObj?.id))) setMatrixDrilldown(null)
      const newMetricKeys = new Set((d.dataset?.metrics ?? []).map((m: any) => m.key))
      if (!newMetricKeys.has(heatmapField)) {
        const recommended = d.eligibility?.eligible?.find((v: any) => v.visualization === 'HEATMAP')?.recommendedConfig?.metricKey
        if (recommended) setHeatmapField(recommended)
      }
    }).catch(() => {
      if (myToken !== scenarioRequestTokenRef.current) return
      setScenarioSwitchError('Failed to switch scenario. Showing the previous scenario.')
      setPendingScenarioId(null)
    })
  }

  // Section 9/D: an explicit user action only - never invoked by
  // switchScenario itself. Reuses the existing view-update endpoint/
  // permission (scenarioId is already an updatable field there, with its
  // own tenant-scoped validation) rather than a new one. Uses
  // viewOverrides (the established optimistic-update pattern in this
  // component) so the "saved" indicator updates immediately on success,
  // without a full view reload; a failure leaves viewOverrides untouched,
  // so the UI never falsely claims the default changed.
  const setAsDefaultScenario = async (scenarioId: string) => {
    setSavingDefaultScenario(true)
    try {
      const result = await api.put(`/ea-views/${view.id}`, { scenarioId })
      if (result?.id) setViewOverrides((prev: any) => ({ ...prev, scenarioId }))
    } finally {
      setSavingDefaultScenario(false)
    }
  }

  // ── Comparison request (Phase 5B) ────────────────────────────────────
  //
  // One /compare request per pair - never per-renderer (Section 25/5).
  // Race protection mirrors switchScenario exactly: a token captured at
  // request time only commits if it's still the latest issued when the
  // response arrives, so rapidly changing the left/right pair can never
  // let an earlier, slower request overwrite a later, faster one.
  const runComparison = (leftId: string, rightId: string) => {
    const myToken = ++comparisonRequestTokenRef.current
    setComparisonLoading(true)
    setComparisonError(null)
    api.post(`/ea-views/${view.id}/compare`, { leftScenarioId: leftId, rightScenarioId: rightId }).then((d: any) => {
      if (myToken !== comparisonRequestTokenRef.current) return // superseded by a newer comparison request
      if (!d?.objects) { setComparisonError('Failed to load comparison. Showing the previous result.'); return }
      setComparisonData(d)
      setComparisonLeftId(leftId)
      setComparisonRightId(rightId)
    }).catch(() => {
      if (myToken !== comparisonRequestTokenRef.current) return
      setComparisonError('Failed to load comparison. Showing the previous result.')
    }).finally(() => {
      if (myToken === comparisonRequestTokenRef.current) setComparisonLoading(false)
    })
  }

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

  // ── Graph progressive disclosure (Phase 4C) ──────────────────────────
  //
  // Indexes built once per dataset (Section 27's explicit indexing
  // guidance), reused across every expand/collapse/filter interaction -
  // no re-scanning dataset.relationships/paths on every click.
  const graphIndexes = useMemo(() => buildGraphIndexes(dataset), [dataset])

  // Initializes (or re-initializes, on a genuinely new dataset) the
  // focused, bounded initial view - never the full dataset by default
  // (Section 2). Re-runs when the dataset itself changes (a fresh view
  // load, or a scenario switch), not on every render. Phase 5A: prefers
  // retaining the PRIOR graph focus (via a ref, since graphFocusId isn't
  // a dependency here and a closure would otherwise capture a stale
  // value) over the generic `selected` object - Section 6's "if focused
  // Capability A exists in both scenarios, focus may remain" refers
  // specifically to the graph's own focus concept, not whatever object
  // happens to be selected for the detail panel at the moment.
  const priorGraphFocusIdRef = React.useRef<string | null>(null)
  useEffect(() => { priorGraphFocusIdRef.current = graphFocusId }, [graphFocusId])
  useEffect(() => {
    if (!dataset) { setGraphVisibleState(null); setGraphFocusId(null); return }
    const focusId = chooseFocusObject(dataset, priorGraphFocusIdRef.current ?? selected?.id)
    setGraphFocusId(focusId)
    setGraphVisibleState(focusId ? computeInitialVisibleSet(graphIndexes, focusId) : null)
    setGraphHighlightedPathId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset])

  // Phase 4B: heatmap-fields backend endpoint removed - ViewDataset.metrics
  // (already present in the single /dataset fetch) provides the same
  // candidate-metric information, data-driven from actual returned
  // values, with zero extra network calls (Section 12's explicit "no new
  // network calls" requirement).

  // Phase 4B: color-strategy computation is now handled by
  // buildHeatmapDisplay (ViewDataset.metrics already carries dataType/min/
  // max/distinctValues) - only the color mapping itself stays here.
  const HEATMAP_CATEGORICAL_PALETTE = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b']
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

  // Phase 4C: purely client-side over the already-fetched dataset - no
  // network call (replaces the old /object-context fetch entirely,
  // Section 27's explicit "no per-expansion API request" requirement).
  const expandNode = (nodeId: string, direction: ExpandDirection = 'both') => {
    if (!graphVisibleState) return
    const newState = expandNeighbors(graphIndexes, graphVisibleState, nodeId, direction)
    const newlyRevealedIds = [...newState.visibleObjectIds].filter(id => !graphVisibleState.visibleObjectIds.has(id))
    setGraphVisibleState(newState)
    setExpandedNodeIds(prev => new Set(prev).add(nodeId))
    // Place newly-revealed nodes near the expanded node so they don't
    // stack at the shared default origin before the next auto-layout run.
    const origin = positions[nodeId] || { x: 400, y: 300 }
    setPositions(prev => {
      const next = { ...prev }
      newlyRevealedIds.forEach((id, i) => {
        if (!next[id]) { const a = (i / Math.max(1, newlyRevealedIds.length)) * Math.PI * 2; next[id] = { x: origin.x + Math.cos(a) * 140, y: origin.y + Math.sin(a) * 140 } }
      })
      return next
    })
  }


  const expandNextHop = () => {
    if (!graphVisibleState) return
    setGraphVisibleState(expandAllNextPathHops(graphIndexes, graphVisibleState))
  }

  const collapseNode = (nodeId: string) => {
    if (!graphVisibleState || !graphFocusId) return
    setGraphVisibleState(collapseBranch(graphVisibleState, nodeId, graphFocusId))
    setExpandedNodeIds(prev => { const next = new Set(prev); next.delete(nodeId); return next })
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
  // ── Capability Map (Phase 4B) ────────────────────────────────────────
  //
  // Consumes buildCapabilityMapDisplay(dataset, eligibility) - real
  // hierarchy from ViewDataset.hierarchies, whatever depth is actually
  // present (Section 2's explicit "do not preserve the old artificial
  // two-level limit"). Deeper branches use the same collapse mechanism as
  // Tree (shared collapsedTreeNodes state) for progressive rendering
  // rather than becoming unusable.
  const renderCapabilityMap = () => {
    const display = buildCapabilityMapDisplay(dataset, eligibility)
    if (!display.eligible) {
      return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>▦</div>
        <div>{display.reason}</div>
      </div>
    }
    const objectById = new Map<string, any>((dataset?.objects ?? []).map((o: any) => [o.id, o]))
    const toggle = (id: string) => setCollapsedTreeNodes(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

    const renderCapNode = (id: string, depth: number): React.ReactNode => {
      const cap = objectById.get(id)
      if (!cap) return null
      const children = display.childrenByParentId?.[id] ?? []
      const hasChildren = children.length > 0
      const isCollapsed = collapsedTreeNodes.has(id)
      const overlayCount = computeCapabilityOverlayCount(dataset, id, capabilityOverlayType)
      return (
        <div key={id} style={{ marginLeft: depth * 18 }}>
          <div onClick={() => setCapabilityDrilldown(buildCapabilityDrilldown(dataset, id))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, background: depth === 0 ? '#3498db22' : 'var(--navy-light)', border: depth === 0 ? '2px solid #3498db44' : '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', marginBottom: 6, cursor: 'pointer' }}>
            {hasChildren ? (
              <span onClick={e => { e.stopPropagation(); toggle(id) }} style={{ width: 14, textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer' }}>{isCollapsed ? '▶' : '▼'}</span>
            ) : <span style={{ width: 14 }} />}
            <span style={{ fontSize: depth === 0 ? 13 : 12, fontWeight: depth === 0 ? 700 : 500, color: depth === 0 ? '#3498db' : 'var(--text)' }}>{cap.name}</span>
            {overlayCount !== null && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>{capabilityOverlayType}: {overlayCount}</span>}
          </div>
          {hasChildren && !isCollapsed && children.map(c => renderCapNode(c, depth + 1))}
        </div>
      )
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
          <label style={{ ...S.label, marginBottom: 0 }}>Overlay:</label>
          <select style={{ ...S.input, maxWidth: 200 }} value={capabilityOverlayType} onChange={e => setCapabilityOverlayType(e.target.value)}>
            {[...new Set((dataset?.objects ?? []).map((o: any) => o.semanticType || o.assetType))].filter((t: any) => t !== 'BusinessCapability').map((t: any) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 20, minWidth: 800 }}>
          {(display.rootIds ?? []).map(rootId => <div key={rootId} style={{ flex: 1, minWidth: 200 }}>{renderCapNode(rootId, 0)}</div>)}
        </div>
        {capabilityDrilldown && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setCapabilityDrilldown(null)}>
            <div style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, maxWidth: 480, maxHeight: '70vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              {capabilityDrilldown.parent && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>Parent: {capabilityDrilldown.parent.name}</div>}
              {capabilityDrilldown.children.length > 0 && <div style={{ fontSize: 12, marginBottom: 8 }}>Children: {capabilityDrilldown.children.map((c: any) => c.name).join(', ')}</div>}
              {capabilityDrilldown.related.length > 0 && <div style={{ fontSize: 12, marginBottom: 8 }}>Related: {capabilityDrilldown.related.map((r: any) => r.name).join(', ')}</div>}
              <button style={{ ...S.btn(), marginTop: 8 }} onClick={() => setCapabilityDrilldown(null)}>Close</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Heatmap (Phase 4B) ────────────────────────────────────────────────
  //
  // Consumes buildHeatmapDisplay(dataset, eligibility, heatmapField) -
  // structure + metric, never just colored objects (Section 3). Missing
  // values render as a distinct muted tile, never coerced to 0 or a
  // fabricated color.
  const HEATMAP_STATUS: Record<string,string> = { APPROVED:'#2ecc71', ACTIVE:'#2ecc71', UNDER_REVIEW:'#f39c12', DRAFT:'#e67e22', DEPRECATED:'#e74c3c', PLANNED:'#3498db' }
  const renderHeatmap = () => {
    const display = buildHeatmapDisplay(dataset, eligibility, heatmapField)
    if (!display.eligible) {
      return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>▤</div>
        <div>{display.reason}</div>
      </div>
    }
    const colorByValue: Record<string, string> = {}
    if (display.dataType === 'categorical' || display.dataType === 'status') {
      (display.distinctValues ?? []).forEach((v, i) => { colorByValue[v] = display.dataType === 'status' ? (HEATMAP_STATUS[v] || '#7f8c8d') : HEATMAP_CATEGORICAL_PALETTE[i % HEATMAP_CATEGORICAL_PALETTE.length] })
    }
    const getColor = (tile: { value: number | string | null }): string => {
      if (tile.value === null) return '#4b5563' // muted gray for genuinely missing values
      if (display.dataType === 'numeric') return numericGradientColor(tile.value as number, display.min!, display.max!)
      return colorByValue[String(tile.value)] || '#7f8c8d'
    }
    const objectById = new Map<string, any>((dataset?.objects ?? []).map((o: any) => [o.id, o]))
    return (
      <div>
        {dataset?.provenance?.truncated && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Results are truncated - this heatmap does not represent every matching object.</div>
        )}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <label style={{ ...S.label, marginBottom: 0 }}>Color by:</label>
          <select style={{ ...S.input, maxWidth: 220 }} value={heatmapField} onChange={e => setHeatmapField(e.target.value)}>
            {(display.candidateMetrics ?? [heatmapField]).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' as const, maxWidth: '60%' }}>
            {(display.dataType === 'categorical' || display.dataType === 'status') && Object.entries(colorByValue).map(([k,c]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{k}</div>)}
            {display.dataType === 'numeric' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                <span>{display.min}</span>
                <div style={{ width: 100, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, #2ecc71, #f39c12, #e74c3c)' }} />
                <span>{display.max}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {(display.tiles ?? []).map(tile => {
            const color = getColor(tile)
            const obj = objectById.get(tile.objectId)
            return (
              <div key={tile.objectId} onClick={() => setSelected(obj)} style={{ padding: '10px 12px', borderRadius: 8, background: color+'22', border: `1px solid ${color}44`, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = color+'44')}
                onMouseLeave={e => (e.currentTarget.style.background = color+'22')}>
                <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{obj?.assetType?.replace(/_/g,' ')}</div>
                <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{tile.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{tile.displayValue}</div>
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
  // ── Tree (Phase 4B) ───────────────────────────────────────────────────
  //
  // Consumes buildTreeDisplay(dataset, eligibility) - real hierarchy only
  // (Section 4). The render function itself also carries a defensive
  // visited-set guard during recursion (not just the utility's own cycle
  // detection) so malformed data can never cause infinite recursion here,
  // even if it somehow slipped past the utility layer.
  const renderTree = () => {
    const display = buildTreeDisplay(dataset, eligibility)
    if (!display.eligible) {
      return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40, maxWidth: 480, margin: '0 auto' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⌵</div>
        <div>{display.reason}</div>
      </div>
    }
    const objectById = new Map<string, any>((dataset?.objects ?? []).map((o: any) => [o.id, o]))
    const toggle = (id: string) => setCollapsedTreeNodes(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    const renderNode = (id: string, depth: number, ancestry: Set<string>): React.ReactNode => {
      if (ancestry.has(id)) return null // defensive cycle guard at render time too, independent of the utility's own detection
      const n = objectById.get(id)
      if (!n) return null
      const children = display.childrenByParentId?.[id] ?? []
      const hasChildren = children.length > 0
      const isCollapsed = collapsedTreeNodes.has(id)
      const color = TYPE_COLOR[n.assetType] || '#7f8c8d'
      return (
        <div key={id}>
          <div onClick={() => setSelected(n)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', marginLeft: depth * 22, borderRadius: 6, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            {hasChildren ? (
              <span onClick={e => { e.stopPropagation(); toggle(id) }} style={{ width: 16, textAlign: 'center', fontSize: 10, color: 'var(--text-dim)', cursor: 'pointer' }}>{isCollapsed ? '▶' : '▼'}</span>
            ) : <span style={{ width: 16 }} />}
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: depth === 0 ? 600 : 400 }}>{n.name}</span>
            <span style={{ ...S.badge(HEATMAP_STATUS[n.status] || '#7f8c8d'), fontSize: 10, marginLeft: 'auto' }}>{n.status}</span>
          </div>
          {hasChildren && !isCollapsed && children.map(c => renderNode(c, depth + 1, new Set([...ancestry, id])))}
        </div>
      )
    }
    return (
      <div>
        {display.malformed && <div style={{ fontSize: 12, color: '#f39c12', marginBottom: 10 }}>⚠ Some hierarchy data was malformed (a cycle or dangling reference) and was safely excluded.</div>}
        <div style={S.card}>{(display.rootIds ?? []).map(id => renderNode(id, 0, new Set()))}</div>
      </div>
    )
  }

  // ── Cards ─────────────────────────────────────────────────────────────────
  // ── Cards (Phase 4B) ──────────────────────────────────────────────────
  //
  // Consumes buildCardContext(dataset, objectId) for relationship
  // summaries - object + meaningful context, not an isolated inventory
  // tile (Section 5). Entirely derived from the already-fetched dataset;
  // no per-card fetch. A density warning (reusing the existing filter
  // bar, not new pagination infrastructure) appears above a threshold.
  const CARDS_WARN_THRESHOLD = 100
  const renderCards = () => (
    <div>
      {filteredNodes.length > CARDS_WARN_THRESHOLD && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>
          {filteredNodes.length} cards - use the filters above to narrow this down for easier browsing.
        </div>
      )}
      {dataset?.provenance?.truncated && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>Results are truncated - not every matching object is shown.</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {filteredNodes.map((n: any) => {
          const color = TYPE_COLOR[n.assetType] || '#7f8c8d'
          const context = dataset ? buildCardContext(dataset, n.id) : null
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
              {context && context.summaries.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  {context.summaries.map(s => (
                    <div key={s.relationshipType} style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>
                      <span style={{ fontStyle: 'italic' }}>{s.label}:</span> {s.relatedNames.join(', ')}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-dim)' }}>
                <span>{n.domain}</span>
                <span>{n.owner || '—'}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Comparison (Phase 5B) ─────────────────────────────────────────────
  //
  // A distinct rendering path, never touching the single-scenario viewer
  // state above. Table (Section 12, "one of the strongest comparison
  // renderers") and Matrix (Section 16) are implemented; Capability Map/
  // Heatmap/Tree/Cards comparison-specific treatments are deferred (see
  // completion report) - the underlying ComparisonDataset already
  // supports building them the same way, but doing so wasn't completed
  // in this pass given the phase's overall scope.
  const renderComparison = () => {
    const CHANGE_COLOR: Record<string, string> = { ADDED: '#2ecc71', REMOVED: '#e74c3c', MODIFIED: '#f39c12', UNCHANGED: '#7f8c8d' }
    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
          <label style={S.label}>Left</label>
          <select style={{ ...S.input, maxWidth: 200 }} value={comparisonLeftId ?? ''} onChange={e => setComparisonLeftId(e.target.value || null)}>
            <option value="">Select…</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <span style={{ color: 'var(--text-dim)' }}>vs</span>
          <label style={S.label}>Right</label>
          <select style={{ ...S.input, maxWidth: 200 }} value={comparisonRightId ?? ''} onChange={e => setComparisonRightId(e.target.value || null)}>
            <option value="">Select…</option>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button style={S.btn('primary')} disabled={!comparisonLeftId || !comparisonRightId} onClick={() => comparisonLeftId && comparisonRightId && runComparison(comparisonLeftId, comparisonRightId)}>
            Compare{comparisonLoading ? ' ⏳' : ''}
          </button>
          <button style={{ ...S.btn(), marginLeft: 'auto' }} onClick={() => { setComparisonMode(false); setComparisonData(null) }}>✕ Exit Comparison</button>
        </div>
        {comparisonError && <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 12 }}>⚠ {comparisonError}</div>}
        {!comparisonData ? (
          <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Choose two scenarios and click Compare to see what changed architecturally between them.</div>
        ) : (() => {
          const oc = comparisonData.objects, rc = comparisonData.relationships
          const filtered = applyComparisonFilters(comparisonData, { changeTypes: [...comparisonChangeFilter] as any })
          return (
            <div>
              {/* Section 11: summary header */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                <strong>{comparisonData.context?.leftScenario?.name}</strong><span style={{ color: 'var(--text-dim)' }}>→</span><strong>{comparisonData.context?.rightScenario?.name}</strong>
              </div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' as const, fontSize: 12 }}>
                <span>Objects: <span style={{ color: CHANGE_COLOR.ADDED }}>+{oc.added.length} Added</span> <span style={{ color: CHANGE_COLOR.REMOVED }}>−{oc.removed.length} Removed</span> <span style={{ color: CHANGE_COLOR.MODIFIED }}>~{oc.modified.length} Modified</span> <span style={{ color: 'var(--text-dim)' }}>{oc.unchanged.length} Unchanged</span></span>
                <span>Relationships: <span style={{ color: CHANGE_COLOR.ADDED }}>+{rc.added.length} Added</span> <span style={{ color: CHANGE_COLOR.REMOVED }}>−{rc.removed.length} Removed</span></span>
              </div>
              {(comparisonData.warnings ?? []).map((w: any) => <div key={w.code} style={{ fontSize: 12, color: '#f39c12', marginBottom: 8 }}>⚠ {w.message}</div>)}
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' as const }}>
                <button style={comparisonView === 'TABLE' ? S.btn('primary') : S.btn()} onClick={() => setComparisonView('TABLE')}>Table</button>
                <button style={comparisonView === 'MATRIX' ? S.btn('primary') : S.btn()} onClick={() => setComparisonView('MATRIX')}>Matrix</button>
                {(['ADDED', 'REMOVED', 'MODIFIED', 'UNCHANGED'] as const).map(ct => (
                  <label key={ct} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                    <input type="checkbox" checked={comparisonChangeFilter.has(ct)} onChange={() => setComparisonChangeFilter(prev => { const next = new Set(prev); next.has(ct) ? next.delete(ct) : next.add(ct); return next })} />
                    <span style={{ color: CHANGE_COLOR[ct] }}>{ct}</span>
                  </label>
                ))}
              </div>
              {comparisonView === 'TABLE' ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                    <thead><tr>{['Object', 'Type', 'Change', 'Changed Properties', 'Before', 'After'].map(h => <th key={h} style={{ padding: '8px 12px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {buildChangeSummaryRows({ objects: filtered }, comparisonChangeFilter.has('UNCHANGED')).map((row, i) => (
                        <tr key={row.id} style={{ background: i % 2 === 0 ? 'var(--navy-light)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{row.name}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)' }}>{row.type}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><span style={S.badge(CHANGE_COLOR[row.changeType])}>{row.changeType}</span></td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{row.changedProperties.join(', ')}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--text-dim)' }}>{row.before}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Relationship Changes</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead><tr>{['Source', 'Relationship', 'Target', 'Change'].map(h => <th key={h} style={{ padding: '8px 12px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {buildRelationshipChangeRows(comparisonData).map((row, i) => (
                        <tr key={row.key} style={{ background: i % 2 === 0 ? 'var(--navy-light)' : 'transparent' }}>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{row.source}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontStyle: 'italic', color: 'var(--text-dim)' }}>{row.relationship}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>{row.target}</td>
                          <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}><span style={S.badge(CHANGE_COLOR[row.changeType])}>{row.changeType}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (() => {
                const m = buildComparisonMatrix(comparisonData)
                if (!m.eligible) return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>{m.reason}</div>
                return (
                  <div>
                    {m.relationMode === 'PATH' && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>Path-based comparison ({m.rowType} × {m.columnType}) - counts real configured-path instances on each side, not direct relationships.</div>}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse' }}>
                        <thead><tr><th style={{ padding: '6px 10px', background: 'var(--navy-mid)', fontSize: 11 }}>{m.rowType} ↓ / {m.columnType} →</th>{(m.columns ?? []).map(c => <th key={c.id} style={{ padding: '6px 10px', background: 'var(--navy-mid)', fontSize: 11 }}>{c.name}</th>)}</tr></thead>
                        <tbody>
                          {(m.rows ?? []).map(r => (
                            <tr key={r.id}>
                              <td style={{ padding: '6px 10px', fontWeight: 600, fontSize: 12 }}>{r.name}</td>
                              {(m.columns ?? []).map(c => {
                                const cell = m.cells?.get(`${r.id}::${c.id}`)
                                if (!cell || (cell.beforeCount === 0 && cell.afterCount === 0)) return <td key={c.id} style={{ padding: '6px 10px', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
                                const deltaColor = cell.delta > 0 ? CHANGE_COLOR.ADDED : cell.delta < 0 ? CHANGE_COLOR.REMOVED : 'var(--text-dim)'
                                return <td key={c.id} style={{ padding: '6px 10px', borderLeft: '1px solid var(--border)', borderBottom: '1px solid var(--border)', textAlign: 'center', fontSize: 11 }}>{cell.beforeCount} → {cell.afterCount} <span style={{ color: deltaColor }}>({cell.delta >= 0 ? '+' : ''}{cell.delta})</span></td>
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })()}
      </div>
    )
  }

  // ── Graph ────────────────────────────────────────────────────────────────────
  // ── Graph visible subset (Phase 4C) ──────────────────────────────────
  //
  // graphVisibleState (progressive disclosure) -> relationship/object-type
  // filters -> pruneDanglingRelationships, all pure and over the already-
  // fetched dataset. graphEligible/graphIneligibleReason let the render
  // below show the deterministic reason instead of an empty canvas
  // (Section 19).
  const graphEval = eligibility?.eligible?.find((v: any) => v.visualization === 'GRAPH')
  const graphIneligibleReason = eligibility?.ineligible?.find((v: any) => v.visualization === 'GRAPH')?.reasons?.[0]
  const { graphVisibleObjects, graphVisibleEdges, graphHighlight } = (() => {
    if (!dataset || !graphVisibleState) return { graphVisibleObjects: [] as any[], graphVisibleEdges: [] as any[], graphHighlight: null as any }
    const filtered = applyGraphFilters(dataset, graphVisibleState.visibleObjectIds, graphVisibleState.visibleRelationshipIds, {
      relationshipTypes: graphRelTypeFilter.size > 0 ? [...graphRelTypeFilter] : undefined,
      objectTypes: graphObjectTypeFilter.size > 0 ? [...graphObjectTypeFilter] : undefined,
    })
    const prunedRelIds = pruneDanglingRelationships(dataset, filtered.objectIds, filtered.relationshipIds)
    const objs = (dataset.objects ?? []).filter((o: any) => filtered.objectIds.has(o.id))
    const edges = (dataset.relationships ?? []).filter((r: any) => prunedRelIds.has(r.id))
    const highlight = graphHighlightedPathId ? computePathHighlight(dataset, graphHighlightedPathId) : null
    return { graphVisibleObjects: objs, graphVisibleEdges: edges, graphHighlight: highlight }
  })()
  const graphAllRelTypes = [...new Set((dataset?.relationships ?? []).map((r: any) => r.relationshipType))] as string[]
  const graphAllObjectTypes = [...new Set((dataset?.objects ?? []).map((o: any) => o.semanticType || o.assetType))] as string[]

  const renderGraph = () => {
    if (eligibility && !graphEval) {
      return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 280px)', color: 'var(--text-dim)', textAlign: 'center' }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⬡</div>
          <div>{graphIneligibleReason || 'Graph is not available for this view - it has no meaningful relationships to show.'}</div>
        </div>
      </div>
    }
    const totalObjects = dataset?.objects?.length ?? 0
    return (
    <div ref={graphContainerRef} style={{ display: 'flex', height: isFullscreen ? '100vh' : 'calc(100vh - 280px)', gap: 0, background: isFullscreen ? 'var(--navy)' : 'transparent' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, maxWidth: 'calc(100% - 200px)' }}>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.min(2.5,z+0.15))}>+</button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 6px' }}>{Math.round(zoom*100)}%</span>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.max(0.25,z-0.15))}>−</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => { setZoom(1); setPan({x:0,y:0}) }}>⊡ Fit</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} disabled={layoutRunning} onClick={runAutoLayout}>{layoutRunning ? '⏳ Laying out...' : '🧭 Auto-Layout'}</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={toggleFullscreen}>{isFullscreen ? '⤢ Exit Fullscreen' : '⛶ Fullscreen'}</button>
          {/* Section 12/13: visible-vs-total, distinct from dataset truncation */}
          <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '3px 6px' }} title="Objects currently shown vs. total in this dataset - expand relationships to explore more.">
            Showing {graphVisibleObjects.length} of {totalObjects} objects
          </span>
          {dataset?.provenance?.truncated && (
            <span style={{ fontSize: 11, color: '#f39c12', padding: '3px 6px' }} title="The underlying architecture result itself was cut off by a query limit - not every matching object exists in this dataset at all.">
              ⚠ Dataset truncated
            </span>
          )}
          <div style={{ position: 'relative' }}>
            <input value={graphSearch} onChange={e => setGraphSearch(e.target.value)} placeholder="🔍 Find node..." style={{ ...S.input, width: 150, padding: '4px 8px', fontSize: 12 }} />
            {graphSearch.trim() && (
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 200, overflowY: 'auto' as const, width: 220, zIndex: 20 }}>
                {graphSearchMatches.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--text-dim)' }}>No matches</div>}
                {graphSearchMatches.slice(0, 8).map((n: any) => (
                  <div key={n.id} onClick={() => {
                    // Section 22: reveal the match if progressive disclosure
                    // currently hides it, then focus/center on it.
                    if (graphVisibleState && !graphVisibleState.visibleObjectIds.has(n.id)) setGraphVisibleState({ ...graphVisibleState, visibleObjectIds: new Set([...graphVisibleState.visibleObjectIds, n.id]) })
                    focusOnNode(n); setGraphSearch('')
                  }} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{n.name}</div>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Section 4/5/7/8/23: expand/filter/reset controls */}
        <div style={{ position: 'absolute', top: 46, left: 10, zIndex: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' as const, maxWidth: 'calc(100% - 20px)' }}>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 11 }} onClick={expandNextHop} title="Advance every visible object one hop further along the View's configured path">⇥ Expand next hop</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 11 }} onClick={() => { if (graphFocusId) { setGraphVisibleState(computeInitialVisibleSet(graphIndexes, graphFocusId)); setGraphHighlightedPathId(null); setGraphRelTypeFilter(new Set()); setGraphObjectTypeFilter(new Set()) } }}>↺ Reset to focus</button>
          {graphAllRelTypes.length > 1 && (
            <details style={{ position: 'relative' }}>
              <summary style={{ ...S.btn(), padding: '3px 10px', fontSize: 11, display: 'inline-block', cursor: 'pointer', listStyle: 'none' }}>Relationships ▾</summary>
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, zIndex: 20, minWidth: 160 }}>
                {graphAllRelTypes.map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={graphRelTypeFilter.size === 0 || graphRelTypeFilter.has(t)} onChange={() => setGraphRelTypeFilter(prev => { const next = new Set(prev.size === 0 ? graphAllRelTypes : prev); next.has(t) ? next.delete(t) : next.add(t); return next.size === graphAllRelTypes.length ? new Set() : next })} />
                    {t}
                  </label>
                ))}
              </div>
            </details>
          )}
          {graphAllObjectTypes.length > 1 && (
            <details style={{ position: 'relative' }}>
              <summary style={{ ...S.btn(), padding: '3px 10px', fontSize: 11, display: 'inline-block', cursor: 'pointer', listStyle: 'none' }}>Object types ▾</summary>
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, padding: 8, zIndex: 20, minWidth: 160 }}>
                {graphAllObjectTypes.map(t => (
                  <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '3px 0', cursor: 'pointer' }}>
                    <input type="checkbox" checked={graphObjectTypeFilter.size === 0 || graphObjectTypeFilter.has(t)} onChange={() => setGraphObjectTypeFilter(prev => { const next = new Set(prev.size === 0 ? graphAllObjectTypes : prev); next.has(t) ? next.delete(t) : next.add(t); return next.size === graphAllObjectTypes.length ? new Set() : next })} />
                    {t}
                  </label>
                ))}
              </div>
            </details>
          )}
          {(dataset?.paths?.length ?? 0) > 0 && (
            <select style={{ ...S.input, padding: '3px 8px', fontSize: 11, maxWidth: 180 }} value={graphHighlightedPathId ?? ''} onChange={e => setGraphHighlightedPathId(e.target.value || null)}>
              <option value="">Highlight path…</option>
              {(dataset.paths ?? []).map((p: any) => {
                const names = p.objectIds.map((oid: string) => (dataset.objects ?? []).find((o: any) => o.id === oid)?.name || oid)
                return <option key={p.id} value={p.id}>{names.join(' → ')}</option>
              })}
            </select>
          )}
        </div>
        {loading ? <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-dim)' }}>Loading view data...</div> : (
          <svg ref={graphSvgRef} style={{ width:'100%', height:'100%', cursor: panStart?'grabbing':dragging?'grabbing':'grab' }}
            onMouseDown={onSvgMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
            <defs><marker id="arrow2" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgba(3,105,161,0.4)" /></marker></defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {graphVisibleEdges.map((e: any) => {
                const isHighlighted = graphHighlight?.relationshipIds.has(e.id)
                const dimmed = graphHighlight && !isHighlighted
                return (
                  <g key={e.id}>
                    <path d={getEdgePath(e)} stroke={isHighlighted ? 'var(--accent)' : 'rgba(3,105,161,0.25)'} strokeWidth={isHighlighted ? 2.5 : 1.5} fill="none" markerEnd="url(#arrow2)" opacity={dimmed ? 0.15 : 1} />
                    {isHighlighted && (() => { const s=positions[e.sourceId]||{x:0,y:0}; const t=positions[e.targetId]||{x:0,y:0}; return <text x={(s.x+t.x)/2+40} y={(s.y+t.y)/2+20} fontSize={9} fill="var(--accent)" textAnchor="middle">{e.label || e.relationshipType}</text> })()}
                  </g>
                )
              })}
              {graphVisibleObjects.map((n: any) => {
                const pos=positions[n.id]||{x:100,y:100}
                const isSel=selected?.id===n.id
                const isFocus = n.id === graphFocusId
                const isMatch = graphSearch.trim() && n.name.toLowerCase().includes(graphSearch.trim().toLowerCase())
                const isExpanded = expandedNodeIds.has(n.id)
                const isHighlighted = graphHighlight?.objectIds.has(n.id)
                const dimmed = graphHighlight && !isHighlighted
                const dc=DOMAIN_COLOR[n.domain]||'#3498db'
                return (
                  <g key={n.id} data-node="true" transform={`translate(${pos.x},${pos.y})`} onMouseDown={e=>onNodeMouseDown(e,n.id)}
                    onDoubleClick={() => isExpanded ? collapseNode(n.id) : expandNode(n.id)} style={{cursor: 'grab', opacity: dimmed ? 0.2 : 1}}>
                    <rect width={160} height={44} rx={8} fill="var(--navy-light)" stroke={isSel||isHighlighted?'var(--accent)':isFocus?'#f39c12':isMatch?'#f39c12':dc+'55'} strokeWidth={isSel||isMatch||isFocus||isHighlighted?2:1.5} />
                    <rect width={5} height={44} rx={2} fill={dc} />
                    <text x={16} y={18} fontSize={11} fontWeight={600} fill="var(--text)">{n.name.length>17?n.name.slice(0,16)+'…':n.name}</text>
                    <text x={16} y={32} fontSize={9} fill="rgba(100,116,139,0.7)">{(n.semanticType || n.assetType)?.replace(/_/g,' ')} · {n.domain}</text>
                    <circle cx={148} cy={10} r={5} fill={HEATMAP_STATUS[n.status]||'#7f8c8d'} />
                    {isExpanded ? <text x={148} y={38} fontSize={9} fill="rgba(100,116,139,0.6)">⊖<title>Double-click to collapse</title></text> : <text x={148} y={38} fontSize={9} fill="rgba(100,116,139,0.6)">⊕<title>Double-click to expand</title></text>}
                  </g>
                )
              })}
            </g>
          </svg>
        )}
        {/* Mini-map */}
        {!loading && graphVisibleObjects.length > 0 && (
          <svg width={140} height={100} style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(15,23,42,0.85)', border: '1px solid var(--border)', borderRadius: 8 }}
            viewBox={`${graphBounds.minX} ${graphBounds.minY} ${graphBounds.maxX - graphBounds.minX} ${graphBounds.maxY - graphBounds.minY}`}>
            {graphVisibleObjects.map((n: any) => { const p = positions[n.id]; if (!p) return null; return <rect key={n.id} x={p.x} y={p.y} width={160} height={44} fill={DOMAIN_COLOR[n.domain] || '#3498db'} opacity={0.7} /> })}
          </svg>
        )}
      </div>
      {selected && (() => {
        // Section 16: reuses ViewDataset directly for incoming/outgoing
        // relationships and path memberships - no per-node API request.
        const cardCtx = dataset ? buildCardContext(dataset, selected.id) : null
        const memberPaths = graphIndexes.pathsByObject.get(selected.id) ?? []
        return (
        <div style={{ width: 260, background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, marginLeft:12, padding:16, overflowY:'auto' as const, flexShrink:0 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>{selected.name}</div>
          {[{l:'Type',v:(selected.semanticType || selected.assetType)?.replace(/_/g,' ')},{l:'Domain',v:selected.domain},{l:'Status',v:selected.status},{l:'Owner',v:selected.owner||'—'}].map(f=>(
            <div key={f.l} style={{ marginBottom:10 }}><div style={S.label}>{f.l}</div><div style={{fontSize:13}}>{f.v}</div></div>
          ))}
          {selected.description && <><div style={S.label}>Description</div><div style={{fontSize:12,color:'var(--text-dim)',lineHeight:1.6}}>{selected.description}</div></>}
          {cardCtx && cardCtx.summaries.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={S.label}>Relationships ({cardCtx.relationshipCount})</div>
              {cardCtx.summaries.map(s => <div key={s.relationshipType} style={{ fontSize: 12, marginBottom: 4 }}><span style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>{s.label}:</span> {s.relatedNames.join(', ')}</div>)}
            </div>
          )}
          {memberPaths.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={S.label}>Path membership</div>
              {memberPaths.map((p: any) => <div key={p.id} onClick={() => setGraphHighlightedPathId(p.id)} style={{ fontSize: 11, color: 'var(--accent)', cursor: 'pointer', marginBottom: 2 }}>{p.objectIds.map((oid: string) => (dataset.objects ?? []).find((o: any) => o.id === oid)?.name || oid).join(' → ')}</div>)}
            </div>
          )}
          {selected.tags?.length > 0 && <><div style={{...S.label,marginTop:8}}>Tags</div><div style={{display:'flex',gap:4,flexWrap:'wrap' as const}}>{selected.tags.map((t:string)=><span key={t} style={{...S.badge('#7f8c8d'),fontSize:10}}>{t}</span>)}</div></>}
          <button style={{...S.btn(),marginTop:16,fontSize:12,width:'100%'}} onClick={()=>setSelected(null)}>Close</button>
        </div>
        )
      })()}
    </div>
    )
  }

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
            {view.approvalStatus && view.approvalStatus !== 'NOT_REQUIRED' && (
              <span style={S.badge(view.approvalStatus === 'APPROVED' ? '#2ecc71' : view.approvalStatus === 'REJECTED' ? '#e74c3c' : '#f39c12')}>
                {view.approvalStatus === 'PENDING' ? '⏳ Pending Approval' : view.approvalStatus === 'APPROVED' ? '✓ Approved' : '✕ Rejected'}
              </span>
            )}
          </div>
          {/* ── Scenario Selector (Phase 5A) ─────────────────────────────
              Section 3: name/type/status/horizon + lineage context.
              Section 4: pendingScenarioId shows a loading state on the
              badge itself rather than blanking the page - the previously
              committed scenario/dataset stay fully visible underneath
              until the new one actually commits. */}
          <div style={{ marginTop: 6 }}>
            <details style={{ position: 'relative', display: 'inline-block' }}>
              <summary style={{ listStyle: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={S.badge(STATE_COLOR[scenarios.find(s => s.id === committedScenarioId)?.type] || '#7f8c8d')}>
                  {pendingScenarioId ? `Switching to ${scenarios.find(s => s.id === pendingScenarioId)?.name || '…'}…` : (scenarios.find(s => s.id === committedScenarioId)?.name || 'Current Architecture')}
                </span>
                {scenarios.find(s => s.id === committedScenarioId)?.status === 'DRAFT' && <span style={{ ...S.badge('#f39c12'), fontSize: 10 }}>DRAFT</span>}
                {view.scenarioId === committedScenarioId && committedScenarioId && <span title="This is the View's saved default scenario" style={{ fontSize: 11, color: 'var(--text-dim)' }}>★ default</span>}
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>▾</span>
              </summary>
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, zIndex: 30, minWidth: 280, maxHeight: 360, overflowY: 'auto' as const }}>
                {(() => {
                  const tree = buildScenarioLineageTree(scenarios)
                  const renderScenarioOption = (id: string, depth: number): React.ReactNode => {
                    const s = scenarios.find(x => x.id === id)
                    if (!s) return null
                    const children = tree.childrenByParentId[id] ?? []
                    const isActive = id === committedScenarioId
                    return (
                      <div key={id}>
                        <div onClick={() => !isActive && switchScenario(id)}
                          style={{ marginLeft: depth * 14, display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: isActive ? 'default' : 'pointer', background: isActive ? 'rgba(3,105,161,0.12)' : 'transparent' }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(3,105,161,0.06)' }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}>
                          <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400 }}>{s.name}</span>
                          <span style={{ ...S.badge(STATE_COLOR[s.type] || '#7f8c8d'), fontSize: 9 }}>{s.type}</span>
                          {s.status === 'DRAFT' && <span style={{ ...S.badge('#f39c12'), fontSize: 9 }}>DRAFT</span>}
                          {s.horizonDate && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{new Date(s.horizonDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}</span>}
                          {view.scenarioId === s.id && <span style={{ fontSize: 10, color: 'var(--text-dim)' }} title="View's saved default">★</span>}
                        </div>
                        {children.map(c => renderScenarioOption(c, depth + 1))}
                      </div>
                    )
                  }
                  return tree.rootIds.map(id => renderScenarioOption(id, 0))
                })()}
                {scenarios.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 8 }}>No architecture scenarios available.</div>}
                {committedScenarioId && view.scenarioId !== committedScenarioId && (
                  <button disabled={savingDefaultScenario} onClick={() => setAsDefaultScenario(committedScenarioId)} style={{ ...S.btn(), marginTop: 8, width: '100%', fontSize: 11 }}>
                    {savingDefaultScenario ? 'Saving…' : '★ Set as default for this View'}
                  </button>
                )}
              </div>
            </details>
            {/* Section 11: lightweight lineage context, e.g. "Current -> Transition 2027 -> Target A" */}
            {committedScenarioId && scenarios.length > 0 && (() => {
              const path = getScenarioLineagePath(scenarios, committedScenarioId)
              return path.length > 1 ? <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{path.map((s: any) => s.name).join(' → ')}</div> : null
            })()}
            {scenarioSwitchError && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>⚠ {scenarioSwitchError}</div>}
            {vizAutoSwitchNotice && <div style={{ fontSize: 11, color: '#f39c12', marginTop: 4 }} onClick={() => setVizAutoSwitchNotice(null)}>ℹ {vizAutoSwitchNotice} <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>Dismiss</span></div>}
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          {!isRoadmap && !isDashboard && (
            <button style={comparisonMode ? S.btn('primary') : S.btn()} onClick={() => setComparisonMode(m => !m)} title="Compare two architecture scenarios">⇄ Compare</button>
          )}
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
      {!comparisonMode && (<>
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
      </>)}

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
        : comparisonMode ? renderComparison()
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
  // Phase 5A: the old Architecture State selector (STATES: CURRENT/
  // TARGET/TRANSITION/BASELINE/PLANNED) is retired from view creation -
  // architectureState is still sent in the create payload for backend
  // compatibility (defaulted to 'CURRENT', never shown to the user), but
  // architecture scenario selection is now a viewing-time concern via
  // the ScenarioSelector, not a per-View fixed choice at creation.
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
