import { Fragment, useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'
import { tenantInviteUrl } from '../lib/tenantHosts'

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

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
  SUPERADMIN: 'Super Admin',
}

const ROLE_COLORS: Record<string, string> = {
  ARCHITECT: 'badge-active',
  REVIEWER: 'badge-review',
  TENANT_ADMIN: 'badge-approved',
}

/** An Access Governance role (Access Governance > Roles). */
interface TenantRole { id: string; code?: string; name: string; nameAr?: string | null; isActive?: boolean }

/** Pick Access Governance roles; the list comes from Access Governance > Roles. */
function RolePicker({ roles, value, onChange, idPrefix, t, isAR }: { roles: TenantRole[]; value: string[]; onChange: (ids: string[]) => void; idPrefix: string; t: (k: string) => string; isAR: boolean }) {
  if (!roles.length) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('users.no_ag_roles') || 'No roles are defined yet. Add them in Access Governance > Roles.'}</div>
  return (
    <div role="group" aria-labelledby={`${idPrefix}-label`} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)' }}>
      {roles.map(r => (
        <label key={r.id} htmlFor={`${idPrefix}-${r.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
          <input id={`${idPrefix}-${r.id}`} type="checkbox" checked={value.includes(r.id)} onChange={e => onChange(e.target.checked ? [...value, r.id] : value.filter(x => x !== r.id))} />
          {(isAR && r.nameAr) || r.name}
        </label>
      ))}
    </div>
  )
}

const roleNames = (ids: string[] | undefined, roles: TenantRole[], isAR: boolean) =>
  (ids || []).map(id => roles.find(r => r.id === id)).filter(Boolean).map(r => (isAR && r!.nameAr) || r!.name)

/** Users of the tenant. Lives inside Access Governance (Users tab, `embedded`); the old /settings/users and /users addresses redirect there. */
export default function UsersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, isAR } = useLang() as any
  const { hasPermission, user } = useAuth()
  // Tenant administrators: legacy TENANT_ADMIN / SUPERADMIN, or a role granting Tenant.Administer.
  const isAdmin = hasPermission('Tenant.Administer')
  const canSeeAccess = hasPermission('Roles.View')
  const [effective, setEffective] = useState<{ userId: string; perms: any[] } | null>(null)
  const api = useApi()
  const [users, setUsers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'users' | 'invitations'>('users')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [resettingUser, setResettingUser] = useState<any>(null)
  const [inviteForm, setInviteForm] = useState<{ email: string; fullName: string; role: string; tenantRoleIds: string[] }>({ email: '', fullName: '', role: 'ARCHITECT', tenantRoleIds: [] })
  const [createForm, setCreateForm] = useState<{ email: string; fullName: string; password: string; role: string; tenantRoleIds: string[] }>({ email: '', fullName: '', password: '', role: 'ARCHITECT', tenantRoleIds: [] })
  // Roles come from Access Governance > Roles (active ones).
  const [tenantRoles, setTenantRoles] = useState<TenantRole[]>([])
  const [resetPassword, setResetPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  // What happened to the last invitation: emailed, or the link to share by hand.
  const [inviteResult, setInviteResult] = useState<{ email: string; inviteUrl: string; delivery: { status: string; error?: string } } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)

  const canInvite = hasPermission('Users.Invite')
  const canEdit = hasPermission('Users.Edit')
  const canDisable = hasPermission('Users.Disable')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [u, i] = await Promise.all([api.get('/users'), api.get('/users/invitations')])
      setUsers(Array.isArray(u) ? u : [])
      setInvitations(Array.isArray(i) ? i : [])
      const roles = await api.get('/access-governance/roles').catch(() => [])
      setTenantRoles((Array.isArray(roles) ? roles : []).filter((r: TenantRole) => r.isActive !== false))
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

  const showInviteResult = (result: any) => {
    setInviteResult({ email: result.email, inviteUrl: tenantInviteUrl(result.inviteUrl, user?.tenantSlug), delivery: result.emailDelivery || { status: 'NOT_CONFIGURED' } })
    setLinkCopied(false)
    setShowInviteModal(true)
  }

  const inviteUser = async () => {
    if (!inviteForm.email) { showMsg(t('users.invite_email_required') || 'Email is required', true); return }
    if (tenantRoles.length && !inviteForm.tenantRoleIds.length) { showMsg(t('users.role_required') || 'Choose at least one role', true); return }
    try {
      const result = await api.post('/users/invite', inviteForm)
      showInviteResult(result)
      setInviteForm({ email: '', fullName: '', role: 'ARCHITECT', tenantRoleIds: [] })
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  // A repeated invite renews the link (the old one stops working) and emails the new one.
  const resendInvitation = async (inv: any) => {
    try {
      const result = await api.post('/users/invite', { email: inv.email, role: inv.role, tenantRoleIds: inv.tenantRoleIds || [], ...(inv.fullName ? { fullName: inv.fullName } : {}) })
      showInviteResult(result)
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const closeInviteModal = () => { setShowInviteModal(false); setInviteResult(null) }

  const createUser = async () => {
    if (!createForm.email || !createForm.password) { showMsg(t('users.email_password_required') || 'Email and password are required', true); return }
    if (tenantRoles.length && !createForm.tenantRoleIds.length) { showMsg(t('users.role_required') || 'Choose at least one role', true); return }
    try {
      await api.post('/users', createForm)
      showMsg('User created successfully')
      setShowCreateModal(false)
      setCreateForm({ email: '', fullName: '', password: '', role: 'ARCHITECT', tenantRoleIds: [] })
      load()
    } catch (e: any) { showMsg(e.message, true) }
  }

  const updateUser = async () => {
    if (!editingUser) return
    try {
      const original = users.find(x => x.id === editingUser.id) || {}
      await api.put(`/users/${editingUser.id}`, {
        fullName: editingUser.fullName, isActive: editingUser.isActive,
        ...(editingUser.email && editingUser.email !== original.email ? { email: editingUser.email } : {}),
        ...(editingUser.role !== original.role ? { role: editingUser.role } : {}),
      })
      // Access Governance roles: assign the added ones, remove the dropped ones (each audited there).
      const before: string[] = (original.tenantRoles || []).map((r: TenantRole) => r.id)
      const after: string[] = editingUser.tenantRoleIds || before
      for (const id of after.filter(x => !before.includes(x))) await api.post(`/access-governance/roles/${id}/assign`, { userId: editingUser.id, reason: 'Assigned in Settings > Users' })
      for (const id of before.filter(x => !after.includes(x))) await api.del(`/access-governance/roles/${id}/assign/${editingUser.id}`)
      showMsg(t('users.updated') || 'User updated')
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

  const deleteUserPermanently = async (u: any) => {
    if (!window.confirm((t('users.confirm_delete_permanent') || 'Delete {email} permanently? The account and its role assignments are removed and cannot be restored. Audit history is kept.').replace('{email}', u.email))) return
    try {
      await api.del(`/users/${u.id}/permanent`)
      showMsg((t('users.deleted') || '{email} was deleted').replace('{email}', u.email))
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

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }

  // The link carries the invitation's secret token, so it is fetched from the API (never built from the id).
  const copyInviteLink = async (inv: any) => {
    try {
      const r = await api.get(`/users/invitations/${inv.id}/link`)
      if (!r?.inviteUrl) throw new Error(r?.message || 'Invitation not found')
      if (r.expired) { showMsg(t('users.invite_link_expired') || 'This invitation has expired. Use Resend to send a new link.', true); return }
      const url = tenantInviteUrl(r.inviteUrl, user?.tenantSlug)
      if (await copyText(url)) showMsg(t('users.invite_link_copied') || 'Invite link copied to clipboard')
      else showInviteResult({ email: inv.email, inviteUrl: url, emailDelivery: { status: 'LINK_ONLY' } })
    } catch (e: any) { showMsg(e.message, true) }
  }

  const toggleEffective = async (userId: string) => {
    if (effective?.userId === userId) { setEffective(null); return }
    try {
      const perms = await api.get(`/access-governance/users/${userId}/effective-permissions`)
      setEffective({ userId, perms: Array.isArray(perms) ? perms : [] })
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div style={embedded ? undefined : { padding: '20px 28px', height: '100%', overflow: 'auto' }} dir={isAR ? 'rtl' : 'ltr'}>
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>👥 {t('users.title') || 'Users'}</h1>
          <HelpTip text={t('users.help') || 'Manage users in your tenant. Invite new users by email, or create them directly. Deactivate users who no longer need access.'} />
        </div>
      )}

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
            <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--navy-mid)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.name') || 'Name'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.email') || 'Email'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.ag_roles') || 'Roles'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.access_level') || 'Access level'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.status') || 'Status'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.last_login') || 'Last Login'}</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-dim)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('users.actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <Fragment key={u.id}>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 500 }}>{u.fullName || u.email}</div>
                        {u.fullNameAr && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.fullNameAr}</div>}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)' }}>{u.email}</td>
                      <td style={{ padding: '10px 14px' }} data-testid={`user-roles-${u.id}`}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(u.tenantRoles || []).length ? (u.tenantRoles || []).map((r: TenantRole) => <span key={r.id} className="badge badge-active">{(isAR && r.nameAr) || r.name}</span>)
                            : <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('users.no_roles') || 'No role'}</span>}
                        </div>
                      </td>
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
                          {canSeeAccess && (
                            <button type="button" aria-expanded={effective?.userId === u.id} onClick={() => toggleEffective(u.id)} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                              {t('users.effective_access')}
                            </button>
                          )}
                          {canEdit && (
                            <button onClick={() => setEditingUser({ ...u, tenantRoleIds: (u.tenantRoles || []).map((r: TenantRole) => r.id) })} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
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
                          {isAdmin && canDisable && u.id !== user?.userId && (
                            <button onClick={() => deleteUserPermanently(u)} aria-label={`${t('users.delete_permanent') || 'Delete permanently'} ${u.email}`} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--danger)', border: '1px solid var(--danger)', color: '#fff', borderRadius: 4, cursor: 'pointer' }}>
                              🗑 {t('users.delete_permanent') || 'Delete permanently'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {effective && effective.userId === u.id && (
                      <tr data-testid={`user-effective-${u.id}`}>
                        <td colSpan={7} style={{ padding: '10px 14px', fontSize: 12, background: 'var(--navy)' }}>
                          {effective.perms.length === 0 ? <span style={{ color: 'var(--text-dim)' }}>{t('users.effective_none')}</span> : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {effective.perms.map((p: any, i: number) => (
                                <span key={i} className="badge badge-draft" title={`${t('users.effective_via')} ${p.source}${p.domainScope?.length ? ` · ${p.domainScope.join(', ')}` : ''}`}>{p.code}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim)' }}>{t('users.no_users') || 'No users yet.'}</td></tr>
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
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          {roleNames(inv.tenantRoleIds, tenantRoles, isAR).map(n => <span key={n} className="badge badge-active">{n}</span>)}
                          <span className={`badge ${ROLE_COLORS[inv.role] || 'badge-draft'}`}>{ROLE_LABELS[inv.role] || inv.role}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 12 }}>{new Date(inv.expiresAt).toLocaleDateString()}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-progress">{t('users.pending') || 'Pending'}</span></td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button onClick={() => copyInviteLink(inv)} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                            📋 {t('users.copy_link') || 'Copy Link'}
                          </button>
                          {canInvite && (
                            <button onClick={() => resendInvitation(inv)} title={t('users.resend_help') || 'Sends a new link; the previous link stops working.'} style={{ padding: '4px 10px', fontSize: 11, background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer' }}>
                              ✉️ {t('users.resend') || 'Resend'}
                            </button>
                          )}
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
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center' }}>✉️ {t('users.invite_title') || 'Invite User'}<HelpTip text={t('users.invite_help') || 'The person receives an email with a link to create their account. If no email sender is configured for the platform, copy the link and send it yourself. A link works once and expires after 72 hours.'} /></h3>
            {inviteResult ? (
              <div data-testid="invite-result">
                <div role="status" style={{ padding: '10px 12px', borderRadius: 'var(--radius)', fontSize: 13, marginBottom: 12, border: '1px solid', ...(inviteResult.delivery.status === 'SENT' ? { borderColor: 'rgba(22,163,74,0.35)', background: 'rgba(22,163,74,0.08)' } : { borderColor: 'rgba(217,119,6,0.35)', background: 'rgba(217,119,6,0.08)' }) }}>
                  {inviteResult.delivery.status === 'SENT' && (t('users.invite_sent') || 'An invitation email was sent to {email}.').replace('{email}', inviteResult.email)}
                  {inviteResult.delivery.status === 'NOT_CONFIGURED' && (t('users.invite_not_emailed') || 'The invitation for {email} was created, but no email was sent: the platform has no email sender configured. Copy the link below and send it to the person.').replace('{email}', inviteResult.email)}
                  {inviteResult.delivery.status === 'FAILED' && `${(t('users.invite_email_failed') || 'The invitation for {email} was created, but the email could not be sent. Copy the link below and send it to the person.').replace('{email}', inviteResult.email)}${inviteResult.delivery.error ? ` (${inviteResult.delivery.error})` : ''}`}
                  {inviteResult.delivery.status === 'LINK_ONLY' && (t('users.invite_link_for') || 'Invitation link for {email}:').replace('{email}', inviteResult.email)}
                </div>
                <label htmlFor="invite-link" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.invite_link') || 'Invitation link'}</label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  <input id="invite-link" readOnly dir="ltr" value={inviteResult.inviteUrl} onFocus={e => e.currentTarget.select()} style={{ flex: '1 1 220px', minWidth: 0, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 12 }} />
                  <button onClick={async () => setLinkCopied(await copyText(inviteResult.inviteUrl))} style={{ padding: '8px 12px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, cursor: 'pointer' }}>
                    {linkCopied ? `✓ ${t('users.copied') || 'Copied'}` : `📋 ${t('users.copy_link') || 'Copy Link'}`}
                  </button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={closeInviteModal} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('users.done') || 'Done'}</button>
                </div>
              </div>
            ) : (<>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="invite-email" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.email') || 'Email'} *</label>
              <input id="invite-email" type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="user@example.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="invite-name" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.full_name') || 'Full Name'}</label>
              <input id="invite-name" type="text" value={inviteForm.fullName} onChange={e => setInviteForm({ ...inviteForm, fullName: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="John Doe" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div id="invite-roles-label" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.ag_roles') || 'Roles'}{tenantRoles.length ? ' *' : ''}<HelpTip text={t('users.ag_roles_help') || 'Roles come from Access Governance > Roles, where their permissions are defined. The person gets the roles you choose here.'} /></div>
              <RolePicker roles={tenantRoles} value={inviteForm.tenantRoleIds} onChange={ids => setInviteForm({ ...inviteForm, tenantRoleIds: ids })} idPrefix="invite-roles" t={t} isAR={!!isAR} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="invite-role" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.access_level') || 'Access level'}<HelpTip text={t('users.access_level_help') || 'Platform-wide access: Tenant Admin can manage settings and users; Architect and Reviewer cannot. Detailed permissions come from the roles above.'} /></label>
              <select id="invite-role" value={inviteForm.role} onChange={e => setInviteForm({ ...inviteForm, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }}>
                <option value="ARCHITECT">{t('users.role_architect') || 'Architect'}</option>
                <option value="REVIEWER">{t('users.role_reviewer') || 'Reviewer'}</option>
                <option value="TENANT_ADMIN">{t('users.role_admin') || 'Tenant Admin'}</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={closeInviteModal} style={{ padding: '8px 16px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, cursor: 'pointer' }}>{t('users.cancel') || 'Cancel'}</button>
              <button onClick={inviteUser} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>{t('users.send_invite') || 'Send Invitation'}</button>
            </div>
            </>)}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--navy-light)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', width: 420, maxWidth: '90vw', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>➕ {t('users.create_title') || 'Create User'}</h3>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="create-email" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.email') || 'Email'} *</label>
              <input id="create-email" type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="user@example.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="create-name" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.full_name') || 'Full Name'}</label>
              <input id="create-name" type="text" value={createForm.fullName} onChange={e => setCreateForm({ ...createForm, fullName: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="John Doe" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="create-password" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.password') || 'Password'} *</label>
              <input id="create-password" type="password" value={createForm.password} onChange={e => setCreateForm({ ...createForm, password: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} placeholder="Min 8 characters" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div id="create-roles-label" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.ag_roles') || 'Roles'}{tenantRoles.length ? ' *' : ''}<HelpTip text={t('users.ag_roles_help') || 'Roles come from Access Governance > Roles, where their permissions are defined. The person gets the roles you choose here.'} /></div>
              <RolePicker roles={tenantRoles} value={createForm.tenantRoleIds} onChange={ids => setCreateForm({ ...createForm, tenantRoleIds: ids })} idPrefix="create-roles" t={t} isAR={!!isAR} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="create-role" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.access_level') || 'Access level'}<HelpTip text={t('users.access_level_help') || 'Platform-wide access: Tenant Admin can manage settings and users; Architect and Reviewer cannot. Detailed permissions come from the roles above.'} /></label>
              <select id="create-role" value={createForm.role} onChange={e => setCreateForm({ ...createForm, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }}>
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
              <label htmlFor="edit-name" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.full_name') || 'Full Name'}</label>
              <input id="edit-name" type="text" value={editingUser.fullName || ''} onChange={e => setEditingUser({ ...editingUser, fullName: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="edit-email" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.email') || 'Email'}</label>
              <input id="edit-email" type="email" dir="ltr" value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div id="edit-roles-label" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.ag_roles') || 'Roles'}<HelpTip text={t('users.ag_roles_help') || 'Roles come from Access Governance > Roles, where their permissions are defined. The person gets the roles you choose here.'} /></div>
              <RolePicker roles={tenantRoles} value={editingUser.tenantRoleIds || []} onChange={ids => setEditingUser({ ...editingUser, tenantRoleIds: ids })} idPrefix="edit-roles" t={t} isAR={!!isAR} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="edit-role" style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4, color: 'var(--text-dim)' }}>{t('users.access_level') || 'Access level'}<HelpTip text={t('users.access_level_help') || 'Platform-wide access: Tenant Admin can manage settings and users; Architect and Reviewer cannot. Detailed permissions come from the roles above.'} /></label>
              <select id="edit-role" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', background: 'var(--navy)', fontSize: 13 }}>
                {!['ARCHITECT', 'REVIEWER', 'TENANT_ADMIN'].includes(editingUser.role) && <option value={editingUser.role}>{ROLE_LABELS[editingUser.role] || editingUser.role}</option>}
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
