// ── Graph Progressive Disclosure (Phase 4C) ───────────────────────────────
//
// Pure functions consuming ViewDataset directly - every expand/collapse/
// filter/highlight operation here is a pure, synchronous computation over
// the already-fetched dataset. No function in this file makes or implies
// a network call; that's the whole point of Phase 4C's "one /dataset
// fetch per view" requirement (Section 27).

export interface GraphIndexes {
  objectById: Map<string, any>
  outgoingBySource: Map<string, any[]> // relationships where this object is the source
  incomingByTarget: Map<string, any[]> // relationships where this object is the target
  pathsByObject: Map<string, any[]> // ViewDataset.paths this object participates in
}

// Pre-built once per dataset, reused across every interaction - avoids
// O(N) or worse re-scanning of relationships/paths on every expand/
// collapse/filter click (Section 27's explicit indexing guidance).
export function buildGraphIndexes(dataset: any): GraphIndexes {
  const objectById = new Map<string, any>((dataset?.objects ?? []).map((o: any) => [o.id, o]))
  const outgoingBySource = new Map<string, any[]>()
  const incomingByTarget = new Map<string, any[]>()
  for (const rel of dataset?.relationships ?? []) {
    if (!outgoingBySource.has(rel.sourceId)) outgoingBySource.set(rel.sourceId, [])
    outgoingBySource.get(rel.sourceId)!.push(rel)
    if (!incomingByTarget.has(rel.targetId)) incomingByTarget.set(rel.targetId, [])
    incomingByTarget.get(rel.targetId)!.push(rel)
  }
  const pathsByObject = new Map<string, any[]>()
  for (const path of dataset?.paths ?? []) {
    for (const oid of path.objectIds) {
      if (!pathsByObject.has(oid)) pathsByObject.set(oid, [])
      pathsByObject.get(oid)!.push(path)
    }
  }
  return { objectById, outgoingBySource, incomingByTarget, pathsByObject }
}

// Priority: explicitly selected object, if one exists and is a real
// dataset object; otherwise the first PRIMARY object; otherwise null
// (no meaningful focus - caller falls back to a bounded overview, not a
// full render). Matches Section 3's exact stated priority order.
export function chooseFocusObject(dataset: any, selectedObjectId?: string | null): string | null {
  const objects: any[] = dataset?.objects ?? []
  if (selectedObjectId && objects.some(o => o.id === selectedObjectId)) return selectedObjectId
  const primary = objects.find(o => o.role === 'PRIMARY')
  if (primary) return primary.id
  return objects[0]?.id ?? null
}

export interface VisibleGraphState {
  visibleObjectIds: Set<string>
  visibleRelationshipIds: Set<string>
  // reason each object became visible, for collapse-branch logic:
  // 'focus' | the id of the object whose expansion first revealed it
  revealedBy: Map<string, string>
}

// Initial bounded view: the focus object plus its direct (1-hop)
// neighbors in both directions - never the full dataset (Section 2's
// core requirement). "Direct neighbors" means a real relationship
// connects them, nothing inferred.
export function computeInitialVisibleSet(indexes: GraphIndexes, focusObjectId: string): VisibleGraphState {
  const visibleObjectIds = new Set<string>([focusObjectId])
  const visibleRelationshipIds = new Set<string>()
  const revealedBy = new Map<string, string>([[focusObjectId, 'focus']])
  for (const rel of indexes.outgoingBySource.get(focusObjectId) ?? []) {
    visibleObjectIds.add(rel.targetId); visibleRelationshipIds.add(rel.id)
    if (!revealedBy.has(rel.targetId)) revealedBy.set(rel.targetId, focusObjectId)
  }
  for (const rel of indexes.incomingByTarget.get(focusObjectId) ?? []) {
    visibleObjectIds.add(rel.sourceId); visibleRelationshipIds.add(rel.id)
    if (!revealedBy.has(rel.sourceId)) revealedBy.set(rel.sourceId, focusObjectId)
  }
  return { visibleObjectIds, visibleRelationshipIds, revealedBy }
}

