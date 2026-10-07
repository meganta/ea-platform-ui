import { useCallback, useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import HelpTip from '../../components/HelpTip'
import { useRelease, fill, ReleaseImpact, ReleaseChange, SEVERITY_COLOR } from './release'
import OrphanedLinksCard from './OrphanedLinksCard'
import './MetaModelRelease.css'

const STATUS_COLOR: Record<string, string> = { DRAFT: '#f39c12', PUBLISHED: '#2ecc71', DEPRECATED: '#7f8c8d', ARCHIVED: '#e74c3c' }

function ChangeRow({ c }: { c: ReleaseChange }) {
  const { t } = useLang()
  const color = SEVERITY_COLOR[c.impact.severity]
  const counts = [
    c.impact.objects ? fill(t('mm.rel.objects'), { n: c.impact.objects }) : null,
    c.impact.links ? fill(t('mm.rel.links'), { n: c.impact.links }) : null,
    c.impact.values ? fill(t('mm.rel.values'), { n: c.impact.values }) : null,
    c.impact.reconnects ? fill(t('mm.rel.reconnects'), { n: c.impact.reconnects }) : null,
  ].filter(Boolean)
  return (
    <div className="mm-change" style={{ borderLeftColor: color }} data-testid="mm-change">
      <div className="mm-change-head">
        <span className="mm-pill" style={{ background: color + '22', color }}>{t(`mm.rel.sev.${c.impact.severity}`)}</span>
        <span className="mm-meta">{t(`mm.rel.kind.${c.kind}`)} · {t(`mm.rel.action.${c.action}`)}</span>
        <strong>{c.name}</strong>
        <span className="mm-meta" style={{ fontFamily: 'monospace' }}>{c.ownerCode ? `${c.ownerCode}.` : ''}{c.code}</span>
        {counts.length > 0 && <span className="mm-meta">· {counts.join(' · ')}</span>}
      </div>
      {c.fields.length > 0 && (
        <div className="mm-meta" style={{ marginTop: 4 }}>
          {fill(t('mm.rel.fields'), { fields: c.fields.map(f => `${f.field}: ${f.before ?? '—'} → ${f.after ?? '—'}`).join('; ') })}
        </div>
      )}
      <ul>{c.impact.consequences.map((s, i) => <li key={i}>{s}</li>)}</ul>
      {c.impact.views.length > 0 && <div className="mm-meta" style={{ marginTop: 4 }}>{t('mm.rel.views')}: {c.impact.views.map(v => v.name).join(', ')}</div>}
      {c.impact.referenceElements.length > 0 && <div className="mm-meta">{t('mm.rel.refs')}: {c.impact.referenceElements.map(v => v.name).join(', ')}</div>}
    </div>
  )
}

/** Versions & Release: start a draft, review what it changes and what that does to the tenant's data, publish or discard it. */
export default function ReleasePanel({ api }: { api: any }) {
  const { t, isAR } = useLang()
  const { hasPermission } = useAuth() as any
  const isAdmin = !!hasPermission?.('Tenant.Administer')
  const { versions, draft, published, reload } = useRelease()
  const [impact, setImpact] = useState<ReleaseImpact | null>(null)
  const [loadingImpact, setLoadingImpact] = useState(false)
  const [filter, setFilter] = useState<'all' | 'attention'>('all')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [form, setForm] = useState({ version: '', description: '' })

  const loadImpact = useCallback(() => {
    setImpact(null); setAck(false)
    if (!draft) return
    setLoadingImpact(true)
    api.get(`/meta-model/versions/${draft.id}/impact`)
      .then((r: ReleaseImpact) => setImpact(r))
      .catch((e: any) => setNotice({ kind: 'err', text: e.message }))
      .finally(() => setLoadingImpact(false))
  }, [api, draft])
  useEffect(() => { loadImpact() }, [loadImpact])

  const createDraft = async () => {
    if (!form.version.trim()) return
    setBusy(true); setNotice(null)
    try {
      await api.post('/meta-model/versions', { version: form.version.trim(), description: form.description.trim() || undefined })
      setForm({ version: '', description: '' })
      reload()
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }

  const publish = async () => {
    if (!draft) return
    setBusy(true); setNotice(null)
    try {
      await api.post(`/meta-model/versions/${draft.id}/publish`, { acknowledge: ack })
      setNotice({ kind: 'ok', text: fill(t('mm.rel.published_ok'), { version: draft.version }) })
      reload()
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }

  const discard = async () => {
    if (!draft || !window.confirm(fill(t('mm.rel.discard_confirm'), { draft: draft.version }))) return
    setBusy(true); setNotice(null)
    try {
      await api.del(`/meta-model/versions/${draft.id}`)
      setNotice({ kind: 'ok', text: fill(t('mm.rel.discarded'), { draft: draft.version }) })
      reload()
    } catch (e: any) { setNotice({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }

  const summary = impact?.summary
  const shown = (impact?.changes || []).filter(c => filter === 'all' || c.impact.severity !== 'NON_BREAKING')
  const needsAck = !!summary?.requiresAcknowledgement
  const step = !draft ? 0 : summary && summary.total > 0 ? 1 : 0

  return (
    <div className="mm-stack" dir={isAR ? 'rtl' : 'ltr'}>
      <div className="mm-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{t('mm.rel.title')}<HelpTip text={t('mm.rel.help')} /></div>
          <div className="mm-meta" style={{ fontSize: 13 }}>{t('mm.rel.subtitle')}</div>
        </div>
        <div className="mm-steps" aria-label={t('mm.rel.title')}>
          {['draft', 'review', 'publish'].map((s, i) => <span key={s} className={`mm-step${i === step ? ' active' : ''}`}>{i + 1}. {t(`mm.rel.step.${s}`)}</span>)}
        </div>
      </div>

      {notice && <div className={`mm-notice ${notice.kind}`} role="status">{notice.text}</div>}
      {!isAdmin && <div className="mm-notice warn">{t('mm.rel.admin_only')}</div>}

      {!draft && (
        <div className="mm-card mm-stack">
          <div className="mm-meta" style={{ fontSize: 13 }}>{t('mm.rel.no_draft')}</div>
          <div style={{ fontWeight: 600 }}>{t('mm.rel.new_title')}</div>
          <div className="mm-meta">{t('mm.rel.new_hint')}</div>
          <div className="mm-form">
            <div className="mm-field">
              <label htmlFor="mm-new-version">{t('mm.rel.version_name')}</label>
              <input id="mm-new-version" value={form.version} onChange={e => setForm(f => ({ ...f, version: e.target.value }))} placeholder="2026.10" />
            </div>
            <div className="mm-field">
              <label htmlFor="mm-new-description">{t('mm.rel.description')}</label>
              <input id="mm-new-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div><button type="button" className="mm-btn primary" disabled={!isAdmin || busy || !form.version.trim()} onClick={createDraft}>{busy ? t('mm.rel.creating') : t('mm.rel.create')}</button></div>
        </div>
      )}

      {draft && (
        <div className="mm-card mm-stack">
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{fill(t('mm.rel.draft_title'), { draft: draft.version })}</div>
            {draft.description && <div className="mm-meta" style={{ fontSize: 13 }}>{draft.description}</div>}
            <div className="mm-meta">{published ? fill(t('mm.rel.compared'), { published: published.version }) : t('mm.rel.compared_first')}</div>
          </div>

          {loadingImpact && <div className="mm-meta">{t('mm.rel.loading')}</div>}
          {summary && (
            <>
              <div className="mm-tiles">
                <div className="mm-tile"><div className="mm-tile-label">{t('mm.rel.total')}</div><div className="mm-tile-value">{summary.total}</div></div>
                <div className="mm-tile"><div className="mm-tile-label">{t('mm.rel.sev.BREAKING')}</div><div className="mm-tile-value" style={{ color: SEVERITY_COLOR.BREAKING }}>{summary.breaking}</div></div>
                <div className="mm-tile"><div className="mm-tile-label">{t('mm.rel.sev.POTENTIALLY_BREAKING')}</div><div className="mm-tile-value" style={{ color: SEVERITY_COLOR.POTENTIALLY_BREAKING }}>{summary.potentiallyBreaking}</div></div>
                <div className="mm-tile"><div className="mm-tile-label">{t('mm.rel.sev.NON_BREAKING')}</div><div className="mm-tile-value" style={{ color: SEVERITY_COLOR.NON_BREAKING }}>{summary.nonBreaking}</div></div>
              </div>
              {summary.total === 0 ? <div className="mm-meta" style={{ fontSize: 13 }}>{t('mm.rel.no_changes')}</div> : (
                <>
                  <div className="mm-row">
                    {(['all', 'attention'] as const).map(f => (
                      <button key={f} type="button" className={`mm-btn small${filter === f ? ' primary' : ''}`} onClick={() => setFilter(f)}>{t(`mm.rel.filter.${f}`)}</button>
                    ))}
                  </div>
                  <div className="mm-stack" style={{ gap: 8 }}>{shown.map(c => <ChangeRow key={c.key} c={c} />)}</div>
                </>
              )}
              {needsAck && (
                <label className="mm-row" style={{ fontSize: 13 }}>
                  <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} data-testid="mm-ack" />
                  {t('mm.rel.ack')}
                </label>
              )}
            </>
          )}

          <div className="mm-row">
            <button type="button" className="mm-btn primary" disabled={!isAdmin || busy || !summary || summary.total === 0 || (needsAck && !ack)} onClick={publish}>
              {busy ? t('mm.rel.publishing') : t('mm.rel.publish')}
            </button>
            <button type="button" className="mm-btn danger" disabled={!isAdmin || busy} onClick={discard}>{t('mm.rel.discard')}</button>
          </div>
        </div>
      )}

      {isAdmin && <OrphanedLinksCard api={api} refreshKey={published?.id} />}

      <div className="mm-card mm-stack">
        <div style={{ fontWeight: 600 }}>{t('mm.rel.history')}</div>
        {versions.map(v => (
          <div key={v.id} className="mm-version">
            <strong>{v.version}</strong>
            <span className="mm-pill" style={{ background: (STATUS_COLOR[v.status] || '#7f8c8d') + '22', color: STATUS_COLOR[v.status] || '#7f8c8d' }}>{t(`mm.rel.status.${v.status}`)}</span>
            {v.description && <span className="mm-meta" style={{ fontSize: 12 }}>{v.description}</span>}
            <span className="mm-meta" style={{ marginInlineStart: 'auto' }}>
              {fill(t('mm.rel.counts'), { d: v._count?.domains || 0, t: v._count?.objectTypes || 0, r: v._count?.relationships || 0 })}
              {v.publishedAt ? ` · ${fill(t('mm.rel.published_on'), { date: new Date(v.publishedAt).toLocaleDateString(isAR ? 'ar-SA' : 'en-GB') })}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
