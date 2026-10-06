import { useEffect, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { ElementConformance, RefApi, RefElement, STATUS_COLOR, T, localDescription, localName } from './refArch'

const REPO_LINKS = ['REALIZES', 'IMPLEMENTS', 'CONFORMS_TO', 'SATISFIES', 'REPLACES', 'DEVIATES_FROM', 'EXCEPTION_TO', 'GUIDED_BY_PRINCIPLE', 'CONSTRAINED_BY_STANDARD', 'TRACES_TO_CAPABILITY']
const REALIZING = ['REALIZES', 'IMPLEMENTS', 'CONFORMS_TO', 'SATISFIES', 'REPLACES', 'DEVIATES_FROM', 'EXCEPTION_TO']

/**
 * One reference element: what it is (definition, layer, Meta Model types),
 * where it came from (document, slide, original wording, how it was
 * derived and who stated it), how the actual architecture stands against
 * it (implementations, deviations, exceptions, decisions, traces), and the
 * actions an architect takes on it. Draft elements can be edited here.
 */
export default function ElementDrawer({ architectureId, element, parentName, conformance, editable, metaModelTypes, api, t, isAR, onChanged, onClose }: {
  architectureId: string
  element: RefElement
  parentName: string | null
  conformance: ElementConformance | undefined
  editable: boolean
  versionId: string
  metaModelTypes: Array<{ code: string; name: string; domain: string | null }>
  api: RefApi
  t: T
  isAR: boolean
  onChanged: () => void
  onClose: () => void
}) {
  const [links, setLinks] = useState<any[]>([])
  const [linkType, setLinkType] = useState('REALIZES')
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<any[]>([])
  const [rationale, setRationale] = useState('')
  const [expires, setExpires] = useState('')
  const [decision, setDecision] = useState('NO_IMPLEMENTATION_EXISTS')
  const [decisionWhy, setDecisionWhy] = useState('')
  const [types, setTypes] = useState<string[]>(element.metaModelTypeCodes || [])
  const [configRequired, setConfigRequired] = useState(element.metaModelStatus === 'CONFIGURATION_REQUIRED')
  const [obligation, setObligation] = useState(element.obligation || 'RECOMMENDED')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const p = element.provenance || {}
  const key = element.stableKey

  const loadLinks = () => api.get(`/reference-architectures/${architectureId}/links?elementKey=${encodeURIComponent(key)}`).then(r => setLinks(Array.isArray(r) ? r : [])).catch(() => setLinks([]))
  useEffect(() => {
    loadLinks()
    setTypes(element.metaModelTypeCodes || []); setConfigRequired(element.metaModelStatus === 'CONFIGURATION_REQUIRED'); setObligation(element.obligation || 'RECOMMENDED'); setMsg(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, architectureId])

  const run = (fn: () => Promise<any>) => fn().then(() => { setMsg({ ok: true, text: '✓' }); loadLinks(); onChanged() }).catch((e: any) => setMsg({ ok: false, text: e.message }))

  const searchObjects = () => {
    const typeFilter = REALIZING.includes(linkType) && element.metaModelTypeCodes.length === 1 ? `&assetType=${encodeURIComponent(element.metaModelTypeCodes[0])}` : ''
    api.get(`/ea-repository/assets?search=${encodeURIComponent(search)}&page=1&pageSize=20${typeFilter}`).then((r: any) => {
      const items = Array.isArray(r) ? r : r?.items || []
      setCandidates(REALIZING.includes(linkType) ? items.filter((a: any) => element.metaModelTypeCodes.includes(a.assetType)) : items)
    }).catch(() => setCandidates([]))
  }

  const status = conformance?.status
  const proposed = links.filter(l => l.status === 'PROPOSED')
  const confirmedTraces = links.filter(l => l.status === 'CONFIRMED' && !REALIZING.includes(l.linkType))
  return (
    <aside className="rp-card ra-drawer" aria-label={localName(element, isAR)} data-testid="ra-drawer">
      <div className="ap-head-top" style={{ marginBottom: 8 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, overflowWrap: 'anywhere' }}>{localName(element, isAR)}</h3>
          {isAR ? element.name !== element.nameAr && <div className="ap-subtitle">{element.name}</div> : element.nameAr && <div className="ap-subtitle" dir="rtl">{element.nameAr}</div>}
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>{t('common.close')}</button>
      </div>
      {msg && <div className={`ra-msg ${msg.ok ? 'ra-msg-ok' : 'ra-msg-err'}`} role="status">{msg.text}</div>}

      <dl className="ra-kv">
        <dt>{t('refarch.kind')}</dt><dd>{t(`refarch.ekind.${element.kind}`)}{parentName ? ` · ${parentName}` : ''}</dd>
        {status && (<><dt>{t('refarch.state')}</dt><dd><span className="ra-chip"><span className="ra-dot" style={{ background: STATUS_COLOR[status] }} aria-hidden="true" />{t(`refarch.conf.${status}`)}</span>{conformance?.absence && <span className="ra-chip" style={{ marginInlineStart: 6 }}>{t(`refarch.absence.${conformance.absence}`)}</span>}<div className="text-dim" style={{ fontSize: 12, marginTop: 4 }}>{conformance?.reason}</div></dd></>)}
        <dt>{t(`refarch.mm.${element.metaModelStatus}`)}</dt><dd>{element.metaModelTypeCodes.join(', ') || element.metaModelNote || '—'}</dd>
        {element.obligation && (<><dt>{t('refarch.form.obligation')}</dt><dd>{t(`refarch.form.obligation.${element.obligation}`)}</dd></>)}
        {element.disposition && (<><dt>{t('refarch.el.national')}</dt><dd>{t(`refarch.disp.${element.disposition}`)}{element.nationalElementKey ? ` · ${element.nationalElementKey}` : ''}</dd></>)}
        {element.authority && (<><dt>{t('refarch.authority')}</dt><dd>{t(`refarch.el.authority.${element.authority}`)}</dd></>)}
      </dl>

      {localDescription(element, isAR) && (<div className="ap-section" style={{ marginTop: 12 }}><div className="ap-section-title">{t('refarch.el.definition')}</div><p style={{ margin: 0, fontSize: 13 }}>{localDescription(element, isAR)}</p></div>)}

      {p.fileName && (
        <div className="ap-section">
          <div className="ap-section-title">{t('refarch.el.source')}</div>
          <dl className="ra-kv">
            <dt>{t('refarch.el.source')}</dt><dd>{p.fileName}</dd>
            {p.page != null && (<><dt>{t('refarch.el.slide')}</dt><dd>{p.page}{p.slideTitle ? ` · ${p.slideTitle}` : ''}</dd></>)}
            {p.confidence != null && (<><dt>{t('refarch.el.confidence')}</dt><dd>{Math.round(p.confidence * 100) / 100}</dd></>)}
            {p.method && (<><dt>{t('refarch.el.method')}</dt><dd>{p.method}</dd></>)}
          </dl>
          {p.originalText && <blockquote className="ra-quote" dir="auto" aria-label={t('refarch.el.original')}>{p.originalText}</blockquote>}
        </div>
      )}

      <div className="ap-section">
        <div className="ap-section-title">{t('refarch.el.implementations')}</div>
        {(conformance?.realizedBy || []).length === 0 ? <p className="ap-empty" style={{ margin: 0 }}>{t('refarch.el.no_impl')}</p> : (
          <ul className="ra-list">{conformance!.realizedBy.map(r => <li key={r.linkId}><span>{r.name}</span><span className="ra-chip">{t(`refarch.link.${r.linkType}`)}{!r.present ? ' · ✕' : ''}</span></li>)}</ul>
        )}
        {(conformance?.deviations || []).length > 0 && (<><div className="ap-section-title" style={{ marginTop: 10 }}>{t('refarch.el.deviations')}</div><ul className="ra-list">{conformance!.deviations.map(d => <li key={d.linkId}>{d.name}</li>)}</ul></>)}
        {(conformance?.exceptions || []).length > 0 && (<><div className="ap-section-title" style={{ marginTop: 10 }}>{t('refarch.el.exceptions')}</div><ul className="ra-list">{conformance!.exceptions.map(x => <li key={x.linkId}><span>{x.name}</span>{x.expiresAt && <span className="text-dim">{x.expiresAt.slice(0, 10)}{x.expired ? ' ✕' : ''}</span>}</li>)}</ul></>)}
        {proposed.length > 0 && (
          <>
            <div className="ap-section-title" style={{ marginTop: 10 }}>{t('refarch.el.proposed')}</div>
            <ul className="ra-list">{proposed.map(l => (
              <li key={l.id}>
                <span>{l.targetName} <span className="text-dim" style={{ fontSize: 11 }}>{l.basis}{l.confidence != null ? ` · ${l.confidence}` : ''}</span></span>
                <span className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api.post(`/reference-architectures/links/${l.id}/decision`, { decision: 'CONFIRM' }))}>{t('refarch.el.confirm')}</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => api.post(`/reference-architectures/links/${l.id}/decision`, { decision: 'REJECT' }))}>{t('refarch.el.reject')}</button>
                </span>
              </li>
            ))}</ul>
          </>
        )}
      </div>

      {confirmedTraces.length > 0 && (
        <div className="ap-section">
          <div className="ap-section-title">{t('refarch.el.traces')}</div>
          <ul className="ra-list">{confirmedTraces.map(l => <li key={l.id}><span>{l.targetName}</span><span className="ra-chip">{t(`refarch.link.${l.linkType}`)}</span></li>)}</ul>
        </div>
      )}
      {conformance?.decision && (
        <div className="ap-section">
          <div className="ap-section-title">{t('refarch.el.decision')}</div>
          <p style={{ margin: 0, fontSize: 13 }}>{t(`refarch.absence.${conformance.decision.outcome === 'NOT_ASSESSABLE' ? 'IMPLEMENTATION_NOT_RECORDED' : conformance.decision.outcome}`)} - {conformance.decision.rationale}</p>
        </div>
      )}

      {editable && (
        <div className="ap-section">
          <div className="ap-section-title">{t('common.edit')}</div>
          {element.reviewStatus === 'PROPOSED' && (
            <div className="flex gap-2" style={{ marginBottom: 8 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api.post(`/reference-architectures/versions/${(element as any).versionId}/elements/review`, { keys: [key], decision: 'ACCEPT' }))}>{t('refarch.review.accept')}</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => run(() => api.post(`/reference-architectures/versions/${(element as any).versionId}/elements/review`, { keys: [key], decision: 'REJECT' }))}>{t('refarch.review.reject')}</button>
            </div>
          )}
          <div className="form-group">
            <label className="form-label" htmlFor="ra-el-types">{t('refarch.form.types')}</label>
            <select id="ra-el-types" className="form-input" multiple size={5} value={types} disabled={configRequired} onChange={e => setTypes(Array.from(e.target.selectedOptions).map(o => o.value))}>
              {metaModelTypes.map(o => <option key={o.code} value={o.code}>{o.name} ({o.code})</option>)}
            </select>
          </div>
          <label className="ap-toggle" htmlFor="ra-el-config"><input id="ra-el-config" type="checkbox" checked={configRequired} onChange={e => setConfigRequired(e.target.checked)} />{t('refarch.form.config_required')}</label>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label className="form-label" htmlFor="ra-el-obligation">{t('refarch.form.obligation')}</label>
            <select id="ra-el-obligation" className="form-input" value={obligation} onChange={e => setObligation(e.target.value)}>
              {['MANDATORY', 'RECOMMENDED', 'OPTIONAL'].map(o => <option key={o} value={o}>{t(`refarch.form.obligation.${o}`)}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api.patch(`/reference-architectures/versions/${(element as any).versionId}/elements/${encodeURIComponent(key)}`, { metaModelTypeCodes: configRequired ? [] : types, configurationRequired: configRequired, obligation }))}>{t('common.save')}</button>
        </div>
      )}

      <div className="ap-section">
        <div className="ap-section-title">{t('refarch.el.link_object')}<HelpTip text={t('refarch.coverage.help')} /></div>
        <div className="form-group">
          <label className="form-label" htmlFor="ra-link-type">{t('refarch.el.link_type')}</label>
          <select id="ra-link-type" className="form-input" value={linkType} onChange={e => { setLinkType(e.target.value); setCandidates([]) }}>
            {REPO_LINKS.map(l => <option key={l} value={l}>{t(`refarch.link.${l}`)}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ra-link-search">{t('refarch.el.search_object')}</label>
          <div className="flex gap-2">
            <input id="ra-link-search" className="form-input" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchObjects() }} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={searchObjects}>🔍</button>
          </div>
        </div>
        {['DEVIATES_FROM', 'EXCEPTION_TO'].includes(linkType) && (
          <div className="form-group">
            <label className="form-label" htmlFor="ra-link-why">{t('refarch.el.rationale')}</label>
            <textarea id="ra-link-why" className="form-input" rows={2} value={rationale} onChange={e => setRationale(e.target.value)} />
          </div>
        )}
        {linkType === 'EXCEPTION_TO' && (
          <div className="form-group">
            <label className="form-label" htmlFor="ra-link-exp">{t('refarch.el.expires')}</label>
            <input id="ra-link-exp" type="date" className="form-input" value={expires} onChange={e => setExpires(e.target.value)} />
          </div>
        )}
        {candidates.length > 0 && (
          <ul className="ra-list">{candidates.map((a: any) => (
            <li key={a.id}>
              <span>{a.name} <span className="text-dim" style={{ fontSize: 11 }}>{a.assetType}</span></span>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => run(() => api.post(`/reference-architectures/${architectureId}/links`, { elementKey: key, linkType, targetModule: 'REPOSITORY', targetId: a.id, rationale: rationale || undefined, exceptionExpiresAt: expires || undefined }))}>{t('refarch.el.record')}</button>
            </li>
          ))}</ul>
        )}
      </div>

      <div className="ap-section">
        <div className="ap-section-title">{t('refarch.el.decide')}</div>
        <div className="form-group">
          <label className="form-label" htmlFor="ra-decision">{t('refarch.el.decide')}</label>
          <select id="ra-decision" className="form-input" value={decision} onChange={e => setDecision(e.target.value)}>
            <option value="NO_IMPLEMENTATION_EXISTS">{t('refarch.absence.NO_IMPLEMENTATION_EXISTS')}</option>
            <option value="NOT_APPLICABLE">{t('refarch.absence.NOT_APPLICABLE')}</option>
            <option value="NOT_ASSESSABLE">{t('refarch.conf.INSUFFICIENT_DATA')}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="ra-decision-why">{t('refarch.el.rationale')}</label>
          <textarea id="ra-decision-why" className="form-input" rows={2} value={decisionWhy} onChange={e => setDecisionWhy(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={!decisionWhy.trim()} onClick={() => run(() => api.post(`/reference-architectures/${architectureId}/decisions`, { elementKey: key, outcome: decision, rationale: decisionWhy }))}>{t('refarch.el.record')}</button>
      </div>
    </aside>
  )
}
