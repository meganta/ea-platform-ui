import * as fs from 'fs'
import * as path from 'path'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import DeepWorkCard from '../DeepWorkCard'
import DeepWorkLauncher from '../DeepWorkLauncher'
import { runStage } from '../deepWorkApi'
import { DEEP_WORK_DECISIONS, DEEP_WORK_KINDS, DEEP_WORK_STAGES, DEEP_WORK_STATUSES, DEEP_WORK_TRANSLATIONS } from '../deepWorkStrings'

jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../HelpTip', () => () => <span>?</span>)
jest.mock('../../../lib/api', () => ({ API_BASE: 'http://api', getToken: () => 'tok' }))

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
const fail = (status: number, body: any) => Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) })

const done = {
  id: 'run-1', module: 'governance', title: 'Lead review: Portal HLD', status: 'COMPLETED', phase: 'DONE', level: 'DEEP', model: 'claude-opus-5-5', steps: 7, toolCalls: 12, costSar: 3.456, unpricedTurns: 0,
  ledger: [{ id: 'E1', step: 1, tool: 'review_document', input: {}, summary: 'Disaster recovery is not described.', sourceRef: { type: 'REVIEW_DOCUMENT', label: 'disaster recovery' } }],
  critiques: [{ pass: 1, verdict: 'SOUND', issues: [] }], limitations: [],
  result: {
    draft: { summary: 'DR is missing', answer: 'The design does not describe disaster recovery [E1].', findings: [{ statement: 'No DR design', kind: 'MISSED', evidence: ['E1'], confidence: 'HIGH' }, { statement: 'Made up', evidence: [], unsupported: true }], openQuestions: ['Who owns DR?'], limitations: [] },
    verdict: { decision: 'REQUIRES_CHANGES', rationale: 'DR absent [E1]', confidence: 'HIGH', conditions: ['Add a DR design'], dissent: [] }, limitations: ['The investigation has used all its rounds.'],
  },
  policy: { profile: { maxSteps: 40, maxToolCalls: 90, timeLimitSec: 900 } },
}

afterEach(() => { jest.useRealTimers() })

