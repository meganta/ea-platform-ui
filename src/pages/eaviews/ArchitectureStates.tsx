import React from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'

// ── Architecture states (Current / Transition / Target) ─────────────────
//
// GET /ea-views/:id/states returns the view's lines of change: Current,
// its Transitions, then a Target, one line per programme. People pick a
// state, not a scenario; comparison and evolution only ever pair two
// states on the same line, so an unrelated scenario is never offered.

export interface StateEntry { scenarioId: string; name: string; label: 'CURRENT' | 'TRANSITION' | 'TARGET'; transitionNumber?: number; status: string; horizonDate: string | null }
export interface StateLine { id: string; programme: string | null; states: StateEntry[] }

export function stateTitle(s: StateEntry, t: (k: string) => string): string {
  if (s.label === 'CURRENT') return t('eaviews.state_current')
  if (s.label === 'TARGET') return t('eaviews.state_target')
  return `${t('eaviews.state_transition')} ${s.transitionNumber ?? ''}`.trim()
}

// Every state on any line, once (Current is on every line).
export function allStates(lines: StateLine[]): StateEntry[] {
  const seen = new Map<string, StateEntry>()
  for (const l of lines) for (const s of l.states) if (!seen.has(s.scenarioId)) seen.set(s.scenarioId, s)
  return [...seen.values()]
}

// States that can be compared with `fromId`: later states on any line that
// contains it.
export function comparableWith(lines: StateLine[], fromId: string): StateEntry[] {
  const out = new Map<string, StateEntry>()
  for (const l of lines) {
    const i = l.states.findIndex(s => s.scenarioId === fromId)
    if (i < 0) continue
    for (const s of l.states.slice(i + 1)) out.set(s.scenarioId, s)
  }
  return [...out.values()]
}

export function StateMenu({ lines, activeId, onPick }: { lines: StateLine[]; activeId: string | null; onPick: (scenarioId: string) => void }) {
  const { t } = useLang()
  return (
    <div data-testid="state-menu">
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {t('eaviews.states_title')}
        <HelpTip text={t('eaviews.states_help')} />
      </div>
      {lines.map(line => (
        <div key={line.id} style={{ marginBottom: 8 }}>
          {line.programme && <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', padding: '2px 8px' }}>{line.programme}</div>}
          {line.states.map(s => {
            const active = s.scenarioId === activeId
            return (
              <button key={s.scenarioId} type="button" disabled={active} onClick={() => onPick(s.scenarioId)}
                aria-current={active ? 'true' : undefined}
                style={{ display: 'flex', width: '100%', alignItems: 'baseline', gap: 6, padding: '5px 8px', borderRadius: 6, borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', textAlign: 'start' as const, cursor: active ? 'default' : 'pointer', background: active ? 'var(--navy-mid)' : 'transparent', color: 'var(--text)' }}>
                <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' as const }}>{stateTitle(s, t)}</span>
                {s.label !== 'CURRENT' && <span style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>}
                {s.status === 'DRAFT' && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({t('eaviews.state_draft')})</span>}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export interface Evolution {
  from: StateEntry; to: StateEntry; programme: string | null
  summary: { introduced: number; retired: number; restored: number; modified: number; unchanged: number; relationshipsAdded: number; relationshipsRemoved: number }
  items: Array<{ objectId: string; name: string; assetType: string; change: 'INTRODUCED' | 'RETIRED' | 'RESTORED' | 'MODIFIED'; propertyChanges?: Array<{ property: string; before: any; after: any }> }>
}

const CHANGE_KEYS: Array<[Evolution['items'][number]['change'], keyof Evolution['summary'], string]> = [
  ['INTRODUCED', 'introduced', 'eaviews.evo_introduced'],
  ['RETIRED', 'retired', 'eaviews.evo_retired'],
  ['RESTORED', 'restored', 'eaviews.evo_restored'],
  ['MODIFIED', 'modified', 'eaviews.evo_modified'],
]

export function EvolutionSummary({ evolution }: { evolution: Evolution }) {
  const { t } = useLang()
  const [open, setOpen] = React.useState<string | null>(null)
  const { summary } = evolution
  return (
    <section data-testid="evolution" aria-label={t('eaviews.evo_title')} style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
        {t('eaviews.evo_title')}: {stateTitle(evolution.from, t)} → {stateTitle(evolution.to, t)}
        {evolution.programme && <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-dim)' }}>({evolution.programme})</span>}
        <HelpTip text={t('eaviews.evo_help')} />
      </div>
      <div className="stat-grid-4">
        {CHANGE_KEYS.map(([change, key, label]) => (
          <button key={change} type="button" onClick={() => setOpen(o => o === change ? null : change)} aria-expanded={open === change}
            style={{ textAlign: 'start' as const, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: open === change ? 'var(--navy-mid)' : 'transparent', color: 'var(--text)', cursor: 'pointer' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{summary[key]}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t(label)}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>
        {t('eaviews.evo_relationships')}: +{summary.relationshipsAdded} / −{summary.relationshipsRemoved} · {t('eaviews.evo_unchanged')}: {summary.unchanged}
      </div>
      {open && (
        <ul data-testid="evolution-items" style={{ margin: '10px 0 0', paddingInlineStart: 18, fontSize: 13 }}>
          {evolution.items.filter(i => i.change === open).map(i => (
            <li key={i.objectId} style={{ marginBottom: 4 }}>
              <strong>{i.name}</strong> <span style={{ color: 'var(--text-dim)' }}>({i.assetType})</span>
              {i.propertyChanges && i.propertyChanges.length > 0 && (
                <span style={{ color: 'var(--text-dim)' }}> · {i.propertyChanges.map(p => `${p.property.replace(/^metadata\./, '')}: ${p.before ?? '—'} → ${p.after ?? '—'}`).join('; ')}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
