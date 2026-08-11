import React, { createContext, useContext, useState, useEffect } from 'react'
import { api, setToken, clearToken, getToken } from '../lib/api'
interface User { userId: string; email: string; role: string; tenantId: string; tenantSlug?: string }
interface AuthCtx { user: User | null; loading: boolean; login: (e: string, p: string, t: string) => Promise<void>; logout: () => void }
const Ctx = createContext<AuthCtx>({} as AuthCtx)
export const useAuth = () => useContext(Ctx)
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (getToken()) { api.me().then(setUser).catch(() => { clearToken(); setUser(null) }).finally(() => setLoading(false)) }
    else { setLoading(false) }
  }, [])
  const login = async (email: string, password: string, tenantSlug: string) => {
    const { accessToken } = await api.login(email, password, tenantSlug)
    setToken(accessToken)
    const me = await api.me()
    setUser(me)
  }
  const logout = () => { clearToken(); setUser(null) }
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>
}
