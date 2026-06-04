import { useEffect, useState, useRef } from 'react'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

function useApi() {
  const token = () => localStorage.getItem('ea_token')
  const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
  const post = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json())
  const patch = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json())
  const postFile = (path: string, form: FormData) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form }).then(r => r.json())
  const del = (path: string) => fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
  return { get, post, patch, postFile, del }
}

const REVIEW_TYPES = [
  { value: 'HLD_REVIEW', label: 'High-Level Design (HLD) Review' },
  { value: 'LLD_REVIEW', label: 'Low-Level Design (LLD) Review' },
  { value: 'NEW_PROJECT', label: 'New Project Review' },
  { value: 'RFP_SOW', label: 'RFP / Scope of Work Review' },
  { value: 'CHANGE_REQUEST', label: 'Change Request Review' },
  { value: 'CAB_REVIEW', label: 'CAB Review' },
  { value: 'DIGITAL_INITIATIVE', label: 'Digital Initiative Review' },
  { value: 'TECHNICAL_PROPOSAL', label: 'Technical Proposal Review' },
  { value: 'BUSINESS_DEMAND', label: 'Business Demand Review' },
]

const AGGRESSIVENESS_CARDS = [
  { value: 'ADVISORY', label: 'Advisory', icon: '💡', description: 'Lightweight guidance. Best for early-stage exploration.', border: '#3498db' },
  { value: 'STANDARD', label: 'Standard', icon: '⚖️', description: 'Balanced review covering all domains. Default.', border: '#2ecc71' },
  { value: 'STRICT', label: 'Strict', icon: '🔒', description: 'Rigorous analysis with elevated thresholds. High-impact.', border: '#e67e22' },
  { value: 'EXECUTIVE', label: 'Executive', icon: '🏛️', description: 'Board-level scrutiny with strategic alignment focus.', border: '#e74c3c' },
]

const SEV_COLOR: Record<string, string> = { CRITICAL: '#e74c3c', HIGH: '#e67e22', MEDIUM: '#3498db', LOW: '#2ecc71' }
const DECISION_COLOR: Record<string, string> = { APPROVED: '#2ecc71', APPROVED_WITH_CONDITIONS: '#f39c12', REQUIRES_CHANGES: '#e67e22', REJECTED: '#e74c3c', PENDING: '#8baac8' }
const COMPLIANCE_COLOR: Record<string, string> = { COMPLIANT: '#2ecc71', PARTIALLY_COMPLIANT: '#f39c12', NON_COMPLIANT: '#e74c3c', NOT_APPLICABLE: '#8baac8', REQUIRES_EXCEPTION: '#e67e22' }
const ALIGNMENT_COLOR: Record<string, string> = { FULLY_ALIGNED: '#2ecc71', PARTIALLY_ALIGNED: '#f39c12', WEAKLY_ALIGNED: '#e67e22', NOT_ALIGNED: '#e74c3c', NOT_APPLICABLE: '#8baac8' }

function Steps({ current }: { current: number }) {
  const steps = ['Review Type', 'Upload Inputs', 'Gap Check', 'AI Review', 'Report']
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 64 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, background: i <= current ? 'var(--accent)' : 'var(--navy-mid)', color: i <= current ? '#fff' : 'var(--text-muted)', border: i === current ? '2px solid var(--accent)' : '2px solid transparent' }}>
              {i < current ? '✓' : i + 1}
            </div>
            <div style={{ fontSize: 11, color: i === current ? 'var(--accent)' : 'var(--text-muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{s}</div>
          </div>
          {i < steps.length - 1 && <div style={{ flex: 1, height: 2, background: i < current ? 'var(--accent)' : 'var(--navy-mid)', margin: '0 4px', marginBottom: 20 }} />}
        </div>
      ))}
    </div>
  )
}

