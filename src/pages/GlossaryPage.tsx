import { useLang } from '../contexts/LangContext'
import { useState, useEffect, useCallback, useMemo } from 'react'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (p: string) => fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const put = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok)
    return { get, post, put, del }
  }, [])
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const DOMAINS = ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY', 'GOVERNANCE', 'GENERAL']
const DOMAIN_COLOR: Record<string, string> = {
  BUSINESS: '#e74c3c', BENEFICIARY_EXPERIENCE: '#9b59b6', APPLICATIONS: '#3498db', DATA: '#1abc9c',
  TECHNOLOGY: '#f39c12', SECURITY: '#e67e22', GOVERNANCE: '#2ecc71', GENERAL: '#7f8c8d',
}
const domainColor = (d?: string) => DOMAIN_COLOR[d || 'GENERAL'] || '#7f8c8d'

export default function GlossaryPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const api = useApi()
  const [terms, setTerms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [domainFilter, setDomainFilter] = useState('')
  const [editing, setEditing] = useState<any>(null) // term being edited, or a fresh draft
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/glossary').then((d: any) => { setTerms(Array.isArray(d) ? d : []); setLoading(false) })
  }, [api])
  useEffect(() => { load() }, [load])

  const startNew = () => setEditing({ termEn: '', termAr: '', definition: '', domain: '' })
  const startEdit = (t: any) => setEditing({ ...t })

  const save = async () => {
    if (!editing.termEn || !editing.termAr) return alert(L('English and Arabic terms are both required', 'المصطلح بالإنجليزية والعربية مطلوبان'))
    setSaving(true)
    try {
      const payload = { termEn: editing.termEn, termAr: editing.termAr, definition: editing.definition || undefined, domain: editing.domain || undefined }
      if (editing.id) await api.put(`/glossary/${editing.id}`, payload)
      else await api.post('/glossary', payload)
      setEditing(null); load()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    if (!window.confirm(L('Delete this glossary term?', 'حذف هذا المصطلح من المسرد؟'))) return
    await api.del(`/glossary/${id}`); load()
  }

  const filtered = terms.filter(t => {
    if (domainFilter && t.domain !== domainFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!t.termEn.toLowerCase().includes(q) && !t.termAr.includes(search) && !(t.definition || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{L('📖 Glossary', '📖 المسرد')}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Bilingual EA terminology definitions for this tenant', 'تعريفات مصطلحات البنية المؤسسية بلغتين لهذه الجهة')}</div>
        </div>
        <button style={S.btn('primary')} onClick={startNew}>{L('+ New Term', '+ مصطلح جديد')}</button>
      </div>
      <div style={S.content}>
        {editing && (
          <div style={S.card}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>{editing.id ? L('Edit Term', 'تعديل المصطلح') : L('New Term', 'مصطلح جديد')}</div>
            <div style={S.grid2}>
              <div><div style={S.label}>{L('Term (EN) *', 'المصطلح (بالإنجليزية) *')}</div><input style={S.input} value={editing.termEn} onChange={e => setEditing((v: any) => ({ ...v, termEn: e.target.value }))} /></div>
              <div><div style={S.label}>{L('Term (AR) *', 'المصطلح (بالعربية) *')}</div><input style={S.input} dir="rtl" value={editing.termAr} onChange={e => setEditing((v: any) => ({ ...v, termAr: e.target.value }))} /></div>
            </div>
            <div style={S.label}>{L('Domain', 'المجال')}</div>
            <select style={S.input} value={editing.domain || ''} onChange={e => setEditing((v: any) => ({ ...v, domain: e.target.value }))}>
              <option value="">{L('General / Unspecified', 'عام / غير محدد')}</option>
              {DOMAINS.filter(d => d !== 'GENERAL').map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
            </select>
            <div style={S.label}>{L('Definition', 'التعريف')}</div>
            <textarea style={{ ...S.input, minHeight: 70 }} value={editing.definition || ''} onChange={e => setEditing((v: any) => ({ ...v, definition: e.target.value }))} />
            <div style={S.row}>
              <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? L('Saving…', 'جارٍ الحفظ…') : L('💾 Save', '💾 حفظ')}</button>
              <button style={S.btn()} onClick={() => setEditing(null)}>{L('Cancel', 'إلغاء')}</button>
            </div>
          </div>
        )}

        <div style={{ ...S.row, marginBottom: 16 }}>
          <input style={{ ...S.input, marginBottom: 0, flex: 1 }} placeholder={L('Search terms or definitions…', 'ابحث في المصطلحات أو التعريفات…')} value={search} onChange={e => setSearch(e.target.value)} />
          <select style={{ ...S.input, marginBottom: 0, width: 200 }} value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
            <option value="">{L('All Domains', 'كل المجالات')}</option>
            {DOMAINS.map(d => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
            {terms.length === 0 ? L('No glossary terms yet. Add the first one to start building your tenant vocabulary.', 'لا توجد مصطلحات في المسرد بعد. أضف أول مصطلح لبدء بناء مفردات جهتك.') : L('No terms match your search.', 'لا توجد مصطلحات تطابق بحثك.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(t => (
              <div key={t.id} style={{ ...S.card, marginBottom: 0, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{t.termEn}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-dim)' }} dir="rtl">{t.termAr}</span>
                    </div>
                    {t.definition && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{t.definition}</div>}
                  </div>
                  {t.domain && <span style={S.badge(domainColor(t.domain))}>{t.domain.replace('_', ' ')}</span>}
                  <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => startEdit(t)}>{L('Edit', 'تعديل')}</button>
                  <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => remove(t.id)}>{L('Delete', 'حذف')}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
