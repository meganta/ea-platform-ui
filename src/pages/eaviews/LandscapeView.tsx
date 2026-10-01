import React from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'

// ── Landscape ────────────────────────────────────────────────────────────
//
// A landscape lays the primary objects of a view out in groups, so a
// portfolio can be read at a glance: applications grouped by the
// capability they support, data grouped by the application that uses it.
// The grouping comes from the view's own relationships (each primary
// object appears under every related object it is linked to, never
// guessed); objects with no such link are shown in their own group, so a
// gap is visible rather than hidden. Without any relationships, objects
// are grouped by lifecycle.

export interface LandscapeNode { id: string; name: string; assetType: string; status?: string; metadata?: Record<string, any> }
export interface LandscapeEdge { sourceId: string; targetId: string }
export interface LandscapeGroup { key: string; label: string; items: LandscapeNode[]; unlinked?: boolean }

export const UNLINKED_KEY = '__unlinked__'

export function lifecycleOf(n: LandscapeNode): string {
  return (n.metadata?.lifecycleStatus as string) || n.status || 'UNKNOWN'
}

export function buildLandscape(nodes: LandscapeNode[], edges: LandscapeEdge[], primaryIds: Set<string>): { groupedBy: 'RELATED' | 'LIFECYCLE'; groups: LandscapeGroup[] } {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const primaries = nodes.filter(n => primaryIds.has(n.id))
  const groups = new Map<string, LandscapeGroup>()
  const linked = new Set<string>()
  for (const e of edges) {
    const [p, r] = primaryIds.has(e.sourceId) && !primaryIds.has(e.targetId) ? [e.sourceId, e.targetId]
      : primaryIds.has(e.targetId) && !primaryIds.has(e.sourceId) ? [e.targetId, e.sourceId] : [null, null]
    if (!p || !r) continue
    const prim = byId.get(p), rel = byId.get(r)
    if (!prim || !rel) continue
    const g = groups.get(rel.id) || { key: rel.id, label: rel.name, items: [] }
    if (!g.items.some(i => i.id === prim.id)) g.items.push(prim)
    groups.set(rel.id, g)
    linked.add(prim.id)
  }
  if (groups.size > 0) {
    const sorted = [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label))
    const unlinked = primaries.filter(p => !linked.has(p.id))
    if (unlinked.length > 0) sorted.push({ key: UNLINKED_KEY, label: '', items: unlinked, unlinked: true })
    for (const g of sorted) g.items.sort((a, b) => a.name.localeCompare(b.name))
    return { groupedBy: 'RELATED', groups: sorted }
  }
  const byLifecycle = new Map<string, LandscapeGroup>()
  for (const p of primaries) {
    const k = lifecycleOf(p)
    const g = byLifecycle.get(k) || { key: k, label: k.replace(/_/g, ' '), items: [] }
    g.items.push(p)
    byLifecycle.set(k, g)
  }
  const groupsOut = [...byLifecycle.values()].sort((a, b) => b.items.length - a.items.length)
  for (const g of groupsOut) g.items.sort((a, b) => a.name.localeCompare(b.name))
  return { groupedBy: 'LIFECYCLE', groups: groupsOut }
}

export function LandscapeView({ nodes, edges, primaryIds, onSelect }: { nodes: LandscapeNode[]; edges: LandscapeEdge[]; primaryIds: Set<string>; onSelect: (n: LandscapeNode) => void }) {
  const { t } = useLang()
  const { groupedBy, groups } = buildLandscape(nodes, edges, primaryIds)
  if (groups.length === 0) return null
  return (
    <div data-testid="landscape">
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        {groupedBy === 'RELATED' ? t('eaviews.landscape_by_related') : t('eaviews.landscape_by_lifecycle')}
        <HelpTip text={t('eaviews.landscape_help')} />
      </div>
      <div className="landscape-grid">
        {groups.map(g => (
          <section key={g.key} className="landscape-group" aria-label={g.unlinked ? t('eaviews.landscape_unlinked') : g.label}>
            <header className="landscape-group-title">
              <span>{g.unlinked ? t('eaviews.landscape_unlinked') : g.label}</span>
              <span className="landscape-count">{g.items.length}</span>
            </header>
            <div className="landscape-items">
              {g.items.map(n => (
                <button key={n.id} type="button" className="landscape-item" onClick={() => onSelect(n)} title={`${n.name} · ${lifecycleOf(n).replace(/_/g, ' ')}`}>
                  {n.name}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
