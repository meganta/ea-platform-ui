import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AssetProfileScreen from '../AssetProfileScreen';
import { displayValue, fromInputValue, toInputValue, validateValue } from '../assetProfile';

const t = (k: string) => k;
const ASSET = { id: 'a1', name: '1HRDF', nameAr: 'منصة الصندوق', domain: 'APPLICATION', assetType: 'Application', status: 'APPROVED', source: 'MANUAL', owner: 'HR IT', version: '1.0', metadata: { alias: 'HR Portal', hostingType: 'SAAS', leanixCode: 'LX-1', legacyField: 'kept' }, tags: ['core'] };
const PROFILE = {
  asset: ASSET,
  objectType: { id: 'app', code: 'Application', name: 'Application', nameAr: 'تطبيق', icon: '🧩' },
  resolution: 'RESOLVED',
  attributeGroups: [
    { id: '', name: '', isCollapsed: false, attributes: [
      { code: 'alias', name: 'Alias', attributeType: 'TEXT', isRequired: false, isReadOnly: false, value: 'HR Portal', hasValue: true },
      { code: 'users', name: 'Number of users', attributeType: 'INTEGER', isRequired: false, isReadOnly: false, value: null, hasValue: false },
    ] },
    { id: 'g1', name: 'Operations', nameAr: 'التشغيل', isCollapsed: false, attributes: [
      { code: 'hostingType', name: 'Hosting Type', attributeType: 'ENUM', isRequired: true, isReadOnly: false, value: 'SAAS', hasValue: true, enumValues: [{ value: 'SAAS', label: 'SaaS' }, { value: 'ONPREM', label: 'On premises' }] },
      { code: 'leanixCode', name: 'LeanIX Code', attributeType: 'TEXT', isRequired: false, isReadOnly: false, value: 'LX-1', hasValue: true },
      { code: 'applicationUrl', name: 'Application URL', attributeType: 'URL', isRequired: false, isReadOnly: false, value: null, hasValue: false },
    ] },
  ],
  otherAttributes: [{ key: 'legacyField', value: 'kept' }],
  completeness: { filled: 3, total: 5, requiredMissing: [] },
  relationshipSlots: [
    { definitionId: 'uses', code: 'APP_USES_DATA', name: 'uses', direction: 'OUTGOING', label: 'uses', forwardLabel: 'uses', otherType: { id: 'data', code: 'DataEntity', name: 'Data Entity' }, cardinality: 'MANY_TO_MANY', single: false, isRequired: false,
      attributes: [{ code: 'crud', name: 'CRUD', attributeType: 'TEXT', isRequired: false }], count: 2,
      items: [{ relationshipId: 'r1', metadata: { crud: 'R' }, relatedAsset: { id: 'd1', name: 'Employee', assetType: 'DataEntity' } }, { relationshipId: 'r2', metadata: {}, relatedAsset: { id: 'd2', name: 'Contract', assetType: 'DataEntity' } }], truncated: false },
    { definitionId: 'owned', code: 'APP_OWNED_BY_ORG', name: 'owned by', direction: 'OUTGOING', label: 'business-owned by', forwardLabel: 'business-owned by', otherType: { id: 'org', code: 'OrgUnit', name: 'Organisation Unit' }, cardinality: 'MANY_TO_ONE', single: true, isRequired: true, attributes: [], count: 0, items: [], truncated: false },
    { definitionId: 'involves', code: 'PROJECT_INVOLVES_APP', name: 'involves', direction: 'INCOMING', label: 'involved in project', forwardLabel: 'involves', otherType: { id: 'proj', code: 'Project', name: 'Project' }, cardinality: 'MANY_TO_MANY', single: false, isRequired: false, attributes: [], count: 0, items: [], truncated: false },
  ],
  otherRelationships: [{ relationshipId: 'r9', direction: 'OUTGOING', label: 'relates to', relationshipType: 'relates to', metadata: {}, relatedAsset: { id: 'x1', name: 'Legacy thing', assetType: 'Other' } }],
  relationshipTotals: { linked: 3, truncated: false },
};

