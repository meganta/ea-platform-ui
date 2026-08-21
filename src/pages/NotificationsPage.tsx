import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'

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
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)', flexWrap: 'wrap' as const },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary' | 'secondary' | 'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? '#0B1929' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const SEVERITIES = ['INFORMATIONAL', 'SUCCESS', 'REMINDER', 'WARNING', 'HIGH', 'CRITICAL', 'ACTION_REQUIRED']
const SEVERITY_COLOR: Record<string, string> = {
  INFORMATIONAL: '#3498db', SUCCESS: '#2ecc71', REMINDER: '#7f8c8d', WARNING: '#f39c12',
  HIGH: '#e67e22', CRITICAL: '#e74c3c', ACTION_REQUIRED: '#e74c3c',
}
const SEVERITY_LABEL: Record<string, { en: string; ar: string }> = {
  INFORMATIONAL: { en: 'Informational', ar: 'إعلامي' }, SUCCESS: { en: 'Success', ar: 'نجاح' },
  REMINDER: { en: 'Reminder', ar: 'تذكير' }, WARNING: { en: 'Warning', ar: 'تحذير' },
  HIGH: { en: 'High', ar: 'مرتفع' }, CRITICAL: { en: 'Critical', ar: 'حرج' }, ACTION_REQUIRED: { en: 'Action Required', ar: 'يتطلب إجراء' },
}
const CHANNELS = ['IN_APP', 'EMAIL']
const CHANNEL_LABEL: Record<string, { en: string; ar: string }> = { IN_APP: { en: 'In-App', ar: 'داخل التطبيق' }, EMAIL: { en: 'Email', ar: 'البريد الإلكتروني' } }
const ROLES = ['ARCHITECT', 'REVIEWER', 'TENANT_ADMIN']

export default function NotificationsPage() {
  const api = useApi()
  const { t, isAR } = useLang()
  const { user } = useAuth() as any
  const isAdmin = user?.role === 'TENANT_ADMIN'
  const [tab, setTab] = useState<'inbox' | 'preferences' | 'rules' | 'templates' | 'announce'>('inbox')

  return (
    <div style={S.page} dir={isAR ? 'rtl' : 'ltr'}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            🔔 {t('notif.title')}
            <HelpTip text={isAR
              ? 'الوارد يعرض تنبيهاتك الشخصية. القواعد تحدد متى تُنشأ هذه التنبيهات ولمن، والقوالب تتحكم في صياغتها.'
              : 'Inbox shows your personal alerts. Rules decide when those alerts get created and for whom, and templates control how they read.'} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('notif.subtitle')}</div>
        </div>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'inbox')} onClick={() => setTab('inbox')}>{t('notif.tab_inbox')}</button>
        <button style={S.tab(tab === 'preferences')} onClick={() => setTab('preferences')}>{t('notif.tab_preferences')}</button>
        {isAdmin && <button style={S.tab(tab === 'rules')} onClick={() => setTab('rules')}>{t('notif.tab_rules')}</button>}
        {isAdmin && <button style={S.tab(tab === 'templates')} onClick={() => setTab('templates')}>{t('notif.tab_templates')}</button>}
        {isAdmin && <button style={S.tab(tab === 'announce')} onClick={() => setTab('announce')}>{t('notif.tab_announce')}</button>}
      </div>
      <div style={S.content}>
        {tab === 'inbox' && <InboxTab api={api} isAR={isAR} t={t} />}
        {tab === 'preferences' && <PreferencesTab api={api} isAR={isAR} t={t} />}
        {tab === 'rules' && isAdmin && <RulesTab api={api} isAR={isAR} t={t} />}
        {tab === 'templates' && isAdmin && <TemplatesTab api={api} isAR={isAR} t={t} />}
        {tab === 'announce' && isAdmin && <AnnounceTab api={api} isAR={isAR} t={t} />}
      </div>
    </div>
  )
}

