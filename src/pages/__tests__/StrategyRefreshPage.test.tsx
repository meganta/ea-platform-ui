import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import StrategyRefreshPage from '../StrategyRefreshPage'
import { strategyRefreshApi } from '../../lib/strategy-refresh'
let mockIsAR = false

jest.mock('../../lib/strategy-refresh', () => ({ strategyRefreshApi: { list: jest.fn(), get: jest.fn(), create: jest.fn(), upload: jest.fn(), analyze: jest.fn(), decide: jest.fn(), activate: jest.fn(), source: jest.fn(), rerun: jest.fn(), publicationOptions: jest.fn(), publish: jest.fn(), cancelPublication: jest.fn() } }))
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => true }) }))
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: mockIsAR, t: (key: string) => key }) }))

const api = strategyRefreshApi as jest.Mocked<typeof strategyRefreshApi>
const finding: any = { id: 'fact-a', category: 'STRATEGY_STRUCTURE', title: 'Increase service access', authority: 'DOCUMENT_DECLARED_FACT', decision: 'PENDING', revision: 1, confidence: 0.9, destination: 'REPOSITORY', publishedAt: null, payload: { semanticType: 'Objective', description: 'Declared objective' }, evidence: [{ sourceId: 'doc-a', quote: 'Increase service access', section: 'Objectives', page: null }] }
const ready: any = { id: 'refresh-a', title: 'Strategy 2027', strategyId: 'strategy-a', analysisStatus: 'READY', strategyStatus: 'DRAFT', findings: [finding], sources: [{ id: 'doc-a', filename: 'Strategy.pdf' }], context: { limitations: ['Repository evidence is incomplete'], evidence: [] }, summary: [{ category: 'STRATEGY_STRUCTURE', count: 1, findingIds: ['fact-a'] }], responseProgress: { total: 1, published: 0, pending: 1 } }
beforeEach(() => { mockIsAR = false; jest.clearAllMocks(); api.list.mockResolvedValue([ready]); api.get.mockResolvedValue(ready) })

it('offers publication on the reviewed finding card without duplicating it or silently writing', async () => {
  api.get.mockResolvedValue({ ...ready, strategyStatus: 'ACTIVE', findings: [{ ...finding, decision: 'APPROVED' }] });
  api.publicationOptions.mockResolvedValue({ revision: 1, actions: [], objectTypes: [], relationships: [], assets: [], plans: [], cycles: [], views: [] });
  render(<StrategyRefreshPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'strategy.refresh.tab.review' }));
  expect(screen.getAllByRole('heading', { name: finding.title })).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.publish' }));
  expect(await screen.findByText('strategy.refresh.publication.no_destination')).toBeInTheDocument();
  expect(api.publish).not.toHaveBeenCalled();
  expect(api.activate).not.toHaveBeenCalled();
});

it('shows the recorded shared ViewDataset picture without applying or re-querying architecture', async () => {
  api.get.mockResolvedValue({ ...ready, context: { limitations: [], evidence: [{ id: 'view-a:target-a', module: 'EA_VIEW_DATASET', authority: 'TENANT_FACT', data: { viewId: 'view-a', viewName: 'Strategic Target', scenarioType: 'TARGET', dataset: { objects: [{ id: 'asset-a' }], relationships: [] }, image: { svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>Asset A</text></svg>', shownNodes: 1, shownEdges: 0 } } }] } });
  render(<StrategyRefreshPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }));
  fireEvent.click(await screen.findByRole('button', { name: 'strategy.refresh.tab.map' }));
  expect(screen.getByRole('img', { name: 'Strategic Target' })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
  expect(screen.getByText('strategy.refresh.view_snapshot_note')).toBeInTheDocument();
  expect(api.decide).not.toHaveBeenCalled();
  expect(api.activate).not.toHaveBeenCalled();
});

it('makes refresh the primary action and drills summary facts into their evidence', async () => {
  render(<StrategyRefreshPage />)
  expect(screen.getByRole('button', { name: 'strategy.refresh.start' })).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  expect(await screen.findByText('strategy.refresh.summary')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /strategy structure/ }))
  expect(screen.getByRole('heading', { name: finding.title })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.why' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Increase service access')
  expect(screen.getByRole('dialog')).toHaveTextContent('document declared fact')
  expect(screen.getByRole('dialog')).toHaveTextContent('Objectives')
})

it('drills a distinct-object metric into exactly its cited findings, across categories', async () => {
  const impact: any = { ...finding, id: 'impact-a', category: 'ARCHITECTURE_IMPACT', title: 'Review application impact' }
  const capability: any = { ...finding, id: 'cap-a', category: 'CAPABILITY_IMPACT', title: 'Review capability impact' }
  api.get.mockResolvedValue({ ...ready, findings: [finding, impact, capability], summary: [{ id: 'objects:Application', category: 'ARCHITECTURE_IMPACT', semanticType: 'Application', measure: 'REFERENCED_OBJECTS', count: 1, findingIds: ['impact-a', 'cap-a'] }] })
  render(<StrategyRefreshPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Application/ }))
  expect(screen.getByRole('heading', { name: impact.title })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: capability.title })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: finding.title })).not.toBeInTheDocument()
})

