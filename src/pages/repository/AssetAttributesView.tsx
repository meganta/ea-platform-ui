import { useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { AssetProfile, displayValue, localName } from './assetProfile'

type T = (k: string) => string
const WIDE = new Set(['LONG_TEXT', 'RICH_TEXT', 'JSON_DATA'])

/**
 * Every attribute the Meta Model defines for the object's type, in its
 * groups, with the recorded value or "not recorded"; then any recorded
 * values the Meta Model does not define (never hidden).
 */
export default function AssetAttributesView({ profile, t, isAR }: { profile: AssetProfile; t: T; isAR: boolean }) {
  const [onlyRecorded, setOnlyRecorded] = useState(false)
  const groups = profile.attributeGroups || []
  const { filled, total } = profile.completeness || { filled: 0, total: 0 }

  if (!groups.length && !profile.otherAttributes?.length) {
    return <p className="ap-empty">{t(profile.resolution === 'RESOLVED' ? 'repository.profile.no_attributes' : 'repository.profile.type_unresolved')}</p>
  }
  return (
    <div>
      <div className="ap-toolbar">
        <span style={{ fontSize: 12 }}>{t('repository.profile.recorded_of').replace('{filled}', String(filled)).replace('{total}', String(total))}</span>
        <HelpTip text={t('repository.profile.attributes_help')} />
        <label className="ap-toggle" htmlFor="ap-only-recorded">
          <input id="ap-only-recorded" type="checkbox" checked={onlyRecorded} onChange={e => setOnlyRecorded(e.target.checked)} />
          {t('repository.profile.only_recorded')}
        </label>
      </div>
      {groups.map((g, gi) => {
        const attrs = g.attributes.filter(a => !onlyRecorded || a.hasValue)
        if (!attrs.length) return null
        const recorded = g.attributes.filter(a => a.hasValue).length
        return (
          <details key={g.id || gi} className="ap-group" open={!g.isCollapsed}>
            <summary><span>{localName(g, isAR) || t('repository.profile.general')}</span><span className="ap-slot-meta">{recorded}/{g.attributes.length}</span></summary>
            <div className="ap-group-body">
              <dl className="ap-attrs">
                {attrs.map(a => {
                  const text = displayValue(a, a.value, isAR)
                  return (
                    <div key={a.code} className={`ap-attr${WIDE.has(a.attributeType) ? ' ap-wide' : ''}`}>
                      <dt>{localName(a, isAR)}{a.isRequired && <span className="ap-required"> *</span>}</dt>
                      <dd>
                        {!text ? <span className="ap-empty">{t('repository.profile.not_recorded')}</span>
                          : a.attributeType === 'URL' && /^https?:\/\//i.test(text) ? <a href={text} target="_blank" rel="noopener noreferrer" dir="ltr">{text}</a>
                          : a.attributeType === 'EMAIL' ? <a href={`mailto:${text}`} dir="ltr">{text}</a>
                          : text}
                      </dd>
                    </div>
                  )
                })}
              </dl>
            </div>
          </details>
        )
      })}
      {!!profile.otherAttributes?.length && (
        <details className="ap-group" open>
          <summary><span>{t('repository.profile.other_data')}</span><HelpTip text={t('repository.profile.other_data_help')} /></summary>
          <div className="ap-group-body">
            <dl className="ap-attrs">
              {profile.otherAttributes.map(o => (
                <div key={o.key} className="ap-attr"><dt dir="ltr">{o.key}</dt><dd>{typeof o.value === 'object' ? JSON.stringify(o.value) : String(o.value)}</dd></div>
              ))}
            </dl>
          </div>
        </details>
      )}
    </div>
  )
}
