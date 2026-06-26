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
  {
    value: 'ADVISORY', label: 'Advisory', icon: '💡', border: '#3498db',
    description: 'Lightweight guidance for early-stage exploration.',
    details: [
      'Constructive tone — findings are suggestions, not blockers',
      'Lower scoring penalties — focus on direction not compliance',
      'Ideal for: concept proposals, feasibility studies, early HLDs',
      'Decision outcome: Guidance only — no formal approval required',
    ],
  },
  {
    value: 'STANDARD', label: 'Standard', icon: '⚖️', border: '#2ecc71',
    description: 'Balanced review covering all domains. Default for most HLD reviews.',
    details: [
      'Full domain coverage across all 6 NORA architecture domains',
      'Normal compliance thresholds and scoring penalties',
      'Ideal for: standard HLD/LLD reviews, project approvals',
      'Decision outcome: APPROVED / APPROVED WITH CONDITIONS / REQUIRES CHANGES',
    ],
  },
  {
    value: 'STRICT', label: 'Strict', icon: '🔒', border: '#e67e22',
    description: 'Rigorous analysis with elevated thresholds. For high-impact solutions.',
    details: [
      'Higher scoring penalties — MEDIUM findings also penalize score',
      'Full EA principle enforcement — every deviation flagged',
      'Ideal for: critical systems, cross-domain integrations, large budgets',
      'Decision outcome: Formal ARB approval required before proceeding',
    ],
  },
  {
    value: 'EXECUTIVE', label: 'Executive', icon: '🏛️', border: '#e74c3c',
    description: 'Board-level scrutiny with maximum strategic and financial focus.',
    details: [
      'Deepest assessment — strategic, financial, and risk dimensions weighted highest',
      'Every finding includes business impact and SAR financial implications',
      'Ideal for: strategic platforms, Vision 2030 initiatives, enterprise-wide systems',
      'Decision outcome: Executive committee sign-off required',
    ],
  },
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

