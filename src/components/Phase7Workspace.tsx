import { useEffect, useState, useCallback } from 'react'
import { useLang } from '../contexts/LangContext'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const token = () => localStorage.getItem('ea_token')
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  }).then(r => r.json())

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUIREMENT_TYPES = [
  'STRATEGIC', 'BUSINESS', 'ARCHITECTURE', 'INTEGRATION', 'DATA',
  'SECURITY', 'TECHNOLOGY', 'GOVERNANCE', 'COMPLIANCE', 'TRANSFORMATION', 'OPERATIONAL',
]

const REQUIREMENT_STATUSES = [
  'DRAFT', 'PROPOSED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
  'IMPLEMENTED', 'DEFERRED', 'RETIRED',
]

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#8baac8',
  PROPOSED: '#f39c12',
  UNDER_REVIEW: '#3498db',
  APPROVED: '#2ecc71',
  REJECTED: '#e74c3c',
  IMPLEMENTED: '#1abc9c',
  DEFERRED: '#9b59b6',
  RETIRED: '#7f8c8d',
}

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#e74c3c',
  HIGH: '#f39c12',
  MEDIUM: '#3498db',
  LOW: '#95a5a6',
}

const TYPE_COLOR: Record<string, string> = {
  STRATEGIC: '#9b59b6', BUSINESS: '#2ecc71', ARCHITECTURE: '#00b4d8',
  INTEGRATION: '#f39c12', DATA: '#3498db', SECURITY: '#e74c3c',
  TECHNOLOGY: '#1abc9c', GOVERNANCE: '#e67e22', COMPLIANCE: '#8e44ad',
  TRANSFORMATION: '#c0392b', OPERATIONAL: '#27ae60',
}

// ─── Add/Edit Requirement Modal ───────────────────────────────────────────────

