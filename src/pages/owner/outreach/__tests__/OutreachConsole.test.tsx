import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as fs from 'fs';
import * as path from 'path';
import { OWNER_TRANSLATIONS } from '../../ownerStrings';
import * as C from '../outreachApi';

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

jest.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { userId: 'o', email: 'owner@archmind.sa', platformRole: 'PLATFORM_OWNER' }, loading: false, logout: jest.fn() }),
  isPlatformOwner: () => true,
}));
jest.mock('../../../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false, locale: 'EN', setLocale: jest.fn() }),
}));

const mockStore: Record<string, jest.Mock> = {};
jest.mock('../outreachApi', () => {
  const actual = jest.requireActual('../outreachApi');
  return { ...actual, outreachApi: new Proxy({}, { get: (_t, k: string) => (mockStore[k] ||= jest.fn()) }) };
});
jest.mock('../../ownerApi', () => {
  const actual = jest.requireActual('../../ownerApi');
  return { ...actual, ownerApi: new Proxy({}, { get: (_t, k: string) => (mockStore[`owner_${k}`] ||= jest.fn()) }) };
});
const api = new Proxy({} as Record<string, jest.Mock>, { get: (_t, k: string) => (mockStore[k] ||= jest.fn()) });

/* eslint-disable import/first */
import OwnerLayout from '../../OwnerLayout';
import OutreachDashboardPage from '../OutreachDashboardPage';
import OutreachEntitiesPage from '../OutreachEntitiesPage';
import OutreachEntityPage from '../OutreachEntityPage';
import OutreachProspectsPage from '../OutreachProspectsPage';
import OutreachCampaignsPage, { OutreachCampaignPage } from '../OutreachCampaignsPage';
import OutreachSettingsPage from '../OutreachSettingsPage';
import ProspectDrawer from '../ProspectDrawer';
import OutreachPagePage, { LinkedInCallbackPage, LinkedInPageCard } from '../OutreachPagePage';

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockParams = {};
  mockSearch = new URLSearchParams();
});

const ENTITY = { id: 'e1', nameEn: 'Human Resources Development Fund', nameAr: 'صندوق تنمية الموارد البشرية', aliases: [], entityType: 'FUND', sector: 'Labour', website: 'https://www.hrdf.org.sa', domain: 'hrdf.org.sa', country: 'SA', city: 'Riyadh', governmentStatus: 'LIKELY_GOVERNMENT', governmentBasis: 'The name carries a government designation.', evidence: [], tenantId: null, tenantMatch: 'NEW_ENTITY', tenantCandidates: [], suppressed: false, source: 'OWNER', createdAt: '2026-10-07T00:00:00Z' };
const PROSPECT = { id: 'p1', entityId: 'e1', fullName: 'Ahmed Al-Qahtani', fullNameAr: null, jobTitle: 'Director of Enterprise Architecture', roleCategory: 'ENTERPRISE_ARCHITECTURE', seniority: 'DIRECTOR', employmentStatus: 'CURRENT_CONFIRMED', emailStatus: 'VERIFIED_PUBLIC', email: 'ahmed.q@hrdf.org.sa', relevanceScore: 92, stage: 'VERIFIED', doNotContact: false };

describe('Owner shell', () => {
  it('has a Government Outreach entry in the owner sidebar', () => {
    render(<OwnerLayout />);
    expect(screen.getByText('owner.nav.outreach').closest('a')).toHaveAttribute('href', '/owner/outreach');
  });
});

describe('Outreach dashboard', () => {
  it('shows the metrics, the funnel and that email is not configured', async () => {
    api.dashboard.mockResolvedValue({
      metrics: { linkedinProfiles: 31, connectionRequestsSent: 5, linkedinConnections: 7, entities: 12, relevantProfessionals: 40, eaLeaders: 9, dtLeaders: 7, innovationLeaders: 3, entitiesWithoutTenant: 8, tenantsFromOutreach: 4, tenantsEnriched: 3, invitationsSent: 6, activatedUsers: 2, engagedTenants: 1 },
      funnel: [{ stage: 'DISCOVERED', count: 40 }, { stage: 'VERIFIED', count: 20 }, { stage: 'CONTACTED', count: 10 }, { stage: 'CONNECTED', count: 7 }, { stage: 'INVITED', count: 6 }, { stage: 'ACTIVATED', count: 2 }, { stage: 'ENGAGED', count: 1 }],
      entitiesByType: { MINISTRY: 5, FUND: 2 }, email: { configured: false },
    });
    render(<OutreachDashboardPage />);
    expect(await screen.findByText('owner.outreach.dash.ea_leaders')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.email_not_configured')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.funnel.ENGAGED')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.funnel.CONNECTED')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.dash.li_profiles')).toBeInTheDocument();
    expect(screen.getByText('31')).toBeInTheDocument();
    expect(screen.getAllByText('40')).toHaveLength(2); // tile + funnel
    fireEvent.click(screen.getByText('owner.outreach.type.MINISTRY · 5'));
    expect(mockNavigate).toHaveBeenCalledWith('/owner/outreach/entities?type=MINISTRY');
  });
});

