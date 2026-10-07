import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import HelpTip from '../components/HelpTip'
import { useLang } from '../contexts/LangContext'
import { HealthApi, HealthAssessment, HealthItem, REFERENCE_CLASSES, T, fmt, heatColor, makeApi } from './health/health'
import './repository/AssetProfile.css'
import './health/ArchitectureHealth.css'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi(): HealthApi {
  return useMemo(() => makeApi(API_URL), [])
}

const domainName = (d: { name: string; nameAr?: string | null }, isAR: boolean) => (isAR && d.nameAr) || d.name

function Tile({ label, value, sub, help }: { label: string; value: string; sub?: string; help?: string }) {
  return (
    <div className="ah-tile">
      <div className="ah-tile-label">{label}{help && <HelpTip text={help} />}</div>
      <div className="ah-tile-value">{value}</div>
      {sub && <div className="ah-tile-sub">{sub}</div>}
    </div>
  )
}

function Bar({ value }: { value: number | null }) {
  return <div className="ah-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} /></div>
}

function Prio({ p, t }: { p: string; t: T }) {
  return <span className={`ah-chip ah-prio-${p}`}>{t(`health.priority.${p}`)}</span>
}

/** Small trend line of stored assessments (maturity and completeness). */
function Trend({ points, t }: { points: Array<{ createdAt: string; maturityScore: number | null; completenessScore: number | null }>; t: T }) {
  if (points.length < 2) return <div className="ah-dim">{t('health.trend.need_two')}</div>
  const w = 320; const h = 80
  const line = (key: 'maturityScore' | 'completenessScore') => points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p[key] ?? 0) / 100) * h}`).join(' ')
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={t('health.trend.title')} style={{ maxWidth: w }}>
        <polyline points={line('completenessScore')} fill="none" stroke="var(--text-dim)" strokeWidth="2" strokeDasharray="4 3" />
        <polyline points={line('maturityScore')} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
      </svg>
      <figcaption className="ah-dim">— {t('health.maturity')} · - - {t('health.completeness')} · {points.length} {t('health.trend.assessments')}</figcaption>
    </figure>
  )
}

// ── Enterprise (Chief Architect) ─────────────────────────────────────────────

function EnterpriseView({ api, t, isAR, onOpen }: { api: HealthApi; t: T; isAR: boolean; onOpen: (code: string) => void }) {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.get('/architecture-health/enterprise').then(setData).catch(e => setError(e.message)) }, [api])
  if (error) return <div className="rp-card" role="alert">{error}</div>
  if (!data) return <div className="rp-card">{t('common.loading')}</div>
  const criteria: string[] = data.domains[0]?.criteria.map((c: any) => c.code) || []
  return (
    <div data-testid="health-enterprise">
      <div className="rp-card">
        <div className="rp-card-title">{t('health.enterprise.title')}<HelpTip text={t('health.enterprise.help')} /></div>
        <div className="rp-table-wrap">
          <table className="ah-table">
            <thead><tr>
              <th>{t('health.domain')}</th><th>{t('health.maturity')}</th><th>{t('health.target')}</th><th>{t('health.gap')}</th>
              <th>{t('health.completeness')}</th><th>{t('health.relationships')}</th><th>{t('health.reference')}</th><th>{t('health.objects')}</th>
            </tr></thead>
            <tbody>
              {data.domains.map((d: any) => (
                <tr key={d.domain.code}>
                  <td><button type="button" className="ah-link-btn" onClick={() => onOpen(d.domain.code)}>{domainName(d.domain, isAR)}</button></td>
                  <td><span className="ah-heat" style={{ background: heatColor(d.maturity.score) }}>{fmt(d.maturity.score)}</span> {d.maturity.level ? <span className="ah-dim">{t('health.level')} {d.maturity.level}</span> : null}</td>
                  <td>{d.maturity.targetScore}</td>
                  <td>{fmt(d.maturity.gapPoints)}</td>
                  <td>{fmt(d.completeness, '%')}</td>
                  <td>{fmt(d.relationshipCompleteness, '%')}</td>
                  <td>{fmt(d.referenceCoverage, '%')}</td>
                  <td>{d.objectCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rp-card">
        <div className="rp-card-title">{t('health.enterprise.heatmap')}<HelpTip text={t('health.enterprise.heatmap_help')} /></div>
        <div className="rp-table-wrap">
          <table className="ah-table" data-testid="health-heatmap">
            <thead><tr><th>{t('health.domain')}</th>{criteria.map(c => <th key={c} title={t(`health.criterion.${c}`)}>{t(`health.criterion_short.${c}`)}</th>)}</tr></thead>
            <tbody>
              {data.domains.map((d: any) => (
                <tr key={d.domain.code}>
                  <td>{domainName(d.domain, isAR)}</td>
                  {d.criteria.map((c: any) => <td key={c.code}><span className="ah-heat" style={{ background: heatColor(c.status === 'ASSESSED' ? c.score : null) }}>{c.status === 'ASSESSED' ? c.score : t('health.na')}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="rp-card">
        <div className="rp-card-title">{t('health.enterprise.top_actions')}</div>
        {data.topActions.length === 0 ? <div className="ah-dim">{t('health.none')}</div> : (
          <ol className="ah-list">
            {data.topActions.map((a: any, i: number) => (
              <li key={i}><Prio p={a.priority} t={t} /> <strong>{a.domainName}</strong> — {a.action}<div className="ah-dim">{a.problem}</div></li>
            ))}
          </ol>
        )}
      </div>
      {data.unresolvedObjects > 0 && <div className="rp-banner">{t('health.unresolved').replace('{count}', String(data.unresolvedObjects))}</div>}
    </div>
  )
}

// ── One domain ──────────────────────────────────────────────────────────────

function GapRow({ item, api, code, t }: { item: HealthItem; api: HealthApi; code: string; t: T }) {
  const [objects, setObjects] = useState<any[] | null>(null)
  const [open, setOpen] = useState(false)
  const toggle = () => {
    setOpen(o => !o)
    if (!objects) api.get(`/architecture-health/domains/${encodeURIComponent(code)}/gaps?item=${encodeURIComponent(item.key)}&limit=50`).then(r => setObjects(r.objects || [])).catch(() => setObjects([]))
  }
  return (
    <>
      <tr>
        <td>{item.typeName}</td>
        <td>{item.label}{item.relationship && item.relationship.otherEndRecorded === 0 && <div className="ah-dim">{t('health.gap.blocked').replace('{type}', item.relationship.otherEndTypeName)}</div>}</td>
        <td><Prio p={item.priority} t={t} /><div className="ah-dim">{item.priorityBasis}</div></td>
        <td><Bar value={item.coverage} /> <span className="ah-dim">{item.useful}/{item.expected}</span></td>
        <td>{item.missing}{item.invalid > 0 && <div className="ah-dim">{t('health.gap.invalid').replace('{count}', String(item.invalid))}</div>}</td>
        <td>+{item.gainPoints}</td>
        <td><button type="button" className="ah-link-btn" aria-expanded={open} onClick={toggle}>{open ? t('health.gap.hide') : t('health.gap.show')}</button></td>
      </tr>
      {open && (
        <tr><td colSpan={7}>
          <div className="ah-objects" data-testid="health-gap-objects">
            {!objects ? t('common.loading') : objects.length === 0 ? t('health.none') : (
              <ul className="ah-list">{objects.map(o => <li key={o.id}><a href={`/repository?asset=${encodeURIComponent(o.id)}`}>{o.name}</a> <span className="ah-dim">{o.assetType}</span></li>)}</ul>
            )}
            {objects && item.missing > objects.length && <div className="ah-dim">{t('health.gap.more').replace('{shown}', String(objects.length)).replace('{total}', String(item.missing))}</div>}
          </div>
        </td></tr>
      )}
    </>
  )
}

function DomainView({ api, t, isAR, code }: { api: HealthApi; t: T; isAR: boolean; code: string }) {
  const [data, setData] = useState<{ assessment: HealthAssessment; latest: any } | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const load = useCallback((fresh = false) => {
    setError(null)
    api.get(`/architecture-health/domains/${encodeURIComponent(code)}${fresh ? '?fresh=true' : ''}`).then(setData).catch(e => setError(e.message))
    api.get(`/architecture-health/domains/${encodeURIComponent(code)}/history`).then(h => setHistory(Array.isArray(h) ? h : [])).catch(() => setHistory([]))
  }, [api, code])
  useEffect(() => { setData(null); load() }, [load])

  const save = () => {
    setSaving(true); setMsg(null)
    api.post(`/architecture-health/domains/${encodeURIComponent(code)}/assess`)
      .then(() => { setMsg(t('health.saved')); load(true) })
      .catch(e => setMsg(e.message))
      .finally(() => setSaving(false))
  }

  if (error) return <div className="rp-card" role="alert">{error}</div>
  if (!data) return <div className="rp-card">{t('common.loading')}</div>
  const a = data.assessment
  const m = a.maturity
  const planKeys = new Set(a.collectionPlan.itemKeys)
  const gaps = a.items.filter(i => i.missing > 0 && i.weight > 0)
  const shownGaps = showAll ? gaps : gaps.slice(0, 15)
  const prev = data.latest
  const delta = prev && prev.maturityScore !== null && m.score !== null ? Math.round((m.score - prev.maturityScore) * 10) / 10 : null

  return (
    <div data-testid="health-domain">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{domainName(a.domain, isAR)}</div>
          <div className="ah-dim">{t('health.assessed_live')} · {a.objectCount} {t('health.objects')}{prev ? ` · ${t('health.last_saved')} ${new Date(prev.createdAt).toLocaleDateString(isAR ? 'ar' : 'en')}` : ''}</div>
        </div>
        <button type="button" className="ah-btn ah-btn-primary" onClick={save} disabled={saving}>{saving ? t('health.saving') : t('health.save')}</button>
        <HelpTip text={t('health.save_help')} />
      </div>
      {msg && <div className="rp-banner" role="status">{msg}</div>}
      {(a.truncated.links || a.truncated.objects) && <div className="rp-banner">{t('health.truncated')}</div>}

      <div className="ah-tiles">
        <Tile label={t('health.maturity')} value={m.score === null ? t('health.na') : `${m.score}`} sub={m.level ? `${t('health.level')} ${m.level} · ${t(`health.level.${m.level}`)} · ${t('health.target')} ${t('health.level')} ${m.targetLevel} (${m.targetScore})` : undefined} help={t('health.maturity_help')} />
        <Tile label={t('health.completeness')} value={fmt(a.completeness.score, '%')} sub={t('health.completeness_sub')} help={t('health.completeness_help')} />
        <Tile label={t('health.attributes')} value={fmt(a.completeness.attributeScore, '%')} />
        <Tile label={t('health.relationships')} value={fmt(a.completeness.relationshipScore, '%')} help={t('health.relationships_help')} />
        <Tile label={t('health.reference')} value={a.reference.coverage ? `${a.reference.coverage.confirmed}/${a.reference.coverage.mandatory}` : t('health.na')} sub={a.reference.status === 'NO_REFERENCE' ? t('health.reference.none') : undefined} />
        {delta !== null && <Tile label={t('health.since_saved')} value={`${delta >= 0 ? '+' : ''}${delta}`} />}
      </div>

      <div className="rp-card">
        <div className="rp-card-title">{t('health.plan.title')}<HelpTip text={t('health.plan.help')} /></div>
        <div className="ah-plan" data-testid="health-plan">
          {a.collectionPlan.itemKeys.length === 0 ? t('health.plan.nothing') : t('health.plan.statement')
            .replace('{items}', String(a.collectionPlan.itemKeys.length)).replace('{values}', String(a.collectionPlan.values)).replace('{objects}', String(a.collectionPlan.objects))
            .replace('{from}', fmt(a.collectionPlan.completenessFrom)).replace('{to}', fmt(a.collectionPlan.completenessTo))
            .replace('{mfrom}', fmt(a.collectionPlan.maturityFrom)).replace('{mto}', fmt(a.collectionPlan.maturityTo))}
        </div>
        <ol className="ah-list">
          {a.items.filter(i => planKeys.has(i.key)).map(i => <li key={i.key}><Prio p={i.priority} t={t} /> {i.typeName}: {i.label} <span className="ah-dim">— {i.missing}/{i.expected} · +{i.gainPoints}</span></li>)}
        </ol>
        {a.collectionPlan.blocked.length > 0 && (
          <div className="ah-dim" style={{ marginTop: 8 }}>{t('health.plan.blocked')}: {a.collectionPlan.blocked.map(b => `${b.label} (${b.needs})`).join('; ')}</div>
        )}
      </div>

      <div className="rp-card">
        <div className="rp-card-title">{t('health.criteria.title')}<HelpTip text={t('health.criteria.help')} /></div>
        <div className="rp-table-wrap">
          <table className="ah-table" data-testid="health-criteria">
            <thead><tr><th>{t('health.criteria.criterion')}</th><th>{t('health.criteria.weight')}</th><th>{t('health.criteria.score')}</th><th>{t('health.criteria.evidence')}</th><th>{t('health.criteria.action')}</th></tr></thead>
            <tbody>
              {m.criteria.map(c => (
                <tr key={c.code}>
                  <td><strong>{t(`health.criterion.${c.code}`)}</strong><div className="ah-dim">{c.why}</div></td>
                  <td>{c.weight}</td>
                  <td>{c.status === 'ASSESSED' ? <><span className="ah-heat" style={{ background: heatColor(c.score) }}>{c.score}</span> <span className="ah-dim">/ {c.targetScore}</span></> : <span className="ah-chip">{t('health.not_assessed')}</span>}</td>
                  <td>{c.status === 'ASSESSED' && c.evidence.of > 0 && <div>{c.evidence.measured} / {c.evidence.of}</div>}<div className="ah-dim">{c.explanation}</div></td>
                  <td>{c.gap && <div>{c.gap}</div>}{c.recommendedAction && <div className="ah-dim">→ {c.recommendedAction}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="ah-dim" style={{ marginTop: 8 }}>{m.rule}</div>
      </div>

      <div className="rp-card">
        <div className="rp-card-title">{t('health.gaps.title')}<HelpTip text={t('health.gaps.help')} /></div>
        {gaps.length === 0 ? <div className="ah-dim">{t('health.none')}</div> : (
          <div className="rp-table-wrap">
            <table className="ah-table" data-testid="health-gaps">
              <thead><tr><th>{t('health.gaps.type')}</th><th>{t('health.gaps.item')}</th><th>{t('health.gaps.priority')}</th><th>{t('health.gaps.coverage')}</th><th>{t('health.gaps.missing')}</th><th>{t('health.gaps.gain')}</th><th /></tr></thead>
              <tbody>{shownGaps.map(i => <GapRow key={i.key} item={i} api={api} code={a.domain.code} t={t} />)}</tbody>
            </table>
          </div>
        )}
        {gaps.length > 15 && <button type="button" className="ah-link-btn" style={{ marginTop: 8 }} onClick={() => setShowAll(s => !s)}>{showAll ? t('health.gaps.fewer') : t('health.gaps.all').replace('{count}', String(gaps.length))}</button>}
        <div className="ah-dim" style={{ marginTop: 8 }}>{a.completeness.rule}</div>
      </div>

      <div className="ah-grid-2">
        <div className="rp-card" style={{ marginTop: 16 }}>
          <div className="rp-card-title">{t('health.reference.title')}<HelpTip text={t('health.reference.help')} /></div>
          {a.reference.status === 'NO_REFERENCE' ? <div className="ah-dim">{t('health.reference.none')}</div> : (
            <>
              {a.reference.coverage && <div style={{ marginBottom: 8 }}>{a.reference.coverage.statement}</div>}
              {REFERENCE_CLASSES.map(cls => (a.reference.byClass[cls] || []).length > 0 && (
                <div key={cls} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12.5 }}>{t(`health.refclass.${cls}`)} ({a.reference.byClass[cls].length})</div>
                  <div className="ah-dim">{a.reference.byClass[cls].slice(0, 8).map(e => e.name).join(', ')}</div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="rp-card" style={{ marginTop: 16 }}>
          <div className="rp-card-title">{t('health.issues.title')}</div>
          <ul className="ah-list">
            {a.missingTypes.map(mt => <li key={mt.code}>{t(mt.classification === 'REFERENCE_GAP' ? 'health.issues.reference_type' : 'health.issues.unrecorded_type').replace('{type}', mt.name)}</li>)}
            {a.suspiciousLinks.total > 0 && <li>{t('health.issues.suspicious').replace('{count}', String(a.suspiciousLinks.total))}<div className="ah-dim">{Object.entries(a.suspiciousLinks.byReason).map(([k, v]) => `${t(`health.suspicious.${k}`)}: ${v}`).join(' · ')}</div></li>}
            {a.invalidValues.total > 0 && <li>{t('health.issues.invalid').replace('{count}', String(a.invalidValues.total))}</li>}
            {a.missingTypes.length === 0 && a.suspiciousLinks.total === 0 && a.invalidValues.total === 0 && <li className="ah-dim">{t('health.none')}</li>}
          </ul>
        </div>
      </div>

      <div className="ah-grid-2">
        <div className="rp-card" style={{ marginTop: 16 }}>
          <div className="rp-card-title">{t('health.recommendations')}</div>
          <ol className="ah-list">{a.recommendations.map((r, i) => <li key={i}><Prio p={r.priority} t={t} /> {r.action}<div className="ah-dim">{r.problem}</div></li>)}</ol>
        </div>
        <div className="rp-card" style={{ marginTop: 16 }}>
          <div className="rp-card-title">{t('health.trend.title')}<HelpTip text={t('health.trend.help')} /></div>
          <Trend points={history} t={t} />
          <div className="rp-card-title" style={{ marginTop: 16 }}>{t('health.types.title')}</div>
          <div className="rp-table-wrap">
            <table className="ah-table">
              <thead><tr><th>{t('health.gaps.type')}</th><th>{t('health.objects')}</th><th>{t('health.attributes')}</th><th>{t('health.relationships')}</th></tr></thead>
              <tbody>{a.types.map(ty => <tr key={ty.code}><td>{ty.name}</td><td>{ty.objectCount}</td><td>{fmt(ty.attributeScore, '%')}</td><td>{fmt(ty.relationshipScore, '%')}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="ah-dim" style={{ marginTop: 12 }}>{a.basis}</div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ArchitectureHealthPage() {
  const { t, isAR } = useLang()
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const [domains, setDomains] = useState<any[] | null>(null)
  const [published, setPublished] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const selected = params.get('domain') || 'ENTERPRISE'

  useEffect(() => {
    api.get('/architecture-health/domains').then(r => { setDomains(r.domains || []); setPublished(r.metaModelPublished !== false) }).catch(e => setError(e.message))
  }, [api])

  const open = (code: string) => setParams(p => { const n = new URLSearchParams(p); if (code === 'ENTERPRISE') n.delete('domain'); else n.set('domain', code); return n })

  return (
    <div className="rp-page" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="rp-header">
        <div className="rp-header-main">
          <h1 className="rp-title">🩺 {t('health.title')} <HelpTip text={t('health.help')} /></h1>
          <div className="rp-sub">{t('health.subtitle')}</div>
        </div>
        <a className="ah-btn" href="/copilot" style={{ textDecoration: 'none' }}>💬 {t('health.ask_copilot')}</a>
      </div>
      <div className="rp-content">
        {error && <div className="rp-card" role="alert">{error}</div>}
        {!published && <div className="rp-card">{t('health.no_meta_model')}</div>}
        {domains && published && (
          <>
            <div className="ah-domains" role="group" aria-label={t('health.domains')}>
              <button type="button" className="ah-domain-btn" aria-pressed={selected === 'ENTERPRISE'} onClick={() => open('ENTERPRISE')}>🏛 {t('health.enterprise')}</button>
              {domains.map(d => (
                <button key={d.code} type="button" className="ah-domain-btn" aria-pressed={selected === d.code} onClick={() => open(d.code)}>
                  {domainName(d, isAR)}{d.latest?.maturityScore !== undefined && d.latest?.maturityScore !== null ? ` · ${d.latest.maturityScore}` : ''}
                </button>
              ))}
            </div>
            {selected === 'ENTERPRISE' ? <EnterpriseView api={api} t={t} isAR={isAR} onOpen={open} /> : <DomainView key={selected} api={api} t={t} isAR={isAR} code={selected} />}
          </>
        )}
        {!domains && !error && <div className="rp-card">{t('common.loading')}</div>}
      </div>
    </div>
  )
}
