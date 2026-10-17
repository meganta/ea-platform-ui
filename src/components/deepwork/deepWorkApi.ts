// Deep-work client (backend /deep-work and the modules' start routes). The
// server enforces access, the AI policy and budgets; this client only calls it.
import { API_BASE, getToken } from '../../lib/api'

export const ACTIVE = ['QUEUED', 'RUNNING']
export const POLL_MS = 4000

export interface EvidenceEntry { id: string; step: number; tool: string; input: Record<string, any>; summary: string; sourceRef?: { type: string; id?: string; label?: string } | null; error?: boolean }
export interface Finding { statement: string; kind?: string; evidence: string[]; confidence?: 'HIGH' | 'MEDIUM' | 'LOW'; unsupported?: boolean; invalidCitations?: string[] }
export interface Draft { summary: string; answer: string; findings: Finding[]; openQuestions: string[]; limitations: string[] }
export interface Verdict { decision: string; rationale: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; conditions: string[]; dissent: string[] }
export interface DeepRun {
  id: string; module: string; type: string | null; subjectType: string | null; subjectId: string | null; title: string; question: string; language: string
  status: string; phase: string; requestedLevel: string; level: string; model: string; provider: string
  ledger: EvidenceEntry[]; draft: Draft | null; critiques: Array<{ pass: number; verdict: string; issues: any[] }>; verdict: Verdict | null
  result: { draft: Draft; verdict: Verdict | null; limitations: string[] } | null; limitations: string[]
  steps: number; toolCalls: number; costSar: number; unpricedTurns: number; error: string | null; createdAt: string; finishedAt: string | null
  policy?: { profile?: { maxSteps: number; maxToolCalls: number; timeLimitSec: number } }
}

async function call(method: string, path: string, body?: any) {
  const r = await fetch(`${API_BASE}${path}`, { method, headers: { Authorization: `Bearer ${getToken() || ''}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await r.json().catch(() => null)
  if (!r.ok) {
    const err: any = new Error(data?.message ? (Array.isArray(data.message) ? data.message.join(', ') : typeof data.message === 'string' ? data.message : data.message.message) : `HTTP ${r.status}`)
    err.code = data?.code || data?.message?.code
    throw err
  }
  return data
}

export const deepWorkApi = {
  get: (id: string): Promise<DeepRun> => call('GET', `/deep-work/${id}`),
  advance: (id: string): Promise<DeepRun> => call('POST', `/deep-work/${id}/advance`),
  cancel: (id: string): Promise<DeepRun> => call('POST', `/deep-work/${id}/cancel`),
  list: (f: { module?: string; subjectType?: string; subjectId?: string }) => call('GET', `/deep-work?${new URLSearchParams(Object.entries(f).filter(([, v]) => !!v) as any).toString()}`),
  effective: (module: string, type?: string | null) => call('GET', `/ai-policy/effective?module=${encodeURIComponent(module)}${type ? `&type=${encodeURIComponent(type)}` : ''}`),
  startCopilot: (dto: { question: string; architectCode?: string; conversationId?: string; language?: 'EN' | 'AR' }): Promise<DeepRun> => call('POST', '/copilot/deep-work', dto),
  startAdmStage: (cycleId: string, phase: string, language: 'EN' | 'AR'): Promise<DeepRun> => call('POST', `/adm-intelligence/cycles/${cycleId}/phases/${encodeURIComponent(phase)}/lead-review`, { language }),
  startStrategy: (refreshId: string, language: 'EN' | 'AR'): Promise<DeepRun> => call('POST', `/strategy-refreshes/${refreshId}/lead-review`, { language }),
}

/** Downloads a finished run as a PowerPoint in the organization's presentation style. */
export async function downloadDeepWorkDeck(id: string, language: 'EN' | 'AR') {
  const r = await fetch(`${API_BASE}/deep-work/${id}/deck?language=${language}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } })
  if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ? String(d.message) : `HTTP ${r.status}`) }
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement('a'); a.href = url; a.download = `deep-work-${id.slice(0, 8)}-${language.toLowerCase()}.pptx`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Which phase label a run is in (for the status pill). */
export function runStage(r: Pick<DeepRun, 'status' | 'phase'>): string {
  if (r.status === 'QUEUED') return 'QUEUED'
  if (r.status === 'RUNNING') return r.phase === 'CRITIQUE' ? 'CHECKING' : r.phase === 'LEAD' ? 'LEAD' : 'INVESTIGATING'
  return r.status
}
