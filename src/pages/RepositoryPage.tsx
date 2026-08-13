import { useEffect, useState, useRef } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'badge-draft',
  UNDER_REVIEW: 'badge-review',
  APPROVED: 'badge-approved',
  DEPRECATED: 'badge-draft',
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'badge-draft',
  ADM_OUTPUT: 'badge-progress',
  UPLOAD: 'badge-active',
  INTEGRATION: 'badge-ai-draft',
}

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
  const post = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  const put = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  const del = (path: string) => fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
  const upload = (path: string, file: File) => {
    const fd = new FormData(); fd.append('file', file)
    return fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd }).then(r => r.json())
  }
  return { get, post, put, del, upload }
}

function AssetModal({ asset, config, onClose, onSave, t }: any) {
  const [form, setForm] = useState(asset || { name: '', nameAr: '', description: '', domain: '', assetType: '', status: 'DRAFT', owner: '', tags: [] })
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }))
  const domains = config?.enabledDomains || []
  const assetTypes = config?.allDomains?.[form.domain] || []

  const submit = async (e: any) => {
    e.preventDefault(); setLoading(true)
    try { await onSave(form) } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">{asset ? 'Edit Asset' : 'New EA Asset'}</div>
        <form onSubmit={submit}>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group"><label className="form-label">Name (English) *</label><input className="form-input" value={form.name} onChange={set('name')} required /></div>
            <div className="form-group"><label className="form-label">Name (Arabic)</label><input className="form-input" value={form.nameAr || ''} onChange={set('nameAr')} dir="rtl" /></div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-input" value={form.description || ''} onChange={set('description')} rows={2} /></div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Domain *</label>
              <select className="form-input" value={form.domain} onChange={e => setForm((f: any) => ({ ...f, domain: e.target.value, assetType: '' }))} required>
                <option value="">Select domain...</option>
                {domains.map((d: string) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Asset Type *</label>
              <select className="form-input" value={form.assetType} onChange={set('assetType')} required disabled={!form.domain}>
                <option value="">Select type...</option>
                {assetTypes.map((t: string) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={set('status')}>
                {['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Owner</label><input className="form-input" value={form.owner || ''} onChange={set('owner')} /></div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Asset'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AssetDetail({ asset: initialAsset, onClose, onDelete, api, t }: any) {
  const [asset, setAsset] = useState(initialAsset)
  const [attachments, setAttachments] = useState(initialAsset.attachments || [])

  // Fetch fresh data on mount to get latest attachments
  useEffect(() => {
    api.get(`/ea-repository/assets/${initialAsset.id}`).then((fresh: any) => {
      setAsset(fresh)
      setAttachments(fresh.attachments || [])
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAsset.id])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (e: any) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const result = await api.upload(`/ea-repository/assets/${asset.id}/attachments`, file)
      setAttachments((a: any[]) => [...a, result])
    } finally { setUploading(false); e.target.value = '' }
  }

  const deleteAttachment = async (attachmentId: string) => {
    if (!window.confirm('Delete this attachment?')) return
    await api.del(`/ea-repository/assets/${asset.id}/attachments/${attachmentId}`)
    setAttachments((a: any[]) => a.filter((x: any) => x.id !== attachmentId))
  }

  const downloadAttachment = (attachmentId: string, name: string) => {
    const token = localStorage.getItem('ea_token')
    fetch(`${API_URL}/ea-repository/assets/${asset.id}/attachments/${attachmentId}/download`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 600, maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="modal-title" style={{ marginBottom: 4 }}>{asset.name}</div>
            {asset.nameAr && <div style={{ fontSize: 14, color: 'var(--text-dim)', direction: 'rtl' }}>{asset.nameAr}</div>}
          </div>
          <div className="flex gap-2">
            <span className={`badge ${STATUS_COLORS[asset.status] || 'badge-draft'}`}>{asset.status}</span>
            <span className={`badge ${SOURCE_COLORS[asset.source] || 'badge-draft'}`}>{asset.source}</span>
          </div>
        </div>

        <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>DOMAIN</div><div style={{ fontSize: 13 }}>{asset.domain}</div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>ASSET TYPE</div><div style={{ fontSize: 13 }}>{asset.assetType?.replace(/_/g, ' ')}</div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>OWNER</div><div style={{ fontSize: 13 }}>{asset.owner || '—'}</div></div>
          <div><div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>VERSION</div><div style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>{asset.version}</div></div>
        </div>

        {asset.description && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>DESCRIPTION</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{asset.description}</div>
          </div>
        )}

        {asset.tags?.length > 0 && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {asset.tags.map((tag: string) => (
              <span key={tag} style={{ padding: '2px 8px', background: 'rgba(0,180,216,0.1)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: 2, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{tag}</span>
            ))}
          </div>
        )}

        <div className="divider" />

        <div className="flex items-center justify-between mb-3">
          <div style={{ fontSize: 13, fontWeight: 600 }}>📎 Attachments ({attachments.length})</div>
          <button className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            ⬆ {uploading ? 'Uploading...' : 'Upload File'}
          </button>
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={uploadFile} />
        </div>

        {attachments.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', padding: '16px 0' }}>No attachments yet</div>
        ) : attachments.map((a: any) => (
          <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontSize: 13 }}>📄 {a.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                  {(a.sizeBytes / 1024).toFixed(1)} KB · {a.mimeType}
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, fontFamily: 'var(--font-mono)', background: a.inKnowledgeBase ? 'rgba(46,204,113,0.15)' : 'rgba(139,170,200,0.1)', color: a.inKnowledgeBase ? 'var(--success)' : 'var(--text-dim)', border: `1px solid ${a.inKnowledgeBase ? 'rgba(46,204,113,0.3)' : 'var(--border)'}` }}>
                  {a.inKnowledgeBase ? '📚 IN KB' : '📚 NOT IN KB'}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={async () => {
                    const token = localStorage.getItem('ea_token')
                    const res = await fetch(`${API_URL}/ea-repository/assets/${asset.id}/attachments/${a.id}/knowledge-base`, {
                      method: 'PUT',
                      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ include: !a.inKnowledgeBase })
                    })
                    if (res.ok) {
                      const updated = await res.json()
                      setAttachments((prev: any[]) => prev.map((x: any) => x.id === a.id ? { ...x, ...updated } : x))
                    }
                  }}
                >
                  {a.inKnowledgeBase ? '− Remove from KB' : '+ Add to KB'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => downloadAttachment(a.id, a.name)}>⬇</button>
                <button onClick={() => deleteAttachment(a.id)} style={{ background: 'none', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius)', color: 'var(--danger)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-4">
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Close</button>
          <button className="btn btn-danger btn-sm" onClick={() => { onDelete(asset.id); onClose() }}>Delete Asset</button>
        </div>
      </div>
    </div>
  )
}

export default function RepositoryPage() {
  const { t } = useLang()
  const api = useApi()
  const [config, setConfig] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [selectedSource, setSelectedSource] = useState<string>('ALL')
  const [selectedAssetType, setSelectedAssetType] = useState<string>('ALL')
  const [groupByCycle, setGroupByCycle] = useState<boolean>(false)
  const [showAdd, setShowAdd] = useState(false)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  const [editAsset, setEditAsset] = useState<any>(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    const [cfg, assetList, sum] = await Promise.all([
      api.get('/ea-repository/framework-config'),
      api.get('/ea-repository/assets'),
      api.get('/ea-repository/summary'),
    ])
    setConfig(cfg)
    setAssets(assetList)
    setSummary(sum)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createAsset = async (form: any) => {
    await api.post('/ea-repository/assets', form)
    setShowAdd(false)
    await load()
  }

  const updateAsset = async (form: any) => {
    await api.put(`/ea-repository/assets/${editAsset.id}`, form)
    setEditAsset(null)
    await load()
  }

  const deleteAsset = async (id: string) => {
    if (!window.confirm('Delete this asset?')) return
    await api.del(`/ea-repository/assets/${id}`)
    await load()
  }

  const filtered = assets.filter(a => {
    if (selectedDomain !== 'ALL' && a.domain !== selectedDomain) return false
    if (selectedStatus !== 'ALL' && a.status !== selectedStatus) return false
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.nameAr || '').includes(search)) return false
    return true
  })

  const domains = config?.enabledDomains || []
  const repoAssetTypes: string[] = Array.from(new Set(assets.map((a:any) => a.assetType).filter(Boolean))).sort()

  // Group by cycle
  const groupedAssets: Record<string, any[]> = {}
  if (groupByCycle) {
    filtered.forEach((a:any) => {
      const key = a.source === 'ADM_OUTPUT' && a.sourceRef
        ? `ADM Cycle: ${a.sourceRef.slice(0,8)}`
        : a.source === 'MANUAL' ? 'Manual Entries'
        : a.source === 'UPLOAD' ? 'Uploads'
        : 'Other'
      if (!groupedAssets[key]) groupedAssets[key] = []
      groupedAssets[key].push(a)
    })
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title" style={{ display: 'flex', alignItems: 'center' }}>{t('repo.title')}<HelpTip text="This is the master list of everything in your architecture - applications, business capabilities, data, technology, and how they connect. Other parts of the platform (like reviews and diagrams) pull from what's stored here." /></div>
            <div className="page-subtitle">
              {config?.frameworkType} FRAMEWORK · {summary?.total || 0} ASSETS
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Asset</button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary cards */}
        {summary && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ flex: 1, minWidth: 120 }}>
              <div className="stat-value">{summary.total}</div>
              <div className="stat-label">Total Assets</div>
            </div>
            {summary.byDomain?.map((d: any) => (
              <div key={d.domain} className="stat-card" style={{ flex: 1, minWidth: 120, cursor: 'pointer' }} onClick={() => setSelectedDomain(d.domain)}>
                <div className="stat-value" style={{ fontSize: 24 }}>{d.count}</div>
                <div className="stat-label">{d.domain.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search assets..." value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input" style={{ width: 140 }} value={selectedSource} onChange={e => setSelectedSource(e.target.value)}>
            <option value="ALL">All Sources</option>
            <option value="ADM_OUTPUT">ADM Output</option>
            <option value="MANUAL">Manual</option>
            <option value="UPLOAD">Upload</option>
          </select>
          <select className="form-input" style={{ width: 140 }} value={selectedAssetType} onChange={e => setSelectedAssetType(e.target.value)}>
            <option value="ALL">All Types</option>
            {repoAssetTypes.map((t:any) => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={groupByCycle} onChange={e => setGroupByCycle(e.target.checked)} />
            Group by Cycle
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {filtered.length}/{assets.length}
          </div>
          <select className="form-input" style={{ width: 140 }} value={selectedDomain} onChange={e => setSelectedDomain(e.target.value)}>
            <option value="ALL">All Domains</option>
            {domains.map((d: string) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="form-input" style={{ width: 160 }} value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
            <option value="ALL">All Statuses</option>
            {['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {/* Assets table */}
        {groupByCycle && Object.keys(groupedAssets).length > 0 ? (
          <div>
            {Object.entries(groupedAssets).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  📁 {group} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({items.length} assets)</span>
                </div>
                <table>
                  <thead><tr>
                    <th>{t('repo.col_name')}</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>{items.map((a:any) => (
                    <tr key={a.id} onClick={() => setSelectedAsset(a)} style={{ cursor: 'pointer' }}>
                      <td><div style={{ fontWeight: 500 }}>{a.name}</div>{a.nameAr && <div style={{ fontSize: 11, color: 'var(--text-dim)', direction: 'rtl' }}>{a.nameAr}</div>}</td>
                      <td style={{ fontSize: 11 }}>{(a.domain||'').replace(/_/g,' ')}</td>
                      <td style={{ fontSize: 11 }}>{(a.assetType||'').replace(/_/g,' ')}</td>
                      <td><span className={`badge ${STATUS_COLORS[a.status]||''}`}>{a.status}</span></td>
                      <td><button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={e => { e.stopPropagation(); deleteAsset(a.id) }}>🗑</button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 40 }}>🗄</div>
            <div className="empty-title">No assets found</div>
            <div className="empty-sub">Create your first EA asset or adjust the filters</div>
            <button className="btn btn-primary mt-4" onClick={() => setShowAdd(true)}>+ New Asset</button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Domain</th>
                <th>Type</th>
                <th>Status</th>
                <th>Source</th>
                <th>Owner</th>
                <th>Files</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedAsset(a)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{a.name}</div>
                    {a.nameAr && <div style={{ fontSize: 11, color: 'var(--text-dim)', direction: 'rtl' }}>{a.nameAr}</div>}
                  </td>
                  <td><span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(0,180,216,0.08)', borderRadius: 2, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{a.domain}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{a.assetType?.replace(/_/g, ' ')}</td>
                  <td><span className={`badge ${STATUS_COLORS[a.status] || 'badge-draft'}`}>{a.status.replace(/_/g, ' ')}</span></td>
                  <td><span className={`badge ${SOURCE_COLORS[a.source] || 'badge-draft'}`}>{a.source.replace(/_/g, ' ')}</span></td>
                  <td style={{ fontSize: 12 }}>{a.owner || '—'}</td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{a._count?.attachments || 0}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditAsset(a)}>✏</button>
                      <button onClick={() => deleteAsset(a.id)} style={{ background: 'none', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius)', color: 'var(--danger)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && <AssetModal config={config} onClose={() => setShowAdd(false)} onSave={createAsset} t={t} />}
      {editAsset && <AssetModal asset={editAsset} config={config} onClose={() => setEditAsset(null)} onSave={updateAsset} t={t} />}
      {selectedAsset && <AssetDetail asset={selectedAsset} onClose={() => setSelectedAsset(null)} onDelete={deleteAsset} api={api} t={t} />}
    </div>
  )
}
