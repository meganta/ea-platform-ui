import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { Pill } from '../ownerUi'
import { outreachApi, ROLE_CATEGORIES, SENIORITIES, MANUAL_STAGES, EMPLOYMENT_COLOR, EMAIL_COLOR, entityName } from './outreachApi'
import { Blockers, StatusPill } from './OutreachShell'

/**
 * One prospect: who, why relevant (factors), the public sources behind every
 * fact, current-employment verification, contact legitimacy, outreach gates,
 * do-not-contact, correction and erasure.
 */
export default function ProspectDrawer({ prospectId, onClose, onChanged }: { prospectId: string; onClose: () => void; onChanged?: () => void }) {
  const { t, isAR } = useLang()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'' | 'verify' | 'dnc' | 'clear' | 'erase' | 'edit'>('')
  const [note, setNote] = useState('')
  const [suppress, setSuppress] = useState(true)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { setError(''); outreachApi.prospect(prospectId).then(setD).catch((e: any) => setError(e.message)) }, [prospectId])
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
                <ul>{d.messages.map((m: any) => <li key={m.id}>{m.subject} · {t(`owner.outreach.message_status.${m.status}`)} {m.sentAt ? `· ${fmtDate(m.sentAt, isAR)}` : ''}</li>)}</ul>
              </>
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
            {mode === 'edit' && <ProspectFormModal entityId={p.entityId} prospect={p} onClose={() => setMode('')} onSaved={() => { setMode(''); onChanged?.(); load() }} />}
          </>
        )}
      </aside>
    </div>
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
