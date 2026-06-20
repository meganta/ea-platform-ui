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

const INTELLIGENCE_ITEMS = [
  { key: 'strategies', label: 'Strategic Objectives & Initiatives', icon: '🎯', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'ea_assets', label: 'EA Assets & Applications Inventory', icon: '🏗️', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'capabilities', label: 'Business Capabilities', icon: '⚡', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'standards', label: 'EA Standards & Principles', icon: '📐', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'reference_architectures', label: 'Reference Architectures', icon: '🗂️', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'target_architectures', label: 'Target-State Architectures', icon: '🎯', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'technology_catalog', label: 'Approved Technology Catalog', icon: '💻', source: 'repository', enrichUrl: '/repository', enrichLabel: 'Add to Repository' },
  { key: 'arch_decisions', label: 'Previous Architecture Decisions', icon: '📋', source: 'kb', enrichUrl: '/knowledge', enrichLabel: 'Upload to Knowledge Base' },
  { key: 'security_standards', label: 'Security Standards & Controls', icon: '🔒', source: 'kb', enrichUrl: '/knowledge', enrichLabel: 'Upload to Knowledge Base' },
  { key: 'similar_reviews', label: 'Similar Previous Reviews', icon: '🔍', source: 'auto', enrichUrl: '', enrichLabel: '' },
]

const SEV_COLOR: Record<string, string> = { CRITICAL: '#e74c3c', HIGH: '#e67e22', MEDIUM: '#3498db', LOW: '#2ecc71' }
const DECISION_COLOR: Record<string, string> = { APPROVED: '#2ecc71', APPROVED_WITH_CONDITIONS: '#f39c12', REQUIRES_CHANGES: '#e67e22', REJECTED: '#e74c3c', PENDING: '#8baac8' }

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


const DOMAIN_LABEL: Record<string, string> = {
  BUSINESS_ARCHITECTURE: 'Business Architecture',
  BENEFICIARY_EXPERIENCE: 'Beneficiary Experience',
  APPLICATION_INTEGRATION: 'Application & Integration',
  DATA_ARCHITECTURE: 'Data Architecture',
  INFRASTRUCTURE: 'Infrastructure',
  SECURITY_ARCHITECTURE: 'Security Architecture',
  TOGAF_BUSINESS: 'TOGAF Business',
  TOGAF_APPLICATION: 'TOGAF Application',
  TOGAF_DATA: 'TOGAF Data',
  TOGAF_TECHNOLOGY: 'TOGAF Technology',
  TOGAF_GOVERNANCE: 'TOGAF Governance',
}

