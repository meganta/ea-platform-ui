import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import HelpTip from '../../components/HelpTip'
import { API_BASE, getToken } from '../../lib/api'
import { PS_COVERS, PS_HEADERS, PS_LOGO, PS_MEASURED, PS_PALETTE, PS_POINTS, PS_TABLES, PS_TONES } from './presentationStyleStrings'

export interface PresentationStyle {
  fonts: { latinHeading: string | null; latinBody: string | null; arabic: string | null; measureLatinAs: string }
  palette: Record<'primary' | 'accent' | 'ink' | 'surface', string | null>
  cover: string | null; header: string | null; table: string | null; points: string | null
  logoPlacement: string; tone: string; guidelines: string | null
}
interface StyleView { published: PresentationStyle | null; draft: PresentationStyle | null; publishedAt: string | null; editing: PresentationStyle; warnings: string[] }

async function call(method: string, path: string, body?: any) {
  const r = await fetch(`${API_BASE}${path}`, { method, headers: { Authorization: `Bearer ${getToken() || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const data = await r.json().catch(() => null)
  if (!r.ok) throw new Error(data?.message ? (Array.isArray(data.message) ? data.message.join(', ') : String(data.message)) : `HTTP ${r.status}`)
  return data
}

/** What the server stores: '#' added back for colour inputs, empty -> null. */
const hexIn = (v: string | null) => (v ? `#${v}` : '')
const orNull = (v: string) => (v.trim() ? v.trim() : null)

/**
 * The organization's presentation style for decks (Settings > Organization >
 * Branding): fonts, colours, layout choices, logo position, tone and
 * guidelines. Edited as a draft, checked with a downloaded sample deck, then
 * published by an administrator. Validation (legibility, names) is the server's.
 */
export default function PresentationStyleCard() {
  const { t, isAR } = useLang()
  const { hasPermission } = useAuth()
  const isAdmin = hasPermission('Tenant.Administer')
  const [view, setView] = useState<StyleView | null>(null)
  const [form, setForm] = useState<PresentationStyle | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  const accept = useCallback((v: StyleView) => { setView(v); setForm(v.editing); setDirty(false) }, [])
  // Loaded once; `t` is read at failure time only, so a language switch never reloads (and resets) the form.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { call('GET', '/branding/presentation-style').then(accept).catch(e => setMsg({ type: 'error', text: `${t('pstyle.load_failed')}: ${e.message}` })) }, [accept])

  const set = (patch: (f: PresentationStyle) => PresentationStyle) => { setForm(f => (f ? patch(f) : f)); setDirty(true); setMsg(null) }
  const run = async (key: string, fn: () => Promise<any>, ok?: string) => {
    setBusy(key); setMsg(null)
    try { const v = await fn(); if (v && v.editing) accept(v); if (ok) setMsg({ type: 'ok', text: ok }) } catch (e: any) { setMsg({ type: 'error', text: e.message }) } finally { setBusy('') }
  }
  const preview = (language: 'EN' | 'AR') => run(`preview-${language}`, async () => {
    const r = await fetch(`${API_BASE}/branding/presentation-style/preview?language=${language}`, { method: 'POST', headers: { Authorization: `Bearer ${getToken() || localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(d?.message ? String(d.message) : `HTTP ${r.status}`) }
    const url = URL.createObjectURL(await r.blob())
    const a = document.createElement('a'); a.href = url; a.download = `presentation-style-preview-${language.toLowerCase()}.pptx`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })

  const state = useMemo(() => {
    if (!view) return ''
    if (view.draft) return t('pstyle.state.draft')
    return view.published ? t('pstyle.state.published').replace('{date}', view.publishedAt ? view.publishedAt.slice(0, 10) : '') : t('pstyle.state.builtin')
  }, [view, t])

  if (!form || !view) return <div className="card" style={{ marginTop: 16 }} data-testid="pstyle-card">{msg ? <div role="alert" style={{ color: 'var(--danger)' }}>{msg.text}</div> : t('pstyle.loading')}</div>

  const choice = (id: string, labelKey: string, value: string | null, options: readonly string[], prefix: string, onChange: (v: string | null) => void, allowDefault = true) => (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label" htmlFor={id}>{t(labelKey)}</label>
      <select id={id} className="form-input" value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
        {allowDefault && <option value="">{t('pstyle.design_default')}</option>}
        {options.map(o => <option key={o} value={o}>{prefix ? t(`${prefix}.${o}`) : o}</option>)}
      </select>
    </div>
  )

  return (
    <div className="card" style={{ marginTop: 16 }} dir={isAR ? 'rtl' : 'ltr'} data-testid="pstyle-card">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', fontSize: 15 }}>{t('pstyle.title')}<HelpTip text={t('pstyle.help')} /></div>
      <div style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 12 }} data-testid="pstyle-state">{state}{dirty ? ` · ${t('pstyle.unsaved')}` : ''}</div>

      <div className="section-title" style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>{t('pstyle.fonts')}<HelpTip text={t('pstyle.fonts_help')} /></div>
      <div className="stat-grid-4" style={{ gap: 10, marginBottom: 14 }}>
        {(['latinHeading', 'latinBody', 'arabic'] as const).map(k => (
          <div key={k} className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor={`pstyle-font-${k}`}>{t(`pstyle.font.${k}`)}</label>
            <input id={`pstyle-font-${k}`} className="form-input" placeholder={t('pstyle.font_placeholder')} value={form.fonts[k] ?? ''} maxLength={60} onChange={e => set(f => ({ ...f, fonts: { ...f.fonts, [k]: orNull(e.target.value) } }))} />
          </div>
        ))}
        {choice('pstyle-font-measure', 'pstyle.font.measure', form.fonts.measureLatinAs, PS_MEASURED, '', v => set(f => ({ ...f, fonts: { ...f.fonts, measureLatinAs: v || 'Calibri' } })), false)}
      </div>

      <div className="section-title" style={{ display: 'flex', alignItems: 'center', fontSize: 13 }}>{t('pstyle.colours')}<HelpTip text={t('pstyle.colours_help')} /></div>
      <div className="stat-grid-4" style={{ gap: 10, marginBottom: 14 }}>
        {PS_PALETTE.map(k => (
          <div key={k} className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor={`pstyle-colour-${k}`}>{t(`pstyle.colour.${k}`)}</label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input type="color" aria-label={t(`pstyle.colour.${k}`)} value={hexIn(form.palette[k]) || '#ffffff'} onChange={e => set(f => ({ ...f, palette: { ...f.palette, [k]: e.target.value.replace('#', '').toUpperCase() } }))} style={{ width: 36, height: 30, padding: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none' }} />
              <input id={`pstyle-colour-${k}`} className="form-input" placeholder={t('pstyle.design_default')} value={hexIn(form.palette[k])} onChange={e => set(f => ({ ...f, palette: { ...f.palette, [k]: orNull(e.target.value.replace('#', '')) } }))} />
            </div>
          </div>
        ))}
      </div>

      <div className="section-title" style={{ fontSize: 13 }}>{t('pstyle.layout')}</div>
      <div className="stat-grid-5" style={{ gap: 10, marginBottom: 14 }}>
        {choice('pstyle-cover', 'pstyle.cover', form.cover, PS_COVERS, 'pstyle.cover', v => set(f => ({ ...f, cover: v })))}
        {choice('pstyle-header', 'pstyle.header', form.header, PS_HEADERS, 'pstyle.header', v => set(f => ({ ...f, header: v })))}
        {choice('pstyle-table', 'pstyle.table', form.table, PS_TABLES, 'pstyle.table', v => set(f => ({ ...f, table: v })))}
        {choice('pstyle-points', 'pstyle.points', form.points, PS_POINTS, 'pstyle.points', v => set(f => ({ ...f, points: v })))}
        {choice('pstyle-logo', 'pstyle.logo', form.logoPlacement, PS_LOGO, 'pstyle.logo', v => set(f => ({ ...f, logoPlacement: v || 'END' })), false)}
      </div>

      <div className="section-title" style={{ fontSize: 13 }}>{t('pstyle.writing')}</div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        {choice('pstyle-tone', 'pstyle.tone', form.tone, PS_TONES, 'pstyle.tone', v => set(f => ({ ...f, tone: v || 'FORMAL' })), false)}
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label" htmlFor="pstyle-guidelines" style={{ display: 'flex', alignItems: 'center' }}>{t('pstyle.guidelines')}<HelpTip text={t('pstyle.guidelines_help')} /></label>
          <textarea id="pstyle-guidelines" className="form-input" rows={4} maxLength={4000} value={form.guidelines ?? ''} onChange={e => set(f => ({ ...f, guidelines: e.target.value || null }))} />
        </div>
      </div>

      {view.warnings.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }} data-testid="pstyle-warnings">
          <strong>{t('pstyle.warnings')}:</strong>
          <ul style={{ margin: '4px 0', paddingInlineStart: 18 }}>{view.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        </div>
      )}
      {msg && <div role={msg.type === 'error' ? 'alert' : 'status'} style={{ color: msg.type === 'error' ? 'var(--danger)' : 'var(--success)', fontSize: 12, marginBottom: 8 }}>{msg.text}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || !dirty} onClick={() => run('save', () => call('PUT', '/branding/presentation-style', form), t('pstyle.saved'))}>{busy === 'save' ? t('pstyle.saving') : t('pstyle.save')}</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => preview('EN')}>{t('pstyle.preview_en')}</button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => preview('AR')}>{t('pstyle.preview_ar')}</button>
        <HelpTip text={t('pstyle.preview_help')} />
        {isAdmin && view.draft && <button type="button" className="btn btn-primary btn-sm" disabled={!!busy || dirty} onClick={() => run('publish', () => call('POST', '/branding/presentation-style/publish'), t('pstyle.published_ok'))}>{t('pstyle.publish')}</button>}
        {view.draft && <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run('discard', () => call('POST', '/branding/presentation-style/discard'))}>{t('pstyle.discard')}</button>}
        {isAdmin && view.published && <button type="button" className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => { if (window.confirm(t('pstyle.reset_confirm'))) run('reset', () => call('POST', '/branding/presentation-style/reset')) }}>{t('pstyle.reset')}</button>}
      </div>
      {!isAdmin && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6 }}>{t('pstyle.admin_only')}</div>}
    </div>
  )
}
