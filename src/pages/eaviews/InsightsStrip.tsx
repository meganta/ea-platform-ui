import React from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'

// ── Insights: facts counted from the view's own data ──────────────────────
//
// /dataset returns `insights` computed server-side from the resolved
// dataset (no AI, no scores). Each tile states one fact; a tile with
// objects behind it narrows the view to those objects.

export interface ViewInsight {
  key: string
  type: string
  severity: 'INFO' | 'ATTENTION'
  value: number
  total?: number
  text: string
  textAr: string
  breakdown?: Array<{ label: string; count: number }>
  objectIds?: string[]
}

export function InsightsStrip({ insights, stateChange, focusKey, onFocus }: {
  insights: ViewInsight[]
  // Optional fact from /evolution when a non-Current state is shown.
  stateChange?: { introduced: number; retired: number; modified: number } | null
  focusKey: string | null
  onFocus: (insight: ViewInsight | null) => void
}) {
  const { t, isAR } = useLang()
  if (insights.length === 0 && !stateChange) return null
  return (
    <section data-testid="insights" aria-label={t('eaviews.insights_title')} style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        {t('eaviews.insights_title')}
        <HelpTip text={t('eaviews.insights_help')} />
      </div>
      <div className="insight-grid">
        {stateChange && (
          <div className="insight-tile" data-testid="insight-state-change">
            <div className="insight-value">+{stateChange.introduced} / −{stateChange.retired}</div>
            <div className="insight-text">{t('eaviews.insight_vs_current')}{stateChange.modified > 0 ? ` · ${t('eaviews.evo_modified')}: ${stateChange.modified}` : ''}</div>
          </div>
        )}
        {insights.map(i => {
          const focusable = (i.objectIds?.length || 0) > 0
          const active = focusKey === i.key
          const body = (
            <>
              <div className="insight-value">{i.value}{i.total !== undefined && i.total !== i.value ? <span className="insight-total"> / {i.total}</span> : null}</div>
              <div className="insight-text">{isAR ? i.textAr : i.text}</div>
            </>
          )
          return focusable ? (
            <button key={i.key} type="button" className={`insight-tile${i.severity === 'ATTENTION' ? ' insight-attention' : ''}${active ? ' insight-active' : ''}`}
              aria-pressed={active} title={t('eaviews.insight_focus')} onClick={() => onFocus(active ? null : i)}>
              {body}
            </button>
          ) : (
            <div key={i.key} className={`insight-tile${i.severity === 'ATTENTION' ? ' insight-attention' : ''}`}>{body}</div>
          )
        })}
      </div>
    </section>
  )
}
