import React from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { SYNTHESIS_HORIZONS } from './governanceSynthesisStrings'

// Cross-domain view and remediation roadmap of a review (backend
// governance-synthesis.ts, report.domainSummaries._synthesis): the story
// across domains, themes joining findings of different domains, and the
// ordered steps with the findings each closes. Written from the review's own
// findings only; shown as stored, never recomputed here.

export interface SynthesisFindingRef { title: string; domain: string; severity: string }
export interface SynthesisRecord {
  status: 'COMPLETED' | 'ROADMAP_ONLY'
  narrative?: string | null
  themes?: Array<{ title: string; explanation?: string; findings: SynthesisFindingRef[] }>
  roadmap?: Array<{ order: number; action: string; rationale?: string; horizon: string; findings: SynthesisFindingRef[]; source: 'AI' | 'PLATFORM' }>
  limitations?: string[]
}

const SEV_COLOR: Record<string, string> = { CRITICAL: '#c0392b', HIGH: '#d35400', MEDIUM: '#b7950b', LOW: '#2e86c1' }

function FindingChips({ refs }: { refs: SynthesisFindingRef[] }) {
  return (
    <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
      {refs.map(r => (
        <span key={r.title} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, border: `1px solid ${SEV_COLOR[r.severity] || 'var(--navy-light)'}`, color: 'var(--text)', maxWidth: '100%', overflowWrap: 'anywhere' }}>
          {r.title}
        </span>
      ))}
    </span>
  )
}

export default function GovernanceSynthesis({ record }: { record: SynthesisRecord }) {
  const { t, isAR } = useLang()
  const themes = record.themes || []
  const roadmap = record.roadmap || []
  if (!record.narrative && themes.length === 0 && roadmap.length === 0) return null
  return (
    <div className="card" dir={isAR ? 'rtl' : 'ltr'} data-testid="gov-synthesis" style={{ marginBottom: 16, borderInlineStart: '3px solid var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 14 }}>{t('gov.synthesis.title')}</strong>
        <HelpTip text={t('gov.synthesis.help')} />
      </div>
      {record.narrative && <p style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: '10px 0 0' }}>{record.narrative}</p>}

      {themes.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>{t('gov.synthesis.themes')}</div>
          {themes.map(th => (
            <div key={th.title} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{th.title}</div>
              {th.explanation && <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 4px' }}>{th.explanation}</div>}
              <FindingChips refs={th.findings} />
            </div>
          ))}
        </div>
      )}

      {roadmap.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-dim)', marginBottom: 6 }}>
            {t('gov.synthesis.roadmap')}{record.status === 'ROADMAP_ONLY' && <span style={{ fontWeight: 400, marginInlineStart: 8 }}>{t('gov.synthesis.roadmap_only')}</span>}
          </div>
          {SYNTHESIS_HORIZONS.map(h => {
            const steps = roadmap.filter(s => s.horizon === h)
            if (steps.length === 0) return null
            return (
              <div key={h} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--accent)', marginBottom: 4 }}>{t(`gov.synthesis.horizon.${h}`)}</div>
                <ol start={steps[0].order} style={{ margin: 0, paddingInlineStart: 22 }}>
                  {steps.map(s => (
                    <li key={s.order} value={s.order} style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>{s.action}</span>
                      {s.source === 'PLATFORM' && <span title={t('gov.synthesis.platform_help')} style={{ fontSize: 10, marginInlineStart: 6, padding: '1px 6px', borderRadius: 8, background: 'var(--navy-mid)', color: 'var(--text-dim)' }}>{t('gov.synthesis.platform')}</span>}
                      {s.rationale && s.rationale !== s.action && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.rationale}</div>}
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{t('gov.synthesis.closes')}: <FindingChips refs={s.findings} /></div>
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      )}
      {(record.limitations || []).map(l => <div key={l} style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', marginTop: 6 }}>{l}</div>)}
    </div>
  )
}
