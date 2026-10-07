import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { fmtDate } from '../ownerApi'
import { ErrorBox, Header, Loading, Pill } from '../ownerUi'
import { outreachApi } from './outreachApi'
import { OutreachNav } from './OutreachShell'

const CAPABILITIES = ['supportsProfileDiscovery', 'supportsConnectionRequest', 'supportsDirectMessaging', 'supportsMessageStatus']

export default function OutreachSettingsPage() {
  const { t, isAR } = useLang()
  const [settings, setSettings] = useState<any>(null)
  const [form, setForm] = useState<any>(null)
  const [materials, setMaterials] = useState<any[] | null>(null)
  const [providers, setProviders] = useState<any>(null)
  const [suppressions, setSuppressions] = useState<any[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [makeDefault, setMakeDefault] = useState(true)
  const [domain, setDomain] = useState('')
  const [domainReason, setDomainReason] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setError('')
    outreachApi.settings().then((s: any) => { setSettings(s); setForm({ ...s, legalBasisNote: s.legalBasisNote || '', replyTo: s.replyTo || '', contactLine: s.contactLine || '' }) }).catch((e: any) => setError(e.message))
    outreachApi.materials().then(setMaterials).catch(() => setMaterials([]))
    outreachApi.providers().then(setProviders).catch(() => setProviders(null))
    outreachApi.suppressions().then((s: any) => setSuppressions(Array.isArray(s) ? s : [])).catch(() => setSuppressions([]))
  }, [])
  useEffect(load, [load])

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault(); setError(''); setNotice('')
    const dto: any = {}
    for (const k of ['sendingEnabled', 'legalBasisNote', 'dailySendLimit', 'batchLimit', 'linkedinDailyLimit', 'requireOwnerVerification', 'retentionDays', 'senderName', 'replyTo', 'contactLine']) {
      const v = k === 'linkedinDailyLimit' ? form[k] ?? 15 : form[k]
      dto[k] = ['dailySendLimit', 'batchLimit', 'linkedinDailyLimit', 'retentionDays'].includes(k) ? Number(v) : v
    }
    try { await outreachApi.saveSettings(dto); setNotice(t('owner.outreach.settings.saved')); load() } catch (e: any) { setError(e.message) }
  }
  const upload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0]
    if (!f) return
    setError(''); setNotice('')
    try { await outreachApi.uploadMaterial(f, makeDefault); setNotice(t('owner.outreach.materials.uploaded')); load() } catch (e: any) { setError(e.message) } finally { if (fileRef.current) fileRef.current.value = '' }
  }
  const run = async (fn: () => Promise<any>) => { setError(''); try { await fn(); load() } catch (e: any) { setError(e.message) } }

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.outreach.settings.title')} subtitle={t('owner.outreach.settings.subtitle')} help={t('owner.outreach.settings.help')} />
      <OutreachNav />
      {error && <ErrorBox error={error} onRetry={load} />}
      {notice && <div className="oc-ok" role="status">{notice}</div>}

      <section className="oc-card">
        <h2 className="oc-h2">{t('owner.outreach.materials.title')}<HelpTip text={t('owner.outreach.materials.help')} /></h2>
        <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="btn btn-primary" htmlFor="or-mat-file" style={{ cursor: 'pointer' }}>{t('owner.outreach.materials.upload')}</label>
          <input id="or-mat-file" ref={fileRef} type="file" accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={upload} style={{ position: 'absolute', left: -9999 }} />
          <label style={{ display: 'flex', gap: 6, fontSize: 13 }}><input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} />{t('owner.outreach.materials.make_default')}</label>
          <span className="oc-muted">{t('owner.outreach.materials.limits')}</span>
        </div>
        {!materials ? <Loading /> : !materials.length ? <div className="oc-empty">{t('owner.outreach.materials.empty')}</div> : (
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th>{t('owner.outreach.materials.name')}</th><th>{t('owner.outreach.materials.size')}</th><th>{t('owner.outreach.created')}</th><th /></tr></thead>
              <tbody>
                {materials.map(m => (
                  <tr key={m.id}>
                    <td><strong>{m.name}</strong>{m.isDefault && <> <Pill text={t('owner.outreach.default')} color="var(--success)" /></>}<div className="oc-muted">{m.fileName}</div></td>
                    <td>{(m.sizeBytes / 1024 / 1024).toFixed(1)} MB</td>
                    <td>{fmtDate(m.createdAt, isAR)}</td>
                    <td className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => run(() => outreachApi.downloadMaterial(m.id, m.fileName))}>{t('owner.outreach.materials.download')}</button>
                      {!m.isDefault && <button type="button" className="btn btn-sm btn-secondary" onClick={() => run(() => outreachApi.setDefaultMaterial(m.id))}>{t('owner.outreach.materials.set_default')}</button>}
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => run(() => outreachApi.archiveMaterial(m.id))}>{t('owner.outreach.materials.archive')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form && (
        <form className="oc-card" style={{ marginTop: 16 }} onSubmit={save}>
          <h2 className="oc-h2">{t('owner.outreach.settings.sending')}<HelpTip text={t('owner.outreach.settings.sending_help')} /></h2>
          <div className="oc-warn" role="note">{t('owner.outreach.settings.legal_note')}</div>
          <label style={{ display: 'flex', gap: 8, fontSize: 14, margin: '8px 0' }}>
            <input id="or-set-enabled" type="checkbox" checked={!!form.sendingEnabled} onChange={e => setForm({ ...form, sendingEnabled: e.target.checked })} />
            <span>{t('owner.outreach.settings.enabled')}</span>
          </label>
          <div className="form-group">
            <label className="form-label" htmlFor="or-set-legal">{t('owner.outreach.settings.legal_basis')}</label>
            <textarea id="or-set-legal" className="form-input" rows={3} value={form.legalBasisNote} onChange={e => setForm({ ...form, legalBasisNote: e.target.value })} />
          </div>
          <div className="oc-grid-3" style={{ gap: 12 }}>
            <div className="form-group"><label className="form-label" htmlFor="or-set-daily">{t('owner.outreach.settings.daily')}</label><input id="or-set-daily" className="form-input" type="number" min={1} max={500} value={form.dailySendLimit} onChange={e => setForm({ ...form, dailySendLimit: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="or-set-batch">{t('owner.outreach.settings.batch')}</label><input id="or-set-batch" className="form-input" type="number" min={1} max={50} value={form.batchLimit} onChange={e => setForm({ ...form, batchLimit: e.target.value })} /></div>
            <div className="form-group"><div className="flex" style={{ alignItems: 'center' }}><label className="form-label" htmlFor="or-set-li-daily">{t('owner.outreach.settings.li_daily')}</label><HelpTip text={t('owner.outreach.settings.li_daily_help')} /></div><input id="or-set-li-daily" className="form-input" type="number" min={1} max={50} value={form.linkedinDailyLimit ?? 15} onChange={e => setForm({ ...form, linkedinDailyLimit: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="or-set-retention">{t('owner.outreach.settings.retention')}<HelpTip text={t('owner.outreach.settings.retention_help')} /></label><input id="or-set-retention" className="form-input" type="number" min={30} max={1825} value={form.retentionDays} onChange={e => setForm({ ...form, retentionDays: e.target.value })} /></div>
          </div>
          <label style={{ display: 'flex', gap: 8, fontSize: 14, margin: '4px 0 12px' }}>
            <input id="or-set-verify" type="checkbox" checked={!!form.requireOwnerVerification} onChange={e => setForm({ ...form, requireOwnerVerification: e.target.checked })} />
            <span>{t('owner.outreach.settings.require_verification')}</span>
          </label>
          <div className="oc-grid-3" style={{ gap: 12 }}>
            <div className="form-group"><label className="form-label" htmlFor="or-set-sender">{t('owner.outreach.settings.sender')}</label><input id="or-set-sender" className="form-input" value={form.senderName} onChange={e => setForm({ ...form, senderName: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="or-set-reply">{t('owner.outreach.settings.reply_to')}</label><input id="or-set-reply" className="form-input" type="email" value={form.replyTo} onChange={e => setForm({ ...form, replyTo: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="or-set-contact">{t('owner.outreach.settings.contact')}</label><input id="or-set-contact" className="form-input" value={form.contactLine} onChange={e => setForm({ ...form, contactLine: e.target.value })} /></div>
          </div>
          {settings?.updatedAt && <div className="oc-muted">{t('owner.outreach.settings.updated')}: {fmtDate(settings.updatedAt, isAR)}</div>}
          <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>{t('owner.outreach.save')}</button>
        </form>
      )}

      <section className="oc-card" style={{ marginTop: 16 }}>
        <h2 className="oc-h2">{t('owner.outreach.providers.title')}<HelpTip text={t('owner.outreach.providers.help')} /></h2>
        {!providers ? <Loading /> : (
          <ul className="oc-list">
            <li><strong>{t('owner.outreach.providers.email')}</strong> — <Pill text={providers.email?.configured ? t('owner.settings.enabled') : t('owner.settings.disabled')} color={providers.email?.configured ? 'var(--success)' : 'var(--warning)'} /><div className="oc-muted">{t(providers.email?.configured ? 'owner.outreach.providers.email_on' : 'owner.outreach.providers.email_off')}</div></li>
            {(providers.channels || []).map((c: any) => (
              <li key={`ch-${c.channel}`}>
                <strong>{t('owner.outreach.providers.channel')}: {t(`owner.outreach.channel.${c.channel}`)}</strong> — <Pill text={c.capabilities?.configured ? t('owner.settings.enabled') : t(c.channel === 'LINKEDIN' ? 'owner.outreach.providers.manual' : 'owner.settings.disabled')} color={c.capabilities?.configured ? 'var(--success)' : 'var(--warning)'} />
                <div className="oc-muted">{CAPABILITIES.map(k => `${t(`owner.outreach.capability.${k}`)}: ${c.capabilities?.[k] ? t('owner.outreach.yes') : t('owner.outreach.no')}`).join(' · ')}</div>
                {c.channel === 'LINKEDIN' && <div className="oc-muted">{t('owner.outreach.providers.linkedin_manual')}</div>}
              </li>
            ))}
            {(providers.providers || []).map((p: any) => (
              <li key={p.name}><strong>{t(`owner.outreach.provider.${p.name}`)}</strong> — <Pill text={p.configured ? t('owner.settings.enabled') : t('owner.settings.disabled')} color={p.configured ? 'var(--success)' : 'var(--warning)'} /><div className="oc-muted">{t(`owner.outreach.provider_detail.${p.name}`)}</div></li>
            ))}
          </ul>
        )}
      </section>

      <section className="oc-card" style={{ marginTop: 16 }}>
        <h2 className="oc-h2">{t('owner.outreach.suppression.title')}<HelpTip text={t('owner.outreach.suppression.help')} /></h2>
        <form className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={async ev => { ev.preventDefault(); await run(() => outreachApi.suppressDomain({ domain, reason: domainReason })); setDomain(''); setDomainReason('') }}>
          <div className="form-group" style={{ margin: 0 }}><label className="form-label" htmlFor="or-sup-domain">{t('owner.outreach.suppression.domain')}</label><input id="or-sup-domain" className="form-input" value={domain} onChange={e => setDomain(e.target.value)} placeholder="example.gov.sa" /></div>
          <div className="form-group" style={{ margin: 0, flex: '1 1 220px' }}><label className="form-label" htmlFor="or-sup-reason">{t('owner.reason')}</label><input id="or-sup-reason" className="form-input" value={domainReason} onChange={e => setDomainReason(e.target.value)} /></div>
          <button type="submit" className="btn btn-secondary" disabled={!domain || domainReason.trim().length < 5}>{t('owner.outreach.suppression.add')}</button>
        </form>
        {suppressions.length > 0 && (
          <div className="oc-table-wrap" style={{ marginTop: 12 }}>
            <table className="oc-table oc-compact">
              <thead><tr><th>{t('owner.outreach.suppression.scope')}</th><th>{t('owner.outreach.suppression.value')}</th><th>{t('owner.reason')}</th><th>{t('owner.outreach.source')}</th><th>{t('owner.outreach.created')}</th></tr></thead>
              <tbody>{suppressions.map(s => <tr key={s.id}><td>{t(`owner.outreach.suppression.scope.${s.scope}`)}</td><td>{s.value}</td><td>{s.reason}</td><td>{t(`owner.outreach.suppression.source.${s.source}`)}</td><td>{fmtDate(s.createdAt, isAR)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
