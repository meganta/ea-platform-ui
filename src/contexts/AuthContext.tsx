import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { api, setToken, clearToken, getToken } from '../lib/api'

export interface User {
  userId: string
  email: string
  role: string
  tenantId: string
  tenantSlug?: string
  isPlatformAdmin?: boolean
  fullName?: string
  fullNameAr?: string
  locale?: string
}

export interface AuthCtx {
  user: User | null
  loading: boolean
  permissions: string[]
  login: (e: string, p: string, t: string) => Promise<void>
  logout: () => void
  hasPermission: (code: string) => boolean
  reloadPermissions: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({} as AuthCtx)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

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
    const { accessToken } = await api.login(email, password, tenantSlug)
    setToken(accessToken)
    const me = await api.me()
    setUser(me)
    await loadPermissions()
  }

  const logout = () => { clearToken(); setUser(null); setPermissions([]) }

  const hasPermission = useCallback((code: string) => {
    if (!user) return false
    // Legacy role bypass: TENANT_ADMIN gets everything during migration
    if (user.role === 'TENANT_ADMIN') return true
    // Platform admin gets everything
    if (user.isPlatformAdmin) return true
    return permissions.includes(code)
  }, [user, permissions])

  const reloadPermissions = useCallback(async () => {
    await loadPermissions()
  }, [loadPermissions])

  return (
    <Ctx.Provider value={{ user, loading, permissions, login, logout, hasPermission, reloadPermissions }}>
      {children}
    </Ctx.Provider>
  )
}
