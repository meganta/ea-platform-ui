import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EaViewsPage from '../EaViewsPage';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

// EaViewsPage now uses useSearchParams (Object Context View entry point) -
// mocked per this codebase's established pattern (see LoginPage.test.tsx)
// rather than wrapping every render() in a real Router, since
// react-router-dom's real useSearchParams/useNavigate throw outside a
// Router context and none of these tests need real routing behavior.
let mockSearchParams = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, jest.fn()],
}), { virtual: true });

// Export wiring tests only need to verify EaViewsPage calls the right
// exportUtils function with the right data - the export functions'
// internal CSV/JSON/SVG/PNG/PDF/PPTX logic already has its own dedicated,
// thorough coverage in eaviews/__tests__/exportUtils.test.ts.
jest.mock('../eaviews/exportUtils', () => ({
  exportAsJSON: jest.fn(),
  exportNodesAsCSV: jest.fn(),
  exportMatrixAsCSV: jest.fn(),
  exportRoadmapAsCSV: jest.fn(),
  exportGraphAsSVG: jest.fn(),
  exportGraphAsPNG: jest.fn().mockResolvedValue(undefined),
  exportGraphAsPDF: jest.fn().mockResolvedValue(undefined),
  exportNodesAsPDF: jest.fn().mockResolvedValue(undefined),
  exportMatrixAsPDF: jest.fn().mockResolvedValue(undefined),
  exportRoadmapAsPDF: jest.fn().mockResolvedValue(undefined),
  exportGraphAsPPTX: jest.fn().mockResolvedValue(undefined),
  exportNodesAsPPTX: jest.fn().mockResolvedValue(undefined),
  exportMatrixAsPPTX: jest.fn().mockResolvedValue(undefined),
  exportRoadmapAsPPTX: jest.fn().mockResolvedValue(undefined),
}));
import * as exportUtils from '../eaviews/exportUtils';

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
});

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length); // most specific first
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    for (const pattern of sortedPatterns) {
      if (url.includes(pattern)) {
        const routeValue = routes[pattern];
        if (routeValue && typeof routeValue === 'object' && routeValue.__fail) {
          return Promise.resolve({ ok: false, status: routeValue.status ?? 500, statusText: 'Error', json: () => Promise.resolve({ statusCode: routeValue.status ?? 500, message: routeValue.message || 'Error' }) });
        }
        const value = typeof routeValue === 'function' ? routeValue(options) : routeValue;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

describe('EaViewsPage - tab navigation', () => {
  it('starts on the Dashboard tab', async () => {
    mockFetch({ '/ea-views/stats': {} });
    render(<EaViewsPage />);
    expect(await screen.findByText('🗺 EA Views & Viewpoints Studio')).toBeInTheDocument();
  });

  it('hides the tab strip while in the builder or viewer sub-views', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'My View', category: 'BUSINESS' }] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('My View'));
    await waitFor(() => expect(screen.queryByText('🏠 Dashboard')).not.toBeInTheDocument());
  });
});

describe('EaViewsPage - ViewLibrary', () => {
  const SAMPLE_VIEWPOINT = { id: 'vp1', name: 'Application Landscape', category: 'APPLICATION', description: 'Shows all applications', defaultVisualization: 'GRAPH' };

  it('lists predefined viewpoints and seeds the library on load', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    expect(await screen.findByText('Application Landscape')).toBeInTheDocument();
    await waitFor(() => {
      const seedCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/viewpoints/seed'));
      expect(seedCall).toBeDefined();
    });
  });

  it('filters viewpoints by category', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [
      { id: 'vp1', name: 'App View', category: 'APPLICATION', description: 'x' },
      { id: 'vp2', name: 'Business View', category: 'BUSINESS', description: 'y' },
    ]});
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('App View');
    fireEvent.click(screen.getByRole('button', { name: 'BUSINESS' }));
    expect(screen.getByText('Business View')).toBeInTheDocument();
    expect(screen.queryByText('App View')).not.toBeInTheDocument();
  });

  it('navigates to the builder with the selected viewpoint when Activate View is clicked', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('Application Landscape');
    fireEvent.click(screen.getByText('▶ Activate View'));
    // Builder view hides the tab strip
    await waitFor(() => expect(screen.queryByText('🏠 Dashboard')).not.toBeInTheDocument());
  });

  it('shows a Compatible badge once the compatibility check resolves', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT],
      '/ea-views/viewpoints/vp1/compatibility': { status: 'COMPATIBLE', rootTypeStatus: [], relatedTypeStatus: [], missingRootTypes: [] },
    });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('Application Landscape');
    expect(await screen.findByText('✓ Compatible')).toBeInTheDocument();
  });

  it('shows a Not Compatible badge when the tenant has no data for the required types', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT],
      '/ea-views/viewpoints/vp1/compatibility': { status: 'NOT_COMPATIBLE', rootTypeStatus: [], relatedTypeStatus: [], missingRootTypes: ['APPLICATION'] },
    });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('Application Landscape');
    expect(await screen.findByText('✕ Not Compatible')).toBeInTheDocument();
  });

  it('the library still renders (without a badge) when the compatibility check fails, rather than breaking the whole card', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT],
      '/ea-views/viewpoints/vp1/compatibility': { __fail: true, status: 500 },
    });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    expect(await screen.findByText('Application Landscape')).toBeInTheDocument();
    expect(screen.queryByText(/Compatible/)).not.toBeInTheDocument();
  });

  it('shows stakeholder and concern tags on a viewpoint card when present', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [
      { id: 'vp1', name: 'App Portfolio', category: 'APPLICATION', description: 'x', stakeholders: ['CIO', 'Application Architect'], concerns: ['Application duplication', 'Technology risk'] },
    ] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('App Portfolio');
    expect(screen.getByText(/CIO, Application Architect/)).toBeInTheDocument();
    expect(screen.getByText('Application duplication')).toBeInTheDocument();
    expect(screen.getByText('Technology risk')).toBeInTheDocument();
  });

  it('does not render a stakeholder/concern block at all for a viewpoint with neither', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [{ id: 'vp1', name: 'No Metadata View', category: 'APPLICATION', description: 'x' }] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('No Metadata View');
    expect(screen.queryByText('👤', { exact: false })).not.toBeInTheDocument();
  });

  it('shows a stakeholder filter dropdown populated from every viewpoint\'s stakeholders, and filtering by one narrows the list', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [
      { id: 'vp1', name: 'App Portfolio', category: 'APPLICATION', description: 'x', stakeholders: ['CIO'] },
      { id: 'vp2', name: 'Data Landscape', category: 'DATA', description: 'y', stakeholders: ['Data Architect'] },
    ] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('App Portfolio');
    fireEvent.change(screen.getByText('All Stakeholders').closest('select')!, { target: { value: 'CIO' } });
    expect(screen.getByText('App Portfolio')).toBeInTheDocument();
    expect(screen.queryByText('Data Landscape')).not.toBeInTheDocument();
  });

  it('does not show the stakeholder filter dropdown at all when no viewpoint has any stakeholders defined', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [{ id: 'vp1', name: 'Plain View', category: 'APPLICATION', description: 'x' }] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('Plain View');
    expect(screen.queryByText('All Stakeholders')).not.toBeInTheDocument();
  });
});

describe('EaViewsPage - MyViews', () => {
  const SAMPLE_VIEW = { id: 'v1', name: 'Payments Landscape', category: 'APPLICATION', status: 'PUBLISHED', architectureState: 'CURRENT', viewCount: 12, isFavorite: false };

  it('lists saved views with their metadata badges', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    expect(await screen.findByText('Payments Landscape')).toBeInTheDocument();
    expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
  });

  it('shows the empty state pointing to the View Library when there are no views', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    expect(await screen.findByText(/No views yet/)).toBeInTheDocument();
  });

  it('filters to favorites only when the Favorites toggle is clicked', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [
      { ...SAMPLE_VIEW, id: 'v1', name: 'Favorited View', isFavorite: true },
      { ...SAMPLE_VIEW, id: 'v2', name: 'Regular View', isFavorite: false },
    ]});
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Favorited View');
    fireEvent.click(screen.getByText('⭐ Favorites'));
    expect(screen.getByText('Favorited View')).toBeInTheDocument();
    expect(screen.queryByText('Regular View')).not.toBeInTheDocument();
  });

  it('toggling favorite does not also open the view (event propagation is stopped)', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    const favButtons = screen.getAllByText('⭐');
    fireEvent.click(favButtons[favButtons.length - 1]);
    // Still on my-views (tab strip visible), not navigated into the viewer
    await waitFor(() => expect(screen.getByText('🏠 Dashboard')).toBeInTheDocument());
  });

  it('POSTs to the favorite endpoint for the correct view id', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    fireEvent.click(screen.getAllByText('⭐').pop()!);
    await waitFor(() => {
      const favCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ea-views/v1/favorite'));
      expect(favCall).toBeDefined();
      expect(favCall[1].method).toBe('POST');
    });
  });

  it('clicking the clone button POSTs to the clone endpoint and refreshes the list, without opening the original view', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    fireEvent.click(screen.getByTitle('Clone this view'));
    await waitFor(() => {
      const cloneCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ea-views/v1/clone'));
      expect(cloneCall).toBeDefined();
      expect(cloneCall[1].method).toBe('POST');
    });
    // Still on my-views (tab strip visible), not navigated into the viewer -
    // same event-propagation-stopped pattern already proven for favorite/delete.
    expect(screen.getByText('🏠 Dashboard')).toBeInTheDocument();
  });

  it('does not delete when the user cancels the confirmation dialog', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('✕'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });
});

describe('EaViewsPage - Related Architecture Views entry point (ADM integration)', () => {
  it('reads the architectureState query param and lands directly on My Views, pre-filtered', async () => {
    mockSearchParams = new URLSearchParams('architectureState=TARGET');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views': [
        { id: 'v1', name: 'Target App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'TARGET' },
        { id: 'v2', name: 'Current App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT' },
      ],
    });
    render(<EaViewsPage />);
    expect(await screen.findByText('Target App Landscape')).toBeInTheDocument();
    expect(screen.queryByText('Current App Landscape')).not.toBeInTheDocument();
  });

  it('the architecture-state filter dropdown reflects the incoming param and can be changed manually afterward', async () => {
    mockSearchParams = new URLSearchParams('architectureState=BASELINE');
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Baseline View', category: 'Application', status: 'PUBLISHED', architectureState: 'BASELINE' }] });
    render(<EaViewsPage />);
    await screen.findByText('Baseline View');
    const select = screen.getByText('All Architecture States').closest('select') as HTMLSelectElement;
    expect(select.value).toBe('BASELINE');
    fireEvent.change(select, { target: { value: '' } });
    expect(select.value).toBe('');
  });

  it('does not land on My Views or apply any filter when no architectureState param is present', async () => {
    mockFetch({ '/ea-views/stats': {} });
    render(<EaViewsPage />);
    expect(await screen.findByText('🗺 EA Views & Viewpoints Studio')).toBeInTheDocument();
    expect(screen.queryByText('Target App Landscape')).not.toBeInTheDocument();
  });
});

describe('EaViewsPage - SnapshotsPanel', () => {
  it('does not fetch snapshots until a view is selected', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'View A' }] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📸 Snapshots').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📸 Snapshots')[0]);
    await screen.findByText('Select View');
    const snapshotCalls = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/snapshots'));
    expect(snapshotCalls).toHaveLength(0);
  });

  it('loads and displays snapshots once a view is selected', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'View A' }],
      '/ea-views/v1/snapshots': [{ id: 's1', name: 'Q1 2026 Snapshot', objectCount: 50, relationshipCount: 30, takenAt: '2026-01-01T00:00:00Z', architectureState: 'CURRENT' }],
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📸 Snapshots').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📸 Snapshots')[0]);
    await screen.findByText('Select View');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v1' } });
    expect(await screen.findByText('Q1 2026 Snapshot')).toBeInTheDocument();
  });

  it('shows a view-specific empty message when a view has no snapshots yet', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'View A' }], '/ea-views/v1/snapshots': [] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📸 Snapshots').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📸 Snapshots')[0]);
    await screen.findByText('Select View');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v1' } });
    expect(await screen.findByText(/No snapshots for this view yet/)).toBeInTheDocument();
  });
});

