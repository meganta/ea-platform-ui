import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import AssetPicker, { PickedAsset } from './AssetPicker'
import { BASES, COST_CATEGORIES, FvApi, FvRights, T, day, money } from './fvApi'

type Kind = 'costs' | 'contracts' | 'licenses'

function DataStatus({ s, t }: { s: string; t: T }) {
  return <span className={`fv-chip ${s === 'VALIDATED' ? 'fv-tone-good' : s === 'REJECTED' ? 'fv-tone-bad' : 'fv-tone-neutral'}`}>{t(`fv.data.${s}`)}</span>
}

function ValidateButtons({ rid, t, onDecide }: { rid: string; t: T; onDecide: (decision: 'VALIDATED' | 'REJECTED', note?: string) => void }) {
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')
  if (rejecting) return (
    <div>
      <label className="form-label" htmlFor={`fv-reject-${rid}`}>{t('fv.reason')}</label>
      <input id={`fv-reject-${rid}`} className="form-input" value={note} onChange={e => setNote(e.target.value)} />
      <div className="fv-toolbar" style={{ marginTop: 4 }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!note.trim()} onClick={() => onDecide('REJECTED', note)}>{t('fv.data.reject')}</button>
        <button type="button" className="ah-link-btn" onClick={() => setRejecting(false)}>{t('fv.cancel')}</button>
      </div>
    </div>
  )
  return (
    <div className="fv-toolbar" style={{ margin: 0 }}>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onDecide('VALIDATED')}>{t('fv.data.validate')}</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRejecting(true)}>{t('fv.data.reject')}</button>
    </div>
  )
}

