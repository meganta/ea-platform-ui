import React from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

/**
 * EA principles compliance for a governance review: one card per tenant
 * principle with its status, the rationale, and the document statement it
 * rests on. Rendered only when the review has the section (it is omitted
 * server-side when no principle exists or the review type has no
 * compliance output).
 */
export type PrincipleStatus = 'COMPLIANT' | 'PARTIALLY_COMPLIANT' | 'NON_COMPLIANT' | 'NOT_APPLICABLE'
export interface PrincipleComplianceSection {
  source: 'REPOSITORY_OBJECT' | 'REPOSITORY_DOCUMENT' | 'KNOWLEDGE_BASE'
  sources: string[]
  assessments: Array<{ principleId: string; principle: string; statement?: string; status: PrincipleStatus; rationale: string; evidence?: string | null }>
  unassessed?: Array<{ principle: string; reason: string }>
  counts: Record<PrincipleStatus, number>
}

const STATUSES: PrincipleStatus[] = ['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE']
const COLOR: Record<PrincipleStatus, string> = { COMPLIANT: '#2ecc71', PARTIALLY_COMPLIANT: '#f39c12', NON_COMPLIANT: '#e74c3c', NOT_APPLICABLE: '#64748B' }
const STATUS_LABEL: Record<PrincipleStatus, [string, string]> = {
  COMPLIANT: ['Compliant', 'ممتثل'], PARTIALLY_COMPLIANT: ['Partially compliant', 'ممتثل جزئياً'],
  NON_COMPLIANT: ['Not compliant', 'غير ممتثل'], NOT_APPLICABLE: ['Not applicable', 'غير منطبق'],
}
const SOURCE_LABEL: Record<PrincipleComplianceSection['source'], [string, string]> = {
  REPOSITORY_OBJECT: ['EA repository principle objects', 'عناصر المبادئ في مستودع البنية المؤسسية'],
  REPOSITORY_DOCUMENT: ['Principle documents in the EA repository', 'وثائق المبادئ في مستودع البنية المؤسسية'],
  KNOWLEDGE_BASE: ['EA knowledge base', 'قاعدة معرفة البنية المؤسسية'],
}

export default function PrincipleCompliancePanel({ section }: { section: PrincipleComplianceSection | null | undefined }) {
  const { isAR } = useLang()
  if (!section || !Array.isArray(section.assessments) || section.assessments.length === 0) return null
  const L = (pair: [string, string]) => (isAR ? pair[1] : pair[0])
  return (
    <section aria-label={L(['EA Principles Compliance', 'الامتثال لمبادئ البنية المؤسسية'])} dir={isAR ? 'rtl' : 'ltr'} style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>{L(['EA Principles Compliance', 'الامتثال لمبادئ البنية المؤسسية'])}</h3>
        <HelpTip text={L([
          'Each of your EA principles is assessed against the submitted document: compliant, partially compliant, not compliant or not applicable, always with the reason. Principles come from the EA repository objects first, then principle documents uploaded to the repository, then the knowledge base.',
          'يُقيَّم كل مبدأ من مبادئ البنية المؤسسية مقابل الوثيقة المقدمة: ممتثل أو ممتثل جزئياً أو غير ممتثل أو غير منطبق، مع ذكر السبب دائماً. تؤخذ المبادئ من عناصر مستودع البنية المؤسسية أولاً، ثم من وثائق المبادئ المرفوعة في المستودع، ثم من قاعدة المعرفة.',
        ])} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
        {L(['Source', 'المصدر'])}: {L(SOURCE_LABEL[section.source])}{section.sources?.length ? ` (${section.sources.join(isAR ? '؛ ' : '; ')})` : ''}
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
          <article key={a.principleId} data-testid="principle-card" style={{ border: '1px solid var(--border)', borderInlineStart: `4px solid ${COLOR[a.status]}`, borderRadius: 8, padding: 12, background: 'var(--bg-card)', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13, overflowWrap: 'anywhere' }}>P-{i + 1} · {a.principle}</strong>
              <span style={{ fontSize: 11, fontWeight: 700, color: COLOR[a.status], whiteSpace: 'nowrap' }}>{L(STATUS_LABEL[a.status])}</span>
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
          {L(['Not assessed', 'لم يُقيَّم'])}: {section.unassessed.map(u => u.principle).join(isAR ? '؛ ' : '; ')}
        </div>
      )}
    </section>
  )
}
