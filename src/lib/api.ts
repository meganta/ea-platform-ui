export const API_BASE = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'
let authToken: string | null = localStorage.getItem('ea_token')
export const setToken = (t: string) => { authToken = t; localStorage.setItem('ea_token', t) }
export const clearToken = () => { authToken = null; localStorage.removeItem('ea_token') }
export const getToken = () => authToken
async function req(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `HTTP ${res.status}`) }
  if (res.status === 204) return null
  return res.json()
}
export const api = {
  login: (email: string, password: string, tenantSlug: string) => req('POST', '/auth/login', { email, password, tenantSlug }),
  me: () => req('GET', '/auth/me'),
  getCycles: () => req('GET', '/adm/cycles'),
  createCycle: (data: any) => req('POST', '/adm/cycles', data),
  getCycle: (id: string) => req('GET', `/adm/cycles/${id}`),
  startPhase: (cycleId: string, phase: string) => req('POST', `/adm/cycles/${cycleId}/phases/${phase}/start`),
  runGapAnalysis: (cycleId: string) => req('POST', `/adm/cycles/${cycleId}/gap-analysis`),
  getCapabilities: () => req('GET', '/ea-repository/capabilities'),
  createCapability: (data: any) => req('POST', '/ea-repository/capabilities', data),
  getApplications: () => req('GET', '/ea-repository/applications'),
  createApplication: (data: any) => req('POST', '/ea-repository/applications', data),
  getDecisions: () => req('GET', '/ea-repository/decisions'),
  getDocuments: () => req('GET', '/knowledge/documents'),
  searchKnowledge: (query: string) => req('POST', '/knowledge/search', { query }),
  getGlossary: () => req('GET', '/glossary'),
  chatSync: (message: string, sessionId: string, locale = 'EN') => req('POST', '/copilot/chat/sync', { message, sessionId, locale }),
}
