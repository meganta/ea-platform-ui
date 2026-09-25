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
    mockFetch({ '/setup/profile': { id: 'p', sector: 'HEALTH', industry: 'Health services' }, '/ea-repository/framework-config': {}, '/business-capabilities/organization-context': { classificationStatus: 'NEEDS_ADMIN_CONFIRMATION' }, '/config/framework': {} });
    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('org-classification-summary')).toHaveTextContent('Not confirmed');
    expect(screen.queryByText('Sector')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByText(/^Save/));
    await waitFor(() => expect(calls.some(c => c.url.includes('/setup/profile') && c.opts?.method === 'PUT')).toBe(true));
    const body = JSON.parse(calls.find(c => c.url.includes('/setup/profile') && c.opts?.method === 'PUT')!.opts.body);
    expect(body).not.toHaveProperty('sector');
    expect(body.industry).toBe('Health services');
  });

  it('shows a confirmed classification', async () => {
    mockFetch({ '/setup/profile': { id: 'p' }, '/ea-repository/framework-config': {}, '/business-capabilities/organization-context': { classificationStatus: 'CONFIRMED', organizationType: 'GOVERNMENT', industry: { code: 'GOV_HEALTH', labelEn: 'Health' }, jurisdiction: 'SA' } });
    render(<OrganizationSettingsPage />);
    expect(await screen.findByTestId('org-classification-summary')).toHaveTextContent('Government · Health · SA');
  });
});
