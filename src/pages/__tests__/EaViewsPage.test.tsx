import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EaViewsPage from '../EaViewsPage';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length); // most specific first
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

describe('EaViewsPage - tab navigation', () => {
  it('starts on the Dashboard tab', async () => {
    mockFetch({ '/ea-views/stats': {} });
    render(<EaViewsPage />);
    expect(await screen.findByText('🗺 EA Views & Viewpoints Studio')).toBeInTheDocument();
  });

  it('hides the tab strip while in the builder or viewer sub-views', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'My View', category: 'BUSINESS' }] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    fireEvent.click(await screen.findByText('My View'));
    await waitFor(() => expect(screen.queryByText('🏠 Dashboard')).not.toBeInTheDocument());
  });
});

describe('EaViewsPage - ViewLibrary', () => {
  const SAMPLE_VIEWPOINT = { id: 'vp1', name: 'Application Landscape', category: 'APPLICATION', description: 'Shows all applications', defaultVisualization: 'GRAPH' };

  it('lists predefined viewpoints and seeds the library on load', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    expect(await screen.findByText('Application Landscape')).toBeInTheDocument();
    await waitFor(() => {
      const seedCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/viewpoints/seed'));
      expect(seedCall).toBeDefined();
    });
  });

  it('filters viewpoints by category', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [
      { id: 'vp1', name: 'App View', category: 'APPLICATION', description: 'x' },
      { id: 'vp2', name: 'Business View', category: 'BUSINESS', description: 'y' },
    ]});
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('App View');
    fireEvent.click(screen.getByRole('button', { name: 'BUSINESS' }));
    expect(screen.getByText('Business View')).toBeInTheDocument();
    expect(screen.queryByText('App View')).not.toBeInTheDocument();
  });

  it('navigates to the builder with the selected viewpoint when Activate View is clicked', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views/viewpoints': [SAMPLE_VIEWPOINT] });
    render(<EaViewsPage />);
    fireEvent.click(await screen.findByText('📚 View Library'));
    await screen.findByText('Application Landscape');
    fireEvent.click(screen.getByText('▶ Activate View'));
    // Builder view hides the tab strip
    await waitFor(() => expect(screen.queryByText('🏠 Dashboard')).not.toBeInTheDocument());
  });
});

describe('EaViewsPage - MyViews', () => {
  const SAMPLE_VIEW = { id: 'v1', name: 'Payments Landscape', category: 'APPLICATION', status: 'PUBLISHED', architectureState: 'CURRENT', viewCount: 12, isFavorite: false };

  it('lists saved views with their metadata badges', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    expect(await screen.findByText('Payments Landscape')).toBeInTheDocument();
    expect(screen.getByText('PUBLISHED')).toBeInTheDocument();
  });

  it('shows the empty state pointing to the View Library when there are no views', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    expect(await screen.findByText(/No views yet/)).toBeInTheDocument();
  });

  it('filters to favorites only when the Favorites toggle is clicked', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [
      { ...SAMPLE_VIEW, id: 'v1', name: 'Favorited View', isFavorite: true },
      { ...SAMPLE_VIEW, id: 'v2', name: 'Regular View', isFavorite: false },
    ]});
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Favorited View');
    fireEvent.click(screen.getByText('⭐ Favorites'));
    expect(screen.getByText('Favorited View')).toBeInTheDocument();
    expect(screen.queryByText('Regular View')).not.toBeInTheDocument();
  });

  it('toggling favorite does not also open the view (event propagation is stopped)', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    const favButtons = screen.getAllByText('⭐');
    fireEvent.click(favButtons[favButtons.length - 1]);
    // Still on my-views (tab strip visible), not navigated into the viewer
    await waitFor(() => expect(screen.getByText('🏠 Dashboard')).toBeInTheDocument());
  });

  it('POSTs to the favorite endpoint for the correct view id', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    fireEvent.click(screen.getAllByText('⭐').pop()!);
    await waitFor(() => {
      const favCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/ea-views/v1/favorite'));
      expect(favCall).toBeDefined();
      expect(favCall[1].method).toBe('POST');
    });
  });

  it('does not delete when the user cancels the confirmation dialog', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [SAMPLE_VIEW] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📋 My Views').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📋 My Views')[0]);
    await screen.findByText('Payments Landscape');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('✕'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });
});

describe('EaViewsPage - SnapshotsPanel', () => {
  it('does not fetch snapshots until a view is selected', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'View A' }] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📸 Snapshots').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📸 Snapshots')[0]);
    await screen.findByText('Select View');
    const snapshotCalls = (global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/snapshots'));
    expect(snapshotCalls).toHaveLength(0);
  });

  it('loads and displays snapshots once a view is selected', async () => {
    mockFetch({
      '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'View A' }],
      '/ea-views/v1/snapshots': [{ id: 's1', name: 'Q1 2026 Snapshot', objectCount: 50, relationshipCount: 30, takenAt: '2026-01-01T00:00:00Z', architectureState: 'CURRENT' }],
    });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📸 Snapshots').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📸 Snapshots')[0]);
    await screen.findByText('Select View');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v1' } });
    expect(await screen.findByText('Q1 2026 Snapshot')).toBeInTheDocument();
  });

  it('shows a view-specific empty message when a view has no snapshots yet', async () => {
    mockFetch({ '/ea-views/stats': {}, '/ea-views': [{ id: 'v1', name: 'View A' }], '/ea-views/v1/snapshots': [] });
    render(<EaViewsPage />);
    await waitFor(() => expect(screen.getAllByText('📸 Snapshots').length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText('📸 Snapshots')[0]);
    await screen.findByText('Select View');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'v1' } });
    expect(await screen.findByText(/No snapshots for this view yet/)).toBeInTheDocument();
  });
});
