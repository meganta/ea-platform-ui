import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useMetaApi() {
  const { token } = useAuth() as any
  const authHeader = { Authorization: `Bearer ${token || localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' }
  const get = (path: string) => fetch(`${API}${path}`, { headers: authHeader }).then(r => r.json())
  const post = (path: string, body?: any) => fetch(`${API}${path}`, { method: 'POST', headers: authHeader, body: body ? JSON.stringify(body) : undefined }).then(r => r.json())
  const put = (path: string, body: any) => fetch(`${API}${path}`, { method: 'PUT', headers: authHeader, body: JSON.stringify(body) }).then(r => r.json())
  const del = (path: string) => fetch(`${API}${path}`, { method: 'DELETE', headers: authHeader }).then(r => r.ok)
  return { get, post, put, del }
}

// ── Design tokens ─────────────────────────────────────────────────────────────
const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16 },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (active: boolean) => ({ padding: '10px 18px', fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--accent)' : 'var(--text-dim)', borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer', background: 'none', border: 'none', transition: 'all 0.15s' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (variant: 'primary'|'secondary'|'danger' = 'secondary') => ({
    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
    background: variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? '#e74c3c22' : 'var(--navy-mid)',
    color: variant === 'primary' ? '#0B1929' : variant === 'danger' ? '#e74c3c' : 'var(--text)',
    transition: 'all 0.15s',
  }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (color: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: color + '22', color }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column' as const, gap: 4 },
}

// ── Setup wizard ──────────────────────────────────────────────────────────────
function SetupWizard({ api, onCreated }: { api: any, onCreated: () => void }) {
  const [step, setStep] = useState<'choose'|'framework'|'blank'>('choose')
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [selected, setSelected] = useState<string>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { api.get('/meta-model/frameworks').then((d: any) => setFrameworks(Array.isArray(d) ? d : [])) }, [])

  const create = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      if (step === 'framework') {
        await api.post('/meta-model/create-from-framework', { frameworkCode: selected, name, description })
      } else {
        await api.post('/meta-model/create-blank', { name, description })
      }
      onCreated()
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 560, margin: '60px auto', ...S.card }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>🏗 Create Your EA Meta-Model</div>
      <div style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>Define the object types, attributes, and relationships that form your Enterprise Architecture</div>

      {step === 'choose' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { id: 'framework', icon: '📐', title: 'Start from a Framework', desc: 'Use TOGAF or NORA 2.0 as your baseline — customize from there' },
            { id: 'blank', icon: '📄', title: 'Start Blank', desc: 'Build your own custom meta-model from scratch' },
          ].map(opt => (
            <div key={opt.id} onClick={() => setStep(opt.id as any)} style={{ padding: '16px 20px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'flex-start', transition: 'all 0.15s', background: 'var(--navy)' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <span style={{ fontSize: 28 }}>{opt.icon}</span>
              <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{opt.title}</div><div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{opt.desc}</div></div>
            </div>
          ))}
        </div>
      )}

      {step === 'framework' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {(frameworks.length ? frameworks : [{ code: 'TOGAF', name: 'TOGAF 9.2' }, { code: 'NORA_2_0', name: 'NORA 2.0' }]).map((fw: any) => (
              <div key={fw.code} onClick={() => setSelected(fw.code)} style={{ flex: 1, padding: '14px 16px', borderRadius: 10, border: `2px solid ${selected === fw.code ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', textAlign: 'center', background: selected === fw.code ? 'rgba(0,180,216,0.08)' : 'var(--navy)' }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{fw.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{fw.versions?.[0]?.description || 'EA Framework'}</div>
              </div>
            ))}
          </div>
          <div><label style={S.label}>Meta-Model Name *</label><input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. HRDF Enterprise Architecture Meta-Model" /></div>
          <div><label style={S.label}>Description</label><input style={S.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.btn()} onClick={() => setStep('choose')}>← Back</button>
            <button style={{ ...S.btn('primary'), flex: 1 }} onClick={create} disabled={!name || !selected || loading}>{loading ? 'Creating...' : 'Create from Framework'}</button>
          </div>
        </div>
      )}

      {step === 'blank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div><label style={S.label}>Meta-Model Name *</label><input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Custom EA Meta-Model" /></div>
          <div><label style={S.label}>Description</label><input style={S.input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.btn()} onClick={() => setStep('choose')}>← Back</button>
            <button style={{ ...S.btn('primary'), flex: 1 }} onClick={create} disabled={!name || loading}>{loading ? 'Creating...' : 'Create Blank Meta-Model'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ stats, onTab }: { stats: any, onTab: (t: string) => void }) {
  const model = stats?.model
  const fw = model?.frameworkVersion

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Meta-model info */}
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(0,180,216,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>🏛</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{model?.name || 'EA Meta-Model'}</div>
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>{model?.description || 'No description'}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {fw && <span style={S.badge('var(--accent)')}>{fw.framework?.name} {fw.version}</span>}
            {stats?.draftVersion && <span style={S.badge('#f39c12')}>Draft v{stats.draftVersion.version}</span>}
            {stats?.publishedVersion && <span style={S.badge('#2ecc71')}>Published v{stats.publishedVersion.version}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={S.btn('primary')} onClick={() => onTab('designer')}>🎨 Open Designer</button>
          <button style={S.btn()} onClick={() => onTab('versions')}>📋 Versions</button>
        </div>
      </div>

      {/* Stats */}
      <div style={S.grid3}>
        {[
          { icon: '🗂', label: 'Domains', value: stats?.domains ?? 0, tab: 'domains', color: '#3498db' },
          { icon: '⬛', label: 'Object Types', value: stats?.objectTypes ?? 0, tab: 'objects', color: '#e67e22' },
          { icon: '📋', label: 'Attributes', value: stats?.attributes ?? 0, tab: 'objects', color: '#9b59b6' },
          { icon: '🔗', label: 'Relationships', value: stats?.relationships ?? 0, tab: 'relationships', color: '#1abc9c' },
          { icon: '🔄', label: 'Draft Changes', value: stats?.draftVersion ? 'Active' : 'None', tab: 'versions', color: '#f39c12' },
          { icon: '✅', label: 'Published', value: stats?.publishedVersion ? `v${stats.publishedVersion.version}` : 'None', tab: 'versions', color: '#2ecc71' },
        ].map(st => (
          <div key={st.label} style={{ ...S.statCard, cursor: 'pointer' }} onClick={() => onTab(st.tab)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{st.icon}</span>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{st.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: st.color }}>{st.value}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: 'var(--text-dim)' }}>QUICK ACTIONS</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const }}>
          {[
            { label: '+ Add Domain', tab: 'domains', icon: '🗂' },
            { label: '+ Add Object Type', tab: 'objects', icon: '⬛' },
            { label: '+ Add Relationship', tab: 'relationships', icon: '🔗' },
            { label: '📥 Import', tab: 'import', icon: '' },
            { label: '📤 Export', tab: 'export', icon: '' },
            { label: '✅ Validate', tab: 'validation', icon: '' },
          ].map(a => (
            <button key={a.label} style={S.btn()} onClick={() => onTab(a.tab)}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Domains Manager ───────────────────────────────────────────────────────────
function DomainsManager({ api }: { api: any }) {
  const [domains, setDomains] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', color: '#3498db', icon: '📁', description: '' })

  const load = useCallback(() => {
    setLoading(true)
    api.get('/meta-model/domains').then((d: any) => { setDomains(Array.isArray(d) ? d : []); setLoading(false) })
  }, [api])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.code || !form.name) return
    if (editing) { await api.put(`/meta-model/domains/${editing.id}`, form) }
    else { await api.post('/meta-model/domains', form) }
    setShowForm(false); setEditing(null); setForm({ code: '', name: '', nameAr: '', color: '#3498db', icon: '📁', description: '' })
    load()
  }

  const remove = async (id: string) => {
    if (!window.confirm('Delete this domain? Object types must be reassigned first.')) return
    await api.del(`/meta-model/domains/${id}`); load()
  }

  const startEdit = (d: any) => { setEditing(d); setForm({ code: d.code, name: d.name, nameAr: d.nameAr || '', color: d.color, icon: d.icon || '📁', description: d.description || '' }); setShowForm(true) }

  const ICONS = ['🏢', '💻', '🗄', '⚙', '🔒', '🎯', '📊', '⚖', '👥', '🔄', '🌐', '📁', '🏛', '🚀', '💡']
  const COLORS = ['#3498db', '#e67e22', '#2ecc71', '#9b59b6', '#e74c3c', '#1abc9c', '#f39c12', '#7f8c8d', '#2c3e50', '#16a085']

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Domains</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Organize your meta-model by architectural domains</div>
        </div>
        <button style={S.btn('primary')} onClick={() => { setEditing(null); setForm({ code: '', name: '', nameAr: '', color: '#3498db', icon: '📁', description: '' }); setShowForm(true) }}>+ Add Domain</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{editing ? 'Edit Domain' : 'New Domain'}</div>
          <div style={S.grid2}>
            <div><label style={S.label}>Code *</label><input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g,'_') }))} placeholder="BUSINESS" disabled={!!editing} /></div>
            <div><label style={S.label}>Name *</label><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Business Architecture" /></div>
            <div><label style={S.label}>Arabic Name</label><input style={{ ...S.input, direction: 'rtl' }} value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} placeholder="البنية المعمارية للأعمال" /></div>
            <div><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={S.label}>Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
              {ICONS.map(ic => <span key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ fontSize: 22, cursor: 'pointer', padding: 4, borderRadius: 6, background: form.icon === ic ? 'rgba(0,180,216,0.2)' : 'transparent', border: `1px solid ${form.icon === ic ? 'var(--accent)' : 'transparent'}` }}>{ic}</span>)}
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={S.label}>Color</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {COLORS.map(c => <div key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: `3px solid ${form.color === c ? '#fff' : 'transparent'}` }} />)}
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} style={{ width: 28, height: 28, border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={S.btn()} onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</button>
            <button style={S.btn('primary')} onClick={save}>{editing ? 'Save Changes' : 'Create Domain'}</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {domains.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No domains yet. Add your first domain to organize your meta-model.</div>}
          {domains.map((d, idx) => (
            <div key={d.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 16, padding: '14px 20px' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: d.color + '33', border: `1px solid ${d.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{d.icon || '📁'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {d.name}
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{d.code}</span>
                  {d.nameAr && <span style={{ fontSize: 12, color: 'var(--text-dim)', direction: 'rtl' }}>{d.nameAr}</span>}
                </div>
                {d.description && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{d.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{d._count?.objectTypes || 0} object types</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: d.color }} />
                <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 12 }} onClick={() => startEdit(d)}>Edit</button>
                <button style={{ ...S.btn('danger'), padding: '4px 10px', fontSize: 12 }} onClick={() => remove(d.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Object Types List ─────────────────────────────────────────────────────────
function ObjectTypesList({ api, onSelect }: { api: any, onSelect: (ot: any) => void }) {
  const [types, setTypes] = useState<any[]>([])
  const [domains, setDomains] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', singularLabel: '', pluralLabel: '', domainId: '', icon: '⬜', color: '#3498db', semanticType: '', description: '', allowHierarchy: false })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      api.get('/meta-model/object-types'),
      api.get('/meta-model/domains'),
    ]).then(([t, d]: any[]) => { setTypes(Array.isArray(t) ? t : []); setDomains(Array.isArray(d) ? d : []); setLoading(false) })
  }, [api])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form.code || !form.name || !form.singularLabel) return
    await api.post('/meta-model/object-types', form)
    setShowForm(false); setForm({ code: '', name: '', nameAr: '', singularLabel: '', pluralLabel: '', domainId: '', icon: '⬜', color: '#3498db', semanticType: '', description: '', allowHierarchy: false })
    load()
  }

  const ICONS = ['⬜', '💻', '🗄', '⚙', '🔒', '🎯', '📊', '🏢', '👥', '🔄', '🌐', '📁', '🏛', '🚀', '💡', '📋', '🔗', '📈', '🛎', '⬛']
  const CLASSIFICATION_COLOR: Record<string, string> = { FRAMEWORK: '#3498db', TENANT_EXTENSION: '#f39c12', CUSTOM: '#9b59b6' }

  const filtered = types.filter(t =>
    (!search || t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase())) &&
    (!filterDomain || t.domainId === filterDomain)
  )

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Object Types</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>EA entity types defined in your meta-model</div>
        </div>
        <button style={S.btn('primary')} onClick={() => setShowForm(!showForm)}>+ Add Object Type</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input style={{ ...S.input, maxWidth: 280 }} placeholder="🔍 Search object types..." value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...S.input, maxWidth: 200 }} value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
          <option value="">All Domains</option>
          {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-dim)', display: 'flex', alignItems: 'center' }}>{filtered.length} / {types.length} types</div>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>New Object Type</div>
          <div style={S.grid2}>
            <div><label style={S.label}>Code *</label><input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="BusinessCapability" /></div>
            <div><label style={S.label}>Name *</label><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Business Capability" /></div>
            <div><label style={S.label}>Singular Label *</label><input style={S.input} value={form.singularLabel} onChange={e => setForm(f => ({ ...f, singularLabel: e.target.value }))} placeholder="Capability" /></div>
            <div><label style={S.label}>Plural Label</label><input style={S.input} value={form.pluralLabel} onChange={e => setForm(f => ({ ...f, pluralLabel: e.target.value }))} placeholder="Capabilities" /></div>
            <div><label style={S.label}>Domain</label>
              <select style={S.input} value={form.domainId} onChange={e => setForm(f => ({ ...f, domainId: e.target.value }))}>
                <option value="">No Domain</option>
                {domains.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Semantic Type</label><input style={S.input} value={form.semanticType} onChange={e => setForm(f => ({ ...f, semanticType: e.target.value }))} placeholder="e.g. BusinessCapability" /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
            <label style={S.label}>Icon</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {ICONS.map(ic => <span key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))} style={{ fontSize: 18, cursor: 'pointer', padding: 3, borderRadius: 4, background: form.icon === ic ? 'rgba(0,180,216,0.2)' : 'transparent', border: `1px solid ${form.icon === ic ? 'var(--accent)' : 'transparent'}` }}>{ic}</span>)}
            </div>
            <label style={{ ...S.label, marginLeft: 12 }}>Allow Hierarchy</label>
            <input type="checkbox" checked={form.allowHierarchy} onChange={e => setForm(f => ({ ...f, allowHierarchy: e.target.checked }))} style={{ width: 16, height: 16 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={S.btn()} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={S.btn('primary')} onClick={save}>Create Object Type</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {filtered.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No object types found. {types.length === 0 ? 'Create your first object type.' : 'Try a different search.'}</div>}
          {filtered.map(ot => (
            <div key={ot.id} onClick={() => onSelect(ot)} style={{ ...S.card, padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: ot.color + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{ot.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{ot.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{ot.code}</span>
                  {ot.allowHierarchy && <span style={{ fontSize: 10, color: '#f39c12' }}>🌳 Hierarchical</span>}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ot.domain?.name || 'No domain'} · {ot.singularLabel} / {ot.pluralLabel}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <span style={S.badge(CLASSIFICATION_COLOR[ot.classification] || '#7f8c8d')}>{ot.classification}</span>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ot._count?.attributeDefs || 0} attrs · {(ot._count?.sourceRelationships || 0) + (ot._count?.targetRelationships || 0)} rels</span>
                <span style={{ color: 'var(--accent)', fontSize: 16 }}>›</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Object Type Editor ────────────────────────────────────────────────────────
function ObjectTypeEditor({ api, objectType, onBack }: { api: any, objectType: any, onBack: () => void }) {
  const [detail, setDetail] = useState<any>(null)
  const [tab, setTab] = useState<'overview'|'attributes'|'relationships'>('overview')
  const [attrForm, setAttrForm] = useState({ code: '', name: '', attributeType: 'TEXT', isRequired: false, helpText: '' })
  const [showAttrForm, setShowAttrForm] = useState(false)

  useEffect(() => {
    api.get(`/meta-model/object-types/${objectType.id}`).then(setDetail)
  }, [objectType.id])

  const addAttr = async () => {
    if (!attrForm.code || !attrForm.name) return
    await api.post(`/meta-model/object-types/${objectType.id}/attributes`, attrForm)
    api.get(`/meta-model/object-types/${objectType.id}`).then(setDetail)
    setAttrForm({ code: '', name: '', attributeType: 'TEXT', isRequired: false, helpText: '' })
    setShowAttrForm(false)
  }

  const deleteAttr = async (id: string) => {
    await api.del(`/meta-model/attributes/${id}`)
    api.get(`/meta-model/object-types/${objectType.id}`).then(setDetail)
  }

  const ATTR_TYPES = ['TEXT','LONG_TEXT','RICH_TEXT','INTEGER','DECIMAL','PERCENTAGE','BOOLEAN','DATE','DATETIME','URL','EMAIL','ENUM','MULTI_ENUM','REFERENCE','MULTI_REFERENCE','USER','CURRENCY','LIFECYCLE_STATUS','MATURITY_SCORE','JSON_DATA']
  const ATTR_TYPE_COLOR: Record<string, string> = { TEXT: '#3498db', ENUM: '#e67e22', REFERENCE: '#9b59b6', BOOLEAN: '#1abc9c', DATE: '#f39c12', INTEGER: '#e74c3c', DECIMAL: '#e74c3c' }

  if (!detail) return <div style={{ color: 'var(--text-dim)', padding: 40, textAlign: 'center' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>← Back</button>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: detail.color + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{detail.icon}</div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{detail.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{detail.code} · {detail.domain?.name || 'No domain'} · {detail.singularLabel} / {detail.pluralLabel}</div>
        </div>
        {detail.allowHierarchy && <span style={S.badge('#f39c12')}>🌳 Hierarchical</span>}
        <span style={S.badge(detail.classification === 'FRAMEWORK' ? '#3498db' : '#9b59b6')}>{detail.classification}</span>
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {(['overview','attributes','relationships'] as const).map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>{t.charAt(0).toUpperCase() + t.slice(1)}{t === 'attributes' ? ` (${detail.attributeDefs?.length || 0})` : ''}{t === 'relationships' ? ` (${(detail.sourceRelationships?.length || 0) + (detail.targetRelationships?.length || 0)})` : ''}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div style={S.grid2}>
          {[
            { label: 'Code', value: detail.code },
            { label: 'Semantic Type', value: detail.semanticType || '—' },
            { label: 'Domain', value: detail.domain?.name || 'Not assigned' },
            { label: 'Classification', value: detail.classification },
            { label: 'Singular Label', value: detail.singularLabel },
            { label: 'Plural Label', value: detail.pluralLabel },
            { label: 'Allow Hierarchy', value: detail.allowHierarchy ? 'Yes' : 'No' },
            { label: 'Allow Attachments', value: detail.allowAttachments ? 'Yes' : 'No' },
          ].map(f => (
            <div key={f.label} style={S.card}>
              <div style={S.label}>{f.label}</div>
              <div style={{ fontWeight: 500 }}>{f.value}</div>
            </div>
          ))}
          {detail.description && <div style={{ ...S.card, gridColumn: '1/-1' }}><div style={S.label}>Description</div><div>{detail.description}</div></div>}
        </div>
      )}

      {tab === 'attributes' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button style={S.btn('primary')} onClick={() => setShowAttrForm(!showAttrForm)}>+ Add Attribute</button>
          </div>
          {showAttrForm && (
            <div style={{ ...S.card, marginBottom: 16, borderColor: 'var(--accent)' }}>
              <div style={S.grid2}>
                <div><label style={S.label}>Code *</label><input style={S.input} value={attrForm.code} onChange={e => setAttrForm(f => ({ ...f, code: e.target.value }))} placeholder="criticality" /></div>
                <div><label style={S.label}>Name *</label><input style={S.input} value={attrForm.name} onChange={e => setAttrForm(f => ({ ...f, name: e.target.value }))} placeholder="Criticality" /></div>
                <div><label style={S.label}>Type</label>
                  <select style={S.input} value={attrForm.attributeType} onChange={e => setAttrForm(f => ({ ...f, attributeType: e.target.value }))}>
                    {ATTR_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                  </select>
                </div>
                <div><label style={S.label}>Help Text</label><input style={S.input} value={attrForm.helpText} onChange={e => setAttrForm(f => ({ ...f, helpText: e.target.value }))} /></div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                <input type="checkbox" id="req" checked={attrForm.isRequired} onChange={e => setAttrForm(f => ({ ...f, isRequired: e.target.checked }))} />
                <label htmlFor="req" style={{ fontSize: 13 }}>Required</label>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button style={S.btn()} onClick={() => setShowAttrForm(false)}>Cancel</button>
                  <button style={S.btn('primary')} onClick={addAttr}>Add Attribute</button>
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(detail.attributeDefs || []).length === 0 && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No attributes defined yet</div>}
            {(detail.attributeDefs || []).map((a: any) => (
              <div key={a.id} style={{ ...S.card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: ATTR_TYPE_COLOR[a.attributeType] || '#7f8c8d', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {a.name}
                    {a.isRequired && <span style={{ fontSize: 10, color: '#e74c3c', fontWeight: 700 }}>REQUIRED</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.code} · {a.attributeType.replace(/_/g,' ')}</div>
                </div>
                <button style={{ ...S.btn('danger'), padding: '3px 10px', fontSize: 11 }} onClick={() => deleteAttr(a.id)}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'relationships' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>Relationships where this object type is source or target</div>
          {[...( detail.sourceRelationships || []), ...(detail.targetRelationships || [])].length === 0
            ? <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>No relationships defined yet</div>
            : [...(detail.sourceRelationships || [])].map((r: any) => (
              <div key={r.id} style={{ ...S.card, padding: '10px 16px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{detail.name}</span>
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→ {r.forwardLabel} →</span>
                <span style={{ fontWeight: 600 }}>{r.targetType?.name}</span>
                <span style={{ ...S.badge('#1abc9c'), marginLeft: 'auto' }}>{r.cardinality?.replace(/_/g,' ')}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Relationships Manager ─────────────────────────────────────────────────────
function RelationshipsManager({ api }: { api: any }) {
  const [rels, setRels] = useState<any[]>([])
  const [types, setTypes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewMode, setViewMode] = useState<'list'|'matrix'>('list')
  const [matrix, setMatrix] = useState<any>(null)
  const [form, setForm] = useState({ code: '', name: '', sourceTypeId: '', targetTypeId: '', forwardLabel: '', reverseLabel: '', cardinality: 'MANY_TO_MANY', description: '' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([api.get('/meta-model/relationships'), api.get('/meta-model/object-types')]).then(([r, t]: any[]) => {
      setRels(Array.isArray(r) ? r : [])
      setTypes(Array.isArray(t) ? t : [])
      setLoading(false)
    })
  }, [api])

  const loadMatrix = useCallback(() => {
    api.get('/meta-model/relationships/matrix').then((m: any) => setMatrix(m))
  }, [api])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (viewMode === 'matrix') loadMatrix() }, [viewMode, loadMatrix])

  const save = async () => {
    if (!form.code || !form.sourceTypeId || !form.targetTypeId || !form.forwardLabel) return
    await api.post('/meta-model/relationships', form)
    setShowForm(false); setForm({ code: '', name: '', sourceTypeId: '', targetTypeId: '', forwardLabel: '', reverseLabel: '', cardinality: 'MANY_TO_MANY', description: '' })
    load(); if (viewMode === 'matrix') loadMatrix()
  }

  const remove = async (id: string) => {
    await api.del(`/meta-model/relationships/${id}`); load()
  }

  const CARDINALITIES = ['ONE_TO_ONE','ONE_TO_MANY','MANY_TO_ONE','MANY_TO_MANY']
  const CARD_COLOR: Record<string,string> = { ONE_TO_ONE: '#1abc9c', ONE_TO_MANY: '#3498db', MANY_TO_ONE: '#e67e22', MANY_TO_MANY: '#9b59b6' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Relationships</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Define allowed connections between object types</div>
        </div>
        <div style={S.row}>
          <div style={{ display: 'flex', gap: 2, background: 'var(--navy-light)', borderRadius: 8, padding: 2 }}>
            {(['list','matrix'] as const).map(m => <button key={m} style={{ ...S.btn(), padding: '5px 12px', background: viewMode === m ? 'var(--accent)' : 'none', color: viewMode === m ? '#0B1929' : 'var(--text-dim)' }} onClick={() => setViewMode(m)}>{m === 'list' ? '☰ List' : '⊞ Matrix'}</button>)}
          </div>
          <button style={S.btn('primary')} onClick={() => setShowForm(!showForm)}>+ Add Relationship</button>
        </div>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>New Relationship</div>
          <div style={S.grid2}>
            <div><label style={S.label}>Code *</label><input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CAP_SUPPORTED_BY_APP" /></div>
            <div><label style={S.label}>Name</label><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Capability supported by Application" /></div>
            <div><label style={S.label}>Source Type *</label>
              <select style={S.input} value={form.sourceTypeId} onChange={e => setForm(f => ({ ...f, sourceTypeId: e.target.value }))}>
                <option value="">Select source...</option>
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Target Type *</label>
              <select style={S.input} value={form.targetTypeId} onChange={e => setForm(f => ({ ...f, targetTypeId: e.target.value }))}>
                <option value="">Select target...</option>
                {types.map((t: any) => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Forward Label *</label><input style={S.input} value={form.forwardLabel} onChange={e => setForm(f => ({ ...f, forwardLabel: e.target.value }))} placeholder="supported by" /></div>
            <div><label style={S.label}>Reverse Label</label><input style={S.input} value={form.reverseLabel} onChange={e => setForm(f => ({ ...f, reverseLabel: e.target.value }))} placeholder="supports" /></div>
            <div><label style={S.label}>Cardinality</label>
              <select style={S.input} value={form.cardinality} onChange={e => setForm(f => ({ ...f, cardinality: e.target.value }))}>
                {CARDINALITIES.map(c => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button style={S.btn()} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={S.btn('primary')} onClick={save}>Create Relationship</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div> : viewMode === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rels.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No relationships defined yet</div>}
          {rels.map(r => (
            <div key={r.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 600, color: r.sourceType?.color || 'var(--text)' }}>{r.sourceType?.icon} {r.sourceType?.name}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 13 }}>→ <em>{r.forwardLabel}</em> →</span>
                  <span style={{ fontWeight: 600, color: r.targetType?.color || 'var(--text)' }}>{r.targetType?.icon} {r.targetType?.name}</span>
                  {r.reverseLabel && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>(↔ {r.reverseLabel})</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{r.code} · {r.classification}</div>
              </div>
              <span style={S.badge(CARD_COLOR[r.cardinality] || '#7f8c8d')}>{r.cardinality?.replace(/_/g,' ')}</span>
              {r.classification === 'CUSTOM' && <button style={{ ...S.btn('danger'), padding: '3px 10px', fontSize: 11 }} onClick={() => remove(r.id)}>✕</button>}
            </div>
          ))}
        </div>
      ) : (
        // Matrix view
        matrix ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', textAlign: 'left', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, position: 'sticky', left: 0 }}>Source ↓ / Target →</th>
                  {matrix.objectTypes?.map((ot: any) => (
                    <th key={ot.id} style={{ padding: '8px 10px', background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', minWidth: 100 }}>
                      {ot.icon} {ot.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.objectTypes?.map((source: any) => (
                  <tr key={source.id}>
                    <td style={{ padding: '8px 12px', background: 'var(--navy-light)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0 }}>{source.icon} {source.name}</td>
                    {matrix.objectTypes?.map((target: any) => {
                      const rels2 = matrix.matrix?.[source.id]?.[target.id] || []
                      return (
                        <td key={target.id} style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', borderLeft: '1px solid var(--border)', background: rels2.length > 0 ? 'rgba(0,180,216,0.08)' : 'transparent', textAlign: 'center', verticalAlign: 'top' }}>
                          {rels2.map((r: any) => (
                            <div key={r.id} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,180,216,0.2)', color: 'var(--accent)', marginBottom: 2, whiteSpace: 'nowrap' }}>{r.label}</div>
                          ))}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading matrix...</div>
      )}
    </div>
  )
}

// ── Visual Designer (SVG graph) ───────────────────────────────────────────────
function MetaModelDesigner({ api }: { api: any }) {
  const [graph, setGraph] = useState<{ nodes: any[], edges: any[] }>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({})
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState<{ mx: number; my: number; px: number; py: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [filterDomain, setFilterDomain] = useState<string>('')
  const svgRef = React.useRef<SVGSVGElement>(null)

  useEffect(() => {
    api.get('/meta-model/object-types/graph').then((g: any) => {
      if (g?.nodes) {
        setGraph(g)
        // Auto-layout: group by domain in columns
        const domainGroups: Record<string, any[]> = {}
        for (const n of g.nodes) { const d = n.domain || 'Other'; if (!domainGroups[d]) domainGroups[d] = []; domainGroups[d].push(n) }
        const pos: Record<string, { x: number; y: number }> = {}
        let colX = 80
        for (const [, nodes] of Object.entries(domainGroups)) {
          nodes.forEach((n, i) => { pos[n.id] = { x: colX, y: 80 + i * 90 } })
          colX += 200
        }
        setPositions(pos)
      }
      setLoading(false)
    })
  }, [api])

  const domains = [...new Set(graph.nodes.map(n => n.domain).filter(Boolean))] as string[]
  const filtered = { nodes: graph.nodes.filter(n => !filterDomain || n.domain === filterDomain), edges: graph.edges.filter(e => !filterDomain || (graph.nodes.find(n => n.id === e.source)?.domain === filterDomain || graph.nodes.find(n => n.id === e.target)?.domain === filterDomain)) }

  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const pos = positions[id] || { x: 100, y: 100 }
    setDragging({ id, ox: e.clientX - pos.x, oy: e.clientY - pos.y })
    setSelected(graph.nodes.find(n => n.id === id) || null)
  }

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return
    setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPositions(p => ({ ...p, [dragging.id]: { x: (e.clientX - dragging.ox) / zoom, y: (e.clientY - dragging.oy) / zoom } }))
    } else if (panStart) {
      setPan({ x: panStart.px + e.clientX - panStart.mx, y: panStart.py + e.clientY - panStart.my })
    }
  }

  const onMouseUp = () => { setDragging(null); setPanStart(null) }
  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); setZoom(z => Math.max(0.3, Math.min(2, z - e.deltaY * 0.001))) }

  const getEdgePath = (e: any) => {
    const s = positions[e.source]; const t = positions[e.target]
    if (!s || !t) return ''
    const mx = (s.x + 80 + t.x) / 2; const my = (s.y + 20 + t.y + 20) / 2
    return `M ${s.x + 80} ${s.y + 20} Q ${mx} ${my} ${t.x} ${t.y + 20}`
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 180px)', gap: 0 }}>
      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 10 }}>
        {/* Toolbar */}
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ ...S.input, maxWidth: 160, fontSize: 12 }} value={filterDomain} onChange={e => setFilterDomain(e.target.value)}>
            <option value="">All Domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 12 }} onClick={() => setZoom(z => Math.min(2, z + 0.1))}>+</button>
          <span style={{ fontSize: 12, color: 'var(--text-dim)', minWidth: 36, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 12 }} onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>−</button>
          <button style={{ ...S.btn(), padding: '4px 10px', fontSize: 12 }} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>⊡ Fit</button>
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{filtered.nodes.length} types · {filtered.edges.length} relationships</span>
        </div>

        {loading ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Loading graph...</div> : (
          <svg ref={svgRef} style={{ width: '100%', height: '100%', cursor: panStart ? 'grabbing' : dragging ? 'grabbing' : 'grab' }}
            onMouseDown={onSvgMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} onWheel={onWheel}>
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="8" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="rgba(0,180,216,0.5)" />
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {filtered.edges.map((e: any) => {
                const path = getEdgePath(e)
                if (!path) return null
                const s = positions[e.source]; const t = positions[e.target]
                const mx = s && t ? (s.x + 80 + t.x) / 2 : 0; const my = s && t ? (s.y + 20 + t.y + 20) / 2 : 0
                return (
                  <g key={e.id}>
                    <path d={path} stroke="rgba(0,180,216,0.3)" strokeWidth={1.5} fill="none" markerEnd="url(#arrow)" />
                    <text x={mx} y={my - 4} textAnchor="middle" fontSize={9} fill="rgba(139,170,200,0.8)">{e.label}</text>
                  </g>
                )
              })}
              {/* Nodes */}
              {filtered.nodes.map((n: any) => {
                const pos = positions[n.id] || { x: 100, y: 100 }
                const isSelected = selected?.id === n.id
                const domColor = n.domainColor || '#3498db'
                return (
                  <g key={n.id} data-node="true" transform={`translate(${pos.x},${pos.y})`} onMouseDown={e => onNodeMouseDown(e, n.id)} style={{ cursor: 'grab' }}>
                    <rect width={160} height={40} rx={8} fill="var(--navy-light)" stroke={isSelected ? 'var(--accent)' : domColor + '55'} strokeWidth={isSelected ? 2 : 1.5} />
                    <rect width={4} height={40} rx={2} fill={domColor} />
                    <text x={24} y={15} fontSize={16}>{n.icon}</text>
                    <text x={48} y={16} fontSize={11} fontWeight={600} fill="var(--text)">{n.name.length > 16 ? n.name.slice(0,15) + '…' : n.name}</text>
                    <text x={48} y={30} fontSize={9} fill="rgba(139,170,200,0.7)">{n.domain || 'No domain'}</text>
                    {n.allowHierarchy && <text x={148} y={14} fontSize={10}>🌳</text>}
                  </g>
                )
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Properties panel */}
      <div style={{ width: 240, background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, marginLeft: 12, padding: 16, overflowY: 'auto' as const, flexShrink: 0 }}>
        {selected ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{selected.icon} {selected.name}</div>
            {[
              { label: 'Code', value: selected.code },
              { label: 'Domain', value: selected.domain || '—' },
              { label: 'Semantic Type', value: selected.semanticType || '—' },
              { label: 'Hierarchy', value: selected.allowHierarchy ? 'Yes' : 'No' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 10 }}>
                <div style={S.label}>{f.label}</div>
                <div style={{ fontSize: 13 }}>{f.value}</div>
              </div>
            ))}
            <div style={S.label}>Connections</div>
            <div style={{ fontSize: 13 }}>
              {graph.edges.filter(e => e.source === selected.id || e.target === selected.id).length} relationships
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, textAlign: 'center', paddingTop: 40 }}>
            Click a node to see details.<br /><br />
            <span style={{ fontSize: 11 }}>Drag nodes to rearrange<br />Scroll to zoom<br />Drag background to pan</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Validation Panel ──────────────────────────────────────────────────────────
function ValidationPanel({ api }: { api: any }) {
  const [issues, setIssues] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [ran, setRan] = useState(false)

  const run = async () => {
    setLoading(true)
    const result = await api.post('/meta-model/validate')
    setIssues(Array.isArray(result) ? result : [])
    setLoading(false); setRan(true)
  }

  const SEV_COLOR: Record<string,string> = { ERROR: '#e74c3c', WARNING: '#f39c12', INFO: '#3498db' }
  const errors = issues.filter(i => i.severity === 'ERROR')
  const warnings = issues.filter(i => i.severity === 'WARNING')
  const infos = issues.filter(i => i.severity === 'INFO')

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>Meta-Model Validation</div><div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Check for errors, warnings, and improvements</div></div>
        <button style={S.btn('primary')} onClick={run} disabled={loading}>{loading ? '⏳ Validating...' : '▶ Run Validation'}</button>
      </div>

      {ran && (
        <>
          <div style={S.grid3}>
            {[{ label: 'Errors', count: errors.length, color: '#e74c3c' }, { label: 'Warnings', count: warnings.length, color: '#f39c12' }, { label: 'Info', count: infos.length, color: '#3498db' }].map(s => (
              <div key={s.label} style={{ ...S.statCard }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: s.color }}>{s.count}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {issues.length === 0 && <div style={{ ...S.card, textAlign: 'center', color: '#2ecc71', padding: 40, fontSize: 16 }}>✅ No issues found — meta-model is valid!</div>}
            {issues.map((issue, i) => (
              <div key={i} style={{ ...S.card, padding: '12px 16px', borderLeft: `3px solid ${SEV_COLOR[issue.severity]}` }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: SEV_COLOR[issue.severity], fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{issue.severity}</span>
                  <div>
                    <div style={{ fontWeight: 500 }}>{issue.message}</div>
                    {issue.resourceName && <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{issue.resourceType}: {issue.resourceName}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'monospace' }}>{issue.code}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!ran && <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 60 }}>Click "Run Validation" to check your meta-model for issues</div>}
    </div>
  )
}

// ── AI Advisor ────────────────────────────────────────────────────────────────
function AiAdvisor({ api }: { api: any }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [gaps, setGaps] = useState<string[]>([])
  const [loadingGaps, setLoadingGaps] = useState(false)

  const ask = async () => {
    if (!question.trim()) return
    setLoading(true); setAnswer('')
    const result = await api.post('/meta-model/ai/advise', { question })
    setAnswer(typeof result === 'string' ? result : result?.answer || JSON.stringify(result))
    setLoading(false)
  }

  const detectGaps = async () => {
    setLoadingGaps(true)
    const result = await api.get('/meta-model/ai/detect-gaps')
    setGaps(Array.isArray(result) ? result : [])
    setLoadingGaps(false)
  }

  const QUICK = ['Should I create separate object types for Application and Application Component?', 'What relationships should a Business Capability have?', 'How should I model government services in NORA 2.0?', 'What attributes should a Technology Component have?']

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>🤖 AI Meta-Model Advisor</div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 20 }}>Ask the AI for meta-model design advice based on your current configuration and EA best practices</div>

      <div style={S.card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: 'var(--text-dim)' }}>Quick Questions</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 16 }}>
          {QUICK.map(q => <button key={q} style={{ ...S.btn(), fontSize: 12, padding: '5px 12px' }} onClick={() => setQuestion(q)}>{q.length > 60 ? q.slice(0,58) + '…' : q}</button>)}
        </div>
        <textarea style={{ ...S.input, height: 80, resize: 'vertical' as const }} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask about your meta-model design..." />
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <button style={S.btn('primary')} onClick={ask} disabled={loading || !question.trim()}>{loading ? '⏳ Thinking...' : '💬 Ask AI'}</button>
        </div>
        {answer && (
          <div style={{ marginTop: 16, padding: 16, background: 'var(--navy)', borderRadius: 8, fontSize: 13, lineHeight: 1.7, borderLeft: '3px solid var(--accent)' }}>
            <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 8 }}>AI ADVISOR</div>
            {answer}
          </div>
        )}
      </div>

      <div style={{ ...S.card, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>🔍 Gap Detection</div>
          <button style={S.btn()} onClick={detectGaps} disabled={loadingGaps}>{loadingGaps ? '⏳ Analyzing...' : 'Detect Gaps'}</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 10 }}>AI analyzes your meta-model and identifies potential missing elements</div>
        {gaps.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gaps.map((g, i) => <div key={i} style={{ padding: '10px 14px', background: 'var(--navy)', borderRadius: 8, fontSize: 13, borderLeft: '3px solid #f39c12' }}>⚠ {g}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Versions Manager ──────────────────────────────────────────────────────────
function VersionsManager({ api }: { api: any }) {
  const [versions, setVersions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ version: '', description: '' })
  const [impact, setImpact] = useState<any>(null)

  const load = () => { setLoading(true); api.get('/meta-model/versions').then((v: any) => { setVersions(Array.isArray(v) ? v : []); setLoading(false) }) }
  useEffect(() => { load() }, [])

  const create = async () => {
    if (!form.version) return
    await api.post('/meta-model/versions', form)
    setShowForm(false); load()
  }

  const publish = async (id: string) => {
    if (!window.confirm('Publish this version? It will become the active meta-model.')) return
    await api.post(`/meta-model/versions/${id}/publish`, { force: false })
    load()
  }

  const loadImpact = (id: string) => { api.get(`/meta-model/versions/${id}/impact`).then(setImpact) }

  const STATUS_COLOR: Record<string,string> = { DRAFT: '#f39c12', PUBLISHED: '#2ecc71', DEPRECATED: '#7f8c8d', ARCHIVED: '#e74c3c' }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div><div style={{ fontSize: 18, fontWeight: 700 }}>Versions</div><div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Manage meta-model versions and publish changes</div></div>
        <button style={S.btn('primary')} onClick={() => setShowForm(!showForm)}>+ New Version</button>
      </div>

      {showForm && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: 'var(--accent)' }}>
          <div style={S.grid2}>
            <div><label style={S.label}>Version *</label><input style={S.input} value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="1.1" /></div>
            <div><label style={S.label}>Description</label><input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button style={S.btn()} onClick={() => setShowForm(false)}>Cancel</button>
            <button style={S.btn('primary')} onClick={create}>Create Version</button>
          </div>
        </div>
      )}

      {impact && (
        <div style={{ ...S.card, marginBottom: 20, borderColor: impact.canPublish ? '#2ecc71' : '#e74c3c' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Impact Analysis — v{impact.version}</div>
          <div style={S.grid3}>
            <div style={{ ...S.statCard }}><div style={S.label}>Breaking</div><div style={{ fontSize: 24, fontWeight: 700, color: '#e74c3c' }}>{impact.breaking.count}</div></div>
            <div style={{ ...S.statCard }}><div style={S.label}>Potentially Breaking</div><div style={{ fontSize: 24, fontWeight: 700, color: '#f39c12' }}>{impact.potentiallyBreaking.count}</div></div>
            <div style={{ ...S.statCard }}><div style={S.label}>Non-Breaking</div><div style={{ fontSize: 24, fontWeight: 700, color: '#2ecc71' }}>{impact.nonBreaking.count}</div></div>
          </div>
          <div style={{ marginTop: 12, color: impact.canPublish ? '#2ecc71' : '#e74c3c', fontWeight: 600, fontSize: 13 }}>
            {impact.canPublish ? '✅ Safe to publish' : '⚠ Breaking changes detected — review before publishing'}
          </div>
          <button style={{ ...S.btn(), marginTop: 8 }} onClick={() => setImpact(null)}>Close</button>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {versions.map(v => (
            <div key={v.id} style={{ ...S.card, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>v{v.version}</span>
                  <span style={S.badge(STATUS_COLOR[v.status] || '#7f8c8d')}>{v.status}</span>
                </div>
                {v.description && <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 2 }}>{v.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  {v._count?.domains || 0} domains · {v._count?.objectTypes || 0} types · {v._count?.relationships || 0} relationships
                  {v.publishedAt && ` · Published ${new Date(v.publishedAt).toLocaleDateString()}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...S.btn(), fontSize: 12, padding: '4px 12px' }} onClick={() => loadImpact(v.id)}>📊 Impact</button>
                {v.status === 'DRAFT' && <button style={{ ...S.btn('primary'), fontSize: 12, padding: '4px 12px' }} onClick={() => publish(v.id)}>🚀 Publish</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MetaModelPage() {
  const api = useMetaApi()
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard')
  const [selectedObjectType, setSelectedObjectType] = useState<any>(null)

  const loadStats = useCallback(() => {
    api.get('/meta-model/stats').then((s: any) => { setStats(s); setLoading(false) })
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const TABS = [
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'domains', label: '🗂 Domains' },
    { id: 'objects', label: '⬛ Object Types' },
    { id: 'relationships', label: '🔗 Relationships' },
    { id: 'designer', label: '🎨 Designer' },
    { id: 'validation', label: '✅ Validation' },
    { id: 'ai', label: '🤖 AI Advisor' },
    { id: 'versions', label: '📋 Versions' },
  ]

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-dim)' }}>Loading...</div>

  if (!stats?.model) return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>🏛 EA Meta-Model Studio</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Define and manage your Enterprise Architecture meta-model</div>
      </div>
      <SetupWizard api={api} onCreated={loadStats} />
    </div>
  )

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🏛 EA Meta-Model Studio</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{stats?.model?.name}</div>
        </div>
      </div>

      <div style={S.tabs}>
        {TABS.map(t => <button key={t.id} style={S.tab(tab === t.id)} onClick={() => { setTab(t.id); setSelectedObjectType(null) }}>{t.label}</button>)}
      </div>

      <div style={S.content}>
        {tab === 'dashboard' && <Dashboard stats={stats} onTab={t => setTab(t)} />}
        {tab === 'domains' && <DomainsManager api={api} />}
        {tab === 'objects' && !selectedObjectType && <ObjectTypesList api={api} onSelect={ot => setSelectedObjectType(ot)} />}
        {tab === 'objects' && selectedObjectType && <ObjectTypeEditor api={api} objectType={selectedObjectType} onBack={() => setSelectedObjectType(null)} />}
        {tab === 'relationships' && <RelationshipsManager api={api} />}
        {tab === 'designer' && <MetaModelDesigner api={api} />}
        {tab === 'validation' && <ValidationPanel api={api} />}
        {tab === 'ai' && <AiAdvisor api={api} />}
        {tab === 'versions' && <VersionsManager api={api} />}
      </div>
    </div>
  )
}
