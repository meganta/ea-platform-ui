import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { enumLabel } from '../lib/enumLabels'
import HelpTip from '../components/HelpTip'
import { getToken } from '../lib/api'

const GOV_API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

async function govGet(path: string) {
  const res = await fetch(GOV_API + path, { headers: { Authorization: 'Bearer ' + (getToken() || '') } })
  if (!res.ok) throw new Error('HTTP ' + res.status)
  return res.json()
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#e74c3c', HIGH: '#e67e22', MEDIUM: '#f39c12', LOW: '#3498db',
  APPROVED: '#2ecc71', OPEN: '#64748B', REJECTED: '#e74c3c', ACCEPTED: '#3498db',
}

const STATUS_COLOR: Record<string, string> = {
  COMPLIANT: '#2ecc71', PARTIALLY_COMPLIANT: '#f39c12',
  NON_COMPLIANT: '#e74c3c', REQUIRES_EXCEPTION: '#e67e22', NOT_APPLICABLE: '#64748B',
}

function ExportBtn({ url, label }: { url: string; label: string }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const token = localStorage.getItem('ea_token') || ''
  const handleExport = async () => {
    const res = await fetch(`${GOV_API}/${url}`, { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = label.toLowerCase().replace(/ /g, '-') + '.csv'; a.click()
  }
  return (
    <button onClick={handleExport} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #2ecc71', background: 'transparent', color: '#2ecc71', fontSize: 12, cursor: 'pointer' }}>
      {L('⬇ Export CSV', '⬇ تصدير CSV')}
    </button>
  )
}

// ── Report 1: Financial Savings ──────────────────────────────────────────────
function SavingsReport() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [reviewType, setReviewType] = useState('')
  const [domain, setDomain] = useState('')
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

  // Domain filter is client-side — API doesn't support it
  const filteredItems = (data?.items || []).filter((i: any) => !domain || i.domain === domain)
  const exportUrl = `governance/reports/savings/export?${new URLSearchParams({ status, reviewType, dateFrom, dateTo }).toString()}`

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selStyle}>
          <option value=''>{L('All Statuses', 'كل الحالات')}</option>
          <option value='OPEN'>{L('Open', 'مفتوحة')}</option>
          <option value='ACCEPTED'>{L('Accepted', 'مقبولة')}</option>
          <option value='APPROVED'>{L('Confirmed', 'مؤكدة')}</option>
          <option value='REJECTED'>{L('Rejected', 'مرفوضة')}</option>
        </select>
        <select value={reviewType} onChange={e => setReviewType(e.target.value)} style={selStyle}>
          <option value=''>{L('All Review Types', 'كل أنواع المراجعات')}</option>
          <option value='HLD_REVIEW'>{L('HLD Review', 'مراجعة التصميم رفيع المستوى')}</option>
          <option value='LLD_REVIEW'>{L('LLD Review', 'مراجعة التصميم التفصيلي')}</option>
        </select>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={selStyle}>
          <option value=''>{L('All Domains', 'كل المجالات')}</option>
          <option value='APPLICATION_INTEGRATION'>{L('Application Integration', 'التطبيقات والتكامل')}</option>
          <option value='DATA_ARCHITECTURE'>{L('Data Architecture', 'معمارية البيانات')}</option>
          <option value='INFRASTRUCTURE'>{L('Infrastructure', 'البنية التحتية')}</option>
          <option value='SECURITY_ARCHITECTURE'>{L('Security Architecture', 'معمارية الأمن')}</option>
          <option value='BUSINESS_ARCHITECTURE'>{L('Business Architecture', 'معمارية الأعمال')}</option>
          <option value='BENEFICIARY_EXPERIENCE'>{L('Beneficiary Experience', 'تجربة المستفيد')}</option>
        </select>
        <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} placeholder={L('From', 'من')} />
        <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} placeholder={L('To', 'إلى')} />
        <div style={{ marginLeft: 'auto' }}>
          <ExportBtn url={exportUrl} label='savings-report' />
        </div>
      </div>

      {/* Summary */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {[
            ['Total Opportunities', data.total, '#64748B'],
            ['Total Annual Savings', L(`SAR ${(data.totalAnnual || 0).toLocaleString('en-US')}`, `${(data.totalAnnual || 0).toLocaleString('ar')} ريال`), '#2ecc71'],
            ['Total One-time Savings', L(`SAR ${(data.totalOneTime || 0).toLocaleString('en-US')}`, `${(data.totalOneTime || 0).toLocaleString('ar')} ريال`), '#3498db'],
          ].map(([l, v, c]: any) => (
            <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 10, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>{L('Loading...', 'جارٍ التحميل...')}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)' }}>
                {[L('Review', 'المراجعة'), L('Type', 'النوع'), L('Date', 'التاريخ'), L('Finding', 'الملاحظة'), L('Domain', 'المجال'), L('Status', 'الحالة'), L('One-time (SAR)', 'لمرة واحدة (ريال)'), L('Annual (SAR)', 'سنوي (ريال)'), L('Total (SAR)', 'الإجمالي (ريال)')].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--navy-light)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item: any) => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--navy-light)' }}>
                  <td style={{ padding: '8px 12px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.review?.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{enumLabel(item.review?.reviewType, isAR)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.review?.createdAt ? new Date(item.review.createdAt).toLocaleDateString(isAR ? 'ar' : 'en-US') : ''}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{enumLabel(item.domain, isAR)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <select
                      value={item.status}
                      onChange={async e => {
                        const newStatus = e.target.value
                        const token = localStorage.getItem('ea_token') || ''
                        await fetch(`${GOV_API}/governance/reviews/${item.reviewId}/findings/${item.id}`, {
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
                      style={{ padding: '2px 6px', borderRadius: 8, border: '1px solid ' + (SEV_COLOR[item.status]||'#64748B') + '66',
                        background: (SEV_COLOR[item.status]||'#64748B') + '18', color: SEV_COLOR[item.status]||'#64748B',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
                    >
                      <option value={L('OPEN', 'مفتوحة')}>{L('OPEN', 'مفتوحة')}</option>
                      <option value={L('ACCEPTED', 'مقبولة')}>{L('ACCEPTED', 'مقبولة')}</option>
                      <option value='APPROVED'>{L('CONFIRMED', 'مؤكدة')}</option>
                      <option value={L('REJECTED', 'مرفوضة')}>{L('REJECTED', 'مرفوضة')}</option>
                      <option value='EXCEPTION_REQUESTED'>{L('EXCEPTION', 'استثناء')}</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#3498db', fontWeight: 600 }}>{item.estimatedSaving ? item.estimatedSaving.toLocaleString(isAR ? 'ar' : 'en-US') : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2ecc71', fontWeight: 600 }}>{item.annualSaving ? item.annualSaving.toLocaleString(isAR ? 'ar' : 'en-US') : '—'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: '#2ecc71' }}>{item.totalSaving ? item.totalSaving.toLocaleString(isAR ? 'ar' : 'en-US') : '—'}</td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{domain ? L('No savings in selected domain', 'لا توجد وفورات في المجال المحدد') : L('No savings found', 'لم تُرصد وفورات')}</td></tr>
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
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const nav = useNavigate()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [complianceStatus, setComplianceStatus] = useState('')
  const [reviewType, setReviewType] = useState('')
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('')
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

  // Severity filter is client-side
  const filteredCompItems = (data?.items || []).filter((i: any) => !severity || i.severity === severity)
  const exportUrl = `governance/reports/compliance/export?${new URLSearchParams({ complianceStatus, reviewType, category, dateFrom, dateTo }).toString()}`

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <select value={complianceStatus} onChange={e => setComplianceStatus(e.target.value)} style={selStyle}>
          <option value=''>{L('All Statuses', 'كل الحالات')}</option>
          <option value='NON_COMPLIANT'>{L('Non-Compliant', 'غير ممتثل')}</option>
          <option value='PARTIALLY_COMPLIANT'>{L('Partially Compliant', 'ممتثل جزئياً')}</option>
          <option value='COMPLIANT'>{L('Compliant', 'ممتثل')}</option>
          <option value='REQUIRES_EXCEPTION'>{L('Requires Exception', 'يتطلب استثناء')}</option>
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)} style={selStyle}>
          <option value=''>{L('All Categories', 'كل الفئات')}</option>
          <option value='TENANT_PRINCIPLE'>{L('Tenant Principles', 'مبادئ الجهة')}</option>
          <option value='TENANT_STANDARD'>{L('Tenant Standards', 'معايير الجهة')}</option>
          <option value='NCA_STANDARD'>{L('NCA ECC', 'الضوابط الأساسية للأمن السيبراني (NCA)')}</option>
          <option value='NDMO_STANDARD'>{L('NDMO', 'مكتب إدارة البيانات الوطنية')}</option>
          <option value='SDAIA_STANDARD'>{L('SDAIA', 'سدايا')}</option>
          <option value='DGA_STANDARD'>{L('DGA', 'هيئة الحكومة الرقمية')}</option>
        </select>
        <select value={severity} onChange={e => setSeverity(e.target.value)} style={selStyle}>
          <option value=''>{L('All Severities', 'كل درجات الخطورة')}</option>
          <option value='CRITICAL'>{L('Critical', 'حرج')}</option>
          <option value='HIGH'>{L('High', 'عالٍ')}</option>
          <option value='MEDIUM'>{L('Medium', 'متوسط')}</option>
          <option value='LOW'>{L('Low', 'منخفض')}</option>
        </select>
        <select value={reviewType} onChange={e => setReviewType(e.target.value)} style={selStyle}>
          <option value=''>{L('All Review Types', 'كل أنواع المراجعات')}</option>
          <option value='HLD_REVIEW'>{L('HLD Review', 'مراجعة التصميم رفيع المستوى')}</option>
          <option value='LLD_REVIEW'>{L('LLD Review', 'مراجعة التصميم التفصيلي')}</option>
        </select>
        <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} />
        <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} />
        <div style={{ marginLeft: 'auto' }}><ExportBtn url={exportUrl} label='compliance-register' /></div>
      </div>

      {data && (
        <div className="stat-grid-4" style={{ marginBottom: 16 }}>
          {[
            [L('Total', 'الإجمالي'), data.total, '#64748B'],
            [L('Non-Compliant', 'غير ممتثل'), data.nonCompliantCount, '#e74c3c'],
            [L('Partial', 'جزئي'), data.partialCount, '#f39c12'],
            [L('Compliant', 'ممتثل'), data.compliantCount, '#2ecc71'],
          ].map(([l, v, c]: any) => (
            <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>{L('Loading...', 'جارٍ التحميل...')}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)' }}>
                {[L('Review', 'المراجعة'), L('Type', 'النوع'), L('Date', 'التاريخ'), L('Principle / Standard', 'المبدأ / المعيار'), L('Category', 'الفئة'), L('Status', 'الحالة'), L('Gap', 'الفجوة'), ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--navy-light)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCompItems.map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--navy-light)', cursor: 'pointer' }} onClick={() => nav('/governance', { state: { reviewId: item.reviewId, tab: 'compliance' } })}>
                  <td style={{ padding: '8px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.review?.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)' }}>{enumLabel(item.review?.reviewType, isAR)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.review?.createdAt ? new Date(item.review.createdAt).toLocaleDateString(isAR ? 'ar' : 'en-US') : ''}</td>
                  <td style={{ padding: '8px 12px', maxWidth: 200 }}>{item.principleOrStandard}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{enumLabel(item.category, isAR)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: (STATUS_COLOR[item.complianceStatus]||'#64748B')+'22', color: STATUS_COLOR[item.complianceStatus]||'#64748B', whiteSpace: 'nowrap' }}>
                      {enumLabel(item.complianceStatus, isAR)}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#e74c3c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.gap}</td>
                  <td style={{ padding: '8px 12px' }}><span style={{ fontSize: 11, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{L('→ Open Review', '← فتح المراجعة')}</span></td>
                </tr>
              ))}
              {filteredCompItems.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{severity ? L('No items with selected severity', 'لا توجد عناصر بالخطورة المحددة') : L('No compliance items found', 'لا توجد عناصر امتثال')}</td></tr>
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
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
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
          <option value=''>{L('All Sources', 'كل المصادر')}</option>
          <option value='ADM'>{L('ADM Cycles', 'دورات ADM')}</option>
          <option value='GOVERNANCE'>{L('Governance Reviews', 'مراجعات الحوكمة')}</option>
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} style={selStyle}>
          <option value=''>{L('All Statuses', 'كل الحالات')}</option>
          <option value='OPEN'>{L('Open', 'مفتوحة')}</option>
          <option value='ACCEPTED'>{L('Accepted', 'مقبولة')}</option>
          <option value='APPROVED'>{L('Approved', 'معتمد')}</option>
          <option value='REJECTED'>{L('Rejected', 'مرفوضة')}</option>
          <option value='PENDING'>{L('Pending', 'قيد الانتظار')}</option>
        </select>
        <select value={domain} onChange={e => setDomain(e.target.value)} style={selStyle}>
          <option value=''>{L('All Domains', 'كل المجالات')}</option>
          <option value='SECURITY_ARCHITECTURE'>{L('Security', 'الأمن')}</option>
          <option value='DATA_ARCHITECTURE'>{L('Data', 'البيانات')}</option>
          <option value='APPLICATION_INTEGRATION'>{L('Integration', 'التكامل')}</option>
          <option value='INFRASTRUCTURE'>{L('Infrastructure', 'البنية التحتية')}</option>
          <option value='BUSINESS_ARCHITECTURE'>{L('Business', 'الأعمال')}</option>
        </select>
        <select value={reviewType} onChange={e => setReviewType(e.target.value)} style={selStyle}>
          <option value=''>{L('All Review Types', 'كل أنواع المراجعات')}</option>
          <option value='HLD_REVIEW'>{L('HLD Review', 'مراجعة التصميم رفيع المستوى')}</option>
          <option value='LLD_REVIEW'>{L('LLD Review', 'مراجعة التصميم التفصيلي')}</option>
        </select>
        <input type='date' value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={selStyle} />
        <input type='date' value={dateTo} onChange={e => setDateTo(e.target.value)} style={selStyle} />
        <div style={{ marginLeft: 'auto' }}><ExportBtn url={exportUrl} label='ea-requirements' /></div>
      </div>

      {data && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            [L('Total', 'الإجمالي'), data.total, '#64748B'],
            [L('From ADM', 'من ADM'), data.admCount, '#3498db'],
            [L('From Governance', 'من الحوكمة'), data.governanceCount, '#9b59b6'],
          ].map(([l, v, c]: any) => (
            <div key={l} style={{ background: c + '18', border: '1px solid ' + c + '44', borderRadius: 8, padding: '8px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>{L('Loading...', 'جارٍ التحميل...')}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)' }}>
                {[L('Source', 'المصدر'), L('Title', 'العنوان'), L('Type', 'النوع'), L('Domain', 'المجال'), L('Priority', 'الأولوية'), L('Status', 'الحالة'), L('Review / Cycle', 'المراجعة / الدورة'), L('Date', 'التاريخ')].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--navy-light)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.items || []).map((item: any, i: number) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--navy-light)' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: item.source === 'ADM' ? '#3498db22' : '#9b59b622', color: item.source === 'ADM' ? '#3498db' : '#9b59b6' }}>{item.source === 'ADM' ? 'ADM' : L('Governance', 'الحوكمة')}</span>
                  </td>
                  <td style={{ padding: '8px 12px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{isAR ? (item.titleAr || item.title) : item.title}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{enumLabel(item.type, isAR)}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11 }}>{enumLabel(item.domain, isAR)}</td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, background: (SEV_COLOR[item.priority]||'#64748B')+'22', color: SEV_COLOR[item.priority]||'#64748B' }}>{enumLabel(item.priority, isAR)}</span>
                  </td>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ padding: '2px 6px', borderRadius: 6, fontSize: 11, background: (SEV_COLOR[item.status]||'#64748B')+'22', color: SEV_COLOR[item.status]||'#64748B' }}>{enumLabel(item.status, isAR)}</span>
                  </td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reviewName}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(isAR ? 'ar' : 'en-US') : ''}</td>
                </tr>
              ))}
              {(!data?.items?.length) && (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>{L('No requirements found', 'لا توجد متطلبات')}</td></tr>
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
        <div style={{ fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center' }}>{isAR ? '📊 التقارير' : '📊 Reports'}{!isAR && <HelpTip text="A combined view across all your governance reviews - see patterns in findings, track compliance over time, and export summaries." />}</div>
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


