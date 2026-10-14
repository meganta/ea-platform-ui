import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ArchitectureRoadmap from '../ArchitectureRoadmap'

let mockIsAR = false
let mockPerms: string[] = ['Roadmap.View', 'Roadmap.Manage', 'Roadmap.Deliver']
let mockRole = 'TENANT_ADMIN'
jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: mockIsAR }) }))
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: (c: string) => mockPerms.includes(c), user: { role: mockRole } }) }))

const LINE = [
  { id: 'cur', name: 'Current', label: 'CURRENT', status: 'APPROVED', horizonDate: null, achievedAt: null, changes: 0, unplanned: 0, workPackages: 0, delivered: 0 },
  { id: 't1', name: 'Transition 1 — 2027', label: 'TRANSITION', transitionNumber: 1, status: 'APPROVED', horizonDate: '2027-12-31T00:00:00.000Z', achievedAt: null, changes: 2, unplanned: 1, workPackages: 1, delivered: 0 },
  { id: 'tgt', name: 'Enterprise Target 2029', label: 'TARGET', status: 'DRAFT', horizonDate: '2029-12-31T00:00:00.000Z', achievedAt: null, changes: 1, unplanned: 1, workPackages: 0, delivered: 0 },
]
const OVERVIEW = {
  roadmap: { id: 'rm', name: 'HRDF EA Roadmap', startDate: '2026-10-11T00:00:00.000Z', targetDate: '2029-12-31T00:00:00.000Z', stepSize: 'ANNUAL' },
  line: LINE,
  offLine: [{ id: 'alt', name: 'Option B', type: 'TARGET', status: 'DRAFT', horizonDate: null, branchesFrom: 'Current' }],
  segments: [{ id: 'seg', name: 'CRM programme', domains: [], workPackages: 1, delivered: 0, changes: 1 }],
  workPackages: [{ id: 'wp1', name: 'CRM go-live', scenarioId: 't1', status: 'PLANNED', endDate: '2027-06-30T00:00:00.000Z', changes: 1, segmentId: 'seg', deliveredChanges: 0 }],
  measures: [{ id: 'm1', kind: 'DOMAIN_MATURITY', subjectName: 'Application', targetValue: 3, current: 2, status: 'BELOW', overdue: false, stateName: 'Enterprise Target 2029', dueDate: '2029-12-31T00:00:00.000Z', currentDetail: 'Level 2' }],
  progress: { workPackages: { total: 1, planned: 1, committed: 0, delivered: 0 }, changes: { delivered: 0, remaining: 3, planned: 1, unplanned: 2 }, deliveredShare: 0 },
  domains: [{ domain: 'APP', domainName: 'Application', total: 3, introduce: 1, retire: 1, modify: 0, links: 1, planned: 1, unplanned: 2 }],
  inEffect: { state: LINE[0], next: LINE[1] },
  warnings: [{ code: 'UNPLANNED_CHANGES', count: 2 }, { code: 'STATE_NOT_APPROVED', name: 'Enterprise Target 2029' }],
}
const CHANGES = { total: 2, truncated: false, items: [
  { id: 'd1', kind: 'OBJECT', change: 'INTRODUCE', stateId: 't1', stateName: 'Transition 1 — 2027', objectId: 'a1', objectName: 'New CRM', objectType: 'Application', domain: 'APP', domainName: 'Application', workPackageId: 'wp1', workPackageName: 'CRM go-live', horizonDate: '2027-12-31T00:00:00.000Z' },
  { id: 'd2', kind: 'OBJECT', change: 'RETIRE', stateId: 't1', stateName: 'Transition 1 — 2027', objectId: 'a2', objectName: 'Old CRM', objectType: 'Application', domain: 'APP', domainName: 'Application', workPackageId: null, workPackageName: null, horizonDate: '2027-12-31T00:00:00.000Z' },
] }

let calls: Array<{ url: string; method: string; body: any }>
function mockApi(overview: any = OVERVIEW) {
  calls = []
  global.fetch = jest.fn().mockImplementation((url: string, opts: any = {}) => {
    const method = opts.method || 'GET'
    calls.push({ url, method, body: opts.body ? JSON.parse(opts.body) : undefined })
    let body: any = {}
    if (method === 'GET' && /\/architecture-roadmap$/.test(url)) body = overview
    else if (url.includes('/architecture-roadmap/changes')) body = CHANGES
    else if (url.includes('/commit')) body = { objectsDated: 2 }
    else if (url.includes('/ea-planning/plans')) body = []
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) })
  }) as any
}

beforeEach(() => { mockIsAR = false; mockPerms = ['Roadmap.View', 'Roadmap.Manage', 'Roadmap.Deliver']; mockRole = 'TENANT_ADMIN'; localStorage.setItem('ea_token', 'x'); window.confirm = jest.fn(() => true); mockApi() })

