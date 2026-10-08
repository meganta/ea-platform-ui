import { apiFetch } from '../lib/session'
import { useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { saveBlob } from '../lib/studyExport'

const API = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

/** A data collection a domain architect prepared in Copilot (health_collection_prepare). */
export interface CopilotCollectionAttachment {
  kind: 'COLLECTION'; id: string; collectionId: string; domainCode: string; domainName: string
  items: number; rows: number; completenessFrom: number | null; completenessTo: number | null
  maturityFrom: number | null; maturityTo: number | null; createdAt: string
}

export function isCollectionAttachment(a: any): a is CopilotCollectionAttachment {
  return !!a && a.kind === 'COLLECTION' && typeof a.collectionId === 'string'
}

const num = (n: number | null) => (n === null || n === undefined ? '—' : String(n))

export default function CopilotCollectionCard({ attachment: a }: { attachment: CopilotCollectionAttachment }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const download = async () => {
    setBusy(true); setError(false)
    try {
      const res = await apiFetch(`${API}/architecture-health/collections/${encodeURIComponent(a.collectionId)}/template`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` } })
      if (!res.ok) throw new Error(String(res.status))
      saveBlob(await res.blob(), `ArchMind_collection_${a.domainCode}.xlsx`)
    } catch { setError(true) }
    finally { setBusy(false) }
  }
  const btn = { fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', border: '1px solid var(--accent)', fontWeight: 600 } as const
  return (
    <div data-testid="copilot-collection-card" style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--navy-light)', fontSize: 12.5, maxWidth: '100%' }}>
      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>📥 {t('copilot.collection.title').replace('{domain}', a.domainName)}<HelpTip text={t('copilot.collection.help')} /></div>
      <div style={{ color: 'var(--text-dim)', marginTop: 4 }}>
        {t('copilot.collection.summary').replace('{items}', String(a.items)).replace('{rows}', String(a.rows))}
        {a.completenessTo !== null && ` · ${t('copilot.collection.gain').replace('{from}', num(a.completenessFrom)).replace('{to}', num(a.completenessTo))}`}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" onClick={download} disabled={busy} style={{ ...btn, background: 'var(--accent)', color: 'var(--navy)' }}>{busy ? t('copilot.collection.downloading') : `⬇ ${t('copilot.collection.download')}`}</button>
        <a href={`/architecture-health?domain=${encodeURIComponent(a.domainCode)}`} style={{ ...btn, background: 'transparent', color: 'var(--text)', borderColor: 'var(--border)', textDecoration: 'none' }}>↗ {t('copilot.collection.open')}</a>
      </div>
      {error && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 4 }}>{t('copilot.collection.failed')}</div>}
    </div>
  )
}
