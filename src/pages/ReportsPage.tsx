import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { getToken } from '../lib/api'

const GOV_API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

async function govGet(path: string) {
  const res = await fetch(GOV_API + path, { headers: { Authorization: 'Bearer ' + (getToken() || '') } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

const API_URL = process.env.REACT_APP_API_URL || ''

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#e74c3c', HIGH: '#e67e22', MEDIUM: '#f39c12', LOW: '#3498db',
  APPROVED: '#2ecc71', OPEN: '#8baac8', REJECTED: '#e74c3c', ACCEPTED: '#3498db',
}

const STATUS_COLOR: Record<string, string> = {
  COMPLIANT: '#2ecc71', PARTIALLY_COMPLIANT: '#f39c12',
  NON_COMPLIANT: '#e74c3c', REQUIRES_EXCEPTION: '#e67e22', NOT_APPLICABLE: '#8baac8',
}

function ExportBtn({ url, label }: { url: string; label: string }) {
  const token = localStorage.getItem('ea_token') || ''
  const handleExport = async () => {
    const res = await fetch(`${API_URL}/api/v1/${url}`, { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = label.toLowerCase().replace(/ /g, '-') + '.csv'; a.click()
  }
  return (
    <button onClick={handleExport} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2ecc71', background: 'transparent', color: '#2ecc71', fontSize: 12, cursor: 'pointer' }}>
      ⬇ Export CSV
    </button>
  )
}

// ── Report 1: Financial Savings ──────────────────────────────────────────────
function SavingsReport() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [reviewType, setReviewType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (reviewType) params.set('reviewType', reviewType)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await govGet(`/governance/reports/savings?${params}`)
      setData(res)
    } catch { setData(null) } finally { setLoading(false) }
  }, [status, reviewType, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const exportUrl = `governance/reports/savings/export?${new URLSearchParams({ status, reviewType, dateFrom, dateTo }).toString()}`

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selStyle}>
          <option value=''>All Statuses</option>
          <option value='OPEN'>Open</option>
          <option value='ACCEPTED'>Accepted</option>
          <option value='APPROVED'>Confirmed</option>
          <option value='REJECTED'>Rejected</option>
        </select>
        <select value={reviewType} onChange={e => setReviewType(e.target.value)} style={selStyle}>
          <option value=''>All Review Types</option>
          <option value='HLD_REVIEW'>HLD Review</option>
          <option value='LLD_REVIEW'>LLD Review</option>
        </select>
        <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} placeholder='From' />
        <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} placeholder='To' />
        <div style={{ marginLeft: 'auto' }}>
          <ExportBtn url={exportUrl} label='savings-report' />
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            ['Total Opportunities', data.total, '#8baac8'],
            ['Total Annual Savings', `SAR ${(data.totalAnnual || 0).toLocaleString()}`, '#2ecc71'],
            ['Total One-time Savings', `SAR ${(data.totalOneTime || 0).toLocaleString()}`, '#3498db'],
          ].map(([l, v, c]: any) => (
            <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Loading...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)' }}>
                {['Review', 'Type', 'Date', 'Finding', 'Domain', 'Status', 'One-time (SAR)', 'Annual (SAR)', 'Total (SAR)'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--navy-light)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--navy-light)' }}>
                  <td style={{ padding: '8px 12px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.review?.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{item.review?.reviewType?.replace(/_/g,' ')}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.review?.createdAt ? new Date(item.review.createdAt).toLocaleDateString() : ''}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{item.domain?.replace(/_/g,' ')}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={item.status}
                      onChange={async e => {
                        const newStatus = e.target.value
                        const token = localStorage.getItem('ea_token') || ''
                        await fetch(`${API_URL}/api/v1/governance/reviews/${item.reviewId}/findings/${item.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                          body: JSON.stringify({ status: newStatus }),
                        })
                        // Refresh data
                        setData((prev: any) => ({
                          ...prev,
                          items: prev.items.map((i: any) => i.id === item.id ? { ...i, status: newStatus } : i)
                        }))
                      }}
                      style={{ padding: '2px 6px', borderRadius: 8, border: '1px solid ' + (SEV_COLOR[item.status]||'#8baac8') + '66',
                        background: (SEV_COLOR[item.status]||'#8baac8') + '18', color: SEV_COLOR[item.status]||'#8baac8',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <option value='OPEN'>OPEN</option>
                      <option value='ACCEPTED'>ACCEPTED</option>
                      <option value='APPROVED'>CONFIRMED</option>
                      <option value='REJECTED'>REJECTED</option>
                      <option value='EXCEPTION_REQUESTED'>EXCEPTION</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#3498db', fontWeight: 600 }}>{item.estimatedSaving ? item.estimatedSaving.toLocaleString() : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2ecc71', fontWeight: 600 }}>{item.annualSaving ? item.annualSaving.toLocaleString() : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2ecc71' }}>{item.totalSaving ? item.totalSaving.toLocaleString() : '—'}</td>
                </tr>
              ))}
              {(!data?.items?.length) && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No savings found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Report 2: Compliance Register ────────────────────────────────────────────
function ComplianceReport() {
  const nav = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [complianceStatus, setComplianceStatus] = useState('')
  const [reviewType, setReviewType] = useState('')
  const [category, setCategory] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (complianceStatus) params.set('complianceStatus', complianceStatus)
      if (reviewType) params.set('reviewType', reviewType)
      if (category) params.set('category', category)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await govGet(`/governance/reports/compliance?${params}`)
      setData(res)
    } catch { setData(null) } finally { setLoading(false) }
  }, [complianceStatus, reviewType, category, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const exportUrl = `governance/reports/compliance/export?${new URLSearchParams({ complianceStatus, reviewType, category, dateFrom, dateTo }).toString()}`

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={complianceStatus} onChange={e => setComplianceStatus(e.target.value)} style={selStyle}>
          <option value=''>All Statuses</option>
          <option value='NON_COMPLIANT'>Non-Compliant</option>
          <option value='PARTIALLY_COMPLIANT'>Partially Compliant</option>
          <option value='COMPLIANT'>Compliant</option>
          <option value='REQUIRES_EXCEPTION'>Requires Exception</option>
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} style={selStyle}>
          <option value=''>All Categories</option>
          <option value='TENANT_PRINCIPLE'>Tenant Principles</option>
          <option value='TENANT_STANDARD'>Tenant Standards</option>
          <option value='NCA_STANDARD'>NCA ECC</option>
          <option value='NDMO_STANDARD'>NDMO</option>
          <option value='SDAIA_STANDARD'>SDAIA</option>
          <option value='DGA_STANDARD'>DGA</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={selStyle}>
          <option value=''>All Severities</option>
          <option value='CRITICAL'>Critical</option>
          <option value='HIGH'>High</option>
          <option value='MEDIUM'>Medium</option>
          <option value='LOW'>Low</option>
        </select>
        <select value={reviewType} onChange={e => setReviewType(e.target.value)} style={selStyle}>
          <option value=''>All Review Types</option>
          <option value='HLD_REVIEW'>HLD Review</option>
          <option value='LLD_REVIEW'>LLD Review</option>
        </select>
        <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} />
        <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} />
        <div style={{ marginLeft: 'auto' }}><ExportBtn url={exportUrl} label='compliance-register' /></div>
      </div>

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
          {[
            ['Total', data.total, '#8baac8'],
            ['Non-Compliant', data.nonCompliantCount, '#e74c3c'],
            ['Partial', data.partialCount, '#f39c12'],
            ['Compliant', data.compliantCount, '#2ecc71'],
          ].map(([l, v, c]: any) => (
            <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Loading...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)' }}>
                {['Review', 'Type', 'Date', 'Principle / Standard', 'Category', 'Status', 'Gap', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--navy-light)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--navy-light)', cursor: 'pointer' }} onClick={() => nav('/governance', { state: { reviewId: item.reviewId, tab: 'compliance' } })}>
                  <td style={{ padding: '8px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.review?.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{item.review?.reviewType?.replace(/_/g,' ')}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.review?.createdAt ? new Date(item.review.createdAt).toLocaleDateString() : ''}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200 }}>{item.principleOrStandard}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{item.category?.replace(/_/g,' ')}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: (STATUS_COLOR[item.complianceStatus]||'#8baac8')+'22', color: STATUS_COLOR[item.complianceStatus]||'#8baac8', whiteSpace: 'nowrap' }}>
                      {item.complianceStatus?.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#e74c3c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.gap}</td>
                  <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>→ Open Review</span></td>
                </tr>
              ))}
              {(!data?.items?.length) && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No compliance items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Report 3: EA Requirements Tracker ────────────────────────────────────────
function RequirementsTracker() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [source, setSource] = useState('')
  const [status, setStatus] = useState('')
  const [domain, setDomain] = useState('')
  const [reviewType, setReviewType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (source) params.set('source', source)
      if (status) params.set('status', status)
      if (domain) params.set('domain', domain)
      if (reviewType) params.set('reviewType', reviewType)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      const res = await govGet(`/governance/reports/requirements?${params}`)
      setData(res)
    } catch { setData(null) } finally { setLoading(false) }
  }, [source, status, domain, reviewType, dateFrom, dateTo])

  useEffect(() => { load() }, [load])

  const exportUrl = `governance/reports/requirements/export?${new URLSearchParams({ source, status, domain, reviewType, dateFrom, dateTo }).toString()}`

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={source} onChange={e => setSource(e.target.value)} style={selStyle}>
          <option value=''>All Sources</option>
          <option value='ADM'>ADM Cycles</option>
          <option value='GOVERNANCE'>Governance Reviews</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selStyle}>
          <option value=''>All Statuses</option>
          <option value='OPEN'>Open</option>
          <option value='ACCEPTED'>Accepted</option>
          <option value='APPROVED'>Approved</option>
          <option value='REJECTED'>Rejected</option>
          <option value='PENDING'>Pending</option>
        </select>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={selStyle}>
          <option value=''>All Domains</option>
          <option value='SECURITY_ARCHITECTURE'>Security</option>
          <option value='DATA_ARCHITECTURE'>Data</option>
          <option value='APPLICATION_INTEGRATION'>Integration</option>
          <option value='INFRASTRUCTURE'>Infrastructure</option>
          <option value='BUSINESS_ARCHITECTURE'>Business</option>
        </select>
        <select value={reviewType} onChange={e => setReviewType(e.target.value)} style={selStyle}>
          <option value=''>All Review Types</option>
          <option value='HLD_REVIEW'>HLD Review</option>
          <option value='LLD_REVIEW'>LLD Review</option>
        </select>
        <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} />
        <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} />
        <div style={{ marginLeft: 'auto' }}><ExportBtn url={exportUrl} label='ea-requirements' /></div>
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            ['Total', data.total, '#8baac8'],
            ['From ADM', data.admCount, '#3498db'],
            ['From Governance', data.governanceCount, '#9b59b6'],
          ].map(([l, v, c]: any) => (
            <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>Loading...</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)' }}>
                {['Source', 'Title', 'Title (AR)', 'Type', 'Domain', 'Priority', 'Status', 'Review / Cycle', 'Date'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--navy-light)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--navy-light)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: item.source === 'ADM' ? '#3498db22' : '#9b59b622', color: item.source === 'ADM' ? '#3498db' : '#9b59b6' }}>{item.source}</span>
                  </td>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 12, direction: 'rtl', textAlign: 'right', color: 'var(--text-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.titleAr || '—'}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{item.type?.replace(/_/g,' ')}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{item.domain?.replace(/_/g,' ')}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, background: (SEV_COLOR[item.priority]||'#8baac8')+'22', color: SEV_COLOR[item.priority]||'#8baac8' }}>{item.priority}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, background: (SEV_COLOR[item.status]||'#8baac8')+'22', color: SEV_COLOR[item.status]||'#8baac8' }}>{item.status}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reviewName}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}</td>
                </tr>
              ))}
              {(!data?.items?.length) && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No requirements found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Shared style ─────────────────────────────────────────────────────────────
const selStyle: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 8, border: '1px solid var(--navy-light)',
  background: 'var(--navy-mid)', color: 'var(--text)', fontSize: 12, cursor: 'pointer',
}

const REPORTS = [
  { key: 'savings', label: '💰 Financial Savings', labelAr: 'الوفورات المالية' },
  { key: 'compliance', label: '✅ Compliance Register', labelAr: 'سجل الامتثال' },
  { key: 'requirements', label: '📋 EA Requirements Tracker', labelAr: 'متتبع متطلبات البنية' },
]

// ── Main ReportsPage ──────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { isAR } = useLang()
  const [active, setActive] = useState('savings')

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <div className='page-header' style={{ paddingBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{isAR ? '📊 التقارير' : '📊 Reports'}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          {isAR ? 'تقارير الحوكمة والمتطلبات والامتثال' : 'Governance, compliance and requirements reports'}
        </div>
      </div>

      <div className='page-body'>
        {/* Sub-nav */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--navy-light)', paddingBottom: 10 }}>
          {REPORTS.map(r => (
            <button key={r.key} onClick={() => setActive(r.key)} style={{
              padding: '6px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active === r.key ? 600 : 400,
              background: active === r.key ? 'var(--accent)22' : 'transparent',
              color: active === r.key ? 'var(--accent)' : 'var(--text-muted)',
              borderBottom: active === r.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}>
              {isAR ? r.labelAr : r.label}
            </button>
          ))}
        </div>

        {/* Report content */}
        <div style={{ background: 'var(--navy-mid)', borderRadius: 12, padding: 20 }}>
          {active === 'savings'      && <SavingsReport />}
          {active === 'compliance'   && <ComplianceReport />}
          {active === 'requirements' && <RequirementsTracker />}
        </div>
      </div>
    </div>
  )
}


