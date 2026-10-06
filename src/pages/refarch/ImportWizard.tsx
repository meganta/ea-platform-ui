import { useEffect, useRef, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { RefApi, T } from './refArch'

interface SlidePlan { slideNo: number; include: boolean; target: string; name: string; nameAr: string; kind: string; authorityLevel: string; domainCode: string; derivedFromSlideNo: string }

const KINDS = ['REFERENCE_MODEL', 'REFERENCE_ARCHITECTURE', 'REFERENCE_PATTERN']
const AUTHORITIES = ['NATIONAL', 'EXTERNAL_FRAMEWORK', 'ORGANIZATION']
const isArabic = (s: string | null | undefined) => /[؀-ۿ]/.test(s || '')

/**
 * Upload -> structure extracted per slide (with the original wording and
 * how each element was derived) -> optional AI interpretation (proposals
 * only) -> choose what each slide becomes -> draft versions to review.
 */
export default function ImportWizard({ api, t, domains, architectures, onApplied, onClose }: {
  api: RefApi; t: T
  domains: Array<{ code: string; name: string }>
  architectures: Array<{ id: string; name: string; kind: string }>
  onApplied: (result: any) => void
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [imp, setImp] = useState<any>(null)
  const [plans, setPlans] = useState<SlidePlan[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const poll = useRef<any>(null)

  const planFrom = (data: any): SlidePlan[] => (data.extraction?.slides || []).map((s: any) => {
    const c = (data.interpretation?.slides || []).find((x: any) => x.slideNo === s.slideNo)
    const existing = data.suggestions?.[s.slideNo]
    const title = s.title || `Slide ${s.slideNo}`
    return {
      slideNo: s.slideNo, include: c ? c.role !== 'OTHER' : s.nodes.length > 0,
      target: existing ? existing.id : 'new',
      name: c?.nameEn || title, nameAr: isArabic(title) ? title : '',
      kind: c && c.role !== 'OTHER' ? c.role : 'REFERENCE_ARCHITECTURE',
      authorityLevel: c?.authorityLevel || 'ORGANIZATION',
      domainCode: c?.domainCode || '',
      derivedFromSlideNo: c?.pairedWithSlide ? String(c.pairedWithSlide) : '',
    }
  })

  const accept = (data: any) => { setImp(data); setPlans(planFrom(data)) }
  useEffect(() => () => clearInterval(poll.current), [])

  const upload = () => {
    if (!file) return
    setBusy(true); setError('')
    api.upload('/reference-architectures/imports', file).then(accept).catch(e => setError(e.message)).finally(() => setBusy(false))
  }
  const interpret = () => {
    setError('')
    api.post(`/reference-architectures/imports/${imp.id}/interpret`, {}).then(data => {
      setImp(data)
      clearInterval(poll.current)
      poll.current = setInterval(() => {
        api.get(`/reference-architectures/imports/${imp.id}`).then(d => {
          setImp(d)
          if (d.interpretation?.status !== 'RUNNING') { clearInterval(poll.current); setPlans(planFrom(d)) }
        }).catch(() => clearInterval(poll.current))
      }, 4000)
    }).catch(e => setError(e.message))
  }
  const apply = () => {
    setBusy(true); setError('')
    const slides = plans.filter(p => p.include).map(p => ({
      slideNo: p.slideNo, include: true,
      ...(p.target === 'new' ? { create: { name: p.name, nameAr: p.nameAr || undefined, kind: p.kind, authorityLevel: p.authorityLevel, domainCode: p.domainCode || undefined } } : { architectureId: p.target }),
      ...(p.derivedFromSlideNo ? { derivedFromSlideNo: Number(p.derivedFromSlideNo) } : {}),
    }))
    api.post(`/reference-architectures/imports/${imp.id}/apply`, { slides }).then(onApplied).catch(e => setError(e.message)).finally(() => setBusy(false))
  }
  const set = (i: number, patch: Partial<SlidePlan>) => setPlans(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const running = imp?.interpretation?.status === 'RUNNING'

  return (
    <div className="rp-card" data-testid="ra-import">
      <div className="rp-card-title">{t('refarch.import.title')}<HelpTip text={t('refarch.import.help')} /></div>
      {error && <div className="ra-msg ra-msg-err" role="alert">{error}</div>}
      {!imp && (
        <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="ra-import-file">{t('refarch.import.file')}</label>
            <input id="ra-import-file" type="file" className="form-input" accept=".pptx,.pdf,.docx,.txt" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <button type="button" className="btn btn-primary" disabled={!file || busy} onClick={upload}>{busy ? t('refarch.loading') : t('refarch.import.upload')}</button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        </div>
      )}
      {imp && (
        <>
          <p className="text-dim" style={{ fontSize: 12, marginTop: 0 }}>{imp.fileName} · {imp.method} · SHA-256 {String(imp.sha256 || '').slice(0, 12)}…</p>
          <div className="flex gap-2" style={{ flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
            <button type="button" className="btn btn-secondary btn-sm" disabled={running} onClick={interpret}>{running ? t('refarch.import.interpreting') : t('refarch.import.interpret')}</button>
            <HelpTip text={t('refarch.import.interpret_help')} />
            {imp.interpretation?.status === 'FAILED' && <span className="ra-msg ra-msg-err" style={{ margin: 0 }}>{imp.interpretation.error}</span>}
            {running && <span className="text-dim" style={{ fontSize: 12 }}>{imp.interpretation.slidesDone || 0} / {plans.length}</span>}
          </div>
          {imp.warnings?.length > 0 && (
            <details style={{ marginBottom: 12 }}><summary className="text-dim" style={{ fontSize: 12 }}>{t('refarch.import.warnings')} ({imp.warnings.length})</summary>
              <ul style={{ fontSize: 12 }}>{imp.warnings.slice(0, 40).map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
            </details>
          )}
          <div className="ra-scroll">
            <table className="ra-table">
              <thead><tr><th>{t('refarch.import.include')}</th><th>{t('refarch.import.slides')}</th><th>{t('refarch.import.target_existing')}</th><th>{t('refarch.kind')}</th><th>{t('refarch.authority')}</th><th>{t('refarch.domain')}</th><th>{t('refarch.import.derived_slide')}</th></tr></thead>
              <tbody>
                {plans.map((p, i) => {
                  const slide = imp.extraction.slides.find((s: any) => s.slideNo === p.slideNo)
                  return (
                    <tr key={p.slideNo}>
                      <td><input type="checkbox" aria-label={`${t('refarch.import.include')} ${p.slideNo}`} checked={p.include} onChange={e => set(i, { include: e.target.checked })} /></td>
                      <td style={{ minWidth: 220 }}>
                        <button type="button" className="ra-leaf" onClick={() => setOpen(open === p.slideNo ? null : p.slideNo)} aria-expanded={open === p.slideNo}>#{p.slideNo} {slide?.title || ''} · {slide?.nodes?.length || 0}</button>
                        {open === p.slideNo && (
                          <ul style={{ fontSize: 12, margin: '6px 0 0', paddingInlineStart: 16 }} data-testid={`ra-slide-${p.slideNo}`}>
                            {slide.nodes.slice(0, 120).map((n: any) => <li key={n.id} style={{ marginInlineStart: n.depth * 12 }} dir="auto">{n.name} <span className="text-dim">{n.kindHint} · {n.method} · {n.confidence}</span></li>)}
                          </ul>
                        )}
                        {p.include && p.target === 'new' && (
                          <div style={{ marginTop: 6 }}>
                            <label className="form-label" htmlFor={`ra-imp-name-${p.slideNo}`}>{t('refarch.form.name')}</label>
                            <input id={`ra-imp-name-${p.slideNo}`} className="form-input" value={p.name} onChange={e => set(i, { name: e.target.value })} />
                            <label className="form-label" htmlFor={`ra-imp-namear-${p.slideNo}`}>{t('refarch.form.name_ar')}</label>
                            <input id={`ra-imp-namear-${p.slideNo}`} className="form-input" dir="rtl" value={p.nameAr} onChange={e => set(i, { nameAr: e.target.value })} />
                          </div>
                        )}
                      </td>
                      <td>
                        <select className="form-input" aria-label={`${t('refarch.import.target_existing')} ${p.slideNo}`} value={p.target} onChange={e => set(i, { target: e.target.value })}>
                          <option value="new">{t('refarch.import.target_new')}</option>
                          {architectures.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td><select className="form-input" aria-label={`${t('refarch.kind')} ${p.slideNo}`} value={p.kind} disabled={p.target !== 'new'} onChange={e => set(i, { kind: e.target.value })}>{KINDS.map(k => <option key={k} value={k}>{t(`refarch.kind.${k}`)}</option>)}</select></td>
                      <td><select className="form-input" aria-label={`${t('refarch.authority')} ${p.slideNo}`} value={p.authorityLevel} disabled={p.target !== 'new'} onChange={e => set(i, { authorityLevel: e.target.value })}>{AUTHORITIES.map(k => <option key={k} value={k}>{t(`refarch.authority.${k}`)}</option>)}</select></td>
                      <td><select className="form-input" aria-label={`${t('refarch.domain')} ${p.slideNo}`} value={p.domainCode} disabled={p.target !== 'new'} onChange={e => set(i, { domainCode: e.target.value })}><option value="">{t('refarch.list.cross_domain')}</option>{domains.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}</select></td>
                      <td><select className="form-input" aria-label={`${t('refarch.import.derived_slide')} ${p.slideNo}`} value={p.derivedFromSlideNo} onChange={e => set(i, { derivedFromSlideNo: e.target.value })}><option value="">{t('refarch.form.none')}</option>{plans.filter(o => o.slideNo !== p.slideNo).map(o => <option key={o.slideNo} value={o.slideNo}>#{o.slideNo}</option>)}</select></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" disabled={busy || running || !plans.some(p => p.include)} onClick={apply}>{t('refarch.import.apply')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => api.del(`/reference-architectures/imports/${imp.id}`).catch(() => undefined).then(onClose)}>{t('refarch.import.discard')}</button>
          </div>
        </>
      )}
    </div>
  )
}
