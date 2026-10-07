import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import HelpTip from '../components/HelpTip'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import ReferenceDiagram from './refarch/ReferenceDiagram'
import ElementDrawer from './refarch/ElementDrawer'
import ImportWizard from './refarch/ImportWizard'
import { ElementConformance, RefApi, RefElement, STATUS_COLOR, STATUS_ORDER, T, localName, makeApi } from './refarch/refArch'
import './repository/AssetProfile.css'
import './refarch/ReferenceArchitecture.css'

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'
const KINDS = ['REFERENCE_MODEL', 'REFERENCE_ARCHITECTURE', 'REFERENCE_PATTERN']
type Tab = 'overview' | 'architecture' | 'actual' | 'conformance' | 'target' | 'tailoring' | 'controls' | 'usage' | 'versions'
const TABS: Tab[] = ['overview', 'architecture', 'actual', 'conformance', 'target', 'tailoring', 'controls', 'usage', 'versions']
/** A reference model is structure only (never implemented): no implementation, conformance, Current -> Target or traces tabs. */
const MODEL_HIDDEN_TABS: Tab[] = ['actual', 'conformance', 'target', 'controls']
const isModel = (a: any) => a?.kind === 'REFERENCE_MODEL'

function useApi(): RefApi {
  return useMemo(() => makeApi(API_URL), [])
}

function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  return msg ? <div className={`ra-msg ${msg.ok ? 'ra-msg-ok' : 'ra-msg-err'}`} role="status">{msg.text}</div> : null
}

function StatusChip({ status, t }: { status: string; t: T }) {
  return <span className="ra-chip"><span className="ra-dot" style={{ background: STATUS_COLOR[status] || '#94A3B8' }} aria-hidden="true" />{t(`refarch.conf.${status}`)}</span>
}

// ── Create form ────────────────────────────────────────────────────────────

