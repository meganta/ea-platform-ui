import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const put = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const del = (path: string) => fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(r => r.ok ? null : r.json().then(d => { throw new Error(d.message || `HTTP ${r.status}`) }))
    return { get, post, put, del }
  }, [])
}

const ROLE_LABELS: Record<string, string> = {
  ARCHITECT: 'Architect',
  REVIEWER: 'Reviewer',
  TENANT_ADMIN: 'Tenant Admin',
}

const ROLE_COLORS: Record<string, string> = {
  ARCHITECT: 'badge-active',
  REVIEWER: 'badge-review',
  TENANT_ADMIN: 'badge-approved',
}

export default function UsersPage() {
  const { t, locale } = useLang()
  const { hasPermission } = useAuth()
  const api = useApi()
  const [users, setUsers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'invitations'>('users')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [resettingUser, setResettingUser] = useState<any>(null)
  const [inviteForm, setInviteForm] = useState({ email: '', fullName: '', role: 'ARCHITECT' })
  const [createForm, setCreateForm] = useState({ email: '', fullName: '', password: '', role: 'ARCHITECT' })
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canInvite = hasPermission('Users.Invite')
  const canEdit = hasPermission('Users.Edit')
  const canDisable = hasPermission('Users.Disable')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, i] = await Promise.all([api.get('/users'), api.get('/users/invitations')])
      setUsers(u || [])
      setInvitations(i || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => { load() }, [load])

  const showMsg = (msg: string, isError = false) => {
    if (isError) { setError(msg); setSuccess(null) } else { setSuccess(msg); setError(null) }
    setTimeout(() => { setError(null); setSuccess(null) }, 5000)
  }

  const inviteUser = async () => {
    if (!inviteForm.email) { showMsg('Email is required', true); return }
    try {
      const result = await api.post('/users/invite', inviteForm)
      showMsg(`Invitation sent to ${result.email}. Link: ${result.inviteUrl}`)
      setShowInviteModal(false)
      setInviteForm({ email: '', fullName: '', role: 'ARCHITECT' })
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const createUser = async () => {
    if (!createForm.email || !createForm.password) { showMsg('Email and password are required', true); return }
    try {
      await api.post('/users', createForm)
      showMsg('User created successfully')
      setShowCreateModal(false)
      setCreateForm({ email: '', fullName: '', password: '', role: 'ARCHITECT' })
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const updateUser = async () => {
    if (!editingUser) return
    try {
      await api.put(`/users/${editingUser.id}`, { role: editingUser.role, isActive: editingUser.isActive, fullName: editingUser.fullName })
      showMsg('User updated')
      setEditingUser(null)
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const doResetPassword = async () => {
    if (!resettingUser || !resetPassword) return
    try {
      await api.put(`/users/${resettingUser.id}/password`, { newPassword: resetPassword })
      showMsg('Password reset successfully')
      setResettingUser(null)
      setResetPassword('')
    } catch (e: any) { showMsg(e.message, true) }
  }

  const deactivateUser = async (id: string) => {
    if (!window.confirm(t('users.confirm_deactivate') || 'Deactivate this user?')) return
    try {
      await api.del(`/users/${id}`)
      showMsg('User deactivated')
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const cancelInvitation = async (id: string) => {
    if (!window.confirm(t('users.confirm_cancel_invite') || 'Cancel this invitation?')) return
    try {
      await api.del(`/users/invitations/${id}`)
      showMsg('Invitation cancelled')
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const copyInviteLink = (url: string) => {
    navigator.clipboard.writeText(url)
    showMsg('Invite link copied to clipboard')
  }

  return (
    <div style={{ padding: '20px 28px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>👥 {t('users.title') || 'Users'}</h1>
        <HelpTip text={t('users.help') || 'Manage users in your tenant. Invite new users by email, or create them directly. Deactivate users who no longer need access.'} />
      </div>

      {(error || success) && (
        <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16, background: error ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)', color: error ? 'var(--danger)' : 'var(--success)', border: `1px solid ${error ? 'rgba(220,38,38,0.2)' : 'rgba(22,163,74,0.2)'}` }}>
          {error || success}
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        <button onClick={() => setTab('users')} style={{ padding: '10px 16px', fontSize: 13, fontWeight: tab === 'users' ? 600 : 400, color: tab === 'users' ? 'var(--accent)' : 'var(--text-dim)', borderBottom: tab === 'users' ? '2px solid var(--accent)' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}>
          {t('users.tab_users') || 'Active Users'} ({users.length})
        </button>
        <button onClick={() => setTab('invitations')} style={{ padding: '10px 16px', fontSize: 13, fontWeight: tab === 'invitations' ? 600 : 400, color: tab === 'invitations' ? 'var(--accent)' : 'var(--text-dim)', borderBottom: tab === 'invitations' ? '2px solid var(--accent)' : '2px solid transparent', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer' }}>
          {t('users.tab_invitations') || 'Pending Invitations'} ({invitations.length})
        </button>
      </div>

      {tab === 'users' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {canInvite && (
              <>
                <button onClick={() => setShowInviteModal(true)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                  ✉️ {t('users.invite') || 'Invite by Email'}
                </button>
                <button onClick={() => setShowCreateModal(true)} style={{ padding: '8px 16px', background: 'var(--navy-mid)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>
                  ➕ {t('users.create') || 'Create User'}
                </button>
              </>
            )}
          </div>

          {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
            <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.name') || 'Name'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.email') || 'Email'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.role') || 'Role'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.status') || 'Status'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.last_login') || 'Last Login'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 500 }}>{u.fullName || u.email}</div>
                        {u.fullNameAr && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.fullNameAr}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${ROLE_COLORS[u.role] || 'badge-draft'}`}>{ROLE_LABELS[u.role] || u.role}</span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className={`badge ${u.isActive ? 'badge-approved' : 'badge-draft'}`}>{u.isActive ? (t('users.active') || 'Active') : (t('users.inactive') || 'Inactive')}</span>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 12 }}>
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {canEdit && (
                            <button onClick={() => setEditingUser({ ...u })} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                              {t('users.edit') || 'Edit'}
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => setResettingUser(u)} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                              {t('users.reset_pw') || 'Reset PW'}
                            </button>
                          )}
                          {canDisable && u.isActive && (
                            <button onClick={() => deactivateUser(u.id)} style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--danger)', borderRadius: 4, cursor: 'pointer' }}>
                              {t('users.deactivate') || 'Deactivate'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>{t('users.no_users') || 'No users yet.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'invitations' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {canInvite && (
              <button onClick={() => setShowInviteModal(true)} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                ✉️ {t('users.invite') || 'Invite by Email'}
              </button>
            )}
          </div>
          {loading ? <div className="spinner" style={{ margin: '40px auto' }} /> : (
            <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>{t('users.email') || 'Email'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>{t('users.role') || 'Role'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>{t('users.expires') || 'Expires'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>{t('users.status') || 'Status'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase' }}>{t('users.actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>{inv.email}</td>
                      <td style={{ padding: '10px 14px' }}><span className={`badge ${ROLE_COLORS[inv.role] || 'badge-draft'}`}>{ROLE_LABELS[inv.role] || inv.role}</span></td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 12 }}>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-progress">{t('users.pending') || 'Pending'}</span></td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => copyInviteLink(`${window.location.origin}/invite/${inv.token || inv.id}`)} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                            📋 {t('users.copy_link') || 'Copy Link'}
                          </button>
                          <button onClick={() => cancelInvitation(inv.id)} style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: 'var(--danger)', borderRadius: 4, cursor: 'pointer' }}>
                            {t('users.cancel') || 'Cancel'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {invitations.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>{t('users.no_invitations') || 'No pending invitations.'}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 420, maxWidth: '90vw', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>✉️ {t('users.invite_title') || 'Invite User'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.email') || 'Email'} *</label>
              <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="user@example.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.full_name') || 'Full Name'}</label>
              <input type="text" value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="John Doe" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.role') || 'Role'}</label>
              <select value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }}>
                <option value="ARCHITECT">{t('users.role_architect') || 'Architect'}</option>
                <option value="REVIEWER">{t('users.role_reviewer') || 'Reviewer'}</option>
                <option value="TENANT_ADMIN">{t('users.role_admin') || 'Tenant Admin'}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowInviteModal(false)} style={{ padding: '8px 16px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>{t('users.cancel') || 'Cancel'}</button>
              <button onClick={inviteUser} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('users.send_invite') || 'Send Invitation'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 420, maxWidth: '90vw', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>➕ {t('users.create_title') || 'Create User'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.email') || 'Email'} *</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="user@example.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.full_name') || 'Full Name'}</label>
              <input type="text" value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="John Doe" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.password') || 'Password'} *</label>
              <input type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="Min 8 characters" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.role') || 'Role'}</label>
              <select value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }}>
                <option value="ARCHITECT">{t('users.role_architect') || 'Architect'}</option>
                <option value="REVIEWER">{t('users.role_reviewer') || 'Reviewer'}</option>
                <option value="TENANT_ADMIN">{t('users.role_admin') || 'Tenant Admin'}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: '8px 16px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>{t('users.cancel') || 'Cancel'}</button>
              <button onClick={createUser} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('users.create') || 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 420, maxWidth: '90vw', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>✏️ {t('users.edit_title') || 'Edit User'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.full_name') || 'Full Name'}</label>
              <input type="text" value={editingUser.fullName || ''} onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.role') || 'Role'}</label>
              <select value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }}>
                <option value="ARCHITECT">{t('users.role_architect') || 'Architect'}</option>
                <option value="REVIEWER">{t('users.role_reviewer') || 'Reviewer'}</option>
                <option value="TENANT_ADMIN">{t('users.role_admin') || 'Tenant Admin'}</option>
              </select>
            </div>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="active" checked={editingUser.isActive} onChange={e => setEditingUser({ ...editingUser, isActive: e.target.checked })} style={{ cursor: 'pointer' }} />
              <label htmlFor="active" style={{ fontSize: 13, cursor: 'pointer' }}>{t('users.active') || 'Active'}</label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditingUser(null)} style={{ padding: '8px 16px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>{t('users.cancel') || 'Cancel'}</button>
              <button onClick={updateUser} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('users.save') || 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 420, maxWidth: '90vw', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>🔑 {t('users.reset_title') || 'Reset Password'}</h3>
            <p style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-dim)' }}>{t('users.reset_for') || 'Reset password for'} <strong>{resettingUser.email}</strong></p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.new_password') || 'New Password'} *</label>
              <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="Min 8 characters" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setResettingUser(null); setResetPassword('') }} style={{ padding: '8px 16px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>{t('users.cancel') || 'Cancel'}</button>
              <button onClick={doResetPassword} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('users.reset') || 'Reset'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
