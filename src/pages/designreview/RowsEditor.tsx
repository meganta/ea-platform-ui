import { useLang } from '../../contexts/LangContext'

export type FieldKind = 'text' | 'area' | 'select' | 'list'
export interface FieldSpec { key: string; label: string; kind: FieldKind; options?: Array<{ value: string; label: string }>; placeholder?: string }

/**
 * Edits a list of rows field by field (inputs, text areas, selects, comma
 * lists), with add and remove. Every field has its own label (htmlFor/id).
 */
export default function RowsEditor({ idPrefix, rows, fields, onChange, blank, addLabel, fixed = false, legend }: {
  idPrefix: string; rows: any[]; fields: FieldSpec[]; onChange: (rows: any[]) => void; blank?: () => any; addLabel?: string
  /** Rows can be edited but not added or removed. */ fixed?: boolean; legend?: (row: any) => string
}) {
  const { t } = useLang()
  const set = (i: number, key: string, value: any) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
  return (
    <div className="dr-rows">
      {rows.map((row, i) => (
        <fieldset key={i} className="dr-row-edit">
          {legend ? <legend className="dr-dim">{legend(row)}</legend> : <legend className="sr-only">{`${i + 1}`}</legend>}
          {fields.map(f => {
            const id = `${idPrefix}-${i}-${f.key}`
            const value = f.kind === 'list' ? (Array.isArray(row[f.key]) ? row[f.key].join(', ') : row[f.key] ?? '') : row[f.key] ?? ''
            return (
              <div key={f.key} className={`dr-field dr-field-${f.kind}`}>
                <label className="form-label" htmlFor={id}>{f.label}</label>
                {f.kind === 'area' ? <textarea id={id} className="form-input" rows={3} value={value} onChange={e => set(i, f.key, e.target.value)} />
                  : f.kind === 'select' ? (
                    <select id={id} className="form-input" value={value} onChange={e => set(i, f.key, e.target.value)}>
                      {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : <input id={id} className="form-input" value={value} placeholder={f.placeholder}
                    onChange={e => set(i, f.key, e.target.value)} />}
              </div>
            )
          })}
          {!fixed && <button type="button" className="btn btn-ghost dr-remove" onClick={() => onChange(rows.filter((_, j) => j !== i))}>{t('dr.remove')}</button>}
        </fieldset>
      ))}
      {!fixed && blank && <button type="button" className="btn btn-secondary" onClick={() => onChange([...rows, blank()])}>{addLabel || t('dr.add')}</button>}
    </div>
  )
}

/** A comma list typed by a person (Latin or Arabic commas) -> items. */
export const commaList = (v: unknown): string[] => (Array.isArray(v) ? v : String(v ?? '').split(/[,،]/)).map(x => String(x).trim()).filter(Boolean)

/** One item per line <-> list. */
export const linesToList = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean)
export const listToLines = (l: string[] | undefined) => (l || []).join('\n')
