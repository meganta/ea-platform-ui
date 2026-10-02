import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrganizationSettingsPage from '../OrganizationSettingsPage';

jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ isAR: false, setLocale: jest.fn(), t: (k: string) => k }) }));
jest.mock('../../../contexts/BrandingContext', () => ({ useBranding: () => ({ branding: null, refresh: jest.fn(), reload: jest.fn() }) }));

let calls: Array<{ url: string; opts: any }> = [];
function mockFetch(routes: Record<string, any>) {
  calls = [];
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, opts?: any) => {
    calls.push({ url, opts });
    const k = keys.find(p => url.includes(p));
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(k ? routes[k] : {}) });
  }) as any;
}

beforeEach(() => localStorage.setItem('ea_token', 't'));

describe('OrganizationSettingsPage - organization classification (Phase 1.1)', () => {
  it('no longer offers the legacy Sector selector and never sends sector on save', async () => {
    mockFetch({ '/config/organization': { profile: { id: 'p', sector: 'HEALTH', industry: 'Health services' }, locale: 'EN', framework: { frameworkType: 'NORA', enabledDomains: [] } }, '/ea-repository/framework-config': {}, '/business-capabilities/organization-context': { classificationStatus: 'NEEDS_ADMIN_CONFIRMATION' } });
    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('org-classification-summary')).toHaveTextContent('Not confirmed');
    expect(screen.queryByText('Sector')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText(/^Save/));
    await waitFor(() => expect(calls.some(c => c.url.includes('/config/organization') && c.opts?.method === 'PUT')).toBe(true));
    const body = JSON.parse(calls.find(c => c.url.includes('/config/organization') && c.opts?.method === 'PUT')!.opts.body);
    expect(body).not.toHaveProperty('sector');
    expect(body.industry).toBe('Health services');
  });

  it('shows a confirmed classification', async () => {
    mockFetch({ '/config/organization': { profile: { id: 'p' }, locale: 'EN', framework: { frameworkType: 'NORA', enabledDomains: [] } }, '/ea-repository/framework-config': {}, '/business-capabilities/organization-context': { classificationStatus: 'CONFIRMED', organizationType: 'GOVERNMENT', industry: { code: 'GOV_HEALTH', labelEn: 'Health' }, jurisdiction: 'SA' } });
    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('org-classification-summary')).toHaveTextContent('Government · Health · SA');
  });
});

describe('OrganizationSettingsPage - one tenant settings source (Tenant Settings)', () => {
  const org = { profile: { id: 'p', entityType: 'MINISTRY', industry: 'Health' }, locale: 'EN', framework: { frameworkType: 'CUSTOM', enabledDomains: ['DATA'] } };

  it('loads language, framework and domains in scope from /config/organization', async () => {
    mockFetch({ '/config/organization': org, '/ea-repository/framework-config': {}, '/business-capabilities/organization-context': {} });
    render(<OrganizationSettingsPage />);
    expect(await screen.findByLabelText(/Platform Language/, { selector: 'select' })).toHaveValue('EN');
    expect(calls.some(c => c.url.includes('/setup/profile'))).toBe(false);
    expect(screen.getByRole('button', { name: /✓\s*DATA/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^BUSINESS$/ })).toBeInTheDocument();
  });

  it('saves everything in one request to /config/organization, each value under its single setting', async () => {
    mockFetch({ '/config/organization': org, '/ea-repository/framework-config': {}, '/business-capabilities/organization-context': {} });
    render(<OrganizationSettingsPage />);
    fireEvent.click(await screen.findByText(/^Save/));
    await waitFor(() => expect(calls.some(c => c.url.includes('/config/organization') && c.opts?.method === 'PUT')).toBe(true));
    const puts = calls.filter(c => c.opts?.method === 'PUT');
    expect(puts).toHaveLength(1);
    const body = JSON.parse(puts[0].opts.body);
    expect(body).toMatchObject({ locale: 'EN', frameworkType: 'CUSTOM', domainsInScope: ['DATA'], entityType: 'MINISTRY', industry: 'Health' });
    for (const k of ['language', 'preferredFramework', 'sector']) expect(body).not.toHaveProperty(k);
    expect(await screen.findByText(/Saved successfully/)).toBeInTheDocument();
  });
});
