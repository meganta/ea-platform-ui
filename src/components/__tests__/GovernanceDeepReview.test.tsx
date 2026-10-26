import { render, screen } from '@testing-library/react'
import GovernanceDeepReviewNote, { DeepReviewBadge } from '../GovernanceDeepReview'

jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../HelpTip', () => () => <span>?</span>)

const record = {
  status: 'COMPLETED', level: 'DEEP', steps: 9, lookups: 14, costSar: 4.2, confirmed: 3,
  verdict: { decision: 'APPROVED_WITH_CONDITIONS', rationale: 'Fixable before go-live.', conditions: ['Reuse the existing CRM'] },
  added: [{ title: 'Duplicates the existing CRM platform', domain: 'APPLICATION_INTEGRATION', severity: 'HIGH', evidence: ['E2'] }],
  lowered: [{ title: 'No DR plan', domain: 'INFRASTRUCTURE', from: 'HIGH', to: 'MEDIUM', reason: 'DR is in annex C' }],
  withdrawn: [{ title: 'Vendor claim', domain: 'APPLICATION_INTEGRATION', severity: 'LOW', reason: 'Not in the document' }],
  openQuestions: ['Who owns DR?'], limitations: ['One lookup failed.'],
}

describe('GovernanceDeepReviewNote', () => {
  it('says what the deep review changed in this report, with the recommended decision and conditions', () => {
    render(<GovernanceDeepReviewNote record={record} />)
    expect(screen.getByText('deepwork.gov.title')).toBeInTheDocument()
    expect(screen.getByText('deepwork.gov.count.added')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('deepwork.decision.APPROVED_WITH_CONDITIONS')).toBeInTheDocument()
    expect(screen.getByText('Reuse the existing CRM')).toBeInTheDocument()
    expect(screen.getByText(/Duplicates the existing CRM platform/)).toBeInTheDocument()
    expect(screen.getByText(/HIGH → MEDIUM/)).toBeInTheDocument()
    expect(screen.getByText(/Not in the document/)).toBeInTheDocument()
    expect(screen.getByText('Who owns DR?')).toBeInTheDocument()
    expect(screen.getByText('One lookup failed.')).toBeInTheDocument()
    expect(screen.getByText(/4\.20 SAR/)).toBeInTheDocument()
    // no separate deck or lead-review launcher
    expect(screen.queryByText(/deck/i)).toBeNull()
  })

  it('a deep review that did not complete says the report is the standard review', () => {
    render(<GovernanceDeepReviewNote record={{ status: 'CANCELLED', limitations: ['Stopped: the time allowed for this run was used.'] }} />)
    expect(screen.getByText('deepwork.gov.not_completed')).toBeInTheDocument()
    expect(screen.queryByText('deepwork.gov.count.added')).toBeNull()
    expect(screen.getByText(/time allowed/)).toBeInTheDocument()
  })

  it('marks findings the deep review raised', () => {
    render(<DeepReviewBadge />)
    expect(screen.getByText('deepwork.gov.badge')).toHaveAttribute('title', 'deepwork.gov.badge_help')
  })
})
