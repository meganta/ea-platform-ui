import { FormEvent, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'
import HelpTip from '../components/HelpTip'

export default function ChangePasswordPage() {
  const { locale } = useLang()
  const ar = locale === 'AR'
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    setSuccess(false)
    if (newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) {
      setError(ar ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل وألا تتجاوز 72 بايت.' : 'Password must contain at least 8 characters and at most 72 UTF-8 bytes.')
      return
    }
    if (newPassword !== confirmation) {
      setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.')
      return
    }
    if (newPassword === currentPassword) {
      setError(ar ? 'اختر كلمة مرور مختلفة عن الحالية.' : 'Choose a password different from your current password.')
      return
    }
    setBusy(true)
    try {
      await api.changeMyPassword({ currentPassword, newPassword })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setSuccess(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(message === 'Current password is incorrect'
        ? (ar ? 'كلمة المرور الحالية غير صحيحة.' : message)
        : (ar ? 'تعذر تغيير كلمة المرور. حاول مرة أخرى.' : message || 'Unable to change password. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ padding: 24 }} dir={ar ? 'rtl' : 'ltr'}>
      <h1 style={{ fontSize: 24 }}>{ar ? 'تغيير كلمة المرور' : 'Change password'}<HelpTip text={ar ? 'أدخل كلمة المرور الحالية للتحقق من هويتك. بعد التغيير، ستحتاج الجلسات إلى تسجيل الدخول مجددًا عند انتهاء صلاحيتها.' : 'Enter your current password to verify your identity. After changing it, sessions must sign in again when their access expires.'} /></h1>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 440 }}>
        {error && <div role="alert" className="login-error">{error}</div>}
        {success && <p role="status">{ar ? 'تم تغيير كلمة المرور بنجاح.' : 'Your password has been changed.'}</p>}
        <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="current-password">{ar ? 'كلمة المرور الحالية' : 'Current password'}</label>
            <input id="current-password" className="form-input" type="password" autoComplete="current-password" required value={currentPassword} onChange={e => { setCurrentPassword(e.target.value); setSuccess(false) }} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">{ar ? 'كلمة المرور الجديدة' : 'New password'}</label>
            <input id="new-password" className="form-input" type="password" autoComplete="new-password" required minLength={8} aria-describedby="password-requirements" value={newPassword} onChange={e => { setNewPassword(e.target.value); setSuccess(false) }} />
            <small id="password-requirements">{ar ? '8 أحرف على الأقل' : 'At least 8 characters'}</small>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">{ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password'}</label>
            <input id="confirm-password" className="form-input" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={e => { setConfirmation(e.target.value); setSuccess(false) }} />
          </div>
          <button type="submit" className="btn btn-primary">{busy ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'تغيير كلمة المرور' : 'Change password')}</button>
        </fieldset>
      </form>
    </div>
  )
}
