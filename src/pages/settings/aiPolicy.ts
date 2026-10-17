// AI policy (depth levels, models, SAR budgets) - shared types and helpers for the tenant card
// (Settings > AI & Copilot) and the Owner Console (model catalogue, per-tenant limits).
// The backend resolves the effective policy; these screens only show it and edit the choices.

export const AI_DEPTH_LEVELS = ['QUICK', 'STANDARD', 'DEEP', 'EXHAUSTIVE'] as const
export type AiDepthLevel = typeof AI_DEPTH_LEVELS[number]
export const AI_POLICY_MODULES = ['copilot', 'copilot_deep', 'governance', 'adm', 'strategy'] as const
export type AiPolicyModule = typeof AI_POLICY_MODULES[number]
export const BUDGET_MODULES = ['copilot', 'governance', 'adm', 'strategy'] as const
export type BudgetModule = typeof BUDGET_MODULES[number]
export const CATALOGUE_PROVIDERS = ['anthropic', 'openai', 'azure_openai', 'google_vertex', 'aws_bedrock'] as const
export const KSA_STATUSES = ['AVAILABLE', 'NOT_AVAILABLE', 'UNVERIFIED'] as const
export const NOTE_CODES = ['OWNER_MAX_LEVEL', 'MODEL_NOT_ALLOWED', 'MODEL_FALLBACK', 'MODEL_NOT_DEEP_CAPABLE', 'NO_ALLOWED_MODEL', 'BUDGET_STEP_DOWN', 'BUDGET_EXHAUSTED', 'OWNER_CEILING_REACHED', 'COPILOT_DEEP_DISABLED', 'PRICE_UNKNOWN'] as const
export const MODEL_BLOCKS = ['INACTIVE', 'PROVIDER_NOT_SUPPORTED', 'PROVIDER_NOT_ALLOWED', 'MODEL_NOT_ALLOWED', 'NOT_KSA_HOSTED', 'NOT_IN_CATALOGUE'] as const

export interface DepthProfile { level: AiDepthLevel; maxSteps: number; maxToolCalls: number; effort: string; maxOutputTokens: number; critiquePasses: number; leadRole: boolean; timeLimitSec: number }

export interface AiPolicySettings {
  levels: Record<AiPolicyModule, AiDepthLevel>
  typeLevels: Partial<Record<AiPolicyModule, Record<string, AiDepthLevel>>>
  copilotDeepWorkEnabled: boolean
  models: Partial<Record<AiDepthLevel, string>>
  monthlyBudgetSar: number | null
  moduleBudgetsSar: Partial<Record<BudgetModule, number>>
  runCapSar: number | null
  budgetMode: 'SOFT' | 'HARD'
}

export interface AiEnforcement {
  allowedProviders: string[]
  allowedModelIds: string[]
  ksaOnly: boolean
  maxLevels: Partial<Record<AiPolicyModule, AiDepthLevel>>
  monthlyCeilingSar: number | null
  moduleCeilingsSar: Partial<Record<BudgetModule, number>>
  runCeilingSar: number | null
  allowTenantKeys: boolean
  priceMultiplier?: number
  note: string | null
  updatedAt?: string | null
}

export interface CatalogueModel {
  id?: string
  key?: string
  provider: string
  modelId: string
  displayName: string
  vendor: string
  contextWindow?: number | null
  maxOutputTokens?: number | null
  deepWorkCapable: boolean
  hostingRegions?: string[]
  ksaAvailability: string
  ksaRegionNote?: string | null
  inputSarPerMTok: number | null
  outputSarPerMTok: number | null
  priceSource?: string | null
  isActive: boolean
  notes?: string | null
  gatewaySupported?: boolean
}

export interface PolicyNote { code: string; by: 'OWNER' | 'ADMIN' | 'BUDGET' | 'CATALOGUE'; message: string }

export interface EffectivePolicy {
  module: AiPolicyModule
  requestedLevel: AiDepthLevel
  level: AiDepthLevel
  profile: DepthProfile
  model: (CatalogueModel & { key: string }) | null
  usesMainModel: boolean
  budget: { mode: 'SOFT' | 'HARD'; monthlyBudgetSar: number | null; moduleBudgetSar: number | null; runCapSar: number | null; monthSpentSar: number; moduleSpentSar: number; remainingSar: number | null; moduleRemainingSar: number | null }
  canRun: boolean
  blockedReason: string | null
  notes: PolicyNote[]
}

export interface AiSpend { monthSar: number; byModule: Partial<Record<BudgetModule | 'other', number>>; unpricedCalls: number }

export interface AiPolicyView {
  settings: AiPolicySettings
  ownerLimits: AiEnforcement
  levels: DepthProfile[]
  models: CatalogueModel[]
  unavailableModels: Array<{ key: string; displayName: string; reason: string }>
  mainModel: { provider: string; model: string } | null
  effective: Record<AiPolicyModule, EffectivePolicy>
  spend: AiSpend
  currency: 'SAR'
}

/** Amounts in SAR with Latin digits in both languages. */
export const sar = (v: number | null | undefined) => (v == null ? '-' : `${v.toLocaleString('en-US', { maximumFractionDigits: 2 })} SAR`)

/** A number field's text -> amount, empty -> null (no budget). */
export const amountOrNull = (text: string): number | null => {
  const s = text.trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : NaN
}

export const modelKey = (m: { provider: string; modelId: string }) => `${m.provider}:${m.modelId}`
