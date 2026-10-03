import { useEffect, useMemo, useRef, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import AttributeField from './AttributeField'
import { arrow, slotLabel } from './AssetRelationshipsView'
import { AssetProfile, RelatedAsset, RelationshipSlot, assetProfileApi, fromInputValue, localName, toInputValue, validateValue } from './assetProfile'

type T = (k: string) => string
const STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED']
const LIFECYCLES = ['PLANNED', 'ACTIVE', 'DEPRECATED', 'RETIRED']

interface PendingLink { key: string; asset: RelatedAsset; metadata: Record<string, any> }
interface SlotChanges { add: PendingLink[]; remove: string[]; edit: Record<string, Record<string, any>> }
const slotKey = (s: RelationshipSlot) => `${s.definitionId}:${s.direction}`

/**
 * Edits everything recorded on one Repository object: its core fields, every
 * attribute its Meta Model type defines (an input per attribute type), and its
 * relationships per Meta Model relationship (add from objects of the right
 * type, remove, edit the relationship's own attributes). Changes are applied
 * together on Save; anything that fails is reported and nothing is hidden.
 */
export default function AssetEditor({ profile, domains, typesFor, t, isAR, onCancel, onSaved }: {
  profile: AssetProfile; domains: string[]; typesFor: (domain: string) => string[]; t: T; isAR: boolean; onCancel: () => void; onSaved: () => void
}) {
  const a = profile.asset
  const [core, setCore] = useState({
    name: a.name || '', nameAr: a.nameAr || '', description: a.description || '', descriptionAr: a.descriptionAr || '',
    domain: a.domain === 'APPLICATIONS' ? 'APPLICATION' : a.domain || '', assetType: a.assetType || '', status: a.status || 'DRAFT', lifecycleStatus: a.lifecycleStatus || '', owner: a.owner || '', version: a.version || '',
    tags: (a.tags || []).join(', '),
  })
  const attributes = useMemo(() => (profile.attributeGroups || []).flatMap(g => g.attributes), [profile])
  const [values, setValues] = useState<Record<string, any>>(() => Object.fromEntries(attributes.map(x => [x.code, toInputValue(x.attributeType, x.value)])))
  const [changes, setChanges] = useState<Record<string, SlotChanges>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ kind: 'error' | 'partial'; messages: string[] } | null>(null)
  const types = typesFor(core.domain)
  const typeChanged = core.assetType !== a.assetType

  const setC = (k: keyof typeof core) => (e: any) => setCore(c => ({ ...c, [k]: e.target.value }))
  const changesFor = (s: RelationshipSlot): SlotChanges => changes[slotKey(s)] || { add: [], remove: [], edit: {} }
  const updateSlot = (s: RelationshipSlot, fn: (c: SlotChanges) => SlotChanges) => setChanges(all => ({ ...all, [slotKey(s)]: fn(all[slotKey(s)] || { add: [], remove: [], edit: {} }) }))

  const addLink = (s: RelationshipSlot, asset: RelatedAsset) => updateSlot(s, c => {
    // A single-valued relationship is replaced, not doubled.
    const remove = s.single ? [...new Set([...c.remove, ...s.items.map(i => i.relationshipId)])] : c.remove
    const add = s.single ? [] : c.add
    return { ...c, remove, add: [...add, { key: `${asset.id}-${Date.now()}`, asset, metadata: {} }] }
  })

  const pendingCount = Object.values(changes).reduce((n, c) => n + c.add.length + c.remove.length + Object.keys(c.edit).length, 0)

  const save = async () => {
    const errs: Record<string, string> = {}
    if (!core.name.trim()) errs.__name = 'repository.profile.error.required'
    for (const attr of attributes) { const e = validateValue(attr, values[attr.code]); if (e) errs[attr.code] = e }
    setErrors(errs)
    if (Object.keys(errs).length) { setResult({ kind: 'error', messages: [t('repository.profile.fix_errors')] }); return }
    setSaving(true); setResult(null)
    const failures: string[] = []
    try {
      // Values the Meta Model does not define are kept as they are.
      const metadata: Record<string, any> = { ...(a.metadata || {}) }
      for (const attr of attributes) {
        if (attr.isReadOnly) continue
        const v = fromInputValue(attr.attributeType, values[attr.code])
        if (v === null) delete metadata[attr.code]; else metadata[attr.code] = v
      }
      await assetProfileApi.updateAsset(a.id, {
        name: core.name.trim(), nameAr: core.nameAr, description: core.description, descriptionAr: core.descriptionAr,
        domain: core.domain, assetType: core.assetType, status: core.status, ...(core.lifecycleStatus ? { lifecycleStatus: core.lifecycleStatus } : {}),
        owner: core.owner, version: core.version || undefined, tags: core.tags.split(',').map((x: string) => x.trim()).filter(Boolean), metadata,
      })
    } catch (e: any) {
      setSaving(false); setResult({ kind: 'error', messages: [`${t('repository.profile.save_failed')}: ${e.message}`] }); return
    }
    for (const s of profile.relationshipSlots || []) {
      const c = changes[slotKey(s)]
      if (!c) continue
      const name = (id: string) => s.items.find(i => i.relationshipId === id)?.relatedAsset.name || id
      for (const id of c.remove) { try { await assetProfileApi.unlink(id) } catch (e: any) { failures.push(`${slotLabel(s, isAR)} — ${name(id)}: ${e.message}`) } }
      for (const p of c.add) {
        try {
          await assetProfileApi.link({ sourceId: s.direction === 'OUTGOING' ? a.id : p.asset.id, targetId: s.direction === 'OUTGOING' ? p.asset.id : a.id, relationshipType: s.forwardLabel, relationshipDefinitionId: s.definitionId, ...(Object.keys(p.metadata).length ? { metadata: p.metadata } : {}) })
        } catch (e: any) { failures.push(`${slotLabel(s, isAR)} — ${p.asset.name}: ${e.message}`) }
      }
      for (const [id, metadata] of Object.entries(c.edit)) {
        if (c.remove.includes(id)) continue
        try { await assetProfileApi.updateLink(id, metadata) } catch (e: any) { failures.push(`${slotLabel(s, isAR)} — ${name(id)}: ${e.message}`) }
      }
    }
    setSaving(false)
    if (failures.length) { setResult({ kind: 'partial', messages: failures }); return }
    onSaved()
  }

  return (
    <div className="ap-editor">
      {result && (
        <div role="alert" className={`ap-banner ${result.kind === 'error' ? 'ap-banner-error' : ''}`}>
          {result.kind === 'partial' && <strong>{t('repository.profile.partial_saved')}</strong>}
          <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>{result.messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <section className="ap-section">
        <div className="ap-section-title">{t('repository.profile.core')}</div>
        <div className="ap-edit-grid">
          <div className="form-group"><label className="form-label" htmlFor="ap-name">{t('repository.profile.name_en')} <span className="ap-required">*</span></label><input id="ap-name" className="form-input" value={core.name} onChange={setC('name')} aria-invalid={!!errors.__name || undefined} />{errors.__name && <div role="alert" className="ap-error">{t(errors.__name)}</div>}</div>
          <div className="form-group"><label className="form-label" htmlFor="ap-name-ar">{t('repository.profile.name_ar')}</label><input id="ap-name-ar" className="form-input" dir="rtl" value={core.nameAr} onChange={setC('nameAr')} /></div>
          <div className="form-group ap-wide"><label className="form-label" htmlFor="ap-desc">{t('repository.profile.description_en')}</label><textarea id="ap-desc" className="form-input" rows={3} value={core.description} onChange={setC('description')} /></div>
          <div className="form-group ap-wide"><label className="form-label" htmlFor="ap-desc-ar">{t('repository.profile.description_ar')}</label><textarea id="ap-desc-ar" className="form-input" rows={3} dir="rtl" value={core.descriptionAr} onChange={setC('descriptionAr')} /></div>
          <div className="form-group">
            <label className="form-label" htmlFor="ap-domain">{t('repository.profile.domain')}</label>
            <select id="ap-domain" className="form-input" value={core.domain} onChange={e => setCore(c => ({ ...c, domain: e.target.value, assetType: typesFor(e.target.value).includes(c.assetType) ? c.assetType : '' }))}>
              {!domains.includes(core.domain) && core.domain && <option value={core.domain}>{core.domain}</option>}
              {domains.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ap-type">{t('repository.profile.type')}</label>
            <select id="ap-type" className="form-input" value={core.assetType} onChange={setC('assetType')}>
              <option value="">{t('repository.profile.select')}</option>
              {!types.includes(core.assetType) && core.assetType && <option value={core.assetType}>{core.assetType}</option>}
              {types.map(x => <option key={x} value={x}>{x.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          {typeChanged && <div className="ap-banner ap-wide">{t('repository.profile.type_change_note')}</div>}
          <div className="form-group">
            <label className="form-label" htmlFor="ap-status">{t('repository.profile.status')}</label>
            <select id="ap-status" className="form-input" value={core.status} onChange={setC('status')}>{STATUSES.map(s => <option key={s} value={s}>{t(`repository.profile.status.${s}`)}</option>)}</select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="ap-lifecycle">{t('repository.profile.lifecycle')}</label>
            <select id="ap-lifecycle" className="form-input" value={core.lifecycleStatus} onChange={setC('lifecycleStatus')}>
              <option value="">{t('repository.profile.not_set')}</option>
              {LIFECYCLES.map(s => <option key={s} value={s}>{t(`repository.profile.lifecycle.${s}`)}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="ap-owner">{t('repository.profile.owner')}</label><input id="ap-owner" className="form-input" value={core.owner} onChange={setC('owner')} /></div>
          <div className="form-group"><label className="form-label" htmlFor="ap-version">{t('repository.profile.version')}</label><input id="ap-version" className="form-input" value={core.version} onChange={setC('version')} /></div>
          <div className="form-group ap-wide"><label className="form-label" htmlFor="ap-tags">{t('repository.profile.tags')}</label><input id="ap-tags" className="form-input" value={core.tags} onChange={setC('tags')} placeholder={t('repository.profile.tags_hint')} /></div>
        </div>
      </section>

      {(profile.attributeGroups || []).map((g, gi) => (
        <section key={g.id || gi} className="ap-section">
          <div className="ap-section-title">{localName(g, isAR) || t('repository.profile.attributes')}</div>
          <div className="ap-edit-grid">
            {g.attributes.map(attr => (
              <div key={attr.code} className={['LONG_TEXT', 'RICH_TEXT', 'JSON_DATA', 'MULTI_ENUM'].includes(attr.attributeType) ? 'ap-wide' : undefined}>
                <AttributeField def={attr} idPrefix="ap-attr" isAR={isAR} t={t} value={values[attr.code]} error={errors[attr.code]}
                  onChange={v => { setValues(vs => ({ ...vs, [attr.code]: v })); if (errors[attr.code]) setErrors(es => { const n = { ...es }; delete n[attr.code]; return n }) }} />
              </div>
            ))}
          </div>
        </section>
      ))}
      {!!profile.otherAttributes?.length && <p className="ap-help">{t('repository.profile.other_data_kept').replace('{count}', String(profile.otherAttributes.length))}</p>}

      <section className="ap-section">
        <div className="ap-section-title">{t('repository.profile.relationships')}<HelpTip text={t('repository.profile.edit_relationships_help')} /></div>
        {typeChanged && <div className="ap-banner">{t('repository.profile.type_change_relationships')}</div>}
        {!(profile.relationshipSlots || []).length && <p className="ap-empty">{t('repository.profile.no_relationship_types')}</p>}
        {(profile.relationshipSlots || []).map(s => (
          <SlotEditor key={slotKey(s)} slot={s} assetId={a.id} changes={changesFor(s)} t={t} isAR={isAR} disabled={typeChanged || saving}
            onAdd={asset => addLink(s, asset)}
            onRemove={id => updateSlot(s, c => ({ ...c, remove: c.remove.includes(id) ? c.remove.filter(x => x !== id) : [...c.remove, id] }))}
            onCancelAdd={key => updateSlot(s, c => ({ ...c, add: c.add.filter(p => p.key !== key) }))}
            onEditAttr={(id, metadata) => updateSlot(s, c => ({ ...c, edit: { ...c.edit, [id]: metadata } }))}
            onEditPendingAttr={(key, metadata) => updateSlot(s, c => ({ ...c, add: c.add.map(p => (p.key === key ? { ...p, metadata } : p)) }))} />
        ))}
      </section>

      <div className="ap-foot">
        {pendingCount > 0 && <span className="ap-pending" style={{ marginInlineEnd: 'auto', alignSelf: 'center' }}>{t('repository.profile.pending_changes').replace('{count}', String(pendingCount))}</span>}
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>{t('repository.profile.cancel')}</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('repository.profile.saving') : t('repository.profile.save')}</button>
      </div>
    </div>
  )
}

function SlotEditor({ slot: s, assetId, changes, t, isAR, disabled, onAdd, onRemove, onCancelAdd, onEditAttr, onEditPendingAttr }: {
  slot: RelationshipSlot; assetId: string; changes: SlotChanges; t: T; isAR: boolean; disabled: boolean
  onAdd: (a: RelatedAsset) => void; onRemove: (id: string) => void; onCancelAdd: (key: string) => void
  onEditAttr: (id: string, metadata: Record<string, any>) => void; onEditPendingAttr: (key: string, metadata: Record<string, any>) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [found, setFound] = useState<{ items: RelatedAsset[]; total: number } | null>(null)
  const [searchError, setSearchError] = useState('')
  const timer = useRef<any>(null)
  const pickerId = `ap-pick-${s.definitionId}-${s.direction}`
  useEffect(() => {
    if (!open) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      assetProfileApi.candidates(assetId, s.definitionId, s.direction, search)
        .then(r => { setFound(r); setSearchError('') })
        .catch(e => setSearchError(e.message))
    }, 250)
    return () => clearTimeout(timer.current)
  }, [open, search, assetId, s.definitionId, s.direction])
  const pendingIds = new Set(changes.add.map(p => p.asset.id))
  const attrInputs = (metadata: Record<string, any>, onChange: (m: Record<string, any>) => void, prefix: string) => s.attributes.length > 0 && (
    <div className="ap-rel-attrs">
      {s.attributes.map(attr => (
        <AttributeField key={attr.code} def={attr} idPrefix={prefix} isAR={isAR} t={t} value={toInputValue(attr.attributeType, metadata?.[attr.code])}
          onChange={v => onChange({ ...(metadata || {}), [attr.code]: fromInputValue(attr.attributeType, v) })} />
      ))}
    </div>
  )
  return (
    <section className="ap-slot" data-testid={`edit-slot-${s.code}-${s.direction}`} aria-label={`${slotLabel(s, isAR)} ${localName(s.otherType, isAR)}`}>
      <div className="ap-slot-head">
        <div className="ap-slot-name">
          <span aria-hidden>{arrow(s.direction, isAR)}</span><span>{slotLabel(s, isAR)}</span>
          <span className="ap-chip">{localName(s.otherType, isAR) || '—'}</span>
          {s.isRequired && <span className="ap-chip">{t('repository.profile.required')}</span>}
          {s.single && <span className="ap-chip">{t('repository.profile.single')}</span>}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={disabled || !s.otherType} aria-expanded={open} aria-controls={pickerId} onClick={() => setOpen(o => !o)}>
          {open ? t('repository.profile.done_adding') : `+ ${t(s.single && s.count ? 'repository.profile.replace' : 'repository.profile.add')}`}
        </button>
      </div>
      <div className="ap-slot-body">
        {open && (
          <div className="ap-picker" id={pickerId}>
            <label className="form-label" htmlFor={`${pickerId}-search`}>{t('repository.profile.find').replace('{type}', localName(s.otherType, isAR))}</label>
            <input id={`${pickerId}-search`} className="form-input" value={search} autoFocus onChange={e => setSearch(e.target.value)} placeholder={t('repository.profile.find_hint')} />
            {searchError && <div role="alert" className="ap-error">{searchError}</div>}
            {found && (found.items.filter(i => !pendingIds.has(i.id)).length ? (
              <ul className="ap-picker-list" aria-label={t('repository.profile.matches')}>
                {found.items.filter(i => !pendingIds.has(i.id)).map(i => (
                  <li key={i.id}><button type="button" onClick={() => { onAdd(i); if (s.single) setOpen(false) }}><span>{localName(i, isAR)}</span><span className="ap-slot-meta">{i.status || ''}</span></button></li>
                ))}
              </ul>
            ) : <div className="ap-help">{t('repository.profile.no_matches')}</div>)}
            {found && found.total > found.items.length && <div className="ap-help">{t('repository.profile.more_matches').replace('{count}', String(found.total))}</div>}
          </div>
        )}
        {!s.items.length && !changes.add.length && <div className="ap-empty" style={{ fontSize: 12 }}>{t('repository.profile.none_recorded')}</div>}
        <ul className="ap-items">
          {s.items.map(i => {
            const removed = changes.remove.includes(i.relationshipId)
            const metadata = changes.edit[i.relationshipId] ?? i.metadata
            return (
              <li key={i.relationshipId} className="ap-item">
                <div className="ap-item-main"><span className={removed ? 'ap-removed' : undefined}>{localName(i.relatedAsset, isAR)}</span>{removed && <span className="ap-pending">{t('repository.profile.will_remove')}</span>}</div>
                <button type="button" className="btn btn-secondary btn-sm" disabled={disabled} onClick={() => onRemove(i.relationshipId)} aria-label={`${t(removed ? 'repository.profile.undo_remove' : 'repository.profile.remove')} ${i.relatedAsset.name}`}>
                  {removed ? t('repository.profile.undo_remove') : t('repository.profile.remove')}
                </button>
                {!removed && attrInputs(metadata, m => onEditAttr(i.relationshipId, m), `ap-rel-${i.relationshipId}`)}
              </li>
            )
          })}
          {changes.add.map(p => (
            <li key={p.key} className="ap-item">
              <div className="ap-item-main"><span>{localName(p.asset, isAR)}</span><span className="ap-pending">{t('repository.profile.will_add')}</span></div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onCancelAdd(p.key)} aria-label={`${t('repository.profile.cancel')} ${p.asset.name}`}>{t('repository.profile.cancel')}</button>
              {attrInputs(p.metadata, m => onEditPendingAttr(p.key, m), `ap-new-${p.key}`)}
            </li>
          ))}
        </ul>
        {s.truncated && <div className="ap-slot-meta">{t('repository.profile.slot_truncated').replace('{count}', String(s.count))}</div>}
      </div>
    </section>
  )
}
