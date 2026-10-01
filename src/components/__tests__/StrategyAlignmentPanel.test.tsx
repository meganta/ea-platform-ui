import React from 'react'
import { render, screen } from '@testing-library/react'
import StrategyAlignmentPanel, { StrategyAlignmentSection, usesStrategyAlignment } from '../StrategyAlignmentPanel'
let mockArabic = false
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockArabic, t: (k: string) => k }) }))
beforeEach(() => { mockArabic = false })

const section: StrategyAlignmentSection = {
  source: 'REPOSITORY_STRUCTURED', sources: ['Strategy register'], strategies: [{ name: 'Digital Strategy', kind: 'DT_STRATEGY' }], score: 50,
  counts: { ALIGNED: 1, NOT_ALIGNED: 1, NOT_APPLICABLE: 0 },
  unassessed: [{ objective: 'Open data', reason: 'no rationale given' }],
  assessments: [
    { objectiveId: 'g1', objective: 'Digitise all permit services', pillar: 'Digital services', strategyName: 'Digital Strategy', strategyKind: 'DT_STRATEGY', status: 'ALIGNED', rationale: 'Permits are applied for and tracked online.', evidence: 'lets citizens apply for permits online' },
    { objectiveId: 'g2', objective: 'Paperless government', isPillar: true, strategyKind: 'DT_STRATEGY', status: 'NOT_ALIGNED', rationale: 'Paper forms are kept alongside the portal.', evidence: null },
  ],
}

test('score, one card per objective with strategy, pillar, status, rationale and quoted statement; source, counts and what was not assessed', () => {
  render(<StrategyAlignmentPanel section={section} score={50} />)
  expect(screen.getAllByTestId('objective-card')).toHaveLength(2)
  expect(screen.getByTestId('strategy-score').textContent).toBe('Strategic alignment score: 50/100')
  expect(screen.getByText('S-1 · Digitise all permit services')).toBeInTheDocument()
  expect(screen.getByText('Digital strategy · Pillar: Digital services')).toBeInTheDocument()
  expect(screen.getByText('Digital strategy · Pillar')).toBeInTheDocument()
  expect(screen.getByText('“lets citizens apply for permits online”')).toBeInTheDocument()
  expect(screen.getByText(/Source: EA repository strategy register and objectives \(Strategy register\)/)).toBeInTheDocument()
  expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Aligned: 1', 'Not aligned: 1', 'Not applicable: 0'])
  expect(screen.getByText('Not assessed: Open data')).toBeInTheDocument()
})

test('no applicable objective: not scored', () => {
  render(<StrategyAlignmentPanel section={{ ...section, score: null }} score={null} />)
  expect(screen.getByTestId('strategy-score').textContent).toMatch(/^Not scored/)
})

test('not considered: a note saying why, no cards', () => {
  render(<StrategyAlignmentPanel section={undefined} score={null} />)
  expect(screen.getByTestId('strategy-not-considered')).toBeInTheDocument()
  expect(screen.queryAllByTestId('objective-card')).toHaveLength(0)
})

test('Arabic interface: Arabic labels and right-to-left', () => {
  mockArabic = true
  const { container } = render(<StrategyAlignmentPanel section={section} score={50} />)
  expect(container.querySelector('section')!.getAttribute('dir')).toBe('rtl')
  expect(screen.getByText('المواءمة الاستراتيجية')).toBeInTheDocument()
  expect(screen.getByText('غير متوائم')).toBeInTheDocument()
  expect(screen.getByTestId('strategy-score').textContent).toBe('درجة المواءمة الاستراتيجية: 50/100')
})

test('a stored report uses the panel only when it was assessed against the strategy objectives', () => {
  expect(usesStrategyAlignment({ strategicAlignment: { considered: false } })).toBe(true)
  expect(usesStrategyAlignment({ strategicAlignment: { objectives: [] } })).toBe(false)
  expect(usesStrategyAlignment(null)).toBe(false)
})
