import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import BrandLogo from '../brand/BrandLogo'
import BrandPattern from '../brand/BrandPattern'
import Icon from '../brand/icons'
import '../brand/brand.css'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const nav = useNavigate()
  const [validating, setValidating] = useState(true)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) { setValidating(false); setError('Invalid invitation link'); return }
    // We can't call a protected endpoint, so we just show the form.
    // The accept endpoint will validate the token server-side.
    setValidating(false)
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) { setError('Full name is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }

    try {
      const result = await api.acceptInvitation(token!, { fullName, password })
      setSuccess(true)
      // Auto-login after 2 seconds
      setTimeout(async () => {
        try {
          // We need tenantSlug to login — fetch it from the created user's tenant
          const tenantRes = await fetch(`${API_URL}/auth/tenant-by-user/${result.userId}`)
          if (!tenantRes.ok) {
            nav('/login')
            return
          }
          const tenantData = await tenantRes.json()
          const loginRes = await api.login(result.email, password, tenantData.slug)
          setToken(loginRes.accessToken)
          nav('/app')
        } catch {
          nav('/login')
        }
      }, 2000)
    } catch (e: any) {
      setError(e.message || 'Failed to accept invitation')
    }
  }

  if (validating) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ marginTop: 16, color: 'var(--text-dim)' }}>Validating invitation...</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="login-page">
        <BrandPattern variant="flow" intensity={0.35} />
        <div className="login-card login-card-center" role="status">
          <span className="login-done-mark"><Icon name="check" size={28} /></span>
          <h2 className="login-title">Account Created!</h2>
          <p className="login-muted">Your account has been set up. Redirecting to the platform...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <BrandPattern variant="flow" intensity={0.35} />
      <div className="login-card">
        <BrandLogo size={24} />
        <h1 className="login-title login-title-spaced">You're Invited!</h1>
        <p className="login-muted">Set up your account to join the platform.</p>

        {error && <div className="login-error" role="alert">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-name">Full Name *</label>
            <input id="invite-name" className="form-input" type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-password">Password *</label>
            <input id="invite-password" className="form-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" required minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-confirm">Confirm Password *</label>
            <input id="invite-confirm" className="form-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary login-submit">Create Account</button>
        </form>

        <p className="login-muted login-footnote">Already have an account? <a href="/login">Sign in</a></p>
      </div>
    </div>
  )
}