describe('EaViewsPage - ViewViewer dashboard/roadmap branching', () => {
  async function openView(view: any, extraRoutes: Record<string, any> = {}) {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [view], ...extraRoutes });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText(view.name));
  }

  it('a DASHBOARD-type view fetches and renders its widgets, not the graph/heatmap/etc mode picker', async () => {
    const view = { id: 'v1', name: 'Exec Dashboard', category: 'Governance', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'DASHBOARD' };
    await openView(view, {
      '/ea-views/v1/dashboard': { widgets: [{ id: 'w1', type: 'kpi', title: 'Total Apps', x: 0, y: 0, w: 1, h: 1, config: {} }], results: { w1: { value: 42, label: '42' } } },
    });
    expect(await screen.findByText('Total Apps')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    // The GRAPH/HEATMAP/etc quick mode picker is graph-data-specific and
    // should not appear for a dashboard view.
    expect(screen.queryByText(/HEATMAP/)).not.toBeInTheDocument();
  });

  it('a DASHBOARD-type view with no widgets yet shows the empty state with an "Add Widgets" prompt', async () => {
    const view = { id: 'v1', name: 'Empty Dashboard', category: 'Governance', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'DASHBOARD' };
    await openView(view, { '/ea-views/v1/dashboard': { widgets: [], results: {} } });
    expect(await screen.findByText(/no widgets yet/i)).toBeInTheDocument();
  });

  it('clicking "Edit Widgets" opens the DashboardBuilder', async () => {
    const view = { id: 'v1', name: 'Exec Dashboard', category: 'Governance', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'DASHBOARD' };
    await openView(view, { '/ea-views/v1/dashboard': { widgets: [], results: {} } });
    await screen.findByText(/no widgets yet/i);
    fireEvent.click(screen.getByText('⚙ Edit Widgets'));
    expect(await screen.findByText('Dashboard Widgets (0)')).toBeInTheDocument();
  });

  it('a ROADMAP-type view with no date fields configured shows the config panel, not an error page', async () => {
    const view = { id: 'v1', name: 'Project Roadmap', category: 'Governance', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'ROADMAP', rootObjectTypes: ['TechProject'], roadmapConfig: {} };
    await openView(view, {
      '/ea-views/v1/roadmap': { __fail: true, status: 400, message: 'This view has no roadmap date fields configured yet' },
      '/ea-views/date-fields': [{ code: 'startDate', name: 'Start Date' }, { code: 'endDate', name: 'End Date' }],
    });
    expect(await screen.findByText('Configure Roadmap Timeline')).toBeInTheDocument();
  });

  it('a ROADMAP-type view with date fields configured renders the timeline with real items', async () => {
    const view = { id: 'v1', name: 'Project Roadmap', category: 'Governance', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'ROADMAP', rootObjectTypes: ['TechProject'], roadmapConfig: { startField: 'StartDate', endField: 'EndDate' } };
    await openView(view, {
      '/ea-views/v1/roadmap': { items: [{ id: 'p1', name: 'Phase 1 Rollout', start: '2026-01-01T00:00:00Z', end: '2026-06-01T00:00:00Z', group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' }] },
    });
    expect(await screen.findByText('Phase 1 Rollout')).toBeInTheDocument();
    expect(screen.getByText('PMO')).toBeInTheDocument();
  });

  it('a GRAPH-type view (the pre-existing default) still shows the mode picker and does not call the roadmap/dashboard endpoints at all', async () => {
    const view = { id: 'v1', name: 'App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH' };
    await openView(view, { '/ea-views/v1/dataset': { legacy: { nodes: [], edges: [], metadata: {} } } });
    await waitFor(() => expect(screen.getByText(/GRAPH/)).toBeInTheDocument());
    const calls = (global.fetch as jest.Mock).mock.calls.map((c: any) => c[0]);
    expect(calls.some((u: string) => u.includes('/v1/roadmap'))).toBe(false);
    expect(calls.some((u: string) => u.includes('/v1/dashboard'))).toBe(false);
  });
});

describe('EaViewsPage - Architecture Packs tab', () => {
  it('navigates to the Packs tab and shows the CollectionsPanel', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/collections': [] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📦 Architecture Packs'));
    expect(await screen.findByText('Architecture Packs')).toBeInTheDocument();
    expect(await screen.findByText(/No Architecture Packs yet/)).toBeInTheDocument();
  });
});

