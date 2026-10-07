import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import { ErrorBox, Header, Loading, Tile } from '../ownerUi'
import { outreachApi } from './outreachApi'
import { OutreachNav } from './OutreachShell'

const TILES: Array<[string, string]> = [
  ['entities', 'owner.outreach.dash.entities'], ['relevantProfessionals', 'owner.outreach.dash.professionals'],
  ['eaLeaders', 'owner.outreach.dash.ea_leaders'], ['dtLeaders', 'owner.outreach.dash.dt_leaders'], ['innovationLeaders', 'owner.outreach.dash.innovation_leaders'],
  ['entitiesWithoutTenant', 'owner.outreach.dash.no_tenant'], ['tenantsFromOutreach', 'owner.outreach.dash.tenants_created'], ['tenantsEnriched', 'owner.outreach.dash.tenants_enriched'],
  ['invitationsSent', 'owner.outreach.dash.invitations_sent'], ['activatedUsers', 'owner.outreach.dash.activated'], ['engagedTenants', 'owner.outreach.dash.engaged_tenants'],
]

export default function OutreachDashboardPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => { setError(''); outreachApi.dashboard().then(setData).catch((e: any) => setError(e.message)) }, [])
  useEffect(load, [load])
  const max = data ? Math.max(1, ...data.funnel.map((f: any) => f.count)) : 1
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.title')} subtitle={t('owner.outreach.subtitle')} help={t('owner.outreach.help')}
        actions={<button type="button" className="btn btn-primary" onClick={() => nav('/owner/outreach/entities?discover=1')}>{t('owner.outreach.entities.discover')}</button>} />
      <OutreachNav />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!data && !error && <Loading />}
      {data && (
        <>
          {!data.email?.configured && <div className="oc-warn" role="note">{t('owner.outreach.email_not_configured')}</div>}
          <div className="stat-grid-4">
            {TILES.map(([k, label]) => <Tile key={k} label={t(label)} value={data.metrics[k] ?? 0} />)}
          </div>
          <div className="oc-card" style={{ marginTop: 16 }}>
            <h2 className="oc-h2">{t('owner.outreach.dash.funnel')}</h2>
            <ol className="oc-funnel" aria-label={t('owner.outreach.dash.funnel')}>
              {data.funnel.map((f: any) => (
                <li key={f.stage}>
                  <span className="oc-funnel-label">{t(`owner.outreach.funnel.${f.stage}`)}</span>
                  <span className="oc-funnel-bar"><span style={{ width: `${Math.round((f.count / max) * 100)}%` }} /></span>
                  <span className="oc-funnel-count">{f.count}</span>
                </li>
              ))}
            </ol>
            <div className="oc-muted">{t('owner.outreach.dash.funnel_note')}</div>
          </div>
          {Object.keys(data.entitiesByType || {}).length > 0 && (
            <div className="oc-card" style={{ marginTop: 16 }}>
              <h2 className="oc-h2">{t('owner.outreach.dash.by_type')}</h2>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {Object.entries(data.entitiesByType).map(([k, v]: any) => (
                  <button key={k} type="button" className="btn btn-sm btn-secondary" onClick={() => nav(`/owner/outreach/entities?type=${k}`)}>{t(`owner.outreach.type.${k}`)} · {v}</button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
