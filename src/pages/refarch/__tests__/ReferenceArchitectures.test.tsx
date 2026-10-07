import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import ReferenceArchitecturesPage from '../../ReferenceArchitecturesPage'
import ReferenceDiagram from '../ReferenceDiagram'
import ImportWizard from '../ImportWizard'
import { buildTree, makeApi } from '../refArch'

let mockParams = new URLSearchParams()
const mockSetParams = jest.fn((fn: any) => { mockParams = typeof fn === 'function' ? fn(mockParams) : fn })
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  useSearchParams: () => [mockParams, mockSetParams],
  useNavigate: () => mockNavigate,
}), { virtual: true })

let mockIsAR = false
jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: mockIsAR, locale: mockIsAR ? 'AR' : 'EN' }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)
let mockAdmin = false
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => mockAdmin }) }))

const ARCH = { id: 'a1', code: 'APP', name: 'Application Reference Architecture', nameAr: 'المعمارية المرجعية للتطبيقات', kind: 'REFERENCE_ARCHITECTURE', authorityLevel: 'ORGANIZATION', domainCode: 'APPLICATION', activeVersionId: 'v1', derivedFromId: 'm1', derivedFrom: { id: 'm1', name: 'National Application Model', kind: 'REFERENCE_MODEL' }, versions: [{ id: 'v1', version: '1.0', status: 'ACTIVE', _count: { elements: 3 } }] }
const MODEL = { id: 'm1', name: 'National Application Model', kind: 'REFERENCE_MODEL', authorityLevel: 'NATIONAL', domainCode: 'APPLICATION', activeVersion: { id: 'mv1', version: '1.0' }, latestVersion: { id: 'mv1', version: '1.0', status: 'ACTIVE' } }
const ELEMENTS = [
  { stableKey: 'access', parentKey: null, kind: 'LAYER', name: 'Access layer', metaModelTypeCodes: [], metaModelStatus: 'STRUCTURAL', reviewStatus: 'ACCEPTED', sortOrder: 0 },
  { stableKey: 'portal', parentKey: 'access', kind: 'COMPONENT', name: 'Digital portal', nameAr: 'البوابة الرقمية', metaModelTypeCodes: ['Application'], metaModelStatus: 'RESOLVED', reviewStatus: 'ACCEPTED', sortOrder: 0, obligation: 'MANDATORY', authority: 'SOURCE_DECLARED', provenance: { fileName: 'ref.pptx', page: 9, originalText: 'البوابة الرقمية', confidence: 0.9, method: 'CONTAINMENT' } },
  { stableKey: 'kiosk', parentKey: 'access', kind: 'COMPONENT', name: 'Kiosk', metaModelTypeCodes: ['Application'], metaModelStatus: 'RESOLVED', reviewStatus: 'ACCEPTED', sortOrder: 1, obligation: 'MANDATORY' },
]
const CONF = {
  summary: { byStatus: { ALIGNED: ['portal'], GAP: ['kiosk'], PARTIALLY_ALIGNED: ['access'] }, coverage: { statement: '1 of 2 mandatory reference components have verified implementations', rule: 'Counted: ...' } },
  elements: [
    { stableKey: 'access', name: 'Access layer', kind: 'LAYER', obligation: 'RECOMMENDED', status: 'PARTIALLY_ALIGNED', absence: null, reason: 'agg', realizedBy: [], deviations: [], exceptions: [], proposedLinks: 0, duplication: false, metaModelTypeCodes: [] },
    { stableKey: 'portal', name: 'Digital portal', kind: 'COMPONENT', obligation: 'MANDATORY', status: 'ALIGNED', absence: null, reason: '1 confirmed implementation(s) present', realizedBy: [{ linkId: 'l1', objectId: 'app1', name: 'HRDF Website', linkType: 'REALIZES', present: true, lifecycleStatus: 'ACTIVE' }], deviations: [], exceptions: [], proposedLinks: 0, duplication: false, metaModelTypeCodes: ['Application'] },
    { stableKey: 'kiosk', name: 'Kiosk', kind: 'COMPONENT', obligation: 'MANDATORY', status: 'GAP', absence: 'NO_IMPLEMENTATION_EXISTS', reason: 'An architect confirmed that no implementation exists.', realizedBy: [], deviations: [], exceptions: [], proposedLinks: 0, duplication: false, metaModelTypeCodes: ['Application'] },
  ],
  orphans: { considered: 3, orphans: [{ id: 'o1', name: 'Legacy app', assetType: 'Application' }] },
}

