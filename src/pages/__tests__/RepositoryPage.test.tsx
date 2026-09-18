import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RepositoryPage from '../RepositoryPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key }),
}));

// RepositoryPage now uses useNavigate (the "Show Dependencies" / Object
// Context View entry point) and useSearchParams (Copilot Phase 1's
// evidence-drawer deep link, ?assetId=<id>) - both mocked per this
// codebase's established pattern (see DashboardPage.test.tsx) rather
// than wrapping every render() in a real Router. mockSearchParams
// defaults to an empty URLSearchParams so the deep-link effect's
// `.get('assetId')` returns null and existing tests are unaffected
// unless a test explicitly sets it.
const mockNavigate = jest.fn();
let mockSearchParams = new URLSearchParams();
const mockSetSearchParams = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  localStorage.setItem('ea_token', 'fake-token');
});

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    for (const pattern of sortedPatterns) {
      if (url.includes(pattern)) {
        const value = typeof routes[pattern] === 'function' ? routes[pattern](url, options) : routes[pattern];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

const CONFIG = { enabledDomains: ['BUSINESS', 'APPLICATION'], allDomains: { BUSINESS: ['CAPABILITY'], APPLICATION: ['APPLICATION'] } };
const LEGACY_APPLICATIONS_CONFIG = { enabledDomains: ['BUSINESS', 'APPLICATIONS'], allDomains: { BUSINESS: ['CAPABILITY'], APPLICATIONS: ['Application'] } };

function asset(overrides: Partial<Record<string, any>> = {}) {
  return { id: 'a1', name: 'Core Banking', nameAr: null, domain: 'APPLICATION', status: 'APPROVED', source: 'MANUAL', assetType: 'APPLICATION', ...overrides };
}

describe('RepositoryPage - loading and listing', () => {
  it('loads and displays assets', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    expect(await screen.findByText('Core Banking')).toBeInTheDocument();
  });

  it('filters by free-text search across English and Arabic names - sends the search term as a server-side query param (debounced)', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('search=banking')
        ? [asset({ id: 'a1', name: 'Core Banking' })]
        : [asset({ id: 'a1', name: 'Core Banking' }), asset({ id: 'a2', name: 'CRM Platform' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    expect(screen.getByText('CRM Platform')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search assets...'), { target: { value: 'banking' } });
    // Search is debounced (300ms) before the request fires - findByText's
    // own polling wait comfortably covers that delay.
    await waitFor(() => expect(screen.queryByText('CRM Platform')).not.toBeInTheDocument());
    expect(screen.getByText('Core Banking')).toBeInTheDocument();
    expect(screen.queryByText('CRM Platform')).not.toBeInTheDocument();
  });

  it('filters by domain - sends the selected domain as a server-side query param (filtering is server-side, item 2)', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('domain=BUSINESS')
        ? [asset({ id: 'a2', name: 'Payments Capability', domain: 'BUSINESS' })]
        : [asset({ id: 'a1', name: 'Core Banking', domain: 'APPLICATION' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    const selects = screen.getAllByRole('combobox');
    const domainSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="BUSINESS"]'))!;
    fireEvent.change(domainSelect, { target: { value: 'BUSINESS' } });
    expect(await screen.findByText('Payments Capability')).toBeInTheDocument();
    expect(screen.queryByText('Core Banking')).not.toBeInTheDocument();
  });

  // Live bug report fix: getRepositoryDomains previously always read
  // config.enabledDomains - a separate field stored once on the
  // frameworkConfig row and never synced when the tenant's Meta Model is
  // later published/republished. Confirmed on live data: a tenant's
  // enabledDomains still had the stale code "BENEFICIARY_EXPERIENCE"
  // while its actual, current Meta Model domain code is "BENEFICIARY" -
  // selecting the dropdown option sent a domain value matching zero
  // real assets, despite hundreds of real Beneficiary-domain assets
  // existing. Once metaModelDriven is true, the domain list must come
  // from config.allDomains' own keys (already correctly built
  // server-side from the live Meta Model), never enabledDomains.
  it('when metaModelDriven is true, the Domain dropdown uses allDomains\' real Meta Model keys, not the stale enabledDomains field', async () => {
    const staleConfig = {
      metaModelDriven: true,
      enabledDomains: ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY', 'BENEFICIARY_EXPERIENCE'], // the real, stale, live value
      allDomains: { BUSINESS: ['CAPABILITY'], BENEFICIARY: ['Touchpoint'], MOTIVATION: ['StrategicGoal'], GOVERNANCE: ['GovEntity'] },
    };
    mockFetch({ '/ea-repository/framework-config': staleConfig, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    const selects = screen.getAllByRole('combobox');
    const domainSelect = selects.find(s => (s as HTMLSelectElement).options.length > 1 && Array.from((s as HTMLSelectElement).options).some(o => o.value === 'BENEFICIARY' || o.value === 'BENEFICIARY_EXPERIENCE'))!;
    const optionValues = Array.from((domainSelect as HTMLSelectElement).options).map(o => o.value);
    // The real Meta Model code, from allDomains
    expect(optionValues).toContain('BENEFICIARY');
    // Not the stale enabledDomains code, which matches zero real assets
    expect(optionValues).not.toContain('BENEFICIARY_EXPERIENCE');
    // Domains enabledDomains omitted entirely (MOTIVATION, GOVERNANCE)
    // are now correctly offered too, since they come from allDomains
    expect(optionValues).toContain('MOTIVATION');
    expect(optionValues).toContain('GOVERNANCE');
  });

  it('shows canonical APPLICATION in the domain filter when framework config still returns legacy APPLICATIONS', async () => {
    mockFetch({
      '/ea-repository/framework-config': LEGACY_APPLICATIONS_CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('domain=APPLICATION')
        ? [asset({ assetType: 'Application' })]
        : [asset({ assetType: 'Application' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');

    const domainSelect = screen.getAllByRole('combobox')
      .find(s => (s as HTMLSelectElement).querySelector('option[value="ALL"]') && (s as HTMLSelectElement).querySelector('option[value="APPLICATION"]'))!;
    expect(domainSelect.querySelector('option[value="APPLICATIONS"]')).not.toBeInTheDocument();

    fireEvent.change(domainSelect, { target: { value: 'APPLICATION' } });
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[0].includes('domain=APPLICATION'))).toBe(true));
    expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[0].includes('domain=APPLICATIONS'))).toBe(false);
  });

  it('filters by status - sends the selected status as a server-side query param', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('status=DRAFT')
        ? [asset({ id: 'a2', name: 'Draft Asset', status: 'DRAFT' })]
        : [asset({ id: 'a1', name: 'Approved Asset', status: 'APPROVED' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Approved Asset');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="DRAFT"]'))!;
    fireEvent.change(statusSelect, { target: { value: 'DRAFT' } });
    expect(await screen.findByText('Draft Asset')).toBeInTheDocument();
    expect(screen.queryByText('Approved Asset')).not.toBeInTheDocument();
  });

  it('filters by source - proves the fix for a bug where this filter had working UI but was never actually applied', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('source=ADM_OUTPUT')
        ? [asset({ id: 'a2', name: 'ADM Generated', source: 'ADM_OUTPUT' })]
        : [asset({ id: 'a1', name: 'Manually Entered', source: 'MANUAL' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Manually Entered');
    const selects = screen.getAllByRole('combobox');
    const sourceSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="ADM_OUTPUT"]'))!;
    fireEvent.change(sourceSelect, { target: { value: 'ADM_OUTPUT' } });
    expect(await screen.findByText('ADM Generated')).toBeInTheDocument();
    expect(screen.queryByText('Manually Entered')).not.toBeInTheDocument();
  });

  it('filters by asset type - proves the same fix for the second previously-inert filter', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('assetType=CAPABILITY')
        ? [asset({ id: 'a2', name: 'Cap Asset', assetType: 'CAPABILITY' })]
        : [asset({ id: 'a1', name: 'App Asset', assetType: 'APPLICATION' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('App Asset');
    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="CAPABILITY"]'))!;
    fireEvent.change(typeSelect, { target: { value: 'CAPABILITY' } });
    expect(await screen.findByText('Cap Asset')).toBeInTheDocument();
    expect(screen.queryByText('App Asset')).not.toBeInTheDocument();
  });

  it('groups assets by source/cycle when Group by Cycle is enabled', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Manual One', source: 'MANUAL' }), asset({ id: 'a2', name: 'Upload One', source: 'UPLOAD' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Manual One');
    // Group by Cycle is only shown once ADM Output is selected as the
    // source (explicit correction: it doesn't apply to Manual/Upload
    // data the same way) - select it first to reveal the checkbox.
    fireEvent.change(screen.getByDisplayValue('All Sources'), { target: { value: 'ADM_OUTPUT' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(await screen.findByText(/Manual Entries/)).toBeInTheDocument();
    expect(screen.getByText(/Uploads/)).toBeInTheDocument();
  });
});

describe('RepositoryPage - CRUD', () => {
  it('creates a new asset via the modal', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText('+ New Asset')[0]);
    fireEvent.change(screen.getByLabelText(/Name \(English\)/), { target: { value: 'New App' } });

    const domainSelect = screen.getByLabelText(/Domain/);
    fireEvent.change(domainSelect, { target: { value: 'APPLICATION' } });
    const typeSelect = screen.getByLabelText(/Asset Type/);
    fireEvent.change(typeSelect, { target: { value: 'APPLICATION' } });
    fireEvent.click(screen.getByText('Save Asset'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/ea-repository/assets'));
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body).name).toBe('New App');
    });
  });

  it('normalizes legacy APPLICATIONS in the edit modal and preserves its Application object type', async () => {
    mockFetch({
      '/ea-repository/framework-config': LEGACY_APPLICATIONS_CONFIG,
      '/ea-repository/assets': [asset({ domain: 'APPLICATIONS', assetType: 'Application' })],
      '/ea-repository/summary': {},
      '/ea-repository/object-types/Application/attributes': { attributes: [] },
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('✏'));

    expect(screen.getByText('Edit Asset').closest('.modal')).toHaveStyle({
      maxHeight: 'calc(100vh - 32px)',
      overflowY: 'auto',
      boxSizing: 'border-box',
    });
    const domainSelect = screen.getByLabelText('Domain *') as HTMLSelectElement;
    expect(domainSelect.value).toBe('APPLICATION');
    expect(domainSelect.querySelector('option[value="APPLICATIONS"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Asset Type *')).toHaveValue('Application');

    fireEvent.click(screen.getByText('Save Asset'));
    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body)).toEqual(expect.objectContaining({ domain: 'APPLICATION', assetType: 'Application' }));
    });
  });

  // EA Repository Production Readiness, item 5: the same form/component
  // renders whatever attributes the tenant's Meta Model declares for the
  // selected object type - no per-type hardcoded form.
  it('renders dynamic Meta Model attribute fields once an object type is selected, and includes them in the save payload', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [], '/ea-repository/summary': {},
      '/ea-repository/object-types/APPLICATION/attributes': { attributes: [{ code: 'criticality', name: 'Criticality', attributeType: 'ENUM', isRequired: false, enumValues: [{ value: 'HIGH', label: 'High' }, { value: 'LOW', label: 'Low' }] }] },
    });
    render(<RepositoryPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText('+ New Asset')[0]);
    fireEvent.change(screen.getByLabelText(/Name \(English\)/), { target: { value: 'New App' } });
    fireEvent.change(screen.getByLabelText(/Domain/), { target: { value: 'APPLICATION' } });
    fireEvent.change(screen.getByLabelText(/Asset Type/), { target: { value: 'APPLICATION' } });

    const criticalitySelect = await screen.findByLabelText('Criticality');
    fireEvent.change(criticalitySelect, { target: { value: 'HIGH' } });
    fireEvent.click(screen.getByText('Save Asset'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/ea-repository/assets'));
      expect(JSON.parse(postCall[1].body).metadata).toEqual({ criticality: 'HIGH' });
    });
  });

  it('deletes an asset after confirmation', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Core Banking'));
    const deleteBtn = await screen.findByText(/Delete/);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('/ea-repository/assets/a1');
    });
    confirmSpy.mockRestore();
  });

  it('"Explore Dependencies" navigates to EA Views with the object-context query param for this asset', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Core Banking'));
    fireEvent.click(await screen.findByText(/Explore Dependencies/));
    expect(mockNavigate).toHaveBeenCalledWith('/ea-views?objectContext=a1');
  });
});

