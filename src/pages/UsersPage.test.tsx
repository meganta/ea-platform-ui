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
    expect(JSON.parse(post.init.body)).toEqual({ email: 'pending@acme.com', role: 'REVIEWER', fullName: 'Pat', tenantRoleIds: [] });
  });
});

describe('UsersPage roles from Access Governance', () => {
  const ROLES = [
    { id: 'role-arch', code: 'architect', name: 'Architect', nameAr: 'معماري', isActive: true },
    { id: 'role-eng', code: 'engineer', name: 'Innovation Engineer', isActive: true },
    { id: 'role-old', code: 'old', name: 'Retired role', isActive: false },
  ];
  const USERS = [
    { id: 'u1', email: 'admin@acme.com', fullName: 'Admin', role: 'TENANT_ADMIN', isActive: true, tenantRoles: [{ id: 'role-arch', name: 'Architect' }] },
    { id: 'u2', email: 'old@acme.com', fullName: 'Old User', role: 'ARCHITECT', isActive: false, tenantRoles: [] },
  ];
  let calls: Array<{ url: string; init?: any }> = [];
  const route = (routes: Record<string, any>) => {
    calls = [];
    (fetch as jest.Mock).mockImplementation(async (url: string, init?: any) => {
      calls.push({ url, init });
      const method = init?.method || 'GET';
      const key = Object.keys(routes).sort((a, b) => b.length - a.length).find(k => { const [m, p] = k.split(' '); return m === method && url.includes(p); });
      const body = key ? routes[key] : {};
      return { ok: true, json: async () => (typeof body === 'function' ? body(url, init) : body) };
    });
  };
  const base = { 'GET /access-governance/roles': ROLES, 'GET /users/invitations': [], 'GET /users': USERS };

  it("shows each user's Access Governance roles and offers only active roles when inviting", async () => {
    route({ ...base, 'POST /users/invite': { id: 'i', email: 'n@acme.com', inviteUrl: 'https://ui/invite/t', emailDelivery: { status: 'SENT' } } });
    render(<UsersPage />);
    expect(await screen.findByTestId('user-roles-u1')).toHaveTextContent('Architect');
    expect(screen.getByTestId('user-roles-u2')).toHaveTextContent('users.no_roles');
    fireEvent.click(screen.getAllByText(/users\.invite$/)[0]);
    expect(screen.getByLabelText('Innovation Engineer')).toBeInTheDocument();
    expect(screen.queryByLabelText('Retired role')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/users\.email/), { target: { value: 'n@acme.com' } });
    fireEvent.click(screen.getByText('users.send_invite'));
    expect(await screen.findByText('users.role_required')).toBeInTheDocument();
    expect(calls.some(c => c.init?.method === 'POST')).toBe(false);
    fireEvent.click(screen.getByLabelText('Innovation Engineer'));
    fireEvent.click(screen.getByText('users.send_invite'));
    await screen.findByTestId('invite-result');
    expect(JSON.parse(calls.find(c => c.init?.method === 'POST')!.init.body)).toMatchObject({ email: 'n@acme.com', role: 'ARCHITECT', tenantRoleIds: ['role-eng'] });
  });

  it('creating a user sends the chosen roles', async () => {
    route({ ...base, 'POST /users': { id: 'u3' } });
    render(<UsersPage />);
    await screen.findByTestId('user-roles-u1');
    fireEvent.click(screen.getAllByText(/users\.create/)[0]);
    fireEvent.change(screen.getByLabelText(/users\.email/), { target: { value: 'c@acme.com' } });
    fireEvent.change(screen.getByLabelText(/users\.password/), { target: { value: 'password-1' } });
    fireEvent.click(screen.getByLabelText('Architect'));
    fireEvent.click(screen.getByText('users.create'));
    await waitFor(() => expect(calls.find(c => c.init?.method === 'POST')).toBeTruthy());
    expect(JSON.parse(calls.find(c => c.init?.method === 'POST')!.init.body)).toMatchObject({ email: 'c@acme.com', tenantRoleIds: ['role-arch'] });
  });

  it("editing changes the name and email and adds/removes Access Governance roles, without re-sending an unchanged access level", async () => {
    route({ ...base, 'PUT /users/u1': { id: 'u1' }, 'POST /access-governance/roles/': { id: 'a' }, 'DELETE /access-governance/roles/': null });
    render(<UsersPage />);
    await screen.findByTestId('user-roles-u1');
    fireEvent.click(screen.getAllByText('users.edit')[0]);
    fireEvent.change(screen.getByLabelText('users.full_name'), { target: { value: 'HRDF Admin' } });
    fireEvent.change(screen.getByLabelText('users.email'), { target: { value: 'admin@hrdf.com' } });
    fireEvent.click(screen.getByLabelText('Architect'));
    fireEvent.click(screen.getByLabelText('Innovation Engineer'));
    fireEvent.click(screen.getByText('users.save'));
    await waitFor(() => expect(calls.some(c => c.init?.method === 'DELETE')).toBe(true));
    expect(JSON.parse(calls.find(c => c.init?.method === 'PUT')!.init.body)).toEqual({ fullName: 'HRDF Admin', isActive: true, email: 'admin@hrdf.com' });
    const assign = calls.find(c => c.init?.method === 'POST')!;
    expect(assign.url).toMatch(/access-governance\/roles\/role-eng\/assign$/);
    expect(JSON.parse(assign.init.body)).toMatchObject({ userId: 'u1' });
    expect(calls.find(c => c.init?.method === 'DELETE')!.url).toMatch(/access-governance\/roles\/role-arch\/assign\/u1$/);
  });

  it('an administrator can delete another user permanently after confirming', async () => {
    route({ ...base, 'DELETE /users/u2/permanent': { deleted: true } });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<UsersPage />);
    await screen.findByTestId('user-roles-u1');
    expect(screen.queryByRole('button', { name: 'users.delete_permanent admin@acme.com' })).not.toBeInTheDocument(); // never your own account
    fireEvent.click(screen.getByRole('button', { name: 'users.delete_permanent old@acme.com' }));
    await waitFor(() => expect(calls.some(c => c.init?.method === 'DELETE' && /\/users\/u2\/permanent$/.test(c.url))).toBe(true));
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
  });
});
