import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useLang } from '../../../contexts/LangContext'
import { Pill } from '../ownerUi'
import { outreachApi, JOB_RUNNING } from './outreachApi'

/** Sub-navigation of Government Outreach (inside the Owner Console shell). */
export function OutreachNav() {
  const { t } = useLang()
  const items = [
    { to: '/owner/outreach', label: t('owner.outreach.nav.dashboard'), end: true },
    { to: '/owner/outreach/entities', label: t('owner.outreach.nav.entities') },
    { to: '/owner/outreach/prospects', label: t('owner.outreach.nav.prospects') },
    { to: '/owner/outreach/campaigns', label: t('owner.outreach.nav.campaigns') },
    { to: '/owner/outreach/settings', label: t('owner.outreach.nav.settings') },
  ]
  return (
    <nav className="oc-tabs" aria-label={t('owner.nav.outreach')}>
      {items.map(i => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }: { isActive: boolean }) => `oc-tab${isActive ? ' active' : ''}`}>{i.label}</NavLink>
      ))}
    </nav>
  )
}

/** Reasons a prospect cannot be contacted yet, worded per code. */
export function Blockers({ blockers }: { blockers: string[] }) {
  const { t } = useLang()
  if (!blockers?.length) return null
  return (
    <ul className="oc-blockers">
      {blockers.map(b => <li key={b}>{t(`owner.outreach.blocker.${b}`)}</li>)}
    </ul>
  )
}

export function StatusPill({ prefix, value, colors }: { prefix: string; value: string | null | undefined; colors?: Record<string, string> }) {
  const { t } = useLang()
  if (!value) return <span className="oc-muted">—</span>
  return <Pill text={t(`${prefix}.${value}`)} color={colors?.[value] || 'var(--text-dim)'} />
}

/**
 * Follows a discovery job: while it runs, asks the server to run the next
 * stage (POST advance), like the enrichment panel; shows stages, counts and
 * limitations; offers close (review done) or cancel.
 */
export function JobProgress({ jobId, onDone }: { jobId: string; onDone?: () => void }) {
  const { t } = useLang()
  const [job, setJob] = useState<any>(null)
  const [error, setError] = useState('')
  const stopped = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    stopped.current = false
    let timer: any
    const step = async () => {
      try {
        const j = await outreachApi.job(jobId)
        if (stopped.current) return
        setJob(j)
        if (JOB_RUNNING.includes(j.status)) {
          const next = await outreachApi.advance(jobId)
          if (stopped.current) return
          setJob(next)
          if (JOB_RUNNING.includes(next.status)) timer = setTimeout(step, 1500)
          else doneRef.current?.()
        }
      } catch (e: any) { if (!stopped.current) setError(e.message) }
    }
    step()
    return () => { stopped.current = true; clearTimeout(timer) }
  }, [jobId])

  if (error) return <div className="oc-error" role="alert">{error}</div>
  if (!job) return <div className="oc-muted" role="status">{t('owner.loading')}</div>
  const running = JOB_RUNNING.includes(job.status)
  const done: string[] = job.progress?.stagesDone || []
  const stages = job.mode === 'ENTITIES' ? ['ENTITY_DISCOVERY', 'VERIFICATION', 'CLASSIFICATION', 'DEDUPLICATION', 'ENTITY_MAPPING'] : ['PROFESSIONAL_DISCOVERY', 'VERIFICATION', 'CLASSIFICATION', 'DEDUPLICATION', 'ENTITY_MAPPING']
  return (
    <div className="oc-card oc-job" aria-live="polite">
      <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <strong>{t(`owner.outreach.job.mode.${job.mode}`)}</strong>
        <Pill text={t(`owner.outreach.job.status.${job.status}`)} color={job.status === 'FAILED' ? 'var(--danger)' : running ? '#0EA5E9' : 'var(--success)'} />
        {job.progress?.message && <span className="oc-muted">{job.progress.message}</span>}
      </div>
      <ol className="oc-stages">
        {stages.map(s => <li key={s} className={done.includes(s) ? 'done' : job.stage === s ? 'current' : ''}>{t(`owner.outreach.job.stage.${s}`)}</li>)}
      </ol>
      {job.results && (job.results.created !== undefined) && (
        <div className="oc-muted">{t('owner.outreach.job.results').replace('{created}', String(job.results.created ?? 0)).replace('{merged}', String(job.results.merged ?? 0)).replace('{dropped}', String(job.results.dropped ?? 0)).replace('{suppressed}', String(job.results.suppressed ?? 0))}</div>
      )}
      {job.errorMessage && <div className="oc-error">{job.errorMessage}</div>}
      {job.limitations?.length > 0 && (
        <details><summary>{t('owner.outreach.job.limitations')} ({job.limitations.length})</summary><ul>{job.limitations.map((l: string, i: number) => <li key={i} className="oc-muted">{l}</li>)}</ul></details>
      )}
      {job.rejected?.length > 0 && (
        <details><summary>{t('owner.outreach.job.rejected')} ({job.rejected.length})</summary><ul>{job.rejected.map((r: any, i: number) => <li key={i}><strong>{r.name}</strong> — <span className="oc-muted">{r.reason}</span></li>)}</ul></details>
      )}
      {job.sources?.length > 0 && (
        <details><summary>{t('owner.outreach.job.sources')} ({job.sources.length})</summary><ul>{job.sources.map((s: any) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.title || s.url}</a> <span className="oc-muted">· {s.publisher} · {t('owner.outreach.tier')} {s.tier}</span></li>)}</ul></details>
      )}
      <div className="flex gap-2" style={{ marginTop: 8 }}>
        {running && <button type="button" className="btn btn-sm btn-secondary" onClick={async () => setJob(await outreachApi.cancelJob(jobId))}>{t('owner.cancel')}</button>}
        {job.status === 'READY_FOR_REVIEW' && <button type="button" className="btn btn-sm btn-primary" onClick={async () => { setJob(await outreachApi.completeJob(jobId)); onDone?.() }}>{t('owner.outreach.job.mark_reviewed')}</button>}
      </div>
    </div>
  )
}
