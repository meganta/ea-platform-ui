import * as fs from 'fs'
import * as path from 'path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DesignReviewsPage from '../DesignReviewsPage'
import { DR_TRANSLATIONS, DR_DYNAMIC_KEYS } from '../designreview/designReviewStrings'
import { fileNameOf } from '../designreview/designReviewApi'
import { commaList } from '../designreview/RowsEditor'

let mockParams = new URLSearchParams()
const mockSetParams = jest.fn((p: any) => { mockParams = new URLSearchParams(p) })
jest.mock('react-router-dom', () => ({ useSearchParams: () => [mockParams, mockSetParams] }), { virtual: true })
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
let mockPerms = new Set(['DesignReview.View', 'DesignReview.Run', 'DesignReview.Edit', 'DesignReview.Approve'])
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: (c: string) => mockPerms.has(c) }) }))
jest.mock('../../components/HelpTip', () => () => <span>?</span>)
jest.mock('../../lib/api', () => ({ API_BASE: 'http://api', getToken: () => 'tok' }))

const summary = { id: 'r1', title: 'HR managed services', reviewType: 'RFP', language: 'EN', status: 'READY', stage: 'DONE', documentName: 'rfp.pdf', documentChars: 1200, error: null, createdAt: '2026-11-20T10:00:00Z', updatedAt: '', approvedAt: null, stalled: false, verdict: 'CONDITIONAL', counts: { gaps: 1, risks: 1, recommendations: 1 } }
const result = {
  scope: { summary: 'Operate and support the HR platform', items: ['Operations'], deliverables: ['Monthly report'] }, documentReferences: ['NCA ECC'],
  landscape: [{ ref: 'A1', id: 'a1', name: 'Oracle HR', nameInDocument: 'Oracle HR', inRepository: true, typeLabel: 'Application', lifecycle: 'Planned for migration', owner: 'HR', relation: 'Operated by the supplier' }, { ref: null, id: null, name: 'New CRM', nameInDocument: 'New CRM', inRepository: false, relation: 'Introduced' }],
  projects: [],
  strategy: [{ key: 'g1', label: 'Business vision', rows: [{ ref: 'S1', id: 's1', name: 'SO1', pillar: 'Excellence', rating: 'PARTIAL', justification: 'Indirect' }] }],
  principles: [{ ref: 'P1', id: 'p1', name: 'Re-use over Buy over Build', rating: 'ALIGNED', justification: 'Reuses' }], standards: [],
  domains: [{ domain: 'APPLICATION', level: 'HIGH', points: ['Migration conflict'] }],
  gaps: [{ id: 'G1', title: 'No exit plan', description: 'Missing', severity: 'HIGH', refs: [{ ref: 'A1', id: 'a1', name: 'Oracle HR' }] }],
  risks: [{ id: 'R1', title: 'Sunk cost', description: '', impact: 'HIGH', likelihood: 'HIGH', mitigation: 'Short term' }],
  recommendations: [{ id: 'C1', group: 'SCOPE', text: 'Add exit and handover', gaps: ['G1'] }], nextSteps: [{ step: 'Revise', owner: 'Procurement', timing: 'Before issue' }],
  executive: { headline: 'Proceed with conditions', keyMessages: ['Tie the term to the migration'], aiVerdict: 'CONDITIONAL', aiVerdictReason: 'Exit missing' },
  verdict: { value: 'CONDITIONAL', basis: 'RULE', reason: '1 high gap(s)', ruleValue: 'CONDITIONAL', ruleReason: '1 high gap(s)' }, counts: { gaps: 1, risks: 1, recommendations: 1 }, limitations: ['No EA standards are recorded in the Repository.'],
}
const review = { ...summary, result, counts: { landscape: 2, projects: 0, objectives: 1, principles: 1, standards: 0, referenceArchitectures: 0 }, candidates: { landscape: [{ ref: 'A2', name: 'Data Warehouse', type: 'Application' }], projects: [], standards: [] } }

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), headers: { get: () => null } })
function api(routes: Record<string, (init?: any) => any>) {
  const fn = jest.fn((url: string, init?: any) => {
    const key = `${init?.method || 'GET'} ${url.replace('http://api/design-reviews', '')}`
    const hit = Object.keys(routes).sort((a, b) => b.length - a.length).find(k => key === k || key.startsWith(k))
    if (!hit) return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ message: `no route ${key}` }) })
    return routes[hit](init)
  })
  global.fetch = fn as any
  return fn
}
const sent = (fn: jest.Mock, key: string) => fn.mock.calls.filter(c => `${c[1]?.method || 'GET'} ${String(c[0]).replace('http://api/design-reviews', '')}` === key)

