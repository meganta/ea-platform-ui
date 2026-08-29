// ── Scenario Authoring Utilities (Phase 5C) ───────────────────────────────
//
// Pure functions only - no network calls, no diff/resolution logic (that
// belongs entirely to the backend's ScenarioAuthoringService/resolver,
// reused as-is). These functions only shape already-fetched data for the
// authoring UI.

export interface PropertyFieldDisplay {
  key: string
  value: any
  provenance: 'repository' | 'scenarioOverride' | 'unknown'
}

// Builds one row per metadata key (union of the object's own metadata
// keys, so a key with no override still shows) with its provenance -
// 'unknown' when the dataset wasn't scenario-resolved at all (no
// metadataProvenance present), never guessed as one or the other.
export function buildPropertyFieldDisplay(object: any): PropertyFieldDisplay[] {
  const metadata = object?.metadata ?? {}
  const provenanceMap = object?.metadataProvenance
  return Object.keys(metadata).map(key => ({
    key,
    value: metadata[key],
    provenance: provenanceMap ? (provenanceMap[key] ?? 'repository') : 'unknown',
  }))
}

// Section: "preventing accidental editing of Current architecture" - the
// single source of truth for whether a Current-edit confirmation must be
// shown before any authoring action proceeds. Deliberately a pure
// predicate the component checks before every single mutating call, not
// a one-time mode-entry gate - so it still protects a user who entered
// authoring mode on a Target, then switched the active scenario to
// Current while still in authoring mode.
export function requiresCurrentEditConfirmation(scenario: any): boolean {
  return scenario?.type === 'CURRENT'
}

export function isScenarioLocked(scenario: any): boolean {
  return scenario?.status !== 'DRAFT'
}

export interface AssetAuthoringActions {
  canRemove: boolean
  canRestore: boolean
  canEditProperties: boolean
}

// present: whether the asset is currently visible in the resolved
// dataset (Section: asset introduce/remove/restore) - an asset only
// ever offers Remove (if present) XOR Restore (if not, and it has a
// delta making it eligible - see listRemovedAssets), never both at
// once, and property editing only makes sense for a present asset.
export function determineAssetActions(present: boolean, locked: boolean): AssetAuthoringActions {
  if (locked) return { canRemove: false, canRestore: false, canEditProperties: false }
  return { canRemove: present, canRestore: !present, canEditProperties: present }
}

// Section: "ensuring every authoring action ... without creating
// duplicate or contradictory deltas" - a lightweight, client-side
// pre-check mirroring the backend's own presence-check-before-action
// (Section 2/3 of the authoring service). This never replaces the
// backend's authoritative check (which always runs regardless); it only
// lets the UI disable a button that would otherwise be rejected,
// avoiding a round-trip that could only ever fail.
export function canIntroduce(alreadyPresent: boolean, locked: boolean): boolean {
  return !alreadyPresent && !locked
}

export interface RelationshipAuthoringRow {
  key: string
  sourceId: string
  targetId: string
  relationshipType: string
  label?: string
}

// Dedupes by canonical key (sourceId/targetId/relationshipType) - the
// same key the backend resolver uses - so a relationship appearing via
// both a base row and an unrelated delta is never listed twice.
export function buildRelationshipAuthoringRows(relationships: any[]): RelationshipAuthoringRow[] {
  const seen = new Set<string>()
  const rows: RelationshipAuthoringRow[] = []
  for (const r of relationships ?? []) {
    const key = `${r.sourceId}::${r.targetId}::${r.relationshipType}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ key, sourceId: r.sourceId, targetId: r.targetId, relationshipType: r.relationshipType, label: r.label })
  }
  return rows
}
