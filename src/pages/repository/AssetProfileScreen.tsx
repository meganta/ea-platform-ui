import { useCallback, useEffect, useRef, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import AssetAttributesView from './AssetAttributesView'
import AssetRelationshipsView, { arrow, slotLabel } from './AssetRelationshipsView'
import AssetEditor from './AssetEditor'
import { AssetProfile, localName } from './assetProfile'
import { metaModelLabel } from './OriginTag'
import './AssetProfile.css'
import { AssetReferenceAlignment } from '../../components/ReferenceArchitecturePanels'

type T = (k: string) => string
type Tab = 'overview' | 'attributes' | 'relationships' | 'attachments'
const FINDING_SEVERITY_COLORS: Record<string, string> = { CRITICAL: '#dc2626', HIGH: '#e74c3c', MEDIUM: '#f39c12', LOW: '#2ecc71' }

/** A profile from the API; an older API (or a plain asset) still shows its core fields. */
function normalize(data: any, fallback: any): AssetProfile {
  if (data?.asset) return data
  const asset = data && data.id ? data : fallback
  return { asset, objectType: null, resolution: 'NO_META_MODEL', attributeGroups: [], otherAttributes: [], completeness: { filled: 0, total: 0, requiredMissing: [] }, relationshipSlots: [], otherRelationships: [], relationshipTotals: { linked: 0, truncated: false } }
}

/**
 * One Repository object as a full page: what it is (core facts), every
 * attribute its Meta Model type defines, every relationship its type may
 * have, its attachments and the governance findings / roadmap items that
 * reference it - and an Edit mode for all of it.
 */
export default function AssetProfileScreen({ asset: initial, startInEdit, t, isAR, api, domains, typesFor, sourceLabel, statusClass, sourceClass, syncedLabels, onBack, onOpenAsset, onDelete, onModeChange, onChanged, onExplore }: {
  asset: any; startInEdit?: boolean; t: T; isAR: boolean; api: any; domains: string[]; typesFor: (d: string) => string[]
  sourceLabel: (a: any) => { label: string; detail?: string }; statusClass: (s: string) => string; sourceClass: (s: string) => string; syncedLabels: Record<string, string>
  onBack: () => void; onOpenAsset: (id: string, name: string) => void; onDelete: (id: string) => void; onModeChange: (edit: boolean) => void; onChanged: () => void; onExplore: (id: string) => void
}) {
  const [profile, setProfile] = useState<AssetProfile>(() => normalize(null, initial))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [editing, setEditing] = useState(!!startInEdit)
  const [saved, setSaved] = useState(false)
  const [attachments, setAttachments] = useState<any[]>(initial.attachments || [])
  const [findings, setFindings] = useState<any[]>([])
  const [findingsLoading, setFindingsLoading] = useState(true)
  const [roadmapItems, setRoadmapItems] = useState<any[]>([])
  const [roadmapLoading, setRoadmapLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    return api.get(`/ea-repository/assets/${initial.id}/profile`)
      .then((data: any) => { const p = normalize(data, initial); setProfile(p); setAttachments(p.asset.attachments || []); setError('') })
      .catch((e: any) => setError(e?.message || 'error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id, api])

  useEffect(() => {
    load()
    api.get(`/governance/findings/by-asset/${initial.id}`).then((r: any) => setFindings(Array.isArray(r?.findings) ? r.findings : [])).catch(() => setFindings([])).finally(() => setFindingsLoading(false))
    api.get(`/ea-planning/roadmap/by-asset/${initial.id}`).then((r: any) => setRoadmapItems(Array.isArray(r?.items) ? r.items : [])).catch(() => setRoadmapItems([])).finally(() => setRoadmapLoading(false))
    headingRef.current?.focus()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.id])

  const setMode = (edit: boolean) => { setEditing(edit); setSaved(false); onModeChange(edit) }
  const asset = profile.asset || initial
  const source = sourceLabel(asset)
  const slots = profile.relationshipSlots || []
  const linked = slots.reduce((n, s) => n + s.count, 0) + (profile.otherRelationships || []).length

  const uploadFile = async (e: any) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try { const result = await api.upload(`/ea-repository/assets/${asset.id}/attachments`, file); setAttachments(a => [...a, result]) } finally { setUploading(false); e.target.value = '' }
  }
  const deleteAttachment = async (attachmentId: string) => {
    if (!window.confirm(t('repository.profile.confirm_delete_attachment'))) return
    await api.del(`/ea-repository/assets/${asset.id}/attachments/${attachmentId}`)
    setAttachments(a => a.filter(x => x.id !== attachmentId))
  }
  const downloadAttachment = (attachmentId: string, name: string) => api.download(`/ea-repository/assets/${asset.id}/attachments/${attachmentId}/download`, name)
  const toggleKb = async (a: any) => { const updated = await api.put(`/ea-repository/assets/${asset.id}/attachments/${a.id}/knowledge-base`, { include: !a.inKnowledgeBase }); if (updated) setAttachments(prev => prev.map(x => (x.id === a.id ? { ...x, ...updated } : x))) }

  const synced = asset.source === 'INTEGRATION' ? Object.entries(syncedLabels).filter(([key]) => asset.metadata && asset.metadata[key] !== undefined && asset.metadata[key] !== null && asset.metadata[key] !== '') : []
  const fact = (label: string, value: any) => <div className="ap-fact"><dt>{label}</dt><dd>{value || <span className="ap-empty">{t('repository.profile.not_recorded')}</span>}</dd></div>
  const typeName = localName(profile.objectType, isAR) || asset.canonicalDisplayLabel || asset.assetType

  return (
    <div className="ap-page rp-page" dir={isAR ? 'rtl' : 'ltr'} data-testid="asset-profile">
      <header className="ap-head">
        <div className="ap-hero">
          <nav className="ap-crumbs" aria-label={t('repository.profile.breadcrumb')}>
            <button type="button" className="ap-link" onClick={onBack}>{isAR ? '→' : '←'} {t('repository.profile.back')}</button>
          </nav>
          <div className="ap-head-top">
            <div className="ap-hero-row">
              <span className="ap-type-icon" aria-hidden style={profile.objectType?.color ? { borderColor: profile.objectType.color } : undefined}>{profile.objectType?.icon || '🗄'}</span>
              <div style={{ minWidth: 0 }}>
                <h1 className="ap-title" tabIndex={-1} ref={headingRef}>{isAR && asset.nameAr ? asset.nameAr : asset.name}</h1>
                {(isAR ? asset.name : asset.nameAr) && asset.nameAr && <div className="ap-subtitle" dir={isAR ? 'ltr' : 'rtl'}>{isAR ? asset.name : asset.nameAr}</div>}
                <div className="ap-badges">
                  <span className="ap-type"><span className="ap-type-dot" style={{ background: profile.objectType?.color || 'var(--accent)' }} />{typeName}</span>
                  {asset.status && <span className={`badge ${statusClass(asset.status)}`}>{asset.status}</span>}
                  {asset.lifecycleStatus && <span className="badge badge-draft">{asset.lifecycleStatus}</span>}
                  <span className={`badge ${sourceClass(asset.source)}`} title={source.detail}>{source.label}</span>
                  {profile.metaModel?.version && <span className="ap-slot-meta">{t('repository.profile.origin.version').replace('{version}', metaModelLabel(profile, t))}</span>}
                </div>
              </div>
            </div>
            {!editing && (
              <div className="ap-actions">
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setMode(true)} disabled={loading && !profile.attributeGroups.length && !error}>✏ {t('repository.profile.edit')}</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => onExplore(asset.id)} title={t('repository.profile.explore_help')}>🕸 Explore Dependencies</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(asset.id)}>Delete Asset</button>
              </div>
            )}
          </div>
        </div>
        {!editing && (
          <div className="ap-tabs" role="tablist" aria-label={t('repository.profile.sections')}>
            {([['overview', t('repository.profile.tab.overview')], ['attributes', `${t('repository.profile.tab.attributes')} (${profile.completeness?.filled ?? 0}/${profile.completeness?.total ?? 0})`], ['relationships', `${t('repository.profile.tab.relationships')} (${linked})`], ['attachments', `${t('repository.profile.tab.attachments')} (${attachments.length})`]] as Array<[Tab, string]>).map(([key, label]) => (
              <button key={key} type="button" role="tab" id={`ap-tab-${key}`} aria-selected={tab === key} aria-controls={`ap-panel-${key}`} className="ap-tab" onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>
        )}
        {editing && <div className="ap-tabs" aria-hidden><span className="ap-tab ap-tab-static">✏ {t('repository.profile.editing')}</span></div>}
      </header>

      <div className="ap-body">
        {loading && <div role="status" className="ap-help">{t('repository.profile.loading')}</div>}
        {error && <div role="alert" className="ap-banner ap-banner-error">{t('repository.profile.load_failed')}</div>}
        {saved && !editing && <div role="status" className="ap-banner ap-banner-ok">{t('repository.profile.saved')}</div>}
        {!loading && (profile.resolution === 'UNRESOLVED' || profile.resolution === 'AMBIGUOUS') && <div className="ap-banner">{t('repository.profile.type_unresolved')}</div>}

        {editing ? (
          loading ? null : <AssetEditor profile={profile} domains={domains} typesFor={typesFor} t={t} isAR={isAR}
            onCancel={() => setMode(false)} onSaved={() => { setMode(false); setSaved(true); load(); onChanged() }} />
        ) : (
          <div role="tabpanel" id={`ap-panel-${tab}`} aria-labelledby={`ap-tab-${tab}`}>
            {tab === 'overview' && (
              <>
                <div className="stat-grid-4 rp-stats" data-testid="ap-stats">
                  <button type="button" className="rp-stat" onClick={() => setTab('attributes')}><div className="rp-stat-label">{t('repository.profile.stat.attributes')}</div><div className="rp-stat-value">{profile.completeness?.filled ?? 0}<span className="ap-slot-meta"> / {profile.completeness?.total ?? 0}</span></div></button>
                  <button type="button" className="rp-stat" onClick={() => setTab('relationships')}><div className="rp-stat-label">{t('repository.profile.stat.relationships')}</div><div className="rp-stat-value">{linked}</div></button>
                  <button type="button" className="rp-stat" onClick={() => setTab('attachments')}><div className="rp-stat-label">{t('repository.profile.stat.attachments')}</div><div className="rp-stat-value">{attachments.length}</div></button>
                  <div className="rp-stat"><div className="rp-stat-label">{t('repository.profile.stat.findings')}</div><div className="rp-stat-value">{findingsLoading ? '…' : findings.length}</div></div>
                </div>
                <AssetReferenceAlignment assetId={asset.id} />
                <section className="ap-section">
                  <dl className="ap-facts" style={{ margin: 0 }}>
                    {fact(t('repository.profile.type'), typeName)}
                    {fact(t('repository.profile.domain'), asset.operatingDomainDisplayName || asset.domain)}
                    {fact(t('repository.profile.owner'), asset.owner)}
                    {fact(t('repository.profile.lifecycle'), asset.lifecycleStatus)}
                    {fact(t('repository.profile.version'), asset.version)}
                    {fact(t('repository.profile.updated'), asset.updatedAt ? new Date(asset.updatedAt).toLocaleDateString(isAR ? 'ar-SA' : 'en-GB') : '')}
                  </dl>
                </section>
                {(asset.description || asset.descriptionAr) && (
                  <section className="ap-section">
                    <div className="ap-section-title">{t('repository.profile.description')}</div>
                    {asset.description && <p style={{ fontSize: 13, lineHeight: 1.6, margin: '0 0 6px' }} dir="auto">{asset.description}</p>}
                    {asset.descriptionAr && <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }} dir="rtl">{asset.descriptionAr}</p>}
                  </section>
                )}
                {profile.completeness?.total > 0 && (
                  <section className="ap-section">
                    <div className="ap-section-title">{t('repository.profile.completeness')}<HelpTip text={t('repository.profile.completeness_help')} /></div>
                    <div style={{ fontSize: 13 }}>{t('repository.profile.recorded_of').replace('{filled}', String(profile.completeness.filled)).replace('{total}', String(profile.completeness.total))}</div>
                    <div className="ap-meter" role="progressbar" aria-valuemin={0} aria-valuemax={profile.completeness.total} aria-valuenow={profile.completeness.filled} aria-label={t('repository.profile.completeness')}><span style={{ width: `${Math.round(100 * profile.completeness.filled / profile.completeness.total)}%` }} /></div>
                    {profile.completeness.requiredMissing.length > 0 && <div className="ap-error">{t('repository.profile.required_missing')}: {profile.completeness.requiredMissing.map(code => { const a = profile.attributeGroups.flatMap(g => g.attributes).find(x => x.code === code); return a ? localName(a, isAR) : code }).join(', ')}</div>}
                  </section>
                )}
                {slots.length > 0 && (
                  <section className="ap-section">
                    <div className="ap-section-title">{t('repository.profile.relationships')}</div>
                    <div className="ap-summary-chips">
                      {slots.filter(s => s.count > 0 || s.isRequired).map(s => (
                        <button key={`${s.definitionId}:${s.direction}`} type="button" className={`ap-chip${s.isRequired && !s.count ? ' ap-chip-warn' : ''}`} onClick={() => setTab('relationships')}>
                          {arrow(s.direction, isAR)} {slotLabel(s, isAR)} · {localName(s.otherType, isAR)} ({s.count})
                        </button>
                      ))}
                      {!slots.some(s => s.count > 0) && <span className="ap-empty" style={{ fontSize: 12 }}>{t('repository.profile.none_recorded')}</span>}
                    </div>
                  </section>
                )}
                {findingsLoading ? <div className="ap-help">{t('repository.findings_loading')}</div> : findings.length > 0 && (
                  <section className="ap-section">
                    <div className="ap-section-title">🏛 {t('repository.findings_title')} ({findings.length})<HelpTip text={t('repository.findings_help')} /></div>
                    <ul className="ap-items">{findings.map(f => (
                      <li key={f.id} className="ap-item">
                        <div className="ap-item-main"><span className="ap-chip" style={{ color: FINDING_SEVERITY_COLORS[f.severity] || undefined }}>{f.severity || '—'}</span><span style={{ fontSize: 13 }}>{f.title}</span></div>
                        <span className="ap-slot-meta">{f.status}</span>
                      </li>
                    ))}</ul>
                  </section>
                )}
                {roadmapLoading ? <div className="ap-help">{t('repository.roadmap_loading')}</div> : roadmapItems.length > 0 && (
                  <section className="ap-section">
                    <div className="ap-section-title">🗓 {t('repository.roadmap_title')} ({roadmapItems.length})<HelpTip text={t('repository.roadmap_help')} /></div>
                    <ul className="ap-items">{roadmapItems.map((item, i) => (
                      <li key={i} className="ap-item">
                        <div className="ap-item-main"><span className="ap-chip">{item.itemType === 'activity' ? t('repository.roadmap_activity') : t('repository.roadmap_deliverable')}</span><span style={{ fontSize: 13 }}>{item.name}</span></div>
                        <span className="ap-slot-meta">{item.planName}{item.periodLabel ? ` · ${item.periodLabel}` : ''}</span>
                      </li>
                    ))}</ul>
                  </section>
                )}
                {asset.tags?.length > 0 && (
                  <section className="ap-section">
                    <div className="ap-section-title">{t('repository.profile.tags')}</div>
                    <div className="ap-summary-chips">{asset.tags.map((tag: string) => <span key={tag} className="ap-chip">{tag}</span>)}</div>
                  </section>
                )}
                {synced.length > 0 && (
                  <section className="ap-section ap-group" style={{ padding: 12 }}>
                    <div className="ap-section-title">🔗 SYNCED FROM {source.label.toUpperCase()}{source.detail ? ` (${source.detail})` : ''}</div>
                    <dl className="ap-attrs">{synced.map(([key, label]) => <div key={key} className="ap-attr"><dt>{label}</dt><dd>{String(asset.metadata[key])}</dd></div>)}</dl>
                  </section>
                )}
              </>
            )}
            {tab === 'attributes' && <AssetAttributesView profile={profile} t={t} isAR={isAR} />}
            {tab === 'relationships' && <AssetRelationshipsView profile={profile} t={t} isAR={isAR} onOpenAsset={onOpenAsset} />}
            {tab === 'attachments' && (
              <section>
                <div className="ap-toolbar" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>📎 {t('repository.profile.tab.attachments')} ({attachments.length})</span>
                  <button type="button" className="btn btn-secondary btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>⬆ {uploading ? t('repository.profile.uploading') : t('repository.profile.upload')}</button>
                  <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={uploadFile} aria-label={t('repository.profile.upload')} />
                </div>
                {!attachments.length ? <p className="ap-empty">{t('repository.profile.no_attachments')}</p> : (
                  <ul className="ap-items">{attachments.map(a => (
                    <li key={a.id} className="ap-item">
                      <div style={{ minWidth: 0 }}><div style={{ fontSize: 13, overflowWrap: 'anywhere' }}>📄 {a.name}</div><div className="ap-slot-meta" dir="ltr">{(a.sizeBytes / 1024).toFixed(1)} KB · {a.mimeType}</div></div>
                      <div className="ap-item-main">
                        <span className="ap-chip">{a.inKnowledgeBase ? t('repository.profile.in_kb') : t('repository.profile.not_in_kb')}</span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleKb(a)}>{a.inKnowledgeBase ? t('repository.profile.remove_kb') : t('repository.profile.add_kb')}</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => downloadAttachment(a.id, a.name)} aria-label={`${t('repository.profile.download')} ${a.name}`}>⬇</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteAttachment(a.id)} aria-label={`${t('repository.profile.delete')} ${a.name}`}>🗑</button>
                      </div>
                    </li>
                  ))}</ul>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
