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

// ── Graph comparison (Section 13/14) ────────────────────────────────────
//
// Builds a dataset shape compatible with graphDisclosureUtils
// (buildGraphIndexes/chooseFocusObject/computeInitialVisibleSet/
// expandNeighbors etc., Phase 4C) so Progressive Disclosure is reused
// unchanged - not reimplemented for comparison. Every object and
// relationship carries a `_comparisonChangeType` the renderer uses for
// visual treatment (ADDED/REMOVED/MODIFIED/UNCHANGED) - never relying on
// color alone (Section 13's explicit accessibility requirement), so the
// renderer also needs a label/icon per change type, which
// CHANGE_TYPE_SYMBOL below provides. Removed objects are retained (their
// full left-side object, Section 14) even though they don't exist in the
// right-side dataset at all.
export const CHANGE_TYPE_SYMBOL: Record<string, string> = { ADDED: '+', REMOVED: '−', MODIFIED: '~', UNCHANGED: '' }

export function buildComparisonGraphDataset(comparison: any) {
  const objects: any[] = []
  for (const o of comparison?.objects?.added ?? []) objects.push({ ...o.right, _comparisonChangeType: 'ADDED' })
  for (const o of comparison?.objects?.removed ?? []) objects.push({ ...o.left, _comparisonChangeType: 'REMOVED' })
  for (const o of comparison?.objects?.modified ?? []) objects.push({ ...o.right, _comparisonChangeType: 'MODIFIED', _propertyChanges: o.propertyChanges })
  for (const o of comparison?.objects?.unchanged ?? []) objects.push({ ...o.right, _comparisonChangeType: 'UNCHANGED' })

  const relationships: any[] = []
  for (const r of comparison?.relationships?.added ?? []) relationships.push({ ...r.right, id: r.key, _comparisonChangeType: 'ADDED' })
  for (const r of comparison?.relationships?.removed ?? []) relationships.push({ ...r.left, id: r.key, _comparisonChangeType: 'REMOVED' })
  for (const r of comparison?.relationships?.unchanged ?? []) relationships.push({ ...(r.right ?? r.left), id: r.key, _comparisonChangeType: 'UNCHANGED' })

  // Both sides' real paths, so progressive disclosure's path-aware
  // expansion (expandAllNextPathHops) still works across the comparison -
  // never a synthesized/merged path, just the union of what's real on
  // each side.
  const paths = [...(comparison?.leftPaths ?? []), ...(comparison?.rightPaths ?? [])]
  return { objects, relationships, paths }
}

// ── Capability Map comparison (Section 17) ──────────────────────────────
//
// Uses leftHierarchies/rightHierarchies directly - never infers
// structure from relationships (explicit requirement, verified against
// the backend contract before this was written). If a capability exists
// in only one side's hierarchy, that's surfaced directly rather than
// fabricating a merged structural position for it.
export interface ComparisonCapabilityNode {
  id: string
  name: string
  changeType: ComparisonChangeType
  parentId: string | null
  depth: number
  onlyInSide?: 'LEFT' | 'RIGHT' // set when the node's parent link exists on only one side
}

export function buildComparisonCapabilityMap(comparison: any): { eligible: boolean; reason?: string; nodes?: ComparisonCapabilityNode[] } {
  const leftH = comparison?.leftHierarchies?.[0]
  const rightH = comparison?.rightHierarchies?.[0]
  if (!leftH && !rightH) return { eligible: false, reason: 'Capability Map comparison is not available - no capability hierarchy exists on either side.' }

  const changeTypeById = new Map<string, ComparisonChangeType>()
  const objectById = new Map<string, any>()
  for (const bucket of ['added', 'removed', 'modified', 'unchanged'] as const) {
    for (const o of comparison?.objects?.[bucket] ?? []) { changeTypeById.set(o.id, o.changeType); objectById.set(o.id, o.right ?? o.left) }
  }

  const leftParentBy = leftH?.parentByObjectId ?? {}
  const rightParentBy = rightH?.parentByObjectId ?? {}
  const allIds = new Set([...Object.keys(leftParentBy), ...Object.keys(rightParentBy)])

  const depthOf = (id: string, parentBy: Record<string, string | null>, seen = new Set<string>()): number => {
    const parentId = parentBy[id]
    if (!parentId || seen.has(id)) return 0
    seen.add(id)
    return 1 + depthOf(parentId, parentBy, seen)
  }

  const nodes: ComparisonCapabilityNode[] = []
  for (const id of allIds) {
    const inLeft = id in leftParentBy, inRight = id in rightParentBy
    const parentId = (inRight ? rightParentBy[id] : leftParentBy[id]) ?? null
    const depth = depthOf(id, inRight ? rightParentBy : leftParentBy)
    nodes.push({
      id,
      name: objectById.get(id)?.name ?? id,
      changeType: changeTypeById.get(id) ?? 'UNCHANGED',
      parentId,
      depth,
      onlyInSide: !inLeft && inRight ? 'RIGHT' : inLeft && !inRight ? 'LEFT' : undefined,
    })
  }
  return { eligible: true, nodes }
}

