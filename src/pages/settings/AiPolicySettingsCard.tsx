import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { SETTINGS_API_URL } from './shared'
import {
  AI_DEPTH_LEVELS, AI_POLICY_MODULES, AiDepthLevel, AiPolicyModule, AiPolicySettings, AiPolicyView, BUDGET_MODULES, BudgetModule,
  CatalogueModel, EffectivePolicy, amountOrNull, sar,
} from './aiPolicy'

async function call(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SETTINGS_API_URL}${path}`, { ...init, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' } })
  const body = await r.json().catch(() => null)
  if (!r.ok) throw new Error(body?.message ? (Array.isArray(body.message) ? body.message.join(', ') : body.message) : `HTTP ${r.status}`)
  return body
}

const levelAbove = (a: AiDepthLevel, max?: AiDepthLevel) => !!max && AI_DEPTH_LEVELS.indexOf(a) > AI_DEPTH_LEVELS.indexOf(max)
const amountText = (v: number | null | undefined) => (v == null ? '' : String(v))

/** One model's label: name, Kingdom hosting, SAR price per million tokens. */
export function ModelLabel({ m }: { m: CatalogueModel }) {
  const { t } = useLang()
  return (
    <span>
      {m.displayName}
      {m.ksaAvailability === 'AVAILABLE' && <span className="badge badge-active" style={{ marginInlineStart: 6 }} data-testid="ksa-badge">{t('aipolicy.ksa.AVAILABLE')}</span>}
    </span>
  )
}

const modelOptionText = (m: CatalogueModel, t: (k: string) => string) => {
  const ksa = m.ksaAvailability === 'AVAILABLE' ? ` · ${t('aipolicy.ksa.AVAILABLE')}` : ''
  const price = m.inputSarPerMTok != null && m.outputSarPerMTok != null
    ? ` · ${t('aipolicy.price').replace('{in}', String(m.inputSarPerMTok)).replace('{out}', String(m.outputSarPerMTok))}`
    : ` · ${t('aipolicy.price_unknown')}`
  return `${m.displayName} (${m.vendor})${ksa}${price}`
}

/** What the platform will actually do for one module right now. */
function EffectiveLine({ e }: { e: EffectivePolicy }) {
  const { t } = useLang()
  const model = e.model ? e.model.displayName : t('aipolicy.main_model')
  return (
    <div className="aip-effective" data-testid={`aip-effective-${e.module}`}>
      {e.canRun
        ? t('aipolicy.effective').replace('{level}', t(`aipolicy.level.${e.level}`)).replace('{model}', model)
        : <span style={{ color: 'var(--danger)' }}>{t('aipolicy.blocked')}</span>}
      {e.notes.map(n => <div key={n.code} className="aip-note">• {t(`aipolicy.note.${n.code}`)}</div>)}
    </div>
  )
}

/**
 * Settings > AI & Copilot: how deeply AI works in each module, which model each depth uses,
 * and how much the organization spends (SAR). The administrator decides; people using the
 * modules never choose a level. The platform owner's limits for this organization always win.
 */
export default function AiPolicySettingsCard() {
  const { t, isAR } = useLang()
  const [view, setView] = useState<AiPolicyView | null>(null)
  const [draft, setDraft] = useState<AiPolicySettings | null>(null)
  const [budgetText, setBudgetText] = useState<{ monthly: string; run: string; modules: Partial<Record<BudgetModule, string>> }>({ monthly: '', run: '', modules: {} })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = (v: AiPolicyView) => {
    setView(v); setDraft(v.settings)
    setBudgetText({
      monthly: amountText(v.settings.monthlyBudgetSar), run: amountText(v.settings.runCapSar),
      modules: Object.fromEntries(BUDGET_MODULES.map(m => [m, amountText(v.settings.moduleBudgetsSar?.[m])])),
    })
  }

  useEffect(() => { call('/config/ai-policy').then(load).catch(e => setMsg({ ok: false, text: e.message })) }, [])

  const save = async () => {
    if (!draft) return
    const monthly = amountOrNull(budgetText.monthly)
    const run = amountOrNull(budgetText.run)
    const modules: Record<string, number | null> = {}
    for (const m of BUDGET_MODULES) modules[m] = amountOrNull(budgetText.modules[m] || '')
    if ([monthly, run, ...Object.values(modules)].some(v => Number.isNaN(v))) { setMsg({ ok: false, text: t('aipolicy.bad_amount') }); return }
    setSaving(true); setMsg(null)
    try {
      const saved: AiPolicyView = await call('/config/ai-policy', {
        method: 'PUT',
        body: JSON.stringify({
          levels: draft.levels, copilotDeepWorkEnabled: draft.copilotDeepWorkEnabled,
          models: Object.fromEntries(AI_DEPTH_LEVELS.map(l => [l, draft.models[l] || null])),
          monthlyBudgetSar: monthly, runCapSar: run, moduleBudgetsSar: modules, budgetMode: draft.budgetMode,
        }),
      })
      load(saved)
      setMsg({ ok: true, text: t('aipolicy.saved') })
    } catch (e: any) { setMsg({ ok: false, text: e.message }) }
    finally { setSaving(false) }
  }

  const limits = view?.ownerLimits
  const limitLines: string[] = []
  if (limits) {
    if (limits.ksaOnly) limitLines.push(t('aipolicy.limit.ksa_only'))
    if (limits.allowedProviders.length) limitLines.push(t('aipolicy.limit.providers').replace('{list}', limits.allowedProviders.join(', ')))
    if (limits.allowedModelIds.length) limitLines.push(t('aipolicy.limit.models').replace('{n}', String(limits.allowedModelIds.length)))
    for (const m of AI_POLICY_MODULES) if (limits.maxLevels[m]) limitLines.push(t('aipolicy.limit.max_level').replace('{module}', t(`aipolicy.module.${m}`)).replace('{level}', t(`aipolicy.level.${limits.maxLevels[m]}`)))
    if (limits.monthlyCeilingSar != null) limitLines.push(t('aipolicy.limit.monthly').replace('{amount}', sar(limits.monthlyCeilingSar)))
    for (const m of BUDGET_MODULES) if (limits.moduleCeilingsSar[m] != null) limitLines.push(t('aipolicy.limit.module').replace('{module}', t(`aipolicy.module.${m}`)).replace('{amount}', sar(limits.moduleCeilingsSar[m])))
    if (limits.runCeilingSar != null) limitLines.push(t('aipolicy.limit.run').replace('{amount}', sar(limits.runCeilingSar)))
    if (!limits.allowTenantKeys) limitLines.push(t('aipolicy.limit.no_own_keys'))
  }

  return (
    <div className="card" style={{ marginTop: 16 }} dir={isAR ? 'rtl' : 'ltr'} data-testid="ai-policy-settings">
      <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>🧭 {t('aipolicy.title')}<HelpTip text={t('aipolicy.help')} /></div>
      {msg && <div role="status" className={msg.ok ? 'alert alert-info' : 'alert'} style={{ marginBottom: 12, color: msg.ok ? undefined : 'var(--danger)' }}>{msg.text}</div>}
      {!view || !draft ? <div className="spinner" /> : (
        <>
          <div className="stat-grid-5" style={{ marginBottom: 12 }} data-testid="aip-spend">
            <div className="stat-card"><div className="stat-label">{t('aipolicy.spend.month')}</div><div className="stat-value" style={{ fontSize: 18 }}>{sar(view.spend.monthSar)}</div></div>
            {BUDGET_MODULES.map(m => (
              <div key={m} className="stat-card"><div className="stat-label">{t(`aipolicy.module.${m}`)}</div><div className="stat-value" style={{ fontSize: 18 }}>{sar(view.spend.byModule[m] ?? 0)}</div></div>
            ))}
          </div>
          {view.spend.unpricedCalls > 0 && <div className="form-hint" style={{ fontSize: 12, marginBottom: 8 }}>{t('aipolicy.spend.unpriced').replace('{n}', String(view.spend.unpricedCalls))}</div>}

          {limitLines.length > 0 && (
            <div className="alert alert-info" style={{ marginBottom: 12 }} data-testid="aip-owner-limits">
              <strong>{t('aipolicy.limits_title')}</strong>
              {limitLines.map(l => <div key={l}>🔒 {l}</div>)}
              {limits?.note && <div style={{ marginTop: 4, fontStyle: 'italic' }}>{limits.note}</div>}
            </div>
          )}

          <h4 className="aip-h">{t('aipolicy.levels_title')}<HelpTip text={t('aipolicy.levels_help')} /></h4>
          <div className="aip-grid">
            {AI_POLICY_MODULES.map((m: AiPolicyModule) => (
              <div key={m} className="form-group aip-module">
                <label className="form-label" htmlFor={`aip-level-${m}`}>{t(`aipolicy.module.${m}`)}</label>
                {m === 'copilot_deep' && (
                  <label className="aip-check" htmlFor="aip-deep-enabled">
                    <input id="aip-deep-enabled" type="checkbox" checked={draft.copilotDeepWorkEnabled} onChange={e => setDraft({ ...draft, copilotDeepWorkEnabled: e.target.checked })} />
                    {' '}{t('aipolicy.deep_enabled')}
                  </label>
                )}
                <select id={`aip-level-${m}`} className="form-input" value={draft.levels[m]} disabled={m === 'copilot_deep' && !draft.copilotDeepWorkEnabled}
                  onChange={e => setDraft({ ...draft, levels: { ...draft.levels, [m]: e.target.value as AiDepthLevel } })}>
                  {AI_DEPTH_LEVELS.map(l => (
                    <option key={l} value={l}>{t(`aipolicy.level.${l}`)}{levelAbove(l, limits?.maxLevels[m]) ? ` - ${t('aipolicy.above_limit')}` : ''}</option>
                  ))}
                </select>
                <div className="form-hint" style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>{t(`aipolicy.module.${m}.help`)}</div>
                {view.effective[m] && <EffectiveLine e={view.effective[m]} />}
              </div>
            ))}
          </div>

          <details className="aip-details">
            <summary>{t('aipolicy.levels_compare')}</summary>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" data-testid="aip-levels-table">
                <thead><tr><th>{t('aipolicy.col.level')}</th><th>{t('aipolicy.col.steps')}</th><th>{t('aipolicy.col.lookups')}</th><th>{t('aipolicy.col.checks')}</th><th>{t('aipolicy.col.lead')}</th><th>{t('aipolicy.col.time')}</th></tr></thead>
                <tbody>
                  {view.levels.map(p => (
                    <tr key={p.level}><td>{t(`aipolicy.level.${p.level}`)}</td><td>{p.maxSteps}</td><td>{p.maxToolCalls}</td><td>{p.critiquePasses}</td><td>{p.leadRole ? '✓' : '-'}</td><td>{Math.round(p.timeLimitSec / 60)} {t('aipolicy.minutes')}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <h4 className="aip-h">{t('aipolicy.models_title')}<HelpTip text={t('aipolicy.models_help')} /></h4>
          <div className="aip-grid">
            {AI_DEPTH_LEVELS.map(l => (
              <div key={l} className="form-group">
                <label className="form-label" htmlFor={`aip-model-${l}`}>{t(`aipolicy.level.${l}`)}</label>
                <select id={`aip-model-${l}`} className="form-input" value={draft.models[l] || ''} onChange={e => setDraft({ ...draft, models: { ...draft.models, [l]: e.target.value || undefined } })}>
                  <option value="">{t('aipolicy.main_model')}{view.mainModel ? ` (${view.mainModel.model})` : ''}</option>
                  {view.models.map(m => <option key={m.key} value={m.key}>{modelOptionText(m, t)}</option>)}
                </select>
              </div>
            ))}
          </div>
          {view.unavailableModels.length > 0 && (
            <details className="aip-details">
              <summary>{t('aipolicy.unavailable').replace('{n}', String(view.unavailableModels.length))}</summary>
              <ul style={{ margin: '6px 0', paddingInlineStart: 18, fontSize: 12.5 }}>
                {view.unavailableModels.map(u => <li key={u.key}>{u.displayName} - {t(`aipolicy.block.${u.reason}`)}</li>)}
              </ul>
            </details>
          )}

          <h4 className="aip-h">{t('aipolicy.budget_title')}<HelpTip text={t('aipolicy.budget_help')} /></h4>
          <div className="aip-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="aip-budget-month">{t('aipolicy.budget.monthly')}</label>
              <input id="aip-budget-month" className="form-input" inputMode="decimal" value={budgetText.monthly} placeholder={t('aipolicy.no_limit')} onChange={e => setBudgetText({ ...budgetText, monthly: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aip-budget-run">{t('aipolicy.budget.run')}</label>
              <input id="aip-budget-run" className="form-input" inputMode="decimal" value={budgetText.run} placeholder={t('aipolicy.no_limit')} onChange={e => setBudgetText({ ...budgetText, run: e.target.value })} />
            </div>
            {BUDGET_MODULES.map(m => (
              <div key={m} className="form-group">
                <label className="form-label" htmlFor={`aip-budget-${m}`}>{t('aipolicy.budget.module').replace('{module}', t(`aipolicy.module.${m}`))}</label>
                <input id={`aip-budget-${m}`} className="form-input" inputMode="decimal" value={budgetText.modules[m] || ''} placeholder={t('aipolicy.no_limit')} onChange={e => setBudgetText({ ...budgetText, modules: { ...budgetText.modules, [m]: e.target.value } })} />
              </div>
            ))}
          </div>
          <fieldset className="form-group" style={{ border: 'none', padding: 0 }}>
            <legend className="form-label">{t('aipolicy.budget.mode')}</legend>
            {(['SOFT', 'HARD'] as const).map(mode => (
              <label key={mode} className="aip-check" htmlFor={`aip-mode-${mode}`} style={{ display: 'block' }}>
                <input id={`aip-mode-${mode}`} type="radio" name="aip-mode" checked={draft.budgetMode === mode} onChange={() => setDraft({ ...draft, budgetMode: mode })} />
                {' '}{t(`aipolicy.budget.mode.${mode}`)}
              </label>
            ))}
          </fieldset>
          <button type="button" className="btn btn-primary mt-4" disabled={saving} onClick={save}>{saving ? t('aipolicy.saving') : t('aipolicy.save')}</button>
        </>
      )}
    </div>
  )
}
