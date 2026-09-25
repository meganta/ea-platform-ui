import { useCallback, useEffect, useMemo, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useAuth } from '../../contexts/AuthContext'
import { ReportsPanel } from './Insights'

// Business Capability Assessments (Phase 2): list + detail (results,
// validation, approval, publication) and the 9-step Assess Maturity wizard.
// Scores shown here are computed deterministically on the server; the UI
// never calculates or adjusts a maturity score.

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

export async function api(method: string, path: string, body?: any) {
  const res = await fetch(`${API}${path}`, {
    method, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const m = data?.message
    throw new Error(typeof m === 'string' ? m : m?.message || (Array.isArray(m) ? m.join('; ') : `HTTP ${res.status}`))
  }
  return data
}

type LFn = (en: string, ar: string) => string
const BASE = '/business-capabilities/assessments'

const STATUS: Record<string, [string, string]> = {
  DRAFT: ['Draft', 'مسودة'], SURVEY_DESIGN: ['Survey design', 'تصميم الاستبيان'], OPEN: ['Open', 'مفتوح'], RESPONSES_RECEIVED: ['Responses received', 'تم استلام ردود'],
  ANALYSIS: ['Analysis', 'تحليل'], VALIDATION: ['Validation', 'تحقق'], APPROVAL: ['Awaiting approval', 'بانتظار الاعتماد'], PUBLISHED: ['Published', 'منشور'], ARCHIVED: ['Archived', 'مؤرشف'],
}
const RESULT: Record<string, [string, string]> = {
  CALCULATED: ['Calculated', 'محسوبة'], INSUFFICIENT_COVERAGE: ['Insufficient responses', 'ردود غير كافية'], FLAGGED_FOR_VALIDATION: ['Respondents disagree', 'تباين بين المستجيبين'], VALIDATED: ['Validated', 'تم التحقق'],
}

export function AssessmentsPanel({ L, isAR, can }: { L: LFn; isAR: boolean; can: { assess: boolean; validate: boolean; approve: boolean; publish: boolean } }) {
  const [list, setList] = useState<any[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [wizard, setWizard] = useState(false)
  const [resumeId, setResumeId] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { api('GET', BASE).then(setList).catch(e => setError(e.message)) }, [])
  useEffect(() => { load() }, [load])

  if (wizard) return <AssessWizard L={L} isAR={isAR} resumeId={resumeId} onClose={(id) => { setWizard(false); setResumeId(undefined); load(); setOpenId(id ?? null) }} />
  if (openId) return <AssessmentDetail id={openId} L={L} isAR={isAR} can={can} onBack={() => { setOpenId(null); load() }} onResume={() => { setResumeId(openId); setOpenId(null); setWizard(true) }} />
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        {can.assess && <button className="btn btn-primary btn-sm" onClick={() => setWizard(true)}>{L('Assess maturity', 'تقييم النضج')}</button>}
        <HelpTip text={L('Scores come only from submitted responses and verified evidence. Nothing updates your capabilities until an assessment is approved and published.', 'تُحسب الدرجات من الردود المقدمة والأدلة المتحقق منها فقط. لا تتغير القدرات إلا بعد اعتماد التقييم ونشره.')} />
      </div>
      {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
      {!list ? <div style={{ color: 'var(--text-dim)' }}>{L('Loading…', 'جارٍ التحميل…')}</div> : !list.length ? (
        <div style={{ padding: 24, border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-dim)', fontSize: 13, textAlign: 'center' }}>{L('No assessments yet.', 'لا توجد تقييمات بعد.')}</div>
      ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--navy-mid)' }}>
              {[L('Assessment', 'التقييم'), L('Status', 'الحالة'), L('Capabilities', 'القدرات'), L('Created', 'تاريخ الإنشاء')].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'start', fontSize: 11, color: 'var(--text-dim)' }}>{h}</th>)}
            </tr></thead>
            <tbody>{list.map(a => (
              <tr key={a.id} onClick={() => setOpenId(a.id)} style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}>
                <td style={{ padding: '8px 10px' }}>{(isAR && a.nameAr) || a.name}</td>
                <td style={{ padding: '8px 10px' }}><span className="badge badge-draft">{STATUS[a.status] ? L(STATUS[a.status][0], STATUS[a.status][1]) : a.status}</span></td>
                <td style={{ padding: '8px 10px' }}>{a._count?.scope ?? 0}</td>
                <td style={{ padding: '8px 10px' }}>{String(a.createdAt).slice(0, 10)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AssessmentDetail({ id, L, isAR, can, onBack, onResume }: { id: string; L: LFn; isAR: boolean; can: { assess: boolean; validate: boolean; approve: boolean; publish: boolean }; onBack: () => void; onResume?: () => void }) {
  const { user } = useAuth()
  const [a, setA] = useState<any>(null)
  const [progress, setProgress] = useState<any>(null)
  const [caps, setCaps] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<any[] | null>(null)
  const [resetNotice, setResetNotice] = useState<number>(0)
  const [reassessed, setReassessed] = useState<string | null>(null)
  const [reminded, setReminded] = useState<number | null>(null)
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  useEffect(() => { api('GET', '/users').then((u: any) => { const list = Array.isArray(u) ? u : u?.users || u?.items || []; setUserNames(Object.fromEntries(list.map((x: any) => [x.id, x.name || x.fullName || x.email]))) }).catch(() => undefined) }, [])
  const load = useCallback(async () => {
    try {
      const p = await api('GET', `${BASE}/${id}/progress`)
      setProgress(p); setA(p.assessment)
    } catch (e: any) { setError(e.message) }
  }, [id])
  useEffect(() => { load(); api('GET', '/business-capabilities/capabilities').then((cs: any[]) => setCaps(Object.fromEntries(cs.map(c => [c.id, (isAR && c.nameAr) || c.name])))).catch(() => undefined) }, [load, isAR])

  const act = async (fn: () => Promise<any>) => { setBusy(true); setError(null); try { const r = await fn(); if (r?.report) setReport(r.report); if (typeof r?.validationsReset === 'number') setResetNotice(r.validationsReset); await load() } catch (e: any) { setError(e.message) } finally { setBusy(false) } }
  if (!a) return <div>{error ? <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div> : L('Loading…', 'جارٍ التحميل…')}</div>
  const submitted = (progress?.assignments || []).filter((x: any) => x.status === 'SUBMITTED').length

  return (
    <div>
      <button className="btn btn-secondary btn-sm" onClick={onBack}>← {L('Assessments', 'التقييمات')}</button>
      <div style={{ margin: '12px 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 16 }}>{(isAR && a.nameAr) || a.name}</strong>
        <span className="badge badge-draft" data-testid="assessment-status">{STATUS[a.status] ? L(STATUS[a.status][0], STATUS[a.status][1]) : a.status}</span>
        {['OPEN', 'RESPONSES_RECEIVED'].includes(a.status) && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{submitted}/{progress?.assignments?.length ?? 0} {L('respondents submitted', 'مستجيبين أرسلوا')}</span>}
      </div>
      {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {can.assess && ['OPEN', 'RESPONSES_RECEIVED', 'VALIDATION'].includes(a.status) && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => {
          const validated = (a.results || []).filter((r: any) => r.status === 'VALIDATED').length
          if (a.status === 'VALIDATION' && validated > 0 && !window.confirm(L(`Recalculating replaces the results. ${validated} validation decision(s) will be cleared and must be made again. Continue?`, `إعادة الحساب تستبدل النتائج، وسيُلغى ${validated} من قرارات التحقق ويجب إعادتها. متابعة؟`))) return
          act(() => api('POST', `${BASE}/${id}/analyze`))
        }}>{a.status === 'VALIDATION' ? L('Recalculate', 'إعادة الحساب') : L('Close survey and analyze', 'إغلاق الاستبيان والتحليل')}</button>}
        {can.validate && a.status === 'VALIDATION' && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => api('POST', `${BASE}/${id}/submit-for-approval`))}>{L('Submit for approval', 'إرسال للاعتماد')}</button>}
        {can.approve && a.status === 'APPROVAL' && !a.approvedAt && (a.createdBy === user?.userId
          ? <span data-testid="needs-other-approver" style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>{L('You created this assessment, so another authorized approver must approve it.', 'أنشأت هذا التقييم، لذا يجب أن يعتمده معتمد آخر مخوّل.')}</span>
          : <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => act(() => api('POST', `${BASE}/${id}/approve`))}>{L('Approve', 'اعتماد')}</button>)}
        {['DRAFT', 'SURVEY_DESIGN'].includes(a.status) && (can.assess && onResume
          ? <button className="btn btn-primary btn-sm" data-testid="continue-setup" disabled={busy} onClick={onResume}>{L('Continue setup', 'متابعة الإعداد')}</button>
          : <span style={{ fontSize: 12, color: 'var(--text-dim)', alignSelf: 'center' }}>{L('This assessment is still being set up.', 'هذا التقييم لا يزال قيد الإعداد.')}</span>)}
        {can.assess && ['OPEN', 'RESPONSES_RECEIVED'].includes(a.status) && a.surveyId && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(async () => { const r = await api('POST', `/surveys/${a.surveyId}/remind`, {}); setReminded(r?.reminded ?? 0) })}>{L('Send reminder', 'إرسال تذكير')}</button>}
        {can.assess && !['PUBLISHED', 'ARCHIVED'].includes(a.status) && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { if (window.confirm(L('Archive this assessment? It cannot be continued afterwards.', 'أرشفة هذا التقييم؟ لا يمكن متابعته بعد ذلك.'))) act(() => api('POST', `${BASE}/${id}/archive`, {})) }}>{L('Archive', 'أرشفة')}</button>}
        {can.assess && a.status === 'PUBLISHED' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => act(async () => { const r = await api('POST', `${BASE}/${id}/reassess`, {}); setReassessed(r?.assessment?.id ?? null) })}>{L('Create reassessment', 'إنشاء إعادة تقييم')}</button>}
        {reassessed && <span role="status" data-testid="reassessment-created" style={{ fontSize: 12, alignSelf: 'center' }}>{L('Reassessment created in survey design. Previous results are context only; nothing is copied as an answer.', 'أُنشئت إعادة التقييم في مرحلة تصميم الاستبيان. النتائج السابقة سياق فقط ولا تُنسخ كإجابات.')}</span>}
        {can.approve && a.status === 'APPROVAL' && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => { const note = window.prompt(L('Reason for sending back', 'سبب الإعادة')); if (note) act(() => api('POST', `${BASE}/${id}/send-back`, { note })) }}>{L('Send back', 'إعادة للتحقق')}</button>}
        {can.publish && a.status === 'APPROVAL' && a.approvedAt && <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { if (window.confirm(L('Publishing updates the current maturity of the assessed capabilities. Continue?', 'النشر يحدّث مستوى النضج الحالي للقدرات. متابعة؟'))) act(() => api('POST', `${BASE}/${id}/publish`)) }}>{L('Publish results', 'نشر النتائج')}</button>}
      </div>
      {resetNotice > 0 && <div role="status" data-testid="validations-reset" style={{ fontSize: 13, padding: 10, marginBottom: 12, borderRadius: 6, border: '1px solid var(--warning)' }}>{L(`Results were recalculated. ${resetNotice} earlier validation decision(s) no longer apply - please validate these results again.`, `أُعيد حساب النتائج. لم تعد ${resetNotice} من قرارات التحقق السابقة سارية - يرجى التحقق من النتائج مجدداً.`)}</div>}
      {report && (
        <div data-testid="publication-report" style={{ fontSize: 12, marginBottom: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 6 }}>
          {report.map((r: any) => <div key={r.capabilityAssetId}>{caps[r.capabilityAssetId] || r.capabilityAssetId}: {r.projected.length ? L('updated', 'تم التحديث') : L('not updated', 'لم يُحدَّث')}{r.reason ? ` - ${r.reason}` : ''}</div>)}
        </div>
      )}
      {a.status === 'VALIDATION' && can.validate && (a.results || []).some((r: any) => (r.varianceFlags || []).length) && <ConsensusWorkspace id={id} L={L} onChange={load} />}
      {reminded != null && <div role="status" style={{ fontSize: 12, marginBottom: 8 }}>{L(`Reminder sent to ${reminded} respondent(s) who have not submitted.`, `أُرسل تذكير إلى ${reminded} من المستجيبين الذين لم يرسلوا.`)}</div>}
      {['DRAFT', 'SURVEY_DESIGN'].includes(a.status) && (
        <div data-testid="setup-summary" style={{ fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{L('Setup progress', 'تقدم الإعداد')}</div>
          <div>{(a.scope || []).length ? '✓' : '○'} {L('Capabilities in scope', 'القدرات ضمن النطاق')}: {(a.scope || []).length}</div>
          <div>{a.surveyId ? '✓' : '○'} {L('Questionnaire generated', 'تم إنشاء الاستبيان')}</div>
          <div>○ {L('Respondents assigned and launched', 'تعيين المستجيبين والإطلاق')}</div>
        </div>
      )}
      {['OPEN', 'RESPONSES_RECEIVED'].includes(a.status) && (progress?.assignments || []).length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 12 }}>
          <table data-testid="respondent-progress" style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'start' }}>{L('Respondent', 'المستجيب')}</th><th style={{ textAlign: 'start' }}>{L('Role', 'الدور')}</th><th style={{ textAlign: 'start' }}>{L('Status', 'الحالة')}</th></tr></thead>
            <tbody>{progress.assignments.map((x: any) => (
              <tr key={x.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td>{userNames[x.respondentUserId] || L('User', 'مستخدم')}</td><td>{x.role || '—'}</td>
                <td>{x.status === 'SUBMITTED' ? L('Submitted', 'تم الإرسال') : x.status === 'IN_PROGRESS' ? L('In progress', 'قيد الإجابة') : L('Not started', 'لم يبدأ')}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {a.status === 'PUBLISHED' && a.recommendedNextAssessmentAt && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{L('Recommended next assessment', 'التقييم التالي الموصى به')}: {String(a.recommendedNextAssessmentAt).slice(0, 10)}</div>}
      {['PUBLISHED', 'APPROVAL', 'VALIDATION'].includes(a.status) && <ReportsPanel L={L} assessmentId={id} />}
      {(a.results || []).length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {a.results.map((r: any) => <ResultCard key={r.id} r={r} name={caps[r.capabilityAssetId] || r.capabilityAssetId} L={L} canValidate={can.validate && a.status === 'VALIDATION'} onValidate={(body) => act(() => api('POST', `${BASE}/${id}/results/${r.id}/validate`, body))} />)}
        </div>
      )}
    </div>
  )
}

function ResultCard({ r, name, L, canValidate, onValidate }: { r: any; name: string; L: LFn; canValidate: boolean; onValidate: (b: any) => void }) {
  const [score, setScore] = useState<string>('')
  const [note, setNote] = useState('')
  const flagged = r.status === 'FLAGGED_FOR_VALIDATION'
  const shown = r.finalScore ?? r.evidenceAdjustedScore
  const adjusted = r.rawScore != null && r.evidenceAdjustedScore != null && r.rawScore !== r.evidenceAdjustedScore
  return (
    <section aria-label={name} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, borderInlineStart: `3px solid ${flagged ? 'var(--warning)' : r.status === 'INSUFFICIENT_COVERAGE' ? 'var(--text-dim)' : 'var(--success)'}` }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <strong>{name}</strong>
        <span className="badge badge-draft">{RESULT[r.status] ? L(RESULT[r.status][0], RESULT[r.status][1]) : r.status}</span>
        <span style={{ fontSize: 13 }}>{L('Maturity', 'النضج')}: <strong data-testid="result-score">{shown == null ? '—' : shown}</strong>{flagged && shown != null ? ` (${L('provisional', 'مؤقت')})` : ''}</span>
        {r.targetMaturity != null && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Target', 'المستهدف')}: {r.targetMaturity}</span>}
        {r.previousScore != null && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Previous', 'السابق')}: {r.previousScore}</span>}
        {r.coverage != null && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Coverage', 'التغطية')}: {Math.round(r.coverage * 100)}%</span>}
      </div>
      {adjusted && <div data-testid="evidence-adjusted" style={{ fontSize: 12, marginTop: 6 }}>{L(`Claimed ${r.rawScore}; adjusted to ${r.evidenceAdjustedScore} because some claims lack verified evidence.`, `المُدّعى ${r.rawScore}؛ عُدِّل إلى ${r.evidenceAdjustedScore} لعدم التحقق من بعض الأدلة.`)}</div>}
      {(r.varianceFlags || []).length > 0 && (
        <div style={{ fontSize: 12, marginTop: 6, color: 'var(--warning)' }}>
          {r.varianceFlags.map((f: any) => <div key={f.dimension}>{f.dimension}: {L('scores range', 'الدرجات من')} {Math.min(...f.respondentScores.map((x: any) => x.score).filter((x: any) => x != null))}–{Math.max(...f.respondentScores.map((x: any) => x.score).filter((x: any) => x != null))} ({L('threshold', 'الحد')} {f.threshold})</div>)}
        </div>
      )}
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12 }}>{L('Dimensions', 'الأبعاد')}</summary>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6, marginTop: 6, fontSize: 12 }}>
          {(r.dimensionScores || []).map((d: any) => <div key={d.code}>{d.code}: <strong>{d.adjustedScore == null ? '—' : Math.round(d.adjustedScore * 100) / 100}</strong>{d.flagged ? ' ⚠' : ''}</div>)}
        </div>
      </details>
      {r.validationNote && <div style={{ fontSize: 12, marginTop: 6, color: 'var(--text-dim)' }}>{L('Validation note', 'ملاحظة التحقق')}: {r.validationNote}</div>}
      {canValidate && r.status !== 'VALIDATED' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {flagged && <input aria-label={L('Agreed score', 'الدرجة المتفق عليها')} className="form-input" style={{ width: 90 }} type="number" step="0.1" min={1} max={5} value={score} onChange={e => setScore(e.target.value)} placeholder={L('Agreed', 'متفق')} />}
          <input aria-label={L('Validation note', 'ملاحظة التحقق')} className="form-input" style={{ flex: 1, minWidth: 180 }} value={note} onChange={e => setNote(e.target.value)} placeholder={L('Validation note (required)', 'ملاحظة التحقق (مطلوبة)')} />
          <button className="btn btn-secondary btn-sm" disabled={!note.trim() || (flagged && !score)} onClick={() => onValidate({ note, ...(flagged ? { finalScore: Number(score) } : {}) })}>{L('Validate', 'تحقق')}</button>
        </div>
      )}
    </section>
  )
}

