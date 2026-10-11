// Architecture Roadmap: client and pure helpers (unit-tested). Every number is the backend's; nothing here recomputes it.

export const API = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

export function makeRoadmapApi(base: string = API) {
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
    put: json('PUT'),
    patch: json('PATCH'),
    del: (path: string) => fetch(`${base}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(handle),
  }
}
export type RoadmapApi = ReturnType<typeof makeRoadmapApi>

export function fill(text: string, vars: Record<string, string | number | null | undefined>) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString())
}

/** A date as YYYY-MM-DD (dates are stored as midnight UTC), or '' when none. */
export function day(d: string | Date | null | undefined): string {
  if (!d) return ''
  const x = new Date(d)
  return Number.isNaN(x.getTime()) ? '' : x.toISOString().slice(0, 10)
}

export interface LineState { id: string; name: string; label: 'CURRENT' | 'TRANSITION' | 'TARGET'; transitionNumber?: number; status: string; horizonDate: string | null; achievedAt: string | null; owner?: string | null; changes?: number; unplanned?: number; workPackages?: number; delivered?: number }

/** "Transition 2" / "Target" / "Current" label for a state, translated. */
export function stateLabel(s: Pick<LineState, 'label' | 'transitionNumber'>, t: (k: string) => string) {
  return fill(t(`roadmap.label.${s.label}`), { n: s.transitionNumber ?? '' })
}

/** The status shown for a state: achieved wins over approved/draft. */
export function stateStatus(s: Pick<LineState, 'status' | 'achievedAt'>): 'ACHIEVED' | 'APPROVED' | 'DRAFT' {
  return s.achievedAt ? 'ACHIEVED' : s.status === 'APPROVED' ? 'APPROVED' : 'DRAFT'
}

/** The warning sentence for a backend warning code. */
export function warningText(w: { code: string; name?: string | null; count?: number | null; date?: string | null }, t: (k: string) => string) {
  return fill(t(`roadmap.warn.${w.code}`), { name: w.name ?? '', count: w.count ?? '', date: day(w.date) })
}

/** Moves an item one place earlier (-1) or later (+1) in a list. */
export function move<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir
  if (j < 0 || j >= list.length) return list
  const out = [...list]
  ;[out[index], out[j]] = [out[j], out[index]]
  return out
}

/** Inserts a state into the ordered transitions by its date (undated ones go last). */
export function insertByDate<T extends { id: string; horizonDate?: string | null }>(list: T[], item: T): T[] {
  const t = item.horizonDate ? new Date(item.horizonDate).getTime() : Infinity
  const at = list.findIndex(x => (x.horizonDate ? new Date(x.horizonDate).getTime() : Infinity) > t)
  const out = list.filter(x => x.id !== item.id)
  out.splice(at < 0 ? out.length : Math.min(at, out.length), 0, item)
  return out
}

export interface ChangeItem { id: string; kind: 'OBJECT' | 'RELATIONSHIP'; change: string; stateId: string; stateName: string; objectId: string; objectName: string; objectType: string; domain: string; domainName: string | null; related?: { id: string; name: string } | null; relationshipType?: string; properties?: string[]; workPackageId: string | null; workPackageName: string | null; horizonDate: string | null }

/**
 * Whether a selection can be assigned: every change on one state. Returns
 * that state id and the ids split by kind (the API takes object and link
 * changes separately), or null.
 */
export function assignable(items: ChangeItem[], selected: Set<string>) {
  const chosen = items.filter(i => selected.has(i.id))
  if (!chosen.length) return null
  const states = new Set(chosen.map(i => i.stateId))
  if (states.size !== 1) return null
  return {
    stateId: chosen[0].stateId,
    objectChangeIds: chosen.filter(i => i.kind === 'OBJECT').map(i => i.id),
    linkChangeIds: chosen.filter(i => i.kind === 'RELATIONSHIP').map(i => i.id),
    assigned: chosen.filter(i => i.workPackageId).length,
  }
}

/** Counts of target measures by status, for the header tile. */
export function measureCounts(measures: Array<{ status: string }>) {
  return { total: measures.length, met: measures.filter(m => m.status === 'MET').length, below: measures.filter(m => m.status === 'BELOW').length, unmeasured: measures.filter(m => m.status === 'NOT_MEASURED').length }
}

export const MEASURE_KINDS = ['DOMAIN_MATURITY', 'CAPABILITY_MATURITY', 'REFERENCE_COVERAGE', 'KPI'] as const
export const STATUS_TONE: Record<string, string> = { ACHIEVED: 'good', APPROVED: 'info', DRAFT: 'muted', PLANNED: 'muted', COMMITTED: 'info', DELIVERED: 'good', CANCELLED: 'muted', MET: 'good', BELOW: 'warn', NOT_MEASURED: 'muted', RETIRING: 'warn', PLANNED_NEW: 'info', CHANGING: 'info', STAYS: 'muted' }
