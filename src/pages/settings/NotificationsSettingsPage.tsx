import { useLang } from '../../contexts/LangContext'
import { useState, useEffect } from 'react'
import { authFetch } from './shared'

export default function NotificationsSettingsPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('Notifications', 'الإشعارات')}</div>
        <div className="page-subtitle">{L('EMAIL AND WEBHOOK ALERTS', 'تنبيهات البريد الإلكتروني وخطافات الويب')}</div>
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
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
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
      if (res.message) setMsg({ type: 'success', text: L('Notification settings saved', 'تم حفظ إعدادات الإشعارات') })
      else setMsg({ type: 'error', text: L('Failed to save', 'تعذّر الحفظ') })
    } finally { setSaving(false) }
  }

  const testWebhook = async () => {
    if (!form.webhookUrl) { setMsg({ type: 'error', text: L('Enter a webhook URL first', 'أدخل رابط خطاف الويب أولاً') }); return }
    setTesting(true); setMsg(null)
    try {
      await fetch(form.webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'test', platform: 'ArchMind EA', timestamp: new Date().toISOString() }) })
      setMsg({ type: 'success', text: L('Test webhook sent', 'تم إرسال خطاف الويب التجريبي') })
    } catch { setMsg({ type: 'error', text: L('Webhook delivery failed — check the URL', 'تعذّر إرسال خطاف الويب — تحقق من الرابط') }) }
    finally { setTesting(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>{L('🔔 Notification Settings', '🔔 إعدادات الإشعارات')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{L('Configure email and webhook notifications for platform events', 'تكوين إشعارات البريد الإلكتروني وخطافات الويب لأحداث المنصة')}</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Email */}
        <div style={{ padding: 14, background: 'var(--navy)', border: `1px solid ${form.emailEnabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: form.emailEnabled ? 12 : 0 }}>
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{L('Email Notifications', 'إشعارات البريد الإلكتروني')}</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('Send email alerts for platform events', 'إرسال تنبيهات بالبريد الإلكتروني لأحداث المنصة')}</div></div>
            <div style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }} onClick={() => setForm(f => ({ ...f, emailEnabled: !f.emailEnabled }))}>
              <div style={{ position: 'absolute', inset: 0, background: form.emailEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 11, transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 2, left: form.emailEnabled ? 20 : 2, width: 18, height: 18, background: 'white', borderRadius: 9, transition: 'left 0.2s' }} />
            </div>
          </div>
          {form.emailEnabled && <>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Notification Recipients (comma-separated)', 'مستلمو الإشعارات (مفصولون بفواصل)')}</div>
              <input className="form-input" value={form.notifyEmails} onChange={e => setForm(f => ({ ...f, notifyEmails: e.target.value }))} placeholder="user@org.gov.sa, admin@org.gov.sa" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[['notifyOnApproval', L('Notify when output is approved', 'الإشعار عند اعتماد المخرج')], ['notifyOnGeneration', L('Notify when generation completes', 'الإشعار عند اكتمال الإنشاء')], ['notifyOnComment', L('Notify on review comments', 'الإشعار عند التعليق على المراجعة')]].map(([k, l]) => (
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
            <div><div style={{ fontSize: 13, fontWeight: 600 }}>{L('Webhook', 'خطاف الويب')}</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('POST events to an external endpoint', 'إرسال الأحداث (POST) إلى نقطة نهاية خارجية')}</div></div>
            <div style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer', flexShrink: 0 }} onClick={() => setForm(f => ({ ...f, webhookEnabled: !f.webhookEnabled }))}>
              <div style={{ position: 'absolute', inset: 0, background: form.webhookEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 11, transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 2, left: form.webhookEnabled ? 20 : 2, width: 18, height: 18, background: 'white', borderRadius: 9, transition: 'left 0.2s' }} />
            </div>
          </div>
          {form.webhookEnabled && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Webhook URL', 'رابط خطاف الويب')}</div>
              <input className="form-input" value={form.webhookUrl} onChange={e => setForm(f => ({ ...f, webhookUrl: e.target.value }))} placeholder="https://your-service.com/webhook" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Webhook Secret (optional)', 'سر خطاف الويب (اختياري)')}</div>
              <input className="form-input" type="password" value={form.webhookSecret} onChange={e => setForm(f => ({ ...f, webhookSecret: e.target.value }))} placeholder={L('Signing secret', 'سر التوقيع')} style={{ fontSize: 11, width: '100%' }} />
            </div>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} disabled={testing} onClick={testWebhook}>{testing ? L('Sending...', 'جارٍ الإرسال...') : L('🧪 Test Webhook', '🧪 اختبار خطاف الويب')}</button>
          </div>}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? L('Saving...', 'جارٍ الحفظ...') : L('💾 Save Notification Settings', '💾 حفظ إعدادات الإشعارات')}</button>
      </div>
    </div>
  )
}

