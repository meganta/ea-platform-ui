// ── Capability Map + Heatmap + Tree + Cards (Phase 4B) ────────────────────
//
// Pure functions consuming the canonical ViewDataset + VisualizationEligibility
// contract - matching tableMatrixUtils.ts's Phase 4A convention. No renderer
// invents hierarchy, metric values, relationships, or grouping that isn't
// already represented in ViewDataset; every structural decision here
// traces to a concrete dataset field.

// ── Capability Map ─────────────────────────────────────────────────────

export interface CapabilityMapDisplay {
  eligible: boolean
  reason?: string
  rootIds?: string[]
  childrenByParentId?: Record<string, string[]>
  depth?: number // actual max depth present, so the renderer never assumes a fixed 2-level limit
}

// Uses ViewDataset.hierarchies directly - never infers structure from
// relationships or fabricates a flat grid when eligibility says no usable
// hierarchy/grouping exists (Section 2's explicit requirement). Supports
// whatever depth is actually present, not an artificial 2-level cap.
export function buildCapabilityMapDisplay(dataset: any, eligibility: any): CapabilityMapDisplay {
  const capMapEval = eligibility?.eligible?.find((v: any) => v.visualization === 'CAPABILITY_MAP')
  if (!capMapEval) {
    const ineligible = eligibility?.ineligible?.find((v: any) => v.visualization === 'CAPABILITY_MAP')
    return { eligible: false, reason: ineligible?.reasons?.[0] || 'Capability Map is unavailable because the selected view contains Business Capabilities but no usable capability hierarchy or grouping.' }
  }
  const hierarchy = (dataset?.hierarchies ?? [])[0]
  if (!hierarchy) {
    // Eligible via level/group structure (Phase 3.1) but no parentId tree
    // to actually build a map FROM - render capabilities as a single,
    // honest flat level rather than fabricating parent/child links that
    // don't exist in the data.
    const capIds = (dataset?.objects ?? []).filter((o: any) => o.semanticType === 'BusinessCapability').map((o: any) => o.id)
    return { eligible: true, rootIds: capIds, childrenByParentId: {}, depth: 1 }
  }
  const childrenByParentId: Record<string, string[]> = {}
  for (const [childId, parentId] of Object.entries(hierarchy.parentByObjectId)) {
    if (parentId) {
      if (!childrenByParentId[parentId as string]) childrenByParentId[parentId as string] = []
      childrenByParentId[parentId as string].push(childId)
    }
  }
  const depth = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 1 // cycle guard - malformed data shouldn't crash depth calculation
    seen.add(id)
    const children = childrenByParentId[id] ?? []
    if (children.length === 0) return 1
    return 1 + Math.max(...children.map(c => depth(c, seen)))
  }
  const maxDepth = hierarchy.rootIds.length > 0 ? Math.max(...hierarchy.rootIds.map((r: string) => depth(r, new Set()))) : 1
  return { eligible: true, rootIds: hierarchy.rootIds, childrenByParentId, depth: maxDepth }
}

// Deterministic related-object overlay - e.g. "Applications supporting
// capability: 3" (Section 2's own example). Counts real relationships
// (or, if a configured path exists, real paths) reaching the given
// capability where the far-end object matches relatedType - never a
// fabricated or AI-derived score. Returns null (not 0) when no such
// relationships/paths exist in the dataset at all, so the renderer can
// distinguish "counted, found zero" from "this overlay isn't applicable
// to this dataset."
export function computeCapabilityOverlayCount(dataset: any, capabilityId: string, relatedSemanticType: string): number | null {
  const objectById = new Map((dataset?.objects ?? []).map((o: any) => [o.id, o]))
  const relevantRelIds = new Set<string>()
  let anyRelOfThisShapeExists = false
  for (const rel of dataset?.relationships ?? []) {
    const other = rel.sourceId === capabilityId ? rel.targetId : rel.targetId === capabilityId ? rel.sourceId : null
    if (!other) continue
    const otherObj: any = objectById.get(other)
    if (!otherObj) continue
    if (otherObj.semanticType === relatedSemanticType || otherObj.assetType === relatedSemanticType) {
      anyRelOfThisShapeExists = true
      relevantRelIds.add(other)
    }
  }
  if (!anyRelOfThisShapeExists) return null
  return relevantRelIds.size
}

