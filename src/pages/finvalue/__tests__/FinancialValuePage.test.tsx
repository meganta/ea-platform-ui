import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'

let mockInitial = ''
jest.mock('react-router-dom', () => {
  const React = require('react')
  return {
    useSearchParams: () => {
      const [p, setP] = React.useState(() => new URLSearchParams(mockInitial))
      const set = (fn: any) => setP((prev: URLSearchParams) => (typeof fn === 'function' ? fn(prev) : new URLSearchParams(fn)))
      return [p, set]
    },
  }
}, { virtual: true })
jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)

import FinancialValuePage from '../../FinancialValuePage'

const ALL_RIGHTS = { VIEW: true, VIEW_FINANCIAL_DATA: true, MANAGE_DATA: true, VALIDATE_DATA: true, MANAGE_OPPORTUNITIES: true, ASSESS_FEASIBILITY: true, VALIDATE_FINANCE: false, APPROVE: false, VERIFY_SAVINGS: false, CONFIGURE: false, RUN_RESEARCH: true }
const bucket = (amount: number, count = 1, unquantified = 0) => ({ amount, count, unquantified })
const SUMMARY = {
  currency: 'SAR',
  cashSavings: { POTENTIAL: bucket(120000, 3, 2), VALIDATED: bucket(50000), APPROVED: bucket(300000), IMPLEMENTED: bucket(0, 0) },
  costAvoidance: { POTENTIAL: bucket(0, 1, 1), VALIDATED: bucket(0, 0), APPROVED: bucket(400000), IMPLEMENTED: bucket(0, 0) },
  realized: { amount: 60000, verifiedRealizations: 1 }, realizationRate: 20, productivity: { count: 1 }, nonFinancial: { count: 0 },
  byEngine: [{ key: 'APPLICATION_RATIONALIZATION', potential: 120000, approved: 300000, realized: 60000, count: 4 }], byDomain: [{ key: 'APP', potential: 1, approved: 2, realized: 0, count: 1 }], byCapability: [],
  byStatus: {}, top: [{ id: 'o1', title: 'Consolidate payroll systems', status: 'VALIDATED', benefitType: 'CASH_SAVING', netAnnualSaving: 120000, confidence: 'HIGH', priorityClass: 'QUICK_WIN', priorityScore: 82 }],
  milestones: [], renewals: [{ id: 'k1', title: 'Monitoring support', vendor: 'Acme', renewalDate: '2026-12-31', noticeBy: '2026-11-30', annualValue: 80000, currency: 'SAR' }],
  queues: { openDataRequests: 2, dataAwaitingValidation: 3, realizationsAwaitingVerification: 1, businessCasesAwaitingFinance: 1, awaitingArchitectureAssessment: 4, staleCandidates: 0, sourcedFromHealth: 2, sourcedFromGovernance: 1 },
  lastDiscovery: { id: 'r', status: 'COMPLETED', startedAt: '2026-10-09', completedAt: '2026-10-09', summary: { candidates: 5, limitations: ['No licence records'] } },
  notes: [],
}
const OPP = {
  id: 'o1', title: 'Consolidate payroll systems', engine: 'APPLICATION_RATIONALIZATION', action: 'CONSOLIDATE', benefitType: 'CASH_SAVING', status: 'EVIDENCE_REQUIRED', sourceKind: 'ARCHITECTURE_HEALTH',
  description: 'Both run payroll', rationale: 'Two shared capabilities', netAnnualSaving: 120000, costAvoidance: null, oneTimeCost: 60000, paybackMonths: 6, confidence: 'HIGH', evidenceCompleteness: 80, realizedAmount: 0,
  indicativeAnnualSaving: null, assets: [{ id: 'a', name: 'Payroll Plus', assetType: 'App' }, { id: 'b', name: 'Legacy Payroll', assetType: 'App' }], subjectAssetId: 'b', dependencies: [], overlaps: [],
  sources: [{ kind: 'ARCHITECTURE_HEALTH', id: 'App:a|b', label: 'Rationalisation (APP): CONSOLIDATE', domainCode: 'APP', live: null }],
  claims: [{ costItemId: 'c1', reductionPct: 100, allocatedPct: 100, sharedWith: [], costItem: { id: 'c1', description: 'Vendor support', category: 'SUPPORT', annualAmount: 120000, currency: 'SAR', basis: 'CONTRACT', status: 'VALIDATED' } }],
  financialDataRestricted: false, model: { savingsStartMonth: 0, oneTime: [{ label: 'Migration', amount: 60000, currency: 'SAR', basis: 'QUOTE', category: 'MIGRATION', year: 0 }], newRecurring: [], avoided: [] }, ratings: {}, feasibility: { architecture: { status: 'FEASIBLE', at: '2026-10-01' } },
  calculation: {
    method: 'FVI-CALC-1', inputHash: 'abc', currency: 'SAR', currentAnnualCost: 120000, grossAnnualSaving: 120000, newRecurringAnnual: 0, netAnnualSaving: 120000, targetAnnualCost: 0, oneTimeTotal: 60000, parallelRunCost: 0,
    costAvoidanceTotal: 0, npv: 450000, roiPct: 900, paybackMonths: 6, overlapReduction: 0, excluded: [], tco: { current3: 360000, target3: 60000, current5: 600000, target5: 60000 }, formulas: { npv: 'Sum of discounted flows' },
    flows: [{ year: 0, savings: 0, newCosts: 0, oneTime: 60000, avoided: 0, net: -60000, cumulativeNet: -60000 }, { year: 1, savings: 120000, newCosts: 0, oneTime: 0, avoided: 0, net: 120000, cumulativeNet: 60000 }],
    simulation: { baseline: { annualCost: 120000, horizonCost: 600000 }, scenarios: [{ code: 'CONSERVATIVE', netAnnualSaving: 96000, oneTimeTotal: 72000, npv: 300000, paybackMonths: 12 }, { code: 'EXPECTED', netAnnualSaving: 120000, oneTimeTotal: 60000, npv: 450000, paybackMonths: 6 }, { code: 'OPTIMISTIC', netAnnualSaving: 120000, oneTimeTotal: 54000, npv: 460000, paybackMonths: 5 }], sensitivity: [{ variable: 'DELAY', change: '+3 months', npv: 400000 }] },
    requirements: [{ code: 'BASELINE_COST', satisfied: true, detail: 'Recorded and validated' }, { code: 'BUSINESS_CONFIRMATION', satisfied: false, detail: 'NOT_ASSESSED' }],
  },
  score: { score: 82, priorityClass: 'QUICK_WIN', gates: [{ code: 'QUANTIFIED', passed: true, reason: 'ok' }], criteria: [{ code: 'FINANCIAL_BENEFIT', weight: 25, effectiveWeight: 40, score: 3, status: 'ASSESSED', rationale: 'Annual net benefit' }], rule: 'Gates first' },
  actions: [
    { action: 'VALIDATE', permitted: true, noteRequired: false, blockers: [{ code: 'BUSINESS_BLOCKED', message: 'The business owner has not confirmed' }] },
    { action: 'REJECT', permitted: true, noteRequired: true, blockers: [] },
  ],
  events: [{ id: 'e1', eventType: 'DISCOVERED', createdAt: '2026-10-01', toStatus: 'DISCOVERED' }], evidence: [], dataRequests: [], realizations: [], roadmap: null, research: null, scenario: null,
  businessCase: null, businessCaseVersion: 0, settings: { baseCurrency: 'SAR', segregationOfDuties: true },
}

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), blob: () => Promise.resolve(new Blob(['x'])) })
function route(routes: Record<string, any>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length)
  return jest.fn((url: string, init?: any) => {
    const key = keys.find(k => url.includes(k))
    return ok(key ? (typeof routes[key] === 'function' ? routes[key](url, init) : routes[key]) : [])
  })
}
const called = (fetchMock: jest.Mock, part: string, method = 'POST') => fetchMock.mock.calls.filter(c => String(c[0]).includes(part) && (c[1]?.method || 'GET') === method)

