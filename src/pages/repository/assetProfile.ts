import { apiFetch } from '../../lib/session'
/** Client and types for an EA Repository object's Meta Model-driven profile (view + edit). */
const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

export interface EnumOption { value: string; label: string; labelAr?: string | null; color?: string | null }
export interface ProfileAttribute {
  code: string; name: string; nameAr?: string | null; description?: string | null; helpText?: string | null; helpTextAr?: string | null
  attributeType: string; isRequired: boolean; isReadOnly: boolean; placeholder?: string | null; defaultValue?: string | null
  validationRules?: any; displayConfig?: any; enumValues?: EnumOption[]; value: any; hasValue: boolean
}
export interface ProfileGroup { id: string; name: string; nameAr?: string | null; isCollapsed: boolean; attributes: ProfileAttribute[] }
export interface RelatedAsset { id: string; name: string; nameAr?: string | null; assetType: string; status?: string | null; lifecycleStatus?: string | null; typeLabel?: string | null }
export interface RelationshipAttribute { code: string; name: string; nameAr?: string | null; attributeType: string; isRequired: boolean; enumValues?: EnumOption[] }
export interface SlotItem { relationshipId: string; label?: string | null; metadata: Record<string, any>; relatedAsset: RelatedAsset }
export interface RelationshipSlot {
  definitionId: string; code: string; name: string; nameAr?: string | null; description?: string | null
  direction: 'OUTGOING' | 'INCOMING'; label: string; labelAr?: string | null
  otherType: { id: string; code: string; name: string; nameAr?: string | null; icon?: string | null; color?: string | null } | null
  forwardLabel: string; cardinality: string; single: boolean; isRequired: boolean; attributes: RelationshipAttribute[]
  count: number; items: SlotItem[]; truncated: boolean
}
export interface AssetProfile {
  asset: any
  objectType: { id: string; code: string; name: string; nameAr?: string | null; singularLabel?: string; singularLabelAr?: string | null; icon?: string; color?: string; description?: string | null } | null
  resolution: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS' | 'NO_META_MODEL'
  /** The Meta Model version the attributes and relationships come from. */
  metaModel?: { versionId: string; version: string | null; status: string | null } | null
  attributeGroups: ProfileGroup[]
  otherAttributes: Array<{ key: string; value: any }>
  completeness: { filled: number; total: number; requiredMissing: string[] }
  relationshipSlots: RelationshipSlot[]
  otherRelationships: Array<{ relationshipId: string; direction: 'OUTGOING' | 'INCOMING'; label: string; relationshipType: string; metadata: any; relatedAsset: RelatedAsset }>
  relationshipTotals: { linked: number; truncated: boolean }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('ea_token')
  const res = await apiFetch(`${API_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${token || ''}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join('; ') : data.message || `HTTP ${res.status}`)
  return data as T
}

export const assetProfileApi = {
  profile: (id: string) => call<AssetProfile>(`/ea-repository/assets/${encodeURIComponent(id)}/profile`),
  /** The attributes a Meta Model object type defines (used when an object's type is changed). */
  typeAttributes: (assetType: string) => call<{ attributes: any[] }>(`/ea-repository/object-types/${encodeURIComponent(assetType)}/attributes`),
  candidates: (id: string, definitionId: string, direction: string, search: string) =>
    call<{ items: RelatedAsset[]; total: number }>(`/ea-repository/assets/${encodeURIComponent(id)}/relationship-candidates?definitionId=${encodeURIComponent(definitionId)}&direction=${direction}&search=${encodeURIComponent(search)}`),
  updateAsset: (id: string, body: any) => call(`/ea-repository/assets/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body) }),
  link: (body: { sourceId: string; targetId: string; relationshipType: string; relationshipDefinitionId: string; metadata?: any }) => call<{ id: string }>('/ea-repository/relationships', { method: 'POST', body: JSON.stringify(body) }),
  unlink: (relationshipId: string) => call(`/ea-repository/relationships/${encodeURIComponent(relationshipId)}`, { method: 'DELETE' }),
  updateLink: (relationshipId: string, metadata: any) => call(`/ea-repository/relationships/${encodeURIComponent(relationshipId)}`, { method: 'PATCH', body: JSON.stringify({ metadata }) }),
}