describe('ArchitectureRoadmap', () => {
  it('without a roadmap offers set-up and creates it', async () => {
    mockApi({ roadmap: null, candidates: [{ id: 'old', name: 'Jadarat Target', type: 'TARGET' }], suggestion: { startDate: '2026-10-11', years: 3, stepSize: 'ANNUAL' } })
    render(<ArchitectureRoadmap />)
    await screen.findByText('roadmap.setup.title')
    fireEvent.change(screen.getByLabelText('roadmap.setup.step'), { target: { value: 'HALF_YEAR' } })
    fireEvent.change(screen.getByLabelText('roadmap.setup.target'), { target: { value: 'old' } })
    fireEvent.click(screen.getByText('roadmap.setup.submit'))
    await waitFor(() => expect(calls.find(c => c.method === 'POST')?.body).toMatchObject({ years: 3, stepSize: 'HALF_YEAR', targetScenarioId: 'old', startDate: '2026-10-11' }))
  })

  it('shows the line Current -> Transition -> Target, warnings, alternatives and progress', async () => {
    render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    const states = screen.getAllByRole('listitem').filter(li => li.className.includes('rm-state'))
    expect(states.map(s => s.className.match(/(CURRENT|TRANSITION|TARGET)/)![1])).toEqual(['CURRENT', 'TRANSITION', 'TARGET'])
    expect(screen.getAllByText('Enterprise Target 2029').length).toBeGreaterThan(0)
    expect(screen.getByText('roadmap.warn.UNPLANNED_CHANGES')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'roadmap.state.open_views' })[1]).toHaveAttribute('href', '/ea-views?scenarioId=t1')
  })

  it('approves a state through the scenario status route', async () => {
    render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    fireEvent.click(screen.getByText('roadmap.state.approve'))
    await waitFor(() => expect(calls.find(c => c.method === 'PATCH')).toMatchObject({ url: expect.stringContaining('/ea-views/scenarios/tgt/status'), body: { status: 'APPROVED' } }))
  })

  it('arranges the line: places an alternative by date and saves the order', async () => {
    render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    fireEvent.click(screen.getByText('roadmap.state.arrange'))
    fireEvent.click(screen.getByText('+ Option B'))
    fireEvent.click(screen.getByText('roadmap.state.save_order'))
    await waitFor(() => expect(calls.find(c => c.method === 'PUT')).toMatchObject({ url: expect.stringContaining('/architecture-roadmap/line'), body: { transitions: [{ id: 't1' }, { id: 'alt' }] } }))
  })

  it('assigns selected changes of one state to a planned work package', async () => {
    render(<ArchitectureRoadmap />)
    await screen.findByText('Old CRM')
    fireEvent.click(screen.getByLabelText('Old CRM'))
    fireEvent.change(await screen.findByLabelText('roadmap.changes.assign_to'), { target: { value: 'wp1' } })
    fireEvent.click(screen.getByText('roadmap.changes.assign'))
    await waitFor(() => expect(calls.find(c => c.url.includes('/work-packages/wp1/changes'))?.body).toEqual({ objectChangeIds: ['d2'], linkChangeIds: [], remove: false }))
  })

  it('commits a work package after confirmation and reports the dated objects', async () => {
    render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    fireEvent.click(screen.getByRole('tab', { name: 'roadmap.sub.packages' }))
    fireEvent.click(await screen.findByText('roadmap.wp.commit'))
    await waitFor(() => expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/work-packages/wp1/commit'))).toBe(true))
    expect(await screen.findByText('roadmap.wp.committed_result')).toBeInTheDocument()
  })

  it('hides managing and delivering actions from viewers', async () => {
    mockPerms = ['Roadmap.View']; mockRole = 'ARCHITECT'
    render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    expect(screen.queryByText('roadmap.state.arrange')).not.toBeInTheDocument()
    expect(screen.queryByText('roadmap.delete')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'roadmap.sub.packages' }))
    expect(screen.queryByText('roadmap.wp.commit')).not.toBeInTheDocument()
  })

  it('shows target measures with their status, and domain totals', async () => {
    render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    fireEvent.click(screen.getByRole('tab', { name: 'roadmap.sub.measures' }))
    expect(screen.getByText('roadmap.m.status.BELOW')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'roadmap.sub.domains' }))
    expect(screen.getByRole('button', { name: 'Application' })).toBeInTheDocument()
  })

  it('says so without Roadmap.View and renders right-to-left in Arabic', async () => {
    mockPerms = []
    const { unmount } = render(<ArchitectureRoadmap />)
    expect(screen.getByText('roadmap.no_access')).toBeInTheDocument()
    unmount()
    mockPerms = ['Roadmap.View']; mockIsAR = true
    const { container } = render(<ArchitectureRoadmap />)
    await screen.findByText('HRDF EA Roadmap')
    expect(container.querySelector('.rm')).toHaveAttribute('dir', 'rtl')
  })
})
