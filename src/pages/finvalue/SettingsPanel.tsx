import { useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { FvApi, FvRights, T } from './fvApi'

const USAGE_NUMBERS = ['infraIdleDays', 'cpuAvgThresholdPct', 'cpuPeakThresholdPct', 'memPeakThresholdPct', 'targetPeakUtilizationPct', 'nonProdHoursPerWeek', 'processMinHoursPerYear']
const CRITERIA = ['FINANCIAL_BENEFIT', 'FINANCIAL_CONFIDENCE', 'IMPLEMENTATION_COST', 'IMPLEMENTATION_COMPLEXITY', 'TECHNICAL_FEASIBILITY', 'BUSINESS_IMPACT', 'SECURITY_COMPLIANCE', 'TIME_TO_REALIZE', 'DEPENDENCY_COMPLEXITY', 'STRATEGIC_ALIGNMENT', 'ARCHITECTURE_ALIGNMENT']

/** Tenant settings of the module, read and saved through the Tenant Settings API (/config/financial-value). */
export default function SettingsPanel({ api, t, rights }: { api: FvApi; t: T; rights: FvRights }) {
  const [s, setS] = useState<any>(null)
  const [rates, setRates] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => { api.get('/config/financial-value').then((r: any) => { setS(r); setRates(Object.entries(r.exchangeRates || {}).map(([k, v]) => `${k}=${v}`).join(', ')) }).catch(e => setMsg(e.message)) }, [api])
  if (!s) return <div className="rp-card">{msg || t('common.loading')}</div>
  const ro = !rights.CONFIGURE
  const set = (k: string, v: any) => setS((x: any) => ({ ...x, [k]: v }))
  const save = () => {
    const exchangeRates = Object.fromEntries(rates.split(',').map(p => p.split('=').map(x => x.trim())).filter(([k, v]) => k && v).map(([k, v]) => [k.toUpperCase(), Number(v)]))
    api.put('/config/financial-value', {
      exchangeRates, exchangeRatesValuationDate: s.exchangeRatesValuationDate || null, discountRatePct: Number(s.discountRatePct), escalationRatePct: Number(s.escalationRatePct), horizonYears: Number(s.horizonYears),
      renewalAlertDays: Number(s.renewalAlertDays), licenseUnusedThresholdPct: Number(s.licenseUnusedThresholdPct), licenseMinUnusedUnits: Number(s.licenseMinUnusedUnits), utilizationMaxAgeDays: Number(s.utilizationMaxAgeDays),
      strategicThreshold: Number(s.strategicThreshold), segregationOfDuties: !!s.segregationOfDuties, continuousDiscovery: !!s.continuousDiscovery,
      ...Object.fromEntries(USAGE_NUMBERS.map(k => [k, Number(s[k])])), benchmarkingOptIn: !!s.benchmarkingOptIn, costOverlayInViews: !!s.costOverlayInViews,
      criteriaWeights: Object.fromEntries(CRITERIA.map(c => [c, Number(s.criteriaWeights[c])])),
    }).then(r => { setS(r); setMsg(t('fv.saved')) }).catch(e => setMsg(e.message))
  }
  const num = (k: string, label: string, help?: string) => (
    <div className="form-group" key={k}><label className="form-label" htmlFor={`fv-s-${k}`}>{label}{help && <HelpTip text={help} />}</label><input id={`fv-s-${k}`} type="number" className="form-input" disabled={ro} value={s[k] ?? ''} onChange={e => set(k, e.target.value)} /></div>
  )
  return (
    <div data-testid="fv-settings">
      {msg && <div className="rp-banner" role="status">{msg}</div>}
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.set.money')}<HelpTip text={t('fv.set.money.help')} /></div>
        <div className="fv-form">
          <div className="form-group"><label className="form-label" htmlFor="fv-s-base">{t('fv.set.base')}</label><input id="fv-s-base" className="form-input" value={s.baseCurrency} disabled /></div>
          <div className="form-group"><label className="form-label" htmlFor="fv-s-rates">{t('fv.set.rates')}</label><input id="fv-s-rates" className="form-input" disabled={ro} value={rates} onChange={e => setRates(e.target.value)} /></div>
          <div className="form-group"><label className="form-label" htmlFor="fv-s-valuation">{t('fv.set.valuation')}</label><input id="fv-s-valuation" type="date" className="form-input" disabled={ro} value={s.exchangeRatesValuationDate || ''} onChange={e => set('exchangeRatesValuationDate', e.target.value)} /></div>
          {num('discountRatePct', t('fv.set.discount'))}{num('escalationRatePct', t('fv.set.escalation'))}{num('horizonYears', t('fv.set.horizon'))}{num('strategicThreshold', t('fv.set.strategic'))}
        </div>
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.set.discovery')}</div>
        <div className="fv-form">
          {num('renewalAlertDays', t('fv.set.renewal_days'))}{num('licenseUnusedThresholdPct', t('fv.set.unused_pct'))}{num('licenseMinUnusedUnits', t('fv.set.unused_units'))}{num('utilizationMaxAgeDays', t('fv.set.utilization_age'))}
          <div className="form-group"><label className="ah-dim" htmlFor="fv-s-cont"><input id="fv-s-cont" type="checkbox" disabled={ro} checked={!!s.continuousDiscovery} onChange={e => set('continuousDiscovery', e.target.checked)} /> {t('fv.set.continuous')}</label></div>
          <div className="form-group"><label className="ah-dim" htmlFor="fv-s-sod"><input id="fv-s-sod" type="checkbox" disabled={ro} checked={!!s.segregationOfDuties} onChange={e => set('segregationOfDuties', e.target.checked)} /> {t('fv.set.sod')}</label><HelpTip text={t('fv.set.sod.help')} /></div>
        </div>
      </div>
      <div className="rp-card rp-card-gap" data-testid="fv-settings-usage">
        <div className="rp-card-title">{t('fv.set.usage')}<HelpTip text={t('fv.set.usage.help')} /></div>
        <div className="fv-form">{USAGE_NUMBERS.map(k => num(k, t(`fv.set.${k}`)))}</div>
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.set.sharing')}</div>
        <div className="fv-form">
          <div className="form-group"><label className="ah-dim" htmlFor="fv-s-bench"><input id="fv-s-bench" type="checkbox" disabled={ro} checked={!!s.benchmarkingOptIn} onChange={e => set('benchmarkingOptIn', e.target.checked)} /> {t('fv.set.benchmarking')}</label><HelpTip text={t('fv.set.benchmarking.help')} /></div>
          <div className="form-group"><label className="ah-dim" htmlFor="fv-s-overlay"><input id="fv-s-overlay" type="checkbox" disabled={ro} checked={!!s.costOverlayInViews} onChange={e => set('costOverlayInViews', e.target.checked)} /> {t('fv.set.overlay')}</label><HelpTip text={t('fv.set.overlay.help')} /></div>
        </div>
      </div>
      <div className="rp-card rp-card-gap" data-testid="fv-settings-notifications">
        <div className="rp-card-title">{t('fv.set.notifications')}<HelpTip text={t('fv.set.notifications.help')} /></div>
        <div className="ah-dim">{t('fv.set.notifications.text')}</div>
        <a className="ah-link-btn" href="/notifications">{t('fv.set.notifications.open')}</a>
      </div>
      <div className="rp-card rp-card-gap">
        <div className="rp-card-title">{t('fv.set.weights')}<HelpTip text={t('fv.set.weights.help')} /></div>
        <div className="fv-form">{CRITERIA.map(c => <div className="form-group" key={c}><label className="form-label" htmlFor={`fv-w-${c}`}>{t(`fv.crit.${c}`)}</label><input id={`fv-w-${c}`} type="number" min={0} max={100} className="form-input" disabled={ro} value={s.criteriaWeights[c] ?? 0} onChange={e => setS((x: any) => ({ ...x, criteriaWeights: { ...x.criteriaWeights, [c]: e.target.value } }))} /></div>)}</div>
      </div>
      {!ro ? <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={save}>{t('fv.save')}</button> : <div className="ah-dim" style={{ marginTop: 8 }}>{t('fv.set.read_only')}</div>}
    </div>
  )
}
