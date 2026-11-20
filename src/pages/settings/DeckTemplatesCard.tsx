import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import HelpTip from '../../components/HelpTip'
import { API_BASE, getToken } from '../../lib/api'
import { DT_LANGUAGES } from './deckTemplateStrings'

type Lang = typeof DT_LANGUAGES[number]
export interface DeckTemplateView {
  fileName: string; size: number; uploadedAt: string; isDefault: boolean
  layouts: { cover: string; content: string }; palette: { primary: string; accent: string }; fonts: { latin: string | null; arabic: string | null }; sampleSlides: number
}
type Templates = Record<Lang, DeckTemplateView | null>

const auth = () => ({ Authorization: `Bearer ${getToken() || localStorage.getItem('token') || ''}` })
async function call(method: string, path: string, body?: any): Promise<any> {
  const isForm = body instanceof FormData
  const r = await fetch(`${API_BASE}${path}`, { method, headers: isForm ? auth() : { ...auth(), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : isForm ? body : JSON.stringify(body) })
  if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ? (Array.isArray(d.message) ? d.message.join(', ') : String(d.message)) : `HTTP ${r.status}`) }
  return r
}
function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''))

/**
 * The organization's own PowerPoint templates (Settings > Organization >
 * Branding), one per language. Upload reads the template on the server and
 * makes it the default; the default frames every deck in that language.
 */
export default function DeckTemplatesCard() {
  const { t, isAR } = useLang()
  const { hasPermission } = useAuth()
  const isAdmin = hasPermission('Tenant.Administer')
  const [data, setData] = useState<Templates | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => call('GET', '/branding/deck-templates').then(r => r.json()).then(setData).catch(e => setMsg({ type: 'error', text: `${t('dtpl.load_failed')}: ${e.message}` })), [])
  useEffect(() => { load() }, [load])

  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key); setMsg(null)
    try { const r = await fn(); if (r) setData(r); if (ok) setMsg({ type: 'ok', text: ok }) } catch (e: any) { setMsg({ type: 'error', text: e.message }) } finally { setBusy('') }
  }
  const upload = (lang: Lang, file: File | undefined) => {
    if (!file) return
    const fd = new FormData(); fd.append('file', file)
    run(`upload-${lang}`, () => call('POST', `/branding/deck-templates/${lang}`, fd).then(r => r.json()), t('dtpl.uploaded_ok'))
  }
  const sample = (lang: Lang) => run(`sample-${lang}`, async () => {
    const r = await call('POST', `/branding/presentation-style/preview?language=${lang}`, {})
    save(await r.blob(), `template-sample-${lang.toLowerCase()}.pptx`)
  })
  const download = (lang: Lang, name: string) => run(`download-${lang}`, async () => { const r = await call('GET', `/branding/deck-templates/${lang}/file`); save(await r.blob(), name) })

  return (
    <div className="card" dir={isAR ? 'rtl' : 'ltr'} data-testid="deck-templates">
      <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{t('dtpl.title')} <HelpTip text={t('dtpl.help')} /></h3>
      {!isAdmin && <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>{t('dtpl.admin_only')}</p>}
      {msg && <div role={msg.type === 'ok' ? 'status' : 'alert'} style={{ color: msg.type === 'ok' ? 'var(--success)' : 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{msg.text}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {DT_LANGUAGES.map(lang => {
          const v = data?.[lang] || null
          const inputId = `dtpl-file-${lang}`
          return (
            <section key={lang} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, minWidth: 0 }} aria-labelledby={`dtpl-h-${lang}`} data-testid={`dtpl-${lang}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h4 id={`dtpl-h-${lang}`} style={{ margin: 0 }}>{t(`dtpl.lang.${lang}`)}</h4>
                {v && <span className="badge" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: v.isDefault ? 'rgba(22,163,74,0.14)' : 'var(--navy-mid)', color: v.isDefault ? 'var(--success)' : 'var(--text-dim)' }}>{v.isDefault ? t('dtpl.default_on') : t('dtpl.default_off')}</span>}
              </div>
              {!v ? <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{t('dtpl.none')}</p> : (
                <dl style={{ fontSize: 12.5, margin: '8px 0', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 10px' }}>
                  <dt>{t('dtpl.file')}</dt><dd style={{ margin: 0, overflowWrap: 'anywhere' }}>{v.fileName}</dd>
                  <dt>{t('dtpl.uploaded')}</dt><dd style={{ margin: 0 }} dir="ltr">{v.uploadedAt.slice(0, 10)}</dd>
                  <dt>{t('dtpl.layouts')}</dt><dd style={{ margin: 0 }}>{t('dtpl.layout_cover')}: {v.layouts.cover} · {t('dtpl.layout_content')}: {v.layouts.content}</dd>
                  <dt>{t('dtpl.colours')}</dt><dd style={{ margin: 0, display: 'flex', gap: 6, alignItems: 'center' }}>{[v.palette.primary, v.palette.accent].map(c => <span key={c} title={`#${c}`} data-testid="dtpl-swatch" style={{ width: 16, height: 16, borderRadius: 3, background: `#${c}`, border: '1px solid var(--border)', display: 'inline-block' }} />)}<span dir="ltr">#{v.palette.primary} · #{v.palette.accent}</span></dd>
                  <dt>{t('dtpl.fonts')}</dt><dd style={{ margin: 0 }}>{[v.fonts.latin, v.fonts.arabic].filter((f, i, a) => f && a.indexOf(f) === i).join(' / ') || '—'}</dd>
                  <dd style={{ margin: 0, gridColumn: '1 / -1', color: 'var(--text-muted)' }}>{fill(t('dtpl.samples'), { n: v.sampleSlides })}</dd>
                </dl>
              )}
              {v && isAdmin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, margin: '6px 0' }}>
                  <input type="checkbox" checked={v.isDefault} disabled={!!busy} onChange={e => run(`default-${lang}`, () => call('PUT', `/branding/deck-templates/${lang}/default`, { isDefault: e.target.checked }).then(r => r.json()))} />
                  {t('dtpl.default')}
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {isAdmin && <>
                  <label htmlFor={inputId} className="btn btn-secondary" style={{ cursor: busy ? 'default' : 'pointer' }}>{busy === `upload-${lang}` ? t('dtpl.uploading') : v ? t('dtpl.replace') : t('dtpl.upload')}</label>
                  <input id={inputId} type="file" accept=".pptx,.potx" aria-label={fill(t('dtpl.upload_label'), { lang: t(`dtpl.lang.${lang}`) })} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} disabled={!!busy} onChange={e => { upload(lang, e.target.files?.[0]); e.target.value = '' }} />
                </>}
                {v && <button className="btn btn-secondary" disabled={!!busy} onClick={() => sample(lang)}>{t('dtpl.sample')}</button>}
                {v && <button className="btn btn-ghost" disabled={!!busy} onClick={() => download(lang, v.fileName)}>{t('dtpl.download')}</button>}
                {v && isAdmin && <button className="btn btn-ghost" disabled={!!busy} onClick={() => { if (window.confirm(t('dtpl.remove_confirm'))) run(`remove-${lang}`, () => call('DELETE', `/branding/deck-templates/${lang}`).then(r => r.json())) }}>{t('dtpl.remove')}</button>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