beforeEach(() => {
  mockParams = new URLSearchParams(); mockSetParams.mockClear()
  mockPerms = new Set(['DesignReview.View', 'DesignReview.Run', 'DesignReview.Edit', 'DesignReview.Approve'])
  ;(global as any).URL.createObjectURL = jest.fn(() => 'blob:x')
  ;(global as any).URL.revokeObjectURL = jest.fn()
  window.HTMLElement.prototype.scrollIntoView = jest.fn()
})

describe('DesignReviewsPage - list and new review', () => {
  it('lists reviews with type, status, verdict and counts, and opens one', async () => {
    api({ 'GET ': () => ok([summary]) })
    render(<DesignReviewsPage />)
    const row = await screen.findByTestId('review-r1')
    expect(row).toHaveTextContent('HR managed services')
    expect(row).toHaveTextContent('dr.type.RFP')
    expect(row).toHaveTextContent('dr.status.READY')
    expect(row).toHaveTextContent('dr.verdict.CONDITIONAL')
    fireEvent.click(row)
    expect(mockSetParams).toHaveBeenCalledWith({ review: 'r1' })
  })

  it('uploads the document with its title, type and language, then opens the review', async () => {
    const fn = api({ 'GET ': () => ok([]), 'POST ': () => ok({ ...summary, id: 'r9', status: 'RUNNING' }) })
    render(<DesignReviewsPage />)
    await screen.findByText('dr.empty')
    fireEvent.click(screen.getByText('dr.new'))
    const start = screen.getByText('dr.start')
    expect(start).toBeDisabled()
    fireEvent.change(screen.getByLabelText('dr.field.title'), { target: { value: 'Payroll HLD' } })
    fireEvent.change(screen.getByLabelText('dr.field.type'), { target: { value: 'HLD' } })
    fireEvent.change(screen.getByLabelText('dr.field.language'), { target: { value: 'AR' } })
    const file = new File(['%PDF'], 'hld.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/dr.field.file/), { target: { files: [file] } })
    expect(start).not.toBeDisabled()
    fireEvent.click(start)
    await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ review: 'r9' }))
    const body = sent(fn, 'POST ')[0][1].body as FormData
    expect(body.get('title')).toBe('Payroll HLD')
    expect(body.get('reviewType')).toBe('HLD')
    expect(body.get('language')).toBe('AR')
    expect((body.get('file') as File).name).toBe('hld.pdf')
    expect(sent(fn, 'POST ')[0][1].headers['Content-Type']).toBeUndefined()
  })

  it('shows a refusal from the server and hides New review without the Run permission', async () => {
    api({ 'GET ': () => ok([]), 'POST ': () => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: 'The document has too little readable text to review' }) }) })
    const { unmount } = render(<DesignReviewsPage />)
    await screen.findByText('dr.empty')
    fireEvent.click(screen.getByText('dr.new'))
    fireEvent.change(screen.getByLabelText('dr.field.title'), { target: { value: 'Scan' } })
    fireEvent.change(screen.getByLabelText(/dr.field.file/), { target: { files: [new File(['x'], 'scan.pdf')] } })
    fireEvent.click(screen.getByText('dr.start'))
    expect(await screen.findByRole('alert')).toHaveTextContent('too little readable text')
    unmount()
    mockPerms = new Set(['DesignReview.View'])
    render(<DesignReviewsPage />)
    await screen.findByText('dr.empty')
    expect(screen.queryByText('dr.new')).toBeNull()
  })
})

