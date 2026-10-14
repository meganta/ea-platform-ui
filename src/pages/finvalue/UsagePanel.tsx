import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import AssetPicker, { PickedAsset } from './AssetPicker'
import { FvApi, FvRights, T, day, money } from './fvApi'

export const USAGE_KINDS = ['INFRASTRUCTURE', 'PROCESS'] as const
export const ENVIRONMENTS = ['PROD', 'NONPROD', 'TEST', 'DEV', 'UAT', 'STAGING'] as const
export const REDUNDANCY_ROLES = ['PRIMARY', 'FAILOVER', 'DR', 'STANDBY'] as const
export const INFRA_METRICS = ['cpuAvgPct', 'cpuPeakPct', 'memAvgPct', 'memPeakPct', 'storageAllocatedGb', 'storageUsedGb', 'idleDays', 'vcpu', 'memoryGb'] as const
export const PROCESS_METRICS = ['casesPerYear', 'minutesPerCase', 'errorRatePct', 'hourlyCost'] as const
export const INGEST_SOURCES = ['API', 'ERP', 'PROCUREMENT', 'CLOUD_BILLING', 'MONITORING', 'PROCESS_MINING', 'ITAM'] as const

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'
const EMPTY = { kind: 'INFRASTRUCTURE', resourceName: '', environment: '', redundancyRole: '', periodStart: '', periodEnd: '', monthlyCost: '', currency: 'SAR', alwaysOn: false, metrics: {} as Record<string, string> }

/**
 * Measured usage that feeds infrastructure FinOps (idle, scheduling,
 * rightsizing, storage) and process automation discovery, the cloud billing
 * import and the batch ingestion API for ERP / procurement / ITAM / monitoring.
 */
