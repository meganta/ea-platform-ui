import * as fs from 'fs'
import * as path from 'path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import EaDeliverablesPage from '../EaDeliverablesPage'
import { DELIVERABLES_TRANSLATIONS, DELIVERABLE_FORMATS, VIEW_STATES } from '../deliverables/deliverablesStrings'
import { fileNameOf } from '../deliverables/deliverablesApi'

jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../components/HelpTip', () => () => <span>?</span>)
jest.mock('../../lib/api', () => ({ API_BASE: 'http://api', getToken: () => 'tok' }))

const catalogue = {
  deliverables: [
    { code: 'CAPABILITY_CATALOG', number: 1, title: ['Business Capability Catalog', 'دليل قدرات الأعمال'], summary: ['Every capability', 'كل القدرات'], format: 'XLSX', sources: ['Capability Management'], options: [], records: 358 },
    { code: 'VIEWS_DECK', number: 8, title: ['EA Views (Current to Target)', 'المناظير'], summary: ['Views', 'مناظير'], format: 'PPTX', sources: ['EA Views'], options: ['views'], records: 2 },
    { code: 'DATA_POLICIES', number: 12, title: ['Data Policies and Processing Agreement', 'سياسات البيانات'], summary: ['Policies', 'سياسات'], format: 'DOCX', sources: ['EA Repository'], options: ['policyOwners'], records: 137 },
  ],
  options: {
    policyOwners: [{ owner: 'Data Office', policies: 5 }, { owner: 'IT GD', policies: 16 }],
    views: [{ id: 'v1', name: 'Jadarat Portfolio - Current', state: { type: 'CURRENT', name: 'Current' } }, { id: 'v2', name: 'Jadarat Portfolio - Target', state: { type: 'TARGET', name: 'Jadarat Target' } }],
    architectures: [],
  },
}

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), headers: { get: () => null }, blob: () => Promise.resolve(new Blob(['x'])) })
const file = (name: string) => Promise.resolve({ ok: true, status: 200, headers: { get: () => `attachment; filename*=UTF-8''${encodeURIComponent(name)}` }, blob: () => Promise.resolve(new Blob(['PK'])) })

beforeEach(() => {
  ;(global as any).URL.createObjectURL = jest.fn(() => 'blob:x')
  ;(global as any).URL.revokeObjectURL = jest.fn()
})

describe('EaDeliverablesPage', () => {
  it('lists the deliverables with format, sources and record counts', async () => {
    global.fetch = jest.fn(() => ok(catalogue)) as any
    render(<EaDeliverablesPage />)
    await waitFor(() => expect(screen.getByText('Business Capability Catalog')).toBeInTheDocument())
    expect(screen.getByTestId('deliverable-VIEWS_DECK')).toHaveTextContent('deliv.format.PPTX')
    expect(screen.getAllByText('deliv.records').length).toBe(3)
  })

  it('a deliverable that needs a choice cannot be downloaded until it is made, then sends the choice and the chosen language', async () => {
    const fetchMock = jest.fn((url: string) => (url.endsWith('/ea-deliverables') ? ok(catalogue) : file('12 Data Policies and Processing Agreement.docx')))
    global.fetch = fetchMock as any
    render(<EaDeliverablesPage />)
    await waitFor(() => expect(screen.getByTestId('deliverable-DATA_POLICIES')).toBeInTheDocument())
    const card = screen.getByTestId('deliverable-DATA_POLICIES')
    const button = card.querySelector('button.btn') as HTMLButtonElement
    expect(button).toBeDisabled()
    expect(card).toHaveTextContent('deliv.opt.owners_none')
    fireEvent.click(screen.getByLabelText('Data Office'))
    fireEvent.change(screen.getByLabelText('deliv.language'), { target: { value: 'AR' } })
    expect(button).not.toBeDisabled()
    fireEvent.click(button)
    await waitFor(() => expect(card).toHaveTextContent('deliv.ready'))
    const [url, init] = fetchMock.mock.calls.find(c => String(c[0]).endsWith('/ea-deliverables/DATA_POLICIES'))! as any
    expect(url).toBe('http://api/ea-deliverables/DATA_POLICIES')
    expect(JSON.parse(init.body)).toEqual({ language: 'AR', policyOwners: ['Data Office'] })
  })

  it('views show their architecture state; Download all sends every card\'s own choices', async () => {
    const fetchMock = jest.fn((url: string) => (url.endsWith('/ea-deliverables') ? ok(catalogue) : file('EA Deliverables.zip')))
    global.fetch = fetchMock as any
    render(<EaDeliverablesPage />)
    await waitFor(() => expect(screen.getByLabelText('Jadarat Portfolio - Target')).toBeInTheDocument())
    expect(screen.getByText('deliv.state.TARGET · Jadarat Target')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Jadarat Portfolio - Current'))
    fireEvent.click(screen.getByLabelText('IT GD'))
    fireEvent.click(screen.getByText('deliv.download_all'))
    await waitFor(() => expect(screen.getByText('deliv.ready')).toBeInTheDocument())
    const [, init] = fetchMock.mock.calls.find(c => String(c[0]).endsWith('/ea-deliverables/bundle'))! as any
    expect(JSON.parse(init.body)).toEqual({ language: 'EN', byCode: { VIEWS_DECK: { viewIds: ['v1'] }, DATA_POLICIES: { policyOwners: ['IT GD'] } } })
  })

  it('a refusal from the server is shown on the card', async () => {
    global.fetch = jest.fn((url: string) => (url.endsWith('/ea-deliverables') ? ok(catalogue) : Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: 'Choose the views the deck should contain.' }) }))) as any
    render(<EaDeliverablesPage />)
    await waitFor(() => expect(screen.getByText('Business Capability Catalog')).toBeInTheDocument())
    fireEvent.click(screen.getByTestId('deliverable-CAPABILITY_CATALOG').querySelector('button.btn') as HTMLButtonElement)
    await waitFor(() => expect(screen.getByText(/Choose the views the deck should contain/)).toBeInTheDocument())
  })

  it('reads the file name the server gives, including Arabic names', () => {
    expect(fileNameOf(`attachment; filename*=UTF-8''${encodeURIComponent('01 دليل قدرات الأعمال.xlsx')}`, 'x')).toBe('01 دليل قدرات الأعمال.xlsx')
    expect(fileNameOf(null, 'fallback.zip')).toBe('fallback.zip')
  })
})

describe('deliverables strings', () => {
  const has = (k: string) => { const v = DELIVERABLES_TRANSLATIONS[k]; return !!v && !!v.EN.trim() && /[؀-ۿ]/.test(v.AR) }
  it('every static key the page uses has EN and Arabic', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../EaDeliverablesPage.tsx'), 'utf8') + fs.readFileSync(path.resolve(__dirname, '../../components/Layout.tsx'), 'utf8')
    const keys = Array.from(new Set(Array.from(src.matchAll(/['"`]((?:deliv|nav\.deliverables)[a-z_.]*)['"`]/g)).map(m => m[1]))).filter(k => !k.endsWith('.'))
    expect(keys.length).toBeGreaterThan(20)
    expect(keys.filter(k => !has(k))).toEqual([])
  })
  it('every dynamic family has EN and Arabic', () => {
    const keys = [...DELIVERABLE_FORMATS.map(f => `deliv.format.${f}`), ...VIEW_STATES.map(s => `deliv.state.${s}`), 'deliv.lang.EN', 'deliv.lang.AR']
    expect(keys.filter(k => !has(k))).toEqual([])
  })
})
