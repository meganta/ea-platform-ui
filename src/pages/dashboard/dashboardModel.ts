// Pure calculations behind the dashboard (no React, no fetching), so every
// number shown is reproducible from the API responses and unit-tested.

export interface HealthDomain {
  domain: { code: string; name: string; nameAr?: string | null }
  objectCount: number
  completeness: number | null
  relationshipCompleteness: number | null
  referenceCoverage: number | null
  maturity: { score: number | null; level: number | null; levelLabel?: string; targetLevel: number | null; gapPoints?: number | null }
}

export interface Insight { key: string; kind: string; severity: string; title: string; detail?: string; domainName?: string; link?: string }
export interface TopAction { code: string; priority: string; problem: string; action: string; domainCode?: string; domainName?: string }
export interface GovStats {
  summary?: { totalReviews?: number; completedReviews?: number; inProgressReviews?: number; avgOverallScore?: number; openFindings?: number; criticalOpenFindings?: number }
  decisions?: Record<string, number>
  findingsBySeverity?: Record<string, number>
  monthlyTrend?: Array<{ label: string; count: number; avgScore: number | null }>
}

/** Same thresholds as Architecture Health: levels 1-5 at 20/40/60/80. */
export function levelForScore(score: number): number {
  return score >= 80 ? 5 : score >= 60 ? 4 : score >= 40 ? 3 : score >= 20 ? 2 : 1
}

/** Enterprise maturity = object-weighted average of the measured domains' maturity scores. */
export function enterpriseMaturity(domains: HealthDomain[]) {
  const measured = domains.filter(d => typeof d.maturity?.score === 'number' && d.objectCount > 0)
  if (!measured.length) return null
  const weight = measured.reduce((n, d) => n + d.objectCount, 0)
  const score = measured.reduce((n, d) => n + (d.maturity.score as number) * d.objectCount, 0) / weight
  const belowTarget = measured.filter(d => d.maturity.level != null && d.maturity.targetLevel != null && d.maturity.level < d.maturity.targetLevel).length
  const targets = measured.map(d => d.maturity.targetLevel).filter((x): x is number => typeof x === 'number')
  return { score: round1(score), level: levelForScore(score), targetLevel: targets.length ? Math.max(...targets) : null, measured: measured.length, belowTarget }
}

/** Decision-useful completeness across domains, weighted by how many objects each domain holds. */
export function enterpriseCompleteness(domains: HealthDomain[]) {
  const measured = domains.filter(d => typeof d.completeness === 'number' && d.objectCount > 0)
  if (!measured.length) return null
  const weight = measured.reduce((n, d) => n + d.objectCount, 0)
  return round1(measured.reduce((n, d) => n + (d.completeness as number) * d.objectCount, 0) / weight)
}

/** Domains with the largest gap to their target first; unmeasured ones last. */
export function rankDomains(domains: HealthDomain[]): HealthDomain[] {
  const gap = (d: HealthDomain) => (d.maturity?.score == null ? -1 : (d.maturity.gapPoints ?? 0))
  return [...domains].sort((a, b) => gap(b) - gap(a) || a.domain.name.localeCompare(b.domain.name))
}

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, POSITIVE: 4 }

export interface AttentionItem { key: string; severity: string; title: string; detail?: string; link: string; source: 'HEALTH' | 'ACTION' | 'GOVERNANCE' }

/** What needs attention: critical Architecture Health actions, open critical findings, then insights by severity; good news kept apart. */
export function attentionItems(input: { insights?: Insight[]; topActions?: TopAction[]; gov?: GovStats | null; max?: number }) {
  const items: AttentionItem[] = []
  // At most three critical actions, so the insights still have room; each names its domain and opens it.
  const critical = (input.topActions || []).filter(a => a.priority === 'CRITICAL').slice(0, 3)
  for (const a of critical) {
    items.push({
      key: `action:${a.domainCode || ''}:${a.code}`, severity: 'CRITICAL', title: a.domainName ? `${a.domainName}: ${a.problem}` : a.problem, detail: a.action,
      link: a.domainCode ? `/architecture-health?domain=${a.domainCode}` : '/architecture-health', source: 'ACTION',
    })
  }
  const findings = input.gov?.summary?.criticalOpenFindings ?? 0
  if (findings > 0) items.push({ key: 'gov:critical', severity: 'CRITICAL', title: String(findings), link: '/governance', source: 'GOVERNANCE' })
  const insights = (input.insights || []).filter(i => i.severity !== 'POSITIVE')
  for (const i of insights) items.push({ key: i.key, severity: i.severity, title: i.title, detail: i.detail, link: i.link || '/architecture-health', source: 'HEALTH' })
  items.sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9))
  const positive = (input.insights || []).filter(i => i.severity === 'POSITIVE')
  return { items: items.slice(0, input.max ?? 7), more: Math.max(0, items.length - (input.max ?? 7)), positive }
}

/** Decision outcomes in a fixed order (best to worst) with their share of all decided reviews. */
export const DECISION_ORDER = ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'REQUIRES_CHANGES', 'REJECTED'] as const
export function decisionShares(decisions: Record<string, number> = {}) {
  const total = DECISION_ORDER.reduce((n, d) => n + (decisions[d] || 0), 0)
  return { total, parts: DECISION_ORDER.map(d => ({ key: d, count: decisions[d] || 0, pct: total ? Math.round(((decisions[d] || 0) / total) * 1000) / 10 : 0 })) }
}

export const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const

export function pct(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? '—' : `${Math.round(value)}%`
}

function round1(n: number) { return Math.round(n * 10) / 10 }
