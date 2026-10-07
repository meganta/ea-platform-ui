import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { fmtDate, levelText, pct } from './ownerApi'
import { fill, Pill, Tile } from './ownerUi'

const GROUP_ORDER = ['STRATEGY', 'BUSINESS', 'BENEFICIARY', 'APPLICATION', 'DATA', 'TECHNOLOGY', 'GOVERNANCE']

/** Repository content per EA concept, grouped by domain. */
export function ConceptCounts({ concepts }: { concepts: Array<{ key: string; group: string; count: number }> }) {
  const { t } = useLang()
  return (
    <div className="oc-grid-2">
      {GROUP_ORDER.map(g => {
        const rows = concepts.filter(c => c.group === g)
        if (!rows.length) return null
        return (
          <div key={g} className="oc-card">
            <h3>{t(`owner.group.${g}`)}</h3>
            <dl className="oc-kv">
              {rows.map(r => (
                <div key={r.key} style={{ display: 'contents' }}>
                  <dt>{t(`owner.concept.${r.key}`)}</dt>
                  <dd style={{ fontWeight: r.count ? 600 : 400, color: r.count ? 'var(--text)' : 'var(--text-dim)' }}>{r.count}</dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </div>
  )
}

export function HealthPanel({ health }: { health: any }) {
  const { t } = useLang()
  return (
    <div className="oc-card">
      <h3>{t('owner.health.title')}<HelpTip text={t('owner.health.help')} /></h3>
      <div className="stat-grid-3" style={{ marginBottom: 12 }}>
        <Tile label={t('owner.health.title')} value={health.score ?? '—'} note={health.method} />
        <Tile label={t('owner.health.coverage')} value={`${health.coverage.filter((c: any) => c.present).length}/${health.coverage.length}`} />
      </div>
      <div className="oc-table-wrap">
        <table className="oc-table">
          <thead><tr><th>{t('owner.health.indicator')}</th><th>{t('owner.health.value')}</th><th>{t('owner.health.count')}</th></tr></thead>
          <tbody>
            {health.indicators.map((i: any) => (
              <tr key={i.key}>
                <td><strong>{i.label}</strong><div className="oc-muted">{i.description}</div></td>
                <td style={{ minWidth: 120 }}>
                  {pct(i.ratio.value)}
                  {i.ratio.value !== null && <div className="oc-bar" style={{ marginTop: 4 }}><span style={{ width: `${(i.inverted ? 1 - i.ratio.value : i.ratio.value) * 100}%`, background: i.inverted ? 'var(--warning)' : undefined }} /></div>}
                </td>
                <td className="oc-muted">{i.ratio.numerator} / {i.ratio.denominator}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function MaturityPanel({ assessment }: { assessment: any }) {
  const { t, isAR } = useLang()
  const m = assessment.maturity
  return (
    <div>
      <div className="stat-grid-4" style={{ marginBottom: 14 }}>
        <Tile label={t('owner.maturity.overall')} value={levelText(m.level, t)} />
        <Tile label={t('owner.maturity.target')} value={m.targetLevel ? levelText(m.targetLevel, t) : '—'} />
        <Tile label={t('owner.health.title')} value={assessment.health.score ?? '—'} />
        <Tile label={t('owner.adoption.title')} value={`${assessment.adoption.modulesInUse}/${assessment.adoption.modulesTracked}`} />
      </div>
      <div className="oc-section-title">{t('owner.maturity.title')}<HelpTip text={t('owner.maturity.help')} /></div>
      <div className="oc-muted" style={{ marginBottom: 10 }}>{t('owner.maturity.method')}: {m.method} · {fill(t('owner.maturity.computed'), { time: fmtDate(assessment.computedAt, isAR) })}</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {m.domains.map((d: any) => (
          <details key={d.key} className="oc-domain">
            <summary>
              <strong>{isAR ? d.labelAr : d.label}</strong>
              <span>{d.assessed ? levelText(d.level, t) : <span className="oc-muted">{t('owner.maturity.not_assessed')}</span>}</span>
            </summary>
            {!d.assessed && <div className="oc-muted" style={{ marginTop: 6 }}>{d.notAssessedReason}</div>}
            {d.assessed && (
              <div style={{ marginTop: 8 }}>
                {d.nextLevelGaps.length > 0 && (
                  <div className="oc-muted" style={{ marginBottom: 6 }}><strong>{t('owner.maturity.next_gaps')}:</strong> {d.nextLevelGaps.map((g: any) => g.label).join(' · ')}</div>
                )}
                <div className="oc-muted" style={{ fontWeight: 600 }}>{t('owner.maturity.criteria')}</div>
                {d.criteria.map((c: any) => (
                  <div key={c.id} className="oc-criterion">
                    <span aria-label={c.met ? t('owner.maturity.met') : t('owner.maturity.not_met')} style={{ color: c.met ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{c.met ? '✓' : '✗'}</span>
                    <span style={{ minWidth: 28 }} className="oc-muted">L{c.level}</span>
                    <span><strong>{c.label}</strong><br /><span className="oc-muted">{c.evidence}</span></span>
                  </div>
                ))}
              </div>
            )}
          </details>
        ))}
      </div>
      {assessment.trend?.length > 1 && (
        <div className="oc-section">
          <div className="oc-section-title">{t('owner.maturity.trend')}</div>
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th>{t('owner.audit.col.time')}</th><th>{t('owner.maturity.title')}</th><th>{t('owner.health.title')}</th><th>{t('owner.adoption.title')}</th></tr></thead>
              <tbody>{assessment.trend.map((s: any, i: number) => <tr key={i}><td>{fmtDate(s.computedAt, isAR)}</td><td>{levelText(s.eaLevel, t)}</td><td>{s.healthScore ?? '—'}</td><td>{s.adoption ?? '—'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdoptionPanel({ adoption }: { adoption: any }) {
  const { t } = useLang()
  return (
    <div className="oc-card">
      <h3>{t('owner.adoption.title')}<HelpTip text={t('owner.adoption.help')} /></h3>
      <div className="oc-muted" style={{ marginBottom: 8 }}>{fill(t('owner.adoption.in_use'), { n: adoption.modulesInUse, m: adoption.modulesTracked })} — {adoption.method}</div>
      <ul style={{ listStyle: 'none', display: 'grid', gap: 6 }}>
        {adoption.modules.map((m: any) => (
          <li key={m.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
            <span>{m.label} <span className="oc-muted">({m.measure})</span></span>
            {m.inUse ? <strong>{m.count}</strong> : <Pill text={t('owner.adoption.unused')} color="var(--text-dim)" />}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function BeneficiaryPanel({ assessment }: { assessment: any }) {
  const { t, isAR } = useLang()
  const f = assessment.facts
  const n = (k: string) => f.conceptCounts?.[k] || 0
  const ratio = (num: number, den: number) => (den ? `${num} / ${den} (${Math.round((num / den) * 100)}%)` : '—')
  const domain = assessment.maturity.domains.find((d: any) => d.key === 'BENEFICIARY')
  return (
    <div>
      <div className="oc-section-title">{t('owner.bene.title')}<HelpTip text={t('owner.bene.help')} /></div>
      <div className="stat-grid-5" style={{ marginBottom: 14 }}>
        {['BENEFICIARY', 'JOURNEY', 'CHANNEL', 'TOUCHPOINT', 'SERVICE'].map(k => <Tile key={k} label={t(`owner.concept.${k}`)} value={n(k)} />)}
      </div>
      <div className="oc-card" style={{ marginBottom: 14 }}>
        <dl className="oc-kv">
          <dt>{t('owner.bene.traceability')}</dt><dd>{ratio(f.links?.SERVICE_BENEFICIARY || 0, n('SERVICE'))}</dd>
          <dt>{t('owner.bene.journey_service')}</dt><dd>{ratio(f.links?.JOURNEY_SERVICE || 0, n('JOURNEY'))}</dd>
          <dt>{t('owner.bene.journey_channel')}</dt><dd>{ratio(f.links?.JOURNEY_CHANNEL || 0, n('JOURNEY'))}</dd>
        </dl>
      </div>
      {domain && (
        <div className="oc-domain">
          <strong>{isAR ? domain.labelAr : domain.label}: {domain.assessed ? levelText(domain.level, t) : t('owner.maturity.not_assessed')}</strong>
          {domain.assessed ? domain.criteria.map((c: any) => (
            <div key={c.id} className="oc-criterion"><span style={{ color: c.met ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{c.met ? '✓' : '✗'}</span><span><strong>{c.label}</strong><br /><span className="oc-muted">{c.evidence}</span></span></div>
          )) : <div className="oc-muted">{domain.notAssessedReason}</div>}
        </div>
      )}
    </div>
  )
}
