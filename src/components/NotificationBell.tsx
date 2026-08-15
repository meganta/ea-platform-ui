import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const POLL_INTERVAL_MS = 30000

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (p: string) => fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    return { get, post }
  }, [])
}

const SEVERITY_COLOR: Record<string, string> = {
  INFORMATIONAL: '#3498db', SUCCESS: '#2ecc71', REMINDER: '#7f8c8d', WARNING: '#f39c12',
  HIGH: '#e67e22', CRITICAL: '#e74c3c', ACTION_REQUIRED: '#e74c3c',
}

function timeAgo(iso: string, isAR: boolean) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return isAR ? 'الآن' : 'just now'
  if (mins < 60) return isAR ? `قبل ${mins} د` : `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return isAR ? `قبل ${hours} س` : `${hours}h ago`
  const days = Math.floor(hours / 24)
  return isAR ? `قبل ${days} يوم` : `${days}d ago`
}

export default function NotificationBell() {
  const api = useApi()
  const { t, isAR } = useLang()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(() => {
    if (!localStorage.getItem('ea_token')) return
    api.get('/notifications/unread-count').then((d: any) => setUnreadCount(d?.count ?? 0)).catch(() => {})
  }, [api])

  useEffect(() => {
    refreshCount()
    const id = setInterval(refreshCount, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refreshCount])

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onEscape) }
  }, [open])

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      api.get('/notifications?limit=8').then((d: any) => { setItems(Array.isArray(d) ? d : []); setLoaded(true) })
    }
  }

  const openItem = async (n: any) => {
    if (!n.isRead) {
      await api.post(`/notifications/${n.id}/read`)
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
      setUnreadCount(c => Math.max(0, c - 1))
    }
    setOpen(false)
    if (n.actionUrl) nav(n.actionUrl)
  }

  const markAllRead = async () => {
    await api.post('/notifications/read-all')
    setItems(prev => prev.map(x => ({ ...x, isRead: true })))
    setUnreadCount(0)
  }

  return (
    <div ref={ref} style={{ position: 'fixed', top: 12, insetInlineEnd: 12, zIndex: 120 }}>
      <button
        type="button"
        aria-label={t('notif.bell_label')}
        onClick={toggle}
        style={{
          position: 'relative', width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
          background: 'var(--navy-light)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, insetInlineEnd: -4, minWidth: 16, height: 16, borderRadius: 8,
            background: '#e74c3c', color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: '16px',
            padding: '0 4px', textAlign: 'center' as const,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" style={{
          position: 'absolute', top: 42, insetInlineEnd: 0, width: 320, maxWidth: '85vw',
          background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{t('notif.title')}</div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer' }}>{t('notif.mark_all_read')}</button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center' as const, fontSize: 12, color: 'var(--text-dim)' }}>{t('notif.no_notifications')}</div>
            ) : items.map((n: any) => (
              <div key={n.id} onClick={() => openItem(n)} style={{
                padding: '10px 14px', display: 'flex', gap: 8, cursor: 'pointer',
                borderBottom: '1px solid var(--border)', background: n.isRead ? 'transparent' : 'rgba(0,180,216,0.06)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEVERITY_COLOR[n.severity] || '#7f8c8d', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: n.isRead ? 400 : 600 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{n.body}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>{timeAgo(n.createdAt, isAR)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' as const }}>
            <button onClick={() => { setOpen(false); nav('/notifications') }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>{t('notif.view_all')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
