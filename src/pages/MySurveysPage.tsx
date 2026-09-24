import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from './bcm/Assessments'

// Focused respondent experience for the generic Survey Engine: only the
// surveys assigned to the signed-in user, answered section by section with
// progress, required markers, evidence requirements and save/resume.

export default function MySurveysPage() {
  const { isAR } = useLang()
  const L = useCallback((en: string, ar: string) => (isAR ? ar : en), [isAR])
  const [list, setList] = useState<any[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => { api('GET', '/surveys/my/assignments').then(setList).catch(e => setError(e.message)) }, [])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('My Surveys', 'استبياناتي')}</div>
        <div className="page-subtitle">{L('Surveys you have been asked to answer', 'الاستبيانات المطلوب منك الإجابة عليها')}</div>
      </div>
      <div className="page-body">
        {error && <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>}
        {openId ? <Respond id={openId} L={L} isAR={isAR} onBack={() => { setOpenId(null); load() }} /> : !list ? L('Loading…', 'جارٍ التحميل…') : !list.length ? (
          <div style={{ padding: 24, border: '1px dashed var(--border)', borderRadius: 8, color: 'var(--text-dim)', textAlign: 'center' }}>{L('Nothing to answer right now.', 'لا يوجد ما تجيب عليه حالياً.')}</div>
        ) : (
          <div style={{ display: 'grid', gap: 8, maxWidth: 720 }}>
            {list.map(a => (
              <button key={a.id} onClick={() => setOpenId(a.id)} style={{ textAlign: 'start', padding: 12, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--navy-light)', cursor: 'pointer', color: 'var(--text)' }}>
                <div style={{ fontWeight: 600 }}>{(isAR && a.survey.titleAr) || a.survey.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                  {a.status === 'SUBMITTED' ? L('Submitted', 'تم الإرسال') : a.survey.status !== 'OPEN' ? L('Closed', 'مغلق') : a.status === 'IN_PROGRESS' ? L('In progress - resume', 'قيد الإجابة - متابعة') : L('Not started', 'لم يبدأ')}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Respond({ id, L, isAR, onBack }: { id: string; L: (en: string, ar: string) => string; isAR: boolean; onBack: () => void }) {
  const [data, setData] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, { value: any; notApplicable: boolean }>>({})
  const [dirty, setDirty] = useState(false)
  const [section, setSection] = useState(0)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [evidenceFor, setEvidenceFor] = useState<string | null>(null)

  const load = useCallback(async () => {
    const d = await api('GET', `/surveys/my/assignments/${id}`)
    setData(d)
    setAnswers(Object.fromEntries(d.responses.map((r: any) => [r.questionId, { value: r.value, notApplicable: r.notApplicable }])))
    setDirty(false)
  }, [id])
  useEffect(() => { load().catch(e => setMsg({ kind: 'err', text: e.message })) }, [load])

  const sections = useMemo(() => {
    if (!data) return []
    const withQs = data.sections.map((s: any) => ({ ...s, questions: data.questions.filter((q: any) => q.sectionId === s.id) }))
    const loose = data.questions.filter((q: any) => !q.sectionId)
    return loose.length ? [...withQs, { id: '-', title: L('General', 'عام'), questions: loose }] : withQs
  }, [data, L])
  if (!data) return <div>{msg?.text || L('Loading…', 'جارٍ التحميل…')}</div>
  const editable = data.survey.acceptsResponses
  const answered = data.questions.filter((q: any) => { const a = answers[q.id]; return a && (a.notApplicable || (a.value !== null && a.value !== undefined && a.value !== '')) }).length
  const pct = data.questions.length ? Math.round((answered / data.questions.length) * 100) : 0
  const set = (qid: string, value: any, notApplicable = false) => { setAnswers(a => ({ ...a, [qid]: { value, notApplicable } })); setDirty(true) }
  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      await api('PUT', `/surveys/my/assignments/${id}/responses`, { responses: Object.entries(answers).map(([questionId, a]) => ({ questionId, value: a.notApplicable ? null : a.value, notApplicable: a.notApplicable })) })
      setDirty(false); setMsg({ kind: 'ok', text: L('Saved. You can come back later.', 'تم الحفظ. يمكنك العودة لاحقاً.') })
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }
  const submit = async () => {
    if (!window.confirm(L('Submit your answers? You will not be able to change them.', 'إرسال إجاباتك؟ لن تتمكن من تعديلها.'))) return
    setBusy(true); setMsg(null)
    try { if (dirty) await save(); await api('POST', `/surveys/my/assignments/${id}/submit`); await load(); setMsg({ kind: 'ok', text: L('Thank you - your answers were submitted.', 'شكراً - تم إرسال إجاباتك.') }) }
    catch (e: any) { setMsg({ kind: 'err', text: e.message }) } finally { setBusy(false) }
  }
  const cur = sections[section]

  return (
    <div style={{ maxWidth: 820 }}>
      <button className="btn btn-secondary btn-sm" onClick={onBack}>← {L('My Surveys', 'استبياناتي')}</button>
      <h2 style={{ fontSize: 17, margin: '12px 0 4px' }}>{(isAR && data.survey.titleAr) || data.survey.title}</h2>
      <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={L('Progress', 'التقدم')} style={{ height: 6, background: 'var(--navy-mid)', borderRadius: 3, margin: '8px 0' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent)', borderRadius: 3 }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }} data-testid="survey-progress">{answered}/{data.questions.length} {L('answered', 'تمت الإجابة')} · <span style={{ color: 'var(--danger)' }}>*</span> {L('required', 'مطلوب')}{data.assignment.status === 'SUBMITTED' ? ` · ${L('Submitted', 'تم الإرسال')}` : ''}</div>
      {sections.length > 1 && (
        <div role="tablist" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {sections.map((s: any, i: number) => <button key={s.id} role="tab" aria-selected={i === section} className={`btn btn-sm ${i === section ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSection(i)}>{(isAR && s.titleAr) || s.title}</button>)}
        </div>
      )}
      {cur && cur.questions.map((q: any) => (
        <fieldset key={q.id} disabled={!editable} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, padding: '0 4px' }}>{(isAR && q.textAr) || q.text}{q.required && <span style={{ color: 'var(--danger)' }} aria-label={L('required', 'مطلوب')}> *</span>}</legend>
          {q.evidenceRequirement !== 'NONE' && <div style={{ fontSize: 11, color: q.evidenceRequirement === 'REQUIRED' ? 'var(--warning)' : 'var(--text-dim)', marginBottom: 6 }}>{q.evidenceRequirement === 'REQUIRED' ? L('Evidence required to confirm a "yes" at this level', 'يلزم دليل لتأكيد الإجابة بنعم عند هذا المستوى') : L('Evidence welcome', 'يُرحب بالأدلة')}</div>}
          <Answer q={q} a={answers[q.id]} onChange={(v, na) => set(q.id, v, na)} L={L} isAR={isAR} />
          {q.evidenceRequirement !== 'NONE' && editable && (
            <div style={{ marginTop: 6 }}>
              {(data.evidence || []).filter((e: any) => e.questionId === q.id).map((e: any) => <div key={e.id} style={{ fontSize: 11, color: 'var(--text-dim)' }}>📎 {e.title || e.url || e.statement} · {e.verification === 'VERIFIED' ? L('verified', 'متحقق منه') : e.verification === 'REJECTED' ? L('rejected', 'مرفوض') : L('awaiting verification', 'بانتظار التحقق')}</div>)}
              {evidenceFor === q.id ? <EvidenceForm L={L} onCancel={() => setEvidenceFor(null)} onSubmit={async (ev) => { try { await api('POST', `/surveys/my/assignments/${id}/evidence`, { questionId: q.id, ...ev }); setEvidenceFor(null); await load() } catch (e: any) { setMsg({ kind: 'err', text: e.message }) } }} />
                : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEvidenceFor(q.id)}>+ {L('Add evidence', 'إضافة دليل')}</button>}
            </div>
          )}
        </fieldset>
      ))}
      {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 13, color: msg.kind === 'err' ? 'var(--danger)' : 'var(--success)', margin: '8px 0' }}>{msg.text}</div>}
      {editable && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {section > 0 && <button className="btn btn-secondary btn-sm" onClick={() => setSection(s => s - 1)}>{L('Previous', 'السابق')}</button>}
          <button className="btn btn-secondary btn-sm" disabled={busy || !dirty} onClick={save}>{L('Save progress', 'حفظ التقدم')}</button>
          {section < sections.length - 1 ? <button className="btn btn-primary btn-sm" onClick={async () => { if (dirty) await save(); setSection(s => s + 1) }}>{L('Next', 'التالي')}</button>
            : <button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>{L('Submit', 'إرسال')}</button>}
        </div>
      )}
    </div>
  )
}

function Answer({ q, a, onChange, L, isAR }: { q: any; a?: { value: any; notApplicable: boolean }; onChange: (v: any, na?: boolean) => void; L: (en: string, ar: string) => string; isAR: boolean }) {
  const v = a?.notApplicable ? null : a?.value
  const na = (
    <label style={{ fontSize: 12, display: 'inline-flex', gap: 4, alignItems: 'center', marginInlineStart: 12 }}>
      <input type="checkbox" checked={!!a?.notApplicable} onChange={e => onChange(null, e.target.checked)} />{L('Not applicable', 'لا ينطبق')}
    </label>
  )
  switch (q.type) {
    case 'YES_NO':
      return <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>{[[true, L('Yes', 'نعم')], [false, L('No', 'لا')]].map(([val, label]) => <label key={String(val)} style={{ display: 'flex', gap: 4 }}><input type="radio" name={q.id} checked={v === val} onChange={() => onChange(val)} />{label as string}</label>)}{na}</div>
    case 'LIKERT':
    case 'MATURITY_LEVEL': {
      const opts = q.options?.length ? q.options.map((o: any) => ({ v: o.value, label: (isAR && o.labelAr) || o.label })) : Array.from({ length: (q.config?.max ?? 5) - (q.config?.min ?? 1) + 1 }, (_, i) => ({ v: (q.config?.min ?? 1) + i, label: String((q.config?.min ?? 1) + i) }))
      return <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>{opts.map((o: any) => <label key={o.v} style={{ fontSize: 12, display: 'flex', gap: 4, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: v === o.v ? 'rgba(3,105,161,0.08)' : undefined }}><input type="radio" name={q.id} checked={v === o.v} onChange={() => onChange(o.v)} />{o.label}</label>)}{na}</div>
    }
    case 'SINGLE_CHOICE':
      return <div>{q.options.map((o: any) => <label key={o.key} style={{ display: 'block', fontSize: 13 }}><input type="radio" name={q.id} checked={v === o.key} onChange={() => onChange(o.key)} /> {(isAR && o.labelAr) || o.label}</label>)}{na}</div>
    case 'MULTIPLE_CHOICE':
      return <div>{q.options.map((o: any) => <label key={o.key} style={{ display: 'block', fontSize: 13 }}><input type="checkbox" checked={Array.isArray(v) && v.includes(o.key)} onChange={e => onChange(e.target.checked ? [...(v || []), o.key] : (v || []).filter((x: string) => x !== o.key))} /> {(isAR && o.labelAr) || o.label}</label>)}{na}</div>
    case 'NUMERIC':
      return <div><input aria-label={q.text} className="form-input" type="number" style={{ width: 160 }} value={v ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} />{na}</div>
    default:
      return <textarea aria-label={q.text} className="form-input" rows={2} value={v ?? ''} onChange={e => onChange(e.target.value)} placeholder={q.type === 'URL_REFERENCE' ? 'https://' : ''} />
  }
}

function EvidenceForm({ L, onSubmit, onCancel }: { L: (en: string, ar: string) => string; onSubmit: (e: any) => void; onCancel: () => void }) {
  const [kind, setKind] = useState('URL')
  const [val, setVal] = useState('')
  const [title, setTitle] = useState('')
  const body = kind === 'URL' ? { kind, url: val, title } : kind === 'STATEMENT' ? { kind, statement: val, title } : { kind, refId: val, title }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
      <select aria-label={L('Evidence type', 'نوع الدليل')} className="form-input" style={{ width: 180 }} value={kind} onChange={e => setKind(e.target.value)}>
        <option value="URL">{L('Link (policy, dashboard, report)', 'رابط (سياسة، لوحة، تقرير)')}</option>
        <option value="DOCUMENT">{L('Knowledge document ID', 'معرّف مستند المعرفة')}</option>
        <option value="REPOSITORY_OBJECT">{L('Architecture object ID', 'معرّف عنصر البنية')}</option>
        <option value="STATEMENT">{L('Written statement', 'إفادة مكتوبة')}</option>
      </select>
      <input aria-label={L('Title', 'العنوان')} className="form-input" style={{ width: 160 }} placeholder={L('Title', 'العنوان')} value={title} onChange={e => setTitle(e.target.value)} />
      <input aria-label={L('Evidence', 'الدليل')} className="form-input" style={{ flex: 1, minWidth: 180 }} value={val} onChange={e => setVal(e.target.value)} />
      <button type="button" className="btn btn-primary btn-sm" disabled={!val.trim()} onClick={() => onSubmit(body)}>{L('Attach', 'إرفاق')}</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>{L('Cancel', 'إلغاء')}</button>
    </div>
  )
}
