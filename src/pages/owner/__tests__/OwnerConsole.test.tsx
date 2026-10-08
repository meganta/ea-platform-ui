import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { OWNER_TRANSLATIONS } from '../ownerStrings';

const mockNavigate = jest.fn();
let mockParams: Record<string, string> = {};
let mockSearch = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useSearchParams: () => [mockSearch, (p: URLSearchParams) => { mockSearch = p; }],
  Navigate: ({ to }: any) => <div data-testid="navigate">{to}</div>,
  NavLink: ({ to, children, className }: any) => <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className}>{children}</a>,
  Outlet: () => <div data-testid="outlet" />,
}), { virtual: true });

let mockUser: any = null;
const mockEnterTenant = jest.fn();
const mockExitTenant = jest.fn();
const mockLogout = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, loading: false, enterTenant: mockEnterTenant, exitTenant: mockExitTenant, logout: mockLogout }),
  isPlatformOwner: (u: any) => !!u && u.platformRole === 'PLATFORM_OWNER' && !u.delegatedAccess,
}));

jest.mock('../../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false, locale: 'EN', setLocale: jest.fn() }),
}));

const mockStore: Record<string, jest.Mock> = {};
const api: Record<string, jest.Mock> = new Proxy({} as Record<string, jest.Mock>, { get: (_t, k: string) => (mockStore[k] ||= jest.fn()) });
jest.mock('../ownerApi', () => {
  const actual = jest.requireActual('../ownerApi');
  return { ...actual, ownerApi: new Proxy({}, { get: (_t, k: string) => (mockStore[k] ||= jest.fn()) }) };
});

/* eslint-disable import/first */
import OwnerLayout, { OwnerRoute } from '../OwnerLayout';
import OwnerDashboardPage from '../OwnerDashboardPage';
import OwnerTenantsPage from '../OwnerTenantsPage';
import OwnerTenantDetailPage from '../OwnerTenantDetailPage';
import EnrichmentPanel from '../EnrichmentPanel';
import OwnerAuditPage from '../OwnerAuditPage';
import OwnerSettingsPage from '../OwnerSettingsPage';
import OwnerDemoRequestsPage from '../OwnerDemoRequestsPage';
import DelegatedAccessBanner from '../../../components/DelegatedAccessBanner';

const OWNER = { userId: 'o', email: 'owner@archmind.sa', role: 'ARCHITECT', tenantId: 'home', platformRole: 'PLATFORM_OWNER', delegatedAccess: null };

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockUser = OWNER;
  mockParams = {};
  mockSearch = new URLSearchParams();
});

const TENANT_ROW = { id: 't1', slug: 'fund', name: 'Example Fund', nameAr: null, status: 'ACTIVE', sector: 'Labour', users: 4, createdAt: '2026-10-01T00:00:00Z', officialWebsite: 'https://fund.sa', repository: { total: 120, relationships: 80, counts: { APPLICATION: 12, CAPABILITY: 30 } }, assessment: { eaLevel: 2, eaLevelName: 'Managed', healthScore: 54, adoption: { inUse: 3, tracked: 9 }, computedAt: '2026-10-07T00:00:00Z' } };