function CreateForm({ api, t, domains, architectures, onCreated, onCancel }: { api: RefApi; t: T; domains: Array<{ code: string; name: string }>; architectures: any[]; onCreated: (a: any) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: '', nameAr: '', kind: 'REFERENCE_ARCHITECTURE', authorityLevel: 'ORGANIZATION', domainCode: '', derivedFromId: '', owner: '', description: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const set = (k: string) => (e: any) => setF(x => ({ ...x, [k]: e.target.value }))
  const submit = () => api.post('/reference-architectures', { ...f, domainCode: f.domainCode || undefined, derivedFromId: f.derivedFromId || undefined, nameAr: f.nameAr || undefined, owner: f.owner || undefined, description: f.description || undefined }).then(onCreated).catch(e => setMsg({ ok: false, text: e.message }))
  return (
    <div className="rp-card" data-testid="ra-create">
      <div className="rp-card-title">{t('refarch.list.new')}</div>
      <Msg msg={msg} />
      <div className="ra-form-grid">
        <div className="form-group"><label className="form-label" htmlFor="ra-new-name">{t('refarch.form.name')}</label><input id="ra-new-name" className="form-input" value={f.name} onChange={set('name')} /></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-new-namear">{t('refarch.form.name_ar')}</label><input id="ra-new-namear" className="form-input" dir="rtl" value={f.nameAr} onChange={set('nameAr')} /></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-new-kind">{t('refarch.kind')}</label><select id="ra-new-kind" className="form-input" value={f.kind} onChange={set('kind')}>{KINDS.map(k => <option key={k} value={k}>{t(`refarch.kind.${k}`)}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-new-auth">{t('refarch.authority')}</label><select id="ra-new-auth" className="form-input" value={f.authorityLevel} onChange={set('authorityLevel')}>{['NATIONAL', 'EXTERNAL_FRAMEWORK', 'ORGANIZATION'].map(k => <option key={k} value={k}>{t(`refarch.authority.${k}`)}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-new-domain">{t('refarch.domain')}</label><select id="ra-new-domain" className="form-input" value={f.domainCode} onChange={set('domainCode')}><option value="">{t('refarch.list.cross_domain')}</option>{domains.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-new-derived">{t('refarch.form.derived')}</label><select id="ra-new-derived" className="form-input" value={f.derivedFromId} onChange={set('derivedFromId')}><option value="">{t('refarch.form.none')}</option>{architectures.filter(a => a.kind === 'REFERENCE_MODEL').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-new-owner">{t('refarch.owner')}</label><input id="ra-new-owner" className="form-input" value={f.owner} onChange={set('owner')} /></div>
      </div>
      <div className="form-group"><label className="form-label" htmlFor="ra-new-desc">{t('refarch.form.description')}</label><textarea id="ra-new-desc" className="form-input" rows={2} value={f.description} onChange={set('description')} /></div>
      <div className="flex gap-2"><button type="button" className="btn btn-primary" disabled={!f.name.trim()} onClick={submit}>{t('refarch.form.create')}</button><button type="button" className="btn btn-secondary" onClick={onCancel}>{t('common.cancel')}</button></div>
    </div>
  )
}

// ── Workspace ──────────────────────────────────────────────────────────────

function Workspace({ id, api, t, isAR, metaModel, onBack }: { id: string; api: RefApi; t: T; isAR: boolean; metaModel: any; onBack: () => void }) {
  const navigate = useNavigate()
  const { hasPermission } = useAuth() as any
  const isAdmin = !!hasPermission?.('Tenant.Administer')
  const [arch, setArch] = useState<any>(null)
  const [versionId, setVersionId] = useState<string | null>(null)
  const [version, setVersion] = useState<any>(null)
  const [conf, setConf] = useState<any>(null)
  const [scenarios, setScenarios] = useState<any[]>([])
  const [scenarioId, setScenarioId] = useState('')
  const [archKind, setArchKind] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadArch = useCallback(() => api.get(`/reference-architectures/${id}`).then(a => {
    setArch(a); setArchKind(a.kind)
    setVersionId(v => v || a.activeVersionId || a.versions?.[0]?.id || null)
  }).catch(e => setError(e.message)), [api, id])
  const loadVersion = useCallback(() => {
    if (!versionId) return
    api.get(`/reference-architectures/versions/${versionId}`).then(setVersion).catch(e => setError(e.message))
    // A reference model is never implemented: it has no conformance to load.
    if (archKind === 'REFERENCE_MODEL') { setConf(null); return }
    if (!archKind) return
    api.get(`/reference-architectures/${id}/conformance?versionId=${versionId}${scenarioId ? `&scenarioId=${scenarioId}` : ''}`).then(setConf).catch(() => setConf(null))
  }, [api, id, versionId, scenarioId, archKind])
  useEffect(() => { loadArch(); api.get('/ea-views/scenarios').then(r => setScenarios(Array.isArray(r) ? r : [])).catch(() => setScenarios([])) }, [loadArch, api])
  useEffect(() => { loadVersion() }, [loadVersion])

  const refresh = () => { loadArch(); loadVersion() }
  const act = (fn: () => Promise<any>, ok = '✓') => fn().then(() => { setMsg({ ok: true, text: ok }); refresh() }).catch(e => setMsg({ ok: false, text: e.message }))

  if (error) return <div className="rp-content"><div className="ra-msg ra-msg-err" role="alert">{error}</div><button type="button" className="btn btn-secondary" onClick={onBack}>{t('refarch.back')}</button></div>
  if (!arch || !version) return <div className="rp-content" aria-busy="true">{t('refarch.loading')}</div>

  const elements: RefElement[] = version.elements || []
  const confByKey: Record<string, ElementConformance> = Object.fromEntries((conf?.elements || []).map((e: ElementConformance) => [e.stableKey, e]))
  const draft = version.status === 'DRAFT'
  const pending = elements.filter(e => e.reviewStatus === 'PROPOSED')
  const selectedEl = elements.find(e => e.stableKey === selected) || null
  const parentName = selectedEl?.parentKey ? (() => { const p = elements.find(e => e.stableKey === selectedEl.parentKey); return p ? localName(p, isAR) : null })() : null
  const domainName = (code: string | null) => (code ? metaModel?.domains?.find((d: any) => d.code === code)?.name || code : t('refarch.list.cross_domain'))
  const openInViews = () => api.get('/ea-views/viewpoints').then((vps: any[]) => {
    const vp = (vps || []).find(v => v.code === 'REF_ARCH_OVERVIEW')
    if (!vp) throw new Error(t('refarch.error'))
    return api.post(`/ea-views/open-viewpoint/${vp.id}`, {}).then((v: any) => navigate(`/ea-views?viewId=${encodeURIComponent(v.id)}`))
  }).catch(e => setMsg({ ok: false, text: e.message }))

  // Tenant administrators only; the backend refuses while another architecture, a view, or recorded links/decisions rely on it.
  const remove = () => {
    if (!window.confirm(t('refarch.delete_confirm').replace('{name}', localName(arch, isAR)))) return
    api.del(`/reference-architectures/${arch.id}`).then(() => onBack()).catch((e: any) => setMsg({ ok: false, text: e.message }))
  }

  return (
    <div className="rp-page" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="rp-header">
        <div className="rp-header-main">
          <div className="ap-crumbs"><button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>← {t('refarch.back')}</button></div>
          <h1 className="rp-title">{localName(arch, isAR)}</h1>
          <div className="ap-badges">
            <span className="ra-chip">{t(`refarch.kind.${arch.kind}`)}</span>
            <span className="ra-chip">{t(`refarch.authority.${arch.authorityLevel}`)}</span>
            <span className="ra-chip">{domainName(arch.domainCode)}</span>
            {arch.derivedFrom && <span className="ra-chip">{t('refarch.list.tailors')}: {localName(arch.derivedFrom, isAR)}</span>}
          </div>
        </div>
        <div className="ap-actions" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ra-version">{t('refarch.version')}</label>
            <select id="ra-version" className="form-input" value={versionId || ''} onChange={e => { setVersionId(e.target.value); setSelected(null) }}>
              {(arch.versions || []).map((v: any) => <option key={v.id} value={v.id}>{v.version} · {t(`refarch.status.${v.status}`)}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={openInViews}>{t('refarch.open_in_views')}</button>
          {isAdmin && (<span className="flex gap-2" style={{ alignItems: 'center' }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>{t('refarch.delete')}</button>
            <HelpTip text={t('refarch.delete_help')} />
          </span>)}
        </div>
      </div>
      <div className="rp-strip" role="tablist" aria-label={localName(arch, isAR)}>
        {TABS.filter(x => (x !== 'tailoring' || arch.derivedFromId) && !(isModel(arch) && MODEL_HIDDEN_TABS.includes(x))).map(x => (
          <button key={x} type="button" role="tab" className="ap-tab" aria-selected={tab === x} onClick={() => setTab(x)}>{t(`refarch.tab.${x}`)}</button>
        ))}
      </div>
      <div className="rp-content">
        <Msg msg={msg} />
        {draft && pending.length > 0 && (
          <div className="rp-card rp-card-gap" style={{ marginTop: 0, marginBottom: 16 }} data-testid="ra-pending">
            <div className="flex gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{pending.length}</strong> {t('refarch.review.pending')}
              <button type="button" className="btn btn-primary btn-sm" onClick={() => act(() => api.post(`/reference-architectures/versions/${version.id}/elements/review`, { keys: pending.map(e => e.stableKey), decision: 'ACCEPT' }))}>{t('refarch.review.accept_all')}</button>
            </div>
          </div>
        )}

        {tab === 'overview' && <OverviewTab arch={arch} version={version} conf={conf} t={t} isAR={isAR} api={api} onFilter={() => setTab('conformance')} onChanged={refresh} />}

        {tab === 'architecture' && (
          <>
            {isModel(arch) ? (
              <div className="ap-toolbar"><span className="text-dim" style={{ fontSize: 13 }}>{t('refarch.model.read_only')}</span><HelpTip text={t('refarch.model.help')} /></div>
            ) : (
            <div className="ap-toolbar">
              <label className="form-label" htmlFor="ra-state" style={{ margin: 0 }}>{t('refarch.state')}</label>
              <select id="ra-state" className="form-input" value={scenarioId} onChange={e => setScenarioId(e.target.value)}>
                <option value="">{t('refarch.state.current')}</option>
                {scenarios.filter(s => s.type !== 'CURRENT').map(s => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}
              </select>
              <HelpTip text={t('refarch.diagram.help')} />
            </div>
            )}
            <div className={selectedEl ? 'ra-split' : ''}>
              <div className="rp-card">
                <ReferenceDiagram elements={elements} conformance={confByKey} selected={selected} onSelect={setSelected} t={t} isAR={isAR} />
                {draft && <AddElement api={api} t={t} versionId={version.id} elements={elements} metaModel={metaModel} onAdded={refresh} />}
              </div>
              {selectedEl && (
                <ElementDrawer key={selectedEl.stableKey} architectureId={arch.id} element={selectedEl} parentName={parentName} conformance={isModel(arch) ? undefined : confByKey[selectedEl.stableKey]} editable={draft} referenceModel={isModel(arch)}
                  versionId={version.id} metaModelTypes={metaModel?.objectTypes || []} realization={metaModel?.realization} architectureDomain={arch.domainCode || null} api={api} t={t} isAR={isAR} onChanged={loadVersion} onClose={() => setSelected(null)} />
              )}
            </div>
          </>
        )}

        {tab === 'actual' && <ActualTab arch={arch} conf={conf} t={t} isAR={isAR} api={api} onChanged={loadVersion} onSelect={(k: string) => { setSelected(k); setTab('architecture') }} />}
        {tab === 'conformance' && <ConformanceTab arch={arch} conf={conf} t={t} isAR={isAR} api={api} />}
        {tab === 'target' && <TargetTab arch={arch} versionId={version.id} scenarios={scenarios} t={t} isAR={isAR} api={api} />}
        {tab === 'tailoring' && <TailoringTab arch={arch} t={t} isAR={isAR} api={api} />}
        {tab === 'controls' && <ControlsTab arch={arch} conf={conf} t={t} isAR={isAR} api={api} />}
        {tab === 'usage' && <UsageTab arch={arch} t={t} api={api} />}
        {tab === 'versions' && <VersionsTab arch={arch} version={version} t={t} api={api} act={act} onSelectVersion={(v: string) => setVersionId(v)} />}
      </div>
    </div>
  )
}

function OverviewTab({ arch, version, conf, t, isAR, api, onFilter, onChanged }: any) {
  const [proposals, setProposals] = useState<any[]>([])
  const [checking, setChecking] = useState(false)
  const loadProposals = useCallback(() => api.get(`/reference-architectures/proposals?architectureId=${arch.id}`).then((r: any) => setProposals(Array.isArray(r) ? r : [])).catch(() => setProposals([])), [api, arch.id])
  useEffect(() => { loadProposals() }, [loadProposals])
  // Strategy never edits a reference architecture; analysed refreshes only raise review proposals.
  const checkStrategy = () => {
    setChecking(true)
    api.get('/strategy-refreshes').then((rs: any) => Promise.all((Array.isArray(rs) ? rs : []).filter((r: any) => r.analysisStatus === 'READY').slice(0, 5).map((r: any) => api.post(`/reference-architectures/strategy-refreshes/${r.id}/proposals`, {}).catch(() => null))))
      .then(loadProposals).finally(() => setChecking(false))
  }
  const counts: Record<string, number> = Object.fromEntries(Object.entries(conf?.summary?.byStatus || {}).map(([k, v]: any) => [k, v.length]))
  const desc = isAR ? arch.descriptionAr || arch.description : arch.description || arch.descriptionAr
  return (
    <>
      <div className="rp-card">
        <dl className="ap-facts">
          <div className="ap-fact"><dt>{t('refarch.version')}</dt><dd>{version.version} · {t(`refarch.status.${version.status}`)}</dd></div>
          <div className="ap-fact"><dt>{t('refarch.owner')}</dt><dd>{arch.owner || '—'}</dd></div>
          <div className="ap-fact"><dt>{t('refarch.publisher')}</dt><dd>{arch.publisher || '—'}</dd></div>
          <div className="ap-fact"><dt>{t('refarch.elements')}</dt><dd>{(version.elements || []).filter((e: any) => e.reviewStatus !== 'REJECTED').length}</dd></div>
        </dl>
        {desc && <p style={{ marginBottom: 0 }}>{desc}</p>}
      </div>
      {isModel(arch) && (
        <div className="rp-card" data-testid="ra-model-note">
          <div className="rp-card-title">{t('refarch.model.title')}<HelpTip text={t('refarch.model.help')} /></div>
          <p style={{ margin: 0, fontSize: 13 }}>{t('refarch.model.note')}</p>
        </div>
      )}
      {conf && !isModel(arch) && (
        <div className="rp-card" data-testid="ra-coverage">
          <div className="rp-card-title">{t('refarch.coverage')}<HelpTip text={t('refarch.coverage.help')} /></div>
          <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>{conf.summary.coverage.statement}</p>
          <details><summary className="text-dim" style={{ fontSize: 12 }}>{t('refarch.coverage.rule')}</summary><p className="text-dim" style={{ fontSize: 12 }}>{conf.summary.coverage.rule}</p></details>
          <div className="stat-grid-4" style={{ marginTop: 12 }}>
            {STATUS_ORDER.filter(s => counts[s]).map(s => (
              <button key={s} type="button" className="rp-stat" onClick={onFilter}>
                <div className="rp-stat-label"><span className="ra-dot" style={{ background: STATUS_COLOR[s] }} aria-hidden="true" /> {t(`refarch.conf.${s}`)}</div>
                <div className="rp-stat-value">{counts[s]}</div>
              </button>
            ))}
          </div>
        </div>
      )}
      {(version.metaModelRequirements || []).length > 0 && (
        <div className="rp-card">
          <div className="rp-card-title">{t('refarch.requirements')}</div>
          <ul className="ra-list">{version.metaModelRequirements.map((r: any) => <li key={r.elementKey}><span>{r.element}</span><span className="text-dim">{r.missing}</span></li>)}</ul>
        </div>
      )}
      <div className="rp-card">
        <div className="rp-card-title">{t('refarch.proposals')}<button type="button" className="btn btn-secondary btn-sm" style={{ marginInlineStart: 'auto' }} disabled={checking} onClick={checkStrategy}>{checking ? t('refarch.loading') : t('refarch.proposals.check_strategy')}</button></div>
        {proposals.length === 0 ? <p className="ap-empty" style={{ margin: 0 }}>—</p> : (
          <ul className="ra-list">{proposals.map(p => (
            <li key={p.id}>
              <span><strong>{p.title}</strong><br /><span className="text-dim" style={{ fontSize: 12 }}>{p.rationale}</span></span>
              {p.status === 'PROPOSED' ? (
                <span className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => api.post(`/reference-architectures/proposals/${p.id}/decision`, { decision: 'ACCEPT' }).then(onChanged)}>{t('refarch.proposals.accept')}</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { const note = window.prompt(t('refarch.el.rationale')); if (note) api.post(`/reference-architectures/proposals/${p.id}/decision`, { decision: 'DISMISS', note }).then(onChanged) }}>{t('refarch.proposals.dismiss')}</button>
                </span>
              ) : <span className="ra-chip">{p.status}</span>}
            </li>
          ))}</ul>
        )}
      </div>
    </>
  )
}

function AddElement({ api, t, versionId, elements, metaModel, onAdded }: any) {
  const [f, setF] = useState({ name: '', parentKey: '', kind: 'COMPONENT', obligation: 'RECOMMENDED', type: '', configurationRequired: false })
  const [err, setErr] = useState('')
  const add = () => api.post(`/reference-architectures/versions/${versionId}/elements`, { name: f.name, parentKey: f.parentKey || undefined, kind: f.kind, obligation: f.obligation, metaModelTypeCodes: f.type ? [f.type] : [], configurationRequired: f.configurationRequired })
    .then(() => { setF(x => ({ ...x, name: '' })); setErr(''); onAdded() }).catch((e: any) => setErr(e.message))
  return (
    <details style={{ marginTop: 16 }}>
      <summary className="btn btn-secondary btn-sm" style={{ display: 'inline-block' }}>{t('refarch.form.add_element')}</summary>
      {err && <div className="ra-msg ra-msg-err" role="alert" style={{ marginTop: 8 }}>{err}</div>}
      <div className="ra-form-grid" style={{ marginTop: 10 }}>
        <div className="form-group"><label className="form-label" htmlFor="ra-add-name">{t('refarch.form.element_name')}</label><input id="ra-add-name" className="form-input" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-add-parent">{t('refarch.form.parent')}</label><select id="ra-add-parent" className="form-input" value={f.parentKey} onChange={e => setF({ ...f, parentKey: e.target.value })}><option value="">—</option>{elements.filter((e: any) => e.reviewStatus !== 'REJECTED').map((e: any) => <option key={e.stableKey} value={e.stableKey}>{e.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-add-kind">{t('refarch.kind')}</label><select id="ra-add-kind" className="form-input" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{['LAYER', 'AREA', 'GROUP', 'CAPABILITY', 'COMPONENT', 'STAGE', 'PATTERN', 'CONCEPT'].map(k => <option key={k} value={k}>{t(`refarch.ekind.${k}`)}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-add-type">{t('refarch.form.types')}</label><select id="ra-add-type" className="form-input" value={f.type} disabled={f.configurationRequired} onChange={e => setF({ ...f, type: e.target.value })}><option value="">—</option>{(metaModel?.objectTypes || []).map((o: any) => <option key={o.code} value={o.code}>{o.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label" htmlFor="ra-add-obl">{t('refarch.form.obligation')}</label><select id="ra-add-obl" className="form-input" value={f.obligation} onChange={e => setF({ ...f, obligation: e.target.value })}>{['MANDATORY', 'RECOMMENDED', 'OPTIONAL'].map(o => <option key={o} value={o}>{t(`refarch.form.obligation.${o}`)}</option>)}</select></div>
      </div>
      <label className="ap-toggle" htmlFor="ra-add-cfg"><input id="ra-add-cfg" type="checkbox" checked={f.configurationRequired} onChange={e => setF({ ...f, configurationRequired: e.target.checked })} />{t('refarch.form.config_required')}</label>
      <div style={{ marginTop: 8 }}><button type="button" className="btn btn-primary btn-sm" disabled={!f.name.trim()} onClick={add}>{t('refarch.form.add_element')}</button></div>
    </details>
  )
}

function ActualTab({ arch, conf, t, isAR, api, onChanged, onSelect }: any) {
  const [useAi, setUseAi] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const propose = () => { setBusy(true); api.post(`/reference-architectures/${arch.id}/links/propose`, { useAi }).then((r: any) => { setMsg({ ok: true, text: `${r.proposed} ${t('refarch.propose.done')}${r.notes?.length ? ` · ${r.notes.join(' ')}` : ''}` }); onChanged() }).catch((e: any) => setMsg({ ok: false, text: e.message })).finally(() => setBusy(false)) }
  // Every capability that can be realized (any domain), not only the ones with an expected Meta Model type.
  const rows: ElementConformance[] = (conf?.elements || []).filter((e: any) => e.realizable !== false || e.realizedBy.length > 0)
  return (
    <div className="rp-card">
      <div className="ap-toolbar">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={propose}>{busy ? t('refarch.loading') : t('refarch.propose')}</button>
        <label className="ap-toggle" htmlFor="ra-propose-ai"><input id="ra-propose-ai" type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />{t('refarch.propose.ai')}</label>
        <HelpTip text={t('refarch.coverage.help')} />
      </div>
      <Msg msg={msg} />
      <div className="ra-scroll">
        <table className="ra-table">
          <thead><tr><th>{t('refarch.elements')}</th><th>{t('refarch.state')}</th><th>{t('refarch.el.implementations')}</th><th>{t('refarch.el.proposed')}</th></tr></thead>
          <tbody>{rows.map(e => (
            <tr key={e.stableKey}>
              <td><button type="button" className="ra-leaf" onClick={() => onSelect(e.stableKey)}>{localName(e, isAR)}</button><div className="text-dim" style={{ fontSize: 11 }}>{(e.metaModelTypeCodes || []).join(', ')}</div></td>
              <td><StatusChip status={e.status} t={t} /></td>
              <td>{e.realizedBy.filter(r => r.present).length ? e.realizedBy.filter(r => r.present).map(r => (
                <span key={r.linkId} className="ra-chip" style={{ marginInlineEnd: 4 }}>{r.name}{r.targetDomain ? ` · ${r.targetDomain}` : ''}{r.crossDomain ? ` ↗` : ''}</span>
              )) : <span className="ap-empty">{t('refarch.el.no_impl')}</span>}
                {(e.supportedBy || []).filter(r => r.present).length > 0 && <div className="text-dim" style={{ fontSize: 11 }}>{t('refarch.link.SUPPORTED_BY')}: {(e.supportedBy || []).filter(r => r.present).map(r => r.name).join(', ')}</div>}
              </td>
              <td>{e.proposedLinks || ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

function ConformanceTab({ arch, conf, t, isAR, api }: any) {
  const [filter, setFilter] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  if (!conf) return <p className="ap-empty">{t('refarch.loading')}</p>
  const rows: ElementConformance[] = conf.elements.filter((e: ElementConformance) => !filter || e.status === filter)
  const plan = () => api.post(`/reference-architectures/${arch.id}/gaps/initiative`, { elementKeys: chosen }).then((r: any) => { setMsg({ ok: true, text: `${t('refarch.plan_gaps.done')}: ${r.plan.nameEn} (${r.activitiesAdded})` }); setChosen([]) }).catch((e: any) => setMsg({ ok: false, text: e.message }))
  return (
    <>
      <div className="rp-card">
        <div className="ap-toolbar">
          <label className="form-label" htmlFor="ra-conf-filter" style={{ margin: 0 }}>{t('refarch.conf.filter')}</label>
          <select id="ra-conf-filter" className="form-input" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">{t('refarch.conf.all')}</option>
            {STATUS_ORDER.map(s => <option key={s} value={s}>{t(`refarch.conf.${s}`)}</option>)}
          </select>
          <button type="button" className="btn btn-primary btn-sm" disabled={!chosen.length} onClick={plan}>{t('refarch.plan_gaps')} ({chosen.length})</button>
        </div>
        <Msg msg={msg} />
        <div className="ra-scroll">
          <table className="ra-table" data-testid="ra-conformance-table">
            <thead><tr><th /><th>{t('refarch.elements')}</th><th>{t('refarch.state')}</th><th>{t('refarch.form.obligation')}</th><th>{t('refarch.coverage.rule')}</th></tr></thead>
            <tbody>{rows.map(e => (
              <tr key={e.stableKey}>
                <td><input type="checkbox" aria-label={localName(e, isAR)} checked={chosen.includes(e.stableKey)} disabled={['ALIGNED', 'NOT_APPLICABLE', 'APPROVED_EXCEPTION'].includes(e.status)} onChange={ev => setChosen(c => (ev.target.checked ? [...c, e.stableKey] : c.filter(k => k !== e.stableKey)))} /></td>
                <td>{localName(e, isAR)}<div className="text-dim" style={{ fontSize: 11 }}>{t(`refarch.ekind.${e.kind}`)}</div></td>
                <td><StatusChip status={e.status} t={t} />{e.absence && <div className="text-dim" style={{ fontSize: 11 }}>{t(`refarch.absence.${e.absence}`)}</div>}{e.duplication && <div className="ra-chip" style={{ marginTop: 4 }}>{t('refarch.duplications')}</div>}</td>
                <td>{t(`refarch.form.obligation.${e.obligation}`)}</td>
                <td style={{ fontSize: 12 }}>{e.reason}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {conf.orphans && (
        <div className="rp-card">
          <div className="rp-card-title">{t('refarch.orphans')} ({conf.orphans.orphans.length} / {conf.orphans.considered})<HelpTip text={t('refarch.orphans.help')} /></div>
          <ul className="ra-list">{conf.orphans.orphans.slice(0, 50).map((o: any) => <li key={o.id}><span>{o.name}</span><span className="text-dim">{o.assetType}</span></li>)}</ul>
        </div>
      )}
    </>
  )
}

function TargetTab({ arch, versionId, scenarios, t, isAR, api }: any) {
  const targets = scenarios.filter((s: any) => ['TARGET', 'TRANSITION'].includes(s.type))
  const [sid, setSid] = useState(targets[0]?.id || '')
  const [data, setData] = useState<any>(null)
  const [err, setErr] = useState('')
  useEffect(() => { if (sid) api.get(`/reference-architectures/${arch.id}/current-target?targetScenarioId=${sid}&versionId=${versionId}`).then(setData).catch((e: any) => setErr(e.message)) }, [api, arch.id, sid, versionId])
  if (!targets.length) return <p className="ap-empty">{t('refarch.target.none')}</p>
  return (
    <div className="rp-card">
      <div className="ap-toolbar">
        <label className="form-label" htmlFor="ra-target" style={{ margin: 0 }}>{t('refarch.target.choose')}</label>
        <select id="ra-target" className="form-input" value={sid} onChange={e => setSid(e.target.value)}>{targets.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.type})</option>)}</select>
        <HelpTip text={t('refarch.target.help')} />
      </div>
      {err && <div className="ra-msg ra-msg-err">{err}</div>}
      {data && (
        <>
          <p style={{ fontSize: 13 }}><strong>{t('refarch.current')}:</strong> {data.summary.current.statement} · <strong>{t('refarch.target')}:</strong> {data.summary.target.statement}</p>
          <div className="ra-scroll">
            <table className="ra-table">
              <thead><tr><th>{t('refarch.elements')}</th><th>{t('refarch.current')}</th><th>{t('refarch.target')}</th><th>{t('refarch.versions.modified')}</th></tr></thead>
              <tbody>{data.rows.map((r: any) => (
                <tr key={r.stableKey}>
                  <td>{localName(r, isAR)}</td>
                  <td><StatusChip status={r.current.status} t={t} /></td>
                  <td><StatusChip status={r.target.status} t={t} />{r.introducedInTarget.length > 0 && <div className="text-dim" style={{ fontSize: 11 }}>+ {r.introducedInTarget.map((o: any) => o.name).join(', ')}</div>}</td>
                  <td>{t(`refarch.change.${r.change}`)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function TailoringTab({ arch, t, isAR, api }: any) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.get(`/reference-architectures/${arch.id}/tailoring`).then(setData).catch(() => setData(null)) }, [api, arch.id])
  if (!data) return <p className="ap-empty">{t('refarch.loading')}</p>
  if (!data.model) return <p className="ap-empty">{t('refarch.tailoring.none')}</p>
  return (
    <div className="rp-card" data-testid="ra-tailoring">
      <div className="ap-badges" style={{ marginBottom: 12 }}>{['ADOPTED', 'ADAPTED', 'EXTENDED', 'NOT_APPLICABLE', 'EXCEPTION', 'PENDING_REVIEW'].map(k => <span key={k} className="ra-chip">{t(`refarch.disp.${k}`)}: {data.summary[k]}</span>)}</div>
      <div className="ra-scroll">
        <table className="ra-table">
          <thead><tr><th>{t('refarch.tailoring.model_element')} ({localName(data.model, isAR)})</th><th>{t('refarch.tailoring.org_elements')}</th><th>{t('refarch.state')}</th></tr></thead>
          <tbody>{data.rows.map((r: any) => (
            <tr key={r.model.stableKey}><td>{localName(r.model, isAR)}</td><td>{r.organization.map((o: any) => localName(o, isAR)).join(', ') || '—'}</td><td><span className="ra-chip">{t(`refarch.disp.${r.disposition}`)}</span></td></tr>
          ))}</tbody>
        </table>
      </div>
      {data.extensions.length > 0 && (<><div className="ap-section-title" style={{ marginTop: 12 }}>{t('refarch.tailoring.extensions')}</div><p style={{ fontSize: 13 }}>{data.extensions.map((e: any) => localName(e, isAR)).join(' · ')}</p></>)}
    </div>
  )
}

function ControlsTab({ arch, conf, t, isAR, api }: any) {
  const [tech, setTech] = useState<any[]>([])
  useEffect(() => { api.get(`/reference-architectures/${arch.id}/technology`).then((r: any) => setTech(Array.isArray(r) ? r : [])).catch(() => setTech([])) }, [api, arch.id])
  const traces = (conf?.elements || []).flatMap((e: ElementConformance) => (e.traces || []).map(tr => ({ ...tr, element: localName(e, isAR) })))
  const groups = ['GUIDED_BY_PRINCIPLE', 'CONSTRAINED_BY_STANDARD', 'TRACES_TO_CAPABILITY', 'CANDIDATE_TECHNOLOGY', 'ADDRESSED_BY_INITIATIVE']
  return (
    <div className="rp-card">
      {groups.map(g => {
        const items = traces.filter((x: any) => x.linkType === g)
        return (
          <div key={g} className="ap-section">
            <div className="ap-section-title">{t(`refarch.link.${g}`)} ({items.length})</div>
            {items.length === 0 ? <p className="ap-empty" style={{ margin: 0 }}>—</p> : (
              <ul className="ra-list">{items.map((x: any) => {
                const extra = tech.find(tl => tl.id === x.id)
                return <li key={x.id}><span>{x.targetName}</span><span className="text-dim" style={{ fontSize: 12 }}>{x.element}{extra?.radarPosition ? ` · ${extra.radarPosition}` : ''}{extra?.maturity?.finalScore != null ? ` · ${extra.maturity.finalScore}` : ''}</span></li>
              })}</ul>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UsageTab({ arch, t, api }: any) {
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.get(`/reference-architectures/${arch.id}/usage`).then(setData).catch(() => setData({ usages: [] })) }, [api, arch.id])
  if (!data) return <p className="ap-empty">{t('refarch.loading')}</p>
  if (!data.usages.length && !(data.initiatives || []).length) return <p className="ap-empty">{t('refarch.usage.empty')}</p>
  return (
    <div className="rp-card ra-scroll">
      <table className="ra-table">
        <thead><tr><th>{t('refarch.usage.module')}</th><th>{t('refarch.usage.record')}</th><th>{t('refarch.usage.how')}</th><th>{t('refarch.version')}</th></tr></thead>
        <tbody>{data.usages.map((u: any) => <tr key={u.id}><td>{u.module}</td><td>{u.entityName || u.entityId}</td><td>{u.usage}</td><td>{u.version?.version} · {u.version ? t(`refarch.status.${u.version.status}`) : ''}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function VersionsTab({ arch, version, t, api, act, onSelectVersion }: any) {
  const [impact, setImpact] = useState<any>(null)
  const [diff, setDiff] = useState<any>(null)
  const [label, setLabel] = useState('')
  useEffect(() => {
    setImpact(null); setDiff(null)
    if (['APPROVED', 'UNDER_REVIEW', 'DRAFT'].includes(version.status)) api.get(`/reference-architectures/versions/${version.id}/impact`).then(setImpact).catch(() => setImpact(null))
    else if (version.changeImpact) setImpact(version.changeImpact)
    if (version.basedOnVersionId) api.get(`/reference-architectures/${arch.id}/diff?from=${version.basedOnVersionId}&to=${version.id}`).then(setDiff).catch(() => setDiff(null))
  }, [api, arch.id, version])
  const vp = (path: string, body: any = {}) => () => api.post(`/reference-architectures/versions/${version.id}/${path}`, body)
  return (
    <>
      <div className="rp-card">
        <div className="ap-toolbar">
          {version.status === 'DRAFT' && <button type="button" className="btn btn-primary btn-sm" onClick={() => act(vp('submit'))}>{t('refarch.versions.submit')}</button>}
          {version.status === 'UNDER_REVIEW' && <><button type="button" className="btn btn-primary btn-sm" onClick={() => act(vp('approve'))}>{t('refarch.versions.approve')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => act(vp('return'))}>{t('refarch.versions.return')}</button></>}
          {version.status === 'APPROVED' && <button type="button" className="btn btn-primary btn-sm" onClick={() => act(vp('activate'))}>{t('refarch.versions.activate')}</button>}
          {['DRAFT', 'APPROVED', 'SUPERSEDED'].includes(version.status) && <button type="button" className="btn btn-secondary btn-sm" onClick={() => act(vp('archive'))}>{t('refarch.versions.archive')}</button>}
          <label className="form-label" htmlFor="ra-new-version" style={{ margin: 0 }}>{t('refarch.versions.new')}</label>
          <input id="ra-new-version" className="form-input" style={{ maxWidth: 120 }} value={label} onChange={e => setLabel(e.target.value)} placeholder="2.0" />
          <button type="button" className="btn btn-secondary btn-sm" disabled={!label.trim()} onClick={() => act(() => api.post(`/reference-architectures/${arch.id}/versions`, { version: label }).then((v: any) => { setLabel(''); onSelectVersion(v.id) }))}>{t('refarch.versions.new')}</button>
        </div>
        <div className="ra-scroll">
          <table className="ra-table">
            <thead><tr><th>{t('refarch.version')}</th><th>{t('refarch.state')}</th><th>{t('refarch.elements')}</th><th /></tr></thead>
            <tbody>{(arch.versions || []).map((v: any) => (
              <tr key={v.id}><td>{v.version}</td><td><span className="ra-chip">{t(`refarch.status.${v.status}`)}</span></td><td>{v._count?.elements ?? ''}</td><td><button type="button" className="btn btn-secondary btn-sm" disabled={v.id === version.id} onClick={() => onSelectVersion(v.id)}>→</button></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {diff && (
        <div className="rp-card">
          <div className="rp-card-title">{t('refarch.versions.compare')}</div>
          <div className="ap-badges">{(['added', 'removed', 'modified'] as const).map(k => <span key={k} className="ra-chip">{t(`refarch.versions.${k}`)}: {diff.counts[k]}</span>)}</div>
          <ul className="ra-list" style={{ marginTop: 8 }}>{diff.changes.slice(0, 60).map((c: any) => <li key={c.stableKey}><span>{c.name}</span><span className="text-dim">{c.change}{c.fields?.length ? ` · ${c.fields.join(', ')}` : ''}</span></li>)}</ul>
        </div>
      )}
      {impact && (
        <div className="rp-card" data-testid="ra-impact">
          <div className="rp-card-title">{t('refarch.versions.impact')}<HelpTip text={t('refarch.versions.impact_help')} /></div>
          <div className="ap-badges">{Object.entries(impact.summary || {}).map(([k, n]: any) => <span key={k} className="ra-chip">{t(`refarch.impact.${k}`)}: {n}</span>)}</div>
          <ul className="ra-list" style={{ marginTop: 8 }}>{(impact.items || []).filter((i: any) => i.impact !== 'NO_IMPACT').slice(0, 80).map((i: any, n: number) => <li key={n}><span>{i.module} · {i.name}</span><span className="text-dim" style={{ fontSize: 12 }}>{t(`refarch.impact.${i.impact}`)} - {i.reason}</span></li>)}</ul>
        </div>
      )}
    </>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReferenceArchitecturesPage() {
  const { t, isAR } = useLang()
  const api = useApi()
  const [searchParams, setSearchParams] = useSearchParams()
  const [list, setList] = useState<any[] | null>(null)
  const [metaModel, setMetaModel] = useState<any>(null)
  const [kind, setKind] = useState('')
  const [domain, setDomain] = useState('')
  const [mode, setMode] = useState<'list' | 'create' | 'import'>('list')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const selected = searchParams.get('ra')

  const load = useCallback(() => api.get('/reference-architectures').then(r => setList(Array.isArray(r) ? r : [])).catch(() => setList([])), [api])
  useEffect(() => { load(); api.get('/reference-architectures/meta-model').then(setMetaModel).catch(() => setMetaModel(null)) }, [load, api])

  const open = (id: string | null) => setSearchParams(prev => { const next = new URLSearchParams(prev); if (id) next.set('ra', id); else next.delete('ra'); return next })

  if (selected) return <Workspace id={selected} api={api} t={t} isAR={isAR} metaModel={metaModel} onBack={() => { open(null); load() }} />

  const domains = metaModel?.domains || []
  const shown = (list || []).filter(a => (!kind || a.kind === kind) && (!domain || a.domainCode === domain))
  return (
    <div className="rp-page" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="rp-header">
        <div className="rp-header-main">
          <h1 className="rp-title">🧭 {t('refarch.title')}<HelpTip text={t('refarch.help')} /></h1>
          <div className="rp-sub">{t('refarch.subtitle')}</div>
        </div>
        <div className="ap-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setMode('create')}>{t('refarch.list.new')}</button>
          <button type="button" className="btn btn-primary" onClick={() => setMode('import')}>{t('refarch.list.import')}</button>
        </div>
      </div>
      <div className="rp-content">
        <Msg msg={msg} />
        {mode === 'create' && <CreateForm api={api} t={t} domains={domains} architectures={list || []} onCreated={a => { setMode('list'); open(a.id) }} onCancel={() => setMode('list')} />}
        {mode === 'import' && <ImportWizard api={api} t={t} domains={domains} architectures={list || []} onApplied={() => { setMode('list'); setMsg({ ok: true, text: t('refarch.import.applied') }); load() }} onClose={() => setMode('list')} />}
        <div className="rp-card rp-filters rp-card-gap">
          <label className="form-label" htmlFor="ra-filter-kind" style={{ margin: 0 }}>{t('refarch.kind')}</label>
          <select id="ra-filter-kind" className="form-input" style={{ maxWidth: 220 }} value={kind} onChange={e => setKind(e.target.value)}><option value="">{t('refarch.list.all_kinds')}</option>{KINDS.map(k => <option key={k} value={k}>{t(`refarch.kind.${k}`)}</option>)}</select>
          <label className="form-label" htmlFor="ra-filter-domain" style={{ margin: 0 }}>{t('refarch.domain')}</label>
          <select id="ra-filter-domain" className="form-input" style={{ maxWidth: 260 }} value={domain} onChange={e => setDomain(e.target.value)}><option value="">{t('refarch.list.all_domains')}</option>{domains.map((d: any) => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
        </div>
        {list === null ? <p aria-busy="true">{t('refarch.loading')}</p> : shown.length === 0 ? <p className="ap-empty" data-testid="ra-empty">{t('refarch.list.empty')}</p> : KINDS.map(k => {
          const items = shown.filter(a => a.kind === k)
          if (!items.length) return null
          return (
            <section key={k} aria-label={t(`refarch.kind.${k}`)}>
              <div className="ra-group-title">{t(`refarch.kind.${k}`)} ({items.length})</div>
              <div className="ra-cards">{items.map(a => (
                <button key={a.id} type="button" className="ra-card" onClick={() => open(a.id)}>
                  <span className="ra-card-name">{localName(a, isAR)}</span>
                  <span className="ap-badges" style={{ marginTop: 0 }}>
                    <span className="ra-chip">{t(`refarch.authority.${a.authorityLevel}`)}</span>
                    <span className="ra-chip">{a.domainCode ? domains.find((d: any) => d.code === a.domainCode)?.name || a.domainCode : t('refarch.list.cross_domain')}</span>
                  </span>
                  <span className="ra-card-meta">{a.activeVersion ? `${t('refarch.list.active')}: ${a.activeVersion.version}` : t('refarch.list.none_active')}{a.latestVersion && a.latestVersion.id !== a.activeVersion?.id ? ` · ${a.latestVersion.version} ${t(`refarch.status.${a.latestVersion.status}`)}` : ''}</span>
                </button>
              ))}</div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
