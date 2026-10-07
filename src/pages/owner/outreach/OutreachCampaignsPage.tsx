import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { ErrorBox, Header, Loading, Pill, StepUpModal, Tile } from '../ownerUi'
import { outreachApi, MESSAGE_COLOR, TEMPLATE_ROLES, LEGACY_ROLES, entityName } from './outreachApi'
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
            <thead><tr><th>{t('owner.outreach.campaigns.name')}</th><th>{t('owner.col.status')}</th><th>{t('owner.outreach.col.entities')}</th><th>{t('owner.outreach.col.prospects')}</th><th>{t('owner.outreach.campaigns.emails')}</th><th>{t('owner.outreach.created')}</th></tr></thead>
            <tbody>
              {rows.map(c => (
                <tr key={c.id} className="oc-click" onClick={() => nav(`/owner/outreach/campaigns/${c.id}`)}>
                  <td><strong>{c.name}</strong></td>
                  <td>{t(`owner.outreach.campaign_status.${c.status}`)}</td>
                  <td>{c.entities}</td>
                  <td>{c.prospects}</td>
                  <td>{['DRAFT', 'APPROVED', 'SENT'].map(s => `${t(`owner.outreach.message_status.${s}`)} ${c.messages?.[s] || 0}`).join(' · ')}</td>
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
  ['activated', 'owner.outreach.metric.activated'], ['tenantFirstLogin', 'owner.outreach.metric.first_login'], ['engaged', 'owner.outreach.metric.engaged'],
]

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
  const load = useCallback(() => { setError(''); outreachApi.campaign(id).then(setD).catch((e: any) => setError(e.message)) }, [id])
  useEffect(load, [load])

  const toggle = (mid: string) => setSelected(s => { const n = new Set(s); if (n.has(mid)) n.delete(mid); else n.add(mid); return n })
  const chosen = (d?.messages || []).filter((m: any) => selected.has(m.id))
  const drafts = chosen.filter((m: any) => m.status === 'DRAFT')
  const approved = chosen.filter((m: any) => m.status === 'APPROVED')
  const approve = async () => {
    try { setResult({ kind: 'approve', ...(await outreachApi.approve(drafts.map((m: any) => m.id))) }); setSelected(new Set()); load() } catch (e: any) { setError(e.message) }
  }
  const setStatus = async (status: string) => { try { await outreachApi.updateCampaign(id, { status }); load() } catch (e: any) { setError(e.message) } }

  if (!d) return <div dir={isAR ? 'rtl' : 'ltr'}><OutreachNav />{error ? <ErrorBox error={error} onRetry={load} /> : <Loading />}</div>
  const c = d.campaign
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
          {result.remainingToday !== undefined && <span className="oc-muted"> · {t('owner.outreach.send.remaining').replace('{n}', String(result.remainingToday))}</span>}
          <ul className="oc-list">{result.results.filter((r: any) => !['SENT', 'APPROVED'].includes(r.status)).map((r: any) => <li key={r.messageId}>{t(`owner.outreach.result.${r.status}`)}{r.reason ? ` — ${r.reason === 'DAILY_LIMIT' ? t('owner.outreach.send.daily_limit') : r.reason}` : ''}{r.blockers && <Blockers blockers={r.blockers} />}{r.error && <span className="oc-muted"> ({r.error})</span>}</li>)}</ul>
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setResult(null)}>{t('owner.close')}</button>
        </div>
      )}
      <section className="oc-card" style={{ marginTop: 16 }}>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h2 className="oc-h2" style={{ margin: 0 }}>{t('owner.outreach.campaign.emails')}<HelpTip text={t('owner.outreach.campaign.emails_help')} /></h2>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-secondary" disabled={!drafts.length} onClick={approve}>{t('owner.outreach.approve')} ({drafts.length})</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={!approved.length} onClick={() => setSending(true)}>{t('owner.outreach.send')} ({approved.length})</button>
          </div>
        </div>
        {!d.messages.length && <div className="oc-empty">{t('owner.outreach.campaign.no_emails')}</div>}
        {d.messages.length > 0 && (
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th style={{ width: 32 }}><span style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.select')}</span></th><th>{t('owner.outreach.col.recipient')}</th><th>{t('owner.outreach.col.entity')}</th><th>{t('owner.outreach.col.subject')}</th><th>{t('owner.col.status')}</th><th>{t('owner.outreach.col.generator')}</th><th /></tr></thead>
              <tbody>
                {d.messages.map((m: any) => (
                  <tr key={m.id}>
                    <td><input type="checkbox" aria-label={`${t('owner.outreach.select')} ${m.prospect?.fullName || m.recipient}`} checked={selected.has(m.id)} disabled={!['DRAFT', 'APPROVED'].includes(m.status)} onChange={() => toggle(m.id)} /></td>
                    <td><strong>{m.prospect?.fullName || '—'}</strong><div className="oc-muted">{m.recipient || '—'}</div></td>
                    <td>{entityName(m.entity, isAR)}</td>
                    <td>{m.subject}</td>
                    <td><Pill text={t(`owner.outreach.message_status.${m.status}`)} color={MESSAGE_COLOR[m.status]} />{m.deliveryError && <div className="oc-muted">{m.deliveryError}</div>}{m.sentAt && <div className="oc-muted">{fmtDate(m.sentAt, isAR)}</div>}</td>
                    <td>{t(`owner.outreach.generator.${m.generation?.generator || 'TEMPLATE'}`)}</td>
                    <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditing(m.id)}>{['DRAFT', 'APPROVED', 'FAILED'].includes(m.status) ? t('owner.outreach.review_edit') : t('owner.outreach.view')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <MessageEditor messageId={editing} onClose={() => { setEditing(null); load() }} />}
      {sending && (
        <StepUpModal title={t('owner.outreach.send.title').replace('{n}', String(approved.length))} help={t('owner.outreach.send.help')} confirmLabel={t('owner.outreach.send')}
          onCancel={() => setSending(false)}
          onConfirm={async ({ password }) => { const r = await outreachApi.send(id, { messageIds: approved.map((m: any) => m.id), password }); setSending(false); setSelected(new Set()); setResult({ kind: 'send', ...r }); load() }} />
      )}
    </div>
  )
}

/** Preview and edit one email (subject, body, recipient, attachment, language, role); the footer is fixed. */
function MessageEditor({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const { t } = useLang()
  const [p, setP] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [role, setRole] = useState({ legacyRole: '', template: '' })
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const load = useCallback(() => {
    outreachApi.preview(messageId).then((x: any) => { setP(x); setForm({ subject: x.message.subject, body: x.message.body, recipient: x.message.recipient || '', attachMaterial: x.message.attachMaterial, materialId: x.message.materialId || '', language: x.message.language }) }).catch((e: any) => setError(e.message))
  }, [messageId])
  useEffect(() => { load(); outreachApi.materials().then(setMaterials).catch(() => setMaterials([])) }, [load])
  const editable = p && ['DRAFT', 'APPROVED', 'FAILED'].includes(p.message.status)
  const elevated = ['TENANT_ADMIN', 'SUPERADMIN'].includes(role.legacyRole) || role.template === 'tenant-administrator'
  const save = async () => {
    setError(''); setSaved('')
    const dto: any = {}
    for (const k of ['subject', 'body', 'recipient', 'attachMaterial', 'language']) if (form[k] !== (p.message[k] ?? (k === 'recipient' ? '' : undefined))) dto[k] = form[k]
    if ((form.materialId || null) !== (p.message.materialId || null)) dto.materialId = form.materialId || null
    if (role.legacyRole || role.template) { dto.role = { legacyRole: role.legacyRole || 'ARCHITECT', templateCodes: role.template ? [role.template] : [] }; if (elevated) dto.password = password }
    try { await outreachApi.updateMessage(messageId, dto); setSaved(t('owner.outreach.editor.saved')); load() } catch (e: any) { setError(e.message) }
  }
  const approve = async () => { try { const r = await outreachApi.approve([messageId]); if (r.approved) { setSaved(t('owner.outreach.editor.approved')); load() } else setError(t('owner.outreach.editor.not_approved')) ; if (r.results?.[0]?.blockers) setP((x: any) => ({ ...x, blockers: r.results[0].blockers })) } catch (e: any) { setError(e.message) } }
  const cancel = async () => { try { await outreachApi.cancelMessage(messageId); onClose() } catch (e: any) { setError(e.message) } }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.editor.title')}>
      <div className="modal" style={{ maxWidth: 820, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.outreach.editor.title')}<HelpTip text={t('owner.outreach.editor.help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {saved && <div className="oc-ok" role="status">{saved}</div>}
        {!p || !form ? <Loading /> : (
          <>
            <div className="oc-muted" style={{ marginBottom: 8 }}>{t(`owner.outreach.message_status.${p.message.status}`)} · {t(`owner.outreach.generator.${p.message.generation?.generator || 'TEMPLATE'}`)}{p.message.generation?.rejected?.length ? ` · ${t('owner.outreach.editor.ai_rejected')}` : ''}</div>
            {p.blockers && <Blockers blockers={p.blockers} />}
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
            <div className="grid-2" style={{ gap: 12, marginTop: 12 }}>
              <div className="form-group">
                <label style={{ display: 'flex', gap: 8, fontSize: 13 }}><input type="checkbox" checked={form.attachMaterial} disabled={!editable} onChange={e => setForm({ ...form, attachMaterial: e.target.checked })} /><span>{t('owner.outreach.editor.attach')}</span></label>
                <label className="form-label" htmlFor="or-me-material">{t('owner.outreach.editor.material')}</label>
                <select id="or-me-material" className="form-input" value={form.materialId} disabled={!editable || !form.attachMaterial} onChange={e => setForm({ ...form, materialId: e.target.value })}>
                  <option value="">{t('owner.outreach.editor.no_material')}</option>
                  {materials.map(m => <option key={m.id} value={m.id}>{m.name}{m.isDefault ? ` (${t('owner.outreach.default')})` : ''}</option>)}
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
            <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.close')}</button>
              {editable && <button type="button" className="btn btn-secondary" onClick={cancel}>{t('owner.outreach.editor.cancel_email')}</button>}
              {editable && <button type="button" className="btn btn-secondary" onClick={save}>{t('owner.outreach.save')}</button>}
              {p.message.status === 'DRAFT' && <button type="button" className="btn btn-primary" onClick={approve}>{t('owner.outreach.approve')}</button>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