let calls: Array<{ url: string; init?: any }> = [];
function mockApi(overrides: Record<string, any> = {}) {
  calls = [];
  (global as any).fetch = jest.fn(async (url: string, init?: any) => {
    calls.push({ url, init });
    const method = init?.method || 'GET';
    const route = Object.keys(overrides).find(k => url.includes(k.split(' ').pop()!) && (!k.includes(' ') || k.startsWith(method)));
    if (route) { const r = overrides[route]; return typeof r === 'function' ? r(url, init) : { ok: true, json: async () => r }; }
    if (url.includes('relationship-candidates')) return { ok: true, json: async () => ({ items: [{ id: 'o1', name: 'HR Department', assetType: 'OrgUnit' }, { id: 'o2', name: 'IT Department', assetType: 'OrgUnit' }], total: 2 }) };
    if (method !== 'GET') return { ok: true, json: async () => ({ id: 'new' }) };
    return { ok: true, json: async () => ({}) };
  });
  localStorage.setItem('ea_token', 'tok');
}
const makeApi = () => ({
  get: jest.fn(async (path: string) => (path.endsWith('/profile') ? PROFILE : path.includes('findings') ? { findings: [] } : { items: [] })),
  put: jest.fn(), del: jest.fn(), upload: jest.fn(), download: jest.fn(),
});
const props = (extra: any = {}) => ({
  asset: { id: 'a1', name: '1HRDF' }, t, isAR: false, api: makeApi(), domains: ['APPLICATION'], typesFor: () => ['Application'],
  sourceLabel: () => ({ label: 'Manual' }), statusClass: () => 'badge-approved', sourceClass: () => 'badge-draft', syncedLabels: {},
  onBack: jest.fn(), onOpenAsset: jest.fn(), onDelete: jest.fn(), onModeChange: jest.fn(), onChanged: jest.fn(), onExplore: jest.fn(), ...extra,
});

beforeEach(() => { jest.clearAllMocks(); mockApi(); });