/** The financial store: running costs, vendor contracts and licences of Repository objects, validated by Finance. */
export default function FinancialDataPanel({ api, t, rights }: { api: FvApi; t: T; rights: FvRights }) {
  const [kind, setKind] = useState<Kind>('costs')
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const load = useCallback(() => { setRows(null); api.get(`/financial-value/${kind}`).then(r => setRows(Array.isArray(r) ? r : [])).catch(e => setError(e.message)) }, [api, kind])
  useEffect(() => { load() }, [load])
  const decide = (id: string) => (decision: 'VALIDATED' | 'REJECTED', note?: string) => api.post(`/financial-value/${kind}/${id}/validate`, { decision, note }).then(() => { setMsg(t('fv.saved')); load() }).catch(e => setMsg(e.message))
  const requestCost = (assetId: string, field: 'ANNUAL_COST' | 'CONTRACT_TERMS') => api.post('/financial-value/data-requests/asset', { assetId, field }).then(() => setMsg(t('fv.req.requested'))).catch(e => setMsg(e.message))

  if (!rights.VIEW_FINANCIAL_DATA) return <div className="rp-card">{t('fv.restricted')}</div>
  return (
    <div data-testid="fv-data">
      <div className="fv-toolbar">
        <div className="ah-domains" role="group" aria-label={t('fv.data.title')} style={{ margin: 0 }}>
          {(['costs', 'contracts', 'licenses'] as Kind[]).map(k => <button key={k} type="button" className="ah-domain-btn" aria-pressed={kind === k} onClick={() => { setKind(k); setAdding(false) }}>{t(`fv.data.${k}`)}</button>)}
        </div>
        <HelpTip text={t(`fv.data.${kind}.help`)} />
        <span style={{ flex: 1 }} />
        {rights.MANAGE_DATA && !adding && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>+ {t(`fv.data.add.${kind}`)}</button>}
      </div>
      {msg && <div className="rp-banner" role="status">{msg}</div>}
      {error && <div className="rp-banner" role="alert">{error}</div>}
      {adding && <AddForm kind={kind} api={api} t={t} onDone={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />}
      <div className="rp-card rp-card-gap">
        {!rows ? t('common.loading') : rows.length === 0 ? <div className="ah-dim">{t('fv.data.empty')}</div> : (
          <div className="rp-table-wrap">
            {kind === 'costs' && (
              <table className="ah-table"><thead><tr><th>{t('fv.object')}</th><th>{t('fv.cost_item')}</th><th>{t('fv.annual_amount')}</th><th>{t('fv.basis')}</th><th>{t('fv.data_status')}</th><th>{t('fv.claimed_by')}</th><th /></tr></thead>
                <tbody>{rows.map(r => <tr key={r.id}><td>{r.asset ? <a href={`/repository?asset=${encodeURIComponent(r.asset.id)}`}>{r.asset.name}</a> : '—'}</td><td>{t(`fv.cost.${r.category}`)}{r.description ? <div className="ah-dim">{r.description}</div> : null}{r.vendor ? <div className="ah-dim">{r.vendor}</div> : null}</td>
                  <td>{money(r.annualAmount, r.currency)}</td><td>{t(`fv.basis.${r.basis}`)}</td><td><DataStatus s={r.status} t={t} /></td><td>{r.claims?.length || 0}</td>
                  <td>{r.status === 'SUBMITTED' && rights.VALIDATE_DATA && <ValidateButtons rid={r.id} t={t} onDecide={decide(r.id)} />}</td></tr>)}</tbody></table>
            )}
            {kind === 'contracts' && (
              <table className="ah-table"><thead><tr><th>{t('fv.contract')}</th><th>{t('fv.vendor')}</th><th>{t('fv.objects')}</th><th>{t('fv.annual_value')}</th><th>{t('fv.renewal_date')}</th><th>{t('fv.notice_by')}</th><th>{t('fv.data_status')}</th><th /></tr></thead>
                <tbody>{rows.map(r => <tr key={r.id}><td>{r.title}<div className="ah-dim">{r.reference || ''} {r.autoRenew ? `· ${t('fv.contract.auto_renew')}` : ''}</div></td><td>{r.vendor || '—'}</td><td>{(r.assets || []).map((a: any) => a.name).join(', ') || '—'}</td>
                  <td>{money(r.annualValue, r.currency)}</td><td>{day(r.renewalDate)}{r.renewal?.withinAlertWindow ? <div className="fv-chip fv-tone-go">{t('fv.contract.due').replace('{days}', String(r.renewal.daysUntil))}</div> : null}</td>
                  <td>{day(r.renewal?.noticeBy)}{r.renewal?.noticeOverdue ? <div className="fv-chip fv-tone-bad">{t('fv.contract.notice_passed')}</div> : null}</td><td><DataStatus s={r.dataStatus} t={t} /></td>
                  <td>{r.dataStatus === 'SUBMITTED' && rights.VALIDATE_DATA && <ValidateButtons rid={r.id} t={t} onDecide={decide(r.id)} />}</td></tr>)}</tbody></table>
            )}
            {kind === 'licenses' && (
              <table className="ah-table"><thead><tr><th>{t('fv.license.product')}</th><th>{t('fv.object')}</th><th>{t('fv.license.quantity')}</th><th>{t('fv.license.used')}</th><th>{t('fv.license.unused')}</th><th>{t('fv.license.measured')}</th><th>{t('fv.license.unit_cost')}</th><th>{t('fv.data_status')}</th><th /></tr></thead>
                <tbody>{rows.map(r => <tr key={r.id}><td>{r.productName}<div className="ah-dim">{r.vendor || ''}</div></td><td>{r.asset?.name || '—'}</td><td>{r.quantity}</td><td>{r.activeUsers ?? r.assigned ?? '—'}{r.utilizationPct !== null ? <div className="ah-dim">{r.utilizationPct}%</div> : null}</td>
                  <td>{r.unused ?? '—'}</td><td>{day(r.utilizationMeasuredAt)}</td><td>{money(r.unitCost, r.currency)}</td><td><DataStatus s={r.dataStatus} t={t} /></td>
                  <td>{r.dataStatus === 'SUBMITTED' && rights.VALIDATE_DATA && <ValidateButtons rid={r.id} t={t} onDecide={decide(r.id)} />}</td></tr>)}</tbody></table>
            )}
          </div>
        )}
      </div>
      {rights.MANAGE_DATA && <AssetRequest api={api} t={t} onRequest={requestCost} />}
    </div>
  )
}

function AssetRequest({ api, t, onRequest }: { api: FvApi; t: T; onRequest: (assetId: string, field: 'ANNUAL_COST' | 'CONTRACT_TERMS') => void }) {
  const [asset, setAsset] = useState<PickedAsset[]>([])
  return (
    <div className="rp-card rp-card-gap">
      <div className="rp-card-title">{t('fv.data.ask_owner')}<HelpTip text={t('fv.data.ask_owner.help')} /></div>
      <div className="fv-form">
        <div className="form-group"><label className="form-label" htmlFor="fv-ask-asset">{t('fv.object')}</label><AssetPicker api={api} t={t} id="fv-ask-asset" value={asset} onChange={setAsset} single /></div>
        <div className="fv-toolbar" style={{ margin: 0 }}>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!asset[0]} onClick={() => onRequest(asset[0].id, 'ANNUAL_COST')}>{t('fv.data.ask_cost')}</button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={!asset[0]} onClick={() => onRequest(asset[0].id, 'CONTRACT_TERMS')}>{t('fv.data.ask_contract')}</button>
        </div>
      </div>
    </div>
  )
}

