import { useEffect, useState } from 'react'
import { useLang } from '../../../contexts/LangContext'
import HelpTip from '../../../components/HelpTip'
import { outreachApi, TEMPLATE_ROLES, LEGACY_ROLES, STRATEGIES, LINKEDIN_TYPES, Strategy } from './outreachApi'
import { Blockers } from './OutreachShell'

/** Prepares secure invitations (existing flow, not emailed): suggested role by default, elevation needs the password. */
export function InviteModal({ prospects, onClose }: { prospects: any[]; onClose: () => void }) {
  const { t } = useLang()
  const [roles, setRoles] = useState<Record<string, { legacyRole: string; template: string }>>({})
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const elevated = Object.values(roles).some(r => ['TENANT_ADMIN', 'SUPERADMIN'].includes(r.legacyRole) || r.template === 'tenant-administrator')
  const submit = async () => {
    setBusy(true); setError('')
    const chosen: Record<string, any> = {}
    for (const [pid, r] of Object.entries(roles)) if (r.template || r.legacyRole !== 'ARCHITECT') chosen[pid] = { legacyRole: r.legacyRole, templateCodes: r.template ? [r.template] : [] }
    try { setResult(await outreachApi.invitations({ prospectIds: prospects.map(p => p.id), roles: Object.keys(chosen).length ? chosen : undefined, password: elevated ? password : undefined })) } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.invite')}>
      <div className="modal" style={{ maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.outreach.invite')}<HelpTip text={t('owner.outreach.invite_help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {!result ? (
          <>
            <div className="oc-table-wrap">
              <table className="oc-table">
                <thead><tr><th>{t('owner.outreach.col.name')}</th><th>{t('owner.outreach.invite.access_level')}</th><th>{t('owner.outreach.invite.role')}</th></tr></thead>
                <tbody>
                  {prospects.map(p => {
                    const r = roles[p.id] || { legacyRole: 'ARCHITECT', template: '' }
                    const set = (patch: any) => setRoles(x => ({ ...x, [p.id]: { ...r, ...patch } }))
                    return (
                      <tr key={p.id}>
                        <td><strong>{p.fullName}</strong><div className="oc-muted">{p.jobTitle}</div></td>
                        <td><label htmlFor={`or-inv-l-${p.id}`} style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.invite.access_level')}</label><select id={`or-inv-l-${p.id}`} className="form-input" value={r.legacyRole} onChange={e => set({ legacyRole: e.target.value })}>{LEGACY_ROLES.map(x => <option key={x} value={x}>{t(`owner.outreach.legacy.${x}`)}</option>)}</select></td>
                        <td><label htmlFor={`or-inv-r-${p.id}`} style={{ position: 'absolute', left: -9999 }}>{t('owner.outreach.invite.role')}</label><select id={`or-inv-r-${p.id}`} className="form-input" value={r.template} onChange={e => set({ template: e.target.value })}><option value="">{t('owner.outreach.invite.suggested')}</option>{TEMPLATE_ROLES.map(x => <option key={x} value={x}>{t(`owner.outreach.template.${x}`)}</option>)}</select></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {elevated && (
              <div className="form-group oc-warn">
                <div>{t('owner.outreach.invite.elevated')}</div>
                <label className="form-label" htmlFor="or-inv-pw">{t('owner.password')}</label>
                <input id="or-inv-pw" className="form-input" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || (elevated && !password)}>{t('owner.outreach.invite.prepare')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="oc-ok">{t('owner.outreach.invite.done').replace('{n}', String(result.prepared))}</div>
            <ul className="oc-list">
              {result.results.map((r: any) => {
                const p = prospects.find(x => x.id === r.prospectId)
                return <li key={r.prospectId}><strong>{p?.fullName || r.prospectId}</strong> — {t(`owner.outreach.invite.status.${r.status}`)}{r.blockers && <Blockers blockers={r.blockers} />}{r.error && <span className="oc-muted"> ({r.error})</span>}</li>
              })}
            </ul>
            <div className="oc-muted">{t('owner.outreach.invite.not_emailed')}</div>
            <div className="modal-actions"><button type="button" className="btn btn-primary" onClick={onClose}>{t('owner.close')}</button></div>
          </>
        )}
      </div>
    </div>
  )
}

/** Generates drafts in a campaign (existing or new); nothing is sent here. */
export function PrepareOutreachModal({ prospectIds, onClose, onOpenCampaign, initialStrategy = 'EMAIL', initialLinkedinType = 'AUTO' }: { prospectIds: string[]; onClose: () => void; onOpenCampaign: (id: string) => void; initialStrategy?: Strategy; initialLinkedinType?: string }) {
  const { t } = useLang()
  const [campaigns, setCampaigns] = useState<any[] | null>(null)
  const [campaignId, setCampaignId] = useState('')
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('')
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy)
  const [linkedinType, setLinkedinType] = useState(initialLinkedinType)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { outreachApi.campaigns().then((c: any[]) => setCampaigns(c.filter(x => x.status !== 'CLOSED'))).catch(() => setCampaigns([])) }, [])
  const submit = async () => {
    setBusy(true); setError('')
    try {
      const cid = campaignId || (await outreachApi.createCampaign({ name })).id
      setCampaignId(cid)
      setResult({ ...(await outreachApi.drafts(cid, { prospectIds, language: language || undefined, strategy, linkedinType: strategy === 'EMAIL' || linkedinType === 'AUTO' ? undefined : linkedinType })), campaignId: cid })
    } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.outreach.prepare_outreach')}>
      <div className="modal" style={{ maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.outreach.prepare_outreach')}<HelpTip text={t('owner.outreach.prepare_outreach_help')} /></div>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {!result ? (
          <>
            <div className="form-group">
              <label className="form-label" htmlFor="or-po-campaign">{t('owner.outreach.campaign')}</label>
              <select id="or-po-campaign" className="form-input" value={campaignId} onChange={e => setCampaignId(e.target.value)}>
                <option value="">{t('owner.outreach.campaigns.new')}</option>
                {(campaigns || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {!campaignId && (
              <div className="form-group">
                <label className="form-label" htmlFor="or-po-name">{t('owner.outreach.campaigns.name')}</label>
                <input id="or-po-name" className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('owner.outreach.campaigns.name_example')} />
              </div>
            )}
            <fieldset className="form-group" style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
              <legend className="form-label">{t('owner.outreach.strategy')}<HelpTip text={t('owner.outreach.strategy_help')} /></legend>
              {STRATEGIES.map(x => (
                <label key={x} style={{ display: 'flex', gap: 8, fontSize: 13, marginBottom: 4 }}>
                  <input type="radio" name="or-po-strategy" value={x} checked={strategy === x} onChange={() => setStrategy(x)} />
                  <span><strong>{t(`owner.outreach.strategy.${x}`)}</strong> <span className="oc-muted">— {t(`owner.outreach.strategy_detail.${x}`)}</span></span>
                </label>
              ))}
            </fieldset>
            {strategy !== 'EMAIL' && (
              <div className="form-group">
                <label className="form-label" htmlFor="or-po-litype">{t('owner.outreach.li_type')}</label>
                <select id="or-po-litype" className="form-input" value={linkedinType} onChange={e => setLinkedinType(e.target.value)}>
                  {LINKEDIN_TYPES.map(x => <option key={x} value={x}>{t(`owner.outreach.li_type.${x}`)}</option>)}
                </select>
                <div className="oc-muted">{t('owner.outreach.li_manual_short')}</div>
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="or-po-lang">{t('owner.outreach.language')}</label>
              <select id="or-po-lang" className="form-input" value={language} onChange={e => setLanguage(e.target.value)}>
                <option value="">{t('owner.outreach.language.auto')}</option>
                <option value="EN">English</option><option value="AR">العربية</option>
              </select>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{t('owner.cancel')}</button>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || (!campaignId && name.trim().length < 2)}>{t('owner.outreach.generate_drafts')}</button>
            </div>
          </>
        ) : (
          <>
            <div className="oc-ok">{t('owner.outreach.drafts_done').replace('{n}', String(result.drafted))}</div>
            <ul className="oc-list">{result.results.filter((r: any) => r.status !== 'DRAFTED').map((r: any) => <li key={`${r.prospectId}-${r.channel || 'EMAIL'}`}>{r.channel && <strong>{t(`owner.outreach.channel.${r.channel}`)}: </strong>}{t(`owner.outreach.draft_status.${r.status}`)}{r.blockers && <Blockers blockers={r.blockers} />}</li>)}</ul>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.close')}</button>
              <button type="button" className="btn btn-primary" onClick={() => onOpenCampaign(result.campaignId)}>{t('owner.outreach.open_campaign')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
