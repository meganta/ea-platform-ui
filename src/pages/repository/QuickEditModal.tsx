import { useEffect, useMemo, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import AttributeField from './AttributeField'
import { AssetProfile, assetProfileApi, fromInputValue, localName, toInputValue, validateValue } from './assetProfile'

type T = (k: string) => string
const STATUSES = ['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED']
const LIFECYCLES = ['PLANNED', 'ACTIVE', 'DEPRECATED', 'RETIRED']

/**
 * Quick edit from the Repository list (✏): the object's own fields and every
 * attribute its Meta Model type defines, in a popup. Relationships, domain
 * and type are left to the full page ("Open full page"). Saving sends the
 * full metadata so values the Meta Model does not define are kept.
 */
export default function QuickEditModal({ assetId, t, isAR, onClose, onSaved, onOpenFull }: {
  assetId: string; t: T; isAR: boolean; onClose: () => void; onSaved: () => void; onOpenFull: () => void
}) {
  const [profile, setProfile] = useState<AssetProfile | null>(null)
  const [loadError, setLoadError] = useState('')
  const [core, setCore] = useState({ name: '', nameAr: '', description: '', status: 'DRAFT', lifecycleStatus: '', owner: '' })
  const [values, setValues] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let live = true
    assetProfileApi.profile(assetId).then(p => {
      if (!live) return
      const a = p.asset
      setProfile(p)
      setCore({ name: a.name || '', nameAr: a.nameAr || '', description: a.description || '', status: a.status || 'DRAFT', lifecycleStatus: a.lifecycleStatus || '', owner: a.owner || '' })
      setValues(Object.fromEntries((p.attributeGroups || []).flatMap(g => g.attributes).map(x => [x.code, toInputValue(x.attributeType, x.value)])))
    }).catch((e: any) => { if (live) setLoadError(e.message) })
    return () => { live = false }
  }, [assetId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const attributes = useMemo(() => (profile?.attributeGroups || []).flatMap(g => g.attributes), [profile])
  const setC = (k: keyof typeof core) => (e: any) => setCore(c => ({ ...c, [k]: e.target.value }))

  const save = async (e: any) => {
    e.preventDefault()
    if (!profile) return
    const errs: Record<string, string> = {}
    if (!core.name.trim()) errs.__name = 'repository.profile.error.required'
    for (const attr of attributes) { const v = validateValue(attr, values[attr.code]); if (v) errs[attr.code] = v }
    setErrors(errs)
    if (Object.keys(errs).length) { setSaveError(t('repository.profile.fix_errors')); return }
    setSaving(true); setSaveError('')
    const metadata: Record<string, any> = { ...(profile.asset.metadata || {}) }
    for (const attr of attributes) {
      if (attr.isReadOnly) continue
      const v = fromInputValue(attr.attributeType, values[attr.code])
      if (v === null) delete metadata[attr.code]; else metadata[attr.code] = v
    }
    try {
      await assetProfileApi.updateAsset(profile.asset.id, {
        name: core.name.trim(), nameAr: core.nameAr, description: core.description, status: core.status,
        ...(core.lifecycleStatus ? { lifecycleStatus: core.lifecycleStatus } : {}), owner: core.owner, metadata,
      })
      onSaved()
    } catch (err: any) {
      setSaveError(`${t('repository.profile.save_failed')}: ${err.message}`)
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal ap-quick" role="dialog" aria-modal="true" aria-labelledby="ap-quick-title" dir={isAR ? 'rtl' : 'ltr'} onClick={e => e.stopPropagation()}>
        <div className="modal-title" id="ap-quick-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('repository.quick.title')}{profile ? `: ${localName(profile.asset, isAR)}` : ''}
          <HelpTip text={t('repository.quick.help')} />
        </div>
        {loadError && <div role="alert" className="ap-banner ap-banner-error">{loadError}</div>}
        {!profile && !loadError && <div className="ap-empty" aria-busy="true">{t('repository.quick.loading')}</div>}
        {profile && (
          <form onSubmit={save} noValidate>
            {saveError && <div role="alert" className="ap-banner ap-banner-error">{saveError}</div>}
            <div className="ap-edit-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="qe-name">{t('repository.profile.name_en')} <span className="ap-required">*</span></label>
                <input id="qe-name" className="form-input" value={core.name} onChange={setC('name')} aria-invalid={!!errors.__name || undefined} />
                {errors.__name && <div role="alert" className="ap-error">{t(errors.__name)}</div>}
              </div>
              <div className="form-group"><label className="form-label" htmlFor="qe-name-ar">{t('repository.profile.name_ar')}</label><input id="qe-name-ar" className="form-input" dir="rtl" value={core.nameAr} onChange={setC('nameAr')} /></div>
              <div className="form-group ap-wide"><label className="form-label" htmlFor="qe-desc">{t('repository.profile.description_en')}</label><textarea id="qe-desc" className="form-input" rows={2} value={core.description} onChange={setC('description')} /></div>
              <div className="form-group">
                <label className="form-label" htmlFor="qe-status">{t('repository.profile.status')}</label>
                <select id="qe-status" className="form-input" value={core.status} onChange={setC('status')}>{STATUSES.map(s => <option key={s} value={s}>{t(`repository.profile.status.${s}`)}</option>)}</select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="qe-lifecycle">{t('repository.profile.lifecycle')}</label>
                <select id="qe-lifecycle" className="form-input" value={core.lifecycleStatus} onChange={setC('lifecycleStatus')}>
                  <option value="">—</option>
                  {LIFECYCLES.map(s => <option key={s} value={s}>{t(`repository.profile.lifecycle.${s}`)}</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label" htmlFor="qe-owner">{t('repository.profile.owner')}</label><input id="qe-owner" className="form-input" value={core.owner} onChange={setC('owner')} /></div>
            </div>

            {(profile.attributeGroups || []).filter(g => g.attributes.length).map(g => (
              <section key={g.id} className="ap-section" style={{ marginTop: 12 }}>
                <div className="ap-section-title">{(isAR && g.nameAr) || g.name}</div>
                <div className="ap-edit-grid">
                  {g.attributes.map(attr => (
                    <AttributeField key={attr.code} def={attr} idPrefix="qe-attr" isAR={isAR} t={t} error={errors[attr.code] ? t(errors[attr.code]) : null}
                      value={values[attr.code]} onChange={v => setValues(x => ({ ...x, [attr.code]: v }))} />
                  ))}
                </div>
              </section>
            ))}
            {attributes.length === 0 && <p className="ap-empty">{t('repository.quick.no_attributes')}</p>}

            <p className="text-dim" style={{ fontSize: 12, marginTop: 12 }}>{t('repository.quick.relationships_note')}</p>
            <div className="modal-actions" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onOpenFull} style={{ marginInlineEnd: 'auto' }}>{t('repository.quick.open_full')}</button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('repository.profile.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('repository.quick.saving') : t('repository.profile.save')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