// ── 9-step Assess Maturity wizard ──────────────────────────────────────────
const STEPS: Array<[string, string]> = [['Details', 'التفاصيل'], ['Scope', 'النطاق'], ['Framework', 'الإطار'], ['Dimensions', 'الأبعاد'], ['Target maturity', 'النضج المستهدف'], ['Respondents', 'المستجيبون'], ['Questionnaire', 'الاستبيان'], ['Review', 'المراجعة'], ['Launch', 'الإطلاق']]

export function AssessWizard({ L, isAR, onClose, resumeId }: { L: LFn; isAR: boolean; onClose: (id?: string) => void; resumeId?: string }) {
  const [step, setStep] = useState(0)
  const [filter, setFilter] = useState('')
  const [resuming, setResuming] = useState(!!resumeId)
  const [details, setDetails] = useState({ name: '', description: '' })
  const [caps, setCaps] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [frameworks, setFrameworks] = useState<any[]>([])
  const [frameworkId, setFrameworkId] = useState<string>('')
  const [assessment, setAssessment] = useState<any>(null)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [dims, setDims] = useState<Record<string, Set<string>>>({})
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<any[]>([])
  const [respondents, setRespondents] = useState<Array<{ userId: string; role: string }>>([])
  const [questionnaire, setQuestionnaire] = useState<any>(null)
  const [survey, setSurvey] = useState<any>(null)
  const [aiDrafts, setAiDrafts] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('GET', '/business-capabilities/capabilities').then((c: any) => setCaps(Array.isArray(c) ? c : c?.items || [])).catch(() => setCaps([]))
    api('GET', `${BASE}/frameworks`).then((fs: any) => { const list = Array.isArray(fs) ? fs : []; setFrameworks(list); if (list[0]) setFrameworkId(id => id || list[0].id) }).catch(() => setFrameworks([]))
    api('GET', '/users').then((u: any) => setUsers(Array.isArray(u) ? u : u?.users || u?.items || [])).catch(() => setUsers([]))
  }, [])

  // Resume an assessment that is still being set up (DRAFT / SURVEY_DESIGN): restore everything already saved on the server.
  useEffect(() => {
    if (!resumeId) return
    ;(async () => {
      try {
        const a = await api('GET', `${BASE}/${resumeId}`)
        if (!['DRAFT', 'SURVEY_DESIGN'].includes(a?.status)) { onClose(resumeId); return }
        setAssessment(a)
        setDetails({ name: a.name || '', description: a.description || '' })
        setFrameworkId(a.frameworkId)
        const scope: any[] = Array.isArray(a.scope) ? a.scope : []
        setSelected(new Set(scope.map(x => x.capabilityAssetId)))
        setTargets(Object.fromEntries(scope.filter(x => x.targetMaturity != null).map(x => [x.capabilityAssetId, String(x.targetMaturity)])))
        if (!scope.length) { setStep(1); return }
        const sug = await api('POST', `${BASE}/${a.id}/scope/suggest`, { capabilityIds: scope.map(x => x.capabilityAssetId) })
        setSuggestions(Array.isArray(sug) ? sug : [])
        setDims(Object.fromEntries(scope.map(x => [x.capabilityAssetId, new Set<string>(x.dimensionCodes || [])])))
        if (a.surveyId) {
          const sv = await api('GET', `/surveys/${a.surveyId}`)
          setSurvey(sv)
          setQuestionnaire({ surveyId: a.surveyId, questions: sv?.version?.questions?.length ?? 0 })
          setStep(5) // questionnaire exists: continue with respondents, then review and launch
        } else setStep(3) // scope saved: continue with dimensions
      } catch (e: any) { setError(e.message) } finally { setResuming(false) }
    })()
  }, [resumeId]) // eslint-disable-line react-hooks/exhaustive-deps
  const fw = frameworks.find(f => f.id === frameworkId)
  const capName = useCallback((id: string) => { const c = caps.find(x => x.id === id); return c ? (isAR && c.nameAr) || c.name : id }, [caps, isAR])
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(null); try { await fn() } catch (e: any) { setError(e.message) } finally { setBusy(false) } }

  const next = () => run(async () => {
    if (step === 0 && !details.name.trim()) throw new Error(L('Name is required', 'الاسم مطلوب'))
    if (step === 1 && !selected.size) throw new Error(L('Select at least one capability', 'اختر قدرة واحدة على الأقل'))
    if (step === 2) {
      if (!assessment && !frameworks.length) throw new Error(L('No maturity framework is available. Ask your administrator.', 'لا يتوفر إطار نضج. تواصل مع المسؤول.'))
      const a = assessment ?? await api('POST', BASE, { name: details.name, description: details.description || undefined, ...(frameworkId ? { frameworkId } : {}) })
      setAssessment(a)
      const s = await api('POST', `${BASE}/${a.id}/scope/suggest`, { capabilityIds: [...selected] })
      const list = Array.isArray(s) ? s : []
      setSuggestions(list)
      // keep dimension choices already made (resume / going back); suggest for newly added capabilities only
      setDims(prev => Object.fromEntries(list.map((x: any) => [x.capabilityAssetId, prev[x.capabilityAssetId] ?? new Set((x.suggestions || []).filter((d: any) => d.applicable).map((d: any) => d.code))])))
    }
    if (step === 4) {
      await api('PUT', `${BASE}/${assessment.id}/scope`, { scope: [...selected].map(id => ({ capabilityAssetId: id, dimensionCodes: [...(dims[id] || [])], targetMaturity: targets[id] ? Number(targets[id]) : null })) })
      // Scope (re)saved: any earlier questionnaire no longer matches - it must be generated again.
      if (questionnaire) { setQuestionnaire(null); setSurvey(null) }
    }
    if (step === 5 && !respondents.length) throw new Error(L('Add at least one respondent', 'أضف مستجيباً واحداً على الأقل'))
    if (step === 6 && !questionnaire) throw new Error(L('Generate the questionnaire first', 'أنشئ الاستبيان أولاً'))
    setStep(s => s + 1)
  })

  const generate = () => run(async () => {
    const q = await api('POST', `${BASE}/${assessment.id}/questionnaire`, { includeAiDrafts: aiDrafts })
    setQuestionnaire(q)
    setSurvey(await api('GET', `/surveys/${q.surveyId}`))
  })
  const review = (qid: string, decision: 'APPROVED' | 'REJECTED') => run(async () => {
    await api('POST', `/surveys/${questionnaire.surveyId}/questions/${qid}/review`, { decision })
    setSurvey(await api('GET', `/surveys/${questionnaire.surveyId}`))
  })
  const pendingAi = (survey?.version?.questions || []).filter((q: any) => q.source === 'AI_GENERATED' && q.reviewStatus !== 'APPROVED')
  const launch = () => run(async () => {
    if (pendingAi.length) throw new Error(L('Review all AI-drafted questions before launching', 'راجع جميع الأسئلة المقترحة آلياً قبل الإطلاق'))
    await api('POST', `${BASE}/${assessment.id}/launch`, { respondents })
    onClose(assessment.id)
  })

  const byCap = useMemo(() => {
    const m: Record<string, any[]> = {}
    for (const q of survey?.version?.questions || []) (m[q.subjectId || '-'] ||= []).push(q)
    return m
  }, [survey])

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>{L('Assess maturity', 'تقييم النضج')}</strong>
        <button className="btn btn-secondary btn-sm" onClick={() => onClose(assessment?.id)}>{L('Close', 'إغلاق')}</button>
      </div>
      <ol aria-label={L('Steps', 'الخطوات')} style={{ display: 'flex', gap: 6, listStyle: 'none', padding: 0, flexWrap: 'wrap', marginBottom: 16 }}>
        {STEPS.map(([en, ar], i) => <li key={en} aria-current={i === step ? 'step' : undefined} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 12, background: i === step ? 'var(--accent)' : 'var(--navy-mid)', color: i === step ? '#fff' : 'var(--text-dim)' }}>{i + 1}. {L(en, ar)}</li>)}
      </ol>
      {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
      {resuming && <div role="status" style={{ fontSize: 13, marginBottom: 8 }}>{L('Loading the saved assessment…', 'جارٍ تحميل التقييم المحفوظ…')}</div>}

      {step === 0 && (
        <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
          <label className="form-group"><span className="form-label">{L('Assessment name', 'اسم التقييم')}</span><input className="form-input" value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} /></label>
          <label className="form-group"><span className="form-label">{L('Purpose (optional)', 'الغرض (اختياري)')}</span><textarea className="form-input" rows={2} value={details.description} onChange={e => setDetails({ ...details, description: e.target.value })} /></label>
        </div>
      )}
      {step === 1 && (() => {
        const all = caps.filter(c => c.status !== 'DEPRECATED').sort((x, y) => String(x.name).localeCompare(String(y.name)))
        const q = filter.trim().toLowerCase()
        const shown = q ? all.filter(c => `${c.name} ${c.nameAr || ''}`.toLowerCase().includes(q)) : all
        const allShownSelected = shown.length > 0 && shown.every(c => selected.has(c.id))
        return (
          <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <input aria-label={L('Search capabilities', 'بحث في القدرات')} className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder={L('Search capabilities…', 'ابحث في القدرات…')} value={filter} onChange={e => setFilter(e.target.value)} />
              <button type="button" className="btn btn-secondary btn-sm" disabled={!shown.length || allShownSelected} onClick={() => setSelected(sel => { const n = new Set(sel); shown.forEach(c => n.add(c.id)); return n })}>{q ? L('Select all shown', 'تحديد كل المعروض') : L('Select all', 'تحديد الكل')}</button>
              <button type="button" className="btn btn-secondary btn-sm" disabled={!selected.size} onClick={() => setSelected(new Set())}>{L('Clear', 'مسح')}</button>
              <span data-testid="scope-count" style={{ fontSize: 12, color: 'var(--text-dim)' }}>{selected.size} / {all.length} {L('selected', 'محددة')}</span>
            </div>
            {selected.size > 50 && <div style={{ fontSize: 12, color: 'var(--warning)', marginBottom: 6 }}>{L('Large scopes create long questionnaires. Consider assessing in batches.', 'النطاقات الكبيرة تنتج استبيانات طويلة. يُفضل التقييم على دفعات.')}</div>}
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {shown.map(c => (
                <label key={c.id} style={{ display: 'flex', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                  <input type="checkbox" checked={selected.has(c.id)} onChange={() => setSelected(sel => { const n = new Set(sel); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n })} />{(isAR && c.nameAr) || c.name}
                </label>
              ))}
              {!all.length && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-dim)' }}>{L('No capabilities found. Create or adopt capabilities first.', 'لا توجد قدرات. أنشئ أو اعتمد قدرات أولاً.')}</div>}
              {!!all.length && !shown.length && <div style={{ padding: 12, fontSize: 13, color: 'var(--text-dim)' }}>{L('No capability matches your search.', 'لا توجد قدرة مطابقة للبحث.')}</div>}
            </div>
          </div>
        )
      })()}
      {step === 2 && (
        <div style={{ maxWidth: 640 }}>
          {!frameworks.length && <div role="alert" style={{ color: 'var(--warning)', fontSize: 13, marginBottom: 6 }}>{L('No maturity framework is available. Ask your administrator.', 'لا يتوفر إطار نضج. تواصل مع المسؤول.')}</div>}
          <select aria-label={L('Framework', 'الإطار')} className="form-input" value={frameworkId} onChange={e => setFrameworkId(e.target.value)} disabled={!!assessment}>
            {frameworks.map(f => <option key={f.id} value={f.id}>{(isAR && f.nameAr) || f.name} v{f.version}</option>)}
          </select>
          {fw && (
            <div style={{ fontSize: 12, marginTop: 10 }}>
              <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>{fw.description}</div>
              {(fw.levels || []).map((l: any) => <div key={l.level}><strong>{l.level} {(isAR && l.nameAr) || l.name}</strong> — {l.definition}</div>)}
              <div style={{ marginTop: 8 }} data-testid="framework-rules">
                {L(`Respondents disagreeing by more than ${fw.scoring?.varianceThreshold} level(s) are flagged for validation. At least ${Math.round((fw.scoring?.minimumCoverage ?? 0) * 100)}% of questions must be answered for a score.`, `يُحال التباين الأكبر من ${fw.scoring?.varianceThreshold} مستوى للتحقق. يلزم الإجابة على ${Math.round((fw.scoring?.minimumCoverage ?? 0) * 100)}% على الأقل من الأسئلة للحصول على درجة.`)}
                {fw.scoring?.evidenceGate?.enabled && ' ' + L('Claims at a level that requires evidence count one level lower until the evidence is verified.', 'الادعاءات التي تتطلب أدلة تُحتسب بمستوى أقل حتى يتم التحقق منها.')}
                {fw.scoring?.evidenceRequiredFromLevel && ' ' + L(`Verified evidence is required from level ${fw.scoring.evidenceRequiredFromLevel.critical} for critical capabilities and from level ${fw.scoring.evidenceRequiredFromLevel.default} otherwise. This is ArchMind's default configuration, not a universal maturity rule or an official CMMI requirement.`, `يلزم دليل متحقق منه من المستوى ${fw.scoring.evidenceRequiredFromLevel.critical} للقدرات الحرجة ومن المستوى ${fw.scoring.evidenceRequiredFromLevel.default} لغيرها. هذا إعداد افتراضي في ArchMind وليس قاعدة نضج عامة أو متطلباً رسمياً من CMMI.`)}
                {' ' + L(`Respondents are combined using the ${fw.scoring?.respondentAggregation === 'MEAN' ? 'mean' : 'median'}; disagreement is flagged regardless.`, `تُجمع الردود باستخدام ${fw.scoring?.respondentAggregation === 'MEAN' ? 'المتوسط' : 'الوسيط'}؛ ويُحال التباين للتحقق في جميع الأحوال.`)}
              </div>
            </div>
          )}
        </div>
      )}
      {step === 3 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {suggestions.map(s => (
            <section key={s.capabilityAssetId} aria-label={s.name} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10 }}>
              <strong style={{ fontSize: 13 }}>{capName(s.capabilityAssetId)}</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {s.suggestions.map((d: any) => {
                  const dim = (fw?.dimensions || []).find((x: any) => x.code === d.code)
                  return (
                    <label key={d.code} title={d.reasons.join('; ')} style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input type="checkbox" checked={!!dims[s.capabilityAssetId]?.has(d.code)} onChange={() => setDims(prev => { const n = new Set(prev[s.capabilityAssetId]); n.has(d.code) ? n.delete(d.code) : n.add(d.code); return { ...prev, [s.capabilityAssetId]: n } })} />
                      {dim ? (isAR && dim.nameAr) || dim.name : d.code}
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {step === 4 && (
        <div style={{ display: 'grid', gap: 6, maxWidth: 560 }}>
          {[...selected].map(id => (
            <label key={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, alignItems: 'center' }}>
              <span>{capName(id)}</span>
              <select aria-label={`${L('Target maturity', 'النضج المستهدف')} ${capName(id)}`} className="form-input" style={{ width: 200 }} value={targets[id] || ''} onChange={e => setTargets({ ...targets, [id]: e.target.value })}>
                <option value="">{L('— Not set —', '— غير محدد —')}</option>
                {(fw?.levels || []).map((l: any) => <option key={l.level} value={l.level}>{l.level} {(isAR && l.nameAr) || l.name}</option>)}
              </select>
            </label>
          ))}
        </div>
      )}
      {step === 5 && (
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{L('Respondents are users of your organization. Invite several roles so scores reflect more than one view.', 'المستجيبون من مستخدمي جهتكم. أشرك عدة أدوار لتعكس النتائج أكثر من رأي.')}</div>
          {respondents.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <select aria-label={L('Respondent', 'المستجيب')} className="form-input" value={r.userId} onChange={e => setRespondents(rs => rs.map((x, j) => (j === i ? { ...x, userId: e.target.value } : x)))}>
                <option value="">{L('— Select user —', '— اختر مستخدماً —')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.name || u.fullName || u.email}</option>)}
              </select>
              <select aria-label={L('Role', 'الدور')} className="form-input" style={{ width: 200 }} value={r.role} onChange={e => setRespondents(rs => rs.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}>
                {[['OWNER', 'Capability owner', 'مالك القدرة'], ['BUSINESS_SME', 'Business SME', 'خبير أعمال'], ['OPERATIONS', 'Operations', 'العمليات'], ['IT', 'IT', 'تقنية المعلومات'], ['DATA', 'Data', 'البيانات'], ['EA', 'Enterprise Architecture', 'البنية المؤسسية']].map(([v, en, ar]) => <option key={v} value={v}>{L(en, ar)}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" aria-label={L('Remove', 'إزالة')} onClick={() => setRespondents(rs => rs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => setRespondents(rs => [...rs, { userId: '', role: 'OWNER' }])}>+ {L('Add respondent', 'إضافة مستجيب')}</button>
        </div>
      )}
      {step === 6 && (
        <div>
          {!questionnaire ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={aiDrafts} onChange={e => setAiDrafts(e.target.checked)} />{L('Also suggest extra questions with AI (you review each one)', 'اقتراح أسئلة إضافية بالذكاء الاصطناعي (تراجع كل سؤال)')}</label>
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={generate}>{L('Generate questionnaire', 'إنشاء الاستبيان')}</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, marginBottom: 8 }}>{questionnaire.questions} {L('questions tailored to each capability', 'سؤالاً مخصصاً لكل قدرة')}{pendingAi.length ? ` · ${pendingAi.length} ${L('AI suggestions to review', 'اقتراحات آلية للمراجعة')}` : ''}</div>
              {Object.entries(byCap).map(([capId, qs]) => (
                <details key={capId} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 8, marginBottom: 6 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{capName(capId)} ({qs.length})</summary>
                  {qs.map((q: any) => (
                    <div key={q.id} style={{ fontSize: 12, padding: '4px 0', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ flex: 1, minWidth: 200 }}>{(isAR && q.textAr) || q.text}</span>
                      {q.evidenceRequirement === 'REQUIRED' && <span className="badge badge-review">{L('Evidence', 'دليل')}</span>}
                      {q.source === 'AI_GENERATED' && (q.reviewStatus === 'APPROVED'
                        ? <span className="badge badge-approved">{L('AI · approved', 'آلي · معتمد')}</span>
                        : q.reviewStatus === 'REJECTED' ? <span className="badge badge-draft">{L('Rejected', 'مرفوض')}</span>
                        : <span style={{ display: 'flex', gap: 4 }}><span className="badge badge-review">{L('AI suggestion', 'اقتراح آلي')}</span><button className="btn btn-secondary btn-sm" onClick={() => review(q.id, 'APPROVED')}>{L('Approve', 'اعتماد')}</button><button className="btn btn-secondary btn-sm" onClick={() => review(q.id, 'REJECTED')}>{L('Reject', 'رفض')}</button></span>)}
                    </div>
                  ))}
                </details>
              ))}
            </div>
          )}
        </div>
      )}
      {step === 7 && (
        <div style={{ fontSize: 13, display: 'grid', gap: 4 }} data-testid="wizard-review">
          <div><strong>{details.name}</strong> · {fw ? (isAR && fw.nameAr) || fw.name : ''}</div>
          <div>{selected.size} {L('capabilities', 'قدرات')} · {respondents.length} {L('respondents', 'مستجيبين')} · {questionnaire?.questions ?? 0} {L('questions', 'أسئلة')}</div>
          {pendingAi.length > 0 && <div style={{ color: 'var(--warning)' }}>{L(`${pendingAi.length} AI suggestions still need review.`, `${pendingAi.length} اقتراحات آلية بحاجة للمراجعة.`)}</div>}
        </div>
      )}
      {step === 8 && (
        <div style={{ fontSize: 13 }}>
          <p>{L('Launching locks the questionnaire and notifies nothing automatically; respondents will find it under My Surveys.', 'الإطلاق يقفل الاستبيان، وسيجده المستجيبون ضمن استبياناتي.')}</p>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={launch}>{L('Launch assessment', 'إطلاق التقييم')}</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        {step > 0 && step !== 8 && <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setStep(s => s - 1)}>{L('Back', 'السابق')}</button>}
        {step < 8 && <button className="btn btn-primary btn-sm" disabled={busy} onClick={next}>{L('Next', 'التالي')}</button>}
      </div>
    </div>
  )
}

// ── Consensus workspace (Phase 3): per flagged dimension ───────────────────
function ConsensusWorkspace({ id, L, onChange }: { id: string; L: LFn; onChange: () => void }) {
  const [data, setData] = useState<any>(null)
  const [form, setForm] = useState<Record<string, { score: string; rationale: string }>>({})
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const load = useCallback(() => api('GET', `${BASE}/${id}/consensus`).then(setData).catch(e => setMsg({ kind: 'err', text: e.message })), [id])
  useEffect(() => { load() }, [load])
  // Optional aid: never break the assessment view on an unexpected response.
  if (!data || !Array.isArray(data.items) || !data.items.length) return null
  const key = (i: any) => `${i.resultId}:${i.dimension}`
  const save = async (i: any) => {
    const f = form[key(i)] || { score: '', rationale: '' }
    setMsg(null)
    try {
      const r = await api('POST', `${BASE}/${id}/results/${i.resultId}/dimensions/validate`, { dimension: i.dimension, agreedScore: Number(f.score), rationale: f.rationale })
      setMsg({ kind: 'ok', text: r?.result ? L('All flagged dimensions agreed - the capability result is validated.', 'تم الاتفاق على جميع الأبعاد - تم التحقق من نتيجة القدرة.') : L('Agreed score recorded.', 'تم تسجيل الدرجة المتفق عليها.') })
      await load(); onChange()
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) }
  }
  return (
    <section aria-label={L('Consensus workspace', 'مساحة التوافق')} data-testid="consensus-workspace" style={{ border: '1px solid var(--warning)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{L('Consensus workspace', 'مساحة التوافق')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{L('Respondents disagree on these dimensions. Original answers are never changed; you record an agreed score within the evidence-supported range, with a rationale.', 'يختلف المستجيبون في هذه الأبعاد. لا تُعدَّل الإجابات الأصلية؛ تسجل درجة متفقاً عليها ضمن النطاق المدعوم بالأدلة مع المبرر.')}</div>
      {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 13, color: msg.kind === 'err' ? 'var(--danger)' : 'var(--success)', marginBottom: 6 }}>{msg.text}</div>}
      {data.items.map((i: any) => {
        const f = form[key(i)] || { score: '', rationale: '' }
        return (
          <div key={key(i)} data-testid={`consensus-${i.dimension}`} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <div style={{ fontSize: 13 }}><strong>{i.dimension}</strong> · {L('spread', 'التباين')} {i.spread} ({L('threshold', 'الحد')} {i.threshold}) · {L('provisional median', 'الوسيط المؤقت')} {i.provisionalMedian ?? '—'} · {L('previous', 'السابق')} {i.previousPublished ?? '—'} · {L('target', 'المستهدف')} {i.targetMaturity ?? '—'}</div>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', margin: '4px 0' }}>
              <thead><tr><th style={{ textAlign: 'start' }}>{L('Role', 'الدور')}</th><th style={{ textAlign: 'start' }}>{L('Claimed', 'المُدّعى')}</th><th style={{ textAlign: 'start' }}>{L('Evidence-adjusted', 'بعد الأدلة')}</th><th style={{ textAlign: 'start' }}>{L('Evidence', 'الأدلة')}</th><th style={{ textAlign: 'start' }}>{L('Comments', 'التعليقات')}</th></tr></thead>
              <tbody>{i.respondents.map((r: any) => (
                <tr key={r.assignmentId}><td>{r.role ?? '—'}</td><td>{r.rawScore ?? '—'}</td><td>{r.evidenceAdjustedScore ?? '—'}</td>
                  <td>{r.evidence.length ? r.evidence.map((e: any) => (e.verified ? '✓' : '✗')).join(' ') : '—'}</td><td>{r.comments.join(' | ') || '—'}</td></tr>
              ))}</tbody>
            </table>
            {i.validation ? <div style={{ fontSize: 12 }}>{L('Agreed', 'المتفق عليه')}: <strong>{i.validation.agreedScore}</strong> - {i.validation.rationale}</div> : null}
            {i.bounds && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <input aria-label={`${L('Agreed score', 'الدرجة المتفق عليها')} ${i.dimension}`} className="form-input" type="number" step="0.1" min={i.bounds.lower} max={i.bounds.upper} style={{ width: 90 }} value={f.score} placeholder={`${i.bounds.lower}-${i.bounds.upper}`} onChange={e => setForm({ ...form, [key(i)]: { ...f, score: e.target.value } })} />
                <input aria-label={`${L('Rationale', 'المبرر')} ${i.dimension}`} className="form-input" style={{ flex: 1, minWidth: 200 }} value={f.rationale} placeholder={L('Rationale (required)', 'المبرر (مطلوب)')} onChange={e => setForm({ ...form, [key(i)]: { ...f, rationale: e.target.value } })} />
                <button className="btn btn-secondary btn-sm" disabled={!f.score || !f.rationale.trim()} onClick={() => save(i)}>{i.validation ? L('Revise', 'تعديل') : L('Record agreement', 'تسجيل الاتفاق')}</button>
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}
