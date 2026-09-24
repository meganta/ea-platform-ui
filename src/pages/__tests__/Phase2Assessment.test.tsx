import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { AssessmentsPanel } from '../bcm/Assessments';
import MySurveysPage from '../MySurveysPage';

let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockIsAR, locale: mockIsAR ? 'AR' : 'EN', t: (k: string) => k }) }));

let calls: Array<{ url: string; method: string; body: any }> = [];
function mockFetch(routes: Record<string, any>) {
  calls = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    const method = opts?.method || 'GET';
    calls.push({ url, method, body: opts?.body ? JSON.parse(opts.body) : undefined });
    const k = keys.find(p => { const [m, path] = p.includes(' ') ? p.split(' ') : ['ANY', p]; return (m === 'ANY' || m === method) && url.endsWith(path); }) ?? keys.find(p => url.includes(p.split(' ').pop()!));
    const r = k ? routes[k] : {};
    const v = typeof r === 'function' ? r(opts) : r;
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(v) });
  }) as any;
}
const L = (en: string, ar: string) => (mockIsAR ? ar : en);
const ALL = { assess: true, validate: true, approve: true, publish: true };
beforeEach(() => { mockIsAR = false; localStorage.setItem('ea_token', 't'); jest.spyOn(window, 'confirm').mockReturnValue(true); });

const FW = { id: 'fw', name: 'ArchMind Capability Maturity Model', version: 1, description: 'Five-level scale. Not an official CMMI appraisal.', levels: [1, 2, 3, 4, 5].map(l => ({ level: l, name: `L${l}`, definition: `d${l}` })), dimensions: [{ code: 'PROCESS', name: 'Process' }, { code: 'TECHNOLOGY', name: 'Technology / Applications' }], scoring: { varianceThreshold: 1, minimumCoverage: 0.7, evidenceGate: { enabled: true } } };

