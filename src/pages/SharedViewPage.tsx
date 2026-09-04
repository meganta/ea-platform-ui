import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { API_BASE } from '../lib/api'

interface SharedViewSummary {
  id: string
  name: string
  nameAr?: string | null
  description?: string | null
  category: string
  visualization: string
  viewCount: number
  tenantSlug: string | null
  branding: {
    organizationNameEn?: string | null
    organizationNameAr?: string | null
    accentColor?: string | null
    hasLogo?: boolean
  } | null
}

export default function SharedViewPage() {
  const { t } = useLang()
  const { token } = useParams<{ token: string }>()
  const [view, setView] = useState<SharedViewSummary | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/ea-views/shared/${encodeURIComponent(token)}`)
      .then(async r => {
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || 'This share link is invalid or has expired.') }
        return r.json()
      })
      .then(setView)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  const orgName = view?.branding?.organizationNameEn || view?.branding?.organizationNameAr
  const accentColor = view?.branding?.accentColor || undefined

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        {view?.tenantSlug && view.branding?.hasLogo && !logoFailed ? (
          <img
            src={`${API_BASE}/public/branding/${encodeURIComponent(view.tenantSlug)}/logo`}
            alt={orgName || 'Logo'}
            style={{ maxHeight: 32, maxWidth: 180, objectFit: 'contain', marginBottom: 8 }}
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="login-logo" style={{ marginBottom: 8 }}>{orgName || 'EA Platform'}</div>
        )}

        {error ? (
          <>
            <div className="login-title" style={{ marginTop: 8 }}>Link unavailable</div>
            <div className="login-error" style={{ marginTop: 8 }}>{error}</div>
          </>
        ) : view ? (
          <>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{view.category} · {view.visualization.replace(/_/g, ' ')}</div>
            <div className="login-title" style={{ marginTop: 4 }}>{view.name}</div>
            {view.description && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8, lineHeight: 1.6 }}>{view.description}</div>}

            <div style={{ marginTop: 20, padding: 14, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-dim)' }}>
              This is a shared view from {orgName || 'an EA Platform workspace'}. Sign in to explore the live architecture data.
            </div>

            <Link to={`/login${view.tenantSlug ? `?org=${encodeURIComponent(view.tenantSlug)}` : ''}`}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 16, ...(accentColor ? { background: accentColor, borderColor: accentColor } : {}) }}>
                Sign in to view
              </button>
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}
