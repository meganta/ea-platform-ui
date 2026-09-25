import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useBranding } from '../contexts/BrandingContext'
import SetupAssistantPage from '../pages/SetupAssistantPage'
import NotificationBell from './NotificationBell'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

interface NavItem {
  to: string
  label: string
  icon: string
  permission: string | null
  adminOnly?: boolean
  superadminOnly?: boolean
  children?: NavItem[]
}

const SETTINGS_CHILDREN: NavItem[] = [
  { to: '/settings/organization', label: 'Organization', icon: '🏢', permission: null },
  { to: '/settings/ai', label: 'AI & Copilot', icon: '🤖', permission: null },
  { to: '/settings/knowledge-base', label: 'Knowledge Base', icon: '📚', permission: null },
  { to: '/settings/governance', label: 'Governance', icon: '🏛', permission: null },
  { to: '/settings/output', label: 'Output Preferences', icon: '🖼', permission: null },
  { to: '/settings/notifications', label: 'Notifications', icon: '🔔', permission: null },
  { to: '/settings/users', label: 'Users & Access', icon: '👥', permission: null },
  { to: '/settings/api-billing', label: 'API & Billing', icon: '🔑', permission: null },
]

export default function Layout() {
  const { user, logout, hasPermission } = useAuth()
  const { t, locale, setLocale } = useLang()
  const { branding, logoUrl } = useBranding()
  const [logoFailed, setLogoFailed] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [setupChecked, setSetupChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Auto-expanded whenever the current route is under /settings, so
  // landing directly on e.g. /settings/governance (a bookmark, a link
  // from elsewhere) shows the submenu open rather than collapsed with
  // no visible indication of where you are.
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const nav = useNavigate()
  const location = useLocation()
  const orgName = locale === 'AR' ? (branding?.organizationNameAr || branding?.organizationNameEn) : (branding?.organizationNameEn || branding?.organizationNameAr)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])
  useEffect(() => { if (location.pathname.startsWith('/settings')) setSettingsExpanded(true) }, [location.pathname])

  useEffect(() => {
    if (setupChecked || location.pathname === '/getting-started') return
    const token = localStorage.getItem('ea_token')
    if (!token) return
    fetch(`${API_URL}/setup/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        setSetupChecked(true)
        if (profile && !profile.setupCompleted) setShowSetupModal(true)
      })
      .catch(() => setSetupChecked(true))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const navItems: NavItem[] = [
    { to: '/app', label: t('nav.dashboard'), icon: '⬛', permission: null },
    { to: '/adm', label: t('nav.adm'), icon: '⚙', permission: 'Repository.View' },
    { to: '/copilot', label: t('nav.copilot'), icon: '💬', permission: 'AIArchitect.Use' },
    { to: '/governance', label: '🏛 Governance', icon: '', permission: 'Reviews.View' },
    { to: '/decision-evaluation', label: '⚖ ' + (locale === 'AR' ? 'القرار والتقييم' : 'Decision & Evaluation'), icon: '', permission: 'Reviews.View', superadminOnly: true },
    { to: '/my-surveys', label: '📝 ' + (locale === 'AR' ? 'استبياناتي' : 'My Surveys'), icon: '', permission: 'Surveys.Respond' },
    { to: '/business-capabilities', label: '🧱 ' + (locale === 'AR' ? 'قدرات الأعمال' : 'Business Capabilities'), icon: '', permission: 'BusinessCapability.View' },
    { to: '/strategy', label: '🎯 Strategy', icon: '', permission: 'Repository.View', superadminOnly: true },
    { to: '/ea-planning', label: '🗓 EA Planning', icon: '', permission: 'Repository.View' },
    { to: '/innovation', label: '🔭 ' + t('nav.innovation'), icon: '', permission: 'Repository.View' },
    { to: '/notifications', label: '🔔 ' + t('nav.notifications'), icon: '', permission: null },
    { to: '/meta-model', label: '🧩 Meta-Model', icon: '', permission: 'MetaModel.View' },
    { to: '/ea-views', label: '🗺 EA Views', icon: '', permission: 'Views.View' },
    { to: '/connector-hub', label: '🔌 Connectors', icon: '', permission: 'Repository.View', superadminOnly: true },
    { to: '/reports', label: '📊 ' + (locale === 'AR' ? 'التقارير' : 'Reports'), icon: '', permission: 'Repository.View' },
    { to: '/repository', label: '🗄 ' + t('nav.repository'), icon: '', permission: 'Repository.View' },
    { to: '/knowledge', label: '📚 ' + t('nav.knowledge'), icon: '', permission: 'Repository.View' },
    { to: '/glossary', label: '📖 Glossary', icon: '', permission: 'Repository.View', superadminOnly: true },
    { to: '/access-governance', label: '🔐 Access Governance', icon: '', permission: 'Roles.View', superadminOnly: true },
    // Settings category (restructured, explicit direction): a single
    // expandable nav group replacing the old flat, crowded /settings
    // (11 tabs in one page) and the Setup Assistant's Profile &
    // Framework step (folded into Organization below, including the
    // domains-in-scope setting). Users & Access and API & Billing reuse
    // the existing, fuller standalone UsersPage/BillingPage content
    // rather than duplicating it under a second, thinner implementation.
    { to: '/settings', label: '⚙ Settings', icon: '', permission: 'Users.View', superadminOnly: true, children: SETTINGS_CHILDREN },
    { to: '/getting-started', label: '🏛 Getting Started', icon: '', permission: null, superadminOnly: true },
    { to: '/demo-requests', label: '📨 Demo Requests', icon: '', permission: null, superadminOnly: true },
  ]

  const visibleNav = navItems.filter(item => {
    if (item.superadminOnly && user?.role !== 'SUPERADMIN') return false
    if (item.permission === null) return true
    return hasPermission(item.permission)
  })

  const mainNav = visibleNav.filter(n => !['/repository', '/knowledge', '/glossary', '/access-governance', '/settings', '/getting-started', '/demo-requests'].includes(n.to))
  const repoNav = visibleNav.filter(n => ['/repository', '/knowledge', '/glossary'].includes(n.to))
  const adminNav = visibleNav.filter(n => ['/access-governance', '/settings', '/getting-started', '/demo-requests'].includes(n.to))

  return (
    <div className="layout">
      <button className="mobile-menu-btn" aria-label="Open menu" onClick={() => setSidebarOpen(o => !o)}>☰</button>
      <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <div className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          {logoUrl && !logoFailed
            ? <img src={logoUrl} alt={orgName || 'Logo'} style={{ maxHeight: 32, maxWidth: 160, objectFit: 'contain' }} onError={() => setLogoFailed(true)} />
            : <div className="logo-text">{orgName || 'EA Platform'}</div>}
          <div className="logo-sub">{locale === 'AR' ? 'هندسة المؤسسات' : 'Enterprise Architecture'}</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">{t('nav.main')}</div>
          {mainNav.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/app'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
              {item.icon ? item.icon + ' ' : ''}{item.label}
            </NavLink>
          ))}
          {repoNav.length > 0 && (
            <>
              <div className="nav-label" style={{marginTop:8}}>{t('nav.repo_section')}</div>
              {repoNav.map(item => (
                <NavLink key={item.to} to={item.to} className={({isActive})=>`nav-item${isActive?' active':''}`}>
                  {item.icon ? item.icon + ' ' : ''}{item.label}
                </NavLink>
              ))}
            </>
          )}
          {adminNav.length > 0 && (
            <>
              <div className="nav-label" style={{marginTop:8}}>Admin</div>
              {adminNav.map(item => item.children ? (
                <div key={item.to}>
                  <button
                    type="button"
                    className={`nav-item${location.pathname.startsWith(item.to) ? ' active' : ''}`}
                    onClick={() => setSettingsExpanded(e => !e)}
                    style={{ justifyContent: 'space-between' }}
                    aria-expanded={settingsExpanded}
                  >
                    <span>{item.icon ? item.icon + ' ' : ''}{item.label}</span>
                    <span style={{ fontSize: 10, transition: 'transform 0.15s', transform: settingsExpanded ? 'rotate(90deg)' : 'none' }}>▸</span>
                  </button>
                  {settingsExpanded && (
                    <div style={{ paddingInlineStart: 14, borderInlineStart: '1px solid var(--border)', marginInlineStart: 14 }}>
                      {item.children.map(child => (
                        <NavLink key={child.to} to={child.to} className={({isActive})=>`nav-item${isActive?' active':''}`} style={{ fontSize: 12.5 }}>
                          {child.icon ? child.icon + ' ' : ''}{child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink key={item.to} to={item.to} className={({isActive})=>`nav-item${isActive?' active':''}`}>
                  {item.icon ? item.icon + ' ' : ''}{item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-2" style={{marginBottom:8}}>
            <div className="user-avatar">{user?.email?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name truncate" style={{maxWidth:140}}>{user?.email}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button onClick={()=>setLocale(locale==='EN'?'AR':'EN')} style={{width:'100%',padding:'6px',background:'rgba(3,105,161,0.1)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--accent)',fontSize:12,marginBottom:6,cursor:'pointer'}}>
            🌐 {locale==='EN'?'العربية':'English'}
          </button>
          <button className="logout-btn" onClick={()=>{logout();nav('/login')}}>{t('auth.signout')}</button>
        </div>
      </div>
      <div className="main-content"><Outlet /></div>
      <NotificationBell />
      {showSetupModal && <SetupAssistantPage modal onClose={() => setShowSetupModal(false)} />}
    </div>
  )
}