function ScoreCircle({ score, label, size = 72 }: { score: number, label: string, size?: number }) {
  const color = score >= 75 ? '#2ecc71' : score >= 60 ? '#f39c12' : '#e74c3c'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: size, height: size, borderRadius: '50%', border: '3px solid ' + color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>
        <div style={{ fontSize: size >= 72 ? 22 : 16, fontWeight: 700, color }}>{score}</div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>/100</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

function FindingCard({ f }: { f: any }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--navy-mid)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'var(--navy-mid)' }} onClick={() => setOpen(o => !o)}>
        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: SEV_COLOR[f.severity] + '33', color: SEV_COLOR[f.severity] }}>{f.severity}</span>
        <span style={{ fontSize: 13, flex: 1, color: 'var(--text)' }}>{f.title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>{f.category?.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.domain?.replace(/_/g, ' ')}</span>
        <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Description: </span>{f.description}</div>
          <div style={{ marginBottom: 8, color: 'var(--accent)' }}><span style={{ color: 'var(--text-muted)' }}>Recommendation: </span>{f.recommendation}</div>
          {f.businessImpact && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Business Impact: </span>{f.businessImpact}</div>}
          {f.technicalImpact && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Technical Impact: </span>{f.technicalImpact}</div>}
          {f.relatedPrinciple && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Principle: </span>{f.relatedPrinciple}</div>}
          {f.relatedStandard && <div><span style={{ color: 'var(--text-muted)' }}>Standard: </span>{f.relatedStandard}</div>}
        </div>
      )}
    </div>
  )
}

