import { render, screen, fireEvent } from '@testing-library/react'
import AdmOutputViews from '../AdmOutputViews'

const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true })
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))

const picture = { viewId: 'v1', title: 'Target Application Portfolio', svgContent: '<svg xmlns="http://www.w3.org/2000/svg"><text>Payroll</text></svg>', visualization: 'GRAPH', architectureState: 'TARGET', objects: 12, openUrl: '/ea-views?viewId=v1' }

function mockFetch(body: any, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({ ok, json: async () => body }) as any
}

describe('<AdmOutputViews> - ADM pictures are the linked EA Views', () => {
  beforeEach(() => mockNavigate.mockReset())

  it('shows each linked EA View as a picture with its state and a link to EA Views', async () => {
    mockFetch([picture])
    render(<AdmOutputViews outputId="out-1" />)
    const img = await screen.findByAltText('Target Application Portfolio')
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
    expect(screen.getByText(/GRAPH · TARGET · 12/)).toBeInTheDocument()
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toMatch(/\/adm-intelligence\/outputs\/out-1\/view-pictures$/)
    fireEvent.click(screen.getByText('adm.views_open'))
    expect(mockNavigate).toHaveBeenCalledWith('/ea-views?viewId=v1')
  })

  it('says plainly when no EA View is linked yet (no AI diagram is ever offered instead)', async () => {
    mockFetch([])
    render(<AdmOutputViews outputId="out-1" />)
    expect(await screen.findByText('adm.views_empty')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('a failed request shows the empty state, never an error page', async () => {
    mockFetch({ message: 'x' }, false)
    render(<AdmOutputViews outputId="out-1" />)
    expect(await screen.findByText('adm.views_empty')).toBeInTheDocument()
  })
})
