// Client and helpers for Financial Value Intelligence (backend /financial-value).

export type T = (k: string) => string

export function makeFvApi(base: string) {
  const token = () => localStorage.getItem('ea_token')
  const handle = async (r: Response) => {
    const text = await r.text()
    let body: any = null
    try { body = text ? JSON.parse(text) : null } catch { body = { message: text } }
    if (!r.ok) {
      const msg = body?.message
      throw new Error(typeof msg === 'string' ? msg : Array.isArray(msg) ? msg.join(', ') : msg?.message || `HTTP ${r.status}`)
    }
    return body
  }
  const json = (method: string) => (path: string, body?: any) => fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  }).then(handle)
  return {
    get: (path: string) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(handle),
    post: json('POST'),
    put: json('PUT'),
    del: json('DELETE'),
    upload: (path: string, file: File, fields: Record<string, string> = {}) => {
      const fd = new FormData()
      fd.append('file', file)
      for (const [k, v] of Object.entries(fields)) fd.append(k, v)
      return fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd }).then(handle)
    },
    blob: async (path: string) => {
      const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token()}` } })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.blob()
    },
  }
}
export type FvApi = ReturnType<typeof makeFvApi>

/** What the signed-in person may do in the module (from GET /financial-value/me). */
export interface FvRights {
  VIEW: boolean; VIEW_FINANCIAL_DATA: boolean; MANAGE_DATA: boolean; VALIDATE_DATA: boolean; MANAGE_OPPORTUNITIES: boolean
  ASSESS_FEASIBILITY: boolean; VALIDATE_FINANCE: boolean; APPROVE: boolean; VERIFY_SAVINGS: boolean; CONFIGURE: boolean; RUN_RESEARCH: boolean
}
export const NO_RIGHTS: FvRights = { VIEW: false, VIEW_FINANCIAL_DATA: false, MANAGE_DATA: false, VALIDATE_DATA: false, MANAGE_OPPORTUNITIES: false, ASSESS_FEASIBILITY: false, VALIDATE_FINANCE: false, APPROVE: false, VERIFY_SAVINGS: false, CONFIGURE: false, RUN_RESEARCH: false }

/** Amounts with Latin digits in both languages (platform convention). */
export function money(n: number | null | undefined, currency = 'SAR'): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${Math.round(n).toLocaleString('en-US')} ${currency}`
}
export const num = (n: number | null | undefined, suffix = '') => (n === null || n === undefined ? '—' : `${Math.round(n * 10) / 10}${suffix}`)
export const day = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : '—')

export const ENGINES = ['APPLICATION_RATIONALIZATION', 'LICENSE_OPTIMIZATION', 'INFRASTRUCTURE_FINOPS', 'TECHNOLOGY_CONSOLIDATION', 'CONTRACT_PROCUREMENT', 'DATA_PLATFORM', 'INTEGRATION', 'PROCESS_AUTOMATION', 'INVESTMENT_OPTIMIZATION', 'VENDOR_ALTERNATIVE']
export const ACTIONS = ['RETIRE', 'CONSOLIDATE', 'REPLACE', 'RIGHTSIZE', 'DECOMMISSION', 'RECLAIM_LICENSES', 'RENEGOTIATE', 'DO_NOT_RENEW', 'REUSE_EXISTING', 'AVOID_INVESTMENT', 'AUTOMATE', 'OTHER']
export const BENEFITS = ['CASH_SAVING', 'COST_AVOIDANCE', 'PRODUCTIVITY', 'NON_FINANCIAL']
export const STATUSES = ['DISCOVERED', 'EVIDENCE_REQUIRED', 'VALIDATED', 'BUSINESS_CASE_PREPARED', 'APPROVED', 'PLANNED', 'IN_EXECUTION', 'IMPLEMENTED', 'VERIFICATION', 'REALIZED', 'PARTIALLY_REALIZED', 'REJECTED', 'DEFERRED', 'CANCELLED', 'CLOSED_WITHOUT_SAVINGS']
export const COST_CATEGORIES = ['LICENSE', 'SUBSCRIPTION', 'SUPPORT', 'MAINTENANCE', 'INFRASTRUCTURE', 'CLOUD', 'HOSTING', 'OPERATIONS', 'STAFF', 'INTEGRATION', 'DEVELOPMENT', 'OTHER']
export const BASES = ['ACTUAL', 'CONTRACT', 'QUOTE', 'ESTIMATE']
export const ONE_TIME_CATEGORIES = ['IMPLEMENTATION', 'MIGRATION', 'TERMINATION_PENALTY', 'PARALLEL_RUN', 'TRAINING', 'DATA_ARCHIVAL', 'OTHER']
export const EVIDENCE_KINDS = ['INVOICE', 'CONTRACT', 'LICENSE_REPORT', 'USAGE_REPORT', 'BILLING_STATEMENT', 'BUDGET_RECORD', 'CREDIT_NOTE', 'DECOMMISSION_RECORD', 'PURCHASE_BASELINE', 'FINANCIAL_SYSTEM', 'IMPLEMENTATION_RECORD', 'OTHER']
export const VALUE_STAGES = ['POTENTIAL', 'VALIDATED', 'APPROVED', 'IMPLEMENTED'] as const

export function statusTone(status: string): string {
  if (['REALIZED'].includes(status)) return 'fv-tone-good'
  if (['REJECTED', 'CANCELLED', 'CLOSED_WITHOUT_SAVINGS'].includes(status)) return 'fv-tone-bad'
  if (['APPROVED', 'PLANNED', 'IN_EXECUTION', 'IMPLEMENTED', 'VERIFICATION', 'PARTIALLY_REALIZED'].includes(status)) return 'fv-tone-go'
  return 'fv-tone-neutral'
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = fileName
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Opens a printable HTML report from the API in a new tab (the browser's print dialog saves it as PDF); fetched with the token, never a public URL. */
export async function openPrintable(api: FvApi, path: string) {
  const blob = await api.blob(path)
  const url = URL.createObjectURL(new Blob([blob], { type: 'text/html' }))
  const w = window.open(url, '_blank')
  if (!w) saveBlob(blob, 'report.html')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