it('does not silently approve a fact, and records a reason plus expected revision', async () => {
  render(<StrategyRefreshPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'strategy.refresh.tab.review' }))
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.approve' }))
  const dialog = screen.getByRole('dialog')
  expect(dialog.querySelector('button:last-child')).toBeDisabled()
  fireEvent.change(screen.getByLabelText('strategy.refresh.reason'), { target: { value: 'Verified against source' } })
  fireEvent.click(dialog.querySelector('button:last-child')!)
  await waitFor(() => expect(api.decide).toHaveBeenCalledWith('refresh-a', finding, 'APPROVE', 'Verified against source', undefined))
  expect(api.activate).not.toHaveBeenCalled()
})

it('keeps analysis failures visible and lets the user retry without fake success', async () => {
  api.get.mockResolvedValue({ ...ready, analysisStatus: 'FAILED', failureCode: 'AI_PROVIDER_FAILED' })
  api.analyze.mockRejectedValue(new Error('Provider temporarily unavailable'))
  render(<StrategyRefreshPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  expect(await screen.findByText('AI_PROVIDER_FAILED')).toBeInTheDocument()
  expect(screen.getByText('strategy.refresh.failed_hint')).toBeInTheDocument()
  expect(screen.getByText('strategy.refresh.technical_details')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.retry' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Provider temporarily unavailable')
  expect(api.decide).not.toHaveBeenCalled()
})

it('uses RTL for the Arabic workspace and keeps failed analysis documents locked', async () => {
  mockIsAR = true
  api.get.mockResolvedValue({ ...ready, analysisStatus: 'FAILED', failureCode: 'AI_PROVIDER_FAILED' })
  render(<StrategyRefreshPage />)
  expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl')
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  expect(await screen.findByText('AI_PROVIDER_FAILED')).toBeInTheDocument()
  expect(screen.queryByLabelText('strategy.refresh.documents')).not.toBeInTheDocument()
})

it.each([false, true])('explains citation failure without auto-retry or accepting unsupported conclusions (Arabic: %s)', async isAR => {
  mockIsAR = isAR
  api.get.mockResolvedValue({ ...ready, analysisStatus: 'FAILED', failureCode: 'AI_CITATION_INVALID' })
  render(<StrategyRefreshPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  expect(await screen.findByText('strategy.refresh.citation_hint')).toBeInTheDocument()
  expect(screen.getByRole('main')).toHaveAttribute('dir', isAR ? 'rtl' : 'ltr')
  expect(screen.getByRole('button', { name: 'strategy.refresh.retry' })).toBeEnabled()
  expect(screen.queryByLabelText('strategy.refresh.documents')).not.toBeInTheDocument()
  expect(api.analyze).not.toHaveBeenCalled()
  expect(api.decide).not.toHaveBeenCalled()
  expect(api.publish).not.toHaveBeenCalled()
})

it('does not offer in-place amendment of active strategic facts', async () => {
  api.get.mockResolvedValue({ ...ready, strategyStatus: 'ACTIVE', findings: [{ ...finding, decision: 'APPROVED' }] })
  render(<StrategyRefreshPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
  fireEvent.click(await screen.findByRole('button', { name: 'strategy.refresh.tab.review' }))
  expect(screen.queryByRole('button', { name: 'strategy.refresh.amend' })).not.toBeInTheDocument()
})

it('contains keyboard focus in the upload dialog and restores the opener on Escape', async () => {
  render(<StrategyRefreshPage />)
  const opener = screen.getByRole('button', { name: 'strategy.refresh.start' })
  opener.focus()
  fireEvent.click(opener)
  const title = screen.getByLabelText('strategy.refresh.title')
  expect(title).toHaveFocus()
  fireEvent.keyDown(title, { key: 'Tab', shiftKey: true })
  expect(screen.getByRole('button', { name: 'strategy.refresh.cancel' })).toHaveFocus()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(opener).toHaveFocus()
})

const impactFact: any = { ...finding, id: 'fact-b', title: 'Unify beneficiary channels', payload: { semanticType: 'Initiative', description: 'Single channel' } }
const impact: any = {
  scope: 'CURRENT_ARCHITECTURE', analyzedAt: '2026-10-02T00:00:00Z', limitations: ['Assessed within the actor Repository access.'],
  totals: { repositoryObjects: 5707, assessedObjects: 420, impactedObjects: 3, impactedDomains: 2, namedObjects: 1, notInRepository: 1 },
  synthesis: { headline: 'Channel consolidation drives the refresh', overview: 'The strategy consolidates beneficiary channels.', keyMessages: ['Portal must integrate with CRM'] },
  notInRepository: [{ name: 'Taqat Gateway', factIds: ['fact-b'] }],
  domains: [
    { domain: 'APPLICATION_INTEGRATION', domainName: 'Applications & Integration', status: 'ASSESSED', objectCount: 300, assessedCount: 200, impactLevel: 'HIGH', summary: 'Portal and CRM change.',
      impactedObjects: [
        { assetId: 'a1', name: 'Beneficiary Portal', assetType: 'Application', typeLabel: 'Application', impactType: 'CONSOLIDATE', nature: 'DIRECT', impactLevel: 'HIGH', description: 'Becomes the single channel', factIds: ['fact-b'], namedInStrategy: true },
        { assetId: 'a2', name: 'CRM', assetType: 'Application', typeLabel: 'Application', impactType: 'INTEGRATE', nature: 'INDIRECT', impactLevel: 'LOW', description: 'Feeds the portal', factIds: ['fact-b'], namedInStrategy: false },
      ],
      view: { source: 'SAVED_VIEW', viewId: 'view-1', viewpointId: null, title: 'Application Landscape', visualization: 'GRAPH', architectureState: 'CURRENT', reason: 'Shows the channels.', objects: 12, impactedShown: 2, image: { mimeType: 'image/svg+xml', svg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>', width: 10, height: 10 } } },
    { domain: 'DATA_ARCHITECTURE', domainName: 'Data Architecture', status: 'FAILED', objectCount: 50, assessedCount: 0, impactLevel: 'NONE', summary: '', impactedObjects: [] },
    { domain: 'SECURITY_ARCHITECTURE', domainName: 'Security Architecture', status: 'NO_OBJECTS', objectCount: 0, assessedCount: 0, impactLevel: 'NONE', summary: '', impactedObjects: [] },
  ],
}
const withImpact: any = { ...ready, findings: [finding, impactFact], impact }

describe('EA impact register', () => {
  it('leads the overview with the synthesis, totals and a domain heat map', async () => {
    api.get.mockResolvedValue(withImpact)
    render(<StrategyRefreshPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
    expect(await screen.findByText('Channel consolidation drives the refresh')).toBeInTheDocument()
    expect(screen.getByText('Portal must integrate with CRM')).toBeInTheDocument()
    expect(screen.getByText('strategy.refresh.impact.totals.impactedObjects').previousSibling).toHaveTextContent('3')
    // Domains without objects are not shown; a failed domain says so instead of pretending "no impact".
    expect(screen.getByRole('button', { name: /Applications & Integration/ })).toHaveTextContent('strategy.refresh.impact.level.HIGH')
    expect(screen.getByRole('button', { name: /Data Architecture/ })).toHaveTextContent('strategy.refresh.impact.failed')
    expect(screen.queryByRole('button', { name: /SECURITY_ARCHITECTURE/ })).not.toBeInTheDocument()
  })

  it('opens a domain from the heat map into its impacted objects, EA View and strategy basis', async () => {
    api.get.mockResolvedValue(withImpact)
    render(<StrategyRefreshPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Applications & Integration/ }))
    expect(await screen.findByText('strategy.refresh.impact.register')).toBeInTheDocument()
    expect(screen.getByLabelText('strategy.refresh.impact.filter.domain')).toHaveValue('APPLICATION_INTEGRATION')
    expect(screen.queryByTestId('impact-domain-DATA_ARCHITECTURE')).not.toBeInTheDocument()
    const row = screen.getByText('Beneficiary Portal').closest('tr')!
    expect(row).toHaveTextContent('strategy.refresh.impact.named')
    expect(row).toHaveTextContent('CONSOLIDATE')
    expect(screen.getByRole('img', { name: 'strategy.refresh.impact.view_alt' })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'))
    expect(screen.getByText('strategy.refresh.impact.partial')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Unify beneficiary channels' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Unify beneficiary channels')
  })

  it('filters the register by level and by objects the documents name', async () => {
    api.get.mockResolvedValue(withImpact)
    render(<StrategyRefreshPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'strategy.refresh.tab.impact' }))
    expect(screen.getByText('CRM')).toBeInTheDocument()
    expect(screen.getByText('Taqat Gateway')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('strategy.refresh.impact.filter.level'), { target: { value: 'HIGH' } })
    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('strategy.refresh.impact.filter.level'), { target: { value: '' } })
    fireEvent.click(screen.getByLabelText('strategy.refresh.impact.filter.named'))
    expect(screen.queryByText('CRM')).not.toBeInTheDocument()
    expect(screen.getByText('Beneficiary Portal')).toBeInTheDocument()
  })

  it('tells people to re-run a refresh analysed before the register existed, and re-runs as a new refresh', async () => {
    api.rerun.mockResolvedValue({ ...ready, id: 'refresh-b', analysisStatus: 'QUEUED' })
    api.get.mockImplementation(async (id: string) => id === 'refresh-b' ? { ...ready, id: 'refresh-b', title: 'Strategy 2027 (re-run)', analysisStatus: 'QUEUED' } : ready)
    render(<StrategyRefreshPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
    expect(await screen.findByText('strategy.refresh.impact.legacy')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.rerun' }))
    await waitFor(() => expect(api.rerun).toHaveBeenCalledWith('refresh-a'))
    expect(await screen.findByRole('heading', { name: 'Strategy 2027 (re-run)' })).toBeInTheDocument()
    expect(api.decide).not.toHaveBeenCalled()
  })

  it('opens a source document streamed through the API rather than a signed link', async () => {
    const createObjectURL = jest.fn(() => 'blob:doc'); const revokeObjectURL = jest.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    api.source.mockResolvedValue(new Blob(['%PDF']))
    render(<StrategyRefreshPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
    fireEvent.click(await screen.findByRole('button', { name: /strategy structure/ }))
    fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.why' }))
    fireEvent.click(screen.getByRole('button', { name: 'Strategy.pdf' }))
    await waitFor(() => expect(api.source).toHaveBeenCalledWith('refresh-a', 'doc-a'))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(createObjectURL).toHaveBeenCalled()
    click.mockRestore()
  })

  it('renders the register right-to-left for Arabic readers', async () => {
    mockIsAR = true
    api.get.mockResolvedValue(withImpact)
    render(<StrategyRefreshPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Strategy 2027/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'strategy.refresh.tab.impact' }))
    expect(screen.getByRole('main')).toHaveAttribute('dir', 'rtl')
    expect(screen.getByText('strategy.refresh.impact.not_in_repo')).toBeInTheDocument()
  })
})
