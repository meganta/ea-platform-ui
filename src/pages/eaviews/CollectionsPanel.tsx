import React, { useState, useEffect } from 'react'

const S_LOCAL = {
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none' },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
}

// ── List view: every collection as a card, + a create flow ─────────────────
export function CollectionsPanel({ api, onOpenView }: { api: any; onOpenView: (view: any) => void }) {
  const [collections, setCollections] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/ea-views/collections').then((d: any) => { setCollections(Array.isArray(d) ? d : []); setLoading(false) })
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createCollection = async () => {
    if (!newName.trim()) return
    await api.post('/ea-views/collections', { name: newName.trim(), description: newDescription.trim() || undefined, category: newCategory.trim() || undefined })
    setCreating(false)
    setNewName(''); setNewDescription(''); setNewCategory('')
    load()
  }

  const deleteCollection = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!window.confirm('Delete this Architecture Pack? Views in it are not deleted, only the grouping.')) return
    await api.del(`/ea-views/collections/${id}`)
    load()
  }

  if (openId) {
    const collection = collections.find(c => c.id === openId)
    return <CollectionDetail api={api} collectionId={openId} initial={collection} onBack={() => { setOpenId(null); load() }} onOpenView={onOpenView} />
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Architecture Packs</div>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Group related views together — Executive Pack, Application Rationalization Pack, Target Architecture Pack</div>
        </div>
        <button style={S_LOCAL.btn('primary')} onClick={() => setCreating(true)}>+ New Pack</button>
      </div>

      {creating && (
        <div style={{ ...S_LOCAL.card, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>New Architecture Pack</div>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Name *</label>
            <input style={S_LOCAL.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Executive Pack" autoFocus />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={S_LOCAL.label}>Description</label>
            <input style={S_LOCAL.input} value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="What this pack is for" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={S_LOCAL.label}>Category</label>
            <input style={S_LOCAL.input} value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="e.g. Executive, Application Rationalization" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S_LOCAL.btn('primary')} disabled={!newName.trim()} onClick={createCollection}>Create</button>
            <button style={S_LOCAL.btn()} onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div>
        : collections.length === 0 ? <div style={{ ...S_LOCAL.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No Architecture Packs yet. Create one to group related views together.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {collections.map(c => (
              <div key={c.id} style={{ ...S_LOCAL.card, cursor: 'pointer' }} onClick={() => setOpenId(c.id)}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                  <button style={{ ...S_LOCAL.btn('danger'), padding: '2px 8px', fontSize: 11 }} onClick={(e) => deleteCollection(e, c.id)}>✕</button>
                </div>
                {c.category && <span style={{ ...S_LOCAL.badge('#3498db'), marginBottom: 8, display: 'inline-block' }}>{c.category}</span>}
                {c.description && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10 }}>{c.description}</div>}
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{(c.items || []).length} view{(c.items || []).length === 1 ? '' : 's'}</div>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}

// ── Detail view: manage a single collection's member views ─────────────────
function CollectionDetail({ api, collectionId, initial, onBack, onOpenView }: { api: any; collectionId: string; initial: any; onBack: () => void; onOpenView: (view: any) => void }) {
  const [collection, setCollection] = useState<any>(initial || null)
  const [loading, setLoading] = useState(!initial)
  const [allViews, setAllViews] = useState<any[]>([])
  const [showAddPicker, setShowAddPicker] = useState(false)

  const load = () => {
    setLoading(true)
    api.get(`/ea-views/collections/${collectionId}`).then((d: any) => { setCollection(d); setLoading(false) })
  }
  useEffect(load, [collectionId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/ea-views').then((d: any) => setAllViews(Array.isArray(d) ? d : [])) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const addView = async (viewId: string) => {
    setShowAddPicker(false)
    await api.post(`/ea-views/collections/${collectionId}/views`, { viewId })
    load()
  }
  const removeView = async (viewId: string) => {
    await api.del(`/ea-views/collections/${collectionId}/views/${viewId}`)
    load()
  }
  const moveItem = async (index: number, dir: -1 | 1) => {
    const items = collection.items || []
    const swapIndex = index + dir
    if (swapIndex < 0 || swapIndex >= items.length) return
    const reordered = [...items]
    ;[reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]]
    const orderedViewIds = reordered.map((it: any) => it.viewId)
    setCollection({ ...collection, items: reordered }) // optimistic
    await api.put(`/ea-views/collections/${collectionId}/reorder`, { orderedViewIds })
  }

  if (loading || !collection) return <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 40 }}>Loading...</div>

  const memberViewIds = new Set((collection.items || []).map((it: any) => it.viewId))
  const availableViews = allViews.filter(v => !memberViewIds.has(v.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button style={S_LOCAL.btn()} onClick={onBack}>← Back</button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{collection.name}</div>
          {collection.description && <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>{collection.description}</div>}
        </div>
        <button style={{ ...S_LOCAL.btn('primary'), marginLeft: 'auto' }} onClick={() => setShowAddPicker(v => !v)}>+ Add View</button>
      </div>

      {showAddPicker && (
        <div style={{ ...S_LOCAL.card, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add a view to this pack</div>
          {availableViews.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Every view is already in this pack.</div> : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, maxHeight: 240, overflowY: 'auto' as const }}>
              {availableViews.map(v => (
                <div key={v.id} onClick={() => addView(v.id)} style={{ padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(3,105,161,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{v.name}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {(collection.items || []).length === 0 ? (
        <div style={{ ...S_LOCAL.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>No views in this pack yet.</div>
      ) : (
        (collection.items || []).map((item: any, i: number) => (
          <div key={item.id} style={{ ...S_LOCAL.card, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onOpenView(item.view)}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{item.view?.name || '(view not found)'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.view?.category} · {item.view?.visualization}</div>
            </div>
            <button style={{ ...S_LOCAL.btn(), padding: '3px 8px', fontSize: 11 }} disabled={i === 0} onClick={() => moveItem(i, -1)}>↑</button>
            <button style={{ ...S_LOCAL.btn(), padding: '3px 8px', fontSize: 11 }} disabled={i === (collection.items.length - 1)} onClick={() => moveItem(i, 1)}>↓</button>
            <button style={{ ...S_LOCAL.btn('danger'), padding: '3px 8px', fontSize: 11 }} onClick={() => removeView(item.viewId)}>Remove</button>
          </div>
        ))
      )}
    </div>
  )
}
