import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DecisionEvaluationPage from '../DecisionEvaluationPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ locale: 'EN' }),
}));

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    for (const pattern of sortedPatterns) {
      if (url.includes(pattern)) {
        const value = typeof routes[pattern] === 'function' ? routes[pattern](options) : routes[pattern];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

const ASSESSMENT = {
  id: 'a1', title: 'Database selection', purpose: 'Pick a DB', profile: 'DATABASE_TECHNOLOGY',
  status: 'DRAFT', outcome: null, version: 1,
};

const ASSESSMENT_DETAIL = {
  assessment: ASSESSMENT,
  groups: [{ id: 'g1', name: 'Workload Suitability', weight: 100, displayOrder: 1 }],
  criteria: [{ id: 'c1', groupId: 'g1', name: 'Workload fit', description: 'Fits the workload', weight: 100, gateType: 'BLOCKING', displayOrder: 1 }],
  candidates: [],
  scores: [],
};

describe('DecisionEvaluationPage', () => {
  it('shows an empty state when there are no assessments', async () => {
    mockFetch({ '/decision-evaluation': [] });
    render(<DecisionEvaluationPage />);
    expect(await screen.findByText(/No assessments yet/i)).toBeInTheDocument();
  });

  it('lists existing assessments', async () => {
    mockFetch({ '/decision-evaluation': [ASSESSMENT] });
    render(<DecisionEvaluationPage />);
    expect(await screen.findByText('Database selection')).toBeInTheDocument();
    expect(screen.getByText('DRAFT')).toBeInTheDocument();
  });

  it('opens the create modal and requires title/purpose before submitting', async () => {
    mockFetch({ '/decision-evaluation': [] });
    render(<DecisionEvaluationPage />);
    fireEvent.click(await screen.findByText(/New Assessment/i));
    expect(screen.getByText('New Assessment')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Create'));
    expect(await screen.findByText(/Title and purpose are required/i)).toBeInTheDocument();
  });

  it('navigates into an assessment detail view and shows its tabs', async () => {
    mockFetch({ '/decision-evaluation/a1': ASSESSMENT_DETAIL, '/decision-evaluation': [ASSESSMENT] });
    render(<DecisionEvaluationPage />);
    fireEvent.click(await screen.findByText('Database selection'));
    await waitFor(() => expect(screen.getByText('Criteria (1)')).toBeInTheDocument());
    expect(screen.getByText('Freeze Baseline')).toBeInTheDocument();
  });

  it('shows a message when comparison has not been computed yet', async () => {
    mockFetch({ '/decision-evaluation/a1': ASSESSMENT_DETAIL, '/decision-evaluation': [ASSESSMENT] });
    render(<DecisionEvaluationPage />);
    fireEvent.click(await screen.findByText('Database selection'));
    await waitFor(() => screen.getByText('Compare'));
    fireEvent.click(screen.getByText('Compare'));
    expect(await screen.findByText(/Comparison not computed yet/i)).toBeInTheDocument();
  });
});