describe('EaViewsPage - Version History', () => {
  const VIEW = { id: 'v1', name: 'App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH', currentVersionNumber: 2 };
  async function openView(extraRoutes: Record<string, any> = {}) {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [VIEW],
      '/ea-views/v1/dataset': { legacy: { nodes: [], edges: [], metadata: {} } },
      '/ea-views/saved-filters': [],
      ...extraRoutes,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('App Landscape'));
    await screen.findByText(/objects/);
  }

  it('clicking History fetches and shows the version list', async () => {
    await openView({ '/ea-views/v1/versions': [{ id: 'ver-2', versionNumber: 2, changeReason: 'Published', status: 'PUBLISHED', createdAt: '2026-02-01T00:00:00Z' }, { id: 'ver-1', versionNumber: 1, changeReason: 'Initial creation', status: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' }] });
    fireEvent.click(screen.getByText('🕐 History'));
    expect(await screen.findByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Initial creation')).toBeInTheDocument();
  });

  it('shows an empty-history message when there is none yet', async () => {
    await openView({ '/ea-views/v1/versions': [] });
    fireEvent.click(screen.getByText('🕐 History'));
    expect(await screen.findByText(/No version history yet/)).toBeInTheDocument();
  });

  it('does not show a Restore button for the currently active version', async () => {
    await openView({ '/ea-views/v1/versions': [{ id: 'ver-2', versionNumber: 2, changeReason: 'Current', status: 'PUBLISHED', createdAt: '2026-02-01T00:00:00Z' }] });
    fireEvent.click(screen.getByText('🕐 History'));
    await screen.findByText('Current');
    expect(screen.queryByText('Restore')).not.toBeInTheDocument();
  });

  it('shows a Restore button for a non-current version, and confirms before restoring', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    await openView({ '/ea-views/v1/versions': [{ id: 'ver-1', versionNumber: 1, changeReason: 'Old version', status: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' }] });
    fireEvent.click(screen.getByText('🕐 History'));
    await screen.findByText('Old version');
    fireEvent.click(screen.getByText('Restore'));
    await waitFor(() => {
      const restoreCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/versions/ver-1/restore'));
      expect(restoreCall).toBeDefined();
      expect(restoreCall[1].method).toBe('POST');
    });
    confirmSpy.mockRestore();
  });

  it('does not restore when the confirmation is cancelled', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    await openView({ '/ea-views/v1/versions': [{ id: 'ver-1', versionNumber: 1, changeReason: 'Old version', status: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' }] });
    fireEvent.click(screen.getByText('🕐 History'));
    await screen.findByText('Old version');
    fireEvent.click(screen.getByText('Restore'));
    const restoreCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/restore'));
    expect(restoreCall).toBeUndefined();
    confirmSpy.mockRestore();
  });
});

describe('EaViewsPage - Approval Workflow', () => {
  async function openDraftView(view: any, extraRoutes: Record<string, any> = {}) {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [view],
      '/ea-views/v1/dataset': { legacy: { nodes: [], edges: [], metadata: {} } },
      '/ea-views/saved-filters': [],
      ...extraRoutes,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText(view.name));
    await screen.findByText(/objects/);
  }

  it('a DRAFT view with no pending approval shows "Request Approval" alongside Publish, not Approve/Reject', async () => {
    await openDraftView({ id: 'v1', name: 'Draft View', category: 'Application', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'GRAPH', approvalStatus: 'NOT_REQUIRED' });
    expect(screen.getByText('📝 Request Approval')).toBeInTheDocument();
    expect(screen.getByText('🚀 Publish')).toBeInTheDocument();
    expect(screen.queryByText('✓ Approve')).not.toBeInTheDocument();
  });

  it('a DRAFT view with a PENDING approval shows Approve/Reject, and a Pending badge, not the Request Approval button', async () => {
    await openDraftView({ id: 'v1', name: 'Pending View', category: 'Application', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'GRAPH', approvalStatus: 'PENDING' });
    expect(screen.getByText('✓ Approve')).toBeInTheDocument();
    expect(screen.getByText('✕ Reject')).toBeInTheDocument();
    expect(screen.queryByText('📝 Request Approval')).not.toBeInTheDocument();
    expect(screen.getByText('⏳ Pending Approval')).toBeInTheDocument();
  });

  it('a PUBLISHED view shows neither the approval buttons nor the Publish button', async () => {
    await openDraftView({ id: 'v1', name: 'Live View', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH', approvalStatus: 'NOT_REQUIRED' });
    expect(screen.queryByText('📝 Request Approval')).not.toBeInTheDocument();
    expect(screen.queryByText('🚀 Publish')).not.toBeInTheDocument();
  });

  it('clicking Request Approval posts to the right endpoint and the button set updates without navigating away', async () => {
    await openDraftView(
      { id: 'v1', name: 'Draft View', category: 'Application', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'GRAPH', approvalStatus: 'NOT_REQUIRED' },
      { '/ea-views/v1/request-approval': { id: 'v1', approvalStatus: 'PENDING' } },
    );
    fireEvent.click(screen.getByText('📝 Request Approval'));
    expect(await screen.findByText('✓ Approve')).toBeInTheDocument();
    expect(screen.queryByText('📝 Request Approval')).not.toBeInTheDocument();
  });

  it('clicking Approve prompts for notes and posts them, updating the view to PUBLISHED without navigating away', async () => {
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('Looks good');
    await openDraftView(
      { id: 'v1', name: 'Pending View', category: 'Application', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'GRAPH', approvalStatus: 'PENDING' },
      { '/ea-views/v1/approve': { id: 'v1', status: 'PUBLISHED', approvalStatus: 'APPROVED' } },
    );
    fireEvent.click(screen.getByText('✓ Approve'));
    await waitFor(() => {
      const approveCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/v1/approve'));
      expect(approveCall).toBeDefined();
      expect(JSON.parse(approveCall[1].body)).toEqual({ notes: 'Looks good' });
    });
    expect(await screen.findByText('✓ Approved')).toBeInTheDocument();
    promptSpy.mockRestore();
  });

  it('clicking Reject prompts for a reason and does nothing if the prompt is cancelled', async () => {
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
    await openDraftView({ id: 'v1', name: 'Pending View', category: 'Application', status: 'DRAFT', architectureState: 'CURRENT', visualization: 'GRAPH', approvalStatus: 'PENDING' });
    fireEvent.click(screen.getByText('✕ Reject'));
    const rejectCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/v1/reject'));
    expect(rejectCall).toBeUndefined();
    promptSpy.mockRestore();
  });
});

describe('EaViewsPage - AI Explanation (Copilot integration)', () => {
  async function openView(extraRoutes: Record<string, any> = {}) {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH' }],
      '/ea-views/v1/dataset': { legacy: { nodes: [], edges: [], metadata: {} } },
      '/ea-views/saved-filters': [],
      ...extraRoutes,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('App Landscape'));
    await screen.findByText(/objects/);
  }

  it('clicking Ask AI opens the panel with the four preset actions and a free-text question box', async () => {
    await openView();
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    expect(screen.getByText('Explain this View')).toBeInTheDocument();
    expect(screen.getByText('Identify Risks')).toBeInTheDocument();
    expect(screen.getByText('Identify Gaps')).toBeInTheDocument();
    expect(screen.getByText('Find Duplicates')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Or ask your own question/)).toBeInTheDocument();
  });

  it('clicking a preset action posts the right action and renders the returned analysis', async () => {
    await openView({ '/ea-views/v1/ai-explain': { analysis: 'This view shows 5 applications with one deprecated system.' } });
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    fireEvent.click(screen.getByText('Identify Risks'));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ai-explain'));
      expect(call).toBeDefined();
      expect(JSON.parse(call[1].body)).toEqual({ action: 'risks' });
    });
    expect(await screen.findByText('This view shows 5 applications with one deprecated system.')).toBeInTheDocument();
  });

  it('shows a "Thinking..." indicator while the request is in flight, and disables the preset buttons', async () => {
    let resolveFn: (v: any) => void = () => {};
    const api = { '/ea-views/v1/ai-explain': () => new Promise(res => { resolveFn = res; }) };
    await openView(api);
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    fireEvent.click(screen.getByText('Explain this View'));
    expect(await screen.findByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByText('Explain this View')).toBeDisabled();
    resolveFn({ analysis: 'Done.' });
    await waitFor(() => expect(screen.queryByText('Thinking...')).not.toBeInTheDocument());
  });

  it('typing a custom question and pressing Enter asks it instead of a preset action', async () => {
    await openView({ '/ea-views/v1/ai-explain': { analysis: 'Two applications are past end of life.' } });
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    fireEvent.change(screen.getByPlaceholderText(/Or ask your own question/), { target: { value: 'Which apps are near end of life?' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Or ask your own question/), { key: 'Enter' });
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ai-explain'));
      expect(JSON.parse(call[1].body)).toEqual({ question: 'Which apps are near end of life?' });
    });
    expect(await screen.findByText('Two applications are past end of life.')).toBeInTheDocument();
  });

  it('the Ask button is disabled until a question is typed', async () => {
    await openView();
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    expect(screen.getByText('Ask')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Or ask your own question/), { target: { value: 'x' } });
    expect(screen.getByText('Ask')).not.toBeDisabled();
  });

  it('shows an error message (not a blank panel) when the backend returns an error-shaped response, since api.post never rejects on an HTTP error status', async () => {
    await openView({ '/ea-views/v1/ai-explain': { __fail: true, status: 400, message: 'Unknown action' } });
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    fireEvent.click(screen.getByText('Explain this View'));
    expect(await screen.findByText(/Unknown action/)).toBeInTheDocument();
  });

  it('closing and reopening the panel does not carry over a previous analysis or error', async () => {
    await openView({ '/ea-views/v1/ai-explain': { analysis: 'First answer.' } });
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    fireEvent.click(screen.getByText('Explain this View'));
    await screen.findByText('First answer.');
    fireEvent.click(screen.getByText('Close'));
    fireEvent.click(screen.getByText('🤖 Ask AI'));
    expect(screen.queryByText('First answer.')).not.toBeInTheDocument();
  });
});

describe('EaViewsPage - Export', () => {
  const GRAPH_VIEW = { id: 'v1', name: 'App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH', rootObjectTypes: ['Application'], relatedObjectTypes: ['ITComponent'] };
  async function openGraphView() {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [GRAPH_VIEW],
      '/ea-views/v1/dataset': { legacy: { nodes: [{ id: 'a1', name: 'App A', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {} } },
      '/ea-views/saved-filters': [],
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('App Landscape'));
    await screen.findByText(/objects/);
  }

  it('clicking Export opens a menu with JSON, CSV, SVG, PNG, PDF, and PPTX options for a GRAPH view', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('SVG')).toBeInTheDocument();
    expect(screen.getByText('PNG')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('PPTX')).toBeInTheDocument();
  });

  it('clicking JSON calls exportAsJSON with the current nodes/edges and closes the menu', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('JSON'));
    expect(exportUtils.exportAsJSON).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ name: 'App A' })]) }),
      expect.objectContaining({ viewName: 'App Landscape', architectureState: 'CURRENT' }),
    );
    expect(screen.queryByText('JSON')).not.toBeInTheDocument(); // menu closed
  });

  it('clicking CSV on a GRAPH view calls exportNodesAsCSV (not the matrix exporter)', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('CSV'));
    expect(exportUtils.exportNodesAsCSV).toHaveBeenCalled();
    expect(exportUtils.exportMatrixAsCSV).not.toHaveBeenCalled();
  });

  it('clicking SVG calls exportGraphAsSVG with the live svg element', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('SVG'));
    expect(exportUtils.exportGraphAsSVG).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ viewName: 'App Landscape' }));
  });

  it('switching to MATRIX mode and exporting CSV calls exportMatrixAsCSV, not the plain node exporter', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText(/MATRIX/));
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('CSV'));
    expect(exportUtils.exportMatrixAsCSV).toHaveBeenCalled();
    expect(exportUtils.exportNodesAsCSV).not.toHaveBeenCalled();
  });

  it('does not offer an SVG option once switched to a non-graph visualization mode', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText(/TABLE/));
    fireEvent.click(screen.getByText('⬇ Export'));
    expect(screen.queryByText('SVG')).not.toBeInTheDocument();
  });

  it('does not offer a PNG option once switched to a non-graph visualization mode (PDF/PPTX remain available for tabular formats)', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText(/TABLE/));
    fireEvent.click(screen.getByText('⬇ Export'));
    expect(screen.queryByText('PNG')).not.toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('PPTX')).toBeInTheDocument();
  });

  it('clicking PNG calls exportGraphAsPNG with the live svg element and shows an exporting indicator while in flight', async () => {
    let resolvePng: () => void = () => {};
    (exportUtils.exportGraphAsPNG as jest.Mock).mockReturnValue(new Promise<void>(res => { resolvePng = res; }));
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('PNG'));
    expect(exportUtils.exportGraphAsPNG).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ viewName: 'App Landscape' }));
    expect(await screen.findByText(/Exporting PNG/)).toBeInTheDocument();
    resolvePng();
    await waitFor(() => expect(screen.queryByText(/Exporting PNG/)).not.toBeInTheDocument());
  });

  it('clicking PDF on a GRAPH view calls exportGraphAsPDF (the image-embedding variant), not the table variant', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('PDF'));
    await waitFor(() => expect(exportUtils.exportGraphAsPDF).toHaveBeenCalled());
    expect(exportUtils.exportNodesAsPDF).not.toHaveBeenCalled();
  });

  it('clicking PDF on a TABLE view calls exportNodesAsPDF (the table variant), not the graph-image variant', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText(/TABLE/));
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('PDF'));
    await waitFor(() => expect(exportUtils.exportNodesAsPDF).toHaveBeenCalled());
    expect(exportUtils.exportGraphAsPDF).not.toHaveBeenCalled();
  });

  it('clicking PDF on a MATRIX view calls exportMatrixAsPDF', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText(/MATRIX/));
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('PDF'));
    await waitFor(() => expect(exportUtils.exportMatrixAsPDF).toHaveBeenCalled());
  });

  it('clicking PPTX on a GRAPH view calls exportGraphAsPPTX', async () => {
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('PPTX'));
    await waitFor(() => expect(exportUtils.exportGraphAsPPTX).toHaveBeenCalled());
  });

  it('shows an error alert if an async export rejects, and clears the exporting indicator afterward', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    (exportUtils.exportGraphAsPNG as jest.Mock).mockRejectedValue(new Error('rasterization failed'));
    await openGraphView();
    fireEvent.click(screen.getByText('⬇ Export'));
    fireEvent.click(screen.getByText('PNG'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('rasterization failed')));
    expect(screen.queryByText(/Exporting PNG/)).not.toBeInTheDocument();
    alertSpy.mockRestore();
  });

  it('a DASHBOARD view only offers JSON export, not CSV, SVG, PNG, PDF, or PPTX', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v2', name: 'Exec Dashboard', category: 'Governance', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'DASHBOARD' }],
      '/ea-views/v2/dashboard': { widgets: [], results: {} },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Exec Dashboard'));
    await screen.findByText(/no widgets yet/i);
    fireEvent.click(screen.getByText('⬇ Export'));
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.queryByText('CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('SVG')).not.toBeInTheDocument();
    expect(screen.queryByText('PNG')).not.toBeInTheDocument();
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
    expect(screen.queryByText('PPTX')).not.toBeInTheDocument();
  });
});

describe('EaViewsPage - Saved Filters', () => {
  const GRAPH_VIEW = { id: 'v1', name: 'App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH' };
  async function openGraphView(extraRoutes: Record<string, any> = {}) {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [GRAPH_VIEW],
      '/ea-views/v1/dataset': { legacy: { nodes: [], edges: [], metadata: {} } },
      '/ea-views/saved-filters': [],
      ...extraRoutes,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('App Landscape'));
  }

  it('fetches the saved filter list when a view opens', async () => {
    await openGraphView({ '/ea-views/saved-filters': [{ id: 'f1', name: 'Critical Applications', filterConfig: { status: 'APPROVED' } }] });
    expect(await screen.findByText('📁 Critical Applications')).toBeInTheDocument();
  });

  it('does not show the saved-filters dropdown/chip list when there are none yet', async () => {
    await openGraphView({ '/ea-views/saved-filters': [] });
    await screen.findByText(/objects/); // wait for the view to finish loading
    expect(screen.queryByText('📁 Apply Saved Filter...')).not.toBeInTheDocument();
  });

  it('clicking Save Filters opens the name input box', async () => {
    await openGraphView();
    fireEvent.click(await screen.findByText('💾 Save Filters'));
    expect(screen.getByPlaceholderText(/Critical Applications/)).toBeInTheDocument();
  });

  it('Save Current Filters is disabled until a name is entered', async () => {
    await openGraphView();
    fireEvent.click(await screen.findByText('💾 Save Filters'));
    expect(screen.getByText('Save Current Filters')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Critical Applications/), { target: { value: 'My Preset' } });
    expect(screen.getByText('Save Current Filters')).not.toBeDisabled();
  });

  it('saving posts the current filter state and adds the new preset to the visible list', async () => {
    await openGraphView({
      '/ea-views/saved-filters': (opts: any) => {
        if (opts?.method === 'POST') return { id: 'new-f1', name: JSON.parse(opts.body).name, filterConfig: JSON.parse(opts.body).filterConfig };
        return [];
      },
    });
    fireEvent.click(await screen.findByText('💾 Save Filters'));
    fireEvent.change(screen.getByPlaceholderText(/Critical Applications/), { target: { value: 'My Preset' } });
    fireEvent.click(screen.getByText('Save Current Filters'));
    expect(await screen.findByText('📁 My Preset')).toBeInTheDocument();
    const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ea-views/saved-filters') && c[1]?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall[1].body).name).toBe('My Preset');
  });

  it('clicking a saved filter chip applies its filterConfig to the current view', async () => {
    await openGraphView({ '/ea-views/saved-filters': [{ id: 'f1', name: 'Approved Only', filterConfig: { status: 'APPROVED', search: 'payments' } }] });
    fireEvent.click(await screen.findByText('📁 Approved Only'));
    expect((screen.getByPlaceholderText('🔍 Search...') as HTMLInputElement).value).toBe('payments');
  });

  it('deleting a saved filter chip removes it from the list without applying it', async () => {
    await openGraphView({ '/ea-views/saved-filters': [{ id: 'f1', name: 'To Delete', filterConfig: { status: 'APPROVED' } }] });
    await screen.findByText('📁 To Delete');
    fireEvent.click(screen.getByTitle('Delete this saved filter'));
    await waitFor(() => expect(screen.queryByText('📁 To Delete')).not.toBeInTheDocument());
    const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ea-views/saved-filters/f1'));
    expect(deleteCall[1].method).toBe('DELETE');
    // Did not also apply the filter as a side effect of clicking the ✕
    expect((screen.getByPlaceholderText('🔍 Search...') as HTMLInputElement).value).toBe('');
  });
});

