import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import HelpTip from '../components/HelpTip'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  const { token } = useAuth() as any
  const h = () => ({ Authorization: `Bearer ${token || localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' })
  const get = (p: string) => fetch(`${API}${p}`, { headers: h() }).then(r => r.json())
  const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: h(), body: b ? JSON.stringify(b) : undefined }).then(r => r.json())
  const put = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PUT', headers: h(), body: JSON.stringify(b) }).then(r => r.json())
  const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: h() }).then(r => r.ok)
  const tok = token || localStorage.getItem('ea_token') || ''
  return { get, post, put, del, tok }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (a: boolean) => ({ padding: '10px 18px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', background: 'none', border: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary' | 'secondary' | 'danger' | 'success' = 'secondary') => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : v === 'success' ? '#2ecc7122' : 'var(--navy-mid)',
    color: v === 'primary' ? '#0B1929' : v === 'danger' ? '#e74c3c' : v === 'success' ? '#2ecc71' : 'var(--text)',
  }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const CONNECTOR_TYPES = [
  { code: 'ARCHIMATE',       name: 'ArchiMate 3.1',     icon: '📐', color: '#9b59b6', desc: 'Open standard exchange format — import/export ArchiMate XML files', fileOnly: true },
  { code: 'SPARX_EA',        name: 'Sparx Enterprise Architect', icon: '🏗', color: '#3498db', desc: 'Import XMI exports from Sparx EA', fileOnly: true },
  { code: 'LEANIX',          name: 'LeanIX',            icon: '🔷', color: '#0070d2', desc: 'Bidirectional sync via LeanIX REST API', fileOnly: false },
  { code: 'ARDOQ',           name: 'Ardoq',             icon: '🔶', color: '#f39c12', desc: 'Bidirectional sync via Ardoq REST API', fileOnly: false },
  { code: 'SERVICENOW_CMDB', name: 'ServiceNow CMDB',   icon: '🖥', color: '#81b5a1', desc: 'Import CI records from ServiceNow CMDB', fileOnly: false },
  { code: 'MEGA_HOPEX',      name: 'MEGA HOPEX',        icon: '⬡', color: '#e74c3c', desc: 'Export/import via MEGA API or file', fileOnly: false },
  { code: 'BIZZDESIGN',      name: 'Bizzdesign Horizzon', icon: '🔷', color: '#2ecc71', desc: 'Import/export via Bizzdesign API', fileOnly: false },
  { code: 'GENERIC_CSV',     name: 'Generic CSV',       icon: '📊', color: '#7f8c8d', desc: 'Import any CSV file with column mapping', fileOnly: true },
  { code: 'GENERIC_JSON',    name: 'Generic JSON',      icon: '📄', color: '#7f8c8d', desc: 'ArchMind canonical JSON format', fileOnly: true },
  { code: 'ENTRA_ID',        name: 'Microsoft Entra ID', icon: '🔑', color: '#0078d4', desc: 'Users, groups, and enterprise apps via Microsoft Graph', fileOnly: false },
  { code: 'GENERIC_CMDB',    name: 'Generic CMDB',      icon: '🗄', color: '#5d6d7e', desc: 'Any CMDB exposing a REST/OData API (requires endpoint configuration)', fileOnly: false },
  { code: 'CLOUD_PROVIDER',  name: 'Cloud Provider',    icon: '☁️', color: '#f39c12', desc: 'Cloud resource inventory (AWS/Azure/GCP)', fileOnly: false, comingSoon: true },
  { code: 'API_MANAGEMENT',  name: 'API Management',    icon: '🔌', color: '#8e44ad', desc: 'API gateway/management platform catalog discovery (requires endpoint configuration)', fileOnly: false },
  { code: 'DATA_CATALOG',    name: 'Data Catalog',      icon: '📚', color: '#16a085', desc: 'Data governance/catalog platform asset discovery (requires endpoint configuration)', fileOnly: false },
  { code: 'PPM_TOOL',        name: 'PPM Tool',          icon: '📅', color: '#2980b9', desc: 'Project & portfolio management tool initiative data (requires endpoint configuration)', fileOnly: false },
  { code: 'ZOOM_MEETINGS',   name: 'Zoom Meetings',     icon: '📹', color: '#2d8cff', desc: 'Auto-analyze Zoom meetings via webhook + recording transcript', fileOnly: false },
  { code: 'TEAMS_MEETINGS',  name: 'Microsoft Teams Meetings', icon: '💬', color: '#5059c9', desc: 'Auto-analyze Teams meetings via Graph webhook + transcript', fileOnly: false },
]

const STATUS_COLOR: Record<string, string> = { ACTIVE: '#2ecc71', INACTIVE: '#7f8c8d', ERROR: '#e74c3c', SYNCING: '#f39c12' }
const JOB_COLOR: Record<string, string> = { COMPLETED: '#2ecc71', FAILED: '#e74c3c', RUNNING: '#f39c12', PENDING: '#7f8c8d', PARTIAL: '#e67e22' }
const DIRECTION_LABEL: Record<string, string> = { IMPORT: '⬇ Import', EXPORT: '⬆ Export', BIDIRECTIONAL: '⇅ Bidirectional' }

// ── Dashboard ─────────────────────────────────────────────────────────────────
function ConnectorDashboard({ api, stats, onTab, onOpen }: { api: any, stats: any, onTab: (t: string) => void, onOpen: (c: any) => void }) {
  const [connectors, setConnectors] = useState<any[]>([])
  useEffect(() => { api.get('/connectors').then((d: any) => setConnectors(Array.isArray(d) ? d : [])) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
        {[
          { icon: '🔌', label: 'Total Connectors', value: stats?.total || 0, color: 'var(--accent)' },
          { icon: '✅', label: 'Active', value: stats?.active || 0, color: '#2ecc71' },
          { icon: '⚠️', label: 'Pending Conflicts', value: stats?.pendingConflicts || 0, color: '#f39c12' },
          { icon: '🕐', label: 'Last Sync', value: stats?.lastJob ? new Date(stats.lastJob.createdAt).toLocaleDateString() : 'Never', color: '#3498db' },
        ].map(s => (
          <div key={s.label} style={S.statCard}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 12 }}>QUICK ACTIONS</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          <button style={S.btn('primary')} onClick={() => onTab('new')}>+ Add Connector</button>
          <button style={S.btn()} onClick={() => onTab('archimate')}>📐 ArchiMate Import/Export</button>
          <button style={S.btn()} onClick={() => onTab('connectors')}>📋 All Connectors</button>
          {stats?.pendingConflicts > 0 && <button style={S.btn('danger')} onClick={() => onTab('conflicts')}>⚠️ Resolve {stats.pendingConflicts} Conflicts</button>}
        </div>
      </div>

      {connectors.length > 0 && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Active Connectors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {connectors.map(c => {
              const ct = CONNECTOR_TYPES.find(t => t.code === c.connectorType)
              return (
                <div key={c.id} onClick={() => onOpen(c)} style={{ ...S.card, padding: '12px 16px', cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: (ct?.color || '#7f8c8d') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{ct?.icon || '🔌'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ct?.name} · {DIRECTION_LABEL[c.direction]}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={S.badge(STATUS_COLOR[c.status] || '#7f8c8d')}>{c.status}</span>
                    {c.lastSyncAt && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{new Date(c.lastSyncAt).toLocaleDateString()}</span>}
                    <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c._count?.syncJobs || 0} syncs</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {connectors.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔌</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No connectors configured</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Connect ArchMind to your existing EA tools — LeanIX, Ardoq, Sparx EA, ArchiMate and more</div>
          <button style={S.btn('primary')} onClick={() => onTab('new')}>+ Add First Connector</button>
        </div>
      )}
    </div>
  )
}

// ── New Connector ─────────────────────────────────────────────────────────────
function NewConnector({ api, onCreated, onCancel }: { api: any, onCreated: (c: any) => void, onCancel: () => void }) {
  const [step, setStep] = useState<'pick' | 'configure'>('pick')
  const [selectedType, setSelectedType] = useState<any>(null)
  const [form, setForm] = useState({ name: '', description: '', direction: 'BIDIRECTIONAL', baseUrl: '', autoSync: false, syncIntervalMin: 60 })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!form.name || !selectedType) return
    setSaving(true)
    const result = await api.post('/connectors', { ...form, connectorType: selectedType.code, config: {} })
    setSaving(false)
    if (result?.id) onCreated(result)
  }

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 20 }}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onCancel}>← Back</button>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{step === 'pick' ? 'Choose Connector Type' : `Configure: ${selectedType?.name}`}</div>
      </div>

      {step === 'pick' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {CONNECTOR_TYPES.map(ct => (
            <div key={ct.code} onClick={() => { if (ct.comingSoon) return; setSelectedType(ct); setForm(f => ({ ...f, name: ct.name, direction: ct.fileOnly ? 'IMPORT' : 'BIDIRECTIONAL' })); setStep('configure') }}
              style={{ ...S.card, cursor: ct.comingSoon ? 'default' : 'pointer', opacity: ct.comingSoon ? 0.5 : 1, transition: 'all 0.15s' }}
              onMouseEnter={e => { if (!ct.comingSoon) e.currentTarget.style.borderColor = ct.color }}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: ct.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{ct.icon}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{ct.name}</div>
                  {ct.comingSoon ? <span style={S.badge('#f39c12')}>Coming Soon</span> : ct.fileOnly ? <span style={S.badge('#7f8c8d')}>File-based</span> : <span style={S.badge('#2ecc71')}>API Sync</span>}
                </div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>{ct.desc}</div>
            </div>
          ))}
        </div>
      )}

      {step === 'configure' && selectedType && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={S.label}>Connector Name *</label><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>

            {!selectedType.fileOnly && (
              <>
                <div><label style={S.label}>Sync Direction</label>
                  <select style={S.input} value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))}>
                    <option value="IMPORT">⬇ Import only (external → ArchMind)</option>
                    <option value="EXPORT">⬆ Export only (ArchMind → external)</option>
                    <option value="BIDIRECTIONAL">⇅ Bidirectional</option>
                  </select>
                </div>
                <div><label style={S.label}>API Base URL</label>
                  <input style={S.input} value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
                    placeholder={selectedType.code === 'LEANIX' ? 'https://app.leanix.net' : selectedType.code === 'ARDOQ' ? 'https://app.ardoq.com' : 'https://'} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="checkbox" id="autoSync" checked={form.autoSync} onChange={e => setForm(f => ({ ...f, autoSync: e.target.checked }))} />
                  <label htmlFor="autoSync" style={{ fontSize: 13, cursor: 'pointer' }}>Enable automatic sync</label>
                  {form.autoSync && (
                    <input type="number" value={form.syncIntervalMin} onChange={e => setForm(f => ({ ...f, syncIntervalMin: Number(e.target.value) }))}
                      style={{ ...S.input, maxWidth: 80 }} min={15} max={1440} />
                  )}
                  {form.autoSync && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>minutes</span>}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button style={S.btn()} onClick={() => setStep('pick')}>← Back</button>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={create} disabled={!form.name || saving}>{saving ? 'Creating...' : 'Create Connector'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Connector Detail ──────────────────────────────────────────────────────────
function ConnectorDetail({ api, connector, onBack, onRefresh }: { api: any, connector: any, onBack: () => void, onRefresh: () => void }) {
  const [detail, setDetail] = useState<any>(connector)
  const [tab, setTab] = useState<'overview' | 'credentials' | 'mappings' | 'staging' | 'jobs'>('overview')
  const [creds, setCreds] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [jobs, setJobs] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ct = CONNECTOR_TYPES.find(t => t.code === connector.connectorType)

  const loadJobs = () => api.get(`/connectors/${connector.id}/jobs`).then((d: any) => setJobs(Array.isArray(d) ? d : []))
  useEffect(() => { if (tab === 'jobs') loadJobs() }, [tab])

  const saveCreds = async () => {
    setSaving(true)
    await api.post(`/connectors/${connector.id}/credentials`, creds)
    setSaving(false)
    alert('Credentials saved securely')
  }

  const testConnection = async () => {
    setTesting(true); setTestResult(null)
    const result = await api.post(`/connectors/${connector.id}/test`)
    setTestResult(result); setTesting(false)
  }

  const triggerSync = async () => {
    setSyncing(true)
    await api.post(`/connectors/${connector.id}/sync`)
    setSyncing(false)
    loadJobs()
    onRefresh()
  }

  const importArchiMate = async (file: File) => {
    setSyncing(true)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch(`${API}/connectors/${connector.id}/import/archimate`, {
      method: 'POST', headers: { Authorization: `Bearer ${api.tok}` }, body: fd,
    })
    const data = await res.json()
    setSyncing(false); loadJobs()
    alert(`Import complete: ${data.imported || 0} imported, ${data.conflicts || 0} conflicts, ${data.skipped || 0} skipped`)
  }

  const exportArchiMate = async () => {
    const res = await fetch(`${API}/connectors/${connector.id}/export/archimate`, { headers: { Authorization: `Bearer ${api.tok}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ea-repository-${new Date().toISOString().slice(0, 10)}.xml`
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 1500)
  }

  const CRED_FIELDS: Record<string, { label: string; key: string; type?: string }[]> = {
    LEANIX: [{ label: 'API Token', key: 'apiToken', type: 'password' }],
    ARDOQ: [{ label: 'API Key', key: 'apiKey', type: 'password' }, { label: 'Organization Key', key: 'orgKey' }],
    SERVICENOW_CMDB: [{ label: 'Username', key: 'username' }, { label: 'Password', key: 'password', type: 'password' }],
    MEGA_HOPEX: [{ label: 'API Key', key: 'apiKey', type: 'password' }, { label: 'API Secret', key: 'apiSecret', type: 'password' }],
    BIZZDESIGN: [{ label: 'Username', key: 'username' }, { label: 'Password', key: 'password', type: 'password' }],
    ENTRA_ID: [{ label: 'App Client ID', key: 'clientId' }, { label: 'Client Secret', key: 'clientSecret', type: 'password' }],
    GENERIC_CMDB: [{ label: 'Bearer Token / API Key / Password', key: 'token' }, { label: 'API Key (if authType=apiKey)', key: 'apiKey', type: 'password' }, { label: 'Username (if authType=basic)', key: 'username' }, { label: 'Password (if authType=basic)', key: 'password', type: 'password' }],
    API_MANAGEMENT: [{ label: 'Bearer Token / API Key / Password', key: 'token' }, { label: 'API Key (if authType=apiKey)', key: 'apiKey', type: 'password' }, { label: 'Username (if authType=basic)', key: 'username' }, { label: 'Password (if authType=basic)', key: 'password', type: 'password' }],
    DATA_CATALOG: [{ label: 'Bearer Token / API Key / Password', key: 'token' }, { label: 'API Key (if authType=apiKey)', key: 'apiKey', type: 'password' }, { label: 'Username (if authType=basic)', key: 'username' }, { label: 'Password (if authType=basic)', key: 'password', type: 'password' }],
    PPM_TOOL: [{ label: 'Bearer Token / API Key / Password', key: 'token' }, { label: 'API Key (if authType=apiKey)', key: 'apiKey', type: 'password' }, { label: 'Username (if authType=basic)', key: 'username' }, { label: 'Password (if authType=basic)', key: 'password', type: 'password' }],
    ZOOM_MEETINGS: [
      { label: 'Webhook Secret Token (from Zoom App > Feature > Event Subscriptions)', key: 'webhookSecretToken', type: 'password' },
      { label: 'Account ID (Server-to-Server OAuth app)', key: 'accountId' },
      { label: 'Client ID', key: 'clientId' },
      { label: 'Client Secret', key: 'clientSecret', type: 'password' },
    ],
    TEAMS_MEETINGS: [
      { label: 'Azure Tenant (Directory) ID', key: 'azureTenantId' },
      { label: 'App Registration Client ID', key: 'clientId' },
      { label: 'Client Secret', key: 'clientSecret', type: 'password' },
      { label: 'Client State (shared secret you choose for webhook verification)', key: 'clientState', type: 'password' },
      { label: 'Organizer User ID (for transcript retrieval)', key: 'organizerUserId' },
      { label: 'Online Meeting ID (for transcript retrieval)', key: 'onlineMeetingId' },
    ],
  }

  const credFields = CRED_FIELDS[connector.connectorType] || []
  const isGenericRestType = ['GENERIC_CMDB', 'API_MANAGEMENT', 'DATA_CATALOG', 'PPM_TOOL'].includes(connector.connectorType)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 20 }}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>← Back</button>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: (ct?.color || '#7f8c8d') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{ct?.icon || '🔌'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{connector.name}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
            <span style={S.badge(STATUS_COLOR[connector.status] || '#7f8c8d')}>{connector.status}</span>
            <span style={S.badge('#7f8c8d')}>{ct?.name}</span>
            <span style={S.badge('#3498db')}>{DIRECTION_LABEL[connector.direction]}</span>
          </div>
        </div>
        <div style={S.row}>
          {!ct?.fileOnly && <button style={S.btn()} onClick={testConnection} disabled={testing}>{testing ? '⏳ Testing...' : '🔗 Test Connection'}</button>}
          {!ct?.fileOnly && <button style={S.btn('primary')} onClick={triggerSync} disabled={syncing}>{syncing ? '⏳ Syncing...' : '▶ Sync Now'}</button>}
          {ct?.code === 'ARCHIMATE' && (
            <>
              <input ref={fileInputRef} type="file" accept=".xml,.archimate" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) importArchiMate(e.target.files[0]) }} />
              <button style={S.btn()} onClick={() => fileInputRef.current?.click()} disabled={syncing}>{syncing ? '⏳ Importing...' : '⬇ Import XML'}</button>
              <button style={S.btn('primary')} onClick={exportArchiMate}>⬆ Export XML</button>
            </>
          )}
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div style={{ ...S.card, marginBottom: 16, borderColor: testResult.success ? '#2ecc71' : '#e74c3c', padding: '12px 16px' }}>
          <span style={{ color: testResult.success ? '#2ecc71' : '#e74c3c', fontWeight: 600 }}>
            {testResult.success ? '✅' : '❌'} {testResult.message}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['overview', 'credentials', 'mappings', 'staging', 'jobs'] as const).map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'overview' ? '📋 Overview' : t === 'credentials' ? '🔐 Credentials' : t === 'mappings' ? '🗺 Mappings' : t === 'staging' ? '📥 Staging' : `📊 Sync Jobs (${jobs.length})`}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={S.grid2}>
          {[
            { label: 'Type', value: ct?.name || connector.connectorType },
            { label: 'Direction', value: DIRECTION_LABEL[connector.direction] },
            { label: 'Status', value: connector.status },
            { label: 'Auto Sync', value: connector.autoSync ? `Every ${connector.syncIntervalMin} min` : 'Disabled' },
            { label: 'Base URL', value: connector.baseUrl || '—' },
            { label: 'Last Sync', value: connector.lastSyncAt ? new Date(connector.lastSyncAt).toLocaleString() : 'Never' },
            { label: 'Last Status', value: connector.lastSyncStatus || '—' },
            { label: 'Field Mappings', value: connector.fieldMappings?.length || 0 },
          ].map(f => (
            <div key={f.label} style={S.card}>
              <div style={S.label}>{f.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{f.value}</div>
            </div>
          ))}
          {connector.description && (
            <div style={{ ...S.card, gridColumn: '1/-1' }}>
              <div style={S.label}>Description</div>
              <div style={{ fontSize: 13 }}>{connector.description}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'credentials' && (
        <div style={{ maxWidth: 480 }}>
          {credFields.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
              {ct?.fileOnly ? 'File-based connector — no credentials needed' : 'No credential fields configured for this connector type'}
            </div>
          ) : (
            <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '8px 12px', background: 'rgba(0,180,216,0.06)', borderRadius: 8 }}>
                🔒 Credentials are encrypted with AES-256-GCM before storage. They are never stored in plaintext.
              </div>
              {isGenericRestType && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 12px', background: 'rgba(243,156,18,0.08)', borderRadius: 8 }}>
                  ⚠️ This connector type also requires <code>authType</code> and <code>resources</code> (per-object-type endpoint paths and field names) — configure these in the Connector Configuration panel below.
                </div>
              )}
              {connector.connectorType === 'ENTRA_ID' && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 12px', background: 'rgba(243,156,18,0.08)', borderRadius: 8 }}>
                  ⚠️ This connector also requires your Entra ID tenant (directory) ID — configure it in the Connector Configuration panel below. The app registration needs application-level Graph API permissions (User.Read.All, Group.Read.All, Application.Read.All) with admin consent granted.
                </div>
              )}
              {connector.connectorType === 'ZOOM_MEETINGS' && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 12px', background: 'rgba(45,140,255,0.08)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>⚠️ After saving credentials, paste this URL into your Zoom App's <b>Event Subscriptions</b> settings (Feature tab), and subscribe to <code>meeting.ended</code> and <code>recording.completed</code>. Zoom will send a one-time validation request to this URL, which is handled automatically.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...S.input, fontFamily: 'monospace', fontSize: 11 }} readOnly value={`${API}/copilot/meetings/webhook/${connector.id}`} />
                    <button style={{ ...S.btn(), whiteSpace: 'nowrap' as const }} onClick={() => { navigator.clipboard.writeText(`${API}/copilot/meetings/webhook/${connector.id}`); alert('Copied!') }}>Copy</button>
                  </div>
                </div>
              )}
              {connector.connectorType === 'TEAMS_MEETINGS' && (
                <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '8px 12px', background: 'rgba(80,89,201,0.08)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>⚠️ After saving credentials below, click <b>Setup Subscription</b> to create the Microsoft Graph subscription automatically — no manual Graph API calls needed. Requires OnlineMeetingTranscript.Read.All and CallRecords.Read.All application permissions with admin consent, and Teams Premium or equivalent licensing for transcript access. Once created, the subscription renews itself automatically in the background.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...S.input, fontFamily: 'monospace', fontSize: 11, marginBottom: 0 }} readOnly value={`${API}/copilot/meetings/webhook/${connector.id}`} />
                    <button style={{ ...S.btn(), whiteSpace: 'nowrap' as const }} onClick={() => { navigator.clipboard.writeText(`${API}/copilot/meetings/webhook/${connector.id}`); alert('Copied!') }}>Copy</button>
                  </div>
                  <TeamsSubscriptionButton connectorId={connector.id} />
                </div>
              )}
              {credFields.map(f => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <input style={S.input} type={f.type || 'text'} value={creds[f.key] || ''} onChange={e => setCreds((c: any) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.type === 'password' ? '••••••••' : ''} />
                </div>
              ))}
              <button style={S.btn('primary')} onClick={saveCreds} disabled={saving}>{saving ? 'Saving...' : '🔐 Save Credentials'}</button>
            </div>
          )}
          {['GENERIC_CMDB', 'API_MANAGEMENT', 'DATA_CATALOG', 'PPM_TOOL', 'ENTRA_ID', 'MEGA_HOPEX'].includes(connector.connectorType) && (
            <ConnectorConfigEditor api={api} connector={connector} onSaved={onRefresh} />
          )}
        </div>
      )}

      {tab === 'mappings' && <MappingsTab api={api} connectorId={connector.id} connectorTypeName={ct?.name} />}

      {tab === 'staging' && <StagingTab api={api} connectorId={connector.id} />}

      {tab === 'jobs' && (
        <div>
          {jobs.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No sync jobs yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {jobs.map(j => (
                <div key={j.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={S.badge(JOB_COLOR[j.status] || '#7f8c8d')}>{j.status}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{DIRECTION_LABEL[j.direction]} · {j.totalRecords} records</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      ✅ {j.importedCount} imported · 🔄 {j.updatedCount} updated · ⏭ {j.skippedCount} skipped · ⚠️ {j.conflictCount} conflicts
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'right' }}>
                    {new Date(j.createdAt).toLocaleString()}
                    {j.completedAt && <div>{Math.round((new Date(j.completedAt).getTime() - new Date(j.createdAt).getTime()) / 1000)}s</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Mappings Tab (Data Sync Studio) ─────────────────────────────────────────
const TRANSFORMS = ['NONE', 'UPPERCASE', 'LOWERCASE', 'TRIM', 'DATE_ISO', 'ENUM_MAP']

function MappingsTab({ api, connectorId, connectorTypeName }: { api: any, connectorId: string, connectorTypeName?: string }) {
  const [mappings, setMappings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null) // the mapping being edited, or a fresh draft
  const [discovered, setDiscovered] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/connectors/${connectorId}/mappings`).then((d: any) => { setMappings(Array.isArray(d) ? d : []); setLoading(false) })
  }, [api, connectorId])
  useEffect(() => { load() }, [load])

  const startNew = () => setEditing({ sourceType: '', targetType: '', direction: 'BIDIRECTIONAL', fieldMaps: [{ sourceField: '', targetField: '', transform: 'NONE' }] })
  const startEdit = (m: any) => setEditing({ ...m, fieldMaps: [...(m.fieldMaps || [])] })

  const discoverFields = async (objectTypeCode: string) => {
    if (!objectTypeCode) return
    const fields = await api.get(`/connectors/${connectorId}/staging-fields/${objectTypeCode}`)
    setDiscovered(Array.isArray(fields) ? fields : [])
  }

  const addFieldRow = () => setEditing((e: any) => ({ ...e, fieldMaps: [...e.fieldMaps, { sourceField: '', targetField: '', transform: 'NONE' }] }))
  const updateFieldRow = (i: number, patch: any) => setEditing((e: any) => ({ ...e, fieldMaps: e.fieldMaps.map((fm: any, idx: number) => idx === i ? { ...fm, ...patch } : fm) }))
  const removeFieldRow = (i: number) => setEditing((e: any) => ({ ...e, fieldMaps: e.fieldMaps.filter((_: any, idx: number) => idx !== i) }))

  const save = async () => {
    if (!editing.sourceType || !editing.targetType) return alert('Source type and target type are required')
    setSaving(true)
    // The save endpoint replaces the FULL mapping set for this connector —
    // merge the edited/new mapping into the existing list by sourceType.
    const others = mappings.filter(m => m.sourceType !== editing.sourceType)
    const next = [...others, editing]
    await api.post(`/connectors/${connectorId}/mappings`, { mappings: next })
    setSaving(false); setEditing(null); load()
  }

  const deleteMapping = async (sourceType: string) => {
    if (!window.confirm(`Delete the mapping for "${sourceType}"?`)) return
    const next = mappings.filter(m => m.sourceType !== sourceType)
    await api.post(`/connectors/${connectorId}/mappings`, { mappings: next })
    load()
  }

  if (loading) return <div style={{ color: 'var(--text-dim)', padding: 20 }}>Loading…</div>

  if (editing) {
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.grid2}>
            <div>
              <label style={S.label}>Source Type (external field, e.g. "User" or an Entra ID object type)</label>
              <input style={S.input} value={editing.sourceType} onChange={e => setEditing((v: any) => ({ ...v, sourceType: e.target.value }))} placeholder="e.g. Application" />
            </div>
            <div>
              <label style={S.label}>Target Type (ArchMind object type code)</label>
              <input style={S.input} value={editing.targetType} onChange={e => setEditing((v: any) => ({ ...v, targetType: e.target.value }))} placeholder="e.g. APPLICATION" />
            </div>
          </div>
          <div>
            <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => discoverFields(editing.targetType)}>🔍 Discover fields from staged data</button>
            {discovered.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Found: {discovered.join(', ')}</div>}
          </div>

          <div style={{ fontWeight: 600, fontSize: 13, marginTop: 4 }}>Field Mappings</div>
          {editing.fieldMaps.map((fm: any, i: number) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
              <input style={S.input} placeholder="Source field" value={fm.sourceField} onChange={e => updateFieldRow(i, { sourceField: e.target.value })} list="discovered-fields" />
              <input style={S.input} placeholder="Target field" value={fm.targetField} onChange={e => updateFieldRow(i, { targetField: e.target.value })} />
              <select style={S.input} value={fm.transform || 'NONE'} onChange={e => updateFieldRow(i, { transform: e.target.value })}>
                {TRANSFORMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button style={{ ...S.btn('danger'), fontSize: 11, padding: '6px 10px' }} onClick={() => removeFieldRow(i)}>✕</button>
            </div>
          ))}
          <datalist id="discovered-fields">{discovered.map(f => <option key={f} value={f} />)}</datalist>
          <button style={{ ...S.btn(), alignSelf: 'flex-start' }} onClick={addFieldRow}>+ Add Field</button>

          <div style={S.row}>
            <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? 'Saving…' : '💾 Save Mapping'}</button>
            <button style={S.btn()} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <span>Define how object types in {connectorTypeName || 'this source'} map to ArchMind asset fields. Used by the mapping engine when processing staged records.</span>
        <HelpTip text="Different systems name things differently - one might call something 'App Name' while ArchMind calls it 'name'. A mapping tells ArchMind which field is which, so incoming data lines up correctly." />
      </div>
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={startNew}>+ New Mapping</button>
      {mappings.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No field mappings configured yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mappings.map(m => (
            <div key={m.id || m.sourceType} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.sourceType} → {m.targetType}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{(m.fieldMaps || []).length} field(s) mapped</div>
              </div>
              <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => startEdit(m)}>Edit</button>
              <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => deleteMapping(m.sourceType)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Staging Tab (Data Sync Studio) ──────────────────────────────────────────
const MATCH_STATUS_COLOR: Record<string, string> = { PENDING: '#7f8c8d', MATCHED: '#2ecc71', NEW: '#3498db', CONFLICT: '#e74c3c', IGNORED: '#7f8c8d' }

function StagingTab({ api, connectorId }: { api: any, connectorId: string }) {
  const [objectTypeCode, setObjectTypeCode] = useState('')
  const [summary, setSummary] = useState<any[]>([])
  const [records, setRecords] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [running, setRunning] = useState(false)
  const [autoCommit, setAutoCommit] = useState(false)

  const loadSummary = useCallback(() => {
    api.get(`/connectors/${connectorId}/staging/summary`).then((d: any) => setSummary(Array.isArray(d) ? d : []))
  }, [api, connectorId])
  useEffect(() => { loadSummary() }, [loadSummary])

  const objectTypes = [...new Set(summary.map((s: any) => s.objectTypeCode))]

  const loadRecords = useCallback(() => {
    if (!objectTypeCode) { setRecords([]); return }
    const q = new URLSearchParams({ objectTypeCode, ...(statusFilter ? { matchStatus: statusFilter } : {}) })
    api.get(`/connectors/${connectorId}/staging?${q}`).then((d: any) => setRecords(Array.isArray(d) ? d : []))
  }, [api, connectorId, objectTypeCode, statusFilter])
  useEffect(() => { loadRecords() }, [loadRecords])

  const runPipeline = async () => {
    if (!objectTypeCode) return alert('Select an object type first')
    setRunning(true)
    const result = await api.post(`/connectors/${connectorId}/pipeline/${objectTypeCode}`, { autoCommit })
    setRunning(false)
    alert(`Pipeline complete: ${result.mapped ?? 0} mapped · ${result.matched ?? 0} matched · ${result.conflicts ?? 0} conflicts · ${result.new ?? 0} new${result.committed ? ` · ${result.committed.created} created, ${result.committed.updated} updated` : ''}`)
    loadSummary(); loadRecords()
  }

  const resolveConflict = async (stagingRecordId: string, matchedAssetId?: string, markAsNew?: boolean) => {
    await api.post(`/connectors/staging/${stagingRecordId}/resolve-match`, { matchedAssetId, markAsNew })
    loadRecords(); loadSummary()
  }

  const commitRecord = async (stagingRecordId: string) => {
    const result = await api.post(`/connectors/staging/${stagingRecordId}/commit`)
    if (result?.assetId) { loadRecords(); loadSummary() } else { alert(result?.message || 'Commit failed') }
  }

  const commitAll = async () => {
    if (!objectTypeCode) return
    const result = await api.post(`/connectors/${connectorId}/staging/${objectTypeCode}/commit-all`)
    alert(`Committed: ${result.created} created, ${result.updated} updated${result.errors?.length ? `, ${result.errors.length} error(s)` : ''}`)
    loadRecords(); loadSummary()
  }

  const summaryForType = summary.filter((s: any) => s.objectTypeCode === objectTypeCode)

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <span>Records land here after being pulled/imported from the source, before being committed into the EA Repository. Run the pipeline to map, match, and (optionally) auto-commit.</span>
        <HelpTip text="This is a holding area for data pulled in from a connected system. Nothing here affects your repository until you review it and confirm it - so it's safe to look through before anything changes." />
      </div>

      <div style={{ ...S.card, marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const }}>
        <div style={{ minWidth: 200 }}>
          <label style={S.label}>Object Type</label>
          <select style={S.input} value={objectTypeCode} onChange={e => setObjectTypeCode(e.target.value)}>
            <option value="">Select…</option>
            {objectTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 16 }}>
          <input type="checkbox" checked={autoCommit} onChange={e => setAutoCommit(e.target.checked)} /> Auto-commit high-confidence matches
        </label>
        <button style={{ ...S.btn('primary'), marginTop: 16 }} onClick={runPipeline} disabled={running || !objectTypeCode}>{running ? '⏳ Running…' : '▶ Run Pipeline'}</button>
        <button style={{ ...S.btn(), marginTop: 16 }} onClick={commitAll} disabled={!objectTypeCode}>✅ Commit All Ready</button>
      </div>

      {objectTypeCode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['PENDING', 'MATCHED', 'NEW', 'CONFLICT'].map(status => {
            const count = summaryForType.find((s: any) => s.matchStatus === status)?._count || 0
            return (
              <button key={status} style={{ ...S.statCard, cursor: 'pointer', flex: 1, textAlign: 'center', border: statusFilter === status ? `1px solid ${MATCH_STATUS_COLOR[status]}` : undefined }} onClick={() => setStatusFilter(statusFilter === status ? '' : status)}>
                <div style={{ fontSize: 20, fontWeight: 700, color: MATCH_STATUS_COLOR[status] }}>{count}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{status}</div>
              </button>
            )
          })}
        </div>
      )}

      {objectTypeCode && (
        records.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No staged records{statusFilter ? ` with status ${statusFilter}` : ''}.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {records.map((r: any) => (
              <div key={r.id} style={{ ...S.card, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={S.badge(MATCH_STATUS_COLOR[r.matchStatus])}>{r.matchStatus}</span>
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div style={{ fontWeight: 500 }}>{r.mappedData?.name || r.rawData?.name || r.externalId}</div>
                  {r.matchConfidence != null && <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>Confidence: {Math.round(r.matchConfidence * 100)}%</div>}
                </div>
                {r.matchStatus === 'CONFLICT' && (
                  <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => resolveConflict(r.id, undefined, true)}>Mark as New</button>
                )}
                {(r.matchStatus === 'MATCHED' || r.matchStatus === 'NEW') && !r.reviewedAt && (
                  <button style={{ ...S.btn('primary'), fontSize: 11 }} onClick={() => commitRecord(r.id)}>Commit</button>
                )}
                {r.reviewedAt && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>✓ Committed</span>}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── ArchiMate Quick Panel ─────────────────────────────────────────────────────
function ConnectorConfigEditor({ api, connector, onSaved }: { api: any, connector: any, onSaved: () => void }) {
  const [config, setConfig] = useState<any>(connector.config || {})
  const [saving, setSaving] = useState(false)
  const [rawMode, setRawMode] = useState(false)
  const [rawText, setRawText] = useState(JSON.stringify(connector.config || {}, null, 2))
  const [rawError, setRawError] = useState('')

  const isGenericRest = ['GENERIC_CMDB', 'API_MANAGEMENT', 'DATA_CATALOG', 'PPM_TOOL'].includes(connector.connectorType)
  const isEntraId = connector.connectorType === 'ENTRA_ID'
  const isMegaHopex = connector.connectorType === 'MEGA_HOPEX'
  const hasStructuredForm = isGenericRest || isEntraId || isMegaHopex

  const save = async (dataToSave: any) => {
    setSaving(true)
    try {
      await api.put(`/connectors/${connector.id}`, { config: dataToSave })
      onSaved()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const saveRaw = () => {
    try {
      const parsed = JSON.parse(rawText)
      setRawError('')
      save(parsed)
    } catch (e: any) { setRawError('Invalid JSON: ' + e.message) }
  }

  // ── Generic-REST resources builder ──────────────────────────────────────
  const resources = config.resources || {}
  const resourceKeys = Object.keys(resources)
  const [newResourceKey, setNewResourceKey] = useState('')

  const addResource = () => {
    if (!newResourceKey.trim()) return
    setConfig((c: any) => ({ ...c, resources: { ...(c.resources || {}), [newResourceKey.trim()]: { path: '', idField: 'id' } } }))
    setNewResourceKey('')
  }
  const updateResource = (key: string, patch: any) => {
    setConfig((c: any) => ({ ...c, resources: { ...(c.resources || {}), [key]: { ...(c.resources?.[key] || {}), ...patch } } }))
  }
  const removeResource = (key: string) => {
    setConfig((c: any) => { const r = { ...(c.resources || {}) }; delete r[key]; return { ...c, resources: r } })
  }

  return (
    <div style={{ ...S.card, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, flex: 1 }}>⚙ Connector Configuration</div>
        {hasStructuredForm && <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => { setRawMode(!rawMode); setRawText(JSON.stringify(config, null, 2)) }}>{rawMode ? 'Structured Editor' : 'Raw JSON'}</button>}
      </div>

      {rawMode || !hasStructuredForm ? (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Any additional settings this connector type needs, as raw JSON.</div>
          <textarea style={{ ...S.input, minHeight: 160, fontFamily: 'monospace', fontSize: 12 }} value={rawText} onChange={e => setRawText(e.target.value)} />
          {rawError && <div style={{ fontSize: 11, color: '#e74c3c', marginBottom: 8 }}>{rawError}</div>}
          <button style={S.btn('primary')} onClick={saveRaw} disabled={saving}>{saving ? 'Saving…' : '💾 Save Config'}</button>
        </div>
      ) : (
        <div>
          {isEntraId && (
            <div>
              <div style={S.label}>Entra ID Tenant (Directory) ID</div>
              <input style={S.input} value={config.tenantId || ''} onChange={e => setConfig((c: any) => ({ ...c, tenantId: e.target.value }))} placeholder="e.g. 72f988bf-86f1-41af-91ab-2d7cd011db47" />
            </div>
          )}
          {isMegaHopex && (
            <div style={S.grid2}>
              <div><div style={S.label}>Environment</div><input style={S.input} value={config.environment || ''} onChange={e => setConfig((c: any) => ({ ...c, environment: e.target.value }))} /></div>
              <div><div style={S.label}>Repository</div><input style={S.input} value={config.repository || ''} onChange={e => setConfig((c: any) => ({ ...c, repository: e.target.value }))} /></div>
              <div style={{ gridColumn: '1/-1' }}><div style={S.label}>API Base Path (optional, defaults to /MEGA/WS/api)</div><input style={S.input} value={config.apiBasePath || ''} onChange={e => setConfig((c: any) => ({ ...c, apiBasePath: e.target.value }))} /></div>
            </div>
          )}
          {isGenericRest && (
            <div>
              <div style={S.label}>Auth Type</div>
              <select style={S.input} value={config.authType || ''} onChange={e => setConfig((c: any) => ({ ...c, authType: e.target.value }))}>
                <option value="">Select…</option>
                <option value="bearer">Bearer Token</option>
                <option value="apiKey">API Key (header)</option>
                <option value="basic">Basic Auth (username/password)</option>
              </select>
              {config.authType === 'apiKey' && (
                <div><div style={S.label}>API Key Header Name</div><input style={S.input} placeholder="e.g. X-Api-Key" value={config.apiKeyHeader || ''} onChange={e => setConfig((c: any) => ({ ...c, apiKeyHeader: e.target.value }))} /></div>
              )}

              <div style={{ ...S.label, marginTop: 10 }}>Resources (one per object type this connector can fetch)</div>
              {resourceKeys.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>No resources configured yet.</div>}
              {resourceKeys.map(key => (
                <div key={key} style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{key}</div>
                    <button style={{ ...S.btn('danger'), fontSize: 10, padding: '3px 8px' }} onClick={() => removeResource(key)}>Remove</button>
                  </div>
                  <div style={S.grid2}>
                    <input style={{ ...S.input, marginBottom: 6 }} placeholder="Endpoint path, e.g. /api/v1/applications" value={resources[key].path || ''} onChange={e => updateResource(key, { path: e.target.value })} />
                    <input style={{ ...S.input, marginBottom: 6 }} placeholder="ID field (default: id)" value={resources[key].idField || ''} onChange={e => updateResource(key, { idField: e.target.value })} />
                    <input style={{ ...S.input, marginBottom: 6 }} placeholder="Response envelope field (optional, e.g. items)" value={resources[key].listField || ''} onChange={e => updateResource(key, { listField: e.target.value })} />
                    <input style={{ ...S.input, marginBottom: 6 }} placeholder="Display label (optional)" value={resources[key].label || ''} onChange={e => updateResource(key, { label: e.target.value })} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <input style={{ ...S.input, marginBottom: 0, flex: 1 }} placeholder="New object type key, e.g. APPLICATION" value={newResourceKey} onChange={e => setNewResourceKey(e.target.value)} />
                <button style={S.btn()} onClick={addResource}>+ Add Resource</button>
              </div>
            </div>
          )}
          <button style={{ ...S.btn('primary'), marginTop: 12 }} onClick={() => save(config)} disabled={saving}>{saving ? 'Saving…' : '💾 Save Config'}</button>
        </div>
      )}
    </div>
  )
}

function TeamsSubscriptionButton({ connectorId }: { connectorId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  const setup = async () => {
    setStatus('loading')
    try {
      const token = localStorage.getItem('ea_token')
      const res = await fetch(`${API}/copilot/meetings/${connectorId}/setup-teams-subscription`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Setup failed')
      setStatus('done')
      setMessage(`Subscription active, expires ${new Date(data.expirationDateTime).toLocaleString()}`)
    } catch (e: any) {
      setStatus('error')
      setMessage(e.message)
    }
  }

  return (
    <div>
      <button style={{ ...S.btn('primary'), fontSize: 12 }} onClick={setup} disabled={status === 'loading'}>
        {status === 'loading' ? '⏳ Setting up…' : '🔗 Setup Subscription'}
      </button>
      {message && <div style={{ fontSize: 11, marginTop: 6, color: status === 'error' ? '#e74c3c' : '#2ecc71' }}>{message}</div>}
    </div>
  )
}

function ArchiMatePanel({ api }: { api: any }) {
  const [connectors, setConnectors] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('/connectors').then((d: any) => {
      const arch = (Array.isArray(d) ? d : []).filter((c: any) => c.connectorType === 'ARCHIMATE')
      setConnectors(arch)
      if (arch.length === 1) setSelectedId(arch[0].id)
    })
  }, [])

  const createDefaultConnector = async () => {
    const c = await api.post('/connectors', { name: 'ArchiMate Exchange', connectorType: 'ARCHIMATE', direction: 'BIDIRECTIONAL', config: {} })
    if (c?.id) { setConnectors([c]); setSelectedId(c.id) }
  }

  const doImport = async (file: File) => {
    if (!selectedId) return
    setImporting(true); setResult(null)
    const fd = new FormData(); fd.append('file', file)
    const res = await fetch(`${API}/connectors/${selectedId}/import/archimate`, {
      method: 'POST', headers: { Authorization: `Bearer ${api.tok}` }, body: fd,
    })
    const data = await res.json()
    setResult({ type: 'import', ...data })
    setImporting(false)
  }

  const doExport = async () => {
    if (!selectedId) return
    setExporting(true)
    const res = await fetch(`${API}/connectors/${selectedId}/export/archimate`, { headers: { Authorization: `Bearer ${api.tok}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `ea-repository-${new Date().toISOString().slice(0, 10)}.xml`
    document.body.appendChild(a); a.click()
    setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 1500)
    setExporting(false)
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>📐 ArchiMate 3.1 Exchange</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Import and export EA data using the open ArchiMate 3.1 Exchange Format — compatible with Sparx EA, Archi, BizzDesign, and any ArchiMate-compliant tool</div>

      {connectors.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>No ArchiMate connector configured yet</div>
          <button style={S.btn('primary')} onClick={createDefaultConnector}>Create ArchiMate Connector</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Import */}
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>⬇ Import ArchiMate XML</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              Import an ArchiMate Exchange Format XML file. Supported element types are automatically mapped to ArchMind EA assets. Conflicts are flagged for review.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
              Supported tools: Archi, Sparx EA, BizzDesign, MEGA HOPEX, any ArchiMate 3.x tool
            </div>
            <input ref={fileInputRef} type="file" accept=".xml,.archimate" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) doImport(e.target.files[0]) }} />
            <button style={S.btn('primary')} onClick={() => fileInputRef.current?.click()} disabled={importing}>{importing ? '⏳ Importing...' : '📁 Choose XML File'}</button>
          </div>

          {/* Export */}
          <div style={S.card}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>⬆ Export to ArchiMate XML</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
              Export your EA Repository (capabilities, applications, data entities, technology components) as an ArchiMate 3.1 XML file. Import this into any ArchiMate-compatible tool.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
              Exports approved and under-review assets from all domains
            </div>
            <button style={S.btn()} onClick={doExport} disabled={exporting}>{exporting ? '⏳ Exporting...' : '⬆ Download XML'}</button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ ...S.card, marginTop: 16, borderColor: result.type === 'import' ? 'var(--accent)' : '#2ecc71' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            {result.type === 'import' ? '✅ Import Complete' : '✅ Export Complete'}
          </div>
          {result.type === 'import' && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
              {[
                { l: 'Imported', v: result.imported || 0, c: '#2ecc71' },
                { l: 'Skipped', v: result.skipped || 0, c: '#7f8c8d' },
                { l: 'Conflicts', v: result.conflicts || 0, c: '#f39c12' },
              ].map(s => (
                <div key={s.l} style={{ padding: '8px 16px', borderRadius: 8, background: s.c + '11', border: `1px solid ${s.c}33` }}>
                  <div style={{ fontSize: 11, color: s.c, fontWeight: 600 }}>{s.l}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</div>
                </div>
              ))}
            </div>
          )}
          {result.warnings?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {result.warnings.map((w: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#f39c12', marginBottom: 4 }}>⚠ {w}</div>
              ))}
            </div>
          )}
          {result.unmappedTypes?.length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>Unmapped ArchiMate types (skipped): {result.unmappedTypes.join(', ')}</div>
          )}
        </div>
      )}

      {/* Type mapping reference */}
      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Type Mapping Reference</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, fontSize: 11 }}>
          {[
            ['BusinessCapability', '→', 'CAPABILITY'],
            ['ApplicationComponent', '→', 'APPLICATION'],
            ['DataObject', '→', 'DATA_ENTITY'],
            ['TechnologyComponent', '→', 'TECH_COMPONENT'],
            ['BusinessProcess', '→', 'BUSINESS_PROCESS'],
            ['Node / Device', '→', 'INFRASTRUCTURE'],
            ['ApplicationInterface', '→', 'INTEGRATION'],
            ['Principle', '→', 'EA_PRINCIPLE'],
            ['Goal', '→', 'STRATEGIC_OBJECTIVE'],
            ['WorkPackage', '→', 'PROJECT'],
            ['BusinessActor', '→', 'ORG_UNIT'],
            ['Stakeholder', '→', 'STAKEHOLDER'],
          ].map(([src, arr, tgt]) => (
            <div key={src} style={{ display: 'flex', gap: 6, padding: '4px 8px', background: 'var(--navy)', borderRadius: 4 }}>
              <span style={{ color: '#9b59b6', flex: 1 }}>{src}</span>
              <span style={{ color: 'var(--text-dim)' }}>{arr}</span>
              <span style={{ color: 'var(--accent)', flex: 1, textAlign: 'right' }}>{tgt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Conflicts Panel ───────────────────────────────────────────────────────────
function ConflictsPanel({ api }: { api: any }) {
  const [conflicts, setConflicts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    // Get pending conflicts across all jobs
    api.get('/connectors').then(async (connectors: any[]) => {
      const all: any[] = []
      for (const c of (Array.isArray(connectors) ? connectors : [])) {
        const jobs = await api.get(`/connectors/${c.id}/jobs`)
        for (const j of (Array.isArray(jobs) ? jobs.slice(0, 5) : [])) {
          if (j._count?.conflicts > 0) {
            const detail = await api.get(`/connectors/jobs/${j.id}`)
            all.push(...(detail?.conflicts || []).map((cf: any) => ({ ...cf, connectorName: c.name, jobId: j.id })))
          }
        }
      }
      setConflicts(all); setLoading(false)
    })
  }, [api])

  useEffect(() => { load() }, [load])

  const resolve = async (conflictId: string, resolution: string) => {
    await api.post(`/connectors/conflicts/${conflictId}/resolve`, { resolution })
    load()
  }

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>⚠️ Sync Conflicts</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Review and resolve conflicts between ArchMind data and external tool data</div>

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading conflicts...</div>
        : conflicts.length === 0 ? (
          <div style={{ ...S.card, textAlign: 'center', color: '#2ecc71', padding: 40, fontSize: 15 }}>✅ No pending conflicts</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {conflicts.map(cf => (
              <div key={cf.id} style={{ ...S.card, borderColor: '#f39c1244' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{ fontSize: 18 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{cf.externalName || 'Unnamed'} <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>[{cf.objectType}]</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{cf.connectorName} · Conflicting fields: {cf.conflictFields?.join(', ')}</div>
                  </div>
                </div>
                <div style={S.grid2}>
                  <div style={{ padding: '10px 12px', background: 'rgba(0,180,216,0.08)', borderRadius: 8, border: '1px solid rgba(0,180,216,0.3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>ArchMind Version</div>
                    <div style={{ fontSize: 12 }}>{JSON.stringify(cf.archimindData, null, 2).slice(0, 200)}</div>
                  </div>
                  <div style={{ padding: '10px 12px', background: 'rgba(243,156,18,0.08)', borderRadius: 8, border: '1px solid rgba(243,156,18,0.3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#f39c12', marginBottom: 6 }}>External Version</div>
                    <div style={{ fontSize: 12 }}>{JSON.stringify(cf.externalData, null, 2).slice(0, 200)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button style={S.btn()} onClick={() => resolve(cf.id, 'USE_ARCHIMIND')}>✅ Keep ArchMind</button>
                  <button style={S.btn()} onClick={() => resolve(cf.id, 'USE_EXTERNAL')}>🔄 Use External</button>
                  <button style={{ ...S.btn('danger') }} onClick={() => resolve(cf.id, 'SKIP')}>⏭ Skip</button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
// ── Population Strategy Tab (Data Sync Studio) ──────────────────────────────
const POPULATION_MODES = [
  { code: 'MANUAL', label: 'Manual', desc: 'Created and edited by hand only — never touched by a sync' },
  { code: 'IMPORT', label: 'Import', desc: 'Populated from one-time/periodic imports (e.g. file upload), fully overwritten each time' },
  { code: 'SYNC', label: 'Sync', desc: 'Kept in sync with a connector — every field overwritten from the source' },
  { code: 'PUSH', label: 'Push', desc: 'ArchMind is the source of truth — data flows out to the connector, not in' },
  { code: 'HYBRID', label: 'Hybrid', desc: 'Some fields synced from a source, others protected as manually-owned' },
]

function PopulationStrategyTab({ api }: { api: any }) {
  const [strategies, setStrategies] = useState<any[]>([])
  const [objectTypes, setObjectTypes] = useState<any[]>([])
  const [connectors, setConnectors] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [editingAttributes, setEditingAttributes] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get('/connectors/population-strategy').then((d: any) => setStrategies(Array.isArray(d) ? d : []))
    api.get('/meta-model/object-types').then((d: any) => setObjectTypes(Array.isArray(d) ? d : []))
    api.get('/connectors').then((d: any) => setConnectors(Array.isArray(d) ? d : []))
  }, [api])
  useEffect(() => { load() }, [load])

  const startEdit = (objType: any) => {
    const existing = strategies.find(s => s.objectTypeCode === objType.code)
    setEditing(existing ? { ...existing, fieldOwnership: { ...(existing.fieldOwnership || {}) } } : { objectTypeCode: objType.code, populationMode: 'MANUAL', sourceConnectorId: '', fieldOwnership: {}, deletionPolicy: 'MARK_MISSING' })
    setEditingAttributes([])
    // The object-types LIST endpoint only returns an attribute count, not
    // the actual attributes — fetch them via the dedicated endpoint.
    api.get(`/meta-model/object-types/${objType.id}/attributes`).then((d: any) => setEditingAttributes(Array.isArray(d) ? d : []))
  }

  const save = async () => {
    if (['SYNC', 'HYBRID'].includes(editing.populationMode) && !editing.sourceConnectorId) return alert('Select a source connector for SYNC/HYBRID mode')
    setSaving(true)
    const result = await api.put('/connectors/population-strategy', editing)
    setSaving(false)
    if (result?.id || result?.objectTypeCode) { setEditing(null); load() } else { alert(result?.message || 'Save failed') }
  }

  const remove = async (objectTypeCode: string) => {
    if (!window.confirm(`Reset "${objectTypeCode}" to the default (MANUAL) strategy?`)) return
    await api.del(`/connectors/population-strategy/${objectTypeCode}`)
    load()
  }

  const setFieldOwner = (field: string, owner: string) => setEditing((e: any) => ({ ...e, fieldOwnership: { ...e.fieldOwnership, [field]: owner } }))

  if (editing) {
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ ...S.row, marginBottom: 16 }}>
          <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={() => setEditing(null)}>← Back</button>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{editing.objectTypeCode}</div>
        </div>
        <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={S.label}>Population Mode</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
              {POPULATION_MODES.map(m => (
                <label key={m.code} style={{ display: 'flex', gap: 10, padding: 10, borderRadius: 8, background: editing.populationMode === m.code ? 'rgba(0,180,216,0.08)' : 'var(--navy)', border: `1px solid ${editing.populationMode === m.code ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer' }}>
                  <input type="radio" checked={editing.populationMode === m.code} onChange={() => setEditing((e: any) => ({ ...e, populationMode: m.code }))} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {['SYNC', 'HYBRID'].includes(editing.populationMode) && (
            <div>
              <label style={S.label}>Source Connector (source of truth)</label>
              <select style={S.input} value={editing.sourceConnectorId || ''} onChange={e => setEditing((v: any) => ({ ...v, sourceConnectorId: e.target.value }))}>
                <option value="">Select…</option>
                {connectors.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {editing.populationMode === 'HYBRID' && (
            <div>
              <label style={S.label}>Field Ownership</label>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Fields not listed here default to Manual — never auto-overwritten by a sync.</div>
              {editingAttributes.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No attributes found for this object type in Meta-Model Studio.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {editingAttributes.map((attr: any) => (
                    <div key={attr.code} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <div style={{ flex: 1 }}>{attr.name}</div>
                      <select style={{ ...S.input, width: 140 }} value={editing.fieldOwnership[attr.code] || 'MANUAL'} onChange={e => setFieldOwner(attr.code, e.target.value)}>
                        <option value="MANUAL">Manual</option>
                        <option value="SOURCE">Source</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label style={S.label}>Deletion Policy (when a record disappears from the source)</label>
            <select style={S.input} value={editing.deletionPolicy || 'MARK_MISSING'} onChange={e => setEditing((v: any) => ({ ...v, deletionPolicy: e.target.value }))}>
              <option value="MARK_MISSING">Mark as Deprecated (recommended)</option>
              <option value="IGNORE">Ignore — leave as-is</option>
              <option value="HARD_DELETE">Hard Delete</option>
            </select>
          </div>

          <div style={S.row}>
            <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? 'Saving…' : '💾 Save Strategy'}</button>
            <button style={S.btn()} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
        <span>Configure how each EA object type gets populated tenant-wide — manually curated, synced from a connector, or a hybrid of both with per-field ownership.</span>
        <HelpTip text="For each kind of item in your repository (like Applications or Capabilities), you choose: should people type this in themselves, should it come in automatically from a connected system, or a mix of both?" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {objectTypes.map((t: any) => {
          const strategy = strategies.find(s => s.objectTypeCode === t.code)
          const mode = strategy?.populationMode || 'MANUAL'
          const modeInfo = POPULATION_MODES.find(m => m.code === mode)
          return (
            <div key={t.code} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t.code}</div>
              </div>
              <span style={S.badge(mode === 'MANUAL' ? '#7f8c8d' : mode === 'SYNC' ? '#2ecc71' : mode === 'HYBRID' ? '#f39c12' : mode === 'PUSH' ? '#8e44ad' : '#3498db')}>{modeInfo?.label || mode}</span>
              <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => startEdit(t)}>{strategy ? 'Edit' : 'Configure'}</button>
              {strategy && <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => remove(t.code)}>Reset</button>}
            </div>
          )
        })}
        {objectTypes.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No object types found — configure your meta-model first in Meta-Model Studio.</div>}
      </div>
    </div>
  )
}

export default function ConnectorHubPage() {
  const api = useApi()
  const [tab, setTab] = useState('dashboard')
  const [stats, setStats] = useState<any>(null)
  const [selectedConnector, setSelectedConnector] = useState<any>(null)

  const loadStats = useCallback(() => { api.get('/connectors/stats').then(setStats) }, [])
  useEffect(() => { loadStats() }, [loadStats])

  const TABS = [
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'connectors', label: '🔌 Connectors' },
    { id: 'strategy', label: '⚙️ Population Strategy' },
    { id: 'archimate', label: '📐 ArchiMate' },
    { id: 'conflicts', label: '⚠️ Conflicts' },
    { id: 'new', label: '+ Add' },
  ]

  const openConnector = (c: any) => { setSelectedConnector(c); setTab('detail') }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🔌 Connector Hub</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Connect ArchMind to LeanIX, Ardoq, Sparx EA, ArchiMate and more</div>
        </div>
      </div>

      {tab !== 'detail' && (
        <div style={S.tabs}>
          {TABS.map(t => <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>)}
        </div>
      )}
      {tab !== 'detail' && (() => {
        const TAB_HELP: Record<string, string> = {
          dashboard: "An overview of every external system connected to ArchMind, and how much data has come in from each.",
          connectors: "The systems ArchMind is connected to (like LeanIX, Ardoq, or ServiceNow) so it can pull in your existing architecture data instead of you re-entering it by hand.",
          strategy: "For each type of item (applications, capabilities, etc.), decide whether it should be entered by hand, pulled in automatically from a connected system, or a mix of both.",
          archimate: "Upload an ArchiMate file (a standard architecture-modeling format) to bring its contents into your repository.",
          conflicts: "When incoming data from a connected system doesn't clearly match anything already in your repository, it shows up here so a person can decide what to do with it.",
          new: "Connect ArchMind to a new external system.",
        }
        return TAB_HELP[tab] ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 20px 0', display: 'flex', alignItems: 'center' }}>
            <HelpTip text={TAB_HELP[tab]} />
          </div>
        ) : null
      })()}

      <div style={S.content}>
        {tab === 'dashboard' && <ConnectorDashboard api={api} stats={stats} onTab={setTab} onOpen={openConnector} />}
        {tab === 'connectors' && <ConnectorsList api={api} onOpen={openConnector} />}
        {tab === 'strategy' && <PopulationStrategyTab api={api} />}
        {tab === 'archimate' && <ArchiMatePanel api={api} />}
        {tab === 'conflicts' && <ConflictsPanel api={api} />}
        {tab === 'new' && <NewConnector api={api} onCreated={c => { openConnector(c); loadStats() }} onCancel={() => setTab('dashboard')} />}
        {tab === 'detail' && selectedConnector && <ConnectorDetail api={api} connector={selectedConnector} onBack={() => setTab('connectors')} onRefresh={loadStats} />}
      </div>
    </div>
  )
}

// ── Connectors List ───────────────────────────────────────────────────────────
function ConnectorsList({ api, onOpen }: { api: any, onOpen: (c: any) => void }) {
  const [connectors, setConnectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/connectors').then((d: any) => { setConnectors(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>All Connectors</div>
      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div>
        : connectors.length === 0 ? <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No connectors yet</div>
        : connectors.map(c => {
          const ct = CONNECTOR_TYPES.find(t => t.code === c.connectorType)
          return (
            <div key={c.id} onClick={() => onOpen(c)} style={{ ...S.card, padding: '14px 18px', marginBottom: 8, cursor: 'pointer', display: 'flex', gap: 14, alignItems: 'center', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: (ct?.color || '#7f8c8d') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{ct?.icon || '🔌'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{ct?.name} · {DIRECTION_LABEL[c.direction]} · {c._count?.syncJobs || 0} sync jobs</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={S.badge(STATUS_COLOR[c.status] || '#7f8c8d')}>{c.status}</span>
                {c.lastSyncAt && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Last: {new Date(c.lastSyncAt).toLocaleDateString()}</span>}
                <span style={{ color: 'var(--accent)', fontSize: 16 }}>›</span>
              </div>
            </div>
          )
        })}
    </div>
  )
}