/** The value a field input works with, from a stored value. */
export function toInputValue(type: string, value: any): any {
  if (value === null || value === undefined) return type === 'MULTI_ENUM' || type === 'MULTI_REFERENCE' ? [] : type === 'BOOLEAN' ? '' : ''
  if (type === 'MULTI_ENUM' || type === 'MULTI_REFERENCE') return Array.isArray(value) ? value.map(String) : String(value).split(/\s*[,;]\s*/).filter(Boolean)
  if (type === 'BOOLEAN') return value === true || value === 'true' ? 'true' : value === false || value === 'false' ? 'false' : ''
  if (type === 'DATE') return String(value).slice(0, 10)
  if (type === 'DATETIME') return String(value).slice(0, 16)
  if (type === 'JSON_DATA' && typeof value === 'object') return JSON.stringify(value, null, 2)
  return typeof value === 'object' ? JSON.stringify(value) : String(value)
}

/** The value stored for an input value (numbers as numbers, booleans as booleans, empty as null). */
export function fromInputValue(type: string, input: any): any {
  if (type === 'MULTI_ENUM' || type === 'MULTI_REFERENCE') return Array.isArray(input) && input.length ? input : null
  if (input === '' || input === null || input === undefined) return null
  if (type === 'BOOLEAN') return input === 'true'
  if (['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'MATURITY_SCORE'].includes(type)) { const n = Number(input); return Number.isFinite(n) ? n : input }
  if (type === 'JSON_DATA') { try { return JSON.parse(input) } catch { return input } }
  return input
}

/** Problems with an input value, as translation keys (empty when valid). */
export function validateValue(attr: { attributeType: string; isRequired: boolean; validationRules?: any }, input: any): string | null {
  const empty = input === '' || input === null || input === undefined || (Array.isArray(input) && !input.length)
  if (empty) return attr.isRequired ? 'repository.profile.error.required' : null
  const type = attr.attributeType
  if (['INTEGER', 'DECIMAL', 'PERCENTAGE', 'CURRENCY', 'MATURITY_SCORE'].includes(type)) {
    const n = Number(input)
    if (!Number.isFinite(n)) return 'repository.profile.error.number'
    if (type === 'INTEGER' && !Number.isInteger(n)) return 'repository.profile.error.integer'
    if (type === 'PERCENTAGE' && (n < 0 || n > 100)) return 'repository.profile.error.percentage'
    const rules = attr.validationRules || {}
    if (typeof rules.min === 'number' && n < rules.min) return 'repository.profile.error.min'
    if (typeof rules.max === 'number' && n > rules.max) return 'repository.profile.error.max'
  }
  if (type === 'URL' && !/^https?:\/\/\S+$/i.test(String(input))) return 'repository.profile.error.url'
  if (type === 'EMAIL' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(input))) return 'repository.profile.error.email'
  if (type === 'JSON_DATA') { try { JSON.parse(input) } catch { return 'repository.profile.error.json' } }
  return null
}

/** A stored value as readable text (enum codes shown as their labels). */
export function displayValue(attr: { attributeType: string; enumValues?: EnumOption[] }, value: any, isAR = false): string {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return ''
  const label = (code: any) => { const o = attr.enumValues?.find(e => e.value === String(code)); return o ? (isAR && o.labelAr) || o.label : String(code) }
  if (Array.isArray(value)) return value.map(label).join(', ')
  if (attr.enumValues?.length) return label(value)
  if (attr.attributeType === 'BOOLEAN' || typeof value === 'boolean') return value === true || value === 'true' ? (isAR ? 'نعم' : 'Yes') : (isAR ? 'لا' : 'No')
  if (attr.attributeType === 'PERCENTAGE') return `${value}%`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export const localName = (o: { name?: string; nameAr?: string | null } | null | undefined, isAR: boolean) => (o ? (isAR && o.nameAr) || o.name || '' : '')
