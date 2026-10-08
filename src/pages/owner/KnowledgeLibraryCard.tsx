import { useEffect, useMemo, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { LIBRARY_CATEGORY_COLOR, ownerApi } from './ownerApi'
import { ErrorBox, fill, Loading, Pill } from './ownerUi'

type Choice = 'AUTOMATIC' | 'SHARED' | 'PRIVATE'

/**
 * The knowledge library every new organization receives: the workspace whose
 * documents are shared (default test-tenant) and, per document, its
 * classification (NORA / common / the workspace organization's own) and
 * whether it is shared. Organization-specific documents are not shared
 * unless the owner shares them.
 */
export default function KnowledgeLibraryCard() {
  const { t, isAR } = useLang()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [slug, setSlug] = useState('')
  const [choices, setChoices] = useState<Record<string, Choice>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')

  const apply = (v: any) => { setData(v); setSlug(v.configuredSlug || ''); setChoices({}) }
  useEffect(() => { ownerApi.knowledgeLibrary().then(apply).catch((e: any) => setError(e.message)) }, [])

  const current = (d: any): Choice => (d.sharingBasis === 'OWNER' ? d.sharing : 'AUTOMATIC')
  const changed = useMemo(() => Object.entries(choices).filter(([id, c]) => { const d = data?.documents.find((x: any) => x.id === id); return d && current(d) !== c }), [choices, data])

  const save = async (dto: any) => {
    setSaving(true); setError(''); setSaved('')
    try { apply(await ownerApi.updateKnowledgeLibrary(dto)); setSaved(t('owner.lib.saved')) }
    catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="oc-card" dir={isAR ? 'rtl' : 'ltr'} style={{ gridColumn: '1 / -1' }}>
      <h3>{t('owner.lib.title')}<HelpTip text={t('owner.lib.help')} /></h3>
      {error && <ErrorBox error={error} />}
      {saved && <div className="oc-ok" role="status">{saved}</div>}
      {!data && !error && <Loading />}
      {data && (
        <>
          <dl className="oc-kv">
            <dt>{t('owner.lib.workspace')}</dt>
            <dd>{data.library.tenantId ? <><strong>{data.library.name}</strong> <span className="oc-muted">({data.library.slug}) · {t(`owner.lib.source.${data.library.source}`)}</span></> : <span className="oc-muted">{t('owner.lib.none')}</span>}</dd>
            <dt>{t('owner.lib.counts')}</dt>
            <dd>{fill(t('owner.lib.counts_value'), { shared: data.counts.shared, total: data.counts.total })}</dd>
          </dl>
          {data.envOverride && <p className="oc-muted" style={{ marginTop: 6 }}>{t('owner.lib.env_override')}</p>}
          <div className="form-group" style={{ marginTop: 10, maxWidth: 520 }}>
            <label className="form-label" htmlFor="owner-lib-slug">{t('owner.lib.slug')}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input id="owner-lib-slug" className="form-input" style={{ flex: '1 1 200px' }} value={slug} placeholder={data.defaultSlug} onChange={e => setSlug(e.target.value)} />
              <button type="button" className="btn btn-secondary" disabled={saving || slug.trim() === (data.configuredSlug || '')} onClick={() => save({ tenantSlug: slug.trim() || null })}>{t('owner.lib.save_workspace')}</button>
            </div>
            <span className="oc-muted">{fill(t('owner.lib.slug_help'), { slug: data.defaultSlug })}</span>
          </div>
          {data.documents.length === 0 ? <p className="oc-muted" style={{ marginTop: 10 }}>{t('owner.lib.no_documents')}</p> : (
            <div className="oc-table-wrap" style={{ marginTop: 12 }}>
              <table className="oc-table">
                <thead><tr><th>{t('owner.lib.col.document')}</th><th>{t('owner.lib.col.category')}</th><th>{t('owner.lib.col.sharing')}</th></tr></thead>
                <tbody>
                  {data.documents.map((d: any) => {
                    const choice = choices[d.id] ?? current(d)
                    return (
                      <tr key={d.id}>
                        <td><strong>{d.name}</strong><div className="oc-muted">{d.type} · {d.language}{d.status !== 'READY' || !d.chunkCount ? ` · ${t('owner.lib.not_ready')}` : ''}</div></td>
                        <td><Pill text={t(`owner.lib.category.${d.category}`)} color={LIBRARY_CATEGORY_COLOR[d.category]} /><div className="oc-muted" style={{ marginTop: 4 }}>{d.reason}</div></td>
                        <td>
                          <label htmlFor={`owner-lib-doc-${d.id}`} className="oc-muted" style={{ display: 'block' }}>{d.sharing === 'SHARED' ? t('owner.lib.shared') : t('owner.lib.private')}</label>
                          <select id={`owner-lib-doc-${d.id}`} className="form-input" value={choice} onChange={e => setChoices(c => ({ ...c, [d.id]: e.target.value as Choice }))}>
                            <option value="AUTOMATIC">{t(d.category === 'ORGANIZATION_SPECIFIC' ? 'owner.lib.choice.auto_private' : 'owner.lib.choice.auto_shared')}</option>
                            <option value="SHARED">{t('owner.lib.choice.SHARED')}</option>
                            <option value="PRIVATE">{t('owner.lib.choice.PRIVATE')}</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="modal-actions" style={{ justifyContent: 'flex-start' }}>
            <button type="button" className="btn btn-primary" disabled={saving || changed.length === 0} onClick={() => save({ documents: Object.fromEntries(changed) })}>{fill(t('owner.lib.save_documents'), { n: changed.length })}</button>
          </div>
        </>
      )}
    </div>
  )
}
