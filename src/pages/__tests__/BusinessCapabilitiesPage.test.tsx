import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import BusinessCapabilitiesPage, { classificationGroup } from '../BusinessCapabilitiesPage';

let mockPerms: string[] = [];
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'ARCHITECT' }, hasPermission: (c: string) => mockPerms.includes(c) }),
}));
let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ isAR: mockIsAR, locale: mockIsAR ? 'AR' : 'EN', t: (k: string) => k }),
}));

type Route = any | ((opts: any) => any);
let calls: Array<{ url: string; opts: any }> = [];
function mockFetch(routes: Record<string, Route>) {
  calls = [];
  const patterns = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    calls.push({ url, opts });
    for (const p of patterns) {
      const [method, path] = p.includes(' ') ? p.split(' ') : ['ANY', p];
      if (url.includes(path) && (method === 'ANY' || (opts?.method || 'GET') === method)) {
        const r = routes[p];
        const v = typeof r === 'function' ? r(opts) : r;
        const status = v && v.__status ? v.__status : 200;
        return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(v && v.__status ? v.body : v) });
      }
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  }) as any;
}

const CTX_OK = { organizationType: 'GOVERNMENT', industry: { code: 'GOV_HEALTH' }, subSector: null, jurisdiction: 'SA', classificationStatus: 'CONFIRMED', legacySectorHint: null };
const TREE = {
  total: 3, orphanIds: [], cycleIds: [],
  roots: [
    { level: 0, asset: { id: 'a', name: 'Strategy Management', nameAr: 'إدارة الاستراتيجية', status: 'APPROVED', attributes: { bcmClassification: 'ADMINISTRATIVE' } }, children: [
      { level: 1, asset: { id: 'b', name: 'Planning', status: 'DRAFT', attributes: {} }, children: [] },
    ] },
    { level: 0, asset: { id: 'c', name: 'Patient Care', status: 'DRAFT', source: 'REFERENCE_MODEL', attributes: { bcmClassification: 'CORE' } }, children: [] },
  ],
};

beforeEach(() => { mockPerms = ['BusinessCapability.View']; mockIsAR = false; localStorage.setItem('ea_token', 't'); });

