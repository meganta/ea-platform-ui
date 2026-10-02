import { useEffect, useState, useCallback, CSSProperties } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'

interface DemoRequest {
  id: string
  fullName: string
  organization: string
  jobTitle: string
  email: string
  phone: string | null
  country: string
  preferredLanguage: string
  message: string
  createdAt: string
}

const th: CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }
const td: CSSProperties = { padding: '10px 14px', verticalAlign: 'top' }

export default function DemoRequestsPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [requests, setRequests] = useState<DemoRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Backend already returns these ordered newest-first
      // (orderBy: { createdAt: 'desc' }) - no client-side sort needed.
      const data = await api.listDemoRequests()
      setRequests(data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const formatDate = (iso: string) => new Date(iso).toLocaleString(isAR ? 'ar' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div style={{ padding: '20px 28px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>📨 {L('Demo Requests', 'طلبات العرض التوضيحي')} ({requests.length})</h1>
        <button onClick={load} style={{ padding: '8px 16px', background: 'var(--navy-mid)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>
          ↻ {L('Refresh', 'تحديث')}
        </button>
      </div>

      {error && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: 'rgba(220,38,38,0.08)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.2)' }}>
          {error}
        </div>
      )}

      {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : requests.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>
          {L('No demo requests yet.', 'لا توجد طلبات عرض توضيحي بعد.')}
        </div>
      ) : (
        <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)' }}>
                <th style={th}>{L('Submitted', 'تاريخ الإرسال')}</th>
                <th style={th}>{L('Name', 'الاسم')}</th>
                <th style={th}>{L('Organization', 'الجهة')}</th>
                <th style={th}>{L('Job Title', 'المسمى الوظيفي')}</th>
                <th style={th}>{L('Email', 'البريد الإلكتروني')}</th>
                <th style={th}>{L('Phone', 'الهاتف')}</th>
                <th style={th}>{L('Country', 'الدولة')}</th>
                <th style={th}>{L('Language', 'اللغة')}</th>
                <th style={th}>{L('Message', 'الرسالة')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: i < requests.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{formatDate(r.createdAt)}</td>
                  <td style={td}>{r.fullName}</td>
                  <td style={td}>{r.organization}</td>
                  <td style={td}>{r.jobTitle}</td>
                  <td style={td}><a href={`mailto:${r.email}`} style={{ color: 'var(--accent)' }}>{r.email}</a></td>
                  <td style={td}>{r.phone || '—'}</td>
                  <td style={td}>{r.country}</td>
                  <td style={td}>{/^ar/i.test(r.preferredLanguage) ? L('Arabic', 'العربية') : /^en/i.test(r.preferredLanguage) ? L('English', 'الإنجليزية') : r.preferredLanguage}</td>
                  <td style={{ ...td, maxWidth: 320, whiteSpace: 'pre-wrap' }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
