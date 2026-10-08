import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { ownerApi, fmtDate, VIEW_STATUS_COLOR } from './ownerApi'
import { ErrorBox, fill, Header, Loading, Pill, StepUpModal } from './ownerUi'
import { AdoptionPanel, BeneficiaryPanel, ConceptCounts, HealthPanel, MaturityPanel } from './AssessmentPanels'
import EnrichmentPanel from './EnrichmentPanel'
import ReferencePackPanel from './ReferencePackPanel'
import { AuditTable, SessionsTable } from './OwnerAuditPage'

export const DETAIL_TABS = ['overview', 'repository', 'maturity', 'beneficiaries', 'enrichment', 'reference', 'views', 'recommendations', 'activity'] as const

export default function OwnerTenantDetailPage() {
  const { tenantId = '', tab: pathTab } = useParams()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { t, isAR } = useLang()
  const { enterTenant } = useAuth()
  const tab = (DETAIL_TABS as readonly string[]).includes(pathTab || '') ? pathTab! : ((DETAIL_TABS as readonly string[]).includes(params.get('tab') || '') ? params.get('tab')! : 'overview')
  const [detail, setDetail] = useState<any>(null)
  const [assessment, setAssessment] = useState<any>(null)
  const [me, setMe] = useState<any>(null)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<'enter' | 'status' | null>(null)
  const [duration, setDuration] = useState(30)

  const load = useCallback(() => {
    setError('')
    ownerApi.tenant(tenantId).then(setDetail).catch((e: any) => setError(e.message))
  }, [tenantId])
  useEffect(() => { load(); ownerApi.me().then(setMe).catch(() => undefined) }, [load])
  const needsAssessment = ['repository', 'maturity', 'beneficiaries', 'overview'].includes(tab)
  const loadAssessment = useCallback(() => { ownerApi.maturity(tenantId).then(setAssessment).catch((e: any) => setError(e.message)) }, [tenantId])
  useEffect(() => { if (needsAssessment && !assessment) loadAssessment() }, [needsAssessment, assessment, loadAssessment])

  const go = (next: string) => nav(`/owner/tenants/${tenantId}${next === 'overview' ? '' : `/${next}`}`)
  if (error && !detail) return <ErrorBox error={error} onRetry={load} />
  if (!detail) return <Loading />
  const ten = detail.tenant
  const name = isAR && detail.branding?.organizationNameAr ? detail.branding.organizationNameAr : ten.name
  const active = ten.status === 'ACTIVE'

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <button type="button" className="btn btn-sm btn-secondary" onClick={() => nav('/owner/tenants')} style={{ marginBottom: 10 }}>{isAR ? '→' : '←'} {t('owner.detail.back')}</button>
      <Header title={name} subtitle={`${ten.slug}${detail.profile?.officialWebsite ? ` · ${detail.profile.officialWebsite}` : ''}`}
        actions={<>
          <Pill text={t(`owner.status.${ten.status}`)} color={active ? 'var(--success)' : 'var(--danger)'} />
          {active && <button type="button" className="btn btn-primary" onClick={() => setModal('enter')}>{t('owner.enter.button')}</button>}
          <button type="button" className="btn btn-secondary" onClick={() => setModal('status')}>{active ? t('owner.detail.suspend') : t('owner.detail.activate')}</button>
        </>} />
      {error && <ErrorBox error={error} />}
      <div className="oc-tabs" role="tablist">
        {DETAIL_TABS.map(k => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`oc-tab${tab === k ? ' active' : ''}`} onClick={() => go(k)}>{t(`owner.detail.tab.${k}`)}</button>)}
      </div>

      {tab === 'overview' && <Overview detail={detail} assessment={assessment} onEnrich={() => go('enrichment')} />}
      {tab === 'repository' && (assessment ? <><ConceptCounts concepts={assessment.conceptCounts} /><div className="oc-section"><HealthPanel health={assessment.health} /></div></> : <Loading />)}
      {tab === 'maturity' && (assessment ? <><MaturityPanel assessment={assessment} /><div className="oc-section oc-grid-2"><HealthPanel health={assessment.health} /><AdoptionPanel adoption={assessment.adoption} /></div></> : <Loading />)}
      {tab === 'beneficiaries' && (assessment ? <BeneficiaryPanel assessment={assessment} /> : <Loading />)}
      {tab === 'enrichment' && <EnrichmentPanel tenantId={tenantId} website={detail.profile?.officialWebsite} webSearch={me?.capabilities?.webSearch} onCommitted={() => { setAssessment(null); load() }} />}
      {tab === 'reference' && <ReferencePackPanel tenantId={tenantId} />}
      {tab === 'views' && <ViewsPanel tenantId={tenantId} />}
      {tab === 'recommendations' && <RecommendationsPanel tenantId={tenantId} onNavigate={go} />}
      {tab === 'activity' && <ActivityPanel tenantId={tenantId} />}

      {modal === 'enter' && (
        <StepUpModal title={t('owner.enter.title')} help={t('owner.enter.help')} needReason reasonPlaceholder={t('owner.enter.reason_placeholder')} confirmLabel={t('owner.enter.button')}
          extra={<div className="form-group"><label className="form-label" htmlFor="owner-enter-duration">{t('owner.enter.duration')}</label><input id="owner-enter-duration" className="form-input" type="number" min={5} max={120} value={duration} onChange={e => setDuration(Number(e.target.value) || 30)} /></div>}
          onCancel={() => setModal(null)}
          onConfirm={async ({ reason, password }) => {
            const res = await ownerApi.enter(tenantId, { reason, password, durationMinutes: duration })
            await enterTenant(res.accessToken)
            nav('/app')
          }} />
      )}
      {modal === 'status' && (
        <StepUpModal title={t('owner.detail.status_title')} help={t('owner.detail.status_help')} needReason confirmLabel={active ? t('owner.detail.suspend') : t('owner.detail.activate')}
          onCancel={() => setModal(null)}
          onConfirm={async ({ reason, password }) => {
            await ownerApi.setStatus(tenantId, { status: active ? 'SUSPENDED' : 'ACTIVE', reason, password })
            setModal(null)
            load()
          }} />
      )}
    </div>
  )
}

