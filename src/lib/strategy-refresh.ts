import { API_BASE, getToken } from './api'

export interface RefreshFinding {
  id: string; title: string; category: string; authority: string; confidence: number | null
  decision: string; revision: number; destination: string | null; publishedId: string | null; publishedAt: string | null
  publicationStatus?: string; publicationFailureCode?: string
  payload: { semanticType?: string; description?: string; ambiguity?: string; limitation?: string; classification?: string; explanation?: string; factId?: string; predecessorId?: string; warnings?: string[]; attributes?: Array<{ name: string; value: string; quote: string }> }
  evidence: any
}
export interface StrategyRefresh {
  id: string; title: string; strategyId: string; analysisStatus: string; strategyStatus: string; failureCode?: string; baseRefreshId?: string | null; warnings?: string[]
  strategy?: { name: string; strategyType: string }
  sources?: Array<{ id: string; filename: string; extractionStatus: string }>
  findings?: RefreshFinding[]
  summary?: Array<{ category: string; count: number; findingIds: string[] }>
  context?: { limitations: string[]; evidence: Array<{ id: string; module: string; authority: string; data: any }>; previous?: Array<{ id: string; title: string; payload: any; evidence: any }> }
  responseProgress?: { total: number; published: number; pending: number }
}

async function request<T>(path: string, body?: object | FormData): Promise<T> {
  const token = getToken()
  const isUpload = body instanceof FormData
  const response = await fetch(`${API_BASE}/strategy-refreshes${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(!isUpload && body ? { 'Content-Type': 'application/json' } : {}) },
    body: isUpload ? body : body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join('; ') : data.message || `HTTP ${response.status}`)
  return data as T
}
export const strategyRefreshApi = {
  list: () => request<StrategyRefresh[]>(''),
  get: (id: string) => request<StrategyRefresh>(`/${encodeURIComponent(id)}`),
  create: (title: string, strategyId?: string) => request<StrategyRefresh>('', { title, ...(strategyId ? { strategyId } : {}) }),
  upload: (id: string, file: File) => { const form = new FormData(); form.append('file', file); return request(`/${encodeURIComponent(id)}/documents`, form) },
  analyze: (id: string) => request<StrategyRefresh>(`/${encodeURIComponent(id)}/analyze`, {}),
  decide: (id: string, finding: RefreshFinding, action: 'APPROVE' | 'REJECT' | 'AMEND', reason: string, amendment?: { title: string; description: string }) => request(`/${encodeURIComponent(id)}/findings/${encodeURIComponent(finding.id)}/decisions`, { action, revision: finding.revision, reason, ...amendment }),
  activate: (id: string) => request(`/${encodeURIComponent(id)}/activate`, {}),
  source: (id: string, sourceId: string) => request<{ url: string }>(`/${encodeURIComponent(id)}/documents/${encodeURIComponent(sourceId)}/url`),
}
