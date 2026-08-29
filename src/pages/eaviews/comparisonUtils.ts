// ── Comparison Renderer Utilities (Phase 5B) ──────────────────────────────
//
// Pure functions consuming the backend ComparisonDataset directly - no
// diff logic lives here (Section 25: comparison semantics belong in the
// backend service, reusable by reports/exports/AI later). These
// functions only shape that already-computed result for each renderer.

export type ComparisonChangeType = 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED'

export interface ChangeSummaryRow {
  id: string
  name: string
  type: string
  changeType: ComparisonChangeType
  changedProperties: string[]
  before: string
  after: string
}

function fmtVal(v: any): string { return v === undefined ? '(absent)' : v === null ? '(null)' : String(v) }

// Table: Change Summary (Section 12) - one row per object that actually
// changed, in ADDED/REMOVED/MODIFIED order (UNCHANGED excluded by
// default per Section 21 - the caller decides whether to include it via
// includeUnchanged).
export function buildChangeSummaryRows(comparison: any, includeUnchanged = false): ChangeSummaryRow[] {
  const rows: ChangeSummaryRow[] = []
  for (const o of comparison?.objects?.added ?? []) {
    rows.push({ id: o.id, name: o.right?.name ?? o.id, type: o.right?.semanticType || o.right?.assetType || '', changeType: 'ADDED', changedProperties: [], before: '', after: '' })
  }
  for (const o of comparison?.objects?.removed ?? []) {
    rows.push({ id: o.id, name: o.left?.name ?? o.id, type: o.left?.semanticType || o.left?.assetType || '', changeType: 'REMOVED', changedProperties: [], before: '', after: '' })
  }
  for (const o of comparison?.objects?.modified ?? []) {
    const props = (o.propertyChanges ?? []).map((p: any) => p.property)
    const before = (o.propertyChanges ?? []).map((p: any) => `${p.property}: ${fmtVal(p.before)}`).join(', ')
    const after = (o.propertyChanges ?? []).map((p: any) => `${p.property}: ${fmtVal(p.after)}`).join(', ')
    rows.push({ id: o.id, name: o.right?.name ?? o.left?.name ?? o.id, type: o.right?.semanticType || o.right?.assetType || '', changeType: 'MODIFIED', changedProperties: props, before, after })
  }
  if (includeUnchanged) {
    for (const o of comparison?.objects?.unchanged ?? []) {
      rows.push({ id: o.id, name: o.right?.name ?? o.left?.name ?? o.id, type: o.right?.semanticType || o.right?.assetType || '', changeType: 'UNCHANGED', changedProperties: [], before: '', after: '' })
    }
  }
  return rows
}

export interface RelationshipChangeRow {
  key: string
  source: string
  relationship: string
  target: string
  changeType: 'ADDED' | 'REMOVED' | 'UNCHANGED'
}

// Table: Relationship Changes (Section 12)
export function buildRelationshipChangeRows(comparison: any, includeUnchanged = false): RelationshipChangeRow[] {
  const objById = new Map<string, any>()
  for (const bucket of ['added', 'removed', 'modified', 'unchanged']) {
    for (const o of comparison?.objects?.[bucket] ?? []) objById.set(o.id, o.right ?? o.left)
  }
  const nameOf = (id: string) => objById.get(id)?.name ?? id
  const rows: RelationshipChangeRow[] = []
  for (const r of comparison?.relationships?.added ?? []) {
    rows.push({ key: r.key, source: nameOf(r.right.sourceId), relationship: r.right.label || r.right.relationshipType, target: nameOf(r.right.targetId), changeType: 'ADDED' })
  }
  for (const r of comparison?.relationships?.removed ?? []) {
    rows.push({ key: r.key, source: nameOf(r.left.sourceId), relationship: r.left.label || r.left.relationshipType, target: nameOf(r.left.targetId), changeType: 'REMOVED' })
  }
  if (includeUnchanged) {
    for (const r of comparison?.relationships?.unchanged ?? []) {
      const rel = r.right ?? r.left
      rows.push({ key: r.key, source: nameOf(rel.sourceId), relationship: rel.label || rel.relationshipType, target: nameOf(rel.targetId), changeType: 'UNCHANGED' })
    }
  }
  return rows
}

export interface ComparisonMatrixCell {
  beforeCount: number
  afterCount: number
  delta: number
}

export interface ComparisonMatrixResult {
  eligible: boolean
  reason?: string
  relationMode?: 'DIRECT' | 'PATH'
  rowType?: string
  columnType?: string
  rows?: { id: string; name: string }[]
  columns?: { id: string; name: string }[]
  cells?: Map<string, ComparisonMatrixCell> // keyed `${rowId}::${colId}`
}