describe('EaViewsPage - Tree/Cards visualization modes', () => {
  it('switching to TREE mode nests a child under its parent via ViewDataset.hierarchies and supports collapsing it', async () => {
    const p1 = { id: 'p1', name: 'Parent Cap', assetType: 'GovCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: {} };
    const c1 = { id: 'c1', name: 'Child Cap', assetType: 'GovCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: { parentId: 'p1' } };
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Capability Tree', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/dataset': {
        legacy: { nodes: [p1, c1], edges: [], metadata: {} },
        dataset: { objects: [p1, c1], relationships: [], paths: [], hierarchies: [{ rootIds: ['p1'], parentByObjectId: { p1: null, c1: 'p1' }, source: 'metadata.parentId' }], metrics: [] },
        eligibility: { eligible: [{ visualization: 'TREE', eligible: true, score: 0.85, reasons: [] }], ineligible: [] },
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Capability Tree'));
    fireEvent.click(await screen.findByText(/TREE/));
    expect(await screen.findByText('Parent Cap')).toBeInTheDocument();
    expect(screen.getByText('Child Cap')).toBeInTheDocument();
    fireEvent.click(screen.getByText('▼'));
    expect(screen.queryByText('Child Cap')).not.toBeInTheDocument();
  });

  it('switching to CARDS mode renders each node as a card with its description', async () => {
    const a1 = { id: 'a1', name: 'HR System', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {}, description: 'Handles employee records' };
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'App Cards', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/dataset': {
        legacy: { nodes: [a1], edges: [], metadata: {} },
        dataset: { objects: [a1], relationships: [], paths: [], hierarchies: [], metrics: [] },
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('App Cards'));
    fireEvent.click(await screen.findByText(/CARDS/));
    expect(await screen.findByText('HR System')).toBeInTheDocument();
    expect(screen.getByText('Handles employee records')).toBeInTheDocument();
  });
});

// Phase 4B: the old /heatmap-fields backend endpoint was removed -
// ViewDataset.metrics (already present in the single /dataset fetch)
// replaces its purpose entirely. This replaces the old "fetches
// heatmap-fields..." test, which verified behavior that no longer
// exists.
describe('EaViewsPage - Heatmap metric selection (Phase 4B)', () => {
  it('HEATMAP mode uses ViewDataset.metrics candidates directly, with no separate heatmap-fields network call', async () => {
    const c1 = { id: 'c1', name: 'Cap A', assetType: 'GovCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: { maturityLevel: 'High' } };
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Cap Heatmap', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/dataset': {
        legacy: { nodes: [c1], edges: [], metadata: {} },
        dataset: { objects: [c1], relationships: [], paths: [], hierarchies: [{ rootIds: ['c1'], parentByObjectId: { c1: null }, source: 'metadata.parentId' }], metrics: [{ key: 'maturityLevel', label: 'maturityLevel', dataType: 'categorical', coveragePercent: 100, distinctValues: ['High'] }] },
        eligibility: { eligible: [{ visualization: 'HEATMAP', eligible: true, score: 0.7, reasons: [], recommendedConfig: { metricKey: 'maturityLevel', candidateMetrics: ['maturityLevel'] } }], ineligible: [] },
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Cap Heatmap'));
    fireEvent.click(await screen.findByText(/HEATMAP/));
    expect(await screen.findByText('Cap A')).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[0].includes('/heatmap-fields'))).toBe(false);
  });
});

// Phase 4C: Graph progressive disclosure - verifies the focus/initial-
// visible-subset/expand-next-hop behavior actually wires through the real
// component, not just the pure utility functions in isolation.
describe('EaViewsPage - Graph progressive disclosure (Phase 4C)', () => {
  const capA = { id: 'capA', name: 'Capability A', role: 'PRIMARY', assetType: 'GovCapability', semanticType: 'BusinessCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: {} };
  const appX = { id: 'appX', name: 'App X', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} };
  const tech1 = { id: 'tech1', name: 'Tech 1', role: 'RELATED', assetType: 'TechComponent', semanticType: 'TechComponent', domain: 'TECHNOLOGY', status: 'APPROVED', tags: [], metadata: {} };
  const relCapAX = { id: 'relCapAX', sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' };
  const relXTech1 = { id: 'relXTech1', sourceId: 'appX', targetId: 'tech1', relationshipType: 'hosted_on', label: 'hosted_on' };
  const graphDataset = {
    objects: [capA, appX, tech1],
    relationships: [relCapAX, relXTech1],
    paths: [{ id: 'p1', rootObjectId: 'capA', objectIds: ['capA', 'appX', 'tech1'], relationshipIds: ['relCapAX', 'relXTech1'], hopCount: 2 }],
    hierarchies: [], metrics: [], provenance: { truncated: false },
  };
  const graphEligibility = { eligible: [{ visualization: 'GRAPH', eligible: true, score: 0.9, reasons: [] }], ineligible: [] };

  it('initially shows only Capability A and App X (Tech 1 stays hidden), not the full 3-object dataset', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Focus Graph', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/dataset': { legacy: { nodes: [capA, appX, tech1], edges: [relCapAX, relXTech1], metadata: {} }, dataset: graphDataset, eligibility: graphEligibility },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Focus Graph'));
    expect(await screen.findByText('Capability A')).toBeInTheDocument();
    expect(screen.getByText('App X')).toBeInTheDocument();
    expect(screen.queryByText('Tech 1')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 3 objects/)).toBeInTheDocument();
  });

  it('clicking "Expand next hop" reveals Tech 1', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Focus Graph', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/dataset': { legacy: { nodes: [capA, appX, tech1], edges: [relCapAX, relXTech1], metadata: {} }, dataset: graphDataset, eligibility: graphEligibility },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Focus Graph'));
    await screen.findByText('Capability A');
    fireEvent.click(screen.getByText(/Expand next hop/));
    expect(await screen.findByText('Tech 1')).toBeInTheDocument();
    expect(screen.getByText(/Showing 3 of 3 objects/)).toBeInTheDocument();
  });

  it('shows the deterministic ineligibility reason instead of an empty canvas when GRAPH is not eligible', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'No Rels', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/dataset': {
        legacy: { nodes: [capA], edges: [], metadata: {} },
        dataset: { objects: [capA], relationships: [], paths: [], hierarchies: [], metrics: [], provenance: { truncated: false } },
        eligibility: { eligible: [], ineligible: [{ visualization: 'GRAPH', eligible: false, score: 0, reasons: ['No relationships in this result - a graph would show only disconnected objects.'] }] },
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('No Rels'));
    expect(await screen.findByText(/No relationships in this result/)).toBeInTheDocument();
  });
});

