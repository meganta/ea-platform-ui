import { useLang } from '../contexts/LangContext'
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api, setToken } from '../lib/api'
import BrandLogo from '../brand/BrandLogo'
import BrandPattern from '../brand/BrandPattern'
import Icon from '../brand/icons'
import '../brand/brand.css'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

export default function InviteAcceptPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const { token } = useParams<{ token: string }>()
  const nav = useNavigate()
  const [validating, setValidating] = useState(true)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!token) { setValidating(false); setError(L('Invalid invitation link', 'رابط الدعوة غير صالح')); return }
    // We can't call a protected endpoint, so we just show the form.
    // The accept endpoint will validate the token server-side.
    setValidating(false)
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!fullName.trim()) { setError(L('Full name is required', 'الاسم الكامل مطلوب')); return }
    if (password.length < 8) { setError(L('Password must be at least 8 characters', 'يجب ألا تقل كلمة المرور عن 8 أحرف')); return }
    if (password !== confirmPassword) { setError(L('Passwords do not match', 'كلمتا المرور غير متطابقتين')); return }

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
      setError(e.message || L('Failed to accept invitation', 'تعذّر قبول الدعوة'))
    }
  }

  if (validating) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p style={{ marginTop: 16, color: 'var(--text-dim)' }}>{L('Validating invitation...', 'جارٍ التحقق من الدعوة...')}</p>
      </div>
    )
  }

  if (success) {
    return (
      <div className="login-page">
        <BrandPattern variant="flow" intensity={0.35} />
        <div className="login-card login-card-center" role="status">
          <span className="login-done-mark"><Icon name="check" size={28} /></span>
          <h2 className="login-title">{L('Account Created!', 'تم إنشاء الحساب!')}</h2>
          <p className="login-muted">{L('Your account has been set up. Redirecting to the platform...', 'تم إعداد حسابك. جارٍ تحويلك إلى المنصة...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <BrandPattern variant="flow" intensity={0.35} />
      <div className="login-card">
        <BrandLogo size={24} />
        <h1 className="login-title login-title-spaced">{L('You\'re Invited!', 'أنت مدعو!')}</h1>
        <p className="login-muted">{L('Set up your account to join the platform.', 'أعدّ حسابك للانضمام إلى المنصة.')}</p>

        {error && <div className="login-error" role="alert">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-name">{L('Full Name *', 'الاسم الكامل *')}</label>
            <input id="invite-name" className="form-input" type="text" autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={L('Your full name', 'اسمك الكامل')} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-password">{L('Password *', 'كلمة المرور *')}</label>
            <input id="invite-password" className="form-input" type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={L('Min 8 characters', '8 أحرف على الأقل')} required minLength={8} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="invite-confirm">{L('Confirm Password *', 'تأكيد كلمة المرور *')}</label>
            <input id="invite-confirm" className="form-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={L('Repeat password', 'أعد إدخال كلمة المرور')} required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary login-submit">{L('Create Account', 'إنشاء الحساب')}</button>
        </form>

        <p className="login-muted login-footnote">{L('Already have an account?', 'لديك حساب بالفعل؟')} <a href="/login">{L('Sign in', 'تسجيل الدخول')}</a></p>
      </div>
    </div>
  )
}
