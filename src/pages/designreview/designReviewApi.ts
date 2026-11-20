import { API_BASE, getToken } from '../../lib/api'

export type ReviewType = 'RFP' | 'HLD' | 'LLD' | 'SOLUTION_DESIGN'
export type Lang = 'AR' | 'EN'
export type Rating = 'ALIGNED' | 'PARTIAL' | 'NOT_ALIGNED' | 'NOT_ADDRESSED' | 'NO_DIRECT_IMPACT' | 'NOT_ASSESSED'
export type Level = 'HIGH' | 'MEDIUM' | 'LOW'
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type Verdict = 'APPROVED' | 'CONDITIONAL' | 'NOT_APPROVED'
export type RecGroup = 'SCOPE' | 'ALIGNMENT' | 'GOVERNANCE'
export type Status = 'RUNNING' | 'READY' | 'APPROVED' | 'FAILED'

export const REVIEW_TYPES: ReviewType[] = ['RFP', 'HLD', 'LLD', 'SOLUTION_DESIGN']
export const RATINGS: Rating[] = ['ALIGNED', 'PARTIAL', 'NOT_ALIGNED', 'NOT_ADDRESSED', 'NO_DIRECT_IMPACT', 'NOT_ASSESSED']
export const LEVELS: Level[] = ['HIGH', 'MEDIUM', 'LOW']
export const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
export const VERDICTS: Verdict[] = ['APPROVED', 'CONDITIONAL', 'NOT_APPROVED']
export const REC_GROUPS: RecGroup[] = ['SCOPE', 'ALIGNMENT', 'GOVERNANCE']
export const DOMAINS = ['BUSINESS', 'BENEFICIARY', 'DATA', 'APPLICATION', 'TECHNOLOGY', 'SECURITY'] as const
export const STAGES = ['CONTEXT', 'UNDERSTAND', 'STRATEGY', 'PRINCIPLES', 'IMPACT', 'RECOMMEND', 'DONE'] as const
export const STATUSES: Status[] = ['RUNNING', 'READY', 'APPROVED', 'FAILED']

export interface RatedRow { ref: string; id: string; name: string; rating: Rating; justification: string; pillar?: string | null }
export interface LandscapeRow { ref: string | null; id: string | null; name: string; nameInDocument: string; inRepository: boolean; typeLabel?: string; lifecycle?: string | null; status?: string | null; owner?: string | null; relation: string }
export interface ProjectRow { ref: string; id: string; name: string; status?: string | null; owner?: string | null; relation: string }
export interface DomainImpact { domain: typeof DOMAINS[number]; level: Level | 'NOT_ASSESSED'; points: string[] }
export interface Gap { id: string; title: string; description: string; severity: Severity; refs: Array<{ ref: string; id: string; name: string }> }
export interface Risk { id: string; title: string; description: string; impact: Level; likelihood: Level; mitigation: string }
export interface Recommendation { id: string; group: RecGroup; text: string; gaps: string[] }
export interface NextStep { step: string; owner: string; timing: string }
export interface ReviewResult {
  scope: { summary: string; items: string[]; deliverables: string[] }
  documentReferences: string[]
  landscape: LandscapeRow[]
  projects: ProjectRow[]
  strategy: Array<{ key: string; label: string; rows: RatedRow[] }>
  principles: RatedRow[]
  standards: RatedRow[]
  domains: DomainImpact[]
  gaps: Gap[]
  risks: Risk[]
  recommendations: Recommendation[]
  nextSteps: NextStep[]
  executive: { headline: string; keyMessages: string[]; aiVerdict: Verdict | null; aiVerdictReason: string }
  verdict: { value: Verdict; basis: 'RULE' | 'REVIEWER'; reason: string; ruleValue: Verdict; ruleReason: string }
  counts: { gaps: number; risks: number; recommendations: number }
  limitations: string[]
}
export interface ReviewSummary {
  id: string; title: string; reviewType: ReviewType; language: Lang; status: Status; stage: typeof STAGES[number]; documentName: string; documentChars: number
  error: string | null; createdAt: string; updatedAt: string; approvedAt: string | null; stalled: boolean
  verdict?: Verdict | null; counts?: { gaps: number; risks: number; recommendations: number } | null; summary?: string
}
export interface Candidate { ref: string; name: string; type: string }
export interface Review extends ReviewSummary {
  result: ReviewResult | null
  counts: any
  candidates: { landscape: Candidate[]; projects: Candidate[]; standards: Candidate[] } | null
}

const auth = (): Record<string, string> => (getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
const json = () => ({ 'Content-Type': 'application/json', ...auth() })

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}))
  throw new Error(Array.isArray(body?.message) ? body.message.join('; ') : body?.message || `HTTP ${res.status}`)
}
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/design-reviews${path}`, { ...init, headers: { ...(init.body instanceof FormData ? auth() : json()), ...(init.headers || {}) } })
  if (!res.ok) return fail(res)
  return res.json()
}

/** The file name the server gave (RFC 5987 filename*), else a fallback. */
export function fileNameOf(disposition: string | null, fallback: string): string {
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition || '')
  if (m) { try { return decodeURIComponent(m[1]) } catch { /* fall through */ } }
  return fallback
}

export const designReviewApi = {
  list: (search = '') => call<ReviewSummary[]>(search ? `?search=${encodeURIComponent(search)}` : ''),
  get: (id: string) => call<Review>(`/${encodeURIComponent(id)}`),
  start(file: File, title: string, reviewType: ReviewType, language: Lang) {
    const fd = new FormData()
    fd.append('file', file); fd.append('title', title); fd.append('reviewType', reviewType); fd.append('language', language)
    return call<ReviewSummary>('', { method: 'POST', body: fd })
  },
  resume: (id: string) => call<Review>(`/${encodeURIComponent(id)}/resume`, { method: 'POST' }),
  rerun: (id: string) => call<Review>(`/${encodeURIComponent(id)}/rerun`, { method: 'POST' }),
  edit: (id: string, section: string, value: unknown) => call<Review>(`/${encodeURIComponent(id)}/content`, { method: 'PUT', body: JSON.stringify({ section, value }) }),
  approve: (id: string) => call<Review>(`/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  reopen: (id: string) => call<Review>(`/${encodeURIComponent(id)}/reopen`, { method: 'POST' }),
  remove: (id: string) => call<{ deleted: boolean }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  async download(id: string, format: 'pptx' | 'docx', fallback: string): Promise<string> {
    const res = await fetch(`${API_BASE}/design-reviews/${encodeURIComponent(id)}/export/${format}`, { headers: auth() })
    if (!res.ok) return fail(res)
    const name = fileNameOf(res.headers.get('content-disposition'), `${fallback}.${format}`)
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url; a.download = name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return name
  },
}
