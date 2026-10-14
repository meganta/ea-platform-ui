import * as fs from 'fs'
import * as path from 'path'
import { FINVALUE_TRANSLATIONS } from '../finValueStrings'
import { ACTIONS, BASES, BENEFITS, COST_CATEGORIES, ENGINES, EVIDENCE_KINDS, ONE_TIME_CATEGORIES, STATUSES } from '../fvApi'
import { ALT_COSTS, ALT_GATES, ALT_SCORES, PRICE_BASES, REVIEW_STATUSES } from '../OpportunityExtras'
import { AGENT_CODES, AGENT_FIGURES, OBSERVATION_ACTORS } from '../IntelligencePanels'
import { ENVIRONMENTS, INFRA_METRICS, INGEST_SOURCES, PROCESS_METRICS, REDUNDANCY_ROLES, USAGE_KINDS } from '../UsagePanel'

const DIR = path.resolve(__dirname, '..')
const sources = [path.resolve(DIR, '../FinancialValuePage.tsx'), ...fs.readdirSync(DIR).filter(f => f.endsWith('.tsx')).map(f => path.join(DIR, f))].map(f => fs.readFileSync(f, 'utf8')).join('\n')
const has = (k: string) => {
  const v = FINVALUE_TRANSLATIONS[k]
  return !!v && v.EN.trim().length > 0 && v.AR.trim().length > 0 && /[؀-ۿ]/.test(v.AR)
}

