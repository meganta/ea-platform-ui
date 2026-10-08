import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { LIBRARY_CATEGORY_COLOR, ownerApi, PACK_ACTION_COLOR, PACK_ARCH_ROLES, PACK_INDUSTRIES } from './ownerApi'
import { ErrorBox, fill, Header, Loading, Pill } from './ownerUi'

const SOURCE_COLOR: Record<string, string> = { NORA_OFFICIAL: 'var(--success)', ARCHMIND_CURATED: 'var(--accent)', INDUSTRY_CATALOGUE: 'var(--warning)', TENANT_REPOSITORY: 'var(--success)', PACK_STRUCTURE: 'var(--text-dim)' }

/**
 * Government reference pack for one organization: NORA reference models and
 * the organization's business, application and beneficiary reference
 * architectures tailored to its industry and beneficiaries. The plan comes
 * from the backend (GET reference-pack); preparing it writes only what the
 * plan marks as new.
 */
export default function ReferencePackPanel({ tenantId }: { tenantId: string }) {
  const { t, isAR } = useLang()
  const [industry, setIndustry] = useState('')
  const [plan, setPlan] = useState<any>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [activateModels, setActivateModels] = useState(true)
  const [activateArchitectures, setActivateArchitectures] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [withRepository, setWithRepository] = useState(true)
  const [withCapabilities, setWithCapabilities] = useState(true)
  const [withKnowledge, setWithKnowledge] = useState(true)
  const [skipDocs, setSkipDocs] = useState<Set<string>>(new Set())

  const load = useCallback((code: string) => {
    setError('')
    ownerApi.referencePack(tenantId, { industry: code || undefined }).then(setPlan).catch((e: any) => setError(e.message))
  }, [tenantId])
  useEffect(() => { load(industry) }, [load, industry])

  const lib = plan?.library || null
  const newObjects = (lib?.objects || []).filter((o: any) => o.action === 'CREATE')
  const copyDocs = (lib?.documents || []).filter((d: any) => d.action === 'COPY')
  const chosenDocs = copyDocs.filter((d: any) => !skipDocs.has(d.id))
  const pending = (plan?.architectures || []).filter((a: any) => a.action === 'CREATE' || a.action === 'ADD_MISSING').length
    + (withRepository && newObjects.length ? 1 : 0) + (withKnowledge && chosenDocs.length ? 1 : 0)
    + (withCapabilities && plan?.capabilities?.toCreate ? 1 : 0)
  const apply = async () => {
    setBusy(true); setError(''); setResult(null)
    const parts = [...(withRepository ? ['NORA_REPOSITORY'] : []), ...(withKnowledge ? ['NORA_KNOWLEDGE'] : []), ...(withCapabilities ? ['BUSINESS_CAPABILITIES'] : [])]
    const dto: any = { ...(industry ? { industry } : {}), activateModels, activateArchitectures }
    if (parts.length < 3) dto.include = [...PACK_ARCH_ROLES, ...parts]
    if (withKnowledge && skipDocs.size) dto.documentIds = chosenDocs.map((d: any) => d.id)
    try {
      setResult(await ownerApi.applyReferencePack(tenantId, dto))
      load(industry)
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const name = (a: any) => (isAR && a.nameAr ? a.nameAr : a.name)
  const actionText = (a: any) => {
    if (a.action === 'ADD_MISSING') return fill(t('owner.pack.action.ADD_MISSING'), { n: a.toWrite })
    if (a.action === 'SKIPPED') return `${t('owner.pack.action.SKIPPED')}: ${a.reason?.startsWith('LATEST_VERSION_') ? fill(t('owner.pack.reason.LATEST_VERSION'), { status: a.reason.slice('LATEST_VERSION_'.length) }) : t(`owner.pack.reason.${a.reason}`)}`
    return t(`owner.pack.action.${a.action}`)
  }

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.pack.title')} help={t('owner.pack.help')}
        actions={<button type="button" className="btn btn-primary" disabled={busy || !plan || !pending} onClick={apply}>{busy ? t('owner.pack.preparing') : fill(t('owner.pack.prepare'), { n: pending })}</button>} />
      {error && <ErrorBox error={error} />}
      {result && (
        <div className="oc-ok" role="status">
          {fill(t('owner.pack.done'), { created: result.results.filter((r: any) => r.action === 'CREATED').length, added: result.results.filter((r: any) => r.action === 'ELEMENTS_ADDED').length })}
          {result.capabilities && <div>{fill(t('owner.pack.caps.done'), { created: result.capabilities.created, reused: result.capabilities.reused })}</div>}
          {result.library && <div>{fill(t('owner.pack.lib.done'), { objects: result.library.objectsCreated, docs: result.library.documentsCopied })}</div>}
          {result.library?.failures?.length > 0 && <div className="oc-muted">{result.library.failures.join('; ')}</div>}
        </div>
      )}
      {!plan ? <Loading /> : (
        <>
          <div className="oc-grid-2">
            <div className="oc-card">
              <div className="form-group">
                <label className="form-label" htmlFor="owner-pack-industry">{t('owner.pack.industry')}<HelpTip text={t('owner.pack.industry_help')} /></label>
                <select id="owner-pack-industry" className="form-input" value={industry} onChange={e => setIndustry(e.target.value)}>
                  <option value="">{t('owner.pack.industry_detect')}</option>
                  {PACK_INDUSTRIES.map(c => <option key={c} value={c}>{t(`owner.pack.industry.${c}`)}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 13 }}>
                <strong>{t(`owner.pack.industry.${plan.industry.code}`)}</strong>
                <span className="oc-muted"> · {t(`owner.pack.basis.${plan.industry.basis}`)}{plan.industry.matched?.length ? ` (${plan.industry.matched.join(', ')})` : ''}</span>
              </div>
              <div className="oc-muted" style={{ marginTop: 6 }}>{t(`owner.pack.beneficiaries.${plan.beneficiarySource}`)}</div>
            </div>
            <div className="oc-card">
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, marginBottom: 8 }}>
                <input id="owner-pack-activate-models" type="checkbox" checked={activateModels} onChange={e => setActivateModels(e.target.checked)} />
                <span>{t('owner.pack.activate_models')}<span className="oc-muted" style={{ display: 'block' }}>{t('owner.pack.activate_models_help')}</span></span>
              </label>
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                <input id="owner-pack-activate-archs" type="checkbox" checked={activateArchitectures} onChange={e => setActivateArchitectures(e.target.checked)} />
                <span>{t('owner.pack.activate_archs')}<span className="oc-muted" style={{ display: 'block' }}>{t('owner.pack.activate_archs_help')}</span></span>
              </label>
            </div>
          </div>

          {plan.limitations?.length > 0 && (
            <div className="oc-section">
              <div className="oc-section-title">{t('owner.pack.limitations')}</div>
              <ul style={{ paddingInlineStart: 18, fontSize: 13 }}>{plan.limitations.map((l: string, i: number) => <li key={i} className="oc-muted">{l}</li>)}</ul>
            </div>
          )}

          {plan.capabilities && (
            <div className="oc-section oc-card">
              <h3>{t('owner.pack.caps.title')}<HelpTip text={t('owner.pack.caps.help')} /></h3>
              {plan.capabilities.typeCode ? (
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                  <input id="owner-pack-caps" type="checkbox" checked={withCapabilities} onChange={e => setWithCapabilities(e.target.checked)} />
                  <span>{fill(t('owner.pack.caps.load'), { n: plan.capabilities.toCreate, type: plan.capabilities.typeCode })}<span className="oc-muted" style={{ display: 'block' }}>{fill(t('owner.pack.caps.detail'), { existing: plan.capabilities.existing, core: plan.capabilities.core })}</span></span>
                </label>
              ) : <div className="oc-muted">{(plan.capabilities.limitations || []).join(' ')}</div>}
            </div>
          )}

          {lib && (
            <div className="oc-section oc-card">
              <h3>{t('owner.pack.lib.title')}<HelpTip text={t('owner.pack.lib.help')} /></h3>
              <div className="oc-muted" style={{ marginBottom: 8 }}>{lib.library.tenantId ? fill(t('owner.pack.lib.source'), { name: lib.library.name }) : t('owner.pack.lib.no_source')}</div>
              <div className="oc-grid-2">
                <div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                    <input id="owner-pack-lib-repo" type="checkbox" checked={withRepository} onChange={e => setWithRepository(e.target.checked)} />
                    <span>{fill(t('owner.pack.lib.repository'), { n: newObjects.length })}<span className="oc-muted" style={{ display: 'block' }}>{t('owner.pack.lib.repository_help')}</span></span>
                  </label>
                  <ul style={{ listStyle: 'none', fontSize: 13, marginTop: 6, display: 'grid', gap: 2 }}>
                    {lib.objects.map((o: any) => (
                      <li key={o.key}>
                        {isAR && o.nameAr ? o.nameAr : o.name}
                        <span className="oc-muted"> · {o.typeCode || '—'} · {t(`owner.pack.lib.from.${o.source}`)} · </span>
                        <span style={{ color: o.action === 'CREATE' ? 'var(--accent)' : 'var(--text-dim)' }}>{t(`owner.pack.lib.object.${o.action}`)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                    <input id="owner-pack-lib-kb" type="checkbox" checked={withKnowledge} onChange={e => setWithKnowledge(e.target.checked)} />
                    <span>{fill(t('owner.pack.lib.knowledge'), { n: chosenDocs.length })}<span className="oc-muted" style={{ display: 'block' }}>{t('owner.pack.lib.knowledge_help')}</span></span>
                  </label>
                  {lib.documents.length === 0 ? <div className="oc-muted" style={{ marginTop: 6 }}>{t('owner.pack.lib.no_documents')}</div> : (
                    <ul style={{ listStyle: 'none', fontSize: 13, marginTop: 6, display: 'grid', gap: 4 }}>
                      {lib.documents.map((d: any) => (
                        <li key={d.id}>
                          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <input id={`owner-pack-doc-${d.id}`} type="checkbox" disabled={d.action !== 'COPY' || !withKnowledge} checked={d.action === 'COPY' && !skipDocs.has(d.id)}
                              onChange={e => setSkipDocs(s => { const n = new Set(s); if (e.target.checked) n.delete(d.id); else n.add(d.id); return n })} />
                            <span>{d.name}{d.category && <> <Pill text={t(`owner.lib.category.${d.category}`)} color={LIBRARY_CATEGORY_COLOR[d.category]} /></>}<span className="oc-muted"> · {fill(t('owner.pack.lib.chunks'), { n: d.chunkCount })} · {t(`owner.pack.lib.doc.${d.action}`)}</span></span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="oc-section oc-table-wrap">
            <table className="oc-table">
              <thead><tr><th>{t('owner.pack.col.architecture')}</th><th>{t('owner.pack.col.authority')}</th><th>{t('owner.pack.col.domain')}</th><th>{t('owner.pack.col.elements')}</th><th>{t('owner.pack.col.action')}</th></tr></thead>
              <tbody>
                {plan.architectures.map((a: any) => (
                  <PackRow key={a.code} a={a} name={name(a)} actionText={actionText(a)} open={open === a.code} onToggle={() => setOpen(o => (o === a.code ? null : a.code))} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function PackRow({ a, name, actionText, open, onToggle }: { a: any; name: string; actionText: string; open: boolean; onToggle: () => void }) {
  const { t, isAR } = useLang()
  const [all, setAll] = useState(false)
  const depth = (() => {
    const parent = new Map(a.elements.map((e: any) => [e.stableKey, e.parentKey]))
    return (key: string) => { let d = 0; let p = parent.get(key); while (p && d < 6) { d++; p = parent.get(p as string) } return d }
  })()
  const shown = all ? a.elements : a.elements.slice(0, 60)
  return (
    <>
      <tr>
        <td style={{ minWidth: 220 }}>
          <button type="button" className="btn btn-sm btn-secondary" aria-expanded={open} onClick={onToggle} style={{ marginInlineEnd: 6 }}>{open ? '▴' : '▾'}</button>
          <strong>{name}</strong>
          <div className="oc-muted">{t(`owner.pack.kind.${a.kind}`)}{a.derivedFromCode ? ` · ${t('owner.pack.tailors')} ${a.derivedFromCode}` : ''}</div>
        </td>
        <td><Pill text={t(`owner.pack.provenance.${a.provenance}`)} color={a.provenance === 'OFFICIAL_STANDARD' ? 'var(--success)' : a.provenance === 'ARCHMIND_CURATED' ? 'var(--accent)' : 'var(--warning)'} /></td>
        <td className="oc-muted">{a.domainCode || '—'}</td>
        <td style={{ fontSize: 13 }}>
          {a.counts.elements}
          <div className="oc-muted">{fill(t('owner.pack.counts'), { resolved: a.counts.resolved, cfg: a.counts.configurationRequired })}</div>
        </td>
        <td><Pill text={actionText} color={PACK_ACTION_COLOR[a.action]} /></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5}>
            <div className="oc-muted" style={{ marginBottom: 6 }}>{isAR && a.descriptionAr ? a.descriptionAr : a.description}</div>
            <ul style={{ listStyle: 'none', fontSize: 13, display: 'grid', gap: 2 }}>
              {shown.map((e: any) => (
                <li key={e.stableKey} style={{ paddingInlineStart: depth(e.stableKey) * 16 }}>
                  {e.isNew && a.action !== 'CREATE' ? <strong>+ </strong> : null}
                  <span style={{ fontWeight: depth(e.stableKey) === 0 ? 600 : 400 }}>{isAR && e.nameAr ? e.nameAr : e.name}</span>
                  {' '}<span style={{ color: SOURCE_COLOR[e.source] || 'var(--text-dim)' }}>· {t(`owner.pack.source.${e.source}`)}</span>
                  {e.metaModelStatus === 'CONFIGURATION_REQUIRED' && <span style={{ color: 'var(--warning)' }}> · {t('owner.pack.config_required')}</span>}
                  {e.metaModelTypeCodes?.length > 0 && <span className="oc-muted"> · {e.metaModelTypeCodes.join(', ')}</span>}
                  {e.disposition && <span className="oc-muted"> · {t(`owner.pack.disposition.${e.disposition}`)}</span>}
                </li>
              ))}
            </ul>
            {a.elements.length > shown.length && <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAll(true)}>{fill(t('owner.pack.show_all'), { n: a.elements.length })}</button>}
          </td>
        </tr>
      )}
    </>
  )
}
