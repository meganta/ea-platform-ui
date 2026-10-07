import { createContext, useContext } from 'react'

export type Severity = 'BREAKING' | 'POTENTIALLY_BREAKING' | 'NON_BREAKING'
export type ChangeKind = 'DOMAIN' | 'OBJECT_TYPE' | 'ATTRIBUTE' | 'RELATIONSHIP'

export interface UsageRef { id: string; name: string }
export interface ChangeImpact {
  severity: Severity
  objects: number
  links: number
  /** Links without a relationship today that publishing reconnects to this one. */
  reconnects?: number
  values: number
  views: UsageRef[]
  referenceElements: UsageRef[]
  consequences: string[]
}
export interface ReleaseChange {
  key: string
  kind: ChangeKind
  action: 'ADDED' | 'REMOVED' | 'MODIFIED'
  code: string
  ownerCode?: string
  name: string
  fields: { field: string; before: unknown; after: unknown }[]
  impact: ChangeImpact
}
export interface ReleaseImpact {
  version: { id: string; version: string; status: string; description?: string | null }
  basedOn: { id: string; version: string; publishedAt?: string } | null
  summary: { total: number; breaking: number; potentiallyBreaking: number; nonBreaking: number; requiresAcknowledgement: boolean }
  changes: ReleaseChange[]
}
export interface MetaModelVersion {
  id: string
  version: string
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED' | 'ARCHIVED'
  description?: string | null
  publishedAt?: string | null
  createdAt?: string
  _count?: { domains?: number; objectTypes?: number; relationships?: number }
}
export interface WhereUsed {
  kind: string
  item: { id: string; code: string; name: string }
  version: { id: string; version: string; status: string }
  editable: boolean
  canDelete: boolean
  blocked: string | null
  warning?: string | null
  impact: ChangeImpact
  sampleObjects?: UsageRef[]
  sampleLinks?: { id: string; source: string; target: string }[]
  relationships?: { id: string; code: string; name: string; label: string; from?: string; to?: string; links: number }[]
  objectTypes?: { id: string; code: string; name: string }[]
  attributeCount?: number
}

/** Release state of the studio: whether the screens edit a draft or show the published version read-only. */
export interface MetaModelRelease {
  versions: MetaModelVersion[]
  draft: MetaModelVersion | null
  published: MetaModelVersion | null
  /** True only while a draft is open: every add/edit/delete targets it. */
  editable: boolean
  reload: () => void
}

export function releaseState(versions: MetaModelVersion[], reload: () => void): MetaModelRelease {
  const draft = versions.find(v => v.status === 'DRAFT') || null
  const published = versions.find(v => v.status === 'PUBLISHED') || null
  return { versions, draft, published, editable: !!draft, reload }
}

export const ReleaseContext = createContext<MetaModelRelease>({ versions: [], draft: null, published: null, editable: true, reload: () => {} })
export const useRelease = () => useContext(ReleaseContext)

export const SEVERITY_COLOR: Record<Severity, string> = { BREAKING: '#e74c3c', POTENTIALLY_BREAKING: '#f39c12', NON_BREAKING: '#2ecc71' }

export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))
}
