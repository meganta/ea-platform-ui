import { useCallback, useEffect, useRef, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { BASES, COST_CATEGORIES, FvApi, FvRights, ONE_TIME_CATEGORIES, T, day, saveBlob } from './fvApi'

type Line = Record<string, any>

/** Answer form for one request; the backend validates and Finance reviews before anything is used. */
function AnswerForm({ r, t, onSubmit }: { r: any; t: T; onSubmit: (response: any) => void }) {
  const [v, setV] = useState<Record<string, any>>({})
  const [lines, setLines] = useState<Line[]>([{}])
  const set = (k: string, x: any) => setV(o => ({ ...o, [k]: x }))
  const setLine = (i: number, k: string, x: any) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: x } : l)))
  const id = (k: string) => `fv-ans-${r.id}-${k}`
  const input = (k: string, label: string, type = 'text') => <div className="form-group" key={k}><label className="form-label" htmlFor={id(k)}>{label}</label><input id={id(k)} type={type} className="form-input" value={v[k] ?? ''} onChange={e => set(k, e.target.value)} /></div>
  const lineFields = r.field === 'ANNUAL_COST'
    ? [['category', COST_CATEGORIES, 'fv.cost.'], ['annualAmount'], ['currency'], ['basis', BASES, 'fv.basis.'], ['description']]
    : r.field === 'IMPLEMENTATION_COST'
      ? [['label'], ['category', ONE_TIME_CATEGORIES, 'fv.onetime.'], ['amount'], ['currency'], ['year'], ['basis', BASES, 'fv.basis.']]
      : [['label'], ['amount'], ['currency'], ['year'], ['basis', BASES, 'fv.basis.']]
  const isLines = ['ANNUAL_COST', 'IMPLEMENTATION_COST', 'AVOIDED_INVESTMENT'].includes(r.field)
  const submit = () => {
    if (isLines) onSubmit(v.noOneTimeCost ? { noOneTimeCost: 'YES' } : { lines: lines.filter(l => Object.values(l).some(x => x !== '' && x !== undefined)) })
    else onSubmit(v.noContract ? { noContract: 'YES' } : v)
  }
  return (
    <div className="rp-card rp-card-gap" data-testid="fv-answer">
      <div className="rp-card-title">{r.label}</div>
      <div className="ah-dim" style={{ marginBottom: 8 }}>{r.reason}</div>
      {isLines && (
        <>
          {r.field === 'IMPLEMENTATION_COST' && <label className="ah-dim" htmlFor={id('none')}><input id={id('none')} type="checkbox" checked={!!v.noOneTimeCost} onChange={e => set('noOneTimeCost', e.target.checked)} /> {t('fv.model.no_one_time')}</label>}
          {!v.noOneTimeCost && lines.map((l, i) => (
            <div key={i} className="fv-form" style={{ marginBottom: 6 }}>
              {lineFields.map(([k, opts, prefix]: any) => (
                <div className="form-group" key={k}><label className="form-label" htmlFor={id(`${i}-${k}`)}>{t(`fv.answer.${k}`)}</label>
                  {opts ? <select id={id(`${i}-${k}`)} className="form-input" value={l[k] ?? ''} onChange={e => setLine(i, k, e.target.value)}><option value="" />{opts.map((o: string) => <option key={o} value={o}>{t(`${prefix}${o}`)}</option>)}</select>
                    : <input id={id(`${i}-${k}`)} className="form-input" type={['annualAmount', 'amount', 'year'].includes(k) ? 'number' : 'text'} value={l[k] ?? ''} onChange={e => setLine(i, k, e.target.value)} />}
                </div>
              ))}
              {r.field === 'AVOIDED_INVESTMENT' && <label className="ah-dim" htmlFor={id(`${i}-rec`)}><input id={id(`${i}-rec`)} type="checkbox" checked={!!l.recurring} onChange={e => setLine(i, 'recurring', e.target.checked ? 'YES' : '')} /> {t('fv.line.recurring')}</label>}
            </div>
          ))}
          {!v.noOneTimeCost && <button type="button" className="ah-link-btn" onClick={() => setLines(ls => [...ls, {}])}>+ {t('fv.line.add')}</button>}
        </>
      )}
      {r.field === 'CONTRACT_TERMS' && (
        <>
          <label className="ah-dim" htmlFor={id('nocontract')}><input id={id('nocontract')} type="checkbox" checked={!!v.noContract} onChange={e => set('noContract', e.target.checked)} /> {t('fv.answer.no_contract')}</label>
          {!v.noContract && <div className="fv-form">{input('title', t('fv.contract'))}{input('vendor', t('fv.vendor'))}{input('annualValue', t('fv.annual_value'), 'number')}{input('currency', t('fv.currency'))}{input('renewalDate', t('fv.renewal_date'), 'date')}{input('endDate', t('fv.contract.end'), 'date')}{input('noticePeriodDays', t('fv.contract.notice_days'), 'number')}{input('terminationPenalty', t('fv.contract.penalty'), 'number')}{input('minimumCommitmentUntil', t('fv.contract.committed'), 'date')}</div>}
        </>
      )}
      {r.field === 'LICENSE_UTILIZATION' && <div className="fv-form">{input('assigned', t('fv.license.assigned'), 'number')}{input('activeUsers', t('fv.license.active'), 'number')}{input('measuredAt', t('fv.license.measured'), 'date')}{input('source', t('fv.license.source'))}</div>}
      {r.field === 'LICENSE_UNIT_COST' && <div className="fv-form">{input('unitCost', t('fv.license.unit_cost'), 'number')}{input('currency', t('fv.currency'))}</div>}
      <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={submit}>{t('fv.answer.submit')}</button>
    </div>
  )
}

