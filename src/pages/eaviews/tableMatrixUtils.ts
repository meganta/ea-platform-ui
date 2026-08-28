// ── Relationship-Aware Table + Semantic Matrix (Phase 4A) ────────────────
//
// Pure functions consuming the canonical ViewDataset + VisualizationEligibility
// contract from the backend (view-dataset.types.ts /
// visualization-eligibility.service.ts) - never reconstructing
// architectural meaning (primary/related roles, path chains, DIRECT vs
// PATH relationship semantics) from the legacy flat nodes/edges shape.
// Kept separate from EaViewsPage.tsx's render functions (matching this
// codebase's own exportUtils.ts convention) specifically so this logic is
// unit-testable without full React rendering.

export type TableMode = 'relationship' | 'inventory'

export interface RelationshipTableResult {
  mode: TableMode
  columns: string[] // semantic column headers, in path order for 'relationship' mode; fixed inventory headers otherwise
  relationLabels: string[] // one fewer than columns.length in relationship mode - the hop label BETWEEN each pair of columns
  rows: { id: string; objectIds: string[]; values: { id: string; name: string }[] }[]
}

// Determines table mode from the dataset alone - relationship mode
// whenever real paths or relationships exist, inventory mode only as the
// genuine fallback (Section 1B), never the default for a relational view.
export function determineTableMode(dataset: any): TableMode {
  if (!dataset) return 'inventory'
  if ((dataset.paths?.length ?? 0) > 0) return 'relationship'
  if ((dataset.relationships?.length ?? 0) > 0) return 'relationship'
  return 'inventory'
}

// Builds the relationship-aware table. Each row corresponds to a REAL
// ViewDataset path (multi-hop) or a real relationship (single-hop) - never
// a Cartesian product of independently-listed objects (Section 3's explicit
// prohibition: Capability A -> [App1,App2] must never imply
// [App1,App2] x [TechX,TechY] combinations that were never actually walked).
// Multiple real paths sharing a root correctly produce multiple, separately
// correlated rows (Capability A -> App1 -> TechX and Capability A -> App2
// -> TechX are two rows, not one row with an array cell).
export function buildRelationshipTable(dataset: any): RelationshipTableResult {
  const objectById = new Map((dataset?.objects ?? []).map((o: any) => [o.id, o]))
  const relationshipById = new Map((dataset?.relationships ?? []).map((r: any) => [r.id, r]))

  if ((dataset?.paths?.length ?? 0) > 0) {
    // Column shape derived from the FIRST path's object types, in path
    // order - "for multiple returned paths of the same configured type,
    // rows share the same semantic columns" (Section 2). A dataset with
    // heterogeneous path shapes (different hop counts) still gets one
    // consistent column set sized to the longest path, with shorter rows
    // leaving trailing cells blank rather than corrupting alignment.
    const maxLen = Math.max(...dataset.paths.map((p: any) => p.objectIds.length))
    const samplePath = dataset.paths.find((p: any) => p.objectIds.length === maxLen)
    const columns: string[] = samplePath.objectIds.map((oid: string) => {
      const o: any = objectById.get(oid)
      return o?.semanticType || o?.assetType || 'Object'
    })
    const relationLabels: string[] = samplePath.relationshipIds.map((rid: string) => {
      const r: any = relationshipById.get(rid)
      return r?.label || r?.relationshipType || ''
    })
    const rows = dataset.paths.map((p: any) => ({
      id: p.id,
      objectIds: p.objectIds,
      values: p.objectIds.map((oid: string) => {
        const o: any = objectById.get(oid)
        return { id: oid, name: o?.name ?? oid }
      }),
    }))
    return { mode: 'relationship', columns, relationLabels, rows }
  }

  // Single-hop, no configured path: one row per real relationship,
  // exactly as it exists - not derived/synthesized.
  const columns = ['Source', 'Target']
  const relationLabels = [dataset.relationships[0]?.label || dataset.relationships[0]?.relationshipType || '']
  const rows = dataset.relationships.map((r: any) => {
    const src: any = objectById.get(r.sourceId)
    const tgt: any = objectById.get(r.targetId)
    return {
      id: r.id,
      objectIds: [r.sourceId, r.targetId],
      values: [{ id: r.sourceId, name: src?.name ?? r.sourceId }, { id: r.targetId, name: tgt?.name ?? r.targetId }],
    }
  })
  return { mode: 'relationship', columns, relationLabels, rows }
}

