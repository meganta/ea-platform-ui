import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BillingPage from '../BillingPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false }),
}));

let mockUser: any = { role: 'TENANT_ADMIN', isPlatformAdmin: false };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { role: 'TENANT_ADMIN', isPlatformAdmin: false };
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

const ENTITLEMENTS = {
  tenantId: 't1', planCode: 'STANDARD', planName: 'Standard', status: 'ACTIVE', isActive: true,
  enabledModules: ['EA_REPOSITORY', 'GOVERNANCE_REVIEW'], userAllowance: 50, aiCreditAllowance: 5000,
  trialEndsAt: null, currentPeriodEnd: '2027-01-01T00:00:00Z',
};
const SUBSCRIPTION = { id: 's1', tenantId: 't1', planId: 'p1', status: 'ACTIVE', autoRenew: true, plan: { id: 'p1', name: 'Standard' } };

describe('BillingPage - tab visibility', () => {
  it('shows only tenant tabs for a non-platform-admin', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION });
    render(<BillingPage />);
    await screen.findByText('bill.tab_subscription');
    expect(screen.queryByText('bill.tab_catalog')).not.toBeInTheDocument();
    expect(screen.queryByText('bill.tab_admin_subs')).not.toBeInTheDocument();
  });

  it('shows admin tabs for a platform admin', async () => {
    mockUser = { role: 'ARCHITECT', isPlatformAdmin: true };
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION });
    render(<BillingPage />);
    await screen.findByText('bill.tab_subscription');
    expect(screen.getByText('bill.tab_catalog')).toBeInTheDocument();
    expect(screen.getByText('bill.tab_admin_subs')).toBeInTheDocument();
    expect(screen.getByText('bill.tab_admin_contracts')).toBeInTheDocument();
    expect(screen.getByText('bill.tab_admin_payments')).toBeInTheDocument();
    expect(screen.getByText('bill.tab_admin_invoices')).toBeInTheDocument();
  });
});

describe('BillingPage - My Subscription tab', () => {
  it('shows the current plan, status, allowances, and enabled modules', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION });
    render(<BillingPage />);
    expect(await screen.findByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('5000')).toBeInTheDocument();
    expect(screen.getByText('EA_REPOSITORY')).toBeInTheDocument();
    expect(screen.getByText('GOVERNANCE_REVIEW')).toBeInTheDocument();
  });

  it('shows the empty state when there is no subscription record', async () => {
    mockFetch({ '/commercial/my-entitlements': null, '/commercial/my-subscription': null });
    render(<BillingPage />);
    expect(await screen.findByText('bill.no_subscription')).toBeInTheDocument();
  });

  it('shows unlimited for null allowances', async () => {
    const unlimited = { ...ENTITLEMENTS, userAllowance: null, aiCreditAllowance: null };
    mockFetch({ '/commercial/my-entitlements': unlimited, '/commercial/my-subscription': SUBSCRIPTION });
    render(<BillingPage />);
    await screen.findByText('Standard');
    expect(screen.getAllByText('bill.unlimited').length).toBe(2);
  });
});

describe('BillingPage - AI Usage tab (Commercial-Phase2)', () => {
  const STATUS_NORMAL = { tenantId: 't1', periodStart: '2026-08-01T00:00:00Z', periodEnd: '2026-08-31T23:59:59Z', allowance: 5000, creditsUsed: 1200, creditsRemaining: 3800, percentUsed: 24, thresholdsFired: [] };

  it('shows real usage/remaining/percentage, not just the allowance', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': STATUS_NORMAL });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    expect(await screen.findByText('1200 / 5000 bill.ai_credits_label')).toBeInTheDocument();
    expect(screen.getByText('24%')).toBeInTheDocument();
    expect(screen.getByText(/3800/)).toBeInTheDocument();
  });

  it('shows the empty state when there is no AI usage status yet', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': null });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    expect(await screen.findByText('bill.no_subscription')).toBeInTheDocument();
  });

  it('shows an "unlimited" display when allowance is null, without a percentage bar', async () => {
    const unlimitedStatus = { ...STATUS_NORMAL, allowance: null, creditsRemaining: null, percentUsed: null };
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': unlimitedStatus });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    expect(await screen.findByText(/1200 bill.ai_credits_label bill.used_this_period \(bill.unlimited\)/)).toBeInTheDocument();
  });

  it('shows a warning banner at 70%+ usage but not below it', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': { ...STATUS_NORMAL, percentUsed: 75 } });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    expect(await screen.findByText('bill.ai_allowance_warning')).toBeInTheDocument();
    expect(screen.queryByText('bill.ai_allowance_exceeded')).not.toBeInTheDocument();
  });

  it('does not show a warning banner below the 70% threshold', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': { ...STATUS_NORMAL, percentUsed: 40 } });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    await screen.findByText('40%');
    expect(screen.queryByText('bill.ai_allowance_warning')).not.toBeInTheDocument();
    expect(screen.queryByText('bill.ai_allowance_exceeded')).not.toBeInTheDocument();
  });

  it('shows the exceeded banner (not the warning banner) at 100% usage', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': { ...STATUS_NORMAL, creditsUsed: 5000, creditsRemaining: 0, percentUsed: 100 } });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    expect(await screen.findByText('bill.ai_allowance_exceeded')).toBeInTheDocument();
    expect(screen.queryByText('bill.ai_allowance_warning')).not.toBeInTheDocument();
  });

  it('displays the real period start/end dates', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/ai-usage/my-status': STATUS_NORMAL });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_ai_usage'));
    await screen.findByText('24%');
    const dateText = new Date(STATUS_NORMAL.periodStart).toLocaleDateString('en');
    expect(screen.getByText(new RegExp(dateText.replace(/\//g, '\\/')))).toBeInTheDocument();
  });
});

