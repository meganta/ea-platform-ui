import { useState } from 'react'
import HelpTip from '../../components/HelpTip'
import IdeaMatrix from './IdeaMatrix'
import {
  BENEFIT_TYPE, Bi, COST_BAND, CRITERION_LABEL, LEVEL, QUADRANT, RECOMMENDATION, RISK_CATEGORY, SIMILAR_KIND, SIZE,
  exposureColor, label, pickBi, riskExposure, scoreColor,
} from './ideaLabels'

/** Static text of the assessment view, English / Arabic. */
const UI: Record<string, Bi> = {
  recommendation: { en: 'AI recommendation', ar: 'توصية الذكاء الاصطناعي' },
  conditions: { en: 'Conditions', ar: 'الشروط' },
  mergeWith: { en: 'Merge with', ar: 'الدمج مع' },
  confidence: { en: 'Confidence', ar: 'درجة الثقة' },
  assessed: { en: 'Assessed', ar: 'تاريخ التقييم' },
  overall: { en: 'Weighted score', ar: 'الدرجة المرجّحة' },
  value: { en: 'Value', ar: 'القيمة' },
  ease: { en: 'Ease', ar: 'السهولة' },
  aiOverall: { en: 'AI score before reviewer adjustments', ar: 'درجة الذكاء الاصطناعي قبل تعديلات المراجع' },
  summary: { en: 'Executive summary', ar: 'الملخص التنفيذي' },
  problem: { en: 'Problem / opportunity', ar: 'المشكلة / الفرصة' },
  beneficiaries: { en: 'Target beneficiaries', ar: 'المستفيدون المستهدفون' },
  scorecard: { en: 'Assessment scorecard', ar: 'بطاقة التقييم' },
  scorecardHelp: { en: 'Eight weighted criteria from idea-gate best practice. Value criteria measure what the idea is worth; ease criteria measure how hard it is to deliver (for cost, risk and time a higher score means cheaper, safer and faster). The weighted score, the value / ease scores and the quadrant are calculated by the platform from these scores, not by the AI. Reviewers can adjust a score with a note; the AI score stays visible.', ar: 'ثمانية معايير مرجّحة وفق أفضل الممارسات في بوابة تقييم الأفكار. تقيس معايير القيمة ما تستحقه الفكرة، وتقيس معايير السهولة صعوبة تنفيذها (في التكلفة والمخاطر والوقت تعني الدرجة الأعلى تكلفة أقل ومخاطر أقل وسرعة أكبر). تحسب المنصة الدرجة المرجّحة ودرجتي القيمة والسهولة والربع من هذه الدرجات، لا الذكاء الاصطناعي. يمكن للمراجعين تعديل أي درجة مع ملاحظة، وتبقى درجة الذكاء الاصطناعي ظاهرة.' },
  weight: { en: 'weight', ar: 'الوزن' },
  aiScore: { en: 'AI', ar: 'الذكاء الاصطناعي' },
  adjust: { en: 'Adjust', ar: 'تعديل' },
  reviewerScore: { en: 'Reviewer score (0-100)', ar: 'درجة المراجع (0-100)' },
  reviewerNote: { en: 'Why (required)', ar: 'السبب (مطلوب)' },
  save: { en: 'Save', ar: 'حفظ' },
  cancel: { en: 'Cancel', ar: 'إلغاء' },
  restore: { en: 'Restore AI score', ar: 'استعادة درجة الذكاء الاصطناعي' },
  adjusted: { en: 'Adjusted by reviewer', ar: 'معدّلة من المراجع' },
  noteRequired: { en: 'Enter a score between 0 and 100 and a note explaining it.', ar: 'أدخل درجة بين 0 و100 وملاحظة توضّحها.' },
  swot: { en: 'SWOT analysis', ar: 'تحليل SWOT' },
  strengths: { en: 'Strengths', ar: 'نقاط القوة' },
  weaknesses: { en: 'Weaknesses', ar: 'نقاط الضعف' },
  opportunities: { en: 'Opportunities', ar: 'الفرص' },
  threats: { en: 'Threats', ar: 'التهديدات' },
  benefits: { en: 'Expected benefits', ar: 'الفوائد المتوقعة' },
  kpis: { en: 'Success measures (KPIs)', ar: 'مؤشرات النجاح' },
  kpi: { en: 'Indicator', ar: 'المؤشر' },
  target: { en: 'Target', ar: 'المستهدف' },
  risks: { en: 'Risk register', ar: 'سجل المخاطر' },
  risk: { en: 'Risk', ar: 'الخطر' },
  category: { en: 'Category', ar: 'الفئة' },
  likelihood: { en: 'Likelihood', ar: 'الاحتمالية' },
  impact: { en: 'Impact', ar: 'الأثر' },
  mitigation: { en: 'Mitigation', ar: 'إجراء التخفيف' },
  effort: { en: 'Effort and delivery', ar: 'الجهد والتنفيذ' },
  size: { en: 'Size', ar: 'الحجم' },
  cost: { en: 'Cost', ar: 'التكلفة' },
  timeframe: { en: 'Timeframe', ar: 'الإطار الزمني' },
  skills: { en: 'Skills needed', ar: 'المهارات المطلوبة' },
  strategy: { en: 'Strategy goals it advances', ar: 'الأهداف الاستراتيجية التي تدعمها' },
  eaImpact: { en: 'Affected EA Repository objects', ar: 'عناصر مستودع البنية المؤسسية المتأثرة' },
  eaImpactHelp: { en: 'Objects of your Current architecture the idea would change or depend on. Only objects that exist in your EA Repository are listed.', ar: 'عناصر البنية الحالية التي ستغيّرها الفكرة أو تعتمد عليها. تُعرض فقط العناصر الموجودة فعلاً في مستودع البنية المؤسسية.' },
  similar: { en: 'Similar existing items', ar: 'عناصر مشابهة قائمة' },
  overlap: { en: 'overlap', ar: 'تشابه' },
  assumptions: { en: 'Assumptions', ar: 'الافتراضات' },
  questions: { en: 'Open questions', ar: 'أسئلة مفتوحة' },
  nextSteps: { en: 'Recommended next steps', ar: 'الخطوات التالية المقترحة' },
  grounding: { en: 'What the assessment used', ar: 'ما استند إليه التقييم' },
  profile: { en: 'Organization profile', ar: 'ملف المؤسسة' },
  goals: { en: 'strategy goals', ar: 'أهداف استراتيجية' },
  objects: { en: 'EA Repository objects', ar: 'عناصر من مستودع البنية' },
  relatedTech: { en: 'Related technology', ar: 'التقنية ذات الصلة' },
  dataGaps: { en: 'Limitations', ar: 'القيود' },
  yes: { en: 'complete', ar: 'مكتمل' },
  no: { en: 'incomplete', ar: 'غير مكتمل' },
  none: { en: 'None identified.', ar: 'لم يُحدَّد شيء.' },
}

