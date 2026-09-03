import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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

// Demo/display heuristic, not a true foreign-key trace: EaAsset has no
// direct connectorId field (only source/sourceRef - the real link to a
// specific sync run lives in SyncStagingRecord.matchedAssetId, which
// would need a dedicated lookup this component doesn't have). For a
// source:'INTEGRATION' asset, this infers which connector it likely came
// from by the sourceRef's own prefix pattern (set by whichever script/
// sync populated it - e.g. link-hrdf-connectors-to-real-data.js uses
// 'OPM-' for ManageEngine and 'AXON-' for Informatica Axon). Good enough
// to show a real, human-readable connector name in a demo; not a
// substitute for a genuine traceability feature if that's ever needed
// beyond display purposes.
function getSourceLabel(asset: any): { label: string; detail?: string } {
  if (asset.source === 'INTEGRATION') {
    if (typeof asset.sourceRef === 'string') {
      if (asset.sourceRef.startsWith('OPM-')) return { label: 'ManageEngine OpManager', detail: asset.sourceRef }
      if (asset.sourceRef.startsWith('AXON-')) return { label: 'Informatica Axon', detail: asset.sourceRef }
    }
    return { label: 'Integration', detail: asset.sourceRef }
  }
  if (asset.source === 'ADM_OUTPUT') return { label: 'ADM Output', detail: asset.sourceRef ? `Cycle ${asset.sourceRef.slice(0, 8)}` : undefined }
  if (asset.source === 'UPLOAD') return { label: 'Upload' }
  return { label: 'Manual' }
}

