import React, { useEffect, useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'

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
  const { t } = useLang()
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
            }}>{t('gov.clear_filters')}</button>
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
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('gov.group_by')}</span>
        {(['domain','severity'] as const).map(g => (
          <button key={g} onClick={() => setGroupBy(g)} style={{
            padding: '3px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            border: '1px solid ' + (groupBy === g ? 'var(--accent)' : 'var(--navy-light)'),
            background: groupBy === g ? 'var(--accent)22' : 'transparent',
            color: groupBy === g ? 'var(--accent)' : 'var(--text-muted)',
          }}>{g === 'domain' ? t('gov.domain') : t('gov.severity')}</button>
        ))}
      </div>

      {/* Groups */}
      {Object.keys(groups).length === 0 && (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
          {findings.length === 0 ? 'No findings' : findings.length === 0 ? t('gov.no_findings') : 'No findings match the selected filters'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
            📄 Extracting document content via Docling — this may take 10-30 seconds for large files...
          </div>
          {['Extracting document content', 'Identifying missing artifacts', 'Checking completeness', 'Pulling repository context'].map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 12px', borderRadius: 6, background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> {s}
            </div>
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
  const location = useLocation()
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDecision, setFilterDecision] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [review, setReview] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'summary' | 'findings' | 'domains' | 'strategic' | 'compliance' | 'risk' | 'future' | 'financial'>('summary')
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

  const filteredReviews = reviews.filter(r => {
    if (filterStatus && r.status !== filterStatus) return false
    if (filterDecision && r.decision !== filterDecision) return false
    if (filterType && r.reviewType !== filterType) return false
    if (filterSearch && !r.title?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  const loadReviews = async () => {
    setLoading(true)
    try { const data = await api.get('/governance/reviews'); setReviews(data) }
    catch (e) { setError('Failed to load reviews') }
    finally { setLoading(false) }
  }

  // Handle deep-link from Reports page — auto-open specific review at specific tab
  useEffect(() => {
    const state = location.state as { reviewId?: string; tab?: string } | null
    if (!state?.reviewId || reviews.length === 0) return
    const target = reviews.find((r: any) => r.id === state.reviewId)
    if (target) {
      openReview(target).then(() => { if (state.tab) setTab(state.tab as any) })
      window.history.replaceState({}, '')
    }
  }, [location.state, reviews])

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
      // Upload files one by one — each triggers Docling extraction
      for (let i = 0; i < inputs.length; i++) {
        const inp = inputs[i]
        if (inp._file) {
          const fd = new FormData()
          fd.append('file', inp._file)
          fd.append('label', inp._file.name)
          // Show which file is being processed
          setError('Extracting: ' + inp._file.name + ' (' + (i+1) + '/' + inputs.length + ')')
          await api.postFile('/governance/reviews/' + r.id + '/inputs/file', fd).catch(() => {})
        }
      }
      setError('')
      setView('progress')
      // Poll for extracted metadata — Docling can take 10-30s for large files
      // Poll every 3 seconds for up to 60 seconds
      let attempts = 0
      const maxAttempts = 20
      const pollMeta = setInterval(async () => {
        attempts++
        try {
          const meta = await api.get('/governance/reviews/' + r.id + '/inputs/metadata')
          if (meta && Object.keys(meta).length > 0) {
            setExtractedMeta(meta)
            setShowMeta(true)
            clearInterval(pollMeta)
          }
        } catch { /* keep polling */ }
        if (attempts >= maxAttempts) clearInterval(pollMeta)
      }, 3000)
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
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <input
          value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
          placeholder='Search reviews...'
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'var(--navy-mid)', color: 'var(--text)', fontSize: 12, minWidth: 160 }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'var(--navy-mid)', color: 'var(--text)', fontSize: 12 }}>
          <option value=''>All Statuses</option>
          <option value='COMPLETED'>Completed</option>
          <option value='IN_PROGRESS'>In Progress</option>
          <option value='DRAFT'>Draft</option>
          <option value='CANCELLED'>Cancelled</option>
        </select>
        <select value={filterDecision} onChange={e => setFilterDecision(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'var(--navy-mid)', color: 'var(--text)', fontSize: 12 }}>
          <option value=''>All Decisions</option>
          <option value='APPROVED'>Approved</option>
          <option value='APPROVED_WITH_CONDITIONS'>Approved with Conditions</option>
          <option value='REQUIRES_CHANGES'>Requires Changes</option>
          <option value='REJECTED'>Rejected</option>
          <option value='PENDING'>Pending</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'var(--navy-mid)', color: 'var(--text)', fontSize: 12 }}>
          <option value=''>All Types</option>
          <option value='HLD_REVIEW'>HLD Review</option>
          <option value='LLD_REVIEW'>LLD Review</option>
        </select>
        {(filterStatus || filterDecision || filterType || filterSearch) && (
          <button onClick={() => { setFilterStatus(''); setFilterDecision(''); setFilterType(''); setFilterSearch('') }}
            style={{ padding: '5px 10px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'transparent', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {filteredReviews.length}/{reviews.length} reviews
        </span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {filteredReviews.map(r => (
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
      {report && <ReportView review={review} report={report} findings={findings} tab={tab} setTab={setTab} />}
      {!report && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Report not available yet</div>}
    </div>
  )

  return null
}

function ReportView({ review, report, findings, tab, setTab }: { review: any, report: any, findings: any[], tab: string, setTab: (t: any) => void }) {
  const extScores = (report.domainSummaries?._extendedScores) || {}
  const archQualityScore = extScores.architectureQualityScore || 0
  const secScore = extScores.securityScore || 0
  const futureScore = extScores.futureStateScore || 0
  const finScore = extScores.financialScore || 0
  const confScore = extScores.confidenceScore || report.confidenceScore || 0

  const { t, isAR, resolveText } = useLang()
  const tabs = [
    { key: 'summary', label: t('gov.summary') },
    { key: 'findings', label: t('gov.findings') },
    { key: 'domains', label: t('gov.domains') },
    { key: 'strategic', label: t('gov.strategic') },
    { key: 'compliance', label: t('gov.compliance') },
    { key: 'risk', label: t('gov.risk_register') },
    { key: 'future', label: t('gov.future_state') },
    { key: 'financial', label: t('gov.financial') },
  ]

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
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
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{isAR ? resolveText(report.decisionRationale) : report.decisionRationale}</div>
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
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>{isAR ? resolveText(f.title) : f.title}</div>
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
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>{t('gov.executive_summary')}</div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{isAR ? resolveText(report.executiveSummary) : report.executiveSummary}</div>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e74c3c', marginBottom: 12 }}>{t('gov.mandatory_actions')} ({report.requiredActions.mandatory.length})</div>
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
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f39c12', marginBottom: 12 }}>{t('gov.recommended_actions')} ({report.requiredActions.recommended.length})</div>
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

          {Object.entries(report.domainSummaries || {}).filter(([k, v]) => !k.startsWith('_') && typeof v === 'object' && v !== null && 'score' in v).map(([domain, ds]: [string, any]) => {
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
                    {ds.keyWeaknesses && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 2 }}>✗ {isAR ? resolveText(ds.keyWeaknesses) : ds.keyWeaknesses}</div>}
                    {ds.keyStrengths && !ds.keyWeaknesses && <div style={{ fontSize: 11, color: '#2ecc71', marginTop: 2 }}>✓ {isAR ? resolveText(ds.keyStrengths) : ds.keyStrengths}</div>}
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
      {tab === 'strategic' && (() => {
        const objectives = report.strategicAlignment?.objectives || []
        // Compute weighted strategic alignment: Business(40%) > DT(35%) > EA(25%)
        const STRAT_W: Record<string,number> = { BUSINESS_STRATEGY:0.40, DT_STRATEGY:0.35, EA_STRATEGY:0.25 }
        const rawPct = report.strategicAlignment?.overallAlignmentPercentage || 0
        let weightedSum = 0, totalW = 0
        for (const [sType, sobjs] of Object.entries(grouped) as [string, any[]][]) {
          const w = STRAT_W[sType] || 0.10
          const avg = sobjs.length ? sobjs.reduce((s,o)=>s+(o.alignmentPercentage||0),0)/sobjs.length : 0
          weightedSum += avg * w; totalW += w
        }
        const overallPct = totalW > 0 ? Math.round(weightedSum / totalW) : rawPct
        const overallColor = overallPct >= 75 ? '#2ecc71' : overallPct >= 50 ? '#f39c12' : '#e74c3c'

        // Strategy type weights and colors
        const STRAT_META: Record<string, { weight: number; label: string; color: string }> = {
          BUSINESS_STRATEGY: { weight: 40, label: 'Business Strategy', color: '#e74c3c' },
          DT_STRATEGY:       { weight: 35, label: 'Digital Transformation', color: '#9b59b6' },
          EA_STRATEGY:       { weight: 25, label: 'EA Strategy', color: '#3498db' },
          IT_STRATEGY:       { weight: 0,  label: 'IT Strategy', color: '#1abc9c' },
          DATA_STRATEGY:     { weight: 0,  label: 'Data Strategy', color: '#e67e22' },
          SECURITY_STRATEGY: { weight: 0,  label: 'Security Strategy', color: '#e74c3c' },
          VISION_2030:       { weight: 0,  label: 'Vision 2030', color: '#f39c12' },
        }
        const STATUS_COLOR: Record<string, string> = {
          FULLY_ALIGNED: '#2ecc71', PARTIALLY_ALIGNED: '#f39c12',
          WEAKLY_ALIGNED: '#e67e22', NOT_ALIGNED: '#e74c3c', NOT_APPLICABLE: '#8baac8'
        }
        const STATUS_ICON: Record<string, string> = {
          FULLY_ALIGNED: '✅', PARTIALLY_ALIGNED: '⚠️', WEAKLY_ALIGNED: '🔶', NOT_ALIGNED: '❌', NOT_APPLICABLE: '—'
        }

        // Group by strategy type — sorted by weight desc
        const grouped: Record<string, any[]> = {}
        for (const obj of objectives) { const k = obj.strategyType || 'OTHER'; if (!grouped[k]) grouped[k]=[]; grouped[k].push(obj) }
        const sortedTypes = Object.keys(grouped).sort((a,b) => (STRAT_META[b]?.weight||0) - (STRAT_META[a]?.weight||0))

        return (
          <div>
            {/* Overall alignment header */}
            <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 72 }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: overallColor }}>{overallPct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Overall Alignment</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ height: 10, background: 'var(--navy-dark)', borderRadius: 5, overflow: 'hidden', marginBottom: 8 }}>
                    <div style={{ height: '100%', width: overallPct + '%', background: overallColor, borderRadius: 5, transition: 'width 0.5s' }} />
                  </div>
                  {/* Per-strategy weight summary */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {sortedTypes.filter(t => STRAT_META[t]?.weight > 0).map(t => {
                      const meta = STRAT_META[t]
                      const objs = grouped[t]
                      const avg = objs.length ? Math.round(objs.reduce((s:number,o:any)=>s+(o.alignmentPercentage||0),0)/objs.length) : 0
                      const c = avg >= 75 ? '#2ecc71' : avg >= 50 ? '#f39c12' : '#e74c3c'
                      return (
                        <div key={t} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: '1px solid ' + meta.color + '44', background: meta.color + '15' }}>
                          <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{meta.weight}% weight</span>
                          <span style={{ color: c, fontWeight: 700, marginLeft: 6 }}>{avg}% aligned</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {objectives.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No strategic objectives assessed</div>}

            {/* Per-strategy groups */}
            {sortedTypes.map(stratType => {
              const meta = STRAT_META[stratType]
              const objs = grouped[stratType]
              const avgAlign = Math.round(objs.reduce((s:number,o:any)=>s+(o.alignmentPercentage||0),0)/objs.length)
              const avgColor = avgAlign >= 75 ? '#2ecc71' : avgAlign >= 50 ? '#f39c12' : '#e74c3c'
              const fullyAligned = objs.filter((o:any) => o.alignmentStatus === 'FULLY_ALIGNED').length
              const notAligned = objs.filter((o:any) => o.alignmentStatus === 'NOT_ALIGNED').length

              return (
                <div key={stratType} style={{ marginBottom: 20 }}>
                  {/* Strategy header */}
                  <div style={{ background: (meta?.color || '#8baac8') + '18', border: '1px solid ' + (meta?.color || '#8baac8') + '44', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: meta?.color || '#8baac8' }}>
                          {meta?.label || stratType.replace(/_/g,' ')}
                          {meta?.weight > 0 && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>[{meta.weight}% weight]</span>}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {objs.length} goals · {fullyAligned} fully aligned · {notAligned} not aligned
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', minWidth: 52 }}>
                        <div style={{ fontSize: 22, fontWeight: 700, color: avgColor }}>{avgAlign}%</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>avg</div>
                      </div>
                    </div>
                    {/* Mini alignment bar */}
                    <div style={{ height: 4, background: 'var(--navy-dark)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: avgAlign + '%', background: avgColor, borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Objective cards */}
                  {objs.map((obj: any, i: number) => {
                    const statusColor = STATUS_COLOR[obj.alignmentStatus] || '#8baac8'
                    const pct = obj.alignmentPercentage || 0
                    return (
                      <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid ' + statusColor + '33', borderRadius: 10, padding: 14, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{ fontSize: 16, marginTop: 1 }}>{STATUS_ICON[obj.alignmentStatus] || '•'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{isAR ? resolveText(obj.objectiveName) : obj.objectiveName}</div>
                              <div style={{ fontSize: 18, fontWeight: 700, color: pct >= 75 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c', minWidth: 40, textAlign: 'right' }}>{pct}%</div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 3, background: 'var(--navy-dark)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: pct + '%', background: pct >= 75 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c', borderRadius: 2 }} />
                            </div>
                            {obj.contributionDescription && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{isAR ? resolveText(obj.contributionDescription) : obj.contributionDescription}</div>}
                            {obj.expectedValue && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>💡 {isAR ? resolveText(obj.expectedValue) : obj.expectedValue}</div>}
                            {obj.evidence && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>📋 {obj.evidence}</div>}
                            {obj.relatedKPIs?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📊 KPIs: {obj.relatedKPIs.join(', ')}</div>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Compliance Tab */}
      {tab === 'compliance' && (() => {
        const items = report.complianceMatrix?.items || []
        const statuses = ['COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT','REQUIRES_EXCEPTION','NOT_APPLICABLE']
        const statusColor: Record<string,string> = { COMPLIANT:'#2ecc71', PARTIALLY_COMPLIANT:'#f39c12', NON_COMPLIANT:'#e74c3c', REQUIRES_EXCEPTION:'#e67e22', NOT_APPLICABLE:'#8baac8' }
        const statusLabel: Record<string,string> = { COMPLIANT:'✓ Compliant', PARTIALLY_COMPLIANT:'⚠ Partial', NON_COMPLIANT:'✗ Non-Compliant', REQUIRES_EXCEPTION:'⚡ Exception', NOT_APPLICABLE:'— N/A' }
        const catColor: Record<string,string> = { TENANT_PRINCIPLE:'#e74c3c', TENANT_STANDARD:'#e67e22', TECHNOLOGY_CATALOG:'#9b59b6', NORA_STANDARD:'#3498db', NCA_STANDARD:'#1abc9c' }

        // Group items by category
        const cats = ['TENANT_PRINCIPLE','TENANT_STANDARD','TECHNOLOGY_CATALOG','NORA_STANDARD','NCA_STANDARD','GENERAL_BEST_PRACTICE']
        const grouped: Record<string,any[]> = {}
        for (const item of items) { const c = item.category || 'OTHER'; if (!grouped[c]) grouped[c]=[]; grouped[c].push(item) }

        const countBy = (status: string) => items.filter((i:any) => i.complianceStatus === status).length
        const total = items.length

        return (
          <div>
            {/* Visual status breakdown */}
            {total > 0 && (
              <div style={{ marginBottom: 20 }}>
                {/* Status bar */}
                <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                  {statuses.map(s => {
                    const pct = (countBy(s) / total) * 100
                    return pct > 0 ? <div key={s} style={{ width: pct + '%', background: statusColor[s], title: s }} /> : null
                  })}
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {statuses.map(s => {
                    const n = countBy(s)
                    if (n === 0) return null
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: statusColor[s] }} />
                        <span style={{ fontSize: 12, color: statusColor[s], fontWeight: 600 }}>{n}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{statusLabel[s]}</span>
                      </div>
                    )
                  })}
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    {total} assessed · <span style={{ color: report.complianceMatrix?.complianceRate >= 70 ? '#2ecc71' : '#f39c12', fontWeight: 600 }}>{report.complianceMatrix?.complianceRate || 0}% compliance rate</span>
                  </span>
                </div>

                {/* Category breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginTop: 12 }}>
                  {cats.filter(c => grouped[c]?.length > 0).map(c => {
                    const citems = grouped[c] || []
                    const nonComp = citems.filter((i:any) => i.complianceStatus === 'NON_COMPLIANT').length
                    const comp = citems.filter((i:any) => i.complianceStatus === 'COMPLIANT').length
                    return (
                      <div key={c} style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, color: catColor[c] || 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{c.replace(/_/g,' ')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {comp > 0 && <span style={{ color: '#2ecc71' }}>✓{comp} </span>}
                          {nonComp > 0 && <span style={{ color: '#e74c3c' }}>✗{nonComp} </span>}
                          {citems.length - comp - nonComp > 0 && <span>·{citems.length - comp - nonComp}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Items grouped by category */}
            {cats.filter(c => grouped[c]?.length > 0).map(cat => (
              <div key={cat} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: catColor[cat] || 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 3, height: 14, background: catColor[cat] || '#8baac8', borderRadius: 2 }} />
                  {cat.replace(/_/g,' ')}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({grouped[cat].length})</span>
                </div>
                {grouped[cat].map((item: any, i: number) => (
                  <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid ' + (item.complianceStatus === 'NON_COMPLIANT' ? '#e74c3c33' : 'var(--navy-light)'), borderRadius: 10, padding: 12, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 90, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, textAlign: 'center', marginTop: 1,
                        background: (statusColor[item.complianceStatus] || '#8baac8') + '22',
                        color: statusColor[item.complianceStatus] || '#8baac8'
                      }}>{statusLabel[item.complianceStatus] || item.complianceStatus}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{item.principleOrStandard}</div>
                        {item.evidence && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>📋 {item.evidence}</div>}
                        {item.gap && <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4 }}>⚠ {isAR ? resolveText(item.gap) : item.gap}</div>}
                        {item.recommendation && <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>→ {isAR ? resolveText(item.recommendation) : item.recommendation}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}

            {total === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No compliance matrix available</div>}
          </div>
        )
      })()}

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
      {tab === 'future' && (() => {
        const fs = report.futureStateAlignment
        if (!fs) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Future-state alignment not available</div>
        const pct = fs.alignmentPercentage || 0
        const pctColor = pct >= 75 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c'
        const AREA_STATUS_COLOR: Record<string,string> = {
          ALIGNED: '#2ecc71', PARTIALLY_ALIGNED: '#f39c12', GAP_IDENTIFIED: '#e67e22',
          NOT_ALIGNED: '#e74c3c', FUTURE_REQUIREMENT: '#3498db', NOT_APPLICABLE: '#8baac8'
        }
        const AREA_ICON: Record<string,string> = {
          ALIGNED: '✅', PARTIALLY_ALIGNED: '⚠️', GAP_IDENTIFIED: '🔶',
          NOT_ALIGNED: '❌', FUTURE_REQUIREMENT: '🔵', NOT_APPLICABLE: '—'
        }
        const areas = fs.alignmentAreas || []
        const alignedCount = areas.filter((a:any) => a.status === 'ALIGNED').length
        const gapCount = areas.filter((a:any) => ['GAP_IDENTIFIED','NOT_ALIGNED'].includes(a.status)).length
        const futureReqs = areas.filter((a:any) => a.status === 'FUTURE_REQUIREMENT').length

        return (
          <div>
            {/* Header */}
            <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 10 }}>
                <div style={{ textAlign: 'center', minWidth: 72 }}>
                  <div style={{ fontSize: 36, fontWeight: 700, color: pctColor }}>{pct}%</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{fs.overallAlignment?.replace(/_/g,' ') || 'Alignment'}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, lineHeight: 1.5 }}>{isAR ? resolveText(fs.summary) : fs.summary}</div>
                  <div style={{ height: 8, background: 'var(--navy-dark)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: pct + '%', background: pctColor, borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                </div>
              </div>
              {/* Area status summary */}
              {areas.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                  {alignedCount > 0 && <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: '#2ecc7122', color: '#2ecc71' }}>✅ {alignedCount} Aligned</span>}
                  {gapCount > 0 && <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: '#e74c3c22', color: '#e74c3c' }}>❌ {gapCount} Gaps</span>}
                  {futureReqs > 0 && <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: '#3498db22', color: '#3498db' }}>🔵 {futureReqs} Future Requirements</span>}
                </div>
              )}
            </div>

            {/* Alignment areas — grouped by status */}
            {['NOT_ALIGNED','GAP_IDENTIFIED','PARTIALLY_ALIGNED','FUTURE_REQUIREMENT','ALIGNED','NOT_APPLICABLE']
              .filter(s => areas.some((a:any) => a.status === s))
              .map(status => {
                const statusAreas = areas.filter((a:any) => a.status === status)
                const c = AREA_STATUS_COLOR[status] || '#8baac8'
                return (
                  <div key={status} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{AREA_ICON[status]}</span>
                      <span>{status.replace(/_/g,' ')}</span>
                      <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({statusAreas.length})</span>
                    </div>
                    {statusAreas.map((area: any, i: number) => (
                      <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid ' + c + '33', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{isAR ? resolveText(area.area) : area.area}</div>
                        {area.currentState && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>📍 Current: {isAR ? resolveText(area.currentState) : area.currentState}</div>}
                        {area.targetState && <div style={{ fontSize: 12, color: '#3498db', marginBottom: 4 }}>🎯 Target: {isAR ? resolveText(area.targetState) : area.targetState}</div>}
                        {area.gap && <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 4 }}>⚠ Gap: {isAR ? resolveText(area.gap) : area.gap}</div>}
                        {area.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>→ {isAR ? resolveText(area.recommendation) : area.recommendation}</div>}
                      </div>
                    ))}
                  </div>
                )
              })
            }

            {/* Key gaps */}
            {fs.keyGaps?.length > 0 && (
              <div style={{ background: '#e74c3c11', border: '1px solid #e74c3c33', borderRadius: 10, padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e74c3c', marginBottom: 10 }}>🚨 KEY GAPS TO ADDRESS</div>
                {fs.keyGaps.map((g: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: '#e74c3c', minWidth: 20, fontWeight: 700 }}>{i+1}.</span>
                    <span style={{ color: 'var(--text-muted)' }}>{isAR ? resolveText(g) : g}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommendations roadmap */}
            {fs.recommendations?.length > 0 && (
              <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 12 }}>🗺 ROADMAP TO TARGET STATE</div>
                {fs.recommendations.map((r: string, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 24, height: 24, borderRadius: '50%', background: 'var(--accent)22', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{i+1}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingTop: 3, lineHeight: 1.5 }}>{isAR ? resolveText(r) : r}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Financial Tab */}
      {tab === 'financial' && (() => {
        const fin = report.financialOpportunities || {}
        const opps = fin.opportunities || []
        const totalAnnual = fin.totalAnnualSaving || opps.reduce((s:number,o:any)=>s+(o.annualSaving||0),0)
        const totalOneTime = fin.totalEstimatedSaving || opps.reduce((s:number,o:any)=>s+(o.estimatedSaving||0),0)
        const totalSaving = totalAnnual + totalOneTime

        const TYPE_COLOR: Record<string,string> = {
          REUSE_OPPORTUNITY: '#2ecc71', LICENSE_OPTIMIZATION: '#3498db',
          CLOUD_OPTIMIZATION: '#9b59b6', VENDOR_CONSOLIDATION: '#e67e22',
          TECHNICAL_DEBT_REDUCTION: '#f39c12', PROCESS_AUTOMATION: '#1abc9c',
        }
        const TYPE_ICON: Record<string,string> = {
          REUSE_OPPORTUNITY: '♻️', LICENSE_OPTIMIZATION: '📋',
          CLOUD_OPTIMIZATION: '☁️', VENDOR_CONSOLIDATION: '🤝',
          TECHNICAL_DEBT_REDUCTION: '🔧', PROCESS_AUTOMATION: '⚙️',
        }
        const CONF_COLOR: Record<string,string> = { HIGH:'#2ecc71', MEDIUM:'#f39c12', LOW:'#e74c3c' }

        return (
          <div>
            {/* Total savings header */}
            {totalSaving > 0 ? (
              <div style={{ background: '#2ecc7118', border: '1px solid #2ecc7144', borderRadius: 12, padding: 20, marginBottom: 16 }}>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: 1, marginBottom: 4 }}>TOTAL FINANCIAL OPPORTUNITY</div>
                  <div style={{ fontSize: 36, fontWeight: 700, color: '#2ecc71' }}>
                    SAR {totalSaving.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{opps.length} opportunities identified</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {totalAnnual > 0 && (
                    <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>💰 Annual Savings</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#2ecc71' }}>SAR {totalAnnual.toLocaleString()}</div>
                    </div>
                  )}
                  {totalOneTime > 0 && (
                    <div style={{ background: 'var(--navy-dark)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>🏦 One-time Saving</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#3498db' }}>SAR {totalOneTime.toLocaleString()}</div>
                    </div>
                  )}
                </div>
                {/* Type breakdown */}
                {opps.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                    {Object.entries(
                      opps.reduce((acc:any,o:any)=>{ const t=o.type||'OTHER'; acc[t]=(acc[t]||0)+(o.annualSaving||o.estimatedSaving||0); return acc },{})
                    ).sort((a:any,b:any)=>b[1]-a[1]).map(([type,val]:any) => (
                      <div key={type} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: (TYPE_COLOR[type]||'#8baac8')+'22', color: TYPE_COLOR[type]||'#8baac8' }}>
                        {TYPE_ICON[type]||'•'} {type.replace(/_/g,' ')}: SAR {val.toLocaleString()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No financial opportunities detected</div>
            )}

            {/* Opportunity cards — sorted by saving desc */}
            {[...opps].sort((a:any,b:any)=>((b.annualSaving||0)+(b.estimatedSaving||0))-((a.annualSaving||0)+(a.estimatedSaving||0))).map((o: any, i: number) => {
              const oColor = TYPE_COLOR[o.type] || '#8baac8'
              const oIcon = TYPE_ICON[o.type] || '💡'
              const oTotal = (o.annualSaving||0) + (o.estimatedSaving||0)
              return (
                <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid ' + oColor + '33', borderRadius: 10, padding: 16, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 20, minWidth: 28 }}>{oIcon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>{isAR ? resolveText(o.title||o.type?.replace(/_/g,' ')) : (o.title||o.type?.replace(/_/g,' '))}</div>
                        {o.confidenceLevel && (
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: (CONF_COLOR[o.confidenceLevel]||'#8baac8')+'22', color: CONF_COLOR[o.confidenceLevel]||'#8baac8', fontWeight: 600 }}>
                            {o.confidenceLevel} confidence
                          </span>
                        )}
                        {oTotal > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: '#2ecc71', marginLeft: 'auto' }}>SAR {oTotal.toLocaleString()}</span>}
                      </div>
                      {o.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{isAR ? resolveText(o.description) : o.description}</div>}
                    </div>
                  </div>

                  {o.existingAlternative && (
                    <div style={{ background: '#2ecc7115', border: '1px solid #2ecc7133', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#2ecc71' }}>
                      ♻️ Reuse existing: {isAR ? resolveText(o.existingAlternative) : o.existingAlternative}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: o.estimatedSaving > 0 && o.annualSaving > 0 ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                    {o.estimatedSaving > 0 && (
                      <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>One-time Saving</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#3498db' }}>SAR {o.estimatedSaving.toLocaleString()}</div>
                      </div>
                    )}
                    {o.annualSaving > 0 && (
                      <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '8px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Annual Saving</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#2ecc71' }}>SAR {o.annualSaving.toLocaleString()}</div>
                      </div>
                    )}
                  </div>

                  {o.savingRationale && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: 6 }}>📊 {isAR ? resolveText(o.savingRationale) : o.savingRationale}</div>}
                  {o.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>→ {isAR ? resolveText(o.recommendation) : o.recommendation}</div>}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}


