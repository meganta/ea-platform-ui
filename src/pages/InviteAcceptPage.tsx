import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const nav = useNavigate()
  const [validating, setValidating] = useState(true)
  const [valid, setValid] = useState(false)
  const [invitation, setInvitation] = useState<any>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) { setValidating(false); setError('Invalid invitation link'); return }
    // We can't call a protected endpoint, so we just show the form.
    // The accept endpoint will validate the token server-side.
    setValid(true)
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
          nav('/')
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--navy)' }}>
        <div style={{ textAlign: 'center', padding: 40, background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h2 style={{ marginBottom: 8 }}>Account Created!</h2>
          <p style={{ color: 'var(--text-dim)' }}>Your account has been set up. Redirecting to the platform...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--navy)', padding: 20 }}>
      <div style={{ width: 400, maxWidth: '100%', background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: 32, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>You're Invited!</h1>
          <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 4 }}>Set up your account to join the platform.</p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)', fontSize: 13 }}>
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>Full Name *</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 14 }} placeholder="Your full name" required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>Password *</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 14 }} placeholder="Min 8 characters" required minLength={8} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>Confirm Password *</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 14 }} placeholder="Repeat password" required minLength={8} />
          </div>
          <button type="submit" style={{ width: '100%', padding: '12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Create Account
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-dim)' }}>
          Already have an account? <a href="/login" style={{ color: 'var(--accent)', fontWeight: 500 }}>Sign in</a>
        </div>
      </div>
    </div>
  )
}
