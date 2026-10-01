import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SemanticViewBuilder, { relationChoices } from '../SemanticViewBuilder'

// Shaped like test-tenant's published Meta Model (NORA-based).
const DOMAINS = [{ code: 'APPLICATION', name: 'Application', nameAr: 'التطبيقات', objectTypeCount: 2 }, { code: 'BUSINESS', name: 'Business', objectTypeCount: 1 }]
const APP_TYPES = [{ code: 'Application', name: 'Application', objectCount: 97 }, { code: 'Interface', name: 'Integration Interface', objectCount: 161 }]
const RELATED = {
  primaryType: 'Application',
  related: [
    { code: 'BusinessProcess', name: 'Business Process', domainCode: 'BUSINESS', objectCount: 40, relations: [{ definitionCode: 'APP_AUTOMATES_PROCESS', direction: 'FORWARD', label: 'automates', name: 'x' }], paths: [] },
    { code: 'OrganisationUnit', name: 'Organisation Unit', domainCode: 'BUSINESS', relations: [
      { definitionCode: 'APP_BUSOWNED_BY_ORGUNIT', direction: 'FORWARD', label: 'business-owned by', name: 'x' },
      { definitionCode: 'APP_TECHOWNED_BY_ORGUNIT', direction: 'FORWARD', label: 'tech-owned by', name: 'x' },
    ], paths: [] },
    { code: 'Application', name: 'Application', domainCode: 'APPLICATION', relations: [{ definitionCode: 'APP_INTEGRATED_INTO_APP', direction: 'FORWARD', label: 'integrated into', name: 'x' }],
      paths: [{ code: 'APP_DEPENDS_ON_APP_VIA_INTERFACE', label: 'depends on (via interface)', via: ['Interface'], hops: [] }] },
  ],
}

function makeApi(over: Record<string, any> = {}) {
  const calls: any[] = []
  const api = {
    get: jest.fn((url: string) => {
      calls.push(['GET', url])
      if (url.startsWith('/ea-views/semantics/domains')) return Promise.resolve(DOMAINS)
      if (url.startsWith('/ea-views/semantics/object-types')) return Promise.resolve(APP_TYPES)
      if (url.startsWith('/ea-views/semantics/related')) return Promise.resolve(RELATED)
      if (url.includes('/resolve')) return Promise.resolve(over.resolve)
      if (url.startsWith('/architecture-query/filter-definition')) return Promise.resolve({ objectType: 'Application', identityFields: [], attributes: [], relationships: [] })
      return Promise.resolve({})
    }),
    post: jest.fn((url: string, body: any) => {
      calls.push(['POST', url, body])
      if (url === '/ea-views/semantics/validate') {
        return Promise.resolve(over.validate ? over.validate(body) : {
          valid: true, issues: [],
          visualizations: body.definition.relation?.kind === 'PATH' ? { recommended: 'GRAPH', eligible: ['GRAPH', 'MATRIX', 'TABLE'] }
            : body.definition.relatedType ? { recommended: 'MATRIX', eligible: ['MATRIX', 'GRAPH', 'LANDSCAPE', 'TABLE'] }
            : { recommended: 'LANDSCAPE', eligible: ['LANDSCAPE', 'CARDS', 'TABLE'] },
        })
      }
      if (url === '/ea-views') return Promise.resolve(over.create ?? { id: 'new-view' })
      return Promise.resolve({})
    }),
  }
  return { api, calls }
}

async function chooseUpToPrimary() {
  fireEvent.change(await screen.findByLabelText(/eaviews.builder_domain/), { target: { value: 'APPLICATION' } })
  fireEvent.click(await screen.findByRole('radio', { name: /^Application/ }))
}

describe('relationChoices()', () => {
  it('lists direct relationships and approved paths as distinct choices', () => {
    const c = relationChoices(RELATED.related[2] as any)
    expect(c.map(x => [x.kind, x.label])).toEqual([['DIRECT', 'integrated into'], ['PATH', 'depends on (via interface)']])
  })
})

