import { apiFetch, setSession, clearToken, getToken } from './session'
import { api, API_BASE } from './api'

const base = 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'
const mockFetch = jest.fn()
const response = (status: number, value: unknown = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => value })
beforeEach(() => { localStorage.clear(); mockFetch.mockReset(); global.fetch = mockFetch; setSession('old', 'refresh-old') })

it('refreshes and retries with rotated tokens while preserving method and body', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { accessToken: 'new', refreshToken: 'refresh-new' })).mockResolvedValueOnce(response(200))
  await apiFetch(`${base}/users/me/password`, { method: 'PUT', headers: { Authorization: 'Bearer old' }, body: 'payload' })
  expect(mockFetch.mock.calls[1]).toEqual([`${base}/auth/refresh`, expect.objectContaining({ body: JSON.stringify({ refreshToken: 'refresh-old' }) })])
  expect(mockFetch.mock.calls[2]).toEqual([`${base}/users/me/password`, expect.objectContaining({ method: 'PUT', body: 'payload', headers: { Authorization: 'Bearer new' } })])
  expect(getToken()).toBe('new')
  expect(localStorage.getItem('ea_refresh_token')).toBe('refresh-new')
})

it('coalesces concurrent unauthorized requests into one refresh', async () => {
  mockFetch.mockImplementation(async (url: string, init: RequestInit) => url.endsWith('/auth/refresh')
    ? response(200, { accessToken: 'new', refreshToken: 'refresh-new' })
    : response((init.headers as any).Authorization === 'Bearer new' ? 200 : 401))
  await Promise.all([apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } }), apiFetch(`${base}/b`, { headers: { Authorization: 'Bearer old' } })])
  expect(mockFetch.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'))).toHaveLength(1)
})

it('clears both tokens when refresh is rejected', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(401))
  await expect(apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } })).rejects.toThrow()
  expect(getToken()).toBeNull()
  expect(localStorage.getItem('ea_refresh_token')).toBeNull()
})

it('does not refresh public, foreign-origin, forbidden, or login requests', async () => {
  mockFetch.mockResolvedValue(response(401))
  await apiFetch(`${base}/public/example`)
  await apiFetch('https://example.com/file', { headers: { Authorization: 'Bearer external' } })
  await apiFetch(`${base}/auth/login`, { method: 'POST' })
  mockFetch.mockResolvedValue(response(403))
  await apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } })
  expect(mockFetch).toHaveBeenCalledTimes(4)
  expect(getToken()).toBe('old')
})

it('retries only once and ends the session on a second 401', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { accessToken: 'new', refreshToken: 'new-r' })).mockResolvedValueOnce(response(401))
  expect((await apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } })).status).toBe(401)
  expect(mockFetch).toHaveBeenCalledTimes(3)
  expect(getToken()).toBeNull()
})

it('does not restore a session after logout during refresh', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockImplementationOnce(async () => {
    clearToken()
    return response(200, { accessToken: 'new', refreshToken: 'new-r' })
  })
  await expect(apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } })).rejects.toThrow('Session changed')
  expect(getToken()).toBeNull()
})

it('preserves the session after a temporary refresh failure', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockRejectedValueOnce(new Error('network unavailable'))
  await expect(apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } })).rejects.toThrow('network unavailable')
  expect(getToken()).toBe('old')
})

it('uses the current token when a caller holds a stale token', async () => {
  setSession('latest', 'latest-r')
  mockFetch.mockResolvedValue(response(200))
  await apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer old' } })
  expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Bearer latest')
})

it('refreshes the authenticated /auth/me endpoint', async () => {
  mockFetch.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { accessToken: 'new', refreshToken: 'new-r' })).mockResolvedValueOnce(response(200))
  await apiFetch(`${base}/auth/me`, { headers: { Authorization: 'Bearer old' } })
  expect(mockFetch).toHaveBeenCalledTimes(3)
})

it('preserves upload bodies and abort signals on retry', async () => {
  const body = new FormData()
  body.append('name', 'example')
  const controller = new AbortController()
  mockFetch.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(200, { accessToken: 'new', refreshToken: 'new-r' })).mockResolvedValueOnce(response(200))
  await apiFetch(`${base}/upload`, { method: 'POST', body, signal: controller.signal, headers: { Authorization: 'Bearer old' } })
  expect(mockFetch.mock.calls[2][1].body).toBe(body)
  expect(mockFetch.mock.calls[2][1].signal).toBe(controller.signal)
  expect(mockFetch.mock.calls[2][1].headers['Content-Type']).toBeUndefined()
})

it('wires password changes to the authenticated backend endpoint', async () => {
  mockFetch.mockResolvedValue(response(200, { updated: true }))
  expect(await api.changeMyPassword({ currentPassword: 'old-password', newPassword: 'new-password' })).toEqual({ updated: true })
  expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/users/me/password`, expect.objectContaining({
    method: 'PUT', headers: expect.objectContaining({ Authorization: 'Bearer old' }),
    body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
  }))
})

it('never renews delegated access using the saved owner refresh token', async () => {
  localStorage.setItem('ea_owner_token', 'owner')
  localStorage.setItem('ea_owner_refresh_token', 'owner-refresh')
  localStorage.removeItem('ea_refresh_token')
  mockFetch.mockResolvedValue(response(401))
  expect((await apiFetch(`${base}/a`, { headers: { Authorization: 'Bearer delegated' } })).status).toBe(401)
  expect(mockFetch).toHaveBeenCalledTimes(1)
  expect(localStorage.getItem('ea_owner_token')).toBe('owner')
})
