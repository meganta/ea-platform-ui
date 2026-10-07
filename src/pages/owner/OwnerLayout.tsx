import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useAuth, isPlatformOwner } from '../../contexts/AuthContext'
import { useLang } from '../../contexts/LangContext'
import './OwnerConsole.css'

/**
 * Owner Console shell: its own navigation and a distinct owner band, separate
 * from the tenant workspace Layout. Only a platform owner outside a delegated
 * tenant session gets here; the server enforces the same on every /owner API.
 */
export function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (!isPlatformOwner(user)) return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function OwnerLayout() {
  const { user, logout } = useAuth()
  const { t, isAR, locale, setLocale } = useLang()
  const nav = useNavigate()
  const items = [
    { to: '/owner/dashboard', label: t('owner.nav.dashboard'), icon: '▦' },
    { to: '/owner/tenants', label: t('owner.nav.tenants'), icon: '🏛' },
    { to: '/owner/outreach', label: t('owner.nav.outreach'), icon: '✉' },
    { to: '/owner/demo-requests', label: t('owner.nav.demo'), icon: '📨' },
    { to: '/owner/audit', label: t('owner.nav.audit'), icon: '🛡' },
    { to: '/owner/settings', label: t('owner.nav.settings'), icon: '⚙' },
  ]
  return (
    <div className="oc-layout" dir={isAR ? 'rtl' : 'ltr'}>
      <aside className="oc-sidebar" aria-label={t('owner.console')}>
        <div className="oc-brand">
          <div className="oc-brand-title">ArchMind</div>
          <div className="oc-brand-sub">{t('owner.brand')}</div>
        </div>
        <nav className="oc-nav" aria-label={t('owner.console')}>
          {items.map(i => (
            <NavLink key={i.to} to={i.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <span aria-hidden="true">{i.icon}</span>{i.label}
            </NavLink>
          ))}
          <NavLink to="/app"><span aria-hidden="true">↩</span>{t('owner.nav.workspace')}</NavLink>
        </nav>
        <div className="oc-footer">
          <div className="truncate" style={{ maxWidth: 200 }} title={user?.email}>{user?.email}</div>
          <button type="button" onClick={() => setLocale(locale === 'EN' ? 'AR' : 'EN')}>🌐 {locale === 'EN' ? 'العربية' : 'English'}</button>
          <button type="button" className="oc-logout" onClick={() => { logout(); nav('/login') }}>{t('auth.signout')}</button>
        </div>
      </aside>
      <main className="oc-main">
        <div className="oc-band" role="note">{t('owner.band')}</div>
        <div className="oc-content"><Outlet /></div>
      </main>
    </div>
  )
}
