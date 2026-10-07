import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'
import DynamicFilterBuilder, { ConditionGroup } from '../components/filterBuilder/DynamicFilterBuilder'
import AssetProfileScreen from './repository/AssetProfileScreen'
import AttributeField from './repository/AttributeField'
import QuickEditModal from './repository/QuickEditModal'
import { fromInputValue, toInputValue } from './repository/assetProfile'

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'badge-draft',
  UNDER_REVIEW: 'badge-review',
  APPROVED: 'badge-approved',
  DEPRECATED: 'badge-draft',
}

const SOURCE_COLORS: Record<string, string> = {
  MANUAL: 'badge-draft',
  ADM_OUTPUT: 'badge-progress',
  UPLOAD: 'badge-active',
  INTEGRATION: 'badge-ai-draft',
}

// Demo/display heuristic, not a true foreign-key trace: EaAsset has no
// direct connectorId field (only source/sourceRef - the real link to a
// specific sync run lives in SyncStagingRecord.matchedAssetId, which
// would need a dedicated lookup this component doesn't have). For a
// source:'INTEGRATION' asset, this infers which connector it likely came
// from by the sourceRef's own prefix pattern (set by whichever script/
// sync populated it - e.g. link-hrdf-connectors-to-real-data.js uses
// 'OPM-' for ManageEngine and 'AXON-' for Informatica Axon). Good enough
// to show a real, human-readable connector name in a demo; not a
// substitute for a genuine traceability feature if that's ever needed
// beyond display purposes.
function getSourceLabel(asset: any): { label: string; detail?: string } {
  if (asset.source === 'INTEGRATION') {
    if (typeof asset.sourceRef === 'string') {
      if (asset.sourceRef.startsWith('OPM-')) return { label: 'ManageEngine OpManager', detail: asset.sourceRef }
      if (asset.sourceRef.startsWith('AXON-')) return { label: 'Informatica Axon', detail: asset.sourceRef }
    }
    return { label: 'Integration', detail: asset.sourceRef }
  }
  if (asset.source === 'ADM_OUTPUT') return { label: 'ADM Output', detail: asset.sourceRef ? `Cycle ${asset.sourceRef.slice(0, 8)}` : undefined }
  if (asset.source === 'UPLOAD') return { label: 'Upload' }
  return { label: 'Manual' }
}

// Object-type-specific attributes a connector field mapping might target
// (confirmed against this tenant's real meta-model attribute definitions -
// ITServer's cpu/memory/storage/operatingSystem/networkZone/ipAddress,
// ConceptualDataEntity's dataFormat/dataCategory/canStoreOutsideKSA - see
// scripts/link-hrdf-connectors-to-real-data.js). Anything else present in
// metadata (e.g. leftover fields from a manual JSON edit) is intentionally
// not shown here - this section is specifically "what a connector synced
// onto this asset," not a raw metadata dump.
const SYNCED_ATTRIBUTE_LABELS: Record<string, string> = {
  ipAddress: 'IP Address', cpu: 'CPU (cores)', memory: 'Memory (GB)', storage: 'Storage (GB)',
  operatingSystem: 'Operating System', networkZone: 'Network Zone',
  dataFormat: 'Data Format', dataCategory: 'Data Category', canStoreOutsideKSA: 'Can Store Outside KSA',
}

// Some tenant framework configurations still expose the legacy plural
// APPLICATIONS domain. Keep that compatibility at the config boundary so
// Repository filters and edit payloads consistently use the canonical
// APPLICATION domain without losing object types stored under the old key.
function normalizeRepositoryDomain(domain: string): string {
  return domain === 'APPLICATIONS' ? 'APPLICATION' : domain
}

