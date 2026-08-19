import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccessGovernancePage from '../AccessGovernancePage';

let mockUser: any = { role: 'TENANT_ADMIN' };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { role: 'TENANT_ADMIN' };
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

describe('AccessGovernancePage - tab navigation and admin gating', () => {
  it('renders the Overview tab by default', async () => {
    mockFetch({ '/access-governance/roles': [], '/access-governance/access-requests': [], '/access-governance/sod-conflicts': [], '/access-governance/dormant-accounts': [] });
    render(<AccessGovernancePage />);
    expect(screen.getByText('🔐 Access Governance')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalled()); // let OverviewTab's own fetches settle before the test ends
  });

  it('switches to the Requests tab and loads mine + roles', async () => {
    mockFetch({ '/access-governance/roles': [], '/access-governance/access-requests/mine': [], '/access-governance/access-requests': [] });
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Access Requests'));
    await waitFor(() => {
      const calledUrls = (global.fetch as jest.Mock).mock.calls.map((c: any) => c[0]);
      expect(calledUrls.some((u: string) => u.includes('/access-requests/mine'))).toBe(true);
    });
  });

  it('a non-admin never triggers the admin-only "all requests" fetch', async () => {
    mockUser = { role: 'ARCHITECT' };
    mockFetch({ '/access-governance/roles': [], '/access-governance/access-requests/mine': [] });
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Access Requests'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const calledUrls = (global.fetch as jest.Mock).mock.calls.map((c: any) => c[0]);
    expect(calledUrls.some((u: string) => u.includes('/access-requests?') || u.endsWith('/access-requests'))).toBe(false);
  });

  it('SodTab shows an access-restricted message for a non-admin instead of the management UI', async () => {
    mockUser = { role: 'ARCHITECT' };
    mockFetch({});
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Segregation of Duties'));
    expect(await screen.findByText(/Requires Tenant Administrator access/)).toBeInTheDocument();
  });
});

describe('AccessGovernancePage - RequestsTab', () => {
  const SAMPLE_ROLE = { id: 'role-1', name: 'Application Architect' };

  it('requires both a role and a reason before submitting', async () => {
    mockFetch({ '/access-governance/roles': [SAMPLE_ROLE], '/access-governance/access-requests/mine': [], '/access-governance/access-requests': [] });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Access Requests'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Submit Request'));
    expect(alertSpy).toHaveBeenCalledWith('Select a role and provide a reason');
    alertSpy.mockRestore();
  });

  it('submits a request with the selected role and reason', async () => {
    mockFetch({ '/access-governance/roles': [SAMPLE_ROLE], '/access-governance/access-requests/mine': [], '/access-governance/access-requests': [] });
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Access Requests'));
    await waitFor(() => expect(screen.getAllByText('Application Architect').length).toBeGreaterThan(0));

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'role-1' } });
    fireEvent.change(screen.getByPlaceholderText('Why do you need this access?'), { target: { value: 'Need to review app portfolio' } });
    fireEvent.click(screen.getByText('Submit Request'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/access-requests'));
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body)).toEqual({ tenantRoleId: 'role-1', reason: 'Need to review app portfolio' });
    });
  });

  it('cancels a pending request', async () => {
    mockFetch({
      '/access-governance/roles': [],
      '/access-governance/access-requests/mine': [{ id: 'req-1', tenantRole: { name: 'Viewer' }, reason: 'x', status: 'PENDING' }],
      '/access-governance/access-requests': [],
    });
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Access Requests'));
    fireEvent.click(await screen.findByText('Cancel'));

    await waitFor(() => {
      const cancelCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/req-1/cancel'));
      expect(cancelCall).toBeDefined();
    });
  });

  it('retries as a forced override when rejected for a Segregation-of-Duties conflict and the user confirms', async () => {
    let approveCallCount = 0;
    const routes = {
      '/access-governance/roles': [],
      '/access-governance/access-requests/mine': [],
      '/access-governance/access-requests': [{ id: 'req-1', requesterId: 'user-2', tenantRole: { name: 'Chief Architect' }, reason: 'x', status: 'PENDING' }],
    };
    global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
      if (url.includes('/approve')) {
        approveCallCount++;
        if (approveCallCount === 1) {
          return Promise.resolve({ ok: false, json: () => Promise.resolve({ message: 'Segregation of Duties conflict detected' }) })
            .then(async r => { const d = await r.json(); throw new Error(d.message); });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      for (const [pattern, response] of Object.entries(routes).sort((a, b) => b[0].length - a[0].length)) {
        if (url.includes(pattern)) return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Access Requests'));
    fireEvent.click(await screen.findByText('Approve'));

    await waitFor(() => expect(approveCallCount).toBe(2)); // first attempt rejected, retried with force
    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls.filter((c: any) => c[0].includes('/approve'))[1][1].body);
    expect(secondCallBody.force).toBe(true);
    confirmSpy.mockRestore();
  });
});

describe('AccessGovernancePage - SodTab', () => {
  it('requires all fields before creating a rule', async () => {
    mockFetch({ '/access-governance/roles': [], '/access-governance/sod-rules': [], '/access-governance/sod-conflicts': [] });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Segregation of Duties'));
    fireEvent.click(await screen.findByText('+ Create SoD Rule'));
    fireEvent.click(screen.getByText('Create'));
    expect(alertSpy).toHaveBeenCalledWith('Fill in all fields');
    alertSpy.mockRestore();
  });

  it('shows detected conflicts with per-conflict severity', async () => {
    mockFetch({
      '/access-governance/roles': [], '/access-governance/sod-rules': [],
      '/access-governance/sod-conflicts': [{ userId: 'user-1', conflicts: [{ ruleName: 'Requester/Approver split', severity: 'BLOCKING', conflictingRoleName: 'Approver' }] }],
    });
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Segregation of Duties'));
    expect(await screen.findByText(/Requester\/Approver split/)).toBeInTheDocument();
    expect(screen.getByText('BLOCKING')).toBeInTheDocument();
  });

  it('shows "no conflicts detected" when there are none', async () => {
    mockFetch({ '/access-governance/roles': [], '/access-governance/sod-rules': [], '/access-governance/sod-conflicts': [] });
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Segregation of Duties'));
    expect(await screen.findByText('No conflicts detected.')).toBeInTheDocument();
  });

  it('does not delete a rule when the confirmation dialog is cancelled', async () => {
    mockFetch({
      '/access-governance/roles': [], '/access-governance/sod-conflicts': [],
      '/access-governance/sod-rules': [{ id: 'rule-1', name: 'No Requester+Approver', severity: 'BLOCKING' }],
    });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AccessGovernancePage />);
    fireEvent.click(screen.getByText('Segregation of Duties'));
    await screen.findByText('No Requester+Approver');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('Delete'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });
});
