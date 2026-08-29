import { useState, useEffect, useCallback, useMemo } from 'react'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (p: string) => fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const patch = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const postFile = (p: string, file: File, extraFields?: Record<string, string>) => {
      const form = new FormData()
      form.append('file', file)
      if (extraFields) Object.entries(extraFields).forEach(([k, v]) => form.append(k, v))
      return fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form })
        .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    }
    return { get, post, patch, postFile }
  }, [])
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--border)' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text)' },
  subtitle: { fontSize: 13, color: 'var(--text-dim)', marginTop: 2 },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 },
  btn: (v: 'primary' | 'secondary' | 'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 },
  th: { textAlign: 'left' as const, padding: '8px 10px', color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, borderBottom: '1px solid var(--border)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--text)' },
  modalBackdrop: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, width: 480, maxHeight: '85vh', overflow: 'auto' },
}

const PROFILES: Record<string, { en: string; ar: string; icon: string }> = {
  RFP_TECHNICAL_PROPOSALS: { icon: '📄', en: 'RFP Technical Proposals', ar: 'العروض الفنية لطلب العروض' },
  DATABASE_TECHNOLOGY: { icon: '🗄', en: 'Database Technology', ar: 'تقنية قواعد البيانات' },
  FRONTEND_TECHNOLOGY: { icon: '🖥', en: 'Frontend Technology', ar: 'تقنية الواجهة الأمامية' },
  BACKEND_TECHNOLOGY: { icon: '⚙', en: 'Backend Technology', ar: 'تقنية الخلفية' },
  DATA_VIRTUALIZATION_PRODUCT: { icon: '🔗', en: 'Data Virtualization Product', ar: 'منتج مجازية البيانات' },
  ENTERPRISE_TOOL: { icon: '🧰', en: 'Enterprise Tool', ar: 'أداة مؤسسية' },
  GENERIC_TECHNOLOGY: { icon: '🔧', en: 'Generic Technology', ar: 'تقنية عامة' },
  ARCHITECTURE_OPTION: { icon: '🏗', en: 'Architecture Option', ar: 'خيار معماري' },
  BUILD_VS_BUY: { icon: '⚖', en: 'Build vs Buy', ar: 'بناء أم شراء' },
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94a3b8', CRITERIA_REVIEW: '#f59e0b', BASELINE_FROZEN: '#3b82f6', ASSESSING: '#8b5cf6',
  EVIDENCE_REVIEW: '#8b5cf6', COMPLETED: '#06b6d4', PENDING_APPROVAL: '#f59e0b', APPROVED: '#22c55e',
  RETURNED_FOR_CLARIFICATION: '#e74c3c', CANCELLED: '#e74c3c', SUPERSEDED: '#64748b',
}

const OUTCOME_COLORS: Record<string, string> = {
  RECOMMENDED: '#22c55e', RECOMMENDED_WITH_CONDITIONS: '#f59e0b', NO_CLEAR_WINNER: '#94a3b8',
  INSUFFICIENT_EVIDENCE: '#e74c3c', NO_QUALIFIED_CANDIDATE: '#e74c3c',
}

