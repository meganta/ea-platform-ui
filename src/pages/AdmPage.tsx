import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import ReactMarkdown from 'react-markdown'
import { DiagramViewer } from '../components/DiagramViewer'
function DiagramBlock({ chart }: { chart: string }) {
  // Parse mermaid-style text into a readable styled block
  return (
    <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '12px 16px', margin: '8px 0', overflowX: 'auto' }}>
      <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, letterSpacing: '0.08em' }}>📊 DIAGRAM</div>
      <pre style={{ margin: 0, fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{chart}</pre>
    </div>
  )
}

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
  const post = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json())
  const put = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
  const del = (path: string) => fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
  return { get, post, put, del }
}

const SOURCE_COLORS: Record<string, string> = {
  PREVIOUS_PHASE: 'rgba(0,180,216,0.15)',
  EXTERNAL: 'rgba(201,168,76,0.15)',
  GOVERNANCE: 'rgba(155,89,182,0.15)',
}
const SOURCE_BORDER: Record<string, string> = {
  PREVIOUS_PHASE: 'rgba(0,180,216,0.4)',
  EXTERNAL: 'rgba(201,168,76,0.4)',
  GOVERNANCE: 'rgba(155,89,182,0.4)',
}
const OUTPUT_STATUS_COLOR: Record<string, string> = {
  PENDING: '#8baac8',
  GENERATING: '#f39c12',
  AI_DRAFT: '#9b59b6',
  APPROVED: '#2ecc71',
  REJECTED: '#e74c3c',
}

// ── Create Cycle Modal ────────────────────────────────────
function CreateModal({ onClose, onCreate, t }: any) {
  const [form, setForm] = useState({ name: '', description: '', frameworkType: 'NORA' })
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))
  const submit = async (e: any) => { e.preventDefault(); setLoading(true); try { await onCreate(form) } finally { setLoading(false) } }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{t('adm.modal_title')}</div>
        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label">{t('adm.name')}</label><input className="form-input" value={form.name} onChange={set('name')} required /></div>
          <div className="form-group"><label className="form-label">{t('adm.description')}</label><input className="form-input" value={form.description} onChange={set('description')} /></div>
          <div className="form-group">
            <label className="form-label">{t('adm.framework')}</label>
            <select className="form-input" value={form.frameworkType} onChange={set('frameworkType')}>
              <option value="NORA">NORA 2.0 — المنهجية الوطنية</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? t('common.creating') : t('common.create')}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Scope Selector ────────────────────────────────────────
function ScopeSelector({ cycle, onScopeSet }: any) {
  const api = useApi()
  const DOMAINS: Record<string, string[]> = {
    TOGAF: ['BUSINESS', 'DATA', 'APPLICATION', 'TECHNOLOGY'],
    NORA: ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
  }
  const domains = DOMAINS[cycle.frameworkType] || DOMAINS.NORA
  const [selected, setSelected] = useState<string[]>(cycle.scopeDomains?.length ? cycle.scopeDomains : domains)
  const [saving, setSaving] = useState(false)

  const toggle = (d: string) => setSelected(s => s.includes(d) ? s.filter(x => x !== d) : [...s, d])

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/adm-intelligence/cycles/${cycle.id}/scope`, { scopeDomains: selected })
      onScopeSet(selected)
    } finally { setSaving(false) }
  }

  return (
    <div className="card mb-4" style={{ border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="section-title" style={{ color: 'var(--gold)', marginBottom: 2 }}>🎯 Architecture Scope</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Select domains in scope. Only relevant phases and deliverables will be shown.</div>
        </div>
        <button className="btn btn-primary btn-sm" disabled={saving} onClick={save}>{saving ? 'Saving...' : '✓ Save Scope'}</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {domains.map((d: string) => (
          <button key={d} onClick={() => toggle(d)} style={{ padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', border: `1px solid ${selected.includes(d) ? 'var(--accent)' : 'var(--border)'}`, background: selected.includes(d) ? 'rgba(0,180,216,0.15)' : 'transparent', color: selected.includes(d) ? 'var(--accent)' : 'var(--text-dim)', transition: 'all 0.15s' }}>
            {selected.includes(d) ? '✓ ' : ''}{d.replace(/_/g, ' ')}
          </button>
        ))}
        <button onClick={() => setSelected(domains)} style={{ padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-dim)' }}>All</button>
        <button onClick={() => setSelected([])} style={{ padding: '6px 10px', borderRadius: 'var(--radius)', fontSize: 10, cursor: 'pointer', border: '1px solid var(--border)', background: 'none', color: 'var(--text-dim)' }}>None</button>
      </div>
    </div>
  )
}



function extractDiagrams(text: string): Array<{type: 'text'|'diagram', content: string}> {
  const parts: Array<{type: 'text'|'diagram', content: string}> = []
  // Split on code fences
  const segments = text.split(/(```[\s\S]*?```)/g)
  for (const seg of segments) {
    if (!seg) continue
    if (seg.startsWith('```')) {
      // Extract language and content
      const firstNewline = seg.indexOf('\n')
      const lang = firstNewline > 0 ? seg.slice(3, firstNewline).trim().toLowerCase() : ''
      const body = firstNewline > 0 ? seg.slice(firstNewline + 1).replace(/```\s*$/, '').trim() : seg.slice(3).replace(/```\s*$/, '').trim()
      const isDiagram = lang === 'mermaid' || lang === 'flowchart' || lang === 'graph' ||
        body.match(/^(flowchart|graph|sequenceDiagram|classDiagram|quadrantChart|mindmap|gitGraph|timeline)/)
      if (isDiagram) {
        parts.push({ type: 'diagram', content: (lang && !body.startsWith(lang) ? lang + '\n' + body : body) })
      } else {
        parts.push({ type: 'text', content: seg })
      }
    } else {
      parts.push({ type: 'text', content: seg })
    }
  }
  return parts.length ? parts : [{ type: 'text', content: text }]
}