describe('Owner route guard and shell', () => {
  it('admits a platform owner and shows the owner shell with its own navigation', () => {
    render(<OwnerRoute><OwnerLayout /></OwnerRoute>);
    expect(screen.getByText('owner.band')).toBeInTheDocument();
    expect(screen.getByText('owner.nav.tenants')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it.each([
    ['tenant admin', { ...OWNER, platformRole: null, role: 'TENANT_ADMIN' }],
    ['tenant superadmin', { ...OWNER, platformRole: null, role: 'SUPERADMIN' }],
    ['owner inside a delegated tenant session', { ...OWNER, delegatedAccess: { sessionId: 's' } }],
  ])('sends a %s back to the tenant workspace', (_l, user) => {
    mockUser = user;
    render(<OwnerRoute><div>secret</div></OwnerRoute>);
    expect(screen.getByTestId('navigate')).toHaveTextContent('/app');
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to login', () => {
    mockUser = null;
    render(<OwnerRoute><div>secret</div></OwnerRoute>);
    expect(screen.getByTestId('navigate')).toHaveTextContent('/login');
  });
});

describe('OwnerDashboardPage', () => {
  it('shows platform totals, quality, maturity distribution and the tenant table', async () => {
    api.dashboard.mockResolvedValue({
      tenants: { total: 3, active: 2, suspended: 1, createdLast30Days: 1, recent: [{ id: 't1', name: 'Example Fund', createdAt: '2026-10-01T00:00:00Z' }] },
      repository: { objects: 300, relationships: 150, reviews: 4, concepts: { applications: 12, capabilities: 30 }, quality: { withoutOwner: 7, withoutRelationship: 9, stale: 2, withoutLifecycle: 3, capabilitiesNotTraced: 11, basis: 'Sum over 3 tenants' } },
      assessment: { tenantsAssessed: 3, averageHealth: 51, maturityDistribution: [{ level: 1, tenants: 1 }, { level: 2, tenants: 2 }, { level: 3, tenants: 0 }, { level: 4, tenants: 0 }, { level: 5, tenants: 0 }], note: 'not a ranking' },
      rows: [TENANT_ROW],
    });
    render(<OwnerDashboardPage />);
    expect(await screen.findByText('owner.dash.q.capabilitiesNotTraced')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('not a ranking')).toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Example Fund')[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/owner/tenants/t1');
  });

  it('shows the error with retry', async () => {
    api.dashboard.mockRejectedValue(new Error('Platform owner access required'));
    render(<OwnerDashboardPage />);
    expect(await screen.findByText(/Platform owner access required/)).toBeInTheDocument();
  });
});

describe('OwnerTenantsPage', () => {
  it('lists tenants and creates one from name + portal with AI discovery', async () => {
    api.tenants.mockResolvedValue([TENANT_ROW]);
    api.createTenant.mockResolvedValue({ tenant: { id: 'new', name: 'New Authority', slug: 'new-authority' }, provisioning: { branding: { status: 'DONE' }, metaModel: { status: 'DONE', detail: 'NORA_2_0 published' }, adminInvitation: { status: 'SKIPPED' } }, enrichmentJob: { id: 'j1' } });
    mockSearch = new URLSearchParams('create=1');
    render(<OwnerTenantsPage />);
    expect(await screen.findByText('Example Fund')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('owner.create.name'), { target: { value: 'New Authority' } });
    fireEvent.change(screen.getByLabelText('owner.create.website'), { target: { value: 'new.gov.sa' } });
    fireEvent.click(screen.getByRole('button', { name: 'owner.create.submit' }));
    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    expect(api.createTenant.mock.calls[0][0]).toMatchObject({ organizationName: 'New Authority', officialWebsite: 'new.gov.sa', startDiscovery: true, frameworkType: 'NORA', referencePack: true });
    expect(api.createTenant.mock.calls[0][0].industry).toBeUndefined();
    expect(await screen.findByText(/NORA_2_0 published/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'owner.create.open' }));
    expect(mockNavigate).toHaveBeenCalledWith('/owner/tenants/new?tab=enrichment');
  });

  it('a government organization can be given its industry for its reference pack', async () => {
    api.tenants.mockResolvedValue([]);
    api.createTenant.mockResolvedValue({ tenant: { id: 'n', name: 'X', slug: 'x' }, provisioning: { referencePack: { status: 'DONE', detail: '9 reference models and architectures' } } });
    mockSearch = new URLSearchParams('create=1');
    render(<OwnerTenantsPage />);
    fireEvent.change(screen.getByLabelText('owner.create.name'), { target: { value: 'Health Org' } });
    fireEvent.change(screen.getByLabelText(/owner.create.industry/, { selector: 'select' }), { target: { value: 'GOV_HEALTH' } });
    fireEvent.click(screen.getByRole('button', { name: 'owner.create.submit' }));
    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    expect(api.createTenant.mock.calls[0][0]).toMatchObject({ industry: 'GOV_HEALTH', referencePack: true });
    expect(await screen.findByText(/9 reference models and architectures/)).toBeInTheDocument();
  });

  it('hides the reference pack choice for a private organization and does not send it', async () => {
    api.tenants.mockResolvedValue([]);
    api.createTenant.mockResolvedValue({ tenant: { id: 'n', name: 'X', slug: 'x' }, provisioning: {} });
    mockSearch = new URLSearchParams('create=1');
    render(<OwnerTenantsPage />);
    fireEvent.change(screen.getByLabelText('owner.create.name'), { target: { value: 'X Co' } });
    fireEvent.change(screen.getByLabelText('owner.create.org_type'), { target: { value: 'PRIVATE' } });
    expect(screen.queryByLabelText(/owner.create.industry/, { selector: 'select' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'owner.create.submit' }));
    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    expect(api.createTenant.mock.calls[0][0]).not.toHaveProperty('referencePack');
    expect(api.createTenant.mock.calls[0][0]).not.toHaveProperty('industry');
  });

  it('does not ask for discovery without a portal', async () => {
    api.tenants.mockResolvedValue([]);
    api.createTenant.mockResolvedValue({ tenant: { id: 'n', name: 'X', slug: 'x' }, provisioning: {} });
    mockSearch = new URLSearchParams('create=1');
    render(<OwnerTenantsPage />);
    fireEvent.change(screen.getByLabelText('owner.create.name'), { target: { value: 'X Org' } });
    fireEvent.click(screen.getByRole('button', { name: 'owner.create.submit' }));
    await waitFor(() => expect(api.createTenant).toHaveBeenCalled());
    expect(api.createTenant.mock.calls[0][0].startDiscovery).toBe(false);
  });

  it('comparison tab sorts without ranking language', async () => {
    api.tenants.mockResolvedValue([TENANT_ROW]);
    api.comparison.mockResolvedValue([{ id: 't1', name: 'Example Fund', eaMaturity: 2, repositoryHealth: 54, objects: 120, adoption: { inUse: 3, tracked: 9 } }, { id: 't2', name: 'Alpha', eaMaturity: null, repositoryHealth: null, objects: 5 }]);
    render(<OwnerTenantsPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'owner.tenants.compare' }));
    expect(await screen.findByText('owner.tenants.compare_note')).toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Alpha');
  });
});

