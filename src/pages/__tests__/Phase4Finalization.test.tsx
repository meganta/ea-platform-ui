import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExecutiveOverview, TraceabilityPanel, InitiativeCoverage, ImprovementActions, ReportsPanel } from '../bcm/Insights';
import { UpgradeReview } from '../bcm/ReferenceModels';
import { AssessmentsPanel } from '../bcm/Assessments';
import BusinessCapabilitiesPage from '../BusinessCapabilitiesPage';

let mockUser: any = { userId: 'arch' };
let mockAR = false;
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, hasPermission: () => true }) }));
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockAR, locale: mockAR ? 'AR' : 'EN', t: (k: string) => k }) }));

let calls: Array<{ url: string; method: string; body: any }> = [];
function mockFetch(routes: Record<string, any>, headers: Record<string, string> = {}) {
  calls = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    const method = opts?.method || 'GET';
    calls.push({ url, method, body: opts?.body ? JSON.parse(opts.body) : undefined });
    const k = keys.find(p => { const [m, path] = p.includes(' ') ? p.split(' ') : ['ANY', p]; return (m === 'ANY' || m === method) && url.split('?')[0].endsWith(path); });
    const v = k ? routes[k] : {};
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(v), blob: () => Promise.resolve(new Blob(['x'])), headers: { get: (h: string) => headers[h] ?? null } });
  }) as any;
}
const L = (en: string, ar: string) => (mockAR ? ar : en);
beforeEach(() => { mockUser = { userId: 'arch' }; mockAR = false; localStorage.setItem('ea_token', 't'); jest.spyOn(window, 'confirm').mockReturnValue(true); window.history.replaceState({}, '', '/business-capabilities'); });

const exec = { names: { lm: 'Last Mile Delivery', cx: 'Customs' }, kpis: { totalCapabilities: 12, assessmentCoverage: 58.3, medianMaturity: 2.6, averageTargetMaturity: 3.8, openImprovementActions: 4, actionsWithoutInitiative: 2, assessedCapabilities: { value: 7, ids: [] }, materialGaps: { value: 1, ids: ['lm'] }, criticalBelowTarget: { value: 1, ids: ['lm'] }, lowEvidenceConfidence: { value: 0, ids: [] }, deteriorating: { value: 0, ids: [] }, assessmentsDue: { value: 0, ids: [] }, assessmentsOverdue: { value: 1, ids: ['cx'] }, neverAssessed: { value: 5, ids: [] } } };

