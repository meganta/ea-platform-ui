import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'

export default function LoginPage() {
  const { login } = useAuth()
  const { t, locale, setLocale } = useLang()
  const nav = useNavigate()
  const [form, setForm] = useState({ email:'', password:'', tenantSlug:'test-tenant' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k:string) => (e:any) => setForm(f=>({...f,[k]:e.target.value}))
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
          <div className="login-logo">EA Platform</div>
          <button onClick={()=>setLocale(locale==='EN'?'AR':'EN')} style={{background:'none',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text-dim)',padding:'4px 10px',fontSize:11,cursor:'pointer'}}>
            {locale==='EN'?'🌐 العربية':'🌐 English'}
          </button>
        </div>
        <div className="login-tagline">{t('auth.tagline')}</div>
        <div className="login-title">{t('auth.signin')}</div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label">{t('auth.organization')}</label><input className="form-input" value={form.tenantSlug} onChange={set('tenantSlug')} required/></div>
          <div className="form-group"><label className="form-label">{t('auth.email')}</label><input className="form-input" type="email" value={form.email} onChange={set('email')} required/></div>
          <div className="form-group"><label className="form-label">{t('auth.password')}</label><input className="form-input" type="password" value={form.password} onChange={set('password')} required/></div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center',marginTop:8}}>{loading?t('auth.signin_loading'):t('auth.signin')}</button>
        </form>
      </div>
    </div>
  )
}