const DETAIL = {
  tenant: { id: 't1', slug: 'fund', name: 'Example Fund', status: 'ACTIVE', createdAt: '2026-10-01T00:00:00Z' },
  branding: null, profile: { officialWebsite: 'https://fund.sa', country: 'Saudi Arabia', sector: 'Labour', organizationType: 'GOVERNMENT' },
  metaModel: { name: 'Fund Meta Model', published: { version: '1.0' } },
  users: { total: 3, active: 3, pendingInvitations: 1, admins: [{ email: 'admin@fund.sa' }] },
  activeAccessSessions: [], latestEnrichmentJob: null,
};
const ASSESSMENT = {
  computedAt: '2026-10-07T00:00:00Z',
  facts: { conceptCounts: { BENEFICIARY: 3, SERVICE: 10, JOURNEY: 2 }, links: { SERVICE_BENEFICIARY: 4, JOURNEY_SERVICE: 1, JOURNEY_CHANNEL: 0 } },
  conceptCounts: [{ key: 'APPLICATION', group: 'APPLICATION', count: 12 }, { key: 'BENEFICIARY', group: 'BENEFICIARY', count: 3 }],
  maturity: { level: 2, targetLevel: 3, method: 'median of domains', domains: [
    { key: 'APPLICATION', label: 'Application architecture', labelAr: 'x', assessed: true, level: 2, criteria: [{ id: 'PORTFOLIO', level: 2, label: 'Portfolio exists', met: true, evidence: '12 applications recorded (needs 5)' }, { id: 'APPS_TO_CAPABILITIES_50', level: 3, label: 'Half mapped', met: false, evidence: '2 of 12 applications mapped (17%; needs 50%)' }], nextLevelGaps: [{ label: 'Half mapped' }] },
    { key: 'BENEFICIARY', label: 'Beneficiary experience', labelAr: 'x', assessed: true, level: 2, criteria: [], nextLevelGaps: [] },
    { key: 'DATA', label: 'Data architecture', labelAr: 'x', assessed: false, level: null, notAssessedReason: 'No data domains', criteria: [], nextLevelGaps: [] },
  ] },
  health: { score: 48, method: 'Unweighted mean', coverage: [{ present: true }, { present: false }], indicators: [{ key: 'completeness', label: 'Completeness', description: 'Objects with a description', ratio: { numerator: 6, denominator: 12, value: 0.5 } }] },
  adoption: { modulesInUse: 2, modulesTracked: 9, method: 'Not weighted', modules: [{ key: 'repository', label: 'EA Repository', count: 12, inUse: true, measure: 'objects' }] },
  trend: [],
};

describe('OwnerTenantDetailPage', () => {
  beforeEach(() => {
    mockParams = { tenantId: 't1' };
    api.tenant.mockResolvedValue(DETAIL);
    api.me.mockResolvedValue({ capabilities: { webSearch: false } });
    api.maturity.mockResolvedValue(ASSESSMENT);
  });

  it('overview shows the profile and Meta Model', async () => {
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText('https://fund.sa', { selector: 'a' })).toBeInTheDocument();
    expect(screen.getByText('Fund Meta Model · v1.0')).toBeInTheDocument();
  });

  it('maturity tab drills down from domain to criterion evidence', async () => {
    mockParams = { tenantId: 't1', tab: 'maturity' };
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText('Application architecture')).toBeInTheDocument();
    expect(screen.getByText('2 of 12 applications mapped (17%; needs 50%)')).toBeInTheDocument();
    expect(screen.getByText('No data domains')).toBeInTheDocument();
    expect(screen.getByText('6 / 12')).toBeInTheDocument();
  });

  it('beneficiaries tab shows beneficiary traceability', async () => {
    mockParams = { tenantId: 't1', tab: 'beneficiaries' };
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText('4 / 10 (40%)')).toBeInTheDocument();
  });

  it('entering a tenant asks a reason and the password, then switches to the delegated session', async () => {
    api.enter.mockResolvedValue({ accessToken: 'delegated', session: { id: 's1' } });
    render(<OwnerTenantDetailPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'owner.enter.button' }));
    fireEvent.change(screen.getByLabelText('owner.reason'), { target: { value: 'Support ticket 42 configuration' } });
    fireEvent.change(screen.getByLabelText('owner.password'), { target: { value: 'Owner1234!' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'owner.enter.button' }).slice(-1)[0]);
    await waitFor(() => expect(api.enter).toHaveBeenCalledWith('t1', { reason: 'Support ticket 42 configuration', password: 'Owner1234!', durationMinutes: 30 }));
    expect(mockEnterTenant).toHaveBeenCalledWith('delegated');
    expect(mockNavigate).toHaveBeenCalledWith('/app');
  });

  it('views tab lists eligibility and prepares ready views', async () => {
    mockParams = { tenantId: 't1', tab: 'views' };
    api.viewRecommendations.mockResolvedValue([
      { viewpointId: 'v1', code: 'APP_CAPABILITY_MATRIX', name: 'Application ↔ Capability', purpose: 'Which applications support which capabilities?', status: 'READY', value: { score: 92, breakdown: [{ factor: 'Relationship coverage', points: 40, weight: 40 }] }, whyRecommended: '30 CAPABILITY exist', recommendation: null, existingViewIds: [], recommendedVisualization: 'MATRIX' },
      { viewpointId: 'v2', code: 'JOURNEY_CHANNEL_MAP', name: 'Journey → Channel', purpose: 'q', status: 'RECOMMENDED_AFTER_ENRICHMENT', value: { score: 30, breakdown: [] }, whyRecommended: 'no links', recommendation: 'Run Relationship Discovery', existingViewIds: [], recommendedVisualization: 'GRAPH' },
    ]);
    api.prepareViews.mockResolvedValue({ prepared: [{ viewId: 'x' }], skipped: [] });
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText('Run Relationship Discovery')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'owner.views.prepare (1)' }));
    await waitFor(() => expect(api.prepareViews).toHaveBeenCalledWith('t1'));
    expect(await screen.findByText('owner.views.prepared')).toBeInTheDocument();
  });

  it('recommendations tab shows next best actions and traceable recommendations', async () => {
    mockParams = { tenantId: 't1', tab: 'recommendations' };
    api.recommendations.mockResolvedValue({
      nextBestActions: [{ id: 'REVIEW_DISCOVERIES', text: 'Validate the AI-discovered items awaiting review: 6 journeys.', reason: 'r', route: 'enrichment:j1', source: 'ENRICHMENT', priority: 'HIGH' }],
      recommendations: [{ id: 'APP_CAPABILITY_MAPPING', priority: 'HIGH', gap: 'Applications are not mapped to business capabilities.', whyItMatters: 'w', evidence: '10 of 12 applications have no link to a capability.', action: 'Map the 10 unmapped applications', expectedImprovement: 'Meets level 3', suggestedRole: 'Application Architect', timeframe: '2-4 weeks', archmindCapability: { label: 'EA Views', route: '/ea-views' } }],
    });
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText(/6 journeys/)).toBeInTheDocument();
    expect(screen.getByText('10 of 12 applications have no link to a capability.')).toBeInTheDocument();
  });
});

