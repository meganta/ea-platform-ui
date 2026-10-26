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


const ALL = { ...ALL_RIGHTS, VALIDATE_FINANCE: true, CONFIGURE: true }
const COMPARISON = {
  method: 'FVI-ALT-1', currency: 'SAR', rule: 'Only alternatives passing every gate are ranked.',
  recommendation: { key: 'alt-2', statement: 'Vendor B has the lowest 5-year TCO among the alternatives passing every mandatory gate.', confidence: 'HIGH' },
  results: [
    { key: 'alt-1', name: 'Current CRM', kind: 'CURRENT', annualRecurring: 100000, oneTime: 0, tco3: 300000, tco5: 500000, pv5: 450000, eligibility: 'ELIGIBLE', excludedBy: [], unverifiedGates: [], qualityScore: 60, unpricedLines: [], excludedLines: [], saving5VsCurrent: null, rank: null },
    { key: 'alt-2', name: 'Vendor B', kind: 'ALTERNATIVE', annualRecurring: 50000, oneTime: 40000, tco3: 190000, tco5: 290000, pv5: 260000, eligibility: 'ELIGIBLE', excludedBy: [], unverifiedGates: [], qualityScore: 80, unpricedLines: [], excludedLines: [], saving5VsCurrent: 210000, rank: 1 },
    { key: 'alt-3', name: 'Vendor C', kind: 'ALTERNATIVE', annualRecurring: 0, oneTime: 0, tco3: 0, tco5: 0, pv5: 0, eligibility: 'EXCLUDED', excludedBy: ['securityApproved'], unverifiedGates: [], qualityScore: null, unpricedLines: ['annualLicense'], excludedLines: [], saving5VsCurrent: null, rank: null },
  ],
}
const CHECKS = [
  { code: 'NCA_ECC', name: 'NCA Essential Cybersecurity Controls (ECC)', nameAr: 'الضوابط', authority: 'NCA', why: 'Systems are retired', status: 'NOT_REVIEWED' },
  { code: 'PDPL', name: 'Personal Data Protection Law (PDPL)', nameAr: 'نظام', authority: 'SDAIA', why: 'Data is migrated', status: 'MET', at: '2026-10-02', note: 'DPO confirmed' },
]
const OPP2 = {
  ...OPP, alternatives: [{ key: 'alt-1', name: 'Current CRM', kind: 'CURRENT', costs: { annualLicense: { amount: 100000, currency: 'SAR', basis: 'CONTRACT' } }, gates: {}, scores: {}, sources: [] }],
  alternativesComparison: COMPARISON, complianceChecks: CHECKS, narrative: null, research: { id: 'r1', title: 'CRM market', status: 'COMPLETED', decision: 'INTRODUCE_NEW' },
}

