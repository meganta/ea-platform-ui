import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken, setSession, clearToken, getToken } from '../lib/api'
import { SESSION_ENDED } from '../lib/session'

export interface User {
  userId: string
  email: string
  role: string
  tenantId: string
  tenantSlug?: string
  isPlatformAdmin?: boolean
  /** Platform role above tenants (Owner Console). */
  platformRole?: 'PLATFORM_OWNER' | null
  /** Set while a platform owner manages a tenant through a delegated access session. */
  delegatedAccess?: { sessionId: string; actorUserId: string; homeTenantId: string; expiresAt: string } | null
  tenantName?: string
  fullName?: string
  fullNameAr?: string
  locale?: string
}

export interface AuthCtx {
  user: User | null
  loading: boolean
  permissions: string[]
  login: (e: string, p: string, t: string) => Promise<User>
  logout: () => void
  /** Owner: switch to a delegated tenant session (the owner token is kept aside). */
  enterTenant: (delegatedToken: string) => Promise<void>
  /** Owner: end the delegated session and return to the owner identity. */
  exitTenant: () => Promise<void>
  hasPermission: (code: string) => boolean
  reloadPermissions: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({} as AuthCtx)
/** The owner's own token while a delegated tenant session is active. */
export const OWNER_TOKEN_KEY = 'ea_owner_token'

export const isPlatformOwner = (u: User | null | undefined) => !!u && u.platformRole === 'PLATFORM_OWNER' && !u.delegatedAccess
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const ended = () => { setUser(null); setPermissions([]) }
    const storage = (event: StorageEvent) => { if (event.key === 'ea_token' && !event.newValue) ended() }
    window.addEventListener(SESSION_ENDED, ended)
    window.addEventListener('storage', storage)
    return () => { window.removeEventListener(SESSION_ENDED, ended); window.removeEventListener('storage', storage) }
  }, [])

  const loadPermissions = useCallback(async () => {
    try {
      const perms = await api.getMyPermissions()
      setPermissions(Array.isArray(perms) ? perms.map((p: any) => p.code || p.permissionCode || p) : [])
    } catch {
      setPermissions([])
    }
  }, [])

  useEffect(() => {
    if (getToken()) {
      api.me().then((me) => {
        setUser(me)
        loadPermissions()
      }).catch(() => {
        clearToken()
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loadPermissions])

  const login = async (email: string, password: string, tenantSlug: string) => {
    const { accessToken, refreshToken } = await api.login(email, password, tenantSlug)
    localStorage.removeItem(OWNER_TOKEN_KEY)
    localStorage.removeItem('ea_owner_refresh_token')
    setSession(accessToken, refreshToken)
    const me = await api.me()
    setUser(me)
    await loadPermissions()
    return me
  }

  const logout = () => {
    const refreshToken = localStorage.getItem('ea_refresh_token') || localStorage.getItem('ea_owner_refresh_token')
    clearToken(); localStorage.removeItem(OWNER_TOKEN_KEY); localStorage.removeItem('ea_owner_refresh_token'); setUser(null); setPermissions([])
    if (refreshToken) api.logout(refreshToken).catch(() => {})
  }

  const enterTenant = async (delegatedToken: string) => {
    const ownerToken = getToken()
    if (ownerToken && !localStorage.getItem(OWNER_TOKEN_KEY)) localStorage.setItem(OWNER_TOKEN_KEY, ownerToken)
    const ownerRefresh = localStorage.getItem('ea_refresh_token')
    if (ownerRefresh) localStorage.setItem('ea_owner_refresh_token', ownerRefresh)
    localStorage.removeItem('ea_refresh_token')
    setToken(delegatedToken)
    const me = await api.me()
    setUser(me)
    await loadPermissions()
  }

  const exitTenant = async () => {
    try { await api.exitOwnerAccess() } catch { /* session may already be over: the server refuses the token anyway */ }
    const ownerToken = localStorage.getItem(OWNER_TOKEN_KEY)
    const ownerRefresh = localStorage.getItem('ea_owner_refresh_token')
    localStorage.removeItem(OWNER_TOKEN_KEY)
    localStorage.removeItem('ea_owner_refresh_token')
    if (!ownerToken) { logout(); return }
    if (ownerRefresh) setSession(ownerToken, ownerRefresh)
    else setToken(ownerToken)
    try {
      const me = await api.me()
      setUser(me)
      await loadPermissions()
    } catch {
      logout()
    }
  }

  const hasPermission = useCallback((code: string) => {
    if (!user) return false
    // Legacy role bypass: TENANT_ADMIN/SUPERADMIN get everything during migration
    if (user.role === 'TENANT_ADMIN' || user.role === 'SUPERADMIN') return true
    // Platform admin gets everything
    if (user.isPlatformAdmin) return true
    return permissions.includes(code)
  }, [user, permissions])

  const reloadPermissions = useCallback(async () => {
    await loadPermissions()
  }, [loadPermissions])

  return (
    <Ctx.Provider value={{ user, loading, permissions, login, logout, enterTenant, exitTenant, hasPermission, reloadPermissions }}>
      {children}
    </Ctx.Provider>
  )
}