const PACK_PLAN = {
  pack: { code: 'GOV_REFERENCE_PACK', version: '1.0' },
  industry: { code: 'GOV_LABOR_HR', name: 'Labor / Human Resources', nameAr: 'العمل', basis: 'KEYWORDS', matched: ['human resources'] },
  beneficiarySource: 'INDUSTRY_DEFAULT',
  limitations: ['6 element(s) need a Meta Model concept the published Meta Model does not define'],
  industries: [],
  architectures: [
    { role: 'BRM', code: 'NORA_BRM', kind: 'REFERENCE_MODEL', authorityLevel: 'NATIONAL', provenance: 'OFFICIAL_STANDARD', domainCode: 'BUSINESS', name: 'NORA Business Reference Model', nameAr: 'النموذج المرجعي للأعمال', description: 'Official map', descriptionAr: '', derivedFromCode: null, action: 'UP_TO_DATE', reason: null, counts: { elements: 2, resolved: 1, configurationRequired: 0, structural: 1 }, toWrite: 0,
      elements: [{ stableKey: 'nora-adm', parentKey: null, kind: 'AREA', name: 'Administrative', nameAr: 'الإدارية', metaModelTypeCodes: [], metaModelStatus: 'STRUCTURAL', source: 'NORA_OFFICIAL', disposition: null, isNew: false }, { stableKey: 'nora-adm-str', parentKey: 'nora-adm', kind: 'CAPABILITY', name: 'Strategy', nameAr: 'الاستراتيجية', metaModelTypeCodes: ['GovCapability'], metaModelStatus: 'RESOLVED', source: 'NORA_OFFICIAL', disposition: null, isNew: false }] },
    { role: 'BUSINESS_RA', code: 'ORG_BUSINESS_RA', kind: 'REFERENCE_ARCHITECTURE', authorityLevel: 'ORGANIZATION', provenance: 'ORGANIZATION_TAILORED', domainCode: 'BUSINESS', name: 'Fund Business Reference Architecture', nameAr: '', description: 'Tailors', descriptionAr: '', derivedFromCode: 'NORA_BRM', action: 'CREATE', reason: null, counts: { elements: 1, resolved: 1, configurationRequired: 0, structural: 0 }, toWrite: 1,
      elements: [{ stableKey: 'lab-emp', parentKey: null, kind: 'CAPABILITY', name: 'Employment Support', nameAr: 'دعم التوظيف', metaModelTypeCodes: ['GovCapability'], metaModelStatus: 'RESOLVED', source: 'INDUSTRY_CATALOGUE', disposition: 'EXTENDED', isNew: true }] },
    { role: 'BENEFICIARY_RA', code: 'ORG_BENEFICIARY_RA', kind: 'REFERENCE_ARCHITECTURE', authorityLevel: 'ORGANIZATION', provenance: 'ORGANIZATION_TAILORED', domainCode: 'BENEFICIARY', name: 'Fund Beneficiary Reference Architecture', nameAr: '', description: '', descriptionAr: '', derivedFromCode: 'NORA_BXRM_BASELINE', action: 'SKIPPED', reason: 'LATEST_VERSION_ACTIVE', counts: { elements: 0, resolved: 0, configurationRequired: 0, structural: 0 }, toWrite: 0, elements: [] },
  ],
};