describe('asset profile page: view', () => {
  it('shows the object as a page with its facts, completeness and a way back to the list', async () => {
    const p = props();
    render(<AssetProfileScreen {...p} />);
    expect(await screen.findByRole('heading', { name: '1HRDF' })).toBeInTheDocument();
    expect(await screen.findByText('منصة الصندوق')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    fireEvent.click(screen.getByRole('button', { name: /repository.profile.back/ }));
    expect(p.onBack).toHaveBeenCalled();
  });

  it('lists every Meta Model attribute in its group, empty ones as not recorded, plus other recorded data', async () => {
    render(<AssetProfileScreen {...props()} />);
    fireEvent.click(await screen.findByRole('tab', { name: /repository.profile.tab.attributes \(3\/5\)/ }));
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(screen.getByText('SaaS')).toBeInTheDocument();
    expect(screen.getAllByText('repository.profile.not_recorded')).toHaveLength(2);
    expect(screen.getByText('legacyField')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('repository.profile.only_recorded'));
    expect(screen.queryByText('Number of users')).not.toBeInTheDocument();
    expect(screen.getByText('Alias')).toBeInTheDocument();
  });

  it('lists every relationship the type allows, with linked objects (that open), empty and required ones, and other links', async () => {
    const p = props();
    render(<AssetProfileScreen {...p} />);
    fireEvent.click(await screen.findByRole('tab', { name: /repository.profile.tab.relationships \(3\)/ }));
    const uses = screen.getByTestId('slot-APP_USES_DATA-OUTGOING');
    expect(within(uses).getByText('CRUD: R')).toBeInTheDocument();
    fireEvent.click(within(uses).getByRole('button', { name: 'Employee' }));
    expect(p.onOpenAsset).toHaveBeenCalledWith('d1', 'Employee');
    const owned = screen.getByTestId('slot-APP_OWNED_BY_ORG-OUTGOING');
    expect(within(owned).getByText('repository.profile.none_recorded')).toBeInTheDocument();
    expect(within(owned).getByText('repository.profile.required')).toBeInTheDocument();
    expect(screen.getByTestId('slot-PROJECT_INVOLVES_APP-INCOMING')).toHaveTextContent('involved in project');
    expect(screen.getByText('Legacy thing')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('repository.profile.hide_empty_relationships'));
    expect(screen.queryByTestId('slot-APP_OWNED_BY_ORG-OUTGOING')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('repository.profile.filter_related'), { target: { value: 'contr' } });
    expect(screen.queryByText('Employee')).not.toBeInTheDocument();
    expect(screen.getByText('Contract')).toBeInTheDocument();
  });

  it('still shows the core of an object whose profile cannot be loaded', async () => {
    const failing = { ...makeApi(), get: jest.fn(async (path: string) => { if (path.endsWith('/profile')) throw new Error('down'); return {}; }) };
    render(<AssetProfileScreen {...props({ api: failing, asset: { id: 'a1', name: 'Core Banking' } })} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('repository.profile.load_failed');
    expect(screen.getByRole('heading', { name: 'Core Banking' })).toBeInTheDocument();
  });
});

describe('asset profile page: edit', () => {
  const openEditor = async (extra: any = {}) => {
    const p = props({ startInEdit: true, ...extra });
    render(<AssetProfileScreen {...p} />);
    await screen.findByLabelText(/repository.profile.name_en/);
    return p;
  };

  it('offers an input per attribute type, validates, and saves all values keeping data the Meta Model does not define', async () => {
    const p = await openEditor();
    expect(screen.getByLabelText(/Hosting Type/)).toHaveValue('SAAS');
    fireEvent.change(screen.getByLabelText('Number of users'), { target: { value: '12.5' } });
    fireEvent.change(screen.getByLabelText('Application URL'), { target: { value: 'not a link' } });
    fireEvent.click(screen.getByText('repository.profile.save'));
    expect(await screen.findByText('repository.profile.error.integer')).toBeInTheDocument();
    expect(screen.getByText('repository.profile.error.url')).toBeInTheDocument();
    expect(calls.filter(c => c.init?.method === 'PUT')).toHaveLength(0);

    fireEvent.change(screen.getByLabelText('Number of users'), { target: { value: '1200' } });
    fireEvent.change(screen.getByLabelText('Application URL'), { target: { value: 'https://hrdf.example' } });
    fireEvent.change(screen.getByLabelText('Alias'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(/Hosting Type/), { target: { value: 'ONPREM' } });
    fireEvent.change(screen.getByLabelText('repository.profile.owner'), { target: { value: 'Digital' } });
    fireEvent.click(screen.getByText('repository.profile.save'));
    await waitFor(() => expect(p.onChanged).toHaveBeenCalled());
    const put = calls.find(c => c.init?.method === 'PUT')!;
    expect(put.url).toMatch(/\/ea-repository\/assets\/a1$/);
    const body = JSON.parse(put.init.body);
    expect(body).toMatchObject({ owner: 'Digital', name: '1HRDF', tags: ['core'] });
    expect(body.metadata).toEqual({ users: 1200, applicationUrl: 'https://hrdf.example', hostingType: 'ONPREM', leanixCode: 'LX-1', legacyField: 'kept' });
    expect(await screen.findByText('repository.profile.saved')).toBeInTheDocument();
  });

  it('adds links from objects of the right type, removes links, edits a link\'s attributes and replaces a single-valued one', async () => {
    await openEditor();
    // add to the incoming "involved in project" slot: the other object is the source, the verb is the forward label
    const involves = screen.getByTestId('edit-slot-PROJECT_INVOLVES_APP-INCOMING');
    fireEvent.click(within(involves).getByRole('button', { name: '+ repository.profile.add' }));
    fireEvent.change(within(involves).getByLabelText('repository.profile.find'), { target: { value: 'HR' } });
    fireEvent.click(await within(involves).findByRole('button', { name: /HR Department/ }));
    expect(within(involves).getByText('repository.profile.will_add')).toBeInTheDocument();
    await waitFor(() => expect(calls.some(c => c.url.includes('relationship-candidates') && c.url.includes('definitionId=involves') && c.url.includes('direction=INCOMING') && c.url.includes('search=HR'))).toBe(true));

    const uses = screen.getByTestId('edit-slot-APP_USES_DATA-OUTGOING');
    fireEvent.click(within(uses).getByRole('button', { name: 'repository.profile.remove Contract' }));
    expect(within(uses).getByText('repository.profile.will_remove')).toBeInTheDocument();
    fireEvent.change(within(uses).getAllByLabelText('CRUD')[0], { target: { value: 'CRUD' } });

    const owned = screen.getByTestId('edit-slot-APP_OWNED_BY_ORG-OUTGOING');
    fireEvent.click(within(owned).getByRole('button', { name: '+ repository.profile.add' }));
    fireEvent.click(await within(owned).findByRole('button', { name: /IT Department/ }));
    expect(screen.getByText('repository.profile.pending_changes')).toBeInTheDocument();

    fireEvent.click(screen.getByText('repository.profile.save'));
    await waitFor(() => expect(calls.filter(c => c.init?.method === 'POST')).toHaveLength(2));
    const posts = calls.filter(c => c.init?.method === 'POST').map(c => JSON.parse(c.init.body));
    expect(posts).toContainEqual({ sourceId: 'o1', targetId: 'a1', relationshipType: 'involves', relationshipDefinitionId: 'involves' });
    expect(posts).toContainEqual({ sourceId: 'a1', targetId: 'o2', relationshipType: 'business-owned by', relationshipDefinitionId: 'owned' });
    expect(calls.find(c => c.init?.method === 'DELETE')!.url).toMatch(/relationships\/r2$/);
    const patch = calls.find(c => c.init?.method === 'PATCH')!;
    expect(patch.url).toMatch(/relationships\/r1$/);
    expect(JSON.parse(patch.init.body)).toEqual({ metadata: { crud: 'CRUD' } });
  });

  it('reports relationship changes that failed while keeping what was saved', async () => {
    mockApi({ 'POST /ea-repository/relationships': () => ({ ok: false, status: 400, json: async () => ({ message: 'Canonical relationship endpoints do not match' }) }) });
    const p = await openEditor();
    const involves = screen.getByTestId('edit-slot-PROJECT_INVOLVES_APP-INCOMING');
    fireEvent.click(within(involves).getByRole('button', { name: '+ repository.profile.add' }));
    fireEvent.click(await within(involves).findByRole('button', { name: /HR Department/ }));
    fireEvent.click(screen.getByText('repository.profile.save'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('repository.profile.partial_saved');
    expect(alert).toHaveTextContent('HR Department: Canonical relationship endpoints do not match');
    expect(p.onChanged).not.toHaveBeenCalled();
  });

  it('cancel returns to the view without saving', async () => {
    const p = await openEditor();
    fireEvent.click(screen.getByText('repository.profile.cancel'));
    expect(p.onModeChange).toHaveBeenLastCalledWith(false);
    expect(await screen.findByRole('tab', { name: /repository.profile.tab.overview/ })).toBeInTheDocument();
    expect(calls.filter(c => c.init?.method && c.init.method !== 'GET')).toHaveLength(0);
  });

  it('works right to left in Arabic with Arabic names', async () => {
    render(<AssetProfileScreen {...props({ isAR: true })} />);
    expect(await screen.findByRole('heading', { name: 'منصة الصندوق' })).toBeInTheDocument();
    expect(screen.getByTestId('asset-profile')).toHaveAttribute('dir', 'rtl');
    fireEvent.click(screen.getByRole('tab', { name: /repository.profile.tab.attributes/ }));
    expect(screen.getByText('التشغيل')).toBeInTheDocument();
  });
});

describe('attribute value helpers', () => {
  it('turns stored values into input values and back by type', () => {
    expect(toInputValue('BOOLEAN', true)).toBe('true');
    expect(fromInputValue('BOOLEAN', 'false')).toBe(false);
    expect(fromInputValue('DECIMAL', '2.5')).toBe(2.5);
    expect(toInputValue('MULTI_ENUM', 'A, B')).toEqual(['A', 'B']);
    expect(fromInputValue('MULTI_ENUM', [])).toBeNull();
    expect(toInputValue('DATE', '2026-10-03T00:00:00Z')).toBe('2026-10-03');
    expect(fromInputValue('TEXT', '')).toBeNull();
  });
  it('validates by type and required', () => {
    expect(validateValue({ attributeType: 'TEXT', isRequired: true }, '')).toBe('repository.profile.error.required');
    expect(validateValue({ attributeType: 'PERCENTAGE', isRequired: false }, '120')).toBe('repository.profile.error.percentage');
    expect(validateValue({ attributeType: 'EMAIL', isRequired: false }, 'a@b.co')).toBeNull();
    expect(validateValue({ attributeType: 'DECIMAL', isRequired: false, validationRules: { max: 5 } }, '6')).toBe('repository.profile.error.max');
  });
  it('shows enum labels, yes/no and percentages', () => {
    const attr = { attributeType: 'MULTI_ENUM', enumValues: [{ value: 'A', label: 'Alpha', labelAr: 'ألف' }] };
    expect(displayValue(attr, ['A', 'Z'])).toBe('Alpha, Z');
    expect(displayValue(attr, ['A'], true)).toBe('ألف');
    expect(displayValue({ attributeType: 'BOOLEAN' }, false)).toBe('No');
    expect(displayValue({ attributeType: 'PERCENTAGE' }, 40)).toBe('40%');
  });
});