describe('executive overview', () => {
  it('headline KPIs and every KPI drills down to capabilities', async () => {
    mockFetch({ '/insights/executive': exec });
    const open = jest.fn();
    render(<ExecutiveOverview L={L} onOpenCapability={open} />);
    expect(await screen.findByTestId('kpi-coverage')).toHaveTextContent('58.3%');
    expect(screen.getByTestId('kpi-median')).toHaveTextContent('2.6');
    fireEvent.click(screen.getByTestId('kpi-assessmentsOverdue'));
    fireEvent.click(screen.getByText('Customs'));
    expect(open).toHaveBeenCalledWith('cx');
  });
  it('empty tenant and unexpected responses are handled', async () => {
    mockFetch({ '/insights/executive': { kpis: { ...exec.kpis, totalCapabilities: 0 } } });
    const { unmount } = render(<ExecutiveOverview L={L} onOpenCapability={jest.fn()} />);
    expect(await screen.findByText(/No capabilities yet/)).toBeInTheDocument();
    unmount();
    mockFetch({ '/insights/executive': {} });
    render(<ExecutiveOverview L={L} onOpenCapability={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/);
  });
});

describe('reports', () => {
  it('view (print to PDF) shows provenance and sections; downloads request the right format', async () => {
    mockFetch({ '/insights/reports/EXECUTIVE': { title: 'Executive Capability Report', generatedAt: '2026-09-29T10:00:00Z', provenance: { tenantId: 't', methodology: 'ArchMind defaults' }, summary: [{ label: 'Total capabilities', value: 12 }], sections: [{ title: 'Material gaps', columns: ['Capability'], rows: [['Last Mile Delivery']] }] } }, { 'Content-Disposition': 'attachment; filename="executive-2026-09-29.xlsx"' });
    global.URL.createObjectURL = jest.fn(() => 'blob:x'); global.URL.revokeObjectURL = jest.fn();
    render(<ReportsPanel L={L} />);
    fireEvent.click(screen.getAllByText('View / PDF')[0]);
    const view = await screen.findByTestId('report-view');
    expect(view).toHaveTextContent('methodology: ArchMind defaults');
    expect(view).toHaveTextContent('Last Mile Delivery');
    expect(view.textContent).not.toMatch(/tenantId/);
    fireEvent.click(screen.getAllByText('Excel')[0]);
    await waitFor(() => expect(calls.some(c => c.url.includes('/reports/EXECUTIVE?format=xlsx'))).toBe(true));
  });
});

describe('traceability and initiative coverage', () => {
  it('answers the cross-domain questions from actual relationships', async () => {
    mockFetch({ '/insights/traceability': { applicationsSupportingLowMaturityCriticalCapabilities: [{ capability: { id: 'lm', name: 'Last Mile Delivery', maturity: 2.1 }, applications: [{ name: 'Fleet Tracking' }] }], objectivesDependingOnMaterialGaps: [], gapsWithoutInitiativeCoverage: [{ id: 'lm', name: 'Last Mile Delivery', gaps: ['MATURITY'] }], capabilitiesOnUnhealthyArchitecture: [{ id: 'lm', name: 'Last Mile Delivery', architectureHealth: 'POOR', obsoleteComponents: [{ name: 'Legacy TMS', status: 'RETIRED' }] }] } });
    render(<TraceabilityPanel L={L} onOpenCapability={jest.fn()} />);
    const t = await screen.findByTestId('traceability');
    expect(t).toHaveTextContent('Applications supporting low-maturity critical capabilities (1)');
    fireEvent.click(screen.getByText(/Applications supporting low-maturity/));
    expect(t).toHaveTextContent('Fleet Tracking');
    fireEvent.click(screen.getByText(/unhealthy or obsolete/));
    expect(t).toHaveTextContent('Legacy TMS (RETIRED)');
  });
  it('initiative coverage lists the four views', async () => {
    mockFetch({ '/insights/initiative-coverage': { gapsWithInitiativeCoverage: [{ actionId: 'a', capability: { name: 'Last Mile' }, action: 'Routing', initiative: { name: 'LM Programme' } }], acceptedActionsWithoutInitiative: [], initiativesAddressingMultipleCapabilities: [{ initiative: { id: 'i', name: 'Digital Ops' }, capabilities: [{ name: 'A' }, { name: 'B' }] }], improvementsNotYetPlanned: [] } });
    render(<InitiativeCoverage L={L} />);
    expect(await screen.findByTestId('coverage-gapsWithInitiativeCoverage')).toHaveTextContent('LM Programme');
    expect(screen.getByTestId('coverage-initiativesAddressingMultipleCapabilities')).toHaveTextContent('Digital Ops: A, B');
    expect(screen.getByText(/Schedule initiatives on the roadmap in EA Planning/)).toBeInTheDocument();
  });
});

describe('governed initiative creation UI', () => {
  const action = (p: any) => ({ id: 'x', recommendedAction: 'Standardise routing', gapDescription: 'g', status: 'ACCEPTED', priority: 'HIGH', gapType: 'MATURITY', createdBy: 'arch', proposedInitiative: p, events: [] });
  const routes = (p: any) => ({ 'GET /insights/actions': [action(p)], 'GET /insights/actions/x': action(p), 'GET /insights/actions/initiative-options': [], 'POST /insights/actions/x/initiative-proposal/decision': {}, 'POST /insights/actions/x/initiative-proposal/create': {} });
  it('the proposer cannot approve; another approver can; creation is a separate, confirmed action that acknowledges duplicates', async () => {
    mockFetch(routes({ name: 'LM Programme', status: 'PROPOSED', proposedBy: 'arch', possibleDuplicates: [] }));
    const { unmount } = render(<ImprovementActions L={L} can={{ manage: true, approve: true, link: true }} userId="arch" />);
    fireEvent.click(await screen.findByText('Standardise routing'));
    expect(await screen.findByText(/You proposed it/)).toBeInTheDocument();
    unmount();
    mockFetch(routes({ name: 'LM Programme', status: 'PROPOSED', proposedBy: 'arch', possibleDuplicates: [] }));
    const r2 = render(<ImprovementActions L={L} can={{ manage: true, approve: true, link: true }} userId="rev" />);
    fireEvent.click(await screen.findByText('Standardise routing'));
    fireEvent.click(await screen.findByText('Approve proposal'));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/initiative-proposal/decision'))?.body).toEqual({ decision: 'APPROVED' }));
    expect(screen.queryByText('Create in repository')).not.toBeInTheDocument();
    r2.unmount();
    mockFetch(routes({ name: 'LM Programme', status: 'APPROVED', proposedBy: 'arch', possibleDuplicates: [{ name: 'Last Mile Programme' }] }));
    render(<ImprovementActions L={L} can={{ manage: true, approve: true, link: true }} userId="rev" />);
    fireEvent.click(await screen.findByText('Standardise routing'));
    expect(await screen.findByText(/Possible existing initiatives: Last Mile Programme/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create in repository'));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/Similar initiatives exist/));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/initiative-proposal/create'))?.body).toEqual({ acknowledgeDuplicates: true }));
  });
});