// ── Inbox ────────────────────────────────────────────────────────────────────
function InboxTab({ api, isAR, t }: any) {
  const [items, setItems] = useState<any[]>([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/notifications?limit=100${unreadOnly ? '&unreadOnly=true' : ''}`).then((d: any) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [api, unreadOnly])
  useEffect(() => { load() }, [load])

  const markRead = async (id: string) => { await api.post(`/notifications/${id}/read`); load() }
  const markAllRead = async () => { await api.post('/notifications/read-all'); load() }

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /> {t('notif.unread_only')}
        </label>
        <div style={{ flex: 1 }} />
        <button style={S.btn()} onClick={markAllRead}>{t('notif.mark_all_read')}</button>
      </div>
      {loading ? (
        <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
      ) : items.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('notif.no_notifications')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((n: any) => (
            <div key={n.id} onClick={() => !n.isRead && markRead(n.id)} style={{ ...S.card, padding: '12px 16px', display: 'flex', gap: 12, cursor: n.isRead ? 'default' : 'pointer', background: n.isRead ? S.card.background : 'rgba(0,180,216,0.06)' }}>
              <span style={S.badge(SEVERITY_COLOR[n.severity] || '#7f8c8d')}>{isAR ? SEVERITY_LABEL[n.severity]?.ar : SEVERITY_LABEL[n.severity]?.en}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: n.isRead ? 400 : 600 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 3 }}>{n.body}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{new Date(n.createdAt).toLocaleString(isAR ? 'ar' : 'en')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Preferences ──────────────────────────────────────────────────────────────
function PreferencesTab({ api, isAR, t }: any) {
  const [prefs, setPrefs] = useState<any>(null)
  const [muted, setMuted] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/notifications/preferences').then((p: any) => { setPrefs(p); setMuted((p?.mutedCategories || []).join(', ')) })
  }, [api])

  const toggleChannel = (severity: string, channel: string) => {
    setPrefs((prev: any) => {
      const current: string[] = prev.channelsBySeverity?.[severity] || []
      const next = current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel]
      return { ...prev, channelsBySeverity: { ...prev.channelsBySeverity, [severity]: next } }
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.put('/notifications/preferences', {
        channelsBySeverity: prefs.channelsBySeverity,
        mutedCategories: muted.split(',').map((s: string) => s.trim()).filter(Boolean),
      })
    } finally { setSaving(false) }
  }

  if (!prefs) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>{t('notif.pref_intro')}</div>
      <div style={S.card}>
        {SEVERITIES.map(sev => (
          <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span style={{ ...S.badge(SEVERITY_COLOR[sev]), width: 130, textAlign: 'center' as const }}>{isAR ? SEVERITY_LABEL[sev].ar : SEVERITY_LABEL[sev].en}</span>
            {CHANNELS.map(ch => (
              <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={(prefs.channelsBySeverity?.[sev] || []).includes(ch)} onChange={() => toggleChannel(sev, ch)} />
                {isAR ? CHANNEL_LABEL[ch].ar : CHANNEL_LABEL[ch].en}
              </label>
            ))}
          </div>
        ))}
        <div style={{ marginTop: 14 }}>
          <div style={S.label}>{t('notif.muted_categories')}</div>
          <input style={S.input} value={muted} onChange={e => setMuted(e.target.value)} />
        </div>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('notif.saving') : t('notif.save_preferences')}</button>
      </div>
    </div>
  )
}

// ── Rules ────────────────────────────────────────────────────────────────────
function RuleTemplateLibrary({ api, isAR, t, onActivated }: any) {
  const [templates, setTemplates] = useState<any[]>([])
  const [activatingKey, setActivatingKey] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  const load = useCallback(() => { api.get('/notifications/rule-templates').then((d: any) => setTemplates(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { load() }, [load])

  const activate = async (key: string) => {
    setActivatingKey(key)
    try { await api.post(`/notifications/rule-templates/${key}/activate`, {}); await load(); onActivated() }
    catch (e: any) { alert(e.message) } finally { setActivatingKey(null) }
  }

  if (templates.length === 0) return null

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => setExpanded(v => !v)}>
        <div style={{ flex: 1, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center' }}>
          {t('notif.template_library')}
          <HelpTip text={isAR
            ? 'قوالب جاهزة لقواعد الإشعارات الشائعة في البنية المؤسسية. فعّل واحدًا بنقرة بدلًا من إعداد كل قاعدة من الصفر.'
            : 'Ready-made templates for common EA notification rules. Activate one with a click instead of configuring every rule from scratch.'} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {templates.map((tpl: any) => (
            <div key={tpl.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'var(--navy)', borderRadius: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{isAR ? tpl.nameAr : tpl.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{tpl.eventType}</div>
              </div>
              <span style={S.badge(SEVERITY_COLOR[tpl.severity])}>{isAR ? SEVERITY_LABEL[tpl.severity]?.ar : SEVERITY_LABEL[tpl.severity]?.en}</span>
              {!tpl.hasLivePublisher && (
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }} title={t('notif.no_live_publisher_hint')}>{t('notif.no_live_publisher')}</span>
              )}
              {tpl.isActivated ? (
                <span style={{ ...S.badge('#2ecc71'), fontSize: 11 }}>{t('notif.activated')}</span>
              ) : (
                <button style={{ ...S.btn('primary'), fontSize: 11 }} onClick={() => activate(tpl.key)} disabled={activatingKey === tpl.key}>
                  {activatingKey === tpl.key ? t('notif.activating') : t('notif.activate')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RulesTab({ api, isAR, t }: any) {
  const [rules, setRules] = useState<any[]>([])
  const [templates, setTemplates] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const load = useCallback(() => {
    api.get('/notifications/rules').then((d: any) => setRules(Array.isArray(d) ? d : []))
  }, [api])
  useEffect(() => { load(); api.get('/notifications/templates').then((d: any) => setTemplates(Array.isArray(d) ? d : [])); api.get('/users').then((d: any) => setUsers(Array.isArray(d) ? d : [])) }, [api, load])

  const remove = async (id: string) => { if (!window.confirm(t('notif.delete_rule_confirm'))) return; await api.del(`/notifications/rules/${id}`); load() }
  const toggleActive = async (rule: any) => { await api.put(`/notifications/rules/${rule.id}`, { isActive: !rule.isActive }); load() }

  const userLabel = (id: string) => { const u = users.find((x: any) => x.id === id); return u ? (u.fullName || u.email) : id }

  return (
    <div>
      <RuleTemplateLibrary api={api} isAR={isAR} t={t} onActivated={load} />
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setCreating(true)}>{t('notif.new_rule')}</button>
      {creating && <RuleForm api={api} isAR={isAR} t={t} templates={templates} users={users} onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}

      {rules.length === 0 && !creating ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('notif.no_rules')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((r: any) => (
            <div key={r.id}>
              <div style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{isAR && r.nameAr ? r.nameAr : r.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                    {r.eventType} → {r.recipientType === 'ROLE' ? r.recipientValue : r.recipientType === 'OBJECT_OWNER' ? t('notif.recipient_object_owner') : userLabel(r.recipientValue)} · {r.channels.join(', ')}
                  </div>
                </div>
                <span style={S.badge(SEVERITY_COLOR[r.severity])}>{isAR ? SEVERITY_LABEL[r.severity]?.ar : SEVERITY_LABEL[r.severity]?.en}</span>
                <button style={{ ...S.btn(r.isActive ? 'secondary' : 'danger'), fontSize: 11 }} onClick={() => toggleActive(r)}>{r.isActive ? t('notif.active') : t('notif.inactive')}</button>
                <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => setEditingId(editingId === r.id ? null : r.id)}>{t('notif.edit')}</button>
                <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => remove(r.id)}>{t('notif.delete')}</button>
              </div>
              {editingId === r.id && <RuleForm api={api} isAR={isAR} t={t} templates={templates} users={users} rule={r} onDone={() => { setEditingId(null); load() }} onCancel={() => setEditingId(null)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RuleForm({ api, isAR, t, templates, users, rule, onDone, onCancel }: any) {
  const [form, setForm] = useState({
    name: rule?.name || '', nameAr: rule?.nameAr || '', eventType: rule?.eventType || '',
    severity: rule?.severity || 'INFORMATIONAL', recipientType: rule?.recipientType || 'ROLE',
    recipientValue: rule?.recipientValue || 'ARCHITECT', channels: rule?.channels || ['IN_APP'], templateId: rule?.templateId || '',
  })
  const [saving, setSaving] = useState(false)

  const toggleChannel = (ch: string) => setForm(f => ({ ...f, channels: f.channels.includes(ch) ? f.channels.filter((c: string) => c !== ch) : [...f.channels, ch] }))

  const save = async () => {
    if (!form.name || !form.eventType) return alert(isAR ? 'الاسم ونوع الحدث مطلوبان' : 'Name and event type are required')
    if (form.recipientType !== 'OBJECT_OWNER' && !form.recipientValue) return alert(isAR ? 'المستلم مطلوب لهذا النوع' : 'A recipient is required for this recipient type')
    setSaving(true)
    try {
      const payload = { ...form, templateId: form.templateId || undefined }
      if (rule) await api.put(`/notifications/rules/${rule.id}`, payload)
      else await api.post('/notifications/rules', payload)
      onDone()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ ...S.card, marginTop: 8, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('notif.rule_name')} *</div><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><div style={S.label}>{t('notif.rule_name_ar')}</div><input style={S.input} dir="rtl" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
      </div>
      <div style={S.label}>{t('notif.event_type')} *</div>
      <input style={S.input} placeholder={t('notif.event_type_hint')} value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={S.label}>{t('notif.severity')}</div>
          <select style={S.input} value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
            {SEVERITIES.map(s => <option key={s} value={s}>{isAR ? SEVERITY_LABEL[s].ar : SEVERITY_LABEL[s].en}</option>)}
          </select>
        </div>
        <div>
          <div style={S.label}>{t('notif.recipient_type')}</div>
          <select style={S.input} value={form.recipientType} onChange={e => setForm(f => ({ ...f, recipientType: e.target.value, recipientValue: e.target.value === 'ROLE' ? 'ARCHITECT' : e.target.value === 'OBJECT_OWNER' ? '' : (users[0]?.id || '') }))}>
            <option value="ROLE">{t('notif.recipient_role')}</option>
            <option value="INDIVIDUAL">{t('notif.recipient_individual')}</option>
            <option value="OBJECT_OWNER">{t('notif.recipient_object_owner')}</option>
          </select>
        </div>
      </div>
      <div style={S.label}>{t('notif.recipient')} {form.recipientType !== 'OBJECT_OWNER' && '*'}</div>
      {form.recipientType === 'ROLE' ? (
        <select style={S.input} value={form.recipientValue} onChange={e => setForm(f => ({ ...f, recipientValue: e.target.value }))}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      ) : form.recipientType === 'OBJECT_OWNER' ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', background: 'var(--navy)', padding: 10, borderRadius: 8, marginBottom: 10 }}>{t('notif.object_owner_hint')}</div>
      ) : (
        <select style={S.input} value={form.recipientValue} onChange={e => setForm(f => ({ ...f, recipientValue: e.target.value }))}>
          <option value="">—</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.fullName || u.email}</option>)}
        </select>
      )}
      <div style={S.label}>{t('notif.channels')}</div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
        {CHANNELS.map(ch => (
          <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.channels.includes(ch)} onChange={() => toggleChannel(ch)} /> {isAR ? CHANNEL_LABEL[ch].ar : CHANNEL_LABEL[ch].en}
          </label>
        ))}
      </div>
      <div style={S.label}>{t('notif.template_optional')}</div>
      <select style={S.input} value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))}>
        <option value="">{t('notif.no_template')}</option>
        {templates.map((tpl: any) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
      </select>
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('notif.saving') : rule ? t('notif.save') : t('notif.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('notif.cancel')}</button>
      </div>
    </div>
  )
}

// ── Templates ────────────────────────────────────────────────────────────────
function TemplatesTab({ api, isAR, t }: any) {
  const [templates, setTemplates] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => { api.get('/notifications/templates').then((d: any) => setTemplates(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setCreating(true)}>{t('notif.new_template')}</button>
      {creating && <TemplateForm api={api} isAR={isAR} t={t} onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}

      {templates.length === 0 && !creating ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('notif.no_templates')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.map((tpl: any) => (
            <div key={tpl.id} style={{ ...S.card, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{tpl.name}</div>
                <span style={S.badge('#3498db')}>{tpl.channel}</span>
                <span style={S.badge('#7f8c8d')}>{tpl.language}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{tpl.eventType}</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>{tpl.titleTemplate}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TemplateForm({ api, isAR, t, onDone, onCancel }: any) {
  const [form, setForm] = useState({ name: '', eventType: '', channel: 'IN_APP', language: 'EN', titleTemplate: '', bodyTemplate: '' })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!form.name || !form.eventType || !form.titleTemplate || !form.bodyTemplate) return alert(isAR ? 'جميع الحقول المطلوبة يجب تعبئتها' : 'All required fields must be filled')
    setSaving(true)
    try { await api.post('/notifications/templates', form); onDone() } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('notif.template_name')} *</div><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div>
          <div style={S.label}>{t('notif.channel')}</div>
          <select style={S.input} value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
            {CHANNELS.map(ch => <option key={ch} value={ch}>{isAR ? CHANNEL_LABEL[ch].ar : CHANNEL_LABEL[ch].en}</option>)}
          </select>
        </div>
        <div><div style={S.label}>{t('notif.event_type')} *</div><input style={S.input} placeholder={t('notif.event_type_hint')} value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))} /></div>
        <div>
          <div style={S.label}>{t('notif.language')}</div>
          <select style={S.input} value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
            <option value="EN">English</option>
            <option value="AR">العربية</option>
          </select>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{t('notif.template_hint')}</div>
      <div style={S.label}>{t('notif.title_template')} *</div>
      <input style={S.input} value={form.titleTemplate} onChange={e => setForm(f => ({ ...f, titleTemplate: e.target.value }))} />
      <div style={S.label}>{t('notif.body_template')} *</div>
      <input style={S.input} value={form.bodyTemplate} onChange={e => setForm(f => ({ ...f, bodyTemplate: e.target.value }))} />
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('notif.saving') : t('notif.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('notif.cancel')}</button>
      </div>
    </div>
  )
}

// ── Send Announcement ──────────────────────────────────────────────────────
function AnnounceTab({ api, isAR, t }: any) {
  const [users, setUsers] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [severity, setSeverity] = useState('INFORMATIONAL')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => { api.get('/users').then((d: any) => setUsers(Array.isArray(d) ? d : [])) }, [api])

  const toggleUser = (id: string) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const send = async () => {
    if (!title || !body || selectedIds.length === 0) return alert(isAR ? 'العنوان والرسالة وتحديد مستلم واحد على الأقل مطلوبة' : 'Title, message, and at least one recipient are required')
    setSending(true); setSent(false)
    try {
      await api.post('/notifications/announcements', { title, body, recipientUserIds: selectedIds, severity })
      setSent(true); setTitle(''); setBody(''); setSelectedIds([])
    } catch (e: any) { alert(e.message) } finally { setSending(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={S.card}>
        <div style={S.label}>{t('notif.announce_recipients')} *</div>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 14, maxHeight: 140, overflowY: 'auto' }}>
          {users.map((u: any) => (
            <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, cursor: 'pointer', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px' }}>
              <input type="checkbox" checked={selectedIds.includes(u.id)} onChange={() => toggleUser(u.id)} /> {u.fullName || u.email}
            </label>
          ))}
        </div>
        <div style={S.label}>{t('notif.severity')}</div>
        <select style={S.input} value={severity} onChange={e => setSeverity(e.target.value)}>
          {SEVERITIES.map(s => <option key={s} value={s}>{isAR ? SEVERITY_LABEL[s].ar : SEVERITY_LABEL[s].en}</option>)}
        </select>
        <div style={S.label}>{t('notif.announce_title')} *</div>
        <input style={S.input} value={title} onChange={e => setTitle(e.target.value)} />
        <div style={S.label}>{t('notif.announce_body')} *</div>
        <input style={S.input} value={body} onChange={e => setBody(e.target.value)} />
        <div style={S.row}>
          <button style={S.btn('primary')} onClick={send} disabled={sending}>{sending ? t('notif.sending') : t('notif.send')}</button>
          {sent && <span style={{ color: '#2ecc71', fontSize: 12 }}>✓ {t('notif.sent')}</span>}
        </div>
      </div>
    </div>
  )
}