// Bug fix + refinement (live testing correction, then explicit follow-up
// direction to keep the tenant-scoping feature working correctly rather
// than dropping it): getRepositoryDomains previously either always read
// the stale config.enabledDomains, or (a first-pass fix) ignored it
// entirely once metaModelDriven was true. Neither is right:
// enabledDomains IS a real, user-configurable setting (set via the Setup
// Assistant's "domains in scope" step, PUT /config/framework) - a
// tenant's deliberate choice to scope down which domains they focus on,
// which deserves to be respected, not silently ignored.
// The actual bug was that enabledDomains can contain domain codes that
// no longer match the tenant's current, published Meta Model at all
// (confirmed live: "BENEFICIARY_EXPERIENCE" in enabledDomains vs the
// real Meta Model code "BENEFICIARY" - matching zero real assets).
// Fix: intersect enabledDomains with the live Meta Model's own domain
// codes (config.allDomains' keys) whenever a Meta Model exists - a
// tenant's scoping choice is honored only for domains that still
// genuinely exist. If the intersection is empty (every stored
// enabledDomains entry is stale/unmatched), that scoping choice is
// itself meaningless against the current Meta Model - falls back to
// showing every current Meta Model domain rather than an empty dropdown.
function getRepositoryDomains(config: any): string[] {
  if (!config?.metaModelDriven) {
    return Array.from(new Set((config?.enabledDomains || []).map(normalizeRepositoryDomain)))
  }
  const liveMetaModelDomains = Object.keys(config?.allDomains || {})
  const enabledNormalized = new Set((config?.enabledDomains || []).map(normalizeRepositoryDomain))
  const scoped = liveMetaModelDomains.filter(d => enabledNormalized.has(normalizeRepositoryDomain(d)))
  return Array.from(new Set((scoped.length > 0 ? scoped : liveMetaModelDomains).map(normalizeRepositoryDomain)))
}

function getRepositoryAssetTypes(config: any, domain: string): string[] {
  if (!domain) return []
  const allDomains = config?.allDomains || {}
  if (domain === 'APPLICATION') {
    return Array.from(new Set([...(allDomains.APPLICATION || []), ...(allDomains.APPLICATIONS || [])]))
  }
  return allDomains[domain] || []
}

