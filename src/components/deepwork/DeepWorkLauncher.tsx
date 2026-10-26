import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../HelpTip'
import DeepWorkCard from './DeepWorkCard'
import { DeepRun, deepWorkApi } from './deepWorkApi'
import './DeepWork.css'

interface Props {
  /** AI policy module: governance / adm / strategy */
  module: string
  /** Type the policy may set its own level for (review type, methodology stage, strategy type). */
  type?: string | null
  subjectType: string
  subjectId: string
  /** Title and help text keys of this lead review. */
  titleKey: string
  helpKey: string
  startKey: string
  /** Starts a run through the module's own route. Omit to only show past runs (no permission to start). */
  start?: () => Promise<DeepRun>
}

/**
 * A module's lead review panel: what depth the AI policy sets for it now (the
 * administrator decides, never the person), past runs on this subject, the
 * latest run followed live, and Start when the person may start one.
 */
export default function DeepWorkLauncher({ module, type, subjectType, subjectId, titleKey, helpKey, startKey, start }: Props) {
  const { t, isAR } = useLang()
  const [runs, setRuns] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [policy, setPolicy] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    deepWorkApi.list({ module, subjectType, subjectId }).then((rows: any[]) => { setRuns(rows); setSelected(s => s ?? rows[0]?.id ?? null) }).catch(() => setRuns([]))
    deepWorkApi.effective(module, type).then(setPolicy).catch(() => setPolicy(null))
  }, [module, type, subjectType, subjectId])
  useEffect(() => { load() }, [load])

  const onStart = async () => {
    if (!start) return
    setBusy(true); setError('')
    try {
      const run = await start()
      setRuns(r => [run, ...r])
      setSelected(run.id)
    } catch (e: any) {
      setError(e.code === 'AI_POLICY_BLOCKED' ? `${t('deepwork.blocked')}: ${e.message}` : e.message)
    } finally { setBusy(false) }
  }

  const minutes = policy?.profile ? Math.round(policy.profile.timeLimitSec / 60) : null
  return (
    <div className="dw-launcher" dir={isAR ? 'rtl' : 'ltr'} data-testid="deep-work-launcher">
      <div className="dw-launcher-head">
        <strong style={{ display: 'flex', alignItems: 'center' }}>{t(titleKey)}<HelpTip text={t(helpKey)} /></strong>
        {start && <button type="button" className="btn btn-sm btn-primary" disabled={busy || policy?.canRun === false} onClick={onStart}>{busy ? t('deepwork.starting') : t(startKey)}</button>}
      </div>
      {policy && (
        <div className="dw-launcher-note" data-testid="deep-work-policy">
          {policy.canRun
            ? t('deepwork.policy_note').replace('{level}', t(`aipolicy.level.${policy.level}`)).replace('{minutes}', String(minutes ?? '-'))
            : `${t('deepwork.blocked')}: ${policy.blockedReason || ''}`}
          {policy.profile?.leadRole === false && module !== 'copilot_deep' && <> {t('deepwork.no_lead_at_level')}</>}
        </div>
      )}
      {error && <div className="dw-error" role="alert">{error}</div>}
      {runs.length > 1 && (
        <div className="dw-history" role="list">
          {runs.map(r => (
            <button key={r.id} type="button" role="listitem" className={`btn btn-sm ${selected === r.id ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSelected(r.id)}>
              {new Date(r.createdAt).toISOString().slice(0, 10)} · {t(`deepwork.status.${r.status}`)}
            </button>
          ))}
        </div>
      )}
      {!runs.length && <div className="dw-launcher-note">{t('deepwork.none_yet')}</div>}
      {selected && <DeepWorkCard key={selected} runId={selected} onFinished={() => load()} />}
    </div>
  )
}
