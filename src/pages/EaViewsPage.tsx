import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import HelpTip from '../components/HelpTip'

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
  tab: (a: boolean) => ({ padding: '10px 18px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', background: 'none', border: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? '#0B1929' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const VIZ_ICONS: Record<string,string> = { GRAPH:'🕸', MATRIX:'⊞', HEATMAP:'🔥', CAPABILITY_MAP:'⬛', TABLE:'≡', ROADMAP:'🗺', LANDSCAPE:'🗾', DASHBOARD:'📊' }
const CATEGORY_COLOR: Record<string,string> = { Business:'#3498db', Application:'#e67e22', Data:'#1abc9c', Technology:'#e74c3c', Security:'#9b59b6', 'Cross-Domain':'#f39c12', Strategic:'#2ecc71', Governance:'#7f8c8d', Custom:'#8baac8' }
const STATE_COLOR: Record<string,string> = { CURRENT:'#2ecc71', TARGET:'#3498db', TRANSITION:'#f39c12', BASELINE:'#7f8c8d', PLANNED:'#9b59b6' }
const STATUS_COLOR: Record<string,string> = { DRAFT:'#f39c12', PUBLISHED:'#2ecc71', ARCHIVED:'#7f8c8d' }
const DOMAIN_COLOR: Record<string,string> = { BUSINESS:'#3498db', APPLICATION:'#e67e22', DATA:'#1abc9c', TECHNOLOGY:'#e74c3c', SECURITY:'#9b59b6', STRATEGIC:'#2ecc71', BENEFICIARY_EXPERIENCE:'#16a085', CROSS_CUTTING:'#7f8c8d' }
const TYPE_COLOR: Record<string,string> = { CAPABILITY:'#3498db', APPLICATION:'#e67e22', DATA_ENTITY:'#1abc9c', TECH_COMPONENT:'#e74c3c', SECURITY_CONTROL:'#9b59b6', EA_PRINCIPLE:'#2ecc71', INTEGRATION:'#f39c12' }

// ── View Library (predefined viewpoints) ──────────────────────────────────────
function ViewLibrary({ api, onCreate }: { api: any, onCreate: (v: any) => void }) {
  const [viewpoints, setViewpoints] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => {
    Promise.all([api.get('/ea-views/viewpoints'), api.post('/ea-views/viewpoints/seed')]).then(([vps]: any[]) => {
      setViewpoints(Array.isArray(vps) ? vps : [])
      setLoading(false)
    })
  }, [])

  const categories = Array.from(new Set(viewpoints.map(v => v.category)))
  const filtered = viewpoints.filter(v => !filterCat || v.category === filterCat)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>View Library</div><div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Browse predefined EA views — select one to activate or customize</div></div>
        <button style={S.btn('primary')} onClick={() => onCreate(null)}>+ Custom View</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <button style={{ ...S.btn(), background: !filterCat ? 'var(--accent)' : undefined, color: !filterCat ? '#0B1929' : undefined }} onClick={() => setFilterCat('')}>All</button>
        {categories.map(c => <button key={c} style={{ ...S.btn(), background: filterCat === c ? CATEGORY_COLOR[c] : undefined, color: filterCat === c ? '#fff' : undefined }} onClick={() => setFilterCat(c)}>{c}</button>)}
      </div>

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {filtered.map(vp => (
            <div key={vp.id} style={{ ...S.card, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = CATEGORY_COLOR[vp.category] || 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: (CATEGORY_COLOR[vp.category] || '#3498db') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {VIZ_ICONS[vp.defaultVisualization] || '📊'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{vp.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span style={S.badge(CATEGORY_COLOR[vp.category] || '#3498db')}>{vp.category}</span>
                    <span style={S.badge('#7f8c8d')}>{(vp.defaultVisualization||'').replace(/_/g,' ')}</span>
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 12 }}>{vp.description}</div>
              {vp.purpose && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 12 }}>Purpose: {vp.purpose}</div>}
              <button style={{ ...S.btn('primary'), width: '100%', fontSize: 12 }} onClick={() => onCreate(vp)}>▶ Activate View</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── My Views list ─────────────────────────────────────────────────────────────
function MyViews({ api, onOpen }: { api: any, onOpen: (v: any) => void }) {
  const [views, setViews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [favOnly, setFavOnly] = useState(false)

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

  const filtered = views.filter(v =>
    (!filterCat || v.category === filterCat) &&
    (!filterStatus || v.status === filterStatus) &&
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
function ViewViewer({ api, view, onBack, onRefresh }: { api: any, view: any, onBack: () => void, onRefresh: () => void }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [vizMode, setVizMode] = useState<string>(view.visualization || 'GRAPH')
  const [filterDomain, setFilterDomain] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<any>(null)
  const [showSharePanel, setShowSharePanel] = useState(false)
  const [shareData, setShareData] = useState<any>(null)
  const [heatmapField, setHeatmapField] = useState('status')

  // Graph canvas state
  const [positions, setPositions] = useState<Record<string,{x:number,y:number}>>({})
  const [dragging, setDragging] = useState<{id:string,ox:number,oy:number}|null>(null)
  const [pan, setPan] = useState({x:0,y:0})
  const [panStart, setPanStart] = useState<{mx:number,my:number,px:number,py:number}|null>(null)
  const [zoom, setZoom] = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    api.post(`/ea-views/${view.id}/execute`, {}).then((d: any) => {
      setData(d)
      if (d?.nodes) {
        // Auto-layout by domain in columns
        const domGroups: Record<string,any[]> = {}
        for (const n of d.nodes) { const dk = n.domain||'Other'; if(!domGroups[dk])domGroups[dk]=[]; domGroups[dk].push(n) }
        const pos: Record<string,{x:number,y:number}> = {}
        let colX = 60
        for (const [,ns] of Object.entries(domGroups)) {
          ns.forEach((n,i) => { pos[n.id] = {x:colX, y:60+i*80} })
          colX += 220
        }
        setPositions(pos)
      }
      setLoading(false)
    })
  }, [view.id])

  useEffect(() => { load() }, [load])

  const publish = async () => {
    await api.post(`/ea-views/${view.id}/publish`)
    onRefresh()
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

  // ── Capability Map ──────────────────────────────────────────────────────────
  const renderCapabilityMap = () => {
    const caps = filteredNodes.filter((n: any) => n.assetType === 'CAPABILITY')
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
  const renderHeatmap = () => (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        <label style={{ ...S.label, marginBottom: 0 }}>Color by:</label>
        <select style={{ ...S.input, maxWidth: 160 }} value={heatmapField} onChange={e => setHeatmapField(e.target.value)}>
          <option value="status">Status</option>
          <option value="domain">Domain</option>
          <option value="assetType">Asset Type</option>
        </select>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {Object.entries(HEATMAP_STATUS).map(([k,c]) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-dim)' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{k}</div>)}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {filteredNodes.map((n: any) => {
          const color = heatmapField === 'status' ? (HEATMAP_STATUS[n.status]||'#7f8c8d') : heatmapField === 'domain' ? (DOMAIN_COLOR[n.domain]||'#7f8c8d') : (TYPE_COLOR[n.assetType]||'#7f8c8d')
          return (
            <div key={n.id} onClick={() => setSelected(n)} style={{ padding: '10px 12px', borderRadius: 8, background: color+'22', border: `1px solid ${color}44`, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = color+'44')}
              onMouseLeave={e => (e.currentTarget.style.background = color+'22')}>
              <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 4 }}>{n.assetType.replace(/_/g,' ')}</div>
              <div style={{ fontSize: 12, fontWeight: 500, lineHeight: 1.3 }}>{n.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{n.status}</div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── Matrix ───────────────────────────────────────────────────────────────────
  const renderMatrix = () => {
    const sources = filteredNodes.filter((n: any) => view.rootObjectTypes?.includes(n.assetType))
    const targets = filteredNodes.filter((n: any) => view.relatedObjectTypes?.includes(n.assetType))
    const displayTargets = targets.length > 0 ? targets : filteredNodes.filter((n: any) => !view.rootObjectTypes?.includes(n.assetType))

    if (sources.length === 0) return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>No matrix data. Ensure both source and target object types are configured in the view.</div>

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '8px 12px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, position: 'sticky', left: 0, minWidth: 140 }}>Source ↓ / Related →</th>
              {displayTargets.slice(0,20).map((t: any) => (
                <th key={t.id} style={{ padding: '6px 10px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: TYPE_COLOR[t.assetType]||'var(--text)', whiteSpace: 'nowrap', minWidth: 100, maxWidth: 140 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.slice(0,30).map((src: any, ri: number) => (
              <tr key={src.id} style={{ background: ri % 2 === 0 ? 'var(--navy-light)' : 'transparent' }}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, position: 'sticky', left: 0, background: ri % 2 === 0 ? 'var(--navy-light)' : 'var(--navy)', maxWidth: 140 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: TYPE_COLOR[src.assetType]||'var(--text)' }}>{src.name}</div>
                </td>
                {displayTargets.slice(0,20).map((tgt: any) => {
                  const hasRel = data?.edges?.some((e: any) => (e.sourceId===src.id&&e.targetId===tgt.id)||(e.sourceId===tgt.id&&e.targetId===src.id))
                  const sameDomain = src.domain === tgt.domain
                  return (
                    <td key={tgt.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', textAlign: 'center', background: hasRel ? 'rgba(0,180,216,0.12)' : sameDomain ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      {hasRel && <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--accent)', margin: '0 auto' }} />}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── Table ────────────────────────────────────────────────────────────────────
  const renderTable = () => (
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
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,180,216,0.05)')}
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

  // ── Graph ────────────────────────────────────────────────────────────────────
  const renderGraph = () => (
    <div style={{ display: 'flex', height: 'calc(100vh - 280px)', gap: 0 }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, display: 'flex', gap: 6 }}>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.min(2.5,z+0.15))}>+</button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 6px' }}>{Math.round(zoom*100)}%</span>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z=>Math.max(0.25,z-0.15))}>−</button>
          <button style={{ ...S.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => { setZoom(1); setPan({x:0,y:0}) }}>⊡</button>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', padding: '3px 6px' }}>{filteredNodes.length} objects</span>
        </div>
        {loading ? <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'var(--text-dim)' }}>Loading view data...</div> : (
          <svg style={{ width:'100%', height:'100%', cursor: panStart?'grabbing':dragging?'grabbing':'grab' }}
            onMouseDown={onSvgMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
            <defs><marker id="arrow2" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="rgba(0,180,216,0.4)" /></marker></defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {(data?.edges||[]).filter((e: any) => filteredNodes.find((n: any)=>n.id===e.sourceId) && filteredNodes.find((n: any)=>n.id===e.targetId)).map((e: any) => (
                <g key={e.id}>
                  <path d={getEdgePath(e)} stroke="rgba(0,180,216,0.25)" strokeWidth={1.5} fill="none" markerEnd="url(#arrow2)" />
                </g>
              ))}
              {filteredNodes.map((n: any) => {
                const pos=positions[n.id]||{x:100,y:100}
                const isSel=selected?.id===n.id
                const dc=DOMAIN_COLOR[n.domain]||'#3498db'
                return (
                  <g key={n.id} data-node="true" transform={`translate(${pos.x},${pos.y})`} onMouseDown={e=>onNodeMouseDown(e,n.id)} style={{cursor:'grab'}}>
                    <rect width={160} height={44} rx={8} fill="var(--navy-light)" stroke={isSel?'var(--accent)':dc+'55'} strokeWidth={isSel?2:1.5} />
                    <rect width={5} height={44} rx={2} fill={dc} />
                    <text x={16} y={18} fontSize={11} fontWeight={600} fill="var(--text)">{n.name.length>17?n.name.slice(0,16)+'…':n.name}</text>
                    <text x={16} y={32} fontSize={9} fill="rgba(139,170,200,0.7)">{n.assetType.replace(/_/g,' ')} · {n.domain}</text>
                    <circle cx={148} cy={10} r={5} fill={HEATMAP_STATUS[n.status]||'#7f8c8d'} />
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
          </div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={load}>↻ Refresh</button>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={takeSnapshot}>📸 Snapshot</button>
          <button style={{ ...S.btn(), fontSize:12 }} onClick={shareView}>🔗 Share</button>
          {view.status === 'DRAFT' && <button style={{ ...S.btn('primary'), fontSize:12 }} onClick={publish}>🚀 Publish</button>}
        </div>
      </div>

      {/* Viz mode selector */}
      <div style={{ display:'flex', gap:2, background:'var(--navy-light)', borderRadius:8, padding:3, marginBottom:16, width:'fit-content' }}>
        {['GRAPH','CAPABILITY_MAP','HEATMAP','MATRIX','TABLE'].map(m => (
          <button key={m} style={{ ...S.btn(), padding:'5px 12px', fontSize:12, background:vizMode===m?'var(--accent)':'none', color:vizMode===m?'#0B1929':'var(--text-dim)' }} onClick={()=>setVizMode(m)}>
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
        <div style={{ marginLeft:'auto', fontSize:13, color:'var(--text-dim)', display:'flex', alignItems:'center' }}>{filteredNodes.length} / {data?.nodes?.length||0} objects</div>
      </div>

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
        : renderTable()}
    </div>
  )
}

// ── View Builder ──────────────────────────────────────────────────────────────
function ViewBuilder({ api, viewpoint, onCreated, onCancel }: { api: any, viewpoint: any, onCreated: (v: any) => void, onCancel: () => void }) {
  const ASSET_TYPES = ['CAPABILITY','APPLICATION','DATA_ENTITY','TECH_COMPONENT','SECURITY_CONTROL','EA_PRINCIPLE','INTEGRATION','PROCESS','ORG_UNIT','RISK']
  const DOMAINS = ['BUSINESS','APPLICATION','DATA','TECHNOLOGY','SECURITY','STRATEGIC','BENEFICIARY_EXPERIENCE','CROSS_CUTTING']
  const VIZS = ['GRAPH','CAPABILITY_MAP','HEATMAP','MATRIX','TABLE','LANDSCAPE']
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
                <div key={v} onClick={()=>setForm(f=>({...f,visualization:v}))} style={{ padding:'10px 12px', borderRadius:8, border:`2px solid ${form.visualization===v?'var(--accent)':'var(--border)'}`, cursor:'pointer', textAlign:'center', background:form.visualization===v?'rgba(0,180,216,0.08)':'transparent' }}>
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
            <div><label style={S.label}>Related Object Types</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' as const }}>
                {ASSET_TYPES.filter(t=>!form.rootObjectTypes.includes(t)).map(t=><span key={t} onClick={()=>setForm(f=>({...f,relatedObjectTypes:toggleArr(f.relatedObjectTypes,t)}))} style={{ ...S.badge(form.relatedObjectTypes.includes(t)?'#f39c12':'#7f8c8d'), cursor:'pointer', opacity:form.relatedObjectTypes.includes(t)?1:0.5 }}>{t.replace(/_/g,' ')}</span>)}
              </div>
            </div>
          </div>

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

  useEffect(() => { api.get('/ea-views').then((d: any) => setViews(Array.isArray(d)?d:[])) }, [])
  useEffect(() => {
    if (!selectedView) return
    setLoading(true)
    api.get(`/ea-views/${selectedView}/snapshots`).then((d: any) => { setSnapshots(Array.isArray(d)?d:[]); setLoading(false) })
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
            <div style={{ width:40, height:40, borderRadius:8, background:'rgba(0,180,216,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📸</div>
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
export default function EaViewsPage() {
  const api = useViewsApi()
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [activeView, setActiveView] = useState<any>(null)
  const [selectedViewpoint, setSelectedViewpoint] = useState<any>(null)
  const [showBuilder, setShowBuilder] = useState(false)

  const loadStats = useCallback(() => { api.get('/ea-views/stats').then(setStats) }, [])
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

      {tab !== 'viewer' && tab !== 'builder' && (
        <div style={S.tabs}>
          {TABS.map(t=><button key={t.id} style={S.tab(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label}</button>)}
        </div>
      )}
      {tab !== 'viewer' && tab !== 'builder' && (() => {
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
        {tab === 'my-views' && <MyViews api={api} onOpen={openView} />}
        {tab === 'snapshots' && <SnapshotsPanel api={api} />}
        {tab === 'builder' && <ViewBuilder api={api} viewpoint={selectedViewpoint} onCreated={handleViewCreated} onCancel={()=>setTab('my-views')} />}
        {tab === 'viewer' && activeView && <ViewViewer api={api} view={activeView} onBack={()=>setTab('my-views')} onRefresh={loadStats} />}
      </div>
    </div>
  )
}
