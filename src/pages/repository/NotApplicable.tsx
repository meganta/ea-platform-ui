import { NotApplicableMark } from './assetProfile'

type T = (k: string) => string

/** Shown where an attribute or relationship was marked not applicable to this object. */
export function NotApplicableBadge({ mark, t }: { mark: NotApplicableMark; t: T }) {
  return (
    <span className="ap-na" title={mark.reason || undefined}>
      <span className="ap-chip ap-chip-na">{t('repository.profile.na.badge')}</span>
      {mark.reason && <span className="ap-na-reason">{mark.reason}</span>}
    </span>
  )
}

/** "Not applicable to this object" checkbox with an optional reason, for the editor. */
export function NotApplicableToggle({ id, mark, onChange, t, disabled, hasValue }: {
  id: string; mark: NotApplicableMark | null | undefined; onChange: (m: NotApplicableMark | null) => void; t: T; disabled?: boolean; hasValue?: boolean
}) {
  return (
    <div className="ap-na-toggle">
      <label className="ap-toggle" htmlFor={id}>
        <input id={id} type="checkbox" checked={!!mark} disabled={disabled} onChange={e => onChange(e.target.checked ? { reason: mark?.reason ?? '', at: new Date().toISOString().slice(0, 10) } : null)} />
        {t('repository.profile.na.label')}
      </label>
      {mark && (
        <>
          <label className="sr-only" htmlFor={`${id}-reason`} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{t('repository.profile.na.reason')}</label>
          <input id={`${id}-reason`} className="form-input ap-na-reason-input" value={mark.reason || ''} maxLength={500} placeholder={t('repository.profile.na.reason')} disabled={disabled}
            onChange={e => onChange({ ...mark, reason: e.target.value })} />
          {hasValue && <span className="ap-na-hint">{t('repository.profile.na.value_counts')}</span>}
        </>
      )}
    </div>
  )
}
