import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import StrategyPage from '../StrategyPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

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

const SAMPLE_STRATEGY = { id: 's1', name: 'Digital Transformation Strategy', strategyType: 'EA_STRATEGY', status: 'ACTIVE', goals: [] };

describe('StrategyPage - list view', () => {
  it('loads and displays strategies', async () => {
    mockFetch({ '/strategy': [SAMPLE_STRATEGY] });
    render(<StrategyPage />);
    expect(await screen.findByText('Digital Transformation Strategy')).toBeInTheDocument();
  });

  it('shows the empty state when there are no strategies', async () => {
    mockFetch({ '/strategy': [] });
    render(<StrategyPage />);
    expect(await screen.findByText(/strategy.no_strategies/)).toBeInTheDocument();
  });

  it('opens the new-strategy form and creates a strategy', async () => {
    mockFetch({ '/strategy': [] });
    render(<StrategyPage />);
    await screen.findByText(/strategy.no_strategies/);
    fireEvent.click(screen.getByText('strategy.new'));

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'New Strategy' } });
    fireEvent.click(screen.getByText('strategy.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/strategy'));
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body).name).toBe('New Strategy');
    });
  });
});

describe('StrategyPage - StrategyDetail navigation', () => {
  it('opens the detail view when a strategy is clicked, fetching its full record', async () => {
    mockFetch({
      '/strategy': [SAMPLE_STRATEGY],
      '/strategy/s1': { ...SAMPLE_STRATEGY, vision: 'Become fully digital by 2030', goals: [] },
    });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    expect(await screen.findByText(/2030/)).toBeInTheDocument();
  });

  it('shows the goal count in the Goals tab label', async () => {
    mockFetch({
      '/strategy': [SAMPLE_STRATEGY],
      '/strategy/s1': { ...SAMPLE_STRATEGY, goals: [{ id: 'g1', title: 'Goal A', alignments: [] }, { id: 'g2', title: 'Goal B', alignments: [] }] },
    });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    expect(await screen.findByText(/strategy.tab_goals \(2\)/)).toBeInTheDocument();
  });
});

describe('StrategyPage - GoalsTab', () => {
  function strategyWithGoal(overrides: Partial<Record<string, any>> = {}) {
    return { ...SAMPLE_STRATEGY, goals: [{ id: 'g1', title: 'Reduce Costs', pillar: 'Efficiency', targetYear: 2027, alignments: [], ...overrides }] };
  }

  it('lists goals with their pillar and target year', async () => {
    mockFetch({ '/strategy': [SAMPLE_STRATEGY], '/strategy/s1': strategyWithGoal() });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_goals/));
    expect(await screen.findByText(/Efficiency/)).toBeInTheDocument();
    expect(screen.getByText(/2027/)).toBeInTheDocument();
  });

  it('creates a new goal with parsed KPIs from a comma-separated field', async () => {
    mockFetch({ '/strategy': [SAMPLE_STRATEGY], '/strategy/s1': { ...SAMPLE_STRATEGY, goals: [] } });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_goals/));
    fireEvent.click(await screen.findByText('strategy.add_goal'));
    await screen.findByText('strategy.goal_title_ar'); // wait for the create-goal form to actually render

    // Form field order: Title(EN), Title(AR), Pillar, [Target Year - type=number,
    // role=spinbutton not textbox, excluded here], Description, KPIs
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Improve NPS' } });
    fireEvent.change(textboxes[textboxes.length - 1], { target: { value: 'NPS score, Customer retention' } });

    const addButtons = screen.getAllByText('strategy.add_goal');
    fireEvent.click(addButtons[addButtons.length - 1]);

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/goals'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.title).toBe('Improve NPS');
      expect(body.kpis).toEqual(['NPS score', 'Customer retention']);
    });
  });

  it('does not delete a goal when the confirmation dialog is cancelled', async () => {
    mockFetch({ '/strategy': [SAMPLE_STRATEGY], '/strategy/s1': strategyWithGoal() });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_goals/));
    await screen.findByText('Reduce Costs');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('strategy.delete'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });
});

describe('StrategyPage - GapScoreTab', () => {
  it('displays the overall gap score and per-goal breakdown', async () => {
    mockFetch({
      '/strategy': [SAMPLE_STRATEGY],
      '/strategy/s1': { ...SAMPLE_STRATEGY, goals: [{ id: 'g1', title: 'Reduce Costs' }] },
      '/strategy/s1/gap-score': { overallScore: 72, overallStatus: 'PARTIAL', summary: { strong: 2, gap: 1 }, goalScores: [{ goalId: 'g1', goalTitle: 'Reduce Costs', status: 'STRONG', gapScore: 90, alignedCapabilityCount: 3, totalCapabilities: 3, avgAlignmentScore: 90 }] },
    });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_gap/));
    expect(await screen.findByText('72')).toBeInTheDocument();
    expect(screen.getByText(/3\/3 capabilities aligned/)).toBeInTheDocument();
  });

  it('recalculates when the Recalculate button is clicked', async () => {
    mockFetch({
      '/strategy': [SAMPLE_STRATEGY],
      '/strategy/s1': SAMPLE_STRATEGY,
      '/strategy/s1/gap-score': { overallScore: 50, overallStatus: 'GAP', summary: { strong: 0, gap: 1 }, goalScores: [] },
    });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_gap/));
    await screen.findByText('50');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('gap-score')).length;
    fireEvent.click(screen.getByText(/strategy.recalculate|🔄 Recalculate/));
    await waitFor(() => {
      const callsAfter = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('gap-score')).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});

describe('StrategyPage - AlignmentMatrixTab', () => {
  it('renders a message when there are no capabilities in the repository yet', async () => {
    mockFetch({
      '/strategy': [SAMPLE_STRATEGY], '/strategy/s1': SAMPLE_STRATEGY,
      '/alignment-matrix': { capabilities: [], goals: [], matrix: [] },
    });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_matrix/));
    expect(await screen.findByText(/No capabilities in the EA Repository/)).toBeInTheDocument();
  });

  it('renders the matrix grid with real scores when data exists', async () => {
    mockFetch({
      '/strategy': [SAMPLE_STRATEGY], '/strategy/s1': SAMPLE_STRATEGY,
      '/alignment-matrix': {
        capabilities: [{ id: 'c1', name: 'Digital Payments' }],
        goals: [{ id: 'g1', title: 'Reduce Costs' }],
        matrix: [{ goalId: 'g1', goalTitle: 'Reduce Costs', c1: 85 }],
      },
    });
    render(<StrategyPage />);
    fireEvent.click(await screen.findByText('Digital Transformation Strategy'));
    await screen.findByText(/strategy.tab_overview/); // wait for the async open() call to resolve and the detail view to render
    fireEvent.click(screen.getByText(/strategy.tab_matrix/));
    expect(await screen.findByText('85')).toBeInTheDocument();
  });
});
