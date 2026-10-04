import { useEffect, useMemo, useRef, useState } from 'react'
import './DecisionComparisonWorkspace.css'

type Candidate = { id: string; name: string }
type Criterion = { id: string; name: string; groupId?: string; weight: number; isMandatory?: boolean; gateType?: string }
type Score = { candidateId: string; rank?: number | null; overallScore: number; mandatoryGatesPassed: boolean; evidenceCoveragePercent: number }
type Cell = { id: string; candidateId: string; criterionId: string; status: string; score: number | null; weightedContribution: number | null; normalizedWeight: number | null; rationale?: string; strengths?: string[]; gaps?: string[]; risks?: string[]; clarificationQuestions?: string[]; evidenceIds: string[]; notApplicableJustification?: string; humanOverride?: { originalScore: number | null; newScore: number | null; justification: string } }
type Evidence = { id: string; snippet: string; sectionHeading?: string; pageNumber?: number; tenantObjectName?: string; externalSourceUrl?: string; document?: { label?: string; fileName?: string } }
type Details = { cells: Cell[]; evidence: Evidence[]; reconciliation: { candidateId: string; matchesSavedScore: boolean }[] }
type Props = { id: string; candidates: Candidate[]; criteria?: Criterion[]; groups?: { id: string; name: string }[]; scores: Score[]; assessment: { outcome?: string; executiveRationale?: string; recommendedCandidateId?: string }; api: { get: (url: string) => Promise<any>; post: (url: string, body: any) => Promise<any> }; isAR: boolean }
const EMPTY: Details = { cells: [], evidence: [], reconciliation: [] }
const labels: Record<string, [string, string]> = {
  PASS: ['Pass', 'مستوفى'], PARTIAL: ['Partial', 'مستوفى جزئياً'], FAIL: ['Fail', 'غير مستوفى'], MISSING_EVIDENCE: ['Missing evidence', 'أدلة غير متوفرة'], NOT_APPLICABLE: ['Not applicable', 'غير منطبق'], NOT_ASSESSED: ['Not assessed', 'لم يُقيّم'],
  RECOMMENDED: ['Recommended', 'موصى به'], RECOMMENDED_WITH_CONDITIONS: ['Recommended with conditions', 'موصى به بشروط'], NO_CLEAR_WINNER: ['No clear winner', 'لا يوجد مرشح متفوق بوضوح'], INSUFFICIENT_EVIDENCE: ['Insufficient evidence', 'الأدلة غير كافية'], NO_QUALIFIED_CANDIDATE: ['No qualified candidate', 'لا يوجد مرشح مؤهل'],
}
export function safeEvidenceUrl(value?: string) { try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined } catch { return undefined } }
export default function DecisionComparisonWorkspace({ id, candidates = [], criteria = [], groups = [], scores = [], assessment, api, isAR }: Props) {
  const tr = (en: string, ar: string) => isAR ? ar : en
  const label = (value: string) => labels[value]?.[isAR ? 1 : 0] || value.replace(/_/g, ' ')
  const num = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat(isAR ? 'ar' : 'en', { maximumFractionDigits: 1 }).format(value)
  const [details, setDetails] = useState<Details>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [filter, setFilter] = useState('all')
  const detailRef = useRef<HTMLElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const [selected, setSelected] = useState<Cell | null>(null)
  useEffect(() => { if (selected) { detailRef.current?.focus(); detailRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }) } }, [selected])
  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [variation, setVariation] = useState(10)
  const [sensitivity, setSensitivity] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [sensitivityError, setSensitivityError] = useState(false)
  useEffect(() => {
    if (!scores.length) return
    let active = true
    setLoading(true); setError(''); setDetails(EMPTY); setSelected(null)
    api.get(`/decision-evaluation/${id}/comparison-details`).then(data => {
      if (active) setDetails({ cells: data.cells || [], evidence: data.evidence || [], reconciliation: data.reconciliation || [] })
    }).catch(() => { if (active) setError('load') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id, api, scores, retry])
  const ordered = useMemo(() => [...scores].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity)), [scores])
  const name = (candidateId: string) => candidates.find(c => c.id === candidateId)?.name || tr('Unavailable candidate', 'مرشح غير متوفر')
  const cell = (candidateId: string, criterionId: string) => details.cells.find(c => c.candidateId === candidateId && c.criterionId === criterionId)
  const eligible = ordered.filter(s => s.mandatoryGatesPassed)
  const left = first || eligible[0]?.candidateId || ordered[0]?.candidateId || ''
  const right = second || eligible.find(s => s.candidateId !== left)?.candidateId || ordered.find(s => s.candidateId !== left)?.candidateId || ''
  const reconciled = [left, right].every(candidateId => details.reconciliation.some(r => r.candidateId === candidateId && r.matchesSavedScore))
  const pairEligible = [left, right].every(candidateId => scores.some(s => s.candidateId === candidateId && s.mandatoryGatesPassed))
  const drivers = criteria.map(c => { const a = cell(left, c.id), b = cell(right, c.id); return { criterion: c, a, b, delta: (a?.weightedContribution ?? 0) - (b?.weightedContribution ?? 0) } }).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  const visible = criteria.filter(c => {
    const cells = candidates.map(candidate => cell(candidate.id, c.id))
    return (!group || c.groupId === group) && c.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
      (filter === 'all' || (filter === 'gates' && c.gateType === 'BLOCKING') ||
        (filter === 'evidence' && cells.some(v => !v || ['MISSING_EVIDENCE', 'NOT_ASSESSED'].includes(v.status))) ||
        (filter === 'differences' && new Set(cells.map(v => `${v?.status || 'NOT_ASSESSED'}:${v?.score ?? ''}`)).size > 1))
  })
  async function runSensitivity() {
    setBusy(true); setSensitivityError(false); setSensitivity(null)
    try { setSensitivity(await api.post(`/decision-evaluation/${id}/sensitivity`, { variationPercent: variation })) }
    catch { setSensitivityError(true) } finally { setBusy(false) }
  }
  if (!scores.length) return <div className="dc-panel">{tr('Comparison not computed yet. Run the assessment, then click "Compute Comparison".', 'لم يتم احتساب المقارنة بعد. شغّل التقييم ثم اضغط "احتساب المقارنة".')}</div>
  return <div className="dc-workspace" dir={isAR ? 'rtl' : 'ltr'}>
    <section className="dc-panel dc-decision">
      <div className="dc-eyebrow">{tr('DECISION AT A GLANCE', 'القرار في لمحة')}</div>
      <h2>{assessment.outcome ? label(assessment.outcome) : tr('Comparison results', 'نتائج المقارنة')}</h2>
      {assessment.recommendedCandidateId && <strong><bdi>{name(assessment.recommendedCandidateId)}</bdi></strong>}
      {assessment.executiveRationale && <p dir="auto">{assessment.executiveRationale}</p>}
      <p className="dc-muted">{tr('Saved scores and ranking. Mandatory gates determine eligibility; evidence coverage describes support, not technical merit.', 'النتائج والترتيب المحفوظان. تحدد البوابات الإلزامية الأهلية، وتعكس تغطية الأدلة مستوى الدعم وليست الجودة الفنية.')}</p>
    </section>
    <div className="dc-scorecards">{ordered.map(s => <section className="dc-panel" key={s.candidateId}>
      <div className="dc-eyebrow">{s.rank != null ? `${tr('Rank', 'الترتيب')} ${num(s.rank)}` : tr('Unranked', 'غير مصنّف')}</div>
      <h3><bdi>{name(s.candidateId)}</bdi></h3><div className="dc-total"><bdi dir="ltr">{num(s.overallScore)}<small> / {num(100)}</small></bdi></div>
      <div className={`dc-status ${s.mandatoryGatesPassed ? 'dc-pass' : 'dc-fail'}`}>{s.mandatoryGatesPassed ? tr('Mandatory gates passed', 'اجتاز البوابات الإلزامية') : tr('Mandatory gates failed', 'لم يجتز البوابات الإلزامية')}</div>
      <div className="dc-coverage">{tr('Evidence coverage', 'تغطية الأدلة')} <strong>{num(s.evidenceCoveragePercent)}%</strong></div>
      <progress max={100} value={s.evidenceCoveragePercent} aria-label={`${name(s.candidateId)} ${tr('evidence coverage', 'تغطية الأدلة')}`} />
    </section>)}</div>
    {loading && <p role="status">{tr('Loading criterion evidence…', 'جارٍ تحميل أدلة المعايير…')}</p>}
    {error && <div role="alert" className="dc-panel">{tr('Criterion details could not be loaded. Saved scores remain available.', 'تعذّر تحميل تفاصيل المعايير. تبقى النتائج المحفوظة متاحة.')} <button onClick={() => setRetry(v => v + 1)}>{tr('Retry', 'إعادة المحاولة')}</button></div>}
    {!loading && !error && <>
      <section className="dc-panel">
        <h2>{tr('Compare every criterion', 'مقارنة جميع المعايير')}</h2>
        <p className="dc-muted">{tr('Select a score to inspect its rationale, evidence and clarification questions. Scores are out of 5; missing evidence is never displayed as zero.', 'اختر نتيجة للاطلاع على مبرراتها وأدلتها وأسئلة الاستيضاح. النتائج من 5، ولا تُعرض الأدلة المفقودة كنتيجة صفرية.')}</p>
        <div className="dc-controls">
          <label htmlFor="dc-search">{tr('Search criteria', 'البحث في المعايير')}<input id="dc-search" value={search} onChange={e => setSearch(e.target.value)} /></label>
          <label htmlFor="dc-group">{tr('Criterion group', 'مجموعة المعايير')}<select id="dc-group" value={group} onChange={e => setGroup(e.target.value)}><option value="">{tr('All groups', 'جميع المجموعات')}</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
          <label htmlFor="dc-filter">{tr('Show', 'عرض')}<select id="dc-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{tr('All criteria', 'جميع المعايير')}</option><option value="differences">{tr('Differences', 'الاختلافات')}</option><option value="evidence">{tr('Needs evidence', 'تحتاج إلى أدلة')}</option><option value="gates">{tr('Mandatory gates', 'البوابات الإلزامية')}</option></select></label>
        </div>
        <div className="dc-scroll" tabIndex={0} role="region" aria-label={tr('Criterion comparison matrix', 'مصفوفة مقارنة المعايير')}><table><thead><tr><th scope="col">{tr('Criterion / weight', 'المعيار / الوزن')}</th>{candidates.map(c => <th scope="col" key={c.id}><bdi>{c.name}</bdi></th>)}</tr></thead><tbody>{visible.map(c => <tr key={c.id}><th scope="row"><span dir="auto">{c.name}</span><small>{num(c.weight)}% {c.gateType === 'BLOCKING' && ` · ${tr('Gate', 'بوابة إلزامية')}`}</small></th>{candidates.map(candidate => { const value = cell(candidate.id, c.id); return <td key={candidate.id}>{value ? <button className={`dc-cell dc-${value.status.toLowerCase()}`} onClick={e => { triggerRef.current = e.currentTarget; setSelected(value) }} aria-label={`${candidate.name}: ${c.name} — ${label(value.status)}`}><strong><bdi dir="ltr">{['MISSING_EVIDENCE', 'NOT_ASSESSED', 'NOT_APPLICABLE'].includes(value.status) ? '—' : `${num(value.score)} / ${num(5)}`}</bdi></strong><span>{label(value.status)}</span><small>{tr('Sources', 'المصادر')}: {num(value.evidenceIds.length)}</small></button> : <span className="dc-muted">{label('NOT_ASSESSED')}</span>}</td> })}</tr>)}</tbody></table></div>
        {!visible.length && <p role="status">{tr('No criteria match these filters.', 'لا توجد معايير تطابق عوامل التصفية.')}</p>}
      </section>
      {selected && <section ref={detailRef} tabIndex={-1} className="dc-panel dc-detail" aria-label={tr('Criterion details', 'تفاصيل المعيار')}>
        <button className="dc-close" onClick={() => { setSelected(null); triggerRef.current?.focus() }}>{tr('Close details', 'إغلاق التفاصيل')}</button>
        <div className="dc-eyebrow"><bdi>{name(selected.candidateId)}</bdi></div><h2 dir="auto">{criteria.find(c => c.id === selected.criterionId)?.name}</h2>
        <p>{label(selected.status)} · {tr('Normalized weight', 'الوزن بعد إعادة التوزيع')}: {num(selected.normalizedWeight)}% · {tr('Weighted contribution', 'المساهمة المرجّحة')}: {num(selected.weightedContribution)}</p>
        <p className="dc-muted">{tr('Contributions use the saved scoring formula. Not-applicable criteria are excluded and remaining weights are normalized.', 'تُحسب المساهمات وفق معادلة التقييم المعتمدة. تُستبعد المعايير غير المنطبقة وتُعاد موازنة الأوزان المتبقية.')}</p>
        <p dir="auto">{selected.rationale}</p>{selected.notApplicableJustification && <p dir="auto">{selected.notApplicableJustification}</p>}
        <div className="dc-detail-grid">{([['strengths', tr('Strengths', 'نقاط القوة')], ['gaps', tr('Gaps', 'الفجوات')], ['risks', tr('Risks', 'المخاطر')], ['clarificationQuestions', tr('Clarification questions', 'أسئلة الاستيضاح')]] as const).map(([key, title]) => selected[key]?.length ? <div key={key}><h3>{title}</h3><ul>{selected[key]!.map((v, i) => <li key={i} dir="auto">{v}</li>)}</ul></div> : null)}</div>
        {selected.humanOverride && <div><h3>{tr('Reviewer adjustment', 'تعديل المراجع')}</h3><p><bdi dir="ltr">{num(selected.humanOverride.originalScore)} → {num(selected.humanOverride.newScore)}</bdi></p><p dir="auto">{selected.humanOverride.justification}</p></div>}
        <h3>{tr('Cited evidence', 'الأدلة المستشهد بها')}</h3><p className="dc-muted">{tr('Verbatim source excerpts retain their original language.', 'تُعرض مقتطفات المصادر حرفياً بلغتها الأصلية.')}</p>
        {!selected.evidenceIds.length && <p>{tr('No evidence linked to this assessment.', 'لا توجد أدلة مرتبطة بهذا التقييم.')}</p>}
        {details.evidence.filter(e => selected.evidenceIds.includes(e.id)).map(e => <article className="dc-evidence" key={e.id}><strong dir="auto">{e.document?.label || e.document?.fileName || e.tenantObjectName || tr('Source', 'المصدر')}</strong><div><bdi>{e.sectionHeading}</bdi> {e.pageNumber != null && ` · ${tr('Page', 'الصفحة')} ${num(e.pageNumber)}`}</div><blockquote dir="auto">{e.snippet}</blockquote>{safeEvidenceUrl(e.externalSourceUrl) && <a href={safeEvidenceUrl(e.externalSourceUrl)} target="_blank" rel="noopener noreferrer">{tr('Open source', 'فتح المصدر')}</a>}</article>)}
      </section>}
      {candidates.length > 1 && <section className="dc-panel"><h2>{tr('What drives the score difference?', 'ما الذي يفسّر فرق النتائج؟')}</h2><div className="dc-controls">{[[left, setFirst, 'first', tr('First candidate', 'المرشح الأول')], [right, setSecond, 'second', tr('Second candidate', 'المرشح الثاني')]].map(([value, setter, key, title]: any) => <label key={key} htmlFor={`dc-${key}`}>{title}<select id={`dc-${key}`} value={value} onChange={e => setter(e.target.value)}>{candidates.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>)}</div>
        {left === right ? <p>{tr('Choose two different candidates.', 'اختر مرشحين مختلفين.')}</p> : !reconciled ? <p role="status">{tr('Score explanations require an up-to-date comparison. Compute Comparison after assessment changes.', 'يتطلب تفسير النتائج مقارنة محدّثة. اضغط احتساب المقارنة بعد تعديل التقييم.')}</p> : <><p className="dc-muted">{tr('Contribution differences in score points, first candidate minus second. These explain the total, not a new recommendation. Missing or excluded scores are identified separately.', 'الفروق في المساهمات بنقاط النتيجة، المرشح الأول ناقص الثاني. تفسّر هذه الفروق الإجمالي ولا تمثل توصية جديدة. تُميّز النتائج المفقودة أو المستبعدة بصورة منفصلة.')}</p>{!pairEligible && <p>{tr('A candidate failed mandatory gates. A higher technical score does not establish eligibility.', 'لم يجتز أحد المرشحين البوابات الإلزامية. لا تعني النتيجة الفنية الأعلى تحقق الأهلية.')}</p>}
        <p className="dc-gap">{tr('Saved score difference', 'الفرق بين النتيجتين المحفوظتين')}: <bdi dir="ltr">{num((scores.find(s => s.candidateId === left)?.overallScore ?? 0) - (scores.find(s => s.candidateId === right)?.overallScore ?? 0))}</bdi> {tr('points', 'نقاط')}</p><div className="dc-scroll"><table><thead><tr><th>{tr('Criterion', 'المعيار')}</th><th><bdi>{name(left)}</bdi></th><th><bdi>{name(right)}</bdi></th><th>{tr('Difference', 'الفرق')}</th></tr></thead><tbody>{drivers.map(d => <tr key={d.criterion.id}><th scope="row">{d.criterion.name}{(d.a?.weightedContribution == null || d.b?.weightedContribution == null) && <small>{tr('Includes missing or excluded score', 'يتضمن نتيجة مفقودة أو مستبعدة')}</small>}</th><td>{num(d.a?.weightedContribution)}</td><td>{num(d.b?.weightedContribution)}</td><td><bdi dir="ltr">{d.delta > 0 ? '+' : ''}{num(d.delta)}</bdi></td></tr>)}</tbody></table></div></>}
      </section>}
    </>}
    <section className="dc-panel"><h2>{tr('Sensitivity Analysis', 'تحليل الحساسية')}</h2><p className="dc-muted">{tr('Vary one criterion weight at a time to test ranking stability. This does not change your baseline or decision.', 'اختبر استقرار الترتيب بتغيير وزن معيار واحد في كل مرة. لا يغيّر ذلك خط الأساس أو القرار.')}</p><div className="dc-controls"><label htmlFor="dc-variation">{tr('Weight variation', 'نسبة تغيير الوزن')}<select id="dc-variation" value={variation} onChange={e => { setVariation(Number(e.target.value)); setSensitivity(null) }}>{[5, 10, 20].map(v => <option key={v} value={v}>±{v}%</option>)}</select></label><button disabled={busy} onClick={runSensitivity}>{busy ? tr('Running…', 'جارٍ التشغيل…') : isAR ? <>تشغيل <bdi dir="ltr">(±{variation}%)</bdi></> : `Run (±${variation}%)`}</button></div>
      {sensitivityError && <p role="alert">{tr('Sensitivity analysis could not be completed. Please retry.', 'تعذّر إكمال تحليل الحساسية. يرجى إعادة المحاولة.')}</p>}
      {sensitivity && <div role="status"><h3>{sensitivity.rankingEverChanges ? tr('Ranking is sensitive to weight changes', 'الترتيب حسّاس لتغييرات الوزن') : tr('Ranking is stable', 'الترتيب مستقر')}</h3><p>{tr('Within the tested variation only; this is not a guarantee under all scenarios.', 'ضمن نطاق التغيير المختبر فقط؛ لا يضمن ذلك الاستقرار في جميع السيناريوهات.')}</p>{sensitivity.scenarios?.filter((s: any) => s.rankingChanged).map((s: any, i: number) => <div className="dc-scenario" key={i}><strong>{criteria.find(c => c.id === s.adjustedCriterionId)?.name || tr('Criterion', 'معيار')}</strong> · <span>{s.direction === 'up' ? tr('Weight increased', 'زيادة الوزن') : tr('Weight decreased', 'خفض الوزن')}</span><ol>{s.resultingRanking.map((candidateId: string) => <li key={candidateId}><bdi>{name(candidateId)}</bdi></li>)}</ol></div>)}</div>}
    </section>
  </div>
}