// Matrix comparison (Section 16). PATH mode counts REAL path instances
// from comparison.leftPaths/rightPaths directly, per (root, leaf) pair -
// never inferred from relationships.added/removed, which would
// conflate a genuine multi-hop path count with mere direct-relationship
// presence between the same two objects (the exact anti-pattern Section
// 16 warns against). DIRECT mode counts real relationships the same way,
// from the actual relationship diff arrays.
export function buildComparisonMatrix(comparison: any): ComparisonMatrixResult {
  const objectById = new Map<string, any>()
  for (const bucket of ['added', 'removed', 'modified', 'unchanged']) {
    for (const o of comparison?.objects?.[bucket] ?? []) objectById.set(o.id, o.right ?? o.left)
  }
  const leftPaths: any[] = comparison?.leftPaths ?? []
  const rightPaths: any[] = comparison?.rightPaths ?? []

  if (leftPaths.length > 0 || rightPaths.length > 0) {
    const samplePath = leftPaths[0] ?? rightPaths[0]
    const rootObj = objectById.get(samplePath.rootObjectId)
    const leafObj = objectById.get(samplePath.objectIds[samplePath.objectIds.length - 1])
    if (!rootObj || !leafObj) return { eligible: false, reason: 'Matrix comparison is not available - the configured path could not be resolved.' }
    const rowType = rootObj.semanticType || rootObj.assetType
    const columnType = leafObj.semanticType || leafObj.assetType
    // Count REAL path instances per (root, leaf) pair, on each side
    // independently - this is the actual proof this counts real paths,
    // not a derived/inferred number.
    const beforeCounts = new Map<string, number>()
    for (const p of leftPaths) { const k = `${p.rootObjectId}::${p.objectIds[p.objectIds.length - 1]}`; beforeCounts.set(k, (beforeCounts.get(k) ?? 0) + 1) }
    const afterCounts = new Map<string, number>()
    for (const p of rightPaths) { const k = `${p.rootObjectId}::${p.objectIds[p.objectIds.length - 1]}`; afterCounts.set(k, (afterCounts.get(k) ?? 0) + 1) }
    const allKeys = new Set([...beforeCounts.keys(), ...afterCounts.keys()])
    const cells = new Map<string, ComparisonMatrixCell>()
    const rowIds = new Set<string>(), colIds = new Set<string>()
    for (const k of allKeys) {
      const [rowId, colId] = k.split('::')
      rowIds.add(rowId); colIds.add(colId)
      const before = beforeCounts.get(k) ?? 0, after = afterCounts.get(k) ?? 0
      cells.set(`${rowId}::${colId}`, { beforeCount: before, afterCount: after, delta: after - before })
    }
    return {
      eligible: true, relationMode: 'PATH', rowType, columnType,
      rows: [...rowIds].map(id => ({ id, name: objectById.get(id)?.name ?? id })),
      columns: [...colIds].map(id => ({ id, name: objectById.get(id)?.name ?? id })),
      cells,
    }
  }

  // DIRECT mode fallback: no configured path on either side - count real
  // relationships between distinct semantic types, same as
  // tableMatrixUtils' own incidental-relationship fallback.
  const leftRels: any[] = (comparison?.relationships?.removed ?? []).map((r: any) => r.left).concat((comparison?.relationships?.unchanged ?? []).map((r: any) => r.left))
  const rightRels: any[] = (comparison?.relationships?.added ?? []).map((r: any) => r.right).concat((comparison?.relationships?.unchanged ?? []).map((r: any) => r.right))
  const sampleRel = leftRels[0] ?? rightRels[0]
  if (!sampleRel) return { eligible: false, reason: 'Matrix comparison is not available - no relationships exist on either side.' }
  const srcObj = objectById.get(sampleRel.sourceId), tgtObj = objectById.get(sampleRel.targetId)
  if (!srcObj || !tgtObj) return { eligible: false, reason: 'Matrix comparison is not available - relationship endpoints could not be resolved.' }
  const rowType = srcObj.semanticType || srcObj.assetType
  const columnType = tgtObj.semanticType || tgtObj.assetType
  const countBy = (rels: any[]) => { const m = new Map<string, number>(); for (const r of rels) { const k = `${r.sourceId}::${r.targetId}`; m.set(k, (m.get(k) ?? 0) + 1) } return m }
  const beforeCounts = countBy(leftRels)
  const afterCounts = countBy(rightRels)
  const allKeys = new Set([...beforeCounts.keys(), ...afterCounts.keys()])
  const cells = new Map<string, ComparisonMatrixCell>()
  const rowIds = new Set<string>(), colIds = new Set<string>()
  for (const k of allKeys) {
    const [rowId, colId] = k.split('::')
    rowIds.add(rowId); colIds.add(colId)
    const before = beforeCounts.get(k) ?? 0, after = afterCounts.get(k) ?? 0
    cells.set(`${rowId}::${colId}`, { beforeCount: before, afterCount: after, delta: after - before })
  }
  return {
    eligible: true, relationMode: 'DIRECT', rowType, columnType,
    rows: [...rowIds].map(id => ({ id, name: objectById.get(id)?.name ?? id })),
    columns: [...colIds].map(id => ({ id, name: objectById.get(id)?.name ?? id })),
    cells,
  }
}

export interface ComparisonFilters {
  changeTypes?: ComparisonChangeType[] // undefined/empty = show all
  objectTypes?: string[]
  domains?: string[]
}

// Section 21: filtering over the already-computed comparison, never
// mutating it.
export function applyComparisonFilters(comparison: any, filters: ComparisonFilters) {
  const matchesType = (o: any) => {
    const obj = o.right ?? o.left
    if (filters.objectTypes?.length && !filters.objectTypes.includes(obj?.semanticType || obj?.assetType)) return false
    if (filters.domains?.length && !filters.domains.includes(obj?.domain)) return false
    return true
  }
  const wantChange = (t: ComparisonChangeType) => !filters.changeTypes?.length || filters.changeTypes.includes(t)
  return {
    added: wantChange('ADDED') ? (comparison?.objects?.added ?? []).filter(matchesType) : [],
    removed: wantChange('REMOVED') ? (comparison?.objects?.removed ?? []).filter(matchesType) : [],
    modified: wantChange('MODIFIED') ? (comparison?.objects?.modified ?? []).filter(matchesType) : [],
    unchanged: wantChange('UNCHANGED') ? (comparison?.objects?.unchanged ?? []).filter(matchesType) : [],
  }
}
