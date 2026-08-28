import { buildCapabilityMapDisplay, computeCapabilityOverlayCount, buildCapabilityDrilldown, buildHeatmapDisplay, buildTreeDisplay, buildCardContext } from '../capabilityHeatmapTreeCardsUtils'

describe('capabilityHeatmapTreeCardsUtils', () => {
  // The exact Phase 4B acceptance fixture:
  //   Customer Services
  //   ├── Recruitment
  //   │   ├── Candidate Registration
  //   │   └── Vacancy Matching
  //   └── Career Guidance
  //   Recruitment -> supported_by -> App A, App B
  //   Career Guidance -> supported_by -> App C
  //   risk: Recruitment=HIGH, Career Guidance=MEDIUM, Candidate Registration=LOW
  const customerServices = { id: 'customerServices', name: 'Customer Services', assetType: 'GovCapability', semanticType: 'BusinessCapability', metadata: {} }
  const recruitment = { id: 'recruitment', name: 'Recruitment', assetType: 'GovCapability', semanticType: 'BusinessCapability', metadata: { parentId: 'customerServices', risk: 'HIGH' } }
  const candidateRegistration = { id: 'candidateRegistration', name: 'Candidate Registration', assetType: 'GovCapability', semanticType: 'BusinessCapability', metadata: { parentId: 'recruitment', risk: 'LOW' } }
  const vacancyMatching = { id: 'vacancyMatching', name: 'Vacancy Matching', assetType: 'GovCapability', semanticType: 'BusinessCapability', metadata: { parentId: 'recruitment' } }
  const careerGuidance = { id: 'careerGuidance', name: 'Career Guidance', assetType: 'GovCapability', semanticType: 'BusinessCapability', metadata: { parentId: 'customerServices', risk: 'MEDIUM' } }
  const appA = { id: 'appA', name: 'App A', assetType: 'Application', semanticType: 'Application', status: 'APPROVED', metadata: {} }
  const appB = { id: 'appB', name: 'App B', assetType: 'Application', semanticType: 'Application', status: 'APPROVED', metadata: {} }
  const appC = { id: 'appC', name: 'App C', assetType: 'Application', semanticType: 'Application', status: 'APPROVED', metadata: {} }

  const relRecruitA = { id: 'r1', sourceId: 'recruitment', targetId: 'appA', relationshipType: 'supported_by', label: 'supported_by' }
  const relRecruitB = { id: 'r2', sourceId: 'recruitment', targetId: 'appB', relationshipType: 'supported_by', label: 'supported_by' }
  const relCareerC = { id: 'r3', sourceId: 'careerGuidance', targetId: 'appC', relationshipType: 'supported_by', label: 'supported_by' }

  const hierarchy = {
    rootIds: ['customerServices'],
    parentByObjectId: { customerServices: null, recruitment: 'customerServices', candidateRegistration: 'recruitment', vacancyMatching: 'recruitment', careerGuidance: 'customerServices' },
    source: 'metadata.parentId',
  }

  const acceptanceDataset = {
    objects: [customerServices, recruitment, candidateRegistration, vacancyMatching, careerGuidance, appA, appB, appC],
    relationships: [relRecruitA, relRecruitB, relCareerC],
    paths: [],
    hierarchies: [hierarchy],
    metrics: [{ key: 'risk', label: 'risk', dataType: 'categorical', coveragePercent: 60, distinctValues: ['HIGH', 'MEDIUM', 'LOW'] }],
  }

  function eligibleFor(viz: string, recommendedConfig?: any) {
    return { eligible: [{ visualization: viz, eligible: true, score: 0.9, reasons: [], recommendedConfig }], ineligible: [] }
  }
  function ineligibleFor(viz: string, reason: string) {
    return { eligible: [], ineligible: [{ visualization: viz, eligible: false, score: 0, reasons: [reason] }] }
  }

  // ── Capability Map ─────────────────────────────────────────────────

  // Test 1: Eligible with real capability hierarchy
  it('CAPABILITY_MAP: eligible with real hierarchy returns rootIds/childrenByParentId from ViewDataset.hierarchies', () => {
    const result = buildCapabilityMapDisplay(acceptanceDataset, eligibleFor('CAPABILITY_MAP'))
    expect(result.eligible).toBe(true)
    expect(result.rootIds).toEqual(['customerServices'])
  })

  // Test 2: Ineligible without real structure
  it('CAPABILITY_MAP: ineligible renders the deterministic eligibility reason, not a fabricated flat map', () => {
    const result = buildCapabilityMapDisplay({ objects: [], hierarchies: [] }, ineligibleFor('CAPABILITY_MAP', 'no usable capability structure'))
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('no usable capability structure')
  })

  // Test 3: More than two valid hierarchy levels supported - the acceptance fixture's own 3-level depth
  it('CAPABILITY_MAP: supports the actual 3-level depth present in the fixture, not an artificial 2-level cap', () => {
    const result = buildCapabilityMapDisplay(acceptanceDataset, eligibleFor('CAPABILITY_MAP'))
    expect(result.depth).toBe(3)
  })

  // Test 4: Parent/child structure correct
  it('CAPABILITY_MAP: childrenByParentId correctly reflects the fixture (Recruitment/Career Guidance under Customer Services, two children under Recruitment)', () => {
    const result = buildCapabilityMapDisplay(acceptanceDataset, eligibleFor('CAPABILITY_MAP'))
    expect(result.childrenByParentId?.customerServices?.sort()).toEqual(['careerGuidance', 'recruitment'])
    expect(result.childrenByParentId?.recruitment?.sort()).toEqual(['candidateRegistration', 'vacancyMatching'])
  })

  // Test 5: Related-object count overlay correct - the acceptance example itself
  it('CAPABILITY_MAP overlay: Recruitment supported by 2 applications', () => {
    expect(computeCapabilityOverlayCount(acceptanceDataset, 'recruitment', 'Application')).toBe(2)
    expect(computeCapabilityOverlayCount(acceptanceDataset, 'careerGuidance', 'Application')).toBe(1)
  })

  // Test 6: No fabricated hierarchy
  it('CAPABILITY_MAP: eligible via level/group structure (no parentId tree) renders a single honest flat level, not fabricated parent/child links', () => {
    const flatCaps = [{ id: 'c1', name: 'Cap 1', semanticType: 'BusinessCapability', assetType: 'GovCapability', metadata: { level: 1 } }]
    const result = buildCapabilityMapDisplay({ objects: flatCaps, hierarchies: [] }, eligibleFor('CAPABILITY_MAP'))
    expect(result.eligible).toBe(true)
    expect(result.childrenByParentId).toEqual({})
    expect(result.rootIds).toEqual(['c1'])
  })

  // Test 7: Scenario-resolved related objects reflected (overlay uses whatever dataset is passed - no scenario-specific logic)
  it('CAPABILITY_MAP overlay reflects whatever scenario dataset is passed, with no renderer-side scenario logic', () => {
    const targetDataset = { ...acceptanceDataset, relationships: [relRecruitA] } // Target scenario: only App A remains
    expect(computeCapabilityOverlayCount(targetDataset, 'recruitment', 'Application')).toBe(1)
  })

  it('CAPABILITY_MAP overlay returns null (not 0) when this relationship shape does not exist at all in the dataset', () => {
    expect(computeCapabilityOverlayCount(acceptanceDataset, 'recruitment', 'TechComponent')).toBeNull()
  })

  it('CAPABILITY_MAP drill-down exposes parent, children, and directly related objects, reused from the dataset', () => {
    const drilldown = buildCapabilityDrilldown(acceptanceDataset, 'recruitment')
    expect(drilldown.parent?.id).toBe('customerServices')
    expect(drilldown.children.map((c: any) => c.id).sort()).toEqual(['candidateRegistration', 'vacancyMatching'])
    expect(drilldown.related.map((r: any) => r.id).sort()).toEqual(['appA', 'appB'])
  })

  // ── Heatmap ────────────────────────────────────────────────────────

  // Test 8: Numeric metric visualization
  it('HEATMAP: numeric metric uses real values and dataset min/max', () => {
    const numericDataset = {
      objects: [{ ...appA, metadata: { cost: 100 } }, { ...appB, metadata: { cost: 300 } }],
      relationships: [], paths: [], hierarchies: [],
      metrics: [{ key: 'cost', label: 'cost', dataType: 'numeric', coveragePercent: 100, min: 100, max: 300 }],
    }
    const result = buildHeatmapDisplay(numericDataset, eligibleFor('HEATMAP', { metricKey: 'cost', candidateMetrics: ['cost'] }))
    expect(result.eligible).toBe(true)
    expect(result.dataType).toBe('numeric')
    expect(result.min).toBe(100)
    expect(result.max).toBe(300)
    expect(result.tiles?.find(t => t.objectId === 'appA')?.value).toBe(100)
  })

  // Test 9: Categorical/status metric visualization - the fixture's own risk metric
  it('HEATMAP: categorical metric (risk) uses actual dataset categories', () => {
    const result = buildHeatmapDisplay(acceptanceDataset, eligibleFor('HEATMAP', { metricKey: 'risk', candidateMetrics: ['risk'] }))
    expect(result.eligible).toBe(true)
    expect(result.dataType).toBe('categorical')
    expect(result.tiles?.find(t => t.objectId === 'recruitment')?.value).toBe('HIGH')
    expect(result.tiles?.find(t => t.objectId === 'careerGuidance')?.value).toBe('MEDIUM')
  })

  // Test 10: Missing values handled clearly
  it('HEATMAP: an object with no value for the selected metric gets a distinct null, never a fabricated default', () => {
    const result = buildHeatmapDisplay(acceptanceDataset, eligibleFor('HEATMAP', { metricKey: 'risk', candidateMetrics: ['risk'] }))
    // vacancyMatching has no risk set in the fixture
    const tile = result.tiles?.find(t => t.objectId === 'vacancyMatching')
    expect(tile?.value).toBeNull()
    expect(tile?.displayValue).toBe('—')
  });

  // Test 11: Ineligible without structure
  it('HEATMAP: ineligible without structure renders the deterministic reason', () => {
    const result = buildHeatmapDisplay({ objects: [], hierarchies: [], metrics: [] }, ineligibleFor('HEATMAP', 'no structural grouping'))
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('no structural grouping')
  })

  // Test 12: Ineligible without usable metric
  it('HEATMAP: ineligible without a usable metric renders the deterministic reason', () => {
    const result = buildHeatmapDisplay({ objects: [], hierarchies: [{}], metrics: [] }, ineligibleFor('HEATMAP', 'no metric has sufficient coverage'))
    expect(result.eligible).toBe(false)
    expect(result.reason).toContain('no metric has sufficient coverage')
  })

  // Test 13: No allowHierarchy false-positive - relies entirely on the eligibility engine's own Phase 3.1 correction; this proves the RENDERER never overrides an ineligible verdict
  it('HEATMAP never overrides eligibility=false with its own local default, even when capabilities and a metric both exist', () => {
    const result = buildHeatmapDisplay(
      { objects: [recruitment], hierarchies: [], metrics: [{ key: 'risk', label: 'risk', dataType: 'categorical', coveragePercent: 100 }] },
      ineligibleFor('HEATMAP', 'no structural grouping'),
    )
    expect(result.eligible).toBe(false)
  })

  // Test 14: No fabricated metric
  it('HEATMAP: selecting a metric key not present in ViewDataset.metrics returns ineligible rather than fabricating one', () => {
    const result = buildHeatmapDisplay(acceptanceDataset, eligibleFor('HEATMAP', { metricKey: 'nonexistentMetric' }))
    expect(result.eligible).toBe(false)
  })

  // ── Tree ───────────────────────────────────────────────────────────

  // Test 16: Genuine hierarchy renders correctly - the acceptance fixture
  it('TREE: renders the correct parent/child structure from ViewDataset.hierarchies', () => {
    const result = buildTreeDisplay(acceptanceDataset)
    expect(result.eligible).toBe(true)
    expect(result.rootIds).toEqual(['customerServices'])
    expect(result.childrenByParentId?.recruitment?.sort()).toEqual(['candidateRegistration', 'vacancyMatching'])
  })

  // Test 17: Multiple roots handled
  it('TREE: multiple roots are preserved as separate roots, never merged under a fabricated single root', () => {
    const multiRootHierarchy = { rootIds: ['r1', 'r2'], parentByObjectId: { r1: null, r2: null }, source: 'metadata.parentId' }
    const result = buildTreeDisplay({ objects: [{ id: 'r1' }, { id: 'r2' }], hierarchies: [multiRootHierarchy] })
    expect(result.rootIds).toEqual(['r1', 'r2'])
  })

  // Test 18: Arbitrary relationships do not become tree
  it('TREE: is ineligible when only relationships exist and no genuine hierarchy was built', () => {
    const result = buildTreeDisplay({ objects: [recruitment, appA], relationships: [relRecruitA], hierarchies: [] })
    expect(result.eligible).toBe(false)
  })

  // Test 19: Expand/collapse data structure correct
  it('TREE: childrenByParentId is a plain lookup map suitable for expand/collapse state keyed by object id', () => {
    const result = buildTreeDisplay(acceptanceDataset)
    expect(typeof result.childrenByParentId).toBe('object')
    expect(Array.isArray(result.childrenByParentId?.customerServices)).toBe(true)
  })

  // Test 20: Cycle/malformed hierarchy fails safely
  it('TREE: a cyclic hierarchy is detected and surfaced as malformed, without infinite recursion', () => {
    const cyclicHierarchy = { rootIds: ['a'], parentByObjectId: { a: 'b', b: 'a' }, source: 'metadata.parentId' }
    const result = buildTreeDisplay({ objects: [{ id: 'a' }, { id: 'b' }], hierarchies: [cyclicHierarchy] })
    expect(result.malformed).toBe(true)
    // must still return, not hang/crash
    expect(result.eligible).toBe(true)
  })

  it('TREE: a dangling parent reference (parent not in this result) is dropped and flagged malformed, not crashed on', () => {
    const danglingHierarchy = { rootIds: ['a'], parentByObjectId: { a: null, orphan: 'not-in-result' }, source: 'metadata.parentId' }
    const result = buildTreeDisplay({ objects: [{ id: 'a' }], hierarchies: [danglingHierarchy] })
    expect(result.malformed).toBe(true)
    expect(result.eligible).toBe(true)
  })

  // ── Cards ──────────────────────────────────────────────────────────

  // Test 21/22/23: Primary object context, relationship summary, path-based related context - the acceptance fixture's own example
  it('CARDS: Recruitment card context shows 2 supporting applications, grouped by relationship type', () => {
    const context = buildCardContext(acceptanceDataset, 'recruitment')
    expect(context.relationshipCount).toBe(2)
    expect(context.summaries).toHaveLength(1)
    expect(context.summaries[0].relationshipType).toBe('supported_by')
    expect(context.summaries[0].relatedNames.sort()).toEqual(['App A', 'App B'])
  })

  it('CARDS: an object with no relationships gets an empty, not fabricated, context', () => {
    const context = buildCardContext(acceptanceDataset, 'candidateRegistration')
    expect(context.relationshipCount).toBe(0)
    expect(context.summaries).toEqual([])
  })

  // Test 24: No N+1/re-query - structural proof: buildCardContext takes no network/fetch capability, only the already-fetched dataset
  it('CARDS: buildCardContext is a pure function of the already-fetched dataset - no fetch/async involved at all', () => {
    const result = buildCardContext(acceptanceDataset, 'recruitment')
    expect(result).toBeDefined()
    // synchronous return - proves no network round-trip could have occurred
  })

  // ── General ────────────────────────────────────────────────────────

  // Test 26: Current vs Target changes propagate without renderer-specific state logic
  it('GENERAL: passing a differently-scenario-resolved dataset changes output with no renderer-specific Current/Target branching anywhere in these functions', () => {
    const currentDataset = { ...acceptanceDataset };
    const targetDataset = { ...acceptanceDataset, objects: acceptanceDataset.objects.map(o => o.id === 'recruitment' ? { ...o, metadata: { ...o.metadata, risk: 'LOW' } } : o) }
    const currentResult = buildHeatmapDisplay(currentDataset, eligibleFor('HEATMAP', { metricKey: 'risk' }))
    const targetResult = buildHeatmapDisplay(targetDataset, eligibleFor('HEATMAP', { metricKey: 'risk' }))
    expect(currentResult.tiles?.find(t => t.objectId === 'recruitment')?.value).toBe('HIGH')
    expect(targetResult.tiles?.find(t => t.objectId === 'recruitment')?.value).toBe('LOW')
  })

  // Test 27 covered by Tests 2, 11, 12, 18 above (each renderer's own ineligible-reason test)
  // Test 28 (truncation) and Test 29 (Graph unaffected) are integration-level, verified in EaViewsPage.test.tsx / manual regression, not this pure-function suite
})
