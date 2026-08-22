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

/**
 * Mocks the full review-open flow (list -> findings -> report) plus
 * records every PATCH body sent to /governance/reviews/:id/report, so
 * tests can assert exactly what an in-tab edit actually persisted -
 * not just that a button exists and is clickable.
 */
function mockReportView(review: any, report: any, findings: any[] = []) {
  const patchBodies: any[] = [];
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    if (url.includes('/governance/reviews?')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: [review], total: 1 }) });
    }
    if (opts?.method === 'PATCH' && url.includes('/report')) {
      patchBodies.push(JSON.parse(opts.body));
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url.includes(`/governance/reviews/${review.id}/findings`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(findings) });
    }
    if (url.includes(`/governance/reviews/${review.id}/report`)) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(report) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
  return { patchBodies };
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

describe('GovernancePage - report view: Strategic tab in-tab editing', () => {
  function makeReport(overrides: Partial<Record<string, any>> = {}) {
    return {
      decision: 'REQUIRES_CHANGES', decisionRationale: 'Some issues to address.',
      executiveSummary: 'Summary text.', overallScore: 70,
      strategicAlignment: {
        overallAlignmentPercentage: 60,
        objectives: [
          { strategyType: 'BUSINESS_STRATEGY', objectiveName: 'Improve customer retention', alignmentStatus: 'PARTIALLY_ALIGNED', alignmentPercentage: 50, isTenantStrategy: true },
        ],
      },
      financialOpportunities: { opportunities: [] },
      ...overrides,
    };
  }

  it('editing a strategic objective\'s alignment status persists the change via PATCH to the report endpoint, not just updating local UI state', async () => {
    const review = makeReview({ id: 'r1' });
    const { patchBodies } = mockReportView(review, makeReport());
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.strategic'));

    const select = await screen.findByDisplayValue('PARTIALLY ALIGNED');
    fireEvent.change(select, { target: { value: 'FULLY_ALIGNED' } });

    await waitFor(() => expect(patchBodies.length).toBeGreaterThan(0));
    const lastPatch = patchBodies[patchBodies.length - 1];
    expect(lastPatch.strategicAlignment.objectives[0].alignmentStatus).toBe('FULLY_ALIGNED');
  });

  it('setting a strategic objective to NOT_APPLICABLE zeroes its alignment percentage in the persisted PATCH body — matching the UI\'s own stated rule (%/100 not meaningful for something marked not applicable)', async () => {
    const review = makeReview({ id: 'r1' });
    const { patchBodies } = mockReportView(review, makeReport());
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.strategic'));

    const select = await screen.findByDisplayValue('PARTIALLY ALIGNED');
    fireEvent.change(select, { target: { value: 'NOT_APPLICABLE' } });

    await waitFor(() => expect(patchBodies.length).toBeGreaterThan(0));
    const lastPatch = patchBodies[patchBodies.length - 1];
    expect(lastPatch.strategicAlignment.objectives[0].alignmentStatus).toBe('NOT_APPLICABLE');
    expect(lastPatch.strategicAlignment.objectives[0].alignmentPercentage).toBe(0);
  });

  it('removing a strategic objective persists a shorter objectives array via PATCH, not just hiding it in the UI', async () => {
    const review = makeReview({ id: 'r1' });
    const report = makeReport({
      strategicAlignment: {
        overallAlignmentPercentage: 60,
        objectives: [
          { strategyType: 'BUSINESS_STRATEGY', objectiveName: 'Improve customer retention', alignmentStatus: 'PARTIALLY_ALIGNED', alignmentPercentage: 50, isTenantStrategy: true },
          { strategyType: 'DT_STRATEGY', objectiveName: 'Digitize onboarding', alignmentStatus: 'FULLY_ALIGNED', alignmentPercentage: 90, isTenantStrategy: true },
        ],
      },
    });
    const { patchBodies } = mockReportView(review, report);
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.strategic'));
    await screen.findByText('Improve customer retention');

    const removeButtons = screen.getAllByText('✕ Remove');
    fireEvent.click(removeButtons[0]);

    await waitFor(() => expect(patchBodies.length).toBeGreaterThan(0));
    const lastPatch = patchBodies[patchBodies.length - 1];
    expect(lastPatch.strategicAlignment.objectives).toHaveLength(1);
  });
});

