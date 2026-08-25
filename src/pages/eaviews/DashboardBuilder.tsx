import React, { useState } from 'react'

const S_LOCAL = {
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
}

const ASSET_TYPES = ['CAPABILITY','APPLICATION','DATA_ENTITY','TECH_COMPONENT','SECURITY_CONTROL','EA_PRINCIPLE','INTEGRATION','PROCESS','ORG_UNIT','RISK']
const STATUS_COLOR: Record<string, string> = { APPROVED: '#2ecc71', ACTIVE: '#2ecc71', UNDER_REVIEW: '#f39c12', DRAFT: '#95a5a6', PLANNED: '#3498db', DEPRECATED: '#e74c3c', RETIRED: '#7f8c8d' }
const WIDGET_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'kpi', label: 'KPI Tile', icon: '🔢' },
  { value: 'table', label: 'Table', icon: '≡' },
  { value: 'matrix', label: 'Matrix', icon: '⊞' },
  { value: 'heatmap', label: 'Heatmap', icon: '🔥' },
  { value: 'graph', label: 'Graph Summary', icon: '🕸' },
  { value: 'roadmap', label: 'Roadmap', icon: '🗺' },
]

export interface DashboardWidget {
  id: string
  type: 'kpi' | 'table' | 'matrix' | 'heatmap' | 'graph' | 'roadmap'
  title: string
  x: number; y: number; w: number; h: number
  config: any
}

