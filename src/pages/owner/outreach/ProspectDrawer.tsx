import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { Pill } from '../ownerUi'
import { outreachApi, ROLE_CATEGORIES, SENIORITIES, MANUAL_STAGES, EMPLOYMENT_COLOR, EMAIL_COLOR, LINKEDIN_COLOR, MESSAGE_COLOR, OWNER_LINKEDIN_STATUSES, LINKEDIN_CONNECTED, TIMELINE_KINDS, Strategy, entityName } from './outreachApi'
import { Blockers, StatusPill } from './OutreachShell'
import { InviteModal, PrepareOutreachModal } from './OutreachModals'
import { InteractionEditor } from './OutreachCampaignsPage'

/**
 * One prospect: who, why relevant (factors), the public sources behind every
 * fact, current-employment verification, contact legitimacy, outreach gates,
 * do-not-contact, correction and erasure; the outreach panel (channels,
 * workspace readiness, advisory channel recommendation, actions) and the
 * unified timeline of everything done with this person.
 */
export default function ProspectDrawer({ prospectId, onClose, onChanged }: { prospectId: string; onClose: () => void; onChanged?: () => void }) {
  const { t, isAR } = useLang()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const nav = useNavigate()
  const [mode, setMode] = useState<'' | 'verify' | 'dnc' | 'clear' | 'erase' | 'edit' | 'invite'>('')
  const [prepare, setPrepare] = useState<{ strategy: Strategy; linkedinType: string } | null>(null)
  const [timeline, setTimeline] = useState<any[] | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [liStatus, setLiStatus] = useState('')
  const [note, setNote] = useState('')
  const [suppress, setSuppress] = useState(true)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    setError('')
    outreachApi.prospect(prospectId).then(setD).catch((e: any) => setError(e.message))
    // The timeline is secondary: if it cannot be read the drawer still works.
    Promise.resolve().then(() => outreachApi.timeline(prospectId)).then((x: any) => setTimeline(x?.items || [])).catch(() => setTimeline([]))
  }, [prospectId])
  useEffect(load, [load])

  const act = async (fn: () => Promise<any>, close = false) => {
    setBusy(true); setError('')
    try { await fn(); setMode(''); setNote(''); onChanged?.(); if (close) onClose(); else load() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const p = d?.prospect
  return (
    <div className="oc-drawer-overlay" role="dialog" aria-modal="true" aria-label={p?.fullName || t('owner.outreach.prospect')} onClick={onClose}>
      <aside className="oc-drawer" dir={isAR ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <h2 className="oc-h2" style={{ margin: 0 }}>{p ? (isAR && p.fullNameAr) || p.fullName : t('owner.loading')}</h2>
            {p && <div className="oc-muted">{p.jobTitle} · {entityName(d.entity, isAR)}</div>}
          </div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={onClose} aria-label={t('owner.close')}>✕</button>
        </div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {p && (
          <>
            {p.doNotContact && <div className="oc-error" role="note"><strong>{t('owner.outreach.dnc.title')}</strong> — {p.doNotContactReason} <span className="oc-muted">({fmtDate(p.doNotContactAt, isAR)})</span></div>}
            <div className="oc-fields">
              <div><span>{t('owner.outreach.col.role')}</span>{t(`owner.outreach.role.${p.roleCategory}`)} · {t(`owner.outreach.seniority.${p.seniority}`)}</div>
              <div><span>{t('owner.outreach.classification')}</span>{t(`owner.outreach.basis.${p.classification?.basis || 'NONE'}`)}<div className="oc-muted">{p.classification?.reason}</div></div>
              <div><span>{t('owner.outreach.col.employment')}</span><StatusPill prefix="owner.outreach.employment" value={p.employmentStatus} colors={EMPLOYMENT_COLOR} />{p.ownerVerifiedAt && <> <Pill text={t('owner.outreach.owner_verified')} color="var(--success)" /></>}<div className="oc-muted">{p.employmentBasis}</div><div className="oc-muted">{t('owner.outreach.last_verified')}: {fmtDate(p.lastVerifiedAt, isAR)} · {t('owner.outreach.confidence')}: {Math.round((p.verificationConfidence || 0) * 100)}%</div></div>
              <div><span>{t('owner.outreach.col.email')}</span>{p.email || '—'} <StatusPill prefix="owner.outreach.email_status" value={p.emailStatus} colors={EMAIL_COLOR} />{p.emailSourceUrl && <div className="oc-muted"><a href={p.emailSourceUrl} target="_blank" rel="noopener noreferrer">{t('owner.outreach.email_source')}</a></div>}</div>
              {(p.profileUrl || p.linkedinUrl) && <div><span>{t('owner.outreach.profile')}</span>{p.profileUrl && <a href={p.profileUrl} target="_blank" rel="noopener noreferrer">{t('owner.outreach.profile_link')}</a>} {p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer">LinkedIn</a>}</div>}
              <div><span>{t('owner.outreach.col.stage')}</span>{t(`owner.outreach.stage.${p.stage}`)}</div>
              <div><span>{t('owner.outreach.source')}</span>{t(`owner.outreach.source.${p.source}`)}{p.retainUntil && <div className="oc-muted">{t('owner.outreach.retain_until')}: {fmtDate(p.retainUntil, isAR)}</div>}</div>
            </div>

            <OutreachPanel d={d} busy={busy} liStatus={liStatus} setLiStatus={setLiStatus}
              onRecordLinkedIn={() => act(() => outreachApi.setLinkedInStatus(p.id, { status: liStatus }).then(() => setLiStatus('')))}
              onPrepare={(strategy, linkedinType) => setPrepare({ strategy, linkedinType })}
              onInvite={() => setMode('invite')}
              onViewTenant={id => nav(`/owner/tenants/${id}`)}
              onDoNotContact={() => setMode('dnc')} />

            <h3 className="oc-h3">{t('owner.outreach.relevance')} · {p.relevanceScore}/100 <HelpTip text={t('owner.outreach.relevance_help')} /></h3>
            <table className="oc-table oc-compact"><tbody>
              {(p.relevance || []).map((f: any) => <tr key={f.factor}><td>{t(`owner.outreach.factor.${f.factor}`)}</td><td>{f.points}/{f.max}</td><td className="oc-muted">{f.reason}</td></tr>)}
            </tbody></table>

            <h3 className="oc-h3">{t('owner.outreach.evidence')} ({(p.evidence || []).length})</h3>
            {(p.evidence || []).length === 0 && <div className="oc-muted">{t('owner.outreach.no_evidence')}</div>}
            <ul className="oc-evidence-list">
              {(p.evidence || []).map((e: any, i: number) => (
                <li key={i}>
                  <blockquote>“{e.excerpt}”</blockquote>
                  <a href={e.url} target="_blank" rel="noopener noreferrer">{e.title || e.url}</a>
                  <div className="oc-muted">{e.publisher} · {t('owner.outreach.tier')} {e.tier} · {t('owner.outreach.read_on')} {fmtDate(e.retrievedAt, isAR)}{e.pageAge ? ` · ${t('owner.outreach.dated')} ${e.pageAge}` : ''}</div>
                </li>
              ))}
            </ul>

            <h3 className="oc-h3">{t('owner.outreach.eligibility')}</h3>
            {d.eligibility?.email?.eligible ? <div className="oc-ok">{t('owner.outreach.eligible')}</div> : <Blockers blockers={d.eligibility?.email?.blockers || []} />}
            {d.suggestedRole && <div className="oc-muted">{t('owner.outreach.suggested_role')}: {d.suggestedRole.templateCodes.map((c: string) => t(`owner.outreach.template.${c}`)).join(', ')} — {d.suggestedRole.reason}</div>}

            {d.messages?.length > 0 && (
              <>
                <h3 className="oc-h3">{t('owner.outreach.messages')}</h3>
                <ul className="oc-list">{d.messages.map((m: any) => (
                  <li key={m.id}>
                    <strong>{t(`owner.outreach.channel.${m.channel || 'EMAIL'}`)}</strong> · {t(`owner.outreach.itype.${m.interactionType || 'EMAIL'}`)} · <Pill text={t(`owner.outreach.message_status.${m.status}`)} color={MESSAGE_COLOR[m.status]} />
                    {m.sentAt ? ` · ${fmtDate(m.sentAt, isAR)}` : ''}
                    <div className="oc-muted">{m.channel === 'LINKEDIN' ? String(m.body || '').slice(0, 90) : m.subject}</div>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(m.id)}>{t('owner.outreach.review_edit')}</button>
                  </li>
                ))}</ul>
              </>
            )}

            <h3 className="oc-h3">{t('owner.outreach.timeline')}<HelpTip text={t('owner.outreach.timeline_help')} /></h3>
            {!timeline ? <div className="oc-muted">{t('owner.loading')}</div> : !timeline.length ? <div className="oc-muted">{t('owner.outreach.timeline_empty')}</div> : (
              <ol className="oc-timeline">
                {timeline.map((i: any, n: number) => (
                  <li key={`${i.kind}-${n}`}>
                    <span className="oc-muted">{fmtDate(i.at, isAR)}</span> — {TIMELINE_KINDS.includes(i.kind) ? t(`owner.outreach.tl.${i.kind}`) : i.kind.replace(/_/g, ' ').toLowerCase()}
                    {i.channel && <> · {t(`owner.outreach.channel.${i.channel}`)}</>}
                    {i.interactionType && i.interactionType !== 'EMAIL' && <> · {t(`owner.outreach.itype.${i.interactionType}`)}</>}
                    {i.detail?.to && <> · {t(`owner.outreach.li_status.${i.detail.to}`)}</>}
                    {i.detail?.note && <div className="oc-muted">{i.detail.note}</div>}
                  </li>
                ))}
              </ol>
            )}

            <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 12 }}>
              {!p.doNotContact && p.employmentStatus !== 'FORMER' && <button type="button" className="btn btn-sm btn-primary" onClick={() => setMode('verify')}>{t('owner.outreach.verify')}</button>}
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMode('edit')}>{t('owner.outreach.edit')}</button>
              {!p.doNotContact && <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMode('dnc')}>{t('owner.outreach.dnc.set')}</button>}
              {p.doNotContact && <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMode('clear')}>{t('owner.outreach.dnc.clear')}</button>}
              <button type="button" className="btn btn-sm oc-btn-danger" onClick={() => setMode('erase')}>{t('owner.outreach.erase')}</button>
              {!p.doNotContact && (
                <>
                  <label htmlFor="or-pd-stage" className="oc-muted">{t('owner.outreach.col.stage')}</label>
                  <select id="or-pd-stage" className="form-input" style={{ width: 'auto' }} value="" onChange={e => e.target.value && act(() => outreachApi.setStage([p.id], e.target.value))}>
                    <option value="">{t('owner.outreach.set_stage')}</option>
                    {MANUAL_STAGES.map(s => <option key={s} value={s}>{t(`owner.outreach.stage.${s}`)}</option>)}
                  </select>
                </>
              )}
            </div>

            {(mode === 'verify' || mode === 'dnc' || mode === 'clear' || mode === 'erase') && (
              <div className="oc-card" style={{ marginTop: 12 }}>
                <label className="form-label" htmlFor="or-pd-note">{t(mode === 'verify' ? 'owner.outreach.verify_note' : mode === 'erase' ? 'owner.outreach.erase_reason' : 'owner.reason')}</label>
                <textarea id="or-pd-note" className="form-input" rows={2} value={note} onChange={e => setNote(e.target.value)} />
                {mode === 'erase' && (
                  <label style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={suppress} onChange={e => setSuppress(e.target.checked)} />
                    <span>{t('owner.outreach.erase_suppress')}</span>
                  </label>
                )}
                <div className="flex gap-2" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMode('')} disabled={busy}>{t('owner.cancel')}</button>
                  <button type="button" className={`btn btn-sm ${mode === 'erase' ? 'oc-btn-danger' : 'btn-primary'}`} disabled={busy || note.trim().length < 5}
                    onClick={() => act(() => mode === 'verify' ? outreachApi.verify(p.id, note) : mode === 'dnc' ? outreachApi.doNotContact(p.id, note) : mode === 'clear' ? outreachApi.clearDoNotContact(p.id, note) : outreachApi.erase(p.id, { suppress, reason: note }), mode === 'erase')}>
                    {t('owner.confirm')}
                  </button>
                </div>
              </div>
            )}
            {mode === 'invite' && <InviteModal prospects={[p]} onClose={() => { setMode(''); onChanged?.(); load() }} />}
            {prepare && <PrepareOutreachModal prospectIds={[p.id]} initialStrategy={prepare.strategy} initialLinkedinType={prepare.linkedinType} onClose={() => { setPrepare(null); onChanged?.(); load() }} onOpenCampaign={cid => nav(`/owner/outreach/campaigns/${cid}`)} />}
            {editing && <InteractionEditor interactionId={editing} onClose={() => { setEditing(null); load() }} />}
            {mode === 'edit' && <ProspectFormModal entityId={p.entityId} prospect={p} onClose={() => setMode('')} onSaved={() => { setMode(''); onChanged?.(); load() }} />}
          </>
        )}
      </aside>
    </div>
  )
}

