import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { ownerApi } from './ownerApi'
import { ErrorBox, Loading, Pill } from './ownerUi'
import { CATALOGUE_PROVIDERS, CatalogueModel, KSA_STATUSES, amountOrNull } from '../settings/aiPolicy'

export const KSA_COLOR: Record<string, string> = { AVAILABLE: 'var(--success)', NOT_AVAILABLE: 'var(--text-dim)', UNVERIFIED: 'var(--warning)' }

interface Form {
  id?: string
  provider: string; modelId: string; displayName: string; vendor: string
  contextWindow: string; maxOutputTokens: string
  deepWorkCapable: boolean; ksaAvailability: string; ksaRegionNote: string; hostingRegions: string
  inputSarPerMTok: string; outputSarPerMTok: string; priceSource: string
  isActive: boolean; notes: string
}

const EMPTY: Form = {
  provider: 'anthropic', modelId: '', displayName: '', vendor: '', contextWindow: '', maxOutputTokens: '', deepWorkCapable: false,
  ksaAvailability: 'UNVERIFIED', ksaRegionNote: '', hostingRegions: '', inputSarPerMTok: '', outputSarPerMTok: '', priceSource: '', isActive: true, notes: '',
}

const str = (v: number | null | undefined) => (v == null ? '' : String(v))
const toForm = (m: CatalogueModel): Form => ({
  id: m.id, provider: m.provider, modelId: m.modelId, displayName: m.displayName, vendor: m.vendor,
  contextWindow: str(m.contextWindow), maxOutputTokens: str(m.maxOutputTokens), deepWorkCapable: m.deepWorkCapable,
  ksaAvailability: m.ksaAvailability, ksaRegionNote: m.ksaRegionNote || '', hostingRegions: (m.hostingRegions || []).join(', '),
  inputSarPerMTok: str(m.inputSarPerMTok), outputSarPerMTok: str(m.outputSarPerMTok), priceSource: m.priceSource || '', isActive: m.isActive, notes: m.notes || '',
})

/**
 * Owner Console > Settings: the AI models organizations may be offered, with SAR prices and
 * whether each is hosted in the Kingdom. Prices are entered by the owner from published price
 * lists; a model without a price is never guessed (its spend shows as unknown).
 */