describe('reassessment and reference upgrade', () => {
  it('creates a reassessment from a published assessment and says nothing is copied', async () => {
    mockFetch({
      'GET /business-capabilities/assessments': [{ id: 'a1', name: 'Q1', status: 'PUBLISHED', _count: { scope: 1 } }],
      'GET /business-capabilities/assessments/a1/progress': { assessment: { id: 'a1', name: 'Q1', status: 'PUBLISHED', recommendedNextAssessmentAt: '2027-09-01T00:00:00Z', results: [] }, assignments: [] },
      'GET /business-capabilities/capabilities': [],
      'POST /business-capabilities/assessments/a1/reassess': { assessment: { id: 'a2' } },
    });
    render(<AssessmentsPanel L={L} isAR={false} can={{ assess: true, validate: true, approve: true, publish: true }} />);
    fireEvent.click(await screen.findByText('Q1'));
    expect(await screen.findByText(/Recommended next assessment: 2027-09-01/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create reassessment'));
    expect(await screen.findByTestId('reassessment-created')).toHaveTextContent(/nothing is copied as an answer/);
  });
  it('upgrade review shows current vs latest with UNCHANGED/MODIFIED/NEW/REMOVED and impacts', async () => {
    mockFetch({ '/reference-models/m/upgrade': { tenantVersion: { version: '0.1' }, latestVersion: { version: '0.2' }, counts: { UNCHANGED: 60, MODIFIED: 1, NEW: 1, REMOVED: 1 }, items: [
      { stableKey: 'A', name: 'Hub Operations', changeClass: 'MODIFIED', changedFields: ['description'], impact: 'REVIEW_YOUR_DECISION' },
      { stableKey: 'B', name: 'Drone Delivery', changeClass: 'NEW', changedFields: [], impact: 'CONSIDER_NEW_CAPABILITY' },
      { stableKey: 'C', name: 'Telegraph', changeClass: 'REMOVED', changedFields: [], impact: 'IMPACT_REVIEW' },
      { stableKey: 'D', name: 'Last Mile', changeClass: 'UNCHANGED', changedFields: [], impact: 'DECISION_CARRIES_FORWARD' } ] } });
    render(<UpgradeReview modelId="m" L={L} />);
    fireEvent.click(screen.getByText('Review what changed'));
    const r = await screen.findByTestId('upgrade-review');
    expect(r).toHaveTextContent('Current: 0.1 · Latest: 0.2');
    expect(r).toHaveTextContent('Hub Operations (description) - Changed - review your decision');
    expect(r).toHaveTextContent('Telegraph - Removed - review impact on your mapping');
    expect(r).toHaveTextContent('Last Mile - Your decision carries forward');
    expect(r).toHaveTextContent(/never changed automatically/);
  });
});

describe('navigation', () => {
  const base = { '/organization-context': { classificationStatus: 'CONFIRMED' }, '/capabilities/tree': { total: 0, roots: [], orphanIds: [], cycleIds: [] }, '/insights/executive': exec, '/insights/traceability': {}, '/insights/actions': [], '/reference-models': [], '/reference-recommendations': { recommendations: [] } };
  it('seven primary sections', async () => {
    mockFetch(base);
    render(<BusinessCapabilitiesPage />);
    const tabs = (await screen.findAllByRole('tab')).map(t => t.textContent);
    expect(tabs.slice(0, 7)).toEqual(['Overview', 'Capability Map', 'Capabilities', 'Assessments', 'Health & Gaps', 'Improvement', 'Reference Models']);
  });
  it('legacy ?tab= deep links still land in the right place; ?cap= opens a capability', async () => {
    window.history.replaceState({}, '', '/business-capabilities?tab=advisor');
    mockFetch({ ...base, '/insights/advisor/recommendations': [] });
    const { unmount } = render(<BusinessCapabilitiesPage />);
    expect(await screen.findByRole('tab', { name: 'Advisor' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Improvement' })).toHaveAttribute('aria-selected', 'true');
    unmount();
    window.history.replaceState({}, '', '/business-capabilities?cap=lm');
    mockFetch({ ...base, '/insights/capabilities/lm': { capability: { id: 'lm', name: 'Last Mile Delivery' }, healthProfile: { items: [], contradictions: [] }, healthIndicator: { enabled: false }, gaps: [], materiality: { band: 'LOW', score: 20, explanation: '', factors: [] }, trend: { observed: [], target: { value: null } }, strategy: [], actions: [], initiatives: [], recommendations: [] } });
    render(<BusinessCapabilitiesPage />);
    expect(await screen.findByText('Last Mile Delivery')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Health & Gaps' })).toHaveAttribute('aria-selected', 'true');
  });
  it('Arabic navigation', async () => {
    mockAR = true;
    mockFetch(base);
    render(<BusinessCapabilitiesPage />);
    expect(await screen.findByRole('tab', { name: 'السلامة والفجوات' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'النماذج المرجعية' })).toBeInTheDocument();
  });
});