export type ExpandDirection = 'both' | 'incoming' | 'outgoing'

// Reveals more of the ALREADY-FETCHED dataset around nodeId - never
// fetches anything, never fabricates a relationship that doesn't exist
// in dataset.relationships. Returns a NEW state (immutable), so React
// state updates stay simple. Objects already visible are not duplicated
// (Set semantics) and keep their original revealedBy entry.
export function expandNeighbors(indexes: GraphIndexes, state: VisibleGraphState, nodeId: string, direction: ExpandDirection = 'both'): VisibleGraphState {
  const visibleObjectIds = new Set(state.visibleObjectIds)
  const visibleRelationshipIds = new Set(state.visibleRelationshipIds)
  const revealedBy = new Map(state.revealedBy)
  const outgoing = direction === 'both' || direction === 'outgoing' ? (indexes.outgoingBySource.get(nodeId) ?? []) : []
  const incoming = direction === 'both' || direction === 'incoming' ? (indexes.incomingByTarget.get(nodeId) ?? []) : []
  for (const rel of outgoing) {
    visibleRelationshipIds.add(rel.id)
    if (!visibleObjectIds.has(rel.targetId)) { visibleObjectIds.add(rel.targetId); revealedBy.set(rel.targetId, nodeId) }
  }
  for (const rel of incoming) {
    visibleRelationshipIds.add(rel.id)
    if (!visibleObjectIds.has(rel.sourceId)) { visibleObjectIds.add(rel.sourceId); revealedBy.set(rel.sourceId, nodeId) }
  }
  return { visibleObjectIds, visibleRelationshipIds, revealedBy }
}

// Configured-path-aware expansion (Section 5): given a currently-visible
// object that participates in a real ViewDataset path, reveals the NEXT
// object in that path's own ordered objectIds - not a generic neighbor
// expansion. If the object appears in multiple real paths (branching,
// like the acceptance fixture's Capability A), all of their respective
// next hops are revealed - genuine alternatives, never guessed at.
export function expandNextPathHop(indexes: GraphIndexes, state: VisibleGraphState, nodeId: string): VisibleGraphState {
  const visibleObjectIds = new Set(state.visibleObjectIds)
  const visibleRelationshipIds = new Set(state.visibleRelationshipIds)
  const revealedBy = new Map(state.revealedBy)
  for (const path of indexes.pathsByObject.get(nodeId) ?? []) {
    const idx = path.objectIds.indexOf(nodeId)
    if (idx === -1 || idx >= path.objectIds.length - 1) continue // nodeId is the leaf of this path - nothing further to reveal
    const nextObjectId = path.objectIds[idx + 1]
    const relId = path.relationshipIds[idx] // the hop connecting objectIds[idx] -> objectIds[idx+1]
    if (relId) visibleRelationshipIds.add(relId)
    if (!visibleObjectIds.has(nextObjectId)) { visibleObjectIds.add(nextObjectId); revealedBy.set(nextObjectId, nodeId) }
  }
  return { visibleObjectIds, visibleRelationshipIds, revealedBy }
}

// Graph-level "expand next hop" (Section 5's own worked example): rather
// than advancing a single node, this advances EVERY currently-visible
// node one step further along whatever real paths it participates in -
// matching the spec's own single-action description ("After expand next
// hop: Capability A's two branches BOTH gain their next hop"), since
// calling the per-node version on the focus object alone would do
// nothing once its immediate neighbors are already visible.
export function expandAllNextPathHops(indexes: GraphIndexes, state: VisibleGraphState): VisibleGraphState {
  let next = state
  for (const id of [...state.visibleObjectIds]) next = expandNextPathHop(indexes, next, id)
  return next
}

