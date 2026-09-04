import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

jest.mock('../lib/api', () => ({
  api: {
    me: jest.fn(),
    login: jest.fn(),
    getMyPermissions: jest.fn(),
  },
  setToken: jest.fn(),
  clearToken: jest.fn(),
  getToken: jest.fn(),
}));

import { api, getToken, setToken, clearToken } from '../lib/api';

const TestComponent = () => {
  const { user, loading, hasPermission, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{loading ? 'loading' : 'ready'}</div>
      <div data-testid="user">{user ? user.email : 'no-user'}</div>
      <div data-testid="can-view">{hasPermission('Users.View') ? 'yes' : 'no'}</div>
      <button data-testid="login" onClick={() => login('a@b.com', 'pass', 'acme')}>Login</button>
      <button data-testid="logout" onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getToken as jest.Mock).mockReturnValue(null);
  });

  it('loads user and permissions from token', async () => {
    (getToken as jest.Mock).mockReturnValue('valid-token');
    (api.me as jest.Mock).mockResolvedValue({ userId: 'u1', email: 'a@acme.com', role: 'ARCHITECT' });
    (api.getMyPermissions as jest.Mock).mockResolvedValue([{ code: 'Users.View' }]);

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@acme.com'));
    expect(screen.getByTestId('can-view').textContent).toBe('yes');
  });

  it('TENANT_ADMIN bypasses permission checks', async () => {
    (getToken as jest.Mock).mockReturnValue('valid-token');
    (api.me as jest.Mock).mockResolvedValue({ userId: 'u1', email: 'admin@acme.com', role: 'TENANT_ADMIN' });
    (api.getMyPermissions as jest.Mock).mockResolvedValue([]);

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('admin@acme.com'));
    expect(screen.getByTestId('can-view').textContent).toBe('yes');
  });

  it('login flow sets token and loads permissions', async () => {
    (api.login as jest.Mock).mockResolvedValue({ accessToken: 'new-token' });
    (api.me as jest.Mock).mockResolvedValue({ userId: 'u1', email: 'a@acme.com', role: 'ARCHITECT' });
    (api.getMyPermissions as jest.Mock).mockResolvedValue([{ code: 'Users.View' }]);

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('ready'));

    act(() => { screen.getByTestId('login').click(); });
    await waitFor(() => expect(setToken).toHaveBeenCalledWith('new-token'));
  });

  it('logout clears state', async () => {
    (getToken as jest.Mock).mockReturnValue('valid-token');
    (api.me as jest.Mock).mockResolvedValue({ userId: 'u1', email: 'a@acme.com', role: 'ARCHITECT' });
    (api.getMyPermissions as jest.Mock).mockResolvedValue([{ code: 'Users.View' }]);

    render(<AuthProvider><TestComponent /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('a@acme.com'));

    act(() => { screen.getByTestId('logout').click(); });
    expect(clearToken).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByTestId('user').textContent).toBe('no-user'));
  });
});
