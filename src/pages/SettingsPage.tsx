import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { useBranding } from '../contexts/BrandingContext'
import HelpTip from '../components/HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
  const put = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  return { get, put }
}


function BrandingTab() {
  const { previewAccentColor, reload: reloadGlobalBranding } = useBranding()
  const [form, setForm] = useState({ organizationNameEn: '', organizationNameAr: '', primaryColor: '#00b4d8', secondaryColor: '#1a2332', accentColor: '#f39c12', fontFamily: '' })
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasLogo, setHasLogo] = useState(false)
  const [hasFavicon, setHasFavicon] = useState(false)
  const [logoCacheBust, setLogoCacheBust] = useState(Date.now())
  const [faviconCacheBust, setFaviconCacheBust] = useState(Date.now())

  useEffect(() => {
    authFetch('/branding').then(b => {
      if (b) {
        setForm(f => ({ ...f, ...b }))
        setHasLogo(!!b.logoStorageKey)
        setHasFavicon(!!b.faviconStorageKey)
      }
    })
    // Revert any unsaved live-preview color when leaving this tab.
    return () => previewAccentColor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateAccentColor = (color: string) => {
    setForm(f => ({ ...f, accentColor: color }))
    previewAccentColor(color) // live preview across the real app shell, not persisted until Save
  }

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const updated = await authFetch('/branding', { method: 'PUT', body: JSON.stringify(form) })
      if (updated?.id) {
        setMsg({ type: 'success', text: 'Branding saved' })
        reloadGlobalBranding() // pulls the now-persisted color as the new baseline
      } else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  const uploadAsset = async (kind: 'logo' | 'favicon', file: File) => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingFavicon
    setUploading(true); setMsg(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_URL_LOCAL}/branding/${kind}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` }, // no Content-Type — browser sets multipart boundary itself
        body,
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: `${kind === 'logo' ? 'Logo' : 'Favicon'} uploaded` })
        if (kind === 'logo') { setHasLogo(true); setLogoCacheBust(Date.now()) }
        else { setHasFavicon(true); setFaviconCacheBust(Date.now()) }
      } else {
        setMsg({ type: 'error', text: data?.message || `Failed to upload ${kind}` })
      }
    } catch (e) {
      setMsg({ type: 'error', text: `Upload failed: ${(e as Error).message}` })
    } finally { setUploading(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🎨 Branding</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Customize the platform appearance for your organization</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['organizationNameEn', 'Organization Name (EN)', false], ['organizationNameAr', 'Organization Name (AR)', true]].map(([k, l, rtl]) => (
            <div key={k as string}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{l as string}</div>
              <input className="form-input" type="text" value={(form as any)[k as string] || ''} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ width: '100%', fontSize: 11, direction: rtl ? 'rtl' : 'ltr' }} />
            </div>
          ))}
        </div>

        {/* Logo & Favicon upload */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {hasLogo
                ? <img src={`${API_URL_LOCAL}/branding/logo?t=${logoCacheBust}`} alt={t("settings.logo")} style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
                : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No logo uploaded</div>}
              <label className="btn btn-secondary" style={{ fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                {uploadingLogo ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} disabled={uploadingLogo}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset('logo', f); e.target.value = '' }} />
              </label>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Favicon</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {hasFavicon
                ? <img src={`${API_URL_LOCAL}/branding/favicon?t=${faviconCacheBust}`} alt={t("settings.favicon")} style={{ maxHeight: 24, maxWidth: 24, objectFit: 'contain' }} />
                : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No favicon uploaded</div>}
              <label className="btn btn-secondary" style={{ fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                {uploadingFavicon ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/png,image/x-icon,image/svg+xml" style={{ display: 'none' }} disabled={uploadingFavicon}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset('favicon', f); e.target.value = '' }} />
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[['primaryColor', 'Primary Color'], ['secondaryColor', 'Secondary Color'], ['accentColor', 'Accent Color (live preview)']].map(([k, l]) => (
            <div key={k}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{l}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={(form as any)[k]} onChange={e => k === 'accentColor' ? updateAccentColor(e.target.value) : setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ width: 36, height: 30, border: 'none', background: 'none', cursor: 'pointer' }} />
                <input className="form-input" value={(form as any)[k]} onChange={e => k === 'accentColor' ? updateAccentColor(e.target.value) : setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 11, marginBottom: 3 }}>Font Family (optional — CSS font-family value)</div>
          <input className="form-input" placeholder="e.g. 'Inter', 'IBM Plex Sans Arabic', sans-serif" value={form.fontFamily || ''} onChange={e => setForm(f => ({ ...f, fontFamily: e.target.value }))} style={{ width: '100%', fontSize: 11 }} />
        </div>

        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Branding'}</button>
      </div>
    </div>
  )
}

function ExportSettingsTab() {
  const [form, setForm] = useState({ defaultLanguage: 'AR', includeCharts: true, includeTableOfContents: true, includePageNumbers: true, templateStyle: 'PROFESSIONAL', footerText: '', headerLogoEnabled: true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const s = c.ai?.exportSettings || {}; setForm(f => ({ ...f, ...s })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/export-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: 'Export settings saved' })
      else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>📤 Export Settings</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Configure default behavior for Word and PowerPoint exports</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Default Export Language</div>
            <select className="form-input" value={form.defaultLanguage} onChange={e => setForm(f => ({ ...f, defaultLanguage: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="AR">Arabic (العربية)</option>
              <option value="EN">English</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Template Style</div>
            <select className="form-input" value={form.templateStyle} onChange={e => setForm(f => ({ ...f, templateStyle: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="PROFESSIONAL">Professional</option>
              <option value="GOVERNMENT">Government</option>
              <option value="MINIMAL">Minimal</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Footer Text</div>
            <input className="form-input" value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} placeholder="e.g. Confidential — For internal use only" style={{ fontSize: 11, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['includeCharts', 'Include Charts & Diagrams'], ['includeTableOfContents', 'Include Table of Contents'], ['includePageNumbers', 'Include Page Numbers'], ['headerLogoEnabled', 'Include Organization Logo in Header']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Export Settings'}</button>
      </div>
    </div>
  )
}

function GovernanceSettingsTab() {
  const [form, setForm] = useState({ requireApprovalForPublish: true, reviewerApprovalRequired: false, minReviewers: 1, autoApproveAfterDays: 0, approvalNotifyEmail: '', governanceMode: 'STANDARD' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const g = c.ai?.governance || {}; setForm(f => ({ ...f, ...g })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/governance-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: 'Governance settings saved' })
      else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center' }}>⚖ Governance Settings<HelpTip text="Controls who needs to approve changes to your organization's architecture before they become official, and how many reviewers are required." /></div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Configure architecture governance workflows and approval thresholds</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Governance Mode</div>
            <select className="form-input" value={form.governanceMode} onChange={e => setForm(f => ({ ...f, governanceMode: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="OPEN">Open — No approval required</option>
              <option value="STANDARD">Standard — Architect approval</option>
              <option value="STRICT">Strict — Admin approval required</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Minimum Reviewers</div>
            <input type="number" className="form-input" min={1} max={5} value={form.minReviewers} onChange={e => setForm(f => ({ ...f, minReviewers: Number(e.target.value) }))} style={{ fontSize: 11, width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Auto-approve After (days, 0 = disabled)</div>
            <input type="number" className="form-input" min={0} max={30} value={form.autoApproveAfterDays} onChange={e => setForm(f => ({ ...f, autoApproveAfterDays: Number(e.target.value) }))} style={{ fontSize: 11, width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Governance Notification Email</div>
            <input type="email" className="form-input" value={form.approvalNotifyEmail} onChange={e => setForm(f => ({ ...f, approvalNotifyEmail: e.target.value }))} placeholder="governance@organization.gov.sa" style={{ fontSize: 11, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['requireApprovalForPublish', 'Require approval before publishing outputs'], ['reviewerApprovalRequired', 'Require reviewer sign-off in addition to architect']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Governance Settings'}</button>
      </div>
    </div>
  )
}

function DiagramSettingsTab() {
  const [form, setForm] = useState({ defaultStyle: 'PROFESSIONAL', colorScheme: 'BLUE', autoGenerateDiagrams: true, diagramDensity: 'MEDIUM', showLegend: true, showRelationships: true, arabicLabels: true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const d = c.ai?.diagramSettings || {}; setForm(f => ({ ...f, ...d })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/diagram-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: 'Diagram settings saved' })
      else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>📐 Diagram Settings</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Configure architecture diagram generation preferences</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['defaultStyle', 'Diagram Style', [['PROFESSIONAL', 'Professional'], ['MINIMAL', 'Minimal'], ['DETAILED', 'Detailed']]], ['colorScheme', 'Color Scheme', [['BLUE', 'Blue (Default)'], ['GREEN', 'Green'], ['MONOCHROME', 'Monochrome'], ['GOVERNMENT', 'Government']]], ['diagramDensity', 'Information Density', [['LOW', 'Low — Key elements only'], ['MEDIUM', 'Medium — Balanced'], ['HIGH', 'High — Full detail']]]].map(([k, l, opts]) => (
            <div key={k as string}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{l as string}</div>
              <select className="form-input" value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
                {(opts as string[][]).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['autoGenerateDiagrams', 'Auto-generate diagrams during output generation'], ['showLegend', 'Include legend in diagrams'], ['showRelationships', 'Show relationship lines between components'], ['arabicLabels', 'Use Arabic labels in diagrams (NORA outputs)']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Diagram Settings'}</button>
      </div>
    </div>
  )
}

function NotificationsTab() {
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

function RagKbTab() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ragEnabled, setRagEnabled] = useState(false)
  const [retrievalLimit, setRetrievalLimit] = useState(8)
  const [minRelevanceScore, setMinRelevanceScore] = useState(0.3)
  const [includeRepoAssets, setIncludeRepoAssets] = useState(true)
  const [includeKbDocs, setIncludeKbDocs] = useState(true)
  const [excludeAdmOutputs, setExcludeAdmOutputs] = useState(false)

  const load = () => {
    setLoading(true)
    authFetch('/config').then(c => {
      const ai = c.ai || {}
      setRagEnabled(!!ai.RAG_GENERATION)
      const rag = ai.ragConfig || {}
      setRetrievalLimit(rag.retrievalLimit || 8)
      setMinRelevanceScore(rag.minRelevanceScore || 0.3)
      setIncludeRepoAssets(rag.includeRepoAssets !== false)
      setIncludeKbDocs(rag.includeKbDocs !== false)
      setExcludeAdmOutputs(!!rag.excludeAdmOutputs)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/rag', {
        method: 'PUT',
        body: JSON.stringify({
          ragEnabled,
          ragConfig: { retrievalLimit, minRelevanceScore, includeRepoAssets, includeKbDocs, excludeAdmOutputs },
        }),
      })
      if (res.message) setMsg({ type: 'success', text: 'Knowledge Base settings saved' })
      else setMsg({ type: 'error', text: res.message || 'Failed to save' })
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading...</div>

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🧠 Knowledge Base & RAG Settings</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        Configure how the AI uses the Knowledge Base during architecture generation. RAG (Retrieval-Augmented Generation) pulls relevant content from uploaded documents and EA repository assets.
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {/* RAG Toggle */}
      <div style={{ padding: 16, background: 'var(--navy)', border: `1px solid ${ragEnabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>RAG Generation</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>When enabled, the AI retrieves relevant content from your Knowledge Base before generating each output section</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 44, height: 24 }} onClick={() => setRagEnabled(r => !r)}>
              <div style={{ position: 'absolute', inset: 0, background: ragEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 12, transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 3, left: ragEnabled ? 22 : 3, width: 18, height: 18, background: 'white', borderRadius: 9, transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: ragEnabled ? 'var(--accent)' : 'var(--text-dim)' }}>{ragEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      </div>

      {/* Retrieval params */}
      <div style={{ padding: 16, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, opacity: ragEnabled ? 1 : 0.5, pointerEvents: ragEnabled ? 'all' : 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Retrieval Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>Retrieval Limit <span style={{ color: 'var(--text-dim)' }}>(chunks per generation)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={1} max={20} value={retrievalLimit} onChange={e => setRetrievalLimit(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 24, textAlign: 'center' }}>{retrievalLimit}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Higher = more context, slower generation. Recommended: 6–10</div>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>Minimum Relevance Score <span style={{ color: 'var(--text-dim)' }}>(0.0–1.0)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={0} max={1} step={0.05} value={minRelevanceScore} onChange={e => setMinRelevanceScore(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 32, textAlign: 'center' }}>{minRelevanceScore.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>Higher = stricter matching, fewer but more relevant chunks. Recommended: 0.25–0.40</div>
          </div>
        </div>
      </div>

      {/* Source filters */}
      <div style={{ padding: 16, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, opacity: ragEnabled ? 1 : 0.5, pointerEvents: ragEnabled ? 'all' : 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Retrieval Sources</div>
        {[
          { label: 'Include Knowledge Base Documents', desc: 'Uploaded files and documents indexed in the KB', val: includeKbDocs, set: setIncludeKbDocs },
          { label: 'Include EA Repository Assets', desc: 'Architecture assets promoted to the EA repository', val: includeRepoAssets, set: setIncludeRepoAssets },
          { label: 'Exclude ADM Outputs', desc: 'Prevent previously generated outputs from being retrieved (avoids circular references)', val: excludeAdmOutputs, set: setExcludeAdmOutputs },
        ].map(({ label, desc, val, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</div>
            </div>
            <label style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}>
              <div style={{ position: 'relative', width: 36, height: 20 }} onClick={() => set((s: boolean) => !s)}>
                <div style={{ position: 'absolute', inset: 0, background: val ? 'var(--accent)' : 'var(--border)', borderRadius: 10, transition: 'background 0.2s' }} />
                <div style={{ position: 'absolute', top: 2, left: val ? 18 : 2, width: 16, height: 16, background: 'white', borderRadius: 8, transition: 'left 0.2s' }} />
              </div>
            </label>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={saving} onClick={save}>
        {saving ? 'Saving...' : '💾 Save Knowledge Base Settings'}
      </button>
    </div>
  )
}

const METRIC_LABEL: Record<string, string> = {
  AI_REQUEST: 'AI Requests', AI_TOKENS: 'AI Tokens', DOCUMENT_INGESTION: 'Documents Ingested',
  KNOWLEDGE_SEARCH: 'Knowledge Searches', API_CALL: 'API Calls',
}
const STATUS_COLOR: Record<string, string> = { OK: 'var(--success)', WARNING: '#f39c12', EXCEEDED: 'var(--danger)' }

function BillingTab({ api, tenant }: { api: any, tenant: any }) {
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

function ApiKeysTab() {
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

const ROLE_COLORS: Record<string, string> = {
  TENANT_ADMIN: '#e74c3c', ARCHITECT: '#3498db', REVIEWER: '#2ecc71',
}
const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN: '🔴 Admin', ARCHITECT: '🔵 Architect', REVIEWER: '🟢 Reviewer',
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [showResetPw, setShowResetPw] = useState<string | null>(null)
  const [newPw, setNewPw] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [form, setForm] = useState({ email: '', fullName: '', fullNameAr: '', password: '', role: 'ARCHITECT' })

  const load = () => {
    setLoading(true)
    authFetch('/users').then(u => setUsers(Array.isArray(u) ? u : [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const createUser = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/users', { method: 'POST', body: JSON.stringify(form) })
      if (res.id) { setMsg({ type: 'success', text: `User ${res.email} created` }); setShowCreate(false); setForm({ email: '', fullName: '', fullNameAr: '', password: '', role: 'ARCHITECT' }); load() }
      else setMsg({ type: 'error', text: res.message || 'Failed to create user' })
    } finally { setSaving(false) }
  }

  const updateUser = async (userId: string, data: any) => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch(`/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) })
      if (res.id) { setMsg({ type: 'success', text: 'User updated' }); setEditingUser(null); load() }
      else setMsg({ type: 'error', text: res.message || 'Failed to update' })
    } finally { setSaving(false) }
  }

  const resetPw = async (userId: string) => {
    if (!newPw || newPw.length < 8) { setMsg({ type: 'error', text: 'Password must be at least 8 characters' }); return }
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch(`/users/${userId}/password`, { method: 'PUT', body: JSON.stringify({ newPassword: newPw }) })
      if (res.success) { setMsg({ type: 'success', text: 'Password reset' }); setShowResetPw(null); setNewPw('') }
      else setMsg({ type: 'error', text: res.message || 'Failed' })
    } finally { setSaving(false) }
  }

  const deactivate = async (userId: string, email: string) => {
    if (!window.confirm(`Deactivate ${email}?`)) return
    await authFetch(`/users/${userId}`, { method: 'DELETE' })
    setMsg({ type: 'success', text: 'User deactivated' }); load()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="section-title" style={{ fontSize: 15, marginBottom: 2 }}>👥 User Management</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Manage team members, roles, and access for this tenant</div>
        </div>
        <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowCreate(s => !s)}>+ Add User</button>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {/* Create user form */}
      {showCreate && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--navy)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>New User</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[['email', 'Email', 'email'], ['fullName', 'Full Name (EN)', 'text'], ['fullNameAr', 'Full Name (AR)', 'text'], ['password', 'Password', 'password']].map(([k, l, t]) => (
              <div key={k}>
                <div style={{ fontSize: 11, marginBottom: 3 }}>{l}</div>
                <input className="form-input" type={t} value={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                  style={{ fontSize: 11, width: '100%', direction: k === 'fullNameAr' ? 'rtl' : 'ltr' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Role</div>
              <select className="form-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
                <option value="ARCHITECT">Architect</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="TENANT_ADMIN">Admin</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={saving} onClick={createUser}>{saving ? 'Creating...' : 'Create User'}</button>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Users list */}
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading users...</div> : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 120px', background: 'var(--navy-mid)', padding: '8px 12px', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', gap: 8 }}>
            <div>USER</div><div>EMAIL</div><div>ROLE</div><div>STATUS</div><div>ACTIONS</div>
          </div>
          {users.map(u => (
            <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 120px', padding: '10px 12px', borderTop: '1px solid var(--border)', fontSize: 11, gap: 8, alignItems: 'center', opacity: u.isActive ? 1 : 0.5 }}>
              <div>
                <div style={{ fontWeight: 500 }}>{u.fullName}</div>
                {u.fullNameAr && <div style={{ fontSize: 10, color: 'var(--text-dim)', direction: 'rtl', textAlign: 'left' }}>{u.fullNameAr}</div>}
                <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{u.id.slice(0, 8)}...</div>
              </div>
              <div style={{ fontSize: 11 }}>{u.email}</div>
              <div>
                {editingUser?.id === u.id ? (
                  <select className="form-input" value={editingUser.role} onChange={e => setEditingUser((eu: any) => ({ ...eu, role: e.target.value }))} style={{ fontSize: 10, padding: '2px 4px' }}>
                    <option value="ARCHITECT">Architect</option>
                    <option value="REVIEWER">Reviewer</option>
                    <option value="TENANT_ADMIN">Admin</option>
                  </select>
                ) : (
                  <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: `${ROLE_COLORS[u.role]}18`, color: ROLE_COLORS[u.role], border: `1px solid ${ROLE_COLORS[u.role]}33` }}>{ROLE_LABELS[u.role]}</span>
                )}
              </div>
              <div>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, background: u.isActive ? 'rgba(22,163,74,0.1)' : 'rgba(255,0,0,0.1)', color: u.isActive ? '#2ecc71' : '#e74c3c' }}>
                  {u.isActive ? 'Active' : 'Inactive'}
                </span>
                {u.lastLoginAt && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>Last: {new Date(u.lastLoginAt).toLocaleDateString()}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {editingUser?.id === u.id ? (
                  <>
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 9, padding: '2px 6px' }} disabled={saving} onClick={() => updateUser(u.id, { role: editingUser.role })}>Save</button>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: 9, padding: '2px 6px' }} onClick={() => setEditingUser(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setEditingUser(u)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: 'var(--text)' }}>✏ Role</button>
                    <button onClick={() => { setShowResetPw(u.id); setNewPw('') }} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: 'var(--gold)' }}>🔑 PW</button>
                    {u.isActive && <button onClick={() => deactivate(u.id, u.email)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: '#e74c3c' }}>✕</button>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reset password modal */}
      {showResetPw && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, width: 320 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Reset Password</div>
            <input className="form-input" type="password" placeholder="New password (min 8 chars)" value={newPw} onChange={e => setNewPw(e.target.value)} style={{ width: '100%', marginBottom: 12, fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" disabled={saving} onClick={() => resetPw(showResetPw)}>{saving ? '...' : 'Reset'}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowResetPw(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>
        {users.length} user{users.length !== 1 ? 's' : ''} · Roles: 🔴 Admin can manage all settings · 🔵 Architect can create and edit EA content · 🟢 Reviewer has read-only access
      </div>
    </div>
  )
}

const API_URL_LOCAL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'
const token = () => localStorage.getItem('ea_token')
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL_LOCAL}${path}`, { ...opts, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

const CATEGORY_LABELS: Record<string, string> = {
  EA_CORE: '🏛 EA Core', BUSINESS: '💼 Business', BENEFICIARY_EXPERIENCE: '👤 Beneficiary Experience',
  APPLICATIONS: '📱 Applications', DATA: '🗄 Data', TECHNOLOGY: '⚙ Technology',
  SECURITY: '🔒 Security', GOVERNANCE: '📋 Governance', WORKFLOW: '🔄 Workflow', ADM: '🔁 ADM Phases',
}

function TerminologyTab() {
  const [terms, setTerms] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingTerm, setEditingTerm] = useState<any>(null)
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ termKey: '', category: '', arabic: '', arabicNormalized: '', aiPreferred: true, uiPreferred: true, notes: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showGlobalOnly, setShowGlobalOnly] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      authFetch('/localization/terms'),
      authFetch('/localization/categories'),
    ]).then(([t, c]) => {
      setTerms(Array.isArray(t) ? t : [])
      setCategories(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filteredTerms = terms.filter(t => {
    if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false
    if (showGlobalOnly && t.tenantId) return false
    if (search) {
      const s = search.toLowerCase()
      return t.english?.toLowerCase().includes(s) || t.arabic?.includes(search) || t.termKey?.includes(s)
    }
    return true
  })

  const saveOverride = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/localization/terms/override', { method: 'POST', body: JSON.stringify(overrideForm) })
      if (res.id) { setMsg({ type: 'success', text: 'Override saved' }); setShowOverrideForm(false); load() }
      else setMsg({ type: 'error', text: res.message || 'Failed to save' })
    } finally { setSaving(false) }
  }

  const disableTerm = async (termKey: string, category: string) => {
    if (!window.confirm(`Disable "${termKey}" for this tenant?`)) return
    await authFetch(`/localization/terms/${termKey}/${category}/disable`, { method: 'PUT' })
    setMsg({ type: 'success', text: 'Term disabled for this tenant' }); load()
  }

  const startOverride = (term: any) => {
    setOverrideForm({ termKey: term.termKey, category: term.category, arabic: term.arabic, arabicNormalized: term.arabicNormalized || term.arabic, aiPreferred: term.aiPreferred, uiPreferred: term.uiPreferred, notes: term.notes || '' })
    setShowOverrideForm(true); setEditingTerm(term)
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🌐 EA Terminology Management</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        Manage NORA/DGA standard terminology. Global terms are platform defaults. Create tenant-specific overrides to customize Arabic terminology for your organization.
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Search terms..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 200, fontSize: 11 }} />
        <select className="form-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ fontSize: 11 }}>
          <option value="ALL">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={showGlobalOnly} onChange={e => setShowGlobalOnly(e.target.checked)} />
          Global only
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditingTerm(null); setOverrideForm({ termKey: '', category: '', arabic: '', arabicNormalized: '', aiPreferred: true, uiPreferred: true, notes: '' }); setShowOverrideForm(true) }}>
            + Add Override
          </button>
        </div>
      </div>

      {/* Override form */}
      {showOverrideForm && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--navy)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{editingTerm ? `Override: ${editingTerm.english}` : 'New Terminology Override'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {!editingTerm && <>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Term Key</div>
                <input className="form-input" value={overrideForm.termKey} onChange={e => setOverrideForm(f => ({ ...f, termKey: e.target.value }))} placeholder="e.g. enterprise_architecture" style={{ fontSize: 11, width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Category</div>
                <select className="form-input" value={overrideForm.category} onChange={e => setOverrideForm(f => ({ ...f, category: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
            </>}
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Arabic Term</div>
              <input className="form-input" value={overrideForm.arabic} onChange={e => setOverrideForm(f => ({ ...f, arabic: e.target.value }))} placeholder="Arabic translation" style={{ fontSize: 11, width: '100%', direction: 'rtl' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Normalized Form (used in AI)</div>
              <input className="form-input" value={overrideForm.arabicNormalized} onChange={e => setOverrideForm(f => ({ ...f, arabicNormalized: e.target.value }))} placeholder="Preferred AI form" style={{ fontSize: 11, width: '100%', direction: 'rtl' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Notes</div>
              <input className="form-input" value={overrideForm.notes} onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 18 }}>
              <label style={{ fontSize: 11, display: 'flex', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={overrideForm.aiPreferred} onChange={e => setOverrideForm(f => ({ ...f, aiPreferred: e.target.checked }))} /> AI preferred
              </label>
              <label style={{ fontSize: 11, display: 'flex', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={overrideForm.uiPreferred} onChange={e => setOverrideForm(f => ({ ...f, uiPreferred: e.target.checked }))} /> UI preferred
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={saving} onClick={saveOverride}>{saving ? 'Saving...' : '💾 Save Override'}</button>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowOverrideForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Terms table */}
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading terminology...</div> : (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{filteredTerms.length} terms</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 80px 80px', background: 'var(--navy-mid)', padding: '8px 12px', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', gap: 8 }}>
              <div>ENGLISH</div><div>ARABIC</div><div>NORMALIZED (AI)</div><div>CATEGORY</div><div>FLAGS</div><div>ACTIONS</div>
            </div>
            {filteredTerms.slice(0, 100).map(term => (
              <div key={`${term.termKey}-${term.category}-${term.tenantId || 'global'}`}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 80px 80px', padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11, gap: 8, alignItems: 'center', background: term.tenantId ? 'rgba(3,105,161,0.04)' : 'transparent', opacity: term.isActive === false ? 0.4 : 1 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{term.english}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{term.termKey}</div>
                </div>
                <div style={{ direction: 'rtl', textAlign: 'right' }}>{term.arabic}</div>
                <div style={{ direction: 'rtl', textAlign: 'right', color: term.arabicNormalized !== term.arabic ? 'var(--accent)' : 'var(--text)' }}>{term.arabicNormalized}</div>
                <div>
                  <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 2, background: 'var(--navy-mid)', fontFamily: 'var(--font-mono)' }}>{CATEGORY_LABELS[term.category]?.replace(/^[^ ]+ /, '') || term.category}</span>
                  {term.tenantId && <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2 }}>● tenant override</div>}
                  {term.isGlobal && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>◉ global</div>}
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {term.aiPreferred && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(3,105,161,0.15)', color: 'var(--accent)' }}>AI</span>}
                  {term.uiPreferred && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(100,200,100,0.15)', color: '#4caf50' }}>UI</span>}
                  {term.isActive === false && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(255,0,0,0.1)', color: '#f44' }}>OFF</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startOverride(term)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: 'var(--text)' }}>✏</button>
                  {!term.tenantId && <button onClick={() => disableTerm(term.termKey, term.category)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: '#f44' }}>✕</button>}
                </div>
              </div>
            ))}
          </div>
          {filteredTerms.length > 100 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>Showing first 100 — use search or category filter to narrow results</div>}
        </div>
      )}

      {/* Resolution info */}
      <div style={{ marginTop: 16, padding: 12, background: 'rgba(3,105,161,0.05)', border: '1px solid rgba(3,105,161,0.15)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--text-dim)' }}>
        <strong style={{ color: 'var(--text)' }}>Resolution order:</strong> Tenant override → Global NORA/DGA baseline → Raw key<br />
        <span style={{ color: 'var(--accent)' }}>● Tenant overrides</span> are shown with a blue indicator. They take precedence over global terms in AI generation and UI display.
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { setLocale, isAR, t } = useLang()
  const api = useApi()
  const [config, setConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [tab, setTab] = useState('ai')

  // Form states
  const [ai, setAi] = useState({ provider: 'openai', model: 'gpt-4o', language: 'EN' })

  useEffect(() => {
    api.get('/config').then(c => {
      setConfig(c)
      setAi(c.ai || { provider: 'openai', model: 'gpt-4o', language: 'EN' })
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async (section: string, data: any) => {
    setSaving(section)
    setMsg(null)
    try {
      await api.put(`/config/${section}`, data)
      setMsg({ type: 'success', text: t('settings.saved') })
      const updated = await api.get('/config')
      setConfig(updated)
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed to save' })
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{t('settings.title')}</div>
        <div className="page-subtitle">{isAR ? 'إعدادات المنظمة — ' : 'TENANT CONFIGURATION — '}{config?.tenant?.slug?.toUpperCase()}</div>
        <div className="page-tabs">
          {[
            ['ai', t('settings.ai')],
            ['apikeys', t('settings.apikeys')], ['rag', t('settings.kb')],
            ['branding', t('settings.branding')], ['export', t('settings.export')], ['governance', t('settings.governance')],
            ['diagrams', t('settings.diagrams')], ['notifications', t('settings.notifications')],
            ['users', t('settings.users')], ['terminology', t('settings.terminology')], ['billing', t('settings.billing')]
          ].map(([k, l]) => (
            <button key={k} className={`tab-btn${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 720 }}>
        {msg && (
          <div style={{ padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', border: `1px solid ${msg.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {/* ── AI Config ── */}
        {tab === 'ai' && (
          <div className="card">
            <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>🤖 AI Configuration<HelpTip text="Controls which AI service powers features like governance reviews and the copilot. Unless you have a specific reason to change this, the default setting works well - this is mainly for administrators." /></div>
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
            <button className="btn btn-primary mt-4" disabled={saving === 'ai'} onClick={() => {
              save('ai', ai)
              // Sync UI language with AI language preference
              if (ai.language === 'AR' || ai.language === 'EN') setLocale(ai.language as 'AR' | 'EN')
            }}>
              {saving === 'ai' ? 'Saving...' : 'Save AI Configuration'}
            </button>
          </div>
        )}

        {/* ── Billing ── */}
        {tab === 'apikeys' && <ApiKeysTab />}
        {tab === 'rag' && <RagKbTab />}
        {tab === 'branding' && <BrandingTab />}
        {tab === 'export' && <ExportSettingsTab />}
        {tab === 'governance' && <GovernanceSettingsTab />}
        {tab === 'diagrams' && <DiagramSettingsTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'terminology' && <TerminologyTab />}

        {tab === 'billing' && <BillingTab api={api} tenant={config?.tenant} />}
      </div>
    </div>
  )
}
