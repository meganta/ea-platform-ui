import { useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useLang } from '../../contexts/LangContext'

/** "{n} of {m}" placeholder filling for owner strings. */
export function fill(text: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), text)
}

export function Header({ title, subtitle, help, actions }: { title: string; subtitle?: string; help?: string; actions?: React.ReactNode }) {
  return (
    <div className="oc-header">
      <div>
        <h1 className="oc-title">{title}{help && <HelpTip text={help} />}</h1>
        {subtitle && <div className="oc-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  )
}

export function Tile({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="oc-tile">
      <div className="oc-tile-value">{value}</div>
      <div className="oc-tile-label">{label}</div>
      {note && <div className="oc-tile-note">{note}</div>}
    </div>
  )
}

export function Pill({ text, color }: { text: string; color: string }) {
  return <span className="oc-pill" style={{ color }}>{text}</span>
}

export function Loading() {
  const { t } = useLang()
  return <div className="oc-muted" role="status"><span className="spinner" style={{ width: 16, height: 16, display: 'inline-block', verticalAlign: 'middle', marginInlineEnd: 8 }} />{t('owner.loading')}</div>
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  const { t } = useLang()
  return <div className="oc-error" role="alert">{error}{onRetry && <> · <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>{t('owner.retry')}</button></>}</div>
}

/** Modal asking for a reason and/or the owner's password (step-up). */
export function StepUpModal({ title, help, needReason, reasonPlaceholder, extra, confirmLabel, onCancel, onConfirm }: {
  title: string; help?: string; needReason?: boolean; reasonPlaceholder?: string; extra?: React.ReactNode; confirmLabel?: string
  onCancel: () => void; onConfirm: (v: { reason: string; password: string }) => Promise<void>
}) {
  const { t } = useLang()
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try { await onConfirm({ reason: reason.trim(), password }) } catch (err: any) { setError(err.message || 'Error') } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 520, width: '100%' }}>
        <div className="modal-title">{title}</div>
        {help && <p className="oc-muted" style={{ marginBottom: 12 }}>{help}</p>}
        {error && <div className="oc-error" role="alert">{error}</div>}
        {needReason && (
          <div className="form-group">
            <label className="form-label" htmlFor="owner-stepup-reason">{t('owner.reason')}</label>
            <textarea id="owner-stepup-reason" className="form-input" rows={3} value={reason} placeholder={reasonPlaceholder} onChange={e => setReason(e.target.value)} required minLength={needReason ? 10 : 0} />
          </div>
        )}
        {extra}
        <div className="form-group">
          <label className="form-label" htmlFor="owner-stepup-password">{t('owner.password')}</label>
          <input id="owner-stepup-password" className="form-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
          <div className="oc-muted">{t('owner.password_help')}</div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{confirmLabel || t('owner.confirm')}</button>
        </div>
      </form>
    </div>
  )
}
