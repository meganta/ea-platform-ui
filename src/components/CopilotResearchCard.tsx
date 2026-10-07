import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import HelpTip from './HelpTip'

const API = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'
export const RESEARCH_POLL_MS = 6000

/** A technology / market research Copilot started or showed; the card follows it until it is done. */
export interface CopilotResearchAttachment { kind: 'RESEARCH'; id: string; researchId: string; title: string; status: string; provider: string; createdAt: string }

export function isResearchAttachment(a: any): a is CopilotResearchAttachment {
  return !!a && a.kind === 'RESEARCH' && typeof a.researchId === 'string'
}

const EVIDENCE_STYLE: Record<string, string> = { INTERNET_RESEARCH: 'var(--accent)', REPOSITORY_FACT: '#16a34a', AI_INFERENCE: '#d97706', ARCHITECT_RECOMMENDATION: 'var(--text)' }

function Evidence({ e, t }: { e: string; t: (k: string) => string }) {
  return <span style={{ fontSize: 10, padding: '0 6px', borderRadius: 999, border: `1px solid ${EVIDENCE_STYLE[e] || 'var(--border)'}`, color: EVIDENCE_STYLE[e] || 'var(--text-dim)', whiteSpace: 'nowrap' }}>{t(`copilot.research.evidence.${e}`)}</span>
}

const host = (u: string) => { try { return new URL(u).hostname } catch { return u } }

