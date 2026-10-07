import { render, screen, waitFor, fireEvent } from '@testing-library/react'

jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)
let mockPerms = new Set<string>(['ArchitectureHealth.View', 'ArchitectureHealth.ManageBacklog', 'ArchitectureHealth.DecideActions', 'Innovation.ManageOwnPosition'])
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: (c: string) => mockPerms.has(c) }) }))
const mockSaveBlob = jest.fn()
jest.mock('../../../lib/studyExport', () => ({ saveBlob: (...a: any[]) => mockSaveBlob(...a) }))

import { BacklogPanel, EnterpriseIntelligencePanel, InsightsPanel, RationalisationPanel } from '../ArchitectPanels'
import { makeApi } from '../health'
import CopilotCollectionCard, { isCollectionAttachment } from '../../../components/CopilotCollectionCard'
import CopilotHealthInsights from '../../../components/CopilotHealthInsights'
import CopilotResearchCard from '../../../components/CopilotResearchCard'

const t = (k: string) => k
const ok = (body: any) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob(['x'])) })
function route(routes: Record<string, any>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length)
  return jest.fn((url: string, init?: any) => {
    const key = keys.find(k => url.includes(k))
    return ok(key ? (typeof routes[key] === 'function' ? routes[key](url, init) : routes[key]) : {})
  })
}
const api = makeApi('http://api')

beforeEach(() => {
  mockPerms = new Set(['ArchitectureHealth.View', 'ArchitectureHealth.ManageBacklog', 'ArchitectureHealth.DecideActions', 'Innovation.ManageOwnPosition'])
  Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true })
})

