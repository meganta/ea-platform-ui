import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PathBuilder } from '../PathBuilder';

function mockApi(routes: Record<string, any>) {
  return {
    get: jest.fn((path: string) => {
      for (const pattern of Object.keys(routes)) {
        if (path.includes(pattern)) return Promise.resolve(routes[pattern]);
      }
      return Promise.resolve([]);
    }),
  };
}

describe('PathBuilder', () => {
  it('shows a placeholder instead of fetching anything when no root type is selected yet', () => {
    const api = mockApi({});
    render(<PathBuilder api={api} rootType="" initialPath={[]} onChange={jest.fn()} />);
    expect(screen.getByText(/Select a root object type first/)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('fetches relationship options for the root type on mount', async () => {
    const api = mockApi({ 'relationship-options': [] });
    render(<PathBuilder api={api} rootType="GovCapability" initialPath={[]} onChange={jest.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('sourceType=GovCapability')));
    // Also wait for the fetch's resolution to actually land (setOptions/
    // setLoading), not just confirm the call happened - otherwise this
    // test returns while that resolution is still pending, and it fires
    // in a later tick with no act() wrapping around it anymore.
    expect(await screen.findByText(/No relationships found from this object type/)).toBeInTheDocument();
  });

  it('shows the empty state when no relationship options exist for this type yet', async () => {
    const api = mockApi({ 'relationship-options': [] });
    render(<PathBuilder api={api} rootType="GovCapability" initialPath={[]} onChange={jest.fn()} />);
    expect(await screen.findByText(/No relationships found from this object type/)).toBeInTheDocument();
  });

  it('renders each option with its direction arrow, label, target type, and sample count', async () => {
    const api = mockApi({
      'relationship-options': [{ relationshipType: 'uses', direction: 'FORWARD', targetAssetType: 'ITComponent', targetTypeName: 'IT Component', label: 'uses', sampleCount: 12 }],
    });
    render(<PathBuilder api={api} rootType="Application" initialPath={[]} onChange={jest.fn()} />);
    expect(await screen.findByText('→ uses')).toBeInTheDocument();
    expect(screen.getByText('IT Component (12)')).toBeInTheDocument();
  });

  it('renders a REVERSE-direction option with a left arrow', async () => {
    const api = mockApi({
      'relationship-options': [{ relationshipType: 'owns', direction: 'REVERSE', targetAssetType: 'OrganisationUnit', targetTypeName: 'Organisation Unit', label: 'owned by', sampleCount: 3 }],
    });
    render(<PathBuilder api={api} rootType="GovCapability" initialPath={[]} onChange={jest.fn()} />);
    expect(await screen.findByText('← owned by')).toBeInTheDocument();
  });

  it('clicking an option adds it as a hop, updates the breadcrumb, and calls onChange with the full path', async () => {
    const onChange = jest.fn();
    const api = mockApi({
      'relationship-options': [{ relationshipType: 'uses', direction: 'FORWARD', targetAssetType: 'ITComponent', targetTypeName: 'IT Component', label: 'uses', sampleCount: 12 }],
    });
    render(<PathBuilder api={api} rootType="Application" initialPath={[]} onChange={onChange} />);
    fireEvent.click(await screen.findByText('→ uses'));
    expect(onChange).toHaveBeenCalledWith([{ relationshipType: 'uses', direction: 'FORWARD', targetAssetType: 'ITComponent', label: 'uses', targetTypeName: 'IT Component' }]);
    // The breadcrumb badge below updates synchronously from the click (no
    // async wait needed for it specifically), but the click also changes
    // currentType, which re-triggers the options effect for the new type -
    // wait for that to actually resolve too, or it settles after this test
    // has already returned (same reasoning as the mount test above).
    expect(await screen.findByText('IT Component')).toBeInTheDocument(); // breadcrumb badge, not just the option button
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('sourceType=ITComponent')));
  });

  it('fetches the next hop\'s options scoped to the newly-added target type, not the original root', async () => {
    const api = mockApi({
      'sourceType=Application': [{ relationshipType: 'uses', direction: 'FORWARD', targetAssetType: 'ITComponent', targetTypeName: 'IT Component', label: 'uses', sampleCount: 12 }],
      'sourceType=ITComponent': [{ relationshipType: 'runs on', direction: 'FORWARD', targetAssetType: 'TechPlatform', targetTypeName: 'Technology Platform', label: 'runs on', sampleCount: 4 }],
    });
    render(<PathBuilder api={api} rootType="Application" initialPath={[]} onChange={jest.fn()} />);
    fireEvent.click(await screen.findByText('→ uses'));
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('sourceType=ITComponent')));
    expect(await screen.findByText('→ runs on')).toBeInTheDocument();
  });

  it('removing an earlier step truncates the path from that point on and re-notifies via onChange', async () => {
    const onChange = jest.fn();
    const api = mockApi({ 'relationship-options': [] });
    const initialPath = [
      { relationshipType: 'uses', direction: 'FORWARD' as const, targetAssetType: 'ITComponent', label: 'uses', targetTypeName: 'IT Component' },
      { relationshipType: 'runs on', direction: 'FORWARD' as const, targetAssetType: 'TechPlatform', label: 'runs on', targetTypeName: 'Technology Platform' },
    ];
    render(<PathBuilder api={api} rootType="Application" initialPath={initialPath} onChange={onChange} />);
    await screen.findByText('IT Component');
    const removeButtons = screen.getAllByText('✕');
    fireEvent.click(removeButtons[0]); // remove from the first hop onward
    expect(onChange).toHaveBeenCalledWith([]);
    // Truncating the path changes currentType back to the root type,
    // re-triggering the options fetch - wait for that to actually
    // resolve (see the mount test's comment above for why this matters).
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('sourceType=Application')));
    expect(await screen.findByText(/No relationships found from this object type/)).toBeInTheDocument();
  });

  it('shows the single-level placeholder message when the path is empty', async () => {
    const api = mockApi({ 'relationship-options': [] });
    render(<PathBuilder api={api} rootType="Application" initialPath={[]} onChange={jest.fn()} />);
    expect(screen.getByText(/single-level view/)).toBeInTheDocument();
    // The synchronous assertion above doesn't depend on the mount effect's
    // fetch resolving (path.length===0 is already known at render time),
    // but the fetch still fires and this test would otherwise return
    // before it settles - same reasoning as the mount test above.
    expect(await screen.findByText(/No relationships found from this object type/)).toBeInTheDocument();
  });

  it('caps the path at 6 hops and shows a max-depth message instead of more options', async () => {
    const api = mockApi({ 'relationship-options': [{ relationshipType: 'x', direction: 'FORWARD', targetAssetType: 'Y', label: 'x', sampleCount: 1 }] });
    const sixHopPath = Array.from({ length: 6 }, (_, i) => ({ relationshipType: `hop${i}`, direction: 'FORWARD' as const, targetAssetType: `Type${i}`, label: `hop${i}`, targetTypeName: `Type${i}` }));
    render(<PathBuilder api={api} rootType="Application" initialPath={sixHopPath} onChange={jest.fn()} />);
    // "Maximum path depth reached" renders synchronously from
    // path.length >= 6, independent of the mount effect's fetch - but
    // that fetch still fires (based on currentType, regardless of what
    // path.length gates in the UI) and needs to be awaited too, or it
    // settles after this test has already returned.
    expect(await screen.findByText(/Maximum path depth reached/)).toBeInTheDocument();
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('sourceType=Type5')));
  });
});
