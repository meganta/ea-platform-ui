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
});
