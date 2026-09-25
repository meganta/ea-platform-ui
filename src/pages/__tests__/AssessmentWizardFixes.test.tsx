import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssessmentsPanel, AssessWizard } from '../bcm/Assessments';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { userId: 'arch' }, hasPermission: () => true }) }));
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: false, locale: 'EN', t: (k: string) => k }) }));

let calls: Array<{ url: string; method: string; body: any }> = [];
function mockFetch(routes: Record<string, any>) {
  calls = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    const method = opts?.method || 'GET';
    calls.push({ url, method, body: opts?.body ? JSON.parse(opts.body) : undefined });
    const k = keys.find(p => { const [m, path] = p.includes(' ') ? p.split(' ') : ['ANY', p]; return (m === 'ANY' || m === method) && url.split('?')[0].endsWith(path); });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(k ? routes[k] : {}) });
  }) as any;
}
const L = (en: string) => en;
const CAPS = Array.from({ length: 30 }, (_, i) => ({ id: `c${i}`, name: i === 7 ? 'Last Mile Delivery' : `Capability ${String(i).padStart(2, '0')}`, status: 'APPROVED' }));
const FW = { id: 'fw', name: 'ArchMind CMM', version: 1, levels: [1, 2, 3, 4, 5].map(l => ({ level: l, name: `L${l}` })), dimensions: [{ code: 'PROCESS', name: 'Process' }], scoring: { varianceThreshold: 1, minimumCoverage: 0.7 } };
beforeEach(() => { localStorage.setItem('ea_token', 't'); jest.spyOn(window, 'confirm').mockReturnValue(true); });

