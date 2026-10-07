import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import ArchitectureHealthPage from '../../ArchitectureHealthPage'
import CopilotHealthCard, { isHealthAttachment } from '../../../components/CopilotHealthCard'
import CopilotViewAttachments from '../../../components/CopilotViewAttachments'

let mockParams = new URLSearchParams()
const mockSetParams = jest.fn((fn: any) => { mockParams = typeof fn === 'function' ? fn(mockParams) : fn })
jest.mock('react-router-dom', () => ({ useSearchParams: () => [mockParams, mockSetParams], useNavigate: () => jest.fn() }), { virtual: true })

let mockIsAR = false
jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: mockIsAR, locale: mockIsAR ? 'AR' : 'EN' }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)
let mockPerms = new Set<string>(['ArchitectureHealth.GenerateTemplate', 'ArchitectureHealth.UploadCollection', 'ArchitectureHealth.ApproveChanges', 'ArchitectureHealth.ExecuteChanges'])
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: (c: string) => mockPerms.has(c) }) }))
jest.mock('../../../lib/studyExport', () => ({ saveBlob: jest.fn() }))
import CollectionsPanel from '../CollectionsPanel'
import { makeApi } from '../health'

const criterion = (code: string, score: number | null, extra: any = {}) => ({ code, weight: 10, why: `why ${code}`, status: score === null ? 'NOT_ASSESSED' : 'ASSESSED', score, evidence: { measured: 2, of: 4 }, explanation: `explains ${code}`, gap: score !== null && score < 60 ? `gap ${code}` : null, recommendedAction: score !== null && score < 60 ? `act ${code}` : null, targetScore: 60, gapPoints: score === null ? null : Math.max(0, 60 - score), ...extra })

const ASSESSMENT = {
  domain: { code: 'APPLICATION', name: 'Application', nameAr: 'التطبيقات' },
  generatedAt: '2026-10-07T00:00:00Z', basis: 'Deterministic basis', objectCount: 3,
  truncated: { links: false, objects: false },
  completeness: { score: 41.5, attributeScore: 50, relationshipScore: 30, rule: 'completeness rule' },
  types: [{ code: 'Application', name: 'Application', objectCount: 3, attributeScore: 50, relationshipScore: 30, referenceExpected: false }],
  missingTypes: [{ code: 'API', name: 'API', classification: 'REFERENCE_GAP', referenceElements: ['API Gateway'] }],
  items: [
    { key: 'CORE:Application:owner', kind: 'CORE', typeCode: 'Application', typeName: 'Application', code: 'owner', label: 'Owner', priority: 'CRITICAL', priorityBasis: 'Accountable owner', weight: 5, expected: 3, useful: 1, missing: 2, invalid: 0, coverage: 33.3, gainPoints: 12.5 },
    { key: 'REL:Application:APP_RISK:INCOMING', kind: 'RELATIONSHIP', typeCode: 'Application', typeName: 'Application', code: 'APP_RISK', label: 'affected by Risk', priority: 'HIGH_VALUE', priorityBasis: 'cross-domain', weight: 3, expected: 3, useful: 0, missing: 3, invalid: 0, coverage: 0, gainPoints: 9, relationship: { otherEndTypeName: 'Risk', single: false, crossDomain: true, otherEndRecorded: 0, direction: 'INCOMING' } },
  ],
  invalidValues: { total: 1, samples: [] },
  suspiciousLinks: { total: 2, byReason: { SELF_LINK: 2 } },
  reference: { status: 'ASSESSED', architectures: [{ id: 'ra1', name: 'Ref', elements: 2 }], byClass: { CONFIRMED_EXISTING: [{ stableKey: 'a', name: 'Portal', obligation: 'MANDATORY', reason: '' }], POTENTIALLY_EXISTING_UNDOCUMENTED: [], ARCHITECTURE_GAP: [{ stableKey: 'b', name: 'API Gateway', obligation: 'MANDATORY', reason: '' }], NOT_APPLICABLE: [], REQUIRES_TENANT_CONFIRMATION: [] }, coverage: { mandatory: 2, confirmed: 1, statement: '1 of 2 mandatory reference element(s) are confirmed in the Repository.' } },
  maturity: { score: 38.2, level: 2, levelLabel: 'Developing', targetLevel: 4, targetScore: 60, gapPoints: 21.8, criteria: [criterion('OWNERSHIP', 33.3), criterion('ROADMAP_COVERAGE', null)], notAssessed: ['ROADMAP_COVERAGE'], rule: 'maturity rule' },
  collectionPlan: { itemKeys: ['CORE:Application:owner'], objects: 2, values: 2, blocked: [{ key: 'REL:Application:APP_RISK:INCOMING', label: 'Application: affected by Risk', needs: 'Risk' }], completenessFrom: 41.5, completenessTo: 54, maturityFrom: 38.2, maturityTo: 45.1, statement: 'x' },
  recommendations: [{ code: 'COLLECT_PRIORITY_DATA', priority: 'CRITICAL', problem: 'Completeness is low', evidence: 'e', action: 'Generate a collection template' }],
}