describe('BillingPage - Plans tab', () => {
  it('lists plans with pricing and modules', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/plans': [{ id: 'p1', code: 'STANDARD', name: 'Standard', description: 'Full core platform', priceMonthly: 15000, currency: 'SAR', userAllowance: 50, aiCreditAllowance: 5000, includedModules: ['EA_REPOSITORY'] }],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_plans'));
    expect(await screen.findByText('Standard')).toBeInTheDocument();
    expect(screen.getByText(/15,000 SAR/)).toBeInTheDocument();
  });

  it('shows custom pricing for a custom plan', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/plans': [{ id: 'p2', code: 'ENTERPRISE', name: 'Enterprise', description: '', priceMonthly: null, currency: 'SAR', userAllowance: null, aiCreditAllowance: null, includedModules: [], isCustom: true }],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_plans'));
    expect(await screen.findByText('bill.custom_pricing')).toBeInTheDocument();
  });
});

describe('BillingPage - Invoices / Payments / Contracts tabs', () => {
  it('lists invoices', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/my-invoices': [{ id: 'i1', invoiceNumber: 'INV-001', amount: 5000, currency: 'SAR', status: 'ISSUED', dueDate: '2026-09-01' }],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_invoices'));
    expect(await screen.findByText('INV-001')).toBeInTheDocument();
    expect(screen.getByText('ISSUED')).toBeInTheDocument();
  });

  it('shows the empty state for payments', async () => {
    mockFetch({ '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION, '/commercial/my-payments': [] });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_payments'));
    expect(await screen.findByText('bill.no_payments')).toBeInTheDocument();
  });

  it('lists contracts', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/my-contracts': [{ id: 'c1', contractNumber: 'CN-001', status: 'ACTIVE', startDate: '2026-01-01', value: 100000, currency: 'SAR' }],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_contracts'));
    expect(await screen.findByText('CN-001')).toBeInTheDocument();
  });
});

describe('BillingPage - Admin Catalog tab', () => {
  beforeEach(() => { mockUser = { role: 'ARCHITECT', isPlatformAdmin: true }; });

  it('lists products and plans', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/products': [{ id: 'prod1', code: 'GOVERNANCE_REVIEW', name: 'Governance Review', isActive: true, isCore: false }],
      '/commercial/admin/plans': [{ id: 'plan1', code: 'STANDARD', name: 'Standard', priceMonthly: 15000, currency: 'SAR', isActive: true }],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_catalog'));
    expect(await screen.findByText(/GOVERNANCE_REVIEW/)).toBeInTheDocument();
    expect(screen.getByText(/STANDARD/)).toBeInTheDocument();
  });

  it('creates a new product', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/products': [], '/commercial/admin/plans': [],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_catalog'));
    fireEvent.click(await screen.findByText('bill.new_product'));
    await screen.findByText('bill.name_ar');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'test_module' } });
    fireEvent.change(textboxes[1], { target: { value: 'Test Module' } });
    fireEvent.click(screen.getByText('bill.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/commercial/admin/products'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.code).toBe('TEST_MODULE');
    });
  });

  it('toggles a plan active state', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/products': [], '/commercial/admin/plans': [{ id: 'plan1', code: 'STANDARD', name: 'Standard', priceMonthly: 15000, currency: 'SAR', isActive: true }],
      '/commercial/admin/plans/plan1': {},
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_catalog'));
    fireEvent.click(await screen.findByText('Active'));
    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/commercial/admin/plans/plan1'));
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body).isActive).toBe(false);
    });
  });
});

