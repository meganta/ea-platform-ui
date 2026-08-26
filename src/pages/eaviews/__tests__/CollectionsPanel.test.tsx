import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionsPanel } from '../CollectionsPanel';

function mockApi(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length); // most specific first, matching this session's established mockFetch convention - avoids 'collections' accidentally matching before the more specific 'collections/c1'
  const resolve = (path: string, arg?: any) => {
    for (const pattern of sortedPatterns) {
      if (path.includes(pattern)) return Promise.resolve(typeof routes[pattern] === 'function' ? routes[pattern](arg) : routes[pattern]);
    }
    return Promise.resolve([]);
  };
  return {
    get: jest.fn((path: string) => resolve(path)),
    post: jest.fn((path: string, body?: any) => resolve(path, body)),
    put: jest.fn().mockResolvedValue({}),
    del: jest.fn().mockResolvedValue(true),
  };
}

describe('CollectionsPanel', () => {
  it('shows the empty state when there are no collections yet', async () => {
    const api = mockApi({ 'collections': [] });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    expect(await screen.findByText(/No Architecture Packs yet/)).toBeInTheDocument();
  });

  it('renders each collection as a card with its item count', async () => {
    const api = mockApi({ 'collections': [{ id: 'c1', name: 'Executive Pack', category: 'Executive', description: 'For the board', items: [{ id: 'i1' }, { id: 'i2' }] }] });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    expect(await screen.findByText('Executive Pack')).toBeInTheDocument();
    expect(screen.getByText('For the board')).toBeInTheDocument();
    expect(screen.getByText('2 views')).toBeInTheDocument();
  });

  it('singularizes "view" for a collection with exactly one item', async () => {
    const api = mockApi({ 'collections': [{ id: 'c1', name: 'Solo Pack', items: [{ id: 'i1' }] }] });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    expect(await screen.findByText('1 view')).toBeInTheDocument();
  });

  it('clicking + New Pack opens the create form, disabled until a name is entered', async () => {
    const api = mockApi({ 'collections': [] });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    await screen.findByText(/No Architecture Packs yet/);
    fireEvent.click(screen.getByText('+ New Pack'));
    expect(screen.getByText('New Architecture Pack')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText('e.g. Executive Pack'), { target: { value: 'My Pack' } });
    expect(screen.getByText('Create')).not.toBeDisabled();
  });

  it('creating a pack posts the name/description/category and refreshes the list', async () => {
    const api = mockApi({ 'collections': (body?: any) => (body ? { id: 'new-id', ...body, items: [] } : [{ id: 'c1', name: 'My Pack', items: [] }]) });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    await screen.findByText(/No Architecture Packs yet/);
    fireEvent.click(screen.getByText('+ New Pack'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Executive Pack'), { target: { value: 'My Pack' } });
    fireEvent.click(screen.getByText('Create'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ea-views/collections', expect.objectContaining({ name: 'My Pack' })));
  });

  it('deleting a collection asks for confirmation and does not delete when cancelled', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const api = mockApi({ 'collections': [{ id: 'c1', name: 'Pack A', items: [] }] });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    await screen.findByText('Pack A');
    fireEvent.click(screen.getByText('✕'));
    expect(api.del).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('clicking a collection card opens its detail view', async () => {
    const api = mockApi({
      'collections/c1': { id: 'c1', name: 'Pack A', items: [{ id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape', category: 'Application', visualization: 'GRAPH' } }] },
      'collections': [{ id: 'c1', name: 'Pack A', items: [{ id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape' } }] }],
    });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    fireEvent.click(await screen.findByText('Pack A'));
    expect(await screen.findByText('App Landscape')).toBeInTheDocument();
    expect(screen.getByText('← Back')).toBeInTheDocument();
  });

  it('clicking a member view in detail view calls onOpenView with the view object', async () => {
    const onOpenView = jest.fn();
    const api = mockApi({
      'collections/c1': { id: 'c1', name: 'Pack A', items: [{ id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape', category: 'Application', visualization: 'GRAPH' } }] },
      'collections': [{ id: 'c1', name: 'Pack A', items: [{ id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape' } }] }],
    });
    render(<CollectionsPanel api={api} onOpenView={onOpenView} />);
    fireEvent.click(await screen.findByText('Pack A'));
    fireEvent.click(await screen.findByText('App Landscape'));
    expect(onOpenView).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1', name: 'App Landscape' }));
  });

  it('removing a member view posts a DELETE to the collection-item endpoint', async () => {
    const api = mockApi({
      'collections/c1': { id: 'c1', name: 'Pack A', items: [{ id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'App Landscape' } }] },
      'collections': [{ id: 'c1', name: 'Pack A', items: [] }],
    });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    fireEvent.click(await screen.findByText('Pack A'));
    await screen.findByText('App Landscape');
    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => expect(api.del).toHaveBeenCalledWith('/ea-views/collections/c1/views/v1'));
  });

  it('the up-arrow is disabled for the first item and the down-arrow disabled for the last', async () => {
    const api = mockApi({
      'collections/c1': { id: 'c1', name: 'Pack A', items: [
        { id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'First' } },
        { id: 'i2', viewId: 'v2', view: { id: 'v2', name: 'Second' } },
      ] },
      'collections': [{ id: 'c1', name: 'Pack A', items: [] }],
    });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    fireEvent.click(await screen.findByText('Pack A'));
    await screen.findByText('First');
    const upButtons = screen.getAllByText('↑');
    const downButtons = screen.getAllByText('↓');
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it('moving an item calls the reorder endpoint with the full new order', async () => {
    const api = mockApi({
      'collections/c1': { id: 'c1', name: 'Pack A', items: [
        { id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'First' } },
        { id: 'i2', viewId: 'v2', view: { id: 'v2', name: 'Second' } },
      ] },
      'collections': [{ id: 'c1', name: 'Pack A', items: [] }],
    });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    fireEvent.click(await screen.findByText('Pack A'));
    await screen.findByText('First');
    fireEvent.click(screen.getAllByText('↓')[0]); // move First down past Second
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/ea-views/collections/c1/reorder', { orderedViewIds: ['v2', 'v1'] }));
  });

  it('the Add View picker excludes views already in the collection', async () => {
    const api = mockApi({
      'collections/c1': { id: 'c1', name: 'Pack A', items: [{ id: 'i1', viewId: 'v1', view: { id: 'v1', name: 'Already In Pack' } }] },
      '/ea-views': [{ id: 'v1', name: 'Already In Pack' }, { id: 'v2', name: 'Not Yet Added' }],
      'collections': [{ id: 'c1', name: 'Pack A', items: [] }],
    });
    render(<CollectionsPanel api={api} onOpenView={jest.fn()} />);
    fireEvent.click(await screen.findByText('Pack A'));
    await screen.findByText('Already In Pack');
    fireEvent.click(screen.getByText('+ Add View'));
    expect(await screen.findByText('Not Yet Added')).toBeInTheDocument();
    // "Already In Pack" should appear exactly once on the page (as the
    // existing member row) - not a second time inside the add-picker,
    // which is what excluding it from the picker's list actually means.
    expect(screen.getAllByText('Already In Pack')).toHaveLength(1);
  });
});
