import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

interface ViewPicture { viewId: string; title: string; svgContent: string; visualization: string; architectureState: string; objects: number; openUrl: string }

/**
 * The architecture pictures of an ADM output: the EA Views linked to it
 * (Architecture Impact), drawn from live Repository data. ADM never draws
 * diagrams of its own; these are the same pictures the Word and PowerPoint
 * exports carry.
 */
export default function AdmOutputViews({ outputId }: { outputId: string }) {
  const { t, isAR } = useLang()
  const navigate = useNavigate()
  const [pictures, setPictures] = useState<ViewPicture[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_URL}/adm-intelligence/outputs/${outputId}/view-pictures`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` } })
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (!cancelled) setPictures(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setPictures([]) })
    return () => { cancelled = true }
  }, [outputId])

  if (pictures === null) return null
  return (
    <section className="adm-views" dir={isAR ? 'rtl' : 'ltr'} data-testid="adm-output-views">
      <div className="adm-views-head">
        <span className="adm-views-title">{t('adm.views_title')}</span>
        <HelpTip text={t('adm.views_help')} />
      </div>
      {pictures.length === 0 ? (
        <div className="adm-views-empty">{t('adm.views_empty')}</div>
      ) : pictures.map(p => (
        <figure key={p.viewId} className="adm-views-figure">
          <img className="adm-views-img" alt={p.title} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(p.svgContent)}`} />
          <figcaption className="adm-views-caption">
            <strong>{p.title}</strong>
            <span>{p.visualization.replace(/_/g, ' ')} · {p.architectureState} · {p.objects} {t('adm.views_objects')}</span>
            <button type="button" className="adm-views-open" onClick={() => navigate(p.openUrl)}>{t('adm.views_open')}</button>
          </figcaption>
        </figure>
      ))}
    </section>
  )
}