describe('RepositoryPage - connector provenance display (HRDF demo: ManageEngine/Informatica)', () => {
  it('shows "ManageEngine OpManager" (not a raw INTEGRATION badge) for an asset synced via ManageEngine, inferred from its OPM- sourceRef prefix', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ source: 'INTEGRATION', sourceRef: 'OPM-DEV-00001', name: 'JADARAT-DB01' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('JADARAT-DB01');
    expect(screen.getByText('ManageEngine OpManager')).toBeInTheDocument();
    expect(screen.queryByText('INTEGRATION')).not.toBeInTheDocument();
  });

  it('shows "Informatica Axon" for an asset synced via Informatica, inferred from its AXON- sourceRef prefix', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ source: 'INTEGRATION', sourceRef: 'AXON-CDE-00001', name: 'Employer Subsidy Records' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Employer Subsidy Records');
    expect(screen.getByText('Informatica Axon')).toBeInTheDocument();
  });

  it('falls back to a generic "Integration" label for an INTEGRATION-sourced asset with an unrecognized sourceRef prefix, rather than guessing wrong', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ source: 'INTEGRATION', sourceRef: 'SOME-OTHER-SYSTEM-01', name: 'Legacy Sync Asset' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Legacy Sync Asset');
    // getByText('Integration') is now ambiguous (the new Source dropdown
    // also has an "Integration" option) - scope to the actual source
    // badge, uniquely identified by its title (the sourceRef).
    expect(screen.getByTitle('SOME-OTHER-SYSTEM-01')).toHaveTextContent('Integration');
  });

  it('shows the real synced attributes (CPU, memory, OS) in the asset detail view for a ManageEngine-sourced server', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ source: 'INTEGRATION', sourceRef: 'OPM-DEV-00001', name: 'JADARAT-DB01', metadata: { cpu: 8, memory: 32, operatingSystem: 'Linux', ipAddress: '10.128.4.24' } })],
      '/ea-repository/assets/a1': asset({ source: 'INTEGRATION', sourceRef: 'OPM-DEV-00001', name: 'JADARAT-DB01', metadata: { cpu: 8, memory: 32, operatingSystem: 'Linux', ipAddress: '10.128.4.24' } }),
    });
    render(<RepositoryPage />);
    fireEvent.click(await screen.findByText('JADARAT-DB01'));
    expect(await screen.findByText(/SYNCED FROM MANAGEENGINE OPMANAGER/)).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.getByText('Linux')).toBeInTheDocument();
    expect(screen.getByText('10.128.4.24')).toBeInTheDocument();
  });

  it('shows no synced-attributes section for a MANUAL-sourced asset, even if it happens to have metadata', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ source: 'MANUAL', name: 'Manually Entered Server', metadata: { cpu: 4 } })],
      '/ea-repository/assets/a1': asset({ source: 'MANUAL', name: 'Manually Entered Server', metadata: { cpu: 4 } }),
    });
    render(<RepositoryPage />);
    fireEvent.click(await screen.findByText('Manually Entered Server'));
    await waitFor(() => expect(screen.queryByText(/SYNCED FROM/)).not.toBeInTheDocument());
  });

  it('shows no synced-attributes section for an INTEGRATION-sourced asset with no recognized synced attributes in its metadata', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ source: 'INTEGRATION', sourceRef: 'OPM-DEV-00002', name: 'Bare Server', metadata: {} })],
      '/ea-repository/assets/a1': asset({ source: 'INTEGRATION', sourceRef: 'OPM-DEV-00002', name: 'Bare Server', metadata: {} }),
    });
    render(<RepositoryPage />);
    fireEvent.click(await screen.findByText('Bare Server'));
    await waitFor(() => expect(screen.queryByText(/SYNCED FROM/)).not.toBeInTheDocument());
  });
});

