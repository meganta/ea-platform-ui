import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { FvApi, FvRights, T, day, money } from './fvApi'

/** Finance's queue: business cases awaiting validation and measured savings awaiting verification. */
export default function VerificationPanel({ api, t, rights, onOpen }: { api: FvApi; t: T; rights: FvRights; onOpen: (id: string) => void }) {
  const [cases, setCases] = useState<any[] | null>(null)
  const [realizations, setRealizations] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    api.get('/financial-value/opportunities?status=BUSINESS_CASE_PREPARED').then(r => setCases(Array.isArray(r) ? r : [])).catch(e => setError(e.message))
    api.get('/financial-value/realizations?status=SUBMITTED').then(r => setRealizations(Array.isArray(r) ? r : [])).catch(e => setError(e.message))
  }, [api])
  useEffect(() => { load() }, [load])
  return (
    <div data-testid="fv-verification">
      {error && <div className="rp-banner" role="alert">{error}</div>}
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.verif.cases')}<HelpTip text={t('fv.verif.cases.help')} /></div>
        {!cases ? t('common.loading') : cases.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : (
          <ul className="ah-list">{cases.map(c => <li key={c.id}><button type="button" className="ah-link-btn" onClick={() => onOpen(c.id)}>{c.title}</button> <span className="ah-dim">{money(c.netAnnualSaving ?? c.costAvoidance)} · {t(`fv.confidence.${c.confidence}`)}</span></li>)}</ul>
        )}
        {!rights.VALIDATE_FINANCE && <div className="ah-dim" style={{ marginTop: 6 }}>{t('fv.verif.no_finance_right')}</div>}
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.verif.realizations')}<HelpTip text={t('fv.verif.realizations.help')} /></div>
        {!realizations ? t('common.loading') : realizations.length === 0 ? <div className="ah-dim">{t('fv.none')}</div> : (
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.opportunity')}</th><th>{t('fv.period')}</th><th>{t('fv.baseline')}</th><th>{t('fv.actual')}</th><th>{t('fv.realized')}</th><th>{t('fv.submitted')}</th></tr></thead>
            <tbody>{realizations.map(r => <tr key={r.id}><td><button type="button" className="ah-link-btn" onClick={() => onOpen(r.opportunityId)}>{r.opportunityTitle}</button></td><td>{day(r.periodStart)} – {day(r.periodEnd)}</td><td>{money(r.baselineAmount, r.currency)}</td><td>{money(r.actualAmount, r.currency)}</td><td>{money(r.realizedAmount, r.currency)}</td><td>{day(r.submittedAt)}</td></tr>)}</tbody></table></div>
        )}
        {!rights.VERIFY_SAVINGS && <div className="ah-dim" style={{ marginTop: 6 }}>{t('fv.verif.no_verify_right')}</div>}
      </div>
    </div>
  )
}
