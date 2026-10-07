import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'
import { ownerApi, fmtDate, levelText } from './ownerApi'
import { ErrorBox, Header, Loading, Pill, Tile } from './ownerUi'

const CONCEPT_TILES: Array<[string, string]> = [
  ['applications', 'APPLICATION'], ['capabilities', 'CAPABILITY'], ['processes', 'PROCESS'], ['services', 'SERVICE'],
  ['beneficiarySegments', 'BENEFICIARY'], ['journeys', 'JOURNEY'], ['data', 'DATA'], ['technology', 'TECHNOLOGY'],
  ['principles', 'PRINCIPLE'], ['standards', 'STANDARD'], ['goalsAndObjectives', 'OBJECTIVE'], ['initiatives', 'INITIATIVE'],
]

export default function OwnerDashboardPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    ownerApi.dashboard().then(setData).catch((e: any) => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.dash.title')} subtitle={t('owner.dash.subtitle')} help={t('owner.dash.help')}
        actions={<button type="button" className="btn btn-primary" onClick={() => nav('/owner/tenants?create=1')}>{t('owner.tenants.create')}</button>} />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          <div className="stat-grid-4">
            <Tile label={t('owner.dash.tenants_total')} value={data.tenants.total} />
            <Tile label={t('owner.dash.tenants_active')} value={data.tenants.active} />
            <Tile label={t('owner.dash.tenants_suspended')} value={data.tenants.suspended} />
            <Tile label={t('owner.dash.tenants_new')} value={data.tenants.createdLast30Days} />
          </div>

          <div className="oc-section">
            <div className="oc-section-title">{t('owner.dash.repository')}</div>
            <div className="stat-grid-6">
              <Tile label={t('owner.dash.objects')} value={data.repository.objects} />
              <Tile label={t('owner.dash.relationships')} value={data.repository.relationships} />
              <Tile label={t('owner.dash.reviews')} value={data.repository.reviews} />
              {CONCEPT_TILES.map(([k, concept]) => <Tile key={k} label={t(`owner.concept.${concept}`)} value={data.repository.concepts[k] ?? 0} />)}
            </div>
          </div>

          <div className="oc-section">
            <div className="oc-section-title">{t('owner.dash.quality')}</div>
            <div className="stat-grid-5">
              {['withoutOwner', 'withoutRelationship', 'stale', 'withoutLifecycle', 'capabilitiesNotTraced'].map(k => (
                <Tile key={k} label={t(`owner.dash.q.${k}`)} value={data.repository.quality[k] ?? 0} />
              ))}
            </div>
            <div className="oc-muted" style={{ marginTop: 6 }}>{data.repository.quality.basis}</div>
          </div>

          <div className="oc-section oc-grid-2">
            <div className="oc-card">
              <h3>{t('owner.dash.assessment')}</h3>
              <div className="stat-grid-3" style={{ marginBottom: 12 }}>
                <Tile label={t('owner.dash.avg_health')} value={data.assessment.averageHealth ?? '—'} />
                <Tile label={t('owner.dash.assessed')} value={data.assessment.tenantsAssessed} />
              </div>
              <div className="oc-section-title">{t('owner.dash.distribution')}</div>
              {data.assessment.maturityDistribution.map((d: any) => {
                const max = Math.max(1, ...data.assessment.maturityDistribution.map((x: any) => x.tenants))
                return (
                  <div key={d.level} style={{ display: 'grid', gridTemplateColumns: '160px 1fr 32px', gap: 8, alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
                    <span>{levelText(d.level, t)}</span>
                    <div className="oc-bar"><span style={{ width: `${(d.tenants / max) * 100}%` }} /></div>
                    <span>{d.tenants}</span>
                  </div>
                )
              })}
              <div className="oc-muted">{data.assessment.note}</div>
            </div>
            <div className="oc-card">
              <h3>{t('owner.dash.recent')}</h3>
              {data.tenants.recent.length === 0 ? <div className="oc-muted">{t('owner.none')}</div> : (
                <ul style={{ listStyle: 'none' }}>
                  {data.tenants.recent.map((r: any) => (
                    <li key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => nav(`/owner/tenants/${r.id}`)}>{r.name}</button>
                      <span className="oc-muted" style={{ marginInlineStart: 8 }}>{fmtDate(r.createdAt, isAR)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="oc-section">
            <div className="oc-section-title">{t('owner.nav.tenants')}</div>
            <TenantTable rows={data.rows} onOpen={id => nav(`/owner/tenants/${id}`)} />
          </div>
        </>
      )}
    </div>
  )
}

export function TenantTable({ rows, onOpen }: { rows: any[]; onOpen: (id: string) => void }) {
  const { t, isAR } = useLang()
  if (!rows.length) return <div className="oc-muted">{t('owner.tenants.empty')}</div>
  return (
    <div className="oc-table-wrap">
      <table className="oc-table">
        <thead>
          <tr>
            <th>{t('owner.col.tenant')}</th><th>{t('owner.col.status')}</th><th>{t('owner.col.sector')}</th><th>{t('owner.col.users')}</th>
            <th>{t('owner.col.objects')}</th><th>{t('owner.col.relationships')}</th><th>{t('owner.col.maturity')}</th><th>{t('owner.col.health')}</th>
            <th>{t('owner.col.adoption')}</th><th>{t('owner.col.created')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="oc-click" onClick={() => onOpen(r.id)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') onOpen(r.id) }}>
              <td><strong>{isAR && r.nameAr ? r.nameAr : r.name}</strong><div className="oc-muted">{r.slug}{r.officialWebsite ? ` · ${r.officialWebsite.replace(/^https?:\/\//, '')}` : ''}</div></td>
              <td><Pill text={t(`owner.status.${r.status}`)} color={r.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)'} /></td>
              <td>{r.sector || '—'}</td>
              <td>{r.users}</td>
              <td>{r.repository?.total ?? 0}</td>
              <td>{r.repository?.relationships ?? 0}</td>
              <td>{r.assessment ? levelText(r.assessment.eaLevel, t) : '—'}</td>
              <td>{r.assessment?.healthScore ?? '—'}</td>
              <td>{r.assessment ? `${r.assessment.adoption.inUse}/${r.assessment.adoption.tracked}` : '—'}</td>
              <td>{fmtDate(r.createdAt, isAR)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