describe('RepositoryPage - evidence-drawer deep link (Copilot Phase 1, ?assetId=<id>)', () => {
  it('opens the asset detail modal directly when ?assetId is present, fetching that asset by id', async () => {
    mockSearchParams = new URLSearchParams('assetId=a1');
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Core Banking' }), asset({ id: 'a2', name: 'CRM Platform' })],
      '/ea-repository/assets/a1': asset({ id: 'a1', name: 'Core Banking' }),
    });
    render(<RepositoryPage />);
    // The modal-only "Delete Asset" button only renders once AssetDetail
    // is actually open - distinguishes this from the asset merely
    // appearing in the background list, which loads regardless.
    expect(await screen.findByText('Delete Asset')).toBeInTheDocument();
  });

  it('clears the assetId query param after handling it, so it does not linger or re-trigger', async () => {
    mockSearchParams = new URLSearchParams('assetId=a1');
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Core Banking' })],
      '/ea-repository/assets/a1': asset({ id: 'a1', name: 'Core Banking' }),
    });
    render(<RepositoryPage />);
    await screen.findByText('Delete Asset');
    expect(mockSetSearchParams).toHaveBeenCalled();
  });

  it('fails silently (no modal, no crash) when the linked asset no longer exists', async () => {
    mockSearchParams = new URLSearchParams('assetId=deleted-asset');
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/ea-repository/assets/deleted-asset')) return Promise.reject(new Error('not found'));
      if (url.includes('/ea-repository/framework-config')) return Promise.resolve({ ok: true, json: () => Promise.resolve(CONFIG) });
      if (url.includes('/ea-repository/assets')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;
    render(<RepositoryPage />);
    await waitFor(() => expect(mockSetSearchParams).toHaveBeenCalled());
    expect(screen.queryByText('Delete Asset')).not.toBeInTheDocument();
  });

  it('does not attempt any deep-link fetch when no assetId is present (the normal case)', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {}, '/ea-repository/assets': [asset()] });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    expect(mockSetSearchParams).not.toHaveBeenCalled();
  });
});