export default function CopilotResearchCard({ attachment: a }: { attachment: CopilotResearchAttachment }) {
  const { t, isAR } = useLang()
  const [r, setR] = useState<any>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const { hasPermission } = useAuth()
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState(false)
  const [radar, setRadar] = useState<any>(null)
  const [radarBusy, setRadarBusy] = useState(false)
  const [radarResult, setRadarResult] = useState<any>(null)
  const [radarError, setRadarError] = useState(false)

  useEffect(() => {
    let stop = false
    let timer: any
    const load = async () => {
      try {
        const res = await fetch(`${API}/technology-research/${encodeURIComponent(a.researchId)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` } })
        if (!res.ok) throw new Error(String(res.status))
        const body = await res.json()
        if (stop) return
        setR(body); setLoadFailed(false)
        if (body.status === 'RUNNING') timer = setTimeout(load, RESEARCH_POLL_MS)
      } catch {
        if (!stop) setLoadFailed(true)
      }
    }
    load()
    return () => { stop = true; clearTimeout(timer) }
  }, [a.researchId])

  const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` })
  const loadRadar = async () => {
    setRadarBusy(true); setRadarError(false)
    try {
      const res = await fetch(`${API}/technology-research/${encodeURIComponent(a.researchId)}/radar-matches`, { headers: auth() })
      if (!res.ok) throw new Error(String(res.status))
      setRadar(await res.json())
    } catch { setRadarError(true) }
    finally { setRadarBusy(false) }
  }
  const sendToRadar = async (technologyId: string) => {
    setRadarBusy(true); setRadarError(false)
    try {
      const res = await fetch(`${API}/technology-research/${encodeURIComponent(a.researchId)}/radar`, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ technologyId }) })
      if (!res.ok) throw new Error(String(res.status))
      setRadarResult(await res.json()); setRadar(null)
    } catch { setRadarError(true) }
    finally { setRadarBusy(false) }
  }

  const send = async () => {
    setSending(true); setSendError(false)
    try {
      const res = await fetch(`${API}/technology-research/${encodeURIComponent(a.researchId)}/decision-assessment`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` } })
      if (!res.ok) throw new Error(String(res.status))
      const body = await res.json()
      setR((prev: any) => ({ ...prev, decisionAssessmentId: body.assessment.id }))
    } catch { setSendError(true) }
    finally { setSending(false) }
  }

  const status = r?.status || a.status
  const o = r?.outcome
  const box = { margin: '8px 0 0', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--navy-light)', maxWidth: '100%' } as const
  const th = { textAlign: 'start' as const, padding: '4px 6px', color: 'var(--text-dim)', fontWeight: 600, fontSize: 10.5 }
  const td = { padding: '4px 6px', borderTop: '1px solid var(--border)', verticalAlign: 'top' as const }

  return (
    <section data-testid="copilot-research-card" style={box} dir={isAR ? 'rtl' : 'ltr'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: 'anywhere' }}>🔎 {a.title}</span>
        <HelpTip text={t('copilot.research.help')} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t(`copilot.research.status.${status}`)}{r?.provider && r.provider !== 'NONE' ? ` · ${r.provider}${r.model ? ` / ${r.model}` : ''}` : ''}{r?.searches ? ` · ${t('copilot.research.searches').replace('{count}', String(r.searches))}` : ''}</span>
      </div>
      {status === 'RUNNING' && <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 6 }}>{t('copilot.research.running')}</div>}
      {(status === 'FAILED' || status === 'NOT_CONFIGURED') && <div role="alert" style={{ fontSize: 11.5, color: '#f97316', marginTop: 6 }}>{r?.error || t('copilot.research.failed')}</div>}
      {loadFailed && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>{t('copilot.research.load_failed')}</div>}
      {o && (
        <div style={{ marginTop: 8, fontSize: 11.5 }}>
          <div style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--accent)', marginBottom: 8 }} data-testid="research-decision">
            <strong>{t(`copilot.research.decision.${o.decision.code}`)}</strong> — {o.decision.statement}
            <div style={{ color: 'var(--text-dim)', marginTop: 2 }}>{o.decision.basis}</div>
          </div>
          {o.recommendation?.summary && <div style={{ marginBottom: 6 }}><Evidence e="ARCHITECT_RECOMMENDATION" t={t} /> {o.recommendation.summary} <span style={{ color: 'var(--text-dim)' }}>({t('copilot.research.confidence')}: {t(`copilot.research.conf.${o.confidence}`)})</span></div>}
          {o.candidates?.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }} data-testid="research-candidates">
                <thead><tr><th style={th}>{t('copilot.research.candidate')}</th><th style={th}>{t('copilot.research.position')}</th><th style={th}>{t('copilot.research.score')}</th><th style={th}>{t('copilot.research.fit')}</th><th style={th}>{t('copilot.research.pricing')}</th><th style={th}>{t('copilot.research.sources')}</th></tr></thead>
                <tbody>
                  {o.candidates.map((c: any) => (
                    <tr key={c.name}>
                      <td style={td}><strong>{c.name}</strong>{c.vendor && c.vendor !== c.name ? <div style={{ color: 'var(--text-dim)' }}>{c.vendor}</div> : null}{!c.verified && <div><Evidence e="AI_INFERENCE" t={t} /></div>}</td>
                      <td style={td}>{t(`copilot.research.mp.${c.marketPosition}`)}</td>
                      <td style={td}>{c.weightedScore ?? '—'}<span style={{ color: 'var(--text-dim)' }}> / 5</span></td>
                      <td style={td}>{c.capabilityFit === null ? '—' : `${c.capabilityFit}%`}</td>
                      <td style={td}>{c.pricing.sourceUrl ? <a href={c.pricing.sourceUrl} target="_blank" rel="noopener noreferrer">{c.pricing.statement}</a> : t('copilot.research.vendor_confirmation')}</td>
                      <td style={td}>{c.sources.slice(0, 3).map((s: any) => <div key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">{host(s.url)}</a></div>)}{c.sources.length > 3 && <div style={{ color: 'var(--text-dim)' }}>+{c.sources.length - 3}</div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
            {r?.decisionAssessmentId
              ? <a data-testid="research-de-link" href={`/decision-evaluation?assessment=${encodeURIComponent(r.decisionAssessmentId)}`} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 8, background: 'var(--accent)', color: 'var(--navy)', fontWeight: 600, textDecoration: 'none' }}>↗ {t('copilot.research.open_de')}</a>
              : hasPermission('DecisionEvaluation.CreateAssessments') && (
                <button type="button" onClick={send} disabled={sending} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: sending ? 'default' : 'pointer', background: 'var(--accent)', color: 'var(--navy)', border: '1px solid var(--accent)', fontWeight: 600 }}>
                  {sending ? t('copilot.research.sending') : `⚖ ${t('copilot.research.send_de')}`}
                </button>
              )}
            <HelpTip text={t('copilot.research.send_de_help')} />
            {o.decision?.code !== 'REUSE_EXISTING' && hasPermission('Innovation.ManageOwnPosition') && !radarResult && !radar && (
              <button type="button" onClick={loadRadar} disabled={radarBusy} style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
                📡 {t('copilot.research.radar')}
              </button>
            )}
            {o.decision?.code !== 'REUSE_EXISTING' && hasPermission('Innovation.ManageOwnPosition') && <HelpTip text={t('copilot.research.radar_help')} />}
          </div>
          {radar && (
            <div data-testid="research-radar-matches" style={{ marginTop: 6, fontSize: 11.5 }}>
              {radar.matches.length === 0 ? <div style={{ color: 'var(--text-dim)' }}>{t('copilot.research.radar_none')}</div> : (
                <>
                  <div style={{ color: 'var(--text-dim)', marginBottom: 4 }}>{t('copilot.research.radar_choose')}</div>
                  {radar.matches.map((m: any) => (
                    <div key={m.id} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 }}>
                      <button type="button" disabled={radarBusy} onClick={() => sendToRadar(m.id)} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 8, cursor: 'pointer', background: 'var(--accent)', color: 'var(--navy)', border: '1px solid var(--accent)', fontWeight: 600 }}>{(isAR && m.nameAr) || m.name}</button>
                      <span style={{ color: 'var(--text-dim)' }}>{m.tenantStatus ? t('copilot.research.radar_current').replace('{status}', m.tenantStatus) : t('copilot.research.radar_not_positioned')}{!m.willChange && ` — ${t('copilot.research.radar_kept')}`}</span>
                    </div>
                  ))}
                </>
              )}
              <button type="button" onClick={() => setRadar(null)} style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>{t('common.cancel')}</button>
            </div>
          )}
          {radarResult && (
            <div data-testid="research-radar-done" style={{ marginTop: 6, fontSize: 11.5 }}>
              ✓ {radarResult.statusChanged ? t('copilot.research.radar_done').replace('{name}', radarResult.technology.name).replace('{status}', radarResult.status) : t('copilot.research.radar_noted').replace('{name}', radarResult.technology.name).replace('{status}', radarResult.previousStatus || '—')}
              {' '}<a href="/innovation">{t('copilot.research.radar_open')}</a>
            </div>
          )}
          {radarError && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 4 }}>{t('copilot.research.radar_failed')}</div>}
          {sendError && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 4 }}>{t('copilot.research.send_failed')}</div>}
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} style={{ fontSize: 11.5, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', marginTop: 8 }}>
            {open ? t('copilot.research.hide_details') : t('copilot.research.show_details')}
          </button>
          {open && (
            <div style={{ marginTop: 8 }} data-testid="research-details">
              {o.requiredCapability && <div><strong>{t('copilot.research.capability')}:</strong> {o.requiredCapability}{o.gap ? ` — ${o.gap}` : ''}</div>}
              {o.existing?.length > 0 && (
                <div style={{ marginTop: 6 }}><strong>{t('copilot.research.existing')}</strong>
                  <ul style={{ margin: '4px 0', paddingInlineStart: 18 }}>{o.existing.map((e: any) => <li key={e.id}><Evidence e="REPOSITORY_FACT" t={t} /> {e.name} <span style={{ color: 'var(--text-dim)' }}>({e.type})</span> — {e.coverage === null ? t('copilot.research.unknown') : `${e.coverage}%`}</li>)}</ul>
                </div>
              )}
              {o.requirements?.length > 0 && <div style={{ marginTop: 6 }}><strong>{t('copilot.research.requirements')}</strong><ul style={{ margin: '4px 0', paddingInlineStart: 18 }}>{o.requirements.map((q: any) => <li key={q.code}>{q.code}: {q.requirement}</li>)}</ul></div>}
              {o.criteria?.length > 0 && (
                <div style={{ marginTop: 6 }}><strong>{t('copilot.research.criteria')}</strong>
                  <ul style={{ margin: '4px 0', paddingInlineStart: 18 }}>{o.criteria.map((c: any) => <li key={c.code}>{c.label} — {c.weight}% <span style={{ color: 'var(--text-dim)' }}>{c.why}</span></li>)}</ul>
                </div>
              )}
              {o.alternative?.summary && <div style={{ marginTop: 6 }}><strong>{t('copilot.research.alternative')}:</strong> {o.alternative.summary}</div>}
              {o.limitations?.length > 0 && <div style={{ marginTop: 6, color: 'var(--text-dim)' }}><strong>{t('copilot.research.limitations')}:</strong> {o.limitations.join(' ')}</div>}
              <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>{o.rules}</div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