function newWidgetId() { return `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

// ── Widget configuration form - fields shown adapt to the chosen type ──────
function WidgetConfigForm({ widget, onChange }: { widget: DashboardWidget; onChange: (w: DashboardWidget) => void }) {
  const set = (patch: Partial<DashboardWidget>) => onChange({ ...widget, ...patch })
  const setConfig = (patch: any) => onChange({ ...widget, config: { ...widget.config, ...patch } })

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={S_LOCAL.label}>Widget Title</label>
        <input style={S_LOCAL.input} value={widget.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Total Critical Applications" />
      </div>

      {widget.type === 'kpi' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Object Type</label>
            <select style={S_LOCAL.input} value={widget.config.assetTypes?.[0] || ''} onChange={e => setConfig({ assetTypes: [e.target.value] })}>
              <option value="">Select...</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Aggregation</label>
            <select style={S_LOCAL.input} value={widget.config.aggregation || 'count'} onChange={e => setConfig({ aggregation: e.target.value })}>
              <option value="count">Count of objects</option>
              <option value="sum">Sum of a numeric field</option>
              <option value="avg">Average of a numeric field</option>
            </select>
          </div>
          {widget.config.aggregation !== 'count' && (
            <div style={{ marginBottom: 12 }}>
              <label style={S_LOCAL.label}>Metadata field to aggregate</label>
              <input style={S_LOCAL.input} value={widget.config.field || ''} onChange={e => setConfig({ field: e.target.value })} placeholder="e.g. totalBudget" />
            </div>
          )}
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Filter: Status (optional)</label>
            <input style={S_LOCAL.input} value={widget.config.filters?.status || ''} onChange={e => setConfig({ filters: { ...widget.config.filters, status: e.target.value || undefined } })} placeholder="e.g. APPROVED" />
          </div>
        </>
      )}

      {(widget.type === 'table' || widget.type === 'heatmap' || widget.type === 'graph') && (
        <div style={{ marginBottom: 12 }}>
          <label style={S_LOCAL.label}>Object Types</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
            {ASSET_TYPES.map(t => {
              const active = (widget.config.rootObjectTypes || []).includes(t)
              return <span key={t} onClick={() => setConfig({ rootObjectTypes: active ? (widget.config.rootObjectTypes || []).filter((x: string) => x !== t) : [...(widget.config.rootObjectTypes || []), t] })}
                style={{ ...S_LOCAL.badge(active ? '#3498db' : '#7f8c8d'), cursor: 'pointer', opacity: active ? 1 : 0.5 }}>{t.replace(/_/g, ' ')}</span>
            })}
          </div>
        </div>
      )}

      {widget.type === 'matrix' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Row Object Type (source)</label>
            <select style={S_LOCAL.input} value={widget.config.sourceTypes?.[0] || ''} onChange={e => setConfig({ sourceTypes: [e.target.value] })}>
              <option value="">Select...</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Column Object Type (target)</label>
            <select style={S_LOCAL.input} value={widget.config.targetTypes?.[0] || ''} onChange={e => setConfig({ targetTypes: [e.target.value] })}>
              <option value="">Select...</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
        </>
      )}

      {widget.type === 'roadmap' && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Object Type</label>
            <select style={S_LOCAL.input} value={widget.config.assetTypes?.[0] || ''} onChange={e => setConfig({ assetTypes: [e.target.value] })}>
              <option value="">Select...</option>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={S_LOCAL.label}>Start field</label>
              <input style={S_LOCAL.input} value={widget.config.startField || ''} onChange={e => setConfig({ startField: e.target.value })} placeholder="e.g. StartDate" />
            </div>
            <div>
              <label style={S_LOCAL.label}>End field</label>
              <input style={S_LOCAL.input} value={widget.config.endField || ''} onChange={e => setConfig({ endField: e.target.value })} placeholder="e.g. EndDate" />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tip: check the Object Type's attributes in Meta-Model Studio for the exact field names, or open the full Roadmap view builder for a guided picker.</div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={S_LOCAL.label}>Width (grid columns, 1-4)</label>
          <input type="number" min={1} max={4} style={S_LOCAL.input} value={widget.w} onChange={e => set({ w: Math.min(4, Math.max(1, parseInt(e.target.value, 10) || 1)) })} />
        </div>
        <div>
          <label style={S_LOCAL.label}>Height (grid rows, 1-3)</label>
          <input type="number" min={1} max={3} style={S_LOCAL.input} value={widget.h} onChange={e => set({ h: Math.min(3, Math.max(1, parseInt(e.target.value, 10) || 1)) })} />
        </div>
      </div>
    </div>
  )
}

// ── The Dashboard Builder: manage the widget list, edit each via the form
// above, reorder/remove. Saves the whole widgets array back to the view's
// dashboardConfig in one PUT (matching how filterConfig/styleConfig etc.
// are already persisted for other view types). ──────────────────────────
export function DashboardBuilder({ widgets, onSave, onCancel }: { widgets: DashboardWidget[]; onSave: (widgets: DashboardWidget[]) => void; onCancel: () => void }) {
  const [list, setList] = useState<DashboardWidget[]>(widgets)
  const [editing, setEditing] = useState<DashboardWidget | null>(null)
  const [pickingType, setPickingType] = useState(false)

  const addWidget = (type: DashboardWidget['type']) => {
    const w: DashboardWidget = { id: newWidgetId(), type, title: '', x: 0, y: list.length, w: type === 'kpi' ? 1 : 2, h: 1, config: {} }
    setPickingType(false)
    setEditing(w)
  }

  const saveWidget = (w: DashboardWidget) => {
    setList(prev => {
      const exists = prev.some(p => p.id === w.id)
      return exists ? prev.map(p => p.id === w.id ? w : p) : [...prev, w]
    })
    setEditing(null)
  }

  const removeWidget = (id: string) => setList(prev => prev.filter(w => w.id !== id))
  const moveWidget = (id: string, dir: -1 | 1) => {
    setList(prev => {
      const idx = prev.findIndex(w => w.id === id)
      const next = [...prev]
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  if (editing) {
    return (
      <div style={S_LOCAL.card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{list.some(w => w.id === editing.id) ? 'Edit' : 'Add'} {WIDGET_TYPES.find(t => t.value === editing.type)?.label}</div>
        <WidgetConfigForm widget={editing} onChange={setEditing} />
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <button style={S_LOCAL.btn('primary')} disabled={!editing.title} onClick={() => saveWidget(editing)}>Save Widget</button>
          <button style={S_LOCAL.btn()} onClick={() => setEditing(null)}>Cancel</button>
        </div>
      </div>
    )
  }

  if (pickingType) {
    return (
      <div style={S_LOCAL.card}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Choose Widget Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {WIDGET_TYPES.map(t => (
            <div key={t.value} onClick={() => addWidget(t.value as any)} style={{ ...S_LOCAL.card, textAlign: 'center', cursor: 'pointer', padding: 20 }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>{t.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{t.label}</div>
            </div>
          ))}
        </div>
        <button style={S_LOCAL.btn()} onClick={() => setPickingType(false)}>Cancel</button>
      </div>
    )
  }

  return (
    <div style={S_LOCAL.card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Dashboard Widgets ({list.length})</div>
        <button style={{ ...S_LOCAL.btn('primary'), marginLeft: 'auto' }} onClick={() => setPickingType(true)}>+ Add Widget</button>
      </div>
      {list.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 30 }}>No widgets yet. Add a KPI tile, table, matrix, heatmap, graph summary, or roadmap.</div>}
      {list.map((w, i) => (
        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--navy-mid)', marginBottom: 8 }}>
          <span>{WIDGET_TYPES.find(t => t.value === w.type)?.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{w.title || '(untitled)'}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{WIDGET_TYPES.find(t => t.value === w.type)?.label} · {w.w}x{w.h}</div>
          </div>
          <button style={{ ...S_LOCAL.btn(), padding: '3px 8px', fontSize: 11 }} disabled={i === 0} onClick={() => moveWidget(w.id, -1)}>↑</button>
          <button style={{ ...S_LOCAL.btn(), padding: '3px 8px', fontSize: 11 }} disabled={i === list.length - 1} onClick={() => moveWidget(w.id, 1)}>↓</button>
          <button style={{ ...S_LOCAL.btn(), padding: '3px 8px', fontSize: 11 }} onClick={() => setEditing(w)}>Edit</button>
          <button style={{ ...S_LOCAL.btn('danger'), padding: '3px 8px', fontSize: 11 }} onClick={() => removeWidget(w.id)}>Remove</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button style={S_LOCAL.btn('primary')} onClick={() => onSave(list)}>Save Dashboard</button>
        <button style={S_LOCAL.btn()} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Dashboard Viewer: renders every widget's already-fetched result
// (results keyed by widget.id, from GET /ea-views/:id/dashboard) in a
// responsive grid sized by each widget's w/h. ──────────────────────────────
export function DashboardGrid({ widgets, results, onEdit }: { widgets: DashboardWidget[]; results: Record<string, any>; onEdit?: () => void }) {
  if (widgets.length === 0) {
    return (
      <div style={{ ...S_LOCAL.card, textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>This dashboard has no widgets yet.</div>
        {onEdit && <button style={S_LOCAL.btn('primary')} onClick={onEdit}>+ Add Widgets</button>}
      </div>
    )
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: 130, gap: 14 }}>
      {widgets.map(w => (
        <div key={w.id} style={{ ...S_LOCAL.card, gridColumn: `span ${w.w}`, gridRow: `span ${w.h}`, overflow: 'auto', display: 'flex', flexDirection: 'column' as const }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 10, flexShrink: 0 }}>{w.title}</div>
          <WidgetContent widget={w} result={results[w.id]} />
        </div>
      ))}
    </div>
  )
}

function WidgetContent({ widget, result }: { widget: DashboardWidget; result: any }) {
  if (!result) return <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>No data</div>
  if (result.error) return <div style={{ color: '#e74c3c', fontSize: 12 }}>⚠ {result.error}</div>

  if (widget.type === 'kpi') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)' }}>{result.label}</div>
      </div>
    )
  }

  if (widget.type === 'table') {
    const nodes = result.nodes || []
    return (
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
          <tbody>
            {nodes.slice(0, 20).map((n: any) => (
              <tr key={n.id}>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)' }}>{n.name}</td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right' }}><span style={S_LOCAL.badge(STATUS_COLOR[n.status] || '#7f8c8d')}>{n.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {nodes.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: 20 }}>No objects match.</div>}
      </div>
    )
  }

  if (widget.type === 'heatmap') {
    const nodes = result.nodes || []
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 4, flex: 1, overflow: 'auto', alignContent: 'flex-start' }}>
        {nodes.slice(0, 40).map((n: any) => (
          <div key={n.id} title={n.name} style={{ padding: '6px 8px', borderRadius: 4, background: (STATUS_COLOR[n.status] || '#7f8c8d') + '33', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{n.name}</div>
        ))}
      </div>
    )
  }

  if (widget.type === 'graph') {
    const nodeCount = result.metadata?.totalNodes ?? result.nodes?.length ?? 0
    const edgeCount = result.edges?.length ?? 0
    const topNodes = (result.nodes || []).slice(0, 5)
    return (
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, marginBottom: 8 }}><strong>{nodeCount}</strong> objects, <strong>{edgeCount}</strong> relationships</div>
        {topNodes.map((n: any) => <div key={n.id} style={{ fontSize: 11, color: 'var(--text-dim)', padding: '2px 0' }}>• {n.name}</div>)}
      </div>
    )
  }

  if (widget.type === 'matrix') {
    const sources = (result.sources || []).slice(0, 6)
    const targets = (result.targets || []).slice(0, 6)
    const rels = result.relationships || []
    const hasRel = (sId: string, tId: string) => rels.some((r: any) => r.sourceId === sId && r.targetId === tId)
    return (
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ fontSize: 10, borderCollapse: 'collapse' }}>
          <thead><tr><th /> {targets.map((t: any) => <th key={t.id} style={{ padding: 3, writingMode: 'vertical-rl' as const, fontWeight: 400, color: 'var(--text-dim)' }}>{t.name.slice(0, 14)}</th>)}</tr></thead>
          <tbody>
            {sources.map((s: any) => (
              <tr key={s.id}>
                <td style={{ padding: 3, color: 'var(--text-dim)', whiteSpace: 'nowrap' as const }}>{s.name.slice(0, 16)}</td>
                {targets.map((t: any) => <td key={t.id} style={{ padding: 3, textAlign: 'center' }}>{hasRel(s.id, t.id) ? <span style={{ color: 'var(--accent)' }}>●</span> : ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (widget.type === 'roadmap') {
    const items = (result.items || []).slice(0, 6)
    return (
      <div style={{ flex: 1, overflow: 'auto' }}>
        {items.map((it: any) => (
          <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <span>{it.name}</span>
            <span style={{ color: 'var(--text-dim)' }}>{it.end ? new Date(it.end).toLocaleDateString() : '—'}</span>
          </div>
        ))}
        {items.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: 20 }}>No dated items.</div>}
      </div>
    )
  }

  return null
}