/**
 * Outreach panel: who, LinkedIn and email status, the workspace's readiness,
 * the advisory channel recommendation and the actions. Nothing here sends.
 */
function OutreachPanel({ d, busy, liStatus, setLiStatus, onRecordLinkedIn, onPrepare, onInvite, onViewTenant, onDoNotContact }: {
  d: any; busy: boolean; liStatus: string; setLiStatus: (s: string) => void; onRecordLinkedIn: () => void
  onPrepare: (strategy: Strategy, linkedinType: string) => void; onInvite: () => void; onViewTenant: (id: string) => void; onDoNotContact: () => void
}) {
  const { t, isAR } = useLang()
  const p = d.prospect
  const panel = d.outreachPanel
  if (!panel) return null
  const li = panel.linkedin || {}
  const liOk = !!li.eligibility?.eligible
  const emailOk = !!panel.email?.eligibility?.eligible
  const connected = LINKEDIN_CONNECTED.includes(li.status)
  const tenant = panel.tenant
  const rec = panel.recommendation
  return (
    <section className="oc-card oc-outreach-panel" aria-label={t('owner.outreach.panel.title')} style={{ marginTop: 12 }}>
      <h3 className="oc-h3" style={{ marginTop: 0 }}>{t('owner.outreach.panel.title')}<HelpTip text={t('owner.outreach.panel.help')} /></h3>
      <div className="oc-fields">
        <div><span>{t('owner.outreach.col.name')}</span>{(isAR && p.fullNameAr) || p.fullName}</div>
        <div><span>{t('owner.outreach.col.role')}</span>{p.jobTitle}</div>
        <div><span>{t('owner.outreach.col.entity')}</span>{entityName(d.entity, isAR)}</div>
        <div><span>LinkedIn</span>{li.url ? <a href={li.url} target="_blank" rel="noopener noreferrer">{t('owner.outreach.li.open_profile')}</a> : <span className="oc-muted">{t('owner.outreach.panel.no_linkedin')}</span>} <Pill text={t(`owner.outreach.li_status.${li.status || 'UNKNOWN'}`)} color={LINKEDIN_COLOR[li.status || 'UNKNOWN']} />{li.urlSource && <div className="oc-muted">{t(`owner.outreach.li_source.${li.urlSource}`)}</div>}</div>
        <div><span>{t('owner.outreach.col.email')}</span><StatusPill prefix="owner.outreach.email_status" value={panel.email?.status} colors={EMAIL_COLOR} /></div>
        <div><span>{t('owner.outreach.panel.tenant')}</span>{tenant ? <><Pill text={t('owner.outreach.panel.ready')} color="var(--success)" /> {tenant.enriched ? <Pill text={t('owner.outreach.panel.enriched')} color="var(--success)" /> : <Pill text={t('owner.outreach.panel.not_enriched')} color="var(--warning)" />}</> : <Pill text={t('owner.outreach.panel.no_tenant')} color="#94A3B8" />}</div>
      </div>
      {rec && (
        <div className="oc-note" role="note" style={{ marginTop: 8 }}>
          <strong>{t('owner.outreach.panel.recommended')}: {t(`owner.outreach.recommend.${rec.recommended}`)}</strong>
          <div className="oc-muted">{t(`owner.outreach.recommend_reason.${rec.recommended}`)} {t('owner.outreach.panel.advisory')}</div>
        </div>
      )}
      {!liOk && li.eligibility?.blockers?.length > 0 && <><div className="oc-muted" style={{ marginTop: 8 }}>{t('owner.outreach.panel.linkedin_blocked')}</div><Blockers blockers={li.eligibility.blockers} /></>}
      <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" className="btn btn-sm btn-secondary" disabled={!liOk || connected} onClick={() => onPrepare('LINKEDIN', 'CONNECTION_REQUEST')}>{t('owner.outreach.panel.prepare_connection')}</button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={!liOk} onClick={() => onPrepare('LINKEDIN', 'DIRECT_MESSAGE')}>{t('owner.outreach.panel.prepare_li_message')}</button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={!emailOk} onClick={() => onPrepare('EMAIL', 'AUTO')}>{t('owner.outreach.panel.prepare_email')}</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={!liOk || !emailOk} onClick={() => onPrepare('BOTH', 'AUTO')}>{t('owner.outreach.panel.prepare_both')}</button>
        <button type="button" className="btn btn-sm btn-secondary" disabled={p.doNotContact || !tenant} onClick={onInvite}>{t('owner.outreach.panel.invite')}</button>
        {tenant && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onViewTenant(tenant.id)}>{t('owner.outreach.panel.view_tenant')}</button>}
        {!p.doNotContact && <button type="button" className="btn btn-sm oc-btn-danger" onClick={onDoNotContact}>{t('owner.outreach.dnc.set')}</button>}
      </div>
      {li.url && !p.doNotContact && (
        <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 10 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <div className="flex" style={{ alignItems: 'center' }}><label className="form-label" htmlFor="or-pd-li-status">{t('owner.outreach.panel.record_li')}</label><HelpTip text={t('owner.outreach.panel.record_li_help')} /></div>
            <select id="or-pd-li-status" className="form-input" value={liStatus} onChange={e => setLiStatus(e.target.value)}>
              <option value="">{t('owner.outreach.panel.choose')}</option>
              {OWNER_LINKEDIN_STATUSES.map(s => <option key={s} value={s}>{t(`owner.outreach.li_status.${s}`)}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-sm btn-secondary" disabled={!liStatus || busy} onClick={onRecordLinkedIn}>{t('owner.outreach.panel.record')}</button>
        </div>
      )}
    </section>
  )
}

/** Add (owner-entered) or correct a prospect. */
export function ProspectFormModal({ entityId, prospect, onClose, onSaved }: { entityId: string; prospect?: any; onClose: () => void; onSaved: () => void }) {
  const { t } = useLang()
  const [form, setForm] = useState<any>({
    fullName: prospect?.fullName || '', fullNameAr: prospect?.fullNameAr || '', jobTitle: prospect?.jobTitle || '', roleCategory: prospect?.roleCategory || '',
    seniority: prospect?.seniority || '', email: prospect?.email || '', profileUrl: prospect?.profileUrl || '', linkedinUrl: prospect?.linkedinUrl || '', sourceUrl: '', notes: prospect?.notes || '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }))
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    const dto: any = {}
    for (const [k, v] of Object.entries(form)) if (v !== '' || (prospect && prospect[k] && k !== 'sourceUrl')) dto[k] = v
    if (prospect) delete dto.sourceUrl
    try { if (prospect) await outreachApi.updateProspect(prospect.id, dto); else await outreachApi.addProspect({ ...dto, entityId }); onSaved() } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  const field = (k: string, label: string, opts: { type?: string; required?: boolean } = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`or-pf-${k}`}>{label}</label>
      <input id={`or-pf-${k}`} className="form-input" type={opts.type || 'text'} value={form[k]} required={opts.required} onChange={e => set(k, e.target.value)} />
    </div>
  )
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t(prospect ? 'owner.outreach.edit' : 'owner.outreach.prospects.add')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t(prospect ? 'owner.outreach.edit' : 'owner.outreach.prospects.add')}<HelpTip text={t('owner.outreach.prospects.add_help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        <div className="grid-2" style={{ gap: 12 }}>
          {field('fullName', t('owner.outreach.field.full_name'), { required: true })}
          {field('fullNameAr', t('owner.outreach.field.full_name_ar'))}
        </div>
        {field('jobTitle', t('owner.outreach.field.job_title'), { required: true })}
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="or-pf-roleCategory">{t('owner.outreach.col.role')}</label>
            <select id="or-pf-roleCategory" className="form-input" value={form.roleCategory} onChange={e => set('roleCategory', e.target.value)}>
              <option value="">{t('owner.outreach.from_title')}</option>
              {ROLE_CATEGORIES.map(x => <option key={x} value={x}>{t(`owner.outreach.role.${x}`)}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="or-pf-seniority">{t('owner.outreach.col.seniority')}</label>
            <select id="or-pf-seniority" className="form-input" value={form.seniority} onChange={e => set('seniority', e.target.value)}>
              <option value="">{t('owner.outreach.from_title')}</option>
              {SENIORITIES.map(x => <option key={x} value={x}>{t(`owner.outreach.seniority.${x}`)}</option>)}
            </select>
          </div>
        </div>
        {field('email', t('owner.outreach.field.email'), { type: 'email' })}
        <div className="oc-muted" style={{ marginTop: -8, marginBottom: 12 }}>{t('owner.outreach.email_rule')}</div>
        {field('profileUrl', t('owner.outreach.field.profile_url'))}
        {field('linkedinUrl', t('owner.outreach.field.linkedin_url'))}
        {!prospect && field('sourceUrl', t('owner.outreach.field.source_url'))}
        <div className="form-group">
          <label className="form-label" htmlFor="or-pf-notes">{t('owner.outreach.field.notes')}</label>
          <textarea id="or-pf-notes" className="form-input" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !form.fullName.trim() || !form.jobTitle.trim()}>{t('owner.outreach.save')}</button>
        </div>
      </form>
    </div>
  )
}
