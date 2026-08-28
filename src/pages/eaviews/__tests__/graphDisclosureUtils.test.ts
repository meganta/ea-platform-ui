import { buildGraphIndexes, chooseFocusObject, computeInitialVisibleSet, expandNeighbors, expandNextPathHop, expandAllNextPathHops, collapseBranch, pruneDanglingRelationships, computePathHighlight, applyGraphFilters } from '../graphDisclosureUtils'

describe('graphDisclosureUtils', () => {
  // The exact Phase 4C acceptance fixture:
  //   Capability A -> supported_by -> App X -> hosted_on -> Tech 1
  //   Capability A -> supported_by -> App Y -> hosted_on -> Tech 2
  //   Capability B -> supported_by -> App Z -> hosted_on -> Tech 1
  const capA = { id: 'capA', name: 'Capability A', role: 'PRIMARY', assetType: 'GovCapability', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
  const capB = { id: 'capB', name: 'Capability B', role: 'PRIMARY', assetType: 'GovCapability', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
  const appX = { id: 'appX', name: 'App X', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION' }
  const appY = { id: 'appY', name: 'App Y', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION' }
  const appZ = { id: 'appZ', name: 'App Z', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION' }
  const tech1 = { id: 'tech1', name: 'Tech 1', role: 'RELATED', assetType: 'TechComponent', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }
  const tech2 = { id: 'tech2', name: 'Tech 2', role: 'RELATED', assetType: 'TechComponent', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }

  const relCapAX = { id: 'relCapAX', sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' }
  const relXTech1 = { id: 'relXTech1', sourceId: 'appX', targetId: 'tech1', relationshipType: 'hosted_on', label: 'hosted_on' }
  const relCapAY = { id: 'relCapAY', sourceId: 'capA', targetId: 'appY', relationshipType: 'supported_by', label: 'supported_by' }
  const relYTech2 = { id: 'relYTech2', sourceId: 'appY', targetId: 'tech2', relationshipType: 'hosted_on', label: 'hosted_on' }
  const relCapBZ = { id: 'relCapBZ', sourceId: 'capB', targetId: 'appZ', relationshipType: 'supported_by', label: 'supported_by' }
  const relZTech1 = { id: 'relZTech1', sourceId: 'appZ', targetId: 'tech1', relationshipType: 'hosted_on', label: 'hosted_on' }

  const acceptanceDataset = {
    objects: [capA, capB, appX, appY, appZ, tech1, tech2],
    relationships: [relCapAX, relXTech1, relCapAY, relYTech2, relCapBZ, relZTech1],
    paths: [
      { id: 'p1', rootObjectId: 'capA', objectIds: ['capA', 'appX', 'tech1'], relationshipIds: ['relCapAX', 'relXTech1'], hopCount: 2 },
      { id: 'p2', rootObjectId: 'capA', objectIds: ['capA', 'appY', 'tech2'], relationshipIds: ['relCapAY', 'relYTech2'], hopCount: 2 },
      { id: 'p3', rootObjectId: 'capB', objectIds: ['capB', 'appZ', 'tech1'], relationshipIds: ['relCapBZ', 'relZTech1'], hopCount: 2 },
    ],
  }

  const indexes = buildGraphIndexes(acceptanceDataset)

  // ── Initial Graph ──────────────────────────────────────────────────

  it('chooseFocusObject prioritizes an explicit selection, then falls back to the first PRIMARY object', () => {
    expect(chooseFocusObject(acceptanceDataset, 'capB')).toBe('capB')
    expect(chooseFocusObject(acceptanceDataset, null)).toBe('capA')
  })

  it('chooseFocusObject ignores a selectedObjectId not actually in the dataset', () => {
    expect(chooseFocusObject(acceptanceDataset, 'not-in-dataset')).toBe('capA')
  })

  it('computeInitialVisibleSet: focused on Capability A shows exactly Capability A, App X, App Y - never the full dataset', () => {
    const state = computeInitialVisibleSet(indexes, 'capA')
    expect(state.visibleObjectIds).toEqual(new Set(['capA', 'appX', 'appY']))
    expect(state.visibleRelationshipIds).toEqual(new Set(['relCapAX', 'relCapAY']))
    expect(state.visibleObjectIds.has('capB')).toBe(false)
    expect(state.visibleObjectIds.has('appZ')).toBe(false)
    expect(state.visibleObjectIds.has('tech1')).toBe(false)
  })

  // ── Progressive Disclosure ────────────────────────────────────────

  it('expandNeighbors adds only real, dataset-backed neighbors', () => {
    const initial = computeInitialVisibleSet(indexes, 'capA')
    const expanded = expandNeighbors(indexes, initial, 'appX', 'outgoing')
    expect(expanded.visibleObjectIds).toEqual(new Set(['capA', 'appX', 'appY', 'tech1']))
    expect(expanded.visibleRelationshipIds.has('relXTech1')).toBe(true)
  })

  it('expandAllNextPathHops advances every visible node along its real path(s), matching the acceptance fixture exactly', () => {
    const initial = computeInitialVisibleSet(indexes, 'capA')
    const expanded = expandAllNextPathHops(indexes, initial)
    expect(expanded.visibleObjectIds).toEqual(new Set(['capA', 'appX', 'appY', 'tech1', 'tech2']))
    expect(expanded.visibleRelationshipIds).toEqual(new Set(['relCapAX', 'relCapAY', 'relXTech1', 'relYTech2']))
    expect(expanded.visibleObjectIds.has('capB')).toBe(false)
    expect(expanded.visibleObjectIds.has('appZ')).toBe(false)
  })

  it('expandNextPathHop on a leaf object (no further hops) is a safe no-op', () => {
    const state = computeInitialVisibleSet(indexes, 'capA')
    const fullyExpanded = expandAllNextPathHops(indexes, state)
    const expanded = expandNextPathHop(indexes, fullyExpanded, 'tech1')
    expect(expanded.visibleObjectIds).toEqual(fullyExpanded.visibleObjectIds)
  })

  it("collapseBranch removes only the collapsed node's own descendants, leaving sibling branches intact", () => {
    const initial = computeInitialVisibleSet(indexes, 'capA')
    const expanded = expandAllNextPathHops(indexes, initial)
    const collapsed = collapseBranch(expanded, 'appX', 'capA')
    expect(collapsed.visibleObjectIds).toEqual(new Set(['capA', 'appY', 'tech2']))
    expect(collapsed.visibleObjectIds.has('tech1')).toBe(false)
    expect(collapsed.visibleObjectIds.has('appY')).toBe(true)
  })

  it('collapseBranch never removes the focus object itself', () => {
    const initial = computeInitialVisibleSet(indexes, 'capA')
    const collapsed = collapseBranch(initial, 'capA', 'capA')
    expect(collapsed.visibleObjectIds.has('capA')).toBe(true)
  })

  it('expanding a node whose neighbors are already visible does not duplicate them (Set semantics)', () => {
    const initial = computeInitialVisibleSet(indexes, 'capA')
    const expandedOnce = expandNeighbors(indexes, initial, 'capA', 'outgoing')
    expect(expandedOnce.visibleObjectIds.size).toBe(initial.visibleObjectIds.size)
  })

  it('pruneDanglingRelationships drops a relationship once either endpoint is no longer visible', () => {
    const expanded = expandAllNextPathHops(indexes, computeInitialVisibleSet(indexes, 'capA'))
    const collapsed = collapseBranch(expanded, 'appX', 'capA')
    const pruned = pruneDanglingRelationships(acceptanceDataset, collapsed.visibleObjectIds, collapsed.visibleRelationshipIds)
    expect(pruned.has('relCapAX')).toBe(false)
    expect(pruned.has('relXTech1')).toBe(false)
    expect(pruned.has('relCapAY')).toBe(true)
  })

  // ── Path ───────────────────────────────────────────────────────────

  it('computePathHighlight highlights exactly Capability A, App X, Tech 1 and their two edges - nothing else', () => {
    const highlight = computePathHighlight(acceptanceDataset, 'p1')
    expect(highlight?.objectIds).toEqual(new Set(['capA', 'appX', 'tech1']))
    expect(highlight?.relationshipIds).toEqual(new Set(['relCapAX', 'relXTech1']))
    expect(highlight?.objectIds.has('appY')).toBe(false)
    expect(highlight?.objectIds.has('capB')).toBe(false)
  })

  it('computePathHighlight returns null for a path id that does not exist', () => {
    expect(computePathHighlight(acceptanceDataset, 'not-a-real-path')).toBeNull()
  })

  // ── Filtering ──────────────────────────────────────────────────────

  it('applyGraphFilters by relationshipType keeps only matching edges and their still-connected objects', () => {
    const expanded = expandAllNextPathHops(indexes, computeInitialVisibleSet(indexes, 'capA'))
    const filtered = applyGraphFilters(acceptanceDataset, expanded.visibleObjectIds, expanded.visibleRelationshipIds, { relationshipTypes: ['supported_by'] })
    expect(filtered.relationshipIds).toEqual(new Set(['relCapAX', 'relCapAY']))
    expect(filtered.relationshipIds.has('relXTech1')).toBe(false)
  })

  it('applyGraphFilters by objectTypes/domains narrows the visible object set', () => {
    const expanded = expandAllNextPathHops(indexes, computeInitialVisibleSet(indexes, 'capA'))
    const filtered = applyGraphFilters(acceptanceDataset, expanded.visibleObjectIds, expanded.visibleRelationshipIds, { objectTypes: ['Application'] })
    expect(filtered.objectIds).toEqual(new Set(['appX', 'appY']))
  })

  it('applyGraphFilters never mutates the underlying dataset object', () => {
    const before = JSON.stringify(acceptanceDataset)
    applyGraphFilters(acceptanceDataset, new Set(['capA', 'appX']), new Set(['relCapAX']), { objectTypes: ['Application'] })
    expect(JSON.stringify(acceptanceDataset)).toBe(before)
  })

  it('an empty filters object restores the full previously-visible set (a "reset" is just calling with no filters)', () => {
    const expanded = expandAllNextPathHops(indexes, computeInitialVisibleSet(indexes, 'capA'))
    const reset = applyGraphFilters(acceptanceDataset, expanded.visibleObjectIds, expanded.visibleRelationshipIds, {})
    expect(reset.objectIds).toEqual(expanded.visibleObjectIds)
  })

  // ── Direction ──────────────────────────────────────────────────────

  it('expandNeighbors respects direction: incoming-only to Tech 1 reveals both App X and App Z (two paths converge there)', () => {
    const initial = computeInitialVisibleSet(indexes, 'capA')
    const outgoingOnly = expandNeighbors(indexes, initial, 'appX', 'outgoing')
    expect(outgoingOnly.visibleObjectIds.has('tech1')).toBe(true)
    const incomingOnly = expandNeighbors(indexes, computeInitialVisibleSet(indexes, 'tech1'), 'tech1', 'incoming')
    expect(incomingOnly.visibleObjectIds).toEqual(new Set(['tech1', 'appX', 'appZ']))
  })

  // ── Scenario isolation ─────────────────────────────────────────────

  it('a differently-scenario-resolved dataset (Target, with different relationships) produces a genuinely different graph via the same functions', () => {
    const targetDataset = { ...acceptanceDataset, relationships: [relCapAX, relXTech1] }
    const targetIndexes = buildGraphIndexes(targetDataset)
    const state = computeInitialVisibleSet(targetIndexes, 'capA')
    expect(state.visibleObjectIds).toEqual(new Set(['capA', 'appX']))
  })

  it("Capability B's branch never leaks into a graph focused on Capability A, even after full expansion", () => {
    const expanded = expandAllNextPathHops(indexes, computeInitialVisibleSet(indexes, 'capA'))
    expect(expanded.visibleObjectIds.has('capB')).toBe(false)
    expect(expanded.visibleObjectIds.has('appZ')).toBe(false)
  })
})
