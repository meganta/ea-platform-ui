// Shared types and helpers for the Reference Architectures workspace.

export type T = (k: string) => string

export interface RefElement {
  id?: string
  stableKey: string
  parentKey: string | null
  kind: string
  name: string
  nameAr?: string | null
  description?: string | null
  descriptionAr?: string | null
  sortOrder?: number
  obligation?: string
  expectedCardinality?: string
  metaModelTypeCodes: string[]
  metaModelStatus: string
  metaModelNote?: string | null
  nationalElementKey?: string | null
  disposition?: string | null
  provenance?: any
  authority?: string
  reviewStatus?: string
  changeClass?: string | null
}

export interface ElementConformance {
  stableKey: string
  name: string
  nameAr?: string | null
  kind: string
  parentKey?: string | null
  obligation: string
  status: string
  absence: string | null
  reason: string
  realizedBy: Array<{ linkId: string; objectId: string; name: string | null; linkType: string; present: boolean; lifecycleStatus: string | null }>
  deviations: Array<{ linkId: string; objectId: string; name: string | null }>
  exceptions: Array<{ linkId: string; objectId: string; name: string | null; expiresAt: string | null; expired: boolean }>
  proposedLinks: number
  duplication: boolean
  traces?: Array<{ id: string; linkType: string; targetModule: string; targetId: string; targetName: string | null; targetType: string }>
  decision?: { outcome: string; rationale: string; decidedAt: string } | null
  metaModelTypeCodes?: string[]
  metaModelStatus?: string
  disposition?: string | null
}

/** Conformance colours: one meaning each, from the design tokens where they exist. */
export const STATUS_COLOR: Record<string, string> = {
  ALIGNED: 'var(--success)',
  PARTIALLY_ALIGNED: '#65A30D',
  APPROVED_EXCEPTION: '#7C3AED',
  DEVIATION: 'var(--danger)',
  GAP: 'var(--warning)',
  NOT_ASSESSED: '#94A3B8',
  INSUFFICIENT_DATA: '#64748B',
  NOT_APPLICABLE: '#CBD5E1',
}
export const STATUS_ORDER = ['ALIGNED', 'PARTIALLY_ALIGNED', 'APPROVED_EXCEPTION', 'DEVIATION', 'GAP', 'NOT_ASSESSED', 'INSUFFICIENT_DATA', 'NOT_APPLICABLE']

export const localName = (o: { name: string; nameAr?: string | null }, isAR: boolean) => (isAR && o.nameAr ? o.nameAr : o.name)
export const localDescription = (o: { description?: string | null; descriptionAr?: string | null }, isAR: boolean) => (isAR ? o.descriptionAr || o.description : o.description || o.descriptionAr) || ''

/** Children by parent key, ordered; elements whose parent is missing become roots. */
export function buildTree<E extends { stableKey: string; parentKey?: string | null; sortOrder?: number }>(elements: E[]) {
  const keys = new Set(elements.map(e => e.stableKey))
  const children = new Map<string, E[]>()
  const roots: E[] = []
  for (const e of elements) {
    if (e.parentKey && keys.has(e.parentKey)) children.set(e.parentKey, [...(children.get(e.parentKey) || []), e])
    else roots.push(e)
  }
  const sort = (l: E[]) => l.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  sort(roots)
  children.forEach(l => sort(l))
  return { roots, children }
}

export function makeApi(base: string) {
  const token = () => localStorage.getItem('ea_token')
  const handle = async (r: Response) => {
    const text = await r.text()
    const body = text ? JSON.parse(text) : null
    if (!r.ok) throw new Error(body?.message ? (Array.isArray(body.message) ? body.message.join(', ') : body.message) : `HTTP ${r.status}`)
    return body
  }
  const json = (method: string) => (path: string, body?: any) => fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }).then(handle)
  return {
    get: (path: string) => fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(handle),
    post: json('POST'),
    patch: json('PATCH'),
    del: (path: string) => fetch(`${base}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(handle),
    upload: (path: string, file: File) => { const fd = new FormData(); fd.append('file', file); return fetch(`${base}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd }).then(handle) },
  }
}
export type RefApi = ReturnType<typeof makeApi>
