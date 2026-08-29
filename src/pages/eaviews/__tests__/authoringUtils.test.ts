import { buildPropertyFieldDisplay, requiresCurrentEditConfirmation, isScenarioLocked, determineAssetActions, canIntroduce, buildRelationshipAuthoringRows } from '../authoringUtils'

describe('authoringUtils', () => {
  it('buildPropertyFieldDisplay marks a key present in metadataProvenance as scenarioOverride', () => {
    const object = { metadata: { hostingModel: 'CLOUD', criticality: 'HIGH' }, metadataProvenance: { hostingModel: 'scenarioOverride', criticality: 'repository' } }
    const fields = buildPropertyFieldDisplay(object)
    expect(fields.find(f => f.key === 'hostingModel')?.provenance).toBe('scenarioOverride')
    expect(fields.find(f => f.key === 'criticality')?.provenance).toBe('repository')
  })

  it('buildPropertyFieldDisplay marks every key as unknown when metadataProvenance is entirely absent (no scenario resolution involved)', () => {
    const object = { metadata: { hostingModel: 'CLOUD' } }
    const fields = buildPropertyFieldDisplay(object)
    expect(fields[0].provenance).toBe('unknown')
  })

  it('buildPropertyFieldDisplay treats a metadata key absent from metadataProvenance (but present when a scenario IS involved) as repository, not unknown', () => {
    const object = { metadata: { hostingModel: 'CLOUD', untouchedKey: 'x' }, metadataProvenance: { hostingModel: 'scenarioOverride' } }
    const fields = buildPropertyFieldDisplay(object)
    expect(fields.find(f => f.key === 'untouchedKey')?.provenance).toBe('repository')
  })

  it('requiresCurrentEditConfirmation is true only for a CURRENT-type scenario', () => {
    expect(requiresCurrentEditConfirmation({ type: 'CURRENT' })).toBe(true)
    expect(requiresCurrentEditConfirmation({ type: 'TARGET' })).toBe(false)
    expect(requiresCurrentEditConfirmation({ type: 'TRANSITION' })).toBe(false)
  })

  it('isScenarioLocked is true for any status other than DRAFT', () => {
    expect(isScenarioLocked({ status: 'DRAFT' })).toBe(false)
    expect(isScenarioLocked({ status: 'APPROVED' })).toBe(true)
    expect(isScenarioLocked({ status: 'ARCHIVED' })).toBe(true)
  })

  it('determineAssetActions offers Remove (not Restore) for a present asset on an unlocked scenario', () => {
    expect(determineAssetActions(true, false)).toEqual({ canRemove: true, canRestore: false, canEditProperties: true })
  })

  it('determineAssetActions offers Restore (not Remove) for an absent asset on an unlocked scenario', () => {
    expect(determineAssetActions(false, false)).toEqual({ canRemove: false, canRestore: true, canEditProperties: false })
  })

  it('determineAssetActions disables everything when the scenario is locked, regardless of presence', () => {
    expect(determineAssetActions(true, true)).toEqual({ canRemove: false, canRestore: false, canEditProperties: false })
    expect(determineAssetActions(false, true)).toEqual({ canRemove: false, canRestore: false, canEditProperties: false })
  })

  it('canIntroduce is false when the asset is already present, even on an unlocked scenario', () => {
    expect(canIntroduce(true, false)).toBe(false)
  })

  it('canIntroduce is false when the scenario is locked, even if the asset is absent', () => {
    expect(canIntroduce(false, true)).toBe(false)
  })

  it('canIntroduce is true only when absent AND unlocked', () => {
    expect(canIntroduce(false, false)).toBe(true)
  })

  it('buildRelationshipAuthoringRows dedupes by canonical (source, target, type) key', () => {
    const rows = buildRelationshipAuthoringRows([
      { sourceId: 'a', targetId: 'b', relationshipType: 'hosted_on', label: 'hosted_on' },
      { sourceId: 'a', targetId: 'b', relationshipType: 'hosted_on', label: 'hosted_on' },
      { sourceId: 'a', targetId: 'c', relationshipType: 'hosted_on', label: 'hosted_on' },
    ])
    expect(rows).toHaveLength(2)
  })
})