// ── Heatmap comparison (Section 18) ──────────────────────────────────────
//
// Compares only metrics whose dataType matches on both sides
// (leftMetrics/rightMetrics, from the real ViewDataset.metrics on each
// side - Section 18's explicit "do not silently compare incompatible
// metrics"). Numeric metrics get a real before/after/delta; categorical
// metrics get a before->after transition, NEVER a fabricated numeric
// delta for a category (explicit prohibition).
export interface HeatmapComparisonCell {
  objectId: string
  name: string
  dataType: 'numeric' | 'categorical'
  before: any
  after: any
  delta?: number // numeric only
  transitioned?: boolean // categorical only - true if before !== after
}

export function buildHeatmapComparison(comparison: any, metricKey: string): { eligible: boolean; reason?: string; cells?: HeatmapComparisonCell[] } {
  const leftMetric = (comparison?.leftMetrics ?? []).find((m: any) => m.key === metricKey)
  const rightMetric = (comparison?.rightMetrics ?? []).find((m: any) => m.key === metricKey)
  if (!leftMetric && !rightMetric) return { eligible: false, reason: `Metric "${metricKey}" does not exist on either side.` }
  if (!leftMetric || !rightMetric) return { eligible: false, reason: `Metric "${metricKey}" is not available on both sides - it exists only on the ${leftMetric ? 'left' : 'right'}, so a before/after comparison would be meaningless.` }
  if (leftMetric.dataType !== rightMetric.dataType) return { eligible: false, reason: `Metric "${metricKey}" has an incompatible type between the two scenarios (${leftMetric.dataType} vs ${rightMetric.dataType}).` }

  const isNumeric = leftMetric.dataType === 'numeric'
  const getValue = (obj: any) => metricKey === 'status' ? obj?.status : obj?.metadata?.[metricKey]
  const cells: HeatmapComparisonCell[] = []
  for (const bucket of ['modified', 'unchanged'] as const) {
    for (const o of comparison?.objects?.[bucket] ?? []) {
      const before = getValue(o.left), after = getValue(o.right)
      if (before === undefined && after === undefined) continue
      cells.push(isNumeric
        ? { objectId: o.id, name: o.right?.name ?? o.id, dataType: 'numeric', before, after, delta: (typeof after === 'number' && typeof before === 'number') ? after - before : undefined }
        : { objectId: o.id, name: o.right?.name ?? o.id, dataType: 'categorical', before, after, transitioned: before !== after })
    }
  }
  return { eligible: true, cells }
}

// ── Tree comparison (Section 19) ─────────────────────────────────────────
//
// Real hierarchy only, from leftHierarchies/rightHierarchies - never
// inferred parent-child links. A node whose parent differs between left
// and right is a structural move, surfaced directly (not duplicated as
// two separate nodes).
export interface ComparisonTreeNode {
  id: string
  name: string
  changeType: ComparisonChangeType
  leftParentId: string | null
  rightParentId: string | null
  moved: boolean
  children: ComparisonTreeNode[]
}

