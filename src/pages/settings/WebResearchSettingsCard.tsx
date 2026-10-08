import { apiFetch } from '../../lib/session'
import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { SETTINGS_API_URL } from './shared'

type Provider = 'AUTO' | 'ANTHROPIC' | 'OPENAI' | 'NONE'
/** What research actually runs with (AUTO resolved against the AI settings), reported by the backend. */
interface Effective { provider: 'ANTHROPIC' | 'OPENAI' | 'NONE'; model: string | null; source: 'AI_SETTINGS' | 'FALLBACK' | 'OVERRIDE' | 'OFF'; reason: string | null }
interface WebResearch { provider: Provider; model: string | null; maxSearches: number; allowedDomains: string[]; blockedDomains: string[]; effective?: Effective }

const DEFAULT_MODEL: Record<string, string> = { ANTHROPIC: 'claude-opus-5-5', OPENAI: 'gpt-4o' }
const PROVIDER_NAME: Record<string, string> = { ANTHROPIC: 'Anthropic', OPENAI: 'OpenAI' }
const isOverride = (p: Provider) => p === 'ANTHROPIC' || p === 'OPENAI'

async function call(path: string, init: RequestInit = {}) {
  const r = await apiFetch(`${SETTINGS_API_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' } })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(body?.message ? (Array.isArray(body.message) ? body.message.join(', ') : body.message) : `HTTP ${r.status}`)
  return body
}

const toList = (text: string) => text.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean)

/**
 * Settings > AI & Copilot: internet research for technology research. By default it uses the same
 * provider and model as the AI settings; a provider can be chosen only as an override.
 */
export default function WebResearchSettingsCard() {
  const { t, isAR } = useLang()
  const [cfg, setCfg] = useState<WebResearch | null>(null)
  const [allowed, setAllowed] = useState('')
  const [blocked, setBlocked] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savedProvider, setSavedProvider] = useState<Provider | null>(null)

  useEffect(() => {
    call('/config/web-research').then((c: WebResearch) => { setCfg(c); setSavedProvider(c.provider); setAllowed((c.allowedDomains || []).join(', ')); setBlocked((c.blockedDomains || []).join(', ')) })
      .catch(e => setMsg({ ok: false, text: e.message }))
  }, [])

  const save = async () => {
    if (!cfg) return
    setSaving(true); setMsg(null)
    try {
      const a = toList(allowed); const b = toList(blocked)
      const saved: WebResearch = await call('/config/web-research', { method: 'PUT', body: JSON.stringify({ provider: cfg.provider, model: isOverride(cfg.provider) ? (cfg.model || '') : null, maxSearches: cfg.maxSearches, allowedDomains: a, blockedDomains: a.length ? [] : b }) })
      setCfg(saved); setSavedProvider(saved.provider); setAllowed(saved.allowedDomains.join(', ')); setBlocked(saved.blockedDomains.join(', '))
      setMsg({ ok: true, text: t('settings.web.saved') })
    } catch (e: any) { setMsg({ ok: false, text: e.message }) }
    finally { setSaving(false) }
  }

  return (
    <div className="card" style={{ marginTop: 16 }} dir={isAR ? 'rtl' : 'ltr'} data-testid="web-research-settings">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>🌐 {t('settings.web.title')}<HelpTip text={t('settings.web.help')} /></div>
      {msg && <div role="status" className={msg.ok ? 'alert alert-info' : 'alert'} style={{ marginBottom: 12, color: msg.ok ? undefined : 'var(--danger)' }}>{msg.text}</div>}
      {!cfg ? <div className="spinner" /> : (
        <>
          <div className="form-group">
            <label className="form-label" htmlFor="web-provider">{t('settings.web.provider')}</label>
            <select id="web-provider" className="form-input" value={cfg.provider} onChange={e => setCfg({ ...cfg, provider: e.target.value as WebResearch['provider'], model: null })}>
              <option value="AUTO">{t('settings.web.provider.AUTO')}</option>
              <option value="ANTHROPIC">{t('settings.web.provider.ANTHROPIC')}</option>
              <option value="OPENAI">{t('settings.web.provider.OPENAI')}</option>
              <option value="NONE">{t('settings.web.provider.NONE')}</option>
            </select>
            {cfg.effective && cfg.provider === savedProvider && cfg.effective.provider !== 'NONE' && (
              <div className="form-hint" style={{ fontSize: 12, marginTop: 4 }} data-testid="web-research-effective">
                {t('settings.web.in_use').replace('{provider}', PROVIDER_NAME[cfg.effective.provider]).replace('{model}', cfg.effective.model || DEFAULT_MODEL[cfg.effective.provider])}
                {' - '}{t(`settings.web.source.${cfg.effective.source}`)}
              </div>
            )}
          </div>
          {cfg.provider !== 'NONE' && (
            <>
              {isOverride(cfg.provider) && <div className="form-group">
                <label className="form-label" htmlFor="web-model">{t('settings.web.model')}</label>
                <input id="web-model" className="form-input" value={cfg.model || ''} placeholder={DEFAULT_MODEL[cfg.provider]} onChange={e => setCfg({ ...cfg, model: e.target.value })} />
                <div className="form-hint" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{t('settings.web.model_hint').replace('{model}', DEFAULT_MODEL[cfg.provider])}</div>
              </div>}
              <div className="form-group">
                <label className="form-label" htmlFor="web-searches">{t('settings.web.max_searches')}</label>
                <input id="web-searches" className="form-input" type="number" min={1} max={20} value={cfg.maxSearches} onChange={e => setCfg({ ...cfg, maxSearches: Number(e.target.value) })} style={{ maxWidth: 140 }} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="web-allowed">{t('settings.web.allowed')}</label>
                <input id="web-allowed" className="form-input" value={allowed} placeholder="gartner.com, forrester.com" onChange={e => setAllowed(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="web-blocked">{t('settings.web.blocked')}</label>
                <input id="web-blocked" className="form-input" value={blocked} disabled={toList(allowed).length > 0} onChange={e => setBlocked(e.target.value)} />
                <div className="form-hint" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{t('settings.web.domains_hint')}</div>
              </div>
            </>
          )}
          <div className="alert alert-info" style={{ marginTop: 8 }}>{cfg.provider === 'NONE' ? t('settings.web.off') : t('settings.web.privacy')}</div>
          <button type="button" className="btn btn-primary mt-4" disabled={saving} onClick={save}>{saving ? t('settings.web.saving') : t('settings.web.save')}</button>
        </>
      )}
    </div>
  )
}
