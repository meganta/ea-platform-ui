import React from 'react'
import { render, screen } from '@testing-library/react'
import GovernanceScoreFormula, { ScoreBreakdown, domainsScoreOf } from '../GovernanceScoreFormula'
let mockArabic = false
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockArabic, t: (k: string) => k }) }))
beforeEach(() => { mockArabic = false })

const breakdown: ScoreBreakdown = {
  version: 1, reviewType: 'RFP_SOW', method: 'CRITERIA', overallScore: 61.5,
  components: [
    { key: 'strategic', score: null, weight: 0.05, appliedWeight: 0, included: false, excludedBecause: 'NOT_IN_REVIEW_TYPE' },
    { key: 'compliance', score: 50, weight: 0.3, appliedWeight: 0.5, included: true },
    { key: 'risk', score: 70, weight: 0.15, appliedWeight: 0.25, included: true },
    { key: 'financial', score: null, weight: 0.05, appliedWeight: 0, included: false, excludedBecause: 'NOT_IN_REVIEW_TYPE' },
    { key: 'domain:SECURITY_ARCHITECTURE', score: 76, weight: 0.15, appliedWeight: 0.25, included: true },
    { key: 'domain:DATA_ARCHITECTURE', score: null, weight: 0.15, appliedWeight: 0, included: false, excludedBecause: 'NOT_ASSESSED' },
  ],
}

test('shows each part that counts with its score and share, a part not assessed as such, and never a part the review type excludes', () => {
  render(<GovernanceScoreFormula breakdown={breakdown} />)
  const text = screen.getByTestId('score-formula-parts').textContent || ''
  expect(text).toContain('Compliance 50 × 50%')
  expect(text).toContain('Risk 70 × 25%')
  expect(text).toContain('Security Architecture 76 × 25%')
  expect(text).toContain('Data Architecture not assessed')
  expect(text).not.toContain('Strategic')
  expect(text).not.toContain('Financial')
  expect(text).toContain('= 61.5')
})

test('Arabic interface: Arabic labels and right-to-left', () => {
  mockArabic = true
  const { container } = render(<GovernanceScoreFormula breakdown={breakdown} />)
  expect(container.querySelector('.gov-score-formula')?.getAttribute('dir')).toBe('rtl')
  expect(screen.getByText('طريقة احتساب الدرجة الإجمالية')).toBeInTheDocument()
  expect(screen.getByTestId('score-formula-parts').textContent).toContain('الامتثال')
})

test('domainsScoreOf: the weighted average of the assessed domains, null without a breakdown', () => {
  expect(domainsScoreOf(breakdown)).toBe(76)
  expect(domainsScoreOf(null)).toBeNull()
})
