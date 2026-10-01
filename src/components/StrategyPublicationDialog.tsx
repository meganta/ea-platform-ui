import { useEffect, useRef, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { PublicationOptions, RefreshFinding, strategyRefreshApi } from '../lib/strategy-refresh'

export function StrategyPublicationDialog({ refreshId, finding, onClose, onPublished }: { refreshId: string; finding: RefreshFinding; onClose: () => void; onPublished: () => Promise<void> }) {
  const { t } = useLang()
  const dialog = useRef<HTMLElement>(null)
  const [options, setOptions] = useState<PublicationOptions | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [action, setAction] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    strategyRefreshApi.publicationOptions(refreshId, finding.id).then(result => { if (!cancelled) setOptions(result) }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [refreshId, finding.id])
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => { if (previous?.isConnected) previous.focus() }
  }, [])
  const field = (key: string, choices: Array<{ id: string; name: string }>, optional = false) => <label>{t(`strategy.refresh.publication.${key}`)}<select value={values[key] || ''} onChange={event => { const value = event.target.value; setValues(current => ({ ...current, [key]: value, ...(key === 'objectTypeId' ? { existingAssetId: '' } : {}) })) }}><option value="">{t(optional ? 'strategy.refresh.publication.create_new' : 'strategy.refresh.publication.choose')}</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
  const contract = (): Record<string, unknown> | null => {
    if (!options || options.revision !== finding.revision) return null
    const selectedType = options.objectTypes.find(item => item.id === values.objectTypeId)
    if (action === 'REPOSITORY_FACT' && selectedType && (values.existingAssetId ? selectedType.canUpdate : selectedType.canCreate)) return { action, objectTypeId: values.objectTypeId, ...(values.existingAssetId ? { existingAssetId: values.existingAssetId } : {}) }
    if (action === 'REPOSITORY_RELATIONSHIP' && values.sourceAssetId && values.targetAssetId && values.relationshipDefinitionId && values.sourceAssetId !== values.targetAssetId) return { action, sourceAssetId: values.sourceAssetId, targetAssetId: values.targetAssetId, relationshipDefinitionId: values.relationshipDefinitionId }
    if (action === 'PLAN_REVIEW_ACTION' && values.planId) return { action, planId: values.planId }
    if (action === 'ADM_REVALIDATION_REQUIREMENT' && values.cycleId) return { action, cycleId: values.cycleId }
    const view = options.views.find(item => `${item.id}:${item.scenarioId}` === values.viewId)
    if (action === 'SCENARIO_DELTA' && view && values.assetId && values.operation) return { action, viewId: view.id, scenarioId: view.scenarioId, assetId: values.assetId, operation: values.operation }
    return null
  }
  const submit = async () => {
    const selected = contract()
    if (!selected || busy) return
    setBusy(true); setError('')
    try { await strategyRefreshApi.publish(refreshId, finding, selected); await onPublished(); onClose() }
    catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  return <div className="modal-backdrop"><section ref={dialog} tabIndex={-1} className="refresh-modal" role="dialog" aria-modal="true" aria-label={t('strategy.refresh.publish')} onKeyDown={event => {
    if (event.key === 'Escape' && !busy) { event.preventDefault(); onClose() }
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled)') || [])
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first?.focus() }
    }
  }}>
    <h2>{finding.title}</h2><p>{t('strategy.refresh.publication.authorization_note')}</p><p>{t('strategy.refresh.authority_note')}</p>
    {error && <p role="alert">{error}</p>}
    {options && options.revision !== finding.revision && <p role="alert">{t('strategy.refresh.publication.stale')}</p>}
    {!options ? <p aria-live="polite">{t('strategy.refresh.publication.loading')}</p> : !options.actions.length ? <p>{t('strategy.refresh.publication.no_destination')}</p> : <>
      <label>{t('strategy.refresh.destination')}<select value={action} onChange={event => { setAction(event.target.value); setValues({}) }}><option value="">{t('strategy.refresh.publication.choose')}</option>{options.actions.map(item => <option key={item} value={item}>{t(`strategy.refresh.publication.${item}`)}</option>)}</select></label>
      {action === 'REPOSITORY_FACT' && <>{field('objectTypeId', options.objectTypes)}{field('existingAssetId', options.assets.filter(asset => { const type = options.objectTypes.find(item => item.id === values.objectTypeId); return type?.canUpdate && asset.assetType === type.code && asset.domain === type.operatingDomain }), options.objectTypes.find(item => item.id === values.objectTypeId)?.canCreate)}</>}
      {action === 'REPOSITORY_RELATIONSHIP' && <>{field('relationshipDefinitionId', options.relationships.map(item => ({ id: item.id, name: item.forwardLabel || item.code })))}{field('sourceAssetId', options.assets.filter(item => item.editable))}{field('targetAssetId', options.assets.filter(item => item.editable))}</>}
      {action === 'PLAN_REVIEW_ACTION' && field('planId', options.plans)}
      {action === 'ADM_REVALIDATION_REQUIREMENT' && field('cycleId', options.cycles)}
      {action === 'SCENARIO_DELTA' && <>{field('viewId', options.views.map(item => ({ id: `${item.id}:${item.scenarioId}`, name: item.name })))}{field('assetId', options.assets)}{field('operation', ['INTRODUCE', 'REMOVE', 'RESTORE'].map(item => ({ id: item, name: t(`strategy.refresh.publication.${item}`) })))}</>}
    </>}
    <div className="actions"><button disabled={busy} onClick={onClose}>{t('strategy.refresh.cancel')}</button><button className="primary" disabled={busy || !contract()} onClick={submit}>{t('strategy.refresh.publication.authorize')}</button></div>
  </section></div>
}
