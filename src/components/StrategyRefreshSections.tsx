import { useMemo } from 'react'
import HelpTip from './HelpTip'
import { RefreshFinding, StrategyImpact, StrategyLimit } from '../lib/strategy-refresh'

type T = (key: string) => string
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), text)
const known = (t: T, key: string) => { const v = t(key); return v === key || v === `[${key}]` ? null : v }

/** The strategy's own structure first, then what assessment documents declare. */
export const STRUCTURE_TYPES = ['StrategyIdentity', 'Vision', 'Mission', 'StrategicPillar', 'Goal', 'Objective', 'KPI', 'Initiative', 'Driver', 'Principle', 'Requirement']
export const ASSESSMENT_TYPES = ['Finding', 'Gap', 'Recommendation', 'TargetState']
const FACT_ORDER = [...STRUCTURE_TYPES, ...ASSESSMENT_TYPES]

/** Which tab shows each kind of conclusion. */
export const CONCLUSION_TAB: Record<string, 'impact' | 'execution' | 'changes'> = {
  STRATEGY_ALIGNMENT: 'impact', CAPABILITY_IMPACT: 'impact', ARCHITECTURE_IMPACT: 'impact', ARCHITECTURE_GAP: 'impact', TARGET_REASSESSMENT: 'impact', GOVERNANCE_REVIEW: 'impact',
  INITIATIVE_REVIEW: 'execution', ADM_REVALIDATION: 'execution', OUTCOME_TRACEABILITY: 'execution', STRATEGIC_CHANGE: 'changes',
}
const CONCLUSION_ORDER = Object.keys(CONCLUSION_TAB)

export const factType = (f: RefreshFinding) => f.payload?.semanticType || 'Requirement'
export const factTypeLabel = (t: T, type: string) => known(t, `strategy.refresh.fact_type.${type}`) || type
const factGroupLabel = (t: T, type: string) => known(t, `strategy.refresh.fact_group.${type}`) || type

/** Facts by kind, in structure order; unknown kinds last. */
function byType(facts: RefreshFinding[]) {
  const groups = new Map<string, RefreshFinding[]>()
  for (const f of facts) { const k = factType(f); groups.set(k, [...(groups.get(k) || []), f]) }
  return [...groups.entries()].sort(([a], [b]) => (FACT_ORDER.indexOf(a) + 1 || 99) - (FACT_ORDER.indexOf(b) + 1 || 99))
}

/** A. Overview: what the documents say vs what ArchMind concludes. */
export function StrategySummaryGroups({ findings, t, onOpenFacts, onOpenConclusions }: {
  findings: RefreshFinding[]; t: T; onOpenFacts: (type: string) => void; onOpenConclusions: (category: string) => void
}) {
  const facts = findings.filter(f => f.category === 'STRATEGY_STRUCTURE')
  const conclusions = findings.filter(f => f.category !== 'STRATEGY_STRUCTURE')
  const categories = [...new Set(conclusions.map(f => f.category))].sort((a, b) => (CONCLUSION_ORDER.indexOf(a) + 1 || 99) - (CONCLUSION_ORDER.indexOf(b) + 1 || 99))
  return <div className="summary-groups">
    <div>
      <h3>{t('strategy.refresh.summary.documents')} ({facts.length})<HelpTip text={t('strategy.refresh.summary.documents_help')} /></h3>
      <div className="summary-grid">{byType(facts).map(([type, list]) => <button key={type} onClick={() => onOpenFacts(type)}><strong>{list.length}</strong><span>{factGroupLabel(t, type)}</span></button>)}</div>
    </div>
    <div>
      <h3>{t('strategy.refresh.summary.conclusions')} ({conclusions.length})<HelpTip text={t('strategy.refresh.summary.conclusions_help')} /></h3>
      {categories.length ? <div className="summary-grid">{categories.map(c => <button key={c} onClick={() => onOpenConclusions(c)}><strong>{conclusions.filter(f => f.category === c).length}</strong><span>{known(t, `strategy.refresh.label.${c}`) || c}</span></button>)}</div> : <p className="impact-note">{t('strategy.refresh.no_findings')}</p>}
    </div>
  </div>
}

