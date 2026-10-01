import React from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

/**
 * Strategic alignment for a governance review: the strategic score and one
 * card per business or digital strategy objective or pillar with its status,
 * the rationale, and the document statement it rests on. When the review did
 * not consider strategic alignment (the review type does not assess it, or no
 * strategy objective exists), a short note says so instead.
 */
export type AlignmentStatus = 'ALIGNED' | 'NOT_ALIGNED' | 'NOT_APPLICABLE'
export type StrategyKind = 'BUSINESS_STRATEGY' | 'DT_STRATEGY' | 'STRATEGY'
export interface StrategyAlignmentSection {
  source: 'REPOSITORY_STRUCTURED' | 'REPOSITORY_DOCUMENT' | 'KNOWLEDGE_BASE'
  sources: string[]
  strategies?: Array<{ name: string; kind: StrategyKind }>
  assessments: Array<{ objectiveId: string; objective: string; pillar?: string | null; isPillar?: boolean; strategyName?: string; strategyKind: StrategyKind; status: AlignmentStatus; rationale: string; evidence?: string | null }>
  unassessed?: Array<{ objective: string; reason: string }>
  counts: Record<AlignmentStatus, number>
  score: number | null
}

const STATUSES: AlignmentStatus[] = ['ALIGNED', 'NOT_ALIGNED', 'NOT_APPLICABLE']
const COLOR: Record<AlignmentStatus, string> = { ALIGNED: '#2ecc71', NOT_ALIGNED: '#e74c3c', NOT_APPLICABLE: '#64748B' }
const STATUS_LABEL: Record<AlignmentStatus, [string, string]> = {
  ALIGNED: ['Aligned', 'متوائم'], NOT_ALIGNED: ['Not aligned', 'غير متوائم'], NOT_APPLICABLE: ['Not applicable', 'غير منطبق'],
}
const KIND_LABEL: Record<StrategyKind, [string, string]> = {
  BUSINESS_STRATEGY: ['Business strategy', 'استراتيجية الأعمال'], DT_STRATEGY: ['Digital strategy', 'الاستراتيجية الرقمية'], STRATEGY: ['Strategy', 'الاستراتيجية'],
}
const SOURCE_LABEL: Record<StrategyAlignmentSection['source'], [string, string]> = {
  REPOSITORY_STRUCTURED: ['EA repository strategy register and objectives', 'سجل الاستراتيجيات والأهداف في مستودع البنية المؤسسية'],
  REPOSITORY_DOCUMENT: ['Strategy documents in the EA repository', 'وثائق الاستراتيجية في مستودع البنية المؤسسية'],
  KNOWLEDGE_BASE: ['EA knowledge base', 'قاعدة معرفة البنية المؤسسية'],
}

/** Whether a stored report was assessed against the strategy objectives (as opposed to the older free-form objectives). */
export const usesStrategyAlignment = (report: any): boolean => typeof report?.strategicAlignment?.considered === 'boolean'