describe('ReferencePackPanel', () => {
  beforeEach(() => {
    mockParams = { tenantId: 't1', tab: 'reference' };
    api.tenant.mockResolvedValue(DETAIL);
    api.me.mockResolvedValue({ capabilities: { webSearch: true } });
  });

  it('shows the plan with the detected industry, sources and what will happen', async () => {
    api.referencePack.mockResolvedValue(PACK_PLAN);
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText('NORA Business Reference Model')).toBeInTheDocument();
    expect(api.referencePack).toHaveBeenCalledWith('t1', { industry: undefined });
    expect(screen.getAllByText('owner.pack.industry.GOV_LABOR_HR').length).toBeGreaterThan(0);
    expect(screen.getByText(/owner.pack.basis.KEYWORDS \(human resources\)/)).toBeInTheDocument();
    expect(screen.getByText('owner.pack.beneficiaries.INDUSTRY_DEFAULT')).toBeInTheDocument();
    expect(screen.getByText('owner.pack.provenance.OFFICIAL_STANDARD')).toBeInTheDocument();
    expect(screen.getByText('owner.pack.action.CREATE')).toBeInTheDocument();
    expect(screen.getByText('owner.pack.action.SKIPPED: owner.pack.reason.LATEST_VERSION')).toBeInTheDocument();
    expect(screen.getByText(/6 element\(s\) need a Meta Model concept/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '▾' })[1]);
    expect(await screen.findByText('Employment Support')).toBeInTheDocument();
    expect(screen.getByText(/owner.pack.source.INDUSTRY_CATALOGUE/)).toBeInTheDocument();
  });

  it('choosing an industry re-plans; preparing sends the industry and activation choices', async () => {
    api.referencePack.mockResolvedValue(PACK_PLAN);
    api.applyReferencePack.mockResolvedValue({ results: [{ action: 'CREATED' }, { action: 'ELEMENTS_ADDED' }, { action: 'UP_TO_DATE' }] });
    render(<OwnerTenantDetailPage />);
    await screen.findByText('NORA Business Reference Model');
    fireEvent.change(screen.getByLabelText(/owner.pack.industry_help|owner.pack.industry/, { selector: 'select' }), { target: { value: 'GOV_EDUCATION' } });
    await waitFor(() => expect(api.referencePack).toHaveBeenLastCalledWith('t1', { industry: 'GOV_EDUCATION' }));
    fireEvent.click(screen.getByLabelText(/owner.pack.activate_archs/));
    fireEvent.click(screen.getByRole('button', { name: 'owner.pack.prepare' }));
    await waitFor(() => expect(api.applyReferencePack).toHaveBeenCalledWith('t1', { industry: 'GOV_EDUCATION', activateModels: true, activateArchitectures: true }));
    expect(await screen.findByText('owner.pack.done')).toBeInTheDocument();
  });

  it('NORA library: lists national objects and documents; leaving parts out narrows what is prepared', async () => {
    api.referencePack.mockResolvedValue({ ...PACK_PLAN, library: {
      library: { tenantId: 'home', name: 'ArchMind', source: 'OWNER_HOME' },
      objects: [{ key: 'baseline:NAFATH', name: 'Nafath - National Single Sign-On', nameAr: 'نفاذ', typeCode: 'NationalPlatform', source: 'NORA_BASELINE', action: 'CREATE' }, { key: 'baseline:GSB', name: 'Government Service Bus (GSB)', nameAr: '', typeCode: 'NationalPlatform', source: 'NORA_BASELINE', action: 'EXISTS' }],
      documents: [{ id: 'd1', name: 'NORA 2.0 Guide.pdf', chunkCount: 40, action: 'COPY' }, { id: 'd2', name: 'NORA Principles.pdf', chunkCount: 12, action: 'COPY' }, { id: 'd3', name: 'Old.pdf', chunkCount: 3, action: 'EXISTS' }],
      limitations: [],
    } });
    api.applyReferencePack.mockResolvedValue({ results: [], library: { objectsCreated: 0, documentsCopied: 1, failures: [] } });
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText('Nafath - National Single Sign-On')).toBeInTheDocument();
    expect(screen.getByText('owner.pack.lib.source')).toBeInTheDocument();
    expect(screen.getByLabelText(/Old.pdf/)).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/NORA Principles.pdf/));
    fireEvent.click(screen.getByLabelText(/owner.pack.lib.repository_help/));
    fireEvent.click(screen.getByRole('button', { name: 'owner.pack.prepare' }));
    await waitFor(() => expect(api.applyReferencePack).toHaveBeenCalled());
    const dto = api.applyReferencePack.mock.calls[0][1];
    expect(dto.include).toEqual(['BRM', 'ARM', 'DRM', 'TRM', 'SRM', 'BXRM', 'BUSINESS_RA', 'APPLICATION_RA', 'BENEFICIARY_RA', 'NORA_KNOWLEDGE']);
    expect(dto.documentIds).toEqual(['d1']);
    expect(await screen.findByText('owner.pack.lib.done')).toBeInTheDocument();
  });

  it('nothing to prepare disables the button', async () => {
    api.referencePack.mockResolvedValueOnce({ ...PACK_PLAN, architectures: [PACK_PLAN.architectures[0]] });
    render(<OwnerTenantDetailPage />);
    await screen.findByText('NORA Business Reference Model');
    expect(screen.getByRole('button', { name: 'owner.pack.prepare' })).toBeDisabled();
  });

  it('reports a planning failure', async () => {
    api.referencePack.mockRejectedValue(new Error('Tenant not found'));
    render(<OwnerTenantDetailPage />);
    expect(await screen.findByText(/Tenant not found/)).toBeInTheDocument();
  });
});