describe('BillingPage - Admin Tenant Subscriptions tab', () => {
  beforeEach(() => { mockUser = { role: 'ARCHITECT', isPlatformAdmin: true }; });

  it('prompts to choose a tenant before showing subscription details', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/tenants': [{ id: 'tenant-1', name: 'Acme Gov', slug: 'acme', status: 'ACTIVE' }],
      '/commercial/admin/plans': [],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_admin_subs'));
    expect(await screen.findByText('bill.choose_tenant')).toBeInTheDocument();
  });

  it('loads a tenant subscription once selected and can assign a new plan', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/tenants': [{ id: 'tenant-1', name: 'Acme Gov', slug: 'acme', status: 'ACTIVE' }],
      '/commercial/admin/plans': [{ id: 'plan-2', name: 'Enterprise' }],
      '/commercial/admin/subscriptions/tenant-1': { id: 'sub1', tenantId: 'tenant-1', planId: 'plan-1', status: 'ACTIVE', plan: { id: 'plan-1', name: 'Standard' } },
      '/commercial/admin/subscriptions/tenant-1/assign-plan': {},
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_admin_subs'));
    const select = await screen.findByText('bill.select_tenant');
    fireEvent.change(select.closest('select')!, { target: { value: 'tenant-1' } });

    expect(await screen.findByText('Standard')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'bill.assign_plan' }));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('assign-plan'));
      expect(postCall).toBeDefined();
    });
  });
});

describe('BillingPage - Admin Contracts tab', () => {
  beforeEach(() => { mockUser = { role: 'ARCHITECT', isPlatformAdmin: true }; });

  it('creates a contract for a selected tenant', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/tenants': [{ id: 'tenant-1', name: 'Acme Gov', slug: 'acme', status: 'ACTIVE' }],
      '/commercial/admin/contracts': [],
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_admin_contracts'));
    fireEvent.click(await screen.findByText('bill.new_contract'));
    await screen.findByText('bill.po_number');

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'tenant-1' } }); // selects[0] is the top-level TenantPicker; selects[1] is the form's tenant select

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'CN-100' } });

    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-01-01' } });

    fireEvent.click(screen.getByText('bill.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/commercial/admin/contracts'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.contractNumber).toBe('CN-100');
    });
  });
});

describe('BillingPage - Admin Payments tab', () => {
  beforeEach(() => { mockUser = { role: 'ARCHITECT', isPlatformAdmin: true }; });

  it('records a payment for a selected tenant', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/tenants': [{ id: 'tenant-1', name: 'Acme Gov', slug: 'acme', status: 'ACTIVE' }],
      '/commercial/admin/payments?tenantId=tenant-1': [],
      '/commercial/admin/payments': {},
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_admin_payments'));
    const select = await screen.findByText('bill.select_tenant');
    fireEvent.change(select.closest('select')!, { target: { value: 'tenant-1' } });

    fireEvent.click(await screen.findByText('bill.record_payment'));
    await screen.findByText('bill.method');
    const amountInput = screen.getAllByRole('spinbutton')[0];
    fireEvent.change(amountInput, { target: { value: '5000' } });
    fireEvent.click(screen.getByText('bill.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/commercial/admin/payments'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.tenantId).toBe('tenant-1');
      expect(body.amount).toBe(5000);
    });
  });
});

describe('BillingPage - Admin Invoices tab', () => {
  beforeEach(() => { mockUser = { role: 'ARCHITECT', isPlatformAdmin: true }; });

  it('issues a draft invoice', async () => {
    mockFetch({
      '/commercial/my-entitlements': ENTITLEMENTS, '/commercial/my-subscription': SUBSCRIPTION,
      '/commercial/admin/tenants': [{ id: 'tenant-1', name: 'Acme Gov', slug: 'acme', status: 'ACTIVE' }],
      '/commercial/admin/invoices': [{ id: 'inv1', tenantId: 'tenant-1', invoiceNumber: 'INV-050', amount: 1000, currency: 'SAR', status: 'DRAFT' }],
      '/commercial/admin/invoices/inv1/issue': {},
    });
    render(<BillingPage />);
    fireEvent.click(await screen.findByText('bill.tab_admin_invoices'));
    fireEvent.click(await screen.findByText('bill.issue'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/commercial/admin/invoices/inv1/issue'));
      expect(postCall).toBeDefined();
    });
  });
});