describe('Financial Value - usage, alternatives, compliance, agents, scenarios', () => {
  it('shows productivity hours, savings by department, cost data coverage, benchmarking and the extra reports', async () => {
    const summary = { ...SUMMARY, productivity: { count: 2, hoursPerYear: 5200, value: 260000 }, byDepartment: [{ key: 'IT Operations', count: 2, netAnnualSaving: 90000, realized: 10000 }], dataGaps: { objects: 10, withCost: 4, byType: [{ code: 'App', name: 'Application', objects: 10, withCost: 4 }] } }
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/summary': summary, '/financial-value/benchmarks': { optedIn: true, minPeers: 5, contributingPeers: 2, metrics: [{ metric: 'realizationRatePct', own: 40, peers: null }], rule: '' } })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-overview')).toBeInTheDocument())
    expect(screen.getByText(/5,200 fv.hours_year/)).toBeInTheDocument()
    expect(within(screen.getByTestId('fv-departments')).getByText('IT Operations')).toBeInTheDocument()
    await waitFor(() => expect(within(screen.getByTestId('fv-benchmarks')).getByText('fv.bench.too_few')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/fv.report.pptx/))
    await waitFor(() => expect(called(fetchMock, '/reports/executive.pptx?lang=EN', 'GET')).toHaveLength(1))
    fireEvent.change(screen.getByLabelText('fv.report.plan_year'), { target: { value: '2028' } })
    fireEvent.click(screen.getByText(/fv.report.plan$/))
    await waitFor(() => expect(called(fetchMock, '/reports/annual-plan.docx?year=2028&lang=EN', 'GET')).toHaveLength(1))
    fireEvent.click(screen.getByText('fv.view.ARCHITECTURE'))
    expect(within(screen.getByTestId('fv-data-gaps')).getByText('Application')).toBeInTheDocument()
  })

  it('compares alternatives by 5-year TCO, saves an unpriced line as vendor confirmation required and imports research candidates', async () => {
    mockInitial = 'opportunity=o1'
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/opportunities/o1/alternatives/from-research': { ...OPP2, alternatives: [...OPP2.alternatives, { key: 'research-1', name: 'SaaS CRM', kind: 'ALTERNATIVE', researchCandidate: 'SaaS CRM', costs: { annualLicense: { amount: null, currency: 'SAR', basis: 'UNKNOWN', source: 'Vendor confirmation required' } }, gates: {}, scores: {}, sources: [] }] }, '/financial-value/opportunities/o1': OPP2, '/users': [] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toBeInTheDocument())
    fireEvent.click(screen.getByText('fv.ws.alternatives'))
    const cmp = await screen.findByTestId('fv-alt-comparison')
    expect(within(cmp).getByText(/Vendor B has the lowest/)).toBeInTheDocument()
    expect(within(cmp).getByText('fv.alt.elig.EXCLUDED')).toBeInTheDocument()
    expect(within(cmp).getByText(/fv.alt.unpriced/)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/fv.alt.add$/))
    fireEvent.change(screen.getByLabelText('fv.alt.name'), { target: { value: 'Vendor D' } })
    fireEvent.change(screen.getByLabelText('fv.alt.cost.annualSupport fv.line.amount'), { target: { value: '20000' } })
    fireEvent.change(screen.getByLabelText('fv.alt.cost.annualLicense fv.alt.source'), { target: { value: 'awaiting quote' } })
    fireEvent.change(screen.getByLabelText('fv.alt.gate.securityApproved'), { target: { value: 'yes' } })
    fireEvent.click(screen.getByText('fv.alt.save'))
    await waitFor(() => expect(called(fetchMock, '/opportunities/o1/alternatives', 'PUT')).toHaveLength(1))
    const sent = JSON.parse(called(fetchMock, '/opportunities/o1/alternatives', 'PUT')[0][1].body).alternatives
    const d = sent.find((a: any) => a.name === 'Vendor D')
    expect(d.costs.annualSupport).toEqual(expect.objectContaining({ amount: 20000, basis: 'ESTIMATE' }))
    expect(d.costs.annualLicense).toEqual(expect.objectContaining({ amount: null, basis: 'UNKNOWN', source: 'awaiting quote' }))
    expect(d.gates).toEqual({ securityApproved: true, regulatoryCompliant: null, architectureCompatible: null })

    fireEvent.click(screen.getByText('fv.alt.from_research'))
    await waitFor(() => expect(screen.getByText(/SaaS CRM/)).toBeInTheDocument())
  })

  it('records regulatory reviews (a reason is needed for not applicable) and offers the printable business case', async () => {
    mockInitial = 'opportunity=o1'
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/opportunities/o1': { ...OPP2, businessCase: { version: 1 }, businessCaseVersion: 1 }, '/users': [] })
    global.fetch = fetchMock as any
    const open = jest.fn(() => ({})); (window as any).open = open
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toBeInTheDocument())
    fireEvent.click(screen.getByText('fv.ws.decisions'))
    const comp = await screen.findByTestId('fv-compliance')
    expect(within(comp).getByText('fv.comp.status.MET', { selector: 'span' })).toBeInTheDocument()
    expect(within(comp).getByText('fv.comp.disclaimer')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('fv.comp.record', { selector: '#fv-cs-NCA_ECC' }), { target: { value: 'NOT_APPLICABLE' } })
    const save = within(comp).getAllByText('fv.save')[0]
    expect(save).toBeDisabled()
    fireEvent.change(document.getElementById('fv-cn-NCA_ECC')!, { target: { value: 'No system holds controlled data' } })
    fireEvent.click(save)
    await waitFor(() => expect(called(fetchMock, '/opportunities/o1/compliance')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/opportunities/o1/compliance')[0][1].body)).toEqual(expect.objectContaining({ code: 'NCA_ECC', status: 'NOT_APPLICABLE', note: 'No system holds controlled data' }))
    fireEvent.click(screen.getByText(/fv.print.business_case/))
    await waitFor(() => expect(called(fetchMock, '/opportunities/o1/business-case.html?lang=EN', 'GET')).toHaveLength(1))
    await waitFor(() => expect(open).toHaveBeenCalled())
  })

  it('writes the AI executive summary and adds AI-suggested cost lines without amounts', async () => {
    mockInitial = 'opportunity=o1'
    const fetchMock = route({
      '/financial-value/me': ALL, '/financial-value/opportunities/o1/narrative': { text: 'Saves 120000 a year.', language: 'EN', generatedAt: '2026-10-10', basisHash: 'abc' },
      '/financial-value/opportunities/o1/suggest-assumptions': { suggestions: [{ kind: 'ONE_TIME', category: 'TRAINING', label: 'End-user training', why: 'New screens' }], rule: '' },
      '/financial-value/opportunities/o1': OPP2, '/users': [], '/financial-value/costs': [],
    })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-narrative')).toBeInTheDocument())
    fireEvent.click(screen.getByText('fv.narr.write'))
    await waitFor(() => expect(called(fetchMock, '/opportunities/o1/narrative')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/opportunities/o1/narrative')[0][1].body)).toEqual({ language: 'EN' })
    fireEvent.click(screen.getByText('fv.ws.financials'))
    fireEvent.click(await screen.findByText('fv.suggest.run'))
    fireEvent.click(await screen.findByText('fv.suggest.add'))
    fireEvent.click(screen.getByText('fv.model.save'))
    await waitFor(() => expect(called(fetchMock, '/opportunities/o1/model', 'PUT')).toHaveLength(1))
    const model = JSON.parse(called(fetchMock, '/opportunities/o1/model', 'PUT')[0][1].body)
    expect(model.oneTime).toEqual(expect.arrayContaining([expect.objectContaining({ label: 'End-user training', basis: 'AI_SUGGESTED', category: 'TRAINING' })]))
    expect(model.oneTime.find((l: any) => l.label === 'End-user training').amount).toBeUndefined()
  })

  it('runs an agent review and opens the opportunity behind a finding', async () => {
    mockInitial = 'tab=agents'
    const brief = (code: string) => ({ agent: { code }, brief: { agent: code, scope: { opportunities: 3 }, figures: { open: 2, quantifiedAnnual: 120000, costAvoidance: 0, realized: 0 }, observations: [{ code: 'UNQUANTIFIED', severity: 'MEDIUM', opportunityId: 'o1', title: 'Consolidate payroll systems', detail: 'Not quantified', action: 'Request the missing data', actor: 'DATA_OWNER' }], limits: [] }, narrative: null })
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/agents/': (url: string) => brief(url.split('/agents/')[1].split('/')[0]), '/financial-value/opportunities/o1': OPP2, '/users': [] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    const obs = await screen.findByTestId('fv-observations')
    expect(within(obs).getByText('fv.agents.actor.DATA_OWNER')).toBeInTheDocument()
    fireEvent.click(screen.getByText('fv.agent.CONTRACT_INTELLIGENCE'))
    await waitFor(() => expect(called(fetchMock, '/agents/CONTRACT_INTELLIGENCE/brief')).toHaveLength(1))
    fireEvent.click(screen.getByLabelText(/fv.agents.narrate/))
    fireEvent.click(screen.getByText('fv.agents.run'))
    await waitFor(() => expect(JSON.parse(called(fetchMock, '/agents/CONTRACT_INTELLIGENCE/brief')[1][1].body)).toEqual({ narrate: true, language: 'EN' }))
    fireEvent.click(within(await screen.findByTestId('fv-observations')).getByText('Consolidate payroll systems'))
    await waitFor(() => expect(screen.getByTestId('fv-workspace')).toBeInTheDocument())
  })

  it('compares the running cost of a scenario with the Current architecture and downloads its report', async () => {
    mockInitial = 'tab=scenarios'
    const cost = { scenario: { id: 's1', name: 'Target 2027', type: 'TARGET' }, currency: 'SAR', current: { annual: 500000, validated: 400000, objectsWithCost: 5, objects: 8 }, target: { annual: 300000, validated: 300000, objectsWithCost: 4, objects: 7, additions: 0 }, difference: -200000, removed: [{ id: 'a', name: 'Legacy Payroll', domain: 'APP', annual: 200000 }], introduced: [{ id: 'n', name: 'New HR Suite', domain: 'APP', annual: null }], byDomain: [{ domain: 'APP', current: 500000, scenario: 300000, difference: -200000 }], coverage: { currentPct: 62.5, scenarioPct: 57.1 }, notes: ['1 object(s) the scenario introduces have no recorded cost.'], opportunities: [] }
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/scenarios/s1/cost': cost, '/financial-value/scenarios': [{ id: 's1', name: 'Target 2027', type: 'TARGET' }] })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    fireEvent.change(await screen.findByLabelText('fv.scenario'), { target: { value: 's1' } })
    await waitFor(() => expect(screen.getByText('-200,000 SAR', { selector: '.ah-tile-value' })).toBeInTheDocument())
    expect(screen.getByText('fv.scn.no_cost', { exact: false })).toBeInTheDocument()
    fireEvent.click(screen.getByText(/fv.scn.report/))
    await waitFor(() => expect(called(fetchMock, '/reports/scenario/s1.docx?lang=EN', 'GET')).toHaveLength(1))
  })

  it('records measured usage, imports a cloud billing export and documents the ingestion API', async () => {
    mockInitial = 'tab=usage'
    const rows = [{ id: 'u1', kind: 'INFRASTRUCTURE', resourceName: 'vm-dr-01', assetId: null, assetName: null, environment: 'PROD', redundancyRole: 'DR', metrics: { cpuAvgPct: 2 }, monthlyCost: 900, currency: 'SAR', periodStart: '2026-09-01', periodEnd: '2026-09-30', source: 'MANUAL' }]
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/usage': (url: string, init: any) => (init?.method === 'POST' ? { id: 'u2', warnings: [] } : rows), '/financial-value/ingest/cloud-billing': { format: 'AWS_CUR', label: 'AWS Cost and Usage Report', resources: 4, skippedLines: 0, unlinkedResources: 1, counts: { CREATED: 4 }, note: 'Tag them' } })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    const table = await screen.findByTestId('fv-usage-table')
    expect(within(table).getByText('fv.usage.role.DR')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('fv.usage.resource', { selector: 'input' }), { target: { value: 'vm-test-02' } })
    fireEvent.change(screen.getByLabelText('fv.usage.environment', { selector: 'select' }), { target: { value: 'TEST' } })
    fireEvent.change(screen.getByLabelText('fv.usage.m.cpuAvgPct'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('fv.usage.monthly', { selector: 'input' }), { target: { value: '1200' } })
    fireEvent.click(screen.getByText('fv.usage.save'))
    await waitFor(() => expect(called(fetchMock, '/financial-value/usage')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/financial-value/usage')[0][1].body)).toEqual(expect.objectContaining({ kind: 'INFRASTRUCTURE', resourceName: 'vm-test-02', environment: 'TEST', monthlyCost: 1200, metrics: { cpuAvgPct: 4, alwaysOn: false } }))
    fireEvent.change(screen.getByLabelText('fv.billing.file'), { target: { files: [new File(['a,b'], 'cur.csv')] } })
    fireEvent.click(screen.getByText('fv.billing.import'))
    expect(await screen.findByTestId('fv-billing-result')).toHaveTextContent('Tag them')
    expect(screen.getByTestId('fv-ingest-api')).toHaveTextContent('/financial-value/ingest')
  })

  it('saves the usage thresholds, benchmarking opt-in and the EA Views cost overlay through the Tenant Settings API', async () => {
    mockInitial = 'tab=settings'
    const settings = { baseCurrency: 'SAR', exchangeRates: { USD: 3.75 }, discountRatePct: 6, escalationRatePct: 3, horizonYears: 5, renewalAlertDays: 120, licenseUnusedThresholdPct: 20, licenseMinUnusedUnits: 5, utilizationMaxAgeDays: 180, strategicThreshold: 1000000, segregationOfDuties: true, continuousDiscovery: true, criteriaWeights: {}, infraIdleDays: 30, cpuAvgThresholdPct: 10, cpuPeakThresholdPct: 40, memPeakThresholdPct: 50, targetPeakUtilizationPct: 70, nonProdHoursPerWeek: 60, processMinHoursPerYear: 500, benchmarkingOptIn: false, costOverlayInViews: false }
    const fetchMock = route({ '/financial-value/me': ALL, '/config/financial-value': (url: string, init: any) => (init?.method === 'PUT' ? JSON.parse(init.body) : settings) })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await screen.findByTestId('fv-settings-usage')
    fireEvent.change(screen.getByLabelText('fv.set.infraIdleDays'), { target: { value: '45' } })
    fireEvent.click(screen.getByLabelText(/fv.set.benchmarking$/))
    fireEvent.click(screen.getByLabelText(/fv.set.overlay$/))
    fireEvent.click(screen.getByText('fv.save'))
    await waitFor(() => expect(called(fetchMock, '/config/financial-value', 'PUT')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/config/financial-value', 'PUT')[0][1].body)).toEqual(expect.objectContaining({ infraIdleDays: 45, benchmarkingOptIn: true, costOverlayInViews: true, processMinHoursPerYear: 500 }))
  })

  it('benchmarks the organization\'s own costs and looks up sourced market prices for a licence', async () => {
    mockInitial = 'tab=benchmarks'
    const internal = {
      method: 'FVI-BENCH-INT-1', currency: 'SAR', notes: ['A group is benchmarked only with at least 3 data points.'],
      unitCostByType: [{ type: 'App', typeName: 'Application', objects: 5, enoughData: true, p25: 100, median: 120, p75: 130, total: 1360, outliers: [{ id: 'e', name: 'Legacy ERP', annual: 900, timesMedian: 7.5 }] }],
      licenseUtilization: { median: 90, measured: 3, notMeasured: 1, rows: [{ id: 'l1', productName: 'CRM', vendor: 'V', quantity: 100, used: 40, utilizationPct: 40, belowMedianBy: 50, unusedCost: 60000 }] },
      priceVariance: [{ productName: 'Office E3', metric: 'USER', lowestUnitCost: 900, highestUnitCost: 1200, spreadPct: 33.3, gapToLowest: 30000, entries: [{ id: 'a', vendor: 'Reseller A', quantity: 100, unitCost: 1200 }] }],
      vendorConcentration: { total: 1000, vendors: [{ vendor: 'ACME', annual: 750, sharePct: 75 }], topVendorSharePct: 75, hhi: 6250, concentration: 'HIGH' }, costCentres: [{ key: 'IT', annual: 1000, sharePct: 100 }],
    }
    const done = { id: 'm1', subject: 'CRM', status: 'COMPLETED', createdAt: '2026-10-14', figures: [{ label: 'Enterprise', value: 35, currency: 'USD', unit: 'per user', period: 'MONTH', sourceUrl: 'https://v.example/p', sourceTitle: 'Pricing', quote: 'USD 35 per user per month', grounding: 'VERIFIED', publishedAt: null }], dropped: [{ label: 'Pro', reason: 'No source' }], comparison: { ownAnnualUnitCost: 1890, currency: 'SAR', rows: [{ label: 'Enterprise', marketAnnual: 1575, differencePct: 20, note: null }], rule: 'Check the licence metric.' } }
    const fetchMock = route({
      '/financial-value/me': ALL, '/financial-value/benchmarks/internal': internal,
      '/financial-value/benchmarks/market': (url: string, init: any) => (init?.method === 'POST' ? { ...done, status: 'RUNNING', figures: [], comparison: null } : []),
      '/financial-value/benchmarks/market/m1': done,
      '/financial-value/licenses': [{ id: 'l1', productName: 'CRM', vendor: 'V' }], '/financial-value/contracts': [], '/financial-value/benchmarks': { optedIn: false, minPeers: 5, metrics: [] },
    })
    global.fetch = fetchMock as any
    jest.useFakeTimers()
    render(<FinancialValuePage />)
    expect(await within(await screen.findByTestId('fv-bench-types')).findByText('Legacy ERP')).toBeInTheDocument()
    expect(within(screen.getByTestId('fv-bench-prices')).getByText(/30,000 SAR/)).toBeInTheDocument()
    expect(within(screen.getByTestId('fv-bench-vendors')).getByText('fv.bi.conc.HIGH')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('fv.bm.kind.LICENSE', { selector: 'select' }).querySelectorAll('option').length).toBe(2))
    fireEvent.change(screen.getByLabelText('fv.bm.kind.LICENSE', { selector: 'select' }), { target: { value: 'l1' } })
    fireEvent.click(screen.getByText('fv.bm.run'))
    await waitFor(() => expect(called(fetchMock, '/financial-value/benchmarks/market')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/financial-value/benchmarks/market')[0][1].body)).toEqual(expect.objectContaining({ subjectKind: 'LICENSE', subjectId: 'l1', language: 'EN' }))
    expect(await screen.findByText('fv.bm.running')).toBeInTheDocument()
    jest.advanceTimersByTime(4100)
    jest.useRealTimers()
    const compare = await screen.findByTestId('fv-bench-compare')
    expect(compare).toHaveTextContent('1,575 SAR')
    expect(screen.getByText('fv.bm.ground.VERIFIED')).toBeInTheDocument()
    expect(screen.getByText('Pricing').closest('a')).toHaveAttribute('href', 'https://v.example/p')
  })
})

describe('Financial Value - stale candidates', () => {
  it('dismisses stale discovery candidates with a reason', async () => {
    const summary = { ...SUMMARY, queues: { ...SUMMARY.queues, staleCandidates: 4 } }
    const fetchMock = route({ '/financial-value/me': ALL, '/financial-value/summary': summary, '/financial-value/discovery/dismiss-stale': { dismissed: 4, failed: [] }, '/financial-value/benchmarks': { optedIn: false, metrics: [] } })
    global.fetch = fetchMock as any
    render(<FinancialValuePage />)
    await waitFor(() => expect(screen.getByTestId('fv-overview')).toBeInTheDocument())
    fireEvent.click(screen.getByText('fv.view.ARCHITECTURE'))
    const box = screen.getByTestId('fv-dismiss-stale')
    expect(within(box).getByText('fv.stale.dismiss')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('fv.reason'), { target: { value: 'Different tools, broad capability only' } })
    fireEvent.click(within(box).getByText('fv.stale.dismiss'))
    await waitFor(() => expect(called(fetchMock, '/financial-value/discovery/dismiss-stale')).toHaveLength(1))
    expect(JSON.parse(called(fetchMock, '/financial-value/discovery/dismiss-stale')[0][1].body)).toEqual({ reason: 'Different tools, broad capability only' })
  })
})