function route(routes: Record<string, any>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length)
  return jest.fn((url: string, init?: any) => {
    const key = keys.find(k => url.includes(k))
    const body = key ? (typeof routes[key] === 'function' ? routes[key](url, init) : routes[key]) : {}
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) })
  })
}
const DOMAINS = { metaModelPublished: true, domains: [{ code: 'APPLICATION', name: 'Application', nameAr: 'التطبيقات', typeCount: 2, latest: { maturityScore: 30 } }] }

beforeEach(() => {
  mockParams = new URLSearchParams(); mockIsAR = false; mockSetParams.mockClear()
  Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true })
})

describe('Architecture Health page', () => {
  it('shows every domain compared, the criteria heatmap and top actions (enterprise)', async () => {
    global.fetch = route({
      '/architecture-health/domains': DOMAINS,
      '/architecture-health/enterprise': { domains: [{ domain: ASSESSMENT.domain, objectCount: 3, maturity: ASSESSMENT.maturity, completeness: 41.5, relationshipCompleteness: 30, referenceCoverage: 50, criteria: [{ code: 'OWNERSHIP', score: 33.3, status: 'ASSESSED' }, { code: 'ROADMAP_COVERAGE', score: null, status: 'NOT_ASSESSED' }] }], topActions: [{ priority: 'HIGH', domainName: 'Application', action: 'Collect owners', problem: 'Ownership low' }], unresolvedObjects: 4 },
    }) as any
    render(<ArchitectureHealthPage />)
    await waitFor(() => expect(screen.getByTestId('health-enterprise')).toBeInTheDocument())
    expect(screen.getByTestId('health-heatmap')).toHaveTextContent('33.3')
    expect(screen.getByTestId('health-heatmap')).toHaveTextContent('health.na')
    expect(screen.getByText(/Collect owners/)).toBeInTheDocument()
    expect(screen.getByText('health.unresolved')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Application' }))
    expect(mockSetParams.mock.calls[0][0](new URLSearchParams()).get('domain')).toBe('APPLICATION')
  })

  it('shows a domain: scores, plan, criteria with evidence, gaps with their objects, reference classes', async () => {
    mockParams = new URLSearchParams('domain=APPLICATION')
    const fetchMock = route({
      '/architecture-health/domains': DOMAINS,
      '/architecture-health/domains/APPLICATION/history': [{ createdAt: '2026-09-01', maturityScore: 30, completenessScore: 35 }, { createdAt: '2026-10-01', maturityScore: 36, completenessScore: 40 }],
      '/architecture-health/domains/APPLICATION/gaps': { objects: [{ id: 'app9', name: 'Legacy CRM', assetType: 'Application' }] },
      '/architecture-health/domains/APPLICATION': { assessment: ASSESSMENT, latest: { id: 's1', createdAt: '2026-10-01', maturityScore: 36 } },
    })
    global.fetch = fetchMock as any
    render(<ArchitectureHealthPage />)
    await waitFor(() => expect(screen.getByTestId('health-domain')).toBeInTheDocument())
    expect(screen.getByText('38.2')).toBeInTheDocument()
    expect(screen.getByText('+2.2')).toBeInTheDocument() // change since last saved
    expect(screen.getByTestId('health-plan')).toHaveTextContent('health.plan.statement')
    expect(screen.getByText(/health.plan.blocked/)).toHaveTextContent('Application: affected by Risk (Risk)')
    const criteria = screen.getByTestId('health-criteria')
    expect(criteria).toHaveTextContent('health.criterion.OWNERSHIP')
    expect(criteria).toHaveTextContent('2 / 4')
    expect(criteria).toHaveTextContent('act OWNERSHIP')
    expect(criteria).toHaveTextContent('health.not_assessed')
    expect(screen.getByText('health.refclass.ARCHITECTURE_GAP (1)')).toBeInTheDocument()
    expect(screen.getByText('health.issues.reference_type')).toBeInTheDocument()
    fireEvent.click(screen.getAllByText('health.gap.show')[0])
    await waitFor(() => expect(screen.getByTestId('health-gap-objects')).toHaveTextContent('Legacy CRM'))
    expect(screen.getByText('Legacy CRM').closest('a')).toHaveAttribute('href', '/repository?asset=app9')
    expect(fetchMock.mock.calls.some(c => String(c[0]).includes('gaps?item=CORE%3AApplication%3Aowner'))).toBe(true)
  })

  it('saves an assessment and reloads it', async () => {
    mockParams = new URLSearchParams('domain=APPLICATION')
    const fetchMock = route({
      '/architecture-health/domains': DOMAINS,
      '/architecture-health/domains/APPLICATION/history': [],
      '/architecture-health/domains/APPLICATION/assess': { id: 's2' },
      '/architecture-health/domains/APPLICATION': { assessment: ASSESSMENT, latest: null },
    })
    global.fetch = fetchMock as any
    render(<ArchitectureHealthPage />)
    await waitFor(() => expect(screen.getByText('health.save')).toBeInTheDocument())
    fireEvent.click(screen.getByText('health.save'))
    await waitFor(() => expect(screen.getByText('health.saved')).toBeInTheDocument())
    expect(fetchMock.mock.calls.some(c => String(c[0]).endsWith('/assess') && c[1]?.method === 'POST')).toBe(true)
    expect(fetchMock.mock.calls.some(c => String(c[0]).includes('?fresh=true'))).toBe(true)
  })

  it('says when the Meta Model is not published, and is right-to-left in Arabic', async () => {
    mockIsAR = true
    global.fetch = route({ '/architecture-health/domains': { metaModelPublished: false, domains: [] } }) as any
    const { container } = render(<ArchitectureHealthPage />)
    await waitFor(() => expect(screen.getByText('health.no_meta_model')).toBeInTheDocument())
    expect(container.firstChild).toHaveAttribute('dir', 'rtl')
  })
})

describe('Copilot health card', () => {
  const domainCard = { kind: 'HEALTH_ASSESSMENT', id: 'h1', scope: 'DOMAIN', generatedAt: '2026-10-07', previous: { createdAt: '2026-10-01', maturityScore: 36, completenessScore: 40 },
    summary: { domain: { code: 'APPLICATION', name: 'Application', nameAr: 'التطبيقات' }, objectCount: 3, completeness: 41.5, relationshipCompleteness: 30, referenceCoverage: 50, maturity: { score: 38.2, level: 2, targetLevel: 4, targetScore: 60, gapPoints: 21.8 }, collectionPlan: { completenessTo: 54, maturityTo: 45, items: 3 }, topGaps: [{ key: 'k', label: 'Application: Owner', priority: 'CRITICAL', missing: 2, expected: 3 }] } }

  it('recognises health attachments and renders the domain summary with a dashboard link', () => {
    expect(isHealthAttachment(domainCard)).toBe(true)
    expect(isHealthAttachment({ kind: 'DECK', id: 'x' })).toBe(false)
    render(<CopilotHealthCard attachment={domainCard as any} />)
    expect(screen.getByText('38.2 / 60')).toBeInTheDocument()
    expect(screen.getByText('+2.2')).toBeInTheDocument()
    expect(screen.getByText(/Application: Owner/)).toBeInTheDocument()
    expect(screen.getByText(/copilot.health.open/).closest('a')).toHaveAttribute('href', '/architecture-health?domain=APPLICATION')
  })

  it('renders the enterprise table and is dispatched by the attachment list', () => {
    render(<CopilotViewAttachments attachments={[{ kind: 'HEALTH_ASSESSMENT', id: 'e1', scope: 'ENTERPRISE', generatedAt: 'x', domains: [{ code: 'DATA', name: 'Data', maturityScore: 22, maturityLevel: 2, targetScore: 60, completeness: 30, relationshipCompleteness: 10, gapPoints: 38 }] }]} />)
    expect(screen.getByTestId('copilot-health-card')).toHaveTextContent('copilot.health.enterprise')
    expect(screen.getByText('Data').closest('a')).toHaveAttribute('href', '/architecture-health?domain=DATA')
  })
})

describe('Data collection panel', () => {
  const EX = { id: 'ex1', domainCode: 'APPLICATION', status: 'VALIDATED', itemKeys: ['a', 'b'], createdAt: '2026-10-07', baselineCompleteness: 40, projectedCompleteness: 60, afterCompleteness: null, baselineMaturity: 30, afterMaturity: null,
    validation: { summary: { READY: 2, READY_WITH_WARNING: 1, NEEDS_CLARIFICATION: 1, REJECTED: 1, objectsToCreate: 1, objectsToUpdate: 2, relationshipsToCreate: 3, relationshipsToReplace: 0, conflicts: 1, possibleDuplicates: 0 }, fileProblems: [], rows: [{ rowRef: 'Application!3', objectName: 'Case Manager', status: 'READY', reasons: [], noChanges: false }] } }
  const CHANGES = [
    { id: 'c1', objectId: 'app1', objectName: 'Case Manager', rowRef: 'Application!3', changeType: 'UPDATE_FIELD', field: 'owner', previousValue: null, newValue: 'Operations', validationStatus: 'READY', reasons: [], decision: 'PENDING', executed: false },
    { id: 'c2', objectId: 'app2', objectName: 'Portal', rowRef: 'Application!4', changeType: 'UPDATE_FIELD', field: 'criticality', previousValue: 'LOW', newValue: 'HIGH', validationStatus: 'NEEDS_CLARIFICATION', reasons: ['Replaces the recorded value'], conflict: true, decision: 'PENDING', executed: false },
    { id: 'c3', objectId: 'app2', objectName: 'Portal', rowRef: 'Application!4', changeType: 'CREATE_RELATIONSHIP', field: 'CAP', targetName: 'Nope', validationStatus: 'REJECTED', reasons: ['No Capability named Nope'], decision: 'PENDING', executed: false },
  ]
  beforeEach(() => { mockPerms = new Set(['ArchitectureHealth.GenerateTemplate', 'ArchitectureHealth.UploadCollection', 'ArchitectureHealth.ApproveChanges', 'ArchitectureHealth.ExecuteChanges']) })

  it('starts a collection (downloads the template) and shows validation, changes and decisions', async () => {
    const fetchMock = route({
      '/architecture-health/collections?domain=APPLICATION': [EX],
      '/architecture-health/domains/APPLICATION/collections': { id: 'ex1' },
      '/architecture-health/collections/ex1/template': 'xlsx',
      '/architecture-health/collections/ex1/changes': CHANGES,
      '/architecture-health/collections/ex1/decisions': { decided: 1 },
      '/architecture-health/collections/ex1': EX,
    })
    global.fetch = jest.fn((url: string, init?: any) => fetchMock(url, init).then((r: any) => ({ ...r, blob: () => Promise.resolve(new Blob(['x'])) }))) as any
    render(<CollectionsPanel api={makeApi('')} t={(k: string) => k} code="APPLICATION" canCollect onExecuted={jest.fn()} />)
    await waitFor(() => expect(screen.getByText('health.collect.state.VALIDATED')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/health.collect.start$/))
    await waitFor(() => expect(screen.getByTestId('health-collection-detail')).toBeInTheDocument())
    await waitFor(() => expect(screen.getByTestId('health-changes')).toHaveTextContent('Operations'))
    // A rejected change has no checkbox; the conflict shows the recorded value.
    expect(screen.queryByLabelText('health.collect.select Nope')).toBeNull()
    expect(screen.getByTestId('health-changes')).toHaveTextContent('LOW')
    expect(screen.getAllByRole('checkbox')).toHaveLength(2)
    fireEvent.click(screen.getByText('health.collect.approve_ready'))
    await waitFor(() => expect(screen.getByText('health.collect.decided')).toBeInTheDocument())
    const decision = (global.fetch as jest.Mock).mock.calls.find(c => String(c[0]).endsWith('/decisions'))
    expect(JSON.parse(decision[1].body)).toEqual({ allReady: true, decision: 'APPROVED' })
    // Approving a selected change sends its id and the note.
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.change(screen.getByLabelText('health.collect.note'), { target: { value: 'Confirmed' } })
    fireEvent.click(screen.getByText(/health.collect.approve_selected/))
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(c => String(c[0]).endsWith('/decisions'))).toHaveLength(2))
    const second = (global.fetch as jest.Mock).mock.calls.filter(c => String(c[0]).endsWith('/decisions'))[1]
    expect(JSON.parse(second[1].body)).toEqual({ changeIds: ['c2'], decision: 'APPROVED', note: 'Confirmed' })
  })

  it('hides actions people may not take, and writes approved changes when allowed', async () => {
    mockPerms = new Set(['ArchitectureHealth.ExecuteChanges'])
    const onExecuted = jest.fn()
    global.fetch = route({
      '/architecture-health/collections?domain=APPLICATION': [EX],
      '/architecture-health/collections/ex1/changes': [{ ...CHANGES[0], decision: 'APPROVED' }],
      '/architecture-health/collections/ex1/execute': { written: 1, failed: 0, before: { completeness: 40, maturity: 30 }, after: { completeness: 55, maturity: 38 } },
      '/architecture-health/collections/ex1': EX,
    }) as any
    render(<CollectionsPanel api={makeApi('')} t={(k: string) => k} code="APPLICATION" canCollect onExecuted={onExecuted} />)
    await waitFor(() => expect(screen.getByText('health.collect.open')).toBeInTheDocument())
    expect(screen.queryByText(/health.collect.start$/)).toBeNull()
    fireEvent.click(screen.getByText('health.collect.open'))
    await waitFor(() => expect(screen.getByText('health.collect.execute')).toBeInTheDocument())
    expect(screen.queryByText('health.collect.approve_ready')).toBeNull()
    expect(screen.queryByText('health.collect.upload')).toBeNull()
    fireEvent.click(screen.getByText('health.collect.execute'))
    await waitFor(() => expect(screen.getByTestId('health-collection-result')).toHaveTextContent('health.collect.result'))
    expect(onExecuted).toHaveBeenCalled()
  })
})
