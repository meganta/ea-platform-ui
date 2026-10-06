import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdmReferencePanel, AssetReferenceAlignment, GovernanceReferencePanel } from '../ReferenceArchitecturePanels'

jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../HelpTip', () => () => <span>?</span>)

function route(routes: Record<string, any>) {
  const keys = Object.keys(routes).sort((a, b) => b.length - a.length)
  return jest.fn((url: string) => {
    const k = keys.find(x => url.includes(x))
    const body = k ? routes[k] : {}
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(body)) })
  })
}
beforeEach(() => { Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true }) })

it('ADM: lists the applicable active reference architectures with Current-state facts', async () => {
  global.fetch = route({ '/adm-cycles/c1/context': { architectures: [{ id: 'a1', name: 'App RA', kind: 'REFERENCE_ARCHITECTURE', version: { version: '1.0' }, currentState: { coverage: '1 of 2 mandatory reference components have verified implementations', gaps: ['Kiosk'], deviations: [] } }] } }) as any
  render(<AdmReferencePanel cycleId="c1" />)
  expect(await screen.findByText('App RA')).toHaveAttribute('href', '/reference-architectures?ra=a1')
  expect(screen.getByTestId('adm-refarch')).toHaveTextContent('1 of 2 mandatory reference components')
})

it('ADM: says when nothing applies', async () => {
  global.fetch = route({ '/adm-cycles/c1/context': { architectures: [] } }) as any
  render(<AdmReferencePanel cycleId="c1" />)
  expect(await screen.findByText('refarch.adm.none')).toBeInTheDocument()
})

it('Governance: shows evidence-backed classifications and raises a deviation as a finding', async () => {
  const f = route({
    '/governance-reviews/r1/assessment': { architectures: [{ id: 'a1' }], counts: { ALIGNMENT: 0, GAP: 0, DEVIATION: 1, APPROVED_EXCEPTION: 0, NOT_ASSESSABLE: 0 }, findings: [{ classification: 'DEVIATION', architectureId: 'a1', elementKey: 'portal', objectId: 'app1', linkId: 'l1', evidence: 'Portal deviates from "Access portal" (App RA v1.0)' }], limitations: [] },
    '/governance-reviews/r1/deviations': { id: 'f1' },
  })
  global.fetch = f as any
  render(<GovernanceReferencePanel reviewId="r1" />)
  expect(await screen.findByText(/Portal deviates/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'refarch.gov.raise' }))
  await waitFor(() => expect(screen.getByText('refarch.gov.raised')).toBeInTheDocument())
  const post = f.mock.calls.find((c: any) => c[1]?.method === 'POST')!
  expect(JSON.parse(post[1].body)).toEqual({ architectureId: 'a1', elementKey: 'portal', objectId: 'app1', rationale: 'Portal deviates from "Access portal" (App RA v1.0)' })
})

it('Repository object: shows where the object stands, marking proposals', async () => {
  global.fetch = route({ '/assets/app1/alignment': { results: [{ architecture: { id: 'a1', name: 'App RA' }, elements: [{ stableKey: 'portal', name: 'Access portal', status: 'ALIGNED', links: [{ linkType: 'REALIZES', status: 'CONFIRMED' }, { linkType: 'REALIZES', status: 'PROPOSED' }] }] }], couldRealize: [] } }) as any
  render(<AssetReferenceAlignment assetId="app1" />)
  const panel = await screen.findByTestId('asset-refarch')
  await waitFor(() => expect(panel).toHaveTextContent('Access portal'))
  expect(panel).toHaveTextContent('refarch.el.proposed')
})
