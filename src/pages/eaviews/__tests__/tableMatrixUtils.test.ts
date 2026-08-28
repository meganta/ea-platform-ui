import { determineTableMode, buildRelationshipTable, buildMatrix } from '../tableMatrixUtils'

describe('tableMatrixUtils', () => {
  // The exact Phase 4A acceptance example:
  //   Capability A -> App 1 -> Tech X
  //   Capability A -> App 2 -> Tech X
  //   Capability B -> App 3 -> Tech Y
  const capA = { id: 'capA', name: 'Capability A', assetType: 'GovCapability', semanticType: 'BusinessCapability' }
  const capB = { id: 'capB', name: 'Capability B', assetType: 'GovCapability', semanticType: 'BusinessCapability' }
  const app1 = { id: 'app1', name: 'App 1', assetType: 'Application', semanticType: 'Application' }
  const app2 = { id: 'app2', name: 'App 2', assetType: 'Application', semanticType: 'Application' }
  const app3 = { id: 'app3', name: 'App 3', assetType: 'Application', semanticType: 'Application' }
  const techX = { id: 'techX', name: 'Tech X', assetType: 'TechComponent', semanticType: 'TechComponent' }
  const techY = { id: 'techY', name: 'Tech Y', assetType: 'TechComponent', semanticType: 'TechComponent' }

  const relA1 = { id: 'relA1', sourceId: 'capA', targetId: 'app1', relationshipType: 'supported_by', label: 'supported_by' }
  const rel1X = { id: 'rel1X', sourceId: 'app1', targetId: 'techX', relationshipType: 'hosted_on', label: 'hosted_on' }
  const relA2 = { id: 'relA2', sourceId: 'capA', targetId: 'app2', relationshipType: 'supported_by', label: 'supported_by' }
  const rel2X = { id: 'rel2X', sourceId: 'app2', targetId: 'techX', relationshipType: 'hosted_on', label: 'hosted_on' }
  const relB3 = { id: 'relB3', sourceId: 'capB', targetId: 'app3', relationshipType: 'supported_by', label: 'supported_by' }
  const rel3Y = { id: 'rel3Y', sourceId: 'app3', targetId: 'techY', relationshipType: 'hosted_on', label: 'hosted_on' }

  const acceptanceDataset = {
    objects: [capA, capB, app1, app2, app3, techX, techY],
    relationships: [relA1, rel1X, relA2, rel2X, relB3, rel3Y],
    paths: [
      { id: 'p1', rootObjectId: 'capA', objectIds: ['capA', 'app1', 'techX'], relationshipIds: ['relA1', 'rel1X'], hopCount: 2 },
      { id: 'p2', rootObjectId: 'capA', objectIds: ['capA', 'app2', 'techX'], relationshipIds: ['relA2', 'rel2X'], hopCount: 2 },
      { id: 'p3', rootObjectId: 'capB', objectIds: ['capB', 'app3', 'techY'], relationshipIds: ['relB3', 'rel3Y'], hopCount: 2 },
    ],
  }

  // ── Table ──────────────────────────────────────────────────────────

  // Test 1: Single-object view -> inventory table
  it('determineTableMode falls back to inventory for a plain object collection with no relationships/paths', () => {
    const dataset = { objects: [capA, capB], relationships: [], paths: [] }
    expect(determineTableMode(dataset)).toBe('inventory')
  })

  // Test 2: Single-hop relationship -> relationship-aware row
  it('determineTableMode is relationship-aware for a single-hop relationship, even with no configured path', () => {
    const dataset = { objects: [capA, app1], relationships: [relA1], paths: [] }
    expect(determineTableMode(dataset)).toBe('relationship')
    const table = buildRelationshipTable(dataset)
    expect(table.rows).toHaveLength(1)
    expect(table.rows[0].values.map(v => v.name)).toEqual(['Capability A', 'App 1'])
  });

  // Test 3: Multi-hop path -> ordered path columns
  it('produces columns in path order (Capability, Application, Technology) for a configured multi-hop path', () => {
    expect(determineTableMode(acceptanceDataset)).toBe('relationship')
    const table = buildRelationshipTable(acceptanceDataset)
    expect(table.columns).toEqual(['BusinessCapability', 'Application', 'TechComponent'])
    expect(table.relationLabels).toEqual(['supported_by', 'hosted_on'])
  })

  // Test 4/19: Multiple real paths -> multiple correlated rows (the exact acceptance example)
  it('the acceptance example produces exactly 3 architecture-path rows, correctly correlated', () => {
    const table = buildRelationshipTable(acceptanceDataset)
    expect(table.rows).toHaveLength(3)
    const rowNames = table.rows.map(r => r.values.map(v => v.name))
    expect(rowNames).toContainEqual(['Capability A', 'App 1', 'Tech X'])
    expect(rowNames).toContainEqual(['Capability A', 'App 2', 'Tech X'])
    expect(rowNames).toContainEqual(['Capability B', 'App 3', 'Tech Y'])
  })

  // Test 5: No Cartesian-product corruption
  it('never produces a row implying a combination that was not actually walked (e.g. Capability A with App 3)', () => {
    const table = buildRelationshipTable(acceptanceDataset)
    const rowNames = table.rows.map(r => r.values.map(v => v.name))
    expect(rowNames).not.toContainEqual(['Capability A', 'App 3', 'Tech Y']) // App 3 only ever appears under Capability B
    expect(rowNames).not.toContainEqual(['Capability B', 'App 1', 'Tech X']) // App 1 only ever appears under Capability A
    expect(table.rows).toHaveLength(3) // 2 capabilities x up to 3 apps x 2 techs would be a Cartesian product - this must not happen
  })

  // Test 6: Current vs Target uses different dataset content
  it('renders whatever dataset content is provided, without needing to know how Current/Target was resolved', () => {
    const currentDataset = { objects: [capA, app1], relationships: [relA1], paths: [{ id: 'p1', rootObjectId: 'capA', objectIds: ['capA', 'app1'], relationshipIds: ['relA1'], hopCount: 1 }] }
    const targetDataset = { objects: [capA, app2], relationships: [relA2], paths: [{ id: 'p2', rootObjectId: 'capA', objectIds: ['capA', 'app2'], relationshipIds: ['relA2'], hopCount: 1 }] }
    const currentTable = buildRelationshipTable(currentDataset)
    const targetTable = buildRelationshipTable(targetDataset)
    expect(currentTable.rows[0].values[1].name).toBe('App 1')
    expect(targetTable.rows[0].values[1].name).toBe('App 2')
  })

  // Test 7: Property override appears where configured/displayed
  it('object names reflect whatever the dataset already carries (including scenario-resolved values) - no independent lookup', () => {
    const overriddenApp = { ...app1, name: 'App 1 (Cloud)' } // simulating an already scenario-resolved property override upstream
    const dataset = { objects: [capA, overriddenApp], relationships: [relA1], paths: [{ id: 'p1', rootObjectId: 'capA', objectIds: ['capA', 'app1'], relationshipIds: ['relA1'], hopCount: 1 }] }
    const table = buildRelationshipTable(dataset)
    expect(table.rows[0].values[1].name).toBe('App 1 (Cloud)')
  })

  // ── Matrix DIRECT ──────────────────────────────────────────────────

  function directEligibility(rowType: string, columnType: string, relationshipTypes: string[]) {
    return { eligible: [{ visualization: 'MATRIX', eligible: true, score: 0.95, reasons: [], recommendedConfig: { rowType, columnType, relationMode: 'DIRECT', relationshipTypes } }], ineligible: [] }
  }

  // Test 9: Correct semantic row/column axes
  it('MATRIX DIRECT uses exactly the rowType/columnType from recommendedConfig, not independently invented axes', () => {
    const dataset = { objects: [capA, capB, app1, app3], relationships: [relA1, relB3] }
    const result = buildMatrix(dataset, directEligibility('BusinessCapability', 'Application', ['supported_by']))
    expect(result.rows?.map((r: any) => r.id).sort()).toEqual(['capA', 'capB'])
    expect(result.columns?.map((c: any) => c.id).sort()).toEqual(['app1', 'app3'])
  })

  // Test 10: Only configured relevant relationships populate cells
  it('MATRIX DIRECT only populates cells for the recommended relationshipTypes, ignoring other relationship types between the same objects', () => {
    const unrelatedRel = { id: 'unrelated', sourceId: 'capA', targetId: 'app1', relationshipType: 'mentions' }
    const dataset = { objects: [capA, app1], relationships: [unrelatedRel] } // only an unrelated type exists
    const result = buildMatrix(dataset, directEligibility('BusinessCapability', 'Application', ['supported_by']))
    expect(result.cells?.size).toBe(0)
  })

  // Test 11: Empty unrelated cell stays empty
  it('MATRIX DIRECT: a row/column pair with no matching relationship has no cell entry at all', () => {
    const dataset = { objects: [capA, capB, app1], relationships: [relA1] } // capB has no relationship to app1
    const result = buildMatrix(dataset, directEligibility('BusinessCapability', 'Application', ['supported_by']))
    expect(result.cells?.has('capB::app1')).toBe(false)
    expect(result.cells?.get('capA::app1')?.count).toBe(1)
  })

  // Test 12: Multiple relationships/count handling
  it('MATRIX DIRECT counts multiple relationships of the configured type between the same row/column correctly', () => {
    const relA1b = { id: 'relA1b', sourceId: 'capA', targetId: 'app1', relationshipType: 'supported_by' } // a second, distinct edge between the same pair
    const dataset = { objects: [capA, app1], relationships: [relA1, relA1b] }
    const result = buildMatrix(dataset, directEligibility('BusinessCapability', 'Application', ['supported_by']))
    expect(result.cells?.get('capA::app1')?.count).toBe(2)
  })

  // Test 13: Cell drill-down identifies real relationship
  it('MATRIX DIRECT cell drill-down items are the actual relationship objects, not synthesized', () => {
    const dataset = { objects: [capA, app1], relationships: [relA1] }
    const result = buildMatrix(dataset, directEligibility('BusinessCapability', 'Application', ['supported_by']))
    expect(result.cells?.get('capA::app1')?.items).toEqual([relA1])
  })

  // ── Matrix PATH ────────────────────────────────────────────────────

  function pathEligibility(rowType: string, columnType: string, path: any[]) {
    return { eligible: [{ visualization: 'MATRIX', eligible: true, score: 0.85, reasons: [], recommendedConfig: { rowType, columnType, relationMode: 'PATH', path } }], ineligible: [] }
  }
  const capTechPath = [{ from: 'BusinessCapability', relationship: 'supported_by', to: 'Application' }, { from: 'Application', relationship: 'hosted_on', to: 'TechComponent' }]

  // Test 14: Correct semantic axes
  it('MATRIX PATH uses rowType/columnType from recommendedConfig (Capability x Technology, not Capability x Application)', () => {
    const result = buildMatrix(acceptanceDataset, pathEligibility('BusinessCapability', 'TechComponent', capTechPath))
    expect(result.rows?.map((r: any) => r.id).sort()).toEqual(['capA', 'capB'])
    expect(result.columns?.map((c: any) => c.id).sort()).toEqual(['techX', 'techY'])
  })

  // Test 15/16: Populated cell only when actual configured path exists; multiple paths produce correct count - the exact acceptance example
  it('MATRIX PATH: the acceptance example produces exactly A x X = 2 paths, B x Y = 1 path, others empty', () => {
    const result = buildMatrix(acceptanceDataset, pathEligibility('BusinessCapability', 'TechComponent', capTechPath))
    expect(result.cells?.get('capA::techX')?.count).toBe(2)
    expect(result.cells?.get('capB::techY')?.count).toBe(1)
    expect(result.cells?.has('capA::techY')).toBe(false)
    expect(result.cells?.has('capB::techX')).toBe(false)
  })

  // Test 17: No synthetic direct relationship is created
  it('MATRIX PATH never creates or implies a direct Capability->Technology relationship - only the path count', () => {
    const result = buildMatrix(acceptanceDataset, pathEligibility('BusinessCapability', 'TechComponent', capTechPath))
    expect(result.relationMode).toBe('PATH')
    // the underlying dataset itself has no direct capX->techY relationship at all
    expect(acceptanceDataset.relationships.some((r: any) => r.sourceId === 'capA' && r.targetId === 'techX')).toBe(false)
    expect(result.cells?.get('capA::techX')?.items[0]).toHaveProperty('objectIds') // drill-down items are paths, not a fabricated relationship
  })

  // Test 18: Drill-down returns real path(s)
  it('MATRIX PATH cell drill-down returns the actual underlying paths (Capability A -> App1 -> TechX and -> App2 -> TechX)', () => {
    const result = buildMatrix(acceptanceDataset, pathEligibility('BusinessCapability', 'TechComponent', capTechPath))
    const items = result.cells?.get('capA::techX')?.items ?? []
    expect(items.map((p: any) => p.id).sort()).toEqual(['p1', 'p2'])
    expect(items.map((p: any) => p.objectIds)).toContainEqual(['capA', 'app1', 'techX'])
    expect(items.map((p: any) => p.objectIds)).toContainEqual(['capA', 'app2', 'techX'])
  })

  // Test 19: DIRECT/PATH visual semantics differ appropriately (structural check - pathSteps only present for PATH)
  it('pathSteps is present for PATH mode and absent for DIRECT mode, giving the UI a clear signal for the subtitle/badge', () => {
    const directResult = buildMatrix(acceptanceDataset, directEligibility('BusinessCapability', 'Application', ['supported_by']))
    const pathResult = buildMatrix(acceptanceDataset, pathEligibility('BusinessCapability', 'TechComponent', capTechPath))
    expect(directResult.pathSteps).toBeUndefined()
    expect(pathResult.pathSteps).toEqual(capTechPath)
  })

  // ── General ────────────────────────────────────────────────────────

  // Test 20/21: Matrix ineligibility reason, no arbitrary fallback axes
  it('when Matrix is not eligible, returns the deterministic reason rather than falling back to arbitrary axes', () => {
    const eligibility = { eligible: [], ineligible: [{ visualization: 'MATRIX', eligible: false, score: 0, reasons: ['No two-axis relationship found - this result has no genuine row/column pair to build a matrix from.'] }] }
    const result = buildMatrix({ objects: [capA], relationships: [] }, eligibility)
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('No two-axis relationship found')
    expect(result.rows).toBeUndefined()
    expect(result.columns).toBeUndefined()
  })
})
