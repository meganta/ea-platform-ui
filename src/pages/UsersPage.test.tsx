import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import UsersPage from './UsersPage';

let mockTenantSlug: string | undefined;
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 'u1', email: 'admin@acme.com', role: 'TENANT_ADMIN', tenantSlug: mockTenantSlug },
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
    await waitFor(() => expect(screen.getByText(/users\.invite/)).toBeInTheDocument());
  });

  it('switches to invitations tab', async () => {
    (fetch as jest.Mock)
      .mockImplementationOnce(mockFetch([]))
      .mockImplementationOnce(mockFetch([{ id: 'inv-1', email: 'pending@acme.com', role: 'ARCHITECT', expiresAt: '2026-12-31T00:00:00Z' }]));

    render(<UsersPage />);
    await waitFor(() => expect(screen.getByText(/users\.tab_users/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/users\.tab_invitations/));
    await waitFor(() => expect(screen.getByText('pending@acme.com')).toBeInTheDocument());
  });
});

describe('UsersPage invitations', () => {
  const INV = { id: 'inv-1', email: 'pending@acme.com', role: 'REVIEWER', fullName: 'Pat', expiresAt: '2026-12-31T00:00:00Z' };
  let calls: Array<{ url: string; init?: any }> = [];
  const route = (routes: Record<string, any>) => {
    calls = [];
    (fetch as jest.Mock).mockImplementation(async (url: string, init?: any) => {
      calls.push({ url, init });
      const method = init?.method || 'GET';
      const key = Object.keys(routes).sort((a, b) => b.length - a.length).find(k => { const [m, p] = k.split(' '); return m === method && url.includes(p); });
      const body = key ? routes[key] : [];
      return { ok: true, json: async () => (typeof body === 'function' ? body(url, init) : body) };
    });
  };
  const openInvitations = async () => {
    render(<UsersPage />);
    fireEvent.click(await screen.findByText(/users\.tab_invitations/));
    await screen.findByText('pending@acme.com');
  };

  beforeEach(() => { mockTenantSlug = undefined; Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } }); });

  it("gives out links on the tenant's own address when it has one", async () => {
    mockTenantSlug = 'test-tenant';
    route({ 'GET /users/invitations/inv-1/link': { id: 'inv-1', inviteUrl: 'https://ea-platform-ui-1.run.app/invite/secret-token', expired: false }, 'GET /users/invitations': [INV], 'GET /users': [] });
    await openInvitations();
    fireEvent.click(screen.getByText(/users\.copy_link/));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://hrdf.archmindworks.com/invite/secret-token'));
  });

  it('copies the real token link from the API, not one built from the invitation id', async () => {
    route({ 'GET /users/invitations/inv-1/link': { id: 'inv-1', inviteUrl: 'https://ui/invite/secret-token', expired: false }, 'GET /users/invitations': [INV], 'GET /users': [] });
    await openInvitations();
    fireEvent.click(screen.getByText(/users\.copy_link/));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://ui/invite/secret-token'));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalledWith(expect.stringContaining('inv-1'));
    expect(await screen.findByText('users.invite_link_copied')).toBeInTheDocument();
  });

  it('says an expired invitation must be resent instead of copying a dead link', async () => {
    route({ 'GET /users/invitations/inv-1/link': { id: 'inv-1', inviteUrl: 'https://ui/invite/t', expired: true }, 'GET /users/invitations': [INV], 'GET /users': [] });
    await openInvitations();
    fireEvent.click(screen.getByText(/users\.copy_link/));
    expect(await screen.findByText('users.invite_link_expired')).toBeInTheDocument();
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('after inviting, says honestly that no email was sent when no sender is configured and shows the link to share', async () => {
    route({ 'POST /users/invite': { id: 'inv-2', email: 'new@acme.com', inviteUrl: 'https://ui/invite/tok2', emailDelivery: { status: 'NOT_CONFIGURED', sent: false } }, 'GET /users/invitations': [], 'GET /users': [] });
    render(<UsersPage />);
    fireEvent.click((await screen.findAllByText(/users\.invite$/))[0]);
    fireEvent.change(screen.getByLabelText(/users\.email/), { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByText('users.send_invite'));
    const result = await screen.findByTestId('invite-result');
    expect(result).toHaveTextContent('users.invite_not_emailed');
    expect(screen.getByLabelText('users.invite_link')).toHaveValue('https://ui/invite/tok2');
    fireEvent.click(screen.getByText(/users\.copy_link/));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://ui/invite/tok2'));
  });

  it('confirms the email when it was sent', async () => {
    route({ 'POST /users/invite': { id: 'inv-2', email: 'new@acme.com', inviteUrl: 'https://ui/invite/tok2', emailDelivery: { status: 'SENT', sent: true } }, 'GET /users/invitations': [], 'GET /users': [] });
    render(<UsersPage />);
    fireEvent.click((await screen.findAllByText(/users\.invite$/))[0]);
    fireEvent.change(screen.getByLabelText(/users\.email/), { target: { value: 'new@acme.com' } });
    fireEvent.click(screen.getByText('users.send_invite'));
    expect(await screen.findByTestId('invite-result')).toHaveTextContent('users.invite_sent');
  });

  it('resend renews the invitation with the same email and role', async () => {
    route({ 'POST /users/invite': { id: 'inv-1', email: 'pending@acme.com', inviteUrl: 'https://ui/invite/new', emailDelivery: { status: 'SENT', sent: true } }, 'GET /users/invitations': [INV], 'GET /users': [] });
    await openInvitations();
    fireEvent.click(screen.getByText(/users\.resend$/));
    expect(await screen.findByTestId('invite-result')).toHaveTextContent('users.invite_sent');
    const post = calls.find(c => c.init?.method === 'POST')!;
    expect(JSON.parse(post.init.body)).toEqual({ email: 'pending@acme.com', role: 'REVIEWER', fullName: 'Pat' });
  });
});
