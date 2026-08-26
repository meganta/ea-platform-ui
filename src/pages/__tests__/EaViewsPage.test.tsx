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
    await openView(view, { '/ea-views/v1/execute': { nodes: [], edges: [], metadata: {} } });
    await waitFor(() => expect(screen.getByText(/GRAPH/)).toBeInTheDocument());
    const calls = (global.fetch as jest.Mock).mock.calls.map((c: any) => c[0]);
    expect(calls.some((u: string) => u.includes('/v1/roadmap'))).toBe(false);
    expect(calls.some((u: string) => u.includes('/v1/dashboard'))).toBe(false);
  });
});

describe('EaViewsPage - Export', () => {
  const GRAPH_VIEW = { id: 'v1', name: 'App Landscape', category: 'Application', status: 'PUBLISHED', architectureState: 'CURRENT', visualization: 'GRAPH', rootObjectTypes: ['Application'], relatedObjectTypes: ['ITComponent'] };
  async function openGraphView() {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [GRAPH_VIEW],
      '/ea-views/v1/execute': { nodes: [{ id: 'a1', name: 'App A', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {} }], edges: [], metadata: {} },
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
      '/ea-views/v1/execute': { nodes: [], edges: [], metadata: {} },
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
  it('switching to TREE mode nests a child under its parent via metadata.parentId and supports collapsing it', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Capability Tree', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/execute': { nodes: [
        { id: 'p1', name: 'Parent Cap', assetType: 'GovCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: {} },
        { id: 'c1', name: 'Child Cap', assetType: 'GovCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: { parentId: 'p1' } },
      ], edges: [], metadata: {} },
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
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'App Cards', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/execute': { nodes: [{ id: 'a1', name: 'HR System', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', tags: [], metadata: {}, description: 'Handles employee records' }], edges: [], metadata: {} },
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

describe('EaViewsPage - generalized Heatmap field discovery', () => {
  it('fetches heatmap-fields for the most common asset type in the result set when switching to HEATMAP mode', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'Cap Heatmap', visualization: 'GRAPH', status: 'PUBLISHED', architectureState: 'CURRENT' }],
      '/ea-views/v1/execute': { nodes: [{ id: 'c1', name: 'Cap A', assetType: 'GovCapability', domain: 'BUSINESS', status: 'APPROVED', tags: [], metadata: { maturityLevel: 'High' } }], edges: [], metadata: {} },
      '/ea-views/heatmap-fields': [{ code: 'status', name: 'Status', declaredType: 'ENUM' }, { code: 'maturityLevel', name: 'Maturity Level', declaredType: 'TEXT' }],
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('Cap Heatmap'));
    fireEvent.click(await screen.findByText(/HEATMAP/));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/heatmap-fields'));
      expect(call).toBeDefined();
      expect(call[0]).toContain('assetType=GovCapability');
    });
    expect(await screen.findByText('Maturity Level')).toBeInTheDocument();
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
