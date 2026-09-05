import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RegisterPage from '../RegisterPage';

const mockNavigate = jest.fn();
const mockSetLocale = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}), { virtual: true });

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ locale: 'EN', setLocale: mockSetLocale, t: (k: string) => k }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('RegisterPage', () => {
  it('starts on the Organization step', () => {
    render(<RegisterPage />);
    expect(screen.getByText('Organization Details')).toBeInTheDocument();
  });

  it('auto-generates a lowercase, hyphenated slug from the organization name', () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/Organization Name/), { target: { value: 'Ministry of Health & Welfare' } });
    expect(screen.getByLabelText(/Organization ID/)).toHaveValue('ministry-of-health-welfare');
  });

  it('checks slug availability on blur and shows the result', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ available: true }) });
    render(<RegisterPage />);
    const slugInput = screen.getByLabelText(/Organization ID/);
    fireEvent.change(slugInput, { target: { value: 'my-org' } });
    fireEvent.blur(slugInput);
    expect(await screen.findByText('✓ Available')).toBeInTheDocument();
  });

  it('shows "Already taken" when the slug check reports unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ available: false }) });
    render(<RegisterPage />);
    const slugInput = screen.getByLabelText(/Organization ID/);
    fireEvent.change(slugInput, { target: { value: 'taken-org' } });
    fireEvent.blur(slugInput);
    expect(await screen.findByText('✗ Already taken')).toBeInTheDocument();
  });

  it('blocks moving to the Admin step when the org name or slug is empty', () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Organization Details')).toBeInTheDocument(); // still on step 1
  });

  it('blocks moving to the Admin step when the slug was already confirmed taken', async () => {
    global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ available: false }) });
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/Organization Name/), { target: { value: 'My Org' } });
    const slugInput = screen.getByLabelText(/Organization ID/);
    fireEvent.blur(slugInput);
    await screen.findByText('✗ Already taken');
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(await screen.findByText('Organization ID is already taken')).toBeInTheDocument();
  });

  it('advances to the Admin step when org name and slug are both filled and slug is not known-taken', () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/Organization Name/), { target: { value: 'My Org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    expect(screen.getByText('Admin Account')).toBeInTheDocument();
  });

  describe('Admin step', () => {
    function advanceToAdminStep() {
      render(<RegisterPage />);
      fireEvent.change(screen.getByLabelText(/Organization Name/), { target: { value: 'My Org' } });
      fireEvent.click(screen.getByRole('button', { name: 'Next →' }));
    }

    it('rejects submission when password and confirmation do not match', () => {
      advanceToAdminStep();
      fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'admin@test.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'different123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    it('rejects a password shorter than 8 characters', () => {
      advanceToAdminStep();
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'short' } });
      fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'short' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('returns to the Organization step when Back is clicked, preserving entered data', () => {
      advanceToAdminStep();
      fireEvent.click(screen.getByRole('button', { name: '← Back' }));
      expect(screen.getByText('Organization Details')).toBeInTheDocument();
      expect(screen.getByLabelText(/Organization Name/)).toHaveValue('My Org');
    });

    it('submits the full registration payload and shows the success step', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tenant: { name: 'My Org', slug: 'my-org' }, admin: { email: 'admin@test.com', role: 'TENANT_ADMIN' } }),
      });
      advanceToAdminStep();
      fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Admin User' } });
      fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'admin@test.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

      expect(await screen.findByText('Account Created!')).toBeInTheDocument();
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.adminEmail).toBe('admin@test.com');
      expect(body.adminFullName).toBe('Admin User');
    });

    it('displays the server error message when registration fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Email already registered' }) });
      advanceToAdminStep();
      fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'admin@test.com' } });
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
      expect(await screen.findByText('Email already registered')).toBeInTheDocument();
    });
  });
});
