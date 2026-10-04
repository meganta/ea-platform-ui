import { render, screen, fireEvent, within } from '@testing-library/react'
import Workspace, { safeEvidenceUrl } from '../decision/DecisionComparisonWorkspace'

function setup(isAR = false, overrides: any = {}) {
  const cells = [
    { id: 'r1', candidateId: 'a', criterionId: 'c1', status: 'PASS', score: 4, weightedContribution: 80, normalizedWeight: 100, rationale: 'Saved rationale', evidenceIds: ['e1'], clarificationQuestions: ['Confirm support SLA'] },
    { id: 'r2', candidateId: 'b', criterionId: 'c1', status: 'MISSING_EVIDENCE', score: null, weightedContribution: null, normalizedWeight: 100, evidenceIds: [] },
  ]
  const api = { get: jest.fn().mockResolvedValue({ cells, evidence: [{ id: 'e1', snippet: 'Kafka يدعم التكامل', document: { label: 'Proposal.pdf' }, pageNumber: 3 }], reconciliation: [{ candidateId: 'a', matchesSavedScore: true }, { candidateId: 'b', matchesSavedScore: true }], ...overrides }), post: jest.fn().mockResolvedValue({ rankingEverChanges: true, scenarios: [{ adjustedCriterionId: 'c1', direction: 'down', rankingChanged: true, resultingRanking: ['b', 'a'] }] }) }
  const props = { id: 'review', candidates: [{ id: 'a', name: 'Kafka' }, { id: 'b', name: 'RabbitMQ' }], criteria: [{ id: 'c1', groupId: 'g1', name: 'Integration', weight: 100 }], groups: [{ id: 'g1', name: 'Architecture' }], scores: [{ candidateId: 'a', rank: 1, overallScore: 80, mandatoryGatesPassed: true, evidenceCoveragePercent: 100 }, { candidateId: 'b', rank: null, overallScore: 0, mandatoryGatesPassed: false, evidenceCoveragePercent: 0 }], assessment: { outcome: 'NO_QUALIFIED_CANDIDATE' }, api, isAR }
  const view = render(<Workspace {...props} />)
  return { api, ...view }
}
it('exposes saved scores, missing evidence and verbatim evidence without inventing a winner', async () => {
  setup()
  const missing = await screen.findByRole('button', { name: 'RabbitMQ: Integration — Missing evidence' })
  expect(within(missing).getByText('—')).toBeInTheDocument()
  expect(screen.getByText('No qualified candidate')).toBeInTheDocument()
  expect(screen.getByText('Mandatory gates failed')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Kafka: Integration — Pass' }))
  expect(screen.getByText('Saved rationale')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Criterion details' })).toHaveFocus()
  expect(screen.getByText('Kafka يدعم التكامل')).toBeInTheDocument()
  expect(screen.getByText('Confirm support SLA')).toBeInTheDocument()
  fireEvent.click(screen.getByText('Close details'))
  expect(screen.queryByText('Saved rationale')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kafka: Integration — Pass' })).toHaveFocus()
})
it('filters criteria and explains contribution differences separately from eligibility', async () => {
  setup()
  await screen.findByRole('button', { name: 'Kafka: Integration — Pass' })
  expect(screen.getByText('+80')).toBeInTheDocument()
  expect(screen.getByText(/higher technical score does not establish eligibility/)).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search criteria'), { target: { value: 'unknown' } })
  expect(screen.getByText('No criteria match these filters.')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Search criteria'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'evidence' } })
  expect(screen.getByRole('button', { name: 'RabbitMQ: Integration — Missing evidence' })).toBeInTheDocument()
})
it('withholds pairwise explanations when saved totals are stale', async () => {
  setup(false, { reconciliation: [] })
  await screen.findByRole('button', { name: 'Kafka: Integration — Pass' })
  expect(screen.getByText(/Score explanations require an up-to-date comparison/)).toBeInTheDocument()
  expect(screen.queryByText('+80')).not.toBeInTheDocument()
})
it('shows named sensitivity scenarios and sends the selected variation', async () => {
  const { api } = setup()
  await screen.findByRole('button', { name: 'Kafka: Integration — Pass' })
  fireEvent.change(screen.getByLabelText('Weight variation'), { target: { value: '20' } })
  fireEvent.click(screen.getByText('Run (±20%)'))
  expect(await screen.findByText('Weight decreased')).toBeInTheDocument()
  expect(api.post).toHaveBeenCalledWith('/decision-evaluation/review/sensitivity', { variationPercent: 20 })
  expect(screen.getByText('Ranking is sensitive to weight changes')).toBeInTheDocument()
})
it('renders Arabic controls and RTL composition while preserving source language', async () => {
  const { container } = setup(true)
  fireEvent.click(await screen.findByRole('button', { name: 'Kafka: Integration — مستوفى' }))
  expect(container.querySelector('.dc-workspace')).toHaveAttribute('dir', 'rtl')
  expect(screen.getByLabelText('البحث في المعايير')).toBeInTheDocument()
  expect(screen.getByText('الأدلة المستشهد بها')).toBeInTheDocument()
  expect(screen.getByText('Kafka يدعم التكامل')).toBeInTheDocument()
})
it('only permits HTTP source links', () => {
  expect(safeEvidenceUrl('javascript:alert(1)')).toBeUndefined()
  expect(safeEvidenceUrl('https://example.com/reference')).toBe('https://example.com/reference')
})

it('distinguishes a genuine zero from an excluded criterion', async () => {
  setup(false, { cells: [
    { id: 'r1', candidateId: 'a', criterionId: 'c1', status: 'FAIL', score: 0, weightedContribution: 0, normalizedWeight: 100, evidenceIds: [] },
    { id: 'r2', candidateId: 'b', criterionId: 'c1', status: 'NOT_APPLICABLE', score: null, weightedContribution: null, normalizedWeight: null, evidenceIds: [] },
  ] })
  const failed = await screen.findByRole('button', { name: 'Kafka: Integration — Fail' })
  expect(within(failed).getByText('0 / 5')).toBeInTheDocument()
  expect(within(screen.getByRole('button', { name: 'RabbitMQ: Integration — Not applicable' })).getByText('—')).toBeInTheDocument()
})
