import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth, OWNER_TOKEN_KEY, isPlatformOwner } from './AuthContext';

let mockToken: string | null = 'owner-token';
jest.mock('../lib/api', () => ({
  api: { me: jest.fn(), login: jest.fn(), getMyPermissions: jest.fn(() => Promise.resolve([])), exitOwnerAccess: jest.fn(() => Promise.resolve({})) },
  setToken: jest.fn((t: string) => { mockToken = t; }),
  setSession: jest.fn(),
  clearToken: jest.fn(() => { mockToken = null; }),
  getToken: jest.fn(() => mockToken),
}));
import { api, setToken, setSession, clearToken, getToken } from '../lib/api';

const OWNER = { userId: 'o', email: 'owner@x', role: 'ARCHITECT', tenantId: 'home', platformRole: 'PLATFORM_OWNER', delegatedAccess: null };
const DELEGATED = { userId: 'o', email: 'owner@x', role: 'SUPERADMIN', tenantId: 't1', platformRole: null, delegatedAccess: { sessionId: 's1', actorUserId: 'o', homeTenantId: 'home', expiresAt: '2026-10-07T10:30:00Z' } };

function Probe() {
  const { user, enterTenant, exitTenant, hasPermission } = useAuth();
  return (
    <div>
      <div data-testid="tenant">{user?.tenantId ?? 'none'}</div>
      <div data-testid="owner">{isPlatformOwner(user) ? 'owner' : 'not-owner'}</div>
      <div data-testid="admin">{hasPermission('Users.View') ? 'yes' : 'no'}</div>
      <button onClick={() => enterTenant('delegated-token')}>enter</button>
      <button onClick={() => exitTenant()}>exit</button>
    </div>
  );
}

// CRA resets mock implementations before each test: set them here.
beforeEach(() => {
  mockToken = 'owner-token';
  localStorage.clear();
  (setToken as jest.Mock).mockImplementation((t: string) => { mockToken = t; });
  (setSession as jest.Mock).mockImplementation((t: string, r: string) => { mockToken = t; localStorage.setItem('ea_refresh_token', r); });
  (clearToken as jest.Mock).mockImplementation(() => { mockToken = null; });
  (getToken as jest.Mock).mockImplementation(() => mockToken);
  (api.getMyPermissions as jest.Mock).mockResolvedValue([]);
  (api.exitOwnerAccess as jest.Mock).mockResolvedValue({});
});

it('enter keeps the owner token aside and switches to the delegated session; exit restores the owner', async () => {
  localStorage.setItem('ea_refresh_token', 'owner-refresh');
  (api.me as jest.Mock).mockResolvedValueOnce(OWNER).mockResolvedValueOnce(DELEGATED).mockResolvedValueOnce(OWNER);
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('owner')).toHaveTextContent('owner'));

  fireEvent.click(screen.getByText('enter'));
  await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('t1'));
  expect(localStorage.getItem(OWNER_TOKEN_KEY)).toBe('owner-token');
  expect(mockToken).toBe('delegated-token');
  expect(localStorage.getItem('ea_refresh_token')).toBeNull();
  expect(localStorage.getItem('ea_owner_refresh_token')).toBe('owner-refresh');
  // Inside the tenant the owner is not a platform owner but administers the tenant.
  expect(screen.getByTestId('owner')).toHaveTextContent('not-owner');
  expect(screen.getByTestId('admin')).toHaveTextContent('yes');

  fireEvent.click(screen.getByText('exit'));
  await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('home'));
  expect(api.exitOwnerAccess).toHaveBeenCalled();
  expect(mockToken).toBe('owner-token');
  expect(localStorage.getItem(OWNER_TOKEN_KEY)).toBeNull();
  expect(localStorage.getItem('ea_refresh_token')).toBe('owner-refresh');
  expect(localStorage.getItem('ea_owner_refresh_token')).toBeNull();
});

it('exit without a kept owner token signs out instead of staying in the tenant', async () => {
  (api.me as jest.Mock).mockResolvedValueOnce(DELEGATED);
  mockToken = 'delegated-token';
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('t1'));
  fireEvent.click(screen.getByText('exit'));
  await waitFor(() => expect(screen.getByTestId('tenant')).toHaveTextContent('none'));
});
