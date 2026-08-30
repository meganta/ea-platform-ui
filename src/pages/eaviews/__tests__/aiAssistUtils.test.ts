import { resolveEvidenceRef, buildProposedChangeRows, canApproveProposal, CLAIM_STYLE } from '../aiAssistUtils'

describe('aiAssistUtils', () => {
  const dataset = {
    objects: [{ id: 'appX', name: 'App X' }],
    relationships: [{ sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by' }],
    paths: [{ id: 'path1', objectIds: ['capA', 'appX'] }],
    metrics: [{ key: 'risk' }],
  }

  it('resolveEvidenceRef resolves a valid OBJECT ref to the real object', () => {
    expect(resolveEvidenceRef({ kind: 'OBJECT', id: 'appX' }, dataset)).toEqual({ id: 'appX', name: 'App X' })
  })

  it('resolveEvidenceRef resolves a valid RELATIONSHIP ref by canonical key', () => {
    const result = resolveEvidenceRef({ kind: 'RELATIONSHIP', id: 'capA::appX::supported_by' }, dataset)
    expect(result).toEqual({ sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by' })
  })

  it('resolveEvidenceRef resolves a valid PATH ref', () => {
    expect(resolveEvidenceRef({ kind: 'PATH', id: 'path1' }, dataset)?.id).toBe('path1')
  })

  it('resolveEvidenceRef resolves a valid METRIC ref', () => {
    expect(resolveEvidenceRef({ kind: 'METRIC', id: 'risk' }, dataset)?.key).toBe('risk')
  })

  it('resolveEvidenceRef returns null for an id not in the dataset', () => {
    expect(resolveEvidenceRef({ kind: 'OBJECT', id: 'not-there' }, dataset)).toBeNull()
  })

  it('resolveEvidenceRef returns null for COMPARISON_CLASSIFICATION - handled separately by the caller', () => {
    expect(resolveEvidenceRef({ kind: 'COMPARISON_CLASSIFICATION', id: 'appX' }, dataset)).toBeNull()
  })

  it('resolveEvidenceRef returns null when no dataset is supplied at all', () => {
    expect(resolveEvidenceRef({ kind: 'OBJECT', id: 'appX' }, null)).toBeNull()
  })

  it('CLAIM_STYLE covers all four classifications with distinct colors', () => {
    const colors = new Set(Object.values(CLAIM_STYLE).map(s => s.color))
    expect(colors.size).toBe(4)
  })

  describe('buildProposedChangeRows', () => {
    const objectById = new Map([['appX', { name: 'App X' }], ['capA', { name: 'Capability A' }]])

    it('builds a readable summary for REMOVE_ASSET including the object name', () => {
      const proposal = { proposedChanges: [{ changeType: 'REMOVE_ASSET', assetId: 'appX', rationale: 'redundant', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }], validationIssues: [] }
      const rows = buildProposedChangeRows(proposal, objectById)
      expect(rows[0].summary).toBe('Remove asset: App X')
      expect(rows[0].rationale).toBe('redundant')
      expect(rows[0].evidenceCount).toBe(1)
    })

    it('builds a readable summary for ADD_RELATIONSHIP including both object names', () => {
      const proposal = { proposedChanges: [{ changeType: 'ADD_RELATIONSHIP', sourceId: 'capA', targetId: 'appX', relationshipType: 'depends_on', rationale: 'x', evidenceRefs: [] }], validationIssues: [] }
      const rows = buildProposedChangeRows(proposal, objectById)
      expect(rows[0].summary).toBe('Add relationship: Capability A → depends_on → App X')
    })

    it('builds a readable summary for SET_PROPERTY_OVERRIDE listing the changed keys', () => {
      const proposal = { proposedChanges: [{ changeType: 'SET_PROPERTY_OVERRIDE', assetId: 'appX', overrides: { risk: 'HIGH', criticality: 'LOW' }, rationale: 'x', evidenceRefs: [] }], validationIssues: [] }
      const rows = buildProposedChangeRows(proposal, objectById)
      expect(rows[0].summary).toBe('Change properties: App X (risk, criticality)')
    })

    it('attaches only the issues belonging to that specific changeIndex, not a flat undifferentiated list', () => {
      const proposal = {
        proposedChanges: [
          { changeType: 'REMOVE_ASSET', assetId: 'appX', rationale: 'x', evidenceRefs: [] },
          { changeType: 'REMOVE_ASSET', assetId: 'capA', rationale: 'x', evidenceRefs: [] },
        ],
        validationIssues: [{ severity: 'ERROR', message: 'issue for change 0', changeIndex: 0 }, { severity: 'WARNING', message: 'issue for change 1', changeIndex: 1 }],
      }
      const rows = buildProposedChangeRows(proposal, objectById)
      expect(rows[0].issues).toEqual([{ severity: 'ERROR', message: 'issue for change 0' }])
      expect(rows[1].issues).toEqual([{ severity: 'WARNING', message: 'issue for change 1' }])
    })

    it('returns an empty array for a proposal with no changes', () => {
      expect(buildProposedChangeRows({ proposedChanges: [], validationIssues: [] }, objectById)).toEqual([])
    })
  })

  describe('canApproveProposal', () => {
    it('is true for a VALIDATED proposal with no ERROR-level issues', () => {
      expect(canApproveProposal({ status: 'VALIDATED', validationIssues: [{ severity: 'WARNING', message: 'x' }] })).toBe(true)
    })

    it('is false for a VALIDATED proposal with at least one ERROR-level issue', () => {
      expect(canApproveProposal({ status: 'VALIDATED', validationIssues: [{ severity: 'ERROR', message: 'x' }] })).toBe(false)
    })

    it('is false for any non-VALIDATED status, even with zero issues', () => {
      expect(canApproveProposal({ status: 'REJECTED_BY_VALIDATION', validationIssues: [] })).toBe(false)
      expect(canApproveProposal({ status: 'APPROVED', validationIssues: [] })).toBe(false)
    })
  })
})
