import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
  const put = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  return { get, put }
}

const FRAMEWORKS = ['TOGAF', 'NORA', 'CUSTOM']
const ALL_DOMAINS: Record<string, string[]> = {
  TOGAF: ['BUSINESS', 'DATA', 'APPLICATION', 'TECHNOLOGY', 'CROSS_CUTTING'],
  NORA: ['STRATEGIC', 'BUSINESS', 'DATA', 'APPLICATION', 'TECHNOLOGY', 'SECURITY', 'CROSS_CUTTING'],
  CUSTOM: ['BUSINESS', 'DATA', 'APPLICATION', 'TECHNOLOGY', 'CROSS_CUTTING'],
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useLang()
  const api = useApi()
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [tab, setTab] = useState('general')

  // Form states
  const [general, setGeneral] = useState({ name: '', locale: 'EN' })
  const [framework, setFramework] = useState({ frameworkType: 'TOGAF', enabledDomains: [] as string[] })
  const [ai, setAi] = useState({ provider: 'openai', model: 'gpt-4o', language: 'EN' })
  const [newDomain, setNewDomain] = useState('')

  useEffect(() => {
    api.get('/config').then(c => {
      setConfig(c)
      setGeneral({ name: c.tenant?.name || '', locale: c.tenant?.locale || 'EN' })
      setFramework({ frameworkType: c.framework?.type || 'TOGAF', enabledDomains: c.framework?.enabledDomains || [] })
      setAi(c.ai || { provider: 'openai', model: 'gpt-4o', language: 'EN' })
    }).finally(() => setLoading(false))
  }, [])

  const save = async (section: string, data: any) => {
    setSaving(section)
    setMsg(null)
    try {
      await api.put(`/config/${section}`, data)
      setMsg({ type: 'success', text: 'Configuration saved successfully' })
      const updated = await api.get('/config')
      setConfig(updated)
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed to save' })
    } finally {
      setSaving(null)
    }
  }

  const toggleDomain = (domain: string) => {
    setFramework(f => ({
      ...f,
      enabledDomains: f.enabledDomains.includes(domain)
        ? f.enabledDomains.filter(d => d !== domain)
        : [...f.enabledDomains, domain],
    }))
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">⚙ Settings</div>
        <div className="page-subtitle">TENANT CONFIGURATION — {config?.tenant?.slug?.toUpperCase()}</div>
        <div className="page-tabs">
          {[['general', 'General'], ['framework', 'EA Framework'], ['ai', 'AI Configuration'], ['billing', 'Subscription']].map(([k, l]) => (
            <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 720 }}>
        {msg && (
          <div style={{ padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? 'rgba(46,204,113,0.1)' : 'rgba(231,76,60,0.1)', border: `1px solid ${msg.type === 'success' ? 'rgba(46,204,113,0.3)' : 'rgba(231,76,60,0.3)'}`, color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* ── General ── */}
        {tab === 'general' && (
          <div className="card">
            <div className="section-title">🏢 General Settings</div>
            <div className="form-group">
              <label className="form-label">Organization Name</label>
              <input className="form-input" value={general.name} onChange={e => setGeneral(g => ({ ...g, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Default Language</label>
              <select className="form-input" value={general.locale} onChange={e => setGeneral(g => ({ ...g, locale: e.target.value }))}>
                <option value="EN">English</option>
                <option value="AR">العربية</option>
              </select>
            </div>
            <div className="divider" />
            <div className="form-group">
              <label className="form-label">Interface Language</label>
              <div className="flex gap-2">
                {['EN', 'AR'].map(l => (
                  <button key={l} onClick={() => setLocale(l as 'EN' | 'AR')} className={`btn ${locale === l ? 'btn-primary' : 'btn-secondary'}`}>
                    {l === 'EN' ? '🇬🇧 English' : '🇸🇦 العربية'}
                  </button>
                ))}
              </div>
            </div>
            <div className="divider" />
            <div style={{ display: 'flex', gap: 12 }}>
              <div className="card" style={{ flex: 1, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>ORGANIZATION ID</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{config?.tenant?.slug}</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>SUBSCRIPTION</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--gold)' }}>{config?.tenant?.subscriptionTier}</div>
              </div>
              <div className="card" style={{ flex: 1, padding: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>STATUS</div>
                <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{config?.tenant?.status}</div>
              </div>
            </div>
            <button className="btn btn-primary mt-4" disabled={saving === 'general'} onClick={() => save('general', general)}>
              {saving === 'general' ? 'Saving...' : 'Save General Settings'}
            </button>
          </div>
        )}

        {/* ── Framework ── */}
        {tab === 'framework' && (
          <div className="card">
            <div className="section-title">🏗 EA Framework Configuration</div>
            <div className="form-group">
              <label className="form-label">EA Framework</label>
              <div className="flex gap-2" style={{ marginBottom: 4 }}>
                {FRAMEWORKS.map(f => (
                  <button key={f} onClick={() => {
                    const defaults = ALL_DOMAINS[f] || ALL_DOMAINS.TOGAF
                    setFramework({ frameworkType: f, enabledDomains: defaults })
                  }} className={`btn ${framework.frameworkType === f ? 'btn-primary' : 'btn-secondary'}`}>
                    {f}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                {framework.frameworkType === 'TOGAF' && 'The Open Group Architecture Framework — industry standard EA framework'}
                {framework.frameworkType === 'NORA' && 'National Organization Reference Architecture — Saudi government EA standard'}
                {framework.frameworkType === 'CUSTOM' && 'Define your own architecture domains and asset types'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Enabled Architecture Domains</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {(ALL_DOMAINS[framework.frameworkType] || []).map(domain => (
                  <button key={domain} onClick={() => toggleDomain(domain)}
                    style={{ padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: `1px solid ${framework.enabledDomains.includes(domain) ? 'var(--accent)' : 'var(--border)'}`, background: framework.enabledDomains.includes(domain) ? 'rgba(0,180,216,0.15)' : 'var(--navy)', color: framework.enabledDomains.includes(domain) ? 'var(--accent)' : 'var(--text-dim)' }}>
                    {framework.enabledDomains.includes(domain) ? '✓ ' : ''}{domain.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Click to toggle domains. Disabled domains won't appear in the EA Repository.</div>
            </div>
            {framework.frameworkType === 'CUSTOM' && (
              <div className="form-group">
                <label className="form-label">Add Custom Domain</label>
                <div className="flex gap-2">
                  <input className="form-input" value={newDomain} onChange={e => setNewDomain(e.target.value.toUpperCase().replace(/\s/g, '_'))} placeholder="MY_CUSTOM_DOMAIN" style={{ flex: 1 }} />
                  <button className="btn btn-secondary" onClick={() => { if (newDomain) { setFramework(f => ({ ...f, enabledDomains: [...f.enabledDomains, newDomain] })); setNewDomain('') } }}>Add</button>
                </div>
              </div>
            )}
            <button className="btn btn-primary mt-4" disabled={saving === 'framework'} onClick={() => save('framework', framework)}>
              {saving === 'framework' ? 'Saving...' : 'Save Framework Configuration'}
            </button>
          </div>
        )}

        {/* ── AI Config ── */}
        {tab === 'ai' && (
          <div className="card">
            <div className="section-title">🤖 AI Configuration</div>
            <div className="form-group">
              <label className="form-label">AI Provider</label>
              <select className="form-input" value={ai.provider} onChange={e => setAi(a => ({ ...a, provider: e.target.value }))}>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Language Model</label>
              <select className="form-input" value={ai.model} onChange={e => setAi(a => ({ ...a, model: e.target.value }))}>
                <option value="gpt-4o">GPT-4o (Recommended)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (Faster)</option>
                <option value="claude-opus-4-6">Claude Opus 4.6</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Response Language</label>
              <select className="form-input" value={ai.language} onChange={e => setAi(a => ({ ...a, language: e.target.value }))}>
                <option value="EN">English</option>
                <option value="AR">Arabic (العربية)</option>
                <option value="BILINGUAL">Bilingual (EN + AR)</option>
              </select>
            </div>
            <div className="alert alert-info" style={{ marginTop: 16 }}>
              AI responses will be in {ai.language === 'AR' ? 'Arabic' : ai.language === 'BILINGUAL' ? 'both Arabic and English' : 'English'} by default. Users can still switch language in the Copilot.
            </div>
            <button className="btn btn-primary mt-4" disabled={saving === 'ai'} onClick={() => save('ai', ai)}>
              {saving === 'ai' ? 'Saving...' : 'Save AI Configuration'}
            </button>
          </div>
        )}

        {/* ── Billing ── */}
        {tab === 'billing' && (
          <div className="card">
            <div className="section-title">💳 Subscription & Usage</div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              {['MVP', 'STANDARD', 'ENTERPRISE'].map(tier => (
                <div key={tier} className="card" style={{ flex: 1, padding: 20, border: `1px solid ${config?.tenant?.subscriptionTier === tier ? 'var(--accent)' : 'var(--border)'}`, position: 'relative' }}>
                  {config?.tenant?.subscriptionTier === tier && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'var(--navy)', fontSize: 10, padding: '2px 8px', borderRadius: 2, fontFamily: 'var(--font-mono)' }}>CURRENT</div>}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{tier}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                    {tier === 'MVP' && <>100 AI requests/mo<br />10 documents<br />5,000 API calls</>}
                    {tier === 'STANDARD' && <>1,000 AI requests/mo<br />100 documents<br />50,000 API calls</>}
                    {tier === 'ENTERPRISE' && <>Unlimited AI requests<br />Unlimited documents<br />Unlimited API calls</>}
                  </div>
                </div>
              ))}
            </div>
            <div className="alert alert-info">
              To upgrade your subscription, contact your EA Platform administrator or reach out to support.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