function AddForm({ kind, api, t, onDone, onCancel }: { kind: Kind; api: FvApi; t: T; onDone: () => void; onCancel: () => void }) {
  const [f, setF] = useState<Record<string, any>>({ currency: 'SAR', category: 'SUPPORT', basis: 'CONTRACT', metric: 'USER' })
  const [assets, setAssets] = useState<PickedAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const set = (k: string, v: any) => setF(x => ({ ...x, [k]: v }))
  const n = (v: any) => (v === '' || v === undefined ? undefined : Number(v))
  const submit = () => {
    setError(null)
    const body = kind === 'costs'
      ? { assetId: assets[0]?.id, category: f.category, annualAmount: n(f.annualAmount), currency: f.currency, basis: f.basis, description: f.description, vendor: f.vendor, valuationDate: f.valuationDate || undefined }
      : kind === 'contracts'
        ? { title: f.title, vendor: f.vendor, reference: f.reference, assetIds: assets.map(a => a.id), annualValue: n(f.annualValue), currency: f.currency, startDate: f.startDate || undefined, endDate: f.endDate || undefined, renewalDate: f.renewalDate || undefined, noticePeriodDays: n(f.noticePeriodDays), terminationPenalty: n(f.terminationPenalty), autoRenew: !!f.autoRenew, terms: f.terms }
        : { productName: f.productName, assetId: assets[0]?.id, vendor: f.vendor, metric: f.metric, quantity: n(f.quantity), assigned: n(f.assigned), activeUsers: n(f.activeUsers), unitCost: n(f.unitCost), currency: f.currency, utilizationMeasuredAt: f.utilizationMeasuredAt || undefined, utilizationSource: f.utilizationSource }
    api.post(`/financial-value/${kind}`, body).then(onDone).catch(e => setError(e.message))
  }
  const field = (k: string, label: string, type = 'text') => (
    <div className="form-group" key={k}><label className="form-label" htmlFor={`fv-add-${k}`}>{label}</label><input id={`fv-add-${k}`} type={type} className="form-input" value={f[k] ?? ''} onChange={e => set(k, e.target.value)} /></div>
  )
  return (
    <div className="rp-card" data-testid="fv-add-form">
      <div className="rp-card-title">{t(`fv.data.add.${kind}`)}</div>
      <div className="fv-form">
        {kind === 'costs' && <>
          <div className="form-group"><label className="form-label" htmlFor="fv-add-asset">{t('fv.object')}</label><AssetPicker api={api} t={t} id="fv-add-asset" value={assets} onChange={setAssets} single /></div>
          <div className="form-group"><label className="form-label" htmlFor="fv-add-category">{t('fv.cost_type')}</label><select id="fv-add-category" className="form-input" value={f.category} onChange={e => set('category', e.target.value)}>{COST_CATEGORIES.map(c => <option key={c} value={c}>{t(`fv.cost.${c}`)}</option>)}</select></div>
          {field('annualAmount', t('fv.annual_amount'), 'number')}
          {field('currency', t('fv.currency'))}
          <div className="form-group"><label className="form-label" htmlFor="fv-add-basis">{t('fv.basis')}</label><select id="fv-add-basis" className="form-input" value={f.basis} onChange={e => set('basis', e.target.value)}>{BASES.map(b => <option key={b} value={b}>{t(`fv.basis.${b}`)}</option>)}</select></div>
          {field('description', t('fv.field.description'))}
          {field('vendor', t('fv.vendor'))}
          {field('valuationDate', t('fv.as_of'), 'date')}
        </>}
        {kind === 'contracts' && <>
          {field('title', t('fv.contract'))}{field('vendor', t('fv.vendor'))}{field('reference', t('fv.contract.reference'))}
          <div className="form-group"><label className="form-label" htmlFor="fv-add-assets">{t('fv.objects')}</label><AssetPicker api={api} t={t} id="fv-add-assets" value={assets} onChange={setAssets} /></div>
          {field('annualValue', t('fv.annual_value'), 'number')}{field('currency', t('fv.currency'))}{field('startDate', t('fv.contract.start'), 'date')}{field('endDate', t('fv.contract.end'), 'date')}
          {field('renewalDate', t('fv.renewal_date'), 'date')}{field('noticePeriodDays', t('fv.contract.notice_days'), 'number')}{field('terminationPenalty', t('fv.contract.penalty'), 'number')}
          <div className="form-group"><label className="ah-dim" htmlFor="fv-add-auto"><input id="fv-add-auto" type="checkbox" checked={!!f.autoRenew} onChange={e => set('autoRenew', e.target.checked)} /> {t('fv.contract.auto_renew')}</label></div>
          {field('terms', t('fv.contract.terms'))}
        </>}
        {kind === 'licenses' && <>
          {field('productName', t('fv.license.product'))}
          <div className="form-group"><label className="form-label" htmlFor="fv-add-lasset">{t('fv.object')}</label><AssetPicker api={api} t={t} id="fv-add-lasset" value={assets} onChange={setAssets} single /></div>
          {field('vendor', t('fv.vendor'))}{field('quantity', t('fv.license.quantity'), 'number')}{field('assigned', t('fv.license.assigned'), 'number')}{field('activeUsers', t('fv.license.active'), 'number')}
          {field('unitCost', t('fv.license.unit_cost'), 'number')}{field('currency', t('fv.currency'))}{field('utilizationMeasuredAt', t('fv.license.measured'), 'date')}{field('utilizationSource', t('fv.license.source'))}
        </>}
      </div>
      <div className="fv-note">{t('fv.data.submitted_note')}</div>
      {error && <div className="rp-banner" role="alert">{error}</div>}
      <div className="fv-toolbar" style={{ marginTop: 10 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={submit}>{t('fv.save')}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>{t('fv.cancel')}</button>
      </div>
    </div>
  )
}
