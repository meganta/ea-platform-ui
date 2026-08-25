import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardBuilder, DashboardGrid } from '../DashboardBuilder';

describe('DashboardBuilder', () => {
  it('shows an empty-state prompt when there are no widgets yet', () => {
    render(<DashboardBuilder widgets={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText(/No widgets yet/)).toBeInTheDocument();
    expect(screen.getByText('Dashboard Widgets (0)')).toBeInTheDocument();
  });

  it('clicking + Add Widget opens the type picker with all 6 widget types', () => {
    render(<DashboardBuilder widgets={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Add Widget'));
    expect(screen.getByText('Choose Widget Type')).toBeInTheDocument();
    for (const label of ['KPI Tile', 'Table', 'Matrix', 'Heatmap', 'Graph Summary', 'Roadmap']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('picking KPI Tile opens its config form, and Save Widget is disabled until a title is entered', () => {
    render(<DashboardBuilder widgets={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Add Widget'));
    fireEvent.click(screen.getByText('KPI Tile'));
    expect(screen.getByText('Add KPI Tile')).toBeInTheDocument();
    expect(screen.getByText('Save Widget')).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Total Critical Applications/), { target: { value: 'My KPI' } });
    expect(screen.getByText('Save Widget')).not.toBeDisabled();
  });

  it('saving a configured widget adds it to the list, shown with its type and size', () => {
    render(<DashboardBuilder widgets={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Add Widget'));
    fireEvent.click(screen.getByText('KPI Tile'));
    fireEvent.change(screen.getByPlaceholderText(/Total Critical Applications/), { target: { value: 'My KPI' } });
    fireEvent.click(screen.getByText('Save Widget'));
    expect(screen.getByText('My KPI')).toBeInTheDocument();
    expect(screen.getByText(/KPI Tile · 1x1/)).toBeInTheDocument();
  });

  it('the matrix widget type shows row/column object type pickers instead of the generic object-type checklist', () => {
    render(<DashboardBuilder widgets={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Add Widget'));
    fireEvent.click(screen.getByText('Matrix'));
    expect(screen.getByText('Row Object Type (source)')).toBeInTheDocument();
    expect(screen.getByText('Column Object Type (target)')).toBeInTheDocument();
  });

  it('the roadmap widget type shows start/end field inputs', () => {
    render(<DashboardBuilder widgets={[]} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('+ Add Widget'));
    fireEvent.click(screen.getByText('Roadmap'));
    expect(screen.getByPlaceholderText('e.g. StartDate')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. EndDate')).toBeInTheDocument();
  });

  it('removing a widget takes it out of the list', () => {
    const existing = [{ id: 'w1', type: 'kpi' as const, title: 'Existing KPI', x: 0, y: 0, w: 1, h: 1, config: {} }];
    render(<DashboardBuilder widgets={existing} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Existing KPI')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove'));
    expect(screen.queryByText('Existing KPI')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard Widgets (0)')).toBeInTheDocument();
  });

  it('moving a widget down swaps its order with the next one', () => {
    const existing = [
      { id: 'w1', type: 'kpi' as const, title: 'First', x: 0, y: 0, w: 1, h: 1, config: {} },
      { id: 'w2', type: 'kpi' as const, title: 'Second', x: 0, y: 1, w: 1, h: 1, config: {} },
    ];
    render(<DashboardBuilder widgets={existing} onSave={jest.fn()} onCancel={jest.fn()} />);
    const rows = screen.getAllByText(/First|Second/);
    expect(rows[0].textContent).toBe('First');
    fireEvent.click(screen.getAllByText('↓')[0]); // move "First" down
    const rowsAfter = screen.getAllByText(/First|Second/);
    expect(rowsAfter[0].textContent).toBe('Second');
  });

  it('the up-arrow is disabled for the first widget and the down-arrow disabled for the last', () => {
    const existing = [
      { id: 'w1', type: 'kpi' as const, title: 'Only One', x: 0, y: 0, w: 1, h: 1, config: {} },
    ];
    render(<DashboardBuilder widgets={existing} onSave={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('↑')).toBeDisabled();
    expect(screen.getByText('↓')).toBeDisabled();
  });

  it('editing an existing widget pre-fills the form and updates it in place rather than duplicating it', () => {
    const existing = [{ id: 'w1', type: 'kpi' as const, title: 'Original Title', x: 0, y: 0, w: 1, h: 1, config: { assetTypes: ['APPLICATION'] } }];
    render(<DashboardBuilder widgets={existing} onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Edit'));
    const titleInput = screen.getByDisplayValue('Original Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByText('Save Widget'));
    expect(screen.getByText('Updated Title')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Widgets (1)')).toBeInTheDocument(); // not (2) - updated, not duplicated
  });

  it('calls onSave with the full widget list when Save Dashboard is clicked', () => {
    const onSave = jest.fn();
    const existing = [{ id: 'w1', type: 'kpi' as const, title: 'A KPI', x: 0, y: 0, w: 1, h: 1, config: {} }];
    render(<DashboardBuilder widgets={existing} onSave={onSave} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByText('Save Dashboard'));
    expect(onSave).toHaveBeenCalledWith(existing);
  });

  it('calls onCancel without saving when Cancel is clicked from the widget list', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    render(<DashboardBuilder widgets={[]} onSave={onSave} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('DashboardGrid', () => {
  it('shows an empty state with an "Add Widgets" call to action when there are no widgets', () => {
    const onEdit = jest.fn();
    render(<DashboardGrid widgets={[]} results={{}} onEdit={onEdit} />);
    expect(screen.getByText(/no widgets yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('+ Add Widgets'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('renders a KPI widget\'s value', () => {
    const widgets = [{ id: 'w1', type: 'kpi' as const, title: 'Total Apps', x: 0, y: 0, w: 1, h: 1, config: {} }];
    render(<DashboardGrid widgets={widgets} results={{ w1: { value: 42, label: '42' } }} />);
    expect(screen.getByText('Total Apps')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders a table widget\'s rows with status badges', () => {
    const widgets = [{ id: 'w1', type: 'table' as const, title: 'Apps', x: 0, y: 0, w: 2, h: 1, config: {} }];
    render(<DashboardGrid widgets={widgets} results={{ w1: { nodes: [{ id: 'a1', name: 'HR System', status: 'APPROVED' }] } }} />);
    expect(screen.getByText('HR System')).toBeInTheDocument();
    expect(screen.getByText('APPROVED')).toBeInTheDocument();
  });

  it('renders a graph-summary widget with node/edge counts', () => {
    const widgets = [{ id: 'w1', type: 'graph' as const, title: 'Landscape', x: 0, y: 0, w: 2, h: 1, config: {} }];
    render(<DashboardGrid widgets={widgets} results={{ w1: { metadata: { totalNodes: 15 }, edges: [{}, {}], nodes: [{ id: 'a1', name: 'App A' }] } }} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('• App A')).toBeInTheDocument();
  });

  it('renders a matrix widget with a relationship dot in the correct cell', () => {
    const widgets = [{ id: 'w1', type: 'matrix' as const, title: 'Cap x App', x: 0, y: 0, w: 2, h: 2, config: {} }];
    render(<DashboardGrid widgets={widgets} results={{ w1: {
      sources: [{ id: 's1', name: 'Capability A' }], targets: [{ id: 't1', name: 'Application B' }],
      relationships: [{ sourceId: 's1', targetId: 't1' }],
    } }} />);
    expect(screen.getByText('●')).toBeInTheDocument();
  });

  it('renders a roadmap widget\'s upcoming items', () => {
    const widgets = [{ id: 'w1', type: 'roadmap' as const, title: 'Timeline', x: 0, y: 0, w: 2, h: 1, config: {} }];
    render(<DashboardGrid widgets={widgets} results={{ w1: { items: [{ id: 'p1', name: 'Phase 1', end: '2026-06-01T00:00:00Z' }] } }} />);
    expect(screen.getByText('Phase 1')).toBeInTheDocument();
  });

  it('shows an error message inline for a widget whose query failed, without breaking the rest of the dashboard', () => {
    const widgets = [
      { id: 'w1', type: 'kpi' as const, title: 'Broken', x: 0, y: 0, w: 1, h: 1, config: {} },
      { id: 'w2', type: 'kpi' as const, title: 'Working', x: 0, y: 0, w: 1, h: 1, config: {} },
    ];
    render(<DashboardGrid widgets={widgets} results={{ w1: { error: 'query exploded' }, w2: { value: 5, label: '5' } }} />);
    expect(screen.getByText(/query exploded/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows "No data" for a widget with no result yet, rather than crashing', () => {
    const widgets = [{ id: 'w1', type: 'kpi' as const, title: 'Pending', x: 0, y: 0, w: 1, h: 1, config: {} }];
    render(<DashboardGrid widgets={widgets} results={{}} />);
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
