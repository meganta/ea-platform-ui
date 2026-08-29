import { buildChangeSummaryRows, buildRelationshipChangeRows, buildComparisonMatrix, applyComparisonFilters } from '../comparisonUtils'

describe('comparisonUtils', () => {
  const capA = { id: 'capA', name: 'Capability A', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
  const capB = { id: 'capB', name: 'Capability B', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
  const appXLeft = { id: 'appX', name: 'App X', semanticType: 'Application', domain: 'APPLICATION', metadata: { hostingModel: 'ON_PREM' } }
  const appXRight = { id: 'appX', name: 'App X', semanticType: 'Application', domain: 'APPLICATION', metadata: { hostingModel: 'CONTAINER' } }
  const appY = { id: 'appY', name: 'App Y', semanticType: 'Application', domain: 'APPLICATION' }
  const appZ = { id: 'appZ', name: 'App Z', semanticType: 'Application', domain: 'APPLICATION' }
  const techLegacy = { id: 'techLegacy', name: 'Tech Legacy', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }
  const techShared = { id: 'techShared', name: 'Tech Shared', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }
  const kubernetes = { id: 'kubernetes', name: 'Kubernetes', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }

  const relCapAX = { sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' }
  const relXLegacy = { sourceId: 'appX', targetId: 'techLegacy', relationshipType: 'hosted_on', label: 'hosted_on' }
  const relXK8s = { sourceId: 'appX', targetId: 'kubernetes', relationshipType: 'hosted_on', label: 'hosted_on' }
  const relCapBY = { sourceId: 'capB', targetId: 'appY', relationshipType: 'supported_by', label: 'supported_by' }
  const relCapBZ = { sourceId: 'capB', targetId: 'appZ', relationshipType: 'supported_by', label: 'supported_by' }

  const acceptanceComparison = {
    objects: {
      added: [{ id: 'appZ', changeType: 'ADDED', right: appZ }, { id: 'kubernetes', changeType: 'ADDED', right: kubernetes }],
      removed: [{ id: 'appY', changeType: 'REMOVED', left: appY }, { id: 'techLegacy', changeType: 'REMOVED', left: techLegacy }],
      modified: [{ id: 'appX', changeType: 'MODIFIED', left: appXLeft, right: appXRight, propertyChanges: [{ property: 'metadata.hostingModel', before: 'ON_PREM', after: 'CONTAINER' }] }],
      unchanged: [{ id: 'capA', changeType: 'UNCHANGED', left: capA, right: capA }, { id: 'capB', changeType: 'UNCHANGED', left: capB, right: capB }, { id: 'techShared', changeType: 'UNCHANGED', left: techShared, right: techShared }],
    },
    relationships: {
      added: [{ key: 'appX::kubernetes::hosted_on', changeType: 'ADDED', right: relXK8s }, { key: 'capB::appZ::supported_by', changeType: 'ADDED', right: relCapBZ }],
      removed: [{ key: 'appX::techLegacy::hosted_on', changeType: 'REMOVED', left: relXLegacy }, { key: 'capB::appY::supported_by', changeType: 'REMOVED', left: relCapBY }],
      unchanged: [{ key: 'capA::appX::supported_by', changeType: 'UNCHANGED', left: relCapAX, right: relCapAX }],
    },
    // The acceptance View is configured as Capability -> supported_by ->
    // Application -> hosted_on -> Technology (a real 2-hop path), so a
    // real comparison for this View always populates leftPaths/rightPaths
    // - this fixture reflects that rather than the artificial "no
    // configured path" case, which is tested separately below with its
    // own dedicated, unambiguous single-hop fixture.
    leftPaths: [
      { rootObjectId: 'capA', objectIds: ['capA', 'appX', 'techLegacy'], relationshipIds: [] },
      { rootObjectId: 'capB', objectIds: ['capB', 'appY', 'techShared'], relationshipIds: [] },
    ],
    rightPaths: [
      { rootObjectId: 'capA', objectIds: ['capA', 'appX', 'kubernetes'], relationshipIds: [] },
      { rootObjectId: 'capB', objectIds: ['capB', 'appZ', 'techShared'], relationshipIds: [] },
    ],
  }

  it('buildChangeSummaryRows includes App Z as ADDED, App Y as REMOVED, App X as MODIFIED with its property diff, and excludes UNCHANGED by default', () => {
    const rows = buildChangeSummaryRows(acceptanceComparison)
    expect(rows.find(r => r.id === 'appZ')?.changeType).toBe('ADDED')
    expect(rows.find(r => r.id === 'appY')?.changeType).toBe('REMOVED')
    const appXRow = rows.find(r => r.id === 'appX')
    expect(appXRow?.changeType).toBe('MODIFIED')
    expect(appXRow?.changedProperties).toEqual(['metadata.hostingModel'])
    expect(appXRow?.before).toContain('ON_PREM')
    expect(appXRow?.after).toContain('CONTAINER')
    expect(rows.find(r => r.id === 'capA')).toBeUndefined()
  })

  it('buildChangeSummaryRows includes UNCHANGED objects when explicitly requested', () => {
    const rows = buildChangeSummaryRows(acceptanceComparison, true)
    expect(rows.find(r => r.id === 'capA')?.changeType).toBe('UNCHANGED')
  })

  it('buildRelationshipChangeRows shows App X hosted_on Tech Legacy as REMOVED and App X hosted_on Kubernetes as ADDED', () => {
    const rows = buildRelationshipChangeRows(acceptanceComparison)
    const removed = rows.find(r => r.key === 'appX::techLegacy::hosted_on')
    expect(removed).toMatchObject({ source: 'App X', relationship: 'hosted_on', target: 'Tech Legacy', changeType: 'REMOVED' })
    const added = rows.find(r => r.key === 'appX::kubernetes::hosted_on')
    expect(added).toMatchObject({ source: 'App X', relationship: 'hosted_on', target: 'Kubernetes', changeType: 'ADDED' })
  })

  it('buildComparisonMatrix on the acceptance fixture (a real 2-hop configured path) correctly uses PATH mode, not DIRECT', () => {
    const result = buildComparisonMatrix(acceptanceComparison)
    expect(result.eligible).toBe(true)
    expect(result.relationMode).toBe('PATH')
    expect(result.rowType).toBe('BusinessCapability')
    expect(result.columnType).toBe('TechComponent')
    // Capability A -> Tech Legacy: 1 path in Current, 0 in Target (the path now goes to Kubernetes instead)
    expect(result.cells?.get('capA::techLegacy')).toEqual({ beforeCount: 1, afterCount: 0, delta: -1 })
    // Capability A -> Kubernetes: 0 paths in Current, 1 in Target (newly reachable)
    expect(result.cells?.get('capA::kubernetes')).toEqual({ beforeCount: 0, afterCount: 1, delta: 1 })
    // Capability B -> Tech Shared: 1 path on both sides (via a different App each time, but the same leaf) - unchanged count
    expect(result.cells?.get('capB::techShared')).toEqual({ beforeCount: 1, afterCount: 1, delta: 0 })
  })

  it('buildComparisonMatrix DIRECT mode (a View with no configured path): Capability x Application before/after/delta reflects the real relationship diff', () => {
    // A clean, unambiguous single-hop fixture - Capability -> Application
    // only, no configured path, so this genuinely exercises the DIRECT
    // fallback rather than accidentally exercising PATH mode.
    const capC = { id: 'capC', name: 'Capability C', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
    const appM = { id: 'appM', name: 'App M', semanticType: 'Application', domain: 'APPLICATION' }
    const appN = { id: 'appN', name: 'App N', semanticType: 'Application', domain: 'APPLICATION' }
    const relCapCM = { sourceId: 'capC', targetId: 'appM', relationshipType: 'supported_by', label: 'supported_by' }
    const relCapCN = { sourceId: 'capC', targetId: 'appN', relationshipType: 'supported_by', label: 'supported_by' }
    const comparison = {
      objects: { added: [{ id: 'appN', right: appN }], removed: [{ id: 'appM', left: appM }], modified: [], unchanged: [{ id: 'capC', left: capC, right: capC }] },
      relationships: { added: [{ key: 'capC::appN::supported_by', right: relCapCN }], removed: [{ key: 'capC::appM::supported_by', left: relCapCM }], unchanged: [] },
      leftPaths: [], rightPaths: [],
    }
    const result = buildComparisonMatrix(comparison)
    expect(result.eligible).toBe(true)
    expect(result.relationMode).toBe('DIRECT')
    expect(result.rowType).toBe('BusinessCapability')
    expect(result.columnType).toBe('Application')
    expect(result.cells?.get('capC::appM')).toEqual({ beforeCount: 1, afterCount: 0, delta: -1 })
    expect(result.cells?.get('capC::appN')).toEqual({ beforeCount: 0, afterCount: 1, delta: 1 })
  })


  it("buildComparisonMatrix PATH mode uses REAL path instances, matching Section 16's worked example exactly (3 paths -> 1 path, delta -2)", () => {
    const capX = { id: 'capX', name: 'Cap X', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
    const app1 = { id: 'app1', name: 'App 1', semanticType: 'Application', domain: 'APPLICATION' }
    const app2 = { id: 'app2', name: 'App 2', semanticType: 'Application', domain: 'APPLICATION' }
    const app3 = { id: 'app3', name: 'App 3', semanticType: 'Application', domain: 'APPLICATION' }
    const techX = { id: 'techX', name: 'Tech X', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }
    const comparison = {
      objects: { added: [], removed: [], modified: [], unchanged: [{ id: 'capX', left: capX, right: capX }, { id: 'app1', left: app1, right: app1 }, { id: 'app2', left: app2 }, { id: 'app3', left: app3 }, { id: 'techX', left: techX, right: techX }] },
      relationships: { added: [], removed: [], unchanged: [] },
      leftPaths: [
        { rootObjectId: 'capX', objectIds: ['capX', 'app1', 'techX'], relationshipIds: [] },
        { rootObjectId: 'capX', objectIds: ['capX', 'app2', 'techX'], relationshipIds: [] },
        { rootObjectId: 'capX', objectIds: ['capX', 'app3', 'techX'], relationshipIds: [] },
      ],
      rightPaths: [
        { rootObjectId: 'capX', objectIds: ['capX', 'app1', 'techX'], relationshipIds: [] },
      ],
    }
    const result = buildComparisonMatrix(comparison)
    expect(result.eligible).toBe(true)
    expect(result.relationMode).toBe('PATH')
    expect(result.cells?.get('capX::techX')).toEqual({ beforeCount: 3, afterCount: 1, delta: -2 })
  })

  it('buildComparisonMatrix PATH mode: a cell that gains paths shows a positive delta (0 -> 2)', () => {
    const capY = { id: 'capY', name: 'Cap Y', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
    const app1 = { id: 'app1', name: 'App 1', semanticType: 'Application', domain: 'APPLICATION' }
    const app2 = { id: 'app2', name: 'App 2', semanticType: 'Application', domain: 'APPLICATION' }
    const techY = { id: 'techY', name: 'Tech Y', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }
    const comparison = {
      objects: { added: [], removed: [], modified: [], unchanged: [{ id: 'capY', left: capY, right: capY }, { id: 'app1', right: app1 }, { id: 'app2', right: app2 }, { id: 'techY', left: techY, right: techY }] },
      relationships: { added: [], removed: [], unchanged: [] },
      leftPaths: [],
      rightPaths: [
        { rootObjectId: 'capY', objectIds: ['capY', 'app1', 'techY'], relationshipIds: [] },
        { rootObjectId: 'capY', objectIds: ['capY', 'app2', 'techY'], relationshipIds: [] },
      ],
    }
    const result = buildComparisonMatrix(comparison)
    expect(result.cells?.get('capY::techY')).toEqual({ beforeCount: 0, afterCount: 2, delta: 2 })
  })

  it('buildComparisonMatrix PATH mode never creates a synthetic direct relationship - the cell count comes strictly from real path instances, not relationship endpoint inference', () => {
    const capX = { id: 'capX', name: 'Cap X', semanticType: 'BusinessCapability', domain: 'BUSINESS' }
    const techX = { id: 'techX', name: 'Tech X', semanticType: 'TechComponent', domain: 'TECHNOLOGY' }
    const app1 = { id: 'app1', name: 'App 1', semanticType: 'Application', domain: 'APPLICATION' }
    const comparison = {
      objects: { added: [], removed: [], modified: [], unchanged: [{ id: 'capX', left: capX, right: capX }, { id: 'techX', left: techX, right: techX }, { id: 'app1', left: app1, right: app1 }] },
      relationships: { added: [{ key: 'a', right: { sourceId: 'capX', targetId: 'techX', relationshipType: 'unrelated' } }, { key: 'b', right: { sourceId: 'capX', targetId: 'techX', relationshipType: 'unrelated2' } }], removed: [], unchanged: [] },
      leftPaths: [{ rootObjectId: 'capX', objectIds: ['capX', 'app1', 'techX'], relationshipIds: [] }],
      rightPaths: [{ rootObjectId: 'capX', objectIds: ['capX', 'app1', 'techX'], relationshipIds: [] }],
    }
    const result = buildComparisonMatrix(comparison)
    expect(result.cells?.get('capX::techX')).toEqual({ beforeCount: 1, afterCount: 1, delta: 0 })
  })

  it('buildComparisonMatrix is ineligible with a clear reason when there is nothing to compare', () => {
    const empty = { objects: { added: [], removed: [], modified: [], unchanged: [] }, relationships: { added: [], removed: [], unchanged: [] }, leftPaths: [], rightPaths: [] }
    const result = buildComparisonMatrix(empty)
    expect(result.eligible).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('applyComparisonFilters by changeTypes narrows to just the requested change types', () => {
    const filtered = applyComparisonFilters(acceptanceComparison, { changeTypes: ['ADDED'] })
    expect(filtered.added.length).toBe(2)
    expect(filtered.removed).toEqual([])
    expect(filtered.modified).toEqual([])
    expect(filtered.unchanged).toEqual([])
  })

  it('applyComparisonFilters never mutates the underlying comparison object', () => {
    const before = JSON.stringify(acceptanceComparison)
    applyComparisonFilters(acceptanceComparison, { changeTypes: ['ADDED'] })
    expect(JSON.stringify(acceptanceComparison)).toBe(before)
  })

  it('an empty filters object returns everything, including UNCHANGED', () => {
    const filtered = applyComparisonFilters(acceptanceComparison, {})
    expect(filtered.unchanged.length).toBe(acceptanceComparison.objects.unchanged.length)
  })
})