describe('DesignReviewsPage - workspace', () => {
  it('shows the steps of a stopped review and resumes it', async () => {
    mockParams = new URLSearchParams({ review: 'r1' })
    const fn = api({ 'GET /r1': () => ok({ ...review, status: 'FAILED', stage: 'IMPACT', result: null, error: 'The review stopped at the "IMPACT" step.' }), 'POST /r1/resume': () => ok({ ...review, status: 'RUNNING', stage: 'IMPACT', result: null }) })
    render(<DesignReviewsPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent('IMPACT')
    expect(screen.getByText(/dr.stage.STRATEGY/)).toHaveClass('dr-step-done')
    expect(screen.getByText('dr.stage.IMPACT')).toHaveClass('dr-step-now')
    fireEvent.click(screen.getByText('dr.resume'))
    await waitFor(() => expect(sent(fn, 'POST /r1/resume')).toHaveLength(1))
    expect(await screen.findByText('dr.running')).toBeInTheDocument()
  })

  it('shows the verdict and sections, and saves an edited rating', async () => {
    mockParams = new URLSearchParams({ review: 'r1' })
    const fn = api({ 'GET /r1': () => ok(review), 'PUT /r1/content': () => ok(review) })
    render(<DesignReviewsPage />)
    expect(await screen.findByTestId('verdict')).toHaveTextContent('dr.verdict.CONDITIONAL')
    expect(screen.getByText('Proceed with conditions')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'dr.tab.strategy' }))
    expect(await screen.findByText('SO1')).toBeInTheDocument()
    expect(screen.getByText('Excellence')).toBeInTheDocument()
    fireEvent.click(screen.getByText('dr.edit'))
    fireEvent.change(screen.getByLabelText('dr.col.rating'), { target: { value: 'NOT_ALIGNED' } })
    fireEvent.change(screen.getByLabelText('dr.col.justification'), { target: { value: 'Buys a new platform' } })
    fireEvent.click(screen.getByText('dr.save'))
    await waitFor(() => expect(sent(fn, 'PUT /r1/content')).toHaveLength(1))
    expect(JSON.parse(sent(fn, 'PUT /r1/content')[0][1].body)).toEqual({ section: 'strategy', value: [{ key: 'g1', rows: [{ ref: 'S1', rating: 'NOT_ALIGNED', justification: 'Buys a new platform' }] }] })
  })

  it('records a reviewer verdict with its reason', async () => {
    mockParams = new URLSearchParams({ review: 'r1' })
    const fn = api({ 'GET /r1': () => ok(review), 'PUT /r1/content': () => ok(review) })
    render(<DesignReviewsPage />)
    await screen.findByTestId('verdict')
    fireEvent.click(screen.getAllByText('dr.edit')[0])
    fireEvent.change(screen.getByLabelText('dr.sec.verdict'), { target: { value: 'NOT_APPROVED' } })
    fireEvent.change(screen.getByLabelText('dr.verdict.reason'), { target: { value: 'Committee decision' } })
    fireEvent.click(screen.getByText('dr.save'))
    await waitFor(() => expect(sent(fn, 'PUT /r1/content')).toHaveLength(1))
    expect(JSON.parse(sent(fn, 'PUT /r1/content')[0][1].body)).toEqual({ section: 'verdict', value: { value: 'NOT_APPROVED', reason: 'Committee decision', basis: 'REVIEWER' } })
  })

  it('marks systems not in the Repository and sends typed gap ids as a list', async () => {
    mockParams = new URLSearchParams({ review: 'r1' })
    const fn = api({ 'GET /r1': () => ok(review), 'PUT /r1/content': () => ok(review) })
    render(<DesignReviewsPage />)
    await screen.findByTestId('verdict')
    fireEvent.click(screen.getByRole('tab', { name: 'dr.tab.impact' }))
    expect(await screen.findByText('dr.not_recorded')).toBeInTheDocument()
    expect(screen.getByText('Planned for migration - Application')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'dr.tab.recs' }))
    fireEvent.click(screen.getAllByText('dr.edit')[0])
    fireEvent.change(screen.getByLabelText('dr.col.closes'), { target: { value: 'G1، G2,' } })
    fireEvent.click(screen.getByText('dr.save'))
    await waitFor(() => expect(sent(fn, 'PUT /r1/content')).toHaveLength(1))
    expect(JSON.parse(sent(fn, 'PUT /r1/content')[0][1].body).value[0].gaps).toEqual(['G1', 'G2'])
  })

  it('downloads exports with the server file name and approves the review', async () => {
    mockParams = new URLSearchParams({ review: 'r1' })
    const fn = api({
      'GET /r1/export/pptx': () => Promise.resolve({ ok: true, status: 200, headers: { get: () => `attachment; filename*=UTF-8''${encodeURIComponent('مراجعة الكراسة.pptx')}` }, blob: () => Promise.resolve(new Blob(['PK'])) }),
      'GET /r1': () => ok(review), 'POST /r1/approve': () => ok({ ...review, status: 'APPROVED' }),
    })
    render(<DesignReviewsPage />)
    await screen.findByTestId('verdict')
    fireEvent.click(screen.getByText('dr.export_pptx'))
    expect(await screen.findByRole('status')).toHaveTextContent('dr.downloaded')
    fireEvent.click(screen.getByText('dr.approve'))
    await waitFor(() => expect(sent(fn, 'POST /r1/approve')).toHaveLength(1))
    expect(await screen.findByText('dr.locked')).toBeInTheDocument()
    expect(screen.queryByText('dr.edit')).toBeNull()
    expect(screen.getByText('dr.reopen')).toBeInTheDocument()
  })

  it('lists the limits of the review', async () => {
    mockParams = new URLSearchParams({ review: 'r1' })
    api({ 'GET /r1': () => ok(review) })
    render(<DesignReviewsPage />)
    await screen.findByTestId('verdict')
    fireEvent.click(screen.getByRole('tab', { name: 'dr.tab.limits' }))
    expect(await screen.findByText('dr.sec.limits')).toBeInTheDocument()
    expect(screen.getByText('No EA standards are recorded in the Repository.')).toBeInTheDocument()
  })
})

