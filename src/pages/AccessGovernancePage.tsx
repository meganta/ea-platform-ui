import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (path: string) => fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const patch = (path: string, body?: any) => fetch(`${API_URL}${path}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(r => r.json())
    const del = (path: string) => fetch(`${API_URL}${path}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    return { get, post, patch, del }
  }, [])
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)', flexWrap: 'wrap' as const },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  statCard: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  row: { display: 'flex', alignItems: 'center', gap: 12 },
  th: { textAlign: 'left' as const, fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, padding: '8px 10px', borderBottom: '1px solid var(--border)' },
  td: { fontSize: 13, padding: '8px 10px', borderBottom: '1px solid var(--border)' },
}

const RISK_COLORS: Record<string, string> = { NORMAL: '#64748B', SENSITIVE: '#f39c12', PRIVILEGED: '#e67e22', CRITICAL: '#e74c3c' }
const STATUS_COLORS: Record<string, string> = { PENDING: '#f39c12', APPROVED: '#27ae60', REJECTED: '#e74c3c', CANCELLED: '#64748B', ACTIVE: '#00b4d8', COMPLETED: '#27ae60' }

export default function AccessGovernancePage() {
  const { t } = useLang()
  const api = useApi()
  const { user } = useAuth()
  const isAdmin = user?.role === 'TENANT_ADMIN'
  const [tab, setTab] = useState<'overview'|'roles'|'users'|'requests'|'sod'|'reviews'|'audit'>('overview')

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>🔐 Access Governance</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Roles, permissions, access requests, and governance policies</div>
        </div>
      </div>
      <div style={S.tabs}>
        {[['overview','Overview'],['roles','Roles'],['users','Users'],['requests','Access Requests'],['sod','Segregation of Duties'],['reviews','Access Reviews'],['audit','Audit']].map(([k,l]) => (
          <button key={k} style={S.tab(tab===k)} onClick={() => setTab(k as any)}>{l}</button>
        ))}
      </div>
      {(() => {
        const TAB_HELP: Record<string, string> = {
          overview: "A snapshot of who has access to what across your organization, and whether anything needs your attention.",
          roles: "A role is a bundle of permissions you can hand to someone all at once - like 'Architect' or 'Reviewer' - instead of assigning each permission one by one.",
          users: "See what access each person in your organization currently has, and adjust it if needed.",
          requests: "When someone asks for access to something they don't already have, it shows up here for an admin to approve or decline.",
          sod: "Short for 'Segregation of Duties' - a safeguard that flags when one person has been given two roles that shouldn't be combined, like being able to both request and approve the same thing.",
          reviews: "A periodic check-in where admins confirm that everyone's current access still makes sense, and remove anything that's no longer needed.",
          audit: "A complete history of every access-related change - who was given what, when, and by whom.",
        }
        return (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '10px 20px 0', display: 'flex', alignItems: 'center' }}>
            <HelpTip text={TAB_HELP[tab]} />
          </div>
        )
      })()}
      <div style={S.content}>
        {tab === 'overview' && <OverviewTab api={api} isAdmin={isAdmin} />}
        {tab === 'roles' && <RolesTab api={api} isAdmin={isAdmin} />}
        {tab === 'users' && <UsersTab api={api} isAdmin={isAdmin} />}
        {tab === 'requests' && <RequestsTab api={api} isAdmin={isAdmin} />}
        {tab === 'sod' && <SodTab api={api} isAdmin={isAdmin} />}
        {tab === 'reviews' && <ReviewsTab api={api} isAdmin={isAdmin} />}
        {tab === 'audit' && <AuditTab api={api} />}
      </div>
    </div>
  )
}