describe('GovernancePage - report view: Financial tab in-tab editing', () => {
  function makeReportWithOpportunity(overrides: Partial<Record<string, any>> = {}) {
    return {
      decision: 'REQUIRES_CHANGES', decisionRationale: 'Some issues to address.',
      executiveSummary: 'Summary text.', overallScore: 70,
      strategicAlignment: { overallAlignmentPercentage: 60, objectives: [] },
      financialOpportunities: {
        opportunities: [
          { type: 'LICENSE_OPTIMIZATION', title: 'Consolidate CRM licenses', description: 'Two overlapping CRM licenses in use.', annualSaving: 50000, estimatedSaving: 0 },
        ],
      },
      ...overrides,
    };
  }

  it('editing a financial opportunity\'s title and saving persists the change via PATCH, reflecting the exact edited value, not the original', async () => {
    const review = makeReview({ id: 'r1' });
    const { patchBodies } = mockReportView(review, makeReportWithOpportunity());
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.financial'));
    await screen.findByText('Consolidate CRM licenses');

    fireEvent.click(screen.getByText('✏ Edit'));
    const titleInput = screen.getByPlaceholderText('Title');
    fireEvent.change(titleInput, { target: { value: 'Consolidate CRM and ERP licenses' } });
    fireEvent.click(screen.getByText('💾 Save'));

    await waitFor(() => expect(patchBodies.length).toBeGreaterThan(0));
    const lastPatch = patchBodies[patchBodies.length - 1];
    expect(lastPatch.financialOpportunities.opportunities[0].title).toBe('Consolidate CRM and ERP licenses');
  });

  it('editing a financial opportunity\'s annual saving figure persists the new number, not the original, via PATCH', async () => {
    const review = makeReview({ id: 'r1' });
    const { patchBodies } = mockReportView(review, makeReportWithOpportunity());
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.financial'));
    await screen.findByText('Consolidate CRM licenses');

    fireEvent.click(screen.getByText('✏ Edit'));
    const annualInput = screen.getByDisplayValue('50000');
    fireEvent.change(annualInput, { target: { value: '75000' } });
    fireEvent.click(screen.getByText('💾 Save'));

    await waitFor(() => expect(patchBodies.length).toBeGreaterThan(0));
    const lastPatch = patchBodies[patchBodies.length - 1];
    expect(lastPatch.financialOpportunities.opportunities[0].annualSaving).toBe(75000);
  });

  it('removing a financial opportunity persists an empty opportunities array via PATCH when it was the only one', async () => {
    const review = makeReview({ id: 'r1' });
    const { patchBodies } = mockReportView(review, makeReportWithOpportunity());
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.financial'));
    await screen.findByText('Consolidate CRM licenses');

    fireEvent.click(screen.getByText('🗑'));

    await waitFor(() => expect(patchBodies.length).toBeGreaterThan(0));
    const lastPatch = patchBodies[patchBodies.length - 1];
    expect(lastPatch.financialOpportunities.opportunities).toHaveLength(0);
  });

  it('canceling an in-progress opportunity edit does not send any PATCH request', async () => {
    const review = makeReview({ id: 'r1' });
    const { patchBodies } = mockReportView(review, makeReportWithOpportunity());
    render(<GovernancePage />);

    fireEvent.click(await screen.findByText('Payment Gateway HLD Review'));
    fireEvent.click(await screen.findByText('gov.financial'));
    await screen.findByText('Consolidate CRM licenses');

    fireEvent.click(screen.getByText('✏ Edit'));
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'This should never be saved' } });
    fireEvent.click(screen.getByText('Cancel'));

    expect(patchBodies).toHaveLength(0);
    expect(screen.getByText('Consolidate CRM licenses')).toBeInTheDocument();
  });
});
