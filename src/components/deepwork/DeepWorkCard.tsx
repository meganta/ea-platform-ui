import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../HelpTip'
import { ACTIVE, DeepRun, EvidenceEntry, POLL_MS, deepWorkApi, runStage } from './deepWorkApi'
import './DeepWork.css'

const STAGE_COLOR: Record<string, string> = { QUEUED: 'var(--text-dim)', INVESTIGATING: 'var(--accent)', CHECKING: 'var(--warning)', LEAD: 'var(--gold, #c9a84c)', COMPLETED: 'var(--success)', FAILED: 'var(--danger)', CANCELLED: 'var(--text-dim)' }

/** A translated label, or the raw code when the platform has no label for it. */
function label(t: (k: string) => string, key: string, raw: string) {
  const v = t(key)
  return v === key ? raw.replace(/_/g, ' ').toLowerCase() : v
}

function EvidenceChip({ id, entry, open, onToggle }: { id: string; entry?: EvidenceEntry; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`dw-chip${entry?.error ? ' dw-chip-bad' : ''}${open ? ' active' : ''}`} onClick={onToggle} aria-expanded={open} title={entry ? `${entry.tool}${entry.sourceRef?.label ? ` - ${entry.sourceRef.label}` : ''}` : id}>{id}</button>
  )
}

/**
 * Follows one deep-work run (Copilot deep mode, Governance lead review, ADM
 * stage review, Strategy lead review): progress and spend while it runs (it
 * asks the server to take the next turns while the card is open), then the
 * result - summary, answer, findings with the evidence behind each, the lead
 * verdict, open questions and limits. Everything shown comes from the run.
 */
