import { fireEvent, render, screen } from '@testing-library/react';
import Layout from '../Layout';

let mockLocale = 'EN';
let mockPermission = true;
let mockPerms: string[] | null = null;
jest.mock('react-router-dom', () => ({
  Outlet: () => <div>Platform homepage</div>,
  NavLink: ({ to, children, className }: any) => <a href={to} onClick={e => e.preventDefault()} className={typeof className === 'function' ? className({ isActive: false }) : className}>{children}</a>,
  useNavigate: () => jest.fn(), useLocation: () => ({ pathname: '/app' }),
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { email: 'user@example.com', role: 'ARCHITECT' }, logout: jest.fn(), hasPermission: (c: string) => (mockPerms ? mockPerms.includes(c) : mockPermission) }) }));
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ locale: mockLocale, setLocale: jest.fn(), t: (k: string) => k }) }));
jest.mock('../../contexts/BrandingContext', () => ({ useBranding: () => ({ branding: null, logoUrl: null }) }));
jest.mock('../../pages/SetupAssistantPage', () => () => null);
jest.mock('../NotificationBell', () => () => <button>Notifications</button>);

beforeEach(() => { mockLocale = 'EN'; mockPermission = true; mockPerms = null; localStorage.clear(); });

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

describe('the menu follows the roles in Access Governance', () => {
  const links = () => screen.getAllByRole('link').map(a => a.getAttribute('href'));

  it('an innovation-only role sees the Innovation module and no administration', () => {
    mockPerms = ['Innovation.View', 'Innovation.ManageOwnPosition'];
    render(<Layout />);
    expect(links()).toContain('/innovation');
    for (const to of ['/repository', '/adm', '/copilot', '/access-governance', '/getting-started']) expect(links()).not.toContain(to);
    expect(screen.queryByRole('button', { name: /Settings/ })).not.toBeInTheDocument();
  });

  it('a role with every module permission but no settings sees every module and no Settings or Access Governance', () => {
    mockPerms = ['Repository.View', 'AIArchitect.Use', 'Reviews.View', 'DecisionEvaluation.ViewAssessments', 'Strategy.View', 'Innovation.View', 'MetaModel.View', 'Views.View', 'Connector.View', 'ReferenceArchitecture.View', 'ArchitectureHealth.View', 'BusinessCapability.View', 'Surveys.Respond'];
    render(<Layout />);
    for (const to of ['/adm', '/copilot', '/governance', '/decision-evaluation', '/innovation', '/connector-hub', '/glossary', '/repository', '/ea-views']) expect(links()).toContain(to);
    for (const to of ['/access-governance', '/getting-started']) expect(links()).not.toContain(to);
    expect(screen.queryByRole('button', { name: /Settings/ })).not.toBeInTheDocument();
  });

  it('an administrator role reaches Settings and Access Governance; Users and Demo requests are no longer separate menu items', () => {
    mockPerms = ['Repository.View', 'Settings.Manage', 'Roles.View', 'Tenant.Administer'];
    render(<Layout />);
    expect(links()).toEqual(expect.arrayContaining(['/access-governance', '/getting-started']));
    fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    expect(links()).toEqual(expect.arrayContaining(['/settings/organization', '/settings/ai']));
    expect(links()).not.toContain('/settings/users');
    expect(links()).not.toContain('/demo-requests');
  });
});