describe('Entity directory', () => {
  beforeEach(() => {
    api.jobs.mockResolvedValue([]);
    api.entities.mockResolvedValue({ entities: [
      { ...ENTITY, tenant: null, prospects: 2, byRole: { ENTERPRISE_ARCHITECTURE: 1, DIGITAL_TRANSFORMATION: 1 }, byStage: { VERIFIED: 2 }, outreachStatus: 'PROSPECTS_FOUND' },
      { ...ENTITY, id: 'e2', nameEn: 'Ministry of Health', entityType: 'MINISTRY', governmentStatus: 'CONFIRMED_GOVERNMENT', tenant: { id: 't1', name: 'MOH' }, prospects: 0, byRole: {}, byStage: {}, outreachStatus: 'NOT_STARTED', tenantMatch: 'EXISTING_TENANT' },
      { ...ENTITY, id: 'e3', nameEn: 'Elm Company', entityType: 'OTHER_PUBLIC', governmentStatus: 'NOT_GOVERNMENT', tenant: null, prospects: 0, byRole: {}, byStage: {}, outreachStatus: 'NOT_STARTED' },
    ], byType: {}, total: 3 });
  });

  it('groups entities by type and researches the selected ones (non-government cannot be selected)', async () => {
    api.discover.mockResolvedValue({ jobs: [{ id: 'j1' }], skipped: [] });
    render(<OutreachEntitiesPage />);
    expect(await screen.findByText('Human Resources Development Fund')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /owner.outreach.type.MINISTRY/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /owner.outreach.type.FUND/ })).toBeInTheDocument();
    expect(screen.getByLabelText('owner.outreach.select Elm Company')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('owner.outreach.select Human Resources Development Fund'));
    fireEvent.click(screen.getByText('owner.outreach.entities.research'));
    await waitFor(() => expect(api.discover).toHaveBeenCalledWith({ mode: 'PROFESSIONALS', entityIds: ['e1'] }));
    expect(await screen.findByText('owner.outreach.entities.research_started')).toBeInTheDocument();
  });

  it('adds an entity by hand and opens it', async () => {
    api.addEntity.mockResolvedValue({ entity: { id: 'new' }, created: true });
    render(<OutreachEntitiesPage />);
    await screen.findByText('Human Resources Development Fund');
    fireEvent.click(screen.getByText('owner.outreach.entities.add'));
    fireEvent.change(screen.getByLabelText('owner.outreach.field.name_en'), { target: { value: 'Saudi Data and AI Authority' } });
    fireEvent.change(screen.getByLabelText('owner.outreach.field.website'), { target: { value: 'sdaia.gov.sa' } });
    fireEvent.click(screen.getByText('owner.outreach.save'));
    await waitFor(() => expect(api.addEntity).toHaveBeenCalledWith({ nameEn: 'Saudi Data and AI Authority', website: 'sdaia.gov.sa' }));
    expect(mockNavigate).toHaveBeenCalledWith('/owner/outreach/entities/new');
  });

  it('entity discovery warns when web search is off', async () => {
    mockSearch = new URLSearchParams('discover=1');
    api.providers.mockResolvedValue({ providers: [{ name: 'web-search-organizations', kind: 'ORGANIZATION', configured: false }] });
    api.discover.mockResolvedValue({ jobs: [{ id: 'j2' }], skipped: [] });
    render(<OutreachEntitiesPage />);
    expect(await screen.findByText('owner.outreach.web_search_off')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.start'));
    await waitFor(() => expect(api.discover).toHaveBeenCalledWith({ mode: 'ENTITIES', entityType: 'MINISTRY', sector: undefined, query: undefined }));
  });
});

describe('Entity page', () => {
  const detail = (over: any = {}) => ({ entity: { ...ENTITY, ...over.entity }, tenant: over.tenant ?? null, groups: over.groups ?? [{ roleCategory: 'ENTERPRISE_ARCHITECTURE', prospects: [PROSPECT] }, { roleCategory: 'DIGITAL_TRANSFORMATION', prospects: [{ ...PROSPECT, id: 'p2', fullName: 'Sara Al-Otaibi', jobTitle: 'Head of Digital Transformation', roleCategory: 'DIGITAL_TRANSFORMATION', seniority: 'HEAD' }] }], prospectCount: 2, jobs: [] });

  it('groups prospects by role and cannot create a duplicate workspace', async () => {
    mockParams = { id: 'e1' };
    api.entity.mockResolvedValue(detail({ entity: { tenantMatch: 'EXISTING_TENANT', tenantCandidates: [{ tenantId: 't9', name: 'HRDF', slug: 'hrdf', reason: 'Same official website domain (hrdf.org.sa).' }] } }));
    api.linkTenant.mockResolvedValue({});
    render(<OutreachEntityPage />);
    expect(await screen.findByText('owner.outreach.role.ENTERPRISE_ARCHITECTURE · 1')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.role.DIGITAL_TRANSFORMATION · 1')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.entity.create_tenant')).toBeDisabled();
    fireEvent.click(screen.getByText('owner.outreach.entity.link'));
    await waitFor(() => expect(api.linkTenant).toHaveBeenCalledWith('e1', 't9'));
  });

  it('creating a workspace for a possible match sends the explicit not-a-duplicate confirmation', async () => {
    mockParams = { id: 'e1' };
    api.entity.mockResolvedValue(detail({ entity: { tenantMatch: 'POSSIBLE_MATCH', tenantCandidates: [{ tenantId: 't9', name: 'HR Fund', slug: 'hrf', reason: 'Similar name' }] } }));
    api.createTenant.mockResolvedValue({ tenant: { id: 'tn', name: 'HRDF', slug: 'hrdf' }, provisioning: {} });
    render(<OutreachEntityPage />);
    fireEvent.click(await screen.findByText('owner.outreach.entity.create_tenant'));
    expect(screen.getByLabelText('owner.create.name')).toHaveValue('Human Resources Development Fund');
    expect(screen.getByLabelText('owner.create.website')).toHaveValue('https://www.hrdf.org.sa');
    fireEvent.click(document.getElementById('or-confirm-not-dup') as HTMLInputElement);
    fireEvent.click(screen.getByText('owner.create.submit'));
    await waitFor(() => expect(api.createTenant).toHaveBeenCalledWith('e1', expect.objectContaining({ organizationName: 'Human Resources Development Fund', officialWebsite: 'https://www.hrdf.org.sa', confirmNotDuplicate: true })));
    expect(mockStore.owner_createTenant).toBeUndefined(); // the generic creation is not used: the entity endpoint refuses duplicates
  });

  it('prepares invitations with the suggested role; an administrator role asks for the password', async () => {
    mockParams = { id: 'e1' };
    api.entity.mockResolvedValue(detail({ tenant: { id: 't1', name: 'HRDF', slug: 'hrdf', status: 'ACTIVE', objects: 120, relationships: 80, publicResearchObjects: 64, preparedViews: 5, viewNames: ['Application Portfolio'], metaModelPublished: true, users: {}, latestEnrichmentJob: { status: 'COMPLETED', createdAt: '2026-10-06T00:00:00Z' } } }));
    api.invitations.mockResolvedValue({ prepared: 1, results: [{ prospectId: 'p1', status: 'PREPARED' }] });
    render(<OutreachEntityPage />);
    expect(await screen.findByText('Application Portfolio')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('owner.outreach.select Ahmed Al-Qahtani'));
    fireEvent.click(screen.getByText('owner.outreach.invite (1)'));
    const dialog = screen.getByRole('dialog', { name: 'owner.outreach.invite' });
    fireEvent.change(within(dialog).getByLabelText('owner.outreach.invite.access_level'), { target: { value: 'TENANT_ADMIN' } });
    expect(within(dialog).getByText('owner.outreach.invite.prepare')).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('owner.password'), { target: { value: 'pw' } });
    fireEvent.click(within(dialog).getByText('owner.outreach.invite.prepare'));
    await waitFor(() => expect(api.invitations).toHaveBeenCalledWith({ prospectIds: ['p1'], roles: { p1: { legacyRole: 'TENANT_ADMIN', templateCodes: [] } }, password: 'pw' }));
    expect(await screen.findByText('owner.outreach.invite.not_emailed')).toBeInTheDocument();
  });

  it('prepares outreach drafts into a new campaign', async () => {
    mockParams = { id: 'e1' };
    api.entity.mockResolvedValue(detail({}));
    api.campaigns.mockResolvedValue([]);
    api.createCampaign.mockResolvedValue({ id: 'c1' });
    api.drafts.mockResolvedValue({ drafted: 1, results: [{ prospectId: 'p1', status: 'DRAFTED' }, { prospectId: 'p2', status: 'BLOCKED', blockers: ['NO_TENANT'] }] });
    render(<OutreachEntityPage />);
    fireEvent.click(await screen.findByLabelText('owner.outreach.select Ahmed Al-Qahtani'));
    fireEvent.click(screen.getByLabelText('owner.outreach.select Sara Al-Otaibi'));
    fireEvent.click(screen.getByText('owner.outreach.prepare_outreach (2)'));
    fireEvent.change(await screen.findByLabelText('owner.outreach.campaigns.name'), { target: { value: 'Q4 outreach' } });
    fireEvent.click(screen.getByText('owner.outreach.generate_drafts'));
    await waitFor(() => expect(api.drafts).toHaveBeenCalledWith('c1', { prospectIds: ['p1', 'p2'], language: undefined, strategy: 'EMAIL', linkedinType: undefined }));
    expect(await screen.findByText('owner.outreach.blocker.NO_TENANT')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.open_campaign'));
    expect(mockNavigate).toHaveBeenCalledWith('/owner/outreach/campaigns/c1');
  });
});

