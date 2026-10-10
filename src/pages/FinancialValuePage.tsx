import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import HelpTip from '../components/HelpTip'
import { useLang } from '../contexts/LangContext'
import { FvRights, NO_RIGHTS, makeFvApi } from './finvalue/fvApi'
import Overview from './finvalue/Overview'
import OpportunityList from './finvalue/OpportunityList'
import OpportunityWorkspace from './finvalue/OpportunityWorkspace'
import FinancialDataPanel from './finvalue/FinancialDataPanel'
import DataRequestsPanel from './finvalue/DataRequestsPanel'
import VerificationPanel from './finvalue/VerificationPanel'
import SettingsPanel from './finvalue/SettingsPanel'
import './repository/AssetProfile.css'
import './health/ArchitectureHealth.css'
import './finvalue/FinancialValue.css'

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'
const TABS = ['overview', 'opportunities', 'data', 'requests', 'verification', 'settings'] as const
type Tab = typeof TABS[number]

function useApi() {
  return useMemo(() => makeFvApi(API_URL), [])
}

/**
 * Financial Value Intelligence: savings opportunities discovered from the
 * architecture, the financial evidence behind them, their business cases and
 * lifecycle, and the savings Finance verified. Every figure comes from the
 * backend's deterministic calculation; this page never computes amounts.
 */
export default function FinancialValuePage() {
  const { t, isAR } = useLang()
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const [rights, setRights] = useState<FvRights | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tab = (TABS as readonly string[]).includes(params.get('tab') || '') ? params.get('tab') as Tab : 'overview'
  const opportunity = params.get('opportunity')

  useEffect(() => { api.get('/financial-value/me').then((r: any) => setRights({ ...NO_RIGHTS, ...r })).catch(e => { setError(e.message); setRights(NO_RIGHTS) }) }, [api])

  const go = (next: { tab?: string; opportunity?: string | null }) => setParams(p => {
    const n = new URLSearchParams(p)
    if (next.tab !== undefined) { if (next.tab === 'overview') n.delete('tab'); else n.set('tab', next.tab) }
    if (next.opportunity !== undefined) { if (next.opportunity) n.set('opportunity', next.opportunity); else n.delete('opportunity') }
    return n
  })
  const open = (id: string) => go({ opportunity: id })

  return (
    <div className="rp-page" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="rp-header">
        <div className="rp-header-main">
          <h1 className="rp-title">💰 {t('fv.title')} <HelpTip text={t('fv.help')} /></h1>
          <div className="rp-sub">{t('fv.subtitle')}</div>
        </div>
        <a className="ah-btn" href="/copilot" style={{ textDecoration: 'none' }}>💬 {t('fv.ask_copilot')}</a>
      </div>
      <div className="rp-strip" role="tablist" aria-label={t('fv.title')}>
        {TABS.map(x => <button key={x} type="button" role="tab" className="ap-tab" aria-selected={tab === x && !opportunity} onClick={() => go({ tab: x, opportunity: null })}>{t(`fv.tab.${x}`)}</button>)}
      </div>
      <div className="rp-content">
        {error && <div className="rp-banner" role="alert">{error}</div>}
        {!rights ? <div className="rp-card">{t('common.loading')}</div>
          : opportunity ? <OpportunityWorkspace key={opportunity} api={api} t={t} rights={rights} isAR={isAR} id={opportunity} onBack={() => go({ opportunity: null })} />
          : tab === 'overview' ? <Overview api={api} t={t} rights={rights} isAR={isAR} onOpen={open} onTab={x => go({ tab: x })} />
          : tab === 'opportunities' ? <OpportunityList api={api} t={t} rights={rights} onOpen={open} />
          : tab === 'data' ? <FinancialDataPanel api={api} t={t} rights={rights} />
          : tab === 'requests' ? <DataRequestsPanel api={api} t={t} rights={rights} onOpen={open} />
          : tab === 'verification' ? <VerificationPanel api={api} t={t} rights={rights} onOpen={open} />
          : <SettingsPanel api={api} t={t} rights={rights} />}
      </div>
    </div>
  )
}
