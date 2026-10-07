import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { fmt, heatColor } from '../pages/health/health'

/** A domain (or enterprise) architecture health assessment Copilot attached to an answer. Numbers come from the platform's deterministic assessment. */
export interface CopilotHealthAttachment {
  kind: 'HEALTH_ASSESSMENT'
  id: string
  scope: 'DOMAIN' | 'ENTERPRISE'
  generatedAt: string
  summary?: {
    domain: { code: string; name: string; nameAr?: string | null }
    objectCount: number
    completeness: number | null
    relationshipCompleteness: number | null
    referenceCoverage: number | null
    maturity: { score: number | null; level: number | null; targetLevel: number; targetScore: number; gapPoints: number | null }
    collectionPlan: { completenessTo: number | null; maturityTo: number | null; items: number }
    topGaps: Array<{ key: string; label: string; priority: string; missing: number; expected: number }>
  }
  domains?: Array<{ code: string; name: string; maturityScore: number | null; maturityLevel: number | null; targetScore: number; completeness: number | null; relationshipCompleteness: number | null; gapPoints: number | null }>
  previous?: { createdAt: string; maturityScore: number | null; completenessScore: number | null } | null
}

export function isHealthAttachment(a: any): a is CopilotHealthAttachment {
  return !!a && a.kind === 'HEALTH_ASSESSMENT' && typeof a.id === 'string' && (a.scope === 'DOMAIN' || a.scope === 'ENTERPRISE')
}

export default function CopilotHealthCard({ attachment: a }: { attachment: CopilotHealthAttachment }) {
  const { t, isAR } = useLang()
  const box = { margin: '8px 0 0', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--navy-light)', maxWidth: '100%' } as const
  const linkStyle = { fontSize: 11.5, padding: '5px 11px', borderRadius: 8, background: 'var(--accent)', color: 'var(--navy)', border: '1px solid var(--accent)', fontWeight: 600, textDecoration: 'none', display: 'inline-block' } as const

  if (a.scope === 'ENTERPRISE') {
    return (
      <section data-testid="copilot-health-card" style={box}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>🩺 {t('copilot.health.enterprise')}</span>
          <HelpTip text={t('copilot.health.help')} />
        </div>
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', fontSize: 11.5, borderCollapse: 'collapse' }}>
            <thead><tr style={{ color: 'var(--text-dim)' }}><th style={{ textAlign: 'start' }}>{t('health.domain')}</th><th>{t('health.maturity')}</th><th>{t('health.target')}</th><th>{t('health.completeness')}</th><th>{t('health.relationships')}</th></tr></thead>
            <tbody>
              {(a.domains || []).map(d => (
                <tr key={d.code}>
                  <td><a href={`/architecture-health?domain=${encodeURIComponent(d.code)}`}>{d.name}</a></td>
                  <td style={{ textAlign: 'center' }}><span style={{ padding: '1px 6px', borderRadius: 6, background: heatColor(d.maturityScore) }}>{fmt(d.maturityScore)}</span></td>
                  <td style={{ textAlign: 'center' }}>{d.targetScore}</td>
                  <td style={{ textAlign: 'center' }}>{fmt(d.completeness, '%')}</td>
                  <td style={{ textAlign: 'center' }}>{fmt(d.relationshipCompleteness, '%')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 8 }}><a href="/architecture-health" style={linkStyle}>↗ {t('copilot.health.open')}</a></div>
      </section>
    )
  }

  const s = a.summary
  if (!s) return null
  const name = (isAR && s.domain.nameAr) || s.domain.name
  const delta = a.previous && a.previous.maturityScore !== null && s.maturity.score !== null ? Math.round((s.maturity.score - a.previous.maturityScore) * 10) / 10 : null
  const fact = (label: string, value: string) => (
    <div style={{ minWidth: 90 }}><div style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{label}</div><div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div></div>
  )
  return (
    <section data-testid="copilot-health-card" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: 'anywhere' }}>🩺 {t('copilot.health.domain').replace('{domain}', name)}</span>
        <HelpTip text={t('copilot.health.help')} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{s.objectCount} {t('health.objects')}</span>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
        {fact(t('health.maturity'), s.maturity.score === null ? t('health.na') : `${s.maturity.score} / ${s.maturity.targetScore}`)}
        {fact(t('health.level'), s.maturity.level ? `${s.maturity.level} → ${s.maturity.targetLevel}` : t('health.na'))}
        {fact(t('health.completeness'), fmt(s.completeness, '%'))}
        {fact(t('health.relationships'), fmt(s.relationshipCompleteness, '%'))}
        {s.referenceCoverage !== null && fact(t('health.reference'), fmt(s.referenceCoverage, '%'))}
        {delta !== null && fact(t('health.since_saved'), `${delta >= 0 ? '+' : ''}${delta}`)}
      </div>
      {s.collectionPlan.items > 0 && (
        <div style={{ fontSize: 11.5, marginTop: 8 }}>
          {t('copilot.health.plan').replace('{items}', String(s.collectionPlan.items)).replace('{from}', fmt(s.completeness)).replace('{to}', fmt(s.collectionPlan.completenessTo))}
        </div>
      )}
      {s.topGaps.length > 0 && (
        <ul style={{ margin: '6px 0 0', paddingInlineStart: 18, fontSize: 11.5 }}>
          {s.topGaps.slice(0, 3).map(g => <li key={g.key} style={{ overflowWrap: 'anywhere' }}>{g.label} — {g.missing}/{g.expected} <span style={{ color: 'var(--text-dim)' }}>({t(`health.priority.${g.priority}`)})</span></li>)}
        </ul>
      )}
      <div style={{ marginTop: 8 }}><a href={`/architecture-health?domain=${encodeURIComponent(s.domain.code)}`} style={linkStyle}>↗ {t('copilot.health.open')}</a></div>
    </section>
  )
}