describe('Prospect drawer', () => {
  const D = {
    prospect: { ...PROSPECT, employmentStatus: 'CURRENT_LIKELY', employmentBasis: 'Presented as current in a source dated 3 month(s) ago.', classification: { basis: 'LEXICON', reason: 'Title contains "Enterprise Architecture".' }, relevance: [{ factor: 'ROLE', points: 30, max: 30, reason: 'enterprise architecture' }, { factor: 'CURRENT_EMPLOYMENT', points: 14, max: 20, reason: 'current likely' }], evidence: [{ url: 'https://conf.example/speakers', title: 'Speakers', publisher: 'conf.example', tier: 5, excerpt: 'Ahmed Al-Qahtani, Director of Enterprise Architecture at HRDF', retrievedAt: '2026-10-07T00:00:00Z', pageAge: '2026-07-01' }], emailSourceUrl: 'https://www.hrdf.org.sa/contact', source: 'AI_DISCOVERY' },
    entity: ENTITY, eligibility: { email: { eligible: false, blockers: ['EMPLOYMENT_UNVERIFIED'] } }, suggestedRole: { templateCodes: ['chief-enterprise-architect'], reason: 'EA leader' }, messages: [],
  };
  it('shows the evidence, the relevance factors and the blocker; the owner confirms the role with a note', async () => {
    api.prospect.mockResolvedValue(D);
    api.verify.mockResolvedValue({});
    render(<ProspectDrawer prospectId="p1" onClose={jest.fn()} />);
    expect(await screen.findByText('“Ahmed Al-Qahtani, Director of Enterprise Architecture at HRDF”')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.factor.ROLE')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.blocker.EMPLOYMENT_UNVERIFIED')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.verify'));
    fireEvent.change(screen.getByLabelText('owner.outreach.verify_note'), { target: { value: 'Checked the official leadership page today' } });
    fireEvent.click(screen.getByText('owner.confirm'));
    await waitFor(() => expect(api.verify).toHaveBeenCalledWith('p1', 'Checked the official leadership page today'));
  });
  it('erasure keeps a suppression entry by default', async () => {
    api.prospect.mockResolvedValue(D);
    api.erase.mockResolvedValue({});
    const onClose = jest.fn();
    render(<ProspectDrawer prospectId="p1" onClose={onClose} />);
    fireEvent.click(await screen.findByText('owner.outreach.erase'));
    fireEvent.change(screen.getByLabelText('owner.outreach.erase_reason'), { target: { value: 'Removal request by email' } });
    fireEvent.click(screen.getByText('owner.confirm'));
    await waitFor(() => expect(api.erase).toHaveBeenCalledWith('p1', { suppress: true, reason: 'Removal request by email' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe('Multi-channel outreach', () => {
  const LI = 'https://www.linkedin.com/in/ahmed-alqahtani';
  const PANEL = {
    recommendation: { recommended: 'LINKEDIN_THEN_EMAIL', reason: 'x' },
    linkedin: { url: LI, urlSource: 'SOURCE', status: 'UNKNOWN', eligibility: { eligible: true, blockers: [] }, capabilities: { configured: false, sendModes: ['MANUAL'] } },
    email: { address: 'ahmed.q@hrdf.org.sa', status: 'VERIFIED_PUBLIC', eligibility: { eligible: true, blockers: [] } },
    tenant: { id: 't1', name: 'HRDF', ready: true, enriched: true }, invitation: { id: 'inv', stage: 'VERIFIED' },
  };
  const DETAIL = { prospect: { ...PROSPECT, linkedinUrl: LI, relevance: [], evidence: [], classification: {} }, entity: ENTITY, eligibility: { email: { eligible: true, blockers: [] } }, suggestedRole: null, messages: [], outreachPanel: PANEL };

  it('the prospect outreach panel shows channels and readiness, prepares LinkedIn steps and records a LinkedIn status', async () => {
    api.prospect.mockResolvedValue(DETAIL);
    api.timeline.mockResolvedValue({ items: [{ at: '2026-10-01T08:00:00Z', kind: 'DISCOVERED', channel: null }, { at: '2026-10-03T08:00:00Z', kind: 'INTERACTION_SENT_MANUALLY', channel: 'LINKEDIN', interactionType: 'CONNECTION_REQUEST' }] });
    api.campaigns.mockResolvedValue([{ id: 'c1', name: 'Q4', status: 'ACTIVE' }]);
    api.drafts.mockResolvedValue({ drafted: 1, results: [{ prospectId: 'p1', channel: 'LINKEDIN', status: 'DRAFTED' }] });
    api.setLinkedInStatus.mockResolvedValue({});
    render(<ProspectDrawer prospectId="p1" onClose={jest.fn()} />);
    expect(await screen.findByText('owner.outreach.panel.title')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.panel.enriched')).toBeInTheDocument();
    expect(screen.getByText(/owner.outreach.recommend.LINKEDIN_THEN_EMAIL/)).toBeInTheDocument();
    expect(await screen.findByText(/owner.outreach.tl.INTERACTION_SENT_MANUALLY/)).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.panel.view_tenant')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('owner.outreach.panel.record_li'), { target: { value: 'CONNECTED' } });
    fireEvent.click(screen.getByText('owner.outreach.panel.record'));
    await waitFor(() => expect(api.setLinkedInStatus).toHaveBeenCalledWith('p1', { status: 'CONNECTED' }));
    fireEvent.click(screen.getByText('owner.outreach.panel.prepare_connection'));
    const dialog = await screen.findByRole('dialog', { name: 'owner.outreach.prepare_outreach' });
    await waitFor(() => expect(within(dialog).getByText('Q4')).toBeInTheDocument());
    fireEvent.change(within(dialog).getByLabelText('owner.outreach.campaign'), { target: { value: 'c1' } });
    fireEvent.click(within(dialog).getByText('owner.outreach.generate_drafts'));
    await waitFor(() => expect(api.drafts).toHaveBeenCalledWith('c1', { prospectIds: ['p1'], language: undefined, strategy: 'LINKEDIN', linkedinType: 'CONNECTION_REQUEST' }));
  });

  it('LinkedIn actions are disabled without an eligible profile', async () => {
    api.prospect.mockResolvedValue({ ...DETAIL, outreachPanel: { ...PANEL, recommendation: { recommended: 'EMAIL' }, linkedin: { url: null, status: 'UNKNOWN', eligibility: { eligible: false, blockers: ['LINKEDIN_UNAVAILABLE'] } } } });
    api.timeline.mockResolvedValue({ items: [] });
    render(<ProspectDrawer prospectId="p1" onClose={jest.fn()} />);
    expect(await screen.findByText('owner.outreach.blocker.LINKEDIN_UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.panel.prepare_connection')).toBeDisabled();
    expect(screen.getByText('owner.outreach.panel.prepare_both')).toBeDisabled();
    expect(screen.getByText('owner.outreach.panel.prepare_email')).not.toBeDisabled();
  });

  it('the LinkedIn editor counts characters, copies the text, opens the profile and records the manual send', async () => {
    mockParams = { id: 'c1' };
    api.campaign.mockResolvedValue({
      campaign: { id: 'c1', name: 'Q4', status: 'ACTIVE' }, metrics: {}, entities: [], prospects: [],
      interactions: [{ id: 'l1', channel: 'LINKEDIN', interactionType: 'CONNECTION_REQUEST', status: 'APPROVED', body: 'Hello Ahmed, I would welcome connecting.', prospect: { fullName: 'Ahmed', linkedinStatus: 'CONNECTION_REQUEST_PREPARED' }, entity: ENTITY, generation: { generator: 'TEMPLATE' } }],
    });
    api.preview.mockResolvedValue({ interaction: { id: 'l1', channel: 'LINKEDIN', interactionType: 'CONNECTION_REQUEST', status: 'APPROVED', body: 'Hello Ahmed, I would welcome connecting.', language: 'EN', generation: {} }, channel: 'LINKEDIN', profileUrl: LI, charLimit: 280, length: 40, capabilities: { detail: 'manual' }, sendMode: 'MANUAL', notConnected: false });
    api.materials.mockResolvedValue([]);
    api.recordOutcome.mockResolvedValue({});
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<OutreachCampaignPage />);
    expect((await screen.findAllByText('owner.outreach.channel.LINKEDIN')).length).toBeGreaterThan(1);
    expect(screen.getByText('owner.outreach.li_status.CONNECTION_REQUEST_PREPARED')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.review_edit'));
    expect(await screen.findByText('owner.outreach.li.count')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.li.open_profile').closest('a')).toHaveAttribute('href', LI);
    fireEvent.click(screen.getByText('owner.outreach.li.copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Hello Ahmed, I would welcome connecting.'));
    fireEvent.click(screen.getByText('owner.outreach.li.mark_request_sent'));
    await waitFor(() => expect(api.recordOutcome).toHaveBeenCalledWith('l1', { outcome: 'SENT', note: undefined }));
    expect(screen.queryByLabelText('owner.outreach.col.subject')).not.toBeInTheDocument();
  });

  it('a send answers MANUAL_REQUIRED for LinkedIn texts and says so', async () => {
    mockParams = { id: 'c1' };
    api.campaign.mockResolvedValue({
      campaign: { id: 'c1', name: 'Q4', status: 'ACTIVE' }, metrics: {}, entities: [], prospects: [],
      interactions: [{ id: 'l1', channel: 'LINKEDIN', interactionType: 'DIRECT_MESSAGE', status: 'APPROVED', body: 'Thank you for connecting.', prospect: { fullName: 'Ahmed' }, entity: ENTITY, generation: {} }],
    });
    api.send.mockResolvedValue({ sent: 0, manual: 1, remainingToday: { EMAIL: 20, LINKEDIN: 15 }, results: [{ interactionId: 'l1', status: 'MANUAL_REQUIRED', channel: 'LINKEDIN' }] });
    render(<OutreachCampaignPage />);
    fireEvent.click(await screen.findByLabelText('owner.outreach.select Ahmed'));
    fireEvent.click(screen.getByText('owner.outreach.send (1)'));
    fireEvent.change(screen.getByLabelText('owner.password'), { target: { value: 'pw' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByText('owner.outreach.send'));
    expect(await screen.findByText('owner.outreach.send.manual')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.result.MANUAL_REQUIRED')).toBeInTheDocument();
  });

  it('settings show each channel\'s capabilities and the LinkedIn daily limit', async () => {
    api.settings.mockResolvedValue({ sendingEnabled: false, dailySendLimit: 20, batchLimit: 10, linkedinDailyLimit: 15, requireOwnerVerification: true, retentionDays: 365, senderName: 'ArchMind' });
    api.materials.mockResolvedValue([]);
    api.suppressions.mockResolvedValue([]);
    api.providers.mockResolvedValue({ email: { configured: true }, providers: [], channels: [{ channel: 'EMAIL', name: 'platform-email', capabilities: { configured: true } }, { channel: 'LINKEDIN', name: 'linkedin-manual', capabilities: { configured: false, supportsDirectMessaging: false } }] });
    render(<OutreachSettingsPage />);
    expect(await screen.findByText('owner.outreach.providers.linkedin_manual')).toBeInTheDocument();
    expect(screen.getByLabelText('owner.outreach.settings.li_daily')).toHaveValue(15);
    expect(screen.getByText('owner.outreach.providers.manual')).toBeInTheDocument();
  });
});

describe('ArchMind LinkedIn page', () => {
  const NOT_CONFIGURED = { provider: 'linkedin-page-manual', capabilities: { configured: false }, status: 'NOT_CONNECTED', publishMode: 'MANUAL', candidates: [], manualPageUrl: null, pageUrl: null };

  it('without a LinkedIn app: explains manual publishing, offers no sign-in and saves the page address', async () => {
    api.linkedinPage.mockResolvedValue(NOT_CONFIGURED);
    api.linkedinPageUrl.mockResolvedValue({ ...NOT_CONFIGURED, manualPageUrl: 'https://www.linkedin.com/company/archmind/' });
    render(<LinkedInPageCard />);
    expect(await screen.findByText('owner.outreach.page.not_configured')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.page.never_password')).toBeInTheDocument();
    expect(screen.queryByText('owner.outreach.page.connect')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('owner.outreach.page.manual_url'), { target: { value: 'https://www.linkedin.com/company/archmind/' } });
    fireEvent.click(screen.getByText('owner.outreach.save'));
    await waitFor(() => expect(api.linkedinPageUrl).toHaveBeenCalledWith('https://www.linkedin.com/company/archmind/'));
  });

  it('with a LinkedIn app: Connect goes to LinkedIn sign-in; several pages are offered to choose', async () => {
    api.linkedinPage.mockResolvedValue({ ...NOT_CONFIGURED, capabilities: { configured: true }, status: 'SELECT_ORGANIZATION', candidates: [{ urn: 'urn:li:organization:1', name: 'ArchMind' }, { urn: 'urn:li:organization:2', name: 'Other' }] });
    api.linkedinPageConnect.mockResolvedValue({ url: 'https://www.linkedin.com/oauth/v2/authorization?state=x' });
    api.linkedinPageSelect.mockResolvedValue({});
    const assign = jest.fn();
    const original = window.location;
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } });
    render(<LinkedInPageCard />);
    fireEvent.click((await screen.findAllByText('owner.outreach.page.use_this'))[0]);
    await waitFor(() => expect(api.linkedinPageSelect).toHaveBeenCalledWith('urn:li:organization:1'));
    await waitFor(() => expect(screen.getByText('owner.outreach.page.connect')).not.toBeDisabled());
    fireEvent.click(screen.getByText('owner.outreach.page.connect'));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://www.linkedin.com/oauth/v2/authorization?state=x'));
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });

  it('the LinkedIn return page hands code and state to the backend and returns to the page', async () => {
    mockSearch = new URLSearchParams('code=abc&state=st1');
    api.linkedinPageCallback.mockResolvedValue({ status: 'CONNECTED' });
    render(<LinkedInCallbackPage />);
    await waitFor(() => expect(api.linkedinPageCallback).toHaveBeenCalledWith({ code: 'abc', state: 'st1' }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/owner/outreach/page', { replace: true }));
  });

  it('a LinkedIn sign-in refusal is shown, nothing is sent', async () => {
    mockSearch = new URLSearchParams('error=user_cancelled_login&error_description=The+member+cancelled');
    render(<LinkedInCallbackPage />);
    expect(await screen.findByText('The member cancelled')).toBeInTheDocument();
    expect(api.linkedinPageCallback).not.toHaveBeenCalled();
  });

  it('prepares a post, approves it, and publishing by hand offers copy, open page and record', async () => {
    const POST = { id: 'pp1', kind: 'THOUGHT_LEADERSHIP', topic: 'Capability maps', language: 'EN', body: 'Capability maps connect strategy to architecture decisions. #EnterpriseArchitecture', status: 'READY_FOR_REVIEW', generation: { generator: 'TEMPLATE' }, createdAt: '2026-10-08T00:00:00Z' };
    api.linkedinPage.mockResolvedValue({ ...NOT_CONFIGURED, manualPageUrl: 'https://www.linkedin.com/company/archmind/', pageUrl: 'https://www.linkedin.com/company/archmind/' });
    api.pagePosts.mockResolvedValue([]);
    api.createPagePost.mockResolvedValue(POST);
    api.pagePost.mockResolvedValueOnce(POST).mockResolvedValue({ ...POST, status: 'APPROVED' });
    api.approvePagePost.mockResolvedValue({});
    api.publishPagePost.mockResolvedValue({ status: 'MANUAL_REQUIRED', reason: 'LINKEDIN_NOT_CONFIGURED', pageUrl: 'https://www.linkedin.com/company/archmind/' });
    api.recordPagePost.mockResolvedValue({});
    const writeText = jest.fn(async () => undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<OutreachPagePage />);
    expect(await screen.findByText('owner.outreach.page.no_posts')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.page.new_post'));
    fireEvent.change(screen.getByLabelText('owner.outreach.page.topic'), { target: { value: 'Capability maps' } });
    fireEvent.click(screen.getByText('owner.outreach.page.prepare'));
    await waitFor(() => expect(api.createPagePost).toHaveBeenCalledWith({ kind: 'THOUGHT_LEADERSHIP', topic: 'Capability maps', language: 'EN' }));
    expect(await screen.findByText('owner.outreach.li.count')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.approve'));
    await waitFor(() => expect(api.approvePagePost).toHaveBeenCalledWith('pp1'));
    fireEvent.click(await screen.findByText('owner.outreach.page.publish'));
    fireEvent.change(screen.getByLabelText('owner.password'), { target: { value: 'Owner1234!' } });
    fireEvent.click(within(screen.getByRole('dialog', { name: 'owner.outreach.page.publish' })).getByRole('button', { name: 'owner.outreach.page.publish' }));
    await waitFor(() => expect(api.publishPagePost).toHaveBeenCalledWith('pp1', 'Owner1234!'));
    expect(await screen.findByText('owner.outreach.page.manual_required')).toBeInTheDocument();
    expect(screen.getByText('owner.outreach.page.open_page').closest('a')).toHaveAttribute('href', 'https://www.linkedin.com/company/archmind/');
    fireEvent.click(screen.getByText('owner.outreach.page.copy'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(POST.body));
    fireEvent.change(screen.getByLabelText('owner.outreach.page.post_link'), { target: { value: 'https://www.linkedin.com/feed/update/urn:li:share:5/' } });
    fireEvent.click(screen.getByText('owner.outreach.page.mark_published'));
    await waitFor(() => expect(api.recordPagePost).toHaveBeenCalledWith('pp1', { postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:5/' }));
  });

  it('a welcome post cannot be prepared without an entity and its recorded agreement', async () => {
    api.linkedinPage.mockResolvedValue(NOT_CONFIGURED);
    api.pagePosts.mockResolvedValue([]);
    api.entities.mockResolvedValue({ entities: [{ id: 'e1', nameEn: 'Human Resources Development Fund', tenantId: 't1', suppressed: false }, { id: 'e2', nameEn: 'No workspace', tenantId: null }] });
    api.createPagePost.mockResolvedValue({ id: 'pp2' });
    api.pagePost.mockResolvedValue({ id: 'pp2', kind: 'ENTITY_WELCOME', body: 'x'.repeat(50), status: 'READY_FOR_REVIEW', generation: {} });
    render(<OutreachPagePage />);
    fireEvent.click(await screen.findByText('owner.outreach.page.new_post'));
    fireEvent.change(screen.getByLabelText('owner.outreach.page.kind'), { target: { value: 'ENTITY_WELCOME' } });
    fireEvent.change(screen.getByLabelText('owner.outreach.page.topic'), { target: { value: 'Starting the EA journey' } });
    expect(await screen.findByText('Human Resources Development Fund')).toBeInTheDocument();
    expect(screen.queryByText('No workspace')).not.toBeInTheDocument();
    expect(screen.getByText('owner.outreach.page.prepare')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('owner.outreach.col.entity'), { target: { value: 'e1' } });
    expect(screen.getByText('owner.outreach.page.prepare')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('owner.outreach.page.consent'), { target: { value: 'Approved by the CIO office by email' } });
    fireEvent.click(screen.getByText('owner.outreach.page.prepare'));
    await waitFor(() => expect(api.createPagePost).toHaveBeenCalledWith({ kind: 'ENTITY_WELCOME', topic: 'Starting the EA journey', language: 'EN', entityId: 'e1', entityConsentNote: 'Approved by the CIO office by email' }));
  });
});

describe('Prospect search', () => {
  it('turns a sentence into adjustable filters and queries with them', async () => {
    api.prospects.mockResolvedValue([{ ...PROSPECT, entity: { id: 'e1', nameEn: ENTITY.nameEn }, outreach: { eligible: true, blockers: [] } }]);
    api.interpret.mockResolvedValue({ roleCategory: 'ENTERPRISE_ARCHITECTURE', seniorities: ['DIRECTOR'], entityTypes: ['MINISTRY'], country: 'SA', terms: [] });
    render(<OutreachProspectsPage />);
    expect(await screen.findByText('Ahmed Al-Qahtani')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('owner.outreach.prospects.ask_example'), { target: { value: 'Find EA Directors in Saudi ministries' } });
    fireEvent.click(screen.getByText('owner.outreach.prospects.apply'));
    expect(await screen.findByText('owner.outreach.role.ENTERPRISE_ARCHITECTURE ✕')).toBeInTheDocument();
    await waitFor(() => expect(api.prospects).toHaveBeenLastCalledWith(expect.objectContaining({ roleCategory: 'ENTERPRISE_ARCHITECTURE', seniorities: 'DIRECTOR', entityTypes: 'MINISTRY' })));
    fireEvent.click(screen.getByText('owner.outreach.type.MINISTRY ✕'));
    await waitFor(() => expect(api.prospects.mock.calls.at(-1)[0].entityTypes).toBeUndefined());
    expect(screen.getByText('owner.outreach.eligible_short')).toBeInTheDocument();
  });
});

describe('Campaigns', () => {
  it('lists campaigns and creates one', async () => {
    api.campaigns.mockResolvedValue([]);
    api.createCampaign.mockResolvedValue({ id: 'c9' });
    render(<OutreachCampaignsPage />);
    expect(await screen.findByText('owner.outreach.campaigns.empty')).toBeInTheDocument();
    fireEvent.click(screen.getByText('owner.outreach.campaigns.new'));
    fireEvent.change(screen.getByLabelText('owner.outreach.campaigns.name'), { target: { value: 'KSA Government EA Outreach — Q4 2026' } });
    fireEvent.click(screen.getByText('owner.outreach.save'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/owner/outreach/campaigns/c9'));
  });

  const CAMPAIGN = {
    campaign: { id: 'c1', name: 'Q4', status: 'ACTIVE' },
    metrics: { entitiesSelected: 2, prospectsSelected: 3, tenantsCreated: 1, tenantsEnriched: 1, invitationsPrepared: 2, emailsPrepared: 2, emailsApproved: 1, emailsSent: 0, deliveryFailed: 0, activated: 0, tenantFirstLogin: 0, engaged: 0 },
    entities: [], prospects: [],
    messages: [
      { id: 'm1', status: 'DRAFT', subject: 'Workspace for HRDF', recipient: 'a@hrdf.org.sa', prospect: { fullName: 'Ahmed' }, entity: ENTITY, generation: { generator: 'AI' } },
      { id: 'm2', status: 'APPROVED', subject: 'Workspace for HRDF', recipient: 's@hrdf.org.sa', prospect: { fullName: 'Sara' }, entity: ENTITY, generation: { generator: 'TEMPLATE' } },
      { id: 'm3', status: 'SENT', subject: 'x', recipient: 'k@hrdf.org.sa', prospect: { fullName: 'Khalid' }, entity: ENTITY, generation: {} },
    ],
  };

  it('approves drafts and sends approved emails only after the password', async () => {
    mockParams = { id: 'c1' };
    api.campaign.mockResolvedValue(CAMPAIGN);
    api.approve.mockResolvedValue({ approved: 1, results: [{ messageId: 'm1', status: 'APPROVED' }] });
    api.send.mockResolvedValue({ sent: 0, remainingToday: 19, results: [{ messageId: 'm2', status: 'BLOCKED', blockers: ['DO_NOT_CONTACT'] }] });
    render(<OutreachCampaignPage />);
    expect(await screen.findByText('owner.outreach.metric.sent')).toBeInTheDocument();
    expect(screen.getByLabelText('owner.outreach.select Khalid')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('owner.outreach.select Ahmed'));
    fireEvent.click(screen.getByLabelText('owner.outreach.select Sara'));
    fireEvent.click(screen.getByText('owner.outreach.approve (1)'));
    await waitFor(() => expect(api.approve).toHaveBeenCalledWith(['m1']));
    fireEvent.click(screen.getByLabelText('owner.outreach.select Sara'));
    fireEvent.click(screen.getByText('owner.outreach.send (1)'));
    fireEvent.change(screen.getByLabelText('owner.password'), { target: { value: 'Owner1234!' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByText('owner.outreach.send'));
    await waitFor(() => expect(api.send).toHaveBeenCalledWith('c1', { messageIds: ['m2'], password: 'Owner1234!' }));
    expect(await screen.findByText('owner.outreach.blocker.DO_NOT_CONTACT')).toBeInTheDocument();
  });

  it('the editor shows the fixed footer and saves only the changed fields', async () => {
    mockParams = { id: 'c1' };
    api.campaign.mockResolvedValue(CAMPAIGN);
    api.materials.mockResolvedValue([{ id: 'mat', name: 'ArchMind deck', isDefault: true }]);
    api.preview.mockResolvedValue({ message: { id: 'm1', status: 'DRAFT', subject: 'Workspace for HRDF', body: 'Dear Ahmed, …', recipient: 'a@hrdf.org.sa', attachMaterial: true, materialId: 'mat', language: 'EN', generation: { generator: 'AI', rejected: [] } }, footer: 'To open the workspace, activate your account with this single-use link:\n{{ACTIVATION_LINK}}', material: null });
    api.updateInteraction.mockResolvedValue({});
    render(<OutreachCampaignPage />);
    fireEvent.click((await screen.findAllByText('owner.outreach.review_edit'))[0]);
    expect(await screen.findByText(/\{\{ACTIVATION_LINK\}\}/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('owner.outreach.col.subject'), { target: { value: 'An initial workspace for HRDF' } });
    fireEvent.click(screen.getByText('owner.outreach.save'));
    await waitFor(() => expect(api.updateInteraction).toHaveBeenCalledWith('m1', { subject: 'An initial workspace for HRDF' }));
  });
});

describe('Outreach settings', () => {
  it('saves sending controls with the legal basis and uploads the presentation', async () => {
    api.settings.mockResolvedValue({ sendingEnabled: false, legalBasisNote: null, dailySendLimit: 20, batchLimit: 10, requireOwnerVerification: true, retentionDays: 365, senderName: 'ArchMind', replyTo: null, contactLine: null });
    api.materials.mockResolvedValue([]);
    api.providers.mockResolvedValue({ email: { configured: true }, providers: [{ name: 'linkedin', kind: 'PROFESSIONAL', configured: false }] });
    api.suppressions.mockResolvedValue([]);
    api.saveSettings.mockResolvedValue({});
    api.uploadMaterial.mockResolvedValue({ id: 'm' });
    render(<OutreachSettingsPage />);
    expect(await screen.findByText('owner.outreach.provider_detail.linkedin')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('owner.outreach.settings.enabled'));
    fireEvent.change(screen.getByLabelText('owner.outreach.settings.legal_basis'), { target: { value: 'Legitimate interest reviewed by counsel, ref LC-2026-14' } });
    fireEvent.click(screen.getByText('owner.outreach.save'));
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ sendingEnabled: true, legalBasisNote: 'Legitimate interest reviewed by counsel, ref LC-2026-14', dailySendLimit: 20 })));
    const file = new File(['deck'], 'ArchMind.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
    fireEvent.change(document.getElementById('or-mat-file') as HTMLInputElement, { target: { files: [file] } });
    await waitFor(() => expect(api.uploadMaterial).toHaveBeenCalledWith(file, true));
  });
});

describe('AR/EN coverage', () => {
  it('every outreach string (static and every dynamic family) has English and Arabic', () => {
    const dir = path.resolve(__dirname, '..');
    const files = fs.readdirSync(dir).filter(f => /\.tsx?$/.test(f) && f !== 'outreachStrings.ts').map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
    const used = new Set<string>();
    for (const src of files) for (const m of src.matchAll(/t\('(owner\.[a-zA-Z0-9_.-]+)'\)/g)) used.add(m[1]);
    const families: Record<string, string[]> = {
      'owner.outreach.type.': [...C.ENTITY_TYPES, 'auto'], 'owner.outreach.gov.': C.GOV_STATUSES, 'owner.outreach.match.': C.TENANT_MATCHES, 'owner.outreach.match_help.': C.TENANT_MATCHES,
      'owner.outreach.entity_outreach.': C.ENTITY_OUTREACH, 'owner.outreach.role.': C.ROLE_CATEGORIES, 'owner.outreach.role_short.': C.ROLE_CATEGORIES, 'owner.outreach.seniority.': C.SENIORITIES,
      'owner.outreach.employment.': C.EMPLOYMENT, 'owner.outreach.page.status.': C.PAGE_STATUSES, 'owner.outreach.page.mode.': ['API', 'MANUAL'], 'owner.outreach.page.kind.': C.POST_KINDS, 'owner.outreach.page.post_status.': C.POST_STATUSES, 'owner.outreach.channel.': C.CHANNELS, 'owner.outreach.itype.': C.INTERACTION_TYPES, 'owner.outreach.li_status.': C.LINKEDIN_STATUSES,
      'owner.outreach.strategy.': C.STRATEGIES, 'owner.outreach.strategy_detail.': C.STRATEGIES, 'owner.outreach.li_type.': C.LINKEDIN_TYPES, 'owner.outreach.recommend.': C.RECOMMENDATIONS, 'owner.outreach.recommend_reason.': C.RECOMMENDATIONS,
      'owner.outreach.tl.': C.TIMELINE_KINDS, 'owner.outreach.li_source.': ['SOURCE', 'OWNER'], 'owner.outreach.li.recorded.': ['SENT', 'REPLIED', 'FAILED'],
      'owner.outreach.capability.': ['supportsProfileDiscovery', 'supportsConnectionRequest', 'supportsDirectMessaging', 'supportsMessageStatus'], 'owner.outreach.email_status.': C.EMAIL_STATUSES, 'owner.outreach.stage.': C.STAGES, 'owner.outreach.blocker.': C.BLOCKERS,
      'owner.outreach.template.': C.TEMPLATE_ROLES, 'owner.outreach.legacy.': C.LEGACY_ROLES, 'owner.outreach.message_status.': C.MESSAGE_STATUSES, 'owner.outreach.tenant.': ['LINKED', 'NONE'],
      'owner.outreach.source.': ['AI_DISCOVERY', 'OWNER'], 'owner.outreach.basis.': ['LEXICON', 'LEXICON_AND_AI', 'AI_PROPOSED', 'OWNER', 'NONE'],
      'owner.outreach.factor.': ['ROLE', 'SENIORITY', 'CURRENT_EMPLOYMENT', 'GOVERNMENT_ORGANIZATION', 'SOURCE_QUALITY', 'EVIDENCE_RECENCY'],
      'owner.outreach.job.mode.': ['ENTITIES', 'PROFESSIONALS'], 'owner.outreach.job.status.': [...C.JOB_RUNNING, 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED'],
      'owner.outreach.job.stage.': ['ENTITY_DISCOVERY', 'PROFESSIONAL_DISCOVERY', 'VERIFICATION', 'CLASSIFICATION', 'DEDUPLICATION', 'ENTITY_MAPPING'],
      'owner.outreach.funnel.': C.FUNNEL, 'owner.outreach.skip.': ['NOT_FOUND', 'ENTITY_SUPPRESSED', 'NOT_GOVERNMENT', 'DISCOVERY_RUNNING'],
      'owner.outreach.invite.status.': ['PREPARED', 'BLOCKED', 'FAILED', 'NOT_FOUND'], 'owner.outreach.draft_status.': ['DRAFTED', 'EXISTS', 'BLOCKED'], 'owner.outreach.campaign_status.': ['DRAFT', 'ACTIVE', 'CLOSED'],
      'owner.outreach.result.': ['SENT', 'APPROVED', 'SKIPPED', 'BLOCKED', 'FAILED', 'MANUAL_REQUIRED'], 'owner.outreach.generator.': ['AI', 'TEMPLATE'],
      'owner.outreach.provider.': ['web-search-organizations', 'official-site-people', 'web-search-people', 'linkedin'], 'owner.outreach.provider_detail.': ['web-search-organizations', 'official-site-people', 'web-search-people', 'linkedin'],
      'owner.outreach.suppression.scope.': ['EMAIL', 'PERSON', 'ENTITY', 'DOMAIN'], 'owner.outreach.suppression.source.': ['OWNER', 'OPT_OUT', 'ERASURE'],
      'owner.stage.': ['QUEUED', 'DISCOVERING', 'READY_FOR_REVIEW', 'COMPLETED', 'FAILED', 'CANCELLED'], 'owner.status.': ['ACTIVE', 'SUSPENDED'],
    };
    for (const [p, ks] of Object.entries(families)) for (const k of ks) used.add(p + k);
    const missing = [...used].filter(k => !OWNER_TRANSLATIONS[k]);
    expect(missing).toEqual([]);
    for (const [k, v] of Object.entries(OWNER_TRANSLATIONS)) {
      if (!k.startsWith('owner.outreach') && k !== 'owner.nav.outreach') continue;
      expect({ k, en: !!v.EN?.trim(), ar: /[؀-ۿ]/.test(v.AR) || /^(LinkedIn)$/.test(v.AR) }).toEqual({ k, en: true, ar: true });
    }
  });
});