/** B. Limits of this analysis, worded from codes; collapsed by default. */
export function StrategyLimitsPanel({ limits, t }: { limits: StrategyLimit[]; t: T }) {
  if (!limits.length) return null
  const domainName = (code: unknown) => known(t, `strategy.refresh.impact.domain.${code}`) || String(code)
  const moduleName = (code: unknown) => known(t, `strategy.refresh.limits.module.${code}`) || String(code)
  const sentence = (l: StrategyLimit) => {
    const p: any = l.params || {}
    if (l.code === 'OTHER') return String(p.text || '')
    const key = l.code === 'QUOTES_REJECTED' && p.atLeast === 'true' ? 'QUOTES_REJECTED_AT_LEAST' : l.code
    return fill(t(`strategy.refresh.limits.${key}`), {
      domain: domainName(p.domain), module: moduleName(p.module), assessed: p.assessed ?? '', total: p.total ?? '', count: p.count ?? '',
      domains: Array.isArray(p.domains) ? p.domains.join(', ') : '', names: Array.isArray(p.names) && p.names.length ? `: ${p.names.join(', ')}` : '',
    })
  }
  const lines = limits.map(sentence).filter((s): s is string => !!s)
  if (!lines.length) return null
  return <details className="analysis-limits">
    <summary>{t('strategy.refresh.limits.title')} ({lines.length})</summary>
    <p className="impact-note">{t('strategy.refresh.limits.help')}</p>
    <ul>{lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
  </details>
}

/** C. Strategy Map: every statement from the documents, by kind, linked to the objects it drives. */
export function StrategyMap({ findings, impact, t, type, onTypeChange, onShowFact, onOpenDriven }: {
  findings: RefreshFinding[]; impact: StrategyImpact | null | undefined; t: T; type: string; onTypeChange: (type: string) => void
  onShowFact: (f: RefreshFinding) => void; onOpenDriven: (f: RefreshFinding) => void
}) {
  const facts = useMemo(() => findings.filter(f => f.category === 'STRATEGY_STRUCTURE'), [findings])
  const drives = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of impact?.domains || []) for (const o of d.impactedObjects) for (const id of o.factIds) counts.set(id, (counts.get(id) || 0) + 1)
    return counts
  }, [impact])
  const groups = byType(facts)
  const shown = groups.filter(([k]) => !type || k === type)
  const section = (title: string, kinds: string[]) => {
    const list = shown.filter(([k]) => kinds.includes(k) || (kinds === ASSESSMENT_TYPES ? false : !FACT_ORDER.includes(k)))
    if (!list.length) return null
    return <div className="map-section"><h3>{title}</h3>{list.map(([k, items]) => <div key={k} className="map-group" data-testid={`map-group-${k}`}>
      <h4>{factGroupLabel(t, k)} ({items.length})</h4>
      <div className="map-cards">{items.map(f => {
        const n = drives.get(f.id) || 0
        return <article key={f.id} className="map-card">
          <div className="finding-meta"><span>{factTypeLabel(t, k)}</span>{f.payload?.sourceFilename && <span>{String(f.payload.sourceFilename)}</span>}<span>{known(t, `strategy.refresh.label.${f.decision}`) || f.decision}</span></div>
          <h5>{f.title}</h5>
          {f.payload?.description && <p>{String(f.payload.description).length > 220 ? `${String(f.payload.description).slice(0, 217)}…` : f.payload.description}</p>}
          <div className="actions">
            {n > 0 && <button className="map-drives" onClick={() => onOpenDriven(f)}>{fill(t('strategy.refresh.map.drives'), { n })}</button>}
            <button onClick={() => onShowFact(f)}>{t('strategy.refresh.why')}</button>
          </div>
        </article>
      })}</div>
    </div>)}</div>
  }
  return <section className="strategy-map">
    <h2>{t('strategy.refresh.map.title')}<HelpTip text={t('strategy.refresh.map.help')} /></h2>
    <div className="map-filters" role="group" aria-label={t('strategy.refresh.map.filter')}>
      <button aria-pressed={!type} onClick={() => onTypeChange('')}>{t('strategy.refresh.map.all')} ({facts.length})</button>
      {groups.map(([k, items]) => <button key={k} aria-pressed={type === k} onClick={() => onTypeChange(k)}>{factGroupLabel(t, k)} ({items.length})</button>)}
    </div>
    {!facts.length ? <p>{t('strategy.refresh.no_findings')}</p> : <>
      {section(t('strategy.refresh.map.structure'), STRUCTURE_TYPES)}
      {section(t('strategy.refresh.map.assessment'), ASSESSMENT_TYPES)}
    </>}
  </section>
}

/** Review & Publish: the three steps and where this refresh stands. */
export function ReviewSteps({ refresh, t }: { refresh: { strategyStatus: string; findings?: RefreshFinding[] }; t: T }) {
  const findings = refresh.findings || []
  const facts = findings.filter(f => f.category === 'STRATEGY_STRUCTURE')
  const conclusions = findings.filter(f => f.category !== 'STRATEGY_STRUCTURE' && f.decision !== 'INFORMATIONAL')
  const decided = (list: RefreshFinding[]) => list.filter(f => f.decision !== 'PENDING').length
  const active = refresh.strategyStatus === 'ACTIVE'
  const reviewDone = facts.length > 0 && decided(facts) === facts.length
  const publishable = findings.filter(f => f.decision === 'APPROVED' && (f.category === 'STRATEGY_STRUCTURE' ? f.destination === 'REPOSITORY' : ['STRATEGY_ALIGNMENT', 'CAPABILITY_IMPACT', 'TARGET_REASSESSMENT', 'ARCHITECTURE_GAP', 'INITIATIVE_REVIEW', 'ADM_REVALIDATION', 'GOVERNANCE_REVIEW'].includes(f.category)))
  const steps = [
    { key: 'review', state: reviewDone ? 'done' : 'current', detail: fill(t('strategy.refresh.steps.review.detail'), { facts: decided(facts), factsTotal: facts.length, conclusions: decided(conclusions), conclusionsTotal: conclusions.length }) },
    { key: 'activate', state: active ? 'done' : reviewDone ? 'current' : 'later', detail: t(active ? 'strategy.refresh.steps.activate.done' : 'strategy.refresh.steps.activate.detail') },
    { key: 'publish', state: active ? 'current' : 'later', detail: active ? fill(t('strategy.refresh.steps.publish.detail'), { done: publishable.filter(f => f.publishedAt).length, total: publishable.length }) : t('strategy.refresh.steps.publish.later') },
  ]
  return <ol className="review-steps" aria-label={t('strategy.refresh.steps.title')}>
    {steps.map((s, i) => <li key={s.key} className={`step-${s.state}`} aria-current={s.state === 'current' ? 'step' : undefined}>
      <strong>{i + 1}. {t(`strategy.refresh.steps.${s.key}`)}</strong>
      <span>{t(`strategy.refresh.steps.${s.key}.help`)}</span>
      <small>{s.detail}</small>
    </li>)}
  </ol>
}
