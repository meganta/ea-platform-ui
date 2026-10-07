import { useLang } from '../contexts/LangContext'

/** Where a Decision & Evaluation assessment came from: "Prepared by Copilot · <architect> (<domain> domain)" or the Chief Architect. */
export default function DecisionPreparedBy({ assessment: a }: { assessment: { originType?: string | null; preparedBy?: string | null; preparedByArchitectName?: string | null; preparedByArchitectCode?: string | null; preparedByDomain?: string | null } }) {
  const { t } = useLang()
  if (a.preparedBy !== 'COPILOT' && a.originType !== 'COPILOT_RESEARCH') return null
  const who = a.preparedByArchitectName || a.preparedByArchitectCode
  const role = !who ? '' : a.preparedByDomain ? t('decision.prepared.domain').replace('{name}', who).replace('{domain}', a.preparedByDomain) : t('decision.prepared.chief').replace('{name}', who)
  return (
    <span data-testid="decision-prepared-by" title={t('decision.prepared.help')}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--accent)', color: 'var(--accent)', maxWidth: '100%', overflowWrap: 'anywhere' }}>
      🤖 {t('decision.prepared.copilot')}{role ? ` · ${role}` : ''}{a.originType === 'COPILOT_RESEARCH' ? ` · ${t('decision.prepared.from_research')}` : ''}
    </span>
  )
}