// Section Progress Component
function SectionProgress({ outputId }: { outputId: string }) {
  const [sections, setSections] = useState<any[]>([])
  const token = () => localStorage.getItem('ea_token')
  const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

  useEffect(() => {
    const load = () => {
      fetch(`${API_URL}/adm-intelligence/outputs/${outputId}/sections`, {
        headers: { Authorization: `Bearer ${token()}` }
      }).then(r => r.json()).then(data => {
        if (Array.isArray(data)) setSections(data)
      }).catch(() => {})
    }
    load()
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputId])

  if (sections.length === 0) return (
    <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-dim)' }}>
      <span className="spinner" style={{ marginRight: 6 }}>⟳</span> Generating outline...
    </div>
  )

  const statusIcon: Record<string, string> = {
    PENDING: '○', GENERATING: '⟳', COMPLETE: '✓', FAILED: '✗', INCOMPLETE: '⚠'
  }
  const statusColor: Record<string, string> = {
    PENDING: 'var(--text-dim)', GENERATING: 'var(--accent)', COMPLETE: 'var(--success)',
    FAILED: 'var(--danger)', INCOMPLETE: 'var(--gold)'
  }

  return (
    <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.1)', borderRadius: 4, marginTop: 4 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
        GENERATING SECTIONS ({sections.filter(s => s.status === 'COMPLETE').length}/{sections.length})
      </div>
      {sections.map((s: any) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontSize: 12, color: statusColor[s.status] || 'var(--text-dim)', fontFamily: 'var(--font-mono)', animation: s.status === 'GENERATING' ? 'spin 1s linear infinite' : 'none' }}>
            {statusIcon[s.status] || '○'}
          </span>
          <span style={{ fontSize: 11, color: s.status === 'COMPLETE' ? 'var(--text)' : 'var(--text-dim)' }}>
            {s.title}
          </span>
          {s.status === 'COMPLETE' && (
            <span style={{ fontSize: 9, color: s.tokenCount > 0 ? 'var(--text-dim)' : 'var(--gold)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
              {s.tokenCount > 0 ? `${s.tokenCount} tokens` : '⚠ empty'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}


// Diagram Generation Status
function DiagramStatus({ outputId, onDone, outputStatus }: { outputId: string, onDone: () => void, outputStatus: string }) {
  const [status, setStatus] = useState<{status: string, count: number}>({ status: 'pending', count: 0 })
  const [checked, setChecked] = useState(false)
  const token = () => localStorage.getItem('ea_token')
  const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

  useEffect(() => {
    let triggered = false
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/adm-intelligence/outputs/${outputId}/diagram-status`, {
          headers: { Authorization: `Bearer ${token()}` }
        })
        if (res.status === 401) {
          clearInterval(interval)
          setChecked(true)
          return
        }
        const data = await res.json()
        setStatus(data)
        setChecked(true)
        if (data.count > 0) {
          onDone()
        } else if (!triggered && outputStatus === 'AI_DRAFT') {
          triggered = true
          fetch(`${API_URL}/adm-intelligence/outputs/${outputId}/generate-diagrams`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token()}` }
          }).catch(() => {})
        }
      } catch(e) {}
    }
    load()
    const interval = setInterval(load, 4000)
    return () => clearInterval(interval)
  }, [outputId, outputStatus])  // eslint-disable-line

  if (!checked) return null
  if (status.count > 0) return (
    <div style={{ fontSize: 10, color: 'var(--accent)', padding: '4px 8px', fontFamily: 'var(--font-mono)' }}>
      ✅ {status.count} diagrams ready
    </div>
  )
  return (
    <div style={{ fontSize: 10, color: 'var(--accent)', padding: '4px 8px', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span>
      Generating architecture diagrams...
    </div>
  )
}

// ── Input Source Panel ────────────────────────────────────
function InputSourcePanel({ inp, cycleId, onUpdated, onEdit }: any) {
  const [showOptions, setShowOptions] = useState(false)
  const [kbQuery, setKbQuery] = useState('')
  const [kbSearching, setKbSearching] = useState(false)
  const [showRepoSearch, setShowRepoSearch] = useState(false)
  const [repoAssets, setRepoAssets] = useState<any[]>([])
  const [allRepoAssets, setAllRepoAssets] = useState<any[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [repoSourceFilter, setRepoSourceFilter] = useState('CYCLE')
  const [repoDomainFilter, setRepoDomainFilter] = useState('ALL')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [includeInKb, setIncludeInKb] = useState(false)
  const [includeInRepo, setIncludeInRepo] = useState(false)
  const [uploading, setUploading] = useState(false)
  const token = () => localStorage.getItem('ea_token')

  const pullFromKb = async () => {
    if (!kbQuery.trim()) return
    setKbSearching(true)
    try {
      const res = await fetch(`${API_URL}/adm-intelligence/inputs/${inp.id}/pull-from-kb`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: kbQuery })
      })
      const updated = await res.json()
      if (updated.id) { onUpdated(updated); setShowOptions(false) }
      else alert(updated.message || 'No content found')
    } finally { setKbSearching(false) }
  }

  const loadRepoAssets = async () => {
    setRepoLoading(true)
    try {
      const res = await fetch(`${API_URL}/ea-repository/assets`, { headers: { Authorization: `Bearer ${token()}` } })
      const all = await res.json()
      setAllRepoAssets(all)
      // Default: show only assets from this ADM cycle + manual assets
      setRepoAssets(all.filter((a: any) => a.sourceRef === cycleId || a.source === 'MANUAL'))
      setRepoSourceFilter('CYCLE')
    } finally { setRepoLoading(false) }
  }

  const pullFromRepo = async (assetId: string) => {
    try {
      const res = await fetch(`${API_URL}/adm-intelligence/inputs/${inp.id}/pull-from-repo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      })
      const updated = await res.json()
      if (updated.id) {
        onUpdated(updated)
        setShowOptions(false)
        setShowRepoSearch(false)
      } else {
        alert('Failed to pull from repository: ' + (updated.message || JSON.stringify(updated)))
      }
    } catch (e: any) {
      alert('Error pulling from repository: ' + e.message)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const text = await uploadFile.text()
      // Save as input content
      const res = await fetch(`${API_URL}/adm-intelligence/inputs/${inp.id}`, {
        method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, source: 'PROVIDED' })
      })
      const updated = await res.json()
      onUpdated(updated)

      // Optionally add to KB
      if (includeInKb) {
        const fd = new FormData(); fd.append('file', uploadFile); fd.append('type', 'REFERENCE_ARCHITECTURE')
        await fetch(`${API_URL}/knowledge/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd })
      }

      // Optionally add to Repo
      if (includeInRepo) {
        const fd = new FormData(); fd.append('file', uploadFile)
        // Create an asset and attach file — use cycle phase as domain
        const assetRes = await fetch(`${API_URL}/ea-repository/assets`, {
          method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: uploadFile.name.replace(/\.[^.]+$/, ''), domain: 'CROSS_CUTTING', assetType: 'CUSTOM', status: 'DRAFT', source: 'UPLOAD' })
        })
        const asset = await assetRes.json()
        if (asset.id) {
          await fetch(`${API_URL}/ea-repository/assets/${asset.id}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd })
        }
      }

      setShowOptions(false); setUploadFile(null)
    } finally { setUploading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={onEdit}>{inp.content ? '✏ Edit' : '+ Manual'}</button>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setShowOptions(s => !s)}>⬇ Pull From...</button>
      </div>

      {showOptions && (
        <div style={{ marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {/* KB Search */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--accent)' }}>📚 Pull from Knowledge Base</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" value={kbQuery} onChange={e => setKbQuery(e.target.value)} placeholder={`Search KB for "${inp.title}"`} style={{ flex: 1, fontSize: 11 }} onKeyDown={e => e.key === 'Enter' && pullFromKb()} />
              <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={kbSearching || !kbQuery} onClick={pullFromKb}>{kbSearching ? '...' : 'Search'}</button>
            </div>
          </div>

          <div className="divider" style={{ margin: '8px 0' }} />

          {/* Repo Search */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)' }}>🗄 Pull from EA Repository</div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => { setShowRepoSearch(s => !s); if (!allRepoAssets.length) loadRepoAssets() }}>
                {showRepoSearch ? 'Hide' : 'Browse Assets'}
              </button>
            </div>
            {showRepoSearch && (
              <div>
                {/* Cycle scope toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '4px 8px', background: 'rgba(0,180,216,0.06)', borderRadius: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--accent)' }}>
                    {repoSourceFilter === 'CYCLE' ? '📍 This cycle assets only' : '🌐 All repository assets'}
                  </div>
                  <button style={{ fontSize: 9, background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-dim)', padding: '1px 6px', cursor: 'pointer' }}
                    onClick={() => {
                      const next = repoSourceFilter === 'CYCLE' ? 'ALL' : 'CYCLE'
                      setRepoSourceFilter(next)
                      setRepoAssets(next === 'CYCLE'
                        ? allRepoAssets.filter((a: any) => a.sourceRef === cycleId || a.source === 'MANUAL')
                        : allRepoAssets
                      )
                    }}>
                    {repoSourceFilter === 'CYCLE' ? 'Show All' : 'This Cycle Only'}
                  </button>
                </div>
                {/* Search + domain filter */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input className="form-input" value={repoSearch} onChange={e => setRepoSearch(e.target.value)}
                    placeholder="Search assets..." style={{ flex: 1, fontSize: 10, padding: '3px 6px' }} />
                  <select className="form-input" value={repoDomainFilter} onChange={e => setRepoDomainFilter(e.target.value)}
                    style={{ fontSize: 10, padding: '3px 4px', width: 120 }}>
                    <option value="ALL">All Domains</option>
                    {(Array.from(new Set(allRepoAssets.map((a:any) => a.domain).filter(Boolean))) as string[]).sort().map((d:string) =>
                      <option key={d} value={d}>{(d as string).replace(/_/g,' ')}</option>
                    )}
                  </select>
                </div>
                {/* Asset list */}
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {repoLoading ? <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading...</div> : (() => {
                    const displayAssets = repoAssets.filter((a:any) =>
                      (repoDomainFilter === 'ALL' || a.domain === repoDomainFilter) &&
                      (!repoSearch || a.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
                       (a.nameAr||'').includes(repoSearch) ||
                       (a.description||'').toLowerCase().includes(repoSearch.toLowerCase()))
                    )
                    return displayAssets.length === 0
                      ? <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0', textAlign: 'center' }}>
                          No assets found — try "Show All" to browse all assets
                        </div>
                      : displayAssets.map((a: any) => (
                          <div key={a.id} onClick={() => pullFromRepo(a.id)}
                            style={{ padding: '6px 8px', marginBottom: 3, background: 'var(--navy-light)', borderRadius: 3, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, border: '1px solid transparent', transition: 'border-color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                              {a.nameAr && <div style={{ fontSize: 10, color: 'var(--text-dim)', direction: 'rtl' }}>{a.nameAr}</div>}
                              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2, display: 'flex', gap: 4 }}>
                                <span>{(a.domain||'').replace(/_/g,' ')} / {(a.assetType||'').replace(/_/g,' ')}</span>
                                <span style={{ padding: '0 3px', borderRadius: 2, background: a.source === 'ADM_OUTPUT' ? 'rgba(155,89,182,0.15)' : 'rgba(0,180,216,0.1)', color: a.source === 'ADM_OUTPUT' ? '#9b59b6' : 'var(--accent)' }}>
                                  {(a.source||'').replace(/_/g,' ')}
                                </span>
                                {a.status === 'APPROVED' && <span style={{ padding: '0 3px', borderRadius: 2, background: 'rgba(46,204,113,0.1)', color: 'var(--success)' }}>✓</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0, marginLeft: 6 }}>+ Use</span>
                          </div>
                        ))
                  })()}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                  {repoAssets.length} assets in view · {allRepoAssets.length} total
                </div>
              </div>
            )}
          </div>

          <div className="divider" style={{ margin: '8px 0' }} />

          {/* File Upload */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#2ecc71' }}>⬆ Upload File</div>
            <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ fontSize: 11, marginBottom: 8, color: 'var(--text)' }} />
            {uploadFile && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>📄 {uploadFile.name}</div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeInKb} onChange={e => setIncludeInKb(e.target.checked)} />
                    Add to Knowledge Base
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeInRepo} onChange={e => setIncludeInRepo(e.target.checked)} />
                    Add to EA Repository
                  </label>
                </div>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={uploading} onClick={handleUpload}>{uploading ? 'Uploading...' : 'Upload & Use'}</button>
              </div>
            )}
          </div>

          <button onClick={() => setShowOptions(false)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>× Close</button>
        </div>
      )}
    </div>
  )
}



// ── Template Panel ────────────────────────────────────────
function TemplatePanel({ phase, outputKey, outputId, cycle }: any) {
  const [mapping, setMapping] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const token = () => localStorage.getItem('ea_token')

  useEffect(() => {
    if (!outputKey) return
    fetch(`${API_URL}/adm-templates/output/${outputKey}/mapping`, {
      headers: { Authorization: `Bearer ${token()}` }
    }).then(r => r.json()).then(d => {
      if (!d.error) setMapping(d)
    }).catch(() => {})
  }, [outputKey])

  const download = async (format: 'docx' | 'pptx') => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (outputId) params.set('outputId', outputId)
      const res = await fetch(`${API_URL}/adm-templates/output/${outputKey}/download/${format}?${params}`, {
        headers: { Authorization: `Bearer ${token()}` }
      })
      if (!res.ok) {
        const errText = await res.text()
        throw new Error('Download failed: ' + res.status + ' ' + errText.slice(0, 100))
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${outputKey}_template.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || 'Download failed')
    } finally { setLoading(false) }
  }

  if (!mapping) return null

  const isFilled = !!outputId  // outputId means AI_DRAFT or APPROVED with content

  return (
    <div style={{ marginTop: 8, padding: '10px 12px', background: isFilled ? 'rgba(46,204,113,0.06)' : 'rgba(201,168,76,0.06)', border: `1px solid ${isFilled ? 'rgba(46,204,113,0.3)' : 'rgba(201,168,76,0.25)'}`, borderRadius: 'var(--radius)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: isFilled ? 'var(--success)' : 'var(--gold)' }}>
          {isFilled ? '✅' : '📋'} {mapping.outputNameAr}
        </span>
        {isFilled && <span style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(46,204,113,0.15)', color: 'var(--success)', borderRadius: 2, fontFamily: 'var(--font-mono)' }}>AI CONTENT READY</span>}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>{mapping.purposeAr || mapping.purposeEn}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, ...(isFilled ? { color: 'var(--success)', borderColor: 'rgba(46,204,113,0.4)' } : {}) }} disabled={loading} onClick={() => download('docx')}>
          📄 {loading ? '...' : isFilled ? 'Download Filled Word' : 'Word Template'}
        </button>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, ...(isFilled ? { color: 'var(--success)', borderColor: 'rgba(46,204,113,0.4)' } : {}) }} disabled={loading} onClick={() => download('pptx')}>
          📊 {loading ? '...' : isFilled ? 'Download Filled PPT' : 'PPT Template'}
        </button>
      </div>
    </div>
  )
}

function OutputSourcePanel({ out, onUpdated }: any) {
  const [showOptions, setShowOptions] = useState(false)
  const [kbQuery, setKbQuery] = useState('')
  const [kbSearching, setKbSearching] = useState(false)
  const [showRepoSearch, setShowRepoSearch] = useState(false)
  const [repoAssets, setRepoAssets] = useState<any[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [includeInKb, setIncludeInKb] = useState(false)
  const [includeInRepo, setIncludeInRepo] = useState(false)
  const [uploading, setUploading] = useState(false)
  const token = () => localStorage.getItem('ea_token')

  const pullFromKb = async () => {
    if (!kbQuery.trim()) return
    setKbSearching(true)
    try {
      const res = await fetch(`${API_URL}/adm-intelligence/outputs/${out.id}/pull-from-kb`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: kbQuery })
      })
      const updated = await res.json()
      if (updated.id) { onUpdated(updated); setShowOptions(false) }
    } finally { setKbSearching(false) }
  }

  const loadRepoAssets = async () => {
    setRepoLoading(true)
    try {
      const res = await fetch(`${API_URL}/ea-repository/assets`, { headers: { Authorization: `Bearer ${token()}` } })
      setRepoAssets(await res.json())
    } finally { setRepoLoading(false) }
  }

  const pullFromRepo = async (assetId: string) => {
    const res = await fetch(`${API_URL}/adm-intelligence/outputs/${out.id}/pull-from-repo`, {
      method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId })
    })
    const updated = await res.json()
    if (updated.id) { onUpdated(updated); setShowOptions(false); setShowRepoSearch(false) }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const text = uploadFile.type.startsWith('text') || uploadFile.name.endsWith('.txt') || uploadFile.name.endsWith('.md')
        ? await uploadFile.text()
        : `Uploaded file: ${uploadFile.name} (${(uploadFile.size/1024).toFixed(1)} KB)`
      const res = await fetch(`${API_URL}/adm-intelligence/outputs/${out.id}/upload`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContent: text, fileName: uploadFile.name, includeInKb, includeInRepo })
      })
      const updated = await res.json()
      if (updated.id) { onUpdated(updated); setShowOptions(false); setUploadFile(null) }
    } finally { setUploading(false) }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setShowOptions(s => !s)}>
        ⬇ Pull / Upload
      </button>
      {showOptions && (
        <div style={{ marginTop: 8, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          {/* KB */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--accent)' }}>📚 Pull from Knowledge Base</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" value={kbQuery} onChange={e => setKbQuery(e.target.value)} placeholder={`Search KB for "${out.title}"`} style={{ flex: 1, fontSize: 11 }} onKeyDown={e => e.key === 'Enter' && pullFromKb()} />
              <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={kbSearching || !kbQuery} onClick={pullFromKb}>{kbSearching ? '...' : 'Search'}</button>
            </div>
          </div>
          <div className="divider" style={{ margin: '8px 0' }} />
          {/* Repo */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)' }}>🗄 Pull from EA Repository</div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => { setShowRepoSearch(s => !s); if (!repoAssets.length) loadRepoAssets() }}>{showRepoSearch ? 'Hide' : 'Browse'}</button>
            </div>
            {showRepoSearch && (
              <div style={{ maxHeight: 140, overflow: 'auto' }}>
                {repoLoading ? <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading...</div> :
                  repoAssets.slice(0, 15).map((a: any) => (
                    <div key={a.id} onClick={() => pullFromRepo(a.id)} style={{ padding: '5px 8px', marginBottom: 3, background: 'var(--navy-light)', borderRadius: 3, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                      <div><div style={{ fontWeight: 500 }}>{a.name}</div><div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{a.domain} / {a.assetType}</div></div>
                      <span style={{ fontSize: 10, color: 'var(--accent)' }}>+ Use</span>
                    </div>
                  ))
                }
              </div>
            )}
          </div>
          <div className="divider" style={{ margin: '8px 0' }} />
          {/* Upload */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#2ecc71' }}>⬆ Upload File</div>
            <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ fontSize: 11, marginBottom: 6, color: 'var(--text)' }} />
            {uploadFile && (
              <div>
                <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeInKb} onChange={e => setIncludeInKb(e.target.checked)} /> Add to KB
                  </label>
                  <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeInRepo} onChange={e => setIncludeInRepo(e.target.checked)} /> Add to Repository
                  </label>
                </div>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={uploading} onClick={handleUpload}>{uploading ? 'Uploading...' : 'Upload & Use'}</button>
              </div>
            )}
          </div>
          <button onClick={() => setShowOptions(false)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>× Close</button>
        </div>
      )}
    </div>
  )
}

// ── Evidence Collection Form (DISCOVERY outputs) ──────────────────────────
function EvidenceFieldInput({ field, value, onChange, outId, cycleId }: { field: any; value: string; onChange: (v: string) => void; outId: string; cycleId: string }) {
  const [showOptions, setShowOptions] = useState(false)
  const [kbQuery, setKbQuery] = useState('')
  const [kbSearching, setKbSearching] = useState(false)
  const [showRepoSearch, setShowRepoSearch] = useState(false)
  const [repoAssets, setRepoAssets] = useState<any[]>([])
  const [allRepoAssets, setAllRepoAssets] = useState<any[]>([])
  const [repoLoading, setRepoLoading] = useState(false)
  const [repoSearch, setRepoSearch] = useState('')
  const [repoSourceFilter, setRepoSourceFilter] = useState('CYCLE')
  const [repoDomainFilter, setRepoDomainFilter] = useState('ALL')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [includeInKb, setIncludeInKb] = useState(false)
  const [uploading, setUploading] = useState(false)
  const token = () => localStorage.getItem('ea_token')

  const appendContent = (text: string) => {
    onChange((value ? value + '\n\n' : '') + text)
    setShowOptions(false)
    setShowRepoSearch(false)
  }

  const pullFromKb = async () => {
    if (!kbQuery.trim()) return
    setKbSearching(true)
    try {
      const res = await fetch(`${API_URL}/adm-intelligence/outputs/${outId}/pull-from-kb`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: kbQuery })
      })
      const data = await res.json()
      if (data.content) appendContent(data.content)
      else alert(data.message || 'No content found in KB')
    } finally { setKbSearching(false) }
  }

  const loadRepoAssets = async () => {
    setRepoLoading(true)
    try {
      const res = await fetch(`${API_URL}/ea-repository/assets`, { headers: { Authorization: `Bearer ${token()}` } })
      const all = await res.json()
      setAllRepoAssets(all)
      setRepoAssets(all.filter((a: any) => a.sourceRef === cycleId || a.source === 'MANUAL'))
      setRepoSourceFilter('CYCLE')
    } finally { setRepoLoading(false) }
  }

  const pullFromRepo = async (assetId: string) => {
    try {
      const res = await fetch(`${API_URL}/adm-intelligence/outputs/${outId}/pull-from-repo`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId })
      })
      const data = await res.json()
      if (data.content) appendContent(data.content)
      else alert('Failed to pull from repository: ' + (data.message || JSON.stringify(data)))
    } catch (e: any) { alert('Error: ' + e.message) }
  }

  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const text = await uploadFile.text()
      if (includeInKb) {
        const fd = new FormData(); fd.append('file', uploadFile); fd.append('type', 'REFERENCE_ARCHITECTURE')
        await fetch(`${API_URL}/knowledge/documents/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd })
      }
      appendContent(text)
      setUploadFile(null)
    } finally { setUploading(false) }
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 2, color: 'var(--text)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{field.label}</span>
        <button style={{ fontSize: 10, background: 'none', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 7px', color: 'var(--text-dim)', cursor: 'pointer' }}
          onClick={() => { setShowOptions(s => !s); if (!allRepoAssets.length) loadRepoAssets() }}>
          ⬇ Pull From...
        </button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{field.hint}</div>

      {showOptions && (
        <div style={{ marginBottom: 8, padding: 12, background: 'rgba(0,0,0,0.15)', borderRadius: 6, border: '1px solid var(--border)' }}>
          {/* KB */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: 'var(--accent)' }}>📚 Pull from Knowledge Base</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" value={kbQuery} onChange={e => setKbQuery(e.target.value)}
                placeholder={`Search KB for ${field.label.toLowerCase()}...`}
                style={{ flex: 1, fontSize: 11 }} onKeyDown={e => e.key === 'Enter' && pullFromKb()} />
              <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={kbSearching || !kbQuery} onClick={pullFromKb}>
                {kbSearching ? '...' : 'Search'}
              </button>
            </div>
          </div>

          <div className="divider" style={{ margin: '8px 0' }} />

          {/* Repo */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)' }}>🗄 Pull from EA Repository</div>
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }}
                onClick={() => setShowRepoSearch(s => !s)}>{showRepoSearch ? 'Hide' : 'Browse Assets'}</button>
            </div>
            {showRepoSearch && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, padding: '4px 8px', background: 'rgba(0,180,216,0.06)', borderRadius: 4 }}>
                  <div style={{ fontSize: 10, color: 'var(--accent)' }}>
                    {repoSourceFilter === 'CYCLE' ? '📍 This cycle assets only' : '🌐 All repository assets'}
                  </div>
                  <button style={{ fontSize: 9, background: 'none', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-dim)', padding: '1px 6px', cursor: 'pointer' }}
                    onClick={() => {
                      const next = repoSourceFilter === 'CYCLE' ? 'ALL' : 'CYCLE'
                      setRepoSourceFilter(next)
                      setRepoAssets(next === 'CYCLE' ? allRepoAssets.filter((a: any) => a.sourceRef === cycleId || a.source === 'MANUAL') : allRepoAssets)
                    }}>{repoSourceFilter === 'CYCLE' ? 'Show All' : 'This Cycle Only'}</button>
                </div>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input className="form-input" value={repoSearch} onChange={e => setRepoSearch(e.target.value)}
                    placeholder="Search assets..." style={{ flex: 1, fontSize: 10, padding: '3px 6px' }} />
                  <select className="form-input" value={repoDomainFilter} onChange={e => setRepoDomainFilter(e.target.value)}
                    style={{ fontSize: 10, padding: '3px 4px', width: 110 }}>
                    <option value="ALL">All Domains</option>
                    {(Array.from(new Set(allRepoAssets.map((a: any) => a.domain).filter(Boolean))) as string[]).sort().map((d: string) =>
                      <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
                    )}
                  </select>
                </div>
                <div style={{ maxHeight: 200, overflow: 'auto' }}>
                  {repoLoading ? <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Loading...</div> : (() => {
                    const display = repoAssets.filter((a: any) =>
                      (repoDomainFilter === 'ALL' || a.domain === repoDomainFilter) &&
                      (!repoSearch || a.name.toLowerCase().includes(repoSearch.toLowerCase()) || (a.nameAr || '').includes(repoSearch))
                    )
                    return display.length === 0
                      ? <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0', textAlign: 'center' }}>No assets found — try "Show All"</div>
                      : display.map((a: any) => (
                        <div key={a.id} onClick={() => pullFromRepo(a.id)}
                          style={{ padding: '6px 8px', marginBottom: 3, background: 'var(--navy-light)', borderRadius: 3, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, border: '1px solid transparent' }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{(a.domain || '').replace(/_/g, ' ')} / {(a.assetType || '').replace(/_/g, ' ')}</div>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0, marginLeft: 6 }}>+ Use</span>
                        </div>
                      ))
                  })()}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4 }}>{repoAssets.length} assets in view · {allRepoAssets.length} total</div>
              </div>
            )}
          </div>

          <div className="divider" style={{ margin: '8px 0' }} />

          {/* Upload */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#2ecc71' }}>⬆ Upload File</div>
            <input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} style={{ fontSize: 11, marginBottom: 6, color: 'var(--text)' }} />
            {uploadFile && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>📄 {uploadFile.name}</div>
                <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', marginBottom: 8 }}>
                  <input type="checkbox" checked={includeInKb} onChange={e => setIncludeInKb(e.target.checked)} /> Add to Knowledge Base
                </label>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} disabled={uploading} onClick={handleUpload}>
                  {uploading ? 'Uploading...' : 'Upload & Use'}
                </button>
              </div>
            )}
          </div>

          <button onClick={() => setShowOptions(false)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>× Close</button>
        </div>
      )}

      <textarea
        className="form-input"
        style={{ width: '100%', minHeight: 72, fontSize: 11, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
        placeholder={field.placeholder}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function EvidenceCollectionForm({ out, cycleId, onEvidenceSaved }: { out: any; cycleId: string; onEvidenceSaved: (evidence: any) => void }) {
  const [fields, setFields] = useState<any[]>([])
  const [evidence, setEvidence] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const token = () => localStorage.getItem('ea_token')

  useEffect(() => {
    fetch(`${API_URL}/adm-intelligence/outputs/${out.id}/evidence-def`, {
      headers: { Authorization: `Bearer ${token()}` }
    })
      .then(r => r.json())
      .then(data => { setFields(data.fields || []); setEvidence(data.evidence || {}); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [out.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API_URL}/adm-intelligence/outputs/${out.id}/evidence`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence })
      })
      const updated = await res.json()
      if (updated.id) onEvidenceSaved(evidence)
    } finally { setSaving(false) }
  }

  const filledCount = Object.values(evidence).filter(v => v && v.trim().length > 0).length

  if (!loaded) return <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: '8px 0' }}>Loading collection form...</div>
  if (fields.length === 0) return null

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#f39c12', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🔍 Architecture Evidence Collection</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 400 }}>{filledCount}/{fields.length} fields provided</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map((field: any) => (
          <EvidenceFieldInput
            key={field.key}
            field={field}
            value={evidence[field.key] || ''}
            onChange={v => setEvidence(prev => ({ ...prev, [field.key]: v }))}
            outId={out.id}
            cycleId={cycleId}
          />
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} disabled={saving} onClick={handleSave}>
          {saving ? '💾 Saving...' : '💾 Save Evidence'}
        </button>
        {filledCount > 0 && (
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
            {filledCount}/{fields.length} fields filled — click "Analyze & Structure" to process
          </span>
        )}
      </div>
    </div>
  )
}

// ── Phase Workspace (Step-based) ──────────────────────────
function PhaseWorkspace({ cycle, phase, onClose }: any) {
  const { isAR } = useLang()
  const api = useApi()
  const [phaseInputs, setPhaseInputs] = useState<any[]>([])
  const [phaseOutputs, setPhaseOutputs] = useState<any[]>([])
  const [phaseDef, setPhaseDef] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [expandedOutputs, setExpandedOutputs] = useState<Set<string>>(new Set())
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null)
  const [editingInput, setEditingInput] = useState<string | null>(null)
  const [inputContent, setInputContent] = useState('')
  const [editingOutput, setEditingOutput] = useState<string | null>(null)
  const [outputContent, setOutputContent] = useState('')
  const [activeStep, setActiveStep] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/adm-intelligence/cycles/${cycle.id}/phases/${phase}/inputs`),
      api.get(`/adm-intelligence/cycles/${cycle.id}/phases/${phase}/outputs`),
    ]).then(([inp, out]) => {
      setPhaseInputs(inp.inputs || [])
      setPhaseOutputs(out.outputs || [])
      // Auto-expand outputs that have content or are not in initial PENDING state
      const autoExpand = new Set<string>()
      ;(out.outputs || []).filter((o: any) => o.status === 'GENERATING').forEach((o: any) => autoExpand.add(o.id))
      setExpandedOutputs(autoExpand)
      setPhaseDef(inp.phaseDef || out.phaseDef)
      // Auto-select first step
      const steps = inp.phaseDef?.steps || out.phaseDef?.steps || []
      if (steps.length > 0) setActiveStep(steps[0].key)
    }).finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycle.id, phase])

  const saveInput = async (inputId: string) => {
    await api.put(`/adm-intelligence/inputs/${inputId}`, { content: inputContent, source: 'PROVIDED' })
    setPhaseInputs(inp => inp.map(i => i.id === inputId ? { ...i, content: inputContent, source: 'PROVIDED' } : i))
    setEditingInput(null)
  }

  const generateOutput = async (outputId: string) => {
    // Auto-save any open input before generating so backend has latest content
    if (editingInput) {
      await api.put(`/adm-intelligence/inputs/${editingInput}`, { content: inputContent, source: 'PROVIDED' })
      setPhaseInputs(inp => inp.map(i => i.id === editingInput ? { ...i, content: inputContent, source: 'PROVIDED' } : i))
      setEditingInput(null)
    }
    setGenerating(outputId)
    setExpandedOutputs(prev => { const s = new Set(prev); s.add(outputId); return s })
    try {
      const result = await api.post(`/adm-intelligence/outputs/${outputId}/generate`)
      setPhaseOutputs(out => out.map(o => o.id === outputId ? { ...o, ...result } : o))
      // Poll for updates while GENERATING
      if (result?.status === 'GENERATING') {
        const pollInterval = setInterval(async () => {
          try {
            const updated = await api.get(`/adm-intelligence/outputs/${outputId}`)
            setPhaseOutputs(out => out.map(o => o.id === outputId ? { ...o, ...updated } : o))
            // Keep polling if GENERATING or AI_DRAFT with no content yet
            const isDone = updated?.status !== 'GENERATING' && 
              (updated?.status !== 'AI_DRAFT' || (updated?.content && updated.content.length > 100))
            if (isDone) {
              clearInterval(pollInterval)
              setGenerating(null)
              // Reload full phase data to get latest content
              setPhaseOutputs(prev => prev.map(o => o.id === outputId ? { ...o, ...updated } : o))
            }
          } catch(e) { clearInterval(pollInterval); setGenerating(null) }
        }, 2000)
        return // Don't clear generating state yet
      }
    } catch(e) {}
    setGenerating(null)
  }

  const approveOutput = async (outputId: string) => {
    const result = await api.put(`/adm-intelligence/outputs/${outputId}`, { status: 'APPROVED' })
    setPhaseOutputs(out => out.map(o => o.id === outputId ? { ...o, ...result } : o))
  }

  const saveOutputEdit = async (outputId: string) => {
    const result = await api.put(`/adm-intelligence/outputs/${outputId}`, { content: outputContent, status: 'AI_DRAFT' })
    setPhaseOutputs(out => out.map(o => o.id === outputId ? { ...o, ...result } : o))
    setEditingOutput(null)
  }

  const promoteToRepo = async (outputId: string) => {
    await api.post(`/adm-intelligence/outputs/${outputId}/promote-to-repository`)
    setPhaseOutputs(out => out.map(o => o.id === outputId ? { ...o, inRepository: true } : o))
  }

  const promoteToKb = async (outputId: string) => {
    await api.post(`/adm-intelligence/outputs/${outputId}/promote-to-kb`)
    setPhaseOutputs(out => out.map(o => o.id === outputId ? { ...o, inKnowledgeBase: true } : o))
  }

  const steps = phaseDef?.steps || []
  const currentStep = steps.find((s: any) => s.key === activeStep)

  // Get inputs/outputs for current step
  const stepInputs = currentStep
    ? phaseInputs.filter(i => currentStep.inputs.some((def: any) => def.key === i.inputKey))
    : phaseInputs
  const stepOutputs = currentStep
    ? phaseOutputs.filter(o => currentStep.outputs.some((def: any) => def.key === o.outputKey))
    : phaseOutputs

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, width: '95vw', maxWidth: 1100, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
              Phase {phase} — {phaseDef?.nameAr || phaseDef?.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>{phaseDef?.description}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '0 8px' }}>×</button>
        </div>

        {loading ? (
          <div className="loading-screen" style={{ height: 300 }}><div className="spinner" /></div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Steps sidebar */}
            {steps.length > 1 && (
              <div style={{ width: 200, borderRight: '1px solid var(--border)', padding: '16px 12px', overflowY: 'auto', flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8, letterSpacing: '0.08em' }}>STEPS</div>
                {steps.map((step: any) => {
                  const stepOuts = phaseOutputs.filter(o => step.outputs.some((def: any) => def.key === o.outputKey))
                  const hasApproved = stepOuts.some(o => o.status === 'APPROVED')
                  const hasAiDraft = stepOuts.some(o => o.status === 'AI_DRAFT')
                  return (
                    <button key={step.key} onClick={() => setActiveStep(step.key)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius)', border: `1px solid ${activeStep === step.key ? 'var(--accent)' : 'var(--border)'}`, background: activeStep === step.key ? 'rgba(0,180,216,0.12)' : 'transparent', cursor: 'pointer' }}>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 2 }}>{step.key}</div>
                      <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.4 }}>{step.titleAr || step.title}</div>
                      <div style={{ marginTop: 4 }}>
                        {hasApproved && <span style={{ fontSize: 9, color: '#2ecc71' }}>● Approved</span>}
                        {!hasApproved && hasAiDraft && <span style={{ fontSize: 9, color: '#9b59b6' }}>● AI Draft</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Main content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {currentStep && (
                <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(0,180,216,0.06)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{currentStep.titleAr || currentStep.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{currentStep.title}</div>
                </div>
              )}

              {/* Architecture Scope Selector — Step 1.2 only */}
              {activeStep === '1.2' && (
                <ScopeSelector
                  cycle={cycle}
                  onScopeSet={(domains: string[]) => {
                    cycle.scopeDomains = domains
                  }}
                />
              )}

              <div className="grid-2" style={{ gap: 16 }}>
                {/* Inputs */}
                <div>
                  <div className="section-title" style={{ fontSize: 13, marginBottom: 10 }}>{isAR ? '📥 المدخلات' : isAR ? '📥 المدخلات' : '📥 Inputs'}</div>
                  {stepInputs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '12px 0' }}>No inputs for this step</div>
                  ) : stepInputs.map(inp => {
                    const def = currentStep?.inputs.find((d: any) => d.key === inp.inputKey)
                    const sourceColor = SOURCE_COLORS[def?.source] || SOURCE_COLORS.EXTERNAL
                    const sourceBorder = SOURCE_BORDER[def?.source] || SOURCE_BORDER.EXTERNAL
                    return (
                      <div key={inp.id} style={{ marginBottom: 10, padding: '10px 12px', background: sourceColor, border: `1px solid ${sourceBorder}`, borderRadius: 'var(--radius)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{inp.title}</div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            {inp.providedBy?.startsWith('AUTO_ADM:') && (
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: 'rgba(46,204,113,0.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.3)' }}>{isAR ? '⚡ تلقائي — مخرج ADM' : '⚡ Auto — ADM Output'}</span>
                            )}
                            {inp.providedBy?.startsWith('AUTO_REPO:') && (
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: 'rgba(243,156,18,0.15)', color: 'var(--gold)', border: '1px solid rgba(243,156,18,0.3)' }}>{isAR ? '🗄 تلقائي — المستودع' : '🗄 Auto — Repository'}</span>
                            )}
                            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-dim)' }}>{def?.source?.replace('_', ' ')}</span>
                            <span className={`badge ${inp.source === 'PROVIDED' ? 'badge-approved' : 'badge-draft'}`} style={{ fontSize: 9 }}>{inp.source}</span>
                          </div>
                        </div>
                        {def?.fromPhase && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>← From Phase {def.fromPhase}</div>}
                        {editingInput === inp.id ? (
                          <div>
                            <textarea className="form-input" value={inputContent} onChange={e => setInputContent(e.target.value)} rows={3} style={{ fontSize: 11, marginBottom: 6 }} />
                            <div className="flex gap-2">
                              <button className="btn btn-primary btn-sm" onClick={() => saveInput(inp.id)}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditingInput(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {inp.content && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, maxHeight: 50, overflow: 'hidden', lineHeight: 1.5 }}>{inp.content.slice(0, 120)}{inp.content.length > 120 ? '...' : ''}</div>}
                            <InputSourcePanel inp={inp} cycleId={cycle.id} onUpdated={(updated: any) => setPhaseInputs(prev => prev.map(i => i.id === updated.id ? updated : i))} onEdit={() => { setEditingInput(inp.id); setInputContent(inp.content || '') }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Outputs */}
                <div>
                  <div className="section-title" style={{ fontSize: 13, marginBottom: 10 }}>{isAR ? '📤 المخرجات' : isAR ? '📤 المخرجات' : '📤 Outputs'}</div>
                  {stepOutputs.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '12px 0' }}>No outputs for this step</div>
                  ) : stepOutputs.map(out => {
                    const def = currentStep?.outputs.find((d: any) => d.key === out.outputKey)
                    const statusColor = OUTPUT_STATUS_COLOR[out.status] || '#8baac8'
                    const isExpanded = expandedOutputs.has(out.id)
                    return (
                      <div key={out.id} style={{ marginBottom: 6, background: 'var(--navy)', border: `1px solid ${isExpanded ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', overflow: 'hidden', transition: 'border-color 0.15s' }}>
                        {/* Collapsed header — always visible */}
                        <div
                          onClick={() => setExpandedOutputs(prev => { const s = new Set(prev); s.has(out.id) ? s.delete(out.id) : s.add(out.id); return s })}
                          style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{isExpanded ? '▾' : '▸'}</span>
                            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{out.title}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
                            {def?.behaviorType && (() => {
                              const behaviorLabels: Record<string, { label: string; color: string }> = {
                                DISCOVERY:  { label: '🔍 Discovery',  color: '#f39c12' },
                                ANALYSIS:   { label: '📊 Analysis',   color: '#3498db' },
                                DESIGN:     { label: '🏗 Design',     color: '#9b59b6' },
                                GOVERNANCE: { label: '📋 Governance', color: '#2ecc71' },
                                PLANNING:   { label: '🗺 Planning',   color: '#e74c3c' },
                              }
                              const b = behaviorLabels[def.behaviorType]
                              return b ? (
                                <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 2, background: `${b.color}18`, color: b.color, border: `1px solid ${b.color}33` }}>{b.label}</span>
                              ) : null
                            })()}
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, fontFamily: 'var(--font-mono)', background: `${statusColor}22`, color: statusColor, border: `1px solid ${statusColor}44` }}>{out.status.replace('_', ' ')}</span>
                          </div>
                        </div>

                        {/* Expandable body */}
                        {isExpanded && (
                        <div style={{ padding: '0 12px 10px 12px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{out.description}</div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: out.content ? 6 : 0 }}>
                          {(out.status === 'GENERATING' || generating === out.id) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 10, color: 'var(--accent)' }}>⟳ {def?.behaviorType === 'DISCOVERY' ? 'Analyzing & structuring...' : 'Generating sections...'}</span>
                              <button className='btn btn-secondary btn-sm' style={{ fontSize: 10 }}
                                onClick={async () => {
                                  await fetch(`${API_URL}/adm-intelligence/outputs/${out.id}/reset`, {
                                    method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` }
                                  })
                                  window.location.reload()
                                }}>✕ Cancel</button>
                            </div>
                          )}
                          {(out.status === 'GENERATING' || generating === out.id) && <SectionProgress outputId={out.id} />}
                          {/* Discovery post-generation guidance */}
                          {def?.behaviorType === 'DISCOVERY' && out.status === 'AI_DRAFT' && out.content && (
                            <div style={{ fontSize: 11, padding: '8px 10px', background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)', borderRadius: 4, marginBottom: 6, lineHeight: 1.6 }}>
                              <div style={{ color: '#f39c12', fontWeight: 600, marginBottom: 4 }}>🔍 Architecture Evidence Structured</div>
                              <div style={{ color: 'var(--text-dim)' }}>The AI has organized and structured your collected architecture data. Review the output, make corrections if needed, then <strong style={{ color: 'var(--text)' }}>Approve</strong> to make it available as input to the next step.</div>
                            </div>
                          )}
                          {(out.status === 'PENDING' || out.status === 'AI_DRAFT') && (() => {
                            const behaviorType = def?.behaviorType || 'ANALYSIS'
                            const buttonConfig: Record<string, { label: string; icon: string; tooltip: string }> = {
                              DISCOVERY: { label: 'Analyze & Structure', icon: '🔍', tooltip: 'AI will extract and organize architecture evidence from your inputs — not generate architecture' },
                              ANALYSIS:  { label: 'AI Generate', icon: '🤖', tooltip: 'AI will analyze and interpret the current state' },
                              DESIGN:    { label: 'AI Design', icon: '🏗', tooltip: 'AI will design the target architecture' },
                              GOVERNANCE:{ label: 'AI Generate', icon: '📋', tooltip: 'AI will produce a governance artifact' },
                              PLANNING:  { label: 'AI Plan', icon: '🗺', tooltip: 'AI will sequence and prioritize initiatives' },
                            }
                            const cfg = buttonConfig[behaviorType] || buttonConfig.ANALYSIS
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {behaviorType === 'DISCOVERY' && out.status === 'PENDING' && (
                                  <div style={{ fontSize: 10, color: '#f39c12', padding: '4px 8px', background: 'rgba(243,175,55,0.08)', border: '1px solid rgba(243,175,55,0.2)', borderRadius: 4, marginBottom: 2 }}>
                                    🔍 Discovery mode — provide your collected architecture data as inputs, then click Analyze & Structure
                                  </div>
                                )}
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: 10 }}
                                  disabled={generating === out.id}
                                  title={cfg.tooltip}
                                  onClick={() => generateOutput(out.id)}
                                >
                                  {generating === out.id ? `⏳ ${behaviorType === 'DISCOVERY' ? 'Analyzing...' : 'Generating...'}` : `${cfg.icon} ${cfg.label}`}
                                </button>
                              </div>
                            )
                          })()}
                          {out.content && out.status !== 'APPROVED' && (
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 10, color: '#2ecc71', borderColor: 'rgba(46,204,113,0.4)' }} onClick={() => approveOutput(out.id)}>✓ Approve</button>
                          )}
                          {out.content && (
                            <>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => setExpandedOutput(expandedOutput === out.id ? null : out.id)}>{expandedOutput === out.id ? '▲ Hide' : '▼ View'}</button>
                              <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={() => { setEditingOutput(out.id); setOutputContent(out.content) }}>✏</button>
                            </>
                          )}
                        </div>

                        {/* Promote */}
                        {out.content && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 9, opacity: out.inRepository ? 0.5 : 1 }} disabled={out.inRepository} onClick={() => promoteToRepo(out.id)}>
                              {out.inRepository ? '✓ In Repo' : '🗄 → Repository'}
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ fontSize: 9, opacity: out.inKnowledgeBase ? 0.5 : 1 }} disabled={out.inKnowledgeBase} onClick={() => promoteToKb(out.id)}>
                              {out.inKnowledgeBase ? '✓ In KB' : '📚 → Knowledge Base'}
                            </button>
                          </div>
                        )}

                        {/* Evidence Collection Form for DISCOVERY outputs */}
                        {def?.behaviorType === 'DISCOVERY' && (out.status === 'PENDING' || out.status === 'AI_DRAFT') && (
                          <EvidenceCollectionForm
                            out={out}
                            cycleId={cycle.id}
                            onEvidenceSaved={(ev: any) => setPhaseOutputs(prev => prev.map(o => o.id === out.id ? { ...o, outputEvidence: ev } : o))}
                          />
                        )}
                        {/* Pull/Upload panel — hidden for DISCOVERY outputs, evidence form replaces it */}
                        {def?.behaviorType !== 'DISCOVERY' && (
                          <OutputSourcePanel out={out} onUpdated={(updated: any) => setPhaseOutputs(prev => prev.map(o => o.id === updated.id ? { ...o, ...updated } : o))} />
                        )}

                        {(out.status === 'AI_DRAFT' || out.status === 'APPROVED') && out.content && out.content.length > 100 && <TemplatePanel phase={phase} outputKey={out.outputKey} outputId={out.id} cycle={cycle} />}
                        {out.status !== 'PENDING' && <DiagramViewer cycleId={cycle.id} phase={phase} outputKey={out.outputKey} />}
                        {out.content && out.content.length > 100 && <DiagramStatus outputId={out.id} outputStatus={out.status} onDone={() => setPhaseOutputs(prev => [...prev])} />}


                        {/* Tracability */}
                        {def?.tracesTo?.length > 0 && (
                          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-dim)' }}>
                            Traces to: {def.tracesTo.slice(0,3).join(', ')}{def.tracesTo.length > 3 ? ` +${def.tracesTo.length-3}` : ''}
                          </div>
                        )}

                        {/* Content view */}
                        {expandedOutput === out.id && out.content && !editingOutput && (
                          <div style={{ marginTop: 8, padding: '12px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: 'var(--radius)', fontSize: 12, lineHeight: 1.8, maxHeight: 'none', color: 'var(--text)' }}>
                            {extractDiagrams(out.content).map((part, idx) =>
                              part.type === 'diagram'
                                ? <DiagramBlock key={idx} chart={part.content} />
                                : <ReactMarkdown key={idx} components={{
                                    h1: ({children}) => <h1 style={{fontSize:16,fontWeight:700,color:'var(--accent)',borderBottom:'1px solid var(--border)',paddingBottom:4,marginBottom:8,marginTop:12}}>{children}</h1>,
                                    h2: ({children}) => <h2 style={{fontSize:14,fontWeight:700,color:'var(--accent)',marginBottom:6,marginTop:10}}>{children}</h2>,
                                    h3: ({children}) => <h3 style={{fontSize:13,fontWeight:600,color:'var(--gold)',marginBottom:4,marginTop:8}}>{children}</h3>,
                                    p: ({children}) => <p style={{marginBottom:8,lineHeight:1.7}}>{children}</p>,
                                    strong: ({children}) => <strong style={{color:'var(--text)',fontWeight:700}}>{children}</strong>,
                                    ul: ({children}) => <ul style={{paddingLeft:20,marginBottom:8}}>{children}</ul>,
                                    ol: ({children}) => <ol style={{paddingLeft:20,marginBottom:8}}>{children}</ol>,
                                    li: ({children}) => <li style={{marginBottom:3,lineHeight:1.6}}>{children}</li>,
                                    table: ({children}) => <div style={{overflowX:'auto',marginBottom:12}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>{children}</table></div>,
                                    thead: ({children}) => <thead style={{background:'var(--navy-mid)'}}>{children}</thead>,
                                    th: ({children}) => <th style={{padding:'6px 10px',textAlign:'left',border:'1px solid var(--border)',color:'var(--accent)',fontWeight:600,fontSize:11}}>{children}</th>,
                                    td: ({children}) => <td style={{padding:'5px 10px',border:'1px solid var(--border)',color:'var(--text)',fontSize:11}}>{children}</td>,
                                    hr: () => <hr style={{border:'none',borderTop:'1px solid var(--border)',margin:'12px 0'}} />,
                                    code: ({className, children}: any) => {
                                      const lang = (className || '').replace('language-', '')
                                      const text = String(children || '').trim()
                                      if (lang === 'mermaid' || text.match(/^(graph|flowchart|sequenceDiagram|classDiagram|quadrantChart|mindmap|gitGraph|timeline)/)) {
                                        return <DiagramBlock chart={text} />
                                      }
                                      return <code style={{background:'rgba(0,180,216,0.1)',padding:'1px 5px',borderRadius:3,fontSize:11,fontFamily:'var(--font-mono)',color:'var(--accent)'}}>{children}</code>
                                    },
                                    blockquote: ({children}) => <blockquote style={{borderLeft:'3px solid var(--accent)',paddingLeft:12,marginLeft:0,color:'var(--text-dim)',fontStyle:'italic'}}>{children}</blockquote>,
                                  }}>{part.content}</ReactMarkdown>
                            )}
                          </div>
                        )}

                        {/* Edit */}
                        {editingOutput === out.id && (
                          <div style={{ marginTop: 8 }}>
                            <textarea className="form-input" value={outputContent} onChange={e => setOutputContent(e.target.value)} rows={7} style={{ fontSize: 11 }} />
                            <div className="flex gap-2 mt-2">
                              <button className="btn btn-primary btn-sm" onClick={() => saveOutputEdit(out.id)}>Save</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => setEditingOutput(null)}>Cancel</button>
                            </div>
                          </div>
                        )}
                        </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Cycle Repository View ────────────────────────────────────────────────────
const ARTIFACT_TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  OUTPUT:      { icon: '📄', label: 'Output',      color: 'var(--accent)' },
  DIAGRAM:     { icon: '📐', label: 'Diagram',     color: '#9b59b6' },
  WORD_EXPORT: { icon: '📝', label: 'Word',        color: '#2980b9' },
  PPT_EXPORT:  { icon: '📊', label: 'PPT',         color: '#e67e22' },
  PDF_EXPORT:  { icon: '📋', label: 'PDF',         color: '#e74c3c' },
  INPUT:       { icon: '📥', label: 'Input',       color: '#27ae60' },
  EVIDENCE:    { icon: '🔍', label: 'Evidence',    color: '#f39c12' },
  JSON:        { icon: '{ }', label: 'JSON',       color: 'var(--text-dim)' },
  MARKDOWN:    { icon: '📝', label: 'Markdown',    color: 'var(--text-dim)' },
  TEMPLATE:    { icon: '🗒', label: 'Template',    color: '#1abc9c' },
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: '#2ecc71', DRAFT: '#f39c12', DEPRECATED: '#e74c3c',
}

function CycleRepositoryView({ cycle }: { cycle: any }) {
  const { isAR } = useLang()
  const [data, setData] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [filterPhase, setFilterPhase] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterPhase !== 'ALL') params.set('phase', filterPhase)
    if (filterType !== 'ALL') params.set('artifactType', filterType)
    if (filterStatus !== 'ALL') params.set('status', filterStatus)

    Promise.all([
      authFetch(`/cycle-artifacts/cycles/${cycle.id}?${params}`),
      authFetch(`/cycle-artifacts/cycles/${cycle.id}/summary`),
    ]).then(([d, s]) => { setData(d); setSummary(s) }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filterPhase, filterType, filterStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  const sync = async () => {
    setSyncing(true); setMsg(null)
    try {
      const res = await authFetch(`/cycle-artifacts/cycles/${cycle.id}/sync`, { method: 'POST' })
      setMsg({ type: 'success', text: `Synced: ${res.synced} new, ${res.updated} updated` })
      load()
    } finally { setSyncing(false) }
  }

  const [showExportOptions, setShowExportOptions] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportOptions, setExportOptions] = useState({
    includeInputs: true, includeOutputs: true, includeWordPpt: true,
    includeJsonMarkdown: true, approvedOnly: false, latestOnly: true,
  })

  const exportZip = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams(Object.entries(exportOptions).map(([k, v]) => [k, String(v)]))
      const res = await fetch(`${API_URL}/adm-templates/cycle/${cycle.id}/export?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` }
      })
      if (!res.ok) { alert('Export failed: ' + res.status); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${cycle.name.replace(/\s+/g, '_')}_Export.zip`; a.click()
      URL.revokeObjectURL(url)
      setShowExportOptions(false)
    } finally { setExporting(false) }
  }

  const phases = Array.from(new Set(data?.artifacts?.map((a: any) => a.phase) || [])).sort()

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>📦 Cycle Artifact Repository</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>All outputs, diagrams, and exports organized by phase and step</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} disabled={syncing} onClick={sync}>
            {syncing ? isAR ? '⟳ جارٍ المزامنة...' : '⟳ Syncing...' : isAR ? '⟳ مزامنة المخرجات' : '⟳ Sync Outputs'}
          </button>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowExportOptions(s => !s)}>
            📦 Export Package
          </button>
        </div>
      </div>

      {/* Export options panel */}
      {showExportOptions && (
        <div style={{ marginBottom: 14, padding: 14, background: 'var(--navy)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Export ADM Cycle Package</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              ['includeOutputs', 'Include Outputs (Markdown)'],
              ['includeInputs', 'Include Inputs'],
              ['includeWordPpt', 'Include Word / PPT Exports'],
              ['includeJsonMarkdown', 'Include JSON'],
              ['approvedOnly', 'Approved outputs only'],
              ['latestOnly', 'Latest versions only'],
            ].map(([k, l]) => (
              <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
                <input type="checkbox" checked={(exportOptions as any)[k]} onChange={e => setExportOptions(o => ({ ...o, [k]: e.target.checked }))} />
                {l}
              </label>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={exporting} onClick={exportZip}>
              {exporting ? '⟳ Generating ZIP...' : '⬇ Download ZIP'}
            </button>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowExportOptions(false)}>Cancel</button>
          </div>
        </div>
      )}

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 10 }}>{msg.text}</div>}

      {/* Summary badges */}
      {summary && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ padding: '4px 10px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--text-dim)' }}>Total </span><strong>{summary.total}</strong>
          </div>
          {Object.entries(summary.byStatus || {}).map(([s, c]: any) => (
            <div key={s} style={{ padding: '4px 10px', background: 'var(--navy)', border: `1px solid ${STATUS_COLORS[s] || 'var(--border)'}33`, borderRadius: 4, fontSize: 11 }}>
              <span style={{ color: STATUS_COLORS[s] || 'var(--text-dim)' }}>{s} </span><strong>{c}</strong>
            </div>
          ))}
          {Object.entries(summary.byType || {}).map(([t, c]: any) => (
            <div key={t} style={{ padding: '4px 10px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 10, color: 'var(--text-dim)' }}>
              {ARTIFACT_TYPE_LABELS[t]?.icon} {t.replace('_', ' ')} <strong>{c}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="form-input" value={filterPhase} onChange={e => setFilterPhase(e.target.value)} style={{ fontSize: 11 }}>
          <option value="ALL">All Phases</option>
          {phases.map((p: any) => <option key={p} value={p}>Phase {p}</option>)}
        </select>
        <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ fontSize: 11 }}>
          <option value="ALL">All Types</option>
          {Object.entries(ARTIFACT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className="form-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 11 }}>
          <option value="ALL">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="DRAFT">Draft</option>
          <option value="DEPRECATED">Deprecated</option>
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', marginLeft: 'auto' }}>
          {data?.total || 0} artifacts
        </div>
      </div>

      {/* Artifact list */}
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading artifacts...</div> : (
        data?.total === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12, border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
            {isAR ? 'لا توجد أدوات بعد. اضغط على "مزامنة المخرجات" لتسجيلها.' : 'No artifacts yet. Click "Sync Outputs" to register existing outputs as artifacts.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(data?.grouped || {}).sort(([a], [b]) => a.localeCompare(b)).map(([phaseKey, phaseData]: any) => (
              <div key={phaseKey} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: 'var(--navy-mid)', fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phase {phaseKey} — {phaseData.phaseName || ''}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{phaseData.count} artifacts</span>
                </div>
                {Object.entries(phaseData.steps || {}).map(([stepKey, stepData]: any) => (
                  <div key={stepKey} style={{ borderTop: '1px solid var(--border)' }}>
                    {stepData.stepId && (
                      <div style={{ padding: '5px 12px', background: 'rgba(0,180,216,0.04)', fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                        {stepData.stepId} — {stepData.stepName || ''}
                      </div>
                    )}
                    {stepData.artifacts.map((a: any) => {
                      const typeInfo = ARTIFACT_TYPE_LABELS[a.artifactType] || { icon: '📄', label: a.artifactType, color: 'var(--text-dim)' }
                      return (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', borderTop: '1px solid rgba(255,255,255,0.03)', fontSize: 11 }}>
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{typeInfo.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titleAr || a.title}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 1, display: 'flex', gap: 8 }}>
                              <span style={{ fontFamily: 'var(--font-mono)' }}>{a.outputKey || ''}</span>
                              {a.domain && <span>{a.domain.replace(/_/g, ' ')}</span>}
                              {a.isPhysical && <span style={{ color: '#2ecc71' }}>● physical</span>}
                              {!a.isPhysical && <span style={{ color: 'var(--text-dim)' }}>◌ logical</span>}
                              <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${STATUS_COLORS[a.status] || '#666'}18`, color: STATUS_COLORS[a.status] || 'var(--text-dim)', border: `1px solid ${STATUS_COLORS[a.status] || '#666'}33` }}>{a.status}</span>
                            <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: 'var(--navy-mid)', color: typeInfo.color, border: '1px solid var(--border)' }}>{typeInfo.label}</span>
                            <span style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>v{a.version}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ── Main ADM Page ─────────────────────────────────────────