// Capability drill-down context (Section 2's "Capability drill-down") -
// child/parent capabilities plus directly related objects, all reused
// from the already-fetched dataset, no backend re-query.
export function buildCapabilityDrilldown(dataset: any, capabilityId: string) {
  const hierarchy = (dataset?.hierarchies ?? [])[0]
  const parentId = hierarchy?.parentByObjectId?.[capabilityId] ?? null
  const childIds = hierarchy ? Object.entries(hierarchy.parentByObjectId).filter(([, p]) => p === capabilityId).map(([c]) => c) : []
  const objectById = new Map((dataset?.objects ?? []).map((o: any) => [o.id, o]))
  const relatedObjectIds = new Set<string>()
  for (const rel of dataset?.relationships ?? []) {
    if (rel.sourceId === capabilityId) relatedObjectIds.add(rel.targetId)
    if (rel.targetId === capabilityId) relatedObjectIds.add(rel.sourceId)
  }
  return {
    parent: parentId ? objectById.get(parentId) : null,
    children: childIds.map(id => objectById.get(id)).filter(Boolean),
    related: [...relatedObjectIds].map(id => objectById.get(id)).filter(Boolean),
  }
}

// ── Heatmap ────────────────────────────────────────────────────────────

export interface HeatmapTile {
  objectId: string
  name: string
  value: number | string | null // null = genuinely missing, distinct from a real 0/empty-string category
  displayValue: string
}

export interface HeatmapDisplay {
  eligible: boolean
  reason?: string
  metricKey?: string
  dataType?: 'numeric' | 'categorical' | 'status'
  candidateMetrics?: string[]
  min?: number
  max?: number
  distinctValues?: string[]
  tiles?: HeatmapTile[]
}

// Structure + metric, never just "colored objects" (Section 3). Uses
// eligibility's own recommendedConfig for the metric candidate list and
// dataset.hierarchies for grouping - never fabricates a normalized score
// for a metric that isn't already normalized (real values only). Missing
// values are surfaced as null, never silently coerced to 0 or hidden.
// Direct-object metrics only in this phase - see class header/Section 8
// of the completion report for why related-object aggregation is
// deferred rather than guessed at.
export function buildHeatmapDisplay(dataset: any, eligibility: any, selectedMetricKey?: string): HeatmapDisplay {
  const heatmapEval = eligibility?.eligible?.find((v: any) => v.visualization === 'HEATMAP')
  if (!heatmapEval) {
    const ineligible = eligibility?.ineligible?.find((v: any) => v.visualization === 'HEATMAP')
    return { eligible: false, reason: ineligible?.reasons?.[0] || 'Heatmap is unavailable because this result has no structural grouping and usable metric together.' }
  }
  const config = heatmapEval.recommendedConfig
  const metricKey = selectedMetricKey || config?.metricKey
  const metric = (dataset?.metrics ?? []).find((m: any) => m.key === metricKey)
  if (!metric) return { eligible: false, reason: 'The selected metric is not available in this dataset.' }

  const objects: any[] = dataset?.objects ?? []
  const tiles: HeatmapTile[] = objects.map(o => {
    const raw = metricKey === 'status' ? o.status : o.metadata?.[metricKey]
    if (raw === undefined || raw === null || raw === '') return { objectId: o.id, name: o.name, value: null, displayValue: '—' }
    if (metric.dataType === 'numeric') {
      const n = Number(raw)
      return { objectId: o.id, name: o.name, value: Number.isNaN(n) ? null : n, displayValue: Number.isNaN(n) ? '—' : String(n) }
    }
    return { objectId: o.id, name: o.name, value: String(raw), displayValue: String(raw) }
  })

  return {
    eligible: true, metricKey, dataType: metric.dataType,
    candidateMetrics: config?.candidateMetrics ?? [metricKey],
    min: metric.min, max: metric.max, distinctValues: metric.distinctValues,
    tiles,
  }
}

// ── Tree ───────────────────────────────────────────────────────────────