// Memoized (CLAUDE.md convention): an unmemoized object re-fires every effect that depends on it on each render.
function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    const put = (path: string, body: any) => fetch(`${API_URL}${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
    const del = (path: string) => fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    const upload = (path: string, file: File) => {
      const fd = new FormData(); fd.append('file', file)
      return fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd }).then(r => r.json())
    }
    const download = (path: string, name: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = name; a.click()
      URL.revokeObjectURL(url)
    })
    return { get, post, put, del, upload, download }
  }, [])
}

function AssetModal({ asset, config, onClose, onSave, t, api }: any) {
  const [form, setForm] = useState(() => {
    const initialForm = asset || { name: '', nameAr: '', description: '', domain: '', assetType: '', status: 'DRAFT', owner: '', tags: [], metadata: {} }
    return { ...initialForm, domain: normalizeRepositoryDomain(initialForm.domain) }
  })
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }))
  const domains = getRepositoryDomains(config)
  const assetTypes = getRepositoryAssetTypes(config, form.domain)

  // EA Repository Production Readiness, item 5: the form's attribute
  // fields are dynamically driven by the tenant's real Meta Model
  // (GET /ea-repository/object-types/:assetType/attributes), never a
  // per-object-type hardcoded form. Re-fetched whenever the selected
  // assetType changes.
  const [metaAttributes, setMetaAttributes] = useState<any[]>([])
  useEffect(() => {
    if (!form.assetType) { setMetaAttributes([]); return }
    api.get(`/ea-repository/object-types/${encodeURIComponent(form.assetType)}/attributes`)
      .then((r: any) => setMetaAttributes(Array.isArray(r?.attributes) ? r.attributes : []))
      .catch(() => setMetaAttributes([]))
  }, [form.assetType, api])

  const submit = async (e: any) => {
    e.preventDefault(); setLoading(true)
    try { await onSave(form) } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 560, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-title">{asset ? 'Edit Asset' : 'New EA Asset'}</div>
        <form onSubmit={submit}>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group"><label className="form-label" htmlFor="asset-name">Name (English) *</label><input id="asset-name" className="form-input" value={form.name} onChange={set('name')} required /></div>
            <div className="form-group"><label className="form-label" htmlFor="asset-name-ar">Name (Arabic)</label><input id="asset-name-ar" className="form-input" value={form.nameAr || ''} onChange={set('nameAr')} dir="rtl" /></div>
          </div>
          <div className="form-group"><label className="form-label" htmlFor="asset-description">Description</label><textarea id="asset-description" className="form-input" value={form.description || ''} onChange={set('description')} rows={2} /></div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-domain">Domain *</label>
              <select id="asset-domain" className="form-input" value={form.domain} onChange={e => setForm((f: any) => ({ ...f, domain: e.target.value, assetType: '' }))} required>
                <option value="">Select domain...</option>
                {domains.map((d: string) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-type">Asset Type *</label>
              <select id="asset-type" className="form-input" value={form.assetType} onChange={set('assetType')} required disabled={!form.domain}>
                <option value="">Select type...</option>
                {assetTypes.map((t: string) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="asset-status">Status</label>
              <select id="asset-status" className="form-input" value={form.status} onChange={set('status')}>
                {['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label" htmlFor="asset-owner">Owner</label><input id="asset-owner" className="form-input" value={form.owner || ''} onChange={set('owner')} /></div>
          </div>

          {/* EA Repository Production Readiness, item 5: dynamic Meta
              Model attribute fields - the same component/form for every
              object type, driven entirely by metaAttributes. An enum
              attribute renders as a select (using its declared values),
              anything else as a plain text input. */}
          {metaAttributes.length > 0 && (
            <>
              <div className="divider" />
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>META MODEL ATTRIBUTES</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {metaAttributes.map((attr: any) => (
                  <AttributeField key={attr.code} def={attr} idPrefix="asset-attr" isAR={false} t={t}
                    value={toInputValue(attr.attributeType, form.metadata?.[attr.code])}
                    onChange={v => setForm((f: any) => ({ ...f, metadata: { ...(f.metadata || {}), [attr.code]: fromInputValue(attr.attributeType, v) } }))} />
                ))}
              </div>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving...' : 'Save Asset'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RepositoryPage() {
  const { t, isAR } = useLang() as any
  const api = useApi()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [config, setConfig] = useState<any>(null)
  const [assets, setAssets] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL')
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL')
  const [selectedSource, setSelectedSource] = useState<string>('ALL')
  // Data-taxonomy investigation, this session: assets whose domain/
  // assetType no longer resolve against the tenant's current Meta Model
  // (e.g. created before the tenant's first Meta Model publish) are kept
  // out of the default list, but discoverably so via this explicit
  // toggle - never silently hidden forever.
  const [showNeedsReclassification, setShowNeedsReclassification] = useState(false)
  const [selectedAssetType, setSelectedAssetType] = useState<string>('ALL')
  const [groupByCycle, setGroupByCycle] = useState<boolean>(false)
  const [showAdd, setShowAdd] = useState(false)
  // ✏ in the list opens a quick edit popup (attributes only); the full page keeps relationships.
  const [quickEdit, setQuickEdit] = useState<any>(null)
  const [selectedAsset, setSelectedAsset] = useState<any>(null)
  // An opened object is shown as its own page (view or edit) in place of the list; the URL
  // (?asset=<id>[&mode=edit]) follows it, so the browser's Back returns to the list.
  const [startInEdit, setStartInEdit] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  // EA Repository Production Readiness, item 2: server-side pagination -
  // 50/page is a reasonable default for a fast initial load without
  // building sophisticated page-size UX beyond what's needed.
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [total, setTotal] = useState(0)
  // Meta Model-driven Dynamic Filter Builder (additive, see
  // DynamicFilterBuilder) - null means "no structured filter active", in
  // which case load() below uses the existing simple filters exactly as
  // before (task section 11's "preserve existing simple filters" /
  // section 25's compatibility requirement).
  const [structuredQuery, setStructuredQuery] = useState<ConditionGroup | null>(null)
  // Separate draft state: DynamicFilterBuilder edits this freely (every
  // keystroke) without triggering a query - only clicking "Apply filters"
  // copies it into structuredQuery, which is the one actually in load()'s
  // effect dependencies below. Without this split, every keystroke in a
  // text condition's value box re-queried the server on every character,
  // making "Apply" meaningless (explicit correction from live testing).
  const [draftQuery, setDraftQuery] = useState<ConditionGroup | null>(null)
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)

  // Debounces the search box specifically - a keystroke updates `search`
  // (the input's own responsive value) immediately, but the actual API
  // call (driven by debouncedSearch below) waits 300ms after typing
  // stops, avoiding one request per character on a server-side search.
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = async () => {
    const [cfg, sum] = await Promise.all([
      api.get('/ea-repository/framework-config'),
      api.get('/ea-repository/summary'),
    ])
    setConfig(cfg)
    setSummary(sum)
    if (structuredQuery && selectedAssetType !== 'ALL') {
      // Meta Model-driven Dynamic Filter Builder active - server-side
      // filtering/pagination via the shared Architecture Query Engine
      // (task section 11's "expected Repository behavior" steps 4-6).
      const result = await api.post('/ea-repository/assets/query', { query: { rootObjectType: selectedAssetType, conditionGroup: structuredQuery }, page, pageSize })
      setAssets(result.items || []); setTotal(result.total || 0)
      return
    }
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (selectedDomain !== 'ALL') params.set('domain', selectedDomain)
    if (selectedStatus !== 'ALL') params.set('status', selectedStatus)
    if (selectedSource !== 'ALL') params.set('source', selectedSource)
    if (selectedAssetType !== 'ALL') params.set('assetType', selectedAssetType)
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (showNeedsReclassification) params.set('needsReclassification', 'true')
    const result = await api.get(`/ea-repository/assets?${params.toString()}`)
    // Backward-compatible with the pre-pagination shape (a plain array) in
    // case of a stale cached response during a rolling deploy - treats it
    // as a single, already-complete page rather than crashing.
    if (Array.isArray(result)) { setAssets(result); setTotal(result.length) }
    else { setAssets(result.items || []); setTotal(result.total || 0) }
  }

  useEffect(() => { load() }, [page, selectedDomain, selectedStatus, selectedSource, selectedAssetType, debouncedSearch, structuredQuery, showNeedsReclassification]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resets to page 1 whenever a filter actually changes - a filter
  // change while sitting on page 5 of the old result set should not
  // silently show an empty/wrong page of the new, filtered set. Applies
  // equally to the structured filter builder (task section 11, step 8).
  const changeFilter = (setter: (v: string) => void) => (value: string) => { setter(value); setPage(1) }
  const applyStructuredQuery = () => { setStructuredQuery(draftQuery); setPage(1) }
  const clearStructuredQuery = () => { setDraftQuery(null); setStructuredQuery(null); setPage(1) }
  const toggleFilterBuilder = () => {
    // Opening the panel seeds the draft from whatever is currently
    // applied, so re-opening to tweak an already-applied filter shows
    // the actual applied conditions rather than a blank builder.
    if (!showFilterBuilder) setDraftQuery(structuredQuery)
    setShowFilterBuilder(s => !s)
  }

  // The filter builder's conditions are specific to the object type they
  // were built for - changing the object type invalidates them, so this
  // clears (rather than silently carrying over a now-meaningless
  // structured query for the previous type).
  const prevAssetType = useRef(selectedAssetType)
  useEffect(() => {
    if (prevAssetType.current !== selectedAssetType) { setDraftQuery(null); setStructuredQuery(null); setShowFilterBuilder(false) }
    prevAssetType.current = selectedAssetType
  }, [selectedAssetType])

  // Deep-link support (Copilot Phase 1's evidence drawer links here as
  // ?assetId=<id>) - fetches the asset directly by id rather than relying
  // on it being present in the currently-loaded/filtered `assets` list,
  // so the link works regardless of filters or pagination. Clears the
  // query param once handled so it doesn't re-trigger on an unrelated
  // re-render or linger in the URL after the modal is closed.
  useEffect(() => {
    const opened = searchParams.get('asset')
    if (opened && !searchParams.get('assetId')) { setSelectedAsset({ id: opened, name: '' }); setStartInEdit(searchParams.get('mode') === 'edit'); return }
    const assetId = searchParams.get('assetId')
    if (!assetId) return
    let found = false
    api.get(`/ea-repository/assets/${assetId}`)
      .then((fresh: any) => { if (fresh && fresh.id) { found = true; setSelectedAsset(fresh) } })
      .catch(() => {}) // asset may have been deleted, or id is stale/invalid - fail silently, nothing opens
      .finally(() => {
        searchParams.delete('assetId')
        if (found) searchParams.set('asset', assetId)
        setSearchParams(searchParams, { replace: true })
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const createAsset = async (form: any) => {
    await api.post('/ea-repository/assets', form)
    setShowAdd(false)
    await load()
  }

  const openAsset = (a: any, edit = false) => {
    setSelectedAsset(a); setStartInEdit(edit)
    const next = new URLSearchParams(searchParams)
    next.delete('assetId'); next.set('asset', a.id)
    if (edit) next.set('mode', 'edit'); else next.delete('mode')
    setSearchParams(next)
    window.scrollTo?.(0, 0)
  }
  const closeAsset = () => {
    setSelectedAsset(null); setStartInEdit(false)
    const next = new URLSearchParams(searchParams)
    next.delete('asset'); next.delete('mode')
    setSearchParams(next)
  }
  // Back / forward in the browser: the list or the object follows the URL.
  const urlAsset = searchParams.get('asset')
  useEffect(() => {
    if (!urlAsset && selectedAsset && !searchParams.get('assetId')) { setSelectedAsset(null); setStartInEdit(false) }
    else if (urlAsset && selectedAsset && urlAsset !== selectedAsset.id) { setSelectedAsset({ id: urlAsset, name: '' }) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAsset])

  const deleteAsset = async (id: string) => {
    if (!window.confirm('Delete this asset?')) return
    await api.del(`/ea-repository/assets/${id}`)
    if (selectedAsset?.id === id) closeAsset()
    await load()
  }

  // Filtering/search is now server-side (item 2) - `assets` is already
  // the current, filtered page of results, not the whole repository.
  // `filtered` name kept for the smallest possible diff to the render
  // logic below (groupByCycle, the table, the empty state).
  const filtered = assets

  const domains = getRepositoryDomains(config)
  // EA Repository Production Readiness, item 2: object-type filter
  // values come from the tenant Meta Model (config.allDomains, already
  // Meta-Model-driven since Decision 3), not a hardcoded frontend list
  // or a list derived from whatever happens to be on the current page.
  // Scoped to the selected domain when one is chosen, otherwise every
  // type across every domain.
  const repoAssetTypes: string[] = selectedDomain !== 'ALL'
    ? getRepositoryAssetTypes(config, selectedDomain)
    : Array.from(new Set(Object.values(config?.allDomains || {}).flat() as string[])).sort()

  // Group by cycle
  const groupedAssets: Record<string, any[]> = {}
  if (groupByCycle) {
    filtered.forEach((a:any) => {
      const key = a.source === 'ADM_OUTPUT' && a.sourceRef
        ? `ADM Cycle: ${a.sourceRef.slice(0,8)}`
        : a.source === 'MANUAL' ? 'Manual Entries'
        : a.source === 'UPLOAD' ? 'Uploads'
        : 'Other'
      if (!groupedAssets[key]) groupedAssets[key] = []
      groupedAssets[key].push(a)
    })
  }

  if (selectedAsset) {
    return (
      <div>
        <AssetProfileScreen key={selectedAsset.id} asset={selectedAsset} startInEdit={startInEdit} t={t} isAR={!!isAR} api={api}
          domains={domains} typesFor={(d: string) => getRepositoryAssetTypes(config, d)}
          sourceLabel={getSourceLabel} statusClass={(st: string) => STATUS_COLORS[st] || 'badge-draft'} sourceClass={(src: string) => SOURCE_COLORS[src] || 'badge-draft'} syncedLabels={SYNCED_ATTRIBUTE_LABELS}
          onBack={closeAsset} onOpenAsset={(id: string, name: string) => openAsset({ id, name })} onDelete={deleteAsset}
          onModeChange={(edit: boolean) => { const next = new URLSearchParams(searchParams); next.set('asset', selectedAsset.id); if (edit) next.set('mode', 'edit'); else next.delete('mode'); setSearchParams(next, { replace: true }) }}
          onChanged={() => { load() }} onExplore={(id: string) => navigate(`/ea-views?objectContext=${id}`)} />
      </div>
    )
  }

  const statusCount = (st: string) => (summary?.byStatus || []).find((x: any) => x.status === st)?.count || 0
  const STATUS_TILES = ['APPROVED', 'UNDER_REVIEW', 'DRAFT', 'DEPRECATED']
  return (
    <div className="rp-page" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="rp-header">
        <div className="rp-header-main">
          <h1 className="rp-title page-title">🗄 {t('repo.title')}<HelpTip text={t('repository.list.help')} /></h1>
          <div className="rp-sub page-subtitle">
            {config?.frameworkType} FRAMEWORK · {summary?.total || 0} ASSETS
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Asset</button>
        {!!summary?.needsReclassificationCount && (
          <div className="rp-banner">
            <span>⚠ {summary.needsReclassificationCount} asset{summary.needsReclassificationCount === 1 ? '' : 's'} could not be automatically matched to the current Meta Model and need manual reclassification.</span>
            <button type="button" onClick={() => setShowNeedsReclassification(s => !s)} style={{ marginInlineStart: 'auto', fontSize: 12, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', background: showNeedsReclassification ? 'var(--accent)' : 'transparent', color: showNeedsReclassification ? '#fff' : 'var(--text)' }}>
              {showNeedsReclassification ? 'Show Normal List' : 'Review These Assets'}
            </button>
          </div>
        )}
      </div>

      <div className="rp-content">
        {/* Totals and status tiles (a status tile filters the list by that status). */}
        <div className="stat-grid-5 rp-stats" data-testid="repo-stats">
          <button type="button" className="rp-stat" aria-pressed={selectedStatus === 'ALL'} onClick={() => changeFilter(setSelectedStatus)('ALL')}>
            <div className="rp-stat-label">{t('repository.list.stat.total')}</div><div className="rp-stat-value">{(summary?.total || 0).toLocaleString(isAR ? 'ar-SA' : 'en-US')}</div>
          </button>
          {STATUS_TILES.map(st => (
            <button key={st} type="button" className="rp-stat" aria-pressed={selectedStatus === st} onClick={() => changeFilter(setSelectedStatus)(selectedStatus === st ? 'ALL' : st)}>
              <div className="rp-stat-label">{t(`repository.profile.status.${st}`)}</div><div className="rp-stat-value">{statusCount(st).toLocaleString(isAR ? 'ar-SA' : 'en-US')}</div>
            </button>
          ))}
        </div>
        <div className="rp-card rp-filters">
          <input className="form-input" style={{ flex: 1, minWidth: 200 }} placeholder="Search assets..." aria-label="Search assets" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input" style={{ width: 150 }} value={selectedSource} onChange={e => {
            const nextSource = e.target.value
            changeFilter(setSelectedSource)(nextSource)
            if (nextSource !== 'ADM_OUTPUT') {
              // Group by Cycle only makes sense for ADM Output - reset it
              // when switching away so it's never left silently checked
              // behind a now-hidden control.
              setGroupByCycle(false)
            } else {
              // Domain/Object Type don't apply to ADM Output and their
              // controls are hidden while it's selected - reset them
              // rather than leaving a filter silently active that the
              // user can no longer see or change. Clearing
              // selectedAssetType already triggers the existing
              // prevAssetType effect below, which clears
              // draftQuery/structuredQuery/showFilterBuilder for us.
              setSelectedDomain('ALL')
              setSelectedAssetType('ALL')
            }
          }}>
            <option value="ALL">All Sources</option>
            <option value="ADM_OUTPUT">ADM Output</option>
            <option value="MANUAL">Manual</option>
            <option value="UPLOAD">Upload</option>
            <option value="INTEGRATION">Integration</option>
            <option value="AI_GENERATED">AI Generated</option>
          </select>
          {selectedSource === 'ADM_OUTPUT' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={groupByCycle} onChange={e => setGroupByCycle(e.target.checked)} />
              Group by Cycle
            </label>
          ) : (
            <>
              <select className="form-input" style={{ width: 140 }} value={selectedDomain} onChange={e => { changeFilter(setSelectedDomain)(e.target.value); setSelectedAssetType('ALL') }}>
                <option value="ALL">All Domains</option>
                {domains.map((d: string) => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
              <select className="form-input" style={{ width: 140 }} value={selectedAssetType} onChange={e => changeFilter(setSelectedAssetType)(e.target.value)}>
                <option value="ALL">All Types</option>
                {repoAssetTypes.map((t:any) => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
            </>
          )}
          <select className="form-input" style={{ width: 160 }} value={selectedStatus} onChange={e => changeFilter(setSelectedStatus)(e.target.value)}>
            <option value="ALL">All Statuses</option>
            {['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'DEPRECATED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          {selectedSource !== 'ADM_OUTPUT' && selectedAssetType !== 'ALL' && (
            <button type="button" onClick={toggleFilterBuilder} style={{ fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', background: structuredQuery ? 'var(--accent)' : 'var(--navy-mid)', color: structuredQuery ? '#fff' : 'var(--text)' }}>
              ⚙ {showFilterBuilder ? 'Hide' : 'Advanced'} Filters{structuredQuery ? ` (${structuredQuery.conditions.length})` : ''}
            </button>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {total > 0 ? `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} of ${total}` : '0 of 0'}
          </div>
        </div>

        {/* Meta Model-driven Dynamic Filter Builder (task section 11) -
            gated on a specific object type being selected, since the
            builder's discovery endpoint requires one. */}
        {showFilterBuilder && selectedAssetType !== 'ALL' && (
          <DynamicFilterBuilder
            objectType={selectedAssetType}
            api={api}
            value={draftQuery}
            onChange={setDraftQuery}
            onApply={applyStructuredQuery}
            onClear={clearStructuredQuery}
          />
        )}

        {/* Assets table */}
        {groupByCycle && Object.keys(groupedAssets).length > 0 ? (
          <div>
            {Object.entries(groupedAssets).map(([group, items]) => (
              <div key={group} style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 8, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  📁 {group} <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>({items.length} assets)</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead><tr>
                    <th>{t('repo.col_name')}</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>{items.map((a:any) => (
                    <tr key={a.id} onClick={() => openAsset(a)} style={{ cursor: 'pointer' }}>
                      <td><div style={{ fontWeight: 500 }}>{a.name}</div>{a.nameAr && <div style={{ fontSize: 11, color: 'var(--text-dim)', direction: 'rtl' }}>{a.nameAr}</div>}</td>
                      <td style={{ fontSize: 11 }}>{(a.domain||'').replace(/_/g,' ')}</td>
                      <td style={{ fontSize: 11 }}>{a.canonicalDisplayLabel || (a.assetType||'').replace(/_/g,' ')}</td>
                      <td><span className={`badge ${STATUS_COLORS[a.status]||''}`}>{a.status}</span></td>
                      <td><button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }} onClick={e => { e.stopPropagation(); deleteAsset(a.id) }}>🗑</button></td>
                    </tr>
                  ))}</tbody>
                </table>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty rp-card">
            <div style={{ fontSize: 40 }}>🗄</div>
            <div className="empty-title">No assets found</div>
            <div className="empty-sub">Create your first EA asset or adjust the filters</div>
            <button className="btn btn-primary mt-4" onClick={() => setShowAdd(true)}>+ New Asset</button>
          </div>
        ) : (
          <div className="rp-card rp-card-flush rp-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Domain</th>
                <th>Type</th>
                <th>Status</th>
                <th>Source</th>
                <th>Owner</th>
                <th>Files</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => openAsset(a)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{a.name}</div>
                    {a.nameAr && <div style={{ fontSize: 11, color: 'var(--text-dim)', direction: 'rtl' }}>{a.nameAr}</div>}
                  </td>
                  <td><span className="rp-domain-tag">{a.domain}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{a.canonicalDisplayLabel || a.assetType?.replace(/_/g, ' ')}</td>
                  <td><span className={`badge ${STATUS_COLORS[a.status] || 'badge-draft'}`}>{a.status.replace(/_/g, ' ')}</span></td>
                  <td><span className={`badge ${SOURCE_COLORS[a.source] || 'badge-draft'}`} title={getSourceLabel(a).detail}>{getSourceLabel(a).label}</span></td>
                  <td style={{ fontSize: 12 }}>{a.owner || '—'}</td>
                  <td style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{a._count?.attachments || 0}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setQuickEdit(a) }} aria-label={`${t('repository.profile.edit')} ${a.name}`}>✏</button>
                      <button onClick={() => deleteAsset(a.id)} style={{ background: 'none', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius)', color: 'var(--danger)', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* EA Repository Production Readiness, item 2: server-side
            pagination controls - only shown for the normal (non-grouped)
            view, since groupByCycle is a niche secondary display already
            operating on the current page's results. */}
        {!groupByCycle && total > pageSize && (
          <div className="flex items-center justify-center gap-2 mt-4" style={{ fontSize: 12 }}>
            <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
            <button className="btn btn-secondary btn-sm" disabled={page * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next ›</button>
          </div>
        )}
      </div>

      {quickEdit && (
        <QuickEditModal assetId={quickEdit.id} domains={getRepositoryDomains(config)} typesFor={(d: string) => getRepositoryAssetTypes(config, d)} t={t} isAR={!!isAR} onClose={() => setQuickEdit(null)}
          onSaved={() => { setQuickEdit(null); load() }} onOpenFull={() => { const a = quickEdit; setQuickEdit(null); openAsset(a, true) }} />
      )}
      {showAdd && <AssetModal config={config} onClose={() => setShowAdd(false)} onSave={createAsset} t={t} api={api} />}
    </div>
  )
}