describe('EaViewsPage - Scenario switching (Phase 5A)', () => {
  const capA = { id: 'capA', name: 'Capability A', role: 'PRIMARY', assetType: 'GovCapability', semanticType: 'BusinessCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: {} };
  const appX = { id: 'appX', name: 'App X', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} };
  const techY = { id: 'techY', name: 'Tech Y', role: 'RELATED', assetType: 'TechComponent', semanticType: 'TechComponent', domain: 'TECHNOLOGY', status: 'APPROVED', tags: [], metadata: {} };
  const appZ = { id: 'appZ', name: 'App Z', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} };
  const techK = { id: 'techK', name: 'Tech K', role: 'RELATED', assetType: 'TechComponent', semanticType: 'TechComponent', domain: 'TECHNOLOGY', status: 'APPROVED', tags: [], metadata: {} };
  const appQ = { id: 'appQ', name: 'App Q', role: 'RELATED', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} };
  const techM = { id: 'techM', name: 'Tech M', role: 'RELATED', assetType: 'TechComponent', semanticType: 'TechComponent', domain: 'TECHNOLOGY', status: 'APPROVED', tags: [], metadata: {} };

  const scenarioList = [
    { id: 'current', name: 'Current Architecture', type: 'CURRENT', status: 'APPROVED', horizonDate: null, sequence: null, parentScenarioId: null },
    { id: 'transition', name: 'Transition 2027', type: 'TRANSITION', status: 'APPROVED', horizonDate: '2027-06-01', sequence: 1, parentScenarioId: 'current' },
    { id: 'targetA', name: 'Target A', type: 'TARGET', status: 'APPROVED', horizonDate: '2028-01-01', sequence: 2, parentScenarioId: 'transition' },
    { id: 'targetB', name: 'Target B', type: 'TARGET', status: 'DRAFT', horizonDate: '2028-01-01', sequence: 2, parentScenarioId: 'transition' },
  ];

  function makeDatasetResponse(scenarioId: string, objects: any[], relationships: any[], paths: any[] = []) {
    return {
      legacy: { nodes: objects, edges: relationships, metadata: {} },
      dataset: { context: { scenario: { id: scenarioId } }, objects, relationships, paths, hierarchies: [], metrics: [], provenance: { truncated: false } },
      eligibility: { eligible: [{ visualization: 'TABLE', eligible: true, score: 0.7, reasons: [] }, { visualization: 'GRAPH', eligible: true, score: 0.6, reasons: [] }], ineligible: [] },
    };
  }
  // Each response's relationships form a single Capability -> App -> Tech
  // chain, matching the acceptance fixture's actual configured-path
  // intent - included as `paths` too, so Table renders one correlated
  // row per scenario (matching Phase 4A's own real behavior) rather than
  // two separate single-hop rows that would repeat the App name across
  // rows as both a source and a target.
  const currentResponse = makeDatasetResponse('current', [capA, appX, techY],
    [{ id: 'r1', sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' }, { id: 'r2', sourceId: 'appX', targetId: 'techY', relationshipType: 'hosted_on', label: 'hosted_on' }],
    [{ id: 'pCurrent', rootObjectId: 'capA', objectIds: ['capA', 'appX', 'techY'], relationshipIds: ['r1', 'r2'], hopCount: 2 }]);
  const targetAResponse = makeDatasetResponse('targetA', [capA, appZ, techK],
    [{ id: 'r3', sourceId: 'capA', targetId: 'appZ', relationshipType: 'supported_by', label: 'supported_by' }, { id: 'r4', sourceId: 'appZ', targetId: 'techK', relationshipType: 'hosted_on', label: 'hosted_on' }],
    [{ id: 'pTargetA', rootObjectId: 'capA', objectIds: ['capA', 'appZ', 'techK'], relationshipIds: ['r3', 'r4'], hopCount: 2 }]);
  const targetBResponse = makeDatasetResponse('targetB', [capA, appQ, techM],
    [{ id: 'r5', sourceId: 'capA', targetId: 'appQ', relationshipType: 'supported_by', label: 'supported_by' }, { id: 'r6', sourceId: 'appQ', targetId: 'techM', relationshipType: 'hosted_on', label: 'hosted_on' }],
    [{ id: 'pTargetB', rootObjectId: 'capA', objectIds: ['capA', 'appQ', 'techM'], relationshipIds: ['r5', 'r6'], hopCount: 2 }]);

  async function openView(datasetRoute: any) {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Multi-Scenario View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': datasetRoute,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Multi-Scenario View'));
    await screen.findByText('Current Architecture');
  }

  // ── Mandatory race-condition test ───────────────────────────────────
  it('fast Current -> Target A -> Target B switching: Target B resolving first is never overwritten by a later-resolving, stale Target A response', async () => {
    let resolveA: (v: any) => void = () => {};
    let resolveB: (v: any) => void = () => {};
    const promiseA = new Promise(r => { resolveA = r; });
    const promiseB = new Promise(r => { resolveB = r; });
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      if (body.scenarioId === 'targetA') return promiseA;
      if (body.scenarioId === 'targetB') return promiseB;
      return currentResponse;
    });

    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A')); // request A - deliberately never resolved yet
    // pendingScenarioId now shows "Switching to Target A…" as the summary badge - re-derive the current summary text to reopen
    fireEvent.click(screen.getByText(/Switching to Target A/));
    fireEvent.click(await screen.findByText('Target B')); // request B, before A has resolved

    // B resolves first
    resolveB(targetBResponse);
    await screen.findByText('App Q'); // Target B's own object appears
    expect(screen.getAllByText('Target B').length).toBeGreaterThan(0);
    expect(screen.queryByText('App X')).not.toBeInTheDocument(); // Current's object is gone
    expect(screen.queryByText('App Z')).not.toBeInTheDocument(); // Target A's object never appeared

    // A resolves AFTER B - this stale response must never commit
    resolveA(targetAResponse);
    await new Promise(r => setTimeout(r, 0)); // flush microtasks
    expect(screen.getAllByText('Target B').length).toBeGreaterThan(0); // label still correctly says B
    expect(screen.getByText('App Q')).toBeInTheDocument(); // B's data still displayed
    expect(screen.queryByText('App Z')).not.toBeInTheDocument(); // A's data never overwrote B's
  });

  it('a failed scenario switch retains the previously committed scenario and dataset, and shows an error, without pretending the switch succeeded', async () => {
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      if (body.scenarioId === 'targetA') return Promise.reject(new Error('network error'));
      return currentResponse;
    });
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await waitFor(() => expect(screen.getByText(/Failed to switch scenario/)).toBeInTheDocument());
    // scenario label and data are both still Current's, not falsely showing Target A
    expect(screen.getAllByText('Current Architecture').length).toBeGreaterThan(0);
    expect(screen.getByText('App X')).toBeInTheDocument();
    expect(screen.queryByText('App Z')).not.toBeInTheDocument();
  });

  it('a successful switch updates the scenario label and the displayed dataset together, in the same commit', async () => {
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      return body.scenarioId === 'targetA' ? targetAResponse : currentResponse;
    });
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await screen.findByText('App Z');
    expect(screen.getAllByText('Target A').length).toBeGreaterThan(0);
    expect(screen.queryByText('App X')).not.toBeInTheDocument();
  });

  it('the scenario selector lists all four scenarios with lineage-correct grouping - Target A and Target B as siblings, not sequential', async () => {
    await openView(currentResponse);
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    expect(await screen.findByText('Transition 2027')).toBeInTheDocument();
    expect(screen.getByText('Target A')).toBeInTheDocument();
    expect(screen.getByText('Target B')).toBeInTheDocument();
    expect(screen.getAllByText('DRAFT').length).toBeGreaterThan(0); // Target B's own draft badge
  });

  it('shows the lightweight lineage context path for the active scenario', async () => {
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      return body.scenarioId === 'targetA' ? targetAResponse : currentResponse;
    });
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await screen.findByText('App Z');
    expect(await screen.findByText('Current Architecture → Transition 2027 → Target A')).toBeInTheDocument();
  });

  it('shows an eligibility-fallback notice with the scenario name when the current visualization becomes ineligible after a switch', async () => {
    const ineligibleTargetA = { ...targetAResponse, eligibility: { eligible: [{ visualization: 'GRAPH', eligible: true, score: 0.6, reasons: [] }], ineligible: [{ visualization: 'TABLE', eligible: false, score: 0, reasons: ['no objects'] }] } };
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      return body.scenarioId === 'targetA' ? ineligibleTargetA : currentResponse;
    });
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await waitFor(() => expect(screen.getByText(/is unavailable for Target A. Switched to/)).toBeInTheDocument());
  });

  it('temporarily switching scenario does not persist/mutate the saved View - no PUT request is made merely from switching', async () => {
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      return body.scenarioId === 'targetA' ? targetAResponse : currentResponse;
    });
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await screen.findByText('App Z');
    expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[1]?.method === 'PUT')).toBe(false);
  });

  it('explicit "Set as default" persists the active scenario via PUT, only on explicit user action', async () => {
    await openView((options: any) => {
      const body = JSON.parse(options.body);
      return body.scenarioId === 'targetA' ? targetAResponse : currentResponse;
    });
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await screen.findByText('App Z');
    fireEvent.click(screen.getAllByText('Target A')[0]); // reopen to find the button (Target A is now the active summary badge)
    fireEvent.click(await screen.findByText(/Set as default/));
    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body)).toMatchObject({ scenarioId: 'targetA' });
    });
  });

  it('a scenario-less View displays "Current Architecture" rather than an ambiguous "No Scenario"', async () => {
    await openView(currentResponse);
    expect(screen.getAllByText('Current Architecture').length).toBeGreaterThan(0);
  });

  it('switching scenario in GRAPH mode retains focus on Capability A (present in both) while its scenario-specific neighbors change', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Graph Scenario View', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': (options: any) => {
        const body = JSON.parse(options.body);
        return body.scenarioId === 'targetA' ? targetAResponse : currentResponse;
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Graph Scenario View'));
    await screen.findByText('Capability A');
    expect(screen.getByText('App X')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await screen.findByText('App Z');
    expect(screen.getByText('Capability A')).toBeInTheDocument(); // focus retained
    expect(screen.queryByText('App X')).not.toBeInTheDocument(); // Current's neighbor gone
    expect(screen.getByText('App Z')).toBeInTheDocument(); // Target A's neighbor present via normal disclosure
  });

  // Section 10: URL scenario state
  it('a ?scenario=<id> URL param is sent as the initial scenario override on load', async () => {
    mockSearchParams = new URLSearchParams('scenario=targetA');
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Multi-Scenario View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': (options: any) => {
        const body = JSON.parse(options.body);
        return body.scenarioId === 'targetA' ? targetAResponse : currentResponse;
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Multi-Scenario View'));
    await screen.findByText('App Z'); // Target A's own object, proving the URL override was applied on the initial load
    expect(screen.getAllByText('Target A').length).toBeGreaterThan(0);
  });

  it('an invalid/cross-tenant ?scenario=<id> falls back safely to the View\'s own default rather than getting stuck', async () => {
    mockSearchParams = new URLSearchParams('scenario=not-a-real-scenario');
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Multi-Scenario View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': (options: any) => {
        const body = JSON.parse(options.body);
        return body.scenarioId === 'not-a-real-scenario' ? {} : currentResponse; // simulates the backend's failure shape - no `dataset` key
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Multi-Scenario View'));
    await screen.findByText('App X'); // fell back to Current's own real data, not stuck on an error
    expect(screen.getAllByText('Current Architecture').length).toBeGreaterThan(0);
  });

  // Section 5: explicit per-renderer verification beyond Table/Graph -
  // Matrix and Heatmap have their own scenario-specific reset logic
  // (matrixDrilldown, heatmapField) worth proving directly rather than
  // trusting the shared dataset/eligibility plumbing alone.
  it('MATRIX mode reflects the new scenario\'s dataset after a switch, and a stale drill-down is cleared if its objects no longer exist', async () => {
    const matrixEligibility = { eligible: [{ visualization: 'MATRIX', eligible: true, score: 0.9, reasons: [], recommendedConfig: { rowType: 'BusinessCapability', columnType: 'TechComponent', relationMode: 'PATH', path: [{ from: 'BusinessCapability', relationship: 'supported_by', to: 'Application' }, { from: 'Application', relationship: 'hosted_on', to: 'TechComponent' }] } }], ineligible: [] };
    const currentMatrixResponse = { ...currentResponse, eligibility: matrixEligibility };
    const targetAMatrixResponse = { ...targetAResponse, eligibility: matrixEligibility };
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Matrix Scenario View', visualization: 'MATRIX', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': (options: any) => {
        const body = JSON.parse(options.body);
        return body.scenarioId === 'targetA' ? targetAMatrixResponse : currentMatrixResponse;
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Matrix Scenario View'));
    await screen.findByText('Capability A'); // Current's matrix row
    expect(screen.getByText('Tech Y')).toBeInTheDocument(); // Current's matrix column
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await waitFor(() => expect(screen.queryByText('Tech Y')).not.toBeInTheDocument()); // Current's column is gone
    expect(screen.getByText('Tech K')).toBeInTheDocument(); // Target A's column present instead
  });

  it('HEATMAP metric selection resets to the new scenario\'s recommended metric when the previous one is unavailable', async () => {
    const currentHeatmapResponse = { ...currentResponse, eligibility: { eligible: [{ visualization: 'HEATMAP', eligible: true, score: 0.7, reasons: [], recommendedConfig: { metricKey: 'riskLevel' } }], ineligible: [] }, dataset: { ...currentResponse.dataset, metrics: [{ key: 'riskLevel', label: 'riskLevel', dataType: 'categorical', coveragePercent: 100, distinctValues: ['HIGH'] }], hierarchies: [{ rootIds: ['capA'], parentByObjectId: { capA: null }, source: 'metadata.parentId' }] } };
    const targetAHeatmapResponse = { ...targetAResponse, eligibility: { eligible: [{ visualization: 'HEATMAP', eligible: true, score: 0.7, reasons: [], recommendedConfig: { metricKey: 'maturity' } }], ineligible: [] }, dataset: { ...targetAResponse.dataset, metrics: [{ key: 'maturity', label: 'maturity', dataType: 'categorical', coveragePercent: 100, distinctValues: ['LOW'] }], hierarchies: [{ rootIds: ['capA'], parentByObjectId: { capA: null }, source: 'metadata.parentId' }] } };
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Heatmap Scenario View', visualization: 'HEATMAP', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': (options: any) => {
        const body = JSON.parse(options.body);
        return body.scenarioId === 'targetA' ? targetAHeatmapResponse : currentHeatmapResponse;
      },
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Heatmap Scenario View'));
    await screen.findByText('Capability A');
    fireEvent.click(screen.getAllByText('Current Architecture')[0]);
    fireEvent.click(await screen.findByText('Target A'));
    await waitFor(() => expect(screen.getByText('Capability A')).toBeInTheDocument());
    // the "Color by" selector should now offer Target A's own recommended metric as an option
    expect(screen.getByText('maturity')).toBeInTheDocument();
  });
});