function route(routes: Record<string, any>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length)
  return jest.fn((url: string, init?: any) => {
    const key = keys.find(k => url.includes(k))
    const body = key ? (typeof routes[key] === 'function' ? routes[key](url, init) : routes[key]) : {}
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)), json: () => Promise.resolve(body) })
  })
}
const calls = (f: jest.Mock, method: string, part: string) => f.mock.calls.filter(c => (c[1]?.method || 'GET') === method && String(c[0]).includes(part))

beforeEach(() => {
  mockParams = new URLSearchParams(); mockIsAR = false; mockAdmin = false
  Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true })
})

describe('Reference Architectures page', () => {
  it('lists architectures grouped by kind with their active version', async () => {
    global.fetch = route({ '/reference-architectures/meta-model': { domains: [{ code: 'APPLICATION', name: 'Application & Integration' }], objectTypes: [] }, '/reference-architectures': [MODEL, { ...ARCH, activeVersion: { id: 'v1', version: '1.0' }, latestVersion: { id: 'v1', version: '1.0', status: 'ACTIVE' } }] }) as any
    render(<ReferenceArchitecturesPage />)
    await waitFor(() => expect(screen.getByText('Application Reference Architecture')).toBeInTheDocument())
    expect(screen.getByRole('region', { name: 'refarch.kind.REFERENCE_MODEL' })).toHaveTextContent('National Application Model')
    expect(screen.getByRole('region', { name: 'refarch.kind.REFERENCE_ARCHITECTURE' })).toHaveTextContent('refarch.list.active: 1.0')
    fireEvent.click(screen.getByText('Application Reference Architecture'))
    const update = mockSetParams.mock.calls[0][0]
    expect(update(new URLSearchParams()).get('ra')).toBe('a1')
  })

  it('shows an honest empty state', async () => {
    global.fetch = route({ '/reference-architectures/meta-model': { domains: [], objectTypes: [] }, '/reference-architectures': [] }) as any
    render(<ReferenceArchitecturesPage />)
    expect(await screen.findByTestId('ra-empty')).toHaveTextContent('refarch.list.empty')
  })

  function workspaceFetch(extra: Record<string, any> = {}) {
    return route({
      '/reference-architectures/meta-model': { domains: [{ code: 'APPLICATION', name: 'Application & Integration' }], objectTypes: [{ code: 'Application', name: 'Application' }] },
      '/reference-architectures/a1/conformance': CONF,
      '/reference-architectures/versions/v1': { id: 'v1', version: '1.0', status: 'ACTIVE', elements: ELEMENTS, metaModelRequirements: [{ elementKey: 'x', element: 'Container platform', missing: 'Container platform type' }] },
      '/reference-architectures/a1/links': [],
      '/reference-architectures/proposals': [],
      '/reference-architectures/a1': ARCH,
      '/ea-views/scenarios': [{ id: 's0', type: 'CURRENT', name: 'Current' }, { id: 't1', type: 'TARGET', name: 'Target 2028' }],
      ...extra,
    })
  }

  it('opens a workspace: coverage stated with its denominator, Meta Model requirements, and the structured diagram with element details and provenance', async () => {
    mockParams = new URLSearchParams('ra=a1')
    const f = workspaceFetch(); global.fetch = f as any
    render(<ReferenceArchitecturesPage />)
    expect(await screen.findByTestId('ra-coverage')).toHaveTextContent('1 of 2 mandatory reference components have verified implementations')
    expect(screen.getByText('Container platform')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'refarch.tab.architecture' }))
    const diagram = await screen.findByTestId('ra-diagram')
    expect(within(diagram).getByTestId('ra-box-access')).toHaveTextContent('Digital portal')
    fireEvent.click(within(diagram).getByRole('button', { name: /Digital portal - refarch\.conf\.ALIGNED/ }))
    const drawer = await screen.findByTestId('ra-drawer')
    expect(drawer).toHaveTextContent('ref.pptx')
    expect(drawer).toHaveTextContent('البوابة الرقمية')
    expect(drawer).toHaveTextContent('HRDF Website')
    expect(drawer).toHaveTextContent('refarch.el.authority.SOURCE_DECLARED')
    await waitFor(() => expect(calls(f, 'GET', '/reference-architectures/a1/links?elementKey=portal').length).toBe(1))
  })

  it('links a capability to an object of another domain the Meta Model permits (REALIZED_BY), expected types first, never a type that cannot realize', async () => {
    mockParams = new URLSearchParams('ra=a1')
    const MM = {
      domains: [{ code: 'APPLICATION', name: 'Application' }, { code: 'TECHNOLOGY', name: 'Technology' }, { code: 'DATA', name: 'Data' }],
      objectTypes: [{ code: 'Application', name: 'Application', domain: 'APPLICATION' }, { code: 'ITServer', name: 'Server', domain: 'TECHNOLOGY' }, { code: 'ConceptualDataEntity', name: 'Data Entity', domain: 'DATA' }],
      realization: { relationships: ['REALIZED_BY', 'SUPPORTED_BY', 'DEPENDS_ON'], byType: { Application: ['REALIZED_BY', 'SUPPORTED_BY', 'DEPENDS_ON'], ITServer: ['REALIZED_BY', 'SUPPORTED_BY', 'DEPENDS_ON'], ConceptualDataEntity: ['SUPPORTED_BY', 'DEPENDS_ON'] } },
    }
    const crossConf = { ...CONF, elements: CONF.elements.map((e: any) => e.stableKey === 'portal' ? { ...e, realizedBy: [{ linkId: 'l1', objectId: 'srv1', name: 'Portal server', linkType: 'REALIZED_BY', targetType: 'ITServer', targetDomain: 'TECHNOLOGY', crossDomain: true, present: true, lifecycleStatus: 'ACTIVE' }], supportedBy: [{ linkId: 'l2', objectId: 'ent1', name: 'Applicant', linkType: 'SUPPORTED_BY', targetType: 'ConceptualDataEntity', targetDomain: 'DATA', crossDomain: true, present: true, lifecycleStatus: null }] } : e) }
    const f = workspaceFetch({
      '/reference-architectures/meta-model': MM,
      '/reference-architectures/a1/conformance': crossConf,
      '/ea-repository/assets?search=': { items: [{ id: 'srv2', name: 'Kiosk server', assetType: 'ITServer' }, { id: 'ent2', name: 'Kiosk data', assetType: 'ConceptualDataEntity' }, { id: 'app2', name: 'Kiosk app', assetType: 'Application' }] },
      '/reference-architectures/a1/links': (url: string, init: any) => (init?.method === 'POST' ? { id: 'new' } : []),
    }); global.fetch = f as any
    render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    fireEvent.click(screen.getByRole('tab', { name: 'refarch.tab.architecture' }))
    // The realized capability shows where its implementations sit.
    fireEvent.click(within(await screen.findByTestId('ra-diagram')).getByRole('button', { name: /Digital portal - refarch\.conf\.ALIGNED/ }))
    let drawer = await screen.findByTestId('ra-drawer')
    expect(drawer).toHaveTextContent('Portal server')
    expect(drawer).toHaveTextContent('TECHNOLOGY · refarch.el.cross_domain')
    expect(drawer).toHaveTextContent('refarch.el.supported_by')
    expect(drawer).toHaveTextContent('Applicant')
    fireEvent.click(within(drawer).getByRole('button', { name: 'common.close' }))
    fireEvent.click(within(screen.getByTestId('ra-diagram')).getByRole('button', { name: /Kiosk - refarch\.conf\.GAP/ }))
    drawer = await screen.findByTestId('ra-drawer')
    expect((within(drawer).getByLabelText('refarch.el.link_type') as HTMLSelectElement).value).toBe('REALIZED_BY')
    fireEvent.change(within(drawer).getByLabelText('refarch.el.search_object'), { target: { value: 'Kiosk' } })
    fireEvent.click(within(drawer).getByRole('button', { name: '🔍' }))
    await waitFor(() => expect(drawer).toHaveTextContent('Kiosk server'))
    const items = within(drawer).getAllByRole('listitem').map(li => li.textContent || '')
    const app = items.findIndex(x => x.includes('Kiosk app')); const srv = items.findIndex(x => x.includes('Kiosk server'))
    expect(app).toBeGreaterThan(-1); expect(app).toBeLessThan(srv)
    expect(drawer).not.toHaveTextContent('Kiosk data')
    expect(items[srv]).toContain('refarch.el.cross_domain')
    fireEvent.click(within(within(drawer).getAllByRole('listitem')[srv]).getByRole('button', { name: 'refarch.el.record' }))
    await waitFor(() => expect(calls(f, 'POST', '/reference-architectures/a1/links')).toHaveLength(1))
    expect(JSON.parse(calls(f, 'POST', '/reference-architectures/a1/links')[0][1].body)).toMatchObject({ elementKey: 'kiosk', linkType: 'REALIZED_BY', targetId: 'srv2' })
    // A data entity can support the capability or be a dependency of it.
    fireEvent.change(within(drawer).getByLabelText('refarch.el.link_type'), { target: { value: 'SUPPORTED_BY' } })
    fireEvent.click(within(drawer).getByRole('button', { name: '🔍' }))
    await waitFor(() => expect(drawer).toHaveTextContent('Kiosk data'))
  })

  it('only administrators see Delete; it asks first, calls the API and returns to the list, and shows a refusal', async () => {
    mockParams = new URLSearchParams('ra=a1')
    let f = workspaceFetch(); global.fetch = f as any
    const { unmount } = render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    expect(screen.queryByRole('button', { name: 'refarch.delete' })).toBeNull()
    unmount()
    mockAdmin = true
    f = workspaceFetch({ '/reference-architectures/a1': (url: string, init: any) => (init?.method === 'DELETE' ? { deleted: true } : ARCH) }); global.fetch = f as any
    const confirm = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    fireEvent.click(screen.getByRole('button', { name: 'refarch.delete' }))
    expect(calls(f, 'DELETE', '/reference-architectures/a1')).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'refarch.delete' }))
    await waitFor(() => expect(calls(f, 'DELETE', '/reference-architectures/a1')).toHaveLength(1))
    expect(confirm).toHaveBeenCalledTimes(2)
    confirm.mockRestore()
  })

  it('a reference model is structure only: no implementation/conformance/target/traces tabs, no coverage, no conformance call, and its building blocks give information only', async () => {
    mockParams = new URLSearchParams('ra=a1')
    const f = workspaceFetch({ '/reference-architectures/a1': { ...ARCH, kind: 'REFERENCE_MODEL', authorityLevel: 'NATIONAL', derivedFromId: null, derivedFrom: null } }); global.fetch = f as any
    render(<ReferenceArchitecturesPage />)
    expect(await screen.findByTestId('ra-model-note')).toHaveTextContent('refarch.model.note')
    expect(screen.queryByTestId('ra-coverage')).toBeNull()
    for (const tab of ['refarch.tab.actual', 'refarch.tab.conformance', 'refarch.tab.target', 'refarch.tab.controls']) expect(screen.queryByRole('tab', { name: tab })).toBeNull()
    expect(screen.getByRole('tab', { name: 'refarch.tab.architecture' })).toBeInTheDocument()
    expect(calls(f, 'GET', '/conformance')).toHaveLength(0)
    fireEvent.click(screen.getByRole('tab', { name: 'refarch.tab.architecture' }))
    expect(screen.getByText('refarch.model.read_only')).toBeInTheDocument()
    expect(screen.queryByLabelText('refarch.state')).toBeNull()
    fireEvent.click(within(await screen.findByTestId('ra-diagram')).getByRole('button', { name: /Digital portal/ }))
    const drawer = await screen.findByTestId('ra-drawer')
    expect(drawer).toHaveTextContent('ref.pptx')
    expect(within(drawer).getByTestId('ra-model-drawer-note')).toBeInTheDocument()
    expect(within(drawer).queryByLabelText('refarch.el.link_type')).toBeNull()
    expect(within(drawer).queryByText('refarch.el.implementations')).toBeNull()
    expect(within(drawer).queryByLabelText('refarch.el.decide')).toBeNull()
    expect(calls(f, 'GET', '/links?elementKey=')).toHaveLength(0)
  })

  it('a proposal says what kind of link it is and where it came from', async () => {
    mockParams = new URLSearchParams('ra=a1')
    const f = workspaceFetch({ '/reference-architectures/a1/links?elementKey=portal': [{ id: 'p1', status: 'PROPOSED', linkType: 'DEVIATES_FROM', basis: 'GOVERNANCE_FINDING', confidence: null, targetName: 'Legacy portal', targetId: 'app9', targetType: 'Application', targetModule: 'REPOSITORY' }] }); global.fetch = f as any
    render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    fireEvent.click(screen.getByRole('tab', { name: 'refarch.tab.architecture' }))
    fireEvent.click(within(await screen.findByTestId('ra-diagram')).getByRole('button', { name: /Digital portal - refarch\.conf\.ALIGNED/ }))
    const drawer = await screen.findByTestId('ra-drawer')
    await waitFor(() => expect(drawer).toHaveTextContent('Legacy portal'))
    expect(drawer).toHaveTextContent('refarch.link.DEVIATES_FROM')
    expect(drawer).toHaveTextContent('refarch.basis.GOVERNANCE_FINDING')
  })

  it('plans selected gaps into a draft EA plan and keeps aligned elements out of the selection', async () => {
    mockParams = new URLSearchParams('ra=a1')
    const f = workspaceFetch({ '/reference-architectures/a1/gaps/initiative': { plan: { nameEn: 'Close gaps' }, activitiesAdded: 1 } }); global.fetch = f as any
    render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    fireEvent.click(screen.getByRole('tab', { name: 'refarch.tab.conformance' }))
    const table = await screen.findByTestId('ra-conformance-table')
    expect(within(table).getByRole('checkbox', { name: 'Digital portal' })).toBeDisabled()
    fireEvent.click(within(table).getByRole('checkbox', { name: 'Kiosk' }))
    fireEvent.click(screen.getByRole('button', { name: /refarch\.plan_gaps \(1\)/ }))
    await waitFor(() => expect(calls(f, 'POST', '/gaps/initiative')).toHaveLength(1))
    expect(JSON.parse(calls(f, 'POST', '/gaps/initiative')[0][1].body)).toEqual({ elementKeys: ['kiosk'] })
    expect(await screen.findByText(/refarch.plan_gaps.done: Close gaps/)).toBeInTheDocument()
    expect(screen.getByText('Legacy app')).toBeInTheDocument()
  })

  it('compares Current with a Target scenario without changing anything', async () => {
    mockParams = new URLSearchParams('ra=a1')
    const f = workspaceFetch({ '/reference-architectures/a1/current-target': { summary: { current: { statement: '1 of 2' }, target: { statement: '2 of 2' } }, rows: [{ stableKey: 'kiosk', name: 'Kiosk', current: { status: 'GAP' }, target: { status: 'ALIGNED' }, change: 'GAP_CLOSED', introducedInTarget: [{ name: 'Kiosk app' }] }] } }); global.fetch = f as any
    render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    fireEvent.click(screen.getByRole('tab', { name: 'refarch.tab.target' }))
    expect(await screen.findByText('refarch.change.GAP_CLOSED')).toBeInTheDocument()
    expect(screen.getByText(/Kiosk app/)).toBeInTheDocument()
    expect(calls(f, 'GET', 'current-target?targetScenarioId=t1')).toHaveLength(1)
    expect(f.mock.calls.filter(c => c[1]?.method && c[1].method !== 'GET')).toHaveLength(0)
  })

  it('lays the workspace out right-to-left in Arabic and shows Arabic names', async () => {
    mockParams = new URLSearchParams('ra=a1'); mockIsAR = true
    global.fetch = workspaceFetch() as any
    const { container } = render(<ReferenceArchitecturesPage />)
    await screen.findByTestId('ra-coverage')
    expect(container.querySelector('.rp-page')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('المعمارية المرجعية للتطبيقات')
  })
})