export function buildComparisonTree(comparison: any): { eligible: boolean; reason?: string; roots?: ComparisonTreeNode[] } {
  const leftH = comparison?.leftHierarchies?.[0]
  const rightH = comparison?.rightHierarchies?.[0]
  if (!leftH && !rightH) return { eligible: false, reason: 'Tree comparison is not available - no hierarchy exists on either side.' }

  const changeTypeById = new Map<string, ComparisonChangeType>()
  const objectById = new Map<string, any>()
  for (const bucket of ['added', 'removed', 'modified', 'unchanged'] as const) {
    for (const o of comparison?.objects?.[bucket] ?? []) { changeTypeById.set(o.id, o.changeType); objectById.set(o.id, o.right ?? o.left) }
  }
  const leftParentBy = leftH?.parentByObjectId ?? {}
  const rightParentBy = rightH?.parentByObjectId ?? {}
  const allIds = new Set([...Object.keys(leftParentBy), ...Object.keys(rightParentBy)])

  const nodeById = new Map<string, ComparisonTreeNode>()
  for (const id of allIds) {
    const leftParentId = id in leftParentBy ? (leftParentBy[id] ?? null) : null
    const rightParentId = id in rightParentBy ? (rightParentBy[id] ?? null) : null
    nodeById.set(id, {
      id, name: objectById.get(id)?.name ?? id, changeType: changeTypeById.get(id) ?? 'UNCHANGED',
      leftParentId, rightParentId, moved: (id in leftParentBy) && (id in rightParentBy) && leftParentId !== rightParentId,
      children: [],
    })
  }
  const roots: ComparisonTreeNode[] = []
  const seen = new Set<string>()
  for (const [id, node] of nodeById) {
    const effectiveParent = node.rightParentId ?? node.leftParentId
    if (effectiveParent && nodeById.has(effectiveParent) && !seen.has(`${effectiveParent}->${id}`)) {
      seen.add(`${effectiveParent}->${id}`)
      nodeById.get(effectiveParent)!.children.push(node)
    } else if (!effectiveParent) {
      roots.push(node)
    }
  }
  return { eligible: true, roots }
}

// ── Cards comparison (Section 20) ────────────────────────────────────────
//
// One card per changed object (ADDED/REMOVED/MODIFIED) with concise
// property and relationship changes - never a full audit report (Section
// 20's explicit "avoid turning Cards into full audit reports").
export interface ComparisonCard {
  id: string
  name: string
  changeType: ComparisonChangeType
  propertyChanges: { property: string; before: any; after: any }[]
  relationshipChanges: { relationship: string; target: string; changeType: 'ADDED' | 'REMOVED' }[]
}

export function buildComparisonCards(comparison: any, includeUnchanged = false): ComparisonCard[] {
  const objById = new Map<string, any>()
  for (const bucket of ['added', 'removed', 'modified', 'unchanged'] as const) {
    for (const o of comparison?.objects?.[bucket] ?? []) objById.set(o.id, o.right ?? o.left)
  }
  const nameOf = (id: string) => objById.get(id)?.name ?? id
  const relChangesFor = (objectId: string) => {
    const changes: ComparisonCard['relationshipChanges'] = []
    for (const r of comparison?.relationships?.added ?? []) if (r.right?.sourceId === objectId) changes.push({ relationship: r.right.label || r.right.relationshipType, target: nameOf(r.right.targetId), changeType: 'ADDED' })
    for (const r of comparison?.relationships?.removed ?? []) if (r.left?.sourceId === objectId) changes.push({ relationship: r.left.label || r.left.relationshipType, target: nameOf(r.left.targetId), changeType: 'REMOVED' })
    return changes
  }
  const cards: ComparisonCard[] = []
  for (const o of comparison?.objects?.added ?? []) cards.push({ id: o.id, name: o.right?.name ?? o.id, changeType: 'ADDED', propertyChanges: [], relationshipChanges: relChangesFor(o.id) })
  for (const o of comparison?.objects?.removed ?? []) cards.push({ id: o.id, name: o.left?.name ?? o.id, changeType: 'REMOVED', propertyChanges: [], relationshipChanges: relChangesFor(o.id) })
  for (const o of comparison?.objects?.modified ?? []) cards.push({ id: o.id, name: o.right?.name ?? o.id, changeType: 'MODIFIED', propertyChanges: o.propertyChanges ?? [], relationshipChanges: relChangesFor(o.id) })
  if (includeUnchanged) for (const o of comparison?.objects?.unchanged ?? []) cards.push({ id: o.id, name: o.right?.name ?? o.id, changeType: 'UNCHANGED', propertyChanges: [], relationshipChanges: relChangesFor(o.id) })
  return cards
}