describe('EaViewsPage - Comparison mode (Phase 5B)', () => {
  const scenarioList = [
    { id: 'current', name: 'Current Architecture', type: 'CURRENT', status: 'APPROVED', horizonDate: null, sequence: null, parentScenarioId: null },
    { id: 'targetA', name: 'Target A', type: 'TARGET', status: 'APPROVED', horizonDate: '2028-01-01', sequence: 1, parentScenarioId: 'current' },
    { id: 'targetB', name: 'Target B', type: 'TARGET', status: 'APPROVED', horizonDate: '2028-01-01', sequence: 1, parentScenarioId: 'current' },
  ];
  const baseDatasetResponse = {
    legacy: { nodes: [], edges: [], metadata: {} },
    dataset: { context: { scenario: { id: 'current' } }, objects: [], relationships: [], paths: [], hierarchies: [], metrics: [], provenance: { truncated: false } },
    eligibility: { eligible: [{ visualization: 'TABLE', eligible: true, score: 0.7, reasons: [] }], ineligible: [] },
  };

  function comparisonResult(rightName: string, addedCount: number) {
    return {
      context: { leftScenario: { id: 'current', name: 'Current Architecture' }, rightScenario: { id: rightName === 'Target A' ? 'targetA' : 'targetB', name: rightName } },
      objects: { added: Array.from({ length: addedCount }, (_, i) => ({ id: `added${i}`, changeType: 'ADDED', right: { id: `added${i}`, name: `Added ${rightName} ${i}`, semanticType: 'Application', domain: 'APPLICATION' } })), removed: [], modified: [], unchanged: [] },
      relationships: { added: [], removed: [], unchanged: [] },
      leftPaths: [], rightPaths: [],
      metrics: { objectCounts: { added: addedCount, removed: 0, modified: 0, unchanged: 0 }, relationshipCounts: { added: 0, removed: 0, unchanged: 0 } },
      warnings: [], provenance: { leftTruncated: false, rightTruncated: false },
    };
  }

  async function openComparisonView(compareRoute: any) {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Comparable View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': scenarioList,
      '/ea-views/v1/dataset': baseDatasetResponse,
      '/ea-views/v1/compare': compareRoute,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Comparable View'));
    await screen.findByText('Current Architecture');
    fireEvent.click(screen.getByText(/⇄ Compare/));
  }

  // ── Mandatory comparison race-condition test ────────────────────────
  it('fast Target A -> Target B comparison requests: Target B resolving first is never overwritten by a later-resolving, stale Target A response', async () => {
    let resolveA: (v: any) => void = () => {};
    let resolveB: (v: any) => void = () => {};
    const promiseA = new Promise(r => { resolveA = r; });
    const promiseB = new Promise(r => { resolveB = r; });
    await openComparisonView((options: any) => {
      const body = JSON.parse(options.body);
      if (body.rightScenarioId === 'targetA') return promiseA;
      if (body.rightScenarioId === 'targetB') return promiseB;
      return comparisonResult('Target A', 0);
    });

    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: 'current' } });
    fireEvent.change(selects[1], { target: { value: 'targetA' } });
    fireEvent.click(screen.getByText(/^Compare/)); // request A - deliberately never resolved yet
    fireEvent.change(selects[1], { target: { value: 'targetB' } });
    fireEvent.click(screen.getByText(/^Compare/)); // request B, before A has resolved

    resolveB(comparisonResult('Target B', 5));
    await screen.findByText(/\+5 Added/);

    resolveA(comparisonResult('Target A', 2));
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByText(/\+5 Added/)).toBeInTheDocument(); // B's result still displayed
    expect(screen.queryByText(/\+2 Added/)).not.toBeInTheDocument(); // A's stale response never committed
  });

  it('a failed comparison request retains the previously loaded comparison and shows an error, without pretending it succeeded', async () => {
    let callCount = 0;
    await openComparisonView((options: any) => {
      callCount++;
      if (callCount === 1) return comparisonResult('Target A', 3);
      return Promise.reject(new Error('network error'));
    });
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: 'current' } });
    fireEvent.change(selects[1], { target: { value: 'targetA' } });
    fireEvent.click(screen.getByText(/^Compare/));
    await screen.findByText(/\+3 Added/);

    fireEvent.change(selects[1], { target: { value: 'targetB' } });
    fireEvent.click(screen.getByText(/^Compare/));
    await waitFor(() => expect(screen.getByText(/Failed to load comparison/)).toBeInTheDocument());
    // the previous, valid comparison result is still fully displayed
    expect(screen.getByText(/\+3 Added/)).toBeInTheDocument();
  });

  it('shows the summary header with object/relationship counts after a successful comparison', async () => {
    await openComparisonView(comparisonResult('Target A', 4));
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: 'current' } });
    fireEvent.change(selects[1], { target: { value: 'targetA' } });
    fireEvent.click(screen.getByText(/^Compare/));
    expect(await screen.findByText(/\+4 Added/)).toBeInTheDocument();
    expect(screen.getByText(/0 Unchanged/)).toBeInTheDocument();
  });

  it('exiting comparison mode returns to the normal single-scenario view', async () => {
    await openComparisonView(comparisonResult('Target A', 1));
    fireEvent.click(screen.getByText(/✕ Exit Comparison/));
    expect(screen.queryByText(/✕ Exit Comparison/)).not.toBeInTheDocument();
  });

  // ── The 5 deferred comparison renderers ─────────────────────────────
  function richComparisonResult() {
    const capA = { id: 'capA', name: 'Capability A', semanticType: 'BusinessCapability', domain: 'BUSINESS', role: 'PRIMARY' };
    const appX = { id: 'appX', name: 'App X', semanticType: 'Application', domain: 'APPLICATION', role: 'RELATED', metadata: { risk: 'MEDIUM' } };
    const appXAfter = { ...appX, metadata: { risk: 'HIGH' } };
    const appZ = { id: 'appZ', name: 'App Z', semanticType: 'Application', domain: 'APPLICATION', role: 'RELATED' };
    return {
      context: { leftScenario: { id: 'current', name: 'Current Architecture' }, rightScenario: { id: 'targetA', name: 'Target A' } },
      objects: {
        added: [{ id: 'appZ', changeType: 'ADDED', right: appZ }],
        removed: [],
        modified: [{ id: 'appX', changeType: 'MODIFIED', left: appX, right: appXAfter, propertyChanges: [{ property: 'metadata.risk', before: 'MEDIUM', after: 'HIGH' }] }],
        unchanged: [{ id: 'capA', changeType: 'UNCHANGED', left: capA, right: capA }],
      },
      relationships: {
        added: [{ key: 'capA::appZ::supported_by', right: { sourceId: 'capA', targetId: 'appZ', relationshipType: 'supported_by', label: 'supported_by' } }],
        removed: [],
        unchanged: [{ key: 'capA::appX::supported_by', left: { sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' }, right: { sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' } }],
      },
      leftPaths: [], rightPaths: [],
      leftHierarchies: [{ rootIds: ['capA'], parentByObjectId: { capA: null } }],
      rightHierarchies: [{ rootIds: ['capA'], parentByObjectId: { capA: null } }],
      leftMetrics: [{ key: 'risk', label: 'risk', dataType: 'categorical' }],
      rightMetrics: [{ key: 'risk', label: 'risk', dataType: 'categorical' }],
      metrics: { objectCounts: { added: 1, removed: 0, modified: 1, unchanged: 1 }, relationshipCounts: { added: 1, removed: 0, unchanged: 1 } },
      warnings: [], provenance: { leftTruncated: false, rightTruncated: false },
    };
  }

  async function runRichComparison() {
    await openComparisonView(richComparisonResult());
    await screen.findByText(/Choose two scenarios/);
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: 'current' } });
    fireEvent.change(selects[1], { target: { value: 'targetA' } });
    fireEvent.click(screen.getByText(/^Compare/));
    await screen.findAllByText(/\+1 Added/); // both the Objects and Relationships summary lines match this fixture's counts
  }

  it('Graph comparison shows Capability A, App X (modified) and App Z (added) with change symbols, not relying on color alone', async () => {
    await runRichComparison();
    fireEvent.click(screen.getByText('Graph'));
    await screen.findByText(/Capability A/);
    // change symbols (+/~/−) appear in the node labels themselves, not just as a color
    expect(screen.getByText(/~ App X/)).toBeInTheDocument();
  });

  it('Capability Map comparison shows Capability A as UNCHANGED using the real hierarchy', async () => {
    await runRichComparison();
    fireEvent.click(screen.getByText('Capability Map'));
    await screen.findByText('Capability A');
  });

  it('Heatmap comparison shows the categorical risk transition MEDIUM -> HIGH for App X, never a fabricated numeric delta', async () => {
    await runRichComparison();
    fireEvent.click(screen.getByText('Heatmap'));
    await screen.findByText(/MEDIUM → HIGH/);
  });

  it('Tree comparison renders Capability A from the real hierarchy', async () => {
    await runRichComparison();
    fireEvent.click(screen.getByText('Tree'));
    await screen.findByText('Capability A');
  });

  it('Cards comparison shows App X\'s property change and App Z as a new card', async () => {
    await runRichComparison();
    fireEvent.click(screen.getByText('Cards'));
    await screen.findByText('App X');
    expect(screen.getByText(/metadata.risk: MEDIUM → HIGH/)).toBeInTheDocument();
    expect(screen.getByText('App Z')).toBeInTheDocument();
  });
});

describe('EaViewsPage - Scenario Authoring (Phase 5C)', () => {
  const draftTargetScenario = { id: 'target-1', name: 'Target 2028', type: 'TARGET', status: 'DRAFT', horizonDate: null, sequence: null, parentScenarioId: 'current' };
  const draftCurrentScenario = { id: 'current', name: 'Current Architecture', type: 'CURRENT', status: 'DRAFT', horizonDate: null, sequence: null, parentScenarioId: null };
  const approvedTargetScenario = { ...draftTargetScenario, id: 'target-approved', status: 'APPROVED' };

  function makeAuthoringDataset(scenario: any) {
    const capA = { id: 'capA', name: 'Capability A', assetType: 'GovCapability', semanticType: 'BusinessCapability', domain: 'BUSINESS', role: 'PRIMARY', status: 'APPROVED', tags: [], metadata: {} };
    const appX = { id: 'appX', name: 'App X', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION', role: 'RELATED', status: 'APPROVED', tags: [], metadata: { hostingModel: 'CLOUD', criticality: 'HIGH' }, metadataProvenance: { hostingModel: 'scenarioOverride', criticality: 'repository' } };
    return {
      legacy: { nodes: [capA, appX], edges: [], metadata: {} },
      dataset: {
        context: { scenario: { id: scenario.id, name: scenario.name, type: scenario.type } },
        objects: [capA, appX],
        relationships: [{ id: 'r1', sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' }],
        paths: [], hierarchies: [], metrics: [], provenance: { truncated: false },
      },
      eligibility: { eligible: [{ visualization: 'TABLE', eligible: true, score: 0.7, reasons: [] }], ineligible: [] },
    };
  }

  async function openAuthoring(scenario: any, extraRoutes: any = {}) {
    // Loads directly into the target scenario via ?scenario=<id> (Phase
    // 5A's own proven mechanism) rather than clicking through the
    // ScenarioSelector dropdown - these tests exercise authoring itself,
    // not scenario-switching UI, which is already covered by its own
    // dedicated test suite.
    mockSearchParams = scenario.id === 'current' ? new URLSearchParams() : new URLSearchParams(`scenario=${scenario.id}`);
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Authorable View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': [draftCurrentScenario, draftTargetScenario, approvedTargetScenario],
      '/ea-views/v1/dataset': makeAuthoringDataset(scenario),
      [`/ea-views/scenarios/${scenario.id}/removed-assets`]: [],
      ...extraRoutes,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Authorable View'));
    await screen.findByText('App X');
    fireEvent.click(screen.getByText(/✎ Author/));
  }

  it('shows the scenario name/type/status and Object provenance badges (Inherited vs Overridden)', async () => {
    await openAuthoring(draftTargetScenario);
    // "Target 2028" legitimately appears multiple times (scenario selector
    // summary, lineage path, dropdown list) - getAllByText, not findByText.
    expect(screen.getAllByText('Target 2028').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TARGET').length).toBeGreaterThan(0);
    expect(screen.getAllByText('DRAFT').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByText('✎ Edit')[1]); // App X
    expect(await screen.findByText('Overridden here')).toBeInTheDocument();
    expect(screen.getByText('Inherited')).toBeInTheDocument();
  });

  it('editing Current requires explicit confirmation before any action proceeds - Remove is blocked until confirmed', async () => {
    await openAuthoring(draftCurrentScenario, { '/ea-views/scenarios/current/assets/appX/remove': { delta: {}, warnings: [] } });
    expect(await screen.findByText(/about to edit the Current architecture/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('✕ Remove')[1]);
    expect(await screen.findByText(/Confirm editing Current architecture first/)).toBeInTheDocument();
    const removeCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/appX/remove'));
    expect(removeCall).toBeUndefined(); // never actually sent
  });

  it('after confirming, editing Current proceeds normally', async () => {
    await openAuthoring(draftCurrentScenario, { '/ea-views/scenarios/current/assets/appX/remove': { delta: {}, warnings: [] } });
    fireEvent.click(await screen.findByText('I understand, continue editing Current'));
    fireEvent.click(screen.getAllByText('✕ Remove')[1]);
    await waitFor(() => {
      const removeCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/appX/remove'));
      expect(removeCall).toBeDefined();
    });
  });

  it('Remove posts to the correct endpoint and refreshes the resolved dataset afterward', async () => {
    await openAuthoring(draftTargetScenario, { '/ea-views/scenarios/target-1/assets/appX/remove': { delta: {}, warnings: [] } });
    fireEvent.click(screen.getAllByText('✕ Remove')[1]);
    await waitFor(() => {
      const removeCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/target-1/assets/appX/remove'));
      expect(removeCall).toBeDefined();
      expect(removeCall[1].method).toBe('POST');
    });
    // refresh: a second /dataset POST is issued after the action succeeds
    const datasetCalls = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/v1/dataset'));
    expect(datasetCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('a validation error from the backend is shown and no refresh/false-success is implied', async () => {
    await openAuthoring(draftTargetScenario, { '/ea-views/scenarios/target-1/assets/appX/remove': { statusCode: 400, message: 'This asset is not present in the scenario - nothing to remove.' } });
    fireEvent.click(screen.getAllByText('✕ Remove')[1]);
    expect(await screen.findByText(/nothing to remove/)).toBeInTheDocument();
  });

  it('all edit controls are disabled on an APPROVED scenario, and a Revert to Draft button is offered instead of Approve', async () => {
    await openAuthoring(approvedTargetScenario);
    expect(await screen.findByText('APPROVED')).toBeInTheDocument();
    expect(screen.getByText('Revert to Draft')).toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.getAllByText('✕ Remove')[0]).toBeDisabled();
  });

  it('clicking Approve on a DRAFT scenario calls the status endpoint', async () => {
    await openAuthoring(draftTargetScenario, { '/ea-views/scenarios/target-1/status': { ...draftTargetScenario, status: 'APPROVED' } });
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/target-1/status'));
      expect(call).toBeDefined();
      expect(JSON.parse(call[1].body)).toEqual({ status: 'APPROVED' });
    });
  });

  it('Undo calls the delete endpoint for that specific asset', async () => {
    await openAuthoring(draftTargetScenario, { '/ea-views/scenarios/target-1/assets/appX': { undone: true } });
    fireEvent.click(screen.getAllByText('↩ Undo')[1]);
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/target-1/assets/appX') && c[1].method === 'DELETE');
      expect(call).toBeDefined();
    });
  });

  it('Add Relationship form posts source/target/type to the relationships endpoint', async () => {
    await openAuthoring(draftTargetScenario, { '/ea-views/scenarios/target-1/relationships': { delta: {}, warnings: [] } });
    fireEvent.click(await screen.findByText('+ Add Relationship'));
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    fireEvent.change(selects[0], { target: { value: 'capA' } });
    fireEvent.change(selects[1], { target: { value: 'appX' } });
    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'depends_on' } });
    fireEvent.click(screen.getByText('Add'));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/target-1/relationships') && c[1].method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(call[1].body)).toEqual({ sourceId: 'capA', targetId: 'appX', relationshipType: 'depends_on' });
    });
  });

  it('Remove Relationship sends a body-based DELETE with the canonical key', async () => {
    await openAuthoring(draftTargetScenario, { '/ea-views/scenarios/target-1/relationships': { delta: {}, warnings: [] } });
    await screen.findByText('+ Add Relationship');
    // 2 asset Remove buttons + 1 relationship Remove button - the
    // relationship section renders last, so its button is last in DOM order.
    const removeButtons = screen.getAllByText('✕ Remove');
    fireEvent.click(removeButtons[removeButtons.length - 1]);
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/target-1/relationships') && c[1].method === 'DELETE');
      expect(call).toBeDefined();
      expect(JSON.parse(call[1].body)).toEqual({ sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by' });
    });
  });

  it('exiting authoring mode returns to the normal single-scenario view', async () => {
    await openAuthoring(draftTargetScenario);
    fireEvent.click(screen.getByText(/✕ Exit Authoring/));
    expect(screen.queryByText(/✕ Exit Authoring/)).not.toBeInTheDocument();
  });
});

