import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { ErrorBox, Header, Loading, Pill, StepUpModal } from '../ownerUi'
import { outreachApi, POST_KINDS, POST_MAX, POST_COLOR, entityName } from './outreachApi'
import { OutreachNav } from './OutreachShell'

/**
 * The ArchMind LinkedIn Company Page: connection status and the page posts.
 * ArchMind never asks for a LinkedIn password: an administrator of the page
 * signs in with LinkedIn and ArchMind keeps only the access it grants. Without
 * an approved LinkedIn app, posts are prepared here and published by hand.
 */
export function LinkedInPageCard({ onChanged }: { onChanged?: () => void }) {
  const { t, isAR } = useLang()
  const [s, setS] = useState<any>(null)
  const [error, setError] = useState('')
  const [url, setUrl] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { Promise.resolve().then(() => outreachApi.linkedinPage()).then((x: any) => { setS(x); setUrl(x?.manualPageUrl || '') }).catch((e: any) => setError(e.message)) }, [])
  useEffect(load, [load])
  const run = async (fn: () => Promise<any>) => { setBusy(true); setError(''); try { await fn(); load(); onChanged?.() } catch (e: any) { setError(e.message) } finally { setBusy(false) } }
  const connect = () => run(async () => { const r = await outreachApi.linkedinPageConnect(); window.location.assign(r.url) })
  if (!s) return <section className="oc-card">{error ? <ErrorBox error={error} onRetry={load} /> : <Loading />}</section>
  const configured = !!s.capabilities?.configured
  const statusColor = s.status === 'CONNECTED' ? 'var(--success)' : s.status === 'EXPIRED' || s.status === 'ERROR' ? 'var(--danger)' : 'var(--warning)'
  return (
    <section className="oc-card" aria-label={t('owner.outreach.page.title')}>
      <h2 className="oc-h2">{t('owner.outreach.page.title')}<HelpTip text={t('owner.outreach.page.help')} /></h2>
      {error && <div className="oc-error" role="alert">{error}</div>}
      <div className="oc-fields">
        <div><span>{t('owner.col.status')}</span><Pill text={t(`owner.outreach.page.status.${s.status}`)} color={statusColor} /></div>
        <div><span>{t('owner.outreach.page.mode')}</span>{t(`owner.outreach.page.mode.${s.publishMode}`)}</div>
        {s.organizationName && <div><span>{t('owner.outreach.page.organization')}</span>{s.organizationName}</div>}
        {s.pageUrl && <div><span>{t('owner.outreach.page.address')}</span><a href={s.pageUrl} target="_blank" rel="noopener noreferrer">{s.pageUrl}</a></div>}
        {s.tokenExpiresAt && <div><span>{t('owner.outreach.page.expires')}</span>{fmtDate(s.tokenExpiresAt, isAR)}</div>}
      </div>
      {s.lastError && <div className="oc-warn" role="note">{s.lastError}</div>}
      {!configured && <div className="oc-note" role="note">{t('owner.outreach.page.not_configured')}</div>}
      <div className="oc-muted" style={{ margin: '8px 0' }}>{t('owner.outreach.page.never_password')}</div>
      {s.status === 'SELECT_ORGANIZATION' && (
        <div className="oc-card" style={{ marginTop: 8 }}>
          <div>{t('owner.outreach.page.choose')}</div>
          <ul className="oc-list">{(s.candidates || []).map((c: any) => (
            <li key={c.urn}><strong>{c.name}</strong> <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => outreachApi.linkedinPageSelect(c.urn))}>{t('owner.outreach.page.use_this')}</button></li>
          ))}</ul>
        </div>
      )}
      <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        {configured && s.status !== 'CONNECTED' && <button type="button" className="btn btn-primary" disabled={busy} onClick={connect}>{t(s.status === 'EXPIRED' ? 'owner.outreach.page.reconnect' : 'owner.outreach.page.connect')}</button>}
        {s.status === 'CONNECTED' && <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setDisconnecting(true)}>{t('owner.outreach.page.disconnect')}</button>}
      </div>
      <form className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }} onSubmit={ev => { ev.preventDefault(); run(() => outreachApi.linkedinPageUrl(url.trim())) }}>
        <div className="form-group" style={{ margin: 0, flex: '1 1 260px' }}>
          <label className="form-label" htmlFor="or-page-url">{t('owner.outreach.page.manual_url')}</label>
          <input id="or-page-url" className="form-input" value={url} placeholder="https://www.linkedin.com/company/archmind/" onChange={e => setUrl(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-secondary" disabled={busy}>{t('owner.outreach.save')}</button>
      </form>
      {disconnecting && (
        <StepUpModal title={t('owner.outreach.page.disconnect')} help={t('owner.outreach.page.disconnect_help')} confirmLabel={t('owner.outreach.page.disconnect')}
          onCancel={() => setDisconnecting(false)}
          onConfirm={async ({ password }) => { await outreachApi.linkedinPageDisconnect(password); setDisconnecting(false); load(); onChanged?.() }} />
      )}
    </section>
  )
}