beforeEach(() => {
  mockInitial = ''
  Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true })
  ;(global as any).URL.createObjectURL = jest.fn(() => 'blob:x'); (global as any).URL.revokeObjectURL = jest.fn()
})

describe('FinancialValuePage', () => {
  it('shows each value category apart, realized savings, renewals and how to read the figures', async () => {
    global.fetch = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/summary': SUMMARY }) as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-overview')).toBeInTheDocument())
    const cash = screen.getByTestId('fv-cash')
    expect(within(cash).getByText('120,000 SAR')).toBeInTheDocument()
    expect(within(cash).getByText('300,000 SAR')).toBeInTheDocument()
    expect(within(cash).getByText(/2 fv.unquantified/)).toBeInTheDocument()
    expect(screen.getAllByText('60,000 SAR').length).toBeGreaterThan(0)
    expect(screen.getByText('20%')).toBeInTheDocument()
    expect(screen.getByTestId('fv-renewals')).toHaveTextContent('Monitoring support')
    expect(screen.getByTestId('fv-notes')).toHaveTextContent('fv.notes.1')
  })

  it('lets architects run discovery and see its limitations', async () => {
    const fetchMock = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/summary': SUMMARY, '/financial-value/discovery/run': { status: 'COMPLETED', summary: { created: 2, refreshed: 3 } } })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByText('fv.discovery.title')).toBeInTheDocument())
    expect(screen.getByText('No licence records')).toBeInTheDocument()
    fireEvent.click(screen.getByText('fv.discovery.run'))
    await waitFor(() => expect(called(fetchMock, '/financial-value/discovery/run')).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('fv.discovery.done'))
  })

  it('lists the register and creates an opportunity', async () => {
    mockInitial = 'tab=opportunities'
    const fetchMock = route({
      '/financial-value/me': ALL_RIGHTS,
      '/financial-value/opportunities/new-1': { ...OPP, id: 'new-1', title: 'Retire fax server' },
      '/financial-value/opportunities': (url: string, init: any) => (init?.method === 'POST' ? { id: 'new-1' } : [{ ...OPP, netAnnualSaving: null, assets: [{ id: 'a', name: 'Payroll Plus' }] }]),
    })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByText('Consolidate payroll systems')).toBeInTheDocument())
    expect(screen.getByText('fv.not_quantified')).toBeInTheDocument()
    fireEvent.click(screen.getByText('+ fv.create.open'))
    fireEvent.change(screen.getByLabelText('fv.field.title'), { target: { value: 'Retire fax server' } })
    fireEvent.change(screen.getByLabelText('fv.field.action'), { target: { value: 'RETIRE' } })
    fireEvent.click(screen.getByText('fv.create.submit'))
    await waitFor(() => expect(called(fetchMock, '/financial-value/opportunities').length).toBe(1))
    expect(JSON.parse(called(fetchMock, '/financial-value/opportunities')[0][1].body)).toMatchObject({ title: 'Retire fax server', action: 'RETIRE', engine: 'APPLICATION_RATIONALIZATION' })
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toHaveTextContent('Retire fax server'))
  })

  it('opens an opportunity: figures, sources, calculation, scenarios, priority and blocked next steps', async () => {
    mockInitial = 'opportunity=o1'
    const fetchMock = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/opportunities/o1/transition': OPP, '/financial-value/opportunities/o1': OPP, '/financial-value/costs': [], '/users': [] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toBeInTheDocument())
    expect(screen.getAllByText('120,000 SAR').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Rationalisation (APP): CONSOLIDATE' })).toHaveAttribute('href', '/architecture-health?domain=APP')
    expect(screen.getByRole('link', { name: 'Legacy Payroll' })).toHaveAttribute('href', '/repository?asset=b')

    fireEvent.click(screen.getByRole('tab', { name: 'fv.ws.financials' }))
    await waitFor(() => expect(screen.getByTestId('fv-calculation')).toHaveTextContent('FVI-CALC-1 · abc'))
    expect(screen.getByTestId('fv-scenarios')).toHaveTextContent('fv.sim.CONSERVATIVE')
    expect(screen.getByTestId('fv-priority')).toHaveTextContent('fv.class.QUICK_WIN')

    fireEvent.click(screen.getByRole('tab', { name: 'fv.ws.decisions' }))
    const actions = screen.getByTestId('fv-actions')
    expect(actions).toHaveTextContent('The business owner has not confirmed')
    expect(within(actions).queryAllByRole('button', { name: 'fv.act.VALIDATE' })).toHaveLength(0)
    const reject = within(actions).getByRole('button', { name: 'fv.act.REJECT' })
    expect(reject).toBeDisabled()
    fireEvent.change(screen.getByLabelText('fv.reason'), { target: { value: 'Duplicate of another opportunity' } })
    fireEvent.click(reject)
    await waitFor(() => expect(called(fetchMock, '/transition')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/transition')[0][1].body)).toEqual({ action: 'REJECT', note: 'Duplicate of another opportunity' })
  })

  it('records architecture / business feasibility and requests missing data', async () => {
    mockInitial = 'opportunity=o1'
    const fetchMock = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/opportunities/o1/feasibility': OPP, '/financial-value/opportunities/o1/data-requests': { created: 1 }, '/financial-value/opportunities/o1': OPP, '/users': [] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'fv.ws.decisions' }))
    const business = screen.getByTestId('fv-feas-business')
    fireEvent.change(within(business).getByLabelText('fv.feas.record'), { target: { value: 'CONFIRMED' } })
    fireEvent.click(within(business).getByText('fv.save'))
    await waitFor(() => expect(called(fetchMock, '/feasibility')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/feasibility')[0][1].body)).toMatchObject({ area: 'business', status: 'CONFIRMED' })
    expect(screen.queryByTestId('fv-feas-finance')).toHaveTextContent('fv.feasstatus.NOT_ASSESSED')
    expect(within(screen.getByTestId('fv-feas-finance')).queryByText('fv.save')).toBeNull() // no Finance right

    fireEvent.click(screen.getByRole('tab', { name: 'fv.ws.evidence' }))
    expect(screen.getByTestId('fv-requirements')).toHaveTextContent('fv.reqcode.BUSINESS_CONFIRMATION')
    fireEvent.click(screen.getByText('fv.req.request'))
    await waitFor(() => expect(called(fetchMock, '/data-requests')).toHaveLength(1))
  })

  it('submits measured savings only with financial evidence selected', async () => {
    mockInitial = 'opportunity=o1'
    const implemented = { ...OPP, status: 'IMPLEMENTED', evidence: [{ id: 'ev1', kind: 'BILLING_STATEMENT', title: 'Ledger H1', url: 'https://x', createdAt: '2026-10-01' }], actions: [] }
    const fetchMock = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/opportunities/o1/realizations': { id: 'r1' }, '/financial-value/opportunities/o1': implemented, '/ea-planning/plans': [], '/users': [] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('tab', { name: 'fv.ws.execution' }))
    const form = screen.getByTestId('fv-realize-form')
    fireEvent.change(screen.getByLabelText('fv.realization.from'), { target: { value: '2027-01-01' } })
    fireEvent.change(screen.getByLabelText('fv.realization.to'), { target: { value: '2027-07-01' } })
    fireEvent.change(screen.getByLabelText('fv.realization.actual'), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('fv.realization.method'), { target: { value: 'Ledger comparison for the period' } })
    const submit = within(form).getByText('fv.realization.submit')
    expect(submit).toBeDisabled()
    fireEvent.click(within(form).getByRole('checkbox'))
    expect(submit).not.toBeDisabled()
    fireEvent.click(submit)
    await waitFor(() => expect(called(fetchMock, '/realizations')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/realizations')[0][1].body)).toMatchObject({ periodStart: '2027-01-01', actualAmount: 0, evidenceIds: ['ev1'] })
  })

  it('hides cost details without the financial data permission', async () => {
    mockInitial = 'tab=data'
    global.fetch = route({ '/financial-value/me': { ...ALL_RIGHTS, VIEW_FINANCIAL_DATA: false } }) as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByText('fv.restricted')).toBeInTheDocument())
  })

  it('lets Finance validate submitted costs', async () => {
    mockInitial = 'tab=data'
    const fetchMock = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/costs/c1/validate': { id: 'c1' }, '/financial-value/costs': [{ id: 'c1', category: 'SUPPORT', annualAmount: 50000, currency: 'SAR', basis: 'CONTRACT', status: 'SUBMITTED', asset: { id: 'a', name: 'CRM' }, claims: [] }] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByText('50,000 SAR')).toBeInTheDocument())
    fireEvent.click(screen.getByText('fv.data.validate'))
    await waitFor(() => expect(called(fetchMock, '/costs/c1/validate')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/costs/c1/validate')[0][1].body)).toMatchObject({ decision: 'VALIDATED' })
  })

  it('answers a data request in a form', async () => {
    mockInitial = 'tab=requests'
    const req = { id: 'q1', field: 'ANNUAL_COST', label: 'Annual running cost of CRM', reason: 'Baseline', status: 'OPEN', opportunityId: 'o1', opportunityTitle: 'Retire CRM' }
    const fetchMock = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/data-requests/q1/respond': { id: 'q1' }, '/financial-value/data-requests': [req] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByText('Annual running cost of CRM')).toBeInTheDocument())
    fireEvent.click(screen.getByText('fv.collect.answer'))
    const form = screen.getByTestId('fv-answer')
    fireEvent.change(within(form).getAllByLabelText('fv.answer.category')[0], { target: { value: 'SUPPORT' } })
    fireEvent.change(within(form).getAllByLabelText('fv.answer.annualAmount')[0], { target: { value: '45000' } })
    fireEvent.click(within(form).getByText('fv.answer.submit'))
    await waitFor(() => expect(called(fetchMock, '/respond')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/respond')[0][1].body)).toEqual({ response: { lines: [{ category: 'SUPPORT', annualAmount: '45000' }] } })
  })

  it('shows Finance its verification queue and keeps settings read-only without the configuration permission', async () => {
    mockInitial = 'tab=verification'
    global.fetch = route({ '/financial-value/me': ALL_RIGHTS, '/financial-value/realizations': [{ id: 'r1', opportunityId: 'o1', opportunityTitle: 'Retire CRM', periodStart: '2027-01-01', periodEnd: '2027-07-01', baselineAmount: 60000, actualAmount: 0, realizedAmount: 60000, currency: 'SAR', submittedAt: '2027-07-05' }], '/financial-value/opportunities': [] }) as any
    const { unmount } = render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByText('Retire CRM')).toBeInTheDocument())
    expect(screen.getByText('fv.verif.no_verify_right')).toBeInTheDocument()
    unmount()

    mockInitial = 'tab=settings'
    global.fetch = route({ '/financial-value/me': ALL_RIGHTS, '/config/financial-value': { baseCurrency: 'SAR', exchangeRates: { USD: 3.75 }, discountRatePct: 6, escalationRatePct: 0, horizonYears: 5, criteriaWeights: { FINANCIAL_BENEFIT: 25 }, segregationOfDuties: true } }) as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-settings')).toBeInTheDocument())
    expect(screen.getByLabelText('fv.set.rates')).toHaveValue('USD=3.75')
    expect(screen.getByLabelText('fv.set.discount')).toBeDisabled()
    expect(screen.getByText('fv.set.read_only')).toBeInTheDocument()
  })
})
