import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import HelpTip from '../components/HelpTip'
import { Lang, REVIEW_TYPES, ReviewSummary, ReviewType, designReviewApi } from './designreview/designReviewApi'
import ReviewWorkspace, { verdictClass } from './designreview/ReviewWorkspace'
import './designreview/DesignReview.css'

const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''))

/** Design & RFP Reviews: EA review of an RFP or solution design, grounded in the Repository. */
export default function DesignReviewsPage() {
  const { t, isAR } = useLang()
  const [params, setParams] = useSearchParams()
  const open = params.get('review')
  const go = useCallback((id: string | null) => setParams(id ? { review: id } : {}), [setParams])
  return (
    <div className="dr-page" dir={isAR ? 'rtl' : 'ltr'}>
      {open ? <ReviewWorkspace id={open} onBack={() => go(null)} /> : <ReviewList onOpen={go} />}
      <span className="sr-only">{t('dr.title')}</span>
    </div>
  )
}

function ReviewList({ onOpen }: { onOpen: (id: string) => void }) {
  const { t, isAR } = useLang()
  const { hasPermission } = useAuth() as any
  const canRun = !!hasPermission?.('DesignReview.Run')
  const [rows, setRows] = useState<ReviewSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => { designReviewApi.list(search).then(setRows).catch(e => setError(e.message)) }, [search])
  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h) }, [load])
  // Running reviews update without a reload.
  useEffect(() => {
    if (!rows?.some(r => r.status === 'RUNNING')) return
    const h = setInterval(load, 6000)
    return () => clearInterval(h)
  }, [rows, load])

  return (
    <>
      <header className="dr-header">
        <div>
          <h1 className="dr-title">{t('dr.title')} <HelpTip text={t('dr.help')} /></h1>
          <p className="dr-subtitle">{t('dr.subtitle')}</p>
        </div>
        <div className="dr-actions">
          <label className="sr-only" htmlFor="dr-search">{t('dr.search')}</label>
          <input id="dr-search" className="form-input" placeholder={t('dr.search')} value={search} onChange={e => setSearch(e.target.value)} />
          {canRun && <button className="btn btn-primary" onClick={() => setCreating(true)}>{t('dr.new')}</button>}
        </div>
      </header>
      {creating && <NewReviewForm onCancel={() => setCreating(false)} onStarted={id => { setCreating(false); onOpen(id) }} />}
      {error && <div role="alert" className="dr-error">{t('dr.load_failed')}: {error}</div>}
      {!rows && !error && <p>{t('dr.loading')}</p>}
      {rows && !rows.length && <p className="dr-dim">{t('dr.empty')}</p>}
      {rows && rows.length > 0 && (
        <div className="dr-card dr-table-wrap">
          <table className="dr-table">
            <thead><tr><th>{t('dr.col.title')}</th><th>{t('dr.col.type')}</th><th>{t('dr.col.status')}</th><th>{t('dr.col.verdict')}</th><th>{t('dr.col.created')}</th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="dr-clickable" tabIndex={0} onClick={() => onOpen(r.id)} onKeyDown={e => { if (e.key === 'Enter') onOpen(r.id) }} data-testid={`review-${r.id}`}>
                  <td><strong>{r.title}</strong><div className="dr-dim">{r.documentName}{r.counts ? ` · ${fill(t('dr.counts'), { gaps: r.counts.gaps, risks: r.counts.risks, recs: r.counts.recommendations })}` : ''}</div></td>
                  <td>{t(`dr.type.${r.reviewType}`)}</td>
                  <td><span className={`dr-badge ${r.status === 'FAILED' ? 'dr-bad' : r.status === 'APPROVED' ? 'dr-good' : 'dr-neutral'}`}>{t(`dr.status.${r.status}`)}</span>{r.status === 'RUNNING' && <div className="dr-dim">{t(`dr.stage.${r.stage}`)}</div>}</td>
                  <td>{r.verdict ? <span className={`dr-badge ${verdictClass(r.verdict)}`}>{t(`dr.verdict.${r.verdict}`)}</span> : '—'}</td>
                  <td dir="ltr" style={{ textAlign: isAR ? 'right' : 'left' }}>{r.createdAt?.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function NewReviewForm({ onCancel, onStarted }: { onCancel: () => void; onStarted: (id: string) => void }) {
  const { t, isAR } = useLang()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ReviewType>('RFP')
  const [language, setLanguage] = useState<Lang>(isAR ? 'AR' : 'EN')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || title.trim().length < 3) return
    setBusy(true); setError(null)
    try { const r = await designReviewApi.start(file, title.trim(), type, language); onStarted(r.id) } catch (err: any) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <form className="dr-card" onSubmit={submit} aria-labelledby="dr-new-title">
      <div className="dr-card-head"><h2 id="dr-new-title">{t('dr.new_title')}</h2></div>
      <div className="dr-form">
        <div className="dr-wide">
          <label className="form-label" htmlFor="dr-title">{t('dr.field.title')}</label>
          <input id="dr-title" className="form-input" value={title} placeholder={t('dr.field.title_ph')} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="form-label" htmlFor="dr-type">{t('dr.field.type')}</label>
          <select id="dr-type" className="form-input" value={type} onChange={e => setType(e.target.value as ReviewType)}>
            {REVIEW_TYPES.map(x => <option key={x} value={x}>{t(`dr.type.${x}`)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label" htmlFor="dr-language">{t('dr.field.language')}</label>
          <select id="dr-language" className="form-input" value={language} onChange={e => setLanguage(e.target.value as Lang)}>
            <option value="AR">{t('dr.lang.AR')}</option>
            <option value="EN">{t('dr.lang.EN')}</option>
          </select>
        </div>
        <div className="dr-wide">
          <label className="form-label" htmlFor="dr-file">{t('dr.field.file')} <HelpTip text={t('dr.field.file_help')} /></label>
          <input id="dr-file" type="file" className="form-input" accept=".pdf,.docx,.doc,.txt,.md" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      {error && <div role="alert" className="dr-error">{error}</div>}
      <div className="dr-edit-bar">
        <button type="submit" className="btn btn-primary" disabled={busy || !file || title.trim().length < 3}>{busy ? t('dr.starting') : t('dr.start')}</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>{t('dr.cancel')}</button>
      </div>
    </form>
  )
}
