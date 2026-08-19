import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPage from '../SettingsPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ setLocale: jest.fn(), isAR: false, t: (key: string) => key }),
}));
jest.mock('../../contexts/BrandingContext', () => ({
  useBranding: () => ({ branding: null, refreshBranding: jest.fn() }),
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

const CONFIG = { tenant: { slug: 'test-tenant' }, ai: { provider: 'anthropic', model: 'claude-sonnet-4-6', language: 'EN' } };

describe('SettingsPage - tab navigation', () => {
  it('starts on the AI Configuration tab by default', async () => {
    mockFetch({ '/config': CONFIG });
    render(<SettingsPage />);
    expect(await screen.findByText(/settings.title/)).toBeInTheDocument();
  });

  it('switches to the Users tab and loads the user list', async () => {
    mockFetch({ '/config': CONFIG, '/users': [] });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    expect(await screen.findByText('👥 User Management')).toBeInTheDocument();
  });

  it('shows the tenant slug in the subtitle', async () => {
    mockFetch({ '/config': CONFIG });
    render(<SettingsPage />);
    expect(await screen.findByText(/TEST-TENANT/)).toBeInTheDocument();
  });
});

describe('SettingsPage - UsersTab', () => {
  const SAMPLE_USER = { id: 'user-12345678', email: 'admin@test.com', fullName: 'Admin User', role: 'TENANT_ADMIN', isActive: true };

  it('lists users with their role and status', async () => {
    mockFetch({ '/config': CONFIG, '/users': [SAMPLE_USER] });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    expect(await screen.findByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('creates a new user with the entered form data', async () => {
    mockFetch({ '/config': CONFIG, '/users': [] });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    fireEvent.click(await screen.findByText('+ Add User'));

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'newuser@test.com' } }); // email
    fireEvent.change(inputs[1], { target: { value: 'New User' } }); // fullName
    fireEvent.click(screen.getByText('Create User'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/users'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.email).toBe('newuser@test.com');
      expect(body.role).toBe('ARCHITECT'); // default role
    });
  });

  it('rejects a password reset shorter than 8 characters without ever calling the API', async () => {
    mockFetch({ '/config': CONFIG, '/users': [SAMPLE_USER] });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    await screen.findByText('Admin User');
    fireEvent.click(screen.getByText('🔑 PW'));
    fireEvent.change(screen.getByPlaceholderText(/New password/), { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Reset'));

    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
    const pwCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/password'));
    expect(pwCall).toBeUndefined();
  });

  it('resets a password successfully when it meets the minimum length', async () => {
    mockFetch({ '/config': CONFIG, '/users': [SAMPLE_USER], '/users/user-12345678/password': { success: true } });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    await screen.findByText('Admin User');
    fireEvent.click(screen.getByText('🔑 PW'));
    fireEvent.change(screen.getByPlaceholderText(/New password/), { target: { value: 'longenoughpassword' } });
    fireEvent.click(screen.getByText('Reset'));

    await waitFor(() => {
      const pwCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/password'));
      expect(pwCall).toBeDefined();
      expect(JSON.parse(pwCall[1].body)).toEqual({ newPassword: 'longenoughpassword' });
    });
  });

  it('updates a user\'s role via the inline edit control, sending only the changed field', async () => {
    mockFetch({ '/config': CONFIG, '/users': [SAMPLE_USER] });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    await screen.findByText('Admin User');
    fireEvent.click(screen.getByText('✏ Role'));
    const roleSelect = screen.getByDisplayValue('Admin');
    fireEvent.change(roleSelect, { target: { value: 'REVIEWER' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/users/user-12345678'));
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body)).toEqual({ role: 'REVIEWER' });
    });
  });

  it('does not deactivate a user when the confirmation dialog is cancelled', async () => {
    mockFetch({ '/config': CONFIG, '/users': [SAMPLE_USER] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    await screen.findByText('Admin User');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('✕'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });

  it('deactivates a user after confirmation', async () => {
    mockFetch({ '/config': CONFIG, '/users': [SAMPLE_USER] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.users'));
    await screen.findByText('Admin User');
    fireEvent.click(screen.getByText('✕'));

    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('/users/user-12345678');
    });
    confirmSpy.mockRestore();
  });
});

describe('SettingsPage - GovernanceSettingsTab', () => {
  it('loads existing governance settings from the tenant config', async () => {
    mockFetch({ '/config': { ...CONFIG, ai: { ...CONFIG.ai, governance: { governanceMode: 'STRICT', minReviewers: 3 } } } });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.governance'));
    expect(await screen.findByDisplayValue('Strict — Admin approval required')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  it('saves governance settings with the current form values', async () => {
    mockFetch({ '/config': CONFIG, '/config/governance-settings': { message: 'saved' } });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.governance'));
    await screen.findByText('⚖ Governance Settings');
    fireEvent.click(screen.getByText(/Save Governance Settings/));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/governance-settings'));
      expect(putCall).toBeDefined();
      expect(putCall[1].method).toBe('PUT');
    });
  });

  it('shows a success message after a successful save', async () => {
    mockFetch({ '/config': CONFIG, '/config/governance-settings': { message: 'saved' } });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.governance'));
    await screen.findByText('⚖ Governance Settings');
    fireEvent.click(screen.getByText(/Save Governance Settings/));
    expect(await screen.findByText('Governance settings saved')).toBeInTheDocument();
  });

  it('toggling the approval checkboxes correctly updates form state', async () => {
    mockFetch({ '/config': CONFIG });
    render(<SettingsPage />);
    fireEvent.click(await screen.findByText('settings.governance'));
    const checkbox = await screen.findByText('Require reviewer sign-off in addition to architect');
    const input = checkbox.closest('label')!.querySelector('input')!;
    expect(input).not.toBeChecked();
    fireEvent.click(input);
    expect(input).toBeChecked();
  });
});
