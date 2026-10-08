const ACCESS_KEY = 'ea_token'
const REFRESH_KEY = 'ea_refresh_token'
export const SESSION_ENDED = 'ea-session-ended'

export const getToken = () => localStorage.getItem(ACCESS_KEY)
export const setToken = (token: string) => localStorage.setItem(ACCESS_KEY, token)
export function setSession(accessToken: string, refreshToken: string) {
  setToken(accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}
export function clearToken() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  window.dispatchEvent(new Event(SESSION_ENDED))
}

let refreshing: Promise<string> | null = null
const knownBases = [
  process.env.REACT_APP_API_URL,
  'https://archmindworks.com/api/v1',
  'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1',
  'https://ea-platform-api-693660680541.me-central1.run.app/api/v1',
].filter((base): base is string => Boolean(base)).map(base => base.replace(/\/$/, ''))

async function refreshSession(base: string): Promise<string> {
  if (refreshing) return refreshing
  const refreshToken = localStorage.getItem(REFRESH_KEY)
  if (!refreshToken) {
    clearToken()
    throw new Error('Session expired. Please sign in again.')
  }
  refreshing = (async () => {
    try {
      const rotate = async () => {
        const latestRefresh = localStorage.getItem(REFRESH_KEY)
        if (latestRefresh !== refreshToken) {
          const latestAccess = getToken()
          if (latestRefresh && latestAccess) return latestAccess
          throw new Error('Session changed during refresh')
        }
        const response = await fetch(`${base}/auth/refresh`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
        if (!response.ok) {
          if ((response.status === 401 || response.status === 403) && localStorage.getItem(REFRESH_KEY) === refreshToken) clearToken()
          throw new Error('Unable to refresh session. Please sign in again.')
        }
        const pair = await response.json()
        if (typeof pair.accessToken !== 'string' || typeof pair.refreshToken !== 'string') throw new Error('Invalid refresh response')
        // A response arriving after logout or another login must not restore the old session.
        if (localStorage.getItem(REFRESH_KEY) !== refreshToken) throw new Error('Session changed during refresh')
        setSession(pair.accessToken, pair.refreshToken)
        return pair.accessToken
      }
      // Coordinate rotation between tabs as well as concurrent requests in this tab.
      return navigator.locks ? await navigator.locks.request('archmind-session-refresh', rotate) : await rotate()
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const base = knownBases.find(candidate => url.startsWith(`${candidate}/`))
  const originalRequest = typeof Request !== 'undefined' && input instanceof Request ? input : null
  const headers = new Headers(init?.headers || originalRequest?.headers)
  const authExchange = base && ['login', 'register', 'refresh', 'logout'].some(action => url.split('?')[0] === `${base}/auth/${action}`)
  const authenticated = Boolean(base && headers.get('Authorization')?.startsWith('Bearer ')
    && !authExchange)
  if (!authenticated) return fetch(input, init)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const send = () => {
    const values: Record<string, string> = {}
    headers.forEach((value, key) => { values[key === 'authorization' ? 'Authorization' : key === 'content-type' ? 'Content-Type' : key] = value })
    return fetch(originalRequest ? originalRequest.clone() : input, { ...init, headers: values })
  }
  const response = await send()
  if (response.status !== 401) return response
  if ((init?.signal || originalRequest?.signal)?.aborted) throw new DOMException('The request was aborted', 'AbortError')
  const currentToken = getToken()
  const nextToken = currentToken && currentToken !== token ? currentToken : await refreshSession(base!)
  headers.set('Authorization', `Bearer ${nextToken}`)
  const retried = await send()
  if (retried.status === 401 && getToken() === nextToken) clearToken()
  return retried
}
