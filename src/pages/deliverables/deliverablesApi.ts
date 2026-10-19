import { API_BASE, getToken } from '../../lib/api'

export type DeliverableFormat = 'XLSX' | 'DOCX' | 'PPTX' | 'ZIP'
export type DeliverableOption = 'subject' | 'views' | 'architectures' | 'patterns' | 'policyOwners'
export interface Deliverable {
  code: string; number: number; title: [string, string]; summary: [string, string]; format: DeliverableFormat
  sources: string[]; options: DeliverableOption[]; records: number
}
export interface ViewChoice { id: string; name: string; state: { type: string; name: string; date?: string | null } | null }
export interface ArchitectureChoice { id: string; code: string; name: string; nameAr?: string | null; kind: string; domainCode?: string | null }
export interface DeliverablesCatalogue {
  deliverables: Deliverable[]
  options: { policyOwners: Array<{ owner: string; policies: number }>; views: ViewChoice[]; architectures: ArchitectureChoice[] }
}
export interface Choices { subjectId?: string; viewIds?: string[]; architectureIds?: string[]; policyOwners?: string[] }

const headers = () => ({ 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) })

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}))
  throw new Error(Array.isArray(body?.message) ? body.message.join('; ') : body?.message || `HTTP ${res.status}`)
}

/** The file name the server gave (RFC 5987 filename*), else a fallback. */
export function fileNameOf(disposition: string | null, fallback: string): string {
  const m = /filename\*=UTF-8''([^;]+)/i.exec(disposition || '')
  if (m) { try { return decodeURIComponent(m[1]) } catch { /* fall through */ } }
  const plain = /filename="?([^";]+)"?/i.exec(disposition || '')
  return plain ? plain[1] : fallback
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const deliverablesApi = {
  async catalogue(): Promise<DeliverablesCatalogue> {
    const res = await fetch(`${API_BASE}/ea-deliverables`, { headers: headers() })
    if (!res.ok) return fail(res)
    return res.json()
  },
  async searchObjects(q: string): Promise<Array<{ id: string; name: string; assetType: string }>> {
    const res = await fetch(`${API_BASE}/ea-repository/assets?search=${encodeURIComponent(q)}&pageSize=8&page=1`, { headers: headers() })
    if (!res.ok) return []
    const r = await res.json()
    return (Array.isArray(r) ? r : r?.items || r?.data || []).slice(0, 8)
  },
  /** Prepares one deliverable and saves it; returns the file name. */
  async download(code: string, language: 'EN' | 'AR', choices: Choices): Promise<string> {
    const res = await fetch(`${API_BASE}/ea-deliverables/${encodeURIComponent(code)}`, { method: 'POST', headers: headers(), body: JSON.stringify({ language, ...choices }) })
    if (!res.ok) return fail(res)
    const name = fileNameOf(res.headers.get('content-disposition'), `${code}`)
    save(await res.blob(), name)
    return name
  },
  async downloadAll(language: 'EN' | 'AR', byCode: Record<string, Choices>): Promise<string> {
    const res = await fetch(`${API_BASE}/ea-deliverables/bundle`, { method: 'POST', headers: headers(), body: JSON.stringify({ language, byCode }) })
    if (!res.ok) return fail(res)
    const name = fileNameOf(res.headers.get('content-disposition'), 'EA Deliverables.zip')
    save(await res.blob(), name)
    return name
  },
}
