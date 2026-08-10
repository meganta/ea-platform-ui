import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'

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
            <div key={ct.code} onClick={() => { setSelectedType(ct); setForm(f => ({ ...f, name: ct.name, direction: ct.fileOnly ? 'IMPORT' : 'BIDIRECTIONAL' })); setStep('configure') }}
              style={{ ...S.card, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = ct.color)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: ct.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{ct.icon}</div>
                <div>
                  <div style={{ fontWeight: 700 }}>{ct.name}</div>
                  {ct.fileOnly ? <span style={S.badge('#7f8c8d')}>File-based</span> : <span style={S.badge('#2ecc71')}>API Sync</span>}
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
  const [tab, setTab] = useState<'overview' | 'credentials' | 'mappings' | 'jobs'>('overview')
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
  }

  const credFields = CRED_FIELDS[connector.connectorType] || []

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
        {(['overview', 'credentials', 'mappings', 'jobs'] as const).map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'overview' ? '📋 Overview' : t === 'credentials' ? '🔐 Credentials' : t === 'mappings' ? '🗺 Mappings' : `📊 Sync Jobs (${jobs.length})`}
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
              {credFields.map(f => (
                <div key={f.key}>
                  <label style={S.label}>{f.label}</label>
                  <input style={S.input} type={f.type || 'text'} value={creds[f.key] || ''} onChange={e => setCreds((c: any) => ({ ...c, [f.key]: e.target.value }))} placeholder={f.type === 'password' ? '••••••••' : ''} />
                </div>
              ))}
              <button style={S.btn('primary')} onClick={saveCreds} disabled={saving}>{saving ? 'Saving...' : '🔐 Save Credentials'}</button>
            </div>
          )}
        </div>
      )}

      {tab === 'mappings' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>
            Define how object types in {ct?.name} map to ArchMind asset types. Default mappings are applied automatically.
          </div>
          <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
            <div style={{ fontSize: 20, marginBottom: 8 }}>🗺</div>
            <div>Default mappings are pre-configured for {ct?.name}.</div>
            <div style={{ marginTop: 8, fontSize: 12 }}>Custom field mapping UI coming in next sprint.</div>
          </div>
        </div>
      )}

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

// ── ArchiMate Quick Panel ─────────────────────────────────────────────────────
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

      <div style={S.content}>
        {tab === 'dashboard' && <ConnectorDashboard api={api} stats={stats} onTab={setTab} onOpen={openConnector} />}
        {tab === 'connectors' && <ConnectorsList api={api} onOpen={openConnector} />}
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
