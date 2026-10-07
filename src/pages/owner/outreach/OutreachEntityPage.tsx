import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { ErrorBox, Header, Loading, Pill, Tile } from '../ownerUi'
import { CreateTenantModal } from '../OwnerTenantsPage'
import { outreachApi, ENTITY_TYPES, GOV_STATUSES, GOV_COLOR, MATCH_COLOR, EMPLOYMENT_COLOR, EMAIL_COLOR, entityName } from './outreachApi'
import { JobProgress, OutreachNav, StatusPill } from './OutreachShell'
import ProspectDrawer, { ProspectFormModal } from './ProspectDrawer'
import { InviteModal, PrepareOutreachModal } from './OutreachModals'

export { InviteModal, PrepareOutreachModal }

export default function OutreachEntityPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const { id = '' } = useParams()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<string | null>(null)
  const [modal, setModal] = useState<'' | 'tenant' | 'invite' | 'outreach' | 'add' | 'edit' | 'suppress'>('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDup, setConfirmDup] = useState(false)

  const load = useCallback(() => { setError(''); outreachApi.entity(id).then((x: any) => { setD(x); const running = x.jobs?.find((j: any) => !['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)); if (running) setJobId(running.id) }).catch((e: any) => setError(e.message)) }, [id])
  useEffect(load, [load])

  const run = async (fn: () => Promise<any>, ok?: string) => {
    setBusy(true); setError(''); setNotice('')
    try { const r = await fn(); if (ok) setNotice(ok); load(); return r } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const research = () => run(async () => { const r = await outreachApi.discover({ mode: 'PROFESSIONALS', entityIds: [id] }); if (r.jobs[0]) setJobId(r.jobs[0].id); else if (r.skipped[0]) throw new Error(t(`owner.outreach.skip.${r.skipped[0].reason}`)) })
  const toggle = (pid: string) => setSelected(s => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n })

  if (error && !d) return <div dir={isAR ? 'rtl' : 'ltr'}><OutreachNav /><ErrorBox error={error} onRetry={load} /></div>
  if (!d) return <div dir={isAR ? 'rtl' : 'ltr'}><OutreachNav /><Loading /></div>
  const e = d.entity
  const tenant = d.tenant
  const allProspects = d.groups.flatMap((g: any) => g.prospects)

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={entityName(e, isAR)} subtitle={`${t(`owner.outreach.type.${e.entityType}`)}${e.sector ? ` · ${e.sector}` : ''}${e.city ? ` · ${e.city}` : ''}`} help={t('owner.outreach.entity.help')}
        actions={<>
          <button type="button" className="btn btn-secondary" onClick={() => nav('/owner/outreach/entities')}>{t('owner.outreach.back')}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setModal('edit')}>{t('owner.outreach.edit')}</button>
          <button type="button" className="btn btn-secondary" onClick={() => setModal('suppress')}>{e.suppressed ? t('owner.outreach.entity.unsuppress') : t('owner.outreach.entity.suppress')}</button>
          <button type="button" className="btn btn-primary" disabled={busy || e.suppressed || e.governmentStatus === 'NOT_GOVERNMENT'} onClick={research}>{t('owner.outreach.entities.research')}</button>
        </>} />
      <OutreachNav />
      {error && <ErrorBox error={error} />}
      {notice && <div className="oc-ok" role="status">{notice}</div>}
      {e.suppressed && <div className="oc-error" role="note">{t('owner.outreach.entity.suppressed_note')}: {e.suppressionReason}</div>}
      {jobId && <JobProgress jobId={jobId} onDone={load} />}

      <div className="oc-grid-2">
        <section className="oc-card">
          <h2 className="oc-h2">{t('owner.outreach.entity.overview')}</h2>
          <div className="oc-fields">
            <div><span>{t('owner.outreach.field.website')}</span>{e.website ? <a href={e.website} target="_blank" rel="noopener noreferrer">{e.domain}</a> : '—'}</div>
            <div><span>{t('owner.outreach.field.name_ar')}</span>{e.nameAr || '—'}</div>
            <div><span>{t('owner.outreach.col.government')}</span><Pill text={t(`owner.outreach.gov.${e.governmentStatus}`)} color={GOV_COLOR[e.governmentStatus]} /><div className="oc-muted">{e.governmentBasis}</div></div>
            <div><span>{t('owner.outreach.country')}</span>{t('owner.outreach.country.SA')}</div>
            <div><span>{t('owner.outreach.source')}</span>{t(`owner.outreach.source.${e.source}`)} · {fmtDate(e.lastResearchedAt || e.createdAt, isAR)}</div>
          </div>
          {e.evidence?.length > 0 && (
            <details><summary>{t('owner.outreach.evidence')} ({e.evidence.length})</summary>
              <ul className="oc-evidence-list">{e.evidence.map((x: any, i: number) => <li key={i}><blockquote>“{x.excerpt}”</blockquote><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title || x.url}</a></li>)}</ul>
            </details>
          )}
        </section>

        <section className="oc-card">
          <h2 className="oc-h2">{t('owner.outreach.entity.tenant')}<HelpTip text={t('owner.outreach.entity.tenant_help')} /></h2>
          {tenant ? (
            <>
              <div className="oc-fields">
                <div><span>{t('owner.outreach.col.tenant')}</span><strong>{tenant.name}</strong> ({tenant.slug}) · {t(`owner.status.${tenant.status}`)}</div>
                <div><span>{t('owner.outreach.entity.meta_model')}</span>{tenant.metaModelPublished ? t('owner.outreach.yes') : t('owner.outreach.no')}</div>
                <div><span>{t('owner.outreach.entity.enrichment')}</span>{tenant.latestEnrichmentJob ? `${t(`owner.stage.${tenant.latestEnrichmentJob.status}`)} · ${fmtDate(tenant.latestEnrichmentJob.createdAt, isAR)}` : t('owner.outreach.entity.not_enriched')}</div>
              </div>
              <div className="stat-grid-3" style={{ marginTop: 8 }}>
                <Tile label={t('owner.outreach.entity.objects')} value={tenant.objects} />
                <Tile label={t('owner.outreach.entity.public_objects')} value={tenant.publicResearchObjects} />
                <Tile label={t('owner.outreach.entity.views')} value={tenant.preparedViews} />
              </div>
              {tenant.viewNames?.length > 0 && <div className="oc-muted">{tenant.viewNames.join(' · ')}</div>}
              <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => nav(`/owner/tenants/${tenant.id}`)}>{t('owner.outreach.entity.view_tenant')}</button>
                <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run(() => outreachApi.enrich(id), t('owner.outreach.entity.enrich_started'))}>{t('owner.outreach.entity.enrich')}</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={() => nav(`/owner/tenants/${tenant.id}/enrichment`)}>{t('owner.outreach.entity.review_enrichment')}</button>
                <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run(async () => { const r = await outreachApi.prepareViews(id); setNotice(t('owner.outreach.entity.views_prepared').replace('{n}', String(r.prepared.length)).replace('{skipped}', String(r.skipped.length))) })}>{t('owner.outreach.entity.prepare_views')}</button>
              </div>
            </>
          ) : (
            <>
              <Pill text={t(`owner.outreach.match.${e.tenantMatch}`)} color={MATCH_COLOR[e.tenantMatch]} />
              <div className="oc-muted" style={{ margin: '6px 0' }}>{t(`owner.outreach.match_help.${e.tenantMatch}`)}</div>
              {e.tenantCandidates?.length > 0 && (
                <ul className="oc-list">
                  {e.tenantCandidates.map((c: any) => (
                    <li key={c.tenantId}><strong>{c.name}</strong> ({c.slug}) <span className="oc-muted">— {c.reason}</span> <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run(() => outreachApi.linkTenant(id, c.tenantId), t('owner.outreach.entity.linked'))}>{t('owner.outreach.entity.link')}</button></li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-sm btn-primary" disabled={e.tenantMatch === 'EXISTING_TENANT'} onClick={() => setModal('tenant')}>{t('owner.outreach.entity.create_tenant')}</button>
                <button type="button" className="btn btn-sm btn-secondary" disabled={busy} onClick={() => run(() => outreachApi.rematch(id))}>{t('owner.outreach.entity.rematch')}</button>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="oc-card" style={{ marginTop: 16 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="oc-h2" style={{ margin: 0 }}>{t('owner.outreach.entity.prospects')} · {d.prospectCount}<HelpTip text={t('owner.outreach.entity.prospects_help')} /></h2>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-secondary" onClick={() => setModal('add')}>{t('owner.outreach.prospects.add')}</button>
            <button type="button" className="btn btn-sm btn-secondary" disabled={!selected.size || !tenant} title={!tenant ? t('owner.outreach.blocker.NO_TENANT') : ''} onClick={() => setModal('invite')}>{t('owner.outreach.invite')} ({selected.size})</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={!selected.size} onClick={() => setModal('outreach')}>{t('owner.outreach.prepare_outreach')} ({selected.size})</button>
          </div>
        </div>
        {!d.groups.length && <div className="oc-empty">{t('owner.outreach.entity.no_prospects')}</div>}
        {d.groups.map((g: any) => (
          <div key={g.roleCategory} style={{ marginTop: 12 }}>
            <h3 className="oc-h3">{t(`owner.outreach.role.${g.roleCategory}`)} · {g.prospects.length}</h3>
            <div className="oc-table-wrap">
              <table className="oc-table">
                <thead><tr><th style={{ width: 32 }}><span style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.select')}</span></th><th>{t('owner.outreach.col.name')}</th><th>{t('owner.outreach.col.seniority')}</th><th>{t('owner.outreach.col.employment')}</th><th>{t('owner.outreach.col.email')}</th><th>{t('owner.outreach.col.relevance')}</th><th>{t('owner.outreach.col.stage')}</th></tr></thead>
                <tbody>
                  {g.prospects.map((p: any) => (
                    <tr key={p.id} className="oc-click" onClick={() => setOpen(p.id)}>
                      <td onClick={ev => ev.stopPropagation()}><input type="checkbox" aria-label={`${t('owner.outreach.select')} ${p.fullName}`} checked={selected.has(p.id)} disabled={p.doNotContact} onChange={() => toggle(p.id)} /></td>
                      <td><strong>{(isAR && p.fullNameAr) || p.fullName}</strong><div className="oc-muted">{p.jobTitle}</div></td>
                      <td>{t(`owner.outreach.seniority.${p.seniority}`)}</td>
                      <td><StatusPill prefix="owner.outreach.employment" value={p.employmentStatus} colors={EMPLOYMENT_COLOR} />{p.ownerVerifiedAt && <span title={t('owner.outreach.owner_verified')}> ✓</span>}</td>
                      <td><StatusPill prefix="owner.outreach.email_status" value={p.emailStatus} colors={EMAIL_COLOR} /></td>
                      <td>{p.relevanceScore}</td>
                      <td>{p.doNotContact ? <Pill text={t('owner.outreach.stage.DO_NOT_CONTACT')} color="var(--danger)" /> : t(`owner.outreach.stage.${p.stage}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {open && <ProspectDrawer prospectId={open} onClose={() => setOpen(null)} onChanged={load} />}
      {modal === 'add' && <ProspectFormModal entityId={id} onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'edit' && <EditEntityModal entity={e} onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'suppress' && <SuppressEntityModal entity={e} onClose={() => setModal('')} onSaved={() => { setModal(''); load() }} />}
      {modal === 'tenant' && (
        <CreateTenantModal hideAdmin
          initial={{ organizationName: e.nameEn, organizationNameAr: e.nameAr || '', officialWebsite: e.website || '', sector: e.sector || '', country: 'Saudi Arabia', organizationType: 'GOVERNMENT' }}
          extra={e.tenantMatch === 'POSSIBLE_MATCH' ? <ConfirmNotDuplicate checked={confirmDup} onChange={setConfirmDup} /> : null}
          onSubmit={dto => outreachApi.createTenant(id, {
            organizationName: dto.organizationName, organizationNameAr: dto.organizationNameAr, officialWebsite: dto.officialWebsite, sector: dto.sector,
            slug: dto.slug, locale: dto.locale, frameworkType: dto.frameworkType, startDiscovery: dto.startDiscovery,
            confirmNotDuplicate: confirmDup || undefined,
          })}
          onClose={() => { setModal(''); load() }}
          onCreated={tid => nav(`/owner/tenants/${tid}/enrichment`)} />
      )}
      {modal === 'invite' && <InviteModal prospects={allProspects.filter((p: any) => selected.has(p.id))} onClose={() => { setModal(''); load() }} />}
      {modal === 'outreach' && <PrepareOutreachModal prospectIds={[...selected]} onClose={() => { setModal(''); load() }} onOpenCampaign={cid => nav(`/owner/outreach/campaigns/${cid}`)} />}
    </div>
  )
}

function ConfirmNotDuplicate({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const { t } = useLang()
  return (
    <div className="oc-warn" role="note">
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
        <input id="or-confirm-not-dup" type="checkbox" checked={checked} onChange={ev => onChange(ev.target.checked)} />
        <span>{t('owner.outreach.entity.confirm_not_duplicate')}</span>
      </label>
    </div>
  )
}

function EditEntityModal({ entity, onClose, onSaved }: { entity: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang()
  const [form, setForm] = useState<any>({ nameEn: entity.nameEn, nameAr: entity.nameAr || '', website: entity.website || '', entityType: entity.entityType, sector: entity.sector || '', city: entity.city || '', aliases: (entity.aliases || []).join(', '), governmentStatus: '', governmentBasis: '' })
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }))
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError('')
    const dto: any = { nameEn: form.nameEn, nameAr: form.nameAr, website: form.website, entityType: form.entityType, sector: form.sector, city: form.city, aliases: form.aliases.split(',').map((a: string) => a.trim()).filter(Boolean) }
    if (form.governmentStatus) { dto.governmentStatus = form.governmentStatus; dto.governmentBasis = form.governmentBasis }
    try { await outreachApi.updateEntity(entity.id, dto); onSaved() } catch (err: any) { setError(err.message) }
  }
  const field = (k: string, label: string) => (
    <div className="form-group"><label className="form-label" htmlFor={`or-ee-${k}`}>{label}</label><input id={`or-ee-${k}`} className="form-input" value={form[k]} onChange={e => set(k, e.target.value)} /></div>
  )
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.edit')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.outreach.edit')}</div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {field('nameEn', t('owner.outreach.field.name_en'))}
        {field('nameAr', t('owner.outreach.field.name_ar'))}
        {field('aliases', t('owner.outreach.field.aliases'))}
        {field('website', t('owner.outreach.field.website'))}
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="or-ee-entityType">{t('owner.outreach.col.type')}</label>
            <select id="or-ee-entityType" className="form-input" value={form.entityType} onChange={e => set('entityType', e.target.value)}>{ENTITY_TYPES.map(x => <option key={x} value={x}>{t(`owner.outreach.type.${x}`)}</option>)}</select>
          </div>
          {field('sector', t('owner.outreach.field.sector'))}
        </div>
        {field('city', t('owner.outreach.field.city'))}
        <div className="form-group">
          <label className="form-label" htmlFor="or-ee-gov">{t('owner.outreach.entity.confirm_government')}<HelpTip text={t('owner.outreach.entity.confirm_government_help')} /></label>
          <select id="or-ee-gov" className="form-input" value={form.governmentStatus} onChange={e => set('governmentStatus', e.target.value)}>
            <option value="">{t('owner.outreach.entity.keep_computed')}</option>
            {GOV_STATUSES.map(x => <option key={x} value={x}>{t(`owner.outreach.gov.${x}`)}</option>)}
          </select>
        </div>
        {form.governmentStatus && field('governmentBasis', t('owner.reason'))}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary">{t('owner.outreach.save')}</button>
        </div>
      </form>
    </div>
  )
}

function SuppressEntityModal({ entity, onClose, onSaved }: { entity: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    try { await outreachApi.suppressEntity(entity.id, { suppressed: !entity.suppressed, reason }); onSaved() } catch (err: any) { setError(err.message) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={entity.suppressed ? t('owner.outreach.entity.unsuppress') : t('owner.outreach.entity.suppress')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 480, width: '100%' }}>
        <div className="modal-title">{entity.suppressed ? t('owner.outreach.entity.unsuppress') : t('owner.outreach.entity.suppress')}</div>
        <p className="oc-muted">{t(entity.suppressed ? 'owner.outreach.entity.unsuppress_help' : 'owner.outreach.entity.suppress_help')}</p>
        {error && <div className="oc-error" role="alert">{error}</div>}
        <div className="form-group"><label className="form-label" htmlFor="or-sup-reason">{t('owner.reason')}</label><textarea id="or-sup-reason" className="form-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} required minLength={5} /></div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={reason.trim().length < 5}>{t('owner.confirm')}</button>
        </div>
      </form>
    </div>
  )
}