describe('EnrichmentPanel', () => {
  const JOB = { id: 'j1', status: 'READY_FOR_REVIEW', stage: 'READY_FOR_REVIEW', progress: { stagesDone: ['DISCOVERING', 'EXTRACTING'] }, usage: { aiCalls: 3 }, limitations: ['Not modelled in the tenant\'s Meta Model: Journey stage.'], sources: [{ id: 'S1', url: 'https://fund.sa/about', title: 'About', publisher: 'fund.sa', tierLabel: 'Official organization website' }], profile: {}, logo: null, viewProjection: [] };
  const ITEMS = [
    { id: 'i1', kind: 'OBJECT', name: 'Employers', concept: 'BENEFICIARY', objectTypeCode: 'Beneficiary', mappingStatus: 'MAPPED', classification: 'VERIFIED', factType: 'FACT', confidence: 1, changeType: 'NEW', decision: 'PENDING', evidence: [{ sourceId: 'S1', url: 'https://fund.sa/about', title: 'About', publisher: 'fund.sa', excerpt: 'supports employers', found: true }], duplicateCandidates: [], attributes: {} },
    { id: 'i2', kind: 'OBJECT', name: 'Apply', concept: 'JOURNEY_STAGE', objectTypeCode: null, mappingStatus: 'CONFIGURATION_REQUIRED', classification: 'INFERRED', factType: 'INFERENCE', confidence: 0.6, changeType: 'NEW', decision: 'REJECTED', evidence: [], duplicateCandidates: [], attributes: {} },
  ];

  it('reviews items with evidence, approves, and commits with step-up', async () => {
    api.enrichmentJobs.mockResolvedValue([JOB]);
    api.job.mockResolvedValue(JOB);
    api.items.mockResolvedValue(ITEMS);
    api.decide.mockResolvedValue({ updated: 1 });
    api.commit.mockResolvedValue({ status: 'COMPLETED', result: { created: 1, enriched: 0, linked: 0, skipped: 0, failed: 0 } });
    render(<EnrichmentPanel tenantId="t1" website="https://fund.sa" webSearch={false} />);
    expect(await screen.findByText('Employers')).toBeInTheDocument();
    expect(screen.getByText('owner.mapping.CONFIGURATION_REQUIRED')).toBeInTheDocument();
    // Unmapped item cannot be approved
    const rows = screen.getAllByRole('row');
    expect(rows[2].querySelector('button.btn-primary')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'owner.enrich.evidence (1)' }));
    expect(screen.getByText(/supports employers/)).toBeInTheDocument();
    expect(screen.getByText(/owner.enrich.excerpt_found/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'owner.enrich.approve' })[0]);
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('j1', [{ itemId: 'i1', decision: 'APPROVED' }]));
    fireEvent.click(screen.getByRole('button', { name: 'owner.enrich.commit' }));
    fireEvent.change(screen.getByLabelText('owner.password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'owner.enrich.commit' }).slice(-1)[0]);
    await waitFor(() => expect(api.commit).toHaveBeenCalledWith('j1', { password: 'pw', applyProfile: true }));
  });

  it('marks items known only from AI model knowledge and filters by basis', async () => {
    const job = { ...JOB, sources: [...JOB.sources, { id: 'S2', url: 'archmind:ai-model-knowledge', title: 'AI model knowledge', publisher: 'AI model knowledge', tierLabel: 'AI model knowledge - not a source', kind: 'AI_KNOWLEDGE' }] };
    api.enrichmentJobs.mockResolvedValue([job]);
    api.job.mockResolvedValue(job);
    api.items.mockResolvedValue([ITEMS[0], { ...ITEMS[0], id: 'i3', name: 'Tamheer Programme', concept: 'SERVICE', objectTypeCode: 'GovService', classification: 'INFERRED', confidence: 0.3, evidence: [{ sourceId: 'S2', url: 'archmind:ai-model-knowledge', publisher: 'AI model knowledge', excerpt: 'runs the Tamheer programme', found: true, sourceKind: 'AI_KNOWLEDGE' }] }]);
    render(<EnrichmentPanel tenantId="t1" website="https://fund.sa" webSearch aiKnowledge />);
    expect(await screen.findByText('Tamheer Programme')).toBeInTheDocument();
    expect(screen.getAllByText('owner.enrich.ai_knowledge_badge')).toHaveLength(1);
    expect(screen.getByText('owner.enrich.ai_knowledge_verify')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'owner.enrich.evidence (1)' })[1]);
    expect(screen.getAllByText('owner.enrich.ai_knowledge_source').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('owner.enrich.basis'), { target: { value: 'AI_KNOWLEDGE' } });
    expect(screen.queryByText('Employers')).toBeNull();
    expect(screen.getByText('Tamheer Programme')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('owner.enrich.basis'), { target: { value: 'SOURCED' } });
    expect(screen.getByText('Employers')).toBeInTheDocument();
    expect(screen.queryByText('Tamheer Programme')).toBeNull();
  });

  it('launches discovery with the chosen scopes and follows the running job', async () => {
    const running = { ...JOB, id: 'j2', status: 'EXTRACTING', stage: 'EXTRACTING', progress: { stagesDone: ['DISCOVERING'] } };
    api.enrichmentJobs.mockResolvedValueOnce([]).mockResolvedValue([running]);
    api.launchEnrichment.mockResolvedValue({ id: 'j2' });
    api.job.mockResolvedValue(running);
    api.advance.mockResolvedValue({ ...running, status: 'MAPPING', stage: 'MAPPING' });
    render(<EnrichmentPanel tenantId="t1" website="https://fund.sa" webSearch={false} />);
    expect(await screen.findByText('owner.enrich.web_search_off')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('owner.enrich.scope.BENEFICIARY'));
    fireEvent.click(screen.getByRole('button', { name: 'owner.enrich.launch' }));
    await waitFor(() => expect(api.launchEnrichment).toHaveBeenCalledWith('t1', { scopes: ['BENEFICIARY'], website: 'https://fund.sa' }));
    expect(await screen.findByText(/owner.enrich.running/)).toBeInTheDocument();
    // The panel asks the server to run the next stage while the job runs.
    await waitFor(() => expect(api.advance).toHaveBeenCalledWith('j2'), { timeout: 4000 });
  });
});

