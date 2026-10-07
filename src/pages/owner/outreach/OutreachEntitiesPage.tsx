import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { ErrorBox, Header, Loading, Pill } from '../ownerUi'
import { outreachApi, ENTITY_TYPES, GOV_STATUSES, TENANT_MATCHES, ENTITY_OUTREACH, GOV_COLOR, MATCH_COLOR, entityName } from './outreachApi'
import { JobProgress, OutreachNav } from './OutreachShell'

const MAX_BULK = 10

export default function OutreachEntitiesPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [type, setType] = useState(params.get('type') || '')
  const [gov, setGov] = useState('')
  const [tenant, setTenant] = useState('')
  const [outreach, setOutreach] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [jobs, setJobs] = useState<any[]>([])
  const [adding, setAdding] = useState(false)
  const [notice, setNotice] = useState('')
  const discovering = params.get('discover') === '1'

  const load = useCallback(() => {
    setError('')
    outreachApi.entities({ search: search || undefined, type: type || undefined, government: gov || undefined, tenant: tenant || undefined, outreach: outreach || undefined }).then(setData).catch((e: any) => setError(e.message))
  }, [search, type, gov, tenant, outreach])
  const loadJobs = useCallback(() => { outreachApi.jobs({ active: 'true' }).then((j: any) => setJobs(Array.isArray(j) ? j : [])).catch(() => setJobs([])) }, [])
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h) }, [load])
  useEffect(loadJobs, [loadJobs])

  const setDiscovering = (v: boolean) => { const p = new URLSearchParams(params); if (v) p.set('discover', '1'); else p.delete('discover'); setParams(p) }
  const groups = useMemo(() => {
    const out: Record<string, any[]> = {}
    for (const e of data?.entities || []) (out[e.entityType] ||= []).push(e)
    return ENTITY_TYPES.filter(k => out[k]?.length).map(k => ({ type: k, entities: out[k] }))
  }, [data])
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else if (n.size < MAX_BULK) n.add(id); return n })

  const research = async () => {
    setNotice('')
    try {
      const r = await outreachApi.discover({ mode: 'PROFESSIONALS', entityIds: [...selected] })
      setSelected(new Set())
      setNotice(t('owner.outreach.entities.research_started').replace('{n}', String(r.jobs.length)).replace('{skipped}', String(r.skipped.length)))
      loadJobs()
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.entities.title')} subtitle={t('owner.outreach.entities.subtitle')} help={t('owner.outreach.entities.help')}
        actions={<>
          <button type="button" className="btn btn-secondary" onClick={() => setAdding(true)}>{t('owner.outreach.entities.add')}</button>
          <button type="button" className="btn btn-primary" onClick={() => setDiscovering(true)}>{t('owner.outreach.entities.discover')}</button>
        </>} />
      <OutreachNav />
      {error && <ErrorBox error={error} onRetry={load} />}
      {notice && <div className="oc-ok" role="status">{notice}</div>}
      {jobs.filter(j => j.status !== 'COMPLETED').map(j => <JobProgress key={j.id} jobId={j.id} onDone={() => { load(); loadJobs() }} />)}
      <div className="oc-toolbar">
        <label htmlFor="or-ent-search" className="sr-only" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.entities.search')}</label>
        <input id="or-ent-search" className="form-input" placeholder={t('owner.outreach.entities.search')} value={search} onChange={e => setSearch(e.target.value)} />
        <label htmlFor="or-ent-type" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.col.type')}</label>
        <select id="or-ent-type" className="form-input" value={type} onChange={e => setType(e.target.value)}>
          <option value="">{t('owner.outreach.all_types')}</option>
          {ENTITY_TYPES.map(x => <option key={x} value={x}>{t(`owner.outreach.type.${x}`)}</option>)}
        </select>
        <label htmlFor="or-ent-gov" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.col.government')}</label>
        <select id="or-ent-gov" className="form-input" value={gov} onChange={e => setGov(e.target.value)}>
          <option value="">{t('owner.outreach.all_gov')}</option>
          {GOV_STATUSES.map(x => <option key={x} value={x}>{t(`owner.outreach.gov.${x}`)}</option>)}
        </select>
        <label htmlFor="or-ent-tenant" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.col.tenant')}</label>
        <select id="or-ent-tenant" className="form-input" value={tenant} onChange={e => setTenant(e.target.value)}>
          <option value="">{t('owner.outreach.all_tenant')}</option>
          <option value="LINKED">{t('owner.outreach.tenant.LINKED')}</option>
          <option value="NONE">{t('owner.outreach.tenant.NONE')}</option>
          {TENANT_MATCHES.map(x => <option key={x} value={x}>{t(`owner.outreach.match.${x}`)}</option>)}
        </select>
        <label htmlFor="or-ent-outreach" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.col.outreach')}</label>
        <select id="or-ent-outreach" className="form-input" value={outreach} onChange={e => setOutreach(e.target.value)}>
          <option value="">{t('owner.outreach.all_outreach')}</option>
          {ENTITY_OUTREACH.map(x => <option key={x} value={x}>{t(`owner.outreach.entity_outreach.${x}`)}</option>)}
        </select>
      </div>
      {selected.size > 0 && (
        <div className="oc-selection" role="region" aria-label={t('owner.outreach.selection')}>
          <span>{t('owner.outreach.selected').replace('{n}', String(selected.size))}</span>
          <button type="button" className="btn btn-sm btn-primary" onClick={research}>{t('owner.outreach.entities.research')}</button>
          <HelpTip text={t('owner.outreach.entities.research_help')} />
        </div>
      )}
      {!data && !error && <Loading />}
      {data && !data.entities.length && <div className="oc-empty">{t('owner.outreach.entities.empty')}</div>}
      {groups.map(g => (
        <section key={g.type} className="oc-card" style={{ marginTop: 12 }}>
          <h2 className="oc-h2">{t(`owner.outreach.type.${g.type}`)} <span className="oc-muted">· {g.entities.length}</span></h2>
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th style={{ width: 32 }}><span className="sr-only" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.select')}</span></th><th>{t('owner.outreach.col.entity')}</th><th>{t('owner.outreach.col.government')}</th><th>{t('owner.outreach.col.prospects')}</th><th>{t('owner.outreach.col.tenant')}</th><th>{t('owner.outreach.col.outreach')}</th></tr></thead>
              <tbody>
                {g.entities.map((e: any) => (
                  <tr key={e.id} className="oc-click" onClick={() => nav(`/owner/outreach/entities/${e.id}`)}>
                    <td onClick={ev => ev.stopPropagation()}><input type="checkbox" aria-label={`${t('owner.outreach.select')} ${entityName(e, isAR)}`} checked={selected.has(e.id)} disabled={e.suppressed || e.governmentStatus === 'NOT_GOVERNMENT'} onChange={() => toggle(e.id)} /></td>
                    <td><strong>{entityName(e, isAR)}</strong>{e.suppressed && <> <Pill text={t('owner.outreach.suppressed')} color="var(--danger)" /></>}<div className="oc-muted">{e.domain || '—'}{e.sector ? ` · ${e.sector}` : ''}</div></td>
                    <td><Pill text={t(`owner.outreach.gov.${e.governmentStatus}`)} color={GOV_COLOR[e.governmentStatus]} /></td>
                    <td>{e.prospects}{e.prospects > 0 && <div className="oc-muted">{Object.entries(e.byRole).map(([r, n]: any) => `${t(`owner.outreach.role_short.${r}`)} ${n}`).join(' · ')}</div>}</td>
                    <td>{e.tenant ? <span>{e.tenant.name}</span> : <Pill text={t(`owner.outreach.match.${e.tenantMatch}`)} color={MATCH_COLOR[e.tenantMatch]} />}</td>
                    <td>{t(`owner.outreach.entity_outreach.${e.outreachStatus}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {adding && <AddEntityModal onClose={() => setAdding(false)} onSaved={id => { setAdding(false); nav(`/owner/outreach/entities/${id}`) }} />}
      {discovering && <DiscoverEntitiesModal onClose={() => setDiscovering(false)} onStarted={() => { setDiscovering(false); loadJobs() }} />}
    </div>
  )
}

function AddEntityModal({ onClose, onSaved }: { onClose: () => void; onSaved: (id: string) => void }) {
  const { t } = useLang()
  const [form, setForm] = useState({ nameEn: '', nameAr: '', website: '', entityType: '', sector: '', city: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const dto: any = {}
    for (const [k, v] of Object.entries(form)) if (v) dto[k] = v
    try { const r = await outreachApi.addEntity(dto); onSaved(r.entity.id) } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  const field = (k: string, label: string, required = false) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`or-add-${k}`}>{label}</label>
      <input id={`or-add-${k}`} className="form-input" value={(form as any)[k]} required={required} onChange={e => set(k, e.target.value)} />
    </div>
  )
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.entities.add')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 560, width: '100%' }}>
        <div className="modal-title">{t('owner.outreach.entities.add')}<HelpTip text={t('owner.outreach.entities.add_help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {field('nameEn', t('owner.outreach.field.name_en'), true)}
        {field('nameAr', t('owner.outreach.field.name_ar'))}
        {field('website', t('owner.outreach.field.website'))}
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="or-add-entityType">{t('owner.outreach.col.type')}</label>
            <select id="or-add-entityType" className="form-input" value={form.entityType} onChange={e => set('entityType', e.target.value)}>
              <option value="">{t('owner.outreach.type.auto')}</option>
              {ENTITY_TYPES.map(x => <option key={x} value={x}>{t(`owner.outreach.type.${x}`)}</option>)}
            </select>
          </div>
          {field('sector', t('owner.outreach.field.sector'))}
        </div>
        {field('city', t('owner.outreach.field.city'))}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !form.nameEn.trim()}>{t('owner.outreach.save')}</button>
        </div>
      </form>
    </div>
  )
}

function DiscoverEntitiesModal({ onClose, onStarted }: { onClose: () => void; onStarted: () => void }) {
  const { t } = useLang()
  const [form, setForm] = useState({ entityType: 'MINISTRY', sector: '', query: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [providers, setProviders] = useState<any[] | null>(null)
  useEffect(() => { outreachApi.providers().then((p: any) => setProviders(p.providers || [])).catch(() => setProviders([])) }, [])
  const orgProvider = providers?.find(p => p.kind === 'ORGANIZATION')
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await outreachApi.discover({ mode: 'ENTITIES', entityType: form.entityType || undefined, sector: form.sector || undefined, query: form.query || undefined }); onStarted() } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.entities.discover')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 560, width: '100%' }}>
        <div className="modal-title">{t('owner.outreach.entities.discover')}<HelpTip text={t('owner.outreach.entities.discover_help')} /></div>
        {orgProvider && !orgProvider.configured && <div className="oc-warn" role="note">{t('owner.outreach.web_search_off')}</div>}
        {error && <div className="oc-error" role="alert">{error}</div>}
        <div className="form-group">
          <label className="form-label" htmlFor="or-disc-type">{t('owner.outreach.col.type')}</label>
          <select id="or-disc-type" className="form-input" value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
            {ENTITY_TYPES.map(x => <option key={x} value={x}>{t(`owner.outreach.type.${x}`)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="or-disc-sector">{t('owner.outreach.field.sector')}</label>
          <input id="or-disc-sector" className="form-input" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="or-disc-query">{t('owner.outreach.field.query')}</label>
          <input id="or-disc-query" className="form-input" value={form.query} onChange={e => setForm(f => ({ ...f, query: e.target.value }))} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{t('owner.outreach.start')}</button>
        </div>
      </form>
    </div>
  )
}
