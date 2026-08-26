import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttachedViewsPanel } from '../AttachedViewsPanel';

const API_URL = 'https://fake-api.test';
const token = () => 'fake-token';

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

describe('AttachedViewsPanel', () => {
  it('shows the empty state when there are no attachments yet', async () => {
    mockFetch({ '/attached-views': [] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    expect(await screen.findByText('No architecture views attached yet.')).toBeInTheDocument();
  });

  it('renders an attached live view with a "Live" badge and its note', async () => {
    mockFetch({ '/attached-views': [{ id: 'att-1', viewId: 'v1', note: 'Current state for reference', view: { id: 'v1', name: 'App Landscape' } }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    expect(await screen.findByText('App Landscape')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Current state for reference')).toBeInTheDocument();
  });

  it('renders an attached snapshot with a "Snapshot" badge instead of "Live"', async () => {
    mockFetch({ '/attached-views': [{ id: 'att-1', snapshotId: 's1', snapshot: { id: 's1', name: 'Q1 2026 Snapshot' } }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    expect(await screen.findByText('Q1 2026 Snapshot')).toBeInTheDocument();
    expect(screen.getByText('Snapshot')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('shows "(deleted)" for an attachment whose referenced view/snapshot no longer exists, rather than crashing', async () => {
    mockFetch({ '/attached-views': [{ id: 'att-1', viewId: 'v1', view: null }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    expect(await screen.findByText('(deleted)')).toBeInTheDocument();
  });

  it('clicking "Attach View" fetches the available views and opens the picker', async () => {
    mockFetch({ '/attached-views': [], '/ea-views': [{ id: 'v1', name: 'App Landscape' }, { id: 'v2', name: 'Data Landscape' }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    await screen.findByText('No architecture views attached yet.');
    fireEvent.click(screen.getByText('+ Attach View'));
    expect(await screen.findByText('Select a view...')).toBeInTheDocument();
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].endsWith('/ea-views'));
      expect(call).toBeDefined();
    });
  });

  it('the Attach button is disabled until a view is selected', async () => {
    mockFetch({ '/attached-views': [], '/ea-views': [{ id: 'v1', name: 'App Landscape' }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    await screen.findByText('No architecture views attached yet.');
    fireEvent.click(screen.getByText('+ Attach View'));
    await screen.findByText('Select a view...');
    expect(screen.getByText('Attach')).toBeDisabled();
  });

  it('attaching posts the selected view and note, closes the picker, and refreshes the list', async () => {
    let attached = false; // tracks whether the POST has happened yet, so the mock GET response differs before/after - the initial load must be empty (matching the "no attachments yet" state the test starts from), only the POST-triggered reload should return the newly attached item
    mockFetch({
      '/ea-views': [{ id: 'v1', name: 'App Landscape' }],
      '/attached-views': (opts: any) => {
        if (opts?.method === 'POST') { attached = true; return {}; }
        return attached ? [{ id: 'att-1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape' }, note: 'For reference' }] : [];
      },
    });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    await screen.findByText('No architecture views attached yet.');
    fireEvent.click(screen.getByText('+ Attach View'));
    await screen.findByText('Select a view...');
    fireEvent.change(screen.getByText('Select a view...').closest('select')!, { target: { value: 'v1' } });
    fireEvent.change(screen.getByPlaceholderText('Optional note'), { target: { value: 'For reference' } });
    fireEvent.click(screen.getByText('Attach'));
    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body)).toEqual({ viewId: 'v1', note: 'For reference' });
    });
    expect(await screen.findByText('App Landscape')).toBeInTheDocument();
    expect(screen.queryByText('Select a view...')).not.toBeInTheDocument(); // picker closed
  });

  it('removing an attachment asks for confirmation and does not call DELETE when cancelled', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    mockFetch({ '/attached-views': [{ id: 'att-1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape' } }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    await screen.findByText('App Landscape');
    fireEvent.click(screen.getByText('Remove'));
    const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
    expect(deleteCall).toBeUndefined();
    confirmSpy.mockRestore();
  });

  it('removing an attachment after confirming calls DELETE on the specific attachment and refreshes', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch({ '/attached-views': [{ id: 'att-1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape' } }] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={false} />);
    await screen.findByText('App Landscape');
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('/attached-views/att-1');
    });
    confirmSpy.mockRestore();
  });

  it('renders in Arabic when isAR is true', async () => {
    mockFetch({ '/attached-views': [] });
    render(<AttachedViewsPanel reviewId="review-1" apiUrl={API_URL} token={token} isAR={true} />);
    expect(await screen.findByText('لا توجد عروض مرفقة بعد.')).toBeInTheDocument();
    expect(screen.getByText(/إرفاق عرض/)).toBeInTheDocument();
  });
});
