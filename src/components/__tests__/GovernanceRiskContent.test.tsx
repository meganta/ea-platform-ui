import React from 'react'
import { render, screen } from '@testing-library/react'
import GovernanceRiskContent, { riskDisplayText } from '../GovernanceRiskContent'

test('HLD source fields display the actual risk and recommended action without invented metadata', () => {
  const risk = { riskStatement: '48 TB required but only 8 TB allocated', recommendation: 'Increase storage capacity' }
  render(<><h3>{riskDisplayText(risk).title}</h3><GovernanceRiskContent risk={risk} isAR={false} /></>)
  expect(screen.getByText(risk.riskStatement)).toBeInTheDocument()
  expect(screen.getByText('Mitigation: Increase storage capacity')).toBeInTheDocument()
  expect(screen.queryByText(/Probability:/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Owner:/)).not.toBeInTheDocument()
})

test('legacy risks retain their title, statement, assessed metadata and mitigation', () => {
  const risk = { riskTitle: 'Delivery failure', riskStatement: 'Retries repeat commands', mitigation: 'Deduplicate commands', recommendation: 'Alternate action', owner: 'Architecture team', probability: 'HIGH', impact: 'Repeated operation' }
  render(<><h3>{riskDisplayText(risk).title}</h3><GovernanceRiskContent risk={risk} isAR={false} /></>)
  expect(screen.getByText('Delivery failure')).toBeInTheDocument()
  expect(screen.getByText('Retries repeat commands')).toBeInTheDocument()
  expect(screen.getByText('Mitigation: Deduplicate commands')).toBeInTheDocument()
  expect(screen.getByText('Owner: Architecture team')).toBeInTheDocument()
  expect(screen.queryByText(/Alternate action/)).not.toBeInTheDocument()
})

test('Arabic labels distinguish documentation uncertainty from demonstrated risk', () => {
  render(<GovernanceRiskContent risk={{ riskNature: 'DOCUMENTATION_GAP_UNCERTAINTY', recommendation: 'تحديد خطة الاستعادة' }} isAR />)
  expect(screen.getByText('نقص المعلومات يسبب عدم يقين؛ وليس خطراً مثبتاً')).toBeInTheDocument()
  expect(screen.getByText('إجراء المعالجة: تحديد خطة الاستعادة')).toBeInTheDocument()
})
