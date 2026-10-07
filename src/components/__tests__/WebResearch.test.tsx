import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import WebResearchSettingsCard from '../../pages/settings/WebResearchSettingsCard'
import CopilotResearchCard, { isResearchAttachment, RESEARCH_POLL_MS } from '../CopilotResearchCard'

let mockIsAR = false
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: mockIsAR }) }))
jest.mock('../HelpTip', () => () => <span>?</span>)
let mockCanCreate = true
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: (c: string) => c === 'DecisionEvaluation.CreateAssessments' && mockCanCreate }) }))
import DecisionPreparedBy from '../DecisionPreparedBy'

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })

afterEach(() => { jest.useRealTimers() })

beforeEach(() => {
  mockIsAR = false
  Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true })
})

describe('Web research settings', () => {
  it('follows the AI settings by default: no provider or model to fill in, shows what is in use', async () => {
    const fetchMock = jest.fn((url: string, init?: any) => ok(init?.method === 'PUT'
      ? { ...JSON.parse(init.body), model: null, effective: { provider: 'ANTHROPIC', model: 'claude-sonnet-5-5', source: 'AI_SETTINGS', reason: null } }
      : { provider: 'AUTO', model: null, maxSearches: 5, allowedDomains: [], blockedDomains: [], effective: { provider: 'ANTHROPIC', model: 'claude-sonnet-5-5', source: 'AI_SETTINGS', reason: null } }))
    global.fetch = fetchMock as any
    render(<WebResearchSettingsCard />)
    await waitFor(() => expect(screen.getByLabelText('settings.web.provider')).toHaveValue('AUTO'))
    expect(screen.queryByLabelText('settings.web.model')).toBeNull()
    expect(screen.getByTestId('web-research-effective')).toHaveTextContent('settings.web.source.AI_SETTINGS')
    fireEvent.click(screen.getByText('settings.web.save'))
    await waitFor(() => expect(screen.getByText('settings.web.saved')).toBeInTheDocument())
    const put = fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')!
    expect(JSON.parse(put[1].body)).toMatchObject({ provider: 'AUTO', model: null, maxSearches: 5 })
  })

  it('says when the AI provider cannot search and Anthropic is used instead', async () => {
    global.fetch = jest.fn(() => ok({ provider: 'AUTO', model: null, maxSearches: 5, allowedDomains: [], blockedDomains: [], effective: { provider: 'ANTHROPIC', model: null, source: 'FALLBACK', reason: 'x' } })) as any
    render(<WebResearchSettingsCard />)
    await waitFor(() => expect(screen.getByTestId('web-research-effective')).toHaveTextContent('settings.web.source.FALLBACK'))
  })

  it('an override shows the model field and saves provider, model, searches and domains', async () => {
    const fetchMock = jest.fn((url: string, init?: any) => ok(init?.method === 'PUT' ? { ...JSON.parse(init.body), model: JSON.parse(init.body).model || null } : { provider: 'ANTHROPIC', model: null, maxSearches: 5, allowedDomains: [], blockedDomains: [] }))
    global.fetch = fetchMock as any
    render(<WebResearchSettingsCard />)
    await waitFor(() => expect(screen.getByLabelText('settings.web.provider')).toHaveValue('ANTHROPIC'))
    expect(screen.getByLabelText('settings.web.model')).toHaveAttribute('placeholder', 'claude-opus-5-5')
    fireEvent.change(screen.getByLabelText('settings.web.provider'), { target: { value: 'AUTO' } })
    expect(screen.queryByLabelText('settings.web.model')).toBeNull()
    fireEvent.change(screen.getByLabelText('settings.web.provider'), { target: { value: 'ANTHROPIC' } })
    fireEvent.change(screen.getByLabelText('settings.web.max_searches'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('settings.web.allowed'), { target: { value: 'gartner.com, forrester.com' } })
    expect(screen.getByLabelText('settings.web.blocked')).toBeDisabled()
    fireEvent.click(screen.getByText('settings.web.save'))
    await waitFor(() => expect(screen.getByText('settings.web.saved')).toBeInTheDocument())
    const put = fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')!
    expect(String(put[0])).toContain('/config/web-research')
    expect(JSON.parse(put[1].body)).toEqual({ provider: 'ANTHROPIC', model: '', maxSearches: 8, allowedDomains: ['gartner.com', 'forrester.com'], blockedDomains: [] })
  })

  it('switching research off hides the provider options', async () => {
    global.fetch = jest.fn(() => ok({ provider: 'NONE', model: null, maxSearches: 5, allowedDomains: [], blockedDomains: [] })) as any
    render(<WebResearchSettingsCard />)
    await waitFor(() => expect(screen.getByText('settings.web.off')).toBeInTheDocument())
    expect(screen.queryByLabelText('settings.web.model')).toBeNull()
  })
})

describe('Copilot research card', () => {
  const att = { kind: 'RESEARCH', id: 'research-r1', researchId: 'r1', title: 'An API management platform', status: 'RUNNING', provider: 'ANTHROPIC', createdAt: 'x' }
  const DONE = { id: 'r1', status: 'COMPLETED', provider: 'ANTHROPIC', model: 'claude-opus-5-5', searches: 4, outcome: {
    requiredCapability: 'API management', gap: 'none', requirements: [{ code: 'R1', requirement: 'Gateway' }],
    criteria: [{ code: 'C1', label: 'functional fit', weight: 100, why: 'core' }],
    existing: [{ id: 'app1', name: 'Gateway One', type: 'Application', coverage: 50 }],
    candidates: [
      { name: 'Vendor A', vendor: 'A Inc', marketPosition: 'LEADER', weightedScore: 4.25, capabilityFit: 66.7, pricing: { statement: 'Vendor confirmation required', sourceUrl: null }, sources: [{ url: 'https://a.example/docs', title: 'Docs' }], verified: true },
      { name: 'Vendor B', vendor: 'B', marketPosition: 'UNKNOWN', weightedScore: null, capabilityFit: null, pricing: { statement: 'Vendor confirmation required', sourceUrl: null }, sources: [], verified: false },
    ],
    decision: { code: 'EXTEND_OR_REPLACE', statement: 'Gateway One covers about 50%', basis: 'rule' },
    recommendation: { summary: 'Use Vendor A' }, alternative: { summary: 'Vendor B' }, confidence: 'MEDIUM', limitations: ['No retrieved source supports: Vendor B.'], rules: 'rules text',
  } }

  it('follows a running research until it completes, then shows the decision and candidates', async () => {
    jest.useFakeTimers()
    const responses = [{ ...DONE, status: 'RUNNING', outcome: null }, DONE]
    global.fetch = jest.fn(() => ok(responses.shift())) as any
    expect(isResearchAttachment(att)).toBe(true)
    render(<CopilotResearchCard attachment={att as any} />)
    await waitFor(() => expect(screen.getByText('copilot.research.running')).toBeInTheDocument())
    await act(async () => { jest.advanceTimersByTime(RESEARCH_POLL_MS) })
    await waitFor(() => expect(screen.getByTestId('research-decision')).toHaveTextContent('Gateway One covers about 50%'))
    jest.useRealTimers()
    const table = screen.getByTestId('research-candidates')
    expect(table).toHaveTextContent('Vendor A')
    expect(table).toHaveTextContent('4.25')
    expect(table).toHaveTextContent('copilot.research.vendor_confirmation')
    expect(screen.getByText('a.example').closest('a')).toHaveAttribute('href', 'https://a.example/docs')
    expect(table).toHaveTextContent('copilot.research.evidence.AI_INFERENCE') // Vendor B unverified
    fireEvent.click(screen.getByText('copilot.research.show_details'))
    expect(screen.getByTestId('research-details')).toHaveTextContent('Gateway One')
    expect(screen.getByTestId('research-details')).toHaveTextContent('functional fit — 100%')
  })

  it('says when web research is off', async () => {
    global.fetch = jest.fn(() => ok({ id: 'r1', status: 'NOT_CONFIGURED', provider: 'NONE', error: 'Web research is switched off' })) as any
    render(<CopilotResearchCard attachment={{ ...att, status: 'NOT_CONFIGURED' } as any} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Web research is switched off'))
  })
  it('sends a completed research to Decisions & Evaluation and then links to it', async () => {
    const fetchMock = jest.fn((url: string, init?: any) => ok(init?.method === 'POST' ? { assessment: { id: 'de1', status: 'DRAFT' }, created: true } : DONE))
    global.fetch = fetchMock as any
    render(<CopilotResearchCard attachment={{ ...att, status: 'COMPLETED' } as any} />)
    await waitFor(() => expect(screen.getByText(/copilot.research.send_de$/)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/copilot.research.send_de$/))
    await waitFor(() => expect(screen.getByTestId('research-de-link')).toHaveAttribute('href', '/decision-evaluation?assessment=de1'))
    expect(String(fetchMock.mock.calls.find(c => c[1]?.method === 'POST')![0])).toContain('/technology-research/r1/decision-assessment')
  })

  it('without permission offers no send; an already-sent research links directly', async () => {
    mockCanCreate = false
    global.fetch = jest.fn(() => ok({ ...DONE, decisionAssessmentId: 'de9' })) as any
    render(<CopilotResearchCard attachment={{ ...att, status: 'COMPLETED' } as any} />)
    await waitFor(() => expect(screen.getByTestId('research-de-link')).toHaveAttribute('href', '/decision-evaluation?assessment=de9'))
    expect(screen.queryByText(/copilot.research.send_de$/)).toBeNull()
    mockCanCreate = true
  })
})

describe('Prepared by Copilot badge', () => {
  it('names the domain architect with its domain, or the Chief across domains', () => {
    const { rerender } = render(<DecisionPreparedBy assessment={{ originType: 'COPILOT_RESEARCH', preparedBy: 'COPILOT', preparedByArchitectName: 'Data Architect', preparedByDomain: 'DATA' }} />)
    expect(screen.getByTestId('decision-prepared-by')).toHaveTextContent('decision.prepared.copilot · decision.prepared.domain · decision.prepared.from_research')
    rerender(<DecisionPreparedBy assessment={{ preparedBy: 'COPILOT', preparedByArchitectName: 'Chief Architect', preparedByDomain: null }} />)
    expect(screen.getByTestId('decision-prepared-by')).toHaveTextContent('decision.prepared.chief')
    rerender(<DecisionPreparedBy assessment={{ preparedBy: null, originType: null }} />)
    expect(screen.queryByTestId('decision-prepared-by')).toBeNull()
  })
})
