import { useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

/**
 * Presentation Studio design picker.
 *  • Your organization — tenant templates (brand overlay) and the organization default.
 *  • ArchMind designs — the four built-in design systems, each previewed with
 *    slides rendered by the production renderer (cover, context, exhibit,
 *    architecture, roadmap) in the export language.
 * The design never changes content; the picker says so.
 */

export interface GalleryDesign {
  id: string
  name: string
  nameAr?: string
  description: string
  descriptionAr?: string
  audience?: { AR: string; EN: string }
  formats: string[]
  previews?: { AR: string[]; EN: string[] }
}
export interface TenantTemplate { id: string; name: string; version: number; format: string }
export interface DesignSelection { templateId: string; baseDesign: string }

const PREVIEW_KEYS = ['cover', 'summary', 'exhibit', 'architecture', 'roadmap'] as const

export default function DesignPicker({ gallery, templates, defaultTemplateId, value, onChange, previewLanguage }: {
  gallery: GalleryDesign[]
  templates: TenantTemplate[]
  defaultTemplateId?: string
  value: DesignSelection
  onChange: (value: DesignSelection) => void
  previewLanguage: 'AR' | 'EN'
}) {
  const { t, isAR } = useLang()
  const [previewing, setPreviewing] = useState<GalleryDesign | null>(null)
  const designs = gallery.filter(item => item.formats.includes('PPTX'))
  const tenantTemplates = templates.filter(item => item.format === 'PPTX')
  const isTenant = tenantTemplates.some(item => item.id === value.templateId)
  const name = (item: GalleryDesign) => (isAR ? item.nameAr || item.name : item.name)
  const description = (item: GalleryDesign) => (isAR ? item.descriptionAr || item.description : item.description)
  const previews = (item: GalleryDesign) => item.previews?.[previewLanguage] || []

  return (
    <div dir={isAR ? 'rtl' : 'ltr'} style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
        {t('studio.design')}<HelpTip text={t('studio.help')} />
      </div>

      <fieldset style={{ border: 'none', padding: 0, margin: '8px 0 0' }}>
        <legend style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{t('studio.your_org')}</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <button type="button" className="design-card" aria-pressed={value.templateId === ''} onClick={() => onChange({ ...value, templateId: '' })} title={t('studio.org_default_hint')} style={{ fontSize: 10 }}>
            {t('studio.org_default')}
          </button>
          {tenantTemplates.map(item => (
            <button key={item.id} type="button" className="design-card" aria-pressed={value.templateId === item.id} onClick={() => onChange({ ...value, templateId: item.id })} style={{ fontSize: 10 }}>
              {item.name} · v{item.version}{item.id === defaultTemplateId ? ` · ${t('studio.default_badge')}` : ''}
            </button>
          ))}
        </div>
      </fieldset>

      {isTenant && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}><label htmlFor="studio-base-design" style={{ fontSize: 10 }}>{t('studio.base_design')}</label><HelpTip text={t('studio.base_design_hint')} /></div>
          <select id="studio-base-design" className="form-input" value={value.baseDesign} onChange={e => onChange({ ...value, baseDesign: e.target.value })} style={{ width: '100%', marginTop: 3 }}>
            {designs.map(item => <option key={item.id} value={item.id}>{name(item)}</option>)}
          </select>
        </div>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: '10px 0 0' }}>
        <legend style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>{t('studio.archmind_designs')}</legend>
        <div className="design-picker-grid">
          {designs.map(item => {
            const selected = value.templateId === item.id
            return (
              <div key={item.id} className="design-card" role="button" tabIndex={0} aria-pressed={selected} aria-label={name(item)}
                onClick={() => onChange({ ...value, templateId: item.id })}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange({ ...value, templateId: item.id }) } }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{name(item)}</span>
                  {selected && <span style={{ fontSize: 9, color: 'var(--accent)' }}>{t('studio.selected')}</span>}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--text-dim)', marginTop: 2 }}>{description(item)}</div>
                {item.audience && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{t('studio.audience')}: {item.audience[isAR ? 'AR' : 'EN']}</div>}
                {previews(item).length > 0 && (
                  <div className="design-strip">
                    {previews(item).map((src, i) => <img key={src} src={src} loading="lazy" alt={`${name(item)} — ${t(`studio.preview_${PREVIEW_KEYS[i]}`)}`} />)}
                  </div>
                )}
                {previews(item).length > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 9, marginTop: 6 }} onClick={e => { e.stopPropagation(); setPreviewing(item) }}>{t('studio.preview')}</button>
                )}
              </div>
            )
          })}
        </div>
      </fieldset>

      {previewing && (
        <div role="dialog" aria-modal="true" aria-label={`${t('studio.preview')} — ${name(previewing)}`}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setPreviewing(null)}>
          <div dir={isAR ? 'rtl' : 'ltr'} style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, width: 'min(1100px, 100%)', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 700 }}>{name(previewing)}</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewing(null)}>{t('studio.close')}</button>
            </div>
            <div className="design-preview-grid">
              {previews(previewing).map((src, i) => (
                <figure key={src} style={{ margin: 0 }}>
                  <img src={src} alt={`${name(previewing)} — ${t(`studio.preview_${PREVIEW_KEYS[i]}`)}`} />
                  <figcaption style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{t(`studio.preview_${PREVIEW_KEYS[i]}`)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
