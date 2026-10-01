import React from 'react'
import { render, screen } from '@testing-library/react'
import PipelineStepList, { stepsRatio, PipelineStep } from '../PipelineStepList'
let mockArabic = false
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockArabic, t: (k: string) => k }) }))
beforeEach(() => { mockArabic = false })

const steps: PipelineStep[] = [
  { key: 'domain:DATA_ARCHITECTURE', label: 'Data Architecture', labelAr: 'بنية البيانات', state: 'done' },
  { key: 'domain:SECURITY_ARCHITECTURE', label: 'Security Architecture', labelAr: 'بنية الأمن', state: 'skipped' },
  { key: 'principles', label: 'EA principles', labelAr: 'مبادئ البنية المؤسسية', state: 'pending' },
  { key: 'report', label: 'Writing the report', labelAr: 'إعداد التقرير', state: 'pending' },
]

test('shows exactly the steps the pipeline reports for this review, with their real state', () => {
  render(<PipelineStepList steps={steps} />)
  const items = screen.getAllByRole('listitem')
  expect(items.map(li => li.getAttribute('data-state'))).toEqual(['done', 'skipped', 'pending', 'pending'])
  expect(screen.queryByText('Financial Optimization')).toBeNull()
  expect(screen.getByText('Not applicable to this document')).toBeInTheDocument()
  expect(stepsRatio(steps)).toBe(0.5)
})

test('before the plan arrives nothing is shown as done', () => {
  render(<PipelineStepList steps={null} />)
  expect(screen.getByRole('status')).toHaveTextContent('Preparing the review steps')
  expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  expect(stepsRatio(null)).toBe(0)
})

test('Arabic labels and right-to-left', () => {
  mockArabic = true
  render(<PipelineStepList steps={steps} />)
  expect(screen.getByRole('list', { name: 'خطوات المراجعة' })).toHaveAttribute('dir', 'rtl')
  expect(screen.getByText('مبادئ البنية المؤسسية')).toBeInTheDocument()
})