// Object-type-specific attributes a connector field mapping might target
// (confirmed against this tenant's real meta-model attribute definitions -
// ITServer's cpu/memory/storage/operatingSystem/networkZone/ipAddress,
// ConceptualDataEntity's dataFormat/dataCategory/canStoreOutsideKSA - see
// scripts/link-hrdf-connectors-to-real-data.js). Anything else present in
// metadata (e.g. leftover fields from a manual JSON edit) is intentionally
// not shown here - this section is specifically "what a connector synced
// onto this asset," not a raw metadata dump.
const SYNCED_ATTRIBUTE_LABELS: Record<string, string> = {
  ipAddress: 'IP Address', cpu: 'CPU (cores)', memory: 'Memory (GB)', storage: 'Storage (GB)',
  operatingSystem: 'Operating System', networkZone: 'Network Zone',
  dataFormat: 'Data Format', dataCategory: 'Data Category', canStoreOutsideKSA: 'Can Store Outside KSA',
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
            <div className="form-group"><label className="form-label" htmlFor="asset-name">Name (English) *</label><input id="asset-name" className="form-input" value={form.name} onChange={set('name')} required /></div>
            <div className="form-group"><label className="form-label" htmlFor="asset-name-ar">Name (Arabic)</label><input id="asset-name-ar" className="form-input" value={form.nameAr || ''} onChange={set('nameAr')} dir="rtl" /></div>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="asset-description">Description</label><textarea id="asset-description" className="form-input" value={form.description || ''} onChange={set('description')} rows={2} /></div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-domain">Domain *</label>
              <select id="asset-domain" className="form-input" value={form.domain} onChange={e => setForm((f: any) => ({ ...f, domain: e.target.value, assetType: '' }))} required>
                <option value="">Select domain...</option>
                {domains.map((d: string) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-type">Asset Type *</label>
              <select id="asset-type" className="form-input" value={form.assetType} onChange={set('assetType')} required disabled={!form.domain}>
                <option value="">Select type...</option>
                {assetTypes.map((t: string) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-status">Status</label>
              <select id="asset-status" className="form-input" value={form.status} onChange={set('status')}>
                {['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label" htmlFor="asset-owner">Owner</label><input id="asset-owner" className="form-input" value={form.owner || ''} onChange={set('owner')} /></div>
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
  const navigate = useNavigate()
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
            <span className={`badge ${SOURCE_COLORS[asset.source] || 'badge-draft'}`} title={getSourceLabel(asset).detail}>{getSourceLabel(asset).label}</span>
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
              <span key={tag} style={{ padding: '2px 8px', background: 'rgba(3,105,161,0.1)', border: '1px solid rgba(3,105,161,0.2)', borderRadius: 2, fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{tag}</span>
            ))}
          </div>
        )}

        {asset.source === 'INTEGRATION' && (() => {
          const synced = Object.entries(SYNCED_ATTRIBUTE_LABELS)
            .filter(([key]) => asset.metadata && asset.metadata[key] !== undefined && asset.metadata[key] !== null && asset.metadata[key] !== '')
          if (synced.length === 0) return null
          const sourceInfo = getSourceLabel(asset)
          return (
            <div style={{ marginBottom: 16, padding: 12, background: 'rgba(3,105,161,0.05)', border: '1px solid rgba(3,105,161,0.15)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                🔗 SYNCED FROM {sourceInfo.label.toUpperCase()}{sourceInfo.detail ? ` (${sourceInfo.detail})` : ''}
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                {synced.map(([key, label]) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{label}</div>
                    <div style={{ fontSize: 13 }}>{String(asset.metadata[key])}</div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

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
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 2, fontFamily: 'var(--font-mono)', background: a.inKnowledgeBase ? 'rgba(22,163,74,0.15)' : 'rgba(100,116,139,0.1)', color: a.inKnowledgeBase ? 'var(--success)' : 'var(--text-dim)', border: `1px solid ${a.inKnowledgeBase ? 'rgba(22,163,74,0.3)' : 'var(--border)'}` }}>
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
                <button onClick={() => deleteAttachment(a.id)} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius)', color: 'var(--danger)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
              </div>
            </div>
          </div>
        ))}

        <div className="flex gap-2 mt-4">
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Close</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/ea-views?objectContext=${asset.id}`)} title="Explore this object's relationships and dependencies in EA Views">🕸 Show Dependencies</button>
          <button className="btn btn-danger btn-sm" onClick={() => { onDelete(asset.id); onClose() }}>Delete Asset</button>
        </div>
      </div>
    </div>
  )
}

export default function RepositoryPage() {
  const { t } = useLang()
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()
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
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // EA Repository Production Readiness, item 2: server-side pagination -
  // 50/page is a reasonable default for a fast initial load without
  // building sophisticated page-size UX beyond what's needed.
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [total, setTotal] = useState(0)

  // Debounces the search box specifically - a keystroke updates `search`
  // (the input's own responsive value) immediately, but the actual API
  // call (driven by debouncedSearch below) waits 300ms after typing
  // stops, avoiding one request per character on a server-side search.
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = async () => {
    const [cfg, sum] = await Promise.all([
      api.get('/ea-repository/framework-config'),
      api.get('/ea-repository/summary'),
    ])
    setConfig(cfg)
    setSummary(sum)
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (selectedDomain !== 'ALL') params.set('domain', selectedDomain)
    if (selectedStatus !== 'ALL') params.set('status', selectedStatus)
    if (selectedSource !== 'ALL') params.set('source', selectedSource)
    if (selectedAssetType !== 'ALL') params.set('assetType', selectedAssetType)
    if (debouncedSearch) params.set('search', debouncedSearch)
    const result = await api.get(`/ea-repository/assets?${params.toString()}`)
    // Backward-compatible with the pre-pagination shape (a plain array) in
    // case of a stale cached response during a rolling deploy - treats it
    // as a single, already-complete page rather than crashing.
    if (Array.isArray(result)) { setAssets(result); setTotal(result.length) }
    else { setAssets(result.items || []); setTotal(result.total || 0) }
  }

  useEffect(() => { load() }, [page, selectedDomain, selectedStatus, selectedSource, selectedAssetType, debouncedSearch]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resets to page 1 whenever a filter actually changes - a filter
  // change while sitting on page 5 of the old result set should not
  // silently show an empty/wrong page of the new, filtered set.
  const changeFilter = (setter: (v: string) => void) => (value: string) => { setter(value); setPage(1) }

  // Deep-link support (Copilot Phase 1's evidence drawer links here as
  // ?assetId=<id>) - fetches the asset directly by id rather than relying
  // on it being present in the currently-loaded/filtered `assets` list,
  // so the link works regardless of filters or pagination. Clears the
  // query param once handled so it doesn't re-trigger on an unrelated
  // re-render or linger in the URL after the modal is closed.
  useEffect(() => {
    const assetId = searchParams.get('assetId')
    if (!assetId) return
    api.get(`/ea-repository/assets/${assetId}`)
      .then((fresh: any) => { if (fresh) setSelectedAsset(fresh) })
      .catch(() => {}) // asset may have been deleted, or id is stale/invalid - fail silently, no modal opens
      .finally(() => {
        searchParams.delete('assetId')
        setSearchParams(searchParams, { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Filtering/search is now server-side (item 2) - `assets` is already
  // the current, filtered page of results, not the whole repository.
  // `filtered` name kept for the smallest possible diff to the render
  // logic below (groupByCycle, the table, the empty state).
  const filtered = assets

  const domains = config?.enabledDomains || []
  // EA Repository Production Readiness, item 2: object-type filter
  // values come from the tenant Meta Model (config.allDomains, already
  // Meta-Model-driven since Decision 3), not a hardcoded frontend list
  // or a list derived from whatever happens to be on the current page.
  // Scoped to the selected domain when one is chosen, otherwise every
  // type across every domain.
  const repoAssetTypes: string[] = selectedDomain !== 'ALL'
    ? (config?.allDomains?.[selectedDomain] || [])
    : Array.from(new Set(Object.values(config?.allDomains || {}).flat() as string[])).sort()

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
          <select className="form-input" style={{ width: 140 }} value={selectedSource} onChange={e => changeFilter(setSelectedSource)(e.target.value)}>
            <option value="ALL">All Sources</option>
            <option value="ADM_OUTPUT">ADM Output</option>
            <option value="MANUAL">Manual</option>
            <option value="UPLOAD">Upload</option>
          </select>
          <select className="form-input" style={{ width: 140 }} value={selectedAssetType} onChange={e => changeFilter(setSelectedAssetType)(e.target.value)}>
            <option value="ALL">All Types</option>
            {repoAssetTypes.map((t:any) => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={groupByCycle} onChange={e => setGroupByCycle(e.target.checked)} />
            Group by Cycle
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {total > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}` : '0 of 0'}
          </div>
          <select className="form-input" style={{ width: 140 }} value={selectedDomain} onChange={e => { changeFilter(setSelectedDomain)(e.target.value); setSelectedAssetType('ALL') }}>
            <option value="ALL">All Domains</option>
            {domains.map((d: string) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="form-input" style={{ width: 160 }} value={selectedStatus} onChange={e => changeFilter(setSelectedStatus)(e.target.value)}>
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
                <div style={{ overflowX: 'auto' }}>
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
                      <td style={{ fontSize: 11 }}>{a.canonicalDisplayLabel || (a.assetType||'').replace(/_/g,' ')}</td>
                      <td><span className={`badge ${STATUS_COLORS[a.status]||''}`}>{a.status}</span></td>
                      <td><button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={e => { e.stopPropagation(); deleteAsset(a.id) }}>🗑</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                </div>
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
          <div style={{ overflowX: 'auto' }}>
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
                  <td><span style={{ fontSize: 11, padding: '2px 8px', background: 'rgba(3,105,161,0.08)', borderRadius: 2, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>{a.domain}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{a.canonicalDisplayLabel || a.assetType?.replace(/_/g, ' ')}</td>
                  <td><span className={`badge ${STATUS_COLORS[a.status] || 'badge-draft'}`}>{a.status.replace(/_/g, ' ')}</span></td>
                  <td><span className={`badge ${SOURCE_COLORS[a.source] || 'badge-draft'}`} title={getSourceLabel(a).detail}>{getSourceLabel(a).label}</span></td>
                  <td style={{ fontSize: 12 }}>{a.owner || '—'}</td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{a._count?.attachments || 0}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditAsset(a)}>✏</button>
                      <button onClick={() => deleteAsset(a.id)} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius)', color: 'var(--danger)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* EA Repository Production Readiness, item 2: server-side
            pagination controls - only shown for the normal (non-grouped)
            view, since groupByCycle is a niche secondary display already
            operating on the current page's results. */}
        {!groupByCycle && total > pageSize && (
          <div className="flex items-center justify-center gap-2 mt-4" style={{ fontSize: 12 }}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button className="btn btn-secondary btn-sm" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      {showAdd && <AssetModal config={config} onClose={() => setShowAdd(false)} onSave={createAsset} t={t} />}
      {editAsset && <AssetModal asset={editAsset} config={config} onClose={() => setEditAsset(null)} onSave={updateAsset} t={t} />}
      {selectedAsset && <AssetDetail asset={selectedAsset} onClose={() => setSelectedAsset(null)} onDelete={deleteAsset} api={api} t={t} />}
    </div>
  )
}
