import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ExecutiveInsights, CapabilityInsight, ImprovementActions, CapabilityAdvisor } from '../bcm/Insights';
import { ReferenceComparison, ProvenanceStatus } from '../bcm/ReferenceModels';
import { AssessmentsPanel } from '../bcm/Assessments';

let mockUser: any = { userId: 'arch' };
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, hasPermission: () => true }) }));
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: false, locale: 'EN', t: (k: string) => k }) }));

let calls: Array<{ url: string; method: string; body: any }> = [];
function mockFetch(routes: Record<string, any>) {
  calls = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    const method = opts?.method || 'GET';
    calls.push({ url, method, body: opts?.body ? JSON.parse(opts.body) : undefined });
    const k = keys.find(p => { const [m, path] = p.includes(' ') ? p.split(' ') : ['ANY', p]; return (m === 'ANY' || m === method) && url.split('?')[0].endsWith(path); });
    const v = k ? (typeof routes[k] === 'function' ? routes[k](url, opts) : routes[k]) : {};
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(v) });
  }) as any;
}
const L = (en: string, ar: string) => (mockAR ? ar : en);
let mockAR = false;
beforeEach(() => { mockAR = false; mockUser = { userId: 'arch' }; localStorage.setItem('ea_token', 't'); jest.spyOn(window, 'confirm').mockReturnValue(true); });

const exec = {
  maturityDistribution: { NOT_ASSESSED: 2, '1': 0, '2': 1, '3': 0, '4': 1, '5': 0 },
  criticalBelowTarget: [{ id: 'lm', name: 'Last Mile Delivery', gap: 1.7 }], largestMaturityGaps: [{ id: 'lm', name: 'Last Mile Delivery', gap: 1.7 }],
  highestMaterialGaps: [{ id: 'lm', name: 'Last Mile Delivery', materiality: 81, band: 'HIGH' }], weakEvidenceHighClaim: [], deteriorating: [],
  materialGapsWithoutActions: [{ id: 'lm', name: 'Last Mile Delivery', materiality: 81 }], actionsWithoutInitiative: 2, referenceGaps: 3, insufficientData: 2,
  objectivesAtRisk: [{ goalId: 'g', title: 'Same-day delivery nationwide', capabilities: [{ id: 'lm', name: 'Last Mile Delivery' }] }], actionStatus: {}, totals: { capabilities: 4, activeActions: 2 },
};

