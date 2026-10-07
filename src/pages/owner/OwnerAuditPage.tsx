import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { ownerApi, fmtDate } from './ownerApi'
import { ErrorBox, Header, Loading, Pill } from './ownerUi'

export function SessionsTable({ rows, onEnded }: { rows: any[]; onEnded?: () => void }) {
  const { t, isAR } = useLang()
  const [error, setError] = useState('')
  if (!rows.length) return <div className="oc-muted">{t('owner.audit.empty')}</div>
  return (
    <>
      {error && <ErrorBox error={error} />}
      <div className="oc-table-wrap">
        <table className="oc-table">
          <thead><tr><th>{t('owner.col.tenant')}</th><th>{t('owner.audit.col.actor')}</th><th>{t('owner.reason')}</th><th>{t('owner.audit.col.started')}</th><th>{t('owner.audit.col.ended')}</th><th>{t('owner.audit.col.actions')}</th><th>{t('owner.col.status')}</th><th /></tr></thead>
          <tbody>
            {rows.map(s => (
              <tr key={s.id}>
                <td>{s.tenant?.name || s.tenantId}</td>
                <td>{s.actor?.email || s.actorUserId}</td>
                <td style={{ maxWidth: 280 }}>{s.reason}</td>
                <td>{fmtDate(s.startedAt, isAR)}</td>
                <td>{s.endedAt ? fmtDate(s.endedAt, isAR) : fmtDate(s.expiresAt, isAR)}{s.endReason ? <div className="oc-muted">{s.endReason}</div> : null}</td>
                <td>{s.actionCount}</td>
                <td><Pill text={t(`owner.session.${s.status}`)} color={s.status === 'ACTIVE' ? 'var(--success)' : 'var(--text-dim)'} /></td>
                <td>{s.status === 'ACTIVE' && <button type="button" className="btn btn-sm btn-secondary" onClick={async () => { try { await ownerApi.endSession(s.id); onEnded?.() } catch (e: any) { setError(e.message) } }}>{t('owner.audit.end')}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export function AuditTable({ rows }: { rows: any[] }) {
  const { t, isAR } = useLang()
  if (!rows.length) return <div className="oc-muted">{t('owner.audit.empty')}</div>
  return (
    <div className="oc-table-wrap">
      <table className="oc-table">
        <thead><tr><th>{t('owner.audit.col.time')}</th><th>{t('owner.audit.col.actor')}</th><th>{t('owner.audit.col.action')}</th><th>{t('owner.col.tenant')}</th><th>{t('owner.audit.col.detail')}</th></tr></thead>
        <tbody>
          {rows.map(e => (
            <tr key={e.id}>
              <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(e.createdAt, isAR)}</td>
              <td>{e.actor?.email || e.actorUserId}</td>
              <td><code style={{ fontSize: 11 }}>{e.action}</code></td>
              <td>{e.tenant?.name || '—'}</td>
              <td className="oc-muted" style={{ maxWidth: 420, wordBreak: 'break-word' }}>{e.detail && Object.keys(e.detail).length ? JSON.stringify(e.detail).slice(0, 300) : ''}{e.ipAddress ? ` · ${e.ipAddress}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function OwnerAuditPage() {
  const { t, isAR } = useLang()
  const [events, setEvents] = useState<any[] | null>(null)
  const [sessions, setSessions] = useState<any[] | null>(null)
  const [action, setAction] = useState('')
  const [error, setError] = useState('')
  const load = useCallback(() => {
    setError('')
    ownerApi.audit({ action: action || undefined, limit: '300' }).then(setEvents).catch((e: any) => setError(e.message))
    ownerApi.sessions().then(setSessions).catch((e: any) => setError(e.message))
  }, [action])
  useEffect(() => { load() }, [load])
  const actions = ['OWNER_TENANT_CREATED', 'OWNER_TENANT_SUSPENDED', 'OWNER_TENANT_ACTIVATED', 'OWNER_ACCESS_STARTED', 'OWNER_ACCESS_ENDED', 'OWNER_ENRICHMENT_LAUNCHED', 'OWNER_ENRICHMENT_DECISIONS', 'OWNER_ENRICHMENT_COMMITTED', 'OWNER_VIEWS_PREPARED', 'OWNER_TENANT_VIEWED', 'OWNER_DASHBOARD_VIEWED', 'PLATFORM_OWNER_GRANTED', 'PLATFORM_OWNER_REVOKED']
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.audit.title')} help={t('owner.audit.help')} />
      {error && <ErrorBox error={error} onRetry={load} />}
      <div className="oc-section-title">{t('owner.activity.sessions')}</div>
      {sessions ? <SessionsTable rows={sessions} onEnded={load} /> : <Loading />}
      <div className="oc-section">
        <div className="oc-toolbar">
          <div className="oc-section-title" style={{ margin: 0 }}>{t('owner.activity.audit')}</div>
          <label htmlFor="owner-audit-action" className="oc-muted">{t('owner.audit.col.action')}</label>
          <select id="owner-audit-action" className="form-input" value={action} onChange={e => setAction(e.target.value)}>
            <option value="">{t('owner.enrich.filter_all')}</option>
            {actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {events ? <AuditTable rows={events} /> : <Loading />}
      </div>
    </div>
  )
}
