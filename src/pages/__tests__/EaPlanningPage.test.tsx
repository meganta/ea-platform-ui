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
    objectiveItems: [], initiatives: [], kpiItems: [],
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
    fireEvent.click(await screen.findByText('📋 Plan Content'));
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
    fireEvent.click(await screen.findByText('📋 Plan Content'));
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
    fireEvent.click(await screen.findByText('📋 Plan Content'));
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
    fireEvent.click(await screen.findByText('📋 Plan Content'));
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

describe('EaPlanningPage - New Plan Wizard (multi-step)', () => {
  // mockFetch matches by URL substring, not HTTP method, so GET '/ea-planning/plans'
  // (list) and POST '/ea-planning/plans' (create) share a pattern - this override
  // discriminates by method so create() gets back an object with a real id.
  const PLANS_ROUTE = (url: string, options?: any) => options?.method === 'POST'
    ? { id: 'new-plan-1', ...JSON.parse(options.body) }
    : [plan()];

  it('steps through Plan Type -> Context -> Import Previous -> Review, and creates the plan', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans': PLANS_ROUTE,
      '/ea-planning/plans?planTypeId=pt-1': [],
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('+ New Plan'));

    // Step 1: plan type card
    fireEvent.click(await screen.findByText('Annual EA Master Plan'));
    fireEvent.click(screen.getByText('Next: Define Context →'));

    // Step 2: context
    fireEvent.change(screen.getByPlaceholderText('Plan name'), { target: { value: 'FY2027 Plan' } });
    fireEvent.click(screen.getByText('Next: Import Previous Work →'));

    // Step 3: no previous plans of this type
    await screen.findByText(/No previous plans of this type/);
    fireEvent.click(screen.getByText('Next: Review & Create →'));

    // Step 4: create
    fireEvent.click(await screen.findByText('💾 Create Plan'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans'),
      expect.objectContaining({ method: 'POST' }),
    ));
  });

  it('lets the user selectively import objectives from a previous plan of the same type', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans': PLANS_ROUTE,
      '/ea-planning/plans?planTypeId=pt-1': [{ id: 'plan-2025', nameEn: '2025 Plan', periodLabel: '2025', status: 'COMPLETED' }],
      '/ea-planning/plans/plan-2025/objectives': [{ id: 'obj-1', title: 'Improve maturity', status: 'IN_PROGRESS' }],
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('+ New Plan'));
    fireEvent.click(await screen.findByText('Annual EA Master Plan'));
    fireEvent.click(screen.getByText('Next: Define Context →'));
    fireEvent.change(screen.getByPlaceholderText('Plan name'), { target: { value: 'FY2027 Plan' } });
    fireEvent.click(screen.getByText('Next: Import Previous Work →'));

    fireEvent.change(await screen.findByDisplayValue("Don't import - start fresh"), { target: { value: 'plan-2025' } });
    fireEvent.click(await screen.findByLabelText(/Improve maturity/));
    fireEvent.click(screen.getByText('Next: Review & Create →'));
    fireEvent.click(await screen.findByText('💾 Create Plan'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/new-plan-1/import-objectives'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ fromPlanId: 'plan-2025', objectiveIds: ['obj-1'], includeInitiatives: true }) }),
    ));
  });
});

describe('EaPlanningPage - Prioritization & Architecture Impact panels', () => {
  it('expands an initiative to show scoring criteria and saves a score', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan({ initiatives: [{ id: 'init-1', title: 'Stand up exception workflow', status: 'IN_PROGRESS', health: 'ON_TRACK', objectiveId: null, ownerId: 'user-1', linkedAssetIds: [] }] }),
      '/ea-planning/prioritization-criteria': [{ id: 'crit-1', nameEn: 'Strategic Alignment', weight: 20 }],
      '/ea-planning/plans/plan-1/initiatives/init-1/impact': { assets: [] },
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    fireEvent.click(await screen.findByText(/🚀 Initiatives/));
    fireEvent.click(await screen.findByText(/Stand up exception workflow/));

    expect(await screen.findByText(/Strategic Alignment/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Save Score'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/initiatives/init-1/score'),
      expect.objectContaining({ method: 'PATCH' }),
    ));
  });

  it('shows linked architecture assets and lets the user link a new one via search', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan({ initiatives: [{ id: 'init-1', title: 'Stand up exception workflow', status: 'IN_PROGRESS', health: 'ON_TRACK', objectiveId: null, ownerId: 'user-1', linkedAssetIds: [] }] }),
      '/ea-planning/prioritization-criteria': [],
      '/ea-planning/plans/plan-1/initiatives/init-1/impact': { assets: [] },
      '/ea-repository/assets?search=Payments': [{ id: 'app-1', name: 'Payments App', assetType: 'Application' }],
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    fireEvent.click(await screen.findByText(/🚀 Initiatives/));
    fireEvent.click(await screen.findByText(/Stand up exception workflow/));

    fireEvent.click(await screen.findByText('+ Link Asset'));
    fireEvent.change(screen.getByPlaceholderText('planning.search_asset'), { target: { value: 'Payments' } });
    fireEvent.mouseDown(await screen.findByText('Payments App'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/initiatives/init-1/assets'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ assetId: 'app-1' }) }),
    ));
  });
});

