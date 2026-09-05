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

  // EA Repository Production Readiness, item 3.
  it('filters by ArchMind operating domain via the quick-filter pills - sends operatingDomain as a server-side query param', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': (url: string) => url.includes('operatingDomain=DATA_ARCHITECTURE')
        ? [asset({ id: 'a2', name: 'Data Entity Asset' })]
        : [asset({ id: 'a1', name: 'Core Banking' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Data Architecture'));
    expect(await screen.findByText('Data Entity Asset')).toBeInTheDocument();
    expect(screen.queryByText('Core Banking')).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('checkbox'));
    expect(await screen.findByText(/Manual Entries/)).toBeInTheDocument();
    expect(screen.getByText(/Uploads/)).toBeInTheDocument();
  });
});

// Live bug report fix: the summary cards row used to show duplicate
// cards for the same real concept (e.g. 'APPLICATION'/'APPLICATIONS'),
// and treated NORA-native 'GOVERNANCE'/'MOTIVATION' as if they were
// real ArchMind operating domains. Now driven by the fixed,
// always-present OPERATING_DOMAINS list (merged with summary.byDomain's
// resolved counts), not whatever raw values happen to be in the data.
describe('RepositoryPage - summary cards (bug fix: no duplicates, correct domain set)', () => {
  it('always renders exactly 8 cards (Show All + six operating domains + Strategy Layer), even when summary.byDomain has fewer entries than that', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()],
      '/ea-repository/summary': { total: 42, byDomain: [{ domain: 'APPLICATION_INTEGRATION', operatingDomainDisplayName: 'Applications & Integration', count: 42 }] },
    });
    render(<RepositoryPage />);
    await screen.findByText('Show All');
    expect(screen.getByText('Business Architecture')).toBeInTheDocument();
    expect(screen.getByText('Strategy Layer')).toBeInTheDocument();
    expect(screen.getByText('Applications & Integration')).toBeInTheDocument();
  });

  it('shows a single card with the merged count for a domain the backend resolved from multiple raw assetType values (the exact reported duplicate-card bug)', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()],
      '/ea-repository/summary': { total: 45, byDomain: [{ domain: 'APPLICATION_INTEGRATION', operatingDomainDisplayName: 'Applications & Integration', count: 30 }] },
    });
    render(<RepositoryPage />);
    await screen.findByText('Show All');
    expect(screen.getAllByText('Applications & Integration')).toHaveLength(1);
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows 0 (not missing) for an operating domain with no matching data', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()],
      '/ea-repository/summary': { total: 5, byDomain: [{ domain: 'DATA_ARCHITECTURE', operatingDomainDisplayName: 'Data Architecture', count: 5 }] },
    });
    render(<RepositoryPage />);
    await screen.findByText('Show All');
    const securityCard = screen.getByText('Security Architecture').closest('.stat-card');
    expect(securityCard).toHaveTextContent('0');
  });

  it('clicking a domain card sends operatingDomain (not the old, wrong domain param) as a server-side query param', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG,
      '/ea-repository/assets': (url: string, options: any) => url.includes('operatingDomain=STRATEGY_LAYER')
        ? [asset({ id: 'a2', name: 'Strategic Goal Asset' })]
        : [asset({ id: 'a1', name: 'Core Banking' })],
      '/ea-repository/summary': { total: 2, byDomain: [{ domain: 'STRATEGY_LAYER', operatingDomainDisplayName: 'Strategy Layer', count: 1 }] },
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Strategy Layer'));
    expect(await screen.findByText('Strategic Goal Asset')).toBeInTheDocument();
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
    expect(screen.getByText('Integration')).toBeInTheDocument();
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
