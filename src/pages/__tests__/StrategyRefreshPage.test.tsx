import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import StrategyRefreshPage from '../StrategyRefreshPage'
import { strategyRefreshApi } from '../../lib/strategy-refresh'
let mockIsAR = false

jest.mock('../../lib/strategy-refresh', () => ({ strategyRefreshApi: { list: jest.fn(), get: jest.fn(), create: jest.fn(), upload: jest.fn(), analyze: jest.fn(), decide: jest.fn(), activate: jest.fn(), source: jest.fn(), publicationOptions: jest.fn(), publish: jest.fn(), cancelPublication: jest.fn() } }))
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
