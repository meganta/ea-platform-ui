import { useEffect, useRef, useState } from 'react'
import HelpTip from './HelpTip'
import { TrackedKpi, alignmentApi } from '../lib/strategy-alignment'

type T = (key: string) => string
const MAX_EVIDENCE = 10
const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.zip'
const isWebLink = (value: string) => { try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' } catch { return false } }

/**
 * The comment and evidence (web links, files) behind one KPI measure. They appear in the period
 * report and its Excel export.
 */
export default function KpiEvidenceDialog({ t, kpi, period, year, canEdit, onClose, onChanged }: { t: T; kpi: TrackedKpi; period: string; year: number; canEdit: boolean; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const measure = kpi.measures[period]
  const evidence = measure?.evidence || []
  const [note, setNote] = useState(measure?.note || '')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const dialog = useRef<HTMLElement>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { dialog.current?.focus() }, [])
  const act = async (fn: () => Promise<unknown>) => { setBusy(true); setError(''); setSaved(false); try { await fn(); await onChanged(); return true } catch (e: any) { setError(e.message); return false } finally { setBusy(false) } }
  const periodName = t(`strategy.align.period.${period}`)
  const full = evidence.length >= MAX_EVIDENCE

  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
    <section ref={dialog} tabIndex={-1} className="refresh-modal kpi-evidence" role="dialog" aria-modal="true" aria-labelledby="kpi-evidence-title" onKeyDown={e => { if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose() } }}>
      <h2 id="kpi-evidence-title">{t('strategy.kpi.evidence.title')}<HelpTip text={t('strategy.kpi.evidence.help')} /></h2>
      <p className="impact-note"><strong>{kpi.name}</strong> · {periodName} {year}{measure?.value ? ` · ${t('strategy.kpi.col.value')}: ${measure.value}` : ''}</p>
      {error && <div role="alert" className="error">{error}</div>}

      <label htmlFor="kpi-evidence-note">{t('strategy.kpi.evidence.comment')}</label>
      <textarea id="kpi-evidence-note" value={note} maxLength={1000} rows={3} disabled={!canEdit || busy} onChange={e => { setNote(e.target.value); setSaved(false) }} />
      {canEdit && <div className="actions">
        <button disabled={busy || note.trim() === (measure?.note || '').trim()} onClick={async () => { if (await act(() => alignmentApi.comment(kpi.id, year, period, note.trim()))) setSaved(true) }}>{t('strategy.kpi.evidence.save_comment')}</button>
        {saved && <span role="status" className="impact-note">{t('strategy.kpi.evidence.saved')}</span>}
      </div>}

      <h3>{t('strategy.kpi.evidence.list')} ({evidence.length})</h3>
      {!evidence.length ? <p className="impact-note">{t('strategy.kpi.evidence.none')}</p> : <ul className="kpi-evidence-list">{evidence.map(e => <li key={e.id}>
        {e.kind === 'LINK'
          ? <a href={e.url} target="_blank" rel="noopener noreferrer">{e.url}</a>
          : <button className="link-button" disabled={busy} onClick={() => act(() => alignmentApi.downloadEvidence(kpi.id, year, period, e))}>{e.fileName}</button>}
        <small>{t(`strategy.kpi.evidence.kind.${e.kind}`)}</small>
        {canEdit && <button className="kpi-evidence-remove" disabled={busy} aria-label={`${t('strategy.kpi.evidence.remove')} ${e.kind === 'LINK' ? e.url : e.fileName}`} onClick={() => act(() => alignmentApi.removeEvidence(kpi.id, year, period, e.id))}>{t('strategy.kpi.evidence.remove')}</button>}
      </li>)}</ul>}

      {canEdit && (full ? <p className="impact-note">{t('strategy.kpi.evidence.full')}</p> : <div className="kpi-evidence-add">
        <label htmlFor="kpi-evidence-url">{t('strategy.kpi.evidence.link')}</label>
        <div className="kpi-evidence-row">
          <input id="kpi-evidence-url" type="url" inputMode="url" placeholder="https://" value={url} maxLength={2000} disabled={busy} onChange={e => setUrl(e.target.value)} />
          <button disabled={busy || !isWebLink(url.trim())} onClick={async () => { if (await act(() => alignmentApi.addEvidenceLink(kpi.id, year, period, url.trim()))) setUrl('') }}>{t('strategy.kpi.evidence.add_link')}</button>
        </div>
        {url.trim() && !isWebLink(url.trim()) && <p className="impact-note">{t('strategy.kpi.evidence.link_invalid')}</p>}
        <label htmlFor="kpi-evidence-file">{t('strategy.kpi.evidence.file')}</label>
        <input id="kpi-evidence-file" ref={file} type="file" accept={ACCEPT} disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) act(() => alignmentApi.addEvidenceFile(kpi.id, year, period, f)).finally(() => { if (file.current) file.current.value = '' }) }} />
        <p className="impact-note">{t('strategy.kpi.evidence.file_hint')}</p>
      </div>)}

      <div className="actions"><button className="primary" disabled={busy} onClick={onClose}>{t('strategy.kpi.evidence.close')}</button></div>
    </section>
  </div>
}
