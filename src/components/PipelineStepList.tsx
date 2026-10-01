import React from 'react'
import { useLang } from '../contexts/LangContext'

/**
 * The review pipeline's real progress (GovernanceReview.pipelineProgress):
 * only the steps that apply to this review type, each shown as it finishes.
 * Replaces a fixed list of ten engines ticked on a timer.
 */
export type PipelineStepState = 'pending' | 'done' | 'skipped' | 'failed'
export interface PipelineStep { key: string; label: string; labelAr?: string; state: PipelineStepState }

/** Share of steps no longer pending (0–1). */
export const stepsRatio = (steps: PipelineStep[] | undefined | null) =>
  !steps || steps.length === 0 ? 0 : steps.filter(s => s.state !== 'pending').length / steps.length

const ICON: Record<PipelineStepState, string> = { done: '✅', skipped: '➖', failed: '⚠️', pending: '⏳' }
const STATE_TEXT: Record<PipelineStepState, [string, string]> = {
  done: ['Done', 'اكتمل'], skipped: ['Not applicable to this document', 'لا ينطبق على هذه الوثيقة'], failed: ['Did not complete', 'لم يكتمل'], pending: ['Running', 'قيد التنفيذ'],
}

export default function PipelineStepList({ steps }: { steps: PipelineStep[] | null | undefined }) {
  const { isAR } = useLang()
  if (!steps || steps.length === 0) {
    return <div role="status" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{isAR ? 'جارٍ تحديد خطوات المراجعة…' : 'Preparing the review steps…'}</div>
  }
  return (
    <ul aria-label={isAR ? 'خطوات المراجعة' : 'Review steps'} dir={isAR ? 'rtl' : 'ltr'} style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: 8 }}>
      {steps.map(s => {
        const finished = s.state === 'done'
        return (
          <li key={s.key} data-state={s.state} title={isAR ? STATE_TEXT[s.state][1] : STATE_TEXT[s.state][0]}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: finished ? '#2ecc7111' : 'var(--navy-dark)', border: '1px solid ' + (finished ? '#2ecc7133' : 'var(--navy-light)'), opacity: s.state === 'skipped' ? 0.6 : 1 }}>
            <span aria-hidden style={{ fontSize: 14 }}>{ICON[s.state]}</span>
            <span style={{ fontSize: 12, color: finished ? '#2ecc71' : 'var(--text-muted)' }}>{isAR && s.labelAr ? s.labelAr : s.label}</span>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{isAR ? STATE_TEXT[s.state][1] : STATE_TEXT[s.state][0]}</span>
          </li>
        )
      })}
    </ul>
  )
}