describe('executive insights: summary -> filter -> drill-down', () => {
  it('summary tiles filter a list; clicking opens the capability', async () => {
    mockFetch({ '/insights/executive': exec });
    const open = jest.fn();
    render(<ExecutiveInsights L={L} onOpenCapability={open} />);
    expect(await screen.findByTestId('tile-criticalBelowTarget')).toHaveTextContent('1');
    expect(screen.getByTestId('actions-without-initiative')).toHaveTextContent('2');
    expect(screen.getByText(/missing data, not low priority/)).toBeInTheDocument();
    expect(screen.getByText(/not automatically deficiencies/)).toBeInTheDocument();
    expect(screen.queryByTestId('insight-list')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tile-highestMaterialGaps'));
    fireEvent.click(within(screen.getByTestId('insight-list')).getByText('Last Mile Delivery'));
    expect(open).toHaveBeenCalledWith('lm');
    fireEvent.click(screen.getByTestId('tile-objectivesAtRisk'));
    expect(screen.getByText('Same-day delivery nationwide')).toBeInTheDocument();
  });
});

describe('capability insight', () => {
  const detail = {
    capability: { id: 'lm', name: 'Last Mile Delivery' },
    healthProfile: { items: [{ key: 'maturity', value: 4.2, band: 'STRONG', availability: 'AVAILABLE' }, { key: 'performance', value: 'POOR', band: 'CONCERN', availability: 'AVAILABLE' }, { key: 'riskExposure', value: null, band: null, availability: 'DATA_NOT_AVAILABLE' }], contradictions: [{ code: 'HIGH_MATURITY_POOR_PERFORMANCE', message: 'Maturity 4.2 is high but performance is POOR' }] },
    healthIndicator: { enabled: false },
    gaps: [{ lens: 'MATURITY', status: 'NO_GAP', explanation: 'meets target', missing: [] }, { lens: 'RISK', status: 'DATA_NOT_AVAILABLE', explanation: 'needs data', missing: ['risk exposure'] }],
    materiality: { band: 'INSUFFICIENT_DATA', score: null, explanation: 'Only 2 of 8 factors have data. This is missing data, not low priority.', factors: [] },
    trend: { observed: [{ assessmentId: 'a1', assessedAt: '2026-03-01T00:00:00Z', finalScore: 3.1, evidenceConfidence: 'LOW', gap: 0.9 }], target: { value: 4, kind: 'TARGET_NOT_FORECAST' }, direction: null },
    strategy: [], actions: [], initiatives: [], recommendations: [],
  };
  it('shows the profile (not a single number), missing data explicitly, contradictions, lenses, and target-is-not-forecast', async () => {
    mockFetch({ '/insights/capabilities/lm': detail });
    render(<CapabilityInsight id="lm" L={L} isAR={false} onClose={jest.fn()} />);
    expect(await screen.findByTestId('health-maturity')).toHaveTextContent('4.2 / 5');
    expect(screen.getByTestId('health-riskExposure')).toHaveTextContent('Data not available');
    expect(screen.getByTestId('contradictions')).toHaveTextContent(/high but performance is POOR/);
    expect(screen.queryByTestId('health-indicator')).not.toBeInTheDocument();
    expect(screen.getByTestId('gap-RISK')).toHaveTextContent(/Data not available.*missing: risk exposure/);
    expect(screen.getByTestId('materiality-band')).toHaveTextContent('Insufficient data');
    expect(screen.getByTestId('trend-target')).toHaveTextContent('The target is a goal, not a forecast.');
  });
  it('an enabled composite indicator is secondary and shows its formula and inputs', async () => {
    mockFetch({ '/insights/capabilities/lm': { ...detail, healthIndicator: { enabled: true, value: 60, formula: 'Σ(weight × normalized) / Σ(weight)', components: [{ key: 'maturity', raw: 4.2, normalized: 80, weight: 1 }], note: 'Secondary indicator only.' } } });
    render(<CapabilityInsight id="lm" L={L} isAR={false} onClose={jest.fn()} />);
    expect(await screen.findByTestId('health-indicator')).toHaveTextContent(/Secondary composite indicator: 60/);
    expect(screen.getByTestId('health-indicator')).toHaveTextContent(/Σ\(weight × normalized\)/);
  });
});

describe('improvement actions UI', () => {
  const action = { id: 'x', recommendedAction: 'Standardise route planning', gapDescription: 'Maturity 2.3 vs 4', status: 'PROPOSED', priority: 'HIGH', gapType: 'MATURITY', createdBy: 'arch', origin: 'ADVISOR', originalRecommendation: { what: 'Prioritise Last Mile', why: 'critical' }, events: [{ eventType: 'CREATED', createdAt: '2026-09-27T10:00:00Z', toStatus: 'PROPOSED' }] };
  const routes = (a: any) => ({ 'GET /insights/actions': [a], 'GET /insights/actions/x': a, 'GET /insights/actions/initiative-options': [{ id: 'ini1', name: 'Route optimisation programme' }], 'POST /insights/actions/x/decision': {}, 'POST /insights/actions/x/initiative': {}, 'POST /insights/actions/x/progress': {} });
  it('the creator cannot decide; another approver can accept; original advisor recommendation is preserved', async () => {
    mockFetch(routes(action));
    const { unmount } = render(<ImprovementActions L={L} can={{ manage: true, approve: true, link: true }} userId="arch" />);
    fireEvent.click(await screen.findByText('Standardise route planning'));
    expect(await screen.findByTestId('action-needs-other-approver')).toBeInTheDocument();
    expect(screen.getByText('Original advisor recommendation')).toBeInTheDocument();
    unmount();
    mockFetch(routes(action));
    render(<ImprovementActions L={L} can={{ manage: true, approve: true, link: true }} userId="rev" />);
    fireEvent.click(await screen.findByText('Standardise route planning'));
    fireEvent.click(await screen.findByText('Accept'));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/decision'))?.body).toEqual({ decision: 'ACCEPTED' }));
  });
  it('links an EXISTING initiative (search) and progresses without skipping', async () => {
    mockFetch(routes({ ...action, status: 'ACCEPTED' }));
    render(<ImprovementActions L={L} can={{ manage: true, approve: true, link: true }} userId="rev" />);
    fireEvent.click(await screen.findByText('Standardise route planning'));
    fireEvent.click(await screen.findByText('Route optimisation programme'));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/initiative'))?.body).toEqual({ id: 'ini1' }));
    expect(screen.queryByRole('button', { name: 'COMPLETED' })).not.toBeInTheDocument(); // cannot skip ahead
    expect(screen.queryByRole('button', { name: 'IN PROGRESS' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'PLANNED' }));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/progress'))?.body).toEqual({ to: 'PLANNED' }));
  });
});

describe('advisor UI', () => {
  const rec = { id: 'r1', what: 'Prioritise "Last Mile Delivery": it is business-critical with low maturity.', why: '"Last Mile Delivery" is classified VERY_HIGH for business criticality and has current maturity 2.3 against target 4.', signalType: 'CRITICAL_LOW_MATURITY', confidence: 'MEDIUM', provenance: 'RULE+AI_EXPLANATION', materiality: { band: 'HIGH' }, supportingFacts: { currentMaturity: 2.3 }, dataLimitations: ['referenceRelevance not available'], aiExplanation: 'This matters because…' };
  it('shows what, why, facts, provenance, limitations, AI explanation separately; decisions need rationale', async () => {
    mockFetch({ 'GET /insights/advisor/recommendations': [rec], 'POST /insights/advisor/recommendations/r1/decision': {}, 'POST /insights/advisor/run': { created: 1, skipped: 4 } });
    jest.spyOn(window, 'prompt').mockReturnValueOnce('Out of scope this year');
    render(<CapabilityAdvisor L={L} can={{ run: true, decide: true }} />);
    expect(await screen.findByText(/current maturity 2.3 against target 4/)).toBeInTheDocument();
    expect(screen.getByText(/Rule \+ AI explanation/)).toBeInTheDocument();
    expect(screen.getByText(/referenceRelevance not available/)).toBeInTheDocument();
    expect(screen.getByTestId('ai-explanation')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/decision'))?.body).toEqual({ decision: 'REJECT', rationale: 'Out of scope this year' }));
    fireEvent.click(screen.getByText('Run advisor'));
    expect(await screen.findByText(/1 new recommendation\(s\); 4 unchanged or already decided/)).toBeInTheDocument();
    expect(calls.find(c => c.url.endsWith('/run'))?.body).toEqual({ includeAiExplanation: false });
  });
  it('without decide permission there are no decision buttons', async () => {
    mockFetch({ 'GET /insights/advisor/recommendations': [rec] });
    render(<CapabilityAdvisor L={L} can={{ run: false, decide: false }} />);
    await screen.findByText(/current maturity 2.3/);
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Run advisor')).not.toBeInTheDocument();
  });
});

describe('reference gaps: dispositions, provenance vs status, version awareness', () => {
  it('provenance and status are separate; curated models are never presented as official', () => {
    render(<ProvenanceStatus provenance="ARCHMIND_CURATED" status="PUBLISHED" L={L} />);
    expect(screen.getByTestId('provenance-status')).toHaveTextContent('Provenance: ArchMind curatedStatus: Published');
    expect(screen.getByTestId('provenance-status')).toHaveTextContent(/not an official industry standard/);
  });
  it('records a disposition with rationale against the compared version; shows stale dispositions and the update banner', async () => {
    const data = {
      model: { provenance: 'ARCHMIND_CURATED' }, version: { id: 'v2', status: 'PUBLISHED' },
      versionAwareness: { updateAvailable: true, tenantVersion: { version: '0.1-draft' }, latestVersion: { version: '0.2' } },
      summary: { MISSING: 2, POSSIBLE_MATCH: 0, EXISTING: 0, CUSTOM_TENANT_CAPABILITY: 0, POSSIBLE_DUPLICATE: 0, UNRESOLVED: 1, DISPOSITIONED: 1 },
      reference: [
        { cls: 'MISSING', reference: { id: 'r1', stableKey: 'LOG.XB', name: 'Customs & Cross-Border Trade', level: 1 }, candidates: [], resolved: false, disposition: null },
        { cls: 'MISSING', reference: { id: 'r2', stableKey: 'LOG.FLEET', name: 'Fleet Management', level: 1 }, candidates: [], resolved: false, disposition: { disposition: 'NOT_APPLICABLE', stale: true } },
      ], tenant: [],
    };
    mockFetch({ '/reference-versions/v2/compare': data, 'POST /reference-gap-dispositions': {} });
    jest.spyOn(window, 'prompt').mockReturnValueOnce('Domestic operator only');
    render(<ReferenceComparison versionId="v2" L={L} isAR={false} onReview={jest.fn()} />);
    expect(await screen.findByTestId('reference-update')).toHaveTextContent(/Nothing is migrated automatically/);
    expect(screen.getByTestId('unresolved-count')).toHaveTextContent('Unresolved: 1 · Dispositioned: 1');
    expect(screen.getByTestId('disposition-LOG.FLEET')).toHaveTextContent(/reference changed, review again/);
    fireEvent.change(screen.getByLabelText('Disposition Customs & Cross-Border Trade'), { target: { value: 'NOT_APPLICABLE' } });
    await waitFor(() => expect(calls.find(c => c.method === 'POST')?.body).toEqual({ referenceVersionId: 'v2', stableKey: 'LOG.XB', disposition: 'NOT_APPLICABLE', rationale: 'Domestic operator only' }));
  });
});

describe('consensus workspace', () => {
  it('shows each flagged dimension with roles, claimed vs adjusted, evidence, comments, median, previous, target; records agreement', async () => {
    mockFetch({
      'GET /business-capabilities/assessments': [{ id: 'a1', name: 'Q3', status: 'VALIDATION', _count: { scope: 1 } }],
      'GET /business-capabilities/assessments/a1/progress': { assessment: { id: 'a1', name: 'Q3', status: 'VALIDATION', results: [{ id: 'r1', capabilityAssetId: 'c', status: 'FLAGGED_FOR_VALIDATION', finalScore: null, dimensionScores: [], varianceFlags: [{ dimension: 'PROCESS', respondentScores: [{ score: 2 }, { score: 5 }] }] }] }, assignments: [] },
      'GET /business-capabilities/capabilities': [],
      'GET /business-capabilities/assessments/a1/consensus': { items: [{ resultId: 'r1', dimension: 'PROCESS', spread: 3, threshold: 1, provisionalMedian: 3.5, previousPublished: 2.8, targetMaturity: 4, bounds: { lower: 2, upper: 5 }, validation: null,
        respondents: [{ assignmentId: 'x', role: 'OWNER', rawScore: 5, evidenceAdjustedScore: 5, evidence: [{ verified: true }], comments: ['SOP is published'] }, { assignmentId: 'y', role: 'IT', rawScore: 3, evidenceAdjustedScore: 2, evidence: [{ verified: false }], comments: [] }] }] },
      'POST /business-capabilities/assessments/a1/results/r1/dimensions/validate': { result: null },
    });
    render(<AssessmentsPanel L={L} isAR={false} can={{ assess: true, validate: true, approve: true, publish: true }} />);
    fireEvent.click(await screen.findByText('Q3'));
    const row = await screen.findByTestId('consensus-PROCESS');
    expect(row).toHaveTextContent(/provisional median 3.5 · previous 2.8 · target 4/);
    expect(row).toHaveTextContent('SOP is published');
    fireEvent.change(within(row).getByLabelText('Agreed score PROCESS'), { target: { value: '3.5' } });
    fireEvent.change(within(row).getByLabelText('Rationale PROCESS'), { target: { value: 'Workshop consensus' } });
    fireEvent.click(within(row).getByText('Record agreement'));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/dimensions/validate'))?.body).toEqual({ dimension: 'PROCESS', agreedScore: 3.5, rationale: 'Workshop consensus' }));
  });
});

describe('Arabic', () => {
  it('executive insights and provenance render in Arabic', async () => {
    mockAR = true;
    mockFetch({ '/insights/executive': exec });
    render(<><ExecutiveInsights L={L} onOpenCapability={jest.fn()} /><ProvenanceStatus provenance="ARCHMIND_CURATED" status="PUBLISHED" L={L} /></>);
    expect(await screen.findByText('حرجة دون المستهدف')).toBeInTheDocument();
    expect(screen.getByTestId('provenance-status')).toHaveTextContent('منسّق من ArchMind');
  });
});
