// Government Outreach client (backend `/owner/outreach/*`, platform owners
// only; see ea-platform docs/platform-owner/outreach). The server enforces
// every permission and every outreach gate; this client only calls it.
import { API_BASE, getToken } from '../../../lib/api'
import { call, handle, qs } from '../ownerApi'

type Q = Record<string, string | undefined | null>

export const outreachApi = {
  dashboard: () => call('GET', '/owner/outreach/dashboard'),
  settings: () => call('GET', '/owner/outreach/settings'),
  saveSettings: (dto: any) => call('PUT', '/owner/outreach/settings', dto),
  providers: () => call('GET', '/owner/outreach/providers'),
  suppressions: () => call('GET', '/owner/outreach/suppressions'),
  suppressDomain: (dto: { domain: string; reason: string }) => call('POST', '/owner/outreach/suppressions/domains', dto),
  materials: () => call('GET', '/owner/outreach/materials'),
  uploadMaterial: (file: File, makeDefault: boolean) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('makeDefault', String(makeDefault))
    return fetch(`${API_BASE}/owner/outreach/materials`, { method: 'POST', headers: { Authorization: `Bearer ${getToken() || ''}` }, body: fd }).then(handle)
  },
  setDefaultMaterial: (id: string) => call('PUT', `/owner/outreach/materials/${id}/default`),
  archiveMaterial: (id: string) => call('DELETE', `/owner/outreach/materials/${id}`),
  downloadMaterial: async (id: string, fileName: string) => {
    const r = await fetch(`${API_BASE}/owner/outreach/materials/${id}/content`, { headers: { Authorization: `Bearer ${getToken() || ''}` } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a')
    a.href = url; a.download = fileName; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
  entities: (f: Q = {}) => call('GET', `/owner/outreach/entities${qs(f)}`),
  addEntity: (dto: any) => call('POST', '/owner/outreach/entities', dto),
  entity: (id: string) => call('GET', `/owner/outreach/entities/${id}`),
  updateEntity: (id: string, dto: any) => call('PUT', `/owner/outreach/entities/${id}`, dto),
  deleteEntity: (id: string) => call('DELETE', `/owner/outreach/entities/${id}`),
  rematch: (id: string) => call('POST', `/owner/outreach/entities/${id}/match`),
  linkTenant: (id: string, tenantId: string) => call('POST', `/owner/outreach/entities/${id}/link-tenant`, { tenantId }),
  createTenant: (id: string, dto: any) => call('POST', `/owner/outreach/entities/${id}/tenant`, dto),
  enrich: (id: string, dto: { scopes?: string[] } = {}) => call('POST', `/owner/outreach/entities/${id}/enrich`, dto),
  prepareViews: (id: string) => call('POST', `/owner/outreach/entities/${id}/views/prepare`, {}),
  suppressEntity: (id: string, dto: { suppressed: boolean; reason: string }) => call('PUT', `/owner/outreach/entities/${id}/suppression`, dto),
  discover: (dto: any) => call('POST', '/owner/outreach/discovery', dto),
  jobs: (f: Q = {}) => call('GET', `/owner/outreach/discovery${qs(f)}`),
  job: (id: string) => call('GET', `/owner/outreach/discovery/${id}`),
  advance: (id: string) => call('POST', `/owner/outreach/discovery/${id}/advance`),
  completeJob: (id: string) => call('POST', `/owner/outreach/discovery/${id}/complete`),
  cancelJob: (id: string) => call('POST', `/owner/outreach/discovery/${id}/cancel`),
  interpret: (q: string) => call('GET', `/owner/outreach/search/interpret${qs({ q })}`),
  prospects: (f: Q = {}) => call('GET', `/owner/outreach/prospects${qs(f)}`),
  addProspect: (dto: any) => call('POST', '/owner/outreach/prospects', dto),
  prospect: (id: string) => call('GET', `/owner/outreach/prospects/${id}`),
  updateProspect: (id: string, dto: any) => call('PUT', `/owner/outreach/prospects/${id}`, dto),
  verify: (id: string, note: string) => call('POST', `/owner/outreach/prospects/${id}/verify`, { note }),
  setStage: (prospectIds: string[], stage: string) => call('PUT', '/owner/outreach/prospects/stage', { prospectIds, stage }),
  doNotContact: (id: string, reason: string) => call('PUT', `/owner/outreach/prospects/${id}/do-not-contact`, { reason }),
  clearDoNotContact: (id: string, reason: string) => call('POST', `/owner/outreach/prospects/${id}/do-not-contact/clear`, { reason }),
  erase: (id: string, dto: { suppress: boolean; reason: string }) => call('POST', `/owner/outreach/prospects/${id}/erase`, dto),
  invitations: (dto: { prospectIds: string[]; roles?: any; password?: string }) => call('POST', '/owner/outreach/invitations', dto),
  campaigns: () => call('GET', '/owner/outreach/campaigns'),
  createCampaign: (dto: any) => call('POST', '/owner/outreach/campaigns', dto),
  campaign: (id: string) => call('GET', `/owner/outreach/campaigns/${id}`),
  updateCampaign: (id: string, dto: any) => call('PUT', `/owner/outreach/campaigns/${id}`, dto),
  addMembers: (id: string, dto: { entityIds?: string[]; prospectIds?: string[] }) => call('POST', `/owner/outreach/campaigns/${id}/members`, dto),
  drafts: (id: string, dto: { prospectIds: string[]; language?: string; strategy?: Strategy; linkedinType?: string }) => call('POST', `/owner/outreach/campaigns/${id}/messages`, dto),
  send: (id: string, dto: { messageIds: string[]; password: string }) => call('POST', `/owner/outreach/campaigns/${id}/send`, dto),
  preview: (id: string) => call('GET', `/owner/outreach/interactions/${id}/preview`),
  updateInteraction: (id: string, dto: any) => call('PUT', `/owner/outreach/interactions/${id}`, dto),
  regenerate: (id: string) => call('POST', `/owner/outreach/interactions/${id}/regenerate`),
  approve: (messageIds: string[]) => call('POST', '/owner/outreach/interactions/approve', { messageIds }),
  cancelInteraction: (id: string) => call('POST', `/owner/outreach/interactions/${id}/cancel`),
  recordOutcome: (id: string, dto: { outcome: 'SENT' | 'REPLIED' | 'FAILED'; note?: string }) => call('POST', `/owner/outreach/interactions/${id}/outcome`, dto),
  linkedinPage: () => call('GET', '/owner/outreach/linkedin-page'),
  linkedinPageConnect: () => call('POST', '/owner/outreach/linkedin-page/connect'),
  linkedinPageCallback: (dto: { code: string; state: string }) => call('POST', '/owner/outreach/linkedin-page/callback', dto),
  linkedinPageSelect: (organizationUrn: string) => call('POST', '/owner/outreach/linkedin-page/select', { organizationUrn }),
  linkedinPageDisconnect: (password: string) => call('POST', '/owner/outreach/linkedin-page/disconnect', { password }),
  linkedinPageUrl: (url: string) => call('PUT', '/owner/outreach/linkedin-page/url', { url }),
  pagePosts: (status?: string) => call('GET', `/owner/outreach/page-posts${qs({ status })}`),
  createPagePost: (dto: { kind: string; topic: string; language?: string; entityId?: string; entityConsentNote?: string }) => call('POST', '/owner/outreach/page-posts', dto),
  pagePost: (id: string) => call('GET', `/owner/outreach/page-posts/${id}`),
  updatePagePost: (id: string, dto: { body?: string; language?: string }) => call('PUT', `/owner/outreach/page-posts/${id}`, dto),
  regeneratePagePost: (id: string) => call('POST', `/owner/outreach/page-posts/${id}/regenerate`),
  approvePagePost: (id: string) => call('POST', `/owner/outreach/page-posts/${id}/approve`),
  cancelPagePost: (id: string) => call('POST', `/owner/outreach/page-posts/${id}/cancel`),
  publishPagePost: (id: string, password: string) => call('POST', `/owner/outreach/page-posts/${id}/publish`, { password }),
  recordPagePost: (id: string, dto: { postUrl?: string; note?: string }) => call('POST', `/owner/outreach/page-posts/${id}/published`, dto),
  timeline: (id: string) => call('GET', `/owner/outreach/prospects/${id}/timeline`),
  setLinkedInStatus: (id: string, dto: { status: string; note?: string }) => call('PUT', `/owner/outreach/prospects/${id}/linkedin-status`, dto),
}

export const ENTITY_TYPES = ['MINISTRY', 'AUTHORITY', 'FUND', 'COMMISSION', 'AGENCY', 'CENTER', 'PROGRAM', 'CORPORATION', 'COUNCIL', 'PLATFORM', 'OTHER_PUBLIC']
export const ROLE_CATEGORIES = ['ENTERPRISE_ARCHITECTURE', 'DIGITAL_TRANSFORMATION', 'DIGITAL_INNOVATION', 'DIGITAL_STRATEGY', 'TECHNOLOGY_STRATEGY', 'OTHER_RELEVANT']
export const SENIORITIES = ['EXECUTIVE', 'DIRECTOR', 'HEAD', 'MANAGER', 'CONSULTANT', 'ARCHITECT', 'OTHER']
export const GOV_STATUSES = ['CONFIRMED_GOVERNMENT', 'LIKELY_GOVERNMENT', 'UNVERIFIED', 'NOT_GOVERNMENT']
export const EMPLOYMENT = ['CURRENT_CONFIRMED', 'CURRENT_LIKELY', 'CURRENT_STATUS_UNCERTAIN', 'FORMER']
export const EMAIL_STATUSES = ['VERIFIED_PUBLIC', 'OWNER_PROVIDED', 'UNAVAILABLE']
export const STAGES = ['DISCOVERED', 'VERIFIED', 'SHORTLISTED', 'TENANT_PREPARED', 'INVITATION_PREPARED', 'OUTREACH_READY', 'CONTACTED', 'INVITED', 'ACTIVATED', 'ENGAGED', 'NOT_INTERESTED', 'INVALID', 'DO_NOT_CONTACT']
export const MANUAL_STAGES = ['DISCOVERED', 'VERIFIED', 'SHORTLISTED', 'CONTACTED', 'NOT_INTERESTED', 'INVALID']
export const TENANT_MATCHES = ['EXISTING_TENANT', 'POSSIBLE_MATCH', 'NEW_ENTITY']
export const ENTITY_OUTREACH = ['NOT_STARTED', 'PROSPECTS_FOUND', 'PREPARING', 'CONTACTED', 'ACTIVATED', 'ENGAGED']
export const JOB_RUNNING = ['QUEUED', 'ENTITY_DISCOVERY', 'PROFESSIONAL_DISCOVERY', 'VERIFICATION', 'CLASSIFICATION', 'DEDUPLICATION', 'ENTITY_MAPPING']
export const JOB_STAGES = ['DISCOVERY', 'VERIFICATION', 'CLASSIFICATION', 'DEDUPLICATION', 'ENTITY_MAPPING', 'READY_FOR_REVIEW', 'COMPLETED']
export type Strategy = 'EMAIL' | 'LINKEDIN' | 'BOTH'
export const POST_KINDS = ['THOUGHT_LEADERSHIP', 'PRODUCT_UPDATE', 'ENTITY_WELCOME', 'EVENT']
export const POST_STATUSES = ['READY_FOR_REVIEW', 'APPROVED', 'PUBLISHED', 'FAILED', 'CANCELLED']
export const PAGE_STATUSES = ['NOT_CONNECTED', 'SELECT_ORGANIZATION', 'CONNECTED', 'EXPIRED', 'ERROR']
export const POST_MAX = 3000
export const POST_COLOR: Record<string, string> = { READY_FOR_REVIEW: 'var(--warning)', APPROVED: '#0EA5E9', PUBLISHED: 'var(--success)', FAILED: 'var(--danger)', CANCELLED: '#94A3B8' }
export const MESSAGE_STATUSES = ['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SENT', 'DELIVERED', 'REPLIED', 'FAILED', 'CANCELLED']
/** Statuses that can still be edited, regenerated, approved or cancelled. */
export const EDITABLE_STATUSES = ['DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'FAILED']
export const REVIEW_STATUSES = ['DRAFT', 'READY_FOR_REVIEW']
export const SENT_STATUSES = ['SENT', 'DELIVERED', 'REPLIED']
export const CHANNELS = ['EMAIL', 'LINKEDIN']
export const INTERACTION_TYPES = ['EMAIL', 'CONNECTION_REQUEST', 'DIRECT_MESSAGE', 'INVITATION']
export const STRATEGIES: Strategy[] = ['EMAIL', 'LINKEDIN', 'BOTH']
export const LINKEDIN_TYPES = ['AUTO', 'CONNECTION_REQUEST', 'DIRECT_MESSAGE']
export const LINKEDIN_STATUSES = ['UNKNOWN', 'NOT_CONNECTED', 'CONNECTION_REQUEST_PREPARED', 'CONNECTION_REQUEST_SENT', 'CONNECTED', 'MESSAGE_PREPARED', 'MESSAGE_SENT', 'REPLIED', 'DO_NOT_CONTACT']
/** LinkedIn statuses the owner records by hand (the rest follow from actions). */
export const OWNER_LINKEDIN_STATUSES = ['UNKNOWN', 'NOT_CONNECTED', 'CONNECTION_REQUEST_SENT', 'CONNECTED', 'MESSAGE_SENT', 'REPLIED']
export const LINKEDIN_CONNECTED = ['CONNECTED', 'MESSAGE_PREPARED', 'MESSAGE_SENT', 'REPLIED']
export const RECOMMENDATIONS = ['LINKEDIN_THEN_EMAIL', 'LINKEDIN', 'EMAIL', 'NONE']
export const FUNNEL = ['DISCOVERED', 'VERIFIED', 'CONTACTED', 'CONNECTED', 'INVITED', 'ACTIVATED', 'ENGAGED']
export const TIMELINE_KINDS = [
  'DISCOVERED', 'ADDED', 'PROSPECT_MODIFIED', 'PROSPECT_ENTITY_CHANGED', 'PROSPECT_VERIFIED', 'PROSPECT_STAGE_SET', 'LINKEDIN_STATUS_RECORDED', 'INVITATION_CREATED',
  'INTERACTION_PREPARED', 'INTERACTION_MODIFIED', 'INTERACTION_REGENERATED', 'INTERACTION_APPROVED', 'INTERACTION_CANCELLED', 'INTERACTION_SENT', 'INTERACTION_SENT_MANUALLY',
  'INTERACTION_REPLIED', 'INTERACTION_FAILED', 'INTERACTION_GENERATED',
  'DO_NOT_CONTACT_SET', 'DO_NOT_CONTACT_CLEARED', 'RECIPIENT_OPTED_OUT', 'TENANT_CREATED', 'ENTITY_TENANT_LINKED', 'TENANT_ENRICHMENT_STARTED', 'TENANT_VIEWS_PREPARED',
  'WORKSPACE_ENRICHED', 'INVITATION_ACCEPTED', 'INVITATION_ACTIVATED',
]
export const BLOCKERS = ['DO_NOT_CONTACT', 'ENTITY_SUPPRESSED', 'SUPPRESSED_EMAIL', 'SUPPRESSED_PERSON', 'SUPPRESSED_DOMAIN', 'NOT_GOVERNMENT', 'FORMER_EMPLOYEE', 'EMPLOYMENT_UNVERIFIED', 'EMAIL_UNAVAILABLE', 'NO_TENANT', 'INVALID', 'NOT_INTERESTED', 'ALREADY_ACTIVATED', 'NO_INVITATION', 'INVITATION_FAILED', 'ATTACHMENT_UNAVAILABLE', 'LINKEDIN_UNAVAILABLE', 'LINKEDIN_ALREADY_REQUESTED', 'LINKEDIN_MESSAGE_PENDING', 'LINKEDIN_ALREADY_MESSAGED', 'LINKEDIN_TOO_LONG', 'CHANNEL_UNAVAILABLE', 'MANUAL_REQUIRED']
export const TEMPLATE_ROLES = ['chief-enterprise-architect', 'ea-contributor', 'ea-reviewer', 'ea-viewer', 'executive-viewer', 'guest-viewer', 'tenant-administrator']
export const LEGACY_ROLES = ['ARCHITECT', 'REVIEWER', 'TENANT_ADMIN', 'SUPERADMIN']

export const GOV_COLOR: Record<string, string> = { CONFIRMED_GOVERNMENT: 'var(--success)', LIKELY_GOVERNMENT: '#0EA5E9', UNVERIFIED: 'var(--warning)', NOT_GOVERNMENT: 'var(--danger)' }
export const EMPLOYMENT_COLOR: Record<string, string> = { CURRENT_CONFIRMED: 'var(--success)', CURRENT_LIKELY: '#0EA5E9', CURRENT_STATUS_UNCERTAIN: 'var(--warning)', FORMER: 'var(--danger)' }
export const EMAIL_COLOR: Record<string, string> = { VERIFIED_PUBLIC: 'var(--success)', OWNER_PROVIDED: '#0EA5E9', UNAVAILABLE: '#94A3B8' }
export const MATCH_COLOR: Record<string, string> = { EXISTING_TENANT: 'var(--success)', POSSIBLE_MATCH: 'var(--warning)', NEW_ENTITY: '#0EA5E9' }
export const MESSAGE_COLOR: Record<string, string> = { DRAFT: '#94A3B8', READY_FOR_REVIEW: 'var(--warning)', APPROVED: '#0EA5E9', SENT: 'var(--success)', DELIVERED: 'var(--success)', REPLIED: '#7C3AED', FAILED: 'var(--danger)', CANCELLED: '#94A3B8' }
export const LINKEDIN_COLOR: Record<string, string> = { UNKNOWN: '#94A3B8', NOT_CONNECTED: '#94A3B8', CONNECTION_REQUEST_PREPARED: 'var(--warning)', CONNECTION_REQUEST_SENT: '#0EA5E9', CONNECTED: 'var(--success)', MESSAGE_PREPARED: 'var(--warning)', MESSAGE_SENT: '#0EA5E9', REPLIED: '#7C3AED', DO_NOT_CONTACT: 'var(--danger)' }

/** Display name in the reader's language (Arabic name when reading Arabic and one exists). */
export function entityName(e: { nameEn?: string; nameAr?: string | null } | null | undefined, isAR: boolean) {
  if (!e) return '—'
  return (isAR && e.nameAr) || e.nameEn || e.nameAr || '—'
}
