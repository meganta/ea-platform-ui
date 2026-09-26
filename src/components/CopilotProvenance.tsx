import { useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

/**
 * "Based on" provenance for a Copilot answer (Tenant Intelligence P6).
 * Shows WHICH ArchMind records the answer used, grouped by module, whether
 * each is a recorded fact, a derived join/path, or a document, the answer
 * basis the server derived from that evidence, and - collapsed - how the
 * question was routed. It never shows model reasoning: everything here comes
 * from the evidence items and the content-free trace the API returns.
 */

export interface ProvenanceEvidence {
  sourceType: string
  sourceId: string
  title: string
  module?: string
  evidenceType?: string
  groundingType?: string
  authorityRole?: 'PRIMARY' | 'LINKED' | 'SUPPLEMENTARY'
}

export interface ProvenanceTrace {
  intent: string
  intentSource?: string
  primaryModule: string | null
  temporal: string
  modulesExecuted: string[]
  steps?: Array<{ id: string; module: string; capability: string; status: 'OK' | 'DENIED' | 'FAILED' | 'SKIPPED' }>
  conflictCount?: number
  missingCount?: number
  answerQuality?: 'HIGH' | 'MEDIUM' | 'LOW' | null
}

const MODULE_ORDER = ['ADM', 'REPOSITORY', 'SCENARIO', 'GOVERNANCE', 'PLANNING', 'DECISIONS', 'VIEWS', 'KNOWLEDGE', 'META_MODEL']

/** Module for an item: the server's own label when present, else derived from the legacy source type. */
export function evidenceModule(item: ProvenanceEvidence): string {
  if (item.module) return item.module
  switch (item.sourceType) {
    case 'GOVERNANCE_REVIEW': return 'GOVERNANCE'
    case 'DOCUMENT': return 'KNOWLEDGE'
    case 'META_MODEL': return 'META_MODEL'
    default: return 'REPOSITORY'
  }
}

export type EvidenceKind = 'recorded' | 'derived' | 'document'

export function evidenceKind(item: ProvenanceEvidence): EvidenceKind {
  const type = item.evidenceType || item.groundingType || ''
  if (type === 'DOCUMENT_EVIDENCE' || item.sourceType === 'DOCUMENT') return 'document'
  if (type === 'DERIVED_PATH' || type === 'ADM_DERIVED' || item.sourceType === 'DERIVED_PATH') return 'derived'
  return 'recorded'
}

const KIND_STYLE: Record<EvidenceKind, { fg: string; bg: string }> = {
  recorded: { fg: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  derived: { fg: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  document: { fg: '#eab308', bg: 'rgba(234,179,8,0.12)' },
}
const QUALITY_STYLE: Record<'HIGH' | 'MEDIUM' | 'LOW', { fg: string; bg: string }> = {
  HIGH: { fg: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  MEDIUM: { fg: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  LOW: { fg: '#f97316', bg: 'rgba(249,115,22,0.12)' },
}

const chip = (fg: string, bg: string) => ({ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, color: fg, background: bg, whiteSpace: 'nowrap' as const })

export default function CopilotProvenance({ evidence, trace }: { evidence?: ProvenanceEvidence[]; trace?: ProvenanceTrace | null }) {
  const { t, isAR } = useLang()
  const [showHow, setShowHow] = useState(false)
  const items = evidence || []
  const moduleOwned = !!trace && trace.intent !== 'NONE'
  if (items.length === 0 && !moduleOwned) return null

  const byModule = new Map<string, ProvenanceEvidence[]>()
  for (const item of items) {
    const m = evidenceModule(item)
    byModule.set(m, [...(byModule.get(m) || []), item])
  }
  const modules = [...byModule.keys()].sort((a, b) => {
    const pa = trace?.primaryModule === a ? -1 : MODULE_ORDER.indexOf(a)
    const pb = trace?.primaryModule === b ? -1 : MODULE_ORDER.indexOf(b)
    return pa - pb
  })
  const kinds = (['recorded', 'derived', 'document'] as EvidenceKind[])
    .map(kind => ({ kind, count: items.filter(i => evidenceKind(i) === kind).length }))
    .filter(k => k.count > 0)
  const quality = trace?.answerQuality || null
  const moduleLabel = (m: string) => t(`copilot.prov.module.${m}`)

  return (
    <div dir={isAR ? 'rtl' : 'ltr'} className="copilot-provenance" data-testid="copilot-provenance"
      style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy-light)', fontSize: 12, maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600 }}>{t('copilot.prov.based_on')}</span>
        <HelpTip text={t('copilot.prov.help')} />
        {modules.map(m => (
          <span key={m} style={chip(trace?.primaryModule === m ? 'var(--accent)' : 'var(--text-dim)', 'rgba(148,163,184,0.12)')}
            title={byModule.get(m)!.slice(0, 5).map(i => i.title).join('\n')}>
            {moduleLabel(m)} · {byModule.get(m)!.length}
          </span>
        ))}
        {quality && (
          <span style={{ ...chip(QUALITY_STYLE[quality].fg, QUALITY_STYLE[quality].bg), marginInlineStart: 'auto' }} data-testid="copilot-provenance-quality">
            {t('copilot.prov.basis')}: {t(`copilot.prov.basis.${quality}`)}
          </span>
        )}
      </div>

      {kinds.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {kinds.map(k => <span key={k.kind} style={chip(KIND_STYLE[k.kind].fg, KIND_STYLE[k.kind].bg)}>{t(`copilot.prov.kind.${k.kind}`)} · {k.count}</span>)}
        </div>
      )}

      {moduleOwned && (
        <div style={{ marginTop: 6 }}>
          <button type="button" onClick={() => setShowHow(s => !s)} aria-expanded={showHow}
            style={{ fontSize: 11, color: 'var(--accent)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: 'none', padding: 0, cursor: 'pointer' }}>
            {t('copilot.prov.how_answered')} {showHow ? '▲' : '▼'}
          </button>
          {showHow && (
            <dl className="copilot-provenance-how" style={{ margin: '6px 0 0', display: 'grid', gridTemplateColumns: 'minmax(110px, max-content) 1fr', gap: '3px 10px', fontSize: 11.5 }}>
              <dt style={{ color: 'var(--text-dim)' }}>{t('copilot.prov.question_type')}</dt>
              <dd style={{ margin: 0 }}>{t(`copilot.prov.intent.${trace!.intent}`)}</dd>
              {trace!.temporal && trace!.temporal !== 'UNSPECIFIED' && <>
                <dt style={{ color: 'var(--text-dim)' }}>{t('copilot.prov.time')}</dt>
                <dd style={{ margin: 0 }}>{t(`copilot.prov.temporal.${trace!.temporal}`)}</dd>
              </>}
              <dt style={{ color: 'var(--text-dim)' }}>{t('copilot.prov.modules')}</dt>
              <dd style={{ margin: 0 }}>
                {(trace!.steps || []).length > 0
                  ? trace!.steps!.map(s => (
                    <span key={s.id} style={{ display: 'inline-block', marginInlineEnd: 8 }}>
                      {moduleLabel(s.module)} <span style={{ color: s.status === 'OK' ? 'var(--text-dim)' : '#f97316' }}>({t(`copilot.prov.step.${s.status}`)})</span>
                    </span>))
                  : trace!.modulesExecuted.map(moduleLabel).join(', ')}
              </dd>
              {!!trace!.conflictCount && <>
                <dt style={{ color: 'var(--text-dim)' }}>{t('copilot.prov.conflicts')}</dt>
                <dd style={{ margin: 0 }}>{trace!.conflictCount}</dd>
              </>}
              {!!trace!.missingCount && <>
                <dt style={{ color: 'var(--text-dim)' }}>{t('copilot.prov.not_recorded')}</dt>
                <dd style={{ margin: 0 }}>{trace!.missingCount}</dd>
              </>}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}
