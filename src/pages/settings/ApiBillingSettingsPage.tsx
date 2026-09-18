import { useState, useEffect } from 'react'
import HelpTip from '../../components/HelpTip'
import { authFetch, useSettingsApi } from './shared'

const METRIC_LABEL: Record<string, string> = {
  AI_REQUEST: 'AI Requests', AI_TOKENS: 'AI Tokens', DOCUMENT_INGESTION: 'Documents Ingested',
  KNOWLEDGE_SEARCH: 'Knowledge Searches', API_CALL: 'API Calls',
}
const STATUS_COLOR: Record<string, string> = { OK: 'var(--success)', WARNING: '#f39c12', EXCEEDED: 'var(--danger)' }

export default function ApiBillingSettingsPage() {
  const [subTab, setSubTab] = useState<'apikeys' | 'billing'>('apikeys')
  const api = useSettingsApi()
  const [tenant, setTenant] = useState<any>(null)
  useEffect(() => { api.get('/config').then(c => setTenant(c?.tenant)) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="page-header">
        <div className="page-title">API & Billing</div>
        <div className="page-subtitle">AI PROVIDER KEYS, SUBSCRIPTION & USAGE</div>
        <div className="page-tabs">
          {[['apikeys', 'API Keys'], ['billing', 'Billing']].map(([k, l]) => (
            <button key={k} className={`tab-btn${subTab === k ? ' active' : ''}`} onClick={() => setSubTab(k as any)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="page-body" style={{ maxWidth: 720 }}>
        <div className="card">
          {subTab === 'apikeys' ? <ApiKeysSection /> : <BillingSection api={api} tenant={tenant} />}
        </div>
      </div>
    </div>
  )
}

function ApiKeysSection() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [openaiKey, setOpenaiKey] = useState('')
  const [anthropicKey, setAnthropicKey] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showKey, setShowKey] = useState<Record<string, boolean>>({})

  const load = () => {
    setLoading(true)
    authFetch('/config/api-keys/status').then(s => setStatus(s)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const saveKey = async (provider: string, key: string) => {
    if (!key.trim()) { setMsg({ type: 'error', text: 'Please enter an API key' }); return }
    setSaving(provider); setMsg(null)
    try {
      const res = await authFetch(`/config/api-keys/${provider}`, { method: 'POST', body: JSON.stringify({ apiKey: key }) })
      if (res.success) {
        setMsg({ type: 'success', text: `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} key saved — ${res.masked}` })
        if (provider === 'openai') setOpenaiKey('')
        else setAnthropicKey('')
        load()
      } else setMsg({ type: 'error', text: res.message || 'Failed to save' })
    } finally { setSaving(null) }
  }

  const deleteKey = async (provider: string) => {
    if (!window.confirm(`Remove ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key?`)) return
    setSaving(provider); setMsg(null)
    try {
      await authFetch(`/config/api-keys/${provider}`, { method: 'DELETE' })
      setMsg({ type: 'success', text: `${provider} key removed — platform default will be used` })
      load()
    } finally { setSaving(null) }
  }

  const providers = [
    { id: 'openai', name: 'OpenAI', icon: '⬡', desc: 'GPT-4o and other OpenAI models', keyState: openaiKey, setKey: setOpenaiKey, placeholder: 'sk-...' },
    { id: 'anthropic', name: 'Anthropic', icon: '◈', desc: 'Claude Sonnet and other Anthropic models', keyState: anthropicKey, setKey: setAnthropicKey, placeholder: 'sk-ant-...' },
  ]

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🔑 AI Provider API Keys</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        Configure your own API keys for AI providers. When set, your tenant's key is used instead of the platform default. Keys are stored encrypted and never returned in full.
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {providers.map(p => (
            <div key={p.id} style={{ padding: 16, background: 'var(--navy)', border: `1px solid ${status?.[p.id]?.configured ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{p.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 2, background: status?.[p.id]?.configured ? 'rgba(22,163,74,0.15)' : 'rgba(100,100,100,0.15)', color: status?.[p.id]?.configured ? '#2ecc71' : 'var(--text-dim)', border: `1px solid ${status?.[p.id]?.configured ? 'rgba(22,163,74,0.3)' : 'var(--border)'}` }}>
                    {status?.[p.id]?.configured ? '✓ Configured' : 'Using Platform Default'}
                  </span>
                </div>
              </div>

              {status?.[p.id]?.configured && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', background: 'rgba(3,105,161,0.06)', borderRadius: 4, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-dim)' }}>Current key:</span>
                  <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>{status[p.id].maskedKey}</code>
                  <button onClick={() => deleteKey(p.id)} disabled={saving === p.id} style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 2, color: '#e74c3c', cursor: 'pointer' }}>
                    {saving === p.id ? '...' : '🗑 Remove'}
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input
                    className="form-input"
                    type={showKey[p.id] ? 'text' : 'password'}
                    placeholder={status?.[p.id]?.configured ? 'Enter new key to replace...' : p.placeholder}
                    value={p.keyState}
                    onChange={e => p.setKey(e.target.value)}
                    style={{ width: '100%', fontSize: 11, fontFamily: 'var(--font-mono)', paddingRight: 32 }}
                  />
                  <button onClick={() => setShowKey(s => ({ ...s, [p.id]: !s[p.id] }))}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }}>
                    {showKey[p.id] ? '🙈' : '👁'}
                  </button>
                </div>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11, whiteSpace: 'nowrap' }} disabled={!p.keyState || saving === p.id} onClick={() => saveKey(p.id, p.keyState)}>
                  {saving === p.id ? 'Saving...' : status?.[p.id]?.configured ? 'Update Key' : 'Save Key'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--text-dim)' }}>
        <strong style={{ color: 'var(--gold)' }}>⚠ Security note:</strong> API keys are encrypted with AES-256-GCM before storage. They are never returned in API responses or logs. Only the masked preview is shown after saving.
      </div>
    </div>
  )
}

function BillingSection({ api, tenant }: { api: any, tenant: any }) {
  const [usage, setUsage] = useState<any>(null)
  const [tiers, setTiers] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    api.get('/billing/usage').then(setUsage)
    api.get('/billing/tiers').then(setTiers)
    api.get('/billing/history?months=6').then((d: any) => setHistory(Array.isArray(d) ? d : []))
  }, [api])

  if (!usage || !tiers) return <div className="card"><div style={{ color: 'var(--text-dim)' }}>Loading usage data…</div></div>

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>💳 Subscription & Usage<HelpTip text="Your subscription tier sets monthly limits on things like AI requests and document uploads. If you're getting close to a limit, you'll see it below - contact your administrator if you need a higher tier." /></div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {tiers.tiers.map((t: any) => (
            <div key={t.name} className="card" style={{ flex: 1, padding: 20, border: `1px solid ${tenant?.subscriptionTier === t.name ? 'var(--accent)' : 'var(--border)'}`, position: 'relative' }}>
              {tenant?.subscriptionTier === t.name && <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: 'var(--navy)', fontSize: 10, padding: '2px 8px', borderRadius: 2, fontFamily: 'var(--font-mono)' }}>CURRENT</div>}
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{t.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                {Object.entries(t.limits).map(([metric, limit]: any) => (
                  <div key={metric}>{limit >= 99999 ? 'Unlimited' : limit.toLocaleString()} {METRIC_LABEL[metric] || metric}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="alert alert-info">
          To upgrade your subscription, contact your EA Platform administrator or reach out to support.
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-title">📊 Current Month Usage ({usage.period?.start} – {usage.period?.end})</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Overall status:</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[usage.overallStatus] }}>{usage.overallStatus}</span>
        </div>
        {usage.usage.map((u: any) => (
          <div key={u.metric} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>{METRIC_LABEL[u.metric] || u.metric}</span>
              <span style={{ color: STATUS_COLOR[u.status] }}>{u.used.toLocaleString()} / {u.limit >= 99999 ? '∞' : u.limit.toLocaleString()} ({u.percentage}%)</span>
            </div>
            <div style={{ height: 6, background: 'var(--navy)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(u.percentage, 100)}%`, height: '100%', background: STATUS_COLOR[u.status] }} />
            </div>
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="section-title">📈 Usage History</div>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--text-dim)' }}>Month</th>
                {Object.keys(METRIC_LABEL).map(m => <th key={m} style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-dim)' }}>{METRIC_LABEL[m]}</th>)}
              </tr>
            </thead>
            <tbody>
              {history.map((h: any) => (
                <tr key={h.month} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 8px' }}>{h.month}</td>
                  {Object.keys(METRIC_LABEL).map(m => <td key={m} style={{ textAlign: 'right', padding: '6px 8px' }}>{(h.metrics[m] || 0).toLocaleString()}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