describe('ReferenceDiagram', () => {
  it('draws organising elements as boxes and components as buttons; proposed elements are marked', () => {
    const onSelect = jest.fn()
    render(<ReferenceDiagram elements={[...ELEMENTS, { stableKey: 'chat', parentKey: 'access', kind: 'COMPONENT', name: 'Chatbot', metaModelTypeCodes: [], metaModelStatus: 'UNRESOLVED', reviewStatus: 'PROPOSED' }, { stableKey: 'gone', parentKey: null, kind: 'COMPONENT', name: 'Refused', metaModelTypeCodes: [], metaModelStatus: 'UNRESOLVED', reviewStatus: 'REJECTED' }] as any}
      conformance={Object.fromEntries(CONF.elements.map(e => [e.stableKey, e])) as any} selected={null} onSelect={onSelect} t={(k: string) => k} isAR={false} />)
    expect(screen.getByRole('button', { name: /Chatbot \(refarch.el.proposed\)/ })).toHaveClass('ra-leaf-proposed')
    expect(screen.queryByText('Refused')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Kiosk - refarch.conf.GAP/ }))
    expect(onSelect).toHaveBeenCalledWith('kiosk')
  })

  it('orders children and keeps orphaned elements visible as roots', () => {
    const { roots, children } = buildTree([{ stableKey: 'b', parentKey: 'a', sortOrder: 2 }, { stableKey: 'c', parentKey: 'a', sortOrder: 1 }, { stableKey: 'a', parentKey: null }, { stableKey: 'x', parentKey: 'missing' }])
    expect(roots.map(r => r.stableKey)).toEqual(['a', 'x'])
    expect(children.get('a')!.map(c => c.stableKey)).toEqual(['c', 'b'])
  })
})

