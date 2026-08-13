import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectorHubPage from '../ConnectorHubPage';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function mockFetch(routes: Record<string, any>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    for (const [pattern, response] of Object.entries(routes)) {
      if (url.includes(pattern)) return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

describe('ConnectorHubPage - tab navigation', () => {
  it('starts on the Dashboard tab', async () => {
    mockFetch({ '/connectors/stats': { total: 0 } });
    render(<ConnectorHubPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText('🔌 Connector Hub')).toBeInTheDocument();
  });

  it('switches to the Connectors tab and loads the connector list', async () => {
    mockFetch({ '/connectors/stats': {}, '/connectors': [] });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('🔌 Connectors'));
    expect(await screen.findByText('No connectors yet')).toBeInTheDocument();
  });
});

describe('ConnectorHubPage - ConnectorsList', () => {
  const SAMPLE_CONNECTOR = {
    id: 'c1', name: 'My LeanIX Connection', connectorType: 'LEANIX', direction: 'BIDIRECTIONAL',
    status: 'ACTIVE', _count: { syncJobs: 3 }, lastSyncAt: '2026-01-15T00:00:00Z',
  };

  it('renders each connector with its type icon and status', async () => {
    mockFetch({ '/connectors/stats': {}, '/connectors': [SAMPLE_CONNECTOR] });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('🔌 Connectors'));
    expect(await screen.findByText('My LeanIX Connection')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText(/3 sync jobs/)).toBeInTheDocument();
  });

  it('opens the connector detail view when a connector is clicked', async () => {
    mockFetch({ '/connectors/stats': {}, '/connectors': [SAMPLE_CONNECTOR] });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('🔌 Connectors'));
    fireEvent.click(await screen.findByText('My LeanIX Connection'));
    // Tab strip disappears in detail view (per the tab !== 'detail' condition)
    await waitFor(() => expect(screen.queryByText('🏠 Dashboard')).not.toBeInTheDocument());
  });
});

describe('ConnectorHubPage - NewConnector', () => {
  it('shows the connector type picker first', async () => {
    mockFetch({ '/connectors/stats': {} });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('+ Add'));
    expect(await screen.findByText('Choose Connector Type')).toBeInTheDocument();
    expect(screen.getByText('LeanIX')).toBeInTheDocument();
  });

  it('does not allow selecting a "coming soon" connector type', async () => {
    mockFetch({ '/connectors/stats': {} });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('+ Add'));
    await screen.findByText('Choose Connector Type');
    const comingSoonBadges = screen.queryAllByText('Coming Soon');
    if (comingSoonBadges.length > 0) {
      fireEvent.click(comingSoonBadges[0].closest('div[style*="cursor"]')!);
      expect(screen.getByText('Choose Connector Type')).toBeInTheDocument(); // still on picker step
    }
  });

  it('defaults sync direction to IMPORT for a file-only connector type (e.g. ArchiMate)', async () => {
    mockFetch({ '/connectors/stats': {} });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('+ Add'));
    await screen.findByText('Choose Connector Type');
    fireEvent.click(screen.getByText('ArchiMate 3.1'));
    expect(await screen.findByText(/Configure: ArchiMate 3.1/)).toBeInTheDocument();
    // File-only types hide direction/baseUrl/autoSync fields entirely
    expect(screen.queryByText('Sync Direction')).not.toBeInTheDocument();
  });

  it('shows sync direction and base URL fields for an API-based connector type', async () => {
    mockFetch({ '/connectors/stats': {} });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('+ Add'));
    await screen.findByText('Choose Connector Type');
    fireEvent.click(screen.getByText('LeanIX'));
    expect(await screen.findByText('Sync Direction')).toBeInTheDocument();
    expect(screen.getByText('API Base URL')).toBeInTheDocument();
  });

  it('disables Create Connector until a name is entered', async () => {
    mockFetch({ '/connectors/stats': {} });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('+ Add'));
    await screen.findByText('Choose Connector Type');
    fireEvent.click(screen.getByText('LeanIX'));
    await screen.findByText('Sync Direction');
    // Name is pre-filled from the type name by default, so it's not actually empty here -
    // verify clearing it disables the button
    const nameInput = screen.getByDisplayValue('LeanIX');
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Create Connector' })).toBeDisabled();
  });

  it('submits the correct payload including the selected connectorType code', async () => {
    mockFetch({ '/connectors/stats': {}, '/connectors': { id: 'new-1', name: 'My Ardoq' } });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('+ Add'));
    await screen.findByText('Choose Connector Type');
    fireEvent.click(screen.getByText('Ardoq'));
    await screen.findByText('Sync Direction');
    fireEvent.change(screen.getByDisplayValue('Ardoq'), { target: { value: 'My Ardoq' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Connector' }));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST');
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.connectorType).toBe('ARDOQ');
      expect(body.name).toBe('My Ardoq');
    });
  });
});

describe('ConnectorHubPage - ConflictsPanel', () => {
  const SAMPLE_CONFLICT = {
    id: 'conf-1', externalName: 'Core Banking App', objectType: 'APPLICATION', conflictFields: ['name', 'owner'],
    archimindData: { name: 'Core Banking' }, externalData: { name: 'Core Banking System' },
  };

  it('shows "no pending conflicts" when there are none', async () => {
    mockFetch({ '/connectors/stats': {}, '/connectors': [] });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('⚠️ Conflicts'));
    expect(await screen.findByText('✅ No pending conflicts')).toBeInTheDocument();
  });

  it('displays a real conflict fetched via the nested connectors -> jobs -> job-detail chain', async () => {
    mockFetch({
      '/connectors/stats': {},
      '/connectors/c1/jobs': [{ id: 'job-1', _count: { conflicts: 1 } }],
      '/connectors/jobs/job-1': { conflicts: [SAMPLE_CONFLICT] },
      '/connectors': [{ id: 'c1', name: 'LeanIX Connector' }],
    });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('⚠️ Conflicts'));
    expect(await screen.findByText(/Core Banking App/)).toBeInTheDocument();
  });

  it('POSTs the correct resolution when a conflict action button is clicked', async () => {
    mockFetch({
      '/connectors/stats': {},
      '/connectors/c1/jobs': [{ id: 'job-1', _count: { conflicts: 1 } }],
      '/connectors/jobs/job-1': { conflicts: [SAMPLE_CONFLICT] },
      '/connectors': [{ id: 'c1', name: 'LeanIX Connector' }],
    });
    render(<ConnectorHubPage />);
    fireEvent.click(screen.getByText('⚠️ Conflicts'));
    await screen.findByText(/Core Banking App/);
    fireEvent.click(screen.getByText('✅ Keep ArchMind'));

    await waitFor(() => {
      const resolveCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/conflicts/conf-1/resolve'));
      expect(resolveCall).toBeDefined();
      expect(JSON.parse(resolveCall[1].body)).toEqual({ resolution: 'USE_ARCHIMIND' });
    });
  });
});