export default function DeepWorkCard({ runId, compact = false, resultInMessage = false, onFinished }: { runId: string; compact?: boolean; /** The answer is already the message text: show only the evidence and checks. */ resultInMessage?: boolean; onFinished?: (run: DeepRun) => void }) {
  const { t, isAR } = useLang()
  const [run, setRun] = useState<DeepRun | null>(null)
  const [error, setError] = useState('')
  const [openEvidence, setOpenEvidence] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(!compact)
  const [cancelling, setCancelling] = useState(false)
  const finished = useRef(false)

  const accept = useCallback((r: DeepRun) => {
    setRun(r)
    if (!ACTIVE.includes(r.status) && !finished.current) { finished.current = true; onFinished?.(r) }
  }, [onFinished])

  useEffect(() => {
    let stop = false
    let timer: any
    const step = async () => {
      try {
        const r = await deepWorkApi.get(runId)
        if (stop) return
        accept(r)
        if (ACTIVE.includes(r.status)) {
          const next = await deepWorkApi.advance(runId).catch(() => null)
          if (stop) return
          if (next) accept(next)
          timer = setTimeout(step, POLL_MS)
        }
      } catch (e: any) { if (!stop) setError(e.message) }
    }
    step()
    return () => { stop = true; clearTimeout(timer) }
  }, [runId, accept])

  const cancel = async () => {
    setCancelling(true)
    try { accept(await deepWorkApi.cancel(runId)) } catch (e: any) { setError(e.message) } finally { setCancelling(false) }
  }

  if (error && !run) return <div className="dw-card" role="alert" data-testid="deep-work-card">{t('deepwork.load_failed')}: {error}</div>
  if (!run) return <div className="dw-card" data-testid="deep-work-card"><span className="spinner" style={{ width: 14, height: 14, display: 'inline-block' }} /> {t('deepwork.loading')}</div>

  const stage = runStage(run)
  const active = ACTIVE.includes(run.status)
  const result = run.result
  const draft = result?.draft ?? run.draft
  const verdict = result?.verdict ?? run.verdict
  const limitations = result?.limitations ?? run.limitations ?? []
  const ledger = new Map((run.ledger || []).map(e => [e.id, e]))
  const shownEvidence = openEvidence ? ledger.get(openEvidence) : null
  const p = run.policy?.profile

  return (
    <div className="dw-card" dir={isAR ? 'rtl' : 'ltr'} data-testid="deep-work-card">
      <div className="dw-head">
        <span className="dw-icon" aria-hidden>🔎</span>
        <div className="dw-title">
          <strong>{run.title}</strong>
          <div className="dw-meta">
            <span className="dw-pill" style={{ color: STAGE_COLOR[stage], borderColor: STAGE_COLOR[stage] }} data-testid="deep-work-stage">{t(`deepwork.stage.${stage}`)}</span>
            <span>{t('deepwork.level')}: {label(t, `aipolicy.level.${run.level}`, run.level)}</span>
            <span>{t('deepwork.rounds').replace('{n}', String(run.steps)).replace('{max}', String(p?.maxSteps ?? '-'))}</span>
            <span>{t('deepwork.lookups').replace('{n}', String(run.toolCalls))}</span>
            <span data-testid="deep-work-cost">{run.costSar.toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR{run.unpricedTurns ? ` + ${t('deepwork.unpriced')}` : ''}</span>
          </div>
        </div>
        <HelpTip text={t('deepwork.help')} />
      </div>

      {active && (
        <div className="dw-progress">
          <div>{t(`deepwork.progress.${stage}`)}</div>
          <button type="button" className="btn btn-sm btn-secondary" disabled={cancelling} onClick={cancel}>{t('deepwork.cancel')}</button>
        </div>
      )}
      {run.status === 'FAILED' && <div className="dw-error" role="alert">{t('deepwork.failed')}{run.error ? `: ${run.error}` : ''}</div>}
      {error && run && <div className="dw-error" role="alert">{error}</div>}

      {draft && (
        <>
          {draft.summary && !resultInMessage && <p className="dw-summary"><strong>{t('deepwork.summary')}:</strong> {draft.summary}</p>}
          {verdict && !resultInMessage && (
            <div className="dw-verdict" data-testid="deep-work-verdict">
              <div><strong>{t('deepwork.verdict')}:</strong> <span className="dw-decision">{label(t, `deepwork.decision.${verdict.decision}`, verdict.decision)}</span> · {t('deepwork.confidence')}: {label(t, `deepwork.conf.${verdict.confidence}`, verdict.confidence)}</div>
              <div className="dw-text">{verdict.rationale}</div>
              {verdict.conditions.length > 0 && <><div className="dw-sub">{t('deepwork.conditions')}</div><ul>{verdict.conditions.map(c => <li key={c}>{c}</li>)}</ul></>}
              {verdict.dissent.length > 0 && <><div className="dw-sub">{t('deepwork.dissent')}</div><ul>{verdict.dissent.map(c => <li key={c}>{c}</li>)}</ul></>}
            </div>
          )}
          {compact && <button type="button" className="dw-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? t('deepwork.hide_detail') : resultInMessage ? t('deepwork.show_evidence') : t('deepwork.show_detail')}</button>}
          {expanded && (
            <>
              {draft.answer && !resultInMessage && <div className="dw-text dw-answer">{draft.answer}</div>}
              {draft.findings.length > 0 && (
                <>
                  <div className="dw-sub">{t('deepwork.findings')} ({draft.findings.length})</div>
                  <ol className="dw-findings">
                    {draft.findings.map((f, i) => (
                      <li key={i} className={f.unsupported ? 'dw-unsupported' : ''}>
                        {f.kind && <span className="dw-kind">{label(t, `deepwork.kind.${f.kind}`, f.kind)}</span>} {f.statement}
                        <span className="dw-chips">
                          {f.evidence.map(id => <EvidenceChip key={id} id={id} entry={ledger.get(id)} open={openEvidence === id} onToggle={() => setOpenEvidence(openEvidence === id ? null : id)} />)}
                          {f.unsupported && <span className="dw-flag">{t('deepwork.unsupported')}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {shownEvidence && (
                <div className="dw-evidence" data-testid="deep-work-evidence">
                  <div><strong>{shownEvidence.id}</strong> · {shownEvidence.tool}{shownEvidence.sourceRef?.label ? ` · ${shownEvidence.sourceRef.label}` : ''}</div>
                  <pre>{shownEvidence.summary.length > 1500 ? `${shownEvidence.summary.slice(0, 1500)}…` : shownEvidence.summary}</pre>
                </div>
              )}
              {draft.openQuestions.length > 0 && <><div className="dw-sub">{t('deepwork.open_questions')}</div><ul>{draft.openQuestions.map(q => <li key={q}>{q}</li>)}</ul></>}
              {limitations.length > 0 && <><div className="dw-sub">{t('deepwork.limits')}</div><ul className="dw-limits">{limitations.map(q => <li key={q}>{q}</li>)}</ul></>}
              <div className="dw-foot">{t('deepwork.checks').replace('{n}', String(run.critiques?.length ?? 0))} · {t('deepwork.evidence_count').replace('{n}', String(run.ledger?.length ?? 0))} · {run.model}</div>
            </>
          )}
        </>
      )}
    </div>
  )
}
