// ── AI Assist Utilities (Phase 5D) ────────────────────────────────────────
//
// Pure functions only - no network calls, no grounding/classification
// logic (that is entirely server-side, in EvidenceGroundingService/
// ai-response-parser.ts). These functions only shape the already-graded
// ArchitectureClaim[]/ScenarioChangeProposal the backend returns for
// display, and resolve an evidenceRef back to a real object already
// present in the currently-loaded dataset - never re-fetching, never
// re-deriving whether a ref is valid (the backend already decided that).

export type ClaimClassification = 'FACT' | 'INFERENCE' | 'GENERAL_GUIDANCE' | 'UNVERIFIED'

// The single source of truth for how each classification is styled -
// used consistently everywhere a claim is rendered, so FACT/INFERENCE/
// GENERAL_GUIDANCE/UNVERIFIED are always visually distinguishable
// (Section: "The UI must make these distinguishable").
export const CLAIM_STYLE: Record<ClaimClassification, { label: string; color: string; icon: string }> = {
  FACT: { label: 'Fact', color: '#2ecc71', icon: '✓' },
  INFERENCE: { label: 'Inference', color: '#3498db', icon: '~' },
  GENERAL_GUIDANCE: { label: 'General guidance', color: '#7f8c8d', icon: 'ℹ' },
  UNVERIFIED: { label: 'Unverified', color: '#e74c3c', icon: '⚠' },
}

export interface EvidenceRef {
  kind: 'OBJECT' | 'RELATIONSHIP' | 'PATH' | 'COMPARISON_CLASSIFICATION' | 'METRIC'
  id: string
  scenarioId?: string
}

// Resolves an evidenceRef back to a real, already-loaded object/relationship
// for the detail panel / highlighting - never fetches anything new. Returns
// null if the id genuinely isn't in the currently-loaded dataset (it always
// should be, since the backend already validated every ref against this
// exact data - a null here would indicate the dataset was refreshed since
// the claim was generated, not a hallucinated ref slipping through).
export function resolveEvidenceRef(ref: EvidenceRef, dataset: any): any {
  if (!dataset) return null
  if (ref.kind === 'OBJECT') return (dataset.objects ?? []).find((o: any) => o.id === ref.id) ?? null
  if (ref.kind === 'PATH') return (dataset.paths ?? []).find((p: any) => p.id === ref.id) ?? null
  if (ref.kind === 'METRIC') return (dataset.metrics ?? []).find((m: any) => m.key === ref.id) ?? null
  if (ref.kind === 'RELATIONSHIP') {
    return (dataset.relationships ?? []).find((r: any) => `${r.sourceId}::${r.targetId}::${r.relationshipType}` === ref.id) ?? null
  }
  return null
}

export interface ProposedChangeDisplay {
  index: number
  changeType: string
  summary: string
  rationale: string
  evidenceCount: number
  issues: { severity: 'ERROR' | 'WARNING'; message: string }[]
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  INTRODUCE_ASSET: 'Introduce asset',
  REMOVE_ASSET: 'Remove asset',
  RESTORE_ASSET: 'Restore asset',
  SET_PROPERTY_OVERRIDE: 'Change properties',
  ADD_RELATIONSHIP: 'Add relationship',
  REMOVE_RELATIONSHIP: 'Remove relationship',
}

// Builds one display row per proposedChanges[] entry, with its own
// validationIssues attached by changeIndex (the shape
// ScenarioProposalService.validateProposedChanges already returns) -
// a proposal reviewer sees every issue against the exact change it
// belongs to, not a flat, undifferentiated list.
export function buildProposedChangeRows(proposal: any, objectById: Map<string, any>): ProposedChangeDisplay[] {
  const changes = proposal?.proposedChanges ?? []
  const allIssues = proposal?.validationIssues ?? []
  const nameOf = (id: string) => objectById.get(id)?.name ?? id

  return changes.map((c: any, i: number) => {
    let summary = CHANGE_TYPE_LABEL[c.changeType] ?? c.changeType
    if (c.changeType === 'INTRODUCE_ASSET' || c.changeType === 'REMOVE_ASSET' || c.changeType === 'RESTORE_ASSET') summary += `: ${nameOf(c.assetId)}`
    else if (c.changeType === 'SET_PROPERTY_OVERRIDE') summary += `: ${nameOf(c.assetId)} (${Object.keys(c.overrides ?? {}).join(', ')})`
    else if (c.changeType === 'ADD_RELATIONSHIP' || c.changeType === 'REMOVE_RELATIONSHIP') summary += `: ${nameOf(c.sourceId)} → ${c.relationshipType} → ${nameOf(c.targetId)}`

    return {
      index: i,
      changeType: c.changeType,
      summary,
      rationale: c.rationale,
      evidenceCount: (c.evidenceRefs ?? []).length,
      issues: allIssues.filter((iss: any) => iss.changeIndex === i).map((iss: any) => ({ severity: iss.severity, message: iss.message })),
    }
  })
}

// Section: "ERROR-level issues on any change disable approval for the
// whole proposal" - the single source of truth for whether the Approve
// action should be enabled, so the button and any explanatory text
// never disagree about why approval is blocked.
export function canApproveProposal(proposal: any): boolean {
  if (proposal?.status !== 'VALIDATED') return false
  const issues = proposal?.validationIssues ?? []
  return !issues.some((i: any) => i.severity === 'ERROR')
}