function RequirementModal({ admCycleId, initial, onSave, onClose }: {
  admCycleId: string
  initial?: any
  onSave: (req: any) => void
  onClose: () => void
}) {
  const { t, isAR } = useLang()
  const [form, setForm] = useState({
    title: initial?.title || '',
    titleAr: initial?.titleAr || '',
    description: initial?.description || '',
    requirementType: initial?.requirementType || 'ARCHITECTURE',
    category: initial?.category || '',
    priority: initial?.priority || 'MEDIUM',
    status: initial?.status || 'DRAFT',
    sourcePhase: initial?.sourcePhase || '',
    sourceStep: initial?.sourceStep || '',
    sourceOutputKey: initial?.sourceOutputKey || '',
    affectedDomains: (initial?.affectedDomains || []).join(', '),
    complianceReference: initial?.complianceReference || '',
    rationale: initial?.rationale || '',
    assumptions: initial?.assumptions || '',
    governanceNotes: initial?.governanceNotes || '',
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        admCycleId,
        affectedDomains: form.affectedDomains.split(',').map((s: string) => s.trim()).filter(Boolean),
        manuallyAdded: true,
      }
      let result: any
      if (initial?.id) {
        result = await authFetch(`/requirements/${initial.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      } else {
        result = await authFetch('/requirements', { method: 'POST', body: JSON.stringify(payload) })
      }
      onSave(result)
    } finally { setSaving(false) }
  }

  const inputStyle = { width: '100%', padding: '7px 10px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' as const }
  const labelStyle = { fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, width: '90vw', maxWidth: 680, maxHeight: '88vh', overflow: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>
          {initial ? (isAR ? 'تعديل المتطلب' : 'Edit Requirement') : (isAR ? 'إضافة متطلب جديد' : 'Add Requirement')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'العنوان (إنجليزي) *' : 'Title (English) *'}</label>
            <input style={inputStyle} value={form.title} onChange={set('title')} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'العنوان (عربي)' : 'Title (Arabic)'}</label>
            <input style={{ ...inputStyle, direction: 'rtl' }} value={form.titleAr} onChange={set('titleAr')} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'الوصف *' : 'Description *'}</label>
            <textarea style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} value={form.description} onChange={set('description')} />
          </div>
          <div>
            <label style={labelStyle}>{isAR ? 'نوع المتطلب' : 'Requirement Type'}</label>
            <select style={inputStyle} value={form.requirementType} onChange={set('requirementType')}>
              {REQUIREMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{isAR ? 'الأولوية' : 'Priority'}</label>
            <select style={inputStyle} value={form.priority} onChange={set('priority')}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{isAR ? 'الحالة' : 'Status'}</label>
            <select style={inputStyle} value={form.status} onChange={set('status')}>
              {REQUIREMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>{isAR ? 'التصنيف' : 'Category'}</label>
            <input style={inputStyle} value={form.category} onChange={set('category')} placeholder="e.g. Performance, Security..." />
          </div>
          <div>
            <label style={labelStyle}>{isAR ? 'المرحلة المصدر' : 'Source Phase'}</label>
            <input style={inputStyle} value={form.sourcePhase} onChange={set('sourcePhase')} placeholder="e.g. 3" />
          </div>
          <div>
            <label style={labelStyle}>{isAR ? 'مفتاح المخرج' : 'Source Output Key'}</label>
            <input style={inputStyle} value={form.sourceOutputKey} onChange={set('sourceOutputKey')} placeholder="e.g. strategic_drivers" />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'المجالات المتأثرة (مفصولة بفاصلة)' : 'Affected Domains (comma-separated)'}</label>
            <input style={inputStyle} value={form.affectedDomains} onChange={set('affectedDomains')} placeholder="BUSINESS, DATA, SECURITY..." />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'المبرر' : 'Rationale'}</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.rationale} onChange={set('rationale')} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'الافتراضات' : 'Assumptions'}</label>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={form.assumptions} onChange={set('assumptions')} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'مرجع الامتثال' : 'Compliance Reference'}</label>
            <input style={inputStyle} value={form.complianceReference} onChange={set('complianceReference')} placeholder="e.g. NORA 2.0 Sec 4.3, ISO 27001..." />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>{isAR ? 'ملاحظات الحوكمة' : 'Governance Notes'}</label>
            <textarea style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} value={form.governanceNotes} onChange={set('governanceNotes')} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ padding: '7px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-dim)', cursor: 'pointer', fontSize: 12 }} onClick={onClose}>{t('common.cancel')}</button>
          <button style={{ padding: '7px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }} disabled={saving || !form.title || !form.description} onClick={submit}>
            {saving ? t('common.saving') : (initial ? (isAR ? 'حفظ التعديلات' : 'Save Changes') : (isAR ? 'إضافة المتطلب' : 'Add Requirement'))}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Requirement Card ─────────────────────────────────────────────────────────

function RequirementCard({ req, onApprove, onReject, onEdit, onStatusChange, showApprovalActions }: {
  req: any
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onEdit?: (req: any) => void
  onStatusChange?: (id: string, status: string) => void
  showApprovalActions?: boolean
}) {
  const { isAR } = useLang()
  const [expanded, setExpanded] = useState(false)
  const [actioning, setActioning] = useState(false)

  const title = isAR ? (req.titleAr || req.title) : req.title
  const statusColor = STATUS_COLOR[req.status] || '#8baac8'
  const priorityColor = PRIORITY_COLOR[req.priority] || '#8baac8'
  const typeColor = TYPE_COLOR[req.requirementType] || 'var(--accent)'

  const handleApprove = async () => {
    setActioning(true)
    try { await onApprove?.(req.id) } finally { setActioning(false) }
  }

  const handleReject = async () => {
    setActioning(true)
    try { await onReject?.(req.id) } finally { setActioning(false) }
  }

  return (
    <div style={{ background: 'var(--navy)', border: `1px solid ${expanded ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 6, transition: 'border-color 0.15s' }}>
      {/* Header row */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
          {req.generatedByAI && (
            <div style={{ fontSize: 9, color: '#f39c12', marginTop: 2 }}>⚡ {isAR ? 'مقترح من الذكاء الاصطناعي' : 'AI-suggested'}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: `${typeColor}20`, color: typeColor, border: `1px solid ${typeColor}40` }}>{req.requirementType.replace(/_/g, ' ')}</span>
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: `${priorityColor}20`, color: priorityColor, border: `1px solid ${priorityColor}40` }}>{req.priority}</span>
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}40` }}>{req.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 14px 12px 14px', borderTop: '1px solid var(--border)' }}>
          {req.description && (
            <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.6, margin: '10px 0 8px' }}>{req.description}</div>
          )}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>
            {req.sourcePhase && <span>Phase {req.sourcePhase}{req.sourceStep ? `.${req.sourceStep}` : ''}</span>}
            {req.sourceOutputKey && <span>← {req.sourceOutputKey.replace(/_/g, ' ')}</span>}
            {req.affectedDomains?.length > 0 && <span>Domains: {req.affectedDomains.join(', ')}</span>}
            {req.complianceReference && <span>Ref: {req.complianceReference}</span>}
          </div>
          {req.rationale && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Rationale:</strong> {req.rationale}</div>}
          {req.governanceNotes && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}><strong>Notes:</strong> {req.governanceNotes}</div>}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {showApprovalActions && req.approvalStatus !== 'APPROVED' && (
              <button disabled={actioning} onClick={handleApprove}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid rgba(46,204,113,0.4)', background: 'rgba(46,204,113,0.1)', color: '#2ecc71', cursor: 'pointer' }}>
                ✓ {isAR ? 'اعتماد' : 'Approve'}
              </button>
            )}
            {showApprovalActions && req.approvalStatus !== 'REJECTED' && req.approvalStatus !== 'APPROVED' && (
              <button disabled={actioning} onClick={handleReject}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid rgba(231,76,60,0.4)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', cursor: 'pointer' }}>
                ✗ {isAR ? 'رفض' : 'Reject'}
              </button>
            )}
            {onEdit && (
              <button onClick={() => onEdit(req)}
                style={{ fontSize: 10, padding: '4px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'none', color: 'var(--text-dim)', cursor: 'pointer' }}>
                ✏ {isAR ? 'تعديل' : 'Edit'}
              </button>
            )}
            {onStatusChange && (
              <select value={req.status} onChange={e => onStatusChange(req.id, e.target.value)}
                style={{ fontSize: 10, padding: '3px 6px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--navy-mid)', color: 'var(--text)', cursor: 'pointer' }}>
                {REQUIREMENT_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Step 7.1 — Proposed Requirements & Approval ──────────────────────────────

function Step71({ admCycleId }: { admCycleId: string }) {
  const { isAR } = useLang()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterType, setFilterType] = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/requirements?admCycleId=${admCycleId}&approvalStatus=PENDING`)
      setItems(res.data || [])
    } finally { setLoading(false) }
  }, [admCycleId])

  useEffect(() => { load() }, [load])

  const approve = async (id: string) => {
    await authFetch(`/requirements/${id}/approve`, { method: 'POST' })
    await load()
  }

  const reject = async (id: string) => {
    await authFetch(`/requirements/${id}/reject`, { method: 'POST' })
    await load()
  }

  const onSave = async () => {
    setShowAdd(false)
    setEditing(null)
    await load()
  }

  const displayed = items.filter(r =>
    (filterType === 'ALL' || r.requirementType === filterType) &&
    (filterPriority === 'ALL' || r.priority === filterPriority)
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
            {isAR ? '📋 قائمة انتظار الاعتماد' : '📋 Approval Queue'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
            {isAR ? 'المتطلبات المقترحة التي تنتظر مراجعة بشرية واعتمادها' : 'Proposed requirements awaiting human review and approval'}
          </div>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: '7px 14px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
          + {isAR ? 'إضافة متطلب' : 'Add Requirement'}
        </button>
      </div>

      {/* Human governance notice */}
      <div style={{ padding: '10px 14px', marginBottom: 14, background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.3)', borderRadius: 'var(--radius)', fontSize: 11, color: '#f39c12', lineHeight: 1.6 }}>
        ⚠ {isAR
          ? 'متطلبات الذكاء الاصطناعي لا تُعتمد تلقائياً. يجب على المراجع البشري اعتماد أو رفض كل متطلب قبل أن يصبح جزءاً من مستودع المتطلبات المعتمدة.'
          : 'AI-suggested requirements are never auto-approved. A human reviewer must explicitly approve or reject each requirement before it enters the approved repository.'}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--navy)', color: 'var(--text)' }}>
          <option value="ALL">{isAR ? 'كل الأنواع' : 'All Types'}</option>
          {REQUIREMENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--navy)', color: 'var(--text)' }}>
          <option value="ALL">{isAR ? 'كل الأولويات' : 'All Priorities'}</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', marginLeft: 'auto' }}>
          {displayed.length} {isAR ? 'متطلب' : 'requirements'}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 16 }}>Loading...</div>
      ) : displayed.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-dim)' }}>
          {isAR ? 'لا توجد متطلبات مقترحة. أضف متطلباً يدوياً أو انتظر حتى يقترح الذكاء الاصطناعي متطلبات من مخرجات ADM.' : 'No proposed requirements. Add one manually or wait for AI to suggest requirements from ADM outputs.'}
        </div>
      ) : displayed.map(req => (
        <RequirementCard
          key={req.id}
          req={req}
          showApprovalActions
          onApprove={approve}
          onReject={reject}
          onEdit={setEditing}
        />
      ))}

      {(showAdd || editing) && (
        <RequirementModal
          admCycleId={admCycleId}
          initial={editing}
          onSave={onSave}
          onClose={() => { setShowAdd(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

// ─── Step 7.2 — Requirements Repository & Lifecycle ──────────────────────────

function Step72({ admCycleId }: { admCycleId: string }) {
  const { isAR } = useLang()
  const [items, setItems] = useState<any[]>([])
  const [allItems, setAllItems] = useState<any[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<any>(null)
  const [filterApproval, setFilterApproval] = useState('APPROVED')
  const [filterType, setFilterType] = useState('ALL')
  const [filterDomain, setFilterDomain] = useState('ALL')
  const [filterPhase, setFilterPhase] = useState('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Always fetch full list for filter options
      const allRes = await authFetch(`/requirements?admCycleId=${admCycleId}&limit=200`)
      setAllItems(allRes.data || [])
      setStats(await authFetch(`/requirements/stats/${admCycleId}`))

      // Filtered list
      const params = new URLSearchParams({ admCycleId, limit: '200' })
      if (filterApproval !== 'ALL') params.set('approvalStatus', filterApproval)
      if (filterType !== 'ALL') params.set('requirementType', filterType)
      if (filterDomain !== 'ALL') params.set('affectedDomain', filterDomain)
      if (filterPhase !== 'ALL') params.set('sourcePhase', filterPhase)
      const res = await authFetch(`/requirements?${params}`)
      setItems(res.data || [])
    } finally { setLoading(false) }
  }, [admCycleId, filterApproval, filterType, filterDomain, filterPhase])

  useEffect(() => { load() }, [load])

  const statusChange = async (id: string, status: string) => {
    await authFetch(`/requirements/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    await load()
  }

  const onSave = async () => { setEditing(null); await load() }

  // Use allItems for filter options so dropdowns don't empty when filtering
  const allDomains = Array.from(new Set(allItems.flatMap((r: any) => r.affectedDomains || []))).sort() as string[]
  const allPhases = Array.from(new Set(allItems.map((r: any) => r.sourcePhase).filter(Boolean))).sort() as string[]

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
          {isAR ? '🗃 مستودع المتطلبات' : '🗃 Requirements Repository'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          {isAR ? 'جميع المتطلبات مع دورة حياتها وحالتها' : 'All requirements with lifecycle status and traceability'}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ padding: '4px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--text-dim)' }}>{isAR ? 'الإجمالي ' : 'Total '}</span><strong>{stats.total}</strong>
          </div>
          {(stats.byStatus || []).map((s: any) => (
            <div key={s.status} style={{ padding: '4px 12px', background: 'var(--navy)', border: `1px solid ${STATUS_COLOR[s.status] || 'var(--border)'}44`, borderRadius: 4, fontSize: 11 }}>
              <span style={{ color: STATUS_COLOR[s.status] || 'var(--text-dim)' }}>{s.status.replace(/_/g, ' ')} </span><strong>{s._count}</strong>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={filterApproval} onChange={e => setFilterApproval(e.target.value)}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius)', border: `1px solid ${filterApproval === 'APPROVED' ? 'rgba(46,204,113,0.4)' : 'var(--border)'}`, background: 'var(--navy)', color: filterApproval === 'APPROVED' ? '#2ecc71' : 'var(--text)' }}>
          <option value="APPROVED">{isAR ? 'معتمدة فقط' : 'Approved only'}</option>
          <option value="PENDING">{isAR ? 'قيد الانتظار' : 'Pending'}</option>
          <option value="REJECTED">{isAR ? 'مرفوضة' : 'Rejected'}</option>
          <option value="ALL">{isAR ? 'الكل' : 'All'}</option>
        </select>
        {[
          { val: filterType, set: setFilterType, opts: ['ALL', ...REQUIREMENT_TYPES], label: isAR ? 'النوع' : 'Type' },
          { val: filterDomain, set: setFilterDomain, opts: ['ALL', ...allDomains], label: isAR ? 'المجال' : 'Domain' },
          { val: filterPhase, set: setFilterPhase, opts: ['ALL', ...allPhases], label: isAR ? 'المرحلة' : 'Phase' },
        ].map(f => (
          <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
            style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--navy)', color: 'var(--text)' }}>
            <option value="ALL">{f.label}: {isAR ? 'الكل' : 'All'}</option>
            {f.opts.slice(1).map((o: string) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        ))}
        <div style={{ fontSize: 11, color: 'var(--text-dim)', alignSelf: 'center', marginLeft: 'auto' }}>
          {items.length} {isAR ? 'متطلب' : 'requirements'}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: 16 }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-dim)' }}>
          {filterApproval === 'APPROVED' ? (isAR ? 'لا توجد متطلبات معتمدة بعد. اعتمد المتطلبات المقترحة في الخطوة 7.1.' : 'No approved requirements yet. Approve proposed requirements in Step 7.1.') : (isAR ? 'لا توجد متطلبات.' : 'No requirements found.')}
        </div>
      ) : items.map(req => (
        <RequirementCard
          key={req.id}
          req={req}
          onEdit={setEditing}
          onStatusChange={statusChange}
        />
      ))}

      {editing && (
        <RequirementModal
          admCycleId={admCycleId}
          initial={editing}
          onSave={onSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

// ─── Step 7.3 — Impact Analysis ───────────────────────────────────────────────

function Step73({ admCycleId }: { admCycleId: string }) {
  const { isAR } = useLang()
  const [requirements, setRequirements] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [changeDesc, setChangeDesc] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    authFetch(`/requirements?admCycleId=${admCycleId}&status=APPROVED&limit=100`)
      .then(res => setRequirements(res.data || []))
  }, [admCycleId])

  const analyze = async () => {
    if (!selected || !changeDesc.trim()) return
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await authFetch(`/requirements/${selected}/impact-analysis`, {
        method: 'POST',
        body: JSON.stringify({ changeDescription: changeDesc }),
      })
      setResult(res.analysis || res.message || JSON.stringify(res, null, 2))
    } catch (e: any) {
      setResult('Error: ' + e.message)
    } finally { setAnalyzing(false) }
  }

  const inputStyle = { width: '100%', padding: '8px 10px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', fontSize: 12, boxSizing: 'border-box' as const }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
          {isAR ? '🔍 تحليل أثر تغيير المتطلبات' : '🔍 Requirement Change Impact Analysis'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
          {isAR ? 'اختر متطلباً وصف التغيير المقترح ليحلل الذكاء الاصطناعي أثره على البنية المعمارية.' : 'Select a requirement, describe the proposed change, and AI will analyze the impact on the architecture.'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
            {isAR ? 'المتطلب المعني' : 'Select Requirement'}
          </label>
          <select value={selected} onChange={e => setSelected(e.target.value)} style={inputStyle}>
            <option value="">{isAR ? '-- اختر متطلباً --' : '-- Select a requirement --'}</option>
            {requirements.map(r => (
              <option key={r.id} value={r.id}>{r.title} ({r.requirementType})</option>
            ))}
          </select>
          {requirements.length === 0 && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              {isAR ? 'لا توجد متطلبات معتمدة. اعتمد المتطلبات في 7.1 و7.2 أولاً.' : 'No approved requirements yet. Approve requirements in 7.1 and 7.2 first.'}
            </div>
          )}
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>
            {isAR ? 'وصف التغيير المقترح' : 'Describe the Proposed Change'}
          </label>
          <textarea
            value={changeDesc}
            onChange={e => setChangeDesc(e.target.value)}
            placeholder={isAR ? 'مثال: نريد تعديل نطاق هذا المتطلب ليشمل متطلبات الأداء للبنية التحتية السحابية...' : 'e.g. We want to expand this requirement to include cloud infrastructure performance thresholds...'}
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
          />
        </div>

        <button
          onClick={analyze}
          disabled={!selected || !changeDesc.trim() || analyzing}
          style={{ padding: '9px 20px', background: analyzing ? 'var(--navy-mid)' : 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600, alignSelf: 'flex-start' }}>
          {analyzing ? `⟳ ${isAR ? 'جارٍ التحليل...' : 'Analyzing...'}` : `🔍 ${isAR ? 'تحليل الأثر' : 'Analyze Impact'}`}
        </button>
      </div>

      {result && (
        <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.25)', borderRadius: 'var(--radius)', fontSize: 12, lineHeight: 1.8, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>
          <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 10 }}>
            {isAR ? '📊 نتيجة تحليل الأثر' : '📊 Impact Analysis Result'}
          </div>
          {result}
        </div>
      )}
    </div>
  )
}

// ─── Phase 7 Workspace (main export) ─────────────────────────────────────────

export function Phase7Workspace({ cycle, steps, onClose }: {
  cycle: any
  steps: any[]
  onClose: () => void
}) {
  const { isAR, t } = useLang()
  const [activeStep, setActiveStep] = useState('7.1')

  const STEP_META: Record<string, { label: string; labelAr: string; desc: string; descAr: string }> = {
    '7.1': {
      label: 'Proposed Requirements & Approval',
      labelAr: 'المتطلبات المقترحة والاعتماد',
      desc: 'Review AI-suggested and manually added requirements. Approve, reject, or edit before they enter the repository.',
      descAr: 'مراجعة المتطلبات المقترحة من الذكاء الاصطناعي أو المضافة يدوياً. الاعتماد أو الرفض أو التعديل قبل إدراجها في المستودع.',
    },
    '7.2': {
      label: 'Requirements Repository & Lifecycle',
      labelAr: 'مستودع المتطلبات ودورة الحياة',
      desc: 'Track all requirements, their lifecycle status, type, domain, and source traceability.',
      descAr: 'تتبع جميع المتطلبات وحالة دورة حياتها ونوعها ومجالها وأثرها.',
    },
    '7.3': {
      label: 'Requirement Change Impact Analysis',
      labelAr: 'تحليل أثر تغيير المتطلبات',
      desc: 'Select a requirement, describe a proposed change, and let AI analyze the architectural impact.',
      descAr: 'اختر متطلباً وصف التغيير المقترح ليحلل الذكاء الاصطناعي أثره المعماري.',
    },
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 8, width: '95vw', maxWidth: 1100, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
                {t('adm.phase')} 7 — {isAR ? 'إدارة المتطلبات' : 'Requirements Management'}
              </div>
              <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 2, background: 'rgba(0,180,216,0.15)', color: 'var(--accent)', border: '1px solid rgba(0,180,216,0.3)', fontFamily: 'var(--font-mono)' }}>
                CONTINUOUS
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
              {isAR
                ? 'طبقة حوكمة متطلبات مستمرة تعمل عبر جميع مراحل دورة ADM'
                : 'Continuous requirements governance layer across all ADM phases — not a sequential step'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 22, cursor: 'pointer', padding: '0 8px', flexShrink: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Step sidebar */}
          <div style={{ width: 210, borderRight: '1px solid var(--border)', padding: '16px 12px', overflowY: 'auto', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginBottom: 8, letterSpacing: '0.08em' }}>WORKSPACES</div>
            {['7.1', '7.2', '7.3'].map(key => {
              const meta = STEP_META[key]
              return (
                <button key={key} onClick={() => setActiveStep(key)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 10px', marginBottom: 6, borderRadius: 'var(--radius)', border: `1px solid ${activeStep === key ? 'var(--accent)' : 'var(--border)'}`, background: activeStep === key ? 'rgba(0,180,216,0.12)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginBottom: 3 }}>{key}</div>
                  <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.35 }}>
                    {isAR ? meta.labelAr : meta.label}
                  </div>
                </button>
              )
            })}

            <div style={{ marginTop: 16, padding: '10px 10px', background: 'rgba(0,180,216,0.05)', border: '1px solid rgba(0,180,216,0.15)', borderRadius: 'var(--radius)' }}>
              <div style={{ fontSize: 9, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>NORA 2.0</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                {isAR ? 'إدارة المتطلبات كطبقة حوكمة مستمرة لدورة تطوير البنية المؤسسية' : 'Requirements managed as a continuous governance layer per NORA ADM methodology'}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
            {/* Step header */}
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(0,180,216,0.06)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent)' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{isAR ? STEP_META[activeStep].labelAr : STEP_META[activeStep].label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{isAR ? STEP_META[activeStep].descAr : STEP_META[activeStep].desc}</div>
            </div>

            {activeStep === '7.1' && <Step71 admCycleId={cycle.id} />}
            {activeStep === '7.2' && <Step72 admCycleId={cycle.id} />}
            {activeStep === '7.3' && <Step73 admCycleId={cycle.id} />}
          </div>
        </div>
      </div>
    </div>
  )
}