describe('DeepWorkCard', () => {
  it('shows a finished run: verdict, findings with their evidence, open questions, limits and spend', async () => {
    global.fetch = jest.fn(() => ok(done)) as any
    render(<DeepWorkCard runId="run-1" />)
    await waitFor(() => expect(screen.getByTestId('deep-work-verdict')).toHaveTextContent('requires changes'))
    expect(screen.getByTestId('deep-work-stage')).toHaveTextContent('deepwork.stage.COMPLETED')
    expect(screen.getByTestId('deep-work-cost')).toHaveTextContent('3.46 SAR')
    expect(screen.getByText('deepwork.unsupported')).toBeInTheDocument()
    expect(screen.getByText('Who owns DR?')).toBeInTheDocument()
    expect(screen.getByText('The investigation has used all its rounds.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'E1' }))
    expect(screen.getByTestId('deep-work-evidence')).toHaveTextContent('Disaster recovery is not described.')
    expect((global.fetch as jest.Mock).mock.calls.some(c => String(c[0]).endsWith('/advance'))).toBe(false)
  })

  it('while running, asks the server to take the next turns and follows it to the end', async () => {
    jest.useFakeTimers()
    const running = { ...done, status: 'RUNNING', phase: 'INVESTIGATE', result: null, draft: null, verdict: null }
    const calls: string[] = []
    let n = 0
    global.fetch = jest.fn((url: string, init: any) => { calls.push(`${init.method} ${url}`); n++; return ok(n < 3 ? running : done) }) as any
    const onFinished = jest.fn()
    render(<DeepWorkCard runId="run-1" onFinished={onFinished} />)
    await waitFor(() => expect(screen.getByTestId('deep-work-stage')).toBeInTheDocument())
    await act(async () => { jest.advanceTimersByTime(5000) })
    await waitFor(() => expect(onFinished).toHaveBeenCalledTimes(1))
    expect(calls).toContain('POST http://api/deep-work/run-1/advance')
  })

  it('stop button cancels a running run', async () => {
    const running = { ...done, status: 'RUNNING', phase: 'CRITIQUE', result: null, draft: null, verdict: null }
    global.fetch = jest.fn((url: string) => ok(String(url).endsWith('/cancel') ? { ...running, status: 'CANCELLED' } : running)) as any
    render(<DeepWorkCard runId="run-1" />)
    await waitFor(() => expect(screen.getByTestId('deep-work-stage')).toHaveTextContent('deepwork.stage.CHECKING'))
    fireEvent.click(screen.getByText('deepwork.cancel'))
    await waitFor(() => expect(screen.getByTestId('deep-work-stage')).toHaveTextContent('deepwork.stage.CANCELLED'))
  })

  it('in a Copilot message whose text is the result, shows only the evidence and checks', async () => {
    global.fetch = jest.fn(() => ok(done)) as any
    render(<DeepWorkCard runId="run-1" compact resultInMessage />)
    await waitFor(() => expect(screen.getByText('deepwork.show_evidence')).toBeInTheDocument())
    expect(screen.queryByTestId('deep-work-verdict')).toBeNull()
    fireEvent.click(screen.getByText('deepwork.show_evidence'))
    expect(screen.getByText('No DR design')).toBeInTheDocument()
    expect(screen.queryByText('The design does not describe disaster recovery [E1].')).toBeNull()
  })

  it('stage labels follow status and phase', () => {
    expect(runStage({ status: 'RUNNING', phase: 'LEAD' })).toBe('LEAD')
    expect(runStage({ status: 'RUNNING', phase: 'FINALIZE' })).toBe('INVESTIGATING')
    expect(runStage({ status: 'QUEUED', phase: 'INVESTIGATE' })).toBe('QUEUED')
  })
})

describe('DeepWorkLauncher', () => {
  it('shows the depth the administrator set, past runs, and starts a new one', async () => {
    global.fetch = jest.fn((url: string) => String(url).includes('/ai-policy/effective') ? ok({ canRun: true, level: 'DEEP', profile: { timeLimitSec: 900, leadRole: true } }) : String(url).includes('/deep-work?') ? ok([]) : ok(done)) as any
    const start = jest.fn(async () => done as any)
    render(<DeepWorkLauncher module="strategy" subjectType="STRATEGY_REFRESH" subjectId="sr1" titleKey="deepwork.strategy.title" helpKey="deepwork.strategy.help" startKey="deepwork.strategy.start" start={start} />)
    await waitFor(() => expect(screen.getByTestId('deep-work-policy')).toHaveTextContent('deepwork.policy_note'))
    expect(screen.getByText('deepwork.none_yet')).toBeInTheDocument()
    fireEvent.click(screen.getByText('deepwork.strategy.start'))
    await waitFor(() => expect(screen.getByTestId('deep-work-card')).toBeInTheDocument())
    expect(start).toHaveBeenCalled()
  })

  it('says when the policy does not allow a run and disables Start; no Start without permission', async () => {
    global.fetch = jest.fn((url: string) => String(url).includes('/ai-policy/effective') ? ok({ canRun: false, level: 'DEEP', blockedReason: 'Ceiling reached', profile: { timeLimitSec: 900 } }) : ok([])) as any
    const { unmount } = render(<DeepWorkLauncher module="adm" type="2" subjectType="ADM_CYCLE" subjectId="cy1" titleKey="deepwork.adm.title" helpKey="deepwork.adm.help" startKey="deepwork.adm.start" start={async () => done as any} />)
    await waitFor(() => expect(screen.getByTestId('deep-work-policy')).toHaveTextContent('Ceiling reached'))
    expect(screen.getByText('deepwork.adm.start')).toBeDisabled()
    unmount()
    render(<DeepWorkLauncher module="adm" subjectType="ADM_CYCLE" subjectId="cy1" titleKey="deepwork.adm.title" helpKey="deepwork.adm.help" startKey="deepwork.adm.start" />)
    await waitFor(() => expect(screen.getByTestId('deep-work-launcher')).toBeInTheDocument())
    expect(screen.queryByText('deepwork.adm.start')).toBeNull()
  })

  it('a refusal by the AI policy is explained', async () => {
    global.fetch = jest.fn((url: string) => String(url).includes('/ai-policy/effective') ? ok({ canRun: true, level: 'STANDARD', profile: { timeLimitSec: 360, leadRole: false } }) : ok([])) as any
    const start = jest.fn(async () => { const e: any = new Error('Copilot deep work is switched off'); e.code = 'AI_POLICY_BLOCKED'; throw e })
    render(<DeepWorkLauncher module="governance" subjectType="GOVERNANCE_REVIEW" subjectId="r1" titleKey="deepwork.gov.title" helpKey="deepwork.gov.help" startKey="deepwork.gov.title" start={start} />)
    await waitFor(() => expect(screen.getByTestId('deep-work-policy')).toHaveTextContent('deepwork.no_lead_at_level'))
    fireEvent.click(screen.getAllByText('deepwork.gov.title')[1])
    expect(await screen.findByRole('alert')).toHaveTextContent('deepwork.blocked: Copilot deep work is switched off')
  })
})

describe('deep-work strings', () => {
  const has = (k: string) => { const v = DEEP_WORK_TRANSLATIONS[k]; return !!v && !!v.EN.trim() && /[؀-ۿ]/.test(v.AR) }
  it('every static key the components use has EN and Arabic', () => {
    const dir = path.resolve(__dirname, '..')
    const src = fs.readdirSync(dir).filter(f => f.endsWith('.tsx')).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
      + ['../../../pages/AdmPage.tsx', '../../../pages/StrategyRefreshPage.tsx', '../../../pages/GovernancePage.tsx'].map(f => fs.readFileSync(path.resolve(__dirname, f), 'utf8')).join('\n')
    const keys = Array.from(new Set(Array.from(src.matchAll(/['"`](deepwork\.[a-z_]+(?:\.[a-z_]+)?)['"`]/g)).map(m => m[1])))
    expect(keys.length).toBeGreaterThan(30)
    expect(keys.filter(k => !has(k))).toEqual([])
  })
  it('every dynamic family has EN and Arabic', () => {
    const keys = [
      ...DEEP_WORK_STAGES.flatMap(s => [`deepwork.stage.${s}`, `deepwork.progress.${s}`]), ...DEEP_WORK_STATUSES.map(s => `deepwork.status.${s}`),
      ...DEEP_WORK_DECISIONS.map(d => `deepwork.decision.${d}`), ...DEEP_WORK_KINDS.map(k => `deepwork.kind.${k}`), ...['HIGH', 'MEDIUM', 'LOW'].map(c => `deepwork.conf.${c}`),
    ]
    expect(keys.filter(k => !has(k))).toEqual([])
  })
})
