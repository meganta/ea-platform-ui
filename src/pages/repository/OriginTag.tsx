import { AssetProfile } from './assetProfile'

/** Where a field or relationship of an object comes from. */
export type Origin = 'meta' | 'other' | 'core'
type T = (k: string) => string

const ICON: Record<Origin, string> = { meta: '◆', other: '◇', core: '●' }

/** "v2.1 · Published" for the Meta Model version the profile was read from. */
export function metaModelLabel(profile: Pick<AssetProfile, 'metaModel'>, t: T) {
  const mm = profile.metaModel
  if (!mm?.version) return ''
  return `v${mm.version}${mm.status ? ` · ${t(`repository.profile.mm_status.${mm.status}`)}` : ''}`
}

/**
 * A small tag saying whether an attribute / relationship is defined by the
 * tenant's Meta Model, is data the Meta Model does not define, or is a core
 * field every Repository object has. The tooltip names the definition.
 */
export default function OriginTag({ origin, t, detail }: { origin: Origin; t: T; detail?: string }) {
  const label = t(`repository.profile.origin.${origin}`)
  const help = t(`repository.profile.origin.${origin}_help`)
  const title = detail ? `${help} (${detail})` : help
  return (
    <span className={`ap-origin ap-origin-${origin}`} title={title} data-origin={origin}>
      <span aria-hidden>{ICON[origin]}</span>
      <span>{label}</span>
      <span className="ap-sr">{` — ${title}`}</span>
    </span>
  )
}

/** The three tags side by side, explained once at the top of a list. */
export function OriginLegend({ t, profile, show = ['meta', 'other'] }: { t: T; profile: Pick<AssetProfile, 'metaModel'>; show?: Origin[] }) {
  const mm = metaModelLabel(profile, t)
  return (
    <div className="ap-legend" aria-label={t('repository.profile.origin.legend')}>
      {show.map(o => <OriginTag key={o} origin={o} t={t} detail={o === 'meta' ? mm : undefined} />)}
      {mm && <span className="ap-slot-meta">{t('repository.profile.origin.version').replace('{version}', mm)}</span>}
    </div>
  )
}
