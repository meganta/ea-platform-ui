import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoadmapConfigPanel, RoadmapTimeline } from '../RoadmapView';

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

describe('RoadmapConfigPanel', () => {
  it('fetches available date fields for the given asset type on mount', async () => {
    const api = mockApi({ 'date-fields': [] });
    render(<RoadmapConfigPanel api={api} assetType="TechProject" initial={{}} onSave={jest.fn()} onCancel={jest.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining('assetType=TechProject')));
  });

  it('shows a clear "no date fields" message with a way back, rather than a broken empty form', async () => {
    const api = mockApi({ 'date-fields': [] });
    const onCancel = jest.fn();
    render(<RoadmapConfigPanel api={api} assetType="TechProject" initial={{}} onSave={jest.fn()} onCancel={onCancel} />);
    expect(await screen.findByText(/No date fields found on TechProject/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Back'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('populates the start/end field dropdowns from the fetched fields', async () => {
    const api = mockApi({ 'date-fields': [{ code: 'startDate', name: 'Start Date' }, { code: 'endDate', name: 'End Date' }] });
    render(<RoadmapConfigPanel api={api} assetType="TechProject" initial={{}} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(await screen.findByText('Configure Roadmap Timeline')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
    expect(screen.getAllByText('Start Date').length).toBeGreaterThan(0);
    expect(screen.getAllByText('End Date').length).toBeGreaterThan(0);
  });

  it('disables Save until both start and end fields are chosen', async () => {
    const api = mockApi({ 'date-fields': [{ code: 'startDate', name: 'Start Date' }, { code: 'endDate', name: 'End Date' }] });
    render(<RoadmapConfigPanel api={api} assetType="TechProject" initial={{}} onSave={jest.fn()} onCancel={jest.fn()} />);
    await screen.findByText('Configure Roadmap Timeline');
    const saveBtn = screen.getByText('Save & Build Timeline');
    expect(saveBtn).toBeDisabled();
  });

  it('calls onSave with the selected start/end/groupBy fields once both are chosen', async () => {
    const api = mockApi({ 'date-fields': [{ code: 'startDate', name: 'Start Date' }, { code: 'endDate', name: 'End Date' }] });
    const onSave = jest.fn();
    render(<RoadmapConfigPanel api={api} assetType="TechProject" initial={{}} onSave={onSave} onCancel={jest.fn()} />);
    await screen.findByText('Configure Roadmap Timeline');
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'startDate' } });
    fireEvent.change(selects[1], { target: { value: 'endDate' } });
    fireEvent.change(screen.getByPlaceholderText(/Leave blank to group/), { target: { value: 'theme' } });
    fireEvent.click(screen.getByText('Save & Build Timeline'));
    expect(onSave).toHaveBeenCalledWith({ startField: 'startDate', endField: 'endDate', groupByField: 'theme' });
  });

  it('pre-fills the dropdowns from an already-configured view (editing an existing roadmap)', async () => {
    const api = mockApi({ 'date-fields': [{ code: 'startDate', name: 'Start Date' }, { code: 'endDate', name: 'End Date' }] });
    render(<RoadmapConfigPanel api={api} assetType="TechProject" initial={{ startField: 'startDate', endField: 'endDate' }} onSave={jest.fn()} onCancel={jest.fn()} />);
    await screen.findByText('Configure Roadmap Timeline');
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    expect(selects[0].value).toBe('startDate');
    expect(selects[1].value).toBe('endDate');
  });
});

describe('RoadmapTimeline', () => {
  it('shows an empty-state message when no items have any date at all', () => {
    render(<RoadmapTimeline items={[{ id: '1', name: 'No Dates', start: null, end: null, group: 'PMO', status: 'DRAFT', assetType: 'TechProject' }]} />);
    expect(screen.getByText(/No items with a start or end date/)).toBeInTheDocument();
  });

  it('renders a group row and a bar for each dated item', () => {
    render(<RoadmapTimeline items={[
      { id: '1', name: 'Phase 1', start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z', group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' },
      { id: '2', name: 'Phase 2', start: '2026-03-01T00:00:00Z', end: '2026-06-01T00:00:00Z', group: 'PMO', status: 'PLANNED', assetType: 'TechProject' },
    ]} />);
    expect(screen.getByText('PMO')).toBeInTheDocument();
    expect(screen.getByText('Phase 1')).toBeInTheDocument();
    expect(screen.getByText('Phase 2')).toBeInTheDocument();
  });

  it('groups items into separate rows by their group field', () => {
    render(<RoadmapTimeline items={[
      { id: '1', name: 'PMO Item', start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z', group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' },
      { id: '2', name: 'IT Item', start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z', group: 'IT', status: 'ACTIVE', assetType: 'TechProject' },
    ]} />);
    expect(screen.getByText('PMO')).toBeInTheDocument();
    expect(screen.getByText('IT')).toBeInTheDocument();
  });

  it('calls onSelect with the item when its bar is clicked', () => {
    const onSelect = jest.fn();
    render(<RoadmapTimeline items={[{ id: '1', name: 'Phase 1', start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z', group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' }]} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Phase 1'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '1', name: 'Phase 1' }));
  });

  it('handles an item with only a start date (no end) without crashing', () => {
    render(<RoadmapTimeline items={[{ id: '1', name: 'Milestone', start: '2026-01-01T00:00:00Z', end: null, group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' }]} />);
    expect(screen.getByText('Milestone')).toBeInTheDocument();
  });

  it('handles an item with only an end date (no start) without crashing', () => {
    render(<RoadmapTimeline items={[{ id: '1', name: 'Deadline', start: null, end: '2026-06-01T00:00:00Z', group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' }]} />);
    expect(screen.getByText('Deadline')).toBeInTheDocument();
  });

  it('supports zooming the timeline in and out', () => {
    render(<RoadmapTimeline items={[{ id: '1', name: 'Phase 1', start: '2026-01-01T00:00:00Z', end: '2026-03-01T00:00:00Z', group: 'PMO', status: 'ACTIVE', assetType: 'TechProject' }]} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    fireEvent.click(screen.getByText('+'));
    expect(screen.getByText('130%')).toBeInTheDocument();
    fireEvent.click(screen.getByText('−'));
    fireEvent.click(screen.getByText('−'));
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});
