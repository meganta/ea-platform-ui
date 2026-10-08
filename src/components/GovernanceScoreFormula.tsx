import React from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

/**
 * How a governance review's overall score was calculated — the backend's
 * breakdown (governance-score-scope.ts), shown as it is, never recomputed
 * here: each part that counts, its score and its share of the overall.
 * Parts the review type does not include are not shown; a part that was
 * not assessed is shown as such (its weight went to the others).
 */
export interface ScoreComponent {
  key: string
  score: number | null
  weight: number
  appliedWeight: number
  included: boolean
  excludedBecause?: 'NOT_IN_REVIEW_TYPE' | 'NOT_ASSESSED' | 'NO_WEIGHT'
}
export interface ScoreBreakdown {
  version: 1
  reviewType: string
  method: 'CRITERIA' | 'DOMAIN_AVERAGE'
  overallScore: number
  components: ScoreComponent[]
}

const LABEL: Record<string, [string, string]> = {
  strategic: ['Strategic', 'المواءمة الاستراتيجية'],
  compliance: ['Compliance', 'الامتثال'],
  risk: ['Risk', 'المخاطر'],
  futureState: ['Future State', 'الحالة المستقبلية'],
  financial: ['Financial', 'المالي'],
  domainQuality: ['Domains', 'المجالات'],
  BUSINESS_ARCHITECTURE: ['Business Architecture', 'بنية الأعمال'],
  BENEFICIARY_EXPERIENCE: ['Beneficiary Experience', 'تجربة المستفيد'],
  APPLICATION_INTEGRATION: ['Application & Integration', 'التطبيقات والتكامل'],
  DATA_ARCHITECTURE: ['Data Architecture', 'بنية البيانات'],
  INFRASTRUCTURE: ['Infrastructure', 'البنية التحتية'],
  SECURITY_ARCHITECTURE: ['Security Architecture', 'بنية الأمن'],
}

export function componentLabel(key: string, isAR: boolean): string {
  const k = key.startsWith('domain:') ? key.slice(7) : key
  const pair = LABEL[k]
  return pair ? pair[isAR ? 1 : 0] : k.replace(/_/g, ' ')
}

/** The domains' combined score inside the breakdown: their weighted average, or the single domain-quality part. */
export function domainsScoreOf(breakdown: ScoreBreakdown | null | undefined): number | null {
  if (!breakdown || !Array.isArray(breakdown.components)) return null
  const parts = breakdown.components.filter(c => (c.key === 'domainQuality' || c.key.startsWith('domain:')) && c.included && typeof c.score === 'number')
  const w = parts.reduce((s, c) => s + c.weight, 0)
  return w > 0 ? parts.reduce((s, c) => s + c.weight * (c.score as number), 0) / w : null
}

export default function GovernanceScoreFormula({ breakdown }: { breakdown: ScoreBreakdown }) {
  const { isAR } = useLang()
  const shown = (breakdown.components || []).filter(c => c.excludedBecause !== 'NOT_IN_REVIEW_TYPE' && c.excludedBecause !== 'NO_WEIGHT')
  if (!shown.length) return null
  const pct = (w: number) => `${Math.round(w * 1000) / 10}%`
  return (
    <div className="gov-score-formula" dir={isAR ? 'rtl' : 'ltr'} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
        {isAR ? 'طريقة احتساب الدرجة الإجمالية' : 'How the overall score is calculated'}
        <HelpTip text={isAR
          ? 'الدرجة الإجمالية هي المتوسط المرجح لهذه العناصر. تُحتسب فقط العناصر التي يشملها نوع المراجعة، ويُستبعد العنصر غير المقيَّم ويُعاد توزيع وزنه على العناصر الأخرى.'
          : 'The overall score is the weighted average of these parts. Only the parts this review type includes count; a part that was not assessed is left out and its weight goes to the others.'} />
      </div>
      <div data-testid="score-formula-parts" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {shown.map(c => (
          <span key={c.key} style={{ padding: '3px 8px', borderRadius: 10, border: '1px solid var(--navy-light)', opacity: c.included ? 1 : 0.6, whiteSpace: 'nowrap' }}>
            {componentLabel(c.key, isAR)}{' '}
            {c.included
              ? <><strong style={{ color: 'var(--text)' }}>{Number((c.score as number).toFixed(2))}</strong> × {pct(c.appliedWeight)}</>
              : <em>{isAR ? 'لم يُقيَّم' : 'not assessed'}</em>}
          </span>
        ))}
        <span style={{ padding: '3px 8px', fontWeight: 700, color: 'var(--accent)' }}>= {Number(breakdown.overallScore.toFixed(2))}</span>
      </div>
    </div>
  )
}
