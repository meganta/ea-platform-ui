import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import AiModelCatalogueCard from '../AiModelCatalogueCard'
import TenantAiPolicyPanel from '../TenantAiPolicyPanel'

jest.mock('../../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: false }) }))
jest.mock('../../../components/HelpTip', () => () => <span>?</span>)
const mockStore: Record<string, jest.Mock> = {}
jest.mock('../ownerApi', () => {
  const actual = jest.requireActual('../ownerApi')
  return { ...actual, ownerApi: new Proxy({}, { get: (_t, k: string) => (mockStore[k] ||= jest.fn()) }) }
})

const models = [
  { id: 'm1', provider: 'anthropic', modelId: 'claude-sonnet-5-5', displayName: 'Claude Sonnet 5.5', vendor: 'Anthropic', deepWorkCapable: true, ksaAvailability: 'UNVERIFIED', inputSarPerMTok: 7.5, outputSarPerMTok: 37.5, isActive: true, gatewaySupported: true },
  { id: 'm2', provider: 'google_vertex', modelId: 'gemini-x', displayName: 'Gemini X', vendor: 'Google', deepWorkCapable: true, ksaAvailability: 'AVAILABLE', inputSarPerMTok: null, outputSarPerMTok: null, isActive: true, gatewaySupported: false },
]
const limits = { allowedProviders: [], allowedModelIds: [], ksaOnly: false, maxLevels: {}, monthlyCeilingSar: null, moduleCeilingsSar: {}, runCeilingSar: null, allowTenantKeys: true, priceMultiplier: 1, note: null }
const ownerView = (over: any = {}) => ({
  settings: {}, ownerLimits: { ...limits, ...over }, levels: [], models: [], unavailableModels: [], mainModel: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
  effective: { governance: { module: 'governance', requestedLevel: 'EXHAUSTIVE', level: 'DEEP', model: null, canRun: true, notes: [{ code: 'OWNER_MAX_LEVEL' }] } },
  spend: { monthSar: 10, byModule: {}, unpricedCalls: 0 },
})

beforeEach(() => { for (const k of Object.keys(mockStore)) delete mockStore[k] })

describe('AI model catalogue (Owner Console)', () => {
  it('lists models with Kingdom hosting, SAR price or none, and providers not connected yet', async () => {
    mockStore.aiModels = jest.fn().mockResolvedValue(models)
    render(<AiModelCatalogueCard />)
    await waitFor(() => expect(screen.getByText('Gemini X')).toBeInTheDocument())
    expect(screen.getByText('aipolicy.ksa.AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('aipolicy.price_unknown')).toBeInTheDocument()
    expect(screen.getByText('aipolicy.cat.not_connected')).toBeInTheDocument()
  })

  it('adds a model with prices in SAR and refuses one without a name', async () => {
    mockStore.aiModels = jest.fn().mockResolvedValue([])
    mockStore.createAiModel = jest.fn().mockResolvedValue({})
    render(<AiModelCatalogueCard />)
    fireEvent.click(await screen.findByText('aipolicy.cat.add'))
    fireEvent.click(screen.getByText('aipolicy.save'))
    expect(await screen.findByText('aipolicy.cat.required')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('aipolicy.cat.provider'), { target: { value: 'aws_bedrock' } })
    fireEvent.change(screen.getByLabelText('aipolicy.cat.model_id'), { target: { value: 'meta.llama-x' } })
    fireEvent.change(screen.getByLabelText('aipolicy.cat.display_name'), { target: { value: 'Llama X' } })
    fireEvent.change(screen.getByLabelText('aipolicy.cat.vendor'), { target: { value: 'Meta' } })
    fireEvent.change(screen.getByLabelText('aipolicy.cat.ksa'), { target: { value: 'AVAILABLE' } })
    fireEvent.change(screen.getByLabelText('aipolicy.cat.input_price'), { target: { value: '2' } })
    fireEvent.click(screen.getByText('aipolicy.save'))
    await waitFor(() => expect(mockStore.createAiModel).toHaveBeenCalled())
    expect(mockStore.createAiModel.mock.calls[0][0]).toMatchObject({ provider: 'aws_bedrock', modelId: 'meta.llama-x', vendor: 'Meta', ksaAvailability: 'AVAILABLE', inputSarPerMTok: 2, outputSarPerMTok: null })
  })
})

describe('Tenant AI policy (Owner Console)', () => {
  it('saves the owner\'s limits for this tenant only and shows what applies now', async () => {
    mockStore.tenantAiPolicy = jest.fn().mockResolvedValue(ownerView())
    mockStore.aiModels = jest.fn().mockResolvedValue(models)
    mockStore.updateTenantAiPolicy = jest.fn().mockResolvedValue(ownerView({ ksaOnly: true }))
    render(<TenantAiPolicyPanel tenantId="t-1" />)
    await waitFor(() => expect(screen.getByTestId('tenant-ai-effect')).toHaveTextContent('aipolicy.note.OWNER_MAX_LEVEL'))
    fireEvent.click(screen.getByLabelText(/aipolicy.owner.ksa_only/))
    fireEvent.click(screen.getByLabelText(/aipolicy.owner.own_keys/))
    fireEvent.click(screen.getByLabelText(/Claude Sonnet 5.5/))
    fireEvent.change(screen.getByLabelText('aipolicy.module.governance'), { target: { value: 'STANDARD' } })
    fireEvent.change(screen.getByLabelText('aipolicy.budget.monthly'), { target: { value: '1000' } })
    fireEvent.click(screen.getByText('aipolicy.owner.save'))
    await waitFor(() => expect(screen.getByText('aipolicy.owner.saved')).toBeInTheDocument())
    const [id, dto] = mockStore.updateTenantAiPolicy.mock.calls[0]
    expect(id).toBe('t-1')
    expect(dto).toMatchObject({ ksaOnly: true, allowTenantKeys: false, allowedModelIds: ['anthropic:claude-sonnet-5-5'], monthlyCeilingSar: 1000, priceMultiplier: 1 })
    expect(dto.maxLevels).toMatchObject({ governance: 'STANDARD', copilot: null })
  })

  it('refuses a price multiplier outside 0-10', async () => {
    mockStore.tenantAiPolicy = jest.fn().mockResolvedValue(ownerView())
    mockStore.aiModels = jest.fn().mockResolvedValue([])
    mockStore.updateTenantAiPolicy = jest.fn()
    render(<TenantAiPolicyPanel tenantId="t-1" />)
    fireEvent.change(await screen.findByLabelText('aipolicy.owner.multiplier'), { target: { value: '0' } })
    fireEvent.click(screen.getByText('aipolicy.owner.save'))
    expect(await screen.findByText('aipolicy.bad_amount')).toBeInTheDocument()
    expect(mockStore.updateTenantAiPolicy).not.toHaveBeenCalled()
  })
})
