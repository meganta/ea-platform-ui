import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { exportFileName } from '../lib/exportFileName'
import { fetchStudyExport, saveBlob, ExportProgress } from '../lib/studyExport'
import { RECOMMENDATION_LABEL, STUDY_STATUS_LABEL } from './studyLabels'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

/**
 * An Innovation study the Chief Architect prepared, refreshed or found in
 * Copilot. While the study is being generated the card follows its progress;
 * once ready it offers the study's own Word and PowerPoint exports (in the
 * reader's language) and a link to it in the Innovation module. Everything
 * comes from the stored study - nothing is re-generated here.
 */
export interface CopilotStudyAttachment {
  kind: 'STUDY'
  id: string
  studyId: string
  title: string
  titleAr: string | null
  action: 'STARTED' | 'REFRESHING' | 'EXISTING'
  status: string
  recommendation: string | null
  includeImpactAnalysis: boolean
  authorType: string
  createdAt: string
}

export function isStudyAttachment(a: any): a is CopilotStudyAttachment {
  return !!a && a.kind === 'STUDY' && typeof a.studyId === 'string' && a.studyId.length > 0
}

const GENERATING = 'AI_RESEARCH'
export const STUDY_POLL_MS = 6000
// Generation is several AI stages; stop following after this long.
const MAX_FOLLOW_MS = 25 * 60 * 1000
// Generation starts a moment after the study is created; a just-requested
// study may still read DRAFT on the first fetches.
const START_GRACE_MS = 45 * 1000
const DONE_SECTION_STATES = new Set(['AI_DRAFT', 'UNDER_REVIEW', 'APPROVED'])

type Phase = 'generating' | 'ready' | 'failed'

export function studyPhase(study: { status: string; sections?: any[] } | null, a: CopilotStudyAttachment, elapsedMs: number): Phase {
  const status = study?.status ?? a.status
  if (status === GENERATING) return 'generating'
  const justRequested = a.action !== 'EXISTING'
  const anyDone = (study?.sections || []).some(s => DONE_SECTION_STATES.has(s.status))
  if (status === 'DRAFT' && justRequested) {
    // Still starting, or the generation stopped (it puts the study back to DRAFT).
    return elapsedMs < START_GRACE_MS && !anyDone ? 'generating' : 'failed'
  }
  if (status === 'DRAFT' && !anyDone) return 'failed'
  return 'ready'
}

export default function CopilotStudyCard({ attachment: a }: { attachment: CopilotStudyAttachment }) {
  const { t, isAR } = useLang()
  const [study, setStudy] = useState<any>(null)
  const [busy, setBusy] = useState<'docx' | 'pptx' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState<ExportProgress | null>(null)
  const startedAt = useRef(Date.now())
  const [now, setNow] = useState(Date.now())

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/innovation/studies/${encodeURIComponent(a.studyId)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` } })
      if (res.ok) setStudy(await res.json())
    } catch { /* keep the last known state; the next poll retries */ }
    setNow(Date.now())
  }, [a.studyId])

  useEffect(() => { load() }, [load])

  const phase = studyPhase(study, a, now - startedAt.current)
  useEffect(() => {
    if (phase !== 'generating' || now - startedAt.current > MAX_FOLLOW_MS) return
    const timer = setTimeout(load, STUDY_POLL_MS)
    return () => clearTimeout(timer)
  }, [phase, now, load])

  const title = (isAR && (study?.titleAr || a.titleAr)) || study?.title || a.title
  const status = study?.status ?? a.status
  const recommendation = study?.recommendation ?? a.recommendation
  const sections: any[] = study?.sections || []
  const done = sections.filter(s => DONE_SECTION_STATES.has(s.status)).length
  const lang = isAR ? 'ar' : 'en'

  const download = async (format: 'docx' | 'pptx') => {
    setBusy(format); setError(null)
    try {
      const blob = await fetchStudyExport(`${API}/innovation/studies/${encodeURIComponent(a.studyId)}/export/${format}?lang=${lang}`, localStorage.getItem('ea_token'), {
        onPreparing: p => setPreparing(p), fallbackMessage: t('copilot.study.export_failed'),
      })
      saveBlob(blob, exportFileName(title, 'Innovation_Study', lang, format))
    } catch (e: any) {
      setError(e?.message || t('copilot.study.export_failed'))
    } finally {
      setBusy(null); setPreparing(null)
    }
  }

  const btn = (primary: boolean) => ({
    fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
    background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--navy)' : 'var(--text)',
    border: primary ? '1px solid var(--accent)' : '1px solid var(--border)', fontWeight: primary ? 600 : 400,
  })

  return (
    <div data-testid="copilot-study-card" dir={isAR ? 'rtl' : 'ltr'} style={{ marginTop: 8, padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--navy-light)', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>📑 {title}</span>
        <HelpTip text={t('copilot.study.help')} />
        {a.authorType === 'COPILOT' && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 999, background: 'rgba(56,189,248,0.15)', color: '#38bdf8' }}>{t('copilot.study.by_copilot')}</span>}
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>
        {STUDY_STATUS_LABEL[status] ? (isAR ? STUDY_STATUS_LABEL[status].ar : STUDY_STATUS_LABEL[status].en) : status}
        {a.includeImpactAnalysis ? ` · ${t('copilot.study.with_impact')}` : ''}
        {recommendation && phase === 'ready' ? ` · ${t('copilot.study.recommendation')}: ${RECOMMENDATION_LABEL[recommendation] ? (isAR ? RECOMMENDATION_LABEL[recommendation].ar : RECOMMENDATION_LABEL[recommendation].en) : recommendation}` : ''}
      </div>

      {phase === 'generating' && (
        <div role="status" style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11.5 }}>{a.action === 'REFRESHING' ? t('copilot.study.refreshing') : t('copilot.study.generating')}</div>
          {sections.length > 0 && (
            <>
              <div style={{ height: 6, borderRadius: 4, background: 'var(--border)', marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: `${Math.round((done / sections.length) * 100)}%`, height: '100%', background: 'var(--accent)' }} />
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 3 }}>{done} / {sections.length} {t('copilot.study.sections_ready')}</div>
            </>
          )}
        </div>
      )}

      {phase === 'failed' && <div role="alert" style={{ fontSize: 11.5, color: '#f97316', marginTop: 8 }}>{t('copilot.study.failed')}</div>}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {phase === 'ready' && (
          <>
            <button type="button" style={btn(true)} disabled={busy !== null} onClick={() => download('docx')}>
              {busy === 'docx' ? t('copilot.study.preparing') : `⬇ ${t('copilot.study.download_word')}`}
            </button>
            <button type="button" style={btn(false)} disabled={busy !== null} onClick={() => download('pptx')}>
              {busy === 'pptx' ? t('copilot.study.preparing') : `📊 ${t('copilot.study.download_pptx')}`}
            </button>
          </>
        )}
        <a href={`/innovation?study=${encodeURIComponent(a.studyId)}`} target="_blank" rel="noopener noreferrer" style={btn(false)}>↗ {t('copilot.study.open')}</a>
      </div>
      {preparing && <div role="status" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>{t('copilot.study.export_preparing')}{preparing.total ? ` (${Math.min(preparing.translated, preparing.total)}/${preparing.total})` : ''}</div>}
      {error && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>{error}</div>}
    </div>
  )
}
