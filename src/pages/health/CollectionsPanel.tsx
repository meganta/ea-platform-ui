import { useCallback, useEffect, useMemo, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useAuth } from '../../contexts/AuthContext'
import { saveBlob } from '../../lib/studyExport'
import { HealthApi, T, fmt } from './health'

const STATUSES = ['READY', 'READY_WITH_WARNING', 'NEEDS_CLARIFICATION', 'REJECTED']
const STATUS_CLASS: Record<string, string> = { READY: 'ah-prio-OPTIONAL', READY_WITH_WARNING: 'ah-prio-RECOMMENDED', NEEDS_CLARIFICATION: 'ah-prio-HIGH', REJECTED: 'ah-prio-CRITICAL' }

function Status({ s, t }: { s: string; t: T }) {
  return <span className={`ah-chip ${STATUS_CLASS[s] || ''}`}>{t(`health.collect.status.${s}`)}</span>
}

const show = (v: any) => (v === null || v === undefined || v === '' ? '—' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? (v.name || JSON.stringify(v)) : String(v))

/** One collection: download, upload + validation, proposed changes with decisions, execution. */
function CollectionDetail({ api, t, id, onChanged, onExecuted }: { api: HealthApi; t: T; id: string; onChanged: () => void; onExecuted: () => void }) {
  const { hasPermission } = useAuth()
  const [e, setE] = useState<any>(null)
  const [changes, setChanges] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [filter, setFilter] = useState<string>('ALL')
  const [result, setResult] = useState<any>(null)

  const load = useCallback(() => {
    api.get(`/architecture-health/collections/${id}`).then(setE).catch(err => setMsg({ ok: false, text: err.message }))
    api.get(`/architecture-health/collections/${id}/changes`).then(c => setChanges(Array.isArray(c) ? c : [])).catch(() => setChanges([]))
  }, [api, id])
  useEffect(() => { load() }, [load])

  const run = async (label: string, fn: () => Promise<any>, ok: string) => {
    setBusy(label); setMsg(null)
    try { const r = await fn(); setMsg({ ok: true, text: ok }); load(); onChanged(); return r }
    catch (err: any) { setMsg({ ok: false, text: err.message }) }
    finally { setBusy(null) }
  }
  const download = () => run('download', async () => saveBlob(await api.blob(`/architecture-health/collections/${id}/template`), `ArchMind_collection_${e?.domainCode || ''}.xlsx`), t('health.collect.downloaded'))
  const upload = () => file && run('upload', () => api.upload(`/architecture-health/collections/${id}/upload`, file), t('health.collect.uploaded'))
  const decide = (decision: 'APPROVED' | 'REJECTED', allReady = false) => run('decide', () => api.post(`/architecture-health/collections/${id}/decisions`, allReady ? { allReady: true, decision } : { changeIds: [...selected], decision, note: note.trim() || undefined }).then(r => { setSelected(new Set()); setNote(''); return r }), t('health.collect.decided'))
  const execute = () => run('execute', () => api.post(`/architecture-health/collections/${id}/execute`).then(r => { setResult(r); onExecuted(); return r }), t('health.collect.executed'))

  const shown = useMemo(() => changes.filter(c => filter === 'ALL' || c.validationStatus === filter || (filter === 'PENDING' && c.decision === 'PENDING')), [changes, filter])
  if (!e) return msg ? <div role="alert">{msg.text}</div> : <div>{t('common.loading')}</div>
  const v = e.validation
  const closed = ['EXECUTED', 'CANCELLED'].includes(e.status)
  const approved = changes.filter(c => c.decision === 'APPROVED' && !c.executed).length
  const toggle = (cid: string) => setSelected(s => { const n = new Set(s); if (n.has(cid)) n.delete(cid); else n.add(cid); return n })

  return (
    <div data-testid="health-collection-detail" style={{ marginTop: 12 }}>
      {msg && <div className="rp-banner" role="status">{msg.text}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', margin: '8px 0' }}>
        <button type="button" className="ah-btn" onClick={download} disabled={!!busy}>⬇ {t('health.collect.download')}</button>
        {!closed && e.status !== 'PARTIALLY_EXECUTED' && hasPermission('ArchitectureHealth.UploadCollection') && (
          <>
            <label htmlFor={`ah-upload-${id}`} className="ah-dim">{t('health.collect.choose_file')}</label>
            <input id={`ah-upload-${id}`} type="file" accept=".xlsx,.xls" onChange={ev => setFile(ev.target.files?.[0] || null)} />
            <button type="button" className="ah-btn ah-btn-primary" onClick={upload} disabled={!file || !!busy}>{busy === 'upload' ? t('health.collect.validating') : t('health.collect.upload')}</button>
            <HelpTip text={t('health.collect.upload_help')} />
          </>
        )}
      </div>

      {v && (
        <>
          <div className="ah-tiles">
            {STATUSES.map(s => <div key={s} className="ah-tile"><div className="ah-tile-label">{t(`health.collect.status.${s}`)}</div><div className="ah-tile-value">{v.summary?.[s] ?? 0}</div><div className="ah-tile-sub">{t('health.collect.rows')}</div></div>)}
            <div className="ah-tile"><div className="ah-tile-label">{t('health.collect.preview')}</div><div className="ah-tile-sub">
              {t('health.collect.preview_line').replace('{create}', String(v.summary?.objectsToCreate ?? 0)).replace('{update}', String(v.summary?.objectsToUpdate ?? 0)).replace('{rels}', String(v.summary?.relationshipsToCreate ?? 0)).replace('{replace}', String(v.summary?.relationshipsToReplace ?? 0)).replace('{conflicts}', String(v.summary?.conflicts ?? 0)).replace('{dups}', String(v.summary?.possibleDuplicates ?? 0))}
            </div></div>
          </div>
          {(v.fileProblems || []).length > 0 && <ul className="ah-list" role="alert">{v.fileProblems.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>}
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12.5 }}>{t('health.collect.row_results')} ({(v.rows || []).length})</summary>
            <div className="rp-table-wrap">
              <table className="ah-table">
                <thead><tr><th>{t('health.collect.row')}</th><th>{t('health.collect.object')}</th><th>{t('health.collect.validation')}</th><th>{t('health.collect.reasons')}</th></tr></thead>
                <tbody>{(v.rows || []).map((r: any) => <tr key={r.rowRef}><td>{r.rowRef}</td><td>{r.objectName || '—'}</td><td><Status s={r.status} t={t} /></td><td className="ah-dim">{r.noChanges ? t('health.collect.no_changes') : r.reasons.join(' ')}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}

      {changes.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <label htmlFor={`ah-filter-${id}`} className="ah-dim">{t('health.collect.show')}</label>
            <select id={`ah-filter-${id}`} value={filter} onChange={ev => setFilter(ev.target.value)} className="form-input" style={{ width: 'auto' }}>
              <option value="ALL">{t('health.collect.all')}</option>
              <option value="PENDING">{t('health.collect.pending')}</option>
              {STATUSES.map(s => <option key={s} value={s}>{t(`health.collect.status.${s}`)}</option>)}
            </select>
          </div>
          <div className="rp-table-wrap">
            <table className="ah-table" data-testid="health-changes">
              <thead><tr><th /><th>{t('health.collect.object')}</th><th>{t('health.collect.change')}</th><th>{t('health.collect.previous')}</th><th>{t('health.collect.new')}</th><th>{t('health.collect.validation')}</th><th>{t('health.collect.decision')}</th></tr></thead>
              <tbody>
                {shown.map(c => (
                  <tr key={c.id}>
                    <td>{!c.executed && !closed && c.validationStatus !== 'REJECTED' && <input type="checkbox" aria-label={`${t('health.collect.select')} ${c.objectName}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />}</td>
                    <td>{c.objectId ? <a href={`/repository?asset=${encodeURIComponent(c.objectId)}`}>{c.objectName}</a> : c.objectName}<div className="ah-dim">{c.rowRef}</div></td>
                    <td>{t(`health.collect.type.${c.changeType}`)}{c.field && <div className="ah-dim">{c.field}</div>}</td>
                    <td className="ah-dim">{c.changeType.includes('RELATIONSHIP') ? (c.previousValue ? t('health.collect.recorded_link') : '—') : show(c.previousValue)}</td>
                    <td>{c.changeType.includes('RELATIONSHIP') ? show(c.targetName) : show(c.newValue)}</td>
                    <td><Status s={c.validationStatus} t={t} />{c.reasons?.length > 0 && <div className="ah-dim">{c.reasons.join(' ')}</div>}</td>
                    <td>{c.executed ? <span className="ah-chip">{t('health.collect.written')}</span> : t(`health.collect.decision.${c.decision}`)}{c.executionError && <div className="ah-dim" role="alert">{c.executionError}</div>}{c.decisionNote && <div className="ah-dim">{c.decisionNote}</div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!closed && hasPermission('ArchitectureHealth.ApproveChanges') && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
              <button type="button" className="ah-btn ah-btn-primary" onClick={() => decide('APPROVED', true)} disabled={!!busy}>{t('health.collect.approve_ready')}</button>
              <label htmlFor={`ah-note-${id}`} className="ah-dim">{t('health.collect.note')}</label>
              <input id={`ah-note-${id}`} className="form-input" style={{ width: 240, maxWidth: '100%' }} value={note} onChange={ev => setNote(ev.target.value)} />
              <button type="button" className="ah-btn" onClick={() => decide('APPROVED')} disabled={!!busy || selected.size === 0}>{t('health.collect.approve_selected')} ({selected.size})</button>
              <button type="button" className="ah-btn" onClick={() => decide('REJECTED')} disabled={!!busy || selected.size === 0}>{t('health.collect.reject_selected')}</button>
              <HelpTip text={t('health.collect.approve_help')} />
            </div>
          )}
          {!closed && approved > 0 && hasPermission('ArchitectureHealth.ExecuteChanges') && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="ah-btn ah-btn-primary" onClick={execute} disabled={!!busy}>{busy === 'execute' ? t('health.collect.writing') : t('health.collect.execute').replace('{count}', String(approved))}</button>
              <HelpTip text={t('health.collect.execute_help')} />
            </div>
          )}
        </div>
      )}
      {(result || e.afterCompleteness !== null && e.afterCompleteness !== undefined) && (
        <div className="ah-plan" style={{ marginTop: 10 }} data-testid="health-collection-result">
          {t('health.collect.result').replace('{from}', fmt(e.baselineCompleteness ?? result?.before?.completeness)).replace('{to}', fmt(result?.after?.completeness ?? e.afterCompleteness)).replace('{mfrom}', fmt(e.baselineMaturity ?? result?.before?.maturity)).replace('{mto}', fmt(result?.after?.maturity ?? e.afterMaturity))}
          {result && result.failed > 0 && <div className="ah-dim">{t('health.collect.failed').replace('{count}', String(result.failed))}</div>}
        </div>
      )}
    </div>
  )
}

/** Data collection for one domain: start one from the plan, follow each one to its repository update. */
export default function CollectionsPanel({ api, t, code, canCollect, onExecuted }: { api: HealthApi; t: T; code: string; canCollect: boolean; onExecuted: () => void }) {
  const { hasPermission } = useAuth()
  const [list, setList] = useState<any[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { api.get(`/architecture-health/collections?domain=${encodeURIComponent(code)}`).then(l => setList(Array.isArray(l) ? l : [])).catch(() => setList([])) }, [api, code])
  useEffect(() => { load() }, [load])

  const start = async () => {
    setBusy(true); setMsg(null)
    try {
      const e = await api.post(`/architecture-health/domains/${encodeURIComponent(code)}/collections`, {})
      saveBlob(await api.blob(`/architecture-health/collections/${e.id}/template`), `ArchMind_collection_${code}.xlsx`)
      setOpen(e.id); load()
    } catch (err: any) { setMsg(err.message) }
    finally { setBusy(false) }
  }

  return (
    <div className="rp-card" data-testid="health-collections">
      <div className="rp-card-title">{t('health.collect.title')}<HelpTip text={t('health.collect.help')} /></div>
      {canCollect && hasPermission('ArchitectureHealth.GenerateTemplate') && (
        <button type="button" className="ah-btn ah-btn-primary" onClick={start} disabled={busy}>{busy ? t('health.collect.preparing') : `📥 ${t('health.collect.start')}`}</button>
      )}
      {msg && <div className="rp-banner" role="alert">{msg}</div>}
      {list && list.length === 0 && <div className="ah-dim" style={{ marginTop: 8 }}>{t('health.collect.none')}</div>}
      {list && list.length > 0 && (
        <div className="rp-table-wrap" style={{ marginTop: 10 }}>
          <table className="ah-table">
            <thead><tr><th>{t('health.collect.started')}</th><th>{t('health.collect.state')}</th><th>{t('health.collect.items')}</th><th>{t('health.completeness')}</th><th /></tr></thead>
            <tbody>
              {list.map(e => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td>{t(`health.collect.state.${e.status}`)}</td>
                  <td>{e.itemKeys?.length ?? 0}</td>
                  <td>{fmt(e.baselineCompleteness, '%')} → {e.afterCompleteness !== null && e.afterCompleteness !== undefined ? fmt(e.afterCompleteness, '%') : `${fmt(e.projectedCompleteness, '%')} ${t('health.collect.projected')}`}</td>
                  <td><button type="button" className="ah-link-btn" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>{open === e.id ? t('health.gap.hide') : t('health.collect.open')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <CollectionDetail key={open} api={api} t={t} id={open} onChanged={load} onExecuted={onExecuted} />}
    </div>
  )
}
