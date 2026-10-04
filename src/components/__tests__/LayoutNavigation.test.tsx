import { fireEvent, render, screen } from '@testing-library/react';
import Layout from '../Layout';

let mockLocale = 'EN';
let mockPermission = true;
jest.mock('react-router-dom', () => ({
  Outlet: () => <div>Platform homepage</div>,
  NavLink: ({ to, children, className }: any) => <a href={to} onClick={e => e.preventDefault()} className={typeof className === 'function' ? className({ isActive: false }) : className}>{children}</a>,
  useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/app' }),
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'user@example.com', role: 'ARCHITECT' }, logout: jest.fn(), hasPermission: () => mockPermission }) }));
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ locale: mockLocale, setLocale: jest.fn(), t: (k: string) => k }) }));
jest.mock('../../contexts/BrandingContext', () => ({ useBranding: () => ({ branding: null, logoUrl: null }) }));
jest.mock('../../pages/SetupAssistantPage', () => () => null);
jest.mock('../NotificationBell', () => () => <button>Notifications</button>);

beforeEach(() => { mockLocale = 'EN'; mockPermission = true; localStorage.clear(); });

it('opens the module drawer from the homepage and restores focus after Escape', () => {
  render(<Layout />);
  const toggle = screen.getByRole('button', { name: 'Platform modules' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getByRole('dialog', { name: 'Platform modules' })).toHaveClass('open');
  expect(screen.getByText('Platform homepage').parentElement).toHaveAttribute('inert');
  expect(screen.getByRole('button', { name: 'Close modules menu' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Platform homepage').parentElement).not.toHaveAttribute('inert');
});

it('keeps keyboard focus inside the drawer and closes when selecting a module', () => {
  render(<Layout />);
  fireEvent.click(screen.getByRole('button', { name: 'Platform modules' }));
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(screen.getByRole('button', { name: 'auth.signout' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(screen.getByRole('button', { name: 'Close modules menu' })).toHaveFocus();
  fireEvent.click(screen.getByRole('link', { name: /nav.copilot/ }));
  expect(screen.getByRole('button', { name: 'Platform modules' })).toHaveAttribute('aria-expanded', 'false');
});

it('retains permission filtering and Arabic menu labels and direction', () => {
  mockPermission = false; mockLocale = 'AR';
  const { container } = render(<Layout />);
  fireEvent.click(screen.getByRole('button', { name: 'وحدات المنصة' }));
  expect(screen.getByRole('button', { name: 'إغلاق قائمة الوحدات' })).toBeInTheDocument();
  expect(container.firstChild).toHaveAttribute('dir', 'rtl');
  expect(screen.queryByRole('link', { name: /nav.copilot/ })).not.toBeInTheDocument();
});
