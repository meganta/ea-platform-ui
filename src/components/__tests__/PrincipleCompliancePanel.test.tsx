import React from 'react'
import { render, screen } from '@testing-library/react'
import PrincipleCompliancePanel, { PrincipleComplianceSection } from '../PrincipleCompliancePanel'
let mockArabic = false
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockArabic, t: (k: string) => k }) }))
beforeEach(() => { mockArabic = false })

const section: PrincipleComplianceSection = {
  source: 'REPOSITORY_OBJECT', sources: ['EA Repository'],
  counts: { COMPLIANT: 1, PARTIALLY_COMPLIANT: 0, NON_COMPLIANT: 1, NOT_APPLICABLE: 0 },
  unassessed: [{ principle: 'Cloud First', reason: 'no rationale given' }],
  assessments: [
    { principleId: 'p1', principle: 'API First', status: 'COMPLIANT', rationale: 'APIs go through the gateway.', evidence: 'The platform exposes APIs through the API Gateway.' },
    { principleId: 'p2', principle: 'Data Minimisation', status: 'NON_COMPLIANT', rationale: 'Data is retained with no limit.', evidence: null },
  ],
}

test('one card per principle with status, rationale and the quoted statement; source, counts and what was not assessed', () => {
  render(<PrincipleCompliancePanel section={section} />)
  expect(screen.getAllByTestId('principle-card')).toHaveLength(2)
  expect(screen.getByText('P-1 · API First')).toBeInTheDocument()
  expect(screen.getByText('APIs go through the gateway.')).toBeInTheDocument()
  expect(screen.getByText('“The platform exposes APIs through the API Gateway.”')).toBeInTheDocument()
  expect(screen.getByText(/Source: EA repository principle objects \(EA Repository\)/)).toBeInTheDocument()
  expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['Compliant: 1', 'Partially compliant: 0', 'Not compliant: 1', 'Not applicable: 0'])
  expect(screen.getByText('Not assessed: Cloud First')).toBeInTheDocument()
})

test('Arabic interface: Arabic labels and right-to-left', () => {
  mockArabic = true
  render(<PrincipleCompliancePanel section={section} />)
  expect(screen.getByRole('region', { name: 'الامتثال لمبادئ البنية المؤسسية' })).toHaveAttribute('dir', 'rtl')
  expect(screen.getByText('غير ممتثل')).toBeInTheDocument()
})

test('no section: renders nothing', () => {
  const { container } = render(<PrincipleCompliancePanel section={null} />)
  expect(container).toBeEmptyDOMElement()
})
