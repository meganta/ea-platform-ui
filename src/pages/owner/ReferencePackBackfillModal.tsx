import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { ownerApi } from './ownerApi'
import { fill, Loading, Pill, StepUpModal } from './ownerUi'

/**
 * Prepares the government reference pack for existing organizations that
 * have no business capabilities, no business reference model and no
 * business reference architecture (eligibility decided by the backend).
 */
export default function ReferencePackBackfillModal({ onClose }: { onClose: () => void }) {
  const { t, isAR } = useLang()
  const [rows, setRows] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<any>(null)

  const load = () => {
    setError('')
    ownerApi.referencePackBackfill().then((r: any[]) => { setRows(r); setSelected(new Set(r.filter(x => x.eligible).map(x => x.tenantId))) }).catch((e: any) => setError(e.message))
  }
  useEffect(load, [])
  const eligible = useMemo(() => (rows || []).filter(r => r.eligible), [rows])
  const toggle = (id: string, on: boolean) => setSelected(s => { const n = new Set(s); if (on) n.add(id); else n.delete(id); return n })

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={t('owner.backfill.title')}>
      <div className="modal" dir={isAR ? 'rtl' : 'ltr'} style={{ maxWidth: 860, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-title">{t('owner.backfill.title')}<HelpTip text={t('owner.backfill.help')} /></div>
        <p className="oc-muted" style={{ marginBottom: 10 }}>{t('owner.backfill.rule')}</p>
        {error && <div className="oc-error" role="alert">{error}</div>}
        {result && (
          <div className="oc-ok" role="status">
            {fill(t('owner.backfill.done'), { n: result.results.filter((r: any) => r.status === 'DONE').length })}
            <ul style={{ paddingInlineStart: 18, fontSize: 13 }}>
              {result.results.map((r: any) => (
                <li key={r.tenantId}>{r.name}: {r.status === 'DONE' ? fill(t('owner.backfill.row_done'), { created: r.created ?? 0, caps: r.capabilities ?? 0, industry: t(`owner.pack.industry.${r.industry || 'GOV_OTHER'}`) }) : <span style={{ color: 'var(--danger)' }}>{r.error}</span>}</li>
              ))}
            </ul>
            {result.remaining > 0 && <div>{fill(t('owner.backfill.remaining'), { n: result.remaining })}</div>}
          </div>
        )}
        {!rows ? <Loading /> : (
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th /><th>{t('owner.backfill.col.org')}</th><th>{t('owner.backfill.col.capabilities')}</th><th>{t('owner.backfill.col.reference')}</th><th>{t('owner.backfill.col.status')}</th></tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.tenantId}>
                    <td><input id={`owner-backfill-${r.tenantId}`} type="checkbox" aria-label={r.name} disabled={!r.eligible} checked={r.eligible && selected.has(r.tenantId)} onChange={e => toggle(r.tenantId, e.target.checked)} /></td>
                    <td><strong>{r.name}</strong><div className="oc-muted">{r.slug}{r.framework ? ` · ${r.framework}` : ''}</div></td>
                    <td>{r.businessCapabilities}</td>
                    <td className="oc-muted">{r.hasBusinessReferenceModel || r.hasBusinessReferenceArchitecture ? t('owner.backfill.has_reference') : '—'}</td>
                    <td>{r.eligible ? <Pill text={t('owner.backfill.reason.ELIGIBLE')} color="var(--success)" /> : <span className="oc-muted">{r.reasons.map((x: string) => t(`owner.backfill.reason.${x}`)).join(' · ')}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('owner.close')}</button>
          <button type="button" className="btn btn-primary" disabled={!eligible.some(r => selected.has(r.tenantId))} onClick={() => setConfirming(true)}>{fill(t('owner.backfill.run'), { n: eligible.filter(r => selected.has(r.tenantId)).length })}</button>
        </div>
      </div>
      {confirming && (
        <StepUpModal title={t('owner.backfill.title')} help={t('owner.backfill.confirm_help')} confirmLabel={t('owner.backfill.confirm')}
          onCancel={() => setConfirming(false)}
          onConfirm={async ({ password }) => {
            const res = await ownerApi.runReferencePackBackfill({ tenantIds: eligible.filter(r => selected.has(r.tenantId)).map(r => r.tenantId), password })
            setResult(res); setConfirming(false); load()
          }} />
      )}
    </div>
  )
}
