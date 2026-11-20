import * as fs from 'fs'
import * as path from 'path'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import DeckTemplatesCard from '../DeckTemplatesCard'
import { DECK_TEMPLATE_TRANSLATIONS, DT_LANGUAGES } from '../deckTemplateStrings'

let mockAdmin = true
jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => mockAdmin }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)
jest.mock('../../../lib/api', () => ({ API_BASE: 'http://api', getToken: () => 'tok' }))

const tpl = (over: any = {}) => ({ fileName: 'EA_Review.pptx', size: 10, uploadedAt: '2026-11-20T10:00:00Z', isDefault: true, layouts: { cover: 'شريحة عنوان', content: 'عنوان ومحتوى' }, palette: { primary: '16243B', accent: 'C55A11' }, fonts: { latin: 'SST Arabic', arabic: 'SST Arabic' }, sampleSlides: 8, ...over })
const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), blob: () => Promise.resolve(new Blob(['PK'])) })

beforeEach(() => {
  mockAdmin = true
  ;(global as any).URL.createObjectURL = jest.fn(() => 'blob:x')
  ;(global as any).URL.revokeObjectURL = jest.fn()
})

describe('Deck templates card', () => {
  it('shows each language: the stored template with what was read, or the built-in design', async () => {
    global.fetch = jest.fn(() => ok({ AR: null, EN: tpl() })) as any
    render(<DeckTemplatesCard />)
    await screen.findByText('EA_Review.pptx')
    const en = screen.getByTestId('dtpl-EN')
    expect(en).toHaveTextContent('EA_Review.pptx')
    expect(en).toHaveTextContent('dtpl.default_on')
    expect(en).toHaveTextContent('عنوان ومحتوى')
    expect(en).toHaveTextContent('SST Arabic')
    expect(within(en).getAllByTestId('dtpl-swatch')).toHaveLength(2)
    expect(screen.getByTestId('dtpl-AR')).toHaveTextContent('dtpl.none')
  })

  it('uploads a template for a language as a file and shows the result', async () => {
    const fetchMock = jest.fn((url: string, init: any) => (init?.method === 'POST' ? ok({ AR: tpl({ fileName: 'ar.pptx' }), EN: null }) : ok({ AR: null, EN: null })))
    global.fetch = fetchMock as any
    render(<DeckTemplatesCard />)
    await screen.findAllByText('dtpl.none')
    const file = new File(['PK'], 'ar.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
    fireEvent.change(screen.getByLabelText('dtpl.upload_label', { selector: '#dtpl-file-AR' }), { target: { files: [file] } })
    await screen.findByText('dtpl.uploaded_ok')
    const post = fetchMock.mock.calls.find(c => c[1]?.method === 'POST')!
    expect(post[0]).toBe('http://api/branding/deck-templates/AR')
    expect((post[1].body as FormData).get('file')).toBe(file)
    expect(post[1].headers['Content-Type']).toBeUndefined()
    expect(screen.getByTestId('dtpl-AR')).toHaveTextContent('ar.pptx')
  })

  it('switches the default off, shows a server refusal, and removes after confirmation', async () => {
    const fetchMock = jest.fn((url: string, init: any) => {
      if (init?.method === 'PUT') return ok({ AR: tpl({ isDefault: JSON.parse(init.body).isDefault }), EN: null })
      if (init?.method === 'DELETE') return ok({ AR: null, EN: null })
      if (init?.method === 'POST') return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: 'The template must be widescreen 16:9 (13.33 x 7.5 inches).' }) })
      return ok({ AR: tpl(), EN: null })
    })
    global.fetch = fetchMock as any
    window.confirm = jest.fn(() => true)
    render(<DeckTemplatesCard />)
    await screen.findByText('EA_Review.pptx')
    const ar = screen.getByTestId('dtpl-AR')
    fireEvent.click(within(ar).getByRole('checkbox'))
    await waitFor(() => expect(screen.getByTestId('dtpl-AR')).toHaveTextContent('dtpl.default_off'))
    expect(JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)).toEqual({ isDefault: false })
    fireEvent.change(screen.getByLabelText('dtpl.upload_label', { selector: '#dtpl-file-AR' }), { target: { files: [new File(['x'], 'old.pptx')] } })
    expect(await screen.findByRole('alert')).toHaveTextContent('16:9')
    fireEvent.click(within(screen.getByTestId('dtpl-AR')).getByText('dtpl.remove'))
    await waitFor(() => expect(screen.getByTestId('dtpl-AR')).toHaveTextContent('dtpl.none'))
    expect(fetchMock.mock.calls.some(c => c[1]?.method === 'DELETE' && c[0] === 'http://api/branding/deck-templates/AR')).toBe(true)
  })

  it('downloads a sample deck for the language; non-administrators cannot change templates', async () => {
    mockAdmin = false
    const fetchMock = jest.fn(() => ok({ AR: tpl(), EN: null }))
    global.fetch = fetchMock as any
    render(<DeckTemplatesCard />)
    await screen.findByText('EA_Review.pptx')
    const ar = screen.getByTestId('dtpl-AR')
    expect(screen.getByText('dtpl.admin_only')).toBeInTheDocument()
    expect(within(ar).queryByText('dtpl.remove')).toBeNull()
    expect(within(ar).queryByRole('checkbox')).toBeNull()
    fireEvent.click(within(ar).getByText('dtpl.sample'))
    await waitFor(() => expect(fetchMock.mock.calls.some((c: any) => c[0] === 'http://api/branding/presentation-style/preview?language=AR')).toBe(true))
  })
})

describe('deck template strings', () => {
  const has = (k: string) => { const v = DECK_TEMPLATE_TRANSLATIONS[k]; return !!v && !!v.EN.trim() && /[؀-ۿ]/.test(v.AR) }
  it('every static key and language label has EN and Arabic', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../DeckTemplatesCard.tsx'), 'utf8')
    const keys = Array.from(new Set(Array.from(src.matchAll(/['"`](dtpl\.[a-z_.]*)['"`]/g)).map(m => m[1]))).filter(k => !k.endsWith('.'))
    expect(keys.length).toBeGreaterThan(15)
    expect([...keys, ...DT_LANGUAGES.map(l => `dtpl.lang.${l}`)].filter(k => !has(k))).toEqual([])
  })
})