export default function DataRequestsPanel({ api, t, rights, onOpen }: { api: FvApi; t: T; rights: FvRights; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [status, setStatus] = useState('OPEN')
  const [answering, setAnswering] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)
  const load = useCallback(() => { api.get(`/financial-value/data-requests${status ? `?status=${status}` : ''}`).then(r => setRows(Array.isArray(r) ? r : [])).catch(e => setMsg(e.message)) }, [api, status])
  useEffect(() => { load() }, [load])
  const run = (p: Promise<any>, ok: string) => p.then(() => { setMsg(ok); setAnswering(null); load() }).catch(e => setMsg(e.message))
  const upload = (file: File) => api.upload('/financial-value/data-requests/upload', file).then((r: any) => { setMsg(t('fv.collect.uploaded').replace('{submitted}', String(r.submitted)).replace('{invalid}', String(r.invalid)) + (r.results || []).filter((x: any) => x.errors.length).map((x: any) => ` · ${x.errors.join(', ')}`).join('')); load() }).catch(e => setMsg(e.message))

  return (
    <div data-testid="fv-requests">
      <div className="fv-toolbar">
        <label className="ah-dim" htmlFor="fv-rq-status">{t('fv.status')}</label>
        <select id="fv-rq-status" className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">{t('fv.all')}</option>{['OPEN', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'CANCELLED'].map(s => <option key={s} value={s}>{t(`fv.reqstatus.${s}`)}</option>)}
        </select>
        <HelpTip text={t('fv.collect.help')} />
        <span style={{ flex: 1 }} />
        {(rights.MANAGE_DATA || rights.MANAGE_OPPORTUNITIES) && <button type="button" className="ah-btn" onClick={() => api.blob('/financial-value/data-requests/template.xlsx').then(b => saveBlob(b, 'financial-data-collection.xlsx')).catch(e => setMsg(e.message))}>⬇ {t('fv.collect.template')}</button>}
        {rights.MANAGE_DATA && <>
          <button type="button" className="ah-btn" onClick={() => fileRef.current?.click()}>⬆ {t('fv.collect.upload')}</button>
          <input ref={fileRef} type="file" accept=".xlsx" aria-label={t('fv.collect.upload')} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
        </>}
      </div>
      {msg && <div className="rp-banner" role="status">{msg}</div>}
      <div className="rp-card">
        {!rows ? t('common.loading') : rows.length === 0 ? <div className="ah-dim">{t('fv.collect.empty')}</div> : (
          <div className="rp-table-wrap"><table className="ah-table"><thead><tr><th>{t('fv.request')}</th><th>{t('fv.opportunity')}</th><th>{t('fv.status')}</th><th>{t('fv.due')}</th><th /></tr></thead>
            <tbody>{rows.map(r => (
              <tr key={r.id}><td>{r.label}<div className="ah-dim">{r.reason}</div>{r.reviewNote ? <div className="ah-dim">{t('fv.collect.review_note')}: {r.reviewNote}</div> : null}</td>
                <td>{r.opportunityId ? <button type="button" className="ah-link-btn" onClick={() => onOpen(r.opportunityId)}>{r.opportunityTitle || t('fv.open')}</button> : '—'}</td>
                <td>{t(`fv.reqstatus.${r.status}`)}{r.response ? <div className="ah-dim">{t('fv.collect.answered').replace('{date}', day(r.respondedAt))}</div> : null}</td><td>{day(r.dueDate)}</td>
                <td>
                  {rights.MANAGE_DATA && ['OPEN', 'REJECTED'].includes(r.status) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAnswering(answering === r.id ? null : r.id)}>{t('fv.collect.answer')}</button>}
                  {rights.VALIDATE_DATA && r.status === 'SUBMITTED' && (
                    <div>
                      <pre className="ah-dim" style={{ whiteSpace: 'pre-wrap', margin: '0 0 4px', fontSize: 11 }}>{JSON.stringify(r.response, null, 1)}</pre>
                      <label className="form-label" htmlFor={`fv-rv-${r.id}`}>{t('fv.note')}</label>
                      <input id={`fv-rv-${r.id}`} className="form-input" value={notes[r.id] || ''} onChange={e => setNotes(n => ({ ...n, [r.id]: e.target.value }))} />
                      <div className="fv-toolbar" style={{ marginTop: 4 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => run(api.post(`/financial-value/data-requests/${r.id}/review`, { decision: 'VALIDATED', note: notes[r.id] || undefined }), t('fv.collect.validated'))}>{t('fv.data.validate')}</button>
                        <button type="button" className="btn btn-secondary btn-sm" disabled={!(notes[r.id] || '').trim()} onClick={() => run(api.post(`/financial-value/data-requests/${r.id}/review`, { decision: 'REJECTED', note: notes[r.id] }), t('fv.collect.rejected'))}>{t('fv.data.reject')}</button>
                      </div>
                    </div>
                  )}
                </td></tr>
            ))}</tbody></table></div>
        )}
      </div>
      {answering && rows?.find(r => r.id === answering) && <AnswerForm r={rows.find(r => r.id === answering)} t={t} onSubmit={response => run(api.post(`/financial-value/data-requests/${answering}/respond`, { response }), t('fv.collect.submitted'))} />}
    </div>
  )
}
