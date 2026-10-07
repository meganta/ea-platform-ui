import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { ErrorBox, Header, Loading, Pill, StepUpModal, Tile } from '../ownerUi'
import { outreachApi, MESSAGE_COLOR, LINKEDIN_COLOR, TEMPLATE_ROLES, LEGACY_ROLES, EDITABLE_STATUSES, REVIEW_STATUSES, SENT_STATUSES, entityName } from './outreachApi'
import { Blockers, OutreachNav } from './OutreachShell'

export default function OutreachCampaignsPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const load = useCallback(() => { setError(''); outreachApi.campaigns().then(setRows).catch((e: any) => setError(e.message)) }, [])
  useEffect(load, [load])
  const create = async (ev: React.FormEvent) => {
    ev.preventDefault()
    try { const c = await outreachApi.createCampaign({ name, description: description || undefined }); nav(`/owner/outreach/campaigns/${c.id}`) } catch (e: any) { setError(e.message) }
  }
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.campaigns.title')} subtitle={t('owner.outreach.campaigns.subtitle')} help={t('owner.outreach.campaigns.help')}
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>{t('owner.outreach.campaigns.new')}</button>} />
      <OutreachNav />
      {error && <ErrorBox error={error} onRetry={load} />}
      {creating && (
        <form className="oc-card" onSubmit={create} style={{ marginBottom: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="or-cmp-name">{t('owner.outreach.campaigns.name')}</label>
            <input id="or-cmp-name" className="form-input" value={name} placeholder={t('owner.outreach.campaigns.name_example')} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="or-cmp-desc">{t('owner.outreach.campaigns.description')}</label>
            <textarea id="or-cmp-desc" className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>{t('owner.cancel')}</button>
            <button type="submit" className="btn btn-primary" disabled={name.trim().length < 2}>{t('owner.outreach.save')}</button>
          </div>
        </form>
      )}
      {!rows && !error && <Loading />}
      {rows && !rows.length && <div className="oc-empty">{t('owner.outreach.campaigns.empty')}</div>}
      {rows && rows.length > 0 && (
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead><tr><th>{t('owner.outreach.campaigns.name')}</th><th>{t('owner.col.status')}</th><th>{t('owner.outreach.col.entities')}</th><th>{t('owner.outreach.col.prospects')}</th><th>{t('owner.outreach.campaigns.interactions')}</th><th>{t('owner.outreach.created')}</th></tr></thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} className="oc-click" onClick={() => nav(`/owner/outreach/campaigns/${c.id}`)}>
                  <td><strong>{c.name}</strong></td>
                  <td>{t(`owner.outreach.campaign_status.${c.status}`)}</td>
                  <td>{c.entities}</td>
                  <td>{c.prospects}</td>
                  <td>{['READY_FOR_REVIEW', 'APPROVED', 'SENT'].map(s => `${t(`owner.outreach.message_status.${s}`)} ${(c.interactions || c.messages)?.[s] || 0}`).join(' · ')}</td>
                  <td>{fmtDate(c.createdAt, isAR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const METRICS: Array<[string, string]> = [
  ['entitiesSelected', 'owner.outreach.metric.entities'], ['prospectsSelected', 'owner.outreach.metric.prospects'], ['tenantsCreated', 'owner.outreach.metric.tenants'],
  ['tenantsEnriched', 'owner.outreach.metric.enriched'], ['invitationsPrepared', 'owner.outreach.metric.invitations'], ['emailsPrepared', 'owner.outreach.metric.prepared'],
  ['emailsApproved', 'owner.outreach.metric.approved'], ['emailsSent', 'owner.outreach.metric.sent'], ['deliveryFailed', 'owner.outreach.metric.failed'],
  ['connectionRequestsPrepared', 'owner.outreach.metric.li_requests_prepared'], ['connectionRequestsSent', 'owner.outreach.metric.li_requests_sent'], ['linkedinConnections', 'owner.outreach.metric.li_connections'],
  ['linkedinMessagesPrepared', 'owner.outreach.metric.li_messages_prepared'], ['linkedinMessagesSent', 'owner.outreach.metric.li_messages_sent'], ['linkedinReplies', 'owner.outreach.metric.li_replies'],
  ['activated', 'owner.outreach.metric.activated'], ['tenantFirstLogin', 'owner.outreach.metric.first_login'], ['engaged', 'owner.outreach.metric.engaged'],
]

/** Short label of one interaction: email subject, or the first words of a LinkedIn text. */
function summary(m: any) {
  if (m.channel !== 'LINKEDIN') return m.subject || '—'
  const body = String(m.body || '')
  return body.length > 80 ? `${body.slice(0, 80)}…` : body
}

export function OutreachCampaignPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const { id = '' } = useParams()
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [channel, setChannel] = useState('')
  const load = useCallback(() => { setError(''); outreachApi.campaign(id).then(setD).catch((e: any) => setError(e.message)) }, [id])
  useEffect(load, [load])

  const all: any[] = d?.interactions || d?.messages || []
  const list = channel ? all.filter(m => (m.channel || 'EMAIL') === channel) : all
  const toggle = (mid: string) => setSelected(s => { const n = new Set(s); if (n.has(mid)) n.delete(mid); else n.add(mid); return n })
  const chosen = all.filter(m => selected.has(m.id))
  const drafts = chosen.filter(m => REVIEW_STATUSES.includes(m.status))
  const approved = chosen.filter(m => m.status === 'APPROVED')
  const approve = async () => {
    try { setResult({ kind: 'approve', ...(await outreachApi.approve(drafts.map(m => m.id))) }); setSelected(new Set()); load() } catch (e: any) { setError(e.message) }
  }
  const setStatus = async (status: string) => { try { await outreachApi.updateCampaign(id, { status }); load() } catch (e: any) { setError(e.message) } }

  if (!d) return <div dir={isAR ? 'rtl' : 'ltr'}><OutreachNav />{error ? <ErrorBox error={error} onRetry={load} /> : <Loading />}</div>
  const c = d.campaign
  const remaining = result?.remainingToday
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={c.name} subtitle={`${t(`owner.outreach.campaign_status.${c.status}`)}${c.description ? ` · ${c.description}` : ''}`} help={t('owner.outreach.campaign.help')}
        actions={<>
          <button type="button" className="btn btn-secondary" onClick={() => nav('/owner/outreach/campaigns')}>{t('owner.outreach.back')}</button>
          {c.status !== 'ACTIVE' && c.status !== 'CLOSED' && <button type="button" className="btn btn-secondary" onClick={() => setStatus('ACTIVE')}>{t('owner.outreach.campaign.activate')}</button>}
          {c.status !== 'CLOSED' && <button type="button" className="btn btn-secondary" onClick={() => setStatus('CLOSED')}>{t('owner.outreach.campaign.close')}</button>}
        </>} />
      <OutreachNav />
      {error && <ErrorBox error={error} />}
      <div className="stat-grid-6">
        {METRICS.map(([k, label]) => <Tile key={k} label={t(label)} value={d.metrics[k] ?? 0} />)}
      </div>
      {result && (
        <div className="oc-card" role="status" style={{ marginTop: 12 }}>
          <strong>{result.kind === 'send' ? t('owner.outreach.send.done').replace('{n}', String(result.sent)) : t('owner.outreach.approve.done').replace('{n}', String(result.approved))}</strong>
          {result.kind === 'send' && result.manual > 0 && <div className="oc-muted">{t('owner.outreach.send.manual').replace('{n}', String(result.manual))}</div>}
          {remaining !== undefined && <span className="oc-muted"> · {t('owner.outreach.send.remaining').replace('{n}', String(typeof remaining === 'object' ? remaining.EMAIL ?? 0 : remaining))}</span>}
          <ul className="oc-list">{result.results.filter((r: any) => !['SENT', 'APPROVED'].includes(r.status)).map((r: any) => <li key={r.interactionId || r.messageId}>{t(`owner.outreach.result.${r.status}`)}{r.reason ? ` — ${r.reason === 'DAILY_LIMIT' ? t('owner.outreach.send.daily_limit') : r.reason}` : ''}{r.blockers && <Blockers blockers={r.blockers} />}{r.error && <span className="oc-muted"> ({r.error})</span>}</li>)}</ul>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setResult(null)}>{t('owner.close')}</button>
        </div>
      )}
      <section className="oc-card" style={{ marginTop: 16 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="oc-h2" style={{ margin: 0 }}>{t('owner.outreach.campaign.interactions')}<HelpTip text={t('owner.outreach.campaign.interactions_help')} /></h2>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <label htmlFor="or-cmp-channel" className="oc-muted">{t('owner.outreach.col.channel')}</label>
            <select id="or-cmp-channel" className="form-input" style={{ width: 'auto' }} value={channel} onChange={e => setChannel(e.target.value)}>
              <option value="">{t('owner.outreach.all')}</option>
              <option value="EMAIL">{t('owner.outreach.channel.EMAIL')}</option>
              <option value="LINKEDIN">{t('owner.outreach.channel.LINKEDIN')}</option>
            </select>
            <button type="button" className="btn btn-sm btn-secondary" disabled={!drafts.length} onClick={approve}>{t('owner.outreach.approve')} ({drafts.length})</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={!approved.length} onClick={() => setSending(true)}>{t('owner.outreach.send')} ({approved.length})</button>
          </div>
        </div>
        {!list.length && <div className="oc-empty">{t('owner.outreach.campaign.no_emails')}</div>}
        {list.length > 0 && (
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th style={{ width: 32 }}><span style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.select')}</span></th><th>{t('owner.outreach.col.recipient')}</th><th>{t('owner.outreach.col.channel')}</th><th>{t('owner.outreach.col.entity')}</th><th>{t('owner.outreach.col.content')}</th><th>{t('owner.col.status')}</th><th>{t('owner.outreach.col.generator')}</th><th /></tr></thead>
              <tbody>
                {list.map(m => {
                  const li = m.channel === 'LINKEDIN'
                  return (
                    <tr key={m.id}>
                      <td><input type="checkbox" aria-label={`${t('owner.outreach.select')} ${m.prospect?.fullName || m.recipient}`} checked={selected.has(m.id)} disabled={![...REVIEW_STATUSES, 'APPROVED'].includes(m.status)} onChange={() => toggle(m.id)} /></td>
                      <td><strong>{m.prospect?.fullName || '—'}</strong><div className="oc-muted">{li ? t('owner.outreach.linkedin_profile') : (m.recipient || '—')}</div></td>
                      <td>{t(`owner.outreach.channel.${m.channel || 'EMAIL'}`)}<div className="oc-muted">{t(`owner.outreach.itype.${m.interactionType || 'EMAIL'}`)}</div>{li && m.prospect?.linkedinStatus && <div><Pill text={t(`owner.outreach.li_status.${m.prospect.linkedinStatus}`)} color={LINKEDIN_COLOR[m.prospect.linkedinStatus]} /></div>}</td>
                      <td>{entityName(m.entity, isAR)}</td>
                      <td dir={m.language === 'AR' ? 'rtl' : undefined}>{summary(m)}{!li && m.includesInvitation === false && <div className="oc-muted">{t('owner.outreach.no_invitation')}</div>}</td>
                      <td><Pill text={t(`owner.outreach.message_status.${m.status}`)} color={MESSAGE_COLOR[m.status]} />{m.sendMode === 'MANUAL' && <div className="oc-muted">{t('owner.outreach.sent_manually')}</div>}{m.deliveryError && <div className="oc-muted">{m.deliveryError}</div>}{m.sentAt && <div className="oc-muted">{fmtDate(m.sentAt, isAR)}</div>}</td>
                      <td>{t(`owner.outreach.generator.${m.generation?.generator || 'TEMPLATE'}`)}</td>
                      <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(m.id)}>{EDITABLE_STATUSES.includes(m.status) || (li && SENT_STATUSES.includes(m.status)) ? t('owner.outreach.review_edit') : t('owner.outreach.view')}</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <InteractionEditor interactionId={editing} onClose={() => { setEditing(null); load() }} />}
      {sending && (
        <StepUpModal title={t('owner.outreach.send.title').replace('{n}', String(approved.length))} help={t('owner.outreach.send.help')} confirmLabel={t('owner.outreach.send')}
          onCancel={() => setSending(false)}
          onConfirm={async ({ password }) => { const r = await outreachApi.send(id, { messageIds: approved.map(m => m.id), password }); setSending(false); setSelected(new Set()); setResult({ kind: 'send', ...r }); load() }} />
      )}
    </div>
  )
}

/**
 * Preview and edit one interaction before it goes out. Email: subject, body,
 * recipient, attachment, invitation, language, role; the footer is fixed.
 * LinkedIn: the text with its character limit; ArchMind cannot send it, so the
 * owner copies it, opens the profile, sends it there and records the outcome.
 */
export function InteractionEditor({ interactionId, onClose }: { interactionId: string; onClose: () => void }) {
  const { t } = useLang()
  const [p, setP] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [role, setRole] = useState({ legacyRole: '', template: '' })
  const [password, setPassword] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const load = useCallback(() => {
    outreachApi.preview(interactionId).then((x: any) => {
      const m = x.interaction || x.message
      setP({ ...x, interaction: m })
      setForm({ subject: m.subject || '', body: m.body, recipient: m.recipient || '', attachMaterial: m.attachMaterial, materialId: m.materialId || '', language: m.language, includesInvitation: m.includesInvitation !== false })
    }).catch((e: any) => setError(e.message))
  }, [interactionId])
  useEffect(() => { load(); outreachApi.materials().then(setMaterials).catch(() => setMaterials([])) }, [load])
  const m = p?.interaction
  const li = m?.channel === 'LINKEDIN'
  const editable = m && EDITABLE_STATUSES.includes(m.status)
  const elevated = ['TENANT_ADMIN', 'SUPERADMIN'].includes(role.legacyRole) || role.template === 'tenant-administrator'
  const limit = p?.charLimit || 0
  const over = li && form && form.body.length > limit
  const run = async (fn: () => Promise<any>, msg: string) => { setError(''); setSaved(''); try { await fn(); setSaved(msg); load() } catch (e: any) { setError(e.message) } }
  const save = () => {
    const dto: any = {}
    const keys = li ? ['body', 'language'] : ['subject', 'body', 'recipient', 'attachMaterial', 'language', 'includesInvitation']
    for (const k of keys) {
      const was = k === 'includesInvitation' ? m.includesInvitation !== false : k === 'recipient' || k === 'subject' ? (m[k] || '') : m[k]
      if (form[k] !== was) dto[k] = form[k]
    }
    if (!li && (form.materialId || null) !== (m.materialId || null)) dto.materialId = form.materialId || null
    if (!li && (role.legacyRole || role.template)) { dto.role = { legacyRole: role.legacyRole || 'ARCHITECT', templateCodes: role.template ? [role.template] : [] }; if (elevated) dto.password = password }
    return run(() => outreachApi.updateInteraction(interactionId, dto), t('owner.outreach.editor.saved'))
  }
  const approve = async () => {
    setError(''); setSaved('')
    try {
      const r = await outreachApi.approve([interactionId])
      if (r.approved) { setSaved(t('owner.outreach.editor.approved')); load() } else setError(t('owner.outreach.editor.not_approved'))
      if (r.results?.[0]?.blockers) setP((x: any) => ({ ...x, blockers: r.results[0].blockers }))
    } catch (e: any) { setError(e.message) }
  }
  const cancel = async () => { try { await outreachApi.cancelInteraction(interactionId); onClose() } catch (e: any) { setError(e.message) } }
  const copy = async () => {
    try { await navigator.clipboard.writeText(form.body); setSaved(t('owner.outreach.li.copied')) } catch { setError(t('owner.outreach.li.copy_failed')) }
  }
  const outcome = (o: 'SENT' | 'REPLIED' | 'FAILED') => run(() => outreachApi.recordOutcome(interactionId, { outcome: o, note: note || undefined }), t(`owner.outreach.li.recorded.${o}`))
  const title = li ? t(m.interactionType === 'CONNECTION_REQUEST' ? 'owner.outreach.editor.title_connection' : 'owner.outreach.editor.title_li_message') : t('owner.outreach.editor.title')
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={p ? title : t('owner.outreach.editor.title')}>
      <div className="modal" style={{ maxWidth: 820, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-title">{p ? title : t('owner.outreach.editor.title')}<HelpTip text={t(li ? 'owner.outreach.editor.li_help' : 'owner.outreach.editor.help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {saved && <div className="oc-ok" role="status">{saved}</div>}
        {!p || !form ? <Loading /> : (
          <>
            <div className="oc-muted" style={{ marginBottom: 8 }}>{t(`owner.outreach.message_status.${m.status}`)} · {t(`owner.outreach.generator.${m.generation?.generator || 'TEMPLATE'}`)}{m.generation?.rejected?.length ? ` · ${t('owner.outreach.editor.ai_rejected')}` : ''}</div>
            {p.blockers && <Blockers blockers={p.blockers} />}
            {li ? (
              <>
                <div className="oc-warn" role="note">{t('owner.outreach.li.manual_note')}{p.capabilities?.detail && <div className="oc-muted">{p.capabilities.detail}</div>}</div>
                {p.notConnected && <div className="oc-warn" role="note">{t('owner.outreach.li.not_connected')}</div>}
                <div className="form-group">
                  <label className="form-label" htmlFor="or-me-body">{t(m.interactionType === 'CONNECTION_REQUEST' ? 'owner.outreach.li.note' : 'owner.outreach.li.message')}</label>
                  <textarea id="or-me-body" className="form-input" rows={m.interactionType === 'CONNECTION_REQUEST' ? 4 : 7} dir={form.language === 'AR' ? 'rtl' : 'ltr'} value={form.body} disabled={!editable} onChange={e => setForm({ ...form, body: e.target.value })} />
                  <div className={over ? 'oc-error' : 'oc-muted'} aria-live="polite">{t('owner.outreach.li.count').replace('{n}', String(form.body.length)).replace('{max}', String(limit))}</div>
                </div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={copy}>{t('owner.outreach.li.copy')}</button>
                  {p.profileUrl && <a className="btn btn-sm btn-secondary" href={p.profileUrl} target="_blank" rel="noopener noreferrer">{t('owner.outreach.li.open_profile')}</a>}
                </div>
                {(m.status === 'APPROVED' || SENT_STATUSES.includes(m.status)) && m.status !== 'REPLIED' && (
                  <div className="oc-card" style={{ marginTop: 12 }}>
                    <div className="oc-muted">{t(m.status === 'APPROVED' ? 'owner.outreach.li.record_help' : 'owner.outreach.li.reply_help')}</div>
                    <label className="form-label" htmlFor="or-me-note">{t('owner.outreach.li.outcome_note')}</label>
                    <input id="or-me-note" className="form-input" value={note} onChange={e => setNote(e.target.value)} />
                    <div className="flex gap-2" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                      {m.status === 'APPROVED' && <button type="button" className="btn btn-sm btn-primary" onClick={() => outcome('SENT')}>{t(m.interactionType === 'CONNECTION_REQUEST' ? 'owner.outreach.li.mark_request_sent' : 'owner.outreach.li.mark_message_sent')}</button>}
                      {m.status === 'APPROVED' && <button type="button" className="btn btn-sm btn-secondary" onClick={() => outcome('FAILED')}>{t('owner.outreach.li.mark_not_sent')}</button>}
                      {SENT_STATUSES.includes(m.status) && <button type="button" className="btn btn-sm btn-secondary" onClick={() => outcome('REPLIED')}>{t('owner.outreach.li.mark_replied')}</button>}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="form-group">
                  <label className="form-label" htmlFor="or-me-recipient">{t('owner.outreach.col.recipient')}</label>
                  <input id="or-me-recipient" className="form-input" type="email" value={form.recipient} disabled={!editable} onChange={e => setForm({ ...form, recipient: e.target.value })} />
                  <div className="oc-muted">{t('owner.outreach.editor.recipient_help')}</div>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="or-me-subject">{t('owner.outreach.col.subject')}</label>
                  <input id="or-me-subject" className="form-input" value={form.subject} disabled={!editable} onChange={e => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="or-me-body">{t('owner.outreach.editor.body')}</label>
                  <textarea id="or-me-body" className="form-input" rows={10} dir={form.language === 'AR' ? 'rtl' : 'ltr'} value={form.body} disabled={!editable} onChange={e => setForm({ ...form, body: e.target.value })} />
                </div>
                <div className="oc-card oc-footer-preview">
                  <div className="oc-muted">{t('owner.outreach.editor.footer')}</div>
                  <pre dir={form.language === 'AR' ? 'rtl' : 'ltr'}>{p.footer}</pre>
                </div>
                <label style={{ display: 'flex', gap: 8, fontSize: 13, marginTop: 8 }}><input id="or-me-invitation" type="checkbox" checked={form.includesInvitation} disabled={!editable} onChange={e => setForm({ ...form, includesInvitation: e.target.checked })} /><span>{t('owner.outreach.editor.include_invitation')}</span></label>
                <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
                  <div className="form-group">
                    <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={form.attachMaterial} disabled={!editable} onChange={e => setForm({ ...form, attachMaterial: e.target.checked })} /><span>{t('owner.outreach.editor.attach')}</span></label>
                    <label className="form-label" htmlFor="or-me-material">{t('owner.outreach.editor.material')}</label>
                    <select id="or-me-material" className="form-input" value={form.materialId} disabled={!editable || !form.attachMaterial} onChange={e => setForm({ ...form, materialId: e.target.value })}>
                      <option value="">{t('owner.outreach.editor.no_material')}</option>
                      {materials.map(x => <option key={x.id} value={x.id}>{x.name}{x.isDefault ? ` (${t('owner.outreach.default')})` : ''}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="or-me-language">{t('owner.outreach.language')}</label>
                    <select id="or-me-language" className="form-input" value={form.language} disabled={!editable} onChange={e => setForm({ ...form, language: e.target.value })}><option value="EN">English</option><option value="AR">العربية</option></select>
                  </div>
                </div>
                {editable && (
                  <details>
                    <summary>{t('owner.outreach.editor.role')}</summary>
                    <div className="grid-2" style={{ gap: 12, marginTop: 8 }}>
                      <div className="form-group"><label className="form-label" htmlFor="or-me-legacy">{t('owner.outreach.invite.access_level')}</label><select id="or-me-legacy" className="form-input" value={role.legacyRole} onChange={e => setRole({ ...role, legacyRole: e.target.value })}><option value="">{t('owner.outreach.invite.keep')}</option>{LEGACY_ROLES.map(x => <option key={x} value={x}>{t(`owner.outreach.legacy.${x}`)}</option>)}</select></div>
                      <div className="form-group"><label className="form-label" htmlFor="or-me-template">{t('owner.outreach.invite.role')}</label><select id="or-me-template" className="form-input" value={role.template} onChange={e => setRole({ ...role, template: e.target.value })}><option value="">{t('owner.outreach.invite.keep')}</option>{TEMPLATE_ROLES.map(x => <option key={x} value={x}>{t(`owner.outreach.template.${x}`)}</option>)}</select></div>
                    </div>
                    {elevated && <div className="form-group oc-warn"><div>{t('owner.outreach.invite.elevated')}</div><label className="form-label" htmlFor="or-me-pw">{t('owner.password')}</label><input id="or-me-pw" className="form-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></div>}
                  </details>
                )}
              </>
            )}
            <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.close')}</button>
              {editable && <button type="button" className="btn btn-secondary" onClick={cancel}>{t('owner.outreach.editor.cancel_email')}</button>}
              {editable && <button type="button" className="btn btn-secondary" onClick={() => run(() => outreachApi.regenerate(interactionId), t('owner.outreach.editor.regenerated'))}>{t('owner.outreach.editor.regenerate')}</button>}
              {editable && <button type="button" className="btn btn-secondary" disabled={!!over} onClick={save}>{t('owner.outreach.save')}</button>}
              {REVIEW_STATUSES.includes(m.status) && <button type="button" className="btn btn-primary" disabled={!!over} onClick={approve}>{t('owner.outreach.approve')}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
