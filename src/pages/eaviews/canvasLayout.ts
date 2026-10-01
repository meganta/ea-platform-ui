// ── Architecture canvas layouts ──────────────────────────────────────────
//
// "Question" layout reads left to right the way the view's question does:
// the primary objects first, then each related group in the order the
// view reaches it (path hop order when the view walks a path, otherwise
// object type). "Domain" layout keeps the earlier one-column-per-domain
// arrangement. Both are pure functions of the data so they are testable
// and stable between renders.

export interface CanvasNode { id: string; name: string; assetType: string; domain?: string; operatingDomain?: string }
export interface CanvasObject { id: string; role?: 'PRIMARY' | 'RELATED'; pathIds?: string[] }
export interface CanvasPath { id: string; objectIds: string[] }
export type Positions = Record<string, { x: number; y: number }>

export const COLUMN_WIDTH = 240
export const ROW_HEIGHT = 70
const ORIGIN = 60

function place(columns: CanvasNode[][]): Positions {
  const pos: Positions = {}
  columns.forEach((col, ci) => col.forEach((n, ri) => { pos[n.id] = { x: ORIGIN + ci * COLUMN_WIDTH, y: ORIGIN + ri * ROW_HEIGHT } }))
  return pos
}

const byTypeThenName = (a: CanvasNode, b: CanvasNode) => a.assetType.localeCompare(b.assetType) || a.name.localeCompare(b.name)

export function layoutByDomain(nodes: CanvasNode[]): Positions {
  const groups = new Map<string, CanvasNode[]>()
  for (const n of nodes) {
    const k = n.domain || 'Other'
    groups.set(k, [...(groups.get(k) || []), n])
  }
  return place([...groups.values()])
}

export function layoutByQuestion(nodes: CanvasNode[], objects: CanvasObject[], paths: CanvasPath[] = []): Positions {
  const roleOf = new Map(objects.map(o => [o.id, o.role]))
  // Hop index of each object along the view's paths (0 = root).
  const hop = new Map<string, number>()
  for (const p of paths) p.objectIds.forEach((id, i) => { if (!hop.has(id) || hop.get(id)! > i) hop.set(id, i) })

  const primaries = nodes.filter(n => roleOf.get(n.id) !== 'RELATED').sort(byTypeThenName)
  const related = nodes.filter(n => roleOf.get(n.id) === 'RELATED')
  const columns: CanvasNode[][] = [primaries]
  if (hop.size > 0) {
    const maxHop = Math.max(0, ...related.map(n => hop.get(n.id) ?? 0))
    for (let h = 1; h <= maxHop; h++) columns.push(related.filter(n => (hop.get(n.id) ?? maxHop) === h).sort(byTypeThenName))
    const unplaced = related.filter(n => !hop.has(n.id) || hop.get(n.id) === 0)
    if (unplaced.length) columns.push(unplaced.sort(byTypeThenName))
  } else {
    const types = [...new Set(related.map(n => n.assetType))].sort()
    for (const t of types) columns.push(related.filter(n => n.assetType === t).sort(byTypeThenName))
  }
  return place(columns.filter(c => c.length > 0))
}