describe('Financial Value strings', () => {
  it('has EN and Arabic text for every static key the screens use', () => {
    const keys = Array.from(new Set(Array.from(sources.matchAll(/t\('(fv\.[\w.]+)'\)/g)).map(m => m[1]).concat(['fv.notes.1', 'fv.notes.2', 'fv.notes.3', 'fv.notes.4', 'nav.finvalue'])))
    expect(keys.length).toBeGreaterThan(200)
    expect(keys.filter(k => !has(k))).toEqual([])
  })

  it('has EN and Arabic text for every value of every dynamic family', () => {
    const families: Record<string, string[]> = {
      'fv.status.': STATUSES, 'fv.engine.': ENGINES, 'fv.action.': ACTIONS, 'fv.benefit.': BENEFITS, 'fv.cost.': COST_CATEGORIES, 'fv.basis.': [...BASES, 'AI_SUGGESTED'],
      'fv.onetime.': ONE_TIME_CATEGORIES, 'fv.evkind.': EVIDENCE_KINDS, 'fv.act.': ['REQUEST_EVIDENCE', 'VALIDATE', 'PREPARE_BUSINESS_CASE', 'APPROVE', 'PLAN', 'START_EXECUTION', 'MARK_IMPLEMENTED', 'REJECT', 'DEFER', 'CANCEL', 'REOPEN', 'CLOSE_WITHOUT_SAVINGS'],
      'fv.confidence.': ['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'], 'fv.class.': ['QUICK_WIN', 'STRATEGIC', 'MAJOR_PROJECT', 'STANDARD', 'NOT_ELIGIBLE', 'NON_FINANCIAL'],
      'fv.stage.': ['POTENTIAL', 'VALIDATED', 'APPROVED', 'IMPLEMENTED', 'POTENTIAL.help', 'VALIDATED.help', 'APPROVED.help', 'IMPLEMENTED.help'],
      'fv.source.': ['ARCHITECTURE_HEALTH', 'REPOSITORY', 'LICENSE_DATA', 'CONTRACT_DATA', 'GOVERNANCE_FINDING', 'TECHNOLOGY_RESEARCH', 'MANUAL', 'COPILOT'],
      'fv.reqcode.': ['BASELINE_COST', 'COST_CLAIMS', 'CONTRACT_TERMS', 'LICENSE_UTILIZATION', 'LICENSE_UNIT_COST', 'IMPLEMENTATION_COST', 'AVOIDED_BASELINE', 'ARCHITECTURE_FEASIBILITY', 'BUSINESS_CONFIRMATION'],
      'fv.reqstatus.': ['OPEN', 'SUBMITTED', 'VALIDATED', 'REJECTED', 'CANCELLED'], 'fv.data.': ['SUBMITTED', 'VALIDATED', 'REJECTED', 'SUPERSEDED', 'costs', 'contracts', 'licenses', 'costs.help', 'contracts.help', 'licenses.help', 'add.costs', 'add.contracts', 'add.licenses'],
      'fv.feas.': ['architecture', 'business', 'security', 'finance'], 'fv.feasstatus.': ['NOT_ASSESSED', 'FEASIBLE', 'CONDITIONAL', 'NOT_FEASIBLE', 'CONFIRMED', 'NOT_CONFIRMED'],
      'fv.gate.': ['QUANTIFIED', 'ARCHITECTURE_NOT_REJECTED', 'SECURITY_NOT_BLOCKED', 'BUSINESS_CONTINUITY'],
      'fv.crit.': ['FINANCIAL_BENEFIT', 'FINANCIAL_CONFIDENCE', 'IMPLEMENTATION_COST', 'IMPLEMENTATION_COMPLEXITY', 'TECHNICAL_FEASIBILITY', 'BUSINESS_IMPACT', 'SECURITY_COMPLIANCE', 'TIME_TO_REALIZE', 'DEPENDENCY_COMPLEXITY', 'STRATEGIC_ALIGNMENT', 'ARCHITECTURE_ALIGNMENT'],
      'fv.sim.': ['CONSERVATIVE', 'EXPECTED', 'OPTIMISTIC', 'var.REDUCTION', 'var.ONE_TIME_COST', 'var.DELAY'], 'fv.realstatus.': ['SUBMITTED', 'VERIFIED', 'REJECTED'],
      'fv.research.status.': ['RUNNING', 'COMPLETED', 'FAILED', 'NOT_CONFIGURED'], 'fv.run.': ['RUNNING', 'COMPLETED', 'FAILED'], 'fv.milestone.': ['TARGET_IMPLEMENTATION', 'SAVINGS_START'],
      'fv.view.': ['EXECUTIVE', 'ARCHITECTURE', 'FINANCE'], 'fv.tab.': ['overview', 'opportunities', 'agents', 'scenarios', 'data', 'usage', 'requests', 'verification', 'settings'], 'fv.ws.': ['summary', 'financials', 'alternatives', 'evidence', 'decisions', 'execution', 'history'],
      'fv.live.': ['findingStatus', 'validationStatus', 'reviewStatus', 'reviewDecision', 'researchStatus', 'lifecycleStatus'],
      'fv.alt.cost.': [...ALT_COSTS], 'fv.alt.gate.': [...ALT_GATES], 'fv.alt.score.': [...ALT_SCORES], 'fv.pbasis.': [...PRICE_BASES], 'fv.alt.elig.': ['ELIGIBLE', 'EXCLUDED', 'UNVERIFIED'],
      'fv.comp.status.': [...REVIEW_STATUSES], 'fv.agent.': [...AGENT_CODES, ...AGENT_CODES.map(c => `${c}.help`)], 'fv.agents.actor.': [...OBSERVATION_ACTORS], 'fv.agents.sev.': ['HIGH', 'MEDIUM', 'LOW'], 'fv.agents.fig.': [...AGENT_FIGURES],
      'fv.bench.m.': ['realizationRatePct', 'licenseUtilizationPct', 'approvedSavingsShareOfRunCostPct', 'medianPaybackMonths', 'costCoveragePct'],
      'fv.usage.kind.': [...USAGE_KINDS], 'fv.usage.env.': [...ENVIRONMENTS, 'QA'], 'fv.usage.role.': [...REDUNDANCY_ROLES, 'SECONDARY'], 'fv.usage.m.': [...INFRA_METRICS, ...PROCESS_METRICS, 'alwaysOn', 'automationCandidate'],
      'fv.usage.src.': ['MANUAL', ...INGEST_SOURCES], 'fv.ingest.status.': ['CREATED', 'UPDATED', 'UNCHANGED', 'REJECTED'], 'fv.ingest.rule.': ['1', '2', '3', '4'],
      'fv.set.': ['infraIdleDays', 'cpuAvgThresholdPct', 'cpuPeakThresholdPct', 'memPeakThresholdPct', 'targetPeakUtilizationPct', 'nonProdHoursPerWeek', 'processMinHoursPerYear'],
      'fv.answer.': ['category', 'annualAmount', 'currency', 'basis', 'description', 'label', 'amount', 'year'],
    }
    const missing = Object.entries(families).flatMap(([prefix, values]) => values.map(v => prefix + v)).filter(k => !has(k))
    expect(missing).toEqual([])
  })
})
