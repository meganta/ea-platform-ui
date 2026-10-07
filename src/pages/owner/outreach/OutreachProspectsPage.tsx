import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { ErrorBox, Header, Loading, Pill } from '../ownerUi'
import { outreachApi, ROLE_CATEGORIES, SENIORITIES, ENTITY_TYPES, EMPLOYMENT, EMAIL_STATUSES, STAGES, MANUAL_STAGES, EMPLOYMENT_COLOR, EMAIL_COLOR, entityName } from './outreachApi'
import { Blockers, OutreachNav, StatusPill } from './OutreachShell'
import ProspectDrawer from './ProspectDrawer'
import { InviteModal, PrepareOutreachModal } from './OutreachEntityPage'

const FILTERS: Array<[string, string, string[], string]> = [
  ['roleCategory', 'owner.outreach.col.role', ROLE_CATEGORIES, 'owner.outreach.role'],
  ['seniority', 'owner.outreach.col.seniority', SENIORITIES, 'owner.outreach.seniority'],
  ['entityType', 'owner.outreach.col.type', ENTITY_TYPES, 'owner.outreach.type'],
  ['employment', 'owner.outreach.col.employment', EMPLOYMENT, 'owner.outreach.employment'],
  ['email', 'owner.outreach.col.email', EMAIL_STATUSES, 'owner.outreach.email_status'],
  ['stage', 'owner.outreach.col.stage', STAGES, 'owner.outreach.stage'],
  ['source', 'owner.outreach.source', ['AI_DISCOVERY', 'OWNER'], 'owner.outreach.source'],
  ['tenant', 'owner.outreach.col.tenant', ['LINKED', 'NONE'], 'owner.outreach.tenant'],
]

