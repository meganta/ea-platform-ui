import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { fill, WhereUsed, SEVERITY_COLOR } from './release'
import './MetaModelRelease.css'

export type DeleteKind = 'domain' | 'object-type' | 'attribute' | 'relationship'

const DELETE_PATH: Record<DeleteKind, string> = {
  domain: '/meta-model/domains/',
  'object-type': '/meta-model/object-types/',
  attribute: '/meta-model/attributes/',
  relationship: '/meta-model/relationships/',
}

function List({ title, items, total }: { title: string; items: string[]; total?: number }) {
  const { t } = useLang()
  if (!items.length) return null
  const more = (total ?? items.length) - items.length
  return (
    <div>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
      <ul>
        {items.map((s, i) => <li key={i}>{s}</li>)}
        {more > 0 && <li className="mm-meta">{fill(t('mm.del.and_more'), { n: more })}</li>}
      </ul>
    </div>
  )
}

/**
 * Delete with impact tracing: before anything is removed it shows where the
 * item is used (Repository objects, links, stored values, saved EA Views,
 * reference architectures, relationships that go with it) and what happens
 * when the draft is published. Blocked cases say why and what to do instead.
 */
export default function DeleteImpactDialog({ api, kind, id, name, onClose, onDeleted }: {
  api: any; kind: DeleteKind; id: string; name: string; onClose: () => void; onDeleted: () => void
}) {
  const { t, isAR } = useLang()
  const [info, setInfo] = useState<WhereUsed | null>(null)
  const [error, setError] = useState('')
  const [ack, setAck] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    api.get(`/meta-model/where-used/${kind}/${id}`).then((r: WhereUsed) => { if (live) setInfo(r) }).catch((e: any) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [api, kind, id])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const severity = info?.impact.severity
  const needsAck = !!severity && severity !== 'NON_BREAKING'

  const confirm = async () => {
    setBusy(true); setError('')
    try {
      await api.del(`${DELETE_PATH[kind]}${id}`)
      onDeleted()
    } catch (e: any) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="mm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="mm-dialog" role="dialog" aria-modal="true" aria-labelledby="mm-del-title" dir={isAR ? 'rtl' : 'ltr'}>
        <h2 id="mm-del-title">{fill(t('mm.del.title'), { name })}</h2>
        <div className="mm-meta" style={{ fontSize: 12 }}>{t('mm.del.help')}</div>
        {error && <div className="mm-notice err" role="alert">{error}</div>}
        {!info && !error && <div className="mm-meta">{t('mm.del.loading')}</div>}
        {info && (
          <>
            {info.blocked && <div className="mm-notice err" data-testid="mm-del-blocked"><strong>{t('mm.del.blocked')}:</strong> {info.blocked}</div>}
            {info.warning && <div className="mm-notice warn">{info.warning}</div>}
            <div>
              <div className="mm-row">
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t('mm.del.consequences')}</span>
                <span className="mm-pill" style={{ background: SEVERITY_COLOR[info.impact.severity] + '22', color: SEVERITY_COLOR[info.impact.severity] }}>{t(`mm.rel.sev.${info.impact.severity}`)}</span>
              </div>
              <ul>{info.impact.consequences.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <List title={t('mm.del.types_in_domain')} items={(info.objectTypes || []).map(o => o.name)} />
            <List title={t('mm.del.sample_objects')} items={(info.sampleObjects || []).map(o => o.name)} total={kind === 'attribute' ? info.impact.values : info.impact.objects} />
            <List title={t('mm.del.sample_links')} items={(info.sampleLinks || []).map(l => `${l.source} → ${l.target}`)} total={info.impact.links} />
            <List title={t('mm.del.also_removed')} items={(info.relationships || []).map(r => `${r.from} → ${r.label} → ${r.to}${r.links ? ` (${fill(t('mm.rel.links'), { n: r.links })})` : ''}`)} />
            <List title={t('mm.rel.views')} items={info.impact.views.map(v => v.name)} />
            <List title={t('mm.rel.refs')} items={info.impact.referenceElements.map(v => v.name)} />
            {kind === 'object-type' && !!info.attributeCount && <div className="mm-meta">{fill(t('mm.del.attributes'), { n: info.attributeCount })}</div>}
            {info.canDelete && needsAck && (
              <label className="mm-row" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} data-testid="mm-del-ack" />
                {t('mm.del.ack')}
              </label>
            )}
          </>
        )}
        <div className="mm-dialog-actions">
          <button type="button" className="mm-btn" onClick={onClose}>{info && !info.canDelete ? t('mm.del.close') : t('mm.del.cancel')}</button>
          {info?.canDelete && (
            <button type="button" className="mm-btn danger" disabled={busy || (needsAck && !ack)} onClick={confirm}>
              {busy ? t('mm.del.deleting') : t('mm.del.confirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