describe('Domain backlog', () => {
  const BACKLOG = { actions: [
    { id: 'a1', status: 'PROPOSED', priority: 'HIGH', recommendedAction: 'Record owners', gapDescription: 'Few owners', expectedImpact: { gainPoints: 12, effort: 30 } },
    { id: 'a2', status: 'ACCEPTED', priority: 'MEDIUM', recommendedAction: 'Link risks', gapDescription: 'No risks', expectedImpact: {}, overdue: true },
  ], remembered: [{ id: 'r1', action: 'Map capabilities', reason: 'Done in BCM' }] }

  it('proposes from the assessment, accepts, rejects with a reason, and shows remembered rejections', async () => {
    const fetchMock = route({
      '/backlog/propose': { created: [{ id: 'n' }], rememberedRejections: [{ key: 'k' }] },
      '/backlog': BACKLOG,
      '/backlog/a1/decision': { ok: true },
    })
    global.fetch = fetchMock as any
    render(<BacklogPanel api={api} t={t} code="APPLICATION" />)
    await waitFor(() => expect(screen.getByText('Record owners')).toBeInTheDocument())
    expect(screen.getByText('health.backlog.overdue')).toBeInTheDocument()
    expect(screen.getByText('+12')).toBeInTheDocument()
    expect(screen.getByText(/Done in BCM/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('health.backlog.propose'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('health.backlog.proposed'))

    fireEvent.click(screen.getByText('health.backlog.reject'))
    const confirm = screen.getByText('health.backlog.confirm_reject')
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('health.backlog.reason'), { target: { value: 'Owned by HR' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(fetchMock.mock.calls.some(c => String(c[0]).includes('/backlog/a1/decision') && JSON.parse(c[1].body).decision === 'REJECTED' && JSON.parse(c[1].body).rationale === 'Owned by HR')).toBe(true))
  })

  it('hides decisions and proposals without the permissions', async () => {
    mockPerms = new Set(['ArchitectureHealth.View'])
    global.fetch = route({ '/backlog': BACKLOG }) as any
    render(<BacklogPanel api={api} t={t} code="APPLICATION" />)
    await waitFor(() => expect(screen.getByText('Record owners')).toBeInTheDocument())
    expect(screen.queryByText('health.backlog.propose')).toBeNull()
    expect(screen.queryByText('health.backlog.accept')).toBeNull()
  })
})

describe('Rationalisation', () => {
  it('lists candidates with their evidence and the matrix', async () => {
    global.fetch = route({ '/rationalisation': {
      analysedObjects: 6, byRecommendation: { CONSOLIDATE: 1, RETIRE: 1 }, rule: 'the rule', limitations: ['first part only'],
      pairs: [{ key: 'k', typeName: 'Application', a: { id: 'a1', name: 'Case Manager' }, b: { id: 'a2', name: 'Service Desk' }, recommendation: 'CONSOLIDATE', strength: 'STRONG', sharedCapabilities: ['c1', 'c2'], sharedOther: 1, reason: 'Both support Case handling' }],
      matrix: { capabilities: [{ id: 'c1', name: 'Case handling' }], objects: [{ id: 'a1', name: 'Case Manager', capabilityIds: ['c1'] }] },
    } }) as any
    render(<RationalisationPanel api={api} t={t} code="APPLICATION" />)
    await waitFor(() => expect(screen.getByText('Both support Case handling')).toBeInTheDocument())
    expect(screen.getByText('Case Manager').closest('a')).toHaveAttribute('href', '/repository?asset=a1')
    fireEvent.click(screen.getByText('health.rat.show_matrix'))
    expect(screen.getByTestId('health-rat-matrix')).toHaveTextContent('Case handling')
    expect(screen.getByText(/first part only/)).toBeInTheDocument()
  })

  it('says when nothing could be compared', async () => {
    global.fetch = route({ '/rationalisation': { analysedObjects: 0 } }) as any
    render(<RationalisationPanel api={api} t={t} code="APPLICATION" />)
    await waitFor(() => expect(screen.getByText('health.rat.nothing')).toBeInTheDocument())
  })
})

describe('Chief intelligence and insights', () => {
  it('shows traceability per step (not measurable is not zero) and debt', async () => {
    global.fetch = route({ '/enterprise/intelligence': {
      traceability: { endToEnd: { coverage: 50, statement: '1 of 2 goals' }, steps: [
        { from: 'STRATEGY', to: 'CAPABILITY', status: 'MEASURED', coverage: 50, statement: '1 of 2 linked', unlinkedSample: [{ id: 'g2', name: 'Goal B' }] },
        { from: 'APPLICATION', to: 'TECHNOLOGY', status: 'NOT_RECORDED', coverage: null, statement: 'Technology not recorded', unlinkedSample: [] },
      ] },
      debt: { rule: 'debt rule', items: [{ code: 'DEPENDS_ON_RETIRED', count: 3, severity: 'HIGH', statement: '3 objects linked to retired', sample: [{ id: 'x', name: 'Old CRM' }] }] },
    } }) as any
    render(<EnterpriseIntelligencePanel api={api} t={t} />)
    await waitFor(() => expect(screen.getByText('1 of 2 goals')).toBeInTheDocument())
    expect(screen.getByText(/Goal B/)).toBeInTheDocument()
    expect(screen.getByText('health.not_assessed')).toBeInTheDocument()
    expect(screen.getByText('health.intel.d.DEPENDS_ON_RETIRED')).toBeInTheDocument()
    expect(screen.getByText('Old CRM')).toBeInTheDocument()
  })

  it('lists insights with links; the compact form disappears when there is nothing', async () => {
    const fetchMock = route({ '/insights': { insights: [{ key: 'k', kind: 'MATURITY_DROPPED', severity: 'HIGH', title: 'Application maturity dropped by 5 points', detail: 'From 45 to 40', link: '/architecture-health?domain=APP' }] } })
    global.fetch = fetchMock as any
    render(<InsightsPanel api={api} t={t} domains={['APP']} />)
    await waitFor(() => expect(screen.getByText('Application maturity dropped by 5 points')).toHaveAttribute('href', '/architecture-health?domain=APP'))
    expect(String(fetchMock.mock.calls[0][0])).toContain('/architecture-health/insights?domain=APP')

    global.fetch = route({ '/insights': { insights: [] } }) as any
    const { container } = render(<InsightsPanel api={api} t={t} compact />)
    await waitFor(() => expect(global.fetch).toHaveBeenCalled())
    expect(container.querySelector('[data-testid="health-insights"]')).toBeNull()
  })

  it('Copilot start screen: the domain architect\'s domain, nothing without the permission', async () => {
    const fetchMock = route({ '/insights': { insights: [{ key: 'k', kind: 'NEVER_ASSESSED', severity: 'MEDIUM', title: 'Data has never been assessed', detail: 'd', link: '/x' }] } })
    global.fetch = fetchMock as any
    render(<CopilotHealthInsights architect={{ domain: 'DATA', isChief: false }} />)
    await waitFor(() => expect(screen.getByText('Data has never been assessed')).toBeInTheDocument())
    expect(String(fetchMock.mock.calls[0][0])).toContain('?domain=DATA')
    mockPerms = new Set()
    const none = render(<CopilotHealthInsights architect={{ isChief: true }} />)
    expect(none.container.innerHTML).toBe('')
  })
})

describe('Copilot collection card', () => {
  const att = { kind: 'COLLECTION', id: 'collection-c1', collectionId: 'c1', domainCode: 'APPLICATION', domainName: 'Application', items: 3, rows: 12, completenessFrom: 40, completenessTo: 55, maturityFrom: 30, maturityTo: 36, createdAt: 'x' }
  it('downloads the template through the API and links to the dashboard', async () => {
    expect(isCollectionAttachment(att)).toBe(true)
    expect(isCollectionAttachment({ kind: 'RESEARCH' })).toBe(false)
    const fetchMock = jest.fn(() => ok({}))
    global.fetch = fetchMock as any
    render(<CopilotCollectionCard attachment={att as any} />)
    expect(screen.getByText(/copilot.collection.open$/).closest('a')).toHaveAttribute('href', '/architecture-health?domain=APPLICATION')
    fireEvent.click(screen.getByText(/copilot.collection.download$/))
    await waitFor(() => expect(mockSaveBlob).toHaveBeenCalledWith(expect.any(Blob), 'ArchMind_collection_APPLICATION.xlsx'))
    expect(String((fetchMock.mock.calls[0] as any)[0])).toContain('/architecture-health/collections/c1/template')
  })
})

describe('Research -> Technology Radar', () => {
  const att = { kind: 'RESEARCH', id: 'research-r1', researchId: 'r1', title: 'API management', status: 'COMPLETED', provider: 'ANTHROPIC', createdAt: 'x' }
  const DONE = { id: 'r1', status: 'COMPLETED', outcome: { decision: { code: 'INTRODUCE_NEW', statement: 's', basis: 'b' }, recommendation: {}, candidates: [], criteria: [], requirements: [], existing: [], limitations: [] } }

  it('shows matching radar items and records the research on the chosen one', async () => {
    const fetchMock = jest.fn((url: string) => ok(url.endsWith('/radar-matches')
      ? { matches: [{ id: 'apim', name: 'API Management', tenantStatus: 'WATCH', willChange: true }, { id: 'esb', name: 'Integration Bus', tenantStatus: 'ADOPT', willChange: false }] }
      : url.endsWith('/radar') ? { technology: { id: 'apim', name: 'API Management' }, previousStatus: 'WATCH', status: 'ASSESS', statusChanged: true } : DONE))
    global.fetch = fetchMock as any
    render(<CopilotResearchCard attachment={att as any} />)
    fireEvent.click(await screen.findByText(/copilot.research.radar$/))
    await waitFor(() => expect(screen.getByTestId('research-radar-matches')).toHaveTextContent('copilot.research.radar_kept'))
    fireEvent.click(screen.getByText('API Management'))
    await waitFor(() => expect(screen.getByTestId('research-radar-done')).toHaveTextContent('copilot.research.radar_done'))
    const post = fetchMock.mock.calls.find((c: any) => String(c[0]).endsWith('/radar')) as any
    expect(JSON.parse(post[1].body)).toEqual({ technologyId: 'apim' })
  })

  it('offers nothing for a reuse decision', async () => {
    global.fetch = jest.fn(() => ok({ ...DONE, outcome: { ...DONE.outcome, decision: { code: 'REUSE_EXISTING', statement: 's', basis: 'b' } } })) as any
    render(<CopilotResearchCard attachment={att as any} />)
    await screen.findByText('copilot.research.decision.REUSE_EXISTING')
    expect(screen.queryByText(/copilot.research.radar$/)).toBeNull()
  })
})