export default function UsagePanel({ api, t, rights }: { api: FvApi; t: T; rights: FvRights }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [kind, setKind] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [asset, setAsset] = useState<PickedAsset[]>([])
  const [msg, setMsg] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [billing, setBilling] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { if (!rights.VIEW_FINANCIAL_DATA) return; api.get(`/financial-value/usage${kind ? `?kind=${kind}` : ''}`).then(r => setRows(Array.isArray(r) ? r : [])).catch(e => { setMsg(e.message); setRows([]) }) }, [api, kind, rights.VIEW_FINANCIAL_DATA])
  useEffect(() => { load() }, [load])
  if (!rights.VIEW_FINANCIAL_DATA) return <div className="rp-card">{t('fv.restricted')}</div>
  const metricKeys: readonly string[] = form.kind === 'PROCESS' ? PROCESS_METRICS : INFRA_METRICS
  const save = () => {
    const metrics: Record<string, any> = Object.fromEntries(Object.entries(form.metrics).filter(([k, v]) => metricKeys.includes(k) && v !== '').map(([k, v]) => [k, Number(v)]))
    if (form.kind === 'INFRASTRUCTURE') metrics.alwaysOn = form.alwaysOn
    api.post('/financial-value/usage', {
      kind: form.kind, resourceName: form.resourceName.trim(), assetId: asset[0]?.id || null, environment: form.kind === 'INFRASTRUCTURE' ? form.environment || null : null,
      redundancyRole: form.kind === 'INFRASTRUCTURE' ? form.redundancyRole || null : null, periodStart: form.periodStart || null, periodEnd: form.periodEnd || null, metrics,
      monthlyCost: form.kind === 'INFRASTRUCTURE' && form.monthlyCost !== '' ? Number(form.monthlyCost) : null, currency: form.currency,
    }).then((r: any) => { setMsg([t('fv.usage.saved'), ...(r?.warnings || [])].join(' ')); setForm({ ...EMPTY, kind: form.kind }); setAsset([]); load() }).catch(e => setMsg(e.message))
  }
  const remove = (id: string) => api.del(`/financial-value/usage/${id}`).then(() => load()).catch(e => setMsg(e.message))
  const importBilling = () => {
    if (!file) return
    setBusy(true); setBilling(null)
    api.upload('/financial-value/ingest/cloud-billing', file).then((r: any) => { setBilling(r); setFile(null); load() }).catch(e => setMsg(e.message)).finally(() => setBusy(false))
  }
  const example = JSON.stringify({ source: 'ERP', costs: [{ sourceRef: 'INV-2026-0042', assetName: 'CRM', category: 'LICENSE', annualAmount: 0, currency: 'SAR', basis: 'ACTUAL' }], usage: [{ sourceRef: 'vm-01-2026-09', kind: 'INFRASTRUCTURE', resourceName: 'vm-01', environment: 'PROD', metrics: { cpuAvgPct: 0, cpuPeakPct: 0 }, monthlyCost: 0 }] }, null, 2)

  return (
    <div data-testid="fv-usage">
      {msg && <div className="rp-banner" role="status">{msg}</div>}
      <div className="rp-card">
        <div className="rp-card-title">{t('fv.usage.title')}<HelpTip text={t('fv.usage.help')} /></div>
        <div className="fv-toolbar">
          <label className="ah-dim" htmlFor="fv-u-filter">{t('fv.usage.kind')}</label>
          <select id="fv-u-filter" className="form-input" value={kind} onChange={e => setKind(e.target.value)}><option value="">{t('fv.all')}</option>{USAGE_KINDS.map(k => <option key={k} value={k}>{t(`fv.usage.kind.${k}`)}</option>)}</select>
        </div>
        {!rows ? t('common.loading') : rows.length === 0 ? <div className="ah-dim">{t('fv.usage.none')}</div> : (
          <div className="rp-table-wrap"><table className="ah-table" data-testid="fv-usage-table"><thead><tr><th>{t('fv.usage.resource')}</th><th>{t('fv.usage.kind')}</th><th>{t('fv.usage.environment')}</th><th>{t('fv.usage.measures')}</th><th>{t('fv.usage.monthly')}</th><th>{t('fv.period')}</th><th>{t('fv.usage.source')}</th><th /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}>
                <td>{r.resourceName}{r.assetName ? <div className="ah-dim"><a href={`/repository?asset=${encodeURIComponent(r.assetId)}`}>{r.assetName}</a></div> : <div className="ah-dim">{t('fv.usage.unlinked')}</div>}</td>
                <td>{t(`fv.usage.kind.${r.kind}`)}</td>
                <td>{r.environment ? t(`fv.usage.env.${r.environment}`) : '—'}{r.redundancyRole ? <div className="ah-dim">{t(`fv.usage.role.${r.redundancyRole}`)}</div> : null}</td>
                <td className="ah-dim">{Object.entries(r.metrics || {}).map(([k, v]) => `${t(`fv.usage.m.${k}`)}: ${v}`).join(' · ') || '—'}</td>
                <td>{money(r.monthlyCost, r.currency)}</td>
                <td>{day(r.periodStart)} – {day(r.periodEnd)}</td>
                <td>{t(`fv.usage.src.${r.source}`)}</td>
                <td>{rights.MANAGE_DATA && <button type="button" className="ah-link-btn" aria-label={`${t('fv.remove')} ${r.resourceName}`} onClick={() => remove(r.id)}>×</button>}</td>
              </tr>
            ))}</tbody></table></div>
        )}
      </div>

      {rights.MANAGE_DATA && (
        <div className="rp-card rp-card-gap" data-testid="fv-usage-form">
          <div className="rp-card-title">{t('fv.usage.add')}<HelpTip text={t('fv.usage.add.help')} /></div>
          <div className="fv-form">
            <div className="form-group"><label className="form-label" htmlFor="fv-u-kind">{t('fv.usage.kind')}</label><select id="fv-u-kind" className="form-input" value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value, metrics: {} }))}>{USAGE_KINDS.map(k => <option key={k} value={k}>{t(`fv.usage.kind.${k}`)}</option>)}</select></div>
            <div className="form-group"><label className="form-label" htmlFor="fv-u-name">{form.kind === 'PROCESS' ? t('fv.usage.process') : t('fv.usage.resource')}</label><input id="fv-u-name" className="form-input" value={form.resourceName} onChange={e => setForm(f => ({ ...f, resourceName: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label" htmlFor="fv-u-asset">{t('fv.usage.object')}</label><AssetPicker api={api} t={t} id="fv-u-asset" value={asset} onChange={setAsset} single /></div>
            {form.kind === 'INFRASTRUCTURE' && <>
              <div className="form-group"><label className="form-label" htmlFor="fv-u-env">{t('fv.usage.environment')}</label><select id="fv-u-env" className="form-input" value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}><option value="">—</option>{ENVIRONMENTS.map(x => <option key={x} value={x}>{t(`fv.usage.env.${x}`)}</option>)}</select></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-u-role">{t('fv.usage.role')}<HelpTip text={t('fv.usage.role.help')} /></label><select id="fv-u-role" className="form-input" value={form.redundancyRole} onChange={e => setForm(f => ({ ...f, redundancyRole: e.target.value }))}><option value="">—</option>{REDUNDANCY_ROLES.map(x => <option key={x} value={x}>{t(`fv.usage.role.${x}`)}</option>)}</select></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-u-cost">{t('fv.usage.monthly')}</label><input id="fv-u-cost" type="number" min={0} className="form-input" value={form.monthlyCost} onChange={e => setForm(f => ({ ...f, monthlyCost: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label" htmlFor="fv-u-cur">{t('fv.line.currency')}</label><input id="fv-u-cur" className="form-input" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} /></div>
              <div className="form-group"><label className="ah-dim" htmlFor="fv-u-always"><input id="fv-u-always" type="checkbox" checked={form.alwaysOn} onChange={e => setForm(f => ({ ...f, alwaysOn: e.target.checked }))} /> {t('fv.usage.always_on')}</label></div>
            </>}
            <div className="form-group"><label className="form-label" htmlFor="fv-u-from">{t('fv.realization.from')}</label><input id="fv-u-from" type="date" className="form-input" value={form.periodStart} onChange={e => setForm(f => ({ ...f, periodStart: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label" htmlFor="fv-u-to">{t('fv.realization.to')}</label><input id="fv-u-to" type="date" className="form-input" value={form.periodEnd} onChange={e => setForm(f => ({ ...f, periodEnd: e.target.value }))} /></div>
            {metricKeys.map(k => (
              <div className="form-group" key={k}><label className="form-label" htmlFor={`fv-u-m-${k}`}>{t(`fv.usage.m.${k}`)}</label><input id={`fv-u-m-${k}`} type="number" min={0} className="form-input" value={form.metrics[k] ?? ''} onChange={e => setForm(f => ({ ...f, metrics: { ...f.metrics, [k]: e.target.value } }))} /></div>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={!form.resourceName.trim()} onClick={save}>{t('fv.usage.save')}</button>
          {form.kind === 'INFRASTRUCTURE' && <div className="fv-note">{t('fv.usage.cost_note')}</div>}
        </div>
      )}

      {rights.MANAGE_DATA && (
        <div className="rp-card rp-card-gap" data-testid="fv-billing">
          <div className="rp-card-title">{t('fv.billing.title')}<HelpTip text={t('fv.billing.help')} /></div>
          <div className="fv-toolbar">
            <label className="form-label" htmlFor="fv-billing-file">{t('fv.billing.file')}</label>
            <input id="fv-billing-file" type="file" accept=".csv,.xlsx,.xls" className="form-input" onChange={e => setFile(e.target.files?.[0] || null)} />
            <button type="button" className="btn btn-secondary btn-sm" disabled={!file || busy} onClick={importBilling}>{busy ? t('fv.billing.importing') : t('fv.billing.import')}</button>
          </div>
          {billing && (
            <div data-testid="fv-billing-result">
              <div>{t('fv.billing.result').replace('{label}', billing.label || billing.format).replace('{resources}', String(billing.resources)).replace('{unlinked}', String(billing.unlinkedResources || 0))}</div>
              <div className="ah-dim">{Object.entries(billing.counts || {}).map(([k, v]) => `${t(`fv.ingest.status.${k}`)}: ${v}`).join(' · ')}{billing.skippedLines ? ` · ${t('fv.billing.skipped').replace('{n}', String(billing.skippedLines))}` : ''}</div>
              {billing.note && <div className="fv-note">{billing.note}</div>}
            </div>
          )}
          <div className="ah-dim" style={{ marginTop: 6 }}>{t('fv.billing.tags')}</div>
        </div>
      )}

      <div className="rp-card rp-card-gap" data-testid="fv-ingest-api">
        <div className="rp-card-title">{t('fv.ingest.title')}<HelpTip text={t('fv.ingest.help')} /></div>
        <div>{t('fv.ingest.endpoint')}: <code>POST {API_URL}/financial-value/ingest</code></div>
        <div className="ah-dim" style={{ marginTop: 4 }}>{t('fv.ingest.sources')}: {INGEST_SOURCES.map(s => t(`fv.usage.src.${s}`)).join(' · ')}</div>
        <ul className="ah-list" style={{ marginTop: 6 }}>{['fv.ingest.rule.1', 'fv.ingest.rule.2', 'fv.ingest.rule.3', 'fv.ingest.rule.4'].map(k => <li key={k}>{t(k)}</li>)}</ul>
        <details><summary className="ah-dim">{t('fv.ingest.example')}</summary><pre className="fv-pre" dir="ltr">{example}</pre></details>
      </div>
    </div>
  )
}