export default function DecisionEvaluationPage() {
  const { locale } = useLang()
  const isAR = locale === 'AR'
  const api = useApi()
  const [assessments, setAssessments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/decision-evaluation').then(setAssessments).catch(() => setAssessments([])).finally(() => setLoading(false))
  }, [api])

  useEffect(() => { load() }, [load])

  if (selectedId) {
    return <AssessmentDetail id={selectedId} onBack={() => { setSelectedId(null); load() }} api={api} isAR={isAR} />
  }

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={S.title}>⚖ {isAR ? 'استوديو القرار والتقييم' : 'Decision & Evaluation Studio'}</div>
          <div style={S.subtitle}>{isAR ? 'مقارنة منظمة قائمة على الأدلة بين المرشحين' : 'Structured, evidence-based comparison across candidates'}</div>
        </div>
        <button style={S.btn('primary')} onClick={() => setShowCreate(true)}>+ {isAR ? 'تقييم جديد' : 'New Assessment'}</button>
      </div>
      <div style={S.content}>
        {loading ? <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل...' : 'Loading...'}</div> : (
          assessments.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)' }}>
              {isAR ? 'لا توجد تقييمات بعد. أنشئ أول تقييم للمقارنة بين المرشحين.' : 'No assessments yet. Create your first assessment to compare candidates.'}
            </div>
          ) : (
            <div style={S.grid}>
              {assessments.map(a => (
                <div key={a.id} style={{ ...S.card, cursor: 'pointer' }} onClick={() => setSelectedId(a.id)}>
                  <div style={S.row}>
                    <span style={{ fontSize: 20 }}>{PROFILES[a.profile]?.icon || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isAR ? PROFILES[a.profile]?.ar : PROFILES[a.profile]?.en}</div>
                    </div>
                  </div>
                  <div style={{ ...S.row, marginTop: 12, flexWrap: 'wrap' as const, gap: 8 }}>
                    <span style={S.badge(STATUS_COLORS[a.status] || '#94a3b8')}>{a.status.replace(/_/g, ' ')}</span>
                    {a.outcome && <span style={S.badge(OUTCOME_COLORS[a.outcome] || '#94a3b8')}>{a.outcome.replace(/_/g, ' ')}</span>}
                    {a.version > 1 && <span style={S.badge('#94a3b8')}>v{a.version}</span>}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {showCreate && <CreateAssessmentModal api={api} isAR={isAR} onClose={() => setShowCreate(false)} onCreated={(id: string) => { setShowCreate(false); load(); setSelectedId(id) }} />}
    </div>
  )
}

function CreateAssessmentModal({ api, isAR, onClose, onCreated }: any) {
  const [form, setForm] = useState({ title: '', purpose: '', profile: 'GENERIC_TECHNOLOGY', useCase: '', scope: '', templateId: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<any[]>([])

  useEffect(() => {
    api.get(`/decision-evaluation/templates?profile=${form.profile}`).then(setTemplates).catch(() => setTemplates([]))
  }, [api, form.profile])

  const submit = async () => {
    if (!form.title.trim() || !form.purpose.trim()) { setError(isAR ? 'العنوان والغرض مطلوبان' : 'Title and purpose are required'); return }
    setSaving(true); setError(null)
    try {
      const created = await api.post('/decision-evaluation', { ...form, templateId: form.templateId || undefined })
      onCreated(created.id)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{isAR ? 'تقييم جديد' : 'New Assessment'}</div>
        <label style={S.label}>{isAR ? 'العنوان' : 'Title'}</label>
        <input style={S.input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={isAR ? 'مثال: اختيار قاعدة البيانات لمنصة X' : 'e.g. Database selection for Platform X'} />
        <label style={S.label}>{isAR ? 'الغرض' : 'Purpose'}</label>
        <input style={S.input} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} placeholder={isAR ? 'ما القرار المطلوب؟' : 'What decision is this for?'} />
        <label style={S.label}>{isAR ? 'نوع التقييم' : 'Assessment Type'}</label>
        <select style={S.input} value={form.profile} onChange={e => setForm({ ...form, profile: e.target.value, templateId: '' })}>
          {Object.entries(PROFILES).map(([k, v]) => <option key={k} value={k}>{v.icon} {isAR ? v.ar : v.en}</option>)}
        </select>
        <label style={S.label}>{isAR ? 'القالب (اختياري)' : 'Template (optional)'}</label>
        <select style={S.input} value={form.templateId} onChange={e => setForm({ ...form, templateId: e.target.value })}>
          <option value="">{isAR ? 'استخدام المعايير الافتراضية' : 'Use default criteria'}</option>
          {templates.map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.isArchMindDefault ? '' : ` (${isAR ? 'خاص بالمستأجر' : 'tenant'})`}</option>)}
        </select>
        <label style={S.label}>{isAR ? 'حالة الاستخدام / السياق' : 'Use case / context'}</label>
        <textarea style={{ ...S.input, minHeight: 70 }} value={form.useCase} onChange={e => setForm({ ...form, useCase: e.target.value })} placeholder={isAR ? 'اختياري لكن موصى به بشدة — السياق المحدد للمستأجر يحسّن دقة التقييم' : 'Optional but strongly recommended — tenant-specific context sharpens the assessment'} />
        {error && <div style={{ color: '#e74c3c', fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <div style={{ ...S.row, justifyContent: 'flex-end', marginTop: 8 }}>
          <button style={S.btn()} onClick={onClose}>{isAR ? 'إلغاء' : 'Cancel'}</button>
          <button style={S.btn('primary')} onClick={submit} disabled={saving}>{saving ? '...' : (isAR ? 'إنشاء' : 'Create')}</button>
        </div>
      </div>
    </div>
  )
}

function NewVersionModal({ isAR, onClose, onConfirm }: any) {
  const [reason, setReason] = useState('')
  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{isAR ? 'إصدار جديد' : 'New Version'}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>{isAR ? 'سيتم إنشاء نسخة جديدة قابلة للتعديل من المعايير، وتعليم هذا التقييم كمُستبدَل. جميع النتائج الحالية تبقى محفوظة للتدقيق.' : 'Creates a new, editable version of the criteria and marks this assessment as superseded. All current results are preserved for audit.'}</div>
        <label style={S.label}>{isAR ? 'سبب التغيير' : 'Reason for the change'}</label>
        <textarea style={{ ...S.input, minHeight: 70 }} value={reason} onChange={e => setReason(e.target.value)} />
        <div style={{ ...S.row, justifyContent: 'flex-end', marginTop: 8 }}>
          <button style={S.btn()} onClick={onClose}>{isAR ? 'إلغاء' : 'Cancel'}</button>
          <button style={S.btn('primary')} disabled={!reason.trim()} onClick={() => onConfirm(reason)}>{isAR ? 'إنشاء' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}

function AssessmentDetail({ id, onBack, api, isAR }: any) {
  const [tab, setTab] = useState<'overview' | 'criteria' | 'candidates' | 'compare' | 'decision'>('overview')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [showNewVersion, setShowNewVersion] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/decision-evaluation/${id}`).then(setData).catch((e: any) => setError(e.message)).finally(() => setLoading(false))
  }, [api, id])

  useEffect(() => { load() }, [load])

  const onExportWord = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem('ea_token')
      const res = await fetch(`${API}/decision-evaluation/${id}/export/word?lang=${isAR ? 'ar' : 'en'}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `decision-assessment-${id}.docx`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(e.message || (isAR ? 'فشل التصدير' : 'Export failed'))
    } finally {
      setExporting(false)
    }
  }

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setError(null)
    try { await fn(); await load() } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  if (loading || !data) return <div style={S.page}><div style={S.content}>{isAR ? 'جارٍ التحميل...' : 'Loading...'}</div></div>
  const { assessment, groups, criteria, candidates, scores } = data
  const status = assessment.status

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.row}>
          <button style={S.btn()} onClick={onBack}>← {isAR ? 'رجوع' : 'Back'}</button>
          <div>
            <div style={S.title}>{assessment.title}</div>
            <div style={S.subtitle}>{isAR ? PROFILES[assessment.profile]?.ar : PROFILES[assessment.profile]?.en} · <span style={{ color: STATUS_COLORS[status] }}>{status.replace(/_/g, ' ')}</span></div>
          </div>
        </div>
        <div style={S.row}>
          <button style={S.btn()} disabled={exporting} onClick={() => onExportWord()}>📄 {exporting ? '...' : (isAR ? 'تصدير Word' : 'Export Word')}</button>
          {(status === 'DRAFT' || status === 'CRITERIA_REVIEW') && (
            <button style={S.btn('primary')} disabled={busy} onClick={() => run(() => api.post(`/decision-evaluation/${id}/freeze`))}>{isAR ? 'تجميد الأساس' : 'Freeze Baseline'}</button>
          )}
          {status === 'BASELINE_FROZEN' && (
            <button style={S.btn('primary')} disabled={busy} onClick={() => run(() => api.post(`/decision-evaluation/${id}/run-assessment`))}>{isAR ? 'تشغيل تقييم الذكاء الاصطناعي' : 'Run AI Assessment'}</button>
          )}
          {(status === 'EVIDENCE_REVIEW' || status === 'ASSESSING' || status === 'COMPLETED') && (
            <button style={S.btn('primary')} disabled={busy} onClick={() => run(() => api.post(`/decision-evaluation/${id}/compare`))}>{isAR ? 'احتساب المقارنة' : 'Compute Comparison'}</button>
          )}
          {status !== 'DRAFT' && status !== 'CRITERIA_REVIEW' && status !== 'SUPERSEDED' && status !== 'CANCELLED' && (
            <button style={S.btn()} disabled={busy} onClick={() => setShowNewVersion(true)}>{isAR ? 'إصدار جديد' : 'New Version'}</button>
          )}
        </div>
      </div>
      {showNewVersion && (
        <NewVersionModal
          isAR={isAR}
          onClose={() => setShowNewVersion(false)}
          onConfirm={(reason: string) => {
            setShowNewVersion(false)
            setBusy(true)
            api.post(`/decision-evaluation/${id}/version`, { reason })
              .then(() => { alert(isAR ? 'تم إنشاء إصدار جديد. يمكنك فتحه من القائمة.' : 'New version created — open it from the list.'); onBack() })
              .catch((e: any) => setError(e.message))
              .finally(() => setBusy(false))
          }}
        />
      )}
      {error && <div style={{ padding: '8px 28px', color: '#e74c3c', fontSize: 13 }}>{error}</div>}
      <div style={S.tabs}>
        {(['overview', 'criteria', 'candidates', 'compare', 'decision'] as const).map(t => (
          <button key={t} style={S.tab(tab === t)} onClick={() => setTab(t)}>
            {t === 'overview' && (isAR ? 'نظرة عامة' : 'Overview')}
            {t === 'criteria' && (isAR ? 'المعايير' : `Criteria (${criteria?.length ?? 0})`)}
            {t === 'candidates' && (isAR ? 'المرشحون' : `Candidates (${candidates?.length ?? 0})`)}
            {t === 'compare' && (isAR ? 'المقارنة' : 'Compare')}
            {t === 'decision' && (isAR ? 'القرار' : 'Decision')}
          </button>
        ))}
      </div>
      <div style={S.content}>
        {tab === 'overview' && <OverviewTab assessment={assessment} isAR={isAR} />}
        {tab === 'criteria' && <CriteriaTab id={id} groups={groups} criteria={criteria} status={status} api={api} isAR={isAR} onChanged={load} />}
        {tab === 'candidates' && <CandidatesTab id={id} candidates={candidates} status={status} api={api} isAR={isAR} onChanged={load} />}
        {tab === 'compare' && <CompareTab id={id} candidates={candidates} scores={scores} assessment={assessment} api={api} isAR={isAR} />}
        {tab === 'decision' && <DecisionTab id={id} assessment={assessment} api={api} isAR={isAR} onChanged={load} />}
      </div>
    </div>
  )
}

function OverviewTab({ assessment, isAR }: any) {
  return (
    <div style={S.card}>
      <div style={S.label}>{isAR ? 'الغرض' : 'Purpose'}</div>
      <div style={{ marginBottom: 14 }}>{assessment.purpose}</div>
      {assessment.useCase && (<><div style={S.label}>{isAR ? 'حالة الاستخدام' : 'Use case'}</div><div style={{ marginBottom: 14, whiteSpace: 'pre-wrap' as const }}>{assessment.useCase}</div></>)}
      <div style={S.row}>
        <div><div style={S.label}>{isAR ? 'الإصدار' : 'Version'}</div><div>{assessment.version}</div></div>
        <div><div style={S.label}>{isAR ? 'الحالة' : 'Status'}</div><span style={S.badge(STATUS_COLORS[assessment.status])}>{assessment.status.replace(/_/g, ' ')}</span></div>
        {assessment.outcome && <div><div style={S.label}>{isAR ? 'النتيجة' : 'Outcome'}</div><span style={S.badge(OUTCOME_COLORS[assessment.outcome])}>{assessment.outcome.replace(/_/g, ' ')}</span></div>}
      </div>
      {assessment.executiveRationale && (<><div style={{ ...S.label, marginTop: 14 }}>{isAR ? 'التبرير التنفيذي' : 'Executive rationale'}</div><div>{assessment.executiveRationale}</div></>)}
    </div>
  )
}

function CriteriaTab({ id, groups, criteria, status, api, isAR, onChanged }: any) {
  const editable = status === 'DRAFT' || status === 'CRITERIA_REVIEW'
  const [savingId, setSavingId] = useState<string | null>(null)

  const saveWeight = async (criterionId: string, weight: number) => {
    setSavingId(criterionId)
    try { await api.patch(`/decision-evaluation/${id}/criteria/${criterionId}`, { weight }); await onChanged() }
    catch (e: any) { alert(e.message) } finally { setSavingId(null) }
  }

  const totalWeight = (criteria || []).reduce((s: number, c: any) => s + c.weight, 0)

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 12 }}>
        <span style={S.badge(Math.abs(totalWeight - 100) < 0.01 ? '#22c55e' : '#e74c3c')}>{isAR ? 'إجمالي الأوزان' : 'Total weight'}: {totalWeight.toFixed(1)}%</span>
        {!editable && <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isAR ? 'المعايير مجمدة — أنشئ إصدارًا جديدًا للتعديل' : 'Criteria are frozen — create a new version to edit'}</span>}
      </div>
      {(groups || []).sort((a: any, b: any) => a.displayOrder - b.displayOrder).map((g: any) => (
        <div key={g.id} style={S.card}>
          <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontWeight: 700 }}>{g.name}</div>
            <span style={S.badge('#94a3b8')}>{g.weight}%</span>
          </div>
          <table style={S.table}>
            <thead><tr><th style={S.th}>{isAR ? 'المعيار' : 'Criterion'}</th><th style={S.th}>{isAR ? 'الوزن' : 'Weight'}</th><th style={S.th}>{isAR ? 'إلزامي' : 'Gate'}</th></tr></thead>
            <tbody>
              {(criteria || []).filter((c: any) => c.groupId === g.id).sort((a: any, b: any) => a.displayOrder - b.displayOrder).map((c: any) => (
                <tr key={c.id}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{c.description}</div>
                  </td>
                  <td style={S.td}>
                    {editable ? (
                      <input type="number" step="0.5" defaultValue={c.weight} style={{ ...S.input, width: 70, marginBottom: 0 }}
                        disabled={savingId === c.id}
                        onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v !== c.weight) saveWeight(c.id, v) }} />
                    ) : `${c.weight}%`}
                  </td>
                  <td style={S.td}>{c.gateType === 'BLOCKING' ? <span style={S.badge('#e74c3c')}>{isAR ? 'إلزامي' : 'BLOCKING'}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function CandidatesTab({ id, candidates, status, api, isAR, onChanged }: any) {
  const canAdd = status === 'DRAFT' || status === 'CRITERIA_REVIEW' || status === 'BASELINE_FROZEN'
  const canUploadDocs = status !== 'APPROVED' && status !== 'CANCELLED' && status !== 'SUPERSEDED'
  const [name, setName] = useState('')
  const [vendor, setVendor] = useState('')
  const [adding, setAdding] = useState(false)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [uploadingBaseline, setUploadingBaseline] = useState(false)

  const addCandidate = async () => {
    if (!name.trim()) return
    setAdding(true)
    try { await api.post(`/decision-evaluation/${id}/candidates`, { name, vendorOrSource: vendor || undefined }); setName(''); setVendor(''); await onChanged() }
    catch (e: any) { alert(e.message) } finally { setAdding(false) }
  }

  const uploadCandidateDoc = async (candidateId: string, file: File) => {
    setUploadingFor(candidateId)
    try {
      const result = await api.postFile(`/decision-evaluation/${id}/candidates/${candidateId}/documents`, file, { label: file.name })
      if (!result.isProcessed) alert((isAR ? 'تعذّر استخراج المحتوى: ' : 'Could not extract content: ') + (result.processingError || ''))
      await onChanged()
    } catch (e: any) { alert(e.message) } finally { setUploadingFor(null) }
  }

  const uploadBaselineDoc = async (file: File) => {
    setUploadingBaseline(true)
    try {
      const result = await api.postFile(`/decision-evaluation/${id}/baseline-documents`, file, { label: file.name })
      if (!result.isProcessed) alert((isAR ? 'تعذّر استخراج المحتوى: ' : 'Could not extract content: ') + (result.processingError || ''))
      await onChanged()
    } catch (e: any) { alert(e.message) } finally { setUploadingBaseline(false) }
  }

  return (
    <div>
      {canAdd && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{isAR ? 'إضافة مرشح' : 'Add candidate'}</div>
          <div style={S.row}>
            <input style={{ ...S.input, marginBottom: 0 }} placeholder={isAR ? 'الاسم' : 'Name'} value={name} onChange={e => setName(e.target.value)} />
            <input style={{ ...S.input, marginBottom: 0 }} placeholder={isAR ? 'المورّد (اختياري)' : 'Vendor (optional)'} value={vendor} onChange={e => setVendor(e.target.value)} />
            <button style={S.btn('primary')} disabled={adding || !name.trim()} onClick={addCandidate}>{isAR ? 'إضافة' : 'Add'}</button>
          </div>
        </div>
      )}
      {canUploadDocs && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{isAR ? 'وثيقة الأساس (RFP/SOW)' : 'Baseline document (RFP/SOW)'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>{isAR ? 'تُستخرج وتُقطّع تلقائيًا كسياق مشترك لكل المرشحين' : 'Automatically extracted and chunked as shared context for every candidate'}</div>
          <input type="file" disabled={uploadingBaseline} onChange={e => e.target.files?.[0] && uploadBaselineDoc(e.target.files[0])} />
        </div>
      )}
      <div style={S.grid}>
        {(candidates || []).map((c: any) => (
          <div key={c.id} style={S.card}>
            <div style={{ fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{c.neutralLabel}{c.vendorOrSource ? ` · ${c.vendorOrSource}` : ''}</div>
            {c.isDisqualified && <span style={{ ...S.badge('#e74c3c'), marginTop: 8, display: 'inline-block' }}>{isAR ? 'مستبعد' : 'Disqualified'}</span>}
            {canUploadDocs && (
              <div style={{ marginTop: 10 }}>
                <label style={S.label}>{isAR ? 'رفع مستند (عرض فني، ورقة بيانات...)' : 'Upload document (proposal, datasheet...)'}</label>
                <input type="file" disabled={uploadingFor === c.id} onChange={e => e.target.files?.[0] && uploadCandidateDoc(c.id, e.target.files[0])} />
              </div>
            )}
          </div>
        ))}
      </div>
      {(!candidates || candidates.length < 2) && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 8 }}>{isAR ? 'يلزم مرشّحان على الأقل للمقارنة' : 'At least 2 candidates are required to freeze the baseline'}</div>}
    </div>
  )
}

function CompareTab({ id, candidates, scores, assessment, api, isAR }: any) {
  const [sensitivity, setSensitivity] = useState<any>(null)
  const [runningSensitivity, setRunningSensitivity] = useState(false)

  const runSensitivity = async () => {
    setRunningSensitivity(true)
    try { setSensitivity(await api.post(`/decision-evaluation/${id}/sensitivity`, { variationPercent: 10 })) }
    catch (e: any) { alert(e.message) } finally { setRunningSensitivity(false) }
  }

  if (!scores || scores.length === 0) {
    return <div style={{ ...S.card, color: 'var(--text-dim)' }}>{isAR ? 'لم يتم احتساب المقارنة بعد. شغّل التقييم ثم اضغط "احتساب المقارنة".' : 'Comparison not computed yet. Run the assessment, then click "Compute Comparison".'}</div>
  }
  const candidateById = new Map<string, any>((candidates || []).map((c: any) => [c.id, c]))
  const sorted = [...scores].sort((a: any, b: any) => (a.rank ?? 999) - (b.rank ?? 999))

  return (
    <div>
      {assessment.outcome && (
        <div style={S.card}>
          <div style={S.row}>
            <span style={S.badge(OUTCOME_COLORS[assessment.outcome] || '#94a3b8')}>{assessment.outcome.replace(/_/g, ' ')}</span>
            {assessment.recommendedCandidateId && <span style={{ fontWeight: 700 }}>{candidateById.get(assessment.recommendedCandidateId)?.name}</span>}
          </div>
          {assessment.executiveRationale && <div style={{ marginTop: 10, fontSize: 13 }}>{assessment.executiveRationale}</div>}
        </div>
      )}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>{isAR ? 'الترتيب' : 'Rank'}</th>
              <th style={S.th}>{isAR ? 'المرشح' : 'Candidate'}</th>
              <th style={S.th}>{isAR ? 'النتيجة الإجمالية' : 'Overall Score'}</th>
              <th style={S.th}>{isAR ? 'البوابات الإلزامية' : 'Mandatory Gates'}</th>
              <th style={S.th}>{isAR ? 'تغطية الأدلة' : 'Evidence Coverage'}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s: any) => (
              <tr key={s.candidateId}>
                <td style={S.td}>{s.rank ?? '—'}</td>
                <td style={S.td}>{candidateById.get(s.candidateId)?.name || s.candidateId}</td>
                <td style={S.td}><strong>{s.overallScore?.toFixed(1)}</strong></td>
                <td style={S.td}>{s.mandatoryGatesPassed ? <span style={S.badge('#22c55e')}>{isAR ? 'اجتاز' : 'Passed'}</span> : <span style={S.badge('#e74c3c')}>{isAR ? 'فشل' : 'Failed'}</span>}</td>
                <td style={S.td}>{s.evidenceCoveragePercent?.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={S.card}>
        <div style={{ ...S.row, justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>{isAR ? 'تحليل الحساسية' : 'Sensitivity Analysis'}</div>
          <button style={S.btn()} disabled={runningSensitivity} onClick={runSensitivity}>{runningSensitivity ? '...' : (isAR ? 'تشغيل (±10%)' : 'Run (±10%)')}</button>
        </div>
        {sensitivity && (
          <div style={{ marginTop: 10, fontSize: 13 }}>
            <span style={S.badge(sensitivity.rankingEverChanges ? '#f59e0b' : '#22c55e')}>
              {sensitivity.rankingEverChanges ? (isAR ? 'الترتيب حسّاس لتغييرات الوزن' : 'Ranking is sensitive to weight changes') : (isAR ? 'الترتيب مستقر' : 'Ranking is stable')}
            </span>
            {sensitivity.mostInfluentialCriterionIds?.length > 0 && (
              <div style={{ marginTop: 8, color: 'var(--text-dim)' }}>{isAR ? 'أكثر المعايير تأثيرًا:' : 'Most influential criteria:'} {sensitivity.mostInfluentialCriterionIds.length}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function DecisionTab({ id, assessment, api, isAR, onChanged }: any) {
  const { user } = useAuth()
  const [rationale, setRationale] = useState('')
  const [busy, setBusy] = useState(false)
  const [targetModule, setTargetModule] = useState('EA_REPOSITORY')

  // UI convenience only — the server independently enforces the real
  // permission (DecisionEvaluation.ApproveAssessments / .PublishDecisions)
  // plus separation-of-duties, regardless of what this hides or shows.
  const canSeeApprovalActions = user?.role === 'REVIEWER' || user?.role === 'TENANT_ADMIN'
  const canDecide = canSeeApprovalActions && (assessment.status === 'COMPLETED' || assessment.status === 'PENDING_APPROVAL')
  const canPublish = canSeeApprovalActions && assessment.status === 'APPROVED'

  const decide = async (action: string) => {
    if (!rationale.trim()) { alert(isAR ? 'التبرير مطلوب' : 'Rationale is required'); return }
    setBusy(true)
    try { await api.post(`/decision-evaluation/${id}/decide`, { action, rationale }); setRationale(''); await onChanged() }
    catch (e: any) { alert(e.message) } finally { setBusy(false) }
  }

  const publish = async () => {
    setBusy(true)
    try {
      const pub = await api.post(`/decision-evaluation/${id}/publish`, { targetModule, targetObjectType: 'ARCHITECTURE_DECISION' })
      await api.post(`/decision-evaluation/publications/${pub.id}/consume`)
      await onChanged()
    }
    catch (e: any) { alert(e.message) } finally { setBusy(false) }
  }

  if (!canDecide && !canPublish) {
    return <div style={{ ...S.card, color: 'var(--text-dim)' }}>{isAR ? 'التقييم غير جاهز للقرار بعد. أكمل المقارنة أولاً.' : 'Assessment is not ready for a decision yet. Complete the comparison first.'}</div>
  }

  return (
    <div>
      {canDecide && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{isAR ? 'اتخاذ القرار' : 'Make a decision'}</div>
          <label style={S.label}>{isAR ? 'التبرير' : 'Rationale'}</label>
          <textarea style={{ ...S.input, minHeight: 80 }} value={rationale} onChange={e => setRationale(e.target.value)} />
          <div style={S.row}>
            <button style={S.btn('primary')} disabled={busy} onClick={() => decide('APPROVE')}>{isAR ? 'اعتماد' : 'Approve'}</button>
            <button style={S.btn('danger')} disabled={busy} onClick={() => decide('REJECT')}>{isAR ? 'رفض' : 'Reject'}</button>
            <button style={S.btn()} disabled={busy} onClick={() => decide('RETURN_FOR_CLARIFICATION')}>{isAR ? 'إعادة للتوضيح' : 'Return for Clarification'}</button>
            <button style={S.btn()} disabled={busy} onClick={() => decide('RERUN')}>{isAR ? 'إعادة التشغيل' : 'Rerun'}</button>
          </div>
        </div>
      )}
      {canPublish && (
        <div style={S.card}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>{isAR ? 'نشر القرار' : 'Publish decision'}</div>
          <select style={S.input} value={targetModule} onChange={e => setTargetModule(e.target.value)}>
            <option value="EA_REPOSITORY">{isAR ? 'مستودع هندسة المؤسسات' : 'EA Repository'}</option>
            <option value="GOVERNANCE">{isAR ? 'الحوكمة' : 'Governance'}</option>
            <option value="INNOVATION">{isAR ? 'الابتكار' : 'Innovation'}</option>
            <option value="ROADMAP">{isAR ? 'خارطة الطريق' : 'Roadmap'}</option>
          </select>
          <button style={S.btn('primary')} disabled={busy} onClick={publish}>{isAR ? 'طلب النشر' : 'Request Publication'}</button>
        </div>
      )}
    </div>
  )
}
