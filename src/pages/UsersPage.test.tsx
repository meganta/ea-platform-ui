import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import UsersPage from './UsersPage';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', email: 'admin@acme.com', role: 'TENANT_ADMIN' },
    hasPermission: () => true,
  }),
}));

jest.mock('../contexts/LangContext', () => ({
  useLang: () => ({ t: (k: string) => k, locale: 'EN' }),
}));

jest.mock('../components/HelpTip', () => () => <span>?</span>);

global.fetch = jest.fn();
const mockFetch = (res: any, ok = true) => jest.fn().mockResolvedValue({ ok, json: () => Promise.resolve(res) });

Object.defineProperty(window, 'localStorage', {
  value: { getItem: jest.fn().mockReturnValue('test-token') },
  writable: true,
});

describe('UsersPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders users table', async () => {
    (fetch as jest.Mock)
      .mockImplementationOnce(mockFetch([{ id: 'u1', email: 'alice@acme.com', fullName: 'Alice', role: 'ARCHITECT', isActive: true, lastLoginAt: null }]))
      .mockImplementationOnce(mockFetch([]));

    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('Alice')).toBeInTheDocument());
    expect(screen.getByText('alice@acme.com')).toBeInTheDocument();
  });

  it('shows invite button', async () => {
    (fetch as jest.Mock).mockImplementationOnce(mockFetch([])).mockImplementationOnce(mockFetch([]));
    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('users.invite')).toBeInTheDocument());
  });

  it('switches to invitations tab', async () => {
    (fetch as jest.Mock)
      .mockImplementationOnce(mockFetch([]))
      .mockImplementationOnce(mockFetch([{ id: 'inv-1', email: 'pending@acme.com', role: 'ARCHITECT', expiresAt: '2026-12-31T00:00:00Z' }]));

    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText('users.tab_users')).toBeInTheDocument());
    fireEvent.click(screen.getByText('users.tab_invitations'));
    await waitFor(() => expect(screen.getByText('pending@acme.com')).toBeInTheDocument());
  });
});
