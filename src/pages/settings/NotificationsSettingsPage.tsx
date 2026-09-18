import { useState, useEffect } from 'react'
import { authFetch } from './shared'

export default function NotificationsSettingsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Notifications</div>
        <div className="page-subtitle">EMAIL AND WEBHOOK ALERTS</div>
      </div>
      <div className="page-body" style={{ maxWidth: 720 }}>
        <div className="card">
          <NotificationsSection />
        </div>
      </div>
    </div>
  )
}

function NotificationsSection() {
  const [form, setForm] = useState({ emailEnabled: false, notifyOnApproval: true, notifyOnGeneration: false, notifyOnComment: true, webhookEnabled: false, webhookUrl: '', webhookSecret: '', notifyEmails: '' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const n = c.ai?.notifications || {}; setForm(f => ({ ...f, ...n })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/notification-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: 'Notification settings saved' })
      else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  const testWebhook = async () => {
    if (!form.webhookUrl) { setMsg({ type: 'error', text: 'Enter a webhook URL first' }); return }
    setTesting(true); setMsg(null)
    try {
      await fetch(form.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'test', platform: 'ArchMind EA', timestamp: new Date().toISOString() }) })
      setMsg({ type: 'success', text: 'Test webhook sent' })
    } catch { setMsg({ type: 'error', text: 'Webhook delivery failed — check the URL' }) }
    finally { setTesting(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🔔 Notification Settings</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Configure email and webhook notifications for platform events</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Email */}
        <div style={{ padding: 14, background: 'var(--navy)', border: `1px solid ${form.emailEnabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.emailEnabled ? 12 : 0 }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>Email Notifications</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Send email alerts for platform events</div></div>
            <div style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }} onClick={() => setForm(f => ({ ...f, emailEnabled: !f.emailEnabled }))}>
              <div style={{ position: 'absolute', inset: 0, background: form.emailEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 11, transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 2, left: form.emailEnabled ? 20 : 2, width: 18, height: 18, background: 'white', borderRadius: 9, transition: 'left 0.2s' }} />
            </div>
          </div>
          {form.emailEnabled && <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Notification Recipients (comma-separated)</div>
              <input className="form-input" value={form.notifyEmails} onChange={e => setForm(f => ({ ...f, notifyEmails: e.target.value }))} placeholder="user@org.gov.sa, admin@org.gov.sa" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['notifyOnApproval', 'Notify when output is approved'], ['notifyOnGeneration', 'Notify when generation completes'], ['notifyOnComment', 'Notify on review comments']].map(([k, l]) => (
                <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11 }}>
                  <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />{l}
                </label>
              ))}
            </div>
          </>}
        </div>
        {/* Webhook */}
        <div style={{ padding: 14, background: 'var(--navy)', border: `1px solid ${form.webhookEnabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.webhookEnabled ? 12 : 0 }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>Webhook</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>POST events to an external endpoint</div></div>
            <div style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }} onClick={() => setForm(f => ({ ...f, webhookEnabled: !f.webhookEnabled }))}>
              <div style={{ position: 'absolute', inset: 0, background: form.webhookEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 11, transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 2, left: form.webhookEnabled ? 20 : 2, width: 18, height: 18, background: 'white', borderRadius: 9, transition: 'left 0.2s' }} />
            </div>
          </div>
          {form.webhookEnabled && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Webhook URL</div>
              <input className="form-input" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} placeholder="https://your-service.com/webhook" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Webhook Secret (optional)</div>
              <input className="form-input" type="password" value={form.webhookSecret} onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))} placeholder="Signing secret" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} disabled={testing} onClick={testWebhook}>{testing ? 'Sending...' : '🧪 Test Webhook'}</button>
          </div>}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Notification Settings'}</button>
      </div>
    </div>
  )
}

