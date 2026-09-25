import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ModelSuggestions, ModelSources, ReferenceComparison, CurationWorkspace } from '../bcm/ReferenceModels';
import { AssessmentsPanel } from '../bcm/Assessments';
import MySurveysPage from '../MySurveysPage';
import BusinessCapabilitiesPage from '../BusinessCapabilitiesPage';

let mockUser: any = { userId: 'u1', role: 'ARCHITECT' };
let mockPerms: string[] = ['BusinessCapability.View'];
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUser, hasPermission: (c: string) => mockPerms.includes(c) }) }));
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
const L = (en: string) => en;
beforeEach(() => { mockUser = { userId: 'u1', role: 'ARCHITECT' }; mockPerms = ['BusinessCapability.View']; localStorage.setItem('ea_token', 't'); jest.spyOn(window, 'confirm').mockReturnValue(true); jest.spyOn(window, 'prompt').mockReturnValue('Not relevant for asset-light forwarders'); });

describe('model suggestions', () => {
  it('shows official references and industry models as separate kinds and never adopts', async () => {
    mockFetch({ '/reference-recommendations': { limitation: null, recommendations: [
      { modelId: 'nora', name: 'NORA Business Architecture', kind: 'OFFICIAL_REFERENCE', availability: 'NOT_YET_PUBLISHED', reasons: ['Matches organization type'] },
      { modelId: 'hc', name: 'ArchMind Healthcare', kind: 'INDUSTRY_MODEL', availability: 'PUBLISHED', reasons: ['Matches industry'] },
    ] } });
    const pick = jest.fn();
    render(<ModelSuggestions L={L} onPick={pick} />);
    expect(await screen.findByText('Official reference')).toBeInTheDocument();
    expect(screen.getByText('Industry model')).toBeInTheDocument();
    expect(screen.getByText('content not yet available')).toBeInTheDocument();
    expect(screen.getByText(/Suggestions only/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('ArchMind Healthcare'));
    expect(pick).toHaveBeenCalledWith('hc');
    expect(calls.every(c => c.method === 'GET')).toBe(true);
  });
  it('explains the limitation when classification is not confirmed', async () => {
    mockFetch({ '/reference-recommendations': { limitation: 'Confirm your organization type and industry to get reference model suggestions.', recommendations: [] } });
    render(<ModelSuggestions L={L} onPick={jest.fn()} />);
    expect(await screen.findByTestId('suggestion-limitation')).toHaveTextContent(/Confirm your organization/);
  });
});

describe('sources & methodology', () => {
  it('lists each source with organization, link, edition and informed areas', async () => {
    mockFetch({ '/reference-versions/v1/sources': [{ id: 's', organization: 'GS1', title: 'EPCIS 2.0', url: 'https://www.gs1.org/epcis', publicationInfo: 'ratified 2022', provenanceType: 'OFFICIAL_STANDARD', informedAreas: ['Shipment visibility'] }] });
    render(<ModelSources versionId="v1" version={{ methodology: 'Synthesized by ArchMind (AI-assisted drafting)', assumptions: 'Targets service providers' }} L={L} />);
    expect(await screen.findByRole('link', { name: 'EPCIS 2.0' })).toHaveAttribute('href', 'https://www.gs1.org/epcis');
    expect(screen.getByTestId('model-sources')).toHaveTextContent(/AI-assisted drafting/);
    expect(screen.getByTestId('model-sources')).toHaveTextContent(/Informed: Shipment visibility/);
  });
});

describe('reference vs tenant comparison', () => {
  const data = {
    summary: { MISSING: 1, POSSIBLE_MATCH: 1, EXISTING: 1, CUSTOM_TENANT_CAPABILITY: 1, POSSIBLE_DUPLICATE: 0 },
    reference: [
      { cls: 'MISSING', reference: { id: 'r1', name: 'Customs & Cross-Border Trade', level: 1, isCoreForIndustry: true }, candidates: [], previouslyRejected: true, rejectionRationale: 'Domestic only' },
      { cls: 'POSSIBLE_MATCH', reference: { id: 'r2', name: 'Hub & Sortation Operations', level: 1 }, candidates: [{ id: 't2', name: 'Sortation Operations' }], previouslyRejected: false },
      { cls: 'EXISTING', reference: { id: 'r3', name: 'Last Mile Delivery', level: 1 }, candidates: [], previouslyRejected: false },
    ],
    tenant: [{ cls: 'CUSTOM_TENANT_CAPABILITY', tenant: { id: 't3', name: 'Drone Innovation Lab' }, reason: 'Not linked to or similar to any capability in this reference model' }],
  };
  it('groups differences with counts, shows reasons, and hands review to the adoption workflow', async () => {
    mockFetch({ '/reference-versions/v1/compare': data });
    const onReview = jest.fn();
    render(<ReferenceComparison versionId="v1" L={L} isAR={false} onReview={onReview} />);
    expect(await screen.findByText('Customs & Cross-Border Trade')).toBeInTheDocument();
    expect(screen.getByText(/Previously rejected: Domestic only/)).toBeInTheDocument();
    expect(screen.getByTestId('count-MISSING')).toHaveTextContent('(1)');
    fireEvent.click(screen.getByText('Adopt / map'));
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
    fireEvent.click(screen.getByRole('tab', { name: /Possible match/ }));
    expect(screen.getByText(/Resembles: Sortation Operations/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Already in your model/ }));
    expect(screen.queryByText('Adopt / map')).not.toBeInTheDocument(); // existing items are not re-reviewed from here
    fireEvent.click(screen.getByRole('tab', { name: /Only in your model/ }));
    expect(screen.getByText('Drone Innovation Lab')).toBeInTheDocument();
  });
});

