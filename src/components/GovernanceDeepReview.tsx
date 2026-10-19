import React from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

// Governance deep review (AI policy DEEP / EXHAUSTIVE for the review type).
// It runs inside the review before the report is written, so its changes are
// already in the findings, the decision and the exports; this note says what
// it changed (report.domainSummaries._deepReview). Scores are never touched.

export interface DeepReviewRecord {
  status: string
  level?: string
  model?: string | null
  summary?: string
  verdict?: { decision: string; rationale?: string; confidence?: string; conditions?: string[]; dissent?: string[] } | null
  added?: Array<{ title: string; domain: string; severity: string; evidence?: string[] }>
  lowered?: Array<{ title: string; domain: string; from: string; to: string; reason: string }>
  withdrawn?: Array<{ title: string; domain: string; severity: string; reason: string }>
  confirmed?: number
  openQuestions?: string[]
  limitations?: string[]
  steps?: number
  lookups?: number
  costSar?: number
}

const chip: React.CSSProperties = { fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'var(--accent)22', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap' }

/** Marks a finding the deep review raised. */
export function DeepReviewBadge() {
  const { t } = useLang()
  return <span style={chip} title={t('deepwork.gov.badge_help')}>{t('deepwork.gov.badge')}</span>
}

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''))

export default function GovernanceDeepReviewNote({ record }: { record: DeepReviewRecord }) {
  const { t, isAR } = useLang()
  const done = record.status === 'COMPLETED'
  const added = record.added || [], lowered = record.lowered || [], withdrawn = record.withdrawn || []
  const decision = record.verdict?.decision
  const decisionLabel = decision ? t(`deepwork.decision.${decision}`) : null
  const section = (title: string, items: React.ReactNode[]) => items.length > 0 && (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, lineHeight: 1.6 }}>{items}</ul>
    </div>
  )

  return (
    <div className="card" dir={isAR ? 'rtl' : 'ltr'} data-testid="gov-deep-review" style={{ marginBottom: 16, borderInlineStart: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{t('deepwork.gov.title')}</strong>
        <HelpTip text={t('deepwork.gov.help')} />
        {record.level && <span style={{ ...chip, background: 'var(--navy-mid)', color: 'var(--text-dim)' }}>{t('deepwork.level')}: {t(`aipolicy.level.${record.level}`)}</span>}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginInlineStart: 'auto' }}>
          {fill(t('deepwork.gov.effort'), { steps: record.steps ?? 0, lookups: record.lookups ?? 0 })}{typeof record.costSar === 'number' && record.costSar > 0 ? ` · ${record.costSar.toFixed(2)} SAR` : ''}
        </span>
      </div>

      {!done ? (
        <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-dim)' }}>{t('deepwork.gov.not_completed')}</div>
      ) : (
        <>
          <div className="stat-grid-4" style={{ marginTop: 12 }}>
            {([['added', added.length], ['lowered', lowered.length], ['withdrawn', withdrawn.length], ['confirmed', record.confirmed ?? 0]] as const).map(([k, n]) => (
              <div key={k} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--navy-mid)' }}>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{n}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t(`deepwork.gov.count.${k}`)}</div>
              </div>
            ))}
          </div>
          {decisionLabel && (
            <div style={{ marginTop: 12, fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('deepwork.gov.recommended')}: </span><strong>{decisionLabel}</strong>
              {record.verdict?.rationale && <div style={{ marginTop: 4, color: 'var(--text-dim)' }}>{record.verdict.rationale}</div>}
            </div>
          )}
          {section(t('deepwork.conditions'), (record.verdict?.conditions || []).map((c, i) => <li key={i}>{c}</li>))}
          {section(t('deepwork.gov.added'), added.map((f, i) => <li key={i}><strong>{f.severity}</strong> · {f.title}{f.evidence?.length ? <span style={{ color: 'var(--text-muted)' }}> [{f.evidence.join(', ')}]</span> : null}</li>))}
          {section(t('deepwork.gov.lowered'), lowered.map((f, i) => <li key={i}>{f.title}: {f.from} → {f.to} <span style={{ color: 'var(--text-muted)' }}>- {f.reason}</span></li>))}
          {section(t('deepwork.gov.withdrawn'), withdrawn.map((f, i) => <li key={i}>{f.title} <span style={{ color: 'var(--text-muted)' }}>- {f.reason}</span></li>))}
          {section(t('deepwork.gov.open_questions'), (record.openQuestions || []).map((q, i) => <li key={i}>{q}</li>))}
        </>
      )}
      {(record.limitations || []).length > 0 && (
        <details style={{ marginTop: 10, fontSize: 12 }}>
          <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>{t('deepwork.gov.limits')}</summary>
          <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, lineHeight: 1.6 }}>{record.limitations!.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
      )}
    </div>
  )
}