export default function StrategyAlignmentPanel({ section, score }: { section: StrategyAlignmentSection | null | undefined; score: number | null | undefined }) {
  const { isAR } = useLang()
  const L = (pair: [string, string]) => (isAR ? pair[1] : pair[0])
  const title = L(['Strategic Alignment', 'المواءمة الاستراتيجية'])
  const help = L([
    'The solution is assessed against each objective and pillar of your business and digital strategy: aligned, not aligned or not applicable, always with the reason. Objectives come from the EA repository (strategy register and objective objects) first, then strategy documents uploaded to the repository, then the knowledge base. The score is the share of applicable objectives the solution is aligned with (business strategy weighted 40, digital 35, other 25); not-applicable objectives are left out.',
    'يُقيَّم الحل مقابل كل هدف وركيزة من أهداف استراتيجية الأعمال والاستراتيجية الرقمية: متوائم أو غير متوائم أو غير منطبق، مع ذكر السبب دائماً. تؤخذ الأهداف من مستودع البنية المؤسسية (سجل الاستراتيجيات وعناصر الأهداف) أولاً، ثم من وثائق الاستراتيجية المرفوعة في المستودع، ثم من قاعدة المعرفة. الدرجة هي نسبة الأهداف المنطبقة التي يتوائم معها الحل (الأوزان: استراتيجية الأعمال 40، الرقمية 35، غيرها 25)، وتُستبعد الأهداف غير المنطبقة.',
  ])
  const heading = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
      <h3 style={{ margin: 0, fontSize: 15 }}>{title}</h3>
      <HelpTip text={help} />
    </div>
  )

  if (!section || !Array.isArray(section.assessments) || section.assessments.length === 0) {
    return (
      <section aria-label={title} dir={isAR ? 'rtl' : 'ltr'} style={{ marginBottom: 24 }}>
        {heading}
        <p data-testid="strategy-not-considered" style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          {L([
            'Strategic alignment is not part of this review: no business or digital strategy objective applies — none is defined in the EA repository or knowledge base, or this review type does not assess strategic alignment. It carries no weight in the overall score.',
            'المواءمة الاستراتيجية ليست جزءاً من هذه المراجعة: لا ينطبق أي هدف من أهداف استراتيجية الأعمال أو الاستراتيجية الرقمية — لا يوجد هدف معرّف في مستودع البنية المؤسسية أو قاعدة المعرفة، أو أن نوع المراجعة لا يقيّم المواءمة الاستراتيجية. ولا تدخل في الدرجة الإجمالية.',
          ])}
        </p>
      </section>
    )
  }

  const strategies = (section.strategies || []).map(s => (s.name ? `${s.name} (${L(KIND_LABEL[s.kind])})` : L(KIND_LABEL[s.kind]))).join(isAR ? '؛ ' : '; ')
  return (
    <section aria-label={title} dir={isAR ? 'rtl' : 'ltr'} style={{ marginBottom: 24 }}>
      {heading}
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, overflowWrap: 'anywhere' }}>
        {strategies && <div>{strategies}</div>}
        <div>{L(['Source', 'المصدر'])}: {L(SOURCE_LABEL[section.source])}{section.sources?.length ? ` (${section.sources.join(isAR ? '؛ ' : '; ')})` : ''}</div>
      </div>
      <div data-testid="strategy-score" style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
        {typeof score === 'number'
          ? `${L(['Strategic alignment score', 'درجة المواءمة الاستراتيجية'])}: ${score}/100`
          : L(['Not scored — no objective applies to this solution, so strategy carries no weight in the overall score.', 'غير محتسبة — لا ينطبق أي هدف على هذا الحل، فلا وزن للاستراتيجية في الدرجة الإجمالية.'])}
      </div>
      <div role="list" aria-label={L(['Status summary', 'ملخص الحالات'])} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {STATUSES.map(s => (
          <span role="listitem" key={s} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, border: `1px solid ${COLOR[s]}`, color: COLOR[s], fontWeight: 600 }}>
            {L(STATUS_LABEL[s])}: {section.counts?.[s] ?? 0}
          </span>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 10 }}>
        {section.assessments.map((a, i) => (
          <article key={a.objectiveId} data-testid="objective-card" style={{ border: '1px solid var(--border)', borderInlineStart: `4px solid ${COLOR[a.status]}`, borderRadius: 8, padding: 12, background: 'var(--bg-card)', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>S-{i + 1} · {a.objective}</strong>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLOR[a.status], whiteSpace: 'nowrap' }}>{L(STATUS_LABEL[a.status])}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, overflowWrap: 'anywhere' }}>
              {[L(KIND_LABEL[a.strategyKind] || KIND_LABEL.STRATEGY), a.isPillar ? L(['Pillar', 'ركيزة']) : a.pillar ? `${L(['Pillar', 'الركيزة'])}: ${a.pillar}` : ''].filter(Boolean).join(' · ')}
            </div>
            <p style={{ fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>{a.rationale}</p>
            {a.evidence && (
              <blockquote style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--text-muted)', margin: '8px 0 0', paddingInlineStart: 8, borderInlineStart: '2px solid var(--border)', overflowWrap: 'anywhere' }}>
                “{a.evidence}”
              </blockquote>
            )}
          </article>
        ))}
      </div>
      {!!section.unassessed?.length && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
          {L(['Not assessed', 'لم يُقيَّم'])}: {section.unassessed.map(u => u.objective).join(isAR ? '؛ ' : '; ')}
        </div>
      )}
    </section>
  )
}
