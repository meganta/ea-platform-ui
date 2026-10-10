import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: mockIsAR }),
}));

const mockHasPermission = jest.fn((_code: string) => true);
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ hasPermission: (code: string) => mockHasPermission(code), user: { role: 'ARCHITECT' } }),
}));

jest.mock('../../contexts/BrandingContext', () => ({
  useBranding: () => ({ branding: { organizationNameEn: 'HRDF', organizationNameAr: 'صندوق الموارد' } }),
}));

jest.mock('../../lib/api', () => ({ getToken: () => 'fake-token' }));

const HEALTH = {
  domains: [
    { domain: { code: 'BUSINESS', name: 'Business', nameAr: 'الأعمال' }, objectCount: 100, completeness: 50, relationshipCompleteness: 40, referenceCoverage: null,
      maturity: { score: 30, level: 2, targetLevel: 3, gapPoints: 10 } },
    { domain: { code: 'APPLICATION', name: 'Application' }, objectCount: 300, completeness: 70, relationshipCompleteness: 60, referenceCoverage: 80,
      maturity: { score: 70, level: 4, targetLevel: 3, gapPoints: 0 } },
  ],
  topActions: [{ code: 'OWNERS', priority: 'CRITICAL', problem: 'Applications have no owner', action: 'Record owners' }],
};
const INSIGHTS = { insights: [
  { key: 'i1', kind: 'GAP', severity: 'HIGH', title: 'Servers lack lifecycle' },
  { key: 'i2', kind: 'PROGRESS', severity: 'POSITIVE', title: 'Completeness rose 5 points' },
] };
const GOV = {
  summary: { completedReviews: 4, avgOverallScore: 72, criticalOpenFindings: 2 },
  decisions: { APPROVED: 2, REJECTED: 1, REQUIRES_CHANGES: 1 },
  findingsBySeverity: { CRITICAL: 2, HIGH: 5 },
  monthlyTrend: [{ label: 'Sep', count: 3, avgScore: 70 }],
};
const SUMMARY = { total: 400, byStatus: [{ status: 'APPROVED', count: 250 }, { status: 'DEPRECATED', count: 12 }], byDomain: [{ domain: 'APPLICATION', operatingDomainDisplayName: 'Application', count: 300 }] };

let responses: Record<string, any>;
beforeEach(() => {
  jest.clearAllMocks();
  mockIsAR = false;
  mockHasPermission.mockReturnValue(true);
  responses = {
    '/ea-repository/summary': SUMMARY,
    '/architecture-health/enterprise': HEALTH,
    '/architecture-health/insights': INSIGHTS,
    '/governance/stats': GOV,
    '/governance/reviews': { data: [{ id: 'r1', title: 'CRM review', reviewType: 'SOLUTION_DESIGN', status: 'COMPLETED', decision: 'APPROVED', overallScore: 81, createdAt: '2026-09-01' }] },
    '/ea-planning/dashboard': { total: 3, active: 2, highRisk: 1, avgProgress: 45, byStatus: { ACTIVE: 2, DRAFT: 1 } },
    '/adm/cycles': [{ id: 'c1', name: 'NORA cycle', frameworkType: 'NORA', phases: [{ status: 'COMPLETE' }, { status: 'IN_PROGRESS' }] }],
  };
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const key = Object.keys(responses).find(k => url.includes(k));
    const body = key ? responses[key] : null;
    return Promise.resolve({ ok: body != null, json: () => Promise.resolve(body) });
  }) as any;
});

const fetched = () => (global.fetch as jest.Mock).mock.calls.map(c => c[0] as string);

