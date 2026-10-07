import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { fill } from './release'
import './MetaModelRelease.css'

export interface OrphanedReport {
  orphaned: {
    total: number
    reconnectable: number
    groups: { definitionCode: string; name: string; sourceType: string | null; targetType: string | null; label: string | null; count: number; reconnectTo: { id: string; code: string; name: string } | null }[]
  }
  duplicates: { rowsToRemove: number }
}

/**
 * Links whose relationship was removed from the Meta Model. A publish
 * reconnects them when the relationship comes back (same types and label);
 * this card lists the rest and reconnects the ones the published version
 * already has again (Relationship Integrity, reconnect only).
 */
export default function OrphanedLinksCard({ api, refreshKey }: { api: any; refreshKey?: unknown }) {
  const { t, isAR } = useLang()
  const [report, setReport] = useState<OrphanedReport | null>(null)
  const [dups, setDups] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = useCallback(() => {
    api.get('/ea-repository/relationship-integrity/analyze').then((r: OrphanedReport) => setReport(r)).catch(() => setReport(null))
  }, [api])
  useEffect(() => { load() }, [load, refreshKey])

  const reconnect = async () => {
    setBusy(true); setNotice(null)
    try {
      const r = await api.post('/ea-repository/relationship-integrity/apply', { linkUnlinked: false, removeDuplicates: dups })
      setNotice({ kind: 'ok', text: fill(t('mm.orph.done'), { n: r?.reconnected ?? 0, removed: r?.removed ?? 0 }) })
      setDups(false)
      load()
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }

  const o = report?.orphaned
  if (!o || (!o.total && !notice)) return null
  return (
    <div className="mm-card mm-stack" dir={isAR ? 'rtl' : 'ltr'} data-testid="mm-orphaned">
      <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>{t('mm.orph.title')}<HelpTip text={t('mm.orph.help')} /></div>
      {notice && <div className={`mm-notice ${notice.kind}`} role="status">{notice.text}</div>}
      {o.total > 0 && (
        <>
          <div className="mm-meta" style={{ fontSize: 13 }}>{fill(t('mm.orph.summary'), { total: o.total, n: o.reconnectable })}</div>
          <div className="mm-stack" style={{ gap: 8 }}>
            {o.groups.map(g => (
              <div key={g.definitionCode} className="mm-change" style={{ borderLeftColor: g.reconnectTo ? '#2ecc71' : '#e74c3c' }}>
                <div className="mm-change-head">
                  <strong>{g.name}</strong>
                  <span className="mm-meta" style={{ fontFamily: 'monospace' }}>{g.definitionCode}</span>
                  <span className="mm-meta">· {g.sourceType || '?'} → {g.label || '?'} → {g.targetType || '?'}</span>
                  <span className="mm-meta">· {fill(t('mm.rel.links'), { n: g.count })}</span>
                </div>
                <div className="mm-meta" style={{ marginTop: 4 }}>{g.reconnectTo ? fill(t('mm.orph.to'), { name: `${g.reconnectTo.name} (${g.reconnectTo.code})` }) : t('mm.orph.none')}</div>
              </div>
            ))}
          </div>
          {o.reconnectable > 0 && (
            <>
              {(report?.duplicates.rowsToRemove || 0) > 0 && (
                <label className="mm-row" style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={dups} onChange={e => setDups(e.target.checked)} data-testid="mm-orph-dups" />
                  {fill(t('mm.orph.dups'), { n: report!.duplicates.rowsToRemove })}
                </label>
              )}
              <div><button type="button" className="mm-btn primary" disabled={busy} onClick={reconnect}>{busy ? t('mm.orph.working') : fill(t('mm.orph.reconnect'), { n: o.reconnectable })}</button></div>
            </>
          )}
        </>
      )}
    </div>
  )
}