// Removes nodeId's expanded branch - every object whose revealedBy chain
// traces back to nodeId and nowhere else (an object reachable through
// multiple expansion paths stays visible, since collapsing one branch
// shouldn't hide something still legitimately shown via another). The
// focus object itself can never be collapsed away.
export function collapseBranch(state: VisibleGraphState, nodeId: string, focusObjectId: string): VisibleGraphState {
  if (nodeId === focusObjectId) return state
  // Build reverse adjacency from revealedBy to find nodeId's full descendant set.
  const childrenOf = new Map<string, string[]>()
  for (const [child, parent] of state.revealedBy.entries()) {
    if (!childrenOf.has(parent)) childrenOf.set(parent, [])
    childrenOf.get(parent)!.push(child)
  }
  const toRemove = new Set<string>()
  const collect = (id: string) => {
    for (const child of childrenOf.get(id) ?? []) {
      if (!toRemove.has(child)) { toRemove.add(child); collect(child) }
    }
  }
  collect(nodeId)
  toRemove.add(nodeId)
  const visibleObjectIds = new Set([...state.visibleObjectIds].filter(id => !toRemove.has(id)))
  const revealedBy = new Map([...state.revealedBy].filter(([id]) => !toRemove.has(id)))
  // A relationship stays visible only if BOTH its endpoints are still visible.
  const visibleRelationshipIds = new Set(state.visibleRelationshipIds)
  return { visibleObjectIds, visibleRelationshipIds, revealedBy }
}

// Filters visibleRelationshipIds down to endpoints that are both still
// visible, for use right before rendering edges - collapseBranch itself
// doesn't prune relationships (kept simple/pure), this does it once at
// render/query time.
export function pruneDanglingRelationships(dataset: any, visibleObjectIds: Set<string>, visibleRelationshipIds: Set<string>): Set<string> {
  const relById = new Map<string, any>((dataset?.relationships ?? []).map((r: any) => [r.id, r]))
  return new Set([...visibleRelationshipIds].filter(id => {
    const rel: any = relById.get(id)
    return rel && visibleObjectIds.has(rel.sourceId) && visibleObjectIds.has(rel.targetId)
  }))
}

export interface PathHighlight { objectIds: Set<string>; relationshipIds: Set<string> }

// The highlight corresponds directly to one real ViewDataset.paths entry
// - never a synthetic/derived path (Section 6's explicit prohibition).
export function computePathHighlight(dataset: any, pathId: string): PathHighlight | null {
  const path = (dataset?.paths ?? []).find((p: any) => p.id === pathId)
  if (!path) return null
  return { objectIds: new Set(path.objectIds), relationshipIds: new Set(path.relationshipIds) }
}

export interface GraphFilters {
  relationshipTypes?: string[] // undefined/empty = show all
  objectTypes?: string[] // semanticType or assetType; undefined/empty = show all
  domains?: string[] // undefined/empty = show all
}

// Operates entirely on already-visible/already-fetched data - never
// mutates dataset itself (Section 15's explicit "filter does not mutate
// underlying dataset" test requirement satisfied by returning new Sets).
export function applyGraphFilters(dataset: any, visibleObjectIds: Set<string>, visibleRelationshipIds: Set<string>, filters: GraphFilters): { objectIds: Set<string>; relationshipIds: Set<string> } {
  const objectById = new Map<string, any>((dataset?.objects ?? []).map((o: any) => [o.id, o]))
  const relById = new Map<string, any>((dataset?.relationships ?? []).map((r: any) => [r.id, r]))
  const objectIds = new Set([...visibleObjectIds].filter(id => {
    const o: any = objectById.get(id)
    if (!o) return false
    if (filters.objectTypes?.length && !filters.objectTypes.includes(o.semanticType || o.assetType)) return false
    if (filters.domains?.length && !filters.domains.includes(o.domain)) return false
    return true
  }))
  const relationshipIds = new Set([...visibleRelationshipIds].filter(id => {
    const r: any = relById.get(id)
    if (!r) return false
    if (filters.relationshipTypes?.length && !filters.relationshipTypes.includes(r.relationshipType)) return false
    return objectIds.has(r.sourceId) && objectIds.has(r.targetId)
  }))
  return { objectIds, relationshipIds }
}