function DomainsFindingsTab({ findings, report, isAR, resolveText, reviewId, onFindingUpdate, onFindingDelete }: { findings: any[], report: any, isAR: boolean, resolveText: (s: string) => string, reviewId?: string, onFindingUpdate?: (id: string, data: any) => void, onFindingDelete?: (id: string) => void }) {
  const { t } = useLang()
  const [filterSev, setFilterSev] = React.useState<string[]>([])
  // collapsed state: null = all expanded by default
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({})

  const toggleSev = (s: string) => setFilterSev(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])
  const toggleGroup = (g: string) => setCollapsed(p => ({ ...p, [g]: !p[g] }))

  // Filter findings — never collapse groups, just filter their contents
  const filteredFindings = findings.filter(f => {
    if (filterSev.length > 0 && !filterSev.includes(f.severity)) return false
    return true
  })

  // Build domain groups from domainSummaries (to preserve score data) + findings
  const domainEntries = Object.entries(report.domainSummaries || {})
    .filter(([k, v]) => !k.startsWith('_') && typeof v === 'object' && v !== null && 'score' in (v as any))

  const sevCount = (sev: string) => findings.filter(f => f.severity === sev).length

  return (
    <div>
      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 }}>
        {[['Total', findings.length, 'var(--text)'], ['Critical', sevCount('CRITICAL'), '#e74c3c'], ['High', sevCount('HIGH'), '#e67e22'], ['Medium', sevCount('MEDIUM'), '#f39c12'], ['Low', sevCount('LOW'), '#3498db']].map(([l,v,c]:any) => (
          <div key={l} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Severity filter — filters findings within groups, groups stay expanded */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(sev => {
          const n = sevCount(sev)
          if (n === 0) return null
          const active = filterSev.includes(sev)
          return (
            <button key={sev} onClick={() => toggleSev(sev)} style={{
              padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + SEV_COLOR[sev] + (active ? '' : '55'),
              background: active ? SEV_COLOR[sev] + '33' : 'transparent',
              color: SEV_COLOR[sev]
            }}>{n} {sev}</button>
          )
        })}
        {filterSev.length > 0 && (
          <button onClick={() => setFilterSev([])} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>✕ Clear</button>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filteredFindings.length}/{findings.length} findings</span>
      </div>

      {/* Domain groups */}
      {domainEntries.map(([domain, ds]: [string, any]) => {
        const domainFindings = filteredFindings.filter(f => f.domain === domain)
        const allDomainFindings = findings.filter(f => f.domain === domain)
        const score = Math.round(ds.score || 0)
        const scoreColor = score >= 75 ? '#2ecc71' : score >= 60 ? '#f39c12' : '#e74c3c'
        const isCollapsed = collapsed[domain]
        const crit = allDomainFindings.filter(f => f.severity === 'CRITICAL').length
        const high = allDomainFindings.filter(f => f.severity === 'HIGH').length
        const med  = allDomainFindings.filter(f => f.severity === 'MEDIUM').length
        const low  = allDomainFindings.filter(f => f.severity === 'LOW').length

        return (
          <div key={domain} style={{ marginBottom: 10, border: '1px solid var(--navy-light)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Domain header — clickable to collapse */}
            <div onClick={() => toggleGroup(domain)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--navy-mid)', cursor: 'pointer', userSelect: 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{DOMAIN_LABEL[domain] || domain.replace(/_/g,' ')}</div>
                {ds.keyWeaknesses && <div style={{ fontSize: 11, color: '#e74c3c' }}>✗ {isAR ? resolveText(ds.keyWeaknesses) : ds.keyWeaknesses}</div>}
                {ds.keyStrengths && !ds.keyWeaknesses && <div style={{ fontSize: 11, color: '#2ecc71' }}>✓ {isAR ? resolveText(ds.keyStrengths) : ds.keyStrengths}</div>}
              </div>
              {/* Sub-scores */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[['C', ds.complianceScore], ['R', ds.riskScore], ['S', ds.strategicScore]].map(([l,v]:any) => (
                  <div key={l} style={{ textAlign: 'center', minWidth: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: (v||0) >= 70 ? '#2ecc71' : (v||0) >= 55 ? '#f39c12' : '#e74c3c' }}>{Math.round(v||0)}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{l}</div>
                  </div>
                ))}
              </div>
              {/* Score circle */}
              <div style={{ textAlign: 'center', minWidth: 44 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid ' + scoreColor, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{score}</span>
                </div>
              </div>
              {/* Severity badges */}
              <div style={{ display: 'flex', gap: 4 }}>
                {crit > 0 && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#e74c3c33', color: '#e74c3c' }}>{crit}C</span>}
                {high > 0 && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#e67e2233', color: '#e67e22' }}>{high}H</span>}
                {med  > 0 && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#f39c1233', color: '#f39c12' }}>{med}M</span>}
                {low  > 0 && <span style={{ padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700, background: '#3498db33', color: '#3498db' }}>{low}L</span>}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{isCollapsed ? '▶' : '▼'}</span>
            </div>

            {!isCollapsed && (
              <div style={{ padding: '10px 12px 6px' }}>
                {/* Score bar */}
                <div style={{ height: 4, background: 'var(--navy-dark)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: score + '%', background: scoreColor, borderRadius: 2, transition: 'width 0.5s' }} />
                </div>

                {/* Filtered findings for this domain */}
                {domainFindings.length === 0 && allDomainFindings.length === 0 && (
                  <div style={{ fontSize: 12, color: '#2ecc71', padding: '6px 0 4px' }}>✓ No findings in this domain</div>
                )}
                {domainFindings.length === 0 && allDomainFindings.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0 4px', fontStyle: 'italic' }}>No findings match the active severity filter</div>
                )}
                {domainFindings.map((f, i) => <FindingCard key={i} f={f} reviewId={reviewId} onUpdate={onFindingUpdate} onDelete={onFindingDelete} />)}
              </div>
            )}
          </div>
        )
      })}

      {/* Findings with no domain match */}
      {(() => {
        const domainKeys = domainEntries.map(([k]) => k)
        const orphans = filteredFindings.filter(f => !domainKeys.includes(f.domain))
        if (orphans.length === 0) return null
        return (
          <div style={{ marginBottom: 10, border: '1px solid var(--navy-light)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 16px', background: 'var(--navy-mid)', fontSize: 13, fontWeight: 600 }}>⚙️ General / Other</div>
            <div style={{ padding: '8px 12px 4px' }}>
              {orphans.map((f, i) => <FindingCard key={i} f={f} reviewId={reviewId} onUpdate={onFindingUpdate} onDelete={onFindingDelete} />)}
            </div>
          </div>
        )
      })()}
    </div>
  )
}


function FindingCard({ f, reviewId, onUpdate, onDelete, onRescore }: { f: any; reviewId?: string; onUpdate?: (id: string, data: any) => void; onDelete?: (id: string) => void; onRescore?: () => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const startEdit = (e: React.MouseEvent) => { e.stopPropagation(); setDraft({ title: f.title, description: f.description, recommendation: f.recommendation, severity: f.severity, businessImpact: f.businessImpact || '', technicalImpact: f.technicalImpact || '' }); setEditing(true); setOpen(true) }

  const save = async () => {
    if (!reviewId || !onUpdate) return
    setSaving(true)
    try {
      const token = localStorage.getItem('ea_token') || ''
      const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
      await fetch(`${apiUrl}/governance/reviews/${reviewId}/findings/${f.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(draft),
      })
      onUpdate(f.id, draft)
      setEditing(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Remove this finding from the review?')) return
    if (!reviewId || !onDelete) return
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl}/governance/reviews/${reviewId}/findings/${f.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: 'REJECTED' }),
    })
    onDelete(f.id)
    if (onRescore) onRescore()
  }

  const fieldStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'var(--navy-dark)', color: 'var(--text)', fontSize: 12, marginBottom: 8, boxSizing: 'border-box' }

  return (
    <div style={{ border: '1px solid ' + (f.status === 'REJECTED' ? '#e74c3c33' : 'var(--navy-mid)'), borderRadius: 8, marginBottom: 8, overflow: 'hidden', opacity: f.status === 'REJECTED' ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: 'var(--navy-mid)' }} onClick={() => !editing && setOpen(o => !o)}>
        <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: SEV_COLOR[f.severity] + '33', color: SEV_COLOR[f.severity] }}>{f.severity}</span>
        <span style={{ fontSize: 13, flex: 1, color: 'var(--text)', textDecoration: f.status === 'REJECTED' ? 'line-through' : 'none' }}>{f.title}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 4 }}>{f.category?.replace(/_/g, ' ')}</span>
        {reviewId && !editing && (
          <>
            <button onClick={startEdit} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, border: '1px solid var(--accent)44', background: 'none', color: 'var(--accent)', cursor: 'pointer' }}>✏</button>
            <button onClick={handleDelete} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, border: '1px solid #e74c3c44', background: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕</button>
          </>
        )}
        {!editing && <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{open ? '▲' : '▼'}</span>}
      </div>
      {open && !editing && (
        <div style={{ padding: '12px 14px', fontSize: 13, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 8 }}><span style={{ color: 'var(--text-muted)' }}>Description: </span>{f.description}</div>
          <div style={{ marginBottom: 8, color: 'var(--accent)' }}><span style={{ color: 'var(--text-muted)' }}>Recommendation: </span>{f.recommendation}</div>
          {f.businessImpact && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Business Impact: </span>{f.businessImpact}</div>}
          {f.technicalImpact && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Technical Impact: </span>{f.technicalImpact}</div>}
          {f.relatedPrinciple && <div style={{ marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Principle: </span>{f.relatedPrinciple}</div>}
          {f.relatedStandard && <div><span style={{ color: 'var(--text-muted)' }}>Standard: </span>{f.relatedStandard}</div>}
        </div>
      )}
      {editing && (
        <div style={{ padding: '12px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Title</div>
              <input value={draft.title || ''} onChange={e => setDraft((d: any) => ({...d, title: e.target.value}))} style={fieldStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Severity</div>
              <select value={draft.severity || ''} onChange={e => setDraft((d: any) => ({...d, severity: e.target.value}))} style={fieldStyle}>
                <option value='CRITICAL'>CRITICAL</option>
                <option value='HIGH'>HIGH</option>
                <option value='MEDIUM'>MEDIUM</option>
                <option value='LOW'>LOW</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
          <textarea value={draft.description || ''} onChange={e => setDraft((d: any) => ({...d, description: e.target.value}))} style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Recommendation</div>
          <textarea value={draft.recommendation || ''} onChange={e => setDraft((d: any) => ({...d, recommendation: e.target.value}))} style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button onClick={save} disabled={saving} style={{ padding: '5px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'var(--accent)', border: 'none', color: '#fff' }}>{saving ? '...' : '✓ Save'}</button>
            <button onClick={() => setEditing(false)} style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'none', border: '1px solid var(--navy-light)', color: 'var(--text-muted)' }}>Cancel</button>
          </div>
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

  const [pipelineError, setPipelineError] = React.useState<string | null>(null)
  const [retrying, setRetrying] = React.useState(false)

  const attemptRun = async (attempt: number = 1): Promise<boolean> => {
    try {
      const res = await api.post('/governance/reviews/' + review.id + '/run')
      return true
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Unknown error'
      // Mandatory gaps blocking run — no point retrying
      if (msg.toLowerCase().includes('mandatory gap') || msg.toLowerCase().includes('cannot run')) {
        setPipelineError('⚠️ Mandatory gaps are unresolved: ' + msg + '. Please go back and resolve them before running.')
        return false
      }
      if (attempt < 3) {
        setStatusMsg('Pipeline start failed, retrying (' + attempt + '/3)...')
        await sleep(attempt * 3000)
        return attemptRun(attempt + 1)
      }
      setPipelineError(msg)
      return false
    }
  }

  const runFlow = async () => {
    setPipelineError(null)
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

    // Stage 2: Run AI review — auto-retry up to 3 times
    setStage('reviewing')
    setProgress(30)
    setStatusMsg('Starting AI review pipeline...')
    const started = await attemptRun(1)
    if (!started) return  // error state already set

    setStatusMsg('AI review pipeline running...')

    // Animate engines progressively — use ref so closure stays fresh
    const engineIdxRef = { current: 0 }
    const totalEngines = 10
    const tickEngine = () => {
      const idx = engineIdxRef.current
      if (idx < totalEngines) {
        setEngines(prev => prev.map((e, i) => i <= idx ? { ...e, done: true } : e))
        engineIdxRef.current = idx + 1
        setProgress(30 + Math.round(((idx + 1) / totalEngines) * 50))
      }
    }
    tickEngine()
    engineTimerRef.current = setInterval(tickEngine, 7000)

    // Poll for completion — also detect DRAFT (pipeline crashed after start)
    let staleDraftCount = 0
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
      } else if (r?.status === 'DRAFT') {
        // Pipeline started but crashed back to DRAFT
        staleDraftCount++
        if (staleDraftCount >= 3) {
          clearInterval(pollRef.current)
          clearInterval(engineTimerRef.current)
          setPipelineError('Pipeline crashed during execution. Check Cloud Run logs for details. You can retry below.')
        }
      }
    }, 4000)
  }

  const handleManualRetry = async () => {
    setRetrying(true)
    setPipelineError(null)
    setEngines(prev => prev.map(e => ({ ...e, done: false })))
    setProgress(30)
    startedRef.current = false
    await runFlow()
    setRetrying(false)
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

      {/* Pipeline error state */}
      {pipelineError && (
        <div style={{ marginTop: 16, padding: 14, borderRadius: 10, background: '#e74c3c18', border: '1px solid #e74c3c44' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e74c3c', marginBottom: 6 }}>❌ Pipeline Error</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{pipelineError}</div>
          {!pipelineError.includes('mandatory gap') && (
            <button
              onClick={handleManualRetry}
              disabled={retrying}
              style={{ padding: '6px 16px', borderRadius: 8, background: '#e74c3c', color: '#fff', border: 'none', cursor: retrying ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: retrying ? 0.6 : 1 }}
            >
              {retrying ? '⏳ Retrying...' : '🔄 Retry Pipeline'}
            </button>
          )}
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

function MetadataPreview({ meta }: { meta: any }) {
  if (!meta || Object.keys(meta).length === 0) return null
  return (
    <div style={{ background: '#3498db0a', border: '1px solid #3498db33', borderRadius: 10, padding: 16, marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#3498db', marginBottom: 10 }}>🤖 Auto-Detected from Documents</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {meta.solutionName && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SOLUTION</div><div style={{ fontSize: 13, fontWeight: 600 }}>{meta.solutionName}</div></div>}
        {meta.scope && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SCOPE</div><div style={{ fontSize: 12 }}>{meta.scope}</div></div>}
        {meta.businessOwner && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BUSINESS OWNER</div><div style={{ fontSize: 12 }}>{meta.businessOwner}</div></div>}
        {meta.technicalOwner && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TECH OWNER</div><div style={{ fontSize: 12 }}>{meta.technicalOwner}</div></div>}
      </div>
      {meta.technologies?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>TECHNOLOGIES DETECTED</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {meta.technologies.map((t: string, i: number) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#3498db22', color: '#3498db' }}>{t}</span>)}
          </div>
        </div>
      )}
      {meta.missingItems?.length > 0 && (
        <div style={{ marginTop: 10, background: '#e67e2218', border: '1px solid #e67e2244', borderRadius: 8, padding: '8px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#e67e22', marginBottom: 4 }}>⚠ Potentially Missing</div>
          {meta.missingItems.map((m: string, i: number) => <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {m}</div>)}
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
  const [tab, setTab] = useState<'summary' | 'domains' | 'strategic' | 'compliance' | 'risk' | 'future' | 'financial'>('summary')
  const [findings, setFindings] = useState<any[]>([])
  const [report, setReport] = useState<any>(null)
  const [form, setForm] = useState({ title: '', description: '', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0', aiMode: 'AUTOMATED', projectName: '', notes: '', aggressiveness: 'STANDARD' })
  const [inputs, setInputs] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [extractedMeta, setExtractedMeta] = useState<any>(null)
  const [showMeta, setShowMeta] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; fileName: string; pct: number } | null>(null)
  const [exportLang, setExportLang] = useState<'auto'|'ar'|'en'>('auto')
  const [showRerunModal, setShowRerunModal] = React.useState(false)
  const handleRerunConfirm = async () => {
    setShowRerunModal(false)
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
      const t = localStorage.getItem('ea_token') || ''
      await fetch(`${apiUrl}/governance/reviews/${review?.id}/run`, { method: 'POST', headers: { Authorization: `Bearer ${t}` } })
      setView('progress')
    } catch { alert('Failed to re-run review') }
  }
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
    setLoading(true); setError(''); setUploadStatus('')
    try {
      const r = await api.post('/governance/reviews', form)
      if (!r.id) { setError(r.message || 'Failed to create review'); setLoading(false); return }
      setReview(r)
      setLoading(false)
      // Upload files one by one — each triggers Docling extraction
      const filesToUpload = inputs.filter(inp => inp._file)
      for (let i = 0; i < filesToUpload.length; i++) {
        const inp = filesToUpload[i]
        if (inp._file) {
          const fd = new FormData()
          fd.append('file', inp._file)
          fd.append('label', inp._file.name)
          setUploadStatus('📄 Uploading & extracting: ' + inp._file.name + ' (' + (i+1) + '/' + filesToUpload.length + ')...')
          setUploadProgress({ current: i + 1, total: filesToUpload.length, fileName: inp._file.name, pct: 0 })

          // Simulate progress: tick up to 85% while waiting, jump to 100% when done
          let simPct = 0
          const simTimer = setInterval(() => {
            // Slow down as we approach 85% — feels realistic for Docling extraction
            const increment = simPct < 30 ? 8 : simPct < 60 ? 4 : simPct < 80 ? 2 : 0.5
            simPct = Math.min(85, simPct + increment)
            setUploadProgress(prev => prev ? { ...prev, pct: Math.round(simPct) } : prev)
          }, 500)

          // 90s timeout per file — large DOCX files via Docling can take a while
          const uploadPromise = api.postFile('/governance/reviews/' + r.id + '/inputs/file', fd)
          const timeoutPromise = new Promise(res => setTimeout(res, 90000))
          await Promise.race([uploadPromise, timeoutPromise]).catch(() => {})

          clearInterval(simTimer)
          setUploadProgress({ current: i + 1, total: filesToUpload.length, fileName: inp._file.name, pct: 100 })
          await new Promise(res => setTimeout(res, 400)) // brief pause so user sees 100%
          // Try fetching metadata immediately after each file — Docling may have completed
          try {
            const earlyMeta = await api.get('/governance/reviews/' + r.id + '/inputs/metadata').catch(() => null)
            if (earlyMeta && Object.keys(earlyMeta).length > 0) {
              setExtractedMeta(earlyMeta)
            }
          } catch { /* ignore — will retry in poll */ }
        }
      }
      setUploadStatus('')
      setUploadProgress(null)
      setView('progress')
      // Poll for extracted metadata in background
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
    } catch (e) { setError('Failed to create review. Please try again.') }
    finally { setLoading(false) }
  }

  const exportWord = async (lang?: string) => {
    const token = localStorage.getItem('ea_token')
    const langParam = lang || (exportLang !== 'auto' ? exportLang : '')
    try {
      const url = API_URL + '/governance/reviews/' + review?.id + '/export/word' + (langParam ? '?lang=' + langParam : '')
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      if (!res.ok) { alert('Export failed'); return }
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = (review?.title || 'governance-review') + (langParam === 'ar' ? '_AR' : langParam === 'en' ? '_EN' : '') + '.docx'
      a.click()
      URL.revokeObjectURL(objUrl)
    } catch { alert('Export failed') }
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
        <button className='btn-primary' onClick={() => { setView('create'); setForm({ title: '', description: '', reviewType: 'HLD_REVIEW', framework: 'NORA_2_0', aiMode: 'AUTOMATED', projectName: '', notes: '', aggressiveness: 'STANDARD' }); setInputs([]); setWizardStep(1); setExtractedMeta(null); setShowMeta(false) }}>+ New Review</button>
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

  // ── Wizard helpers ──────────────────────────────────────────────────────────
  const WIZARD_STEPS = [
    { n: 1, label: 'Identity',       icon: '📋' },
    { n: 2, label: 'Documents',      icon: '📄' },
    { n: 3, label: 'Intelligence',   icon: '🧠' },
    { n: 4, label: 'Aggressiveness', icon: '⚖️' },
    { n: 5, label: 'Confirm',        icon: '🚀' },
  ]
  const canNext1 = !!form.title
  const canNext2 = inputs.length > 0
  const wizardNext = () => setWizardStep(s => Math.min(5, s + 1))
  const wizardBack = () => setWizardStep(s => Math.max(1, s - 1))

  if (view === 'create') return (
    <div style={{ padding: '24px 32px', maxWidth: 780 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => { setView('list'); setWizardStep(1) }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>New Governance Review</div>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, gap: 0 }}>
        {WIZARD_STEPS.map((step, idx) => {
          const done = wizardStep > step.n
          const active = wizardStep === step.n
          return (
            <React.Fragment key={step.n}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 80 }}>
                <div onClick={() => done && setWizardStep(step.n)} style={{
                  width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: done ? 16 : 13, fontWeight: 700, cursor: done ? 'pointer' : 'default',
                  background: done ? 'var(--accent)' : active ? 'var(--accent)22' : 'var(--navy-mid)',
                  border: '2px solid ' + (done || active ? 'var(--accent)' : 'var(--navy-light)'),
                  color: done ? '#fff' : active ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.2s'
                }}>{done ? '✓' : step.icon}</div>
                <div style={{ fontSize: 10, color: active ? 'var(--accent)' : done ? 'var(--text-muted)' : 'var(--text-muted)', fontWeight: active ? 700 : 400, whiteSpace: 'nowrap' }}>{step.label}</div>
              </div>
              {idx < WIZARD_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: wizardStep > step.n ? 'var(--accent)' : 'var(--navy-light)', marginBottom: 22, transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {error && <div style={{ background: '#e74c3c22', border: '1px solid #e74c3c', borderRadius: 8, padding: '10px 14px', color: '#e74c3c', marginBottom: 16, fontSize: 13 }}>{error}</div>}

      {/* ── STEP 1: Identity ── */}
      {wizardStep === 1 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📋 Review Identity</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Give your review a clear name and set the review type and framework.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Review Title *</label>
              <input className='form-input' value={form.title} onChange={set('title')}
                placeholder='e.g. Customer Portal HLD Review'
                style={{ fontSize: 15 }} />
            </div>

            <div>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Review Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {REVIEW_TYPES.map(rt => (
                  <div key={rt.value} onClick={() => setForm(f => ({ ...f, reviewType: rt.value }))}
                    style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                      border: '2px solid ' + (form.reviewType === rt.value ? 'var(--accent)' : 'var(--navy-light)'),
                      background: form.reviewType === rt.value ? 'var(--accent)11' : 'var(--navy-mid)',
                      color: form.reviewType === rt.value ? 'var(--accent)' : 'var(--text)',
                      fontSize: 13, fontWeight: form.reviewType === rt.value ? 600 : 400
                    }}>{rt.label}</div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Framework</label>
                <select className='form-input' value={form.framework} onChange={set('framework')}>
                  <option value='NORA_2_0'>NORA 2.0</option>
                  <option value='TOGAF_10'>TOGAF 10</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Project Name (optional)</label>
                <input className='form-input' value={form.projectName} onChange={set('projectName')} placeholder='e.g. Customer Portal' />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 32 }}>
            <button className='btn-primary' onClick={wizardNext} disabled={!canNext1}
              style={{ padding: '10px 28px', opacity: canNext1 ? 1 : 0.4 }}>
              Next: Upload Documents →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Documents ── */}
      {wizardStep === 2 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📄 Upload Architecture Documents</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Upload your HLD, NFRs, diagrams, and integration specs. Docling will extract content automatically while you complete the setup.
          </div>

          <div style={{ border: '2px dashed var(--navy-light)', borderRadius: 12, padding: 36, textAlign: 'center', cursor: 'pointer', marginBottom: 16,
            background: inputs.length > 0 ? 'var(--accent)05' : 'transparent',
            borderColor: inputs.length > 0 ? 'var(--accent)55' : 'var(--navy-light)'
          }}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files) }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>{inputs.length > 0 ? '✅' : '📂'}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              {inputs.length > 0 ? inputs.length + ' file' + (inputs.length > 1 ? 's' : '') + ' selected' : 'Click or drag files here'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, DOCX, PPTX, XLSX, PNG, JPG, JSON, YAML</div>
            <input ref={fileRef} type='file' multiple style={{ display: 'none' }} onChange={e => handleFileSelect(e.target.files)} />
          </div>

          {inputs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {inputs.map((inp, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <span style={{ fontSize: 13, flex: 1, color: 'var(--text)' }}>{inp.label}</span>
                  <span style={{ fontSize: 11, color: '#2ecc71' }}>Ready</span>
                  <button onClick={() => removeInput(i)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: '1px dashed var(--accent)55', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', marginTop: 4 }}>+ Add more files</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
            <button onClick={wizardBack} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '10px 20px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button className='btn-primary' onClick={wizardNext} disabled={!canNext2}
              style={{ padding: '10px 28px', opacity: canNext2 ? 1 : 0.4 }}>
              Next: Review Intelligence →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Intelligence Advisor ── */}
      {wizardStep === 3 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🧠 Review Intelligence</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            These repository items will be used to enrich your review. Missing items reduce review quality — add them before starting if possible.
          </div>
          <IntelligenceAdvisor reviewType={form.reviewType} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
            <button onClick={wizardBack} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '10px 20px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button className='btn-primary' onClick={wizardNext} style={{ padding: '10px 28px' }}>Next: Set Aggressiveness →</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Aggressiveness ── */}
      {wizardStep === 4 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>⚖️ Review Aggressiveness</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Choose how rigorous the AI review should be. This affects finding thresholds, scoring penalties, and compliance strictness.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {AGGRESSIVENESS_CARDS.map(card => {
              const active = form.aggressiveness === card.value
              return (
                <div key={card.value} onClick={() => setForm(f => ({ ...f, aggressiveness: card.value }))}
                  style={{ border: '2px solid ' + (active ? card.border : 'var(--navy-light)'),
                    borderRadius: 12, padding: '18px 16px', cursor: 'pointer',
                    background: active ? card.border + '18' : 'var(--navy-mid)',
                    transition: 'all 0.15s', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 26 }}>{card.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: active ? card.border : 'var(--text)' }}>{card.label}</div>
                      {active && <div style={{ fontSize: 10, color: card.border, fontWeight: 600 }}>✓ Selected</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>{card.description}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {(card as any).details.map((d: string, i: number) => {
                      const isIdeal = d.startsWith('Ideal for:')
                      const isOutcome = d.startsWith('Decision outcome:')
                      return (
                        <div key={i} style={{ display: 'flex', gap: 7, fontSize: 11, lineHeight: 1.4,
                          color: isOutcome ? card.border : isIdeal ? 'var(--accent)' : 'var(--text-muted)' }}>
                          <span style={{ flexShrink: 0, marginTop: 1 }}>{isOutcome ? '⚖' : isIdeal ? '🎯' : '•'}</span>
                          <span>{d}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
            <button onClick={wizardBack} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '10px 20px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>← Back</button>
            <button className='btn-primary' onClick={wizardNext} style={{ padding: '10px 28px' }}>Next: Confirm & Launch →</button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Confirm & Launch ── */}
      {wizardStep === 5 && (
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🚀 Confirm & Launch</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Review your configuration before starting the AI analysis.</div>

          {/* Summary card */}
          <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>REVIEW TITLE</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{form.title}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>REVIEW TYPE</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{REVIEW_TYPES.find(t => t.value === form.reviewType)?.label || form.reviewType}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>FRAMEWORK</div>
                <div style={{ fontSize: 13 }}>{form.framework?.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>AGGRESSIVENESS</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {AGGRESSIVENESS_CARDS.find(c => c.value === form.aggressiveness)?.icon} {form.aggressiveness}
                </div>
              </div>
            </div>
          </div>

          {/* Files */}
          <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>DOCUMENTS ({inputs.length})</div>
            {inputs.map((inp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
                <span>📄</span><span style={{ color: 'var(--text)' }}>{inp.label}</span>
              </div>
            ))}
          </div>

          {/* Extracted metadata if available */}
          {extractedMeta && (
            <div style={{ background: '#3498db0a', border: '1px solid #3498db33', borderRadius: 12, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#3498db', marginBottom: 10 }}>🤖 AUTO-DETECTED FROM DOCUMENTS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {extractedMeta.solutionName && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SOLUTION</div><div style={{ fontSize: 13, fontWeight: 600 }}>{extractedMeta.solutionName}</div></div>}
                {extractedMeta.scope && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>SCOPE</div><div style={{ fontSize: 13 }}>{extractedMeta.scope}</div></div>}
                {extractedMeta.businessOwner && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>BUSINESS OWNER</div><div style={{ fontSize: 13 }}>{extractedMeta.businessOwner}</div></div>}
                {extractedMeta.technicalOwner && <div><div style={{ fontSize: 10, color: 'var(--text-muted)' }}>TECH OWNER</div><div style={{ fontSize: 13 }}>{extractedMeta.technicalOwner}</div></div>}
              </div>
              {extractedMeta.technologies?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>TECHNOLOGIES DETECTED</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {extractedMeta.technologies.map((t: string, i: number) => <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#3498db22', color: '#3498db' }}>{t}</span>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadProgress && (
            <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--navy-dark)', borderRadius: 10, border: '1px solid #3498db44' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 12, color: '#3498db', fontWeight: 600 }}>
                  📄 File {uploadProgress.current}/{uploadProgress.total}: {uploadProgress.fileName.length > 35 ? uploadProgress.fileName.slice(0,32)+'...' : uploadProgress.fileName}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{uploadProgress.pct}%</div>
              </div>
              <div style={{ height: 6, background: 'var(--navy-mid)', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: uploadProgress.pct + '%', background: '#3498db', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </div>
              {uploadProgress.total > 1 && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  {Array.from({ length: uploadProgress.total }).map((_, idx) => (
                    <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, background: idx < uploadProgress.current - 1 ? '#3498db' : idx === uploadProgress.current - 1 ? '#3498db88' : 'var(--navy-light)' }} />
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>⏳ Docling extracting content — large files may take 30–60s</div>
            </div>
          )}
          {uploadStatus && !uploadProgress && (
            <div style={{ background: '#3498db15', border: '1px solid #3498db44', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#3498db', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
              {uploadStatus}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button onClick={wizardBack} disabled={!!uploadStatus || loading} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: 8, padding: '10px 20px', color: 'var(--text-muted)', cursor: uploadStatus ? 'not-allowed' : 'pointer', fontSize: 13, opacity: uploadStatus ? 0.4 : 1 }}>← Back</button>
            <button className='btn-primary' onClick={createAndStart} disabled={loading || !!uploadStatus}
              style={{ fontSize: 15, padding: '12px 36px', opacity: loading || uploadStatus ? 0.7 : 1 }}>
              {loading ? 'Creating review...' : uploadStatus ? 'Uploading...' : '▶ Launch Review'}
            </button>
          </div>
        </div>
      )}
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
      <MetadataPreview meta={extractedMeta} />
    </div>
  )

  if (view === 'report') return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => { setView('list'); loadReviews() }} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}>← Back to reviews</button>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', flex: 1 }}>{review?.title}</div>
        <div style={{ padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: DECISION_COLOR[review?.decision] + '22', color: DECISION_COLOR[review?.decision] }}>{review?.decision?.replace(/_/g, ' ')}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <select value={exportLang} onChange={e => setExportLang(e.target.value as any)}
            style={{ padding: '5px 8px', borderRadius: '8px 0 0 8px', border: '1px solid var(--navy-light)', borderRight: 'none', background: 'var(--navy-mid)', color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
            <option value='auto'>🌐 Auto</option>
            <option value='en'>🇬🇧 EN</option>
            <option value='ar'>🇸🇦 AR</option>
          </select>
          <button onClick={() => exportWord()} style={{ background: 'none', border: '1px solid var(--navy-light)', borderRadius: '0 8px 8px 0', padding: '6px 14px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>📄 Export Word</button>
        </div>
        <button onClick={() => setShowRerunModal(true)} style={{ background: 'none', border: '1px solid var(--accent)', borderRadius: 8, padding: '6px 14px', color: 'var(--accent)', cursor: 'pointer', fontSize: 12 }}>🔄 Re-run</button>
      </div>
      {/* Re-run Confirmation Modal */}
      {showRerunModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e74c3c22', border: '1px solid #e74c3c44', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Re-run AI Review</div>
                <div style={{ fontSize: 12, color: '#e74c3c' }}>This action cannot be undone</div>
              </div>
            </div>
            <div style={{ background: '#e74c3c0d', border: '1px solid #e74c3c33', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10, lineHeight: 1.6 }}>Re-running will regenerate all AI analysis. The following will be <strong style={{ color: '#e74c3c' }}>permanently overwritten</strong>:</div>
              {[['All domain findings','Including any edits or deletions you made'],['Compliance matrix','All principle assessments and status changes'],['Risk register','All risks and severity adjustments'],['Financial opportunities','All saving estimates and edits'],['Scores & decision','Overall score, domain scores, and approval decision'],['Executive summary','The AI narrative will be replaced']].map(([title, desc]) => (
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: '#e74c3c', fontSize: 14, marginTop: 1, flexShrink: 0 }}>✕</span>
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div></div>
                </div>
              ))}
            </div>
            <div style={{ background: '#3498db0d', border: '1px solid #3498db33', borderRadius: 8, padding: '10px 14px', marginBottom: 24, fontSize: 12, color: '#3498db', lineHeight: 1.6 }}>
              💡 <strong>Tip:</strong> Only re-run if you uploaded new documents or changed the repository. For score adjustments, use inline editing instead.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowRerunModal(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'none', border: '1px solid var(--navy-light)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={handleRerunConfirm} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: '#e74c3c', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Yes, Re-run Review</button>
            </div>
          </div>
        </div>
      )}
      {report && <ReportView review={review} report={report} findings={findings} tab={tab} setTab={setTab} />}
      {!report && <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>Report not available yet</div>}
    </div>
  )

  return null
}

function ReportView({ review, report, findings, tab, setTab }: { review: any, report: any, findings: any[], tab: string, setTab: (t: any) => void }) {
  const [riskFilterSev, setRiskFilterSev] = React.useState<string[]>([])
  const [riskFilterCat, setRiskFilterCat] = React.useState<string>('')
  const [editingFinding, setEditingFinding] = React.useState<string | null>(null)
  const [editingReport, setEditingReport] = React.useState<string | null>(null) // field name
  const [editDraft, setEditDraft] = React.useState<any>({})
  const [saving, setSaving] = React.useState(false)
  const extScores = (report.domainSummaries?._extendedScores) || {}
  const archQualityScore = extScores.architectureQualityScore || 0
  const secScore = extScores.securityScore || 0
  const futureScore = extScores.futureStateScore || 0
  const finScore = extScores.financialScore || 0
  const confScore = extScores.confidenceScore || report.confidenceScore || 0

  // ── Edit helpers ──────────────────────────────────────────────────────────
  const apiUrl = (process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1')
  const token = () => localStorage.getItem('ea_token') || ''

  const saveFinding = async (findingId: string, data: any) => {
    setSaving(true)
    try {
      await fetch(`${apiUrl}/governance/reviews/${review.id}/findings/${findingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(data),
      })
    } finally { setSaving(false); setEditingFinding(null); setEditDraft({}) }
  }

  const saveReportField = async (fieldPath: string, value: any) => {
    setSaving(true)
    try {
      // fieldPath can be 'executiveSummary' or 'complianceMatrix' etc
      await fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ [fieldPath]: value }),
      })
    } finally { setSaving(false); setEditingReport(null); setEditDraft({}) }
  }

  const startEditFinding = (f: any) => { setEditingFinding(f.id); setEditDraft({ ...f }) }
  const startEditReport = (field: string, value: any) => { setEditingReport(field); setEditDraft({ value }) }

  // Edit toolbar component (inline)
  const EditBar = ({ onSave, onCancel, isDirty = true }: { onSave: () => void; onCancel: () => void; isDirty?: boolean }) => (
    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
      <button onClick={onSave} disabled={saving || !isDirty} style={{
        padding: '4px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
        background: 'var(--accent)', border: 'none', color: '#fff', opacity: saving ? 0.6 : 1
      }}>{saving ? '...' : '✓ Save'}</button>
      <button onClick={onCancel} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer', background: 'none', border: '1px solid var(--navy-light)', color: 'var(--text-muted)' }}>✕ Cancel</button>
    </div>
  )

  const { t, isAR, resolveText } = useLang()

  // ── Rescore state ──────────────────────────────────────────────────────────
  const [rescoring, setRescoring] = React.useState(false)
  const [rescoreResult, setRescoreResult] = React.useState<any>(null)
  // showRerunModal is managed by parent GovernancePage

  const triggerRescore = React.useCallback(async () => {
    setRescoring(true)
    try {
      const res = await fetch(`${apiUrl}/governance/reviews/${review.id}/rescore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      })
      if (res.ok) setRescoreResult(await res.json())
    } catch { /* non-blocking */ }
    finally { setRescoring(false) }
  }, [review.id, apiUrl])

  // confirmReRun removed — re-run handled by parent GovernancePage via handleRerunConfirm

  // Local state for optimistic updates
  const [localFindings, setLocalFindings] = React.useState(findings)
  React.useEffect(() => { setLocalFindings(findings) }, [findings])
  const handleFindingUpdate = (id: string, data: any) => {
    setLocalFindings((prev: any[]) => prev.map(f => f.id === id ? { ...f, ...data } : f))
    setTimeout(() => triggerRescore(), 300) // rescore after state settles
  }
  const handleFindingDelete = (id: string) => {
    setLocalFindings((prev: any[]) => prev.filter(f => f.id !== id))
    setTimeout(() => triggerRescore(), 300) // rescore after state settles
  }

  // Local report state for optimistic updates
  const [localReport, setLocalReport] = React.useState(report)
  React.useEffect(() => { setLocalReport(report) }, [report])
  const updateLocalReport = (field: string, value: any) => setLocalReport((prev: any) => ({ ...prev, [field]: value }))

  // Compliance local state
  const [localCompliance, setLocalCompliance] = React.useState<any[]>(
    (report.complianceMatrix as any)?.items || []
  )
  React.useEffect(() => { setLocalCompliance((report.complianceMatrix as any)?.items || []) }, [report])
  const [localOpps, setLocalOpps] = React.useState<any[]>(report.financialOpportunities?.opportunities || [])
  const [editingOppIdx, setEditingOppIdx] = React.useState<number | null>(null)
  const [oppDraft, setOppDraft] = React.useState<any>({})
  React.useEffect(() => { setLocalOpps(report.financialOpportunities?.opportunities || []) }, [report])
  const saveOppEdit = async () => {
    if (editingOppIdx === null) return
    const newOpps = localOpps.map((o, i) => i === editingOppIdx ? { ...o, ...oppDraft } : o)
    setLocalOpps(newOpps)
    setEditingOppIdx(null)
    setOppDraft({})
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ financialOpportunities: { ...report.financialOpportunities, opportunities: newOpps } }),
    }).catch(() => {})
  }
  const removeOpp = async (idx: number) => {
    const newOpps = localOpps.filter((_: any, i: number) => i !== idx)
    setLocalOpps(newOpps)
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ financialOpportunities: { ...report.financialOpportunities, opportunities: newOpps } }),
    }).catch(() => {})
  }
  const updateComplianceItem = async (idx: number, data: any) => {
    const newItems = localCompliance.map((item, i) => i === idx ? { ...item, ...data } : item)
    setLocalCompliance(newItems)
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ complianceMatrix: { ...report.complianceMatrix, items: newItems } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }
  const removeComplianceItem = (idx: number) => {
    const newItems = localCompliance.filter((_: any, i: number) => i !== idx)
    setLocalCompliance(newItems)
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ complianceMatrix: { ...report.complianceMatrix, items: newItems } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }

  // Risk local state
  const [localRisks, setLocalRisks] = React.useState<any[]>(
    (report.riskRegister as any)?.risks || []
  )
  React.useEffect(() => { setLocalRisks((report.riskRegister as any)?.risks || []) }, [report])
  const [localObjectives, setLocalObjectives] = React.useState<any[]>(report.strategicAlignment?.objectives || [])
  React.useEffect(() => { setLocalObjectives(report.strategicAlignment?.objectives || []) }, [report])
  const updateObjective = async (idx: number, data: any) => {
    const newObjs = localObjectives.map((o, i) => i === idx ? { ...o, ...data } : o)
    setLocalObjectives(newObjs)
    const t2 = localStorage.getItem('ea_token') || ''
    const apiUrl2 = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl2}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ strategicAlignment: { ...report.strategicAlignment, objectives: newObjs } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }
  const removeObjective = async (idx: number) => {
    const newObjs = localObjectives.filter((_: any, i: number) => i !== idx)
    setLocalObjectives(newObjs)
    const t2 = localStorage.getItem('ea_token') || ''
    const apiUrl2 = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl2}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ strategicAlignment: { ...report.strategicAlignment, objectives: newObjs } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }
  const [localFutureAreas, setLocalFutureAreas] = React.useState<any[]>(report.futureStateAlignment?.alignmentAreas || [])
  React.useEffect(() => { setLocalFutureAreas(report.futureStateAlignment?.alignmentAreas || []) }, [report])
  const updateFutureArea = async (idx: number, data: any) => {
    const newAreas = localFutureAreas.map((a, i) => i === idx ? { ...a, ...data } : a)
    setLocalFutureAreas(newAreas)
    const t2 = localStorage.getItem('ea_token') || ''
    const apiUrl2 = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl2}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ futureStateAlignment: { ...report.futureStateAlignment, alignmentAreas: newAreas } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }
  const removeFutureArea = async (idx: number) => {
    const newAreas = localFutureAreas.filter((_: any, i: number) => i !== idx)
    setLocalFutureAreas(newAreas)
    const t2 = localStorage.getItem('ea_token') || ''
    const apiUrl2 = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl2}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t2}` },
      body: JSON.stringify({ futureStateAlignment: { ...report.futureStateAlignment, alignmentAreas: newAreas } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }

  const updateRisk = async (idx: number, data: any) => {
    const newRisks = localRisks.map((r, i) => i === idx ? { ...r, ...data } : r)
    setLocalRisks(newRisks)
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    await fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ riskRegister: { ...report.riskRegister, risks: newRisks } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }
  const removeRisk = (idx: number) => {
    const newRisks = localRisks.filter((_: any, i: number) => i !== idx)
    setLocalRisks(newRisks)
    const token = localStorage.getItem('ea_token') || ''
    const apiUrl = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    fetch(`${apiUrl}/governance/reviews/${review.id}/report`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ riskRegister: { ...report.riskRegister, risks: newRisks } }),
    }).catch(() => {})
    setTimeout(() => triggerRescore(), 300)
  }
  const tabs = [
    { key: 'summary', label: t('gov.summary') },
    { key: 'domains', label: 'Domains & Findings' },
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

      {/* Rescore banner */}
      {rescoring && (
        <div style={{ background: '#f39c1215', border: '1px solid #f39c1244', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#f39c12', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⏳</span> Recalculating scores...
        </div>
      )}
      {rescoreResult && !rescoring && (
        <div style={{ background: '#2ecc7115', border: '1px solid #2ecc7144', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#2ecc71', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>✓</span>
          <span>Scores recalculated · Overall: <strong>{rescoreResult.overallScore}</strong> · Decision: <strong>{rescoreResult.decision?.replace(/_/g,' ')}</strong></span>
          {rescoreResult.totalAnnualSaving > 0 && <span>· Annual savings: <strong>SAR {rescoreResult.totalAnnualSaving.toLocaleString()}</strong></span>}
          <button onClick={() => setRescoreResult(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#2ecc71', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Score Row — use rescoreResult when available for live updates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 }}>
        <ScoreCircle score={Math.round(rescoreResult?.overallScore    ?? report.overallScore    ?? 0)} label='Overall' />
        <ScoreCircle score={(() => {
          // Use weighted goal alignment % as Strategic score (Option A)
          const STRAT_W: Record<string,number> = { BUSINESS_STRATEGY:0.40, DT_STRATEGY:0.35, EA_STRATEGY:0.25 }
          const objectives = localObjectives
          const NATIONAL_T = ['VISION_2030', 'NDP', 'NATIONAL', 'OTHER']
          const tenantObjs = objectives.filter((o:any) => o.isTenantStrategy !== false && !NATIONAL_T.includes((o.strategyType||'').toUpperCase()))
          const tGrouped: Record<string,any[]> = {}
          for (const o of tenantObjs) { const k = o.strategyType || 'EA_STRATEGY'; if (!tGrouped[k]) tGrouped[k]=[]; tGrouped[k].push(o) }
          let weightedSum = 0, totalW = 0
          for (const [sType, sobjs] of Object.entries(tGrouped) as [string,any[]][]) {
            const w = STRAT_W[sType] || 0.10
            const scorable = sobjs.filter((o:any) => o.alignmentStatus !== 'NOT_APPLICABLE')
            const avg = scorable.length ? scorable.reduce((s:number,o:any)=>s+(o.alignmentPercentage||0),0)/scorable.length : 0
            weightedSum += avg * w; totalW += w
          }
          // If all tenant objectives are NOT_APPLICABLE — no violations, score = 100
          const allNA = tenantObjs.length > 0 && tenantObjs.every((o:any) => o.alignmentStatus === 'NOT_APPLICABLE')
          if (allNA) return 100
          // No tenant objectives at all — not assessed yet, show 0
          if (tenantObjs.length === 0) return 0
          const alignPct = totalW > 0 ? Math.round(weightedSum / totalW) : 0
          return alignPct
        })()} label='Strategic' />
        <ScoreCircle score={Math.round(rescoreResult?.complianceScore ?? report.complianceScore ?? 0)} label='Compliance' />
        <ScoreCircle score={Math.round(rescoreResult?.riskScore       ?? report.riskScore       ?? 0)} label='Risk' />
        <ScoreCircle score={Math.round(report.futureStateAlignment?.alignmentPercentage ?? futureScore ?? 0)} label='Future State' />
        <ScoreCircle score={(() => {
          const opps = report.financialOpportunities?.opportunities || []
          if (opps.length === 0) return 0
          // Score = confidence-weighted: HIGH=100, MEDIUM=70, LOW=40
          const CONF: Record<string,number> = { HIGH: 100, MEDIUM: 70, LOW: 40 }
          const avg = Math.round(opps.reduce((s:number,o:any) => s + (CONF[o.confidenceLevel] || 70), 0) / opps.length)
          return avg
        })()} label='Financial' />
        <ScoreCircle score={Math.round(rescoreResult?.domainQualityScore ?? report.domainQualityScore ?? (() => { const ds = report.domainSummaries ? Object.values(report.domainSummaries) : []; const vals = (ds as any[]).map((d:any) => d?.score || d?.domainScore || 0).filter((v:number) => v > 0); return vals.length ? Math.round(vals.reduce((a:number,b:number)=>a+b,0)/vals.length) : 0; })())} label='Domains' />
      </div>

      {/* Score formula explainer */}
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Overall =</span>
        <span style={{ color: '#9b59b6', fontWeight: 600 }}>Strategic 20%</span>
        <span>+</span>
        <span style={{ color: '#1abc9c', fontWeight: 600 }}>Compliance 20%</span>
        <span>+</span>
        <span style={{ color: '#e67e22', fontWeight: 600 }}>Risk 15%</span>
        <span>+</span>
        <span style={{ color: '#3498db', fontWeight: 600 }}>Future State 10%</span>
        <span>+</span>
        <span style={{ color: '#2ecc71', fontWeight: 600 }}>Financial 10%</span>
        <span>+</span>
        <span style={{ color: '#e74c3c', fontWeight: 600 }}>Domains 25%</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>− CRITICAL penalty</span>
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
          {/* 1. Executive Summary FIRST */}
          <div style={{ background: 'var(--navy-mid)', borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', flex: 1 }}>{t('gov.executive_summary')}</div>
              {editingReport !== 'executiveSummary' && (
                <button onClick={() => startEditReport('executiveSummary', report.executiveSummary)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: '1px solid var(--accent)44', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}>✏ Edit</button>
              )}
            </div>
            {editingReport === 'executiveSummary' ? (
              <div>
                <textarea value={editDraft.value || ''} onChange={e => setEditDraft({ value: e.target.value })}
                  style={{ width: '100%', minHeight: 120, padding: 10, borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--navy-dark)', color: 'var(--text)', fontSize: 13, lineHeight: 1.7, resize: 'vertical', boxSizing: 'border-box' }} />
                <EditBar onSave={() => saveReportField('executiveSummary', editDraft.value)} onCancel={() => { setEditingReport(null); setEditDraft({}) }} />
              </div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text)' }}>{isAR ? resolveText(report.executiveSummary) : report.executiveSummary}</div>
            )}
          </div>

          {/* 2. Finding severity snapshot */}
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

          {/* 3. Immediate blockers — CRITICAL findings */}
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

          {/* 4. Score improvement tips */}
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

          {/* 5. Scope & Methodology */}
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

      {/* Domains & Findings Tab (merged) */}
      {tab === 'domains' && <DomainsFindingsTab findings={localFindings} report={report} isAR={isAR} resolveText={resolveText} reviewId={review.id} onFindingUpdate={handleFindingUpdate} onFindingDelete={handleFindingDelete} />}

      {/* UNUSED_DOMAINS_PLACEHOLDER */}
      {false && (
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
        const objectives = localObjectives

        // Strategy type weights and colors — declared FIRST (used in sort below)
        const STRAT_META: Record<string, { weight: number; label: string; color: string }> = {
          BUSINESS_STRATEGY: { weight: 40, label: 'Business Strategy', color: '#e74c3c' },
          DT_STRATEGY:       { weight: 35, label: 'Digital Transformation', color: '#9b59b6' },
          EA_STRATEGY:       { weight: 25, label: 'EA Strategy', color: '#3498db' },
          IT_STRATEGY:       { weight: 0,  label: 'IT Strategy', color: '#1abc9c' },
          DATA_STRATEGY:     { weight: 0,  label: 'Data Strategy', color: '#e67e22' },
          SECURITY_STRATEGY: { weight: 0,  label: 'Security Strategy', color: '#e74c3c' },
          VISION_2030:       { weight: 0,  label: 'Vision 2030', color: '#f39c12' },
        }

        // Split tenant strategies (scored) from national/common (recommendations only)
        const NATIONAL_TYPES = ['VISION_2030', 'NDP', 'NATIONAL', 'OTHER']
        const tenantObjectives = objectives.filter((o:any) => o.isTenantStrategy !== false && !NATIONAL_TYPES.includes((o.strategyType||'').toUpperCase()))
        const nationalObjectives = objectives.filter((o:any) => o.isTenantStrategy === false || NATIONAL_TYPES.includes((o.strategyType||'').toUpperCase()))

        // Group objectives: all (for pills), tenant-only (for scoring/rendering)
        const grouped: Record<string, any[]> = {}
        for (const obj of objectives) { const k = obj.strategyType || 'OTHER'; if (!grouped[k]) grouped[k]=[]; grouped[k].push(obj) }
        const tenantGrouped: Record<string, any[]> = {}
        for (const obj of tenantObjectives) { const k = obj.strategyType || 'OTHER'; if (!tenantGrouped[k]) tenantGrouped[k]=[]; tenantGrouped[k].push(obj) }
        // sortedTypes: tenant groups sorted by weight — used for both pills and group rendering
        const sortedTypes = Object.keys(tenantGrouped).sort((a,b) => (STRAT_META[b]?.weight||0) - (STRAT_META[a]?.weight||0))

        // Compute weighted alignment using ONLY tenant strategies
        const STRAT_W: Record<string,number> = { BUSINESS_STRATEGY:0.40, DT_STRATEGY:0.35, EA_STRATEGY:0.25 }
        const rawPct = report.strategicAlignment?.overallAlignmentPercentage || 0
        let weightedSum = 0, totalW = 0
        for (const [sType, sobjs] of Object.entries(tenantGrouped) as [string, any[]][]) {
          const w = STRAT_W[sType] || 0.10
          const scorableObjs = sobjs.filter((o:any) => o.alignmentStatus !== 'NOT_APPLICABLE')
          const avg = scorableObjs.length ? scorableObjs.reduce((s:number,o:any)=>s+(o.alignmentPercentage||0),0)/scorableObjs.length : 0
          weightedSum += avg * w; totalW += w
        }
        const overallPct = totalW > 0 ? Math.round(weightedSum / totalW) : rawPct
        const overallColor = overallPct >= 75 ? '#2ecc71' : overallPct >= 50 ? '#f39c12' : '#e74c3c'

        // Guard: if no objectives at all, show empty state
        // Note: all-NA case is now handled by rendering the goals with professional statements — don't skip
        if (objectives.length === 0) return (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎯</div>
            <div style={{ fontSize: 15, marginBottom: 6 }}>No strategic objectives assessed</div>
            <div style={{ fontSize: 12 }}>Add strategy documents to the repository to enable strategic alignment analysis</div>
          </div>
        )

        const STATUS_COLOR: Record<string, string> = {
          FULLY_ALIGNED: '#2ecc71', PARTIALLY_ALIGNED: '#f39c12',
          WEAKLY_ALIGNED: '#e67e22', NOT_ALIGNED: '#e74c3c', NOT_APPLICABLE: '#8baac8'
        }
        const STATUS_ICON: Record<string, string> = {
          FULLY_ALIGNED: '✅', PARTIALLY_ALIGNED: '⚠️', WEAKLY_ALIGNED: '🔶', NOT_ALIGNED: '❌', NOT_APPLICABLE: '—'
        }
        // Sort objectives: aligned first, then partial, then weak, then not aligned, then N/A
        const STATUS_ORDER: Record<string, number> = {
          FULLY_ALIGNED: 0, PARTIALLY_ALIGNED: 1, WEAKLY_ALIGNED: 2, NOT_ALIGNED: 3, NOT_APPLICABLE: 4
        }

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
                    {sortedTypes.filter(t => (STRAT_META[t]?.weight||0) > 0).map(t => {
                      const meta = STRAT_META[t]
                      const objs = grouped[t]
                      const scorableObjs2 = objs.filter((o:any) => o.alignmentStatus !== 'NOT_APPLICABLE')
                      const avg = scorableObjs2.length ? Math.round(scorableObjs2.reduce((s:number,o:any)=>s+(o.alignmentPercentage||0),0)/scorableObjs2.length) : 0
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

            {/* Per-strategy groups */}
            {/* Tenant Strategies — scored */}
            {sortedTypes.map(stratType => {
              const meta = STRAT_META[stratType]
              const objs = grouped[stratType]
              const scorableGroup = objs.filter((o:any) => o.alignmentStatus !== 'NOT_APPLICABLE')
              const avgAlign = scorableGroup.length ? Math.round(scorableGroup.reduce((s:number,o:any)=>s+(o.alignmentPercentage||0),0)/scorableGroup.length) : 0
              const avgColor = avgAlign >= 75 ? '#2ecc71' : avgAlign >= 50 ? '#f39c12' : '#e74c3c'
              const fullyAligned = objs.filter((o:any) => o.alignmentStatus === 'FULLY_ALIGNED').length
              const partialAligned = objs.filter((o:any) => o.alignmentStatus === 'PARTIALLY_ALIGNED').length
              const notAligned = objs.filter((o:any) => o.alignmentStatus === 'NOT_ALIGNED').length
              const notApplicable = objs.filter((o:any) => o.alignmentStatus === 'NOT_APPLICABLE').length

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
                          {objs.length} goals · {fullyAligned > 0 && <span style={{color:'#2ecc71'}}>{fullyAligned} aligned</span>}{fullyAligned > 0 && ' · '}{partialAligned > 0 && <span style={{color:'#f39c12'}}>{partialAligned} partial</span>}{partialAligned > 0 && ' · '}{notAligned > 0 && <span style={{color:'#e74c3c'}}>{notAligned} not aligned</span>}{notApplicable > 0 && ' · '}{notApplicable > 0 && <span style={{color:'#8baac8'}}>{notApplicable} N/A</span>}
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
                  {[...objs].sort((a:any,b:any) => (STATUS_ORDER[a.alignmentStatus]??5)-(STATUS_ORDER[b.alignmentStatus]??5)).map((obj: any, i: number) => {
                    const statusColor = STATUS_COLOR[obj.alignmentStatus] || '#8baac8'
                    const pct = obj.alignmentPercentage || 0
                    return (
                      <div key={i} style={{ background: obj.alignmentStatus === 'NOT_APPLICABLE' ? 'var(--navy-dark)' : 'var(--navy-mid)', border: '1px solid ' + statusColor + (obj.alignmentStatus === 'NOT_APPLICABLE' ? '22' : '33'), borderRadius: 10, padding: 14, marginBottom: 8 }}>
                        {obj.alignmentStatus === 'NOT_APPLICABLE' ? (
                          // NOT_APPLICABLE — professional no-impact statement, no score bar
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 14, marginTop: 2, color: '#8baac8' }}>○</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', flex: 1 }}>{isAR ? resolveText(obj.objectiveName) : obj.objectiveName}</div>
                                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#8baac822', color: '#8baac8', fontWeight: 600, whiteSpace: 'nowrap' }}>No Direct Impact</span>
                              </div>
                              <div style={{ fontSize: 12, color: '#8baac8', lineHeight: 1.6, fontStyle: 'italic' }}>
                                {obj.contributionDescription && obj.contributionDescription !== 'N/A' && obj.contributionDescription !== 'n/a'
                                  ? (isAR ? resolveText(obj.contributionDescription) : obj.contributionDescription)
                                  : `This solution operates in a different functional domain and does not directly address "${obj.objectiveName}". The solution's scope, objectives, and technical design have no direct bearing on this strategic pillar. This does not constitute a gap — it reflects the solution's intended purpose and boundary.`
                                }
                              </div>
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--navy-dark)', display: 'flex', gap: 6 }}>
                                <select value={obj.alignmentStatus} onChange={e => updateObjective(localObjectives.indexOf(obj), { alignmentStatus: e.target.value, alignmentPercentage: e.target.value === 'NOT_APPLICABLE' ? 0 : obj.alignmentPercentage })}
                                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #8baac844', background: '#8baac818', color: '#8baac8', cursor: 'pointer' }}>
                                  {['FULLY_ALIGNED','PARTIALLY_ALIGNED','WEAKLY_ALIGNED','NOT_ALIGNED','NOT_APPLICABLE'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                                </select>
                                <button onClick={() => removeObjective(localObjectives.indexOf(obj))} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e74c3c44', background: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕ Remove</button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          // Regular alignment card with score
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 16, marginTop: 1 }}>{STATUS_ICON[obj.alignmentStatus] || '•'}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{isAR ? resolveText(obj.objectiveName) : obj.objectiveName}</div>
                                <div style={{ fontSize: 18, fontWeight: 700, color: pct >= 75 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c', minWidth: 40, textAlign: 'right' }}>{pct}%</div>
                              </div>
                              <div style={{ height: 3, background: 'var(--navy-dark)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: pct + '%', background: pct >= 75 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c', borderRadius: 2 }} />
                              </div>
                              {obj.contributionDescription && obj.contributionDescription !== 'N/A' && obj.contributionDescription !== 'n/a' && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{isAR ? resolveText(obj.contributionDescription) : obj.contributionDescription}</div>
                              )}
                              {obj.expectedValue && obj.expectedValue !== 'N/A' && obj.expectedValue !== 'n/a' && (
                                <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 4 }}>💡 {isAR ? resolveText(obj.expectedValue) : obj.expectedValue}</div>
                              )}
                              {obj.evidence && obj.evidence !== 'N/A' && obj.evidence !== 'n/a' && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>📋 {obj.evidence}</div>
                              )}
                              {obj.relatedKPIs?.length > 0 && obj.relatedKPIs.some((k:string) => k !== 'N/A') && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📊 KPIs: {obj.relatedKPIs.filter((k:string) => k !== 'N/A').join(', ')}</div>
                              )}
                              {obj.alignmentStatus === 'NOT_ALIGNED' && (
                                <div style={{ fontSize: 11, color: '#e74c3c', fontStyle: 'italic', marginTop: 4 }}>
                                  This strategic goal is relevant to this solution type but is not addressed in the submitted design. Consider adding a specific design element or roadmap item to close this gap.
                                </div>
                              )}
                              {/* Edit controls */}
                              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--navy-dark)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                <select value={obj.alignmentStatus} onChange={e => {
                                  const newPct = e.target.value === 'FULLY_ALIGNED' ? 100 : e.target.value === 'PARTIALLY_ALIGNED' ? 65 : e.target.value === 'WEAKLY_ALIGNED' ? 35 : e.target.value === 'NOT_ALIGNED' ? 0 : 0
                                  updateObjective(localObjectives.indexOf(obj), { alignmentStatus: e.target.value, alignmentPercentage: newPct })
                                }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid ' + (STATUS_COLOR[obj.alignmentStatus]||'#8baac8') + '44', background: (STATUS_COLOR[obj.alignmentStatus]||'#8baac8') + '18', color: STATUS_COLOR[obj.alignmentStatus]||'#8baac8', cursor: 'pointer' }}>
                                  {['FULLY_ALIGNED','PARTIALLY_ALIGNED','WEAKLY_ALIGNED','NOT_ALIGNED','NOT_APPLICABLE'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                                </select>
                                <input type='number' min={0} max={100} value={obj.alignmentPercentage || 0}
                                  onChange={e => updateObjective(localObjectives.indexOf(obj), { alignmentPercentage: Math.min(100, Math.max(0, Number(e.target.value))) })}
                                  style={{ width: 64, fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--navy-light)', background: 'var(--navy-dark)', color: 'var(--text-primary)', textAlign: 'center' }} />
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>%</span>
                                <button onClick={() => removeObjective(localObjectives.indexOf(obj))} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e74c3c44', background: 'none', color: '#e74c3c', cursor: 'pointer', marginLeft: 'auto' }}>✕ Remove</button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* National / Common Strategies — recommendations only, not scored */}
            {nationalObjectives.length > 0 && (
              <div style={{ marginTop: 24, padding: '14px 16px', borderRadius: 10, background: '#f39c1210', border: '1px solid #f39c1233' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f39c12', marginBottom: 4 }}>🌐 National Strategy Alignment — Recommendations Only</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>These goals are from national/government strategies. They do not affect the review score but are shown as alignment recommendations.</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {nationalObjectives.map((o:any, i:number) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 14, marginTop: 1 }}>{o.alignmentStatus === 'FULLY_ALIGNED' ? '✅' : o.alignmentStatus === 'PARTIALLY_ALIGNED' ? '⚠️' : o.alignmentStatus === 'NOT_APPLICABLE' ? '—' : '🔶'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{o.objectiveName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{o.strategyName} · {(o.strategyType||'').replace(/_/g,' ')}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{o.contributionDescription}</div>
                        {o.expectedValue && <div style={{ fontSize: 11, color: '#f39c12', marginTop: 4 }}>💡 {o.expectedValue}</div>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f39c12', minWidth: 36, textAlign: 'right' }}>{o.alignmentPercentage}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })()}

      {/* Compliance Tab */}
      {tab === 'compliance' && (() => {
        const items = report.complianceMatrix?.items || []
        const statuses = ['COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT','REQUIRES_EXCEPTION','RECOMMENDED','NOT_APPLICABLE']
        const statusColor: Record<string,string> = { COMPLIANT:'#2ecc71', PARTIALLY_COMPLIANT:'#f39c12', NON_COMPLIANT:'#e74c3c', REQUIRES_EXCEPTION:'#e67e22', NOT_APPLICABLE:'#8baac8', RECOMMENDED:'#3498db' }
        const statusLabel: Record<string,string> = { COMPLIANT:'✓ Compliant', PARTIALLY_COMPLIANT:'⚠ Partial', NON_COMPLIANT:'✗ Non-Compliant', REQUIRES_EXCEPTION:'⚡ Exception', NOT_APPLICABLE:'— N/A', RECOMMENDED:'💡 Recommended' }
        const catColor: Record<string,string> = { TENANT_PRINCIPLE:'#e74c3c', TENANT_STANDARD:'#e67e22', NCA_STANDARD:'#1abc9c', NDMO_STANDARD:'#9b59b6', SDAIA_STANDARD:'#3498db', DGA_STANDARD:'#f39c12' }
        const catLabel: Record<string,string> = { TENANT_PRINCIPLE:'Tenant EA Principles', TENANT_STANDARD:'Tenant EA Standards', NCA_STANDARD:'NCA ECC Controls', NDMO_STANDARD:'NDMO Data Standards', SDAIA_STANDARD:'SDAIA Standards', DGA_STANDARD:'DGA Standards' }

        // For national standards: filter out NOT_APPLICABLE rows (only show actionable statuses)
        const nationalCats = ['NCA_STANDARD','NDMO_STANDARD','SDAIA_STANDARD','DGA_STANDARD']
        const cats = ['TENANT_PRINCIPLE','TENANT_STANDARD','NCA_STANDARD','NDMO_STANDARD','SDAIA_STANDARD','DGA_STANDARD']
        // Use localCompliance for optimistic updates — fall back to report items
        const allItemsSource = localCompliance.length > 0 ? localCompliance : items
        const displayItems = allItemsSource.filter((i:any) => {
          if (nationalCats.includes(i.category)) return i.complianceStatus !== 'NOT_APPLICABLE'
          return true
        })
        const grouped: Record<string,any[]> = {}
        for (const item of displayItems) { const c = item.category || 'OTHER'; if (!grouped[c]) grouped[c]=[]; grouped[c].push(item) }
        const countBy = (status: string) => displayItems.filter((i:any) => i.complianceStatus === status).length
        const total = displayItems.length

        return (
          <div>
            {/* Visual status breakdown */}
            {total > 0 && (
              <div style={{ marginBottom: 20 }}>
                {/* Status bar */}
                <div style={{ height: 12, borderRadius: 6, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                  {statuses.map(s => {
                    const pct = (countBy(s) / total) * 100
                    return pct > 0 ? <div key={s} title={s} style={{ width: pct + '%', background: statusColor[s] }} /> : null
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
                    {displayItems.length} assessed · <span style={{ color: report.complianceMatrix?.complianceRate >= 70 ? '#2ecc71' : '#f39c12', fontWeight: 600 }}>{report.complianceMatrix?.complianceRate || 0}% compliance rate</span>
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
                        <div style={{ fontSize: 10, color: catColor[c] || 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>{catLabel[c] || c.replace(/_/g,' ')}</div>
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
                  {catLabel[cat] || cat.replace(/_/g,' ')}
                  <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({grouped[cat].length})</span>
                  {(() => {
                    const scorable = grouped[cat].filter((i:any) => i.complianceStatus !== 'NOT_APPLICABLE' && i.complianceStatus !== 'RECOMMENDED')
                    if (scorable.length === 0) return null
                    const avg = Math.round(scorable.reduce((s:number,i:any) => s + (i.complianceStatus === 'COMPLIANT' ? 100 : i.complianceStatus === 'PARTIALLY_COMPLIANT' ? 50 : i.complianceStatus === 'REQUIRES_EXCEPTION' ? 25 : 0), 0) / scorable.length)
                    const c = avg >= 75 ? '#2ecc71' : avg >= 40 ? '#f39c12' : '#e74c3c'
                    return <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: c }}>{avg}/100</span>
                  })()}
                </div>
                {grouped[cat].map((item: any, i: number) => {
                  // Per-item score contribution: COMPLIANT=100, PARTIALLY=50, NON_COMPLIANT=0, N/A=null
                  const itemScore = item.complianceStatus === 'COMPLIANT' ? 100
                    : item.complianceStatus === 'PARTIALLY_COMPLIANT' ? 50
                    : item.complianceStatus === 'NON_COMPLIANT' ? 0
                    : item.complianceStatus === 'REQUIRES_EXCEPTION' ? 25
                    : null // NOT_APPLICABLE and RECOMMENDED — excluded from scoring
                  const scoreColor = itemScore === null ? '#8baac8' : itemScore >= 75 ? '#2ecc71' : itemScore >= 40 ? '#f39c12' : '#e74c3c'
                  const borderColor = item.complianceStatus === 'NON_COMPLIANT' ? '#e74c3c33'
                    : item.complianceStatus === 'COMPLIANT' ? '#2ecc7133'
                    : item.complianceStatus === 'PARTIALLY_COMPLIANT' ? '#f39c1233'
                    : item.complianceStatus === 'RECOMMENDED' ? '#3498db22'
                    : 'var(--navy-light)'
                  return (
                    <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid ' + borderColor, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        {/* Status badge */}
                        <div style={{ minWidth: 100, padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, textAlign: 'center', marginTop: 1, flexShrink: 0,
                          background: (statusColor[item.complianceStatus] || '#8baac8') + '22',
                          color: statusColor[item.complianceStatus] || '#8baac8'
                        }}>{statusLabel[item.complianceStatus] || item.complianceStatus}</div>
                        {/* Content */}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: item.evidence || item.gap ? 4 : 0 }}>{item.principleOrStandard}</div>
                          {item.complianceStatus === 'RECOMMENDED' ? (
                            <div style={{ fontSize: 11, color: '#3498db', marginTop: 4, display: 'flex', gap: 6 }}>
                              <span style={{ flexShrink: 0 }}>💡</span>
                              <span>{isAR ? resolveText(item.recommendation || 'Consider addressing this principle in the solution design.') : (item.recommendation || 'Consider addressing this principle in the solution design.')}</span>
                            </div>
                          ) : (
                            <>
                              {item.evidence && (
                                <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 6 }}>
                                  <span style={{ color: item.complianceStatus === 'COMPLIANT' ? '#2ecc71' : item.complianceStatus === 'PARTIALLY_COMPLIANT' ? '#f39c12' : 'var(--text-muted)', flexShrink: 0 }}>✓</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{item.evidence}</span>
                                </div>
                              )}
                              {item.complianceStatus === 'PARTIALLY_COMPLIANT' && item.gap && (
                                <div style={{ fontSize: 11, marginTop: 4, display: 'flex', gap: 6 }}>
                                  <span style={{ color: '#e74c3c', flexShrink: 0 }}>✗</span>
                                  <span style={{ color: '#e74c3c' }}>{isAR ? resolveText(item.gap) : item.gap}</span>
                                </div>
                              )}
                              {item.complianceStatus === 'NON_COMPLIANT' && item.gap && (
                                <div style={{ fontSize: 11, color: '#e74c3c', marginTop: 4, display: 'flex', gap: 6 }}>
                                  <span style={{ flexShrink: 0 }}>⚠</span>
                                  <span>{isAR ? resolveText(item.gap) : item.gap}</span>
                                </div>
                              )}
                              {item.recommendation && item.complianceStatus !== 'COMPLIANT' && item.complianceStatus !== 'NOT_APPLICABLE' && item.complianceStatus !== 'RECOMMENDED' && (
                                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, display: 'flex', gap: 6 }}>
                                  <span style={{ flexShrink: 0 }}>→</span>
                                  <span>{isAR ? resolveText(item.recommendation) : item.recommendation}</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {/* Score chip */}
                        <div style={{ textAlign: 'center', minWidth: 44, flexShrink: 0 }}>
                          {item.complianceStatus === 'RECOMMENDED' ? (
                            <div style={{ fontSize: 9, color: '#3498db', fontWeight: 600, lineHeight: 1.3 }}>Advisory<br/>No penalty</div>
                          ) : itemScore !== null ? (
                            <>
                              <div style={{ fontSize: 16, fontWeight: 700, color: scoreColor }}>{itemScore}</div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>/100</div>
                            </>
                          ) : (
                            <div style={{ fontSize: 10, color: '#8baac8' }}>N/A</div>
                          )}
                        </div>
                      </div>
                      {/* Edit controls */}
                      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--navy-dark)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <select
                          value={item.complianceStatus}
                          onChange={e => updateComplianceItem(localCompliance.indexOf(item), { complianceStatus: e.target.value })}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid ' + (statusColor[item.complianceStatus] || '#8baac8') + '44', background: (statusColor[item.complianceStatus] || '#8baac8') + '18', color: statusColor[item.complianceStatus] || '#8baac8', cursor: 'pointer' }}>
                          {['COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT','REQUIRES_EXCEPTION','RECOMMENDED','NOT_APPLICABLE'].map(s => (
                            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => removeComplianceItem(localCompliance.indexOf(item))}
                          style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e74c3c44', background: 'none', color: '#e74c3c', cursor: 'pointer' }}>
                          ✕ Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {total === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No compliance matrix available</div>}
          </div>
        )
      })()}

      {/* Risk Register Tab */}
      {tab === 'risk' && (() => {
        const allRisks = localRisks  // use localRisks for live edit/delete
        const filteredRisks = allRisks.filter((r: any) => {
          if (riskFilterSev.length > 0 && !riskFilterSev.includes(r.severity)) return false
          if (riskFilterCat && r.riskCategory !== riskFilterCat) return false
          return true
        })
        const sevCount = (s: string) => allRisks.filter((r: any) => r.severity === s).length
        const allCats = Array.from(new Set(allRisks.map((r: any) => r.riskCategory).filter(Boolean))) as string[]
        const toggleSev = (s: string) => setRiskFilterSev((p: string[]) => p.includes(s) ? p.filter((x: string) => x !== s) : [...p, s])

        return (
          <div>
            {/* Severity summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
              {[['Total', allRisks.length, '#8baac8'], ['Critical', sevCount('CRITICAL'), '#e74c3c'], ['High', sevCount('HIGH'), '#e67e22'], ['Medium', sevCount('MEDIUM'), '#f39c12'], ['Low', sevCount('LOW'), '#3498db']].map(([l, v, c]: any) => (
                <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Severity filter */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(sev => {
                const n = sevCount(sev)
                if (n === 0) return null
                const active = riskFilterSev.includes(sev)
                return (
                  <button key={sev} onClick={() => toggleSev(sev)} style={{
                    padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: '1px solid ' + SEV_COLOR[sev] + (active ? '' : '55'),
                    background: active ? SEV_COLOR[sev] + '33' : 'transparent',
                    color: SEV_COLOR[sev]
                  }}>{n} {sev}</button>
                )
              })}
              <select value={riskFilterCat} onChange={e => setRiskFilterCat(e.target.value)}
                style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--navy-light)', background: 'var(--navy-mid)', color: 'var(--text)', fontSize: 12, marginLeft: 4 }}>
                <option value=''>All Categories</option>
                {allCats.map((c: string) => <option key={c} value={c}>{c.replace(/_/g,' ')}</option>)}
              </select>
              {(riskFilterSev.length > 0 || riskFilterCat) && (
                <button onClick={() => { setRiskFilterSev([]); setRiskFilterCat('') }} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>✕ Clear</button>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{filteredRisks.length}/{allRisks.length} risks</span>
            </div>

            {/* Risk cards */}
            {filteredRisks.map((risk: any) => {
              const riskIdx = localRisks.indexOf(risk)
              return (
              <div key={riskIdx} style={{ background: 'var(--navy-mid)', border: '1px solid var(--navy-light)', borderRadius: 10, padding: 14, marginBottom: 10 }}>
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
                <div style={{ marginTop: 8, display: 'flex', gap: 6, borderTop: '1px solid var(--navy-light)', paddingTop: 8 }}>
                  <select value={risk.severity} onChange={e => { updateRisk(riskIdx, { severity: e.target.value }); setTimeout(() => triggerRescore(), 300) }}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid ' + (SEV_COLOR[risk.severity] || '#8baac8') + '44', background: (SEV_COLOR[risk.severity] || '#8baac8') + '18', color: SEV_COLOR[risk.severity] || '#8baac8', cursor: 'pointer' }}>
                    {['CRITICAL','HIGH','MEDIUM','LOW'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={() => { removeRisk(riskIdx); setTimeout(() => triggerRescore(), 300) }} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e74c3c44', background: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕ Remove</button>
                </div>
              </div>
              )
            })}
            {allRisks.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No risk register available</div>
            )}
            {allRisks.length > 0 && filteredRisks.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>No risks match the selected filters</div>
            )}
          </div>
        )
      })()}

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
        const areas = localFutureAreas  // use local state for live edits
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
                    {statusAreas.map((area: any) => {
                      const areaIdx = localFutureAreas.indexOf(area)
                      return (
                      <div key={areaIdx} style={{ background: 'var(--navy-mid)', border: '1px solid ' + c + '33', borderRadius: 10, padding: 12, marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: 'var(--text)' }}>{isAR ? resolveText(area.area) : area.area}</div>
                        {area.currentState && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>📍 Current: {isAR ? resolveText(area.currentState) : area.currentState}</div>}
                        {area.targetState && <div style={{ fontSize: 12, color: '#3498db', marginBottom: 4 }}>🎯 Target: {isAR ? resolveText(area.targetState) : area.targetState}</div>}
                        {area.gap && <div style={{ fontSize: 12, color: '#e74c3c', marginBottom: 4 }}>⚠ Gap: {isAR ? resolveText(area.gap) : area.gap}</div>}
                        {area.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>→ {isAR ? resolveText(area.recommendation) : area.recommendation}</div>}
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, borderTop: '1px solid var(--navy-light)', paddingTop: 8 }}>
                          <select value={area.status} onChange={e => updateFutureArea(areaIdx, { status: e.target.value })}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid ' + c + '44', background: c + '18', color: c, cursor: 'pointer' }}>
                            {['ALIGNED','PARTIALLY_ALIGNED','GAP_IDENTIFIED','NOT_ALIGNED','FUTURE_REQUIREMENT','NOT_APPLICABLE'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
                          </select>
                          <button onClick={() => removeFutureArea(areaIdx)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid #e74c3c44', background: 'none', color: '#e74c3c', cursor: 'pointer' }}>✕ Remove</button>
                        </div>
                      </div>
                      )
                    })}
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
        // Use localOpps for live totals (reflects user edits/deletes)
        const totalAnnual    = localOpps.reduce((s:number,o:any)=>s+(o.annualSaving||0),0) || rescoreResult?.totalAnnualSaving || fin.totalAnnualSaving || 0
        const totalOneTime   = localOpps.reduce((s:number,o:any)=>s+(o.estimatedSaving||0),0) || rescoreResult?.totalOneTimeSaving || fin.totalEstimatedSaving || 0
        const totalMin       = localOpps.reduce((s:number,o:any)=>s+(o.annualSavingMin||0)+(o.estimatedSavingMin||0),0)
        const totalMax       = localOpps.reduce((s:number,o:any)=>s+(o.annualSavingMax||0)+(o.estimatedSavingMax||0),0)
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
                  {totalMin > 0 && totalMax > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Range: <span style={{ color: '#e74c3c' }}>SAR {totalMin.toLocaleString()}</span> – <span style={{ color: '#2ecc71' }}>SAR {totalMax.toLocaleString()}</span>
                    </div>
                  )}
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
            {[...localOpps].sort((a:any,b:any)=>((b.annualSaving||0)+(b.estimatedSaving||0))-((a.annualSaving||0)+(a.estimatedSaving||0))).map((o: any, i: number) => {
              const oColor = TYPE_COLOR[o.type] || '#8baac8'
              const oIcon = TYPE_ICON[o.type] || '💡'
              const oTotal = (o.annualSaving||0) + (o.estimatedSaving||0)
              const isEditing = editingOppIdx === i
              return (
                <div key={i} style={{ background: 'var(--navy-mid)', border: '1px solid ' + oColor + '33', borderRadius: 10, padding: 16, marginBottom: 10 }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>✏ Edit Saving Opportunity</div>
                      <input value={oppDraft.title ?? o.title ?? ''} onChange={e => setOppDraft((d:any) => ({...d, title: e.target.value}))} placeholder='Title' style={{ background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13 }} />
                      <textarea value={oppDraft.description ?? o.description ?? ''} onChange={e => setOppDraft((d:any) => ({...d, description: e.target.value}))} placeholder='Description' rows={2} style={{ background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }} />
                      <input value={oppDraft.existingAlternative ?? o.existingAlternative ?? ''} onChange={e => setOppDraft((d:any) => ({...d, existingAlternative: e.target.value}))} placeholder='Existing alternative (tool/platform name)' style={{ background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13 }} />
                      <textarea value={oppDraft.savingRationale ?? o.savingRationale ?? ''} onChange={e => setOppDraft((d:any) => ({...d, savingRationale: e.target.value}))} placeholder='Saving rationale (step-by-step derivation)' rows={2} style={{ background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, resize: 'vertical' }} />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>One-time Saving (SAR)</div><input type='number' value={oppDraft.estimatedSaving ?? o.estimatedSaving ?? 0} onChange={e => setOppDraft((d:any) => ({...d, estimatedSaving: Number(e.target.value)}))} style={{ width: '100%', background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '6px 10px', color: '#3498db', fontSize: 14, fontWeight: 700 }} /></div>
                        <div><div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>Annual Saving (SAR)</div><input type='number' value={oppDraft.annualSaving ?? o.annualSaving ?? 0} onChange={e => setOppDraft((d:any) => ({...d, annualSaving: Number(e.target.value)}))} style={{ width: '100%', background: 'var(--navy-dark)', border: '1px solid var(--navy-light)', borderRadius: 6, padding: '6px 10px', color: '#2ecc71', fontSize: 14, fontWeight: 700 }} /></div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                        <button onClick={saveOppEdit} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>💾 Save</button>
                        <button onClick={() => { setEditingOppIdx(null); setOppDraft({}) }} style={{ padding: '7px 16px', borderRadius: 8, background: 'none', border: '1px solid var(--navy-light)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                  <>
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
                        <button onClick={() => { setEditingOppIdx(i); setOppDraft({}) }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'none', border: '1px solid var(--accent)55', color: 'var(--accent)', cursor: 'pointer' }}>✏ Edit</button>
                        <button onClick={() => removeOpp(i)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'none', border: '1px solid #e74c3c55', color: '#e74c3c', cursor: 'pointer' }}>🗑</button>
                      </div>
                      {o.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>{isAR ? resolveText(o.description) : o.description}</div>}
                    </div>
                  </div>

                  {/* Source citation — where in the document this was found */}
                  {o.sourceReference && (
                    <div style={{ background: '#3498db11', border: '1px solid #3498db33', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#3498db', marginBottom: 4, letterSpacing: 0.5 }}>📍 FOUND IN DOCUMENT</div>
                      <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 500 }}>{o.sourceReference}</div>
                      {o.sourceQuote && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, paddingLeft: 8, borderLeft: '2px solid #3498db44', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{o.sourceQuote}"
                        </div>
                      )}
                    </div>
                  )}

                  {o.existingAlternative && (
                    <div style={{ background: '#2ecc7115', border: '1px solid #2ecc7133', borderRadius: 6, padding: '6px 10px', marginBottom: 8, fontSize: 12, color: '#2ecc71' }}>
                      ♻️ Reuse existing: {isAR ? resolveText(o.existingAlternative) : o.existingAlternative}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: o.estimatedSaving > 0 && o.annualSaving > 0 ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
                    {o.estimatedSaving > 0 && (
                      <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>One-time Saving</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#3498db' }}>SAR {o.estimatedSaving.toLocaleString()}</div>
                        {(o.estimatedSavingMin || o.estimatedSavingMax) && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                            <span style={{ color: '#e74c3c' }}>Min SAR {(o.estimatedSavingMin||0).toLocaleString()}</span>
                            <span style={{ margin: '0 6px', color: 'var(--navy-light)' }}>·</span>
                            <span style={{ color: '#2ecc71' }}>Max SAR {(o.estimatedSavingMax||0).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {o.annualSaving > 0 && (
                      <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Annual Saving (avg)</div>
                        <div style={{ fontSize: 17, fontWeight: 700, color: '#2ecc71' }}>SAR {o.annualSaving.toLocaleString()}</div>
                        {(o.annualSavingMin || o.annualSavingMax) && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
                            <span style={{ color: '#e74c3c' }}>Min SAR {(o.annualSavingMin||0).toLocaleString()}</span>
                            <span style={{ margin: '0 6px', color: 'var(--navy-light)' }}>·</span>
                            <span style={{ color: '#2ecc71' }}>Max SAR {(o.annualSavingMax||0).toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Saving rationale — step-by-step derivation */}
                  {o.savingRationale && (
                    <div style={{ background: 'var(--navy-dark)', borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: 0.5 }}>📊 SAVING RATIONALE</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>{isAR ? resolveText(o.savingRationale) : o.savingRationale}</div>
                    </div>
                  )}
                  {o.recommendation && <div style={{ fontSize: 12, color: 'var(--accent)' }}>→ {isAR ? resolveText(o.recommendation) : o.recommendation}</div>}
                  </>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}


