import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '../LoginPage';

const mockLogin = jest.fn();
const mockSetLocale = jest.fn();
const mockNavigate = jest.fn();
let mockSearchParams = new URLSearchParams();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({
    t: (key: string) => ({
      'auth.tagline': 'Enterprise Architecture Platform',
      'auth.signin': 'Sign In',
      'auth.signin_loading': 'Signing in…',
      'auth.organization': 'Organization ID',
      'auth.email': 'Email',
      'auth.password': 'Password',
    } as Record<string, string>)[key] || key,
    locale: 'EN',
    setLocale: mockSetLocale,
  }),
}));

function renderLoginPage() {
  return render(<LoginPage />);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  global.fetch = jest.fn().mockResolvedValue({ ok: false }); // no branding by default
});

afterEach(() => {
  jest.restoreAllMocks(); // undoes any jest.spyOn(window, 'location', 'get') so it doesn't leak into later tests
});

describe('LoginPage', () => {
  it('renders the sign-in form with organization, email, and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Organization ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('defaults the organization field to "demo" when no ?org= query param is present', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Organization ID')).toHaveValue('demo');
  });

  it('pre-fills the organization field from a ?org= query param', () => {
    mockSearchParams = new URLSearchParams('org=acme-corp');
    renderLoginPage();
    expect(screen.getByLabelText('Organization ID')).toHaveValue('acme-corp');
  });

  it('auto-selects the monshaat tenant and hides the organization field on monshaat.archmindworks.com', async () => {
    jest.spyOn(window, 'location', 'get').mockReturnValue({ hostname: 'monshaat.archmindworks.com' } as any);
    mockLogin.mockResolvedValue(undefined);
    renderLoginPage();

    expect(screen.queryByLabelText('Organization ID')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@monshaat.reference.archmind.local' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'ArchMind-Ref-2026!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@monshaat.reference.archmind.local', 'ArchMind-Ref-2026!', 'monshaat');
    });
  });

  it('calls login() with the entered credentials on submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Admin1234!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'Admin1234!', 'demo');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/app');
  });

  it('displays the error message when login() rejects', async () => {
    mockLogin.mockRejectedValue(new Error('Invalid credentials'));
    renderLoginPage();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  it('falls back to a generic error message when the rejection has no message', async () => {
    mockLogin.mockRejectedValue({});
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(await screen.findByText('Login failed')).toBeInTheDocument();
  });

  it('disables the submit button and shows a loading label while the login request is in flight', async () => {
    let resolveLogin: () => void;
    mockLogin.mockReturnValue(new Promise<void>(resolve => { resolveLogin = resolve; }));
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
    resolveLogin!();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' })).not.toBeDisabled());
  });

  it('toggles locale between EN and AR when the language button is clicked', () => {
    renderLoginPage();
    fireEvent.click(screen.getByText('🌐 العربية'));
    expect(mockSetLocale).toHaveBeenCalledWith('AR');
  });

  it('requires email, password, and organization fields (native HTML validation)', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Email')).toBeRequired();
    expect(screen.getByLabelText('Password')).toBeRequired();
    expect(screen.getByLabelText('Organization ID')).toBeRequired();
  });

  it('renders the password field with type="password" so credentials are masked', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
  });
});
