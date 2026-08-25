import React, { useState, useEffect } from 'react'

const S_LOCAL = {
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
}

export interface RelationshipHop {
  relationshipType: string
  direction: 'FORWARD' | 'REVERSE'
  targetAssetType: string
  // Display-only fields, not sent to the backend (which only needs the
  // three fields above), but kept alongside each hop so the built path
  // can render human-readable labels without a second lookup.
  label?: string
  targetTypeName?: string
}

interface RelationshipOption {
  relationshipType: string
  direction: 'FORWARD' | 'REVERSE'
  targetAssetType: string
  targetTypeName?: string
  label: string
  sampleCount: number
}

// Visual, stepwise relationship path builder: pick a starting object type,
// see the relationship options that actually have real data behind them
// (via GET /ea-views/relationship-options - data-driven, not just
// theoretical meta-model definitions, see that endpoint's backend doc
// comment), pick one, land on the next type, repeat. Each step is
// validated against real data by construction - there's no way to build
// an invalid hop through this UI, since the options list only ever
// contains hops confirmed to have EaAssetRelationship rows behind them.
export function PathBuilder({ api, rootType, initialPath, onChange }: { api: any; rootType: string; initialPath: RelationshipHop[]; onChange: (path: RelationshipHop[]) => void }) {
  const [path, setPath] = useState<RelationshipHop[]>(initialPath)
  const [options, setOptions] = useState<RelationshipOption[]>([])
  const [loading, setLoading] = useState(false)

  const currentType = path.length > 0 ? path[path.length - 1].targetAssetType : rootType

  useEffect(() => {
    if (!currentType) { setOptions([]); return }
    setLoading(true)
    api.get(`/ea-views/relationship-options?sourceType=${encodeURIComponent(currentType)}`)
      .then((opts: any) => { setOptions(Array.isArray(opts) ? opts : []); setLoading(false) })
      .catch(() => { setOptions([]); setLoading(false) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentType, api])

  const addHop = (opt: RelationshipOption) => {
    const next = [...path, { relationshipType: opt.relationshipType, direction: opt.direction, targetAssetType: opt.targetAssetType, label: opt.label, targetTypeName: opt.targetTypeName }]
    setPath(next)
    onChange(next)
  }

  const removeFromStep = (index: number) => {
    const next = path.slice(0, index)
    setPath(next)
    onChange(next)
  }

  if (!rootType) {
    return <div style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 20 }}>Select a root object type first to build a relationship path.</div>
  }

  // No own title or outer card wrapper here - the one and only caller
  // (ViewBuilder's "Relationship Path" section) already provides both,
  // and doubling either up reads as a genuine, confusing UI redundancy
  // (two "Relationship Path" headings, a card nested inside a card), not
  // just a test artifact - caught by a test asserting on a single
  // occurrence of the heading text.
  return (
    <>
      {/* Breadcrumb of the path built so far */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16 }}>
        <span style={S_LOCAL.badge('#3498db')}>{rootType.replace(/_/g, ' ')}</span>
        {path.map((hop, i) => (
          <React.Fragment key={i}>
            <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>→ {hop.label || hop.relationshipType} →</span>
            <span style={S_LOCAL.badge('#2ecc71')}>{(hop.targetTypeName || hop.targetAssetType).replace(/_/g, ' ')}</span>
            <button style={{ ...S_LOCAL.btn('danger'), padding: '1px 8px', fontSize: 10 }} onClick={() => removeFromStep(i)} title="Remove this hop and everything after it">✕</button>
          </React.Fragment>
        ))}
        {path.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>(single-level view - add a hop below to walk further)</span>}
      </div>

      {/* Next-hop picker */}
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
        {path.length >= 6 ? 'Maximum path depth reached (6 hops).' : `Add a hop from ${currentType.replace(/_/g, ' ')}:`}
      </div>
      {path.length < 6 && (
        loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading relationship options...</div>
        : options.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No relationships found from this object type in the repository yet.</div>
        : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            {options.map((opt, i) => (
              <button key={i} onClick={() => addHop(opt)} style={{ ...S_LOCAL.btn(), fontSize: 12, textAlign: 'left', display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-start', gap: 2 }}>
                <span>{opt.direction === 'FORWARD' ? '→' : '←'} {opt.label}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{(opt.targetTypeName || opt.targetAssetType).replace(/_/g, ' ')} ({opt.sampleCount})</span>
              </button>
            ))}
          </div>
        )
      )}
    </>
  )
}
