import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdmPage from '../AdmPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false }),
}));

jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }), { virtual: true });
jest.mock('../../components/DiagramViewer', () => ({ DiagramViewer: () => <div /> }));
jest.mock('../../components/Phase7Workspace', () => ({ Phase7Workspace: () => <div /> }));

// AdmPage now uses useNavigate (the "Related Architecture Views" links to
// EA Views) - mocked per this codebase's established pattern (see
// DashboardPage.test.tsx) rather than wrapping every render() in a real
// Router.
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('ea_token', 'fake-token');
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

const SAMPLE_CYCLE = { id: 'cycle-1', name: 'Q1 2026 ADM Cycle', frameworkType: 'NORA', status: 'IN_PROGRESS', scopeDomains: [] };

describe('AdmPage - list view', () => {
  it('loads and displays ADM cycles', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0));
  });

  it('auto-selects the first cycle when none is currently selected', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0)); // appears in both the sidebar list and the auto-selected detail panel
    // The subtitle shows the selected cycle's framework + name
    expect(await screen.findByText(/NORA FRAMEWORK/)).toBeInTheDocument();
  });

  it('shows the empty state with a create shortcut when there are no cycles', async () => {
    mockFetch({ '/adm/cycles': [] });
    render(<AdmPage />);
    expect(await screen.findByText('adm.no_cycles')).toBeInTheDocument();
  });

  it('switches selection when a different cycle in the list is clicked', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE, { id: 'cycle-2', name: 'Q2 2026 ADM Cycle', frameworkType: 'TOGAF', status: 'DRAFT', scopeDomains: [] }] });
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0)); // appears in both the sidebar list and the auto-selected detail panel
    fireEvent.click(screen.getByText('Q2 2026 ADM Cycle'));
    expect(await screen.findByText(/TOGAF FRAMEWORK/)).toBeInTheDocument();
  });

  it('deletes a cycle after confirmation, then reloads the list', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0)); // appears in both the sidebar list and the auto-selected detail panel
    fireEvent.click(screen.getByText('🗑'));

    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('/adm/cycles/cycle-1');
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0)); // appears in both the sidebar list and the auto-selected detail panel
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('🗑'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });

  it('truncates the displayed scope domains list, showing a "+N" overflow indicator', async () => {
    mockFetch({ '/adm/cycles': [{ ...SAMPLE_CYCLE, scopeDomains: ['BUSINESS', 'DATA', 'APPLICATION', 'SECURITY', 'TECHNOLOGY'] }] });
    render(<AdmPage />);
    expect(await screen.findByText(/BUSINESS, DATA, APPLICATION/)).toBeInTheDocument();
    expect(screen.getByText(/\+2/)).toBeInTheDocument();
  });
});

describe('AdmPage - Related Architecture Views (EA Views integration)', () => {
  it('shows all four architecture-state links once a cycle is selected', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0));
    expect(await screen.findByText('🗺 Baseline')).toBeInTheDocument();
    expect(screen.getByText('🗺 Current')).toBeInTheDocument();
    expect(screen.getByText('🗺 Target')).toBeInTheDocument();
    expect(screen.getByText('🗺 Transition')).toBeInTheDocument();
  });

  it('clicking a state link navigates to EA Views with the matching architectureState query param', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0));
    fireEvent.click(await screen.findByText('🗺 Target'));
    expect(mockNavigate).toHaveBeenCalledWith('/ea-views?architectureState=TARGET');
  });

  it('each of the four links navigates with its own distinct state, not all pointing to the same one', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE] });
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0));
    fireEvent.click(await screen.findByText('🗺 Baseline'));
    fireEvent.click(screen.getByText('🗺 Current'));
    fireEvent.click(screen.getByText('🗺 Transition'));
    expect(mockNavigate).toHaveBeenNthCalledWith(1, '/ea-views?architectureState=BASELINE');
    expect(mockNavigate).toHaveBeenNthCalledWith(2, '/ea-views?architectureState=CURRENT');
    expect(mockNavigate).toHaveBeenNthCalledWith(3, '/ea-views?architectureState=TRANSITION');
  });

  it('does not show the section at all when no cycle is selected (empty-cycles state)', async () => {
    mockFetch({ '/adm/cycles': [] });
    render(<AdmPage />);
    await screen.findByText('adm.no_cycles');
    expect(screen.queryByText('🗺 Baseline')).not.toBeInTheDocument();
  });
});

