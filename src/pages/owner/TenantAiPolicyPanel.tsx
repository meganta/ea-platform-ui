import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { ownerApi } from './ownerApi'
import { ErrorBox, Loading, Pill, Tile } from './ownerUi'
import {
  AI_DEPTH_LEVELS, AI_POLICY_MODULES, AiDepthLevel, AiEnforcement, AiPolicyView, BUDGET_MODULES, BudgetModule, CATALOGUE_PROVIDERS,
  CatalogueModel, amountOrNull, modelKey, sar,
} from '../settings/aiPolicy'
import { KSA_COLOR } from './AiModelCatalogueCard'

interface Draft {
  allowedProviders: string[]; allowedModelIds: string[]; ksaOnly: boolean; maxLevels: Record<string, AiDepthLevel | ''>
  monthly: string; run: string; modules: Partial<Record<BudgetModule, string>>; allowTenantKeys: boolean; priceMultiplier: string; note: string
}

const text = (v: number | null | undefined) => (v == null ? '' : String(v))
const toDraft = (e: AiEnforcement): Draft => ({
  allowedProviders: e.allowedProviders, allowedModelIds: e.allowedModelIds, ksaOnly: e.ksaOnly,
  maxLevels: Object.fromEntries(AI_POLICY_MODULES.map(m => [m, e.maxLevels[m] || ''])),
  monthly: text(e.monthlyCeilingSar), run: text(e.runCeilingSar), modules: Object.fromEntries(BUDGET_MODULES.map(m => [m, text(e.moduleCeilingsSar[m])])),
  allowTenantKeys: e.allowTenantKeys, priceMultiplier: String(e.priceMultiplier ?? 1), note: e.note || '',
})
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

/**
 * Owner Console > tenant > AI: the owner's limits for this one organization (providers, models,
 * Kingdom hosting, highest depth per module, SAR ceilings, own keys, price multiplier) and what the
 * organization's administrator chose. The stricter of the two always applies; the administrator is
 * told when limits change.
 */