describe('EaPlanningPage - KPIs tab', () => {
  it('adds a KPI and posts it to the plan', async () => {
    mockFetch({ ...BASE_ROUTES, '/ea-planning/plans/plan-1': plan() });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    fireEvent.click(await screen.findByText(/📈 KPIs/));
    await screen.findByText(/No KPIs defined yet/);

    fireEvent.click(screen.getByText('+ Add KPI'));
    fireEvent.change(screen.getByPlaceholderText(/Metric, e.g/), { target: { value: '% exceptions via governed workflow' } });
    fireEvent.click(screen.getByText('Add KPI'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/kpis'),
      expect.objectContaining({ method: 'POST' }),
    ));
  });
});

describe('EaPlanningPage - Objectives & Initiatives tabs', () => {
  it('adds an objective and posts it to the plan', async () => {
    mockFetch({ ...BASE_ROUTES, '/ea-planning/plans/plan-1': plan() });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    fireEvent.click(await screen.findByText(/🎯 Objectives/));
    await screen.findByText(/No objectives defined yet/);

    fireEvent.click(screen.getByText('+ Add Objective'));
    fireEvent.change(screen.getByPlaceholderText('Objective title'), { target: { value: 'Improve maturity' } });
    fireEvent.click(screen.getByText('Add Objective'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/objectives'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ title: 'Improve maturity' }) }),
    ));
  });

  it('shows initiatives with health/status controls and flags one with no owner', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/plans/plan-1': plan({
        initiatives: [{ id: 'init-1', title: 'Stand up exception workflow', status: 'IN_PROGRESS', health: 'AT_RISK', objectiveId: null, ownerId: null }],
      }),
    });
    render(<EaPlanningPage />);
    await screen.findByText('45%');
    fireEvent.click(screen.getByText('📋 All Plans'));
    fireEvent.click(await screen.findByText('Cloud Migration Plan'));
    fireEvent.click(await screen.findByText(/🚀 Initiatives/));

    expect(await screen.findByText(/Stand up exception workflow/)).toBeInTheDocument();
    expect(screen.getByText('👤 No owner')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('AT RISK'), { target: { value: 'BLOCKED' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/ea-planning/plans/plan-1/initiatives/init-1'),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ health: 'BLOCKED' }) }),
    ));
  });

  it('dashboard shows the needs-attention list and opens the initiatives tab of the right plan on click', async () => {
    mockFetch({
      ...BASE_ROUTES,
      '/ea-planning/dashboard': { ...DASHBOARD, initiativesTotal: 1, initiativesByHealth: { ON_TRACK: 0, AT_RISK: 0, DELAYED: 0, BLOCKED: 1 },
        needsAttention: [{ type: 'BLOCKED_INITIATIVE', initiativeId: 'init-1', planId: 'plan-1', planName: 'Cloud Migration Plan', title: 'Stand up exception workflow' }] },
      '/ea-planning/plans/plan-1': plan({ initiatives: [{ id: 'init-1', title: 'Stand up exception workflow', status: 'IN_PROGRESS', health: 'BLOCKED', objectiveId: null, ownerId: 'user-1' }] }),
    });
    render(<EaPlanningPage />);
    await screen.findByText('Stand up exception workflow');
    fireEvent.click(screen.getByText('Stand up exception workflow'));
    // Lands directly on the Initiatives tab rather than Overview.
    expect(await screen.findByText('👤 user-1')).toBeInTheDocument();
  });
});