export default function AdmPage() {
  const { t, isAR } = useLang()
  const [cycles, setCycles] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [activePhase, setActivePhase] = useState<string | null>(null)
  const [cycleView, setCycleView] = useState<'phases' | 'repository'>('phases')

  const PHASES: Record<string, string[]> = {
    TOGAF: ['PRELIM', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    NORA: ['1', '2', '3', '4', '5', '6', '7'],
  }

  const PHASE_NAMES: Record<string, Record<string, string>> = {
    TOGAF: { PRELIM: 'Preliminary', A: 'Vision', B: 'Business', C: 'Info Systems', D: 'Technology', E: 'Opportunities', F: 'Migration', G: 'Governance', H: 'Change Mgmt' },
    NORA: { '1': 'تحديد النطاق', '2': 'تشخيص الراهن', '3': 'التوجهات', '4': 'تصميم المستقبل', '5': 'تحليل الفجوات', '6': 'خارطة الطريق', '7': 'إدارة المتطلبات' },
  }

  const load = async () => {
    const res = await fetch(`${API_URL}/adm/cycles`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` } })
    const data = await res.json()
    setCycles(data)
    if (selected) setSelected(data.find((c: any) => c.id === selected.id) || null)
    else if (data.length) setSelected(data[0])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const deleteCycle = async (cycleId: string) => {
    if (!window.confirm('Delete this ADM cycle? This cannot be undone.')) return
    await fetch(`${API_URL}/adm/cycles/${cycleId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` } })
    setSelected(null)
    await load()
  }

  const create = async (data: any) => {
    await fetch(`${API_URL}/adm/cycles`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setShowCreate(false); await load()
  }

  const phases = PHASES[selected?.frameworkType] || PHASES.NORA
  const phaseNames = PHASE_NAMES[selected?.frameworkType] || PHASE_NAMES.NORA

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div className="page-title">{t('adm.title')}</div>
            <div className="page-subtitle">
              {selected ? `${selected.frameworkType} FRAMEWORK · ${selected.name}` : t('adm.subtitle')}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>{t('adm.new')}</button>
        </div>
      </div>

      <div className="page-body">
        {cycles.length === 0 ? (
          <div className="empty">
            <div style={{ fontSize: 48 }}>🔄</div>
            <div className="empty-title">{t('adm.no_cycles')}</div>
            <button className="btn btn-primary mt-4" onClick={() => setShowCreate(true)}>{t('common.create')}</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>

            {/* Cycles list */}
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8, letterSpacing: '0.08em' }}>CYCLES</div>
              {cycles.map(c => (
                <div key={c.id} onClick={() => setSelected(c)}
                  style={{ padding: '12px 14px', marginBottom: 6, background: selected?.id === c.id ? 'var(--navy-mid)' : 'var(--navy-light)', border: `1px solid ${selected?.id === c.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge badge-${c.status?.toLowerCase()}`}>{c.status}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: c.frameworkType === 'NORA' ? 'var(--gold)' : 'var(--accent)', background: c.frameworkType === 'NORA' ? 'rgba(201,168,76,0.1)' : 'rgba(0,180,216,0.1)', padding: '1px 6px', borderRadius: 2 }}>{c.frameworkType}</span>
                    <button onClick={e => { e.stopPropagation(); deleteCycle(c.id) }} style={{ marginLeft: 'auto', background: 'none', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius)', color: 'var(--danger)', padding: '1px 6px', fontSize: 10, cursor: 'pointer' }}>🗑</button>
                  </div>
                  {c.scopeDomains?.length > 0 && (
                    <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      Scope: {c.scopeDomains.slice(0,3).join(', ')}{c.scopeDomains.length > 3 ? `+${c.scopeDomains.length-3}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Cycle detail */}
            {selected && (
              <div>
                {/* Cycle view tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  {[['phases', isAR ? '🗺 المراحل' : '🗺 Phases'], ['repository', isAR ? '📦 مستودع الدورة' : '📦 Cycle Repository']].map(([k, l]) => (
                    <button key={k} onClick={() => setCycleView(k as any)}
                      style={{ fontSize: 11, padding: '5px 12px', borderRadius: 'var(--radius)', border: `1px solid ${cycleView === k ? 'var(--accent)' : 'var(--border)'}`, background: cycleView === k ? 'rgba(0,180,216,0.12)' : 'transparent', color: cycleView === k ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>

                {cycleView === 'repository' && <CycleRepositoryView cycle={selected} />}
                {cycleView === 'phases' && (
                <>
                {/* Phase map */}
                <div className="card mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="card-title">{selected.name}</div>
                      <div className="card-subtitle">{selected.frameworkType} · {selected.status}</div>
                    </div>
                  </div>

                  <div style={{ marginBottom: 8, fontSize: 11, color: 'var(--text-dim)' }}>Click a phase to open its workspace</div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {phases.map(p => (
                      <button key={p} onClick={() => setActivePhase(p)}
                        style={{ padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--navy)', cursor: 'pointer', minWidth: 90, textAlign: 'center', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)', color: 'var(--accent)', marginBottom: 4 }}>{p}</div>
                        <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', lineHeight: 1.3, direction: selected.frameworkType === 'NORA' ? 'rtl' : 'ltr' }}>{phaseNames[p]}</div>
                      </button>
                    ))}
                  </div>
                </div>
                </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreate={create} t={t} />}
      {activePhase && selected && <PhaseWorkspace cycle={selected} phase={activePhase} onClose={() => setActivePhase(null)} />}
    </div>
  )
}