/** LinkedIn sends the administrator back here after sign-in (LINKEDIN_REDIRECT_URI). */
export function LinkedInCallbackPage() {
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    const code = params.get('code'); const state = params.get('state')
    if (params.get('error')) { setError(params.get('error_description') || params.get('error') || t('owner.outreach.page.callback_failed')); return }
    if (!code || !state) { setError(t('owner.outreach.page.callback_failed')); return }
    outreachApi.linkedinPageCallback({ code, state }).then(() => nav('/owner/outreach/page', { replace: true })).catch((e: any) => setError(e.message))
  }, [params, nav, t])
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.page.title')} />
      {error ? <><div className="oc-error" role="alert">{error}</div><button type="button" className="btn btn-secondary" onClick={() => nav('/owner/outreach/page')}>{t('owner.outreach.back')}</button></> : <div role="status"><Loading /> {t('owner.outreach.page.connecting')}</div>}
    </div>
  )
}

export default function OutreachPagePage() {
  const { t, isAR } = useLang()
  const [posts, setPosts] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const load = useCallback(() => { setError(''); outreachApi.pagePosts().then(setPosts).catch((e: any) => setError(e.message)) }, [])
  useEffect(load, [load])
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.page.posts_title')} subtitle={t('owner.outreach.page.posts_subtitle')} help={t('owner.outreach.page.posts_help')}
        actions={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>{t('owner.outreach.page.new_post')}</button>} />
      <OutreachNav />
      <LinkedInPageCard key={version} onChanged={load} />
      {error && <ErrorBox error={error} onRetry={load} />}
      <section className="oc-card" style={{ marginTop: 16 }}>
        <h2 className="oc-h2">{t('owner.outreach.page.posts')}</h2>
        {!posts && !error && <Loading />}
        {posts && !posts.length && <div className="oc-empty">{t('owner.outreach.page.no_posts')}</div>}
        {posts && posts.length > 0 && (
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th>{t('owner.outreach.page.kind')}</th><th>{t('owner.outreach.page.topic')}</th><th>{t('owner.col.status')}</th><th>{t('owner.outreach.created')}</th><th /></tr></thead>
              <tbody>{posts.map(p => (
                <tr key={p.id}>
                  <td>{t(`owner.outreach.page.kind.${p.kind}`)}</td>
                  <td dir={p.language === 'AR' ? 'rtl' : undefined}>{p.topic}</td>
                  <td><Pill text={t(`owner.outreach.page.post_status.${p.status}`)} color={POST_COLOR[p.status]} />{p.publishMode && <div className="oc-muted">{t(`owner.outreach.page.mode.${p.publishMode}`)}</div>}{p.postUrl && <div><a href={p.postUrl} target="_blank" rel="noopener noreferrer">{t('owner.outreach.page.view_post')}</a></div>}</td>
                  <td>{fmtDate(p.createdAt, isAR)}</td>
                  <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => setOpen(p.id)}>{t('owner.outreach.review_edit')}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
      {creating && <NewPostModal onClose={() => setCreating(false)} onCreated={id => { setCreating(false); load(); setOpen(id) }} />}
      {open && <PostEditor postId={open} onClose={() => { setOpen(null); load(); setVersion(v => v + 1) }} />}
    </div>
  )
}

function NewPostModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t, isAR } = useLang()
  const [form, setForm] = useState({ kind: 'THOUGHT_LEADERSHIP', language: isAR ? 'AR' : 'EN', topic: '', entityId: '', entityConsentNote: '' })
  const [entities, setEntities] = useState<any[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (form.kind === 'ENTITY_WELCOME' && !entities.length) outreachApi.entities({ tenant: 'LINKED' }).then((x: any) => setEntities(Array.isArray(x) ? x : x?.entities || [])).catch(() => setEntities([])) }, [form.kind, entities.length])
  const welcome = form.kind === 'ENTITY_WELCOME'
  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault(); setBusy(true); setError('')
    try {
      const p = await outreachApi.createPagePost({ kind: form.kind, topic: form.topic.trim(), language: form.language, ...(welcome ? { entityId: form.entityId, entityConsentNote: form.entityConsentNote.trim() } : {}) })
      onCreated(p.id)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.page.new_post')}>
      <form className="modal" onSubmit={submit} style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.outreach.page.new_post')}<HelpTip text={t('owner.outreach.page.new_post_help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        <div className="grid-2" style={{ gap: 12 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="or-pp-kind">{t('owner.outreach.page.kind')}</label>
            <select id="or-pp-kind" className="form-input" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{POST_KINDS.map(k => <option key={k} value={k}>{t(`owner.outreach.page.kind.${k}`)}</option>)}</select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="or-pp-lang">{t('owner.outreach.language')}</label>
            <select id="or-pp-lang" className="form-input" value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}><option value="EN">English</option><option value="AR">العربية</option></select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="or-pp-topic">{t('owner.outreach.page.topic')}</label>
          <textarea id="or-pp-topic" className="form-input" rows={3} value={form.topic} placeholder={t('owner.outreach.page.topic_example')} onChange={e => setForm({ ...form, topic: e.target.value })} required />
        </div>
        {welcome && (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="or-pp-entity">{t('owner.outreach.col.entity')}</label>
              <select id="or-pp-entity" className="form-input" value={form.entityId} onChange={e => setForm({ ...form, entityId: e.target.value })} required>
                <option value="">{t('owner.outreach.page.choose_entity')}</option>
                {entities.filter(e => e.tenantId && !e.suppressed).map(e => <option key={e.id} value={e.id}>{entityName(e, isAR)}</option>)}
              </select>
            </div>
            <div className="form-group oc-warn">
              <label className="form-label" htmlFor="or-pp-consent">{t('owner.outreach.page.consent')}</label>
              <textarea id="or-pp-consent" className="form-input" rows={2} value={form.entityConsentNote} placeholder={t('owner.outreach.page.consent_example')} onChange={e => setForm({ ...form, entityConsentNote: e.target.value })} />
              <div className="oc-muted">{t('owner.outreach.page.consent_help')}</div>
            </div>
          </>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={busy || form.topic.trim().length < 5 || (welcome && (!form.entityId || form.entityConsentNote.trim().length < 10))}>{t('owner.outreach.page.prepare')}</button>
        </div>
      </form>
    </div>
  )
}

const EDITABLE = ['READY_FOR_REVIEW', 'APPROVED', 'FAILED']

export function PostEditor({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { t, isAR } = useLang()
  const [p, setP] = useState<any>(null)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [manual, setManual] = useState<any>(null)
  const [postUrl, setPostUrl] = useState('')
  const load = useCallback(() => { outreachApi.pagePost(postId).then((x: any) => { setP(x); setBody(x.body) }).catch((e: any) => setError(e.message)) }, [postId])
  useEffect(load, [load])
  const run = async (fn: () => Promise<any>, msg: string) => { setError(''); setNotice(''); try { await fn(); setNotice(msg); load() } catch (e: any) { setError(e.message) } }
  const copy = async () => { try { await navigator.clipboard.writeText(body); setNotice(t('owner.outreach.page.copied')) } catch { setError(t('owner.outreach.li.copy_failed')) } }
  const editable = p && EDITABLE.includes(p.status)
  const over = body.length > POST_MAX
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.page.review')}>
      <div className="modal" style={{ maxWidth: 760, width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.outreach.page.review')}<HelpTip text={t('owner.outreach.page.review_help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {notice && <div className="oc-ok" role="status">{notice}</div>}
        {!p ? <Loading /> : (
          <>
            <div className="oc-muted" style={{ marginBottom: 8 }}>
              {t(`owner.outreach.page.kind.${p.kind}`)} · <Pill text={t(`owner.outreach.page.post_status.${p.status}`)} color={POST_COLOR[p.status]} /> · {t(`owner.outreach.generator.${p.generation?.generator || 'TEMPLATE'}`)}{p.generation?.rejected?.length ? ` · ${t('owner.outreach.editor.ai_rejected')}` : ''}
            </div>
            {p.error && <div className="oc-warn" role="note">{p.error}</div>}
            {p.entityConsentNote && <div className="oc-muted">{t('owner.outreach.page.consent')}: {p.entityConsentNote}</div>}
            <div className="form-group">
              <label className="form-label" htmlFor="or-pe-body">{t('owner.outreach.page.text')}</label>
              <textarea id="or-pe-body" className="form-input" rows={12} dir={p.language === 'AR' ? 'rtl' : 'ltr'} value={body} disabled={!editable} onChange={e => setBody(e.target.value)} />
              <div className={over ? 'oc-error' : 'oc-muted'} aria-live="polite">{t('owner.outreach.li.count').replace('{n}', String(body.length)).replace('{max}', String(POST_MAX))}</div>
            </div>
            {p.status === 'PUBLISHED' && (
              <div className="oc-ok" role="status">{t('owner.outreach.page.published_on').replace('{date}', fmtDate(p.publishedAt, isAR))} · {t(`owner.outreach.page.mode.${p.publishMode || 'MANUAL'}`)}{p.postUrl && <> · <a href={p.postUrl} target="_blank" rel="noopener noreferrer">{t('owner.outreach.page.view_post')}</a></>}</div>
            )}
            {manual && (
              <div className="oc-card" style={{ marginTop: 12 }}>
                <div className="oc-note" role="note">{t(manual.reason === 'PAGE_NOT_CONNECTED' ? 'owner.outreach.page.manual_not_connected' : 'owner.outreach.page.manual_required')}</div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap', marginTop: 8 }}>
                  <button type="button" className="btn btn-sm btn-secondary" onClick={copy}>{t('owner.outreach.page.copy')}</button>
                  {manual.pageUrl && <a className="btn btn-sm btn-secondary" href={manual.pageUrl} target="_blank" rel="noopener noreferrer">{t('owner.outreach.page.open_page')}</a>}
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label" htmlFor="or-pe-url">{t('owner.outreach.page.post_link')}</label>
                  <input id="or-pe-url" className="form-input" value={postUrl} placeholder="https://www.linkedin.com/feed/update/…" onChange={e => setPostUrl(e.target.value)} />
                </div>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => run(async () => { await outreachApi.recordPagePost(postId, { postUrl: postUrl.trim() || undefined }); setManual(null) }, t('owner.outreach.page.recorded'))}>{t('owner.outreach.page.mark_published')}</button>
              </div>
            )}
            <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.close')}</button>
              {editable && <button type="button" className="btn btn-secondary" onClick={() => run(() => outreachApi.cancelPagePost(postId), t('owner.outreach.page.cancelled'))}>{t('owner.outreach.page.cancel_post')}</button>}
              {editable && <button type="button" className="btn btn-secondary" onClick={() => run(() => outreachApi.regeneratePagePost(postId), t('owner.outreach.editor.regenerated'))}>{t('owner.outreach.editor.regenerate')}</button>}
              {editable && <button type="button" className="btn btn-secondary" disabled={over || body === p.body} onClick={() => run(() => outreachApi.updatePagePost(postId, { body }), t('owner.outreach.editor.saved'))}>{t('owner.outreach.save')}</button>}
              {p.status === 'READY_FOR_REVIEW' && <button type="button" className="btn btn-primary" disabled={over || body !== p.body} onClick={() => run(() => outreachApi.approvePagePost(postId), t('owner.outreach.editor.approved'))}>{t('owner.outreach.approve')}</button>}
              {p.status === 'APPROVED' && <button type="button" className="btn btn-primary" onClick={() => setPublishing(true)}>{t('owner.outreach.page.publish')}</button>}
            </div>
          </>
        )}
        {publishing && (
          <StepUpModal title={t('owner.outreach.page.publish')} help={t('owner.outreach.page.publish_help')} confirmLabel={t('owner.outreach.page.publish')}
            onCancel={() => setPublishing(false)}
            onConfirm={async ({ password }) => {
              const r = await outreachApi.publishPagePost(postId, password)
              setPublishing(false)
              if (r.status === 'MANUAL_REQUIRED') setManual(r)
              else if (r.status === 'FAILED') setError(`${t('owner.outreach.page.failed')}${r.post?.error ? ` — ${r.post.error}` : ''}`)
              else setNotice(t('owner.outreach.page.published'))
              load()
            }} />
        )}
      </div>
    </div>
  )
}