describe('design review helpers', () => {
  it('reads Arabic file names and splits Latin and Arabic comma lists', () => {
    expect(fileNameOf(`attachment; filename*=UTF-8''${encodeURIComponent('مراجعة.docx')}`, 'x')).toBe('مراجعة.docx')
    expect(fileNameOf(null, 'fallback.docx')).toBe('fallback.docx')
    expect(commaList('G1، G2, ,G3')).toEqual(['G1', 'G2', 'G3'])
  })
})

describe('design review strings', () => {
  const has = (k: string) => { const v = DR_TRANSLATIONS[k]; return !!v && !!v.EN.trim() && /[؀-ۿ]/.test(v.AR) }
  it('every static key the pages use has EN and Arabic', () => {
    const files = ['../DesignReviewsPage.tsx', '../designreview/ReviewWorkspace.tsx', '../designreview/RowsEditor.tsx', '../../components/Layout.tsx']
    const src = files.map(f => fs.readFileSync(path.resolve(__dirname, f), 'utf8')).join('\n')
    const keys = Array.from(new Set(Array.from(src.matchAll(/['"`]((?:dr\.|nav\.designreview)[a-z_.]*)['"`]/g)).map(m => m[1]))).filter(k => !k.endsWith('.'))
    expect(keys.length).toBeGreaterThan(60)
    expect(keys.filter(k => !has(k))).toEqual([])
  })
  it('every dynamic family has EN and Arabic', () => {
    expect(DR_DYNAMIC_KEYS.filter(k => !has(k))).toEqual([])
  })
})