// ── Overview ───────────────────────────────────────────────────────────────
function OverviewTab({ api, isAdmin }: any) {
  const [roles, setRoles] = useState<any[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [dormant, setDormant] = useState<any[]>([])

  useEffect(() => {
    api.get('/access-governance/roles').then(setRoles).catch(() => {})
    if (isAdmin) {
      api.get('/access-governance/access-requests?status=PENDING').then(setRequests).catch(() => {})
      api.get('/access-governance/sod-conflicts').then(setConflicts).catch(() => {})
      api.get('/access-governance/dormant-accounts').then(setDormant).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  return (
    <div>
      <div style={S.grid3}>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Tenant Roles</div><div style={{ fontSize: 28, fontWeight: 700 }}>{roles.length}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>Pending Access Requests</div><div style={{ fontSize: 28, fontWeight: 700, color: requests.length > 0 ? '#f39c12' : undefined }}>{requests.length}</div></div>
        <div style={S.statCard}><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>SoD Conflicts</div><div style={{ fontSize: 28, fontWeight: 700, color: conflicts.length > 0 ? '#e74c3c' : undefined }}>{conflicts.reduce((s: number, c: any) => s + c.conflicts.length, 0)}</div></div>
      </div>
      {isAdmin && dormant.length > 0 && (
        <div style={{ ...S.card, marginTop: 16, borderColor: '#f39c1244' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>⚠ {dormant.length} dormant account{dormant.length !== 1 ? 's' : ''}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No login activity in 90+ days. Review in the Users tab.</div>
        </div>
      )}
      {!isAdmin && <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 16 }}>Some sections require Tenant Administrator access.</div>}
    </div>
  )
}

// ── Roles ──────────────────────────────────────────────────────────────────
function RolesTab({ api, isAdmin }: any) {
  const [roles, setRoles] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [creating, setCreating] = useState(false)
  const [newRole, setNewRole] = useState({ code: '', name: '' })
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    api.get('/access-governance/roles').then(setRoles).catch(() => {})
    api.get('/access-governance/permissions').then(setPermissions).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { load() }, [load])

  const openRole = async (r: any) => {
    const full = await api.get(`/access-governance/roles/${r.id}`)
    setSelected(full)
    setEditPerms(new Set((full.rolePermissions || []).map((rp: any) => rp.permissionCode)))
  }

  const savePermissions = async () => {
    setSaving(true)
    try {
      await api.post(`/access-governance/roles/${selected.id}/permissions`, { permissions: [...editPerms].map(code => ({ code })) })
      await openRole(selected)
      load()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const createRole = async () => {
    if (!newRole.code || !newRole.name) return
    try {
      await api.post('/access-governance/roles', newRole)
      setCreating(false); setNewRole({ code: '', name: '' }); load()
    } catch (e: any) { alert(e.message) }
  }

  const cloneRole = async (r: any) => {
    const name = prompt(`Clone "${r.name}" as:`, `${r.name} (Copy)`)
    if (!name) return
    try {
      await api.post(`/access-governance/roles/${r.id}/clone`, { code: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name })
      load()
    } catch (e: any) { alert(e.message) }
  }

  const deleteRole = async (r: any) => {
    if (!window.confirm(`Delete role "${r.name}"?`)) return
    try { await api.del(`/access-governance/roles/${r.id}`); load() } catch (e: any) { alert(e.message) }
  }

  const permsByModule: Record<string, any[]> = {}
  for (const p of permissions) { (permsByModule[p.module] ||= []).push(p) }

  if (selected) {
    return (
      <div>
        <button style={S.btn()} onClick={() => setSelected(null)}>← Back to Roles</button>
        <div style={{ ...S.card, marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}{selected.isSystemRole && <span style={{ ...S.badge('#64748B'), marginLeft: 8 }}>System Template</span>}{selected.isPrivileged && <span style={{ ...S.badge('#e67e22'), marginLeft: 6 }}>Privileged</span>}</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{selected.description}</div>
            </div>
            {isAdmin && <button style={S.btn('primary')} disabled={saving} onClick={savePermissions}>{saving ? 'Saving…' : 'Save Permissions'}</button>}
          </div>
        </div>
        <div style={S.card}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Permissions</div>
          {Object.entries(permsByModule).map(([mod, perms]) => (
            <div key={mod} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 6 }}>{mod}</div>
              <div style={S.grid2}>
                {perms.map(p => (
                  <label key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '4px 0', cursor: isAdmin ? 'pointer' : 'default' }}>
                    <input type="checkbox" disabled={!isAdmin} checked={editPerms.has(p.code)} onChange={e => {
                      const next = new Set(editPerms)
                      if (e.target.checked) next.add(p.code); else next.delete(p.code)
                      setEditPerms(next)
                    }} />
                    <span>{p.code}</span>
                    {p.riskLevel !== 'NORMAL' && <span style={S.badge(RISK_COLORS[p.riskLevel])}>{p.riskLevel}</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          {!creating ? <button style={S.btn('primary')} onClick={() => setCreating(true)}>+ Create Role</button> : (
            <div style={S.card}>
              <div style={S.grid2}>
                <div><div style={S.label}>Code (slug)</div><input style={S.input} value={newRole.code} onChange={e => setNewRole(r => ({ ...r, code: e.target.value }))} placeholder="e.g. data-steward" /></div>
                <div><div style={S.label}>Name</div><input style={S.input} value={newRole.name} onChange={e => setNewRole(r => ({ ...r, name: e.target.value }))} placeholder="e.g. Data Steward" /></div>
              </div>
              <div style={S.row}><button style={S.btn('primary')} onClick={createRole}>Create</button><button style={S.btn()} onClick={() => setCreating(false)}>Cancel</button></div>
            </div>
          )}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={S.th}>Name</th><th style={S.th}>Permissions</th><th style={S.th}>Users</th><th style={S.th}>Type</th><th style={S.th}></th></tr></thead>
        <tbody>
          {roles.map(r => (
            <tr key={r.id}>
              <td style={S.td}><span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => openRole(r)}>{r.name}</span></td>
              <td style={S.td}>{r.rolePermissions?.length || 0}</td>
              <td style={S.td}>{r._count?.assignments || 0}</td>
              <td style={S.td}>{r.isSystemRole ? <span style={S.badge('#64748B')}>System</span> : <span style={S.badge('#00b4d8')}>Custom</span>}{r.isPrivileged && <span style={{ ...S.badge('#e67e22'), marginLeft: 4 }}>Privileged</span>}</td>
              <td style={S.td}>
                {isAdmin && <>
                  <button style={{ ...S.btn(), fontSize: 11, padding: '4px 8px', marginRight: 6 }} onClick={() => cloneRole(r)}>Clone</button>
                  <button style={{ ...S.btn('danger'), fontSize: 11, padding: '4px 8px' }} onClick={() => deleteRole(r)}>Delete</button>
                </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ── Users ──────────────────────────────────────────────────────────────────
function UsersTab({ api, isAdmin }: any) {
  const [users, setUsers] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [effective, setEffective] = useState<{ userId: string; perms: any[] } | null>(null)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [assignRoleId, setAssignRoleId] = useState('')

  const load = useCallback(() => {
    if (!isAdmin) return
    api.get('/access-governance/users').then(setUsers).catch(() => {})
    api.get('/access-governance/roles').then(setRoles).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])
  useEffect(() => { load() }, [load])

  const viewEffective = async (userId: string) => {
    const perms = await api.get(`/access-governance/users/${userId}/effective-permissions`)
    setEffective({ userId, perms })
  }

  const assignRole = async (userId: string) => {
    if (!assignRoleId) return
    try {
      await api.post(`/access-governance/roles/${assignRoleId}/assign`, { userId })
      setAssigning(null); setAssignRoleId(''); load()
    } catch (e: any) { alert(e.message) }
  }

  const removeRole = async (userId: string, roleId: string) => {
    if (!window.confirm('Remove this role assignment?')) return
    try { await api.del(`/access-governance/roles/${roleId}/assign/${userId}`); load() } catch (e: any) { alert(e.message) }
  }

  if (!isAdmin) return <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Requires Tenant Administrator access.</div>

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={S.th}>User</th><th style={S.th}>Legacy Role</th><th style={S.th}>Governance Roles</th><th style={S.th}>Last Login</th><th style={S.th}></th></tr></thead>
        <tbody>
          {users.map(u => (
            <>
              <tr key={u.id}>
                <td style={S.td}><div>{u.fullName}</div><div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{u.email}</div></td>
                <td style={S.td}>{u.role}</td>
                <td style={S.td}>{u.tenantRoles.length === 0 ? <span style={{ color: 'var(--text-dim)' }}>—</span> : u.tenantRoles.map((r: any) => (
                  <span key={r.id} style={{ ...S.badge('#00b4d8'), marginRight: 4, cursor: 'pointer' }} onClick={() => removeRole(u.id, r.id)} title="Click to remove">{r.name} ✕</span>
                ))}</td>
                <td style={S.td}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : <span style={{ color: '#f39c12' }}>Never</span>}</td>
                <td style={S.td}>
                  <button style={{ ...S.btn(), fontSize: 11, padding: '4px 8px', marginRight: 6 }} onClick={() => viewEffective(u.id)}>Effective Access</button>
                  <button style={{ ...S.btn('primary'), fontSize: 11, padding: '4px 8px' }} onClick={() => setAssigning(assigning === u.id ? null : u.id)}>+ Assign</button>
                </td>
              </tr>
              {assigning === u.id && (
                <tr><td colSpan={5} style={S.td}>
                  <div style={S.row}>
                    <select style={{ ...S.input, marginBottom: 0, width: 240 }} value={assignRoleId} onChange={e => setAssignRoleId(e.target.value)}>
                      <option value="">Select role…</option>
                      {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <button style={S.btn('primary')} onClick={() => assignRole(u.id)}>Assign</button>
                  </div>
                </td></tr>
              )}
              {effective?.userId === u.id && effective && (
                <tr><td colSpan={5} style={S.td}>
                  <div style={{ fontSize: 12 }}>
                    {effective.perms.length === 0 ? <span style={{ color: 'var(--text-dim)' }}>No permissions granted.</span> : effective.perms.map((p: any, i: number) => (
                      <div key={i} style={{ padding: '3px 0' }}>{p.code} <span style={{ color: 'var(--text-dim)' }}>via {p.source}</span>{p.domainScope?.length > 0 && <span style={{ color: 'var(--text-dim)' }}> · scoped to {p.domainScope.join(', ')}</span>}</div>
                    ))}
                  </div>
                </td></tr>
              )}
            </>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ── Access Requests ────────────────────────────────────────────────────────
function RequestsTab({ api, isAdmin }: any) {
  const [requests, setRequests] = useState<any[]>([])
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [newReq, setNewReq] = useState({ tenantRoleId: '', reason: '' })
  const [filter, setFilter] = useState('PENDING')

  const load = useCallback(() => {
    api.get('/access-governance/roles').then(setRoles).catch(() => {})
    api.get('/access-governance/access-requests/mine').then(setMyRequests).catch(() => {})
    if (isAdmin) api.get(`/access-governance/access-requests${filter ? `?status=${filter}` : ''}`).then(setRequests).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, filter])
  useEffect(() => { load() }, [load])

  const submitRequest = async () => {
    if (!newReq.tenantRoleId || !newReq.reason.trim()) return alert('Select a role and provide a reason')
    try { await api.post('/access-governance/access-requests', newReq); setNewReq({ tenantRoleId: '', reason: '' }); load() } catch (e: any) { alert(e.message) }
  }

  const decide = async (id: string, decision: 'approve'|'reject', force = false): Promise<void> => {
    try {
      await api.post(`/access-governance/access-requests/${id}/${decision}`, { force })
      load()
    } catch (e: any) {
      if (e.message.includes('Segregation') && !force && window.confirm(`${e.message}\n\nApprove anyway (override)?`)) {
        return decide(id, decision, true)
      }
      alert(e.message)
    }
  }

  const cancel = async (id: string) => { try { await api.post(`/access-governance/access-requests/${id}/cancel`); load() } catch (e: any) { alert(e.message) } }

  return (
    <div>
      <div style={S.card}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Request Access</div>
        <div style={S.grid2}>
          <div>
            <div style={S.label}>Role</div>
            <select style={S.input} value={newReq.tenantRoleId} onChange={e => setNewReq(r => ({ ...r, tenantRoleId: e.target.value }))}>
              <option value="">Select role…</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <div style={S.label}>Reason</div>
            <input style={S.input} value={newReq.reason} onChange={e => setNewReq(r => ({ ...r, reason: e.target.value }))} placeholder="Why do you need this access?" />
          </div>
        </div>
        <button style={S.btn('primary')} onClick={submitRequest}>Submit Request</button>
      </div>

      <div style={{ fontWeight: 600, margin: '20px 0 8px' }}>My Requests</div>
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead><tr><th style={S.th}>Role</th><th style={S.th}>Reason</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead>
        <tbody>
          {myRequests.map(r => (
            <tr key={r.id}>
              <td style={S.td}>{r.tenantRole?.name}</td>
              <td style={S.td}>{r.reason}</td>
              <td style={S.td}><span style={S.badge(STATUS_COLORS[r.status])}>{r.status}</span></td>
              <td style={S.td}>{r.status === 'PENDING' && <button style={{ ...S.btn(), fontSize: 11, padding: '4px 8px' }} onClick={() => cancel(r.id)}>Cancel</button>}</td>
            </tr>
          ))}
          {myRequests.length === 0 && <tr><td colSpan={4} style={{ ...S.td, color: 'var(--text-dim)' }}>No requests yet.</td></tr>}
        </tbody>
      </table>
      </div>

      {isAdmin && <>
        <div style={S.row}>
          <div style={{ fontWeight: 600 }}>All Requests</div>
          <select style={{ ...S.input, marginBottom: 0, width: 160 }} value={filter} onChange={e => setFilter(e.target.value)}>
            {['PENDING','APPROVED','REJECTED','CANCELLED',''].map(s => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
          <thead><tr><th style={S.th}>Requester</th><th style={S.th}>Role</th><th style={S.th}>Reason</th><th style={S.th}>Status</th><th style={S.th}></th></tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td style={S.td}>{r.requesterId}</td>
                <td style={S.td}>{r.tenantRole?.name}</td>
                <td style={S.td}>{r.reason}</td>
                <td style={S.td}><span style={S.badge(STATUS_COLORS[r.status])}>{r.status}</span></td>
                <td style={S.td}>{r.status === 'PENDING' && <>
                  <button style={{ ...S.btn('primary'), fontSize: 11, padding: '4px 8px', marginRight: 6 }} onClick={() => decide(r.id, 'approve')}>Approve</button>
                  <button style={{ ...S.btn('danger'), fontSize: 11, padding: '4px 8px' }} onClick={() => decide(r.id, 'reject')}>Reject</button>
                </>}</td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} style={{ ...S.td, color: 'var(--text-dim)' }}>No requests.</td></tr>}
          </tbody>
        </table>
        </div>
      </>}
    </div>
  )
}

// ── Segregation of Duties ──────────────────────────────────────────────────
function SodTab({ api, isAdmin }: any) {
  const [rules, setRules] = useState<any[]>([])
  const [roles, setRoles] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', roleAId: '', roleBId: '', severity: 'WARNING' })

  const load = useCallback(() => {
    api.get('/access-governance/roles').then(setRoles).catch(() => {})
    if (isAdmin) {
      api.get('/access-governance/sod-rules').then(setRules).catch(() => {})
      api.get('/access-governance/sod-conflicts').then(setConflicts).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])
  useEffect(() => { load() }, [load])

  const createRule = async () => {
    if (!newRule.name || !newRule.roleAId || !newRule.roleBId) return alert('Fill in all fields')
    try { await api.post('/access-governance/sod-rules', newRule); setCreating(false); setNewRule({ name: '', roleAId: '', roleBId: '', severity: 'WARNING' }); load() } catch (e: any) { alert(e.message) }
  }
  const deleteRule = async (id: string) => { if (!window.confirm('Delete this rule?')) return; try { await api.del(`/access-governance/sod-rules/${id}`); load() } catch (e: any) { alert(e.message) } }

  if (!isAdmin) return <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Requires Tenant Administrator access.</div>

  return (
    <div>
      {!creating ? <button style={S.btn('primary')} onClick={() => setCreating(true)}>+ Create SoD Rule</button> : (
        <div style={S.card}>
          <div style={S.grid2}>
            <div><div style={S.label}>Rule Name</div><input style={S.input} value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} /></div>
            <div><div style={S.label}>Severity</div>
              <select style={S.input} value={newRule.severity} onChange={e => setNewRule(r => ({ ...r, severity: e.target.value }))}>
                <option value="WARNING">Warning (shown, not blocking)</option>
                <option value="BLOCKING">Blocking (assignment refused)</option>
              </select>
            </div>
            <div><div style={S.label}>Role A</div>
              <select style={S.input} value={newRule.roleAId} onChange={e => setNewRule(r => ({ ...r, roleAId: e.target.value }))}>
                <option value="">Select…</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div><div style={S.label}>Role B (conflicts with A)</div>
              <select style={S.input} value={newRule.roleBId} onChange={e => setNewRule(r => ({ ...r, roleBId: e.target.value }))}>
                <option value="">Select…</option>{roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>
          <div style={S.row}><button style={S.btn('primary')} onClick={createRule}>Create</button><button style={S.btn()} onClick={() => setCreating(false)}>Cancel</button></div>
        </div>
      )}

      <div style={{ fontWeight: 600, margin: '20px 0 8px' }}>Rules</div>
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead><tr><th style={S.th}>Name</th><th style={S.th}>Severity</th><th style={S.th}></th></tr></thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id}>
              <td style={S.td}>{r.name}</td>
              <td style={S.td}><span style={S.badge(r.severity === 'BLOCKING' ? '#e74c3c' : '#f39c12')}>{r.severity}</span></td>
              <td style={S.td}><button style={{ ...S.btn('danger'), fontSize: 11, padding: '4px 8px' }} onClick={() => deleteRule(r.id)}>Delete</button></td>
            </tr>
          ))}
          {rules.length === 0 && <tr><td colSpan={3} style={{ ...S.td, color: 'var(--text-dim)' }}>No rules configured.</td></tr>}
        </tbody>
      </table>
      </div>

      <div style={{ fontWeight: 600, marginBottom: 8 }}>Current Conflicts</div>
      {conflicts.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No conflicts detected.</div> : conflicts.map((c: any, i: number) => (
        <div key={i} style={{ ...S.card, borderColor: '#e74c3c33' }}>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>User: {c.userId}</div>
          {c.conflicts.map((cf: any, j: number) => <div key={j} style={{ fontSize: 13 }}>{cf.ruleName}: <span style={S.badge(cf.severity === 'BLOCKING' ? '#e74c3c' : '#f39c12')}>{cf.severity}</span> — {cf.conflictingRoleName}</div>)}
        </div>
      ))}
    </div>
  )
}

// ── Access Reviews ─────────────────────────────────────────────────────────
function ReviewsTab({ api, isAdmin }: any) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', description: '' })

  const load = useCallback(() => { if (isAdmin) api.get('/access-governance/review-campaigns').then(setCampaigns).catch(() => {}) }, [api, isAdmin])
  useEffect(() => { load() }, [load])

  const openCampaign = async (c: any) => { setSelected(c); setItems(await api.get(`/access-governance/review-campaigns/${c.id}/items`)) }

  const createCampaign = async () => {
    if (!newCampaign.name) return
    try { await api.post('/access-governance/review-campaigns', newCampaign); setCreating(false); setNewCampaign({ name: '', description: '' }); load() } catch (e: any) { alert(e.message) }
  }

  const decide = async (itemId: string, decision: string) => {
    try { await api.post(`/access-governance/review-items/${itemId}/decide`, { decision }); if (selected) openCampaign(selected) } catch (e: any) { alert(e.message) }
  }

  const complete = async () => {
    if (!window.confirm('Complete this campaign? Unreviewed items will remain as-is.')) return
    await api.post(`/access-governance/review-campaigns/${selected.id}/complete`)
    setSelected(null); load()
  }

  if (!isAdmin) return <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Requires Tenant Administrator access.</div>

  if (selected) {
    return (
      <div>
        <button style={S.btn()} onClick={() => setSelected(null)}>← Back to Campaigns</button>
        <div style={{ ...S.card, marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{selected.name}</div><div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{items.filter(i => i.decision).length}/{items.length} reviewed</div></div>
          {selected.status === 'ACTIVE' && <button style={S.btn('primary')} onClick={complete}>Complete Campaign</button>}
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={S.th}>User</th><th style={S.th}>Role</th><th style={S.th}>Decision</th><th style={S.th}></th></tr></thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td style={S.td}>{i.user?.fullName || i.userId}</td>
                <td style={S.td}>{i.roleName}</td>
                <td style={S.td}>{i.decision ? <span style={S.badge(i.decision === 'REVOKE' ? '#e74c3c' : '#27ae60')}>{i.decision}</span> : <span style={{ color: 'var(--text-dim)' }}>Pending</span>}</td>
                <td style={S.td}>{!i.decision && selected.status === 'ACTIVE' && (
                  <div style={S.row}>
                    <button style={{ ...S.btn('primary'), fontSize: 11, padding: '4px 8px' }} onClick={() => decide(i.id, 'KEEP')}>Keep</button>
                    <button style={{ ...S.btn('danger'), fontSize: 11, padding: '4px 8px' }} onClick={() => decide(i.id, 'REVOKE')}>Revoke</button>
                  </div>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    )
  }

  return (
    <div>
      {!creating ? <button style={S.btn('primary')} onClick={() => setCreating(true)}>+ Create Review Campaign</button> : (
        <div style={S.card}>
          <div style={S.label}>Name</div><input style={S.input} value={newCampaign.name} onChange={e => setNewCampaign(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Q3 2026 Privileged Access Review" />
          <div style={S.label}>Description</div><input style={S.input} value={newCampaign.description} onChange={e => setNewCampaign(c => ({ ...c, description: e.target.value }))} />
          <div style={S.row}><button style={S.btn('primary')} onClick={createCampaign}>Create</button><button style={S.btn()} onClick={() => setCreating(false)}>Cancel</button></div>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead><tr><th style={S.th}>Name</th><th style={S.th}>Status</th><th style={S.th}>Items</th><th style={S.th}>Created</th></tr></thead>
        <tbody>
          {campaigns.map(c => (
            <tr key={c.id}>
              <td style={S.td}><span style={{ cursor: 'pointer', color: 'var(--accent)' }} onClick={() => openCampaign(c)}>{c.name}</span></td>
              <td style={S.td}><span style={S.badge(STATUS_COLORS[c.status])}>{c.status}</span></td>
              <td style={S.td}>{c._count?.items || 0}</td>
              <td style={S.td}>{new Date(c.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {campaigns.length === 0 && <tr><td colSpan={4} style={{ ...S.td, color: 'var(--text-dim)' }}>No review campaigns yet.</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  )
}

// ── Audit ──────────────────────────────────────────────────────────────────
function AuditTab({ api }: any) {
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => { api.get('/access-governance/audit?limit=100').then(setLogs).catch(() => {}) }, [api])
  return (
    <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr><th style={S.th}>Time</th><th style={S.th}>Actor</th><th style={S.th}>Action</th><th style={S.th}>Target</th></tr></thead>
      <tbody>
        {logs.map(l => (
          <tr key={l.id}>
            <td style={S.td}>{new Date(l.createdAt).toLocaleString()}</td>
            <td style={S.td}>{l.actorId}</td>
            <td style={S.td}>{l.action}</td>
            <td style={S.td}>{l.targetType ? `${l.targetType}: ${l.targetId}` : '—'}</td>
          </tr>
        ))}
        {logs.length === 0 && <tr><td colSpan={4} style={{ ...S.td, color: 'var(--text-dim)' }}>No audit events yet.</td></tr>}
      </tbody>
    </table>
    </div>
  )
}
