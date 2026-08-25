import React, { useState, useEffect, useMemo } from 'react'

const S_LOCAL = {
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary'|'secondary' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
}

const STATUS_COLOR: Record<string, string> = { APPROVED: '#2ecc71', ACTIVE: '#2ecc71', UNDER_REVIEW: '#f39c12', DRAFT: '#95a5a6', PLANNED: '#3498db', DEPRECATED: '#e74c3c', RETIRED: '#7f8c8d' }

interface RoadmapItem { id: string; name: string; start: string | null; end: string | null; group: string; status: string; assetType: string }

// Config UI shown when a view has no roadmap date fields set yet (or the
// user wants to change them) - picks which metadata attribute represents
// start/end per object type, via /ea-views/date-fields. Kept intentionally
// minimal: one type at a time, since roadmap views are realistically
// scoped to a single object type in practice (Projects, Initiatives, etc).
export function RoadmapConfigPanel({ api, assetType, initial, onSave, onCancel }: { api: any; assetType: string; initial: { startField?: string; endField?: string; groupByField?: string }; onSave: (cfg: { startField: string; endField: string; groupByField?: string }) => void; onCancel: () => void }) {
  const [dateFields, setDateFields] = useState<{ code: string; name: string }[]>([])
  const [startField, setStartField] = useState(initial.startField || '')
  const [endField, setEndField] = useState(initial.endField || '')
  const [groupByField, setGroupByField] = useState(initial.groupByField || '')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/ea-views/date-fields?assetType=${encodeURIComponent(assetType)}`)
      .then((fields: any) => setDateFields(Array.isArray(fields) ? fields : []))
      .catch(() => setDateFields([]))
      .then(() => setLoading(false))
  }, [api, assetType])

  if (loading) return <div style={{ ...S_LOCAL.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>Loading available date fields...</div>

  if (dateFields.length === 0) {
    return (
      <div style={{ ...S_LOCAL.card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 14, marginBottom: 8 }}>No date fields found on {assetType}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>A Roadmap view needs at least one date-type attribute (e.g. Start Date, End Date) on the object type. Add one in Meta-Model Studio first.</div>
        <button style={S_LOCAL.btn()} onClick={onCancel}>Back</button>
      </div>
    )
  }

  return (
    <div style={S_LOCAL.card}>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Configure Roadmap Timeline</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={S_LOCAL.label}>Start Date field</label>
          <select style={S_LOCAL.input} value={startField} onChange={e => setStartField(e.target.value)}>
            <option value="">Select...</option>
            {dateFields.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
        </div>
        <div>
          <label style={S_LOCAL.label}>End Date field</label>
          <select style={S_LOCAL.input} value={endField} onChange={e => setEndField(e.target.value)}>
            <option value="">Select...</option>
            {dateFields.map(f => <option key={f.code} value={f.code}>{f.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <label style={S_LOCAL.label}>Group rows by (optional metadata field, e.g. Owner, Theme)</label>
        <input style={S_LOCAL.input} value={groupByField} onChange={e => setGroupByField(e.target.value)} placeholder="Leave blank to group by owner/domain" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={S_LOCAL.btn('primary')} disabled={!startField || !endField} onClick={() => onSave({ startField, endField, groupByField: groupByField || undefined })}>Save & Build Timeline</button>
        <button style={S_LOCAL.btn()} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// The actual timeline rendering, given already-fetched items. Pure
// presentational component so it can be reused for both a saved view's
// roadmap and an ad-hoc/dashboard-widget roadmap.
export function RoadmapTimeline({ items, onSelect }: { items: RoadmapItem[]; onSelect?: (item: RoadmapItem) => void }) {
  const [zoom, setZoom] = useState(1)

  const { groups, minDate, maxDate } = useMemo(() => {
    const withDates = items.filter(i => i.start || i.end)
    if (withDates.length === 0) return { groups: [] as { name: string; items: RoadmapItem[] }[], minDate: new Date(), maxDate: new Date() }
    const dates = withDates.flatMap(i => [i.start, i.end].filter(Boolean).map(d => new Date(d as string).getTime()))
    const min = new Date(Math.min(...dates))
    const max = new Date(Math.max(...dates))
    // Pad the range by ~5% on each side so items at the very edge aren't clipped against the axis.
    const pad = (max.getTime() - min.getTime()) * 0.05 || 1000 * 60 * 60 * 24 * 7
    const grouped = new Map<string, RoadmapItem[]>()
    for (const item of withDates) {
      if (!grouped.has(item.group)) grouped.set(item.group, [])
      grouped.get(item.group)!.push(item)
    }
    return {
      groups: [...grouped.entries()].map(([name, its]) => ({ name, items: its })).sort((a, b) => a.name.localeCompare(b.name)),
      minDate: new Date(min.getTime() - pad),
      maxDate: new Date(max.getTime() + pad),
    }
  }, [items])

  if (groups.length === 0) {
    return <div style={{ ...S_LOCAL.card, textAlign: 'center', color: 'var(--text-dim)', padding: 60 }}>No items with a start or end date in the current filter set.</div>
  }

  const totalMs = maxDate.getTime() - minDate.getTime()
  const pxPerDay = 6 * zoom
  const totalDays = totalMs / (1000 * 60 * 60 * 24)
  const timelineWidth = Math.max(600, totalDays * pxPerDay)
  const xForDate = (d: Date) => ((d.getTime() - minDate.getTime()) / totalMs) * timelineWidth

  // Month gridlines/labels along the axis.
  const monthMarks: { x: number; label: string }[] = []
  const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
  while (cursor < maxDate) {
    monthMarks.push({ x: xForDate(cursor), label: cursor.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  const ROW_H = 34
  const LABEL_W = 180

  return (
    <div style={S_LOCAL.card}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginBottom: 12 }}>
        <button style={{ ...S_LOCAL.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z => Math.max(0.3, z - 0.3))}>−</button>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '3px 8px' }}>{Math.round(zoom * 100)}%</div>
        <button style={{ ...S_LOCAL.btn(), padding: '3px 10px', fontSize: 12 }} onClick={() => setZoom(z => Math.min(4, z + 0.3))}>+</button>
      </div>
      <div style={{ display: 'flex', overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <div style={{ width: LABEL_W, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--navy-mid)' }}>
          <div style={{ height: 30, borderBottom: '1px solid var(--border)' }} />
          {groups.map(g => (
            <div key={g.name} style={{ height: ROW_H * g.items.length, display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>{g.name}</div>
          ))}
        </div>
        <div style={{ position: 'relative', width: timelineWidth, flexShrink: 0 }}>
          <div style={{ position: 'relative', height: 30, borderBottom: '1px solid var(--border)' }}>
            {monthMarks.map((m, i) => (
              <div key={i} style={{ position: 'absolute', left: m.x, top: 0, height: '100%', borderLeft: '1px solid var(--border)', paddingLeft: 4, fontSize: 10, color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{m.label}</div>
            ))}
          </div>
          {groups.map(g => (
            <div key={g.name} style={{ position: 'relative', height: ROW_H * g.items.length, borderBottom: '1px solid var(--border)' }}>
              {monthMarks.map((m, i) => <div key={i} style={{ position: 'absolute', left: m.x, top: 0, bottom: 0, borderLeft: '1px solid rgba(255,255,255,0.04)' }} />)}
              {g.items.map((item, i) => {
                const start = item.start ? new Date(item.start) : (item.end ? new Date(item.end) : minDate)
                const end = item.end ? new Date(item.end) : (item.start ? new Date(item.start) : maxDate)
                const x1 = Math.max(0, xForDate(start))
                const x2 = Math.min(timelineWidth, xForDate(end))
                const barW = Math.max(4, x2 - x1)
                const color = STATUS_COLOR[item.status] || '#3498db'
                return (
                  <div key={item.id} title={item.name} onClick={() => onSelect?.(item)}
                    style={{ position: 'absolute', left: x1, top: i * ROW_H + 6, width: barW, height: ROW_H - 12, borderRadius: 5, background: color + '33', border: `1px solid ${color}`, display: 'flex', alignItems: 'center', paddingLeft: 6, fontSize: 11, color, overflow: 'hidden', whiteSpace: 'nowrap' as const, cursor: onSelect ? 'pointer' : 'default' }}>
                    {item.name}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