describe('Audit and settings', () => {
  it('lists access sessions and owner actions, and can end an active session', async () => {
    api.audit.mockResolvedValue([{ id: 'a1', createdAt: '2026-10-07T10:00:00Z', actor: { email: 'owner@archmind.sa' }, action: 'OWNER_TENANT_CREATED', tenant: { name: 'Example Fund' }, detail: { slug: 'fund' } }]);
    api.sessions.mockResolvedValue([{ id: 's1', tenant: { name: 'Example Fund' }, actor: { email: 'owner@archmind.sa' }, reason: 'Support ticket 42', startedAt: '2026-10-07T10:00:00Z', expiresAt: '2026-10-07T10:30:00Z', actionCount: 2, status: 'ACTIVE' }]);
    api.endSession.mockResolvedValue({});
    render(<OwnerAuditPage />);
    expect(await screen.findByText('OWNER_TENANT_CREATED')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'owner.audit.end' }));
    await waitFor(() => expect(api.endSession).toHaveBeenCalledWith('s1'));
  });

  it('settings show the owner identity and web search configuration', async () => {
    api.me.mockResolvedValue({ email: 'owner@archmind.sa', homeTenantName: 'ArchMind', platformRole: 'PLATFORM_OWNER', capabilities: { webSearch: false, accessTtlMinutes: 30, enrichmentScopes: ['FULL'] } });
    render(<OwnerSettingsPage />);
    expect(await screen.findByText('owner.settings.disabled')).toBeInTheDocument();
    expect(screen.getByText('owner.settings.grant')).toBeInTheDocument();
  });
});