export default function GovernancePage() {
  const api = useApi()
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [reviews, setReviews] = useState<any[]>([])
  const [review, setReview] = useState<any>(null)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gaps, setGaps] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [report, setReport] = useState<any>(null)
  const [repoWarnings, setRepoWarnings] = useState<string[]>([])
  const [form, setForm] = useState({ title: '', description: '', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0', aiMode: 'AUTOMATED', projectName: '', notes: '', aggressiveness: 'STANDARD' })
  const [inputs, setInputs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<any>(null)

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => {
    loadReviews()
    api.get('/governance/repository/warnings').then((d: any) => setRepoWarnings(d?.warnings ?? [])).catch(() => {})
  }, [])

  const loadReviews = async () => {
    setLoading(true)
    try { const data = await api.get('/governance/reviews'); setReviews(data) }
    catch (e) { setError('Failed to load reviews') }
    finally { setLoading(false) }
  }

  const openReview = async (r: any) => {
    setReview(r); setView('detail'); setStep(4)
    const [f, rpt] = await Promise.all([
      api.get('/governance/reviews/' + r.id + '/findings').catch(() => []),
      api.get('/governance/reviews/' + r.id + '/report').catch(() => null),
    ])
    setFindings(Array.isArray(f) ? f : [])
    setReport(rpt)
  }

  const createReview = async () => {
    if (!form.title) { setError('Title is required'); return }
    setLoading(true); setError('')
    try {
      const r = await api.post('/governance/reviews', form)
      if (r.id) { setReview(r); setStep(1); setView('create') }
      else setError(r.message || 'Failed to create review')
    } catch (e) { setError('Failed to create review') }
    finally { setLoading(false) }
  }

  const uploadFile = async (file: File) => {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('label', file.name)
    try {
      const r = await api.postFile('/governance/reviews/' + review.id + '/inputs/file', fd)
      if (r.id) setInputs(i => [...i, r])
    } catch (e) { setError('Upload failed') }
    finally { setUploading(false) }
  }

  const detectGaps = async () => {
    setLoading(true); setError('')
    try {
      const r = await api.post('/governance/reviews/' + review.id + '/gaps/detect')
      setGaps(r.gaps || [])
      setReview((prev: any) => ({ ...prev, completenessScore: r.completenessScore }))
      setStep(3)
    } catch (e) { setError('Gap detection failed') }
    finally { setLoading(false) }
  }

  const runReview = async () => {
    setLoading(true); setError('')
    try {
      await api.post('/governance/reviews/' + review.id + '/run')
      setStep(4); pollStatus()
    } catch (e: any) { setError(e.message || 'Failed to start review') }
    finally { setLoading(false) }
  }

  const pollStatus = () => {
    pollRef.current = setInterval(async () => {
      const r = await api.get('/governance/reviews/' + review.id).catch(() => null)
      if (r?.status === 'COMPLETED') {
        clearInterval(pollRef.current)
        setReview(r)
        const [f, rpt] = await Promise.all([
          api.get('/governance/reviews/' + review.id + '/findings').catch(() => []),
          api.get('/governance/reviews/' + review.id + '/report').catch(() => null),
        ])
        setFindings(Array.isArray(f) ? f : [])
        setReport(rpt)
      }
    }, 3000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  if (view === 'list') return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Governance Reviews</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>EA Governance & Compliance Review Service</div>
        </div>
        <button className='btn-primary' onClick={() => { setView('create'); setStep(0); setForm({ title: '', description: '', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0', aiMode: 'AUTOMATED', projectName: '', notes: '', aggressiveness: 'STANDARD' }) }}>+ New Review</button>
      </div>
      {loading && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Loading...</div>}
      {reviews.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏛️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>No reviews yet</div>
          <div style={{ fontSize: 13 }}>Start your first EA governance review</div>
        </div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        {reviews.map(r => (
          <div key={r.id} onClick={() => openReview(r)} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{r.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{REVIEW_TYPES.find(t => t.value === r.reviewType)?.label || r.reviewType} · {r.framework?.replace(/_/g, ' ')} · {r.aggressiveness || 'STANDARD'} · {new Date(r.createdAt).toLocaleDateString()}</div>
            </div>
            {r.overallScore != null && <ScoreCircle score={Math.round(r.overallScore)} label='Score' />}
            <div style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: DECISION_COLOR[r.decision] + '22', color: DECISION_COLOR[r.decision] }}>{r.decision?.replace(/_/g, ' ')}</div>
            <div style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, background: 'var(--navy-light)', color: 'var(--text-muted)' }}>{r.status}</div>
          </div>
        ))}
      </div>
    </div>
  )

  if (view === 'create') return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>New Governance Review</div>
      </div>
      <Steps current={step} />
      {error && <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c', borderRadius: 8, padding: '10px 14px', color: '#e74c3c', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {step === 0 && (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Review Configuration</div>
          {repoWarnings.length > 0 && (
            <div style={{ background: '#f39c1218', border: '1px solid #f39c1266', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#f39c12', marginBottom: 4 }}>Repository Warnings</div>
                <ul style={{ margin: 0, paddingLeft: 16 }}>
                  {repoWarnings.map((w, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{w}</li>)}
                </ul>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Review Title *</label>
              <input className='form-input' value={form.title} onChange={set('title')} placeholder='e.g. Customer Portal HLD Review' />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Review Type</label>
              <select className='form-input' value={form.reviewType} onChange={set('reviewType')}>
                {REVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Review Aggressiveness</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {AGGRESSIVENESS_CARDS.map(card => (
                  <div key={card.value} onClick={() => setForm(f => ({ ...f, aggressiveness: card.value }))}
                    style={{ border: '2px solid ' + (form.aggressiveness === card.value ? card.border : 'var(--navy-light)'), borderRadius: 10, padding: '12px 10px', cursor: 'pointer', background: form.aggressiveness === card.value ? card.border + '18' : 'var(--navy-dark)', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{card.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{card.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.4 }}>{card.description}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Framework</label>
              <select className='form-input' value={form.framework} onChange={set('framework')}>
                <option value='NORA_2_0'>NORA 2.0</option>
                <option value='TOGAF_10'>TOGAF 10</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>AI Mode</label>
              <select className='form-input' value={form.aiMode} onChange={set('aiMode')}>
                <option value='AUTOMATED'>Fully Automated</option>
                <option value='ASSISTED'>Human Assisted</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Project Name</label>
              <input className='form-input' value={form.projectName} onChange={set('projectName')} placeholder='Optional' />
            </div>
          </div>
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button className='btn-primary' onClick={createReview} disabled={loading}>{loading ? 'Creating...' : 'Create Review →'}</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Upload Inputs</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Upload HLD documents, architecture diagrams, and artifacts for review</div>
          <div style={{ border: '2px dashed var(--navy-light)', borderRadius: 10, padding: 32, textAlign: 'center', cursor: 'pointer', marginBottom: 16 }} onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(uploadFile) }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontSize: 14, color: 'var(--text)' }}>{uploading ? 'Uploading...' : 'Click or drag files here'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>PDF, DOCX, PPTX, XLSX, PNG, JPG, JSON, YAML</div>
            <input ref={fileRef} type='file' multiple style={{ display: 'none' }} onChange={e => Array.from(e.target.files || []).forEach(uploadFile)} />
          </div>
          {inputs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {inputs.map((inp, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--navy-dark)', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ fontSize: 13, flex: 1 }}>{inp.fileName || inp.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--accent)' }}>✓ Uploaded</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={() => setStep(0)} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
            <button className='btn-primary' onClick={() => setStep(2)}>Next: Check Gaps →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Input Gap Detection</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>AI will analyze your inputs and detect missing artifacts</div>
          {gaps.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <button className='btn-primary' onClick={detectGaps} disabled={loading}>{loading ? 'Detecting gaps...' : '🔍 Run Gap Detection'}</button>
            </div>
          )}
          {gaps.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, height: 8, background: 'var(--navy-dark)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: (review?.completenessScore || 0) + '%', background: 'var(--accent)', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', minWidth: 48 }}>{Math.round(review?.completenessScore || 0)}%</div>
              </div>
              {gaps.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, marginBottom: 6, background: g.isMandatory ? '#e74c3c11' : '#f39c1211', borderLeft: '3px solid ' + (g.isMandatory ? '#e74c3c' : '#f39c12') }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{g.description}</div>
                  </div>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: g.isMandatory ? '#e74c3c33' : '#f39c1233', color: g.isMandatory ? '#e74c3c' : '#f39c12', whiteSpace: 'nowrap' }}>{g.isMandatory ? 'Blocks review' : g.priority}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
            <button onClick={() => setStep(1)} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
            <div style={{ display: 'flex', gap: 10 }}>
              {gaps.length > 0 && <button onClick={() => setStep(3)} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', cursor: 'pointer' }}>Proceed anyway</button>}
              {gaps.filter((g: any) => g.isMandatory).length === 0 && gaps.length > 0 && <button className='btn-primary' onClick={() => setStep(3)}>Next: Run AI Review →</button>}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>AI Review Pipeline</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            {(review?.framework || '').includes('TOGAF') ? 'Runs 5 TOGAF ADM domain engines' : 'Runs 6 NORA domain engines'} in parallel plus compliance matrix, strategic objectives, future-state alignment, risk, and financial analysis
          </div>
          {review?.status === 'PROCESSING' ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
              <div style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 8 }}>Review in progress...</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>This may take 2-3 minutes. Results will appear automatically.</div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <button className='btn-primary' onClick={runReview} disabled={loading} style={{ fontSize: 15, padding: '12px 32px' }}>{loading ? 'Starting...' : '▶ Run AI Review'}</button>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
            <button onClick={() => setStep(2)} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '8px 16px', color: 'var(--text-muted)', cursor: 'pointer' }}>← Back</button>
          </div>
        </div>
      )}

      {step === 4 && review?.status === 'PROCESSING' && (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙️</div>
          <div style={{ fontSize: 15, color: 'var(--accent)' }}>Generating governance report...</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Results will appear automatically</div>
        </div>
      )}

      {step === 4 && review?.status === 'COMPLETED' && report && (
        <ReportView review={review} report={report} findings={findings} />
      )}
    </div>
  )

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => { setView('list'); loadReviews() }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>← Back to reviews</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{review?.title}</div>
        <div style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: DECISION_COLOR[review?.decision] + '22', color: DECISION_COLOR[review?.decision] }}>{review?.decision?.replace(/_/g, ' ')}</div>
      </div>
      {report && <ReportView review={review} report={report} findings={findings} />}
      {!report && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Report not available yet</div>}
    </div>
  )
}

function ReportView({ review, report, findings }: { review: any, report: any, findings: any[] }) {
  const [tab, setTab] = useState<'summary' | 'findings' | 'domains' | 'strategic' | 'compliance' | 'risk' | 'future' | 'financial'>('summary')
  const tabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'findings', label: 'Findings' },
    { key: 'domains', label: 'Domains' },
    { key: 'strategic', label: 'Strategic' },
    { key: 'compliance', label: 'Compliance' },
    { key: 'risk', label: 'Risk Register' },
    { key: 'future', label: 'Future State' },
    { key: 'financial', label: 'Financial' },
  ]

  return (
    <div>
      {/* Review Header */}
      <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: '12px 20px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>REVIEW TYPE</div><div style={{ fontSize: 13, fontWeight: 600 }}>{review?.reviewType?.replace(/_/g, ' ')}</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>FRAMEWORK</div><div style={{ fontSize: 13, fontWeight: 600 }}>{review?.framework?.replace(/_/g, ' ')}</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AGGRESSIVENESS</div><div style={{ fontSize: 13, fontWeight: 600 }}>{review?.aggressiveness || 'STANDARD'}</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>METHODOLOGY</div><div style={{ fontSize: 13, fontWeight: 600 }}>{report.reviewMethodology?.split('.')[0]}</div></div>
        <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>DATE</div><div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(review?.createdAt).toLocaleDateString()}</div></div>
        {report.confidenceScore > 0 && <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CONFIDENCE</div><div style={{ fontSize: 13, fontWeight: 600, color: report.confidenceScore >= 75 ? '#2ecc71' : report.confidenceScore >= 50 ? '#f39c12' : '#e74c3c' }}>{report.confidenceScore}%</div></div>}
      </div>

      {/* Score Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 24 }}>
        <ScoreCircle score={Math.round(report.overallScore || 0)} label='Overall' />
        <ScoreCircle score={Math.round(report.strategicScore || 0)} label='Strategic' />
        <ScoreCircle score={Math.round(report.complianceScore || 0)} label='Compliance' />
        <ScoreCircle score={Math.round(report.architectureQualityScore || 0)} label='Arch Quality' />
        <ScoreCircle score={Math.round(report.securityScore || 0)} label='Security' />
        <ScoreCircle score={Math.round(report.futureStateScore || 0)} label='Future State' />
        <ScoreCircle score={Math.round(report.financialScore || 0)} label='Financial' />
      </div>

      {/* Decision Box */}
      <div style={{ background: (DECISION_COLOR[report.decision] || '#8baac8') + '22', border: '1px solid ' + (DECISION_COLOR[report.decision] || '#8baac8'), borderRadius: 10, padding: '14px 20px', marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: DECISION_COLOR[report.decision] || '#8baac8', marginBottom: 4 }}>{report.decision?.replace(/_/g, ' ')}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{report.decisionRationale}</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--navy-light)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: '8px 14px', background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent', color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 600 : 400, whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      {/* Summary Tab */}
      {tab === 'summary' && (
        <div>
          <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>EXECUTIVE SUMMARY</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{report.executiveSummary}</div>
          </div>
          {report.scopeDescription && (
            <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>REVIEW SCOPE & METHODOLOGY</div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>{report.scopeDescription}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{report.reviewMethodology}</div>
            </div>
          )}
          {report.requiredActions?.mandatory?.length > 0 && (
            <div style={{ background: '#e74c3c11', border: '1px solid #e74c3c44', borderRadius: 10, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e74c3c', marginBottom: 12 }}>MANDATORY ACTIONS ({report.requiredActions.mandatory.length})</div>
              {report.requiredActions.mandatory.map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#e74c3c', fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                  <div><div style={{ fontWeight: 500 }}>{a.finding}</div><div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{a.action}</div></div>
                </div>
              ))}
            </div>
          )}
          {report.requiredActions?.recommended?.length > 0 && (
            <div style={{ background: '#f39c1211', border: '1px solid #f39c1244', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f39c12', marginBottom: 12 }}>RECOMMENDED ACTIONS ({report.requiredActions.recommended.length})</div>
              {report.requiredActions.recommended.map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: '#f39c12', fontWeight: 600, minWidth: 20 }}>{i + 1}.</span>
                  <div><div style={{ fontWeight: 500 }}>{a.finding}</div><div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{a.action}</div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Findings Tab */}
      {tab === 'findings' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(sev => {
              const count = findings.filter(f => f.severity === sev).length
              return count > 0 ? (
                <div key={sev} style={{ padding: '8px 16px', borderRadius: 8, background: SEV_COLOR[sev] + '22', border: '1px solid ' + SEV_COLOR[sev] + '44', fontSize: 13 }}>
                  <span style={{ color: SEV_COLOR[sev], fontWeight: 600 }}>{count}</span> <span style={{ color: 'var(--text-muted)' }}>{sev}</span>
                </div>
              ) : null
            })}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 'auto' }}>{findings.length} total findings</div>
          </div>
          {findings.map((f, i) => <FindingCard key={i} f={f} />)}
          {findings.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No findings</div>}
        </div>
      )}

      {/* Domains Tab */}
      {tab === 'domains' && (
        <div>
          {Object.entries(report.domainSummaries || {}).map(([domain, ds]: [string, any]) => (
            <div key={domain} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{domain.replace(/_/g, ' ')}</div>
                <ScoreCircle score={Math.round(ds.score || 0)} label='' size={48} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                {[['Compliance', ds.complianceScore], ['Risk', ds.riskScore]].map(([l, v]: any) => (
                  <div key={l} style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: v >= 75 ? '#2ecc71' : v >= 60 ? '#f39c12' : '#e74c3c' }}>{Math.round(v || 0)}</div>
                  </div>
                ))}
                <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '6px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Findings</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{ds.findings?.length || 0}</div>
                </div>
              </div>
              <div style={{ height: 6, background: 'var(--navy-dark)', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (ds.score || 0) + '%', background: ds.score >= 75 ? '#2ecc71' : ds.score >= 60 ? '#f39c12' : '#e74c3c', borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{ds.summary}</div>
              {ds.keyStrengths && <div style={{ fontSize: 12, color: '#2ecc71' }}>✓ {ds.keyStrengths}</div>}
              {ds.keyWeaknesses && <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 4 }}>✗ {ds.keyWeaknesses}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Strategic Tab */}
      {tab === 'strategic' && (
        <div>
          {report.strategicAlignment?.overallAlignmentPercentage != null && (
            <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={{ fontSize: 32, fontWeight: 700, color: report.strategicAlignment.overallAlignmentPercentage >= 75 ? '#2ecc71' : report.strategicAlignment.overallAlignmentPercentage >= 50 ? '#f39c12' : '#e74c3c' }}>{report.strategicAlignment.overallAlignmentPercentage}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Overall Alignment</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 8, background: 'var(--navy-dark)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: report.strategicAlignment.overallAlignmentPercentage + '%', background: report.strategicAlignment.overallAlignmentPercentage >= 75 ? '#2ecc71' : report.strategicAlignment.overallAlignmentPercentage >= 50 ? '#f39c12' : '#e74c3c', borderRadius: 4 }} />
                </div>
              </div>
            </div>
          )}
          {(report.strategicAlignment?.objectives || []).map((obj: any, i: number) => (
            <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{obj.objectiveName}</div>
                <div style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: (DECISION_COLOR[obj.alignmentStatus] || '#8baac8') + '22', color: (DECISION_COLOR[obj.alignmentStatus] || '#8baac8') }}>{obj.alignmentStatus?.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: obj.alignmentPercentage >= 75 ? '#2ecc71' : obj.alignmentPercentage >= 50 ? '#f39c12' : '#e74c3c', minWidth: 48, textAlign: 'right' }}>{obj.alignmentPercentage}%</div>
              </div>
              <div style={{ height: 4, background: 'var(--navy-dark)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (obj.alignmentPercentage || 0) + '%', background: obj.alignmentPercentage >= 75 ? '#2ecc71' : obj.alignmentPercentage >= 50 ? '#f39c12' : '#e74c3c', borderRadius: 2 }} />
              </div>
              {obj.contributionDescription && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{obj.contributionDescription}</div>}
              {obj.expectedValue && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>Expected Value: {obj.expectedValue}</div>}
              {obj.relatedKPIs?.length > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>KPIs: {obj.relatedKPIs.join(', ')}</div>}
            </div>
          ))}
          {(!report.strategicAlignment?.objectives || report.strategicAlignment.objectives.length === 0) && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No strategic objectives assessed</div>
          )}
        </div>
      )}

      {/* Compliance Tab */}
      {tab === 'compliance' && (
        <div>
          {report.complianceMatrix?.count > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[['Compliant', report.complianceMatrix.compliantCount, '#2ecc71'], ['Non-Compliant', report.complianceMatrix.nonCompliantCount, '#e74c3c'], ['Requires Exception', report.complianceMatrix.requiresExceptionCount, '#e67e22']].map(([l, v, c]: any) => (
                <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{v || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          {(report.complianceMatrix?.items || []).map((item: any, i: number) => (
            <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{item.principleOrStandard}</div>
                <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: (DECISION_COLOR[item.complianceStatus] || '#8baac8') + '22', color: (DECISION_COLOR[item.complianceStatus] || '#8baac8'), whiteSpace: 'nowrap' }}>{item.complianceStatus?.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.category?.replace(/_/g, ' ')}</div>
              </div>
              {item.evidence && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Evidence: {item.evidence}</div>}
              {item.gap && <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 4 }}>Gap: {item.gap}</div>}
              {item.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Recommendation: {item.recommendation}</div>}
            </div>
          ))}
          {(!report.complianceMatrix?.items || report.complianceMatrix.items.length === 0) && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No compliance matrix available</div>
          )}
        </div>
      )}


      {/* Risk Register Tab */}
      {tab === 'risk' && (
        <div>
          {report.riskRegister?.totalRisks > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
              {[['Total Risks', report.riskRegister.totalRisks, '#8baac8'], ['Critical', report.riskRegister.criticalRisks, '#e74c3c'], ['High', report.riskRegister.highRisks, '#e67e22']].map(([l, v, c]: any) => (
                <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{v || 0}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l}</div>
                </div>
              ))}
            </div>
          )}
          {(report.riskRegister?.risks || []).map((risk: any, i: number) => (
            <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: SEV_COLOR[risk.severity] + '33', color: SEV_COLOR[risk.severity] }}>{risk.severity}</span>
                <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{risk.riskTitle}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{risk.riskCategory?.replace(/_/g, ' ')}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Probability: </span>{risk.probability}</div>
                <div style={{ fontSize: 12 }}><span style={{ color: 'var(--text-muted)' }}>Owner: </span>{risk.owner}</div>
              </div>
              {risk.impact && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Impact: {risk.impact}</div>}
              {risk.mitigation && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>Mitigation: {risk.mitigation}</div>}
              {risk.evidence && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Evidence: {risk.evidence}</div>}
            </div>
          ))}
          {(!report.riskRegister?.risks || report.riskRegister.risks.length === 0) && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No risk register available</div>
          )}
        </div>
      )}
      {/* Future State Tab */}
      {tab === 'future' && (
        <div>
          {report.futureStateAlignment ? (
            <div>
              <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 32, fontWeight: 700, color: (report.futureStateAlignment.alignmentPercentage || 0) >= 75 ? '#2ecc71' : (report.futureStateAlignment.alignmentPercentage || 0) >= 50 ? '#f39c12' : '#e74c3c' }}>{report.futureStateAlignment.alignmentPercentage || 0}%</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{report.futureStateAlignment.overallAlignment?.replace(/_/g, ' ')}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8 }}>{report.futureStateAlignment.summary}</div>
                  <div style={{ height: 6, background: 'var(--navy-dark)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: (report.futureStateAlignment.alignmentPercentage || 0) + '%', background: (report.futureStateAlignment.alignmentPercentage || 0) >= 75 ? '#2ecc71' : (report.futureStateAlignment.alignmentPercentage || 0) >= 50 ? '#f39c12' : '#e74c3c', borderRadius: 3 }} />
                  </div>
                </div>
              </div>
              {(report.futureStateAlignment.alignmentAreas || []).map((area: any, i: number) => (
                <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{area.area}</div>
                    <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#8baac822', color: '#8baac8' }}>{area.status?.replace(/_/g, ' ')}</div>
                  </div>
                  {area.gap && <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 4 }}>Gap: {area.gap}</div>}
                  {area.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>Recommendation: {area.recommendation}</div>}
                </div>
              ))}
              {report.futureStateAlignment.keyGaps?.length > 0 && (
                <div style={{ background: '#e74c3c11', border: '1px solid #e74c3c44', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e74c3c', marginBottom: 10 }}>KEY GAPS</div>
                  {report.futureStateAlignment.keyGaps.map((g: string, i: number) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, paddingLeft: 8 }}>• {g}</div>
                  ))}
                </div>
              )}
              {report.futureStateAlignment.recommendations?.length > 0 && (
                <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 10 }}>RECOMMENDATIONS</div>
                  {report.futureStateAlignment.recommendations.map((r: string, i: number) => (
                    <div key={i} style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, paddingLeft: 8 }}>• {r}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Future-state alignment not available</div>
          )}
        </div>
      )}

      {/* Financial Tab */}
      {tab === 'financial' && (
        <div>
          {report.financialOpportunities?.totalAnnualSaving > 0 && (
            <div style={{ background: '#2ecc7122', border: '1px solid #2ecc7144', borderRadius: 10, padding: 16, marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>ESTIMATED ANNUAL SAVINGS</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#2ecc71' }}>SAR {report.financialOpportunities.totalAnnualSaving.toLocaleString()}</div>
            </div>
          )}
          {(report.financialOpportunities?.opportunities || []).map((o: any, i: number) => (
            <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 16, marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{o.type?.replace(/_/g, ' ')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{o.description}</div>
              {o.existingAlternative && <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>Reuse: {o.existingAlternative}</div>}
              {o.estimatedSaving > 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>One-time saving: SAR {o.estimatedSaving.toLocaleString()}</div>}
              {o.annualSaving > 0 && <div style={{ fontSize: 13, color: '#2ecc71' }}>Annual saving: SAR {o.annualSaving.toLocaleString()}</div>}
              {o.confidenceLevel && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Confidence: {o.confidenceLevel}</div>}
            </div>
          ))}
          {!report.financialOpportunities?.opportunities?.length && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No financial opportunities detected</div>
          )}
        </div>
      )}
    </div>
  )
}