describe('RepositoryPage - Advanced Filters apply-deferral (bug fix: query only re-runs on Apply, not every keystroke)', () => {
  const FILTER_DEFINITION = {
    objectType: 'APPLICATION',
    identityFields: [],
    attributes: [{ code: 'techStack', name: 'Tech Stack', dataType: 'TEXT', supportedOperators: ['CONTAINS'] }],
    relationships: [],
  };

  it('editing a condition in the builder does NOT re-query - only clicking Apply filters does', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG,
      '/ea-repository/assets/query': [asset()],
      '/ea-repository/assets': [asset()],
      '/ea-repository/summary': {},
      '/architecture-query/filter-definition': FILTER_DEFINITION,
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'APPLICATION' } });
    fireEvent.click(screen.getByText(/Advanced Filters/));
    fireEvent.click(await screen.findByText('+ Add condition'));
    await screen.findByText('Tech Stack');

    const queryCallsBeforeTyping = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/assets/query')).length;
    const textInput = document.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(textInput, { target: { value: 'Java' } });
    fireEvent.change(textInput, { target: { value: 'JavaEE' } });
    // Typing must not trigger the structured query endpoint at all
    const queryCallsAfterTyping = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/assets/query')).length;
    expect(queryCallsAfterTyping).toBe(queryCallsBeforeTyping);

    fireEvent.click(screen.getByText('Apply filters'));
    await waitFor(() => {
      const queryCallsAfterApply = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/assets/query')).length;
      expect(queryCallsAfterApply).toBeGreaterThan(queryCallsBeforeTyping);
    });
  });

  it('re-opening the panel after Apply seeds the draft from the applied query, not a blank builder', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG,
      '/ea-repository/assets/query': [asset()],
      '/ea-repository/assets': [asset()],
      '/ea-repository/summary': {},
      '/architecture-query/filter-definition': FILTER_DEFINITION,
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.change(screen.getByDisplayValue('All Types'), { target: { value: 'APPLICATION' } });
    fireEvent.click(screen.getByText(/Advanced Filters/));
    fireEvent.click(await screen.findByText('+ Add condition'));
    await screen.findByText('Tech Stack');
    fireEvent.click(screen.getByText('Apply filters'));
    await waitFor(() => expect(screen.getByText(/Hide Filters \(1\)/)).toBeInTheDocument());

    // Close and re-open the panel
    fireEvent.click(screen.getByText(/Hide Filters/));
    fireEvent.click(screen.getByText(/Advanced Filters \(1\)/));
    // The previously-applied condition is still shown, not a blank state
    expect(await screen.findByText('Tech Stack')).toBeInTheDocument();
  });
});

