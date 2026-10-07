import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { ownerApi, fmtDate, levelText } from './ownerApi'
import { ErrorBox, Header, Loading } from './ownerUi'
import { TenantTable } from './OwnerDashboardPage'

export default function OwnerTenantsPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<any[] | null>(null)
  const [comparison, setComparison] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('createdAt')
  const [tab, setTab] = useState<'list' | 'compare'>('list')
  const creating = params.get('create') === '1'

  const load = useCallback(() => {
    setError('')
    ownerApi.tenants({ search: search || undefined, status: status || undefined, sort }).then(setRows).catch((e: any) => setError(e.message))
  }, [search, status, sort])
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h) }, [load])
  useEffect(() => {
    if (tab === 'compare' && !comparison) ownerApi.comparison().then(setComparison).catch((e: any) => setError(e.message))
  }, [tab, comparison])

  const setCreating = (v: boolean) => { const p = new URLSearchParams(params); if (v) p.set('create', '1'); else p.delete('create'); setParams(p) }

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.tenants.title')} subtitle={t('owner.tenants.subtitle')} help={t('owner.tenants.help')}
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>{t('owner.tenants.create')}</button>} />
      <div className="oc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'list'} className={`oc-tab${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>{t('owner.tenants.list')}</button>
        <button type="button" role="tab" aria-selected={tab === 'compare'} className={`oc-tab${tab === 'compare' ? ' active' : ''}`} onClick={() => setTab('compare')}>{t('owner.tenants.compare')}</button>
      </div>
      {error && <ErrorBox error={error} onRetry={load} />}
      {tab === 'list' && (
        <>
          <div className="oc-toolbar">
            <label htmlFor="owner-tenant-search" className="sr-only" style={{ position: 'absolute', left: -9999 }}>{t('owner.tenants.search')}</label>
            <input id="owner-tenant-search" className="form-input" placeholder={t('owner.tenants.search')} value={search} onChange={e => setSearch(e.target.value)} />
            <label htmlFor="owner-tenant-status" style={{ position: 'absolute', left: -9999 }}>{t('owner.col.status')}</label>
            <select id="owner-tenant-status" className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">{t('owner.tenants.status_all')}</option>
              {['ACTIVE', 'SUSPENDED', 'OFFBOARDED'].map(s => <option key={s} value={s}>{t(`owner.status.${s}`)}</option>)}
            </select>
            <label htmlFor="owner-tenant-sort" className="oc-muted">{t('owner.tenants.sort')}</label>
            <select id="owner-tenant-sort" className="form-input" value={sort} onChange={e => setSort(e.target.value)}>
              {['createdAt', 'name', 'health', 'maturity', 'objects'].map(s => <option key={s} value={s}>{t(`owner.tenants.sort.${s}`)}</option>)}
            </select>
          </div>
          {rows ? <TenantTable rows={rows} onOpen={id => nav(`/owner/tenants/${id}`)} /> : !error && <Loading />}
        </>
      )}
      {tab === 'compare' && <ComparisonTable rows={comparison} onOpen={id => nav(`/owner/tenants/${id}`)} />}
      {creating && <CreateTenantModal onClose={() => setCreating(false)} onCreated={id => nav(`/owner/tenants/${id}${'?tab=enrichment'}`)} />}
    </div>
  )
}

const COMPARE_COLUMNS: Array<[string, string]> = [
  ['eaMaturity', 'owner.col.maturity'], ['repositoryHealth', 'owner.col.health'], ['objects', 'owner.col.objects'], ['relationships', 'owner.col.relationships'],
  ['applications', 'owner.col.applications'], ['capabilities', 'owner.col.capabilities'], ['processes', 'owner.col.processes'],
  ['beneficiaries', 'owner.col.beneficiaries'], ['journeys', 'owner.col.journeys'],
]