describe('DashboardPage', () => {
  it('shows the headline KPIs computed from the platform records', async () => {
    render(<DashboardPage />);
    await screen.findByText('dashboard.kpi.objects');
    expect(screen.getByText('400')).toBeInTheDocument();
    // object-weighted maturity: (30*100 + 70*300) / 400 = 60 -> level 4
    expect(screen.getByText('dashboard.kpi.maturity_value')).toBeInTheDocument();
    // object-weighted completeness: (50*100 + 70*300) / 400 = 65
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('72/100')).toBeInTheDocument();
    expect(screen.getAllByText('45%').length).toBeGreaterThan(0);
    expect(screen.getByText(/HRDF/)).toBeInTheDocument();
  });

  it('lists domains furthest from target first and opens a domain in Architecture Health', async () => {
    render(<DashboardPage />);
    const rows = await screen.findAllByRole('row');
    expect(rows[1]).toHaveTextContent('Business');
    expect(rows[2]).toHaveTextContent('Application');
    expect(rows[1]).toHaveTextContent('—'); // reference coverage not measurable
    fireEvent.click(rows[1]);
    expect(mockNavigate).toHaveBeenCalledWith('/architecture-health?domain=BUSINESS');
  });

  it('puts critical items first in Needs attention and keeps good news apart', async () => {
    render(<DashboardPage />);
    await screen.findByText('Applications have no owner');
    const items = screen.getAllByRole('listitem').map(li => li.textContent || '');
    const owners = items.findIndex(x => x.includes('Applications have no owner'));
    const servers = items.findIndex(x => x.includes('Servers lack lifecycle'));
    expect(owners).toBeLessThan(servers);
    expect(screen.getByText('dashboard.attention.critical_findings')).toBeInTheDocument();
    expect(screen.getByText('dashboard.attention.good_news')).toBeInTheDocument();
    expect(screen.getByText(/Completeness rose 5 points/)).toBeInTheDocument();
  });

  it('shows governance decisions, findings, trend and the latest reviews', async () => {
    render(<DashboardPage />);
    await screen.findByText('CRM review');
    expect(screen.getByText('dashboard.gov.decisions')).toBeInTheDocument();
    expect(screen.getByText('dashboard.gov.findings')).toBeInTheDocument();
    expect(screen.getByText('dashboard.gov.trend')).toBeInTheDocument();
    expect(screen.getByText('81')).toBeInTheDocument();
  });

  it('shows delivery with plan counts and ADM cycle phase progress', async () => {
    render(<DashboardPage />);
    await screen.findByText('NORA cycle');
    expect(screen.getByText(/dashboard\.delivery\.phase/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('NORA cycle'));
    expect(mockNavigate).toHaveBeenCalledWith('/adm');
  });

  it('fetches only the sources the user may see', async () => {
    mockHasPermission.mockImplementation((code: string) => code === 'Reviews.View');
    render(<DashboardPage />);
    await screen.findByText('CRM review');
    expect(fetched().some(u => u.includes('/governance/stats'))).toBe(true);
    expect(fetched().some(u => u.includes('/architecture-health'))).toBe(false);
    expect(fetched().some(u => u.includes('/ea-repository/summary'))).toBe(false);
    expect(screen.queryByText('dashboard.domains.title')).not.toBeInTheDocument();
    expect(screen.queryByText('dashboard.qa.repository')).not.toBeInTheDocument();
  });

  it('keeps working when a source fails', async () => {
    responses['/architecture-health/enterprise'] = null;
    render(<DashboardPage />);
    await screen.findByText('dashboard.domains.title');
    expect(screen.getByText('dashboard.unavailable')).toBeInTheDocument();
    expect(screen.getByText('400')).toBeInTheDocument();
  });

  it('says so when no review has been completed', async () => {
    responses['/governance/stats'] = { summary: { completedReviews: 0 } };
    render(<DashboardPage />);
    expect(await screen.findByText('dashboard.gov.none')).toBeInTheDocument();
    expect(screen.queryByText('dashboard.kpi.governance')).not.toBeInTheDocument();
  });

  it('renders right-to-left with Arabic domain names', async () => {
    mockIsAR = true;
    const { container } = render(<DashboardPage />);
    await screen.findByText('الأعمال');
    expect(container.querySelector('.dsh')).toHaveAttribute('dir', 'rtl');
  });

  it('quick actions and refresh', async () => {
    render(<DashboardPage />);
    await screen.findByText('dashboard.kpi.objects');
    fireEvent.click(screen.getByText('dashboard.qa.copilot'));
    expect(mockNavigate).toHaveBeenCalledWith('/copilot');
    const before = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'dashboard.refresh' }));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(before));
  });
});