function Overview({ detail, assessment, onEnrich }: { detail: any; assessment: any; onEnrich: () => void }) {
  const { t, isAR } = useLang()
  const p = detail.profile || {}
  return (
    <div className="oc-grid-2">
      <div className="oc-card">
        <h3>{t('owner.detail.profile')}</h3>
        <dl className="oc-kv">
          <dt>{t('owner.detail.website')}</dt><dd>{p.officialWebsite ? <a href={p.officialWebsite} target="_blank" rel="noopener noreferrer">{p.officialWebsite}</a> : '—'}</dd>
          <dt>{t('owner.detail.country')}</dt><dd>{p.country || '—'}</dd>
          <dt>{t('owner.detail.sector')}</dt><dd>{p.sector || '—'}</dd>
          <dt>{t('owner.detail.org_type')}</dt><dd>{p.organizationType ? t(`owner.create.org_type.${p.organizationType}`) : '—'}</dd>
          <dt>{t('owner.detail.description')}</dt><dd>{p.description || '—'}</dd>
          <dt>{t('owner.detail.meta_model')}</dt><dd>{detail.metaModel?.published ? `${detail.metaModel.name} · v${detail.metaModel.published.version}` : t('owner.detail.meta_model_none')}</dd>
          <dt>{t('owner.col.created')}</dt><dd>{fmtDate(detail.tenant.createdAt, isAR)}</dd>
        </dl>
      </div>
      <div className="oc-card">
        <h3>{t('owner.detail.users')}</h3>
        <dl className="oc-kv">
          <dt>{t('owner.detail.users')}</dt><dd>{detail.users.active} / {detail.users.total}</dd>
          <dt>{t('owner.detail.pending_invites')}</dt><dd>{detail.users.pendingInvitations}</dd>
          <dt>{t('owner.detail.admins')}</dt><dd>{detail.users.admins.length ? detail.users.admins.map((a: any) => a.email).join(', ') : '—'}</dd>
        </dl>
        <h3 style={{ marginTop: 14 }}>{t('owner.detail.latest_job')}</h3>
        {detail.latestEnrichmentJob ? (
          <div style={{ fontSize: 13 }}>{t(`owner.stage.${detail.latestEnrichmentJob.status}`)} · {fmtDate(detail.latestEnrichmentJob.createdAt, isAR)} <button type="button" className="btn btn-sm btn-secondary" onClick={onEnrich}>{t('owner.enrich.review')}</button></div>
        ) : <button type="button" className="btn btn-sm btn-primary" onClick={onEnrich}>{t('owner.enrich.launch')}</button>}
        {detail.activeAccessSessions.length > 0 && (
          <><h3 style={{ marginTop: 14 }}>{t('owner.detail.active_sessions')}</h3>
          <ul style={{ paddingInlineStart: 18, fontSize: 13 }}>{detail.activeAccessSessions.map((s: any) => <li key={s.id}>{fmtDate(s.startedAt, isAR)} → {fmtDate(s.expiresAt, isAR)} · {s.reason}</li>)}</ul></>
        )}
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <div className="oc-section-title">{t('owner.detail.concepts')}</div>
        {assessment ? <ConceptCounts concepts={assessment.conceptCounts} /> : <Loading />}
      </div>
    </div>
  )
}