describe('scope selection', () => {
  it('search, select all, clear, and a live count', async () => {
    mockFetch({ 'GET /business-capabilities/capabilities': CAPS, 'GET /business-capabilities/assessments/frameworks': [FW], 'GET /users': [] });
    render(<AssessWizard L={L} isAR={false} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Assessment name'), { target: { value: 'Q4' } });
    fireEvent.click(screen.getByText('Next'));
    await screen.findByLabelText('Last Mile Delivery');
    fireEvent.click(screen.getByText('Select all'));
    expect(screen.getByTestId('scope-count')).toHaveTextContent('30 / 30 selected');
    fireEvent.click(screen.getByText('Clear'));
    expect(screen.getByTestId('scope-count')).toHaveTextContent('0 / 30 selected');
    fireEvent.change(screen.getByLabelText('Search capabilities'), { target: { value: 'last mile' } });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    fireEvent.click(screen.getByText('Select all shown'));
    expect(screen.getByTestId('scope-count')).toHaveTextContent('1 / 30 selected');
  });
});

describe('framework step', () => {
  it('creates the assessment and fetches dimension suggestions; no framework -> clear message, no request', async () => {
    mockFetch({ 'GET /business-capabilities/capabilities': CAPS, 'GET /business-capabilities/assessments/frameworks': [], 'GET /users': [] });
    render(<AssessWizard L={L} isAR={false} onClose={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Assessment name'), { target: { value: 'Q4' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(await screen.findByLabelText('Last Mile Delivery'));
    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findAllByText(/No maturity framework is available/)).not.toHaveLength(0);
    fireEvent.click(screen.getByText('Next'));
    await waitFor(() => expect(screen.getAllByRole('alert').some(a => /No maturity framework/.test(a.textContent || ''))).toBe(true));
    expect(calls.some(c => c.method === 'POST')).toBe(false);
  });
});

describe('resume an assessment still being set up', () => {
  it('SURVEY_DESIGN with a questionnaire resumes at respondents with scope, targets and dimensions restored', async () => {
    mockFetch({
      'GET /business-capabilities/capabilities': CAPS, 'GET /business-capabilities/assessments/frameworks': [FW], 'GET /users': [{ id: 'u1', name: 'Sara' }],
      'GET /business-capabilities/assessments/a1': { id: 'a1', name: 'Q4 Logistics', status: 'SURVEY_DESIGN', frameworkId: 'fw', surveyId: 's1', scope: [{ capabilityAssetId: 'c7', dimensionCodes: ['PROCESS'], targetMaturity: 4 }] },
      'POST /business-capabilities/assessments/a1/scope/suggest': [{ capabilityAssetId: 'c7', name: 'Last Mile Delivery', suggestions: [{ code: 'PROCESS', applicable: true, reasons: [] }] }],
      'GET /surveys/s1': { version: { questions: [{ id: 'q1' }, { id: 'q2' }] } },
    });
    render(<AssessWizard L={L} isAR={false} resumeId="a1" onClose={jest.fn()} />);
    expect(await screen.findByText('+ Add respondent')).toBeInTheDocument(); // step 6 of 9
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('6. Respondents');
    fireEvent.click(screen.getByText('Back')); // back to targets: restored
    expect(await screen.findByLabelText('Target maturity Last Mile Delivery')).toHaveValue('4');
    expect(calls.some(c => c.method === 'POST' && c.url.endsWith('/assessments'))).toBe(false); // never re-created
  });
  it('DRAFT without scope resumes at capability selection with the saved name', async () => {
    mockFetch({ 'GET /business-capabilities/capabilities': CAPS, 'GET /business-capabilities/assessments/frameworks': [FW], 'GET /users': [], 'GET /business-capabilities/assessments/a2': { id: 'a2', name: 'Q4 Banking', status: 'DRAFT', frameworkId: 'fw', scope: [] } });
    render(<AssessWizard L={L} isAR={false} resumeId="a2" onClose={jest.fn()} />);
    expect(await screen.findByTestId('scope-count')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(screen.getByLabelText('Assessment name')).toHaveValue('Q4 Banking');
  });
});

describe('assessment detail per status', () => {
  const panel = (a: any, progress: any = { assignments: [] }) => mockFetch({
    'GET /business-capabilities/assessments': [{ id: a.id, name: a.name, status: a.status, _count: { scope: 1 } }],
    [`GET /business-capabilities/assessments/${a.id}/progress`]: { assessment: a, ...progress },
    'GET /business-capabilities/capabilities': CAPS, 'GET /users': [{ id: 'u1', name: 'Sara' }],
    [`GET /business-capabilities/assessments/${a.id}`]: a, 'GET /business-capabilities/assessments/frameworks': [FW],
    'POST /surveys/s1/remind': { reminded: 1 },
  });
  it('an assessment being set up shows its setup progress and Continue setup opens the wizard where it left off', async () => {
    panel({ id: 'a2', name: 'Q4 Banking', status: 'DRAFT', frameworkId: 'fw', scope: [], results: [] });
    render(<AssessmentsPanel L={L} isAR={false} can={{ assess: true, validate: true, approve: true, publish: true }} />);
    fireEvent.click(await screen.findByText('Q4 Banking'));
    expect(await screen.findByTestId('setup-summary')).toHaveTextContent('Capabilities in scope: 0');
    fireEvent.click(screen.getByTestId('continue-setup'));
    expect(await screen.findByTestId('scope-count')).toBeInTheDocument();
  });
  it('an open assessment lists respondents with their status and can send reminders', async () => {
    panel({ id: 'a3', name: 'Q3 Ops', status: 'OPEN', surveyId: 's1', results: [] }, { assignments: [{ id: 'x', respondentUserId: 'u1', role: 'OWNER', status: 'IN_PROGRESS' }] });
    render(<AssessmentsPanel L={L} isAR={false} can={{ assess: true, validate: true, approve: true, publish: true }} />);
    fireEvent.click(await screen.findByText('Q3 Ops'));
    expect(await screen.findByTestId('respondent-progress')).toHaveTextContent('SaraOWNERIn progress');
    fireEvent.click(screen.getByText('Send reminder'));
    expect(await screen.findByText(/Reminder sent to 1 respondent/)).toBeInTheDocument();
  });
});