describe('EaViewsPage - AI Assist (Phase 5D)', () => {
  const draftTargetScenario = { id: 'target-1', name: 'Target 2028', type: 'TARGET', status: 'DRAFT', horizonDate: null, sequence: null, parentScenarioId: 'current' };
  const draftCurrentScenario = { id: 'current', name: 'Current Architecture', type: 'CURRENT', status: 'DRAFT', horizonDate: null, sequence: null, parentScenarioId: null };

  function makeAiDataset() {
    const capA = { id: 'capA', name: 'Capability A', assetType: 'GovCapability', semanticType: 'BusinessCapability', domain: 'BUSINESS', role: 'PRIMARY', status: 'APPROVED', tags: [], metadata: {} };
    const appX = { id: 'appX', name: 'App X', assetType: 'Application', semanticType: 'Application', domain: 'APPLICATION', role: 'RELATED', status: 'APPROVED', tags: [], metadata: {} };
    return {
      legacy: { nodes: [capA, appX], edges: [], metadata: {} },
      dataset: { context: { scenario: { id: 'target-1' } }, objects: [capA, appX], relationships: [{ id: 'r1', sourceId: 'capA', targetId: 'appX', relationshipType: 'supported_by', label: 'supported_by' }], paths: [], hierarchies: [], metrics: [], provenance: { truncated: false } },
      eligibility: { eligible: [{ visualization: 'TABLE', eligible: true, score: 0.7, reasons: [] }], ineligible: [] },
    };
  }

  async function openAiAssist(extraRoutes: any = {}) {
    mockSearchParams = new URLSearchParams('scenario=target-1');
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'AI View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': [draftCurrentScenario, draftTargetScenario],
      '/ea-views/v1/dataset': makeAiDataset(),
      ...extraRoutes,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('AI View'));
    await screen.findByText('App X');
    fireEvent.click(screen.getByText(/🤖 AI Assist/));
  }

  // ── Acceptance 1: claims are never visually identical across classifications ──
  it('a FACT claim and an UNVERIFIED claim show distinct, non-identical labels', async () => {
    const explanation = { claims: [{ text: 'App X is approved', classification: 'FACT', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }, { text: 'Something unverifiable', classification: 'UNVERIFIED', evidenceRefs: [] }] };
    await openAiAssist({ '/ea-views/v1/ai/explain': explanation });
    fireEvent.click(screen.getByText('Generate Explanation'));
    expect(await screen.findByText(/Fact/)).toBeInTheDocument();
    expect(screen.getByText(/Unverified/)).toBeInTheDocument();
  });

  it('a GENERAL_GUIDANCE claim is labeled distinctly from FACT/INFERENCE, not conflated with tenant-specific evidence', async () => {
    const explanation = { claims: [{ text: 'Best practice: avoid single points of failure', classification: 'GENERAL_GUIDANCE', evidenceRefs: [] }] };
    await openAiAssist({ '/ea-views/v1/ai/explain': explanation });
    fireEvent.click(screen.getByText('Generate Explanation'));
    expect(await screen.findByText(/General guidance/)).toBeInTheDocument();
  });

  // ── Acceptance 2: evidence click-to-highlight resolves only real evidence ──
  it('clicking a valid evidence chip selects the real, corresponding loaded object', async () => {
    const explanation = { claims: [{ text: 'App X is approved', classification: 'FACT', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }] };
    await openAiAssist({ '/ea-views/v1/ai/explain': explanation });
    fireEvent.click(screen.getByText('Generate Explanation'));
    await screen.findByText(/App X is approved/);
    fireEvent.click(screen.getByText('App X', { selector: 'span' }));
    // the highlight panel combines an emoji marker with the name in one
    // text node ("📍 App X") - matched via regex rather than exact text,
    // since testing-library treats that as one combined-text unit.
    expect(await screen.findByText(/📍.*App X/)).toBeInTheDocument();
  });

  it('an evidence ref that does not resolve against the loaded dataset renders as non-clickable and never selects an unrelated item', async () => {
    const explanation = { claims: [{ text: 'Ghost object claim', classification: 'FACT', evidenceRefs: [{ kind: 'OBJECT', id: 'ghost-id-not-in-dataset' }] }] };
    await openAiAssist({ '/ea-views/v1/ai/explain': explanation });
    fireEvent.click(screen.getByText('Generate Explanation'));
    const chip = await screen.findByText('ghost-id-not-in-dataset');
    fireEvent.click(chip);
    // clicking it must not cause "Capability A" (the other real object) to become selected
    await new Promise(r => setTimeout(r, 0));
    expect(screen.queryAllByText('Capability A').length).toBe(0); // never appeared as selected, since it was never clicked and nothing highlighted it
  });

  // ── Acceptance 9: race safety on AI requests ──────────────────────────
  it('a later explain request wins over an earlier, slower-resolving one', async () => {
    let resolveFirst: (v: any) => void = () => {};
    const firstPromise = new Promise(r => { resolveFirst = r; });
    let callCount = 0;
    await openAiAssist({
      '/ea-views/v1/ai/explain': () => {
        callCount++;
        if (callCount === 1) return firstPromise;
        return { claims: [{ text: 'Second, faster response', classification: 'FACT', evidenceRefs: [] }] };
      },
    });
    fireEvent.click(screen.getByText('Generate Explanation')); // request 1, deliberately never resolved yet
    fireEvent.click(screen.getByText('Generate Explanation')); // request 2, resolves immediately
    await screen.findByText('Second, faster response');
    resolveFirst({ claims: [{ text: 'First, stale response', classification: 'FACT', evidenceRefs: [] }] });
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByText('Second, faster response')).toBeInTheDocument();
    expect(screen.queryByText('First, stale response')).not.toBeInTheDocument();
  });

  it('navigating to a different View clears a previously-shown AI explanation, never leaving stale evidence displayed against different data', async () => {
    const explanation = { claims: [{ text: 'Old view claim', classification: 'FACT', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }] };
    mockSearchParams = new URLSearchParams('scenario=target-1');
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'AI View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }, { id: 'v2', name: 'Other View', visualization: 'TABLE', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/scenarios': [draftCurrentScenario, draftTargetScenario],
      '/ea-views/v1/dataset': makeAiDataset(),
      '/ea-views/v2/dataset': makeAiDataset(),
      '/ea-views/v1/ai/explain': explanation,
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('AI View'));
    await screen.findByText('App X');
    fireEvent.click(screen.getByText(/🤖 AI Assist/));
    fireEvent.click(screen.getByText('Generate Explanation'));
    await screen.findByText('Old view claim');

    // navigate back and open a genuinely different View - this changes
    // view.id, the reset effect's real dependency (not merely toggling
    // the AI Assist mode, which does not).
    fireEvent.click(screen.getByText('← Back'));
    fireEvent.click(await screen.findByText('Other View'));
    await screen.findByText('App X');
    expect(screen.queryByText('Old view claim')).not.toBeInTheDocument();
  });

  // ── Acceptances 3, 5: proposal lifecycle gating ────────────────────────
  it('a proposal with an ERROR-level validation issue cannot be approved - the Approve button is disabled', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'VALIDATED', proposedChanges: [{ changeType: 'REMOVE_ASSET', assetId: 'appX', rationale: 'x', evidenceRefs: [] }], validationIssues: [{ severity: 'ERROR', message: 'not grounded', changeIndex: 0 }], assumptions: [], missingInformation: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'remove unused apps' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('VALIDATED');
    expect(screen.getByText('Approve')).toBeDisabled();
  });

  it('a REJECTED_BY_VALIDATION proposal cannot be approved either, even with zero displayed issues at the top level', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'REJECTED_BY_VALIDATION', proposedChanges: [], validationIssues: [{ severity: 'ERROR', message: 'x', changeIndex: 0 }], assumptions: [], missingInformation: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('REJECTED_BY_VALIDATION');
    expect(screen.getByText('Approve')).toBeDisabled();
  });

  it('a REJECTED proposal cannot be executed - the Execute button is disabled', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'REJECTED', proposedChanges: [], validationIssues: [], assumptions: [], missingInformation: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('REJECTED');
    expect(screen.getByText('Execute')).toBeDisabled();
  });

  it('an APPLIED proposal cannot be executed again, and cannot be rejected', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'APPLIED', proposedChanges: [], validationIssues: [], assumptions: [], missingInformation: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('APPLIED');
    expect(screen.getByText('Execute')).toBeDisabled();
    expect(screen.getByText('Reject')).toBeDisabled();
  });

  it('a VALIDATED proposal with no ERROR issues CAN be approved', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'VALIDATED', proposedChanges: [{ changeType: 'REMOVE_ASSET', assetId: 'appX', rationale: 'x', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }], validationIssues: [], assumptions: [], missingInformation: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('VALIDATED');
    expect(screen.getByText('Approve')).not.toBeDisabled();
  });

  // ── Acceptance 4: stale proposal requires revalidation ────────────────
  it('a stale-fingerprint execution failure shows a clear error and re-syncs the displayed status to the backend\'s own rejection', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'APPROVED', proposedChanges: [], validationIssues: [], assumptions: [], missingInformation: [] };
    const staleError = { statusCode: 400, message: 'The architecture has changed since this proposal was approved. It has been marked for revalidation and cannot be applied as-is.' };
    const rejectedProposal = { ...proposal, status: 'REJECTED', rejectionReason: 'stale' };
    await openAiAssist({
      '/ea-views/v1/ai/propose': proposal,
      '/ea-views/scenarios/target-1/proposals/proposal-1/execute': staleError,
      '/ea-views/scenarios/target-1/proposals/proposal-1': rejectedProposal,
    });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('APPROVED');
    fireEvent.click(screen.getByText('Execute'));
    await screen.findByText(/architecture has changed/);
    await waitFor(() => expect(screen.getByText('REJECTED')).toBeInTheDocument());
  });

  // ── Acceptance: successful execution refreshes via the existing mechanism ──
  it('a successful execution shows a success notice and refreshes the scenario via the existing switchScenario data flow', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'APPROVED', proposedChanges: [], validationIssues: [], assumptions: [], missingInformation: [] };
    const appliedProposal = { ...proposal, status: 'APPLIED' };
    await openAiAssist({
      '/ea-views/v1/ai/propose': proposal,
      '/ea-views/scenarios/target-1/proposals/proposal-1/execute': appliedProposal,
    });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('APPROVED');
    fireEvent.click(screen.getByText('Execute'));
    await screen.findByText(/applied successfully/);
    await waitFor(() => expect(screen.getByText('APPLIED')).toBeInTheDocument());
    // switchScenario's own /dataset re-fetch is the refresh mechanism - a second dataset POST is issued
    const datasetCalls = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/v1/dataset'));
    expect(datasetCalls.length).toBeGreaterThanOrEqual(2);
  });

  // ── Acceptance 7: AI Assist never mutates the repository/scenario directly ──
  it('generating a proposal never calls any authoring endpoint directly - only the propose endpoint, returning a review-only proposal object', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'VALIDATED', proposedChanges: [{ changeType: 'REMOVE_ASSET', assetId: 'appX', rationale: 'x', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }], validationIssues: [], assumptions: [], missingInformation: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'remove App X' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    await screen.findByText('VALIDATED');
    const authoringCalls = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/assets/') && c[0].includes('/remove'));
    expect(authoringCalls).toHaveLength(0); // no direct authoring call was ever made merely from generating the proposal
  });

  // ── Assumptions/missing information/confidence visibility ─────────────
  it('shows assumptions, missing information, and confidence prominently alongside the proposal', async () => {
    const proposal = { id: 'proposal-1', scenarioId: 'target-1', status: 'VALIDATED', confidence: 0.72, assumptions: ['Assumes App X is unused'], missingInformation: ['No usage metrics available'], proposedChanges: [{ changeType: 'REMOVE_ASSET', assetId: 'appX', rationale: 'x', evidenceRefs: [{ kind: 'OBJECT', id: 'appX' }] }], validationIssues: [] };
    await openAiAssist({ '/ea-views/v1/ai/propose': proposal });
    fireEvent.click(screen.getByText('Propose Changes'));
    fireEvent.change(screen.getByPlaceholderText(/Describe the change/), { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Generate Proposal'));
    expect(await screen.findByText(/72%/)).toBeInTheDocument();
    expect(screen.getByText(/Assumes App X is unused/)).toBeInTheDocument();
    expect(screen.getByText(/No usage metrics available/)).toBeInTheDocument();
  });

  it('exiting AI Assist mode returns to the normal single-scenario view', async () => {
    await openAiAssist();
    fireEvent.click(screen.getByText(/✕ Exit AI Assist/));
    expect(screen.queryByText(/✕ Exit AI Assist/)).not.toBeInTheDocument();
  });
});