describe('BusinessCapabilitiesPage', () => {
  it('renders the capability map grouped by top-level capabilities, and filters by classification', async () => {
    mockFetch({ '/organization-context': CTX_OK, '/capabilities/tree': TREE });
    render(<BusinessCapabilitiesPage />);
    expect(await screen.findByLabelText('Strategy Management')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Core' }));
    expect(screen.queryByLabelText('Strategy Management')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Patient Care')).toBeInTheDocument();
  });

  it('shows the Arabic names and labels in Arabic', async () => {
    mockIsAR = true;
    mockFetch({ '/organization-context': CTX_OK, '/capabilities/tree': TREE });
    render(<BusinessCapabilitiesPage />);
    expect(await screen.findByLabelText('إدارة الاستراتيجية')).toBeInTheDocument();
    expect(screen.getByText('قدرات الأعمال')).toBeInTheDocument();
  });

  it('never exposes repository/database terminology', async () => {
    mockFetch({ '/organization-context': CTX_OK, '/capabilities/tree': TREE });
    const { container } = render(<BusinessCapabilitiesPage />);
    await screen.findByLabelText('Strategy Management');
    expect(container.textContent).not.toMatch(/EaAsset|asset|metadata|semanticType/i);
  });

  it('warns when the organization classification needs confirmation and links to Organization Context', async () => {
    mockFetch({
      '/organization-context': { ...CTX_OK, organizationType: null, classificationStatus: 'NEEDS_ADMIN_CONFIRMATION', legacySectorHint: { legacySector: 'HEALTH', candidateOrganizationTypes: [], candidateIndustryCodes: [] } },
      '/capabilities/tree': TREE, '/taxonomy': [],
    });
    render(<BusinessCapabilitiesPage />);
    const banner = await screen.findByTestId('classification-banner');
    fireEvent.click(within(banner).getByText('Review'));
    expect(await screen.findByTestId('legacy-hint')).toHaveTextContent('HEALTH');
    expect(screen.getByText(/Only an administrator/)).toBeInTheDocument();
  });

  it('organization context cascades Organization Type → Industry and confirms via PUT', async () => {
    mockPerms = ['BusinessCapability.View', 'BusinessCapability.ManageOrgContext'];
    mockFetch({
      '/organization-context': { ...CTX_OK, organizationType: null, industry: null, classificationStatus: 'NOT_SET' },
      '/capabilities/tree': TREE,
      '/taxonomy?organizationType=PRIVATE': [{ code: 'PVT_LOGISTICS', labelEn: 'Logistics', subSectors: [{ code: 'T_CARGO', labelEn: 'Air cargo' }] }],
      '/taxonomy': [],
    });
    render(<BusinessCapabilitiesPage />);
    await screen.findByTestId('classification-banner'); // context loaded
    fireEvent.click(screen.getByRole('tab', { name: 'Reference Models' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Organization Context' }));
    const selects = await screen.findAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'PRIVATE' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Logistics' })).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'PVT_LOGISTICS' } });
    await waitFor(() => expect(screen.getByRole('option', { name: 'Air cargo' })).toBeInTheDocument());
    fireEvent.click(screen.getByText('Confirm classification'));
    await waitFor(() => expect(calls.some(c => c.opts?.method === 'PUT')).toBe(true));
    const put = calls.find(c => c.opts?.method === 'PUT')!;
    expect(JSON.parse(put.opts.body)).toMatchObject({ organizationType: 'PRIVATE', industryCode: 'PVT_LOGISTICS', jurisdiction: 'SA' });
  });

  it('reference library: official model without content shows the awaiting-source message and no capabilities', async () => {
    mockFetch({
      '/organization-context': CTX_OK, '/capabilities/tree': TREE,
      '/reference-models': [{ id: 'nora', name: 'NORA BCM', provenance: 'OFFICIAL_STANDARD', versions: [] }],
      '/adoption/decisions': [],
    });
    render(<BusinessCapabilitiesPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reference Models' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Reference Library' }));
    fireEvent.click(await screen.findByRole('option', { name: /NORA BCM/ }));
    expect(await screen.findByTestId('no-published-content')).toHaveTextContent(/authoritative source/);
    expect(screen.getByText('Official standard')).toBeInTheDocument();
  });

  it('adoption requires acknowledging possible duplicates before recording the decision', async () => {
    mockPerms = ['BusinessCapability.View', 'BusinessCapability.AdoptReference'];
    mockFetch({
      '/organization-context': CTX_OK, '/capabilities/tree': TREE,
      '/reference-models': [{ id: 'm', name: 'Logistics Reference', provenance: 'ARCHMIND_CURATED', versions: [{ id: 'v1', version: '1.0', status: 'PUBLISHED' }] }],
      '/reference-versions/v1/tree': { tree: [{ item: { id: 'r1', stableKey: 'LOG.1', name: 'Fleet Management', classification: 'CORE' }, children: [] }] },
      '/adoption/decisions': (o: any) => (o?.method === 'POST' ? { id: 'd1' } : []),
      '/adoption/preview': [{ possibleDuplicates: [{ assetId: 'x', name: 'Fleet Mgmt', strength: 'HIGH' }], parent: null }],
    });
    render(<BusinessCapabilitiesPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reference Models' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Reference Library' }));
    fireEvent.click(await screen.findByRole('option', { name: /Logistics Reference/ }));
    fireEvent.click(await screen.findByText('Fleet Management'));
    expect(await screen.findByTestId('adoption-duplicates')).toHaveTextContent('Fleet Mgmt');
    const record = screen.getByText('Record decision');
    expect(record).toBeDisabled();
    fireEvent.click(within(screen.getByTestId('adoption-duplicates')).getByRole('checkbox'));
    fireEvent.click(record);
    await waitFor(() => expect(calls.some(c => c.url.includes('/adoption/decisions') && c.opts?.method === 'POST')).toBe(true));
    const post = calls.find(c => c.url.includes('/adoption/decisions') && c.opts?.method === 'POST')!;
    expect(JSON.parse(post.opts.body)).toMatchObject({ referenceCapabilityId: 'r1', action: 'ADOPT', acknowledgeDuplicates: true });
  });

  it('capability list shows hierarchy, and detail shows reference vs adopted values', async () => {
    mockFetch({
      '/organization-context': CTX_OK, '/capabilities/tree': TREE,
      '/capabilities/c': { id: 'c', name: 'Patient Care', attributes: { bcmClassification: 'CORE' }, children: [], provenance: [{ decision: 'ADOPTED_MODIFIED', model: { name: 'Health Ref', provenance: 'ARCHMIND_CURATED' }, version: { version: '1.0' }, modifiedFields: ['name'], referenceValue: { name: 'Patient Services' }, adoptedValue: { name: 'Patient Care' } }] },
    });
    render(<BusinessCapabilitiesPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Capabilities' }));
    expect(await screen.findByText('Planning')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Patient Care'));
    expect(await screen.findByTestId('reference-vs-adopted')).toHaveTextContent('Patient Services');
    expect(screen.queryByText('+ Add capability')).not.toBeInTheDocument(); // no Manage permission
  });

  it('Model Setup is hidden without permission; with it, apply requires explicit confirmation', async () => {
    mockFetch({ '/organization-context': CTX_OK, '/capabilities/tree': TREE });
    const { unmount } = render(<BusinessCapabilitiesPage />);
    expect(screen.queryByRole('tab', { name: 'Model Setup' })).not.toBeInTheDocument();
    unmount();

    mockPerms = ['BusinessCapability.View', 'BusinessCapability.ManageAttributePack'];
    mockFetch({
      '/organization-context': CTX_OK, '/capabilities/tree': TREE,
      '/setup/attribute-pack': (o: any) => (JSON.parse(o.body).dryRun === false ? { status: 'APPLIED', plan: { targets: [] } } : { status: 'WOULD_APPLY', plan: { targets: [{ objectTypeCode: 'GovCapability', toAdd: [{ name: 'Strategic Importance' }], conflicts: [], possibleEquivalents: [] }] } }),
    });
    render(<BusinessCapabilitiesPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Reference Models' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Model Setup' }));
    fireEvent.click(screen.getByText('Analyze'));
    expect(await screen.findByText(/Will add: Strategic Importance/)).toBeInTheDocument();
    const apply = screen.getByText('Apply');
    expect(apply).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(apply);
    expect(await screen.findByText(/previous version is preserved/)).toBeInTheDocument();
    const body = JSON.parse(calls.filter(c => c.url.includes('/setup/attribute-pack')).pop()!.opts.body);
    expect(body).toMatchObject({ dryRun: false, confirm: true });
  });

  it('classificationGroup rolls supporting sub-types up', () => {
    expect(classificationGroup('SUPPORTING_ENABLING')).toBe('SUPPORTING');
    expect(classificationGroup('CORE')).toBe('CORE');
    expect(classificationGroup(undefined)).toBeNull();
  });
});