describe('Demo requests (owner only)', () => {
  const ROWS = [
    { id: 'r2', fullName: 'Aisha Al Saud', organization: 'Example Authority', jobTitle: 'Enterprise Architect', email: 'aisha@example.gov.sa', phone: null, country: 'Saudi Arabia', preferredLanguage: 'English', message: 'We would like a demo.', createdAt: '2026-09-14T10:00:00.000Z' },
    { id: 'r1', fullName: 'Omar Khalid', organization: 'Another Org', jobTitle: 'CIO', email: 'omar@another.org', phone: '+966500000000', country: 'United Arab Emirates', preferredLanguage: 'Arabic', message: 'Interested in governance.', createdAt: '2026-09-13T09:00:00.000Z' },
  ];

  it('lists requests in the order the API returns them and filters by search', async () => {
    api.demoRequests.mockResolvedValue(ROWS);
    render(<OwnerDemoRequestsPage />);
    await screen.findByText('Aisha Al Saud');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Aisha Al Saud');
    expect(rows[1]).toHaveTextContent('Omar Khalid');
    expect(screen.getByRole('link', { name: 'omar@another.org' })).toHaveAttribute('href', 'mailto:omar@another.org');
    fireEvent.change(screen.getByLabelText('owner.demo.search'), { target: { value: 'governance' } });
    expect(screen.queryByText('Aisha Al Saud')).not.toBeInTheDocument();
    expect(screen.getByText('Omar Khalid')).toBeInTheDocument();
  });

  it('shows the empty state and an error with retry', async () => {
    api.demoRequests.mockResolvedValueOnce([]);
    const { unmount } = render(<OwnerDemoRequestsPage />);
    expect(await screen.findByTestId('owner-demo-empty')).toHaveTextContent('owner.demo.empty');
    unmount();
    api.demoRequests.mockRejectedValueOnce(new Error('Forbidden'));
    render(<OwnerDemoRequestsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden');
  });

  it('is in the owner navigation', () => {
    render(<OwnerRoute><OwnerLayout /></OwnerRoute>);
    expect(screen.getByText('owner.nav.demo').closest('a')).toHaveAttribute('href', '/owner/demo-requests');
  });
});

describe('DelegatedAccessBanner', () => {
  it('is hidden outside a delegated session', () => {
    const { container } = render(<DelegatedAccessBanner />);
    expect(container).toBeEmptyDOMElement();
  });
  it('shows the persistent owner banner and exits back to the Owner Console', async () => {
    mockUser = { ...OWNER, role: 'SUPERADMIN', platformRole: null, tenantId: 't1', tenantName: 'Example Fund', delegatedAccess: { sessionId: 's1', actorUserId: 'o', homeTenantId: 'home', expiresAt: '2026-10-07T10:30:00Z' } };
    mockExitTenant.mockResolvedValue(undefined);
    render(<DelegatedAccessBanner />);
    expect(screen.getByText(/owner.access.banner/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'owner.access.exit' }));
    await waitFor(() => expect(mockExitTenant).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith('/owner/tenants/t1/activity');
  });
});

describe('AR/EN coverage', () => {
  it('every owner.* key used in the Owner Console has English and Arabic text', () => {
    const dir = path.resolve(__dirname, '..');
    const files = [...fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f)).map(f => path.join(dir, f)), path.resolve(dir, '../../components/DelegatedAccessBanner.tsx'), path.resolve(dir, '../../components/Layout.tsx')];
    const used = new Set<string>();
    for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/t\(\s*'(owner\.[a-zA-Z0-9_.]+)'/g)) used.add(m[1]);
    const missing = [...used].filter(k => !OWNER_TRANSLATIONS[k]);
    expect(missing).toEqual([]);
    for (const [k, v] of Object.entries(OWNER_TRANSLATIONS)) {
      expect(v.EN.trim()).not.toBe('');
      expect(/[؀-ۿ]/.test(v.AR) || /ArchMind|NORA|TOGAF/.test(v.AR)).toBe(true);
      if (!/[؀-ۿ]/.test(v.AR)) throw new Error(`${k} has no Arabic text`);
    }
  });

  it('every templated key (stage, class, change, scope, status...) the pages build exists', () => {
    const families: Record<string, string[]> = {
      'owner.stage.': ['QUEUED', 'DISCOVERING', 'EXTRACTING', 'NORMALIZING', 'MAPPING', 'DEDUPLICATING', 'VALIDATING', 'BUILDING_RELATIONSHIPS', 'PREPARING_VIEWS', 'READY_FOR_REVIEW', 'COMMITTING', 'COMPLETED', 'FAILED', 'CANCELLED'],
      'owner.class.': ['VERIFIED', 'LIKELY', 'INFERRED', 'INSUFFICIENT_EVIDENCE'],
      'owner.change.': ['NEW', 'ENRICH_EXISTING', 'RELATIONSHIP', 'POSSIBLE_DUPLICATE', 'CONFLICT', 'NO_CHANGE'],
      'owner.decision.': ['PENDING', 'APPROVED', 'REJECTED', 'MERGE'],
      'owner.views.status.': ['READY', 'PARTIAL', 'RECOMMENDED_AFTER_ENRICHMENT', 'INSUFFICIENT_DATA', 'LIKELY_READY_AFTER_COMMIT', 'IMPROVED_AFTER_COMMIT'],
      'owner.enrich.scope.': ['FULL', 'STRATEGY', 'BUSINESS', 'BENEFICIARY', 'APPLICATIONS', 'APPLICATION_MODULES', 'PROCESSES', 'CAPABILITIES', 'SERVICES', 'DATA', 'TECHNOLOGY', 'RELATIONSHIPS', 'MISSING'],
      'owner.maturity.level.': ['1', '2', '3', '4', '5'],
      'owner.priority.': ['HIGH', 'MEDIUM', 'LOW'],
      'owner.session.': ['ACTIVE', 'ENDED', 'EXPIRED'],
      'owner.status.': ['ACTIVE', 'SUSPENDED', 'OFFBOARDED'],
      'owner.pack.industry.': ['GOV_LABOR_HR', 'GOV_HEALTH', 'GOV_EDUCATION', 'GOV_TRANSPORT', 'GOV_MUNICIPALITY', 'GOV_FINANCE', 'GOV_JUSTICE', 'GOV_REGULATORY', 'GOV_SOCIAL_DEVELOPMENT', 'GOV_STANDARDS_CONFORMITY', 'GOV_OTHER'],
      'owner.pack.basis.': ['OWNER_CHOICE', 'PROFILE_CODE', 'KEYWORDS', 'DEFAULT'],
      'owner.pack.beneficiaries.': ['REPOSITORY', 'INDUSTRY_DEFAULT'],
      'owner.pack.kind.': ['REFERENCE_MODEL', 'REFERENCE_ARCHITECTURE'],
      'owner.pack.provenance.': ['OFFICIAL_STANDARD', 'ARCHMIND_CURATED', 'ORGANIZATION_TAILORED'],
      'owner.pack.action.': ['CREATE', 'ADD_MISSING', 'UP_TO_DATE', 'SKIPPED'],
      'owner.pack.reason.': ['NO_PUBLISHED_META_MODEL', 'DOMAIN_NOT_IN_META_MODEL'],
      'owner.pack.source.': ['NORA_OFFICIAL', 'ARCHMIND_CURATED', 'INDUSTRY_CATALOGUE', 'TENANT_REPOSITORY', 'PACK_STRUCTURE'],
      'owner.pack.disposition.': ['ADOPTED', 'EXTENDED', 'PENDING_REVIEW', 'ADAPTED'],
      'owner.pack.lib.from.': ['NORA_BASELINE', 'PLATFORM_LIBRARY'],
      'owner.pack.lib.object.': ['CREATE', 'EXISTS', 'NO_TYPE'],
      'owner.pack.lib.doc.': ['COPY', 'EXISTS', 'NOT_READY'],
      'owner.detail.tab.': ['overview', 'repository', 'maturity', 'beneficiaries', 'enrichment', 'reference', 'views', 'recommendations', 'activity'],
      'owner.create.step.': ['branding', 'profile', 'glossary', 'subscription', 'metaModel', 'referencePack', 'adminInvitation'],
    };
    const missing = Object.entries(families).flatMap(([p, ks]) => ks.map(k => p + k)).filter(k => !OWNER_TRANSLATIONS[k]);
    expect(missing).toEqual([]);
  });
});
