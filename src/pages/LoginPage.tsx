import { useState, FormEvent, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { API_BASE } from '../lib/api'

interface PublicBrandingSummary {
  organizationNameEn?: string | null
  organizationNameAr?: string | null
  accentColor?: string | null
  hasLogo?: boolean
}

export default function LoginPage() {
  const { login } = useAuth()
  const { t, locale, setLocale } = useLang()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ email:'', password:'', tenantSlug: searchParams.get('org') || 'test-tenant' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [orgBranding, setOrgBranding] = useState<PublicBrandingSummary | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const set = (k:string) => (e:any) => setForm(f=>({...f,[k]:e.target.value}))

  // Debounced lookup of the typed organization slug's public branding
  // (logo/org name/accent color — all non-sensitive) so the login screen
  // can reflect the tenant's identity before any authentication exists.
  useEffect(() => {
    const slug = form.tenantSlug.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!slug) { setOrgBranding(null); return }
    debounceRef.current = setTimeout(() => {
      fetch(`${API_BASE}/public/branding/${encodeURIComponent(slug)}`)
        .then(r => r.ok ? r.json() : null)
        .then(b => { setOrgBranding(b); setLogoFailed(false) })
        .catch(() => setOrgBranding(null))
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [form.tenantSlug])

  const orgName = locale === 'AR' ? (orgBranding?.organizationNameAr || orgBranding?.organizationNameEn) : (orgBranding?.organizationNameEn || orgBranding?.organizationNameAr)
  const accentColor = orgBranding?.accentColor || undefined

  const submit = async (e:FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.email, form.password, form.tenantSlug); nav('/') }
    catch(err:any) { setError(err.message||'Login failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
          {orgBranding?.hasLogo && !logoFailed
            ? <img src={`${API_BASE}/public/branding/${encodeURIComponent(form.tenantSlug.trim())}/logo`} alt={orgName || 'Logo'} style={{ maxHeight: 28, maxWidth: 160, objectFit: 'contain' }} onError={() => setLogoFailed(true)} />
            : <div className="login-logo">{orgName || 'EA Platform'}</div>}
          <button onClick={()=>setLocale(locale==='EN'?'AR':'EN')} style={{background:'none',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text-dim)',padding:'4px 10px',fontSize:11,cursor:'pointer'}}>
            {locale==='EN'?'🌐 العربية':'🌐 English'}
          </button>
        </div>
        <div className="login-tagline">{orgName ? orgName : t('auth.tagline')}</div>
        <div className="login-title">{t('auth.signin')}</div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label" htmlFor="login-org">{t('auth.organization')}</label><input id="login-org" className="form-input" value={form.tenantSlug} onChange={set('tenantSlug')} required/></div>
          <div className="form-group"><label className="form-label" htmlFor="login-email">{t('auth.email')}</label><input id="login-email" className="form-input" type="email" value={form.email} onChange={set('email')} required/></div>
          <div className="form-group"><label className="form-label" htmlFor="login-password">{t('auth.password')}</label><input id="login-password" className="form-input" type="password" value={form.password} onChange={set('password')} required/></div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center',marginTop:8, ...(accentColor ? { background: accentColor, borderColor: accentColor } : {})}}>{loading?t('auth.signin_loading'):t('auth.signin')}</button>
        </form>
      </div>
    </div>
  )
}
