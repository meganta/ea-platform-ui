import type { ReactElement } from 'react'
import { EnumOption } from './assetProfile'

/**
 * One Meta Model attribute as an input that fits its type: text, long text,
 * numbers (with % for percentages), yes/no, dates, links, e-mail, a list of
 * values (single or several), or JSON. Labelled with htmlFor/id.
 */
export interface FieldDef { code: string; name: string; nameAr?: string | null; attributeType: string; isRequired: boolean; isReadOnly?: boolean; placeholder?: string | null; helpText?: string | null; helpTextAr?: string | null; enumValues?: EnumOption[] }

export default function AttributeField({ def, value, onChange, idPrefix, isAR, t, error }: {
  def: FieldDef; value: any; onChange: (v: any) => void; idPrefix: string; isAR: boolean; t: (k: string) => string; error?: string | null
}) {
  const id = `${idPrefix}-${def.code}`
  const label = (isAR && def.nameAr) || def.name
  const help = (isAR && def.helpTextAr) || def.helpText
  const options = def.enumValues || []
  const common = { id, className: 'form-input', disabled: def.isReadOnly, 'aria-invalid': !!error || undefined, 'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : undefined } as const
  const optionLabel = (o: EnumOption) => (isAR && o.labelAr) || o.label
  const type = def.attributeType
  let input: ReactElement
  if (type === 'MULTI_ENUM' && options.length) {
    const selected: string[] = Array.isArray(value) ? value : []
    input = (
      <div role="group" aria-labelledby={`${id}-label`} className="ap-checks">
        {options.map(o => (
          <label key={o.value} className="ap-check" htmlFor={`${id}-${o.value}`}>
            <input id={`${id}-${o.value}`} type="checkbox" disabled={def.isReadOnly} checked={selected.includes(o.value)}
              onChange={e => onChange(e.target.checked ? [...selected, o.value] : selected.filter(v => v !== o.value))} />
            {optionLabel(o)}
          </label>
        ))}
      </div>
    )
  } else if (options.length) {
    // A stored value that is no longer one of the list's options stays visible and selectable.
    const legacy = value && !options.some(o => o.value === value) ? [{ value, label: `${value} (${t('repository.profile.not_in_list')})` }] : []
    input = (
      <select {...common} value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">{t('repository.profile.select')}</option>
        {[...options, ...legacy].map(o => <option key={o.value} value={o.value}>{optionLabel(o as EnumOption)}</option>)}
      </select>
    )
  } else if (type === 'BOOLEAN') {
    input = (
      <select {...common} value={value ?? ''} onChange={e => onChange(e.target.value)}>
        <option value="">{t('repository.profile.not_set')}</option>
        <option value="true">{t('repository.profile.yes')}</option>
        <option value="false">{t('repository.profile.no')}</option>
      </select>
    )
  } else if (type === 'LONG_TEXT' || type === 'RICH_TEXT' || type === 'JSON_DATA') {
    input = <textarea {...common} rows={type === 'JSON_DATA' ? 5 : 3} value={value ?? ''} placeholder={def.placeholder || undefined} onChange={e => onChange(e.target.value)} dir={type === 'JSON_DATA' ? 'ltr' : undefined} />
  } else {
    const htmlType = type === 'INTEGER' || type === 'DECIMAL' || type === 'PERCENTAGE' || type === 'CURRENCY' || type === 'MATURITY_SCORE' ? 'number'
      : type === 'DATE' ? 'date' : type === 'DATETIME' ? 'datetime-local' : type === 'URL' ? 'url' : type === 'EMAIL' ? 'email' : 'text'
    input = (
      <div className="ap-input-row">
        <input {...common} type={htmlType} step={type === 'INTEGER' ? 1 : htmlType === 'number' ? 'any' : undefined} value={value ?? ''} placeholder={def.placeholder || undefined}
          dir={htmlType === 'url' || htmlType === 'email' ? 'ltr' : undefined} onChange={e => onChange(e.target.value)} />
        {type === 'PERCENTAGE' && <span className="ap-suffix" aria-hidden>%</span>}
      </div>
    )
  }
  return (
    <div className="form-group ap-field">
      <label className="form-label" id={`${id}-label`} htmlFor={type === 'MULTI_ENUM' && options.length ? undefined : id}>
        {label}{def.isRequired && <span className="ap-required" aria-label={t('repository.profile.required')}> *</span>}
      </label>
      {input}
      {help && !error && <div id={`${id}-help`} className="ap-help">{help}</div>}
      {error && <div id={`${id}-error`} role="alert" className="ap-error">{t(error)}</div>}
    </div>
  )
}