export interface MatrixCell {
  count: number
  // DIRECT: the actual relationship objects backing this cell (drill-down).
  // PATH: the actual path objects backing this cell (drill-down).
  items: any[]
}

export interface MatrixResult {
  eligible: boolean
  reason?: string
  relationMode?: 'DIRECT' | 'PATH'
  rowType?: string
  columnType?: string
  pathSteps?: { from: string; relationship: string; to: string }[] // PATH mode only - for the "Derived through: X -> Y -> Z" subtitle (Section 8)
  rows?: any[]
  columns?: any[]
  cells?: Map<string, MatrixCell> // keyed `${rowId}::${colId}`
}

// Consumes VisualizationEligibility's own recommendedConfig - never
// independently invents row/column axes (Section 6's explicit
// prohibition). If Matrix isn't eligible, returns the deterministic
// ineligibility reason instead of empty axes (Section 11) - the caller is
// expected to render that reason, never an empty grid that looks broken.
export function buildMatrix(dataset: any, eligibility: any): MatrixResult {
  const matrixEval = eligibility?.eligible?.find((v: any) => v.visualization === 'MATRIX')
  if (!matrixEval) {
    const ineligible = eligibility?.ineligible?.find((v: any) => v.visualization === 'MATRIX')
    return { eligible: false, reason: ineligible?.reasons?.[0] || 'Matrix is not available for this view.' }
  }
  const config = matrixEval.recommendedConfig
  if (!config) return { eligible: false, reason: 'Matrix is not available for this view.' }

  const { rowType, columnType, relationMode } = config
  const objects: any[] = dataset?.objects ?? []
  const matchesType = (o: any, t: string) => (o.semanticType || o.assetType) === t
  const rows = objects.filter(o => matchesType(o, rowType))
  const columns = objects.filter(o => matchesType(o, columnType))
  const cells = new Map<string, MatrixCell>()

  if (relationMode === 'DIRECT') {
    const relTypes: string[] = config.relationshipTypes ?? []
    for (const rel of dataset?.relationships ?? []) {
      // Only the recommended, configured relationship type(s) populate
      // cells - never arbitrary edge presence unrelated to what was
      // actually recommended (Section 7's explicit requirement).
      if (relTypes.length > 0 && !relTypes.includes(rel.relationshipType)) continue
      // Requires a genuine (row-type object, column-type object) PAIR on
      // the two ends of this relationship, in either orientation - not
      // independently checking "does either end match rows" and "does
      // either end match columns" separately, which could wrongly treat
      // a relationship between two row-type objects as populating a cell.
      const srcInRows = rows.find(r => r.id === rel.sourceId)
      const tgtInCols = columns.find(c => c.id === rel.targetId)
      const srcInCols = columns.find(c => c.id === rel.sourceId)
      const tgtInRows = rows.find(r => r.id === rel.targetId)
      let rowMatch: any; let colMatch: any
      if (srcInRows && tgtInCols) { rowMatch = srcInRows; colMatch = tgtInCols }
      else if (srcInCols && tgtInRows) { rowMatch = tgtInRows; colMatch = srcInCols }
      else continue
      const key = `${rowMatch.id}::${colMatch.id}`
      const existing = cells.get(key) ?? { count: 0, items: [] }
      existing.count += 1
      existing.items.push(rel)
      cells.set(key, existing)
    }
    return { eligible: true, relationMode: 'DIRECT', rowType, columnType, rows, columns, cells }
  }

  if (relationMode === 'PATH') {
    // A populated cell means "at least one real ViewDataset path
    // connects row to column" - NEVER a synthesized direct relationship
    // (Section 8's explicit requirement). Count = number of distinct
    // real paths, per Section 9's worked example (3 paths from 3
    // distinct App intermediaries).
    for (const path of dataset?.paths ?? []) {
      const rowMatch = rows.find(r => r.id === path.rootObjectId)
      const leafId = path.objectIds[path.objectIds.length - 1]
      const colMatch = columns.find(c => c.id === leafId)
      if (!rowMatch || !colMatch) continue
      const key = `${rowMatch.id}::${colMatch.id}`
      const existing = cells.get(key) ?? { count: 0, items: [] }
      existing.count += 1
      existing.items.push(path)
      cells.set(key, existing)
    }
    return { eligible: true, relationMode: 'PATH', rowType, columnType, pathSteps: config.path, rows, columns, cells }
  }

  return { eligible: false, reason: 'Matrix is not available for this view.' }
}