describe('Assess Maturity wizard', () => {
  it('walks the 9 steps and launches with the chosen scope, dimensions, targets and respondents', async () => {
    mockFetch({
      'GET /business-capabilities/assessments': [],
      'GET /business-capabilities/capabilities': [{ id: 'cap1', name: 'Last Mile Delivery', status: 'APPROVED' }],
      'GET /business-capabilities/assessments/frameworks': [FW],
      'GET /users': [{ id: 'u1', name: 'Sara (Owner)' }],
      'POST /business-capabilities/assessments': { id: 'as1' },
      'POST /business-capabilities/assessments/as1/scope/suggest': [{ capabilityAssetId: 'cap1', name: 'Last Mile Delivery', suggestions: [{ code: 'PROCESS', applicable: true, reasons: ['default'] }, { code: 'TECHNOLOGY', applicable: true, reasons: ['apps linked'] }] }],
      'PUT /business-capabilities/assessments/as1/scope': {},
      'POST /business-capabilities/assessments/as1/questionnaire': { surveyId: 's1', questions: 2, aiDraftsPendingReview: 1 },
      'GET /surveys/s1': { version: { questions: [{ id: 'q1', subjectId: 'cap1', text: 'Is Route Planning documented?', source: 'TEMPLATE', evidenceRequirement: 'REQUIRED' }, { id: 'q2', subjectId: 'cap1', text: 'AI: is POD digital?', source: 'AI_GENERATED', reviewStatus: 'PENDING_REVIEW', evidenceRequirement: 'NONE' }] } },
      'POST /surveys/s1/questions/q2/review': {},
      'POST /business-capabilities/assessments/as1/launch': {},
      'GET /business-capabilities/assessments/as1/progress': { assessment: { id: 'as1', name: 'Q3', status: 'OPEN', results: [] }, assignments: [] },
    });
    render(<AssessmentsPanel L={L} isAR={false} can={ALL} />);
    fireEvent.click(await screen.findByText('Assess maturity'));
    fireEvent.change(screen.getByLabelText('Assessment name'), { target: { value: 'Q3 Logistics' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(await screen.findByLabelText('Last Mile Delivery'));
    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findByTestId('framework-rules')).toHaveTextContent(/more than 1 level/);
    fireEvent.click(screen.getByText('Next'));
    const dimSection = await screen.findByRole('region', { name: 'Last Mile Delivery' });
    fireEvent.click(within(dimSection).getByLabelText('Technology / Applications')); // untick a suggested dimension
    fireEvent.click(screen.getByText('Next'));
    fireEvent.change(await screen.findByLabelText('Target maturity Last Mile Delivery'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('Next'));
    await screen.findByText('+ Add respondent');
    const scopePut = calls.find(c => c.method === 'PUT' && c.url.endsWith('/scope'))!;
    expect(scopePut.body).toEqual({ scope: [{ capabilityAssetId: 'cap1', dimensionCodes: ['PROCESS'], targetMaturity: 4 }] });
    fireEvent.click(screen.getByText('+ Add respondent'));
    fireEvent.change(screen.getByLabelText('Respondent'), { target: { value: 'u1' } });
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(await screen.findByText('Generate questionnaire'));
    fireEvent.click(await screen.findByText(/Last Mile Delivery \(2\)/));
    expect(screen.getByText('AI suggestion')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Next'));
    expect(await screen.findByTestId('wizard-review')).toHaveTextContent('1 AI suggestions still need review');
    fireEvent.click(screen.getByText('Next'));
    fireEvent.click(await screen.findByText('Launch assessment'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Review all AI-drafted questions/);
    expect(calls.some(c => c.url.endsWith('/launch'))).toBe(false);
  });
});

describe('Assessment detail', () => {
  const detail = (status: string, results: any[], extra: any = {}) => ({
    'GET /business-capabilities/assessments': [{ id: 'as1', name: 'Q3', status, _count: { scope: 1 } }],
    'GET /business-capabilities/assessments/as1/progress': { assessment: { id: 'as1', name: 'Q3', status, results, ...extra }, assignments: [] },
    'GET /business-capabilities/capabilities': [{ id: 'cap1', name: 'Last Mile Delivery' }],
    'POST /business-capabilities/assessments/as1/results/r1/validate': {},
    'POST /business-capabilities/assessments/as1/publish': { report: [{ capabilityAssetId: 'cap1', projected: ['bcmCurrentMaturity'], skipped: [] }] },
  });

  it('shows raw vs evidence-adjusted scores and flagged disagreement; validation needs a note and an agreed score', async () => {
    mockFetch(detail('VALIDATION', [{ id: 'r1', capabilityAssetId: 'cap1', status: 'FLAGGED_FOR_VALIDATION', rawScore: 3.8, evidenceAdjustedScore: 3.2, finalScore: null, coverage: 0.9, dimensionScores: [], varianceFlags: [{ dimension: 'PROCESS', threshold: 1, respondentScores: [{ score: 2 }, { score: 4 }] }] }]));
    render(<AssessmentsPanel L={L} isAR={false} can={ALL} />);
    fireEvent.click(await screen.findByText('Q3'));
    expect(await screen.findByTestId('evidence-adjusted')).toHaveTextContent('Claimed 3.8; adjusted to 3.2');
    expect(screen.getByText(/PROCESS: scores range 2–4/)).toBeInTheDocument();
    const btn = screen.getByText('Validate');
    expect(btn).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Agreed score'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Validation note'), { target: { value: 'Workshop consensus' } });
    fireEvent.click(btn);
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/validate'))).toBe(true));
    expect(calls.find(c => c.url.endsWith('/validate'))!.body).toEqual({ note: 'Workshop consensus', finalScore: 3 });
  });

  it('publish is offered only after approval and only with the publish permission', async () => {
    mockFetch(detail('APPROVAL', [{ id: 'r1', capabilityAssetId: 'cap1', status: 'CALCULATED', finalScore: 3.2, dimensionScores: [], varianceFlags: [] }], { approvedAt: null }));
    const { unmount } = render(<AssessmentsPanel L={L} isAR={false} can={ALL} />);
    fireEvent.click(await screen.findByText('Q3'));
    await screen.findByText('Approve');
    expect(screen.queryByText('Publish results')).not.toBeInTheDocument();
    unmount();
    mockFetch(detail('APPROVAL', [{ id: 'r1', capabilityAssetId: 'cap1', status: 'CALCULATED', finalScore: 3.2, dimensionScores: [], varianceFlags: [] }], { approvedAt: '2026-09-20' }));
    const r2 = render(<AssessmentsPanel L={L} isAR={false} can={{ ...ALL, publish: false }} />);
    fireEvent.click(await screen.findByText('Q3'));
    await screen.findByTestId('assessment-status');
    expect(screen.queryByText('Publish results')).not.toBeInTheDocument();
    r2.unmount();
    render(<AssessmentsPanel L={L} isAR={false} can={ALL} />);
    fireEvent.click(await screen.findByText('Q3'));
    fireEvent.click(await screen.findByText('Publish results'));
    expect(await screen.findByTestId('publication-report')).toHaveTextContent('Last Mile Delivery: updated');
  });
});

describe('My Surveys (respondent)', () => {
  const survey = {
    assignment: { id: 'as1', status: 'IN_PROGRESS' },
    survey: { id: 's1', title: 'Q3 Logistics', status: 'OPEN', acceptsResponses: true },
    sections: [{ id: 'sec1', title: 'Last Mile Delivery' }],
    questions: [
      { id: 'q1', sectionId: 'sec1', key: 'k1', text: 'Is Route Planning documented?', type: 'YES_NO', required: true, evidenceRequirement: 'REQUIRED' },
      { id: 'q2', sectionId: 'sec1', key: 'k2', text: 'Overall process maturity?', type: 'MATURITY_LEVEL', required: true, evidenceRequirement: 'NONE', options: [1, 2, 3, 4, 5].map(v => ({ key: `L${v}`, label: `${v}`, value: v })) },
    ],
    responses: [{ questionId: 'q2', value: 3, notApplicable: false }], evidence: [],
  };

  it('resumes saved answers, shows progress/required/evidence, saves and submits', async () => {
    mockFetch({ 'GET /surveys/my/assignments': [{ id: 'as1', status: 'IN_PROGRESS', survey: { title: 'Q3 Logistics', status: 'OPEN' } }], 'GET /surveys/my/assignments/as1': survey, 'PUT /surveys/my/assignments/as1/responses': { saved: 2 }, 'POST /surveys/my/assignments/as1/submit': {} });
    render(<MySurveysPage />);
    fireEvent.click(await screen.findByText('Q3 Logistics'));
    expect(await screen.findByTestId('survey-progress')).toHaveTextContent('1/2 answered');
    expect(screen.getByText(/Evidence required/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '3' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(screen.getByTestId('survey-progress')).toHaveTextContent('2/2 answered');
    fireEvent.click(screen.getByText('Save progress'));
    await waitFor(() => expect(calls.some(c => c.method === 'PUT')).toBe(true));
    expect(calls.find(c => c.method === 'PUT')!.body.responses).toEqual(expect.arrayContaining([{ questionId: 'q1', value: true, notApplicable: false }, { questionId: 'q2', value: 3, notApplicable: false }]));
    expect(await screen.findByText('Saved. You can come back later.')).toBeInTheDocument(); // Submit stays disabled while a save is in flight
    fireEvent.click(screen.getByText('Submit'));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/submit'))).toBe(true));
  });

  it('is fully bilingual (Arabic)', async () => {
    mockIsAR = true;
    mockFetch({ 'GET /surveys/my/assignments': [] });
    render(<MySurveysPage />);
    expect(await screen.findByText('لا يوجد ما تجيب عليه حالياً.')).toBeInTheDocument();
    expect(screen.getByText('استبياناتي')).toBeInTheDocument();
  });
});
