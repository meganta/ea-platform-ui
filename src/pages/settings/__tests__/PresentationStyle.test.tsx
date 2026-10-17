import * as fs from 'fs'
import * as path from 'path'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PresentationStyleCard from '../PresentationStyleCard'
import { PRESENTATION_STYLE_TRANSLATIONS, PS_COVERS, PS_HEADERS, PS_LOGO, PS_POINTS, PS_TABLES, PS_TONES, PS_PALETTE } from '../presentationStyleStrings'

let mockAdmin = true
jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => mockAdmin }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)

const style = (over: any = {}) => ({ fonts: { latinHeading: null, latinBody: null, arabic: null, measureLatinAs: 'Calibri' }, palette: { primary: null, accent: null, ink: null, surface: null }, cover: null, header: null, table: null, points: null, logoPlacement: 'END', tone: 'FORMAL', guidelines: null, ...over })
const view = (over: any = {}) => ({ published: null, draft: null, publishedAt: null, editing: style(), warnings: [], ...over })
const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob(['x'])) })

beforeEach(() => { mockAdmin = true })

describe('Presentation style card', () => {
  it('says the built-in designs are used, saves an edited draft with the typed font and colour', async () => {
    const fetchMock = jest.fn((url: string, init: any) => {
      if (init?.method === 'PUT') return ok(view({ draft: style(JSON.parse(init.body)), editing: style(JSON.parse(init.body)), warnings: ['Fonts must be installed'] }))
      return ok(view())
    })
    global.fetch = fetchMock as any
    render(<PresentationStyleCard />)
    await waitFor(() => expect(screen.getByTestId('pstyle-state')).toHaveTextContent('pstyle.state.builtin'))
    fireEvent.change(screen.getByLabelText('pstyle.font.arabic'), { target: { value: 'Dubai' } })
    fireEvent.change(screen.getByLabelText('pstyle.colour.primary', { selector: 'input:not([type=color])' }), { target: { value: '#0A3D62' } })
    fireEvent.change(screen.getByLabelText('pstyle.header'), { target: { value: 'MINIMAL' } })
    expect(screen.getByTestId('pstyle-state')).toHaveTextContent('pstyle.unsaved')
    fireEvent.click(screen.getByText('pstyle.save'))
    await screen.findByText('pstyle.saved')
    const put = fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')!
    expect(put[0]).toContain('/branding/presentation-style')
    expect(JSON.parse(put[1].body)).toMatchObject({ fonts: { arabic: 'Dubai' }, palette: { primary: '0A3D62' }, header: 'MINIMAL' })
    expect(screen.getByTestId('pstyle-state')).toHaveTextContent('pstyle.state.draft')
    expect(screen.getByTestId('pstyle-warnings')).toHaveTextContent('Fonts must be installed')
    expect(screen.getByText('pstyle.publish')).toBeInTheDocument()
  })

  it('shows the server\'s refusal (e.g. an illegible colour)', async () => {
    global.fetch = jest.fn((url: string, init: any) => init?.method === 'PUT' ? Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: 'The text colour (ink) must contrast' }) }) : ok(view())) as any
    render(<PresentationStyleCard />)
    await screen.findByTestId('pstyle-state')
    fireEvent.change(screen.getByLabelText('pstyle.tone'), { target: { value: 'CONCISE' } })
    fireEvent.click(screen.getByText('pstyle.save'))
    expect(await screen.findByRole('alert')).toHaveTextContent('must contrast')
  })

  it('downloads a sample deck of the style on screen, including unsaved changes', async () => {
    const fetchMock = jest.fn((url: string, init: any) => ok(view()))
    global.fetch = fetchMock as any
    ;(URL as any).createObjectURL = jest.fn(() => 'blob:x'); (URL as any).revokeObjectURL = jest.fn()
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<PresentationStyleCard />)
    await screen.findByTestId('pstyle-state')
    fireEvent.change(screen.getByLabelText('pstyle.cover'), { target: { value: 'BLUEPRINT' } })
    fireEvent.click(screen.getByText('pstyle.preview_ar'))
    await waitFor(() => expect(click).toHaveBeenCalled())
    const call = fetchMock.mock.calls.find(c => String(c[0]).includes('/preview'))!
    expect(call[0]).toContain('language=AR')
    expect(JSON.parse(call[1].body).cover).toBe('BLUEPRINT')
    click.mockRestore()
  })

  it('lets administrators publish and reset; others only edit the draft', async () => {
    global.fetch = jest.fn(() => ok(view({ published: style({ tone: 'CONCISE' }), draft: style({ tone: 'NARRATIVE' }), publishedAt: '2026-10-18T10:00:00Z', editing: style({ tone: 'NARRATIVE' }) }))) as any
    const { unmount } = render(<PresentationStyleCard />)
    await screen.findByText('pstyle.publish')
    expect(screen.getByText('pstyle.reset')).toBeInTheDocument()
    unmount()
    mockAdmin = false
    render(<PresentationStyleCard />)
    await screen.findByText('pstyle.discard')
    expect(screen.queryByText('pstyle.publish')).toBeNull()
    expect(screen.queryByText('pstyle.reset')).toBeNull()
    expect(screen.getByText('pstyle.admin_only')).toBeInTheDocument()
  })

  it('has English and Arabic text for every key it uses', () => {
    const src = ['../PresentationStyleCard.tsx'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('\n')
    const keys = new Set<string>(Array.from(src.matchAll(/t\('(pstyle[^']*)'\)/g)).map(m => m[1]))
    for (const k of PS_PALETTE) keys.add(`pstyle.colour.${k}`)
    for (const k of ['latinHeading', 'latinBody', 'arabic']) keys.add(`pstyle.font.${k}`)
    for (const [prefix, list] of [['cover', PS_COVERS], ['header', PS_HEADERS], ['table', PS_TABLES], ['points', PS_POINTS], ['logo', PS_LOGO], ['tone', PS_TONES]] as const) for (const o of list) keys.add(`pstyle.${prefix}.${o}`)
    for (const k of Array.from(keys)) {
      const entry = PRESENTATION_STYLE_TRANSLATIONS[k]
      expect([k, !!entry?.EN, /[؀-ۿ]/.test(entry?.AR || '')]).toEqual([k, true, true])
    }
  })
})
