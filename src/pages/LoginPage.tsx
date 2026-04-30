import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
export default function LoginPage() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', tenantSlug: 'test-tenant' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: any) => setForm(f => ({...f, [k]: e.target.value}))
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true)
    try { await login(form.email, form.password, form.tenantSlug); nav('/') }
    catch (err: any) { setError(err.message || 'Login failed') }
    finally { setLoading(false) }
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">EA Platform</div>
        <div className="login-tagline">ENTERPRISE ARCHITECTURE INTELLIGENCE PLATFORM</div>
        <div className="login-title">Sign In</div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label">Organization</label><input className="form-input" value={form.tenantSlug} onChange={set('tenantSlug')} required/></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={set('email')} required/></div>
          <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={form.password} onChange={set('password')} required/></div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{width:'100%',justifyContent:'center',marginTop:8}}>{loading?'Signing in...':'Sign In'}</button>
        </form>
      </div>
    </div>
  )
}