function ComparisonTable({ rows, onOpen }: { rows: any[] | null; onOpen: (id: string) => void }) {
  const { t, isAR } = useLang()
  const [sortKey, setSortKey] = useState('name')
  const [desc, setDesc] = useState(false)
  const sorted = useMemo(() => {
    if (!rows) return []
    const val = (r: any) => (sortKey === 'name' ? r.name.toLowerCase() : sortKey === 'adoption' ? (r.adoption?.inUse ?? -1) : (r[sortKey] ?? -1))
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); const c = x < y ? -1 : x > y ? 1 : 0; return desc ? -c : c })
  }, [rows, sortKey, desc])
  if (!rows) return <Loading />
  const head = (key: string, label: string) => (
    <th key={key} aria-sort={sortKey === key ? (desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" style={{ background: 'none', border: 'none', color: 'inherit', font: 'inherit', textTransform: 'inherit', padding: 0 }} onClick={() => { if (sortKey === key) setDesc(d => !d); else { setSortKey(key); setDesc(key !== 'name') } }}>{label}{sortKey === key ? (desc ? ' ↓' : ' ↑') : ''}</button>
    </th>
  )
  return (
    <>
      <div className="oc-muted" style={{ marginBottom: 8 }}>{t('owner.tenants.compare_note')}</div>
      <div className="oc-table-wrap">
        <table className="oc-table">
          <thead><tr>{head('name', t('owner.col.tenant'))}{COMPARE_COLUMNS.map(([k, l]) => head(k, t(l)))}{head('adoption', t('owner.col.adoption'))}{head('lastActivity', t('owner.col.last_activity'))}</tr></thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.id} className="oc-click" onClick={() => onOpen(r.id)}>
                <td><strong>{r.name}</strong><div className="oc-muted">{r.sector || ''}</div></td>
                {COMPARE_COLUMNS.map(([k]) => <td key={k}>{k === 'eaMaturity' ? (r.eaMaturity === null ? '—' : levelText(r.eaMaturity, t)) : (r[k] ?? '—')}</td>)}
                <td>{r.adoption ? `${r.adoption.inUse}/${r.adoption.tracked}` : '—'}</td>
                <td>{fmtDate(r.lastActivity, isAR)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/**
 * Owner tenant creation. Government Outreach reuses it with the entity's data
 * prefilled (`initial`), its own submit (the entity endpoint, which refuses
 * duplicates) and extra fields such as the "not a duplicate" confirmation.
 */
export function CreateTenantModal({ onClose, onCreated, initial, onSubmit, extra, hideAdmin }: {
  onClose: () => void; onCreated: (id: string) => void
  initial?: Record<string, any>; onSubmit?: (dto: any) => Promise<any>; extra?: React.ReactNode; hideAdmin?: boolean
}) {
  const { t } = useLang()
  const [form, setForm] = useState<any>({ organizationName: '', organizationNameAr: '', officialWebsite: '', country: 'Saudi Arabia', sector: '', organizationType: 'GOVERNMENT', frameworkType: 'NORA', locale: 'AR', slug: '', adminEmail: '', adminFullName: '', startDiscovery: true, ...(initial || {}) })
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }))
  const field = (k: string, label: string, opts: { type?: string; required?: boolean; help?: string } = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`owner-create-${k}`}>{label}{opts.help && <HelpTip text={opts.help} />}</label>
      <input id={`owner-create-${k}`} className="form-input" type={opts.type || 'text'} value={form[k]} required={opts.required} onChange={e => set(k, e.target.value)} />
    </div>
  )
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    const dto: any = {}
    for (const [k, v] of Object.entries(form)) if (v !== '' && v !== null) dto[k] = v
    if (!form.officialWebsite) dto.startDiscovery = false
    try { setResult(await (onSubmit ? onSubmit(dto) : ownerApi.createTenant(dto))) } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.create.title')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 620, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.create.title')}<HelpTip text={t('owner.create.help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {result ? (
          <>
            <div className="oc-ok">{t('owner.create.done')}: {result.tenant.name} ({result.tenant.slug})</div>
            <ul style={{ listStyle: 'none', fontSize: 13 }}>
              {Object.entries(result.provisioning || {}).map(([k, v]: any) => (
                <li key={k} style={{ padding: '3px 0' }}>
                  <strong>{t(`owner.create.step.${k}`)}</strong>: <span style={{ color: v.status === 'FAILED' ? 'var(--danger)' : v.status === 'DONE' ? 'var(--success)' : 'var(--text-dim)' }}>{t(`owner.create.step.${v.status}`)}</span>{v.detail ? <span className="oc-muted"> — {v.detail}</span> : null}
                </li>
              ))}
            </ul>
            {result.enrichmentJob?.error && <div className="oc-error">{result.enrichmentJob.error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.close')}</button>
              <button type="button" className="btn btn-primary" onClick={() => onCreated(result.tenant.id)}>{t('owner.create.open')}</button>
            </div>
          </>
        ) : (
          <>
            {field('organizationName', t('owner.create.name'), { required: true })}
            {field('officialWebsite', t('owner.create.website'))}
            <div className="grid-2" style={{ gap: 12 }}>
              {field('country', t('owner.create.country'))}
              {field('sector', t('owner.create.sector'))}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="owner-create-orgType">{t('owner.create.org_type')}</label>
              <select id="owner-create-orgType" className="form-input" value={form.organizationType} onChange={e => set('organizationType', e.target.value)}>
                {['GOVERNMENT', 'SEMI_GOVERNMENT', 'PRIVATE'].map(o => <option key={o} value={o}>{t(`owner.create.org_type.${o}`)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                <input id="owner-create-discover" type="checkbox" checked={form.startDiscovery} onChange={e => set('startDiscovery', e.target.checked)} />
                <span>{t('owner.create.discover')}<span className="oc-muted" style={{ display: 'block' }}>{t('owner.create.discover_help')}</span></span>
              </label>
            </div>
            <button type="button" className="btn btn-sm btn-secondary" aria-expanded={more} onClick={() => setMore(m => !m)}>{t('owner.create.optional')} {more ? '▴' : '▾'}</button>
            {more && (
              <div style={{ marginTop: 12 }}>
                {field('organizationNameAr', t('owner.create.name_ar'))}
                <div className="grid-2" style={{ gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="owner-create-framework">{t('owner.create.framework')}</label>
                    <select id="owner-create-framework" className="form-input" value={form.frameworkType} onChange={e => set('frameworkType', e.target.value)}>
                      <option value="NORA">NORA 2.0</option><option value="TOGAF">TOGAF</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="owner-create-locale">{t('owner.create.locale')}</label>
                    <select id="owner-create-locale" className="form-input" value={form.locale} onChange={e => set('locale', e.target.value)}>
                      <option value="AR">العربية</option><option value="EN">English</option>
                    </select>
                  </div>
                </div>
                {field('slug', t('owner.create.slug'), { help: t('owner.create.slug_help') })}
                {!hideAdmin && (
                  <div className="grid-2" style={{ gap: 12 }}>
                    {field('adminEmail', t('owner.create.admin_email'), { type: 'email' })}
                    {field('adminFullName', t('owner.create.admin_name'))}
                  </div>
                )}
              </div>
            )}
            {extra}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !form.organizationName.trim()}>{t('owner.create.submit')}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
