import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({
    t: (key: string) => key,
    isAR: false,
  }),
}));

const mockHasPermission = jest.fn((_code: string) => true);
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    hasPermission: (code: string) => mockHasPermission(code),
  }),
}));

const mockGetCycles = jest.fn();
const mockGetCapabilities = jest.fn();
const mockGetDocuments = jest.fn();
jest.mock('../../lib/api', () => ({
  api: {
    getCycles: () => mockGetCycles(),
    getCapabilities: () => mockGetCapabilities(),
    getDocuments: () => mockGetDocuments(),
  },
  getToken: () => 'fake-token',
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPermission.mockReturnValue(true);
  mockGetCycles.mockResolvedValue([]);
  mockGetCapabilities.mockResolvedValue([]);
  mockGetDocuments.mockResolvedValue([]);
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve({ data: [] }) });
    if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve(null) });
    return Promise.resolve({ json: () => Promise.resolve({}) });
  }) as any;
});

describe('DashboardPage', () => {
  it('renders platform stat cards populated from the loaded data', async () => {
    mockGetCycles.mockResolvedValue([{ status: 'ACTIVE' }, { status: 'ACTIVE' }, { status: 'COMPLETED' }]);
    mockGetCapabilities.mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }, { id: '7' }]);
    mockGetDocuments.mockResolvedValue([{ status: 'READY' }, { status: 'PROCESSING' }, { status: 'PROCESSING' }, { status: 'PROCESSING' }, { status: 'PROCESSING' }]);
    render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument()); // 3 cycles total
    expect(screen.getByText('2 dash.active')).toBeInTheDocument(); // 2 active cycles
    expect(screen.getByText('7')).toBeInTheDocument(); // 7 capabilities
    expect(screen.getByText('1 dash.indexed')).toBeInTheDocument(); // 1 ready doc
  });

  it('does not crash when any individual data source fails to load - each is caught independently', async () => {
    mockGetCycles.mockRejectedValue(new Error('cycles endpoint down'));
    mockGetCapabilities.mockResolvedValue([{ id: '1' }]);
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
  });

  it('prefers the dedicated governance stats endpoint totals over manually counting the reviews list when both are available', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ status: 'COMPLETED' }] }) }); // manual count would say 1
      if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve({ summary: { totalReviews: 50, completedReviews: 40, inProgressReviews: 10 } }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(<DashboardPage />);
    // 50 legitimately appears in two places on a real render (the top-level
    // reviews stat card and the governance dashboard's own KPI grid, both
    // derived from the same statsTotal value) - getAllByText confirms it's
    // present at all, using the stats-endpoint number rather than the
    // manually-counted 1.
    await waitFor(() => expect(screen.getAllByText('50').length).toBeGreaterThan(0));
    expect(screen.queryByText('1')).not.toBeInTheDocument(); // the manually-counted value never appears
  });

  it('falls back to manually counting the reviews list when the stats endpoint returns nothing', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ status: 'COMPLETED' }, { status: 'DRAFT' }, { status: 'DRAFT' }] }) });
      if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve(null) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(<DashboardPage />);
    // 3 total reviews manually counted from the reviews list, scoped to the reviews stat card specifically
    await waitFor(() => {
      const reviewsCard = screen.getByText('gov.reviews').closest('.stat-card')!;
      expect(reviewsCard.querySelector('.stat-value')).toHaveTextContent('3');
    });
  });

  it('handles a reviews response that is a bare array (not wrapped in {data: [...]})', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve([{ status: 'COMPLETED' }]) }); // bare array
      if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve(null) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getAllByText('1').length).toBeGreaterThan(0));
  });

  it('navigates to /governance when the reviews stat card is clicked', async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText('gov.reviews')).toBeInTheDocument());
    fireEvent.click(screen.getByText('gov.reviews').closest('.stat-card')!);
    expect(mockNavigate).toHaveBeenCalledWith('/governance');
  });

  it('only shows the governance dashboard KPI section once there is at least one review', async () => {
    // Note: t('gov.dashboard') text itself also appears unconditionally in a
    // separate "Quick Actions" shortcut list, so check for gov.view_all - the
    // "View all" link inside the conditional governance section specifically.
    render(<DashboardPage />);
    await waitFor(() => expect(screen.queryByText('gov.view_all')).not.toBeInTheDocument());
  });

  it('shows the governance dashboard section once reviews exist', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ status: 'COMPLETED' }] }) });
      if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve({ summary: { totalReviews: 1 } }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(<DashboardPage />);
    expect(await screen.findByText('gov.dashboard')).toBeInTheDocument();
  });

  // Confirmed real gap, found while improving this page: "Open Findings",
  // "X critical"/"none critical", and "(last 6 months)" were hardcoded
  // English literals, not routed through t() - inconsistent with every
  // other label on this page and with the platform's AR/EN convention.
  it('uses translated labels for open-findings/critical-count/score-trend-period, not hardcoded English literals', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ status: 'COMPLETED', title: 'R1', createdAt: new Date().toISOString() }] }) });
      if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve({
        summary: { totalReviews: 1, completedReviews: 1, openFindings: 3, criticalOpenFindings: 1 },
        monthlyTrend: [{ label: 'Jan', count: 1, avgScore: 80 }],
      }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(<DashboardPage />);
    expect(await screen.findByText('gov.open_findings')).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.textContent === '1 common.critical'.toLowerCase() || el?.textContent === '1 common.critical')).toBeInTheDocument();
    expect(screen.getByText(/gov.score_trend/)).toHaveTextContent('gov.last_6_months');
  });

  // Standing policy: every new page or feature includes a help tip
  // explaining the feature in plain language - retrofitted here since
  // the governance dashboard section had none.
  it('shows a help tip explaining the governance dashboard stats, once the section renders', async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('/governance/reviews')) return Promise.resolve({ json: () => Promise.resolve({ data: [{ status: 'COMPLETED' }] }) });
      if (url.includes('/governance/stats')) return Promise.resolve({ json: () => Promise.resolve({ summary: { totalReviews: 1 } }) });
      return Promise.resolve({ json: () => Promise.resolve({}) });
    });
    render(<DashboardPage />);
    await screen.findByText('gov.open_findings');
    expect(screen.getAllByRole('button', { name: 'common.more_info' }).length).toBeGreaterThanOrEqual(1);
  });

  // "Put into consideration rbac for showing data" — the core of this
  // round of changes: a user without a module's permission should never
  // see (or have their browser fetch) that module's data here, matching
  // the exact permission codes Layout.tsx's sidebar already gates
  // module visibility by.
  it('does not fetch or display repository-gated data (cycles/capabilities/documents) when the user lacks Repository.View', async () => {
    mockHasPermission.mockImplementation((code: string) => code !== 'Repository.View');
    render(<DashboardPage />);
    await waitFor(() => expect(mockGetCycles).not.toHaveBeenCalled());
    expect(mockGetCapabilities).not.toHaveBeenCalled();
    expect(mockGetDocuments).not.toHaveBeenCalled();
    expect(screen.queryByText('dash.adm_cycles')).not.toBeInTheDocument();
    expect(screen.queryByText('dash.active_cycles')).not.toBeInTheDocument();
  });

  it('does not fetch or display governance review data when the user lacks Reviews.View', async () => {
    mockHasPermission.mockImplementation((code: string) => code !== 'Reviews.View');
    const fetchSpy = global.fetch as jest.Mock;
    render(<DashboardPage />);
    await waitFor(() => expect(mockGetCycles).toHaveBeenCalled()); // repository data still loads
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('/governance/reviews'), expect.anything());
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringContaining('/governance/stats'), expect.anything());
    expect(screen.queryByText('gov.reviews')).not.toBeInTheDocument();
  });

  it('"Your Modules" only shows modules the user has permission for, filtering out the rest — same codes as the sidebar nav', async () => {
    mockHasPermission.mockImplementation((code: string) => code === 'Repository.View');
    render(<DashboardPage />);
    expect(await screen.findByText('dash.your_modules')).toBeInTheDocument();
    expect(screen.getByText('nav.adm')).toBeInTheDocument(); // Repository.View — shown
    expect(screen.queryByText('nav.governance')).not.toBeInTheDocument(); // Reviews.View — hidden
    expect(screen.queryByText('nav.meta_model')).not.toBeInTheDocument(); // MetaModel.View — hidden
  });

  it('a user with every permission sees every module in "Your Modules"', async () => {
    render(<DashboardPage />);
    expect(await screen.findByText('dash.your_modules')).toBeInTheDocument();
    expect(screen.getByText('nav.adm')).toBeInTheDocument();
    expect(screen.getByText('nav.governance')).toBeInTheDocument();
    expect(screen.getByText('nav.meta_model')).toBeInTheDocument();
    expect(screen.getByText('nav.ea_views')).toBeInTheDocument();
  });

  it('clicking a module card navigates to its page', async () => {
    render(<DashboardPage />);
    const admCard = await screen.findByText('nav.adm');
    fireEvent.click(admCard);
    expect(mockNavigate).toHaveBeenCalledWith('/adm');
  });
});