export function ui(key: string, isAR: boolean) { return label(UI, key, isAR) }

const card = { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, marginBottom: 14 }
const h = { fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 } as const
const chip = (c: string) => ({ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c, whiteSpace: 'nowrap' as const })
const th = { textAlign: 'start' as const, fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, padding: '6px 8px', borderBottom: '1px solid var(--border)' }
const td = { fontSize: 12.5, padding: '8px', borderBottom: '1px solid var(--border)', verticalAlign: 'top' as const }

function BiList({ items, isAR }: { items: Bi[] | undefined; isAR: boolean }) {
  if (!items || items.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{ui('none', isAR)}</div>
  return <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12.5, lineHeight: 1.6 }}>{items.map((x, i) => <li key={i}>{pickBi(x, isAR)}</li>)}</ul>
}

export interface IdeaAssessmentViewProps {
  assessment: any
  isAR: boolean
  canAdjust: boolean
  onAdjust?: (key: string, score: number | null, note?: string) => Promise<void>
  onOpenIdea?: (id: string) => void
  title?: string
}

export default function IdeaAssessmentView({ assessment: a, isAR, canAdjust, onAdjust, onOpenIdea, title }: IdeaAssessmentViewProps) {
  const rec = RECOMMENDATION[a.recommendation?.decision] || RECOMMENDATION.PROCEED_TO_STUDY
  const quadrant = QUADRANT[a.scores?.quadrant]
  const adjustedAny = (a.criteria || []).some((c: any) => c.reviewerScore != null)

  return (
    <div data-testid="idea-assessment">
      {/* Recommendation */}
      <div style={{ ...card, borderInlineStart: `4px solid ${rec.color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{ui('recommendation', isAR)}</span>
          <span style={chip(rec.color)} data-testid="idea-recommendation">{rec.icon} {isAR ? rec.ar : rec.en}</span>
          {a.confidence && <span style={chip('#7f8c8d')}>{ui('confidence', isAR)}: {label(LEVEL, a.confidence, isAR)}</span>}
          {a.assessedAt && <span style={{ fontSize: 11, color: 'var(--text-dim)', marginInlineStart: 'auto' }}>{ui('assessed', isAR)}: {new Date(a.assessedAt).toLocaleString(isAR ? 'ar-SA' : 'en-GB')}</span>}
        </div>
        {pickBi(a.recommendation?.rationale, isAR) && <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{pickBi(a.recommendation.rationale, isAR)}</div>}
        {a.recommendation?.conditions?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4 }}>{ui('conditions', isAR)}</div>
            <BiList items={a.recommendation.conditions} isAR={isAR} />
          </div>
        )}
        {a.recommendation?.mergeWith && (
          <div style={{ fontSize: 12, marginTop: 8 }}>
            {ui('mergeWith', isAR)}: <SimilarLink item={a.recommendation.mergeWith} isAR={isAR} onOpenIdea={onOpenIdea} />
          </div>
        )}
      </div>

      {/* Scores and matrix position */}
      <div style={card}>
        <div className="idea-overview">
          <div>
            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Score big value={a.scores?.overall} label={ui('overall', isAR)} />
              <Score value={a.scores?.value} label={ui('value', isAR)} />
              <Score value={a.scores?.ease} label={ui('ease', isAR)} />
            </div>
            {quadrant && (
              <div style={{ marginTop: 12, fontSize: 12.5 }}>
                <span style={chip(quadrant.color)} data-testid="idea-quadrant">{isAR ? quadrant.ar : quadrant.en}</span>{' '}
                <span style={{ color: 'var(--text-dim)' }}>{pickBi(quadrant.hint, isAR)}</span>
              </div>
            )}
            {adjustedAny && a.scores?.aiOverall != null && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>{ui('aiOverall', isAR)}: {a.scores.aiOverall}</div>
            )}
          </div>
          {a.scores && <IdeaMatrix compact isAR={isAR} points={[{ id: 'this', title: title || '', value: a.scores.value, ease: a.scores.ease, highlight: true }]} />}
        </div>
      </div>

      {/* Summary */}
      <div style={card}>
        <div style={h}>{ui('summary', isAR)}</div>
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>{pickBi(a.summary, isAR)}</div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <div><div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{ui('problem', isAR)}</div><div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{pickBi(a.problem, isAR) || '—'}</div></div>
          <div><div style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 600 }}>{ui('beneficiaries', isAR)}</div><div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{pickBi(a.targetBeneficiaries, isAR) || '—'}</div></div>
        </div>
      </div>

      {/* Scorecard */}
      <div style={card}>
        <div style={h}>{ui('scorecard', isAR)}<HelpTip text={ui('scorecardHelp', isAR)} /></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(a.criteria || []).map((c: any) => <CriterionRow key={c.key} c={c} isAR={isAR} canAdjust={canAdjust && !!onAdjust} onAdjust={onAdjust} />)}
        </div>
      </div>

      {/* SWOT */}
      <div style={card}>
        <div style={h}>{ui('swot', isAR)}</div>
        <div className="grid-2">
          {(['strengths', 'weaknesses', 'opportunities', 'threats'] as const).map(k => (
            <div key={k} style={{ padding: 12, borderRadius: 8, background: 'var(--navy)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: k === 'strengths' || k === 'opportunities' ? '#2ecc71' : '#f39c12' }}>{ui(k, isAR)}</div>
              <BiList items={a.swot?.[k]} isAR={isAR} />
            </div>
          ))}
        </div>
      </div>

      {/* Benefits + KPIs */}
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={h}>{ui('benefits', isAR)}</div>
          {a.benefits?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {a.benefits.map((b: any, i: number) => (
                <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}><span style={chip('#3498db')}>{label(BENEFIT_TYPE, b.type, isAR)}</span> {pickBi(b.text, isAR)}</div>
              ))}
            </div>
          ) : <BiList items={[]} isAR={isAR} />}
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={h}>{ui('kpis', isAR)}</div>
          {a.kpis?.length ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>{ui('kpi', isAR)}</th><th style={th}>{ui('target', isAR)}</th></tr></thead>
                <tbody>{a.kpis.map((k: any, i: number) => <tr key={i}><td style={td}>{pickBi(k.name, isAR)}</td><td style={td}>{pickBi(k.target, isAR)}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <BiList items={[]} isAR={isAR} />}
        </div>
      </div>

      {/* Risk register */}
      <div style={card}>
        <div style={h}>{ui('risks', isAR)}</div>
        {a.risks?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }} data-testid="idea-risks">
              <thead><tr><th style={th}>{ui('risk', isAR)}</th><th style={th}>{ui('category', isAR)}</th><th style={th}>{ui('likelihood', isAR)}</th><th style={th}>{ui('impact', isAR)}</th><th style={th}>{ui('mitigation', isAR)}</th></tr></thead>
              <tbody>
                {[...a.risks].sort((x: any, y: any) => riskExposure(y.likelihood, y.impact) - riskExposure(x.likelihood, x.impact)).map((r: any, i: number) => {
                  const e = riskExposure(r.likelihood, r.impact)
                  return (
                    <tr key={i}>
                      <td style={{ ...td, borderInlineStart: `3px solid ${exposureColor(e)}` }}>{pickBi(r.text, isAR)}</td>
                      <td style={td}>{label(RISK_CATEGORY, r.category, isAR)}</td>
                      <td style={td}>{label(LEVEL, r.likelihood, isAR)}</td>
                      <td style={td}>{label(LEVEL, r.impact, isAR)}</td>
                      <td style={td}>{pickBi(r.mitigation, isAR)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <BiList items={[]} isAR={isAR} />}
      </div>

      {/* Effort */}
      <div style={card}>
        <div style={h}>{ui('effort', isAR)}</div>
        <div className="stat-grid-3">
          <Fact label={ui('size', isAR)} value={label(SIZE, a.effort?.size, isAR)} />
          <Fact label={ui('cost', isAR)} value={label(COST_BAND, a.effort?.costBand, isAR)} />
          <Fact label={ui('timeframe', isAR)} value={pickBi(a.effort?.timeframe, isAR) || '—'} />
        </div>
        {a.effort?.skills?.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5 }}>
            <span style={{ color: 'var(--text-dim)' }}>{ui('skills', isAR)}: </span>
            {a.effort.skills.map((s: Bi) => pickBi(s, isAR)).join(isAR ? '، ' : ', ')}
          </div>
        )}
      </div>

      {/* Strategy + EA impact */}
      <div className="grid-2" style={{ marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={h}>{ui('strategy', isAR)}</div>
          {a.strategicLinks?.length ? a.strategicLinks.map((l: any) => (
            <div key={l.goalId} style={{ fontSize: 12.5, marginBottom: 8, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600 }}>🎯 {l.goal} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>· {l.strategy}</span></div>
              <div>{pickBi(l.contribution, isAR)}</div>
            </div>
          )) : <BiList items={[]} isAR={isAR} />}
        </div>
        <div style={{ ...card, marginBottom: 0 }}>
          <div style={h}>{ui('eaImpact', isAR)}<HelpTip text={ui('eaImpactHelp', isAR)} /></div>
          {a.eaImpact?.length ? a.eaImpact.map((o: any) => (
            <div key={o.assetId} style={{ fontSize: 12.5, marginBottom: 8, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600 }}>🧩 {o.name} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>· {o.type}</span></div>
              <div>{pickBi(o.impact, isAR)}</div>
            </div>
          )) : <BiList items={[]} isAR={isAR} />}
        </div>
      </div>

      {/* Questions / assumptions / next steps */}
      <div className="stat-grid-3" style={{ marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0 }}><div style={h}>{ui('nextSteps', isAR)}</div><BiList items={a.nextSteps} isAR={isAR} /></div>
        <div style={{ ...card, marginBottom: 0 }}><div style={h}>{ui('questions', isAR)}</div><BiList items={a.openQuestions} isAR={isAR} /></div>
        <div style={{ ...card, marginBottom: 0 }}><div style={h}>{ui('assumptions', isAR)}</div><BiList items={a.assumptions} isAR={isAR} /></div>
      </div>

      {a.similar?.length > 0 && (
        <div style={card}>
          <div style={h}>{ui('similar', isAR)}</div>
          {a.similar.map((s: any) => (
            <div key={`${s.kind}-${s.id}`} style={{ fontSize: 12.5, marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={chip('#7f8c8d')}>{label(SIMILAR_KIND, s.kind, isAR)}</span>
              <SimilarLink item={s} isAR={isAR} onOpenIdea={onOpenIdea} />
              <span style={{ color: 'var(--text-dim)' }}>{s.overlap}% {ui('overlap', isAR)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Grounding transparency */}
      <div style={{ ...card, background: 'transparent' }}>
        <div style={h}>{ui('grounding', isAR)}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
          {ui('profile', isAR)}: {a.context?.orgProfile ? ui('yes', isAR) : ui('no', isAR)} · {a.context?.strategyGoals ?? 0} {ui('goals', isAR)} · {a.context?.repositoryObjects ?? 0} {ui('objects', isAR)}
          {a.context?.relatedTechnology ? ` · ${ui('relatedTech', isAR)}: ${a.context.relatedTechnology}` : ''}
        </div>
        {a.dataGaps?.length > 0 && (
          <div style={{ marginTop: 8 }} role="note">
            <div style={{ fontSize: 11, fontWeight: 600, color: '#f39c12', marginBottom: 4 }}>⚠ {ui('dataGaps', isAR)}</div>
            <BiList items={a.dataGaps} isAR={isAR} />
          </div>
        )}
      </div>
    </div>
  )
}

function Score({ value, label: text, big = false }: { value: number | null | undefined; label: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: big ? 34 : 22, fontWeight: 700, color: scoreColor(value), lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{text}</div>
    </div>
  )
}

function Fact({ label: text, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 10, borderRadius: 8, background: 'var(--navy)', border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{text}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{value || '—'}</div>
    </div>
  )
}

function SimilarLink({ item, isAR, onOpenIdea }: { item: any; isAR: boolean; onOpenIdea?: (id: string) => void }) {
  if (item.kind === 'IDEA' && onOpenIdea) return <button type="button" onClick={() => onOpenIdea(item.id)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, fontSize: 12.5 }}>{item.title}</button>
  if (item.kind === 'STUDY') return <a href={`/innovation?study=${encodeURIComponent(item.id)}`} style={{ color: 'var(--accent)' }}>{item.title}</a>
  return <span>{item.title}</span>
}

function CriterionRow({ c, isAR, canAdjust, onAdjust }: { c: any; isAR: boolean; canAdjust: boolean; onAdjust?: IdeaAssessmentViewProps['onAdjust'] }) {
  const [editing, setEditing] = useState(false)
  const [score, setScore] = useState<string>(String(c.score ?? ''))
  const [note, setNote] = useState<string>(c.reviewerNote || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = label(CRITERION_LABEL, c.key, isAR) || pickBi(c.name, isAR)
  const adjusted = c.reviewerScore != null
  const scoreId = `crit-score-${c.key}`
  const noteId = `crit-note-${c.key}`

  const save = async (restore = false) => {
    const n = Number(score)
    if (!restore && (score.trim() === '' || !Number.isFinite(n) || n < 0 || n > 100 || !note.trim())) { setError(ui('noteRequired', isAR)); return }
    setBusy(true); setError(null)
    try { await onAdjust!(c.key, restore ? null : Math.round(n), restore ? undefined : note.trim()); setEditing(false) }
    catch (e: any) { setError(e?.message || 'Error') }
    finally { setBusy(false) }
  }

  return (
    <div data-testid={`criterion-${c.key}`}>
      <div className="idea-criterion">
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>
          {name} <span style={{ fontSize: 10.5, color: 'var(--text-dim)', fontWeight: 400 }}>· {ui('weight', isAR)} {c.weight}%</span>
        </div>
        <div className="idea-criterion-bar" style={{ height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden', position: 'relative' }} aria-hidden="true">
          <div style={{ width: `${c.score}%`, height: '100%', background: scoreColor(c.score) }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: scoreColor(c.score), minWidth: 26, textAlign: 'end' }}>{c.score}</span>
          {adjusted && <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }} title={ui('adjusted', isAR)}>({ui('aiScore', isAR)} {c.aiScore})</span>}
          {canAdjust && !editing && <button type="button" onClick={() => setEditing(true)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>{ui('adjust', isAR)}</button>}
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4 }}>
        {pickBi(c.rationale, isAR)}
        {c.confidence && <span> · {ui('confidence', isAR)}: {label(LEVEL, c.confidence, isAR)}</span>}
      </div>
      {adjusted && c.reviewerNote && <div style={{ fontSize: 12, marginTop: 4 }}>✍ {ui('adjusted', isAR)}: {c.reviewerNote}</div>}
      {editing && (
        <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy)' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ width: 120 }}>
              <label htmlFor={scoreId} style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block' }}>{ui('reviewerScore', isAR)}</label>
              <input id={scoreId} type="number" min={0} max={100} value={score} onChange={e => setScore(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }} />
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor={noteId} style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block' }}>{ui('reviewerNote', isAR)}</label>
              <input id={noteId} value={note} onChange={e => setNote(e.target.value)} style={{ width: '100%', padding: '6px 8px', background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }} />
            </div>
            <button type="button" disabled={busy} onClick={() => save(false)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--navy)', fontWeight: 600, cursor: 'pointer' }}>{ui('save', isAR)}</button>
            {adjusted && <button type="button" disabled={busy} onClick={() => save(true)} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>{ui('restore', isAR)}</button>}
            <button type="button" disabled={busy} onClick={() => { setEditing(false); setError(null) }} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer' }}>{ui('cancel', isAR)}</button>
          </div>
          {error && <div role="alert" style={{ fontSize: 11.5, color: '#e74c3c', marginTop: 6 }}>{error}</div>}
        </div>
      )}
    </div>
  )
}
