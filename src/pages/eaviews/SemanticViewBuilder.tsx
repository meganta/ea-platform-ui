import React, { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import DynamicFilterBuilder from '../../components/filterBuilder/DynamicFilterBuilder'

// ── Meta-Model-driven view builder ─────────────────────────────────────────
//
// A guided interface over the tenant's PUBLISHED Meta Model, not a free
// form. Every choice constrains the next:
//   Architecture domain -> primary object type (in that domain)
//   -> related object type (any domain, only where a relationship exists)
//   -> relationship (one definition, or an approved path)
//   -> visualization (only what this structure supports)
//   -> optional scope (refines, never redefines).
// The backend validates the same definition again before saving.
//
// For a library viewpoint ("Customize") the semantics come from its
// contract resolved against the Meta Model; only name, visualization among
// the contract's alternatives, and scope are asked.

export interface RelationOption { definitionCode: string; direction: 'FORWARD' | 'REVERSE'; label: string; labelAr?: string | null; name: string }
export interface PathOption { code: string; label: string; labelAr?: string; via: string[]; hops: Array<{ fromType: string; targetType: string; label: string }> }
export interface RelatedOption { code: string; name: string; nameAr?: string | null; domainCode: string | null; relations: RelationOption[]; paths: PathOption[]; objectCount?: number }
type Relation = { kind: 'DIRECT'; definitionCode: string; direction: 'FORWARD' | 'REVERSE' } | { kind: 'PATH'; pathCode: string }

const relationKey = (r: Relation | null) => !r ? '' : r.kind === 'DIRECT' ? `D:${r.definitionCode}:${r.direction}` : `P:${r.pathCode}`

// Every way two types are connected, as plain choices.
export function relationChoices(option: RelatedOption | undefined): Array<{ key: string; relation: Relation; kind: 'DIRECT' | 'PATH'; label: string; labelAr?: string | null; via?: string[] }> {
  if (!option) return []
  return [
    ...option.relations.map(r => ({ key: relationKey({ kind: 'DIRECT', definitionCode: r.definitionCode, direction: r.direction }), relation: { kind: 'DIRECT' as const, definitionCode: r.definitionCode, direction: r.direction }, kind: 'DIRECT' as const, label: r.label, labelAr: r.labelAr })),
    ...option.paths.map(p => ({ key: relationKey({ kind: 'PATH', pathCode: p.code }), relation: { kind: 'PATH' as const, pathCode: p.code }, kind: 'PATH' as const, label: p.label, labelAr: p.labelAr, via: p.via })),
  ]
}

const VIZ_LABEL: Record<string, string> = { GRAPH: '🕸 Graph', MATRIX: '⊞ Matrix', TREE: '🌳 Tree', CAPABILITY_MAP: '⬛ Capability Map', HEATMAP: '🔥 Heatmap', LANDSCAPE: '🗾 Landscape', CARDS: '🃏 Cards', TABLE: '≡ Table' }

export default function SemanticViewBuilder({ api, viewpoint, onCreated, onCancel }: { api: any; viewpoint: any | null; onCreated: (v: any) => void; onCancel: () => void }) {
  const { t, isAR } = useLang()
  const nm = (o: { name: string; nameAr?: string | null }) => (isAR && o.nameAr) ? o.nameAr : o.name

  const [name, setName] = useState<string>(viewpoint?.name || '')
  const [description, setDescription] = useState<string>(viewpoint?.description || '')
  const [domains, setDomains] = useState<any[] | null>(null)
  const [domainCode, setDomainCode] = useState('')
  const [types, setTypes] = useState<any[]>([])
  const [primaryType, setPrimaryType] = useState('')
  const [related, setRelated] = useState<RelatedOption[]>([])
  const [relatedType, setRelatedType] = useState('')
  const [relation, setRelation] = useState<Relation | null>(null)
  const [visualization, setVisualization] = useState('')
  const [vizOptions, setVizOptions] = useState<{ recommended: string; eligible: string[] } | null>(null)
  const [issues, setIssues] = useState<Array<{ code: string; message: string }>>([])
  const [structuredQuery, setStructuredQuery] = useState<any>(null)
  const [showScope, setShowScope] = useState(false)
  const [resolved, setResolved] = useState<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [validatedFor, setValidatedFor] = useState<object | null>(null)

  // Library viewpoint: resolve its contract against the Meta Model.
  useEffect(() => {
    if (!viewpoint) return
    Promise.resolve(api.get(`/ea-views/viewpoints/${viewpoint.id}/resolve`)).then((r: any) => {
      if (!r || r.statusCode) { setLoadError(r?.message || t('eaviews.builder_load_error')); return }
      setResolved(r)
      setVisualization(r.visualization?.primary || viewpoint.defaultVisualization || 'TABLE')
    }).catch(() => setLoadError(t('eaviews.builder_load_error')))
  }, [api, viewpoint]) // eslint-disable-line react-hooks/exhaustive-deps

  // Custom view: Meta Model domains.
  useEffect(() => {
    if (viewpoint) return
    Promise.resolve(api.get('/ea-views/semantics/domains')).then((d: any) => {
      if (Array.isArray(d)) setDomains(d)
      else { setDomains([]); setLoadError(d?.message || t('eaviews.builder_load_error')) }
    }).catch(() => { setDomains([]); setLoadError(t('eaviews.builder_load_error')) })
  }, [api, viewpoint]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickDomain = (code: string) => {
    setDomainCode(code); setPrimaryType(''); setTypes([]); setRelated([]); setRelatedType(''); setRelation(null); setStructuredQuery(null)
    if (!code) return
    Promise.resolve(api.get(`/ea-views/semantics/object-types?domain=${encodeURIComponent(code)}`)).then((d: any) => setTypes(Array.isArray(d) ? d : []))
  }
  const pickPrimary = (code: string) => {
    setPrimaryType(code); setRelated([]); setRelatedType(''); setRelation(null); setStructuredQuery(null)
    if (!code) return
    Promise.resolve(api.get(`/ea-views/semantics/related?type=${encodeURIComponent(code)}`)).then((d: any) => setRelated(Array.isArray(d?.related) ? d.related : []))
  }
  const relatedOption = related.find(r => r.code === relatedType)
  const choices = useMemo(() => relationChoices(relatedOption), [relatedOption])
  const pickRelated = (code: string) => {
    setRelatedType(code)
    const opts = relationChoices(related.find(r => r.code === code))
    // One valid meaning: chosen for you. Several: you choose.
    setRelation(opts.length === 1 ? opts[0].relation : null)
  }

  const definition = useMemo(() => primaryType ? {
    domainCode, primaryType,
    ...(relatedType ? { relatedType } : {}),
    ...(relatedType && relation ? { relation } : {}),
  } : null, [domainCode, primaryType, relatedType, relation])

  // The backend decides what the structure supports (and validates it).
  useEffect(() => {
    if (viewpoint || !definition || (relatedType && !relation)) { setVizOptions(null); setIssues([]); return }
    let cancelled = false
    setValidatedFor(null)
    Promise.resolve(api.post('/ea-views/semantics/validate', { definition })).then((r: any) => {
      if (cancelled) return
      setValidatedFor(definition)
      setIssues(Array.isArray(r?.issues) ? r.issues : [])
      setVizOptions(r?.visualizations || null)
      // A new structure starts from its own recommendation; the user can change it.
      if (r?.visualizations) setVisualization(r.visualizations.recommended)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [api, viewpoint, definition, relatedType, relation])

  const viewpointVizOptions: string[] = resolved ? [resolved.visualization.primary, ...(resolved.visualization.alternates || [])].filter((v: string, i: number, a: string[]) => v && a.indexOf(v) === i) : []
  const scopeType: string | null = viewpoint
    ? (resolved?.primary?.length === 1 && resolved.primary[0].types.length === 1 ? resolved.primary[0].types[0].code : null)
    : (primaryType || null)
  const ready = !!name.trim() && (viewpoint ? !!resolved?.resolved : !!definition && (!relatedType || !!relation) && validatedFor === definition && issues.length === 0 && !!visualization)

  const create = async () => {
    if (!ready) return
    setSaving(true)
    setIssues([])
    const filterConfig = structuredQuery ? { structuredQuery } : {}
    const payload = viewpoint
      ? { name: name.trim(), description, viewpointId: viewpoint.id, visualization, filterConfig }
      : { name: name.trim(), description, visualization, semanticDefinition: definition, filterConfig }
    const result = await api.post('/ea-views', payload)
    setSaving(false)
    if (result?.id) { onCreated(result); return }
    setIssues(Array.isArray(result?.issues) ? result.issues : [{ code: 'ERROR', message: result?.message || t('eaviews.builder_save_error') }])
  }

  const typeName = (code: string) => {
    const r = related.find(x => x.code === code) || types.find((x: any) => x.code === code)
    return r ? nm(r) : code
  }

  return (
    <div className="svb" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="svb-header">
        <button type="button" className="svb-btn" onClick={onCancel}>← {t('eaviews.builder_back')}</button>
        <h2 className="svb-title">{viewpoint ? `${t('eaviews.builder_customize')}: ${viewpoint.name}` : t('eaviews.builder_new')}</h2>
        <HelpTip text={viewpoint ? t('eaviews.builder_vp_help') : t('eaviews.builder_help')} />
      </div>
      {loadError && <div role="alert" className="svb-error">{loadError}</div>}

      <div className="svb-grid">
        <div className="svb-main">
          <section className="svb-card">
            <label htmlFor="svb-name" className="svb-label">{t('eaviews.builder_name')} *</label>
            <input id="svb-name" className="svb-input" value={name} onChange={e => setName(e.target.value)} placeholder={t('eaviews.builder_name_ph')} />
            <label htmlFor="svb-desc" className="svb-label">{t('eaviews.builder_desc')}</label>
            <input id="svb-desc" className="svb-input" value={description} onChange={e => setDescription(e.target.value)} />
          </section>

          {viewpoint ? (
            <section className="svb-card" data-testid="svb-resolved">
              <div className="svb-step">{t('eaviews.builder_vp_semantics')}</div>
              {viewpoint.contract?.question && <p className="svb-question">{isAR && viewpoint.contract.questionAr ? viewpoint.contract.questionAr : viewpoint.contract.question}</p>}
              {!resolved && !loadError && <div className="svb-dim">…</div>}
              {resolved && (
                <ul className="svb-list">
                  <li><strong>{t('eaviews.builder_primary')}:</strong> {resolved.primary.flatMap((p: any) => p.types.map((x: any) => nm(x))).join(', ') || '—'}</li>
                  {resolved.related.length > 0 && <li><strong>{t('eaviews.builder_related')}:</strong> {resolved.related.flatMap((p: any) => p.types.map((x: any) => nm(x))).join(', ') || '—'}</li>}
                  {resolved.path.length > 0 && <li><strong>{t('eaviews.builder_path')}:</strong> {resolved.path.map((h: any) => `${h.label} → ${h.to}`).join(' · ')}</li>}
                </ul>
              )}
              {resolved && !resolved.resolved && (
                <div role="alert" className="svb-error">{t('eaviews.builder_vp_unresolved')}: {resolved.unresolved.join(', ')}</div>
              )}
            </section>
          ) : (
            <>
              <section className="svb-card">
                <label htmlFor="svb-domain" className="svb-step">1. {t('eaviews.builder_domain')}</label>
                <select id="svb-domain" className="svb-input" value={domainCode} onChange={e => pickDomain(e.target.value)}>
                  <option value="">{t('eaviews.builder_choose')}</option>
                  {(domains || []).map(d => <option key={d.code} value={d.code}>{nm(d)} ({d.objectTypeCount})</option>)}
                </select>
              </section>

              {domainCode && (
                <section className="svb-card">
                  <div className="svb-step" id="svb-primary-label">2. {t('eaviews.builder_primary')}</div>
                  <div className="svb-options" role="radiogroup" aria-labelledby="svb-primary-label">
                    {types.map((ty: any) => (
                      <label key={ty.code} className={`svb-option${primaryType === ty.code ? ' svb-option-on' : ''}`}>
                        <input type="radio" name="svb-primary" value={ty.code} checked={primaryType === ty.code} onChange={() => pickPrimary(ty.code)} />
                        <span>{nm(ty)}</span><span className="svb-count">{ty.objectCount}</span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {primaryType && (
                <section className="svb-card">
                  <div className="svb-step" id="svb-related-label">3. {t('eaviews.builder_related')} <HelpTip text={t('eaviews.builder_related_help')} /></div>
                  <div className="svb-options" role="radiogroup" aria-labelledby="svb-related-label">
                    <label className={`svb-option${!relatedType ? ' svb-option-on' : ''}`}>
                      <input type="radio" name="svb-related" value="" checked={!relatedType} onChange={() => { setRelatedType(''); setRelation(null) }} />
                      <span>{t('eaviews.builder_related_none')}</span>
                    </label>
                    {related.map(r => (
                      <label key={r.code} className={`svb-option${relatedType === r.code ? ' svb-option-on' : ''}`}>
                        <input type="radio" name="svb-related" value={r.code} checked={relatedType === r.code} onChange={() => pickRelated(r.code)} />
                        <span>{nm(r)}</span>{r.domainCode && <span className="svb-tag">{r.domainCode}</span>}<span className="svb-count">{r.objectCount ?? ''}</span>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              {relatedType && (
                <section className="svb-card">
                  <div className="svb-step" id="svb-rel-label">4. {t('eaviews.builder_relationship')} <HelpTip text={t('eaviews.builder_relationship_help')} /></div>
                  <div className="svb-options svb-options-col" role="radiogroup" aria-labelledby="svb-rel-label">
                    {choices.map(c => (
                      <label key={c.key} className={`svb-option${relationKey(relation) === c.key ? ' svb-option-on' : ''}`}>
                        <input type="radio" name="svb-relation" value={c.key} checked={relationKey(relation) === c.key} onChange={() => setRelation(c.relation)} />
                        <span className="svb-tag">{c.kind === 'DIRECT' ? t('eaviews.builder_direct') : t('eaviews.builder_via_path')}</span>
                        <span>
                          {c.kind === 'DIRECT'
                            ? `${typeName(primaryType)} — ${isAR && c.labelAr ? c.labelAr : c.label} → ${typeName(relatedType)}`
                            : `${typeName(primaryType)} → ${(c.via || []).map(typeName).join(' → ')} → ${typeName(relatedType)} (${isAR && c.labelAr ? c.labelAr : c.label})`}
                        </span>
                      </label>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          {((viewpoint && resolved) || vizOptions) && (
            <section className="svb-card">
              <div className="svb-step" id="svb-viz-label">{viewpoint ? '' : '5. '}{t('eaviews.builder_visualization')} <HelpTip text={t('eaviews.builder_visualization_help')} /></div>
              <div className="svb-options" role="radiogroup" aria-labelledby="svb-viz-label">
                {(viewpoint ? viewpointVizOptions : vizOptions!.eligible).map(v => (
                  <label key={v} className={`svb-option${visualization === v ? ' svb-option-on' : ''}`}>
                    <input type="radio" name="svb-viz" value={v} checked={visualization === v} onChange={() => setVisualization(v)} />
                    <span>{VIZ_LABEL[v] || v}</span>
                    {(viewpoint ? v === viewpointVizOptions[0] : v === vizOptions!.recommended) && <span className="svb-tag">{t('eaviews.builder_recommended')}</span>}
                  </label>
                ))}
              </div>
            </section>
          )}

          {scopeType && (
            <section className="svb-card">
              <button type="button" className="svb-btn" aria-expanded={showScope} onClick={() => setShowScope(s => !s)}>
                {viewpoint ? '' : '6. '}{t('eaviews.builder_scope')} {showScope ? '▴' : '▾'}
              </button>
              <HelpTip text={t('eaviews.builder_scope_help')} />
              {showScope && (
                <DynamicFilterBuilder objectType={scopeType} api={api} value={structuredQuery} onChange={setStructuredQuery} onApply={() => {}} onClear={() => setStructuredQuery(null)} />
              )}
            </section>
          )}
        </div>

        <aside className="svb-card svb-summary" aria-label={t('eaviews.builder_summary')}>
          <div className="svb-step">{t('eaviews.builder_summary')}</div>
          {!viewpoint && (
            <p className="svb-sentence" data-testid="svb-sentence">
              {primaryType ? typeName(primaryType) : '—'}
              {relatedType && ` → ${typeName(relatedType)}`}
              {relatedType && relation && (() => { const c = choices.find(x => x.key === relationKey(relation)); return c ? ` (${isAR && c.labelAr ? c.labelAr : c.label})` : '' })()}
              {visualization && ` · ${VIZ_LABEL[visualization] || visualization}`}
            </p>
          )}
          {issues.length > 0 && (
            <ul role="alert" className="svb-error" data-testid="svb-issues">
              {issues.map((i, k) => <li key={k}>{i.message}</li>)}
            </ul>
          )}
          <button type="button" className="svb-btn svb-primary" disabled={!ready || saving} onClick={create}>{saving ? '…' : t('eaviews.builder_create')}</button>
          <button type="button" className="svb-btn" onClick={onCancel}>{t('eaviews.builder_cancel')}</button>
        </aside>
      </div>
    </div>
  )
}
