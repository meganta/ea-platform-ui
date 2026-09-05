import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportsPage from '../ReportsPage';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}), { virtual: true });

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ isAR: false, t: (k: string) => k }),
}));

function mockFetchJson(data: any) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReportsPage', () => {
  it('shows the Savings report tab by default', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [], total: 0 }));
    render(<ReportsPage />);
    await waitFor(() => expect(screen.getByText('Total Opportunities')).toBeInTheDocument());
  });

  it('switches to the Compliance tab when clicked', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [] }));
    render(<ReportsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('✅ Compliance Register'));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[0].includes('compliance'))).toBe(true));
  });

  it('switches to the Requirements tab when clicked', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [] }));
    render(<ReportsPage />);
    fireEvent.click(screen.getByText('📋 EA Requirements Tracker'));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some((c: any) => c[0].includes('requirement'))).toBe(true));
  });
});

describe('ReportsPage - SavingsReport', () => {
  const SAMPLE_ITEM = {
    id: 'f1', reviewId: 'r1', title: 'Reuse existing gateway', domain: 'APPLICATION_INTEGRATION', status: 'OPEN',
    estimatedSaving: 50000, annualSaving: 120000, totalSaving: 170000,
    review: { title: 'Payment Gateway Review', reviewType: 'HLD_REVIEW', createdAt: '2026-01-15T00:00:00Z' },
  };

  it('displays summary totals from the API response', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [SAMPLE_ITEM], total: 1, totalAnnual: 120000, totalOneTime: 50000 }));
    render(<ReportsPage />);
    expect(await screen.findByText('SAR 120,000')).toBeInTheDocument();
    expect(screen.getByText('SAR 50,000')).toBeInTheDocument();
  });

  it('renders each savings item in the table', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [SAMPLE_ITEM], total: 1 }));
    render(<ReportsPage />);
    expect(await screen.findByText('Payment Gateway Review')).toBeInTheDocument();
    expect(screen.getByText('Reuse existing gateway')).toBeInTheDocument();
  });

  it('shows a domain-specific empty message when a domain filter yields nothing', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [SAMPLE_ITEM], total: 1 }));
    render(<ReportsPage />);
    await screen.findByText('Payment Gateway Review');
    // Domain filter is applied client-side (API doesn't support it per source comment)
    const selects = screen.getAllByRole('combobox');
    const domainSelect = selects[2]; // status, reviewType, domain, in that order
    fireEvent.change(domainSelect, { target: { value: 'SECURITY_ARCHITECTURE' } });
    expect(await screen.findByText('No savings in selected domain')).toBeInTheDocument();
  });

  it('shows the generic empty message when there are no items at all (no domain filter applied)', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [], total: 0 }));
    render(<ReportsPage />);
    expect(await screen.findByText('No savings found')).toBeInTheDocument();
  });

  it('re-fetches with updated query params when a filter changes', async () => {
    global.fetch = jest.fn().mockImplementation(() => mockFetchJson({ items: [] }));
    render(<ReportsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const statusSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(statusSelect, { target: { value: 'ACCEPTED' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const secondCallUrl = (global.fetch as jest.Mock).mock.calls[1][0];
    expect(secondCallUrl).toContain('status=ACCEPTED');
  });

  it('PATCHes the finding status when the status dropdown in a row is changed, then updates it locally', async () => {
    (global.fetch as jest.Mock) = jest.fn()
      .mockImplementationOnce(() => mockFetchJson({ items: [SAMPLE_ITEM], total: 1 })) // initial load
      .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })); // the PATCH call
    render(<ReportsPage />);
    await screen.findByText('Payment Gateway Review');

    const rowStatusSelect = screen.getAllByRole('combobox').find(el => (el as HTMLSelectElement).value === 'OPEN')!;
    fireEvent.change(rowStatusSelect, { target: { value: 'ACCEPTED' } });

    await waitFor(() => {
      const patchCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      expect(patchCall[0]).toContain('/governance/reviews/r1/findings/f1');
      expect(JSON.parse(patchCall[1].body)).toEqual({ status: 'ACCEPTED' });
    });
  });

  it('shows the loading indicator while the request is in flight', async () => {
    let resolveFetch: (v: any) => void;
    global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));
    render(<ReportsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    resolveFetch!({ ok: true, json: () => Promise.resolve({ items: [] }) });
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });

  it('gracefully clears data (no crash) when the API request fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error'));
    render(<ReportsPage />);
    expect(await screen.findByText('No savings found')).toBeInTheDocument();
  });
});