function FindingsTab({ findings }: { findings: any[] }) {
  const [groupBy, setGroupBy] = React.useState<'domain' | 'severity'>('domain')
  const [filterSev, setFilterSev] = React.useState<string[]>([])
  const [filterDomain, setFilterDomain] = React.useState<string[]>([])
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({})

  const allDomains = Array.from(new Set(findings.map(f => f.domain || 'GENERAL'))).sort()

  const toggleSev = (s: string) => setFilterSev(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const toggleDomain = (d: string) => setFilterDomain(p => p.includes(d) ? p.filter(x => x !== d) : [...p, d])
  const toggleGroup = (g: string) => setCollapsed(p => ({ ...p, [g]: !p[g] }))

  const filtered = findings.filter(f => {
    if (filterSev.length > 0 && !filterSev.includes(f.severity)) return false
    if (filterDomain.length > 0 && !filterDomain.includes(f.domain || 'GENERAL')) return false
    return true
  })

  const groups: Record<string, any[]> = {}
  if (groupBy === 'domain') {
    for (const f of filtered) { const k = f.domain || 'GENERAL'; if (!groups[k]) groups[k] = []; groups[k].push(f) }
  } else {
    for (const sev of ['CRITICAL','HIGH','MEDIUM','LOW']) {
      const items = filtered.filter(f => f.severity === sev)
      if (items.length) groups[sev] = items
    }
  }

  const activeFilters = filterSev.length + filterDomain.length

  return (
    <div>
      {/* Severity filter buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['CRITICAL','HIGH','MEDIUM','LOW'].map(sev => {
          const total = findings.filter(f => f.severity === sev).length
          if (total === 0) return null
          const active = filterSev.includes(sev)
          return (
            <button key={sev} onClick={() => toggleSev(sev)} style={{
              padding: '5px 12px', borderRadius: 8, border: '1px solid ' + SEV_COLOR[sev] + (active ? '' : '55'),
              background: active ? SEV_COLOR[sev] + '33' : 'transparent',
              color: SEV_COLOR[sev], fontWeight: 600, fontSize: 12, cursor: 'pointer'
            }}>{total} {sev}</button>
          )
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {activeFilters > 0 && (
            <button onClick={() => { setFilterSev([]); setFilterDomain([]) }} style={{
              fontSize: 11, color: 'var(--text-muted)', background: 'transparent',
              border: '1px solid var(--navy-light)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer'
            }}>✕ Clear filters</button>
          )}
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{filtered.length}/{findings.length} findings</span>
        </div>
      </div>

      {/* Domain filter pills */}
      {allDomains.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {allDomains.map(d => {
            const label = d === 'GENERAL' ? 'General' : (DOMAIN_LABEL[d] || d.replace(/_/g,' '))
            const count = findings.filter(f => (f.domain || 'GENERAL') === d).length
            const active = filterDomain.includes(d)
            return (
              <button key={d} onClick={() => toggleDomain(d)} style={{
                padding: '3px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                border: '1px solid ' + (active ? 'var(--accent)' : 'var(--navy-light)'),
                background: active ? 'var(--accent)22' : 'var(--navy-mid)',
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}>{label} ({count})</button>
            )
          })}
        </div>
      )}

      {/* Group by toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Group by:</span>
        {(['domain','severity'] as const).map(g => (
          <button key={g} onClick={() => setGroupBy(g)} style={{
            padding: '3px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: '1px solid ' + (groupBy === g ? 'var(--accent)' : 'var(--navy-light)'),
            background: groupBy === g ? 'var(--accent)22' : 'transparent',
            color: groupBy === g ? 'var(--accent)' : 'var(--text-muted)',
          }}>{g === 'domain' ? 'Domain' : 'Severity'}</button>
        ))}
      </div>

      {/* Groups */}
      {Object.keys(groups).length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
          {findings.length === 0 ? 'No findings' : 'No findings match the selected filters'}
        </div>
      )}
      {Object.entries(groups).map(([key, items]) => {
        const isCollapsed = collapsed[key]
        const sevCounts = ['CRITICAL','HIGH','MEDIUM','LOW']
          .map(s => ({ s, n: items.filter(f => f.severity === s).length }))
          .filter(x => x.n > 0)
        const groupLabel = groupBy === 'domain'
          ? (key === 'GENERAL' ? '⚙️ General / Common' : (DOMAIN_LABEL[key] || key.replace(/_/g,' ')))
          : key
        return (
          <div key={key} style={{ marginBottom: 10, border: '1px solid var(--navy-light)', borderRadius: 10, overflow: 'hidden' }}>
            <div onClick={() => toggleGroup(key)} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: 'var(--navy-mid)', cursor: 'pointer', userSelect: 'none'
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: groupBy === 'severity' ? SEV_COLOR[key] : 'var(--text)' }}>{groupLabel}</span>
              <div style={{ display: 'flex', gap: 5 }}>
                {sevCounts.map(({ s, n }) => (
                  <span key={s} style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: SEV_COLOR[s] + '33', color: SEV_COLOR[s] }}>{n} {s}</span>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', minWidth: 60, textAlign: 'right' }}>{items.length} finding{items.length !== 1 ? 's' : ''}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isCollapsed ? '▶' : '▼'}</span>
            </div>
            {!isCollapsed && (
              <div style={{ padding: '8px 8px 4px' }}>
                {items.map((f, i) => <FindingCard key={i} f={f} />)}
              </div>
            )}
          </div>
        )
      })}
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

function IntelligenceAdvisor({ reviewType }: { reviewType: string }) {
  const api = useApi()
  const [availability, setAvailability] = useState<Record<string, any>>({})
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    const check = async () => {
      try {
        const contextCheck = await api.get('/governance/repository/context-check?reviewType=' + reviewType).catch(() => ({}))
        setAvailability(contextCheck as any)
      } catch {}
      setChecked(true)
    }
    check()
  }, [reviewType])

  if (!checked) return (
    <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 20, marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🧠 Review Intelligence Advisor</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Checking repository and knowledge base...</div>
    </div>
  )

  return (
    <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 20, marginTop: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🧠 Review Intelligence Advisor</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>The following items will enrich your review. Items marked as missing should be added to improve review quality.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {INTELLIGENCE_ITEMS.map(item => {
          const itemData = availability[item.key]; const available = item.source === 'auto' ? true : (itemData?.available === true || itemData === true)
          return (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: available ? '#2ecc7111' : '#f39c1211', border: '1px solid ' + (available ? '#2ecc7133' : '#f39c1233') }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: available ? '#2ecc71' : '#f39c12' }}>
                  {available ? '✓ Available — will be used automatically' : '⚠ Not found — ' + (item.source === 'kb' ? 'upload to Knowledge Base' : 'add to Repository') + ' to enrich'}
                </div>
              </div>
              {!available && item.enrichUrl && (
                <a href={item.enrichUrl} style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', whiteSpace: 'nowrap', padding: '3px 8px', border: '1px solid var(--accent)', borderRadius: 6 }}>{item.enrichLabel}</a>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ProgressView({ review, onComplete }: { review: any, onComplete: (r: any, f: any[], rpt: any) => void }) {
  const api = useApi()
  const [stage, setStage] = useState<'gaps' | 'reviewing' | 'done'>('gaps')
  const [progress, setProgress] = useState(0)
  const [statusMsg, setStatusMsg] = useState('Analyzing input documents...')
  const [engines, setEngines] = useState([
    { label: 'Business Architecture', done: false },
    { label: 'Beneficiary Experience', done: false },
    { label: 'Application & Integration', done: false },
    { label: 'Data Architecture', done: false },
    { label: 'Infrastructure', done: false },
    { label: 'Security Architecture', done: false },
    { label: 'Compliance Matrix', done: false },
    { label: 'Strategic Alignment', done: false },
    { label: 'Risk Assessment', done: false },
    { label: 'Financial Optimization', done: false },
  ])
  const pollRef = useRef<any>(null)
  const engineTimerRef = useRef<any>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runFlow()
    return () => {
      clearInterval(pollRef.current)
      clearInterval(engineTimerRef.current)
    }
  }, [])

  const runFlow = async () => {
    // Stage 1: Gap detection
    setStage('gaps')
    setStatusMsg('Running gap detection...')
    setProgress(10)
    try {
      await api.post('/governance/reviews/' + review.id + '/gaps/detect')
    } catch {}
    setProgress(25)
    setStatusMsg('Gap detection complete. Starting AI review engines...')
    await sleep(1000)

    // Stage 2: Run AI review
    setStage('reviewing')
    setProgress(30)
    setStatusMsg('AI review pipeline running...')
    try {
      await api.post('/governance/reviews/' + review.id + '/run')
    } catch {}

    // Animate engines progressively
    let engineIdx = 0
    engineTimerRef.current = setInterval(() => {
      if (engineIdx < engines.length) {
        setEngines(prev => prev.map((e, i) => i === engineIdx ? { ...e, done: true } : e))
        engineIdx++
        setProgress(30 + Math.round((engineIdx / engines.length) * 50))
      }
    }, 8000)

    // Poll for completion
    pollRef.current = setInterval(async () => {
      const r = await api.get('/governance/reviews/' + review.id).catch(() => null)
      if (r?.status === 'COMPLETED') {
        clearInterval(pollRef.current)
        clearInterval(engineTimerRef.current)
        setEngines(prev => prev.map(e => ({ ...e, done: true })))
        setProgress(95)
        setStatusMsg('Generating report...')
        await sleep(1500)
        setProgress(100)
        const [f, rpt] = await Promise.all([
          api.get('/governance/reviews/' + review.id + '/findings').catch(() => []),
          api.get('/governance/reviews/' + review.id + '/report').catch(() => null),
        ])
        setStage('done')
        onComplete(r, Array.isArray(f) ? f : [], rpt)
      }
    }, 4000)
  }

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms))

  return (
    <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 28 }}>
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
        {stage === 'gaps' ? '🔍 Analyzing Inputs' : stage === 'reviewing' ? '⚙️ Running AI Review Engines' : '✅ Review Complete'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{statusMsg}</div>

      {/* Progress bar */}
      <div style={{ height: 8, background: 'var(--navy-dark)', borderRadius: 4, marginBottom: 24, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: progress + '%', background: 'var(--accent)', borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>

      {/* Engine status */}
      {stage === 'reviewing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {engines.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: e.done ? '#2ecc7111' : 'var(--navy-dark)', border: '1px solid ' + (e.done ? '#2ecc7133' : 'var(--navy-light)') }}>
              <span style={{ fontSize: 14 }}>{e.done ? '✅' : '⏳'}</span>
              <span style={{ fontSize: 12, color: e.done ? '#2ecc71' : 'var(--text-muted)' }}>{e.label}</span>
            </div>
          ))}
        </div>
      )}

      {stage === 'gaps' && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {['Extracting document content', 'Identifying missing artifacts', 'Checking completeness', 'Pulling repository context'].map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '4px 10px', borderRadius: 6, background: 'var(--navy-dark)', border: '1px solid var(--navy-light)' }}>⏳ {s}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GovernancePage() {
  const api = useApi()
  const [view, setView] = useState<'list' | 'create' | 'progress' | 'report'>('list')
  const [reviews, setReviews] = useState<any[]>([])
  const [review, setReview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [findings, setFindings] = useState<any[]>([])
  const [report, setReport] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0', aiMode: 'AUTOMATED', projectName: '', notes: '', aggressiveness: 'STANDARD' })
  const [inputs, setInputs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [extractedMeta, setExtractedMeta] = useState<any>(null)
  const [showMeta, setShowMeta] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }))

  useEffect(() => { loadReviews() }, [])

  const loadReviews = async () => {
    setLoading(true)
    try { const data = await api.get('/governance/reviews'); setReviews(data) }
    catch (e) { setError('Failed to load reviews') }
    finally { setLoading(false) }
  }

  const openReview = async (r: any) => {
    setReview(r)
    const [f, rpt] = await Promise.all([
      api.get('/governance/reviews/' + r.id + '/findings').catch(() => []),
      api.get('/governance/reviews/' + r.id + '/report').catch(() => null),
    ])
    setFindings(Array.isArray(f) ? f : [])
    setReport(rpt)
    setView('report')
  }

  const createAndStart = async () => {
    if (!form.title) { setError('Title is required'); return }
    if (inputs.length === 0) { setError('Please upload at least one document'); return }
    setLoading(true); setError('')
    try {
      const r = await api.post('/governance/reviews', form)
      if (!r.id) { setError(r.message || 'Failed to create review'); return }
      setReview(r)
      // Upload all files to the new review
      for (const inp of inputs) {
        if (inp._file) {
          const fd = new FormData()
          fd.append('file', inp._file)
          fd.append('label', inp._file.name)
          await api.postFile('/governance/reviews/' + r.id + '/inputs/file', fd).catch(() => {})
        }
      }
      setView('progress')
      // Fetch extracted metadata after a delay (extraction runs async in backend)
      setTimeout(() => fetchExtractedMetadata(r.id).catch(() => {}), 5000)
    } catch (e) { setError('Failed to create review') }
    finally { setLoading(false) }
  }

  const exportWord = async () => {
    const token = localStorage.getItem('ea_token')
    try {
      const res = await fetch(API_URL + '/governance/reviews/' + review?.id + '/export/word', {
        headers: { Authorization: 'Bearer ' + token }
      })
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = (review?.title || 'governance-review') + '.docx'
      a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Export failed') }
  }

  const reRunReview = async () => {
    if (!review?.id) return
    try {
      await api.post('/governance/reviews/' + review.id + '/run')
      setView('progress')
    } catch (e) { alert('Failed to re-run review') }
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    const newInputs = Array.from(files).map(f => ({ label: f.name, _file: f }))
    setInputs(i => [...i, ...newInputs])
  }

  const fetchExtractedMetadata = async (reviewId: string) => {
    try {
      const meta = await api.get('/governance/reviews/' + reviewId + '/inputs/metadata')
      if (meta && Object.keys(meta).length > 0) {
        setExtractedMeta(meta)
        setShowMeta(true)
      }
    } catch {}
  }

  const removeInput = (idx: number) => setInputs(i => i.filter((_, j) => j !== idx))

  if (view === 'list') return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>Governance Reviews</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>EA Governance & Compliance Review Service</div>
        </div>
        <button className='btn-primary' onClick={() => { setView('create'); setForm({ title: '', description: '', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0', aiMode: 'AUTOMATED', projectName: '', notes: '', aggressiveness: 'STANDARD' }); setInputs([]) }}>+ New Review</button>
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
    <div style={{ padding: '24px 32px', maxWidth: 860 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => setView('list')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>New Governance Review</div>
      </div>
      {error && <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c', borderRadius: 8, padding: '10px 14px', color: '#e74c3c', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Review Configuration</div>
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
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Project Name</label>
            <input className='form-input' value={form.projectName} onChange={set('projectName')} placeholder='Optional' />
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Upload Architecture Documents</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>PDF, DOCX, PPTX, XLSX, PNG, JPG, JSON, YAML — HLD documents, diagrams, NFRs, integration specs</div>
        <div style={{ border: '2px dashed var(--navy-light)', borderRadius: 10, padding: 28, textAlign: 'center', cursor: 'pointer', marginBottom: 12 }}
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files) }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
          <div style={{ fontSize: 14, color: 'var(--text)' }}>{uploading ? 'Processing...' : 'Click or drag files here'}</div>
          <input ref={fileRef} type='file' multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} />
        </div>
        {inputs.length > 0 && (
          <div>
            {inputs.map((inp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--navy-dark)', borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>📄</span>
                <span style={{ fontSize: 13, flex: 1 }}>{inp.label}</span>
                <button onClick={() => removeInput(i)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Metadata Panel */}
      {extractedMeta && showMeta && (
        <div style={{ background: 'var(--navy-mid)', border: '1px solid #3498db44', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>🤖 Auto-Extracted Information</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>AI extracted the following from your documents. Review and confirm before starting.</div>
            </div>
            <button onClick={() => setShowMeta(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>×</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {extractedMeta.solutionName && <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>SOLUTION NAME</div><div style={{ fontSize: 13, fontWeight: 600 }}>{extractedMeta.solutionName}</div></div>}
            {extractedMeta.scope && <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>SCOPE</div><div style={{ fontSize: 13 }}>{extractedMeta.scope}</div></div>}
            {extractedMeta.businessOwner && <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>BUSINESS OWNER</div><div style={{ fontSize: 13 }}>{extractedMeta.businessOwner}</div></div>}
            {extractedMeta.technicalOwner && <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>TECHNICAL OWNER</div><div style={{ fontSize: 13 }}>{extractedMeta.technicalOwner}</div></div>}
            {extractedMeta.availabilityTargets && <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>AVAILABILITY</div><div style={{ fontSize: 13 }}>{extractedMeta.availabilityTargets}</div></div>}
            {extractedMeta.drRequirements && <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>DR REQUIREMENTS</div><div style={{ fontSize: 13 }}>{extractedMeta.drRequirements}</div></div>}
          </div>
          {extractedMeta.technologies?.length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>TECHNOLOGIES DETECTED</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{extractedMeta.technologies.map((t: string, i: number) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#3498db22', color: '#3498db' }}>{t}</span>)}</div></div>}
          {extractedMeta.integrations?.length > 0 && <div style={{ marginTop: 10 }}><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>INTEGRATIONS</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{extractedMeta.integrations.map((t: string, i: number) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#2ecc7122', color: '#2ecc71' }}>{t}</span>)}</div></div>}
          {extractedMeta.missingItems?.length > 0 && <div style={{ marginTop: 10, background: '#e67e2218', border: '1px solid #e67e2244', borderRadius: 8, padding: '10px 14px' }}><div style={{ fontSize: 12, fontWeight: 600, color: '#e67e22', marginBottom: 6 }}>⚠ Potentially Missing</div>{extractedMeta.missingItems.map((m: string, i: number) => <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>• {m}</div>)}</div>}
        </div>
      )}

      {/* Intelligence Advisor */}
      <IntelligenceAdvisor reviewType={form.reviewType} />

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
        <button className='btn-primary' onClick={createAndStart} disabled={loading || inputs.length === 0} style={{ fontSize: 15, padding: '12px 32px' }}>
          {loading ? 'Creating...' : '▶ Start Review'}
        </button>
      </div>
    </div>
  )

  if (view === 'progress') return (
    <div style={{ padding: '24px 32px', maxWidth: 800 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{review?.title}</div>
      </div>
      <ProgressView
        review={review}
        onComplete={(r, f, rpt) => { setReview(r); setFindings(f); setReport(rpt); setView('report') }}
      />
    </div>
  )

  if (view === 'report') return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => { setView('list'); loadReviews() }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>← Back to reviews</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{review?.title}</div>
        <div style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: DECISION_COLOR[review?.decision] + '22', color: DECISION_COLOR[review?.decision] }}>{review?.decision?.replace(/_/g, ' ')}</div>
        <button onClick={exportWord} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>📄 Export Word</button>
        <button onClick={reRunReview} style={{ background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 14px', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>🔄 Re-run</button>
      </div>
      {report && <ReportView review={review} report={report} findings={findings} />}
      {!report && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Report not available yet</div>}
    </div>
  )

  return null
}

function ReportView({ review, report, findings }: { review: any, report: any, findings: any[] }) {
  const [tab, setTab] = useState<'summary' | 'findings' | 'domains' | 'strategic' | 'compliance' | 'risk' | 'future' | 'financial'>('summary')
  const extScores = (report.domainSummaries?._extendedScores) || {}
  const archQualityScore = extScores.architectureQualityScore || 0
  const secScore = extScores.securityScore || 0
  const futureScore = extScores.futureStateScore || 0
  const finScore = extScores.financialScore || 0
  const confScore = extScores.confidenceScore || report.confidenceScore || 0

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
        {confScore > 0 && <div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CONFIDENCE</div><div style={{ fontSize: 13, fontWeight: 600, color: confScore >= 75 ? '#2ecc71' : confScore >= 50 ? '#f39c12' : '#e74c3c' }}>{confScore}%</div></div>}
      </div>

      {/* Score Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12, marginBottom: 24 }}>
        <ScoreCircle score={Math.round(report.overallScore || 0)} label='Overall' />
        <ScoreCircle score={Math.round(report.strategicScore || 0)} label='Strategic' />
        <ScoreCircle score={Math.round(report.complianceScore || 0)} label='Compliance' />
        <ScoreCircle score={Math.round(archQualityScore)} label='Arch Quality' />
        <ScoreCircle score={Math.round(secScore)} label='Security' />
        <ScoreCircle score={Math.round(futureScore)} label='Future State' />
        <ScoreCircle score={Math.round(finScore)} label='Financial' />
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
          {/* Finding severity snapshot */}
          {(() => {
            const crit = findings.filter(f => f.severity === 'CRITICAL')
            const high = findings.filter(f => f.severity === 'HIGH')
            const med  = findings.filter(f => f.severity === 'MEDIUM')
            const low  = findings.filter(f => f.severity === 'LOW')
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
                {[['CRITICAL', crit.length, '#e74c3c'], ['HIGH', high.length, '#e67e22'], ['MEDIUM', med.length, '#f39c12'], ['LOW', low.length, '#3498db']].map(([l, n, c]: any) => (
                  <div key={l} style={{ background: c + '15', border: '1px solid ' + c + '44', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: c }}>{n}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Immediate blockers — CRITICAL findings */}
          {findings.filter(f => f.severity === 'CRITICAL').length > 0 && (
            <div style={{ background: '#e74c3c11', border: '1px solid #e74c3c55', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e74c3c', marginBottom: 10 }}>
                🚨 IMMEDIATE BLOCKERS — {findings.filter(f => f.severity === 'CRITICAL').length} CRITICAL FINDINGS
              </div>
              {findings.filter(f => f.severity === 'CRITICAL').map((f: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderTop: i > 0 ? '1px solid #e74c3c22' : 'none', fontSize: 13 }}>
                  <span style={{ color: '#e74c3c', fontWeight: 700, minWidth: 22 }}>{i+1}.</span>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{f.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 2 }}>{f.domain?.replace(/_/g,' ')} · {f.category?.replace(/_/g,' ')}</div>
                    {f.recommendation && <div style={{ color: '#e74c3c', fontSize: 12, marginTop: 4 }}>→ {f.recommendation}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Score improvement tips */}
          {(() => {
            const tips: string[] = []
            if (report.complianceScore < 60) tips.push('Compliance score is low — address EA principle violations to unlock significant score improvement')
            if (report.strategicScore < 60) tips.push('Strategic alignment is weak — map solution capabilities to Business Strategy goals explicitly')
            if ((extScores.securityScore || 0) < 50) tips.push('Security score is critical — resolve IAM and encryption findings before ARB approval')
            if (findings.filter((f:any) => f.severity === 'CRITICAL').length >= 5) tips.push('5+ CRITICAL findings — resolve at least 3 before re-run to move decision to CONDITIONAL')
            if (tips.length === 0 && report.overallScore >= 60) tips.push('Score is in acceptable range — address HIGH findings to move toward APPROVED status')
            return tips.length > 0 ? (
              <div style={{ background: '#3498db11', border: '1px solid #3498db33', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#3498db', marginBottom: 10 }}>💡 SCORE IMPROVEMENT TIPS</div>
                {tips.map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: '#3498db' }}>→</span>
                    <span style={{ color: 'var(--text)' }}>{t}</span>
                  </div>
                ))}
              </div>
            ) : null
          })()}

          {/* Executive Summary */}
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

          {/* Required Actions */}
          {report.requiredActions?.mandatory?.length > 0 && (
            <div style={{ background: '#e74c3c11', border: '1px solid #e74c3c44', borderRadius: 10, padding: 20, marginBottom: 12 }}>
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
      {tab === 'findings' && <FindingsTab findings={findings} />}

      {/* Domains Tab */}
      {tab === 'domains' && (
        <div>
          {/* Domain overview bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['Total Findings', findings.length, 'var(--text)'],
              ['Critical', findings.filter(f=>f.severity==='CRITICAL').length, '#e74c3c'],
              ['High', findings.filter(f=>f.severity==='HIGH').length, '#e67e22'],
            ].map(([l,v,c]:any) => (
              <div key={l} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
              </div>
            ))}
          </div>

          {Object.entries(report.domainSummaries || {}).filter(([k]) => k !== '_extendedScores').map(([domain, ds]: [string, any]) => {
            const domainFindings = findings.filter(f => f.domain === domain)
            const crit = domainFindings.filter(f => f.severity === 'CRITICAL').length
            const high = domainFindings.filter(f => f.severity === 'HIGH').length
            const med  = domainFindings.filter(f => f.severity === 'MEDIUM').length
            const low  = domainFindings.filter(f => f.severity === 'LOW').length
            const score = Math.round(ds.score || 0)
            const scoreColor = score >= 75 ? '#2ecc71' : score >= 60 ? '#f39c12' : '#e74c3c'
            return (
              <div key={domain} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{domain.replace(/_/g, ' ')}</div>
                    {ds.keyWeaknesses && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 2 }}>✗ {ds.keyWeaknesses}</div>}
                    {ds.keyStrengths && !ds.keyWeaknesses && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 2 }}>✓ {ds.keyStrengths}</div>}
                  </div>
                  <ScoreCircle score={score} label='' size={52} />
                </div>

                {/* Score bar */}
                <div style={{ height: 6, background: 'var(--navy-dark)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: score + '%', background: scoreColor, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>

                {/* Sub-scores */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6, marginBottom: 12 }}>
                  {[['Compliance', ds.complianceScore], ['Risk', ds.riskScore], ['Strategic', ds.strategicScore], ['Completeness', ds.completenessScore]].map(([l,v]:any) => (
                    <div key={l} style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '5px 8px', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: (v||0) >= 70 ? '#2ecc71' : (v||0) >= 55 ? '#f39c12' : '#e74c3c' }}>{Math.round(v||0)}</div>
                    </div>
                  ))}
                </div>

                {/* Finding severity badges */}
                {domainFindings.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center' }}>Findings:</span>
                    {crit > 0 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#e74c3c33', color: '#e74c3c' }}>{crit} CRITICAL</span>}
                    {high > 0 && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#e67e2233', color: '#e67e22' }}>{high} HIGH</span>}
                    {med > 0  && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#f39c1233', color: '#f39c12' }}>{med} MEDIUM</span>}
                    {low > 0  && <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#3498db33', color: '#3498db' }}>{low} LOW</span>}
                  </div>
                )}
                {domainFindings.length === 0 && <div style={{ fontSize: 12, color: '#2ecc71' }}>✓ No findings in this domain</div>}
              </div>
            )
          })}
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
          {(() => {
            const objectives = report.strategicAlignment?.objectives || []
            if (objectives.length === 0) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No strategic objectives assessed</div>
            // Group by strategy type
            const grouped: Record<string, any[]> = {}
            for (const obj of objectives) {
              const key = obj.strategyType || 'OTHER'
              if (!grouped[key]) grouped[key] = []
              grouped[key].push(obj)
            }
            return Object.entries(grouped).map(([stratType, objs]) => (
              <div key={stratType} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 10, padding: '6px 12px', background: 'var(--navy-mid)', borderRadius: 8 }}>
                  {stratType.replace(/_/g, ' ')}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>{objs.length} goal(s)</span>
                </div>
                {objs.map((obj: any, i: number) => (
                  <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{obj.objectiveName}</div>
                      <div style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, background: '#8baac822', color: '#8baac8' }}>{obj.alignmentStatus?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: obj.alignmentPercentage >= 75 ? '#2ecc71' : obj.alignmentPercentage >= 50 ? '#f39c12' : '#e74c3c', minWidth: 42, textAlign: 'right' }}>{obj.alignmentPercentage}%</div>
                    </div>
                    <div style={{ height: 4, background: 'var(--navy-dark)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: (obj.alignmentPercentage || 0) + '%', background: obj.alignmentPercentage >= 75 ? '#2ecc71' : obj.alignmentPercentage >= 50 ? '#f39c12' : '#e74c3c', borderRadius: 2 }} />
                    </div>
                    {obj.contributionDescription && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{obj.contributionDescription}</div>}
                    {obj.expectedValue && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>Value: {obj.expectedValue}</div>}
                    {obj.relatedKPIs?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>KPIs: {obj.relatedKPIs.join(', ')}</div>}
                  </div>
                ))}
              </div>
            ))
          })()}
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
                <div style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                background: item.complianceStatus === 'COMPLIANT' ? '#2ecc7122' : item.complianceStatus === 'NON_COMPLIANT' ? '#e74c3c22' : item.complianceStatus === 'REQUIRES_EXCEPTION' ? '#e67e2222' : '#8baac822',
                color: item.complianceStatus === 'COMPLIANT' ? '#2ecc71' : item.complianceStatus === 'NON_COMPLIANT' ? '#e74c3c' : item.complianceStatus === 'REQUIRES_EXCEPTION' ? '#e67e22' : '#8baac8'
              }}>{item.complianceStatus?.replace(/_/g, ' ')}</div>
              <div style={{ padding: '2px 6px', borderRadius: 6, fontSize: 10,
                background: item.category === 'TENANT_PRINCIPLE' ? '#e74c3c22' : item.category === 'TENANT_STANDARD' ? '#e67e2222' : '#3498db22',
                color: item.category === 'TENANT_PRINCIPLE' ? '#e74c3c' : item.category === 'TENANT_STANDARD' ? '#e67e22' : '#3498db',
                whiteSpace: 'nowrap'
              }}>{item.category?.replace(/_/g, ' ')}</div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{o.title || o.type?.replace(/_/g, ' ')}</div>
                {o.confidenceLevel && <div style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#8baac822', color: '#8baac8' }}>Confidence: {o.confidenceLevel}</div>}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>{o.description}</div>
              {o.existingAlternative && <div style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 6 }}>♻️ Reuse: {o.existingAlternative}</div>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                {o.estimatedSaving > 0 && <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '8px 12px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>One-time Saving</div><div style={{ fontSize: 15, fontWeight: 700, color: '#2ecc71' }}>SAR {o.estimatedSaving.toLocaleString()}</div></div>}
                {o.annualSaving > 0 && <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '8px 12px' }}><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Annual Saving</div><div style={{ fontSize: 15, fontWeight: 700, color: '#2ecc71' }}>SAR {o.annualSaving.toLocaleString()}</div></div>}
              </div>
              {o.savingRationale && <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 4 }}>📊 Basis: {o.savingRationale}</div>}
              {o.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>→ {o.recommendation}</div>}
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

