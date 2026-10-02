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
  summary?: Array<{ id?: string; category: string; count: number; findingIds: string[]; measure?: 'FINDINGS' | 'REFERENCED_OBJECTS'; classification?: string; semanticType?: string }>
  context?: { limitations: string[]; evidence: Array<{ id: string; module: string; authority: string; data: any }>; previous?: Array<{ id: string; title: string; payload: any; evidence: any }> }
  responseProgress?: { total: number; published: number; pending: number }
  impact?: StrategyImpact | null
}

export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
export interface StrategyImpactedObject {
  assetId: string; name: string; assetType: string; typeLabel: string
  impactType: string; nature: 'DIRECT' | 'INDIRECT'; impactLevel: 'HIGH' | 'MEDIUM' | 'LOW'; description: string
  factIds: string[]; namedInStrategy: boolean
}
export interface StrategyImpactView {
  source: 'SAVED_VIEW' | 'VIEW_LIBRARY'; viewId: string | null; viewpointId: string | null; title: string; visualization: string
  architectureState: string; reason: string; objects: number; impactedShown: number
  image?: { mimeType: string; svg: string; width: number; height: number }
}
export interface StrategyDomainImpact {
  domain: string; domainName: string; status: 'ASSESSED' | 'FAILED' | 'NO_OBJECTS' | string
  objectCount: number; assessedCount: number; impactLevel: ImpactLevel; summary: string
  impactedObjects: StrategyImpactedObject[]; view?: StrategyImpactView
}
/** The refresh's EA impact register over the Current architecture (absent on refreshes analysed before it existed). */
export interface StrategyImpact {
  scope: 'CURRENT_ARCHITECTURE'; analyzedAt: string
  totals: { repositoryObjects: number; assessedObjects: number; impactedObjects: number; impactedDomains: number; namedObjects: number; notInRepository: number }
  domains: StrategyDomainImpact[]
  notInRepository: Array<{ name: string; factIds: string[] }>
  synthesis?: { headline: string; overview: string; keyMessages: string[] }
  limitations: string[]
}

export interface PublicationOptions {
  revision: number; actions: string[]
  objectTypes: Array<{ id: string; code: string; name: string; operatingDomain: string; canCreate: boolean; canUpdate: boolean; attributeMapping?: { properties: Record<string, unknown>; unmapped: Array<{ name: string; value: string; reason: string }> } }>
  relationships: Array<{ id: string; code: string; forwardLabel: string }>
  assets: Array<{ id: string; name: string; assetType: string; domain: string; editable?: boolean }>
  plans: Array<{ id: string; name: string }>; cycles: Array<{ id: string; name: string }>
  views: Array<{ id: string; name: string; scenarioId: string; scenarioType: string }>
  governanceFrameworks?: string[]; governanceReviewTypes?: string[]
}

export interface PublicationPropertyOptions {
  versionId: string
  properties: Array<{ code: string; name: string; nameAr?: string | null; attributeType: string; isRequired: boolean; values: Array<{ code: string; name: string; nameAr?: string | null }> }>
}
export interface PublicationPreview {
  valid: boolean; representation: 'PROPOSAL_OVERLAY_NOT_APPLIED'; originalAuthority: string
  image: { svg: string }; issues: Array<{ severity: string; message: string }>
  annotations: Array<{ assetId: string; operation: string; visibleInRecordedView: boolean; properties: Array<{ code: string; recordedValue: unknown; proposedValue: unknown }> }>
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
  publicationOptions: (id: string, findingId: string) => request<PublicationOptions>(`/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/publication-options`),
  propertyOptions: (id: string, findingId: string, assetId: string) => request<PublicationPropertyOptions>(`/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/property-options/${encodeURIComponent(assetId)}`),
  preview: (id: string, finding: RefreshFinding, contract: Record<string, unknown>) => request<PublicationPreview>(`/${encodeURIComponent(id)}/findings/${encodeURIComponent(finding.id)}/publication-preview`, { ...contract, revision: finding.revision }),
  publish: (id: string, finding: RefreshFinding, contract: Record<string, unknown>) => request(`/${encodeURIComponent(id)}/findings/${encodeURIComponent(finding.id)}/publication`, { ...contract, revision: finding.revision }),
  cancelPublication: (id: string, findingId: string) => request(`/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/publication/cancel`, {}),
  rerun: (id: string) => request<StrategyRefresh>(`/${encodeURIComponent(id)}/rerun`, {}),
  /** The uploaded document, streamed through the API (tenant-scoped; no signed storage URL). */
  source: async (id: string, sourceId: string): Promise<Blob> => {
    const token = getToken()
    const response = await fetch(`${API_BASE}/strategy-refreshes/${encodeURIComponent(id)}/documents/${encodeURIComponent(sourceId)}/content`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || `HTTP ${response.status}`)
    }
    return response.blob()
  },
}