export default function TenantAiPolicyPanel({ tenantId }: { tenantId: string }) {
  const { t } = useLang()
  const [view, setView] = useState<(AiPolicyView & { ownerLimits: AiEnforcement }) | null>(null)
  const [catalogue, setCatalogue] = useState<CatalogueModel[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setError('')
    ownerApi.tenantAiPolicy(tenantId).then((v: any) => { setView(v); setDraft(toDraft(v.ownerLimits)) }).catch((e: any) => setError(e.message))
    ownerApi.aiModels().then(setCatalogue).catch(() => undefined)
  }, [tenantId])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!draft) return
    const monthly = amountOrNull(draft.monthly); const run = amountOrNull(draft.run)
    const modules: Record<string, number | null> = {}
    for (const m of BUDGET_MODULES) modules[m] = amountOrNull(draft.modules[m] || '')
    const mult = Number(draft.priceMultiplier)
    if ([monthly, run, ...Object.values(modules)].some(v => Number.isNaN(v)) || !(mult > 0 && mult <= 10)) { setError(t('aipolicy.bad_amount')); return }
    setBusy(true); setError(''); setSaved(false)
    try {
      const v = await ownerApi.updateTenantAiPolicy(tenantId, {
        allowedProviders: draft.allowedProviders, allowedModelIds: draft.allowedModelIds, ksaOnly: draft.ksaOnly,
        maxLevels: Object.fromEntries(AI_POLICY_MODULES.map(m => [m, draft.maxLevels[m] || null])),
        monthlyCeilingSar: monthly, runCeilingSar: run, moduleCeilingsSar: modules, allowTenantKeys: draft.allowTenantKeys,
        priceMultiplier: mult, note: draft.note.trim() || null,
      })
      setView(v); setDraft(toDraft(v.ownerLimits)); setSaved(true)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  if (error && !view) return <ErrorBox error={error} onRetry={load} />
  if (!view || !draft) return <Loading />

  return (
    <div data-testid="tenant-ai-policy">
      <div className="stat-grid-4" style={{ marginBottom: 14 }}>
        <Tile label={t('aipolicy.spend.month')} value={sar(view.spend.monthSar)} note={view.spend.unpricedCalls ? t('aipolicy.spend.unpriced').replace('{n}', String(view.spend.unpricedCalls)) : undefined} />
        {BUDGET_MODULES.slice(0, 3).map(m => <Tile key={m} label={t(`aipolicy.module.${m}`)} value={sar(view.spend.byModule[m] ?? 0)} />)}
      </div>
      {error && <ErrorBox error={error} />}
      {saved && <div className="alert alert-info" role="status">{t('aipolicy.owner.saved')}</div>}

      <div className="oc-card">
        <h3 style={{ display: 'flex', alignItems: 'center' }}>{t('aipolicy.owner.title')}<HelpTip text={t('aipolicy.owner.help')} /></h3>
        <div className="oc-section-title">{t('aipolicy.owner.providers')}</div>
        <div className="aip-checks">
          {CATALOGUE_PROVIDERS.map(p => (
            <label key={p} className="aip-check" htmlFor={`own-prov-${p}`}><input id={`own-prov-${p}`} type="checkbox" checked={draft.allowedProviders.includes(p)} onChange={() => setDraft({ ...draft, allowedProviders: toggle(draft.allowedProviders, p) })} /> {t(`aipolicy.provider.${p}`)}</label>
          ))}
        </div>
        <div className="oc-muted">{t('aipolicy.owner.none_all')}</div>

        <div className="oc-section-title" style={{ marginTop: 14 }}>{t('aipolicy.owner.models')}</div>
        <div className="aip-checks">
          {catalogue.filter(m => m.isActive).map(m => {
            const k = modelKey(m)
            return (
              <label key={k} className="aip-check" htmlFor={`own-model-${k}`}>
                <input id={`own-model-${k}`} type="checkbox" checked={draft.allowedModelIds.includes(k)} onChange={() => setDraft({ ...draft, allowedModelIds: toggle(draft.allowedModelIds, k) })} />
                {' '}{m.displayName} <Pill text={t(`aipolicy.ksa.${m.ksaAvailability}`)} color={KSA_COLOR[m.ksaAvailability] || 'var(--text-dim)'} />
              </label>
            )
          })}
        </div>
        <div className="oc-muted">{t('aipolicy.owner.none_all')}</div>
        <label className="aip-check" htmlFor="own-ksa" style={{ display: 'block', marginTop: 10 }}><input id="own-ksa" type="checkbox" checked={draft.ksaOnly} onChange={e => setDraft({ ...draft, ksaOnly: e.target.checked })} /> {t('aipolicy.owner.ksa_only')}</label>
        <label className="aip-check" htmlFor="own-keys" style={{ display: 'block' }}><input id="own-keys" type="checkbox" checked={draft.allowTenantKeys} onChange={e => setDraft({ ...draft, allowTenantKeys: e.target.checked })} /> {t('aipolicy.owner.own_keys')}</label>

        <div className="oc-section-title" style={{ marginTop: 14 }}>{t('aipolicy.owner.max_levels')}</div>
        <div className="aip-grid">
          {AI_POLICY_MODULES.map(m => (
            <div key={m} className="form-group">
              <label className="form-label" htmlFor={`own-max-${m}`}>{t(`aipolicy.module.${m}`)}</label>
              <select id={`own-max-${m}`} className="form-input" value={draft.maxLevels[m] || ''} onChange={e => setDraft({ ...draft, maxLevels: { ...draft.maxLevels, [m]: e.target.value as AiDepthLevel | '' } })}>
                <option value="">{t('aipolicy.no_limit')}</option>
                {AI_DEPTH_LEVELS.map(l => <option key={l} value={l}>{t(`aipolicy.level.${l}`)}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div className="oc-section-title" style={{ marginTop: 14 }}>{t('aipolicy.owner.ceilings')}</div>
        <div className="aip-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="own-monthly">{t('aipolicy.budget.monthly')}</label>
            <input id="own-monthly" className="form-input" inputMode="decimal" placeholder={t('aipolicy.no_limit')} value={draft.monthly} onChange={e => setDraft({ ...draft, monthly: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="own-run">{t('aipolicy.budget.run')}</label>
            <input id="own-run" className="form-input" inputMode="decimal" placeholder={t('aipolicy.no_limit')} value={draft.run} onChange={e => setDraft({ ...draft, run: e.target.value })} />
          </div>
          {BUDGET_MODULES.map(m => (
            <div key={m} className="form-group">
              <label className="form-label" htmlFor={`own-ceil-${m}`}>{t('aipolicy.budget.module').replace('{module}', t(`aipolicy.module.${m}`))}</label>
              <input id={`own-ceil-${m}`} className="form-input" inputMode="decimal" placeholder={t('aipolicy.no_limit')} value={draft.modules[m] || ''} onChange={e => setDraft({ ...draft, modules: { ...draft.modules, [m]: e.target.value } })} />
            </div>
          ))}
          <div className="form-group">
            <label className="form-label" htmlFor="own-mult">{t('aipolicy.owner.multiplier')}</label>
            <input id="own-mult" className="form-input" inputMode="decimal" value={draft.priceMultiplier} onChange={e => setDraft({ ...draft, priceMultiplier: e.target.value })} />
            <div className="oc-muted">{t('aipolicy.owner.multiplier_help')}</div>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="own-note">{t('aipolicy.owner.note')}</label>
          <textarea id="own-note" className="form-input" rows={2} value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })} />
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{t('aipolicy.owner.save')}</button>
      </div>

      <div className="oc-section">
        <div className="oc-section-title">{t('aipolicy.owner.effect')}<HelpTip text={t('aipolicy.owner.effect_help')} /></div>
        <div className="oc-table-wrap">
          <table className="oc-table" data-testid="tenant-ai-effect">
            <thead><tr><th>{t('aipolicy.col.module')}</th><th>{t('aipolicy.col.admin_choice')}</th><th>{t('aipolicy.col.applies')}</th><th>{t('aipolicy.col.model')}</th><th>{t('aipolicy.col.notes')}</th></tr></thead>
            <tbody>
              {AI_POLICY_MODULES.map(m => {
                const e = view.effective[m]
                if (!e) return null
                return (
                  <tr key={m}>
                    <td>{t(`aipolicy.module.${m}`)}</td>
                    <td>{t(`aipolicy.level.${e.requestedLevel}`)}</td>
                    <td>{e.canRun ? t(`aipolicy.level.${e.level}`) : <Pill text={t('aipolicy.blocked')} color="var(--danger)" />}</td>
                    <td>{e.model ? e.model.displayName : `${t('aipolicy.main_model')}${view.mainModel ? ` (${view.mainModel.model})` : ''}`}</td>
                    <td>{e.notes.map(n => <div key={n.code}>{t(`aipolicy.note.${n.code}`)}</div>)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
