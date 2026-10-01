import { useLang } from '../contexts/LangContext'

export interface EAViewSnapshotData {
  viewId: string
  viewName: string
  scenarioType: string
  dataset: { objects: unknown[]; relationships: unknown[] }
  image?: { svg: string; shownNodes: number; shownEdges: number }
}

/** Displays the shared EA Views renderer's recorded result. No query or visualization engine. */
export function EAViewSnapshot({ snapshot }: { snapshot: EAViewSnapshotData }) {
  const { t } = useLang()
  return <figure className="ea-view-snapshot">
    <figcaption><strong>{snapshot.viewName}</strong> · {t(`strategy.refresh.label.${snapshot.scenarioType}`)}</figcaption>
    {snapshot.image && <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(snapshot.image.svg)}`} alt={snapshot.viewName} />}
    <p>{t('strategy.refresh.view_snapshot_note')}</p>
    {snapshot.image && <p>{t('strategy.refresh.shown_objects')}: {snapshot.image.shownNodes} / {snapshot.dataset.objects.length} · {t('strategy.refresh.shown_relationships')}: {snapshot.image.shownEdges} / {snapshot.dataset.relationships.length}</p>}
    <a href="/ea-views">{t('strategy.refresh.open_views')}</a>
  </figure>
}