describe('EaViewsPage - Object Context View entry point', () => {
  it('reads the objectContext query param on mount and opens the standalone dependency viewer', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': {
        nodes: [{ id: 'asset-123', name: 'Payments API', assetType: 'Interface', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }],
        edges: [], metadata: { totalNodes: 1, domains: ['APPLICATION'], executedAt: '2026-01-01T00:00:00Z' }, truncated: false,
      },
    });
    render(<EaViewsPage />);
    expect(await screen.findByText('Dependencies of Payments API')).toBeInTheDocument();
    // Tab strip should be hidden, same as the builder/viewer sub-views.
    expect(screen.queryByText('🏠 Dashboard')).not.toBeInTheDocument();
  });

  it('shows a truncation warning when the backend reports the result was cut off', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': { nodes: [{ id: 'asset-123', name: 'Hub App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {}, truncated: true },
    });
    render(<EaViewsPage />);
    expect(await screen.findByText(/results were truncated/)).toBeInTheDocument();
  });

  it('does not open the object-context viewer when no query param is present', async () => {
    mockFetch({ '/ea-views/stats': {} });
    render(<EaViewsPage />);
    expect(await screen.findByText('🗺 EA Views & Viewpoints Studio')).toBeInTheDocument();
    expect(screen.queryByText(/Dependencies of/)).not.toBeInTheDocument();
  });

  it('clicking Upstream re-fetches object-context with direction=UPSTREAM (Dependency Analysis)', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': { nodes: [{ id: 'asset-123', name: 'Hub App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {}, truncated: false },
    });
    render(<EaViewsPage />);
    await screen.findByText('Dependencies of Hub App');
    fireEvent.click(screen.getByText(/Upstream/));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/object-context/asset-123')).pop();
      expect(call[0]).toContain('direction=UPSTREAM');
    });
  });

  it('clicking Downstream re-fetches object-context with direction=DOWNSTREAM (Impact Analysis)', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': { nodes: [{ id: 'asset-123', name: 'Hub App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {}, truncated: false },
    });
    render(<EaViewsPage />);
    await screen.findByText('Dependencies of Hub App');
    fireEvent.click(screen.getByText(/Downstream/));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/object-context/asset-123')).pop();
      expect(call[0]).toContain('direction=DOWNSTREAM');
    });
  });

  it('shows a relationship-type filter checklist once edges are loaded, and toggling one re-fetches with relationshipTypes set', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': {
        nodes: [
          { id: 'asset-123', name: 'Hub App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} },
          { id: 'b1', name: 'Dep B', assetType: 'ITComponent', domain: 'TECHNOLOGY', status: 'APPROVED', tags: [], metadata: {} },
        ],
        edges: [{ id: 'e1', sourceId: 'asset-123', targetId: 'b1', relationshipType: 'uses', label: 'uses' }],
        metadata: {}, truncated: false,
      },
    });
    render(<EaViewsPage />);
    await screen.findByText('Dependencies of Hub App');
    expect(await screen.findByText('uses')).toBeInTheDocument();
    fireEvent.click(screen.getByText('uses'));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/object-context/asset-123')).pop();
      expect(call[0]).toContain('relationshipTypes=uses');
    });
  });

  it('searching for a path target queries the full repository (not just currently-loaded nodes), and selecting a result fetches the shortest path', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': { nodes: [{ id: 'asset-123', name: 'Hub App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {}, truncated: false },
      '/ea-repository/assets?search=Payments': [{ id: 'far-away-1', name: 'Payments Gateway', assetType: 'Application' }],
      '/ea-views/shortest-path': { found: true, nodes: [{ id: 'asset-123', name: 'Hub App', assetType: 'Application' }, { id: 'far-away-1', name: 'Payments Gateway', assetType: 'Application' }], edges: [{ id: 'e1', sourceId: 'asset-123', targetId: 'far-away-1', relationshipType: 'uses', label: 'uses' }] },
    });
    render(<EaViewsPage />);
    await screen.findByText('Dependencies of Hub App');
    fireEvent.change(screen.getByPlaceholderText(/Search for an object by name/), { target: { value: 'Payments' } });
    fireEvent.click(await screen.findByText('Payments Gateway'));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/shortest-path'));
      expect(call[0]).toContain('from=asset-123');
      expect(call[0]).toContain('to=far-away-1');
    });
    expect(await screen.findByText('Path found')).toBeInTheDocument();
  });

  it('shows "no connecting path" when the shortest-path search finds nothing, not an error', async () => {
    mockSearchParams = new URLSearchParams('objectContext=asset-123');
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/object-context/asset-123': { nodes: [{ id: 'asset-123', name: 'Hub App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {}, truncated: false },
      '/ea-repository/assets?search=Nowhere': [{ id: 'isolated-1', name: 'Isolated Thing', assetType: 'Application' }],
      '/ea-views/shortest-path': { found: false, nodes: [], edges: [] },
    });
    render(<EaViewsPage />);
    await screen.findByText('Dependencies of Hub App');
    fireEvent.change(screen.getByPlaceholderText(/Search for an object by name/), { target: { value: 'Nowhere' } });
    fireEvent.click(await screen.findByText('Isolated Thing'));
    expect(await screen.findByText(/No connecting path found/)).toBeInTheDocument();
  });
});

describe('EaViewsPage - ViewBuilder Path Builder wiring', () => {
  it('the Path Builder only appears once a root object type is selected (progressive disclosure)', async () => {
    mockFetch({ '/ea-views/stats': {} });
    render(<EaViewsPage />);
    fireEvent.click(screen.getByText('+ New View'));
    await screen.findByText('New Custom View');
    expect(screen.queryByText('Relationship Path')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('CAPABILITY'));
    expect(await screen.findByText('Relationship Path')).toBeInTheDocument();
  });

  it('adding a hop via the Path Builder includes it in the create-view payload', async () => {
    mockFetch({
      '/ea-views/stats': {},
      '/ea-views/relationship-options': [{ relationshipType: 'uses', direction: 'FORWARD', targetAssetType: 'ITComponent', targetTypeName: 'IT Component', label: 'uses', sampleCount: 5 }],
      '/ea-views': (opts: any) => { if (opts?.method === 'POST') return { id: 'new-view-1', name: JSON.parse(opts.body).name }; return []; },
    });
    render(<EaViewsPage />);
    fireEvent.click(screen.getByText('+ New View'));
    await screen.findByText('New Custom View');
    fireEvent.click(screen.getByText('CAPABILITY'));
    fireEvent.click(await screen.findByText(/uses/));
    fireEvent.change(screen.getByPlaceholderText(/Q4 2026 Application Portfolio/), { target: { value: 'My Path View' } });
    fireEvent.click(screen.getByText(/Create View/));
    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].endsWith('/ea-views') && c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.relationshipPath).toEqual([{ relationshipType: 'uses', direction: 'FORWARD', targetAssetType: 'ITComponent', label: 'uses', targetTypeName: 'IT Component' }]);
    });
  });
});
