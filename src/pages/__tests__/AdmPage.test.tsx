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
