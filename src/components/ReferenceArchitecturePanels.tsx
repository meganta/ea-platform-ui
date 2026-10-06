import { useEffect, useMemo, useState } from 'react'
import HelpTip from './HelpTip'
import { useLang } from '../contexts/LangContext'
import { STATUS_COLOR, localName, makeApi } from '../pages/refarch/refArch'

// Reference architecture context shown inside other modules - read from
// the Reference Architecture API, never recomputed here.

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const box: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, padding: 14, background: 'var(--navy-light)', marginTop: 12 }
const chip = (color: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999, fontSize: 11, border: '1px solid var(--border)', background: 'var(--navy-mid)', whiteSpace: 'nowrap', borderInlineStart: `3px solid ${color}` })
const link = (id: string) => `/reference-architectures?ra=${encodeURIComponent(id)}`

/** ADM: the active reference architectures that apply to a cycle's domains, with Current-state facts. */
export function AdmReferencePanel({ cycleId }: { cycleId: string }) {
  const { t, isAR } = useLang()
  const api = useMemo(() => makeApi(API_URL), [])
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.get(`/reference-architectures/adm-cycles/${cycleId}/context`).then(setData).catch(() => setData({ architectures: [] })) }, [api, cycleId])
  if (!data) return null
  return (
    <section style={box} aria-label={t('refarch.adm.title')} data-testid="adm-refarch">
      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>🧭 {t('refarch.adm.title')}<HelpTip text={t('refarch.adm.help')} /></div>
      {data.architectures.length === 0 ? <p className="text-dim" style={{ fontSize: 13, margin: '6px 0 0' }}>{t('refarch.adm.none')}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
          {data.architectures.map((a: any) => (
            <li key={a.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <a href={link(a.id)}>{localName(a, isAR)}</a> <span className="text-dim">· {t(`refarch.kind.${a.kind}`)} · {a.version?.version}</span>
              {a.currentState && <div className="text-dim" style={{ fontSize: 12 }}>{a.currentState.coverage}{a.currentState.gaps.length ? ` · ${t('refarch.conf.GAP')}: ${a.currentState.gaps.length}` : ''}{a.currentState.deviations.length ? ` · ${t('refarch.conf.DEVIATION')}: ${a.currentState.deviations.length}` : ''}</div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const GOV_COLOR: Record<string, string> = { ALIGNMENT: STATUS_COLOR.ALIGNED, GAP: STATUS_COLOR.GAP, DEVIATION: STATUS_COLOR.DEVIATION, APPROVED_EXCEPTION: STATUS_COLOR.APPROVED_EXCEPTION, NOT_ASSESSABLE: STATUS_COLOR.NOT_ASSESSED }

/** Governance: reference architecture evidence for one review; a deviation can be raised as a finding with its evidence. */
export function GovernanceReferencePanel({ reviewId }: { reviewId: string }) {
  const { t } = useLang()
  const api = useMemo(() => makeApi(API_URL), [])
  const [data, setData] = useState<any>(null)
  const [raised, setRaised] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState('')
  useEffect(() => { api.get(`/reference-architectures/governance-reviews/${reviewId}/assessment`).then(setData).catch(() => setData(null)) }, [api, reviewId])
  if (!data || (data.architectures.length === 0 && data.findings.length === 0)) return null
  const raise = (f: any) => api.post(`/reference-architectures/governance-reviews/${reviewId}/deviations`, { architectureId: f.architectureId, elementKey: f.elementKey, objectId: f.objectId || undefined, rationale: f.evidence })
    .then(() => setRaised(r => ({ ...r, [`${f.linkId || f.elementKey}`]: true }))).catch((e: any) => setErr(e.message))
  return (
    <section style={box} aria-label={t('refarch.gov.title')} data-testid="gov-refarch">
      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>🧭 {t('refarch.gov.title')}<HelpTip text={t('refarch.gov.help')} /></div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>{Object.entries(data.counts).map(([k, n]: any) => <span key={k} style={chip(GOV_COLOR[k])}>{t(`refarch.gov.${k}`)}: {n}</span>)}</div>
      {err && <div className="ra-msg ra-msg-err" role="alert">{err}</div>}
      {data.limitations?.map((l: string) => <p key={l} className="text-dim" style={{ fontSize: 12 }}>{l}</p>)}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {data.findings.map((f: any, i: number) => (
          <li key={i} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 13, display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span><span style={chip(GOV_COLOR[f.classification])}>{t(`refarch.gov.${f.classification}`)}</span> {f.evidence}</span>
            {['DEVIATION', 'GAP'].includes(f.classification) && f.elementKey && (raised[`${f.linkId || f.elementKey}`]
              ? <span className="text-dim">{t('refarch.gov.raised')}</span>
              : <button type="button" className="btn btn-secondary btn-sm" onClick={() => raise(f)}>{t('refarch.gov.raise')}</button>)}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Repository object page: where the object stands against reference architectures. */
export function AssetReferenceAlignment({ assetId }: { assetId: string }) {
  const { t, isAR } = useLang()
  const api = useMemo(() => makeApi(API_URL), [])
  const [data, setData] = useState<any>(null)
  useEffect(() => { api.get(`/reference-architectures/assets/${assetId}/alignment`).then(setData).catch(() => setData(null)) }, [api, assetId])
  if (!data) return null
  return (
    <section className="ap-section" aria-label={t('refarch.asset.title')} data-testid="asset-refarch">
      <div className="ap-section-title">🧭 {t('refarch.asset.title')}</div>
      {data.results.length === 0 ? <p className="ap-empty" style={{ margin: 0 }}>{t('refarch.asset.none')}{data.couldRealize?.length ? ` ${t('refarch.asset.could')}: ${data.couldRealize.slice(0, 6).map((c: any) => localName(c, isAR)).join(', ')}.` : ''}</p> : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {data.results.flatMap((r: any) => r.elements.map((e: any) => (
            <li key={`${r.architecture.id}-${e.stableKey}`} style={{ padding: '5px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
              <span style={chip(STATUS_COLOR[e.status] || '#94A3B8')}>{t(`refarch.conf.${e.status}`)}</span>{' '}
              <a href={link(r.architecture.id)}>{localName(r.architecture, isAR)}</a> · {localName(e, isAR)}
              <span className="text-dim"> · {e.links.map((l: any) => `${t(`refarch.link.${l.linkType}`)}${l.status === 'PROPOSED' ? ` (${t('refarch.el.proposed')})` : ''}`).join(', ')}</span>
            </li>
          )))}
        </ul>
      )}
    </section>
  )
}
