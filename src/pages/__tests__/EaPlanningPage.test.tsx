import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EaPlanningPage from '../EaPlanningPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  jest.clearAllMocks();
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

const DASHBOARD = { total: 3, active: 2, completed: 1, draft: 0, cancelled: 0, avgProgress: 45, highRisk: 0, byType: { 'Annual EA Master Plan': 3 }, byStatus: { DRAFT: 0, ACTIVE: 2, COMPLETED: 1, CANCELLED: 0 } };
const PLAN_TYPES = [{ id: 'pt-1', nameEn: 'Annual EA Master Plan', code: 'ANNUAL_MASTER' }];

function plan(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'plan-1', nameEn: 'Cloud Migration Plan', status: 'ACTIVE', frequency: 'ANNUAL', periodLabel: '2026',
    progressPct: 40, planType: { nameEn: 'Annual EA Master Plan' },
    activities: [{ id: 'A1', name: 'Migrate Payments App', priority: 'HIGH' }],
    deliverables: [{ id: 'D1', name: 'Migration Runbook', type: 'Document' }],
    kpis: [], risks: [], scenarioId: null,
    ...overrides,
  };
}

const BASE_ROUTES = {
  '/ea-planning/dashboard': DASHBOARD,
  '/ea-planning/plan-types': PLAN_TYPES,
  '/ea-planning/plans': [plan()],
  '/ea-views/scenarios': [{ id: 'scn-1', name: 'Target 2027' }],
};

describe('EaPlanningPage - Dashboard and Plans list (baseline)', () => {
  it('loads and displays dashboard stats', async () => {
    mockFetch(BASE_ROUTES);
    render(<EaPlanningPage />);
    expect(await screen.findByText('45%')).toBeInTheDocument(); // avg progress
    expect(screen.getByText('Annual EA Master Plan')).toBeInTheDocument();
  });

  it('switches to the plans list and shows plans', async () => {
    mockFetch(BASE_ROUTES);
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    expect(await screen.findByText('Cloud Migration Plan')).toBeInTheDocument();
  });
});

describe('EaPlanningPage - Roadmap tab (repository-wide, via getRoadmapOverview)', () => {
  it('loads and displays asset-linked roadmap items in one timeline', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/roadmap': { items: [
        { itemType: 'activity', name: 'Migrate Payments App', planName: 'Cloud Migration Plan', assetName: 'Payments App', assetType: 'Application', periodLabel: '2026' },
      ] },
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('planning.tab_roadmap'));
    expect(await screen.findByText('Migrate Payments App')).toBeInTheDocument();
    expect(screen.getByText(/\(Application\)/)).toBeInTheDocument();
  });

  it('shows the empty state when nothing has been linked to an asset yet', async () => {
    mockFetch({ ...BASE_ROUTES, '/ea-planning/roadmap': { items: [] } });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('planning.tab_roadmap'));
    expect(await screen.findByText('planning.roadmap_empty')).toBeInTheDocument();
  });

  it('re-fetches with a domain filter when one is selected', async () => {
    const fetchSpy = jest.fn().mockImplementation((url: string) => {
      if (url.includes('/ea-planning/roadmap?domain=APPLICATIONS')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [] }) });
      for (const [pattern, value] of Object.entries({ ...BASE_ROUTES, '/ea-planning/roadmap': { items: [] } })) {
        if (url.includes(pattern)) return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchSpy as any;
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('planning.tab_roadmap'));
    await screen.findByText('planning.roadmap_empty');
    fireEvent.change(screen.getByDisplayValue('All'), { target: { value: 'APPLICATIONS' } });
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('/ea-planning/roadmap?domain=APPLICATIONS'), expect.anything()));
  });
});

describe('EaPlanningPage - Plan Detail: scenario linking', () => {
  it('links the plan to a selected Architecture Scenario', async () => {
    mockFetch({ ...BASE_ROUTES, '/ea-planning/plans/plan-1': plan() });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    await screen.findByText('planning.scenario_title');
    await screen.findByText('Target 2027'); // wait for the scenario option to actually be in the DOM before selecting it

    fireEvent.change(screen.getByLabelText('scenario-select'), { target: { value: 'scn-1' } });
    fireEvent.click(screen.getByText('planning.scenario_link'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/scenario'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ scenarioId: 'scn-1' }) }),
    ));
  });

  it('shows the linked scenario name and offers to unlink it', async () => {
    mockFetch({ ...BASE_ROUTES, '/ea-planning/plans/plan-1': plan({ scenarioId: 'scn-1' }) });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    expect(await screen.findByText('Target 2027')).toBeInTheDocument();

    fireEvent.click(screen.getByText('planning.scenario_unlink'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/scenario'),
      expect.objectContaining({ method: 'DELETE' }),
    ));
  });
});

describe('EaPlanningPage - Plan Detail: activity/deliverable asset linking', () => {
  it('links an activity to a real EA asset found via search', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan(),
      '/ea-repository/assets?search=Payments': [{ id: 'app-1', name: 'Payments App', assetType: 'Application' }],
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    await screen.findByText('Migrate Payments App');

    fireEvent.click(screen.getAllByText('planning.link_asset')[0]);
    fireEvent.change(screen.getByPlaceholderText('planning.search_asset'), { target: { value: 'Payments' } });
    fireEvent.mouseDown(await screen.findByText('Payments App'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/activities/A1/asset'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ assetId: 'app-1' }) }),
    ));
  });

  it('shows an already-linked activity with an unlink control instead of the link button', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan({ activities: [{ id: 'A1', name: 'Migrate Payments App', priority: 'HIGH', assetId: 'app-1', assetName: 'Payments App' }], deliverables: [] }),
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    expect(await screen.findByTitle('planning.linked_to: Payments App')).toBeInTheDocument();
    expect(screen.getByText('planning.unlink')).toBeInTheDocument();
    expect(screen.queryByText('planning.link_asset')).not.toBeInTheDocument();
  });

  it('unlinks an activity from its asset', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan({ activities: [{ id: 'A1', name: 'Migrate Payments App', priority: 'HIGH', assetId: 'app-1', assetName: 'Payments App' }] }),
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    fireEvent.click(await screen.findByText('planning.unlink'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/activities/A1/asset'),
      expect.objectContaining({ method: 'DELETE' }),
    ));
  });

  it('also supports linking a deliverable to an asset, targeting the deliverables field specifically', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan(),
      '/ea-repository/assets?search=Runbook': [{ id: 'doc-1', name: 'Runbook Doc', assetType: 'Document' }],
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    await screen.findByText(/Migration Runbook/);

    // Two "link_asset" buttons exist (activity + deliverable) - click the second (deliverable's).
    const linkButtons = screen.getAllByText('planning.link_asset');
    fireEvent.click(linkButtons[linkButtons.length - 1]);
    fireEvent.change(screen.getByPlaceholderText('planning.search_asset'), { target: { value: 'Runbook' } });
    fireEvent.mouseDown(await screen.findByText('Runbook Doc'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/deliverables/D1/asset'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ assetId: 'doc-1' }) }),
    ));
  });
});
