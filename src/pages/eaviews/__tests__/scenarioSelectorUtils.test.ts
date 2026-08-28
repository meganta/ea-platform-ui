import { buildScenarioLineageTree, getScenarioLineagePath, chooseVisualizationAfterScenarioSwitch, isLatestScenarioRequest } from '../scenarioSelectorUtils'

describe('scenarioSelectorUtils', () => {
  // The exact Phase 5A acceptance fixture lineage:
  //   Current -> Transition 2027 -> Target A
  //                               -> Target B
  const current = { id: 'current', name: 'Current Architecture', type: 'CURRENT', status: 'APPROVED', horizonDate: null, sequence: null, parentScenarioId: null }
  const transition = { id: 'transition', name: 'Transition 2027', type: 'TRANSITION', status: 'APPROVED', horizonDate: '2027-06-01', sequence: 1, parentScenarioId: 'current' }
  const targetA = { id: 'targetA', name: 'Target 2028 — Option A', type: 'TARGET', status: 'APPROVED', horizonDate: '2028-01-01', sequence: 2, parentScenarioId: 'transition' }
  const targetB = { id: 'targetB', name: 'Target 2028 — Option B', type: 'TARGET', status: 'DRAFT', horizonDate: '2028-01-01', sequence: 2, parentScenarioId: 'transition' }
  const scenarios = [current, transition, targetA, targetB]

  it('buildScenarioLineageTree: Current is the only root, Transition its only child, Target A/B siblings under Transition', () => {
    const tree = buildScenarioLineageTree(scenarios)
    expect(tree.rootIds).toEqual(['current'])
    expect(tree.childrenByParentId.current).toEqual(['transition'])
    expect(tree.childrenByParentId.transition.sort()).toEqual(['targetA', 'targetB'])
  })

  it("Target A and Target B are never presented as a chain - neither appears as the other's child", () => {
    const tree = buildScenarioLineageTree(scenarios)
    expect(tree.childrenByParentId.targetA).toBeUndefined()
    expect(tree.childrenByParentId.targetB).toBeUndefined()
  })

  it('getScenarioLineagePath: Target A resolves to exactly Current -> Transition 2027 -> Target A, in order', () => {
    const path = getScenarioLineagePath(scenarios, 'targetA')
    expect(path.map(s => s.id)).toEqual(['current', 'transition', 'targetA'])
  })

  it('getScenarioLineagePath: Target B resolves to its own distinct path, sharing the common ancestor but not Target A', () => {
    const path = getScenarioLineagePath(scenarios, 'targetB')
    expect(path.map(s => s.id)).toEqual(['current', 'transition', 'targetB'])
    expect(path.map(s => s.id)).not.toContain('targetA')
  })

  it('getScenarioLineagePath: Current alone has a path of just itself', () => {
    const path = getScenarioLineagePath(scenarios, 'current')
    expect(path.map(s => s.id)).toEqual(['current'])
  })

  it('getScenarioLineagePath is cycle-safe and does not loop forever on malformed data', () => {
    const cyclic = [{ id: 'a', parentScenarioId: 'b' }, { id: 'b', parentScenarioId: 'a' }]
    const path = getScenarioLineagePath(cyclic, 'a')
    expect(path.length).toBeLessThanOrEqual(2)
  })

  it('chooseVisualizationAfterScenarioSwitch retains the current visualization when it remains eligible', () => {
    const eligibility = { eligible: [{ visualization: 'TABLE', score: 0.8 }, { visualization: 'CAPABILITY_MAP', score: 0.6 }] }
    const result = chooseVisualizationAfterScenarioSwitch(eligibility, 'TABLE')
    expect(result).toEqual({ vizMode: 'TABLE', changed: false })
  })

  it('chooseVisualizationAfterScenarioSwitch auto-selects the top-ranked eligible visualization when the current one is no longer eligible', () => {
    const eligibility = { eligible: [{ visualization: 'TABLE', score: 0.8 }, { visualization: 'CARDS', score: 0.5 }] }
    const result = chooseVisualizationAfterScenarioSwitch(eligibility, 'CAPABILITY_MAP')
    expect(result).toEqual({ vizMode: 'TABLE', changed: true })
  })

  it('chooseVisualizationAfterScenarioSwitch returns null (not a fabricated default) when nothing is eligible at all', () => {
    const eligibility = { eligible: [] }
    const result = chooseVisualizationAfterScenarioSwitch(eligibility, 'GRAPH')
    expect(result).toEqual({ vizMode: null, changed: true })
  })

  it('isLatestScenarioRequest: a stale request token is correctly identified as not the latest', () => {
    expect(isLatestScenarioRequest(1, 3)).toBe(false)
    expect(isLatestScenarioRequest(3, 3)).toBe(true)
  })
})