describe('<SemanticViewBuilder> custom view', () => {
  it('domain options come from the Meta Model; primary types are only those of the chosen domain', async () => {
    const { api, calls } = makeApi()
    render(<SemanticViewBuilder api={api} viewpoint={null} onCreated={jest.fn()} onCancel={jest.fn()} />)
    expect(await screen.findByRole('option', { name: 'التطبيقات (2)' })).toBeInTheDocument() // default locale AR
    fireEvent.change(screen.getByLabelText(/eaviews.builder_domain/), { target: { value: 'APPLICATION' } })
    expect(await screen.findByRole('radio', { name: /Integration Interface/ })).toBeInTheDocument()
    expect(calls).toContainEqual(['GET', '/ea-views/semantics/object-types?domain=APPLICATION'])
  })

  it('related types come from the Meta Model (any domain); a single relationship is selected automatically', async () => {
    const { api, calls } = makeApi()
    render(<SemanticViewBuilder api={api} viewpoint={null} onCreated={jest.fn()} onCancel={jest.fn()} />)
    await chooseUpToPrimary()
    expect(calls).toContainEqual(['GET', '/ea-views/semantics/related?type=Application'])
    fireEvent.click(await screen.findByRole('radio', { name: /Business Process/ }))
    expect(await screen.findByRole('radio', { name: /automates/ })).toBeChecked()
    await waitFor(() => expect(calls.some(c => c[1] === '/ea-views/semantics/validate' && c[2].definition.relation?.definitionCode === 'APP_AUTOMATES_PROCESS')).toBe(true))
  })

  it('several valid relationships: none is guessed - the user must choose before creating', async () => {
    const { api } = makeApi()
    render(<SemanticViewBuilder api={api} viewpoint={null} onCreated={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText(/eaviews.builder_name/), { target: { value: 'Ownership' } })
    await chooseUpToPrimary()
    fireEvent.click(await screen.findByRole('radio', { name: /Organisation Unit/ }))
    expect(screen.getByRole('radio', { name: /business-owned by/ })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /tech-owned by/ })).not.toBeChecked()
    expect(screen.getByText('eaviews.builder_create')).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /tech-owned by/ }))
    await waitFor(() => expect(screen.getByText('eaviews.builder_create')).not.toBeDisabled())
  })

  it('a path is offered distinctly from a direct relationship, and only eligible visualizations are shown', async () => {
    const { api } = makeApi()
    render(<SemanticViewBuilder api={api} viewpoint={null} onCreated={jest.fn()} onCancel={jest.fn()} />)
    await chooseUpToPrimary()
    await screen.findByRole('radio', { name: /Business Process/ }) // related list loaded
    fireEvent.click(document.querySelector('input[name="svb-related"][value="Application"]') as HTMLElement) // related: Application
    const path = await screen.findByRole('radio', { name: /depends on \(via interface\)/ })
    expect(path.closest('label')).toHaveTextContent('Application → Integration Interface → Application')
    fireEvent.click(path)
    expect(await screen.findByRole('radio', { name: /Graph/ })).toBeChecked() // recommended for a path
    expect(screen.queryByRole('radio', { name: /Landscape/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: /Heatmap/ })).not.toBeInTheDocument()
  })

  it('creates the view with a semantic definition (no free-form types, no domains field) and shows backend validation errors', async () => {
    const { api, calls } = makeApi({ create: { code: 'INVALID_VIEW_DEFINITION', message: 'x', issues: [{ code: 'RELATIONSHIP_REMOVED', message: 'Application → Business Process using "automates" is not valid in the currently published Meta Model.' }] } })
    render(<SemanticViewBuilder api={api} viewpoint={null} onCreated={jest.fn()} onCancel={jest.fn()} />)
    fireEvent.change(screen.getByLabelText(/eaviews.builder_name/), { target: { value: 'Apps to processes' } })
    await chooseUpToPrimary()
    fireEvent.click(await screen.findByRole('radio', { name: /Business Process/ }))
    await waitFor(() => expect(screen.getByText('eaviews.builder_create')).not.toBeDisabled())
    expect(screen.getByRole('radio', { name: /Matrix/ })).toBeChecked() // the result of validating this definition, not the previous one
    fireEvent.click(screen.getByText('eaviews.builder_create'))
    await waitFor(() => expect(calls.some(c => c[1] === '/ea-views')).toBe(true))
    const body = calls.find(c => c[1] === '/ea-views')[2]
    expect(body).toEqual(expect.objectContaining({
      name: 'Apps to processes', visualization: 'MATRIX',
      semanticDefinition: { domainCode: 'APPLICATION', primaryType: 'Application', relatedType: 'BusinessProcess', relation: { kind: 'DIRECT', definitionCode: 'APP_AUTOMATES_PROCESS', direction: 'FORWARD' } },
    }))
    expect(body.rootObjectTypes).toBeUndefined()
    expect(body.domains).toBeUndefined()
    expect(await screen.findByTestId('svb-issues')).toHaveTextContent('is not valid in the currently published Meta Model')
  })
})

describe('<SemanticViewBuilder> library viewpoint (Customize)', () => {
  const vp = { id: 'vp-1', name: 'Application Portfolio', defaultVisualization: 'LANDSCAPE', contract: { question: 'What applications do we run?', questionAr: 'ما التطبيقات التي نشغّلها؟' } }
  const resolve = {
    resolved: true, unresolved: [],
    primary: [{ family: 'APPLICATION', types: [{ code: 'Application', name: 'Application' }] }],
    related: [{ family: 'CAPABILITY', types: [{ code: 'GovCapability', name: 'Capability' }] }],
    path: [], visualization: { primary: 'LANDSCAPE', alternates: ['TABLE', 'CARDS'] },
  }
  it('shows the contract resolved against the Meta Model and asks no type/relationship questions', async () => {
    const { api, calls } = makeApi({ resolve })
    const onCreated = jest.fn()
    render(<SemanticViewBuilder api={api} viewpoint={vp} onCreated={onCreated} onCancel={jest.fn()} />)
    expect(await screen.findByTestId('svb-resolved')).toHaveTextContent('Capability')
    expect(screen.queryByLabelText(/eaviews.builder_domain/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('radio').map(r => (r as HTMLInputElement).value)).toEqual(['LANDSCAPE', 'TABLE', 'CARDS'])
    fireEvent.click(screen.getByText('eaviews.builder_create'))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    expect(calls.find(c => c[1] === '/ea-views')[2]).toEqual({ name: 'Application Portfolio', description: '', viewpointId: 'vp-1', visualization: 'LANDSCAPE', filterConfig: {} })
  })

  it('a viewpoint the Meta Model cannot satisfy says so and cannot be created', async () => {
    const { api } = makeApi({ resolve: { ...resolve, resolved: false, unresolved: ['ORG_UNIT'] } })
    render(<SemanticViewBuilder api={api} viewpoint={vp} onCreated={jest.fn()} onCancel={jest.fn()} />)
    expect(await screen.findByText(/eaviews.builder_vp_unresolved: ORG_UNIT/)).toBeInTheDocument()
    expect(screen.getByText('eaviews.builder_create')).toBeDisabled()
  })
})
