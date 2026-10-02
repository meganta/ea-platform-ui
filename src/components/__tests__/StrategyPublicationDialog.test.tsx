import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrategyPublicationDialog } from '../StrategyPublicationDialog'
import { strategyRefreshApi } from '../../lib/strategy-refresh'

jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (key: string) => key }) }))
jest.mock('../../lib/strategy-refresh', () => ({ strategyRefreshApi: { publicationOptions: jest.fn(), propertyOptions: jest.fn(), publish: jest.fn() } }))
const api = strategyRefreshApi as jest.Mocked<typeof strategyRefreshApi>
const finding: any = { id: 'finding-a', title: 'Reassess initiative', revision: 2, authority: 'AI_INFERENCE' }
const options: any = { revision: 2, actions: ['PLAN_REVIEW_ACTION'], plans: [{ id: 'plan-a', name: 'Existing reviewed plan' }], cycles: [], assets: [], objectTypes: [], relationships: [], views: [] }
beforeEach(() => { jest.clearAllMocks(); api.publicationOptions.mockResolvedValue(options); api.publish.mockResolvedValue({}) })

it('requires explicit destination selection and authorization; opening the dialog does not publish', async () => {
  const completed = jest.fn().mockResolvedValue(undefined), closed = jest.fn()
  render(<StrategyPublicationDialog refreshId="refresh-a" finding={finding} onClose={closed} onPublished={completed} />)
  await screen.findByLabelText('strategy.refresh.destination')
  expect(api.publish).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'strategy.refresh.publication.authorize' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('strategy.refresh.destination'), { target: { value: 'PLAN_REVIEW_ACTION' } })
  fireEvent.change(screen.getByLabelText('strategy.refresh.publication.planId'), { target: { value: 'plan-a' } })
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.publication.authorize' }))
  await waitFor(() => expect(api.publish).toHaveBeenCalledWith('refresh-a', finding, { action: 'PLAN_REVIEW_ACTION', planId: 'plan-a' }))
  expect(completed).toHaveBeenCalledTimes(1)
  expect(closed).toHaveBeenCalledTimes(1)
})

it('keeps a stale finding revision disabled', async () => {
  api.publicationOptions.mockResolvedValue({ ...options, revision: 3 })
  render(<StrategyPublicationDialog refreshId="refresh-a" finding={finding} onClose={jest.fn()} onPublished={jest.fn()} />)
  await screen.findByLabelText('strategy.refresh.destination')
  fireEvent.change(screen.getByLabelText('strategy.refresh.destination'), { target: { value: 'PLAN_REVIEW_ACTION' } })
  fireEvent.change(screen.getByLabelText('strategy.refresh.publication.planId'), { target: { value: 'plan-a' } })
  expect(screen.getByRole('button', { name: 'strategy.refresh.publication.authorize' })).toBeDisabled()
  expect(api.publish).not.toHaveBeenCalled()
})

it('shows a controlled publication failure without reporting success or closing the dialog', async () => {
  api.publish.mockRejectedValue(new Error('Destination changed since analysis'))
  const completed = jest.fn(), closed = jest.fn()
  render(<StrategyPublicationDialog refreshId="refresh-a" finding={finding} onClose={closed} onPublished={completed} />)
  await screen.findByLabelText('strategy.refresh.destination')
  fireEvent.change(screen.getByLabelText('strategy.refresh.destination'), { target: { value: 'PLAN_REVIEW_ACTION' } })
  fireEvent.change(screen.getByLabelText('strategy.refresh.publication.planId'), { target: { value: 'plan-a' } })
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.publication.authorize' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Destination changed since analysis')
  expect(completed).not.toHaveBeenCalled()
  expect(closed).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'strategy.refresh.cancel' })).not.toBeDisabled()
})

it('publishes only explicitly selected canonical properties with typed values', async () => {
  api.publicationOptions.mockResolvedValue({ ...options, actions: ['SCENARIO_DELTA'], assets: [{ id: 'asset-a', name: 'Application A' }], views: [{ id: 'view-a', scenarioId: 'target-a', name: 'Target view' }] })
  api.propertyOptions.mockResolvedValue({ versionId: 'published-a', properties: [{ code: 'count', name: 'Count', attributeType: 'INTEGER', isRequired: false, values: [] }, { code: 'owner', name: 'Owner', attributeType: 'REFERENCE', isRequired: false, values: [] }] })
  render(<StrategyPublicationDialog refreshId="refresh-a" finding={finding} onClose={jest.fn()} onPublished={jest.fn().mockResolvedValue(undefined)} />)
  await screen.findByLabelText('strategy.refresh.destination')
  fireEvent.change(screen.getByLabelText('strategy.refresh.destination'), { target: { value: 'SCENARIO_DELTA' } })
  fireEvent.change(screen.getByLabelText('strategy.refresh.publication.viewId'), { target: { value: 'view-a:target-a' } })
  fireEvent.change(screen.getByLabelText('strategy.refresh.publication.assetId'), { target: { value: 'asset-a' } })
  fireEvent.change(screen.getByLabelText('strategy.refresh.publication.operation'), { target: { value: 'UPDATE' } })
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Count' }))
  expect(screen.queryByRole('checkbox', { name: 'Owner' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'strategy.refresh.publication.authorize' })).toBeDisabled()
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Count' }), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'strategy.refresh.publication.authorize' }))
  await waitFor(() => expect(api.publish).toHaveBeenCalledWith('refresh-a', finding, { action: 'SCENARIO_DELTA', viewId: 'view-a', scenarioId: 'target-a', assetId: 'asset-a', operation: 'UPDATE', overrides: { count: 3 } }))
})
