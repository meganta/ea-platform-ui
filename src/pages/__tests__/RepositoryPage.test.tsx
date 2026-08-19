import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RepositoryPage from '../RepositoryPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key }),
}));

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

const CONFIG = { enabledDomains: ['BUSINESS', 'APPLICATION'], allDomains: { BUSINESS: ['CAPABILITY'], APPLICATION: ['APPLICATION'] } };

function asset(overrides: Partial<Record<string, any>> = {}) {
  return { id: 'a1', name: 'Core Banking', nameAr: null, domain: 'APPLICATION', status: 'APPROVED', source: 'MANUAL', assetType: 'APPLICATION', ...overrides };
}

describe('RepositoryPage - loading and listing', () => {
  it('loads and displays assets', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    expect(await screen.findByText('Core Banking')).toBeInTheDocument();
  });

  it('filters by free-text search across English and Arabic names', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Core Banking' }), asset({ id: 'a2', name: 'CRM Platform' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.change(screen.getByPlaceholderText('Search assets...'), { target: { value: 'banking' } });
    expect(screen.getByText('Core Banking')).toBeInTheDocument();
    expect(screen.queryByText('CRM Platform')).not.toBeInTheDocument();
  });

  it('filters by domain', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Core Banking', domain: 'APPLICATION' }), asset({ id: 'a2', name: 'Payments Capability', domain: 'BUSINESS' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    const selects = screen.getAllByRole('combobox');
    const domainSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="BUSINESS"]'))!;
    fireEvent.change(domainSelect, { target: { value: 'BUSINESS' } });
    expect(screen.getByText('Payments Capability')).toBeInTheDocument();
    expect(screen.queryByText('Core Banking')).not.toBeInTheDocument();
  });

  it('filters by status', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Approved Asset', status: 'APPROVED' }), asset({ id: 'a2', name: 'Draft Asset', status: 'DRAFT' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Approved Asset');
    const selects = screen.getAllByRole('combobox');
    const statusSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="DRAFT"]'))!;
    fireEvent.change(statusSelect, { target: { value: 'DRAFT' } });
    expect(screen.getByText('Draft Asset')).toBeInTheDocument();
    expect(screen.queryByText('Approved Asset')).not.toBeInTheDocument();
  });

  it('filters by source - proves the fix for a bug where this filter had working UI but was never actually applied', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Manually Entered', source: 'MANUAL' }), asset({ id: 'a2', name: 'ADM Generated', source: 'ADM_OUTPUT' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Manually Entered');
    const selects = screen.getAllByRole('combobox');
    const sourceSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="ADM_OUTPUT"]'))!;
    fireEvent.change(sourceSelect, { target: { value: 'ADM_OUTPUT' } });
    expect(screen.getByText('ADM Generated')).toBeInTheDocument();
    expect(screen.queryByText('Manually Entered')).not.toBeInTheDocument();
  });

  it('filters by asset type - proves the same fix for the second previously-inert filter', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'App Asset', assetType: 'APPLICATION' }), asset({ id: 'a2', name: 'Cap Asset', assetType: 'CAPABILITY' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('App Asset');
    const selects = screen.getAllByRole('combobox');
    const typeSelect = selects.find(s => (s as HTMLSelectElement).querySelector('option[value="CAPABILITY"]'))!;
    fireEvent.change(typeSelect, { target: { value: 'CAPABILITY' } });
    expect(screen.getByText('Cap Asset')).toBeInTheDocument();
    expect(screen.queryByText('App Asset')).not.toBeInTheDocument();
  });

  it('groups assets by source/cycle when Group by Cycle is enabled', async () => {
    mockFetch({
      '/ea-repository/framework-config': CONFIG, '/ea-repository/summary': {},
      '/ea-repository/assets': [asset({ id: 'a1', name: 'Manual One', source: 'MANUAL' }), asset({ id: 'a2', name: 'Upload One', source: 'UPLOAD' })],
    });
    render(<RepositoryPage />);
    await screen.findByText('Manual One');
    fireEvent.click(screen.getByRole('checkbox'));
    expect(await screen.findByText(/Manual Entries/)).toBeInTheDocument();
    expect(screen.getByText(/Uploads/)).toBeInTheDocument();
  });
});

describe('RepositoryPage - CRUD', () => {
  it('creates a new asset via the modal', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [], '/ea-repository/summary': {} });
    render(<RepositoryPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getAllByText('+ New Asset')[0]);
    fireEvent.change(screen.getByLabelText(/Name \(English\)/), { target: { value: 'New App' } });

    const domainSelect = screen.getByLabelText(/Domain/);
    fireEvent.change(domainSelect, { target: { value: 'APPLICATION' } });
    const typeSelect = screen.getByLabelText(/Asset Type/);
    fireEvent.change(typeSelect, { target: { value: 'APPLICATION' } });
    fireEvent.click(screen.getByText('Save Asset'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/ea-repository/assets'));
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body).name).toBe('New App');
    });
  });

  it('deletes an asset after confirmation', async () => {
    mockFetch({ '/ea-repository/framework-config': CONFIG, '/ea-repository/assets': [asset()], '/ea-repository/summary': {} });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<RepositoryPage />);
    await screen.findByText('Core Banking');
    fireEvent.click(screen.getByText('Core Banking'));
    const deleteBtn = await screen.findByText(/Delete/);
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('/ea-repository/assets/a1');
    });
    confirmSpy.mockRestore();
  });
});
