import { API_BASE, getToken } from './api'

export type AlignmentLevel = 'BUSINESS_GOAL' | 'BUSINESS_KPI' | 'DT_GOAL' | 'DT_KPI' | 'DT_INITIATIVE' | 'EA_GOAL' | 'EA_KPI' | 'EA_VALUE' | 'EA_FUNCTION' | 'EA_SERVICE' | 'EA_PROCEDURE' | 'OP_KPI'
export const CHAIN_COLUMNS: AlignmentLevel[] = ['BUSINESS_GOAL', 'BUSINESS_KPI', 'DT_GOAL', 'DT_KPI', 'EA_GOAL', 'EA_KPI', 'EA_VALUE', 'EA_FUNCTION', 'EA_SERVICE', 'EA_PROCEDURE', 'OP_KPI']
/** Which element can serve which (from -> to), as the backend allows. */
export const LINK_RULES: Array<[AlignmentLevel, AlignmentLevel]> = [
  ['BUSINESS_KPI', 'BUSINESS_GOAL'], ['DT_GOAL', 'BUSINESS_GOAL'], ['DT_KPI', 'DT_GOAL'], ['DT_INITIATIVE', 'DT_GOAL'], ['EA_GOAL', 'DT_GOAL'], ['EA_KPI', 'EA_GOAL'],
  ['EA_VALUE', 'EA_GOAL'], ['EA_FUNCTION', 'EA_VALUE'], ['EA_SERVICE', 'EA_FUNCTION'], ['EA_PROCEDURE', 'EA_SERVICE'], ['OP_KPI', 'EA_PROCEDURE'],
]

export interface AlignmentNode { key: string; id: string; level: AlignmentLevel; title: string; description?: string; formula?: string; source: { kind: 'STRATEGY_FACT' | 'REPOSITORY'; strategyName?: string; provisional?: boolean } }
export interface AlignmentLink { id: string; fromKey: string; toKey: string; fromLevel: AlignmentLevel; toLevel: AlignmentLevel; rationale: string; confidence: number; status: 'PROPOSED' | 'CONFIRMED' | 'REJECTED' | 'FLAGGED'; flagReason?: string | null; fromTitle?: string | null; toTitle?: string | null; note?: string | null }
export interface AlignmentGap { code: string; key: string; level: AlignmentLevel; title: string }
export interface AlignmentRun { id: string; status: 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED'; trigger: string; sources: Record<string, any>; summary?: { kept: number; flagged: number; added: number; rejectedKept: number } | null; warnings: string[]; failureCode?: string | null; createdAt: string; completedAt?: string | null }
export interface AlignmentState { run: AlignmentRun | null; nodes?: AlignmentNode[]; links?: AlignmentLink[]; gaps?: AlignmentGap[]; rows?: Array<Record<string, string>>; results?: Array<{ nodeKey: string; period: string; value: string }>; year?: number }

export type KpiFrequency = 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL'
export interface KpiUnit { id: string; name: string; kpis: number; enterpriseArchitecture: boolean }
export interface TrackedKpi {
  id: string; name: string; formula: string; polarity: string; repositoryFrequency: string | null; frequency: KpiFrequency; reported: boolean; target: string | null; unit: string | null
  measures: Record<string, { value: string; note?: string | null; updatedAt?: string }>
  schedule: Array<{ period: string; dueDate: string; status: 'RECORDED' | 'DUE' | 'OVERDUE' | 'UPCOMING' }>
}
export interface KpiReport { year: number; period: string; measured: number; missing: number; rows: Array<{ id: string; name: string; formula: string; frequency: KpiFrequency; target: string; unit: string; value: string; derived: boolean; previous: string; trend: 'UP' | 'DOWN' | 'SAME' | ''; onTarget: boolean | null; status: 'MEASURED' | 'MISSING' }> }

async function call<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join('; ') : data.message || `HTTP ${response.status}`)
  return data as T
}
async function download(path: string, filename: string) {
  const token = getToken()
  const response = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.message || `HTTP ${response.status}`) }
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url; link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 60000)
}
const q = (params: Record<string, string | number | undefined>) => Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')

export const alignmentApi = {
  latest: (year: number) => call<AlignmentState>(`/strategy-alignment?${q({ year })}`),
  start: () => call<{ id: string; status: string }>('/strategy-alignment/runs', 'POST', {}),
  decide: (linkId: string, status: 'CONFIRMED' | 'REJECTED' | 'PROPOSED', note?: string) => call(`/strategy-alignment/links/${encodeURIComponent(linkId)}/decision`, 'POST', { status, ...(note ? { note } : {}) }),
  addLink: (fromKey: string, toKey: string, note?: string) => call('/strategy-alignment/links', 'POST', { fromKey, toKey, ...(note ? { note } : {}) }),
  setValue: (nodeKey: string, year: number, period: string, value: string) => call('/strategy-alignment/values', 'POST', { nodeKey, year, period, value }),
  export: (year: number) => download(`/strategy-alignment/export?${q({ year })}`, `strategic-alignment-${year}.xlsx`),
  units: () => call<KpiUnit[]>('/strategy-alignment/kpis/units'),
  kpis: (unitId: string, year: number) => call<TrackedKpi[]>(`/strategy-alignment/kpis?${q({ unitId, year })}`),
  tracking: (kpiId: string, body: { reported?: boolean; frequency?: KpiFrequency | null; target?: string | null; unit?: string | null }) => call(`/strategy-alignment/kpis/${encodeURIComponent(kpiId)}/tracking`, 'PUT', body),
  measure: (kpiId: string, year: number, period: string, value: string, note?: string) => call(`/strategy-alignment/kpis/${encodeURIComponent(kpiId)}/measures`, 'POST', { year, period, value, ...(note ? { note } : {}) }),
  report: (unitId: string, year: number, period: string) => call<KpiReport>(`/strategy-alignment/kpis/report?${q({ unitId, year, period })}`),
  exportReport: (unitId: string, year: number, period: string) => download(`/strategy-alignment/kpis/report/export?${q({ unitId, year, period })}`, `kpi-report-${year}-${period}.xlsx`),
  setStrategyType: (refreshId: string, strategyType: string) => call(`/strategy-refreshes/${encodeURIComponent(refreshId)}/strategy-type`, 'POST', { strategyType }),
}