describe('AdmPage - sequential execution and Architecture Impact Review', () => {
  it('keeps Manual mode and exposes the additional persisted Sequential mode', async () => {
    mockFetch({ '/adm/cycles': [SAMPLE_CYCLE], '/sequential': {} });
    render(<AdmPage />);
    expect(await screen.findByText('ADM Execution')).toBeInTheDocument();
    fireEvent.click(screen.getByText('▶ Run Sequentially'));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.some((call: any) => call[0].includes('/sequential/start') && call[1]?.method === 'POST')).toBe(true));
    expect(screen.getByText(/Manual mode remains available/)).toBeInTheDocument();
    expect(screen.getByText(/automatically advances generated outputs/)).toBeInTheDocument();
  });

  it.each([
    ['RUNNING', 'Running'],
    ['WAITING_INPUT', 'Waiting for Input'],
    ['REVIEW_REQUIRED', 'Review Required'],
    ['WAITING_FOR_ARCHITECTURE_APPROVAL', 'Architecture Approval Required'],
  ])('shows a human-readable %s pause/running reason', async (status, label) => {
    mockFetch({
      '/adm/cycles': [SAMPLE_CYCLE],
      '/sequential': {
        id: 'run-1', status, currentPhase: '2', currentStep: '2.3',
        completedOutputIds: ['o1'], remainingOutputIds: ['o2'],
        waitingReason: status === 'RUNNING' ? null : `${label} — Application Inventory`,
      },
    });
    render(<AdmPage />);
    expect(await screen.findByText(label)).toBeInTheDocument();
    expect(screen.getByText(/Phase 2 · Step 2.3/)).toBeInTheDocument();
  });

  it('does not offer a generic Resume action at an architecture publication gate', async () => {
    mockFetch({
      '/adm/cycles': [SAMPLE_CYCLE],
      '/sequential': {
        id: 'run-1', status: 'WAITING_FOR_ARCHITECTURE_APPROVAL', currentPhase: '2', currentStep: '2.3',
        completedOutputIds: [], remainingOutputIds: ['o1'], waitingReason: 'Architecture Approval Required — Current Repository impact.',
      },
    });
    render(<AdmPage />);
    expect(await screen.findByText('Architecture Approval Required')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument();
    expect(screen.getByText(/Current Repository impact/)).toBeInTheDocument();
  });

  it('warns about pending architecture impact and opens an explicit controlled proposal', async () => {
    mockFetch({
      '/adm/cycles': [SAMPLE_CYCLE],
      '/architecture-impact-proposal': {
        outputName: 'Application Inventory', architectureState: 'CURRENT', affectedDomains: ['APPLICATIONS'], lifecycleStatus: 'REVIEW_REQUIRED',
        proposal: { assets: [{ key: '1HRDF', action: 'RECONCILE' }], relationships: [], view: { behavior: 'CREATE_OR_REFRESH' } },
        assessment: {
          status: 'REVIEW_REQUIRED',
          assets: [
            { key: '1HRDF', name: '1HRDF', objectType: 'Application', status: 'MATCH_EXISTING' },
            { key: 'new-app', name: 'New App', objectType: 'Application', status: 'INTRODUCE' },
            { key: 'changed-app', name: 'Changed App', objectType: 'Application', status: 'UPDATE', before: { owner: 'A' }, after: { owner: 'B' } },
            { key: 'old-app', name: 'Old App', objectType: 'Application', status: 'REMOVE' },
            { key: 'restored-app', name: 'Restored App', objectType: 'Application', status: 'RESTORE' },
            { key: 'ambiguous-app', name: 'Ambiguous App', objectType: 'Application', status: 'CONFLICT', conflicts: ['Two matching Repository identities require a user decision.'] },
          ],
          relationships: [{ key: 'rel-1', source: '1HRDF', target: 'New App', relationshipType: 'supports', status: 'ADD' }],
          view: { status: 'CREATE', name: 'Application Inventory', viewpoint: 'application_inventory', architectureState: 'CURRENT' },
        },
      },
      '/architecture-impact': {
        pendingCount: 1, completion: { allowed: false, warning: '1 approved architecture-state output(s) still require Architecture Impact Review.' },
        entries: [{ outputId: 'o1', title: 'Application Inventory', phase: '2', outputStatus: 'APPROVED', architectureState: 'CURRENT', impactStatus: 'PENDING', activities: [] }],
      },
    });
    render(<AdmPage />);
    expect(await screen.findByText('Architecture Impact Review')).toBeInTheDocument();
    expect(screen.getByText(/still require Architecture Impact Review/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Review / Apply'));
    expect(await screen.findByText('Matched Existing')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Restored')).toBeInTheDocument();
    expect(screen.getByText('Conflicts / Review Required')).toBeInTheDocument();
    expect(screen.getByText('Relationships')).toBeInTheDocument();
    expect(screen.getByText(/1HRDF → supports → New App · ADD/)).toBeInTheDocument();
    expect(screen.getByText('EA Views')).toBeInTheDocument();
    expect(screen.getByText('REVIEW REQUIRED')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Technical proposal details'));
    expect((await screen.findByLabelText('Technical proposal details') as HTMLTextAreaElement).value).toContain('CREATE_OR_REFRESH');
    expect(screen.getByText('Apply Architecture Changes')).toBeInTheDocument();
    const dispatchSpy = jest.spyOn(window, 'dispatchEvent');
    fireEvent.click(screen.getByText('Apply Architecture Changes'));
    await waitFor(() => expect(dispatchSpy.mock.calls.some(([event]) => event.type === 'adm-sequential-updated')).toBe(true));
    dispatchSpy.mockRestore();
  });
});

describe('AdmPage - Repository-first evidence and persisted Architecture Impact', () => {
  const phaseDef = {
    phase: '1', name: 'Scope Definition', description: 'Scope',
    steps: [{
      key: '1.3', title: 'Identify Stakeholders and Approve Charter', titleAr: '',
      inputs: [{ key: 'org_structure', title: 'Organizational Structure', source: 'EXTERNAL', required: true, domains: [] }],
      outputs: [{ key: 'ea_cycle_charter', title: 'EA Cycle Charter', behaviorType: 'GOVERNANCE', domains: [] }],
    }],
  };

  function phaseRoutes(activities: any[] = []) {
    return {
      '/adm/cycles': [SAMPLE_CYCLE],
      '/phases/1/inputs': {
        phaseDef,
        inputs: [{
          id: 'input-org', inputKey: 'org_structure', title: 'Organizational Structure',
          source: 'SYSTEM', providedBy: 'AUTO_REPO:asset-1', content: 'Repository evidence',
          repositoryEvidence: {
            coverage: 'PARTIAL',
            assets: [{ id: 'asset-1', name: 'HRDF Organization Unit' }],
            relationships: [],
            relevantObjectTypes: [{ id: 'ot-1', name: 'Department' }],
            missing: ['Reporting relationships require supplementary evidence.'],
          },
        }],
      },
      '/phases/1/outputs': {
        phaseDef,
        outputs: [{
          id: 'output-charter', outputKey: 'ea_cycle_charter', title: 'EA Cycle Charter',
          description: 'Charter', status: 'APPROVED', content: 'Approved charter',
          scopeAlignment: { status: 'REVIEW_REQUIRED', scopeDomains: ['BUSINESS'], warnings: ['Explicit constraint requires review.'] },
        }],
      },
      '/outputs/output-charter/architecture-integration': { activities },
    };
  }

  async function openPhaseOne() {
    render(<AdmPage />);
    await waitFor(() => expect(screen.getAllByText('Q1 2026 ADM Cycle').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole('button', { name: /1 phase\.nora\.1/i }));
    await screen.findByText('Organizational Structure');
  }

  it('shows automatically sourced Organization Unit evidence and a clear supplementary gap', async () => {
    mockFetch(phaseRoutes());
    await openPhaseOne();
    expect(screen.getByText(/Repository Evidence — Automatically Sourced/)).toBeInTheDocument();
    expect(screen.getByText(/1 assets · 0 relationships\/dependencies · 1 Meta Model types/)).toBeInTheDocument();
    expect(screen.getByText(/Reporting relationships require supplementary evidence/)).toBeInTheDocument();
  });

  it('reloads persisted integration history and navigates with labels rather than exposing UUIDs', async () => {
    mockFetch(phaseRoutes([{
      id: 'binding-1', action: 'UPDATE', targetModule: 'REPOSITORY',
      targetLabel: '1HRDF', route: '/repository?assetId=asset-1', architectureState: 'CURRENT',
      timestamp: '2026-09-18T12:00:00.000Z', status: 'COMPLETED',
    }]));
    await openPhaseOne();
    fireEvent.click(screen.getByText('EA Cycle Charter'));
    expect(await screen.findByText('Architecture Impact Activity')).toBeInTheDocument();
    expect(screen.getByText('1HRDF')).toBeInTheDocument();
    expect(screen.queryByText('asset-1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('1HRDF'));
    expect(mockNavigate).toHaveBeenCalledWith('/repository?assetId=asset-1');
  });

  it('shows deterministic scope review warnings on downstream outputs', async () => {
    mockFetch(phaseRoutes());
    await openPhaseOne();
    fireEvent.click(screen.getByText('EA Cycle Charter'));
    expect(await screen.findByText('Scope Alignment: Review Required')).toBeInTheDocument();
    expect(screen.getByText(/Explicit constraint requires review/)).toBeInTheDocument();
  });
});

describe('AdmPage - CreateModal', () => {
  it('opens the create modal when the New button is clicked', async () => {
    mockFetch({ '/adm/cycles': [] });
    render(<AdmPage />);
    await screen.findByText('adm.no_cycles');
    fireEvent.click(screen.getByText('adm.new'));
    expect(await screen.findByText('adm.modal_title')).toBeInTheDocument();
  });

  it('closes the modal without creating anything when the overlay is clicked', async () => {
    mockFetch({ '/adm/cycles': [] });
    render(<AdmPage />);
    await screen.findByText('adm.no_cycles');
    fireEvent.click(screen.getByText('adm.new'));
    await screen.findByText('adm.modal_title');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(document.querySelector('.modal-overlay')!);
    await waitFor(() => expect(screen.queryByText('adm.modal_title')).not.toBeInTheDocument());
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
  });

  it('submits the correct payload including the selected framework type', async () => {
    mockFetch({ '/adm/cycles': [] });
    render(<AdmPage />);
    await screen.findByText('adm.no_cycles');
    fireEvent.click(screen.getByText('adm.new'));
    await screen.findByText('adm.modal_title');

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'New ADM Cycle' } });
    const createButtons = screen.getAllByText('common.create');
    fireEvent.click(createButtons[createButtons.length - 1]); // the modal's submit button, not the empty-state shortcut behind it

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.name).toBe('New ADM Cycle');
      expect(body.frameworkType).toBe('NORA');
    });
  });
});