describe('platform curation workspace', () => {
  const tree = (status: string) => ({ version: { status, methodology: 'm' }, tree: [
    { item: { stableKey: 'LOG.XB', level: 1, name: 'Customs & Cross-Border Trade', description: 'Move shipments across borders.', curationStatus: 'PROPOSED', classification: 'CORE' }, children: [] },
    { item: { stableKey: 'LOG.FLEET', level: 1, name: 'Fleet Management', description: 'Own and operate vehicles.', curationStatus: 'MODIFIED', curationNote: 'renamed', originalSnapshot: { name: 'Fleet & Asset Management' } }, children: [] },
  ] });
  const routes = (status: string, extra: any = {}) => ({
    '/reference-models': [{ id: 'm', name: 'ArchMind Logistics', isPlatform: true, provenance: 'ARCHMIND_CURATED', versions: [{ id: 'v1', version: '0.1-draft', status }] }],
    '/reference-versions/v1/tree': tree(status),
    '/reference-versions/v1/curation': { status, submittedBy: 'someone-else', counts: { PROPOSED: 1, MODIFIED: 1 }, blockers: status === 'IN_REVIEW' ? ['1 capability(ies) still need a decision (accept, modify or reject)'] : [], ...extra },
    'POST /reference-versions/v1/curate': {}, 'POST /reference-versions/v1/submit-for-review': {}, 'POST /reference-versions/v1/publish': {}, 'POST /reference-library/curated-drafts/import': [],
  });
  const openVersion = async () => { await screen.findByRole('option', { name: /0.1-draft/ }); fireEvent.change(screen.getByLabelText('Reference model version'), { target: { value: 'v1' } }); await screen.findByTestId('version-status'); };

  it('imports drafts explicitly and submits a draft for review', async () => {
    mockFetch(routes('DRAFT'));
    render(<CurationWorkspace L={L} isAR={false} userId="pa1" />);
    fireEvent.click(await screen.findByText('Import ArchMind curated drafts'));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/curated-drafts/import') && c.method === 'POST')).toBe(true));
    await openVersion();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument(); // curation only during review
    fireEvent.click(screen.getByText('Submit for review'));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/submit-for-review'))).toBe(true));
  });

  it('in review: accept, reject with a reason, shows original wording of modified items and approval blockers', async () => {
    mockFetch(routes('IN_REVIEW'));
    render(<CurationWorkspace L={L} isAR={false} userId="pa1" />);
    await openVersion();
    expect(screen.getByText(/Originally proposed as: Fleet & Asset Management/)).toBeInTheDocument();
    expect(screen.getByTestId('approval-blockers')).toHaveTextContent(/still need a decision/);
    expect(screen.getByText('Approve')).toBeDisabled();
    const row = screen.getByRole('group', { name: 'Customs & Cross-Border Trade' });
    fireEvent.click(within(row).getByText('Reject'));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/curate'))?.body).toEqual({ stableKeys: ['LOG.XB'], decision: 'REJECT', note: 'Not relevant for asset-light forwarders' }));
  });

  it('the submitter cannot approve; publish appears only once APPROVED', async () => {
    mockFetch(routes('IN_REVIEW', { submittedBy: 'pa1', blockers: [] }));
    const { unmount } = render(<CurationWorkspace L={L} isAR={false} userId="pa1" />);
    await openVersion();
    expect(screen.getByTestId('needs-other-reviewer')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Publish')).not.toBeInTheDocument();
    unmount();
    mockFetch(routes('APPROVED'));
    render(<CurationWorkspace L={L} isAR={false} userId="pa1" />);
    await openVersion();
    fireEvent.click(screen.getByText('Publish'));
    await waitFor(() => expect(calls.some(c => c.url.endsWith('/publish') && c.method === 'POST')).toBe(true));
  });
});

describe('curation tab visibility', () => {
  const base = { '/organization-context': { classificationStatus: 'NOT_SET' }, '/capabilities/tree': { total: 0, roots: [], orphanIds: [], cycleIds: [] } };
  it('hidden for tenant users, visible to platform administrators', async () => {
    mockFetch(base);
    const { unmount } = render(<BusinessCapabilitiesPage />);
    await screen.findByRole('tab', { name: /Reference library|Reference Library/ });
    expect(screen.queryByRole('tab', { name: 'Model curation' })).not.toBeInTheDocument();
    unmount();
    mockUser = { userId: 'pa', role: 'SUPERADMIN', isPlatformAdmin: true };
    render(<BusinessCapabilitiesPage />);
    expect(await screen.findByRole('tab', { name: 'Model curation' })).toBeInTheDocument();
  });
});

describe('evidence picker (respondent)', () => {
  it('searches existing records and links the picked one by reference, never by typed id', async () => {
    mockFetch({
      'GET /surveys/my/assignments': [{ id: 'as1', status: 'IN_PROGRESS', survey: { title: 'Q3', status: 'OPEN' } }],
      'GET /surveys/my/assignments/as1': { assignment: { id: 'as1', status: 'IN_PROGRESS' }, survey: { title: 'Q3', status: 'OPEN', acceptsResponses: true }, sections: [], questions: [{ id: 'q1', key: 'k', text: 'Is Route Planning documented?', type: 'YES_NO', required: true, evidenceRequirement: 'REQUIRED' }], responses: [], evidence: [] },
      'GET /surveys/my/assignments/as1/evidence-options': (url: string) => (url.includes('kind=DOCUMENT') ? [{ id: 'd1', label: 'Route planning procedure', kind: 'DOCUMENT', detail: '2026-02-01' }] : []),
      'POST /surveys/my/assignments/as1/evidence': {},
    });
    render(<MySurveysPage />);
    fireEvent.click(await screen.findByText('Q3'));
    fireEvent.click(await screen.findByText('+ Add evidence'));
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'route' } });
    fireEvent.click(await screen.findByRole('option', { name: /Route planning procedure/ }));
    fireEvent.click(screen.getByText('Attach'));
    await waitFor(() => expect(calls.find(c => c.method === 'POST' && c.url.endsWith('/evidence'))?.body).toEqual({ questionId: 'q1', kind: 'DOCUMENT', refId: 'd1', title: 'Route planning procedure' }));
    expect(calls.some(c => c.url.includes('evidence-options?kind=DOCUMENT&q=route'))).toBe(true);
  });
  it('explains empty results for architecture content without access', async () => {
    mockFetch({
      'GET /surveys/my/assignments': [{ id: 'as1', status: 'IN_PROGRESS', survey: { title: 'Q3', status: 'OPEN' } }],
      'GET /surveys/my/assignments/as1': { assignment: { id: 'as1', status: 'IN_PROGRESS' }, survey: { title: 'Q3', status: 'OPEN', acceptsResponses: true }, sections: [], questions: [{ id: 'q1', key: 'k', text: 'Q?', type: 'YES_NO', required: true, evidenceRequirement: 'REQUIRED' }], responses: [], evidence: [] },
      'GET /surveys/my/assignments/as1/evidence-options': [],
    });
    render(<MySurveysPage />);
    fireEvent.click(await screen.findByText('Q3'));
    fireEvent.click(await screen.findByText('+ Add evidence'));
    fireEvent.change(screen.getByLabelText('Evidence type'), { target: { value: 'REPOSITORY_OBJECT' } });
    expect(await screen.findByTestId('no-evidence-options')).toHaveTextContent(/do not have access/);
  });
});