export default function OutreachProspectsPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [chips, setChips] = useState<{ roleCategory?: string; seniorities?: string[]; entityTypes?: string[] } | null>(null)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [sector, setSector] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [modal, setModal] = useState<'' | 'invite' | 'outreach'>('')

  const load = useCallback(() => {
    setError('')
    const f: Record<string, string | undefined> = { ...filters, search: search || undefined, sector: sector || undefined }
    if (chips?.roleCategory && !f.roleCategory) f.roleCategory = chips.roleCategory
    if (chips?.seniorities?.length && !f.seniority) f.seniorities = chips.seniorities.join(',')
    if (chips?.entityTypes?.length && !f.entityType) f.entityTypes = chips.entityTypes.join(',')
    outreachApi.prospects(f).then((r: any) => setRows(Array.isArray(r) ? r : [])).catch((e: any) => setError(e.message))
  }, [filters, search, sector, chips])
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h) }, [load])

  const interpret = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!query.trim()) { setChips(null); return }
    try { setChips(await outreachApi.interpret(query.trim())) } catch (e: any) { setError(e.message) }
  }
  const dropChip = (kind: 'roleCategory' | 'seniorities' | 'entityTypes', value?: string) => setChips(c => {
    if (!c) return c
    if (kind === 'roleCategory') return { ...c, roleCategory: undefined }
    return { ...c, [kind]: (c[kind] || []).filter(v => v !== value) }
  })
  /** Launches professional discovery for directory entities matching the interpreted entity types (max 10). */
  const discoverMatching = async () => {
    setNotice(''); setError('')
    try {
      const list = await outreachApi.entities({ type: chips?.entityTypes?.length === 1 ? chips.entityTypes[0] : undefined, government: undefined })
      const ids = (list.entities || []).filter((e: any) => !e.suppressed && e.governmentStatus !== 'NOT_GOVERNMENT' && (!chips?.entityTypes?.length || chips.entityTypes.includes(e.entityType))).slice(0, 10).map((e: any) => e.id)
      if (!ids.length) { setNotice(t('owner.outreach.prospects.no_entities')); return }
      const r = await outreachApi.discover({ mode: 'PROFESSIONALS', entityIds: ids, roleCategories: chips?.roleCategory ? [chips.roleCategory] : undefined, query: query || undefined })
      setNotice(t('owner.outreach.entities.research_started').replace('{n}', String(r.jobs.length)).replace('{skipped}', String(r.skipped.length)))
    } catch (e: any) { setError(e.message) }
  }
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const setStage = async (stage: string) => {
    if (!stage) return
    try { await outreachApi.setStage([...selected], stage); setSelected(new Set()); load() } catch (e: any) { setError(e.message) }
  }
  const selectedRows = (rows || []).filter(r => selected.has(r.id))

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.prospects.title')} subtitle={t('owner.outreach.prospects.subtitle')} help={t('owner.outreach.prospects.help')} />
      <OutreachNav />
      <form className="oc-card oc-search" onSubmit={interpret}>
        <label className="form-label" htmlFor="or-pr-query">{t('owner.outreach.prospects.ask')}<HelpTip text={t('owner.outreach.prospects.ask_help')} /></label>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <input id="or-pr-query" className="form-input" style={{ flex: '1 1 280px' }} value={query} placeholder={t('owner.outreach.prospects.ask_example')} onChange={e => setQuery(e.target.value)} />
          <button type="submit" className="btn btn-primary">{t('owner.outreach.prospects.apply')}</button>
        </div>
        {chips && (
          <div className="oc-chips" aria-label={t('owner.outreach.prospects.understood')}>
            <span className="oc-muted">{t('owner.outreach.prospects.understood')}:</span>
            <span className="oc-chip">{t('owner.outreach.country.SA')}</span>
            {chips.roleCategory && <button type="button" className="oc-chip" onClick={() => dropChip('roleCategory')}>{t(`owner.outreach.role.${chips.roleCategory}`)} ✕</button>}
            {(chips.seniorities || []).map(s => <button key={s} type="button" className="oc-chip" onClick={() => dropChip('seniorities', s)}>{t(`owner.outreach.seniority.${s}`)} ✕</button>)}
            {(chips.entityTypes || []).map(s => <button key={s} type="button" className="oc-chip" onClick={() => dropChip('entityTypes', s)}>{t(`owner.outreach.type.${s}`)} ✕</button>)}
            <button type="button" className="btn btn-sm btn-secondary" onClick={discoverMatching}>{t('owner.outreach.prospects.discover_matching')}</button>
          </div>
        )}
      </form>
      <div className="oc-toolbar">
        <label htmlFor="or-pr-search" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.prospects.search')}</label>
        <input id="or-pr-search" className="form-input" placeholder={t('owner.outreach.prospects.search')} value={search} onChange={e => setSearch(e.target.value)} />
        <label htmlFor="or-pr-sector" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.field.sector')}</label>
        <input id="or-pr-sector" className="form-input" placeholder={t('owner.outreach.field.sector')} value={sector} onChange={e => setSector(e.target.value)} />
        {FILTERS.map(([key, label, values, prefix]) => (
          <span key={key}>
            <label htmlFor={`or-pr-${key}`} style={{ position: 'absolute', left: -9999 }}>{t(label)}</label>
            <select id={`or-pr-${key}`} className="form-input" value={filters[key] || ''} onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}>
              <option value="">{t(label)}: {t('owner.outreach.any')}</option>
              {values.map(v => <option key={v} value={v}>{t(`${prefix}.${v}`)}</option>)}
            </select>
          </span>
        ))}
      </div>
      {error && <ErrorBox error={error} onRetry={load} />}
      {notice && <div className="oc-ok" role="status">{notice}</div>}
      {selected.size > 0 && (
        <div className="oc-selection" role="region" aria-label={t('owner.outreach.selection')}>
          <span>{t('owner.outreach.selected').replace('{n}', String(selected.size))}</span>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setModal('invite')}>{t('owner.outreach.invite')}</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => setModal('outreach')}>{t('owner.outreach.prepare_outreach')}</button>
          <label htmlFor="or-pr-bulk-stage" style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.set_stage')}</label>
          <select id="or-pr-bulk-stage" className="form-input" style={{ width: 'auto' }} value="" onChange={e => setStage(e.target.value)}>
            <option value="">{t('owner.outreach.set_stage')}</option>
            {MANUAL_STAGES.map(s => <option key={s} value={s}>{t(`owner.outreach.stage.${s}`)}</option>)}
          </select>
        </div>
      )}
      {!rows && !error && <Loading />}
      {rows && !rows.length && <div className="oc-empty">{t('owner.outreach.prospects.empty')}</div>}
      {rows && rows.length > 0 && (
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead><tr><th style={{ width: 32 }}><span style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.select')}</span></th><th>{t('owner.outreach.col.name')}</th><th>{t('owner.outreach.col.entity')}</th><th>{t('owner.outreach.col.role')}</th><th>{t('owner.outreach.col.employment')}</th><th>{t('owner.outreach.col.email')}</th><th>{t('owner.outreach.col.relevance')}</th><th>{t('owner.outreach.col.outreach')}</th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id} className="oc-click" onClick={() => setOpen(p.id)}>
                  <td onClick={ev => ev.stopPropagation()}><input type="checkbox" aria-label={`${t('owner.outreach.select')} ${p.fullName}`} checked={selected.has(p.id)} disabled={p.doNotContact} onChange={() => toggle(p.id)} /></td>
                  <td><strong>{(isAR && p.fullNameAr) || p.fullName}</strong><div className="oc-muted">{p.jobTitle}</div></td>
                  <td><button type="button" className="oc-link" onClick={ev => { ev.stopPropagation(); nav(`/owner/outreach/entities/${p.entityId}`) }}>{entityName(p.entity, isAR)}</button></td>
                  <td>{t(`owner.outreach.role_short.${p.roleCategory}`)} · {t(`owner.outreach.seniority.${p.seniority}`)}</td>
                  <td><StatusPill prefix="owner.outreach.employment" value={p.employmentStatus} colors={EMPLOYMENT_COLOR} /></td>
                  <td><StatusPill prefix="owner.outreach.email_status" value={p.emailStatus} colors={EMAIL_COLOR} /></td>
                  <td>{p.relevanceScore}</td>
                  <td>{p.doNotContact ? <Pill text={t('owner.outreach.stage.DO_NOT_CONTACT')} color="var(--danger)" /> : p.outreach?.eligible ? <Pill text={t('owner.outreach.eligible_short')} color="var(--success)" /> : <Blockers blockers={(p.outreach?.blockers || []).slice(0, 2)} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ProspectDrawer prospectId={open} onClose={() => setOpen(null)} onChanged={load} />}
      {modal === 'invite' && <InviteModal prospects={selectedRows} onClose={() => { setModal(''); load() }} />}
      {modal === 'outreach' && <PrepareOutreachModal prospectIds={[...selected]} onClose={() => { setModal(''); load() }} onOpenCampaign={cid => nav(`/owner/outreach/campaigns/${cid}`)} />}
    </div>
  )
}
