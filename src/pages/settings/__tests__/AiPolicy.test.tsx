import * as fs from 'fs'
import * as path from 'path'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AiPolicySettingsCard from '../AiPolicySettingsCard'
import { AI_POLICY_TRANSLATIONS } from '../aiPolicyStrings'
import { AI_DEPTH_LEVELS, AI_POLICY_MODULES, CATALOGUE_PROVIDERS, KSA_STATUSES, MODEL_BLOCKS, NOTE_CODES, amountOrNull, sar } from '../aiPolicy'

jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)

const ok = (body: any) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) })
const profile = (level: string) => ({ level, maxSteps: 5, maxToolCalls: 8, effort: 'low', maxOutputTokens: 2000, critiquePasses: 0, leadRole: false, timeLimitSec: 90 })
const eff = (module: string, over: any = {}) => ({ module, requestedLevel: 'STANDARD', level: 'STANDARD', profile: profile('STANDARD'), model: null, usesMainModel: true, budget: {}, canRun: true, blockedReason: null, notes: [], ...over })

const view = (over: any = {}) => ({
  settings: { levels: { copilot: 'QUICK', copilot_deep: 'DEEP', governance: 'EXHAUSTIVE', adm: 'STANDARD', strategy: 'STANDARD' }, typeLevels: {}, copilotDeepWorkEnabled: false, models: {}, monthlyBudgetSar: 500, moduleBudgetsSar: {}, runCapSar: null, budgetMode: 'SOFT' },
  ownerLimits: { allowedProviders: [], allowedModelIds: [], ksaOnly: true, maxLevels: { governance: 'DEEP' }, monthlyCeilingSar: 300, moduleCeilingsSar: {}, runCeilingSar: null, allowTenantKeys: false, note: 'Pilot phase' },
  levels: AI_DEPTH_LEVELS.map(profile),
  models: [{ key: 'anthropic:claude-sonnet-5-5', provider: 'anthropic', modelId: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', vendor: 'Anthropic', deepWorkCapable: true, ksaAvailability: 'AVAILABLE', inputSarPerMTok: 7.5, outputSarPerMTok: 37.5, isActive: true }],
  unavailableModels: [{ key: 'openai:gpt-4o', displayName: 'GPT-4o', reason: 'NOT_KSA_HOSTED' }],
  mainModel: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  effective: Object.fromEntries(AI_POLICY_MODULES.map(m => [m, m === 'governance' ? eff(m, { requestedLevel: 'EXHAUSTIVE', level: 'DEEP', notes: [{ code: 'OWNER_MAX_LEVEL', by: 'OWNER', message: '' }] }) : m === 'copilot_deep' ? eff(m, { canRun: false, notes: [{ code: 'COPILOT_DEEP_DISABLED', by: 'ADMIN', message: '' }] }) : eff(m)])),
  spend: { monthSar: 123.45, byModule: { governance: 100 }, unpricedCalls: 2 },
  currency: 'SAR',
  ...over,
})

beforeEach(() => { Object.defineProperty(window, 'localStorage', { value: { getItem: () => 'tok' }, writable: true }) })

describe('AI depth and spending card', () => {
  it('shows spend in SAR, the owner\'s limits, and what each module runs at now', async () => {
    global.fetch = jest.fn(() => ok(view())) as any
    render(<AiPolicySettingsCard />)
    await waitFor(() => expect(screen.getByTestId('aip-spend')).toHaveTextContent('123.45 SAR'))
    expect(screen.getByText('aipolicy.spend.unpriced')).toBeInTheDocument()
    const limits = screen.getByTestId('aip-owner-limits')
    expect(limits).toHaveTextContent('aipolicy.limit.ksa_only')
    expect(limits).toHaveTextContent('aipolicy.limit.no_own_keys')
    expect(limits).toHaveTextContent('Pilot phase')
    expect(screen.getByTestId('aip-effective-governance')).toHaveTextContent('aipolicy.note.OWNER_MAX_LEVEL')
    expect(screen.getByTestId('aip-effective-copilot_deep')).toHaveTextContent('aipolicy.blocked')
    expect(screen.getByLabelText('aipolicy.module.copilot_deep')).toBeDisabled()
    expect(screen.getByText(/aipolicy.block.NOT_KSA_HOSTED/)).toBeInTheDocument()
  })

  it('saves levels, model per level, budgets and mode; empty budgets are sent as no budget', async () => {
    const fetchMock = jest.fn((url: string, init?: any) => ok(view()))
    global.fetch = fetchMock as any
    render(<AiPolicySettingsCard />)
    await waitFor(() => expect(screen.getByLabelText('aipolicy.module.adm')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('aipolicy.module.adm'), { target: { value: 'DEEP' } })
    fireEvent.click(screen.getByLabelText(/aipolicy.deep_enabled/))
    fireEvent.change(screen.getByLabelText('aipolicy.level.DEEP'), { target: { value: 'anthropic:claude-sonnet-5-5' } })
    fireEvent.change(screen.getByLabelText('aipolicy.budget.monthly'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('aipolicy.budget.run'), { target: { value: '25' } })
    fireEvent.click(screen.getByLabelText(/aipolicy.budget.mode.HARD/))
    fireEvent.click(screen.getByText('aipolicy.save'))
    await waitFor(() => expect(screen.getByText('aipolicy.saved')).toBeInTheDocument())
    const body = JSON.parse(fetchMock.mock.calls.find(c => c[1]?.method === 'PUT')![1].body)
    expect(body.levels.adm).toBe('DEEP')
    expect(body.copilotDeepWorkEnabled).toBe(true)
    expect(body.models).toEqual({ QUICK: null, STANDARD: null, DEEP: 'anthropic:claude-sonnet-5-5', EXHAUSTIVE: null })
    expect(body.monthlyBudgetSar).toBeNull()
    expect(body.runCapSar).toBe(25)
    expect(body.budgetMode).toBe('HARD')
  })

  it('refuses a negative or non-numeric budget before sending', async () => {
    const fetchMock = jest.fn(() => ok(view()))
    global.fetch = fetchMock as any
    render(<AiPolicySettingsCard />)
    await waitFor(() => expect(screen.getByLabelText('aipolicy.budget.run')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('aipolicy.budget.run'), { target: { value: 'abc' } })
    fireEvent.click(screen.getByText('aipolicy.save'))
    expect(await screen.findByText('aipolicy.bad_amount')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((c: any) => c[1]?.method === 'PUT')).toBe(false)
  })

  it('helpers: SAR with Latin digits, empty amount = no budget', () => {
    expect(sar(1234.5)).toBe('1,234.5 SAR')
    expect(sar(null)).toBe('-')
    expect(amountOrNull('')).toBeNull()
    expect(amountOrNull('12')).toBe(12)
    expect(Number.isNaN(amountOrNull('-1'))).toBe(true)
  })
})

describe('AI policy strings', () => {
  const has = (k: string) => { const v = AI_POLICY_TRANSLATIONS[k]; return !!v && v.EN.trim().length > 0 && v.AR.trim().length > 0 }
  const arabic = (k: string) => /[؀-ۿ]/.test(AI_POLICY_TRANSLATIONS[k]?.AR || '')
  const files = ['../AiPolicySettingsCard.tsx', '../../owner/AiModelCatalogueCard.tsx', '../../owner/TenantAiPolicyPanel.tsx'].map(f => fs.readFileSync(path.resolve(__dirname, f), 'utf8')).join('\n')

  it('has EN and Arabic text for every static key the screens use', () => {
    const keys = Array.from(new Set(Array.from(files.matchAll(/t\('(aipolicy\.[\w.]+)'\)/g)).map(m => m[1])))
    expect(keys.length).toBeGreaterThan(80)
    expect(keys.filter(k => !has(k))).toEqual([])
    expect(keys.filter(k => !k.startsWith('aipolicy.provider.') && !arabic(k))).toEqual([])
  })

  it('has EN and Arabic text for every dynamic family', () => {
    const keys = [
      ...AI_DEPTH_LEVELS.map(l => `aipolicy.level.${l}`), ...AI_POLICY_MODULES.flatMap(m => [`aipolicy.module.${m}`, `aipolicy.module.${m}.help`]),
      ...NOTE_CODES.map(c => `aipolicy.note.${c}`), ...MODEL_BLOCKS.map(b => `aipolicy.block.${b}`), ...KSA_STATUSES.map(s => `aipolicy.ksa.${s}`),
      ...CATALOGUE_PROVIDERS.map(p => `aipolicy.provider.${p}`), 'aipolicy.budget.mode.SOFT', 'aipolicy.budget.mode.HARD',
    ]
    expect(keys.filter(k => !has(k))).toEqual([])
  })
})