export default function AiModelCatalogueCard() {
  const { t } = useLang()
  const [models, setModels] = useState<CatalogueModel[] | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => { ownerApi.aiModels().then(setModels).catch((e: any) => setError(e.message)) }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!form) return
    const num = (s: string) => amountOrNull(s)
    const nums = [num(form.inputSarPerMTok), num(form.outputSarPerMTok), num(form.contextWindow), num(form.maxOutputTokens)]
    if (nums.some(v => Number.isNaN(v))) { setError(t('aipolicy.bad_amount')); return }
    if (!form.modelId.trim() || !form.displayName.trim() || !form.vendor.trim()) { setError(t('aipolicy.cat.required')); return }
    setBusy(true); setError('')
    const dto = {
      provider: form.provider, modelId: form.modelId.trim(), displayName: form.displayName.trim(), vendor: form.vendor.trim(),
      contextWindow: nums[2], maxOutputTokens: nums[3], deepWorkCapable: form.deepWorkCapable, ksaAvailability: form.ksaAvailability,
      ksaRegionNote: form.ksaRegionNote.trim() || null, hostingRegions: form.hostingRegions.split(/[,;]+/).map(s => s.trim()).filter(Boolean),
      inputSarPerMTok: nums[0], outputSarPerMTok: nums[1], priceSource: form.priceSource.trim() || null, isActive: form.isActive, notes: form.notes.trim() || null,
    }
    try {
      if (form.id) await ownerApi.updateAiModel(form.id, dto)
      else await ownerApi.createAiModel(dto)
      setForm(null); load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const field = (key: keyof Form, label: string, extra: { type?: string; placeholder?: string } = {}) => (
    <div className="form-group">
      <label className="form-label" htmlFor={`cat-${key}`}>{label}</label>
      <input id={`cat-${key}`} className="form-input" type={extra.type || 'text'} placeholder={extra.placeholder} value={String(form![key] ?? '')} onChange={e => setForm({ ...form!, [key]: e.target.value })} />
    </div>
  )

  return (
    <div className="oc-card" data-testid="ai-model-catalogue">
      <h3 style={{ display: 'flex', alignItems: 'center' }}>{t('aipolicy.cat.title')}<HelpTip text={t('aipolicy.cat.help')} /></h3>
      {error && <ErrorBox error={error} />}
      {!models && !error && <Loading />}
      {models && (
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead><tr>
              <th>{t('aipolicy.cat.model')}</th><th>{t('aipolicy.cat.ksa')}</th><th>{t('aipolicy.cat.price')}</th><th>{t('aipolicy.cat.deep')}</th><th>{t('aipolicy.cat.status')}</th><th />
            </tr></thead>
            <tbody>
              {models.map(m => (
                <tr key={m.id || `${m.provider}:${m.modelId}`}>
                  <td><strong>{m.displayName}</strong><div className="oc-muted">{m.vendor} · {m.provider}:{m.modelId}</div></td>
                  <td><Pill text={t(`aipolicy.ksa.${m.ksaAvailability}`)} color={KSA_COLOR[m.ksaAvailability] || 'var(--text-dim)'} />{m.ksaRegionNote && <div className="oc-muted">{m.ksaRegionNote}</div>}</td>
                  <td>{m.inputSarPerMTok != null && m.outputSarPerMTok != null ? t('aipolicy.price').replace('{in}', String(m.inputSarPerMTok)).replace('{out}', String(m.outputSarPerMTok)) : <span className="oc-muted">{t('aipolicy.price_unknown')}</span>}</td>
                  <td>{m.deepWorkCapable ? '✓' : '-'}</td>
                  <td>
                    {!m.isActive ? <Pill text={t('aipolicy.cat.inactive')} color="var(--text-dim)" />
                      : m.gatewaySupported === false ? <Pill text={t('aipolicy.cat.not_connected')} color="var(--warning)" />
                        : m.providerConfigured === false ? <><Pill text={t('aipolicy.cat.not_configured')} color="var(--warning)" />{m.providerNote && <div className="oc-muted" data-testid="cat-provider-note">{m.providerNote}</div>}</>
                          : <Pill text={t('aipolicy.cat.active')} color="var(--success)" />}
                  </td>
                  <td><button type="button" className="btn btn-sm btn-secondary" onClick={() => setForm(toForm(m))}>{t('aipolicy.cat.edit')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!form && <button type="button" className="btn btn-secondary mt-4" onClick={() => setForm({ ...EMPTY })}>{t('aipolicy.cat.add')}</button>}
      {form && (
        <div className="oc-section" data-testid="ai-model-form">
          <div className="aip-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="cat-provider">{t('aipolicy.cat.provider')}</label>
              <select id="cat-provider" className="form-input" value={form.provider} disabled={!!form.id} onChange={e => setForm({ ...form, provider: e.target.value })}>
                {CATALOGUE_PROVIDERS.map(p => <option key={p} value={p}>{t(`aipolicy.provider.${p}`)}</option>)}
              </select>
            </div>
            {field('modelId', t('aipolicy.cat.model_id'), { placeholder: 'claude-sonnet-5-5' })}
            {field('displayName', t('aipolicy.cat.display_name'))}
            {field('vendor', t('aipolicy.cat.vendor'))}
            <div className="form-group">
              <label className="form-label" htmlFor="cat-ksaAvailability">{t('aipolicy.cat.ksa')}</label>
              <select id="cat-ksaAvailability" className="form-input" value={form.ksaAvailability} onChange={e => setForm({ ...form, ksaAvailability: e.target.value })}>
                {KSA_STATUSES.map(s => <option key={s} value={s}>{t(`aipolicy.ksa.${s}`)}</option>)}
              </select>
            </div>
            {field('ksaRegionNote', t('aipolicy.cat.ksa_note'), { placeholder: 'me-central2 (Dammam)' })}
            {field('hostingRegions', t('aipolicy.cat.regions'))}
            {field('inputSarPerMTok', t('aipolicy.cat.input_price'))}
            {field('outputSarPerMTok', t('aipolicy.cat.output_price'))}
            {field('priceSource', t('aipolicy.cat.price_source'))}
            {field('contextWindow', t('aipolicy.cat.context'))}
            {field('maxOutputTokens', t('aipolicy.cat.max_output'))}
          </div>
          <label className="aip-check" htmlFor="cat-deep"><input id="cat-deep" type="checkbox" checked={form.deepWorkCapable} onChange={e => setForm({ ...form, deepWorkCapable: e.target.checked })} /> {t('aipolicy.cat.deep_help')}</label>
          <label className="aip-check" htmlFor="cat-active" style={{ display: 'block' }}><input id="cat-active" type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} /> {t('aipolicy.cat.active_help')}</label>
          <div className="form-group">
            <label className="form-label" htmlFor="cat-notes">{t('aipolicy.cat.notes')}</label>
            <textarea id="cat-notes" className="form-input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>{t('aipolicy.save')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(null); setError('') }}>{t('aipolicy.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
