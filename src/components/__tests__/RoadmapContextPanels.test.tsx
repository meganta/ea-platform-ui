import { render, screen, waitFor } from '@testing-library/react'
import { AssetFutureState, DashboardRoadmapCard, GovernanceTargetPanel, HealthDomainRoadmap } from '../RoadmapContextPanels'

let mockPerms: string[] = ['Roadmap.View']
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: (c: string) => mockPerms.includes(c) }) }))

function mockApi(routes: Record<string, any>) {
  global.fetch = jest.fn().mockImplementation((url: string) => {
    const key = Object.keys(routes).find(k => url.includes(k))
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(key ? routes[key] : {})) })
  }) as any
}
beforeEach(() => { mockPerms = ['Roadmap.View'] })

describe('roadmap context in other modules', () => {
  it('governance: classifies the review objects against the roadmap and leaves out unchanged ones', async () => {
    mockApi({ 'target-alignment': { roadmap: { id: 'rm' }, objects: [
      { objectId: 'a2', objectName: 'Old CRM', objectType: 'Application', classification: 'RETIRING', stateName: 'Transition 1', horizonDate: '2027-12-31T00:00:00.000Z', introducedInSameState: [{ id: 'a1', name: 'New CRM' }] },
      { objectId: 'a3', objectName: 'ERP', objectType: 'Application', classification: 'STAYS' },
    ] } })
    render(<GovernanceTargetPanel reviewId="r1" />)
    expect(await screen.findByText('Old CRM')).toHaveAttribute('href', '/repository?asset=a2')
    expect(screen.queryByText('ERP')).not.toBeInTheDocument()
    expect(screen.getByText('roadmap.align.same_state_new')).toBeInTheDocument()
  })

  it('is hidden and fetches nothing without Roadmap.View', () => {
    mockPerms = []
    mockApi({})
    const { container } = render(<GovernanceTargetPanel reviewId="r1" />)
    expect(container).toBeEmptyDOMElement()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('object page: lists what the roadmap does to the object, or that it stays', async () => {
    mockApi({ '/architecture-roadmap/assets/a2': { roadmap: { id: 'rm' }, asset: { effectiveUntil: '2027-12-31T00:00:00.000Z' }, changes: [{ change: 'RETIRE', stateName: 'Transition 1', horizonDate: '2027-12-31T00:00:00.000Z', workPackageName: null }] } })
    render(<AssetFutureState assetId="a2" />)
    expect(await screen.findByText('roadmap.change.RETIRE')).toBeInTheDocument()
    expect(screen.getByText('roadmap.asset.dates')).toBeInTheDocument()
  })

  it('health and dashboard: summarise the domain and show the line', async () => {
    mockApi({
      '/architecture-roadmap/domains/APP': { roadmap: { targetDate: '2029-12-31' }, summary: { total: 3, introduce: 1, retire: 1, modify: 0, links: 1, unplanned: 2 }, measures: [] },
      '/architecture-roadmap/summary': { roadmap: { id: 'rm' }, line: [{ id: 'cur', label: 'CURRENT', changes: 0 }, { id: 'tgt', label: 'TARGET', horizonDate: '2029-12-31', changes: 3 }], inEffect: { state: { id: 'cur' } }, progress: { changes: { delivered: 0, remaining: 3, unplanned: 2 }, deliveredShare: 0 }, upcoming: [{ id: 'w', name: 'CRM go-live', status: 'PLANNED', endDate: '2027-06-30', overdue: false }] },
    })
    render(<><HealthDomainRoadmap domainCode="APP" /><DashboardRoadmapCard onOpen={() => {}} /></>)
    expect(await screen.findByText('roadmap.health.summary')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('CRM go-live')).toBeInTheDocument())
    expect(screen.getByText('roadmap.dash.in_effect')).toBeInTheDocument()
  })
})
