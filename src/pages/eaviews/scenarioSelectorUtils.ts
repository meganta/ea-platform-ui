// ── Scenario Selector Utilities (Phase 5A) ────────────────────────────────
//
// Pure functions over the flat scenario list from GET /ea-views/scenarios
// (id/name/type/status/horizonDate/sequence/parentScenarioId) - never
// fabricates lineage the backend didn't provide (Section 11: "do not
// fabricate lineage client-side if the backend can provide authoritative
// parent information" - it does, via parentScenarioId).

export interface ScenarioLineageTree {
  rootIds: string[]
  childrenByParentId: Record<string, string[]>
}

// Same shape/approach as Phase 4B's capability hierarchy tree - real
// parent/child structure only, siblings (e.g. Target A/B sharing a
// parent) are never presented as a chain, since they simply appear as
// two separate entries under the same parent's children array.
export function buildScenarioLineageTree(scenarios: any[]): ScenarioLineageTree {
  const childrenByParentId: Record<string, string[]> = {}
  const ids = new Set(scenarios.map(s => s.id))
  const rootIds: string[] = []
  for (const s of scenarios) {
    if (s.parentScenarioId && ids.has(s.parentScenarioId)) {
      if (!childrenByParentId[s.parentScenarioId]) childrenByParentId[s.parentScenarioId] = []
      childrenByParentId[s.parentScenarioId].push(s.id)
    } else {
      rootIds.push(s.id)
    }
  }
  return { rootIds, childrenByParentId }
}

// The ancestor chain from root to the given scenario, e.g.
// ['current', 'transition', 'targetA'] for the acceptance fixture's
// Target A - for the lightweight "Current -> Transition 2027 -> Target
// 2028 - Option A" lineage context display (Section 11). Walks
// parentScenarioId directly; a cycle-safety guard (never revisit an id)
// keeps this from looping forever on malformed data, matching the same
// defensive posture as Phase 4B's tree cycle protection.
export function getScenarioLineagePath(scenarios: any[], scenarioId: string): any[] {
  const byId = new Map(scenarios.map(s => [s.id, s]))
  const path: any[] = []
  let current = byId.get(scenarioId)
  const seen = new Set<string>()
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    path.unshift(current)
    current = current.parentScenarioId ? byId.get(current.parentScenarioId) : undefined
  }
  return path
}

// Section 12/I: after a scenario switch, eligibility may change. Keeps
// the current visualization if it's still eligible; otherwise picks the
// new eligibility result's own top-ranked recommendation (eligibility
// is already sorted by score - see visualization-eligibility.service.ts)
// - never a renderer-local arbitrary default. Returns null when nothing
// is eligible at all (an ineligible-reason message is shown instead of
// forcing any renderer).
export function chooseVisualizationAfterScenarioSwitch(eligibility: any, currentVizMode: string): { vizMode: string | null; changed: boolean } {
  const stillEligible = eligibility?.eligible?.some((v: any) => v.visualization === currentVizMode)
  if (stillEligible) return { vizMode: currentVizMode, changed: false }
  const best = eligibility?.eligible?.[0]?.visualization ?? null
  return { vizMode: best, changed: true }
}

// Section F: race-condition protection for fast scenario switching.
// Purely a comparison - the caller stamps each in-flight request with an
// incrementing token before firing it, and only applies a response if
// its token still matches the latest one issued by the time it resolves.
// A stale response (Current's request resolving after Target B was
// already requested) is silently ignored rather than overwriting newer,
// already-displayed data.
export function isLatestScenarioRequest(requestToken: number, latestIssuedToken: number): boolean {
  return requestToken === latestIssuedToken
}
