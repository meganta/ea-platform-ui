import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useAuth } from './AuthContext'
import { API_BASE, getToken } from '../lib/api'

interface Branding {
  organizationNameEn?: string | null
  organizationNameAr?: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontFamily?: string | null
  logoStorageKey?: string | null
  faviconStorageKey?: string | null
}

interface BrandingCtx {
  branding: Branding | null
  loading: boolean
  logoUrl: string | null
  faviconUrl: string | null
  reload: () => void
  /** Client-side only, not persisted — used by the Settings page for live preview while editing colors. */
  previewAccentColor: (color: string | null) => void
}

const Ctx = createContext<BrandingCtx>({} as BrandingCtx)
export const useBranding = () => useContext(Ctx)

// Only the accent color is applied automatically to the live app shell in
// this phase — it's the single CSS variable used pervasively enough (active
// nav state, buttons, links) to reliably reflect a brand color without
// risking text/background contrast issues. Overriding the dark background
// itself would need proper contrast-checked theming, not attempted here.
function applyAccentColor(color: string | null) {
  const root = document.documentElement
  if (color) {
    root.style.setProperty('--accent', color)
  } else {
    root.style.removeProperty('--accent')
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [branding, setBranding] = useState<Branding | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    if (!user) { setBranding(null); return }
    setLoading(true)
    fetch(`${API_BASE}/branding`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then((b: Branding | null) => {
        setBranding(b)
        applyAccentColor(b?.accentColor || null)
      }).catch(() => { /* non-fatal — app works fine with default styling */ })
      .finally(() => setLoading(false))
  }, [user])

  useEffect(() => { load() }, [load])

  // Favicon + document title — only meaningful once we know the tenant slug
  // (public asset URL) and have branding data.
  useEffect(() => {
    if (!user?.tenantSlug) return
    if (branding?.faviconStorageKey) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link) }
      link.href = `${API_BASE}/public/branding/${user.tenantSlug}/favicon?t=${Date.now()}`
    }
    if (branding?.organizationNameEn) {
      document.title = `${branding.organizationNameEn} — EA Platform`
    }
  }, [branding, user?.tenantSlug])

  const logoUrl = (branding?.logoStorageKey && user?.tenantSlug)
    ? `${API_BASE}/public/branding/${user.tenantSlug}/logo`
    : null
  const faviconUrl = (branding?.faviconStorageKey && user?.tenantSlug)
    ? `${API_BASE}/public/branding/${user.tenantSlug}/favicon`
    : null

  const previewAccentColor = useCallback((color: string | null) => {
    applyAccentColor(color || branding?.accentColor || null)
  }, [branding])

  return (
    <Ctx.Provider value={{ branding, loading, logoUrl, faviconUrl, reload: load, previewAccentColor }}>
      {children}
    </Ctx.Provider>
  )
}