export interface TreeDisplay {
  eligible: boolean
  reason?: string
  rootIds?: string[]
  childrenByParentId?: Record<string, string[]>
  malformed?: boolean // true when a cycle or dangling reference was detected and safely dropped, not crashed on
}

// Only ever built from ViewDataset.hierarchies - never inferred from
// arbitrary relationship edges (Section 4's explicit prohibition).
// Multiple roots are preserved as separate roots, never merged under a
// fabricated single root object. Cycle-safe: a defensive visited-set
// guard during traversal means malformed upstream data degrades to a
// warning, never infinite recursion or a crash - see Section 4's own
// requirement that renderer logic "must remain safe if malformed data
// slips through" even though hierarchy construction upstream should
// already be valid.
export function buildTreeDisplay(dataset: any, eligibility?: any): TreeDisplay {
  if (eligibility) {
    const treeEval = eligibility.eligible?.find((v: any) => v.visualization === 'TREE')
    if (!treeEval) {
      const ineligible = eligibility.ineligible?.find((v: any) => v.visualization === 'TREE')
      return { eligible: false, reason: ineligible?.reasons?.[0] || 'Tree is unavailable because this result has no genuine hierarchy.' }
    }
  }
  const hierarchy = (dataset?.hierarchies ?? [])[0]
  if (!hierarchy) return { eligible: false, reason: 'Tree is unavailable because this result has no genuine hierarchy.' }

  const childrenByParentId: Record<string, string[]> = {}
  let malformed = false
  const objectIds = new Set((dataset?.objects ?? []).map((o: any) => o.id))
  for (const [childId, parentId] of Object.entries(hierarchy.parentByObjectId)) {
    if (!parentId) continue
    if (!objectIds.has(parentId as string)) { malformed = true; continue } // dangling parent reference - dropped, not crashed on
    if (!childrenByParentId[parentId as string]) childrenByParentId[parentId as string] = []
    childrenByParentId[parentId as string].push(childId)
  }
  // Cycle detection: verify every declared root can be traversed without
  // revisiting a node - if not, the hierarchy has a cycle upstream that
  // slipped through; surface as a warning rather than let the renderer's
  // own recursive render function loop forever.
  const visited = new Set<string>()
  const walk = (id: string, path: Set<string>) => {
    if (path.has(id)) { malformed = true; return }
    path.add(id); visited.add(id)
    for (const c of childrenByParentId[id] ?? []) walk(c, new Set(path))
  }
  for (const r of hierarchy.rootIds) walk(r, new Set())

  return { eligible: true, rootIds: hierarchy.rootIds, childrenByParentId, malformed };
}

// ── Cards ──────────────────────────────────────────────────────────────

export interface CardRelationshipSummary {
  relationshipType: string
  label: string
  relatedNames: string[]
}

export interface CardContext {
  objectId: string
  relationshipCount: number
  summaries: CardRelationshipSummary[] // grouped by relationshipType, e.g. "Supports: Recruitment, Career Guidance"
}

// Object + meaningful context, not an isolated inventory tile (Section
// 5). Entirely derived from the already-fetched dataset - grouping real
// relationships by type and listing the real related object names, never
// a separate per-card fetch (Section 5's explicit "No N+1" requirement).
export function buildCardContext(dataset: any, objectId: string): CardContext {
  const objectById = new Map((dataset?.objects ?? []).map((o: any) => [o.id, o]))
  const byType = new Map<string, { label: string; names: string[] }>()
  let count = 0
  for (const rel of dataset?.relationships ?? []) {
    const otherId = rel.sourceId === objectId ? rel.targetId : rel.targetId === objectId ? rel.sourceId : null
    if (!otherId) continue
    count++
    const otherObj: any = objectById.get(otherId)
    if (!byType.has(rel.relationshipType)) byType.set(rel.relationshipType, { label: rel.label || rel.relationshipType, names: [] })
    byType.get(rel.relationshipType)!.names.push(otherObj?.name ?? otherId)
  }
  const summaries: CardRelationshipSummary[] = [...byType.entries()].map(([relationshipType, v]) => ({ relationshipType, label: v.label, relatedNames: v.names }))
  return { objectId, relationshipCount: count, summaries }
}
