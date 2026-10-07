import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { useRelease, fill, ReleaseImpact } from './release'
import './MetaModelRelease.css'

/** Always-visible release state of the studio: which version the screens show and whether they can be edited. */
export default function VersionBar({ api, onOpenRelease }: { api: any; onOpenRelease: () => void }) {
  const { t, isAR } = useLang()
  const { draft, published } = useRelease()
  const [summary, setSummary] = useState<ReleaseImpact['summary'] | null>(null)

  useEffect(() => {
    setSummary(null)
    if (!draft) return
    let live = true
    api.get(`/meta-model/versions/${draft.id}/impact`).then((r: ReleaseImpact) => { if (live) setSummary(r?.summary || null) }).catch(() => {})
    return () => { live = false }
  }, [api, draft])

  if (!draft && !published) {
    return <div className="mm-bar" dir={isAR ? 'rtl' : 'ltr'}><span className="mm-bar-dim">{t('mm.bar.none')}</span></div>
  }

  if (draft) {
    const attention = summary ? summary.breaking + summary.potentiallyBreaking : 0
    return (
      <div className="mm-bar draft" dir={isAR ? 'rtl' : 'ltr'} data-testid="mm-version-bar">
        <div className="mm-bar-text">
          <span className="mm-pill" style={{ background: '#f39c1233', color: '#f39c12' }}>{t('mm.rel.status.DRAFT')}</span>
          <strong>{fill(t('mm.bar.draft'), { draft: draft.version })}</strong>
          <span className="mm-bar-dim">{published ? fill(t('mm.bar.based_on'), { published: published.version }) : t('mm.bar.first')}</span>
          {summary && <span className="mm-bar-dim">· {fill(t('mm.bar.changes'), { n: summary.total })}</span>}
          {attention > 0 && <span className="mm-pill" style={{ background: '#e74c3c22', color: '#e74c3c' }}>{fill(t('mm.bar.breaking'), { n: attention })}</span>}
          <HelpTip text={t('mm.bar.help')} />
        </div>
        <button type="button" className="mm-btn primary" onClick={onOpenRelease}>{t('mm.bar.review')}</button>
      </div>
    )
  }

  return (
    <div className="mm-bar published" dir={isAR ? 'rtl' : 'ltr'} data-testid="mm-version-bar">
      <div className="mm-bar-text">
        <span className="mm-pill" style={{ background: '#2ecc7122', color: '#2ecc71' }}>{t('mm.rel.status.PUBLISHED')}</span>
        <strong>{fill(t('mm.bar.published'), { published: published!.version })}</strong>
        <HelpTip text={t('mm.bar.help')} />
      </div>
      <button type="button" className="mm-btn primary" onClick={onOpenRelease}>{t('mm.bar.start')}</button>
    </div>
  )
}