function ViewsPanel({ tenantId }: { tenantId: string }) {
  const { t, isAR } = useLang()
  const [recs, setRecs] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [showAll, setShowAll] = useState(false)
  const load = useCallback(() => { ownerApi.viewRecommendations(tenantId).then(setRecs).catch((e: any) => setError(e.message)) }, [tenantId])
  useEffect(() => { load() }, [load])
  const prepare = async () => {
    setBusy(true); setError('')
    try { setResult(await ownerApi.prepareViews(tenantId)); load() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }
  const shown = (recs || []).filter(r => showAll || r.status !== 'INSUFFICIENT_DATA')
  const ready = (recs || []).filter(r => r.status === 'READY' && !r.existingViewIds.length).length
  return (
    <div>
      <Header title={t('owner.views.title')} help={t('owner.views.help')} actions={<button type="button" className="btn btn-primary" disabled={busy || !ready} onClick={prepare}>{t('owner.views.prepare')} ({ready})</button>} />
      {error && <ErrorBox error={error} />}
      {result && (
        <div className="oc-ok">
          {fill(t('owner.views.prepared'), { n: result.prepared.length })}
          {result.skipped.length > 0 && <div className="oc-muted">{t('owner.views.skipped')}: {result.skipped.map((s: any) => `${s.name} (${s.reason})`).join('; ')}</div>}
        </div>
      )}
      <label style={{ display: 'flex', gap: 6, fontSize: 13, marginBottom: 10 }}><input id="owner-views-all" type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />{t('owner.views.show_all')}</label>
      {!recs ? <Loading /> : (
        <div className="oc-table-wrap">
          <table className="oc-table">
            <thead><tr><th>{t('owner.views.col.view')}</th><th>{t('owner.views.col.status')}</th><th>{t('owner.views.col.value')}</th><th>{t('owner.views.col.why')}</th><th>{t('owner.views.col.visualization')}</th></tr></thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.viewpointId}>
                  <td style={{ minWidth: 200 }}><strong>{isAR && r.nameAr ? r.nameAr : r.name}</strong><div className="oc-muted">{isAR && r.purposeAr ? r.purposeAr : r.purpose}</div>{r.existingViewIds.length > 0 && <div className="oc-muted">✓ {t('owner.views.exists')}</div>}</td>
                  <td><Pill text={t(`owner.views.status.${r.status}`)} color={VIEW_STATUS_COLOR[r.status]} /></td>
                  <td>
                    <strong>{r.value.score}</strong>
                    <HelpTip text={r.value.breakdown.map((b: any) => `${b.factor}: ${b.points}/${b.weight}`).join(' · ')} />
                  </td>
                  <td style={{ minWidth: 240 }} className="oc-muted">{r.whyRecommended}{r.recommendation ? <div style={{ color: 'var(--text)' }}>{r.recommendation}</div> : null}</td>
                  <td className="oc-muted">{r.recommendedVisualization}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function RecommendationsPanel({ tenantId, onNavigate }: { tenantId: string; onNavigate: (tab: string) => void }) {
  const { t } = useLang()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => { ownerApi.recommendations(tenantId).then(setData).catch((e: any) => setError(e.message)) }, [tenantId])
  if (error) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const color = (p: string) => (p === 'HIGH' ? 'var(--danger)' : p === 'MEDIUM' ? 'var(--warning)' : 'var(--text-dim)')
  return (
    <div>
      <div className="oc-section-title">{t('owner.recs.nba')}</div>
      {data.nextBestActions.length === 0 ? <div className="oc-muted">{t('owner.recs.none')}</div> : (
        <ol style={{ paddingInlineStart: 20, display: 'grid', gap: 8, marginBottom: 18 }}>
          {data.nextBestActions.map((a: any) => (
            <li key={a.id} style={{ fontSize: 13 }}>
              <Pill text={t(`owner.priority.${a.priority}`)} color={color(a.priority)} /> <strong>{a.text}</strong>
              <div className="oc-muted">{a.reason}</div>
              {a.source !== 'RECOMMENDATION' && <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 4 }} onClick={() => onNavigate(a.source === 'VIEWS' && a.route === 'views' ? 'views' : 'enrichment')}>{t(a.source === 'VIEWS' && a.route === 'views' ? 'owner.detail.tab.views' : 'owner.detail.tab.enrichment')}</button>}
            </li>
          ))}
        </ol>
      )}
      <div className="oc-section-title">{t('owner.recs.title')}<HelpTip text={t('owner.recs.help')} /></div>
      {data.recommendations.length === 0 ? <div className="oc-muted">{t('owner.recs.none')}</div> : (
        <div style={{ display: 'grid', gap: 10 }}>
          {data.recommendations.map((r: any) => (
            <div key={r.id} className="oc-card">
              <h3><Pill text={t(`owner.priority.${r.priority}`)} color={color(r.priority)} /> {r.gap}</h3>
              <dl className="oc-kv">
                <dt>{t('owner.recs.why')}</dt><dd>{r.whyItMatters}</dd>
                <dt>{t('owner.recs.evidence')}</dt><dd>{r.evidence}</dd>
                <dt>{t('owner.recs.action')}</dt><dd><strong>{r.action}</strong></dd>
                <dt>{t('owner.recs.improvement')}</dt><dd>{r.expectedImprovement}</dd>
                <dt>{t('owner.recs.role')}</dt><dd>{r.suggestedRole}</dd>
                <dt>{t('owner.recs.timeframe')}</dt><dd>{r.timeframe}</dd>
                <dt>{t('owner.recs.capability')}</dt><dd>{r.archmindCapability.label}</dd>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActivityPanel({ tenantId }: { tenantId: string }) {
  const { t } = useLang()
  const [sessions, setSessions] = useState<any[] | null>(null)
  const [events, setEvents] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    ownerApi.sessions({ tenantId }).then(setSessions).catch((e: any) => setError(e.message))
    ownerApi.audit({ tenantId, limit: '200' }).then(setEvents).catch((e: any) => setError(e.message))
  }, [tenantId])
  useEffect(() => { load() }, [load])
  return (
    <div>
      {error && <ErrorBox error={error} />}
      <div className="oc-section-title">{t('owner.activity.sessions')}</div>
      {sessions ? <SessionsTable rows={sessions} onEnded={load} /> : <Loading />}
      <div className="oc-section">
        <div className="oc-section-title">{t('owner.activity.audit')}</div>
        {events ? <AuditTable rows={events} /> : <Loading />}
      </div>
    </div>
  )
}
