import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GovernancePage from '../GovernancePage';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ state: null }),
}), { virtual: true });

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ isAR: false, t: (key: string) => key }),
}));

function makeReview(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 'r1', title: 'Payment Gateway HLD Review', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0',
    aggressiveness: 'STANDARD', status: 'COMPLETED', decision: 'APPROVED', overallScore: 85,
    createdAt: '2026-01-15T00:00:00Z', ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('ea_token', 'fake-token');
});

function mockApiGet(reviews: any[]) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    if (url.includes('/governance/reviews?')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: reviews, total: reviews.length }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

describe('GovernancePage - list view', () => {
  it('loads and displays reviews on mount', async () => {
    mockApiGet([makeReview()]);
    render(<GovernancePage />);
    expect(await screen.findByText('Payment Gateway HLD Review')).toBeInTheDocument();
  });

  it('shows the empty state when there are no reviews', async () => {
    mockApiGet([]);
    render(<GovernancePage />);
    expect(await screen.findByText('No reviews yet')).toBeInTheDocument();
  });

  it('filters reviews by search text (case-insensitive, title-only)', async () => {
    mockApiGet([makeReview({ id: 'r1', title: 'Payment Gateway Review' }), makeReview({ id: 'r2', title: 'CRM Migration Review' })]);
    render(<GovernancePage />);
    await screen.findByText('Payment Gateway Review');

    fireEvent.change(screen.getByPlaceholderText('Search reviews...'), { target: { value: 'payment' } });
    expect(screen.getByText('Payment Gateway Review')).toBeInTheDocument();
    expect(screen.queryByText('CRM Migration Review')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    mockApiGet([makeReview({ id: 'r1', title: 'Completed Review', status: 'COMPLETED' }), makeReview({ id: 'r2', title: 'Draft Review', status: 'DRAFT' })]);
    render(<GovernancePage />);
    await screen.findByText('Completed Review');

    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="COMPLETED"]'))!;
    fireEvent.change(statusSelect, { target: { value: 'DRAFT' } });
    expect(screen.getByText('Draft Review')).toBeInTheDocument();
    expect(screen.queryByText('Completed Review')).not.toBeInTheDocument();
  });

  it('the score filter "≤ 44 (Critical)" correctly excludes a review scoring exactly at the 45 boundary', async () => {
    mockApiGet([makeReview({ id: 'r1', title: 'Boundary Review', overallScore: 45 }), makeReview({ id: 'r2', title: 'Critical Review', overallScore: 30 })]);
    render(<GovernancePage />);
    await screen.findByText('Boundary Review');

    const selects = screen.getAllByRole('combobox');
    const scoreSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="0"]'))!;
    fireEvent.change(scoreSelect, { target: { value: '0' } });
    expect(screen.getByText('Critical Review')).toBeInTheDocument();
    expect(screen.queryByText('Boundary Review')).not.toBeInTheDocument(); // 45 is NOT <= 44, correctly excluded
  });

  it('the score filter "≥ 75 (Good)" includes a review scoring exactly at 75', async () => {
    mockApiGet([makeReview({ id: 'r1', title: 'Exactly 75', overallScore: 75 }), makeReview({ id: 'r2', title: 'Just Below', overallScore: 74 })]);
    render(<GovernancePage />);
    await screen.findByText('Exactly 75');

    const selects = screen.getAllByRole('combobox');
    const scoreSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="75"]'))!;
    fireEvent.change(scoreSelect, { target: { value: '75' } });
    expect(screen.getByText('Exactly 75')).toBeInTheDocument();
    expect(screen.queryByText('Just Below')).not.toBeInTheDocument();
  });

  it('shows the Clear filters button only when at least one filter is active, and clears all filters when clicked', async () => {
    mockApiGet([makeReview()]);
    render(<GovernancePage />);
    await screen.findByText('Payment Gateway HLD Review');
    expect(screen.queryByText('✕ Clear')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search reviews...'), { target: { value: 'xyz' } });
    expect(screen.getByText('✕ Clear')).toBeInTheDocument();

    fireEvent.click(screen.getByText('✕ Clear'));
    expect(screen.getByPlaceholderText('Search reviews...')).toHaveValue('');
    expect(screen.queryByText('✕ Clear')).not.toBeInTheDocument();
  });

  it('fetches findings and report when a review is clicked, switching to the report view', async () => {
    mockApiGet([makeReview()]);
    render(<GovernancePage />);
    await screen.findByText('Payment Gateway HLD Review');

    fireEvent.click(screen.getByText('Payment Gateway HLD Review'));

    await waitFor(() => {
      const calledUrls = (global.fetch as jest.Mock).mock.calls.map((c: any) => c[0]);
      expect(calledUrls.some((u: string) => u.includes('/governance/reviews/r1/findings'))).toBe(true);
      expect(calledUrls.some((u: string) => u.includes('/governance/reviews/r1/report'))).toBe(true);
    });
  });

  it('resets to page 1 when a filter changes', async () => {
    const manyReviews = Array.from({ length: 20 }, (_, i) => makeReview({ id: `r${i}`, title: `Review ${i}` }));
    mockApiGet(manyReviews);
    render(<GovernancePage />);
    await screen.findByText('Review 0');
    expect(screen.getByText(/page 1\/2/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search reviews...'), { target: { value: 'Review 1' } });
    // Filtering to "Review 1" matches Review 1, 10-19 (11 items) - still fits on 1 page, so page indicator disappears
    await waitFor(() => expect(screen.queryByText(/page \d\/\d/)).not.toBeInTheDocument());
  });
});
