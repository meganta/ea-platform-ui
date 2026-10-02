import { useMemo, useState } from 'react'
import HelpTip from './HelpTip'
import { RefreshFinding, StrategyDomainImpact, StrategyImpact, StrategyImpactView } from '../lib/strategy-refresh'

type T = (key: string) => string
const fill = (text: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [k, v]) => out.split(`{${k}}`).join(String(v)), text)
const LEVELS = ['HIGH', 'MEDIUM', 'LOW'] as const

/** A translated label, falling back to the server's own text when the code is not known here. */
function labelOf(t: T, key: string, fallback: string) {
  const value = t(key)
  return value === key || value === `[${key}]` ? fallback : value
}
const domainLabel = (t: T, d: { domain: string; domainName?: string }) => labelOf(t, `strategy.refresh.impact.domain.${d.domain}`, d.domainName || d.domain)

/** Headline, key messages, totals and the domain heat map: what the strategy means for the architecture, at a glance. */
export function StrategyImpactOverview({ impact, t, onOpenDomain }: { impact: StrategyImpact; t: T; onOpenDomain: (domain: string) => void }) {
  const totals = impact.totals
  const domains = impact.domains.filter(d => d.status !== 'NO_OBJECTS')
  return <section className="impact-overview">
    {impact.synthesis && <div className="impact-synthesis">
      <h2>{t('strategy.refresh.impact.synthesis_title')}<HelpTip text={t('strategy.refresh.impact.synthesis_help')} /></h2>
      <p className="impact-headline">{impact.synthesis.headline}</p>
      <p>{impact.synthesis.overview}</p>
      {!!impact.synthesis.keyMessages.length && <><h3>{t('strategy.refresh.impact.key_messages')}</h3><ul>{impact.synthesis.keyMessages.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
    </div>}
    <div className="impact-totals">
      {(['impactedObjects', 'impactedDomains', 'namedObjects', 'notInRepository'] as const).map(k => <div key={k}><strong>{totals[k]}</strong><span>{t(`strategy.refresh.impact.totals.${k}`)}</span></div>)}
    </div>
    <p className="impact-note">{fill(t('strategy.refresh.impact.assessed'), { assessed: totals.assessedObjects, total: totals.repositoryObjects })}</p>
    {!!domains.length && <>
      <h3>{t('strategy.refresh.impact.heatmap')}<HelpTip text={t('strategy.refresh.impact.heatmap_help')} /></h3>
      <div className="impact-heatmap">
        {domains.map(d => <button key={d.domain} className={`level-${d.status === 'FAILED' ? 'FAILED' : d.impactLevel}`} onClick={() => onOpenDomain(d.domain)}>
          <strong>{domainLabel(t, d)}</strong>
          <span>{d.status === 'FAILED' ? t('strategy.refresh.impact.failed') : t(`strategy.refresh.impact.level.${d.impactLevel}`)}</span>
          {d.status !== 'FAILED' && <small>{fill(t('strategy.refresh.impact.objects_count'), { n: d.impactedObjects.length })}</small>}
        </button>)}
      </div>
    </>}
  </section>
}

function ImpactViewFigure({ view, t }: { view: StrategyImpactView; t: T }) {
  // An <img> never runs markup from the picture; the SVG is generated server-side with every name escaped.
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(view.image!.svg)}`
  return <figure className="impact-view">
    <figcaption><strong>{view.title}</strong> · {t(`strategy.refresh.impact.view_source.${view.source}`)} · {view.visualization}{view.viewId && <> · <a href={`/ea-views?viewId=${encodeURIComponent(view.viewId)}`}>{t('strategy.refresh.impact.open_view')}</a></>}</figcaption>
    <div className="impact-view-image"><img src={src} alt={fill(t('strategy.refresh.impact.view_alt'), { title: view.title })} /></div>
    <p className="impact-note">{view.reason ? `${view.reason} ` : ''}{fill(t('strategy.refresh.impact.view_caption'), { n: view.impactedShown })}</p>
  </figure>
}

/**
 * The impact register: every impacted Current-architecture object with how it is affected
 * and the strategy statements behind it, per-domain EA Views, and the names the documents
 * use that the Repository does not model.
 */
export function StrategyImpactRegister({ impact, findings, t, domain, onDomainChange, onShowFact }: {
  impact: StrategyImpact; findings: RefreshFinding[]; t: T; domain: string; onDomainChange: (domain: string) => void; onShowFact: (finding: RefreshFinding) => void
}) {
  const [level, setLevel] = useState('')
  const [impactType, setImpactType] = useState('')
  const [namedOnly, setNamedOnly] = useState(false)
  const facts = useMemo(() => new Map(findings.map(f => [f.id, f])), [findings])
  const shown: StrategyDomainImpact[] = impact.domains.filter(d => d.status !== 'NO_OBJECTS' && (!domain || d.domain === domain))
  const types = useMemo(() => [...new Set(impact.domains.flatMap(d => d.impactedObjects.map(o => o.impactType)))].sort(), [impact])
  const rows = (d: StrategyDomainImpact) => d.impactedObjects.filter(o => (!level || o.impactLevel === level) && (!impactType || o.impactType === impactType) && (!namedOnly || o.namedInStrategy))
  const basis = (ids: string[]) => ids.map(id => facts.get(id)).filter((f): f is RefreshFinding => !!f)

  return <section className="impact-register">
    <h2>{t('strategy.refresh.impact.register')}<HelpTip text={t('strategy.refresh.impact.register_help')} /></h2>
    <div className="impact-filters">
      <label htmlFor="impact-domain">{t('strategy.refresh.impact.filter.domain')}
        <select id="impact-domain" value={domain} onChange={e => onDomainChange(e.target.value)}>
          <option value="">{t('strategy.refresh.impact.filter.all')}</option>
          {impact.domains.filter(d => d.status !== 'NO_OBJECTS').map(d => <option key={d.domain} value={d.domain}>{domainLabel(t, d)}</option>)}
        </select>
      </label>
      <label htmlFor="impact-level">{t('strategy.refresh.impact.filter.level')}
        <select id="impact-level" value={level} onChange={e => setLevel(e.target.value)}>
          <option value="">{t('strategy.refresh.impact.filter.all')}</option>
          {LEVELS.map(l => <option key={l} value={l}>{t(`strategy.refresh.impact.level.${l}`)}</option>)}
        </select>
      </label>
      <label htmlFor="impact-type">{t('strategy.refresh.impact.filter.type')}
        <select id="impact-type" value={impactType} onChange={e => setImpactType(e.target.value)}>
          <option value="">{t('strategy.refresh.impact.filter.all')}</option>
          {types.map(x => <option key={x} value={x}>{labelOf(t, `strategy.refresh.impact.type.${x}`, x)}</option>)}
        </select>
      </label>
      <label htmlFor="impact-named" className="impact-check"><input id="impact-named" type="checkbox" checked={namedOnly} onChange={e => setNamedOnly(e.target.checked)} />{t('strategy.refresh.impact.filter.named')}</label>
    </div>

    {shown.map(d => {
      const list = rows(d)
      return <article key={d.domain} className="impact-domain" data-testid={`impact-domain-${d.domain}`}>
        <div className="finding-meta"><span className={`impact-level level-${d.status === 'FAILED' ? 'FAILED' : d.impactLevel}`}>{d.status === 'FAILED' ? '!' : t(`strategy.refresh.impact.level.${d.impactLevel}`)}</span></div>
        <h3>{domainLabel(t, d)}</h3>
        {d.status === 'FAILED' ? <p className="limitation">{t('strategy.refresh.impact.failed')}</p> : <>
          {d.summary && <p>{d.summary}</p>}
          {d.assessedCount < d.objectCount && <p className="impact-note">{fill(t('strategy.refresh.impact.partial'), { assessed: d.assessedCount, total: d.objectCount })}</p>}
          {d.view?.image?.svg && <ImpactViewFigure view={d.view} t={t} />}
          {list.length ? <div className="impact-table-wrap"><table>
            <thead><tr>
              <th scope="col">{t('strategy.refresh.impact.col.object')}</th>
              <th scope="col">{t('strategy.refresh.impact.col.type')}</th>
              <th scope="col">{t('strategy.refresh.impact.col.impact')}</th>
              <th scope="col">{t('strategy.refresh.impact.col.description')}</th>
              <th scope="col">{t('strategy.refresh.impact.col.basis')}</th>
            </tr></thead>
            <tbody>{list.map(o => <tr key={o.assetId}>
              <td><strong>{o.name}</strong>{o.namedInStrategy && <span className="impact-named">{t('strategy.refresh.impact.named')}</span>}</td>
              <td>{o.typeLabel || o.assetType}</td>
              <td><span className={`impact-level level-${o.impactLevel}`}>{t(`strategy.refresh.impact.level.${o.impactLevel}`)}</span> {labelOf(t, `strategy.refresh.impact.type.${o.impactType}`, o.impactType)} · {t(`strategy.refresh.impact.nature.${o.nature}`)}</td>
              <td>{o.description}</td>
              <td>{basis(o.factIds).map(f => <button key={f.id} className="impact-fact" onClick={() => onShowFact(f)}>{f.title}</button>)}</td>
            </tr>)}</tbody>
          </table></div> : <p className="impact-note">{t('strategy.refresh.impact.no_rows')}</p>}
        </>}
      </article>
    })}

    {!!impact.notInRepository.length && !domain && <article className="impact-missing">
      <h3>{t('strategy.refresh.impact.not_in_repo')}<HelpTip text={t('strategy.refresh.impact.not_in_repo_help')} /></h3>
      <ul>{impact.notInRepository.map(item => <li key={item.name}><strong>{item.name}</strong>{basis(item.factIds).slice(0, 3).map(f => <button key={f.id} className="impact-fact" onClick={() => onShowFact(f)}>{f.title}</button>)}</li>)}</ul>
    </article>}

    {!!impact.limitations.length && <details className="impact-limitations"><summary>{t('strategy.refresh.impact.limitations')}</summary>{impact.limitations.map((l, i) => <p className="limitation" key={i}>{l}</p>)}</details>}
  </section>
}
