import { useEffect, useState } from 'react'
import { FvApi, T } from './fvApi'

export interface PickedAsset { id: string; name: string; assetType?: string }

/** Searches Repository objects by name and adds them to a list (ids only are sent to the backend). */
export default function AssetPicker({ api, t, id, value, onChange, single = false }: { api: FvApi; t: T; id: string; value: PickedAsset[]; onChange: (v: PickedAsset[]) => void; single?: boolean }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PickedAsset[]>([])
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const h = setTimeout(() => {
      api.get(`/ea-repository/assets?search=${encodeURIComponent(query.trim())}&pageSize=8&page=1`)
        .then((r: any) => setResults((Array.isArray(r) ? r : r?.items || r?.data || []).slice(0, 8)))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(h)
  }, [api, query])
  const add = (a: PickedAsset) => { onChange(single ? [a] : [...value.filter(v => v.id !== a.id), a]); setQuery(''); setResults([]) }
  return (
    <div>
      <input id={id} className="form-input" value={query} placeholder={t('fv.asset.search')} onChange={e => setQuery(e.target.value)} />
      {results.length > 0 && (
        <ul className="ah-list" style={{ listStyle: 'none', paddingInlineStart: 0, marginTop: 4 }}>
          {results.map(r => <li key={r.id}><button type="button" className="ah-link-btn" onClick={() => add(r)}>{r.name}</button> <span className="ah-dim">{r.assetType}</span></li>)}
        </ul>
      )}
      {value.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {value.map(v => <span key={v.id} className="fv-chip">{v.name} <button type="button" className="ah-link-btn" aria-label={`${t('fv.remove')} ${v.name}`} onClick={() => onChange(value.filter(x => x.id !== v.id))}>×</button></span>)}
        </div>
      )}
    </div>
  )
}
