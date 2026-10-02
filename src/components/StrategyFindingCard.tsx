import { ReactNode } from 'react'
import { RefreshFinding } from '../lib/strategy-refresh'
import { factType, factTypeLabel } from './StrategyRefreshSections'

type T = (key: string) => string
type Evidence = { id: string; module: string; authority: string; data: any }
const known = (t: T, key: string) => { const v = t(key); return v === key || v === `[${key}]` ? null : v }

/** What publishing an approved item would do, by kind (mirrors the backend's publication actions). */
const EFFECT_BY_CATEGORY: Record<string, string> = {
  STRATEGY_ALIGNMENT: 'RELATIONSHIP', CAPABILITY_IMPACT: 'RELATIONSHIP', TARGET_REASSESSMENT: 'SCENARIO', ARCHITECTURE_GAP: 'SCENARIO',
  INITIATIVE_REVIEW: 'PLAN', ADM_REVALIDATION: 'ADM', GOVERNANCE_REVIEW: 'GOVERNANCE',
}
export function publishEffect(f: RefreshFinding): string {
  if (f.category === 'STRATEGY_STRUCTURE') return f.destination === 'REPOSITORY' ? 'REPOSITORY' : 'NONE'
  return EFFECT_BY_CATEGORY[f.category] || 'NONE'
}

const recordName = (d: any) => String(d?.name || d?.nameEn || d?.title || d?.viewName || d?.nameAr || '')

/**
 * One strategy item in plain terms. A statement shows its kind and source; a conclusion shows
 * the recommended action, priority, what it affects (named records) and what it is based on
 * (strategy statements). Both say what publishing would do. Review/publish controls come as children.
 */
export function StrategyFindingCard({ finding, t, findings, evidence, onWhy, children }: {
  finding: RefreshFinding; t: T; findings: RefreshFinding[]; evidence: Evidence[]; onWhy: (f: RefreshFinding) => void; children?: ReactNode
}) {
  const isFact = finding.category === 'STRATEGY_STRUCTURE'
  const p: any = finding.payload || {}
  const cites: any = Array.isArray(finding.evidence) ? {} : finding.evidence || {}
  const basedOn = (cites.factIds || []).map((id: string) => findings.find(f => f.id === id)).filter(Boolean) as RefreshFinding[]
  const affects = (cites.tenantEvidenceIds || []).map((id: string) => evidence.find(e => e.id === id)).filter(Boolean) as Evidence[]
  const effect = publishEffect(finding)
  const kindLabel = (e: Evidence) => e.module === 'REPOSITORY' ? String(e.data?.typeLabel || e.data?.assetType || known(t, 'strategy.refresh.affects.REPOSITORY') || '') : t(`strategy.refresh.affects.${e.module}`)
  return <article className="finding-card" data-testid={`finding-${finding.id}`}>
    <div className="finding-meta">
      <span>{isFact ? factTypeLabel(t, factType(finding)) : known(t, `strategy.refresh.label.${finding.category}`) || finding.category}</span>
      {!isFact && p.priority && <span className={`priority priority-${p.priority}`}>{t(`strategy.refresh.card.priority.${p.priority}`)}</span>}
      {isFact && p.sourceFilename && <span>{String(p.sourceFilename)}</span>}
      <span>{known(t, `strategy.refresh.label.${finding.decision}`) || finding.decision}</span>
    </div>
    <h3>{finding.title}</h3>
    {(p.description || p.explanation) && <p>{p.description || p.explanation}</p>}
    {!isFact && p.recommendedAction && <p className="card-row"><strong>{t('strategy.refresh.card.action')}:</strong> {p.recommendedAction}</p>}
    {!isFact && affects.length > 0 && <p className="card-row"><strong>{t('strategy.refresh.card.affects')}:</strong> {affects.map((e, i) => <span key={e.id} className="card-chip">{i ? ' ' : ''}{kindLabel(e)} · {recordName(e.data) || e.id}</span>)}</p>}
    {!isFact && basedOn.length > 0 && <div className="card-row"><strong>{t('strategy.refresh.card.based_on')}:</strong> {basedOn.map(f => <button key={f.id} className="impact-fact" onClick={() => onWhy(f)}><span className="impact-fact-type">{factTypeLabel(t, factType(f))}</span> · {f.title}</button>)}</div>}
    {(p.ambiguity || p.limitation) && <p className="limitation">{p.ambiguity || p.limitation}</p>}
    <p className="card-effect">{t(`strategy.refresh.card.effect.${effect}`)}</p>
    <div className="actions"><button onClick={() => onWhy(finding)}>{t('strategy.refresh.why')}</button>{children}</div>
  </article>
}