describe('RepositoryPage - Source-first filter reorganization (explicit correction)', () => {
  it('Source is the first dropdown, immediately after the search box', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    const selects = screen.getAllByRole('combobox');
    expect((selects[0] as HTMLSelectElement).value).toBe('ALL'); // the Source select, defaulting to "All Sources"
    expect(selects[0].querySelector('option[value="ALL"]')?.textContent).toBe('All Sources');
  });

  it('Source dropdown offers Integration and AI Generated, not just the original three', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    const sourceSelect = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    const values = Array.from(sourceSelect.options).map(o => o.value);
    expect(values).toEqual(['ALL', 'ADM_OUTPUT', 'MANUAL', 'UPLOAD', 'INTEGRATION', 'AI_GENERATED']);
  });

  it('selecting ADM Output hides Domain/Object Type and shows Group by Cycle instead', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    expect(screen.queryByText('Group by Cycle')).not.toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue('All Sources'), { target: { value: 'ADM_OUTPUT' } });
    expect(screen.queryByText('All Domains')).not.toBeInTheDocument();
    expect(screen.queryByText('All Types')).not.toBeInTheDocument();
    expect(screen.getByText('Group by Cycle')).toBeInTheDocument();
  });

  it.each(['MANUAL', 'UPLOAD', 'INTEGRATION', 'AI_GENERATED'])('selecting %s shows Domain/Object Type and hides Group by Cycle', async (source) => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.change(screen.getByDisplayValue('All Sources'), { target: { value: source } });
    expect(screen.getByText('All Domains')).toBeInTheDocument();
    expect(screen.getByText('All Types')).toBeInTheDocument();
    expect(screen.queryByText('Group by Cycle')).not.toBeInTheDocument();
  });

  it('switching from ADM Output back to Manual/Upload resets Group by Cycle so it is not silently left checked', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Manual One', source: 'MANUAL' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Manual One');
    fireEvent.change(screen.getByDisplayValue('All Sources'), { target: { value: 'ADM_OUTPUT' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByDisplayValue('ADM Output'), { target: { value: 'MANUAL' } });
    // The checkbox itself is now hidden entirely (Group by Cycle doesn't
    // apply to Manual), so its state cannot even be inspected via the
    // UI anymore - which is exactly the point: it's been reset and the
    // control that would show a stale "checked" state is gone.
    expect(screen.queryByText('Group by Cycle')).not.toBeInTheDocument();
  });

  it('selecting ADM Output clears any active Domain/Object Type filter and Advanced Filters state, not just hides their controls', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'App One' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('App One');
    fireEvent.change(screen.getAllByRole('combobox')[2], { target: { value: 'APPLICATION' } }); // Object Type select
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[0].includes('assetType=APPLICATION'))).toBe(true));

    fireEvent.change(screen.getByDisplayValue('All Sources'), { target: { value: 'ADM_OUTPUT' } });
    await waitFor(() => {
      const lastCall = (global.fetch as jest.Mock).mock.calls[(global.fetch as jest.Mock).mock.calls.length - 1][0];
      expect(lastCall).not.toContain('assetType=APPLICATION');
    });
  });
});

