import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SetupAssistantPage from '../SetupAssistantPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ isAR: false, t: (key: string) => key, setLocale: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('ea_token', 'fake-token');
  // Suppress jsdom's "Not implemented: navigation" noise from window.location.href assignment
  jest.spyOn(window, 'location', 'get').mockReturnValue({ href: '' } as any);
});

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string) => {
    for (const pattern of sortedPatterns) {
      if (url.includes(pattern)) return Promise.resolve({ ok: true, json: () => Promise.resolve(routes[pattern]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

describe('SetupAssistantPage - step navigation', () => {
  it('starts on step 1 by default when the profile has no prior progress', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {} });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('resumes at the saved setupStep from the profile, not always step 1', async () => {
    mockFetch({ '/setup/profile': { setupStep: 3, setupCompleted: false }, '/config': {} });
    render(<SetupAssistantPage />);
    expect(await screen.findByText('Step 3 of 5')).toBeInTheDocument();
  });

  it('caps the resumed step at the total number of steps, even if the server returns something higher', async () => {
    mockFetch({ '/setup/profile': { setupStep: 99, setupCompleted: false }, '/config': {} });
    render(<SetupAssistantPage />);
    expect(await screen.findByText('Step 5 of 5')).toBeInTheDocument();
  });

  it('does not auto-resume mid-flow when the profile is already marked complete - stays on step 1 and shows the complete badge', async () => {
    mockFetch({ '/setup/profile': { setupStep: 4, setupCompleted: true }, '/config': {} });
    render(<SetupAssistantPage />);
    expect(await screen.findByText('✓ Setup Complete')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
  });

  it('navigates directly to a step when its indicator is clicked', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {}, '/setup/readiness': { overall: 50 } });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Readiness Score'));
    expect(await screen.findByText('Step 4 of 5')).toBeInTheDocument();
  });
});

describe('SetupAssistantPage - Step4Readiness', () => {
  it('displays the overall readiness score', async () => {
    mockFetch({
      '/setup/profile': {}, '/config': {},
      '/setup/readiness': { overall: 72, kbReadiness: { score: 80, label: 'ready' }, repoReadiness: { score: 60, label: 'partial' }, admReadiness: { score: 40, label: 'starting' }, governanceReadiness: { score: 90, label: 'ready' } },
    });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Readiness Score'));
    expect(await screen.findByText('72%')).toBeInTheDocument();
  });

  it('shows 0% gracefully when the readiness data has not loaded any scores', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {}, '/setup/readiness': {} });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Readiness Score'));
    // Every ring (overall + 4 sub-scores) defaults to 0% when no data loaded
    await waitFor(() => expect(screen.getAllByText('0%').length).toBeGreaterThan(0));
  });

  it('advances to step 5 when the next-steps button is clicked', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {}, '/setup/readiness': { overall: 50 }, '/setup/actions': { actions: [] } });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Readiness Score'));
    await waitFor(() => expect(screen.getAllByText('50%').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText(/الخطوات التالية/));
    expect(await screen.findByText('Step 5 of 5')).toBeInTheDocument();
  });
});

describe('SetupAssistantPage - Step5Actions', () => {
  it('lists suggested next actions with a navigation button for each', async () => {
    mockFetch({
      '/setup/profile': {}, '/config': {},
      '/setup/actions': { actions: [{ icon: '📚', titleAr: 'رفع مستندات', titleEn: 'Upload documents', type: 'UPLOAD_KB' }] },
    });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Next Actions'));
    expect(await screen.findByText('Upload documents')).toBeInTheDocument();
  });

  it('shows a ready-to-go message when there are no suggested actions', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {}, '/setup/actions': { actions: [] } });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Next Actions'));
    expect(await screen.findByText(/يمكنك البدء بأول دورة ADM/)).toBeInTheDocument();
  });

  it('completing setup calls the complete endpoint', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {}, '/setup/actions': { actions: [] }, '/setup/complete': {} });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Next Actions'));
    await screen.findByText(/يمكنك البدء بأول دورة ADM/);
    fireEvent.click(screen.getByText(/إتمام الإعداد/));

    await waitFor(() => {
      const completeCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/setup/complete'));
      expect(completeCall).toBeDefined();
      expect(completeCall[1].method).toBe('PUT');
    });
  });

  it('calls onClose instead of redirecting when running as a modal', async () => {
    const onClose = jest.fn();
    mockFetch({ '/setup/profile': {}, '/config': {}, '/setup/actions': { actions: [] }, '/setup/complete': {} });
    render(<SetupAssistantPage modal onClose={onClose} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Next Actions'));
    await screen.findByText(/يمكنك البدء بأول دورة ADM/);
    fireEvent.click(screen.getByText(/إتمام الإعداد/));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows the close button only when running as a modal', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {} });
    render(<SetupAssistantPage modal onClose={jest.fn()} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('does not show a close button in standalone (non-modal) mode', async () => {
    mockFetch({ '/setup/profile': {}, '/config': {} });
    render(<SetupAssistantPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('✕')).not.toBeInTheDocument();
  });
});
