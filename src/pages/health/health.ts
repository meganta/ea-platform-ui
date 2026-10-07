// Client types and helpers for Architecture Health (backend architecture-health module).

export type T = (k: string) => string

export interface HealthItem {
  key: string; kind: 'ATTRIBUTE' | 'CORE' | 'RELATIONSHIP'; typeCode: string; typeName: string; code: string; label: string; labelAr?: string | null
  priority: string; priorityBasis: string; weight: number; expected: number; useful: number; missing: number; invalid: number
  coverage: number | null; gainPoints: number
  relationship?: { otherEndTypeName: string; single: boolean; crossDomain: boolean; otherEndRecorded: number; direction: string }
}

export interface HealthCriterion {
  code: string; weight: number; why: string; status: 'ASSESSED' | 'NOT_ASSESSED'; score: number | null
  evidence: { measured: number; of: number }; explanation: string; gap: string | null; recommendedAction: string | null; targetScore: number; gapPoints: number | null
}

export interface HealthAssessment {
  domain: { code: string; name: string; nameAr?: string | null }
  generatedAt: string; basis: string; objectCount: number
  truncated: { links: boolean; objects: boolean }
  completeness: { score: number | null; attributeScore: number | null; relationshipScore: number | null; rule: string }
  types: Array<{ code: string; name: string; objectCount: number; attributeScore: number | null; relationshipScore: number | null; referenceExpected: boolean }>
  missingTypes: Array<{ code: string; name: string; classification: 'REFERENCE_GAP' | 'NOT_RECORDED'; referenceElements: string[] }>
  items: HealthItem[]
  invalidValues: { total: number; samples: Array<{ objectId: string; objectName: string; field: string; value: string; reason: string }> }
  suspiciousLinks: { total: number; byReason: Record<string, number> }
  reference: { status: 'ASSESSED' | 'NO_REFERENCE'; architectures: Array<{ id: string; name: string; elements: number }>; byClass: Record<string, Array<{ stableKey: string; name: string; obligation: string; reason: string }>>; coverage: { mandatory: number; confirmed: number; statement: string } | null }
  maturity: { score: number | null; level: number | null; levelLabel: string | null; targetLevel: number; targetScore: number; gapPoints: number | null; criteria: HealthCriterion[]; notAssessed: string[]; rule: string }
  collectionPlan: { itemKeys: string[]; objects: number; values: number; blocked: Array<{ key: string; label: string; needs: string }>; completenessFrom: number | null; completenessTo: number | null; maturityFrom: number | null; maturityTo: number | null; statement: string }
  recommendations: Array<{ code: string; priority: string; problem: string; evidence: string; action: string; expectedGainPoints?: number }>
}

export const REFERENCE_CLASSES = ['CONFIRMED_EXISTING', 'POTENTIALLY_EXISTING_UNDOCUMENTED', 'ARCHITECTURE_GAP', 'NOT_APPLICABLE', 'REQUIRES_TENANT_CONFIRMATION']

export const fmt = (n: number | null | undefined, suffix = '') => (n === null || n === undefined ? '—' : `${n}${suffix}`)

/** Background for a 0-100 score cell (neutral when not assessed). */
export function heatColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'transparent'
  if (score >= 80) return 'rgba(22, 163, 74, .22)'
  if (score >= 60) return 'rgba(132, 204, 22, .22)'
  if (score >= 40) return 'rgba(234, 179, 8, .24)'
  if (score >= 20) return 'rgba(249, 115, 22, .24)'
  return 'rgba(220, 38, 38, .22)'
}

export function makeApi(base: string) {
  const token = () => localStorage.getItem('ea_token')
  const handle = async (r: Response) => {
    const text = await r.text()
    const body = text ? JSON.parse(text) : null
    if (!r.ok) throw new Error(body?.message ? (Array.isArray(body.message) ? body.message.join(', ') : body.message) : `HTTP ${r.status}`)
    return body
  }
  return {
    get: (path: string) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(handle),
    post: (path: string, body?: any) => fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(handle),
    upload: (path: string, file: File) => { const fd = new FormData(); fd.append('file', file); return fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd }).then(handle) },
    blob: async (path: string) => {
      const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    },
  }
}
export type HealthApi = ReturnType<typeof makeApi>
