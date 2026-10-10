import { useCallback, useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import AssetPicker, { PickedAsset } from './AssetPicker'
import { ACTIONS, BENEFITS, ENGINES, FvApi, FvRights, STATUSES, T, money, num } from './fvApi'
import { StatusChip } from './Overview'

function CreateForm({ api, t, onCreated, onCancel }: { api: FvApi; t: T; onCreated: (id: string) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ title: '', engine: 'APPLICATION_RATIONALIZATION', action: 'RETIRE', benefitType: 'CASH_SAVING', description: '' })
  const [assets, setAssets] = useState<PickedAsset[]>([])
  const [subject, setSubject] = useState<PickedAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const submit = () => {
    setSaving(true); setError(null)
    api.post('/financial-value/opportunities', { ...form, assetIds: assets.map(a => a.id), subjectAssetId: subject[0]?.id || undefined })
      .then((o: any) => onCreated(o.id)).catch(e => setError(e.message)).finally(() => setSaving(false))
  }
  return (
    <div className="rp-card" data-testid="fv-create">
      <div className="rp-card-title">{t('fv.create.title')}<HelpTip text={t('fv.create.help')} /></div>
      <div className="fv-form">
        <div className="form-group fv-form-wide"><label className="form-label" htmlFor="fv-c-title">{t('fv.field.title')}</label><input id="fv-c-title" className="form-input" value={form.title} onChange={e => set('title', e.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="fv-c-engine">{t('fv.field.engine')}</label><select id="fv-c-engine" className="form-input" value={form.engine} onChange={e => set('engine', e.target.value)}>{ENGINES.map(x => <option key={x} value={x}>{t(`fv.engine.${x}`)}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="fv-c-action">{t('fv.field.action')}</label><select id="fv-c-action" className="form-input" value={form.action} onChange={e => set('action', e.target.value)}>{ACTIONS.map(x => <option key={x} value={x}>{t(`fv.action.${x}`)}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="fv-c-benefit">{t('fv.field.benefit')}</label><select id="fv-c-benefit" className="form-input" value={form.benefitType} onChange={e => set('benefitType', e.target.value)}>{BENEFITS.map(x => <option key={x} value={x}>{t(`fv.benefit.${x}`)}</option>)}</select></div>
        <div className="form-group fv-form-wide"><label className="form-label" htmlFor="fv-c-desc">{t('fv.field.description')}</label><textarea id="fv-c-desc" className="form-input" rows={3} value={form.description} onChange={e => set('description', e.target.value)} /></div>
        <div className="form-group"><label className="form-label" htmlFor="fv-c-subject">{t('fv.field.subject')}</label><AssetPicker api={api} t={t} id="fv-c-subject" value={subject} onChange={setSubject} single /></div>
        <div className="form-group"><label className="form-label" htmlFor="fv-c-assets">{t('fv.field.assets')}</label><AssetPicker api={api} t={t} id="fv-c-assets" value={assets} onChange={setAssets} /></div>
      </div>
      {form.benefitType === 'PRODUCTIVITY' && <div className="fv-note">{t('fv.create.productivity_note')}</div>}
      {error && <div className="rp-banner" role="alert">{error}</div>}
      <div className="fv-toolbar" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={saving || form.title.trim().length < 3}>{t('fv.create.submit')}</button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>{t('fv.cancel')}</button>
      </div>
    </div>
  )
}

/** The savings opportunity register. */
export default function OpportunityList({ api, t, rights, onOpen }: { api: FvApi; t: T; rights: FvRights; onOpen: (id: string) => void }) {
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({ status: '', engine: '', benefitType: '', search: '' })
  const [creating, setCreating] = useState(false)
  const load = useCallback(() => {
    const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as any).toString()
    api.get(`/financial-value/opportunities${q ? `?${q}` : ''}`).then(r => setRows(Array.isArray(r) ? r : [])).catch(e => setError(e.message))
  }, [api, filters])
  useEffect(() => { const h = setTimeout(load, 200); return () => clearTimeout(h) }, [load])
  const set = (k: string, v: string) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div data-testid="fv-register">
      {creating && <CreateForm api={api} t={t} onCancel={() => setCreating(false)} onCreated={id => { setCreating(false); onOpen(id) }} />}
      <div className="rp-card rp-card-gap">
        <div className="fv-toolbar">
          <label className="ah-dim" htmlFor="fv-f-search">{t('fv.filter.search')}</label>
          <input id="fv-f-search" className="form-input" value={filters.search} onChange={e => set('search', e.target.value)} />
          <label className="ah-dim" htmlFor="fv-f-status">{t('fv.status')}</label>
          <select id="fv-f-status" className="form-input" value={filters.status} onChange={e => set('status', e.target.value)}><option value="">{t('fv.all')}</option>{STATUSES.map(s => <option key={s} value={s}>{t(`fv.status.${s}`)}</option>)}</select>
          <label className="ah-dim" htmlFor="fv-f-engine">{t('fv.field.engine')}</label>
          <select id="fv-f-engine" className="form-input" value={filters.engine} onChange={e => set('engine', e.target.value)}><option value="">{t('fv.all')}</option>{ENGINES.map(s => <option key={s} value={s}>{t(`fv.engine.${s}`)}</option>)}</select>
          <label className="ah-dim" htmlFor="fv-f-benefit">{t('fv.field.benefit')}</label>
          <select id="fv-f-benefit" className="form-input" value={filters.benefitType} onChange={e => set('benefitType', e.target.value)}><option value="">{t('fv.all')}</option>{BENEFITS.map(s => <option key={s} value={s}>{t(`fv.benefit.${s}`)}</option>)}</select>
          <span style={{ flex: 1 }} />
          {rights.MANAGE_OPPORTUNITIES && !creating && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>+ {t('fv.create.open')}</button>}
        </div>
        {error && <div className="rp-banner" role="alert">{error}</div>}
        {!rows ? <div>{t('common.loading')}</div> : rows.length === 0 ? <div className="ah-dim">{t('fv.register.empty')}</div> : (
          <div className="rp-table-wrap">
            <table className="ah-table">
              <thead><tr><th>{t('fv.opportunity')}</th><th>{t('fv.field.engine')}</th><th>{t('fv.status')}</th><th>{t('fv.net_annual')}<HelpTip text={t('fv.net_annual.help')} /></th><th>{t('fv.one_time')}</th><th>{t('fv.payback')}</th><th>{t('fv.confidence')}</th><th>{t('fv.evidence_completeness')}</th><th>{t('fv.priority')}</th></tr></thead>
              <tbody>{rows.map(r => (
                <tr key={r.id}>
                  <td><button type="button" className="ah-link-btn" onClick={() => onOpen(r.id)}>{r.title}</button>
                    <div className="ah-dim">{t(`fv.action.${r.action}`)} · {t(`fv.source.${r.sourceKind}`)}{r.assets?.length ? ` · ${r.assets.map((a: any) => a.name).join(', ')}` : ''}{r.stale ? ` · ${t('fv.stale')}` : ''}</div>
                    {r.indicativeAnnualSaving ? <div className="ah-dim">{t('fv.indicative').replace('{amount}', money(r.indicativeAnnualSaving))}</div> : null}
                  </td>
                  <td>{t(`fv.engine.${r.engine}`)}</td>
                  <td><StatusChip status={r.status} t={t} /></td>
                  <td>{r.benefitType === 'COST_AVOIDANCE' ? <>{money(r.costAvoidance)}<div className="ah-dim">{t('fv.benefit.COST_AVOIDANCE')}</div></> : r.netAnnualSaving === null ? <span className="ah-dim">{t('fv.not_quantified')}</span> : money(r.netAnnualSaving)}</td>
                  <td>{money(r.oneTimeCost)}</td>
                  <td>{r.paybackMonths === null || r.paybackMonths === undefined ? '—' : `${r.paybackMonths} ${t('fv.months')}`}</td>
                  <td>{t(`fv.confidence.${r.confidence}`)}</td>
                  <td>{num(r.evidenceCompleteness, '%')}</td>
                  <td>{r.priorityClass ? t(`fv.class.${r.priorityClass}`) : '—'} {r.priorityScore !== null && <span className="ah-dim">{num(r.priorityScore)}</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