describe('recalculation warning', () => {
  it('warns before clearing validations and tells the validator to validate again', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch({
      'GET /business-capabilities/assessments': [{ id: 'a1', name: 'Q3', status: 'VALIDATION', _count: { scope: 1 } }],
      'GET /business-capabilities/assessments/a1/progress': { assessment: { id: 'a1', name: 'Q3', status: 'VALIDATION', results: [{ id: 'r1', capabilityAssetId: 'c', status: 'VALIDATED', finalScore: 3, dimensionScores: [], varianceFlags: [] }] }, assignments: [] },
      'GET /business-capabilities/capabilities': [],
      'POST /business-capabilities/assessments/a1/analyze': { validationsReset: 1 },
    });
    render(<AssessmentsPanel L={L} isAR={false} can={{ assess: true, validate: true, approve: true, publish: true }} />);
    fireEvent.click(await screen.findByText('Q3'));
    fireEvent.click(await screen.findByText('Recalculate'));
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/1 validation decision\(s\) will be cleared/));
    expect(await screen.findByTestId('validations-reset')).toHaveTextContent(/validate these results again/);
  });
  it('cancelling the warning does not recalculate', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockFetch({
      'GET /business-capabilities/assessments': [{ id: 'a1', name: 'Q3', status: 'VALIDATION', _count: { scope: 1 } }],
      'GET /business-capabilities/assessments/a1/progress': { assessment: { id: 'a1', name: 'Q3', status: 'VALIDATION', results: [{ id: 'r1', capabilityAssetId: 'c', status: 'VALIDATED', finalScore: 3, dimensionScores: [], varianceFlags: [] }] }, assignments: [] },
      'GET /business-capabilities/capabilities': [],
    });
    render(<AssessmentsPanel L={L} isAR={false} can={{ assess: true, validate: true, approve: true, publish: true }} />);
    fireEvent.click(await screen.findByText('Q3'));
    fireEvent.click(await screen.findByText('Recalculate'));
    expect(calls.some(c => c.url.endsWith('/analyze'))).toBe(false);
  });
});

describe('resilience', () => {
  it('suggestions render nothing (and never crash) on an unexpected response', async () => {
    mockFetch({ '/reference-recommendations': {} });
    const { container } = render(<ModelSuggestions L={L} onPick={jest.fn()} />);
    await waitFor(() => expect(calls.length).toBe(1));
    expect(container).toBeEmptyDOMElement();
  });
  it('comparison shows a message instead of crashing on an unexpected response', async () => {
    mockFetch({ '/reference-versions/v1/compare': { summary: {} } });
    render(<ReferenceComparison versionId="v1" L={L} isAR={false} onReview={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/);
  });
});