describe('ImportWizard', () => {
  it('uploads, shows the extracted slides, and applies the chosen plan as drafts', async () => {
    const imp = { id: 'i1', fileName: 'ref.pptx', method: 'DETERMINISTIC_LAYOUT', sha256: 'abcdef1234567890', warnings: [], suggestions: {}, extraction: { slides: [
      { slideNo: 1, title: 'النموذج المرجعي الوطني', nodes: [{ id: 's1-n1', name: 'طبقة الوصول', depth: 0, kindHint: 'AREA', method: 'DEFINITION', confidence: 0.8 }] },
      { slideNo: 2, title: 'Org architecture', nodes: [{ id: 's2-n1', name: 'Portal', depth: 0, kindHint: 'COMPONENT', method: 'CONTAINMENT', confidence: 0.9 }] },
    ] } }
    const f = route({ '/reference-architectures/imports/i1/apply': { applied: [{ slideNo: 1 }] }, '/reference-architectures/imports': imp }); global.fetch = f as any
    const onApplied = jest.fn()
    render(<ImportWizard api={makeApi('http://x')} t={(k: string) => k} domains={[{ code: 'APPLICATION', name: 'Application' }]} architectures={[]} onApplied={onApplied} onClose={jest.fn()} />)
    const file = new File(['x'], 'ref.pptx')
    fireEvent.change(screen.getByLabelText('refarch.import.file'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'refarch.import.upload' }))
    expect(await screen.findByText(/ref.pptx · DETERMINISTIC_LAYOUT/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /#1/ }))
    expect(screen.getByTestId('ra-slide-1')).toHaveTextContent('طبقة الوصول')
    fireEvent.change(screen.getByLabelText('refarch.kind 1'), { target: { value: 'REFERENCE_MODEL' } })
    fireEvent.change(screen.getByLabelText('refarch.authority 1'), { target: { value: 'NATIONAL' } })
    fireEvent.change(screen.getByLabelText('refarch.import.derived_slide 2'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'refarch.import.apply' }))
    await waitFor(() => expect(onApplied).toHaveBeenCalled())
    const body = JSON.parse(calls(f, 'POST', '/imports/i1/apply')[0][1].body)
    expect(body.slides[0]).toMatchObject({ slideNo: 1, create: { kind: 'REFERENCE_MODEL', authorityLevel: 'NATIONAL', nameAr: 'النموذج المرجعي الوطني' } })
    expect(body.slides[1]).toMatchObject({ slideNo: 2, derivedFromSlideNo: 1, create: { kind: 'REFERENCE_ARCHITECTURE' } })
  })
})