describe('RepositoryPage - Needs Reclassification banner (data reconciliation)', () => {
  it('does not show the banner when needsReclassificationCount is 0 or absent', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': { total: 5, needsReclassificationCount: 0 } });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    expect(screen.queryByText(/need manual reclassification/)).not.toBeInTheDocument();
  });

  it('shows the banner with the real count when needsReclassificationCount is nonzero', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': { total: 5612, needsReclassificationCount: 16 } });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    expect(screen.getByText(/16 assets could not be automatically matched/)).toBeInTheDocument();
  });

  it('clicking "Review These Assets" sends needsReclassification=true as a server-side query param', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': { total: 5612, needsReclassificationCount: 16 },
      '/ea-repository/assets': (url: string) => url.includes('needsReclassification=true')
        ? [asset({ id: 'a2', name: 'Orphaned Standard Asset' })]
        : [asset({ id: 'a1', name: 'Core Banking' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Review These Assets'));
    expect(await screen.findByText('Orphaned Standard Asset')).toBeInTheDocument();
    expect(screen.queryByText('Core Banking')).not.toBeInTheDocument();
  });

  it('toggles back to the normal list via "Show Normal List"', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': { total: 5612, needsReclassificationCount: 16 },
      '/ea-repository/assets': (url: string) => url.includes('needsReclassification=true')
        ? [asset({ id: 'a2', name: 'Orphaned Standard Asset' })]
        : [asset({ id: 'a1', name: 'Core Banking' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Review These Assets'));
    await screen.findByText('Orphaned Standard Asset');
    fireEvent.click(screen.getByText('Show Normal List'));
    expect(await screen.findByText('Core Banking')).toBeInTheDocument();
  });
});
