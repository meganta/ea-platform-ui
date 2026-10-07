// Owner Console client (backend `/owner/*`, platform-owner only; see
// ea-platform docs/platform-owner). The server enforces every permission;
// this client only calls it.
import { API_BASE, getToken } from '../../lib/api'

export type T = (k: string) => string

export async function handle(r: Response) {
  const text = await r.text()
  let body: any = null
  try { body = text ? JSON.parse(text) : null } catch { body = null }
  if (!r.ok) {
    const msg = body?.message ? (Array.isArray(body.message) ? body.message.join(', ') : typeof body.message === 'string' ? body.message : body.message.message) : `HTTP ${r.status}`
    const err: any = new Error(msg || `HTTP ${r.status}`)
    err.status = r.status
    err.code = body?.code || body?.message?.code
    throw err
  }
  return body
}

export function call(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { Authorization: `Bearer ${getToken() || ''}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }).then(handle)
}

export const qs = (params: Record<string, string | undefined | null>) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '') as Array<[string, string]>
  return p.length ? `?${new URLSearchParams(p).toString()}` : ''
}

export const ownerApi = {
  me: () => call('GET', '/owner/me'),
  dashboard: () => call('GET', '/owner/dashboard'),
  tenants: (f: { search?: string; status?: string; sector?: string; sort?: string } = {}) => call('GET', `/owner/tenants${qs(f)}`),
  comparison: () => call('GET', '/owner/comparison'),
  createTenant: (dto: any) => call('POST', '/owner/tenants', dto),
  tenant: (id: string) => call('GET', `/owner/tenants/${id}`),
  setStatus: (id: string, dto: { status: string; reason: string; password: string }) => call('PUT', `/owner/tenants/${id}/status`, dto),
  maturity: (id: string) => call('GET', `/owner/tenants/${id}/maturity`),
  recommendations: (id: string) => call('GET', `/owner/tenants/${id}/recommendations`),
  viewRecommendations: (id: string) => call('GET', `/owner/tenants/${id}/views/recommendations`),
  prepareViews: (id: string, dto: { viewpointIds?: string[]; max?: number } = {}) => call('POST', `/owner/tenants/${id}/views/prepare`, dto),
  enrichmentJobs: (id: string) => call('GET', `/owner/tenants/${id}/enrichment-jobs`),
  launchEnrichment: (id: string, dto: any) => call('POST', `/owner/tenants/${id}/enrichment-jobs`, dto),
  job: (jobId: string) => call('GET', `/owner/enrichment-jobs/${jobId}`),
  advance: (jobId: string) => call('POST', `/owner/enrichment-jobs/${jobId}/advance`),
  items: (jobId: string, f: { kind?: string; changeType?: string; decision?: string; classification?: string } = {}) => call('GET', `/owner/enrichment-jobs/${jobId}/items${qs(f)}`),
  decide: (jobId: string, decisions: Array<{ itemId: string; decision: string; mergeTargetId?: string }>) => call('PUT', `/owner/enrichment-jobs/${jobId}/items/decisions`, { decisions }),
  logo: (jobId: string, decision: 'APPROVED' | 'REJECTED') => call('PUT', `/owner/enrichment-jobs/${jobId}/logo`, { decision }),
  commit: (jobId: string, dto: { password: string; applyProfile?: boolean }) => call('POST', `/owner/enrichment-jobs/${jobId}/commit`, dto),
  cancel: (jobId: string) => call('POST', `/owner/enrichment-jobs/${jobId}/cancel`),
  enter: (id: string, dto: { reason: string; password: string; durationMinutes?: number }) => call('POST', `/owner/tenants/${id}/access-sessions`, dto),
  sessions: (f: { tenantId?: string; active?: string } = {}) => call('GET', `/owner/access-sessions${qs(f)}`),
  endSession: (sessionId: string) => call('POST', `/owner/access-sessions/${sessionId}/end`),
  audit: (f: { tenantId?: string; action?: string; limit?: string } = {}) => call('GET', `/owner/audit${qs(f)}`),
  exitTenant: () => call('POST', '/owner-access/exit'),
}

export const RUNNING_JOB_STATUSES = ['QUEUED', 'DISCOVERING', 'EXTRACTING', 'MAPPING', 'BUILDING_RELATIONSHIPS', 'PREPARING_VIEWS']
export const PIPELINE_STAGES = ['DISCOVERING', 'EXTRACTING', 'NORMALIZING', 'MAPPING', 'DEDUPLICATING', 'VALIDATING', 'BUILDING_RELATIONSHIPS', 'PREPARING_VIEWS', 'READY_FOR_REVIEW', 'COMMITTING', 'COMPLETED']
export const ENRICHMENT_SCOPES = ['FULL', 'STRATEGY', 'BUSINESS', 'BENEFICIARY', 'APPLICATIONS', 'APPLICATION_MODULES', 'PROCESSES', 'CAPABILITIES', 'SERVICES', 'DATA', 'TECHNOLOGY', 'RELATIONSHIPS', 'MISSING']

export const CLASSIFICATION_COLOR: Record<string, string> = {
  VERIFIED: 'var(--success)',
  LIKELY: '#0EA5E9',
  INFERRED: 'var(--warning)',
  INSUFFICIENT_EVIDENCE: 'var(--danger)',
}
export const VIEW_STATUS_COLOR: Record<string, string> = {
  READY: 'var(--success)',
  PARTIAL: 'var(--warning)',
  RECOMMENDED_AFTER_ENRICHMENT: '#0EA5E9',
  INSUFFICIENT_DATA: '#94A3B8',
}

export function pct(v: number | null | undefined) { return v === null || v === undefined ? '—' : `${Math.round(v * 100)}%` }
export function fmtDate(v: string | null | undefined, isAR = false) {
  if (!v) return '—'
  const d = new Date(v)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(isAR ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
export function levelText(level: number | null | undefined, t: T) {
  if (level === null || level === undefined) return t('owner.maturity.not_assessed')
  const l = Math.floor(level)
  return `${Number.isInteger(level) ? level : level.toFixed(1)} · ${t(`owner.maturity.level.${l}`)}`
}
