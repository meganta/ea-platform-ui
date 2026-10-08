import { apiFetch } from '../lib/session'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import DelegatedAccessBanner from './DelegatedAccessBanner'
import { useLang } from '../contexts/LangContext'
import { useBranding } from '../contexts/BrandingContext'
import SetupAssistantPage from '../pages/SetupAssistantPage'
import NotificationBell from './NotificationBell'

const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

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
  const menuButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const menuLabel = locale === 'AR' ? 'وحدات المنصة' : 'Platform modules'
  // Auto-expanded whenever the current route is under /settings, so
  // landing directly on e.g. /settings/governance (a bookmark, a link
  // from elsewhere) shows the submenu open rather than collapsed with
  // no visible indication of where you are.
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const nav = useNavigate()
  const location = useLocation()
  const orgName = locale === 'AR' ? (branding?.organizationNameAr || branding?.organizationNameEn) : (branding?.organizationNameEn || branding?.organizationNameAr)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!sidebarOpen) return
    const panel = sidebar.current
    const main = content.current
    const trigger = menuButton.current
    main?.setAttribute('inert', '')
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') || [])
    focusable()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setSidebarOpen(false) }
      if (e.key === 'Tab') {
        const items = focusable(), first = items[0], last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { main?.removeAttribute('inert'); document.removeEventListener('keydown', onKey); trigger?.focus() }
  }, [sidebarOpen])
  useEffect(() => { if (location.pathname.startsWith('/settings')) setSettingsExpanded(true) }, [location.pathname])

  useEffect(() => {
    if (setupChecked || location.pathname === '/getting-started') return
    const token = localStorage.getItem('ea_token')
    if (!token) return
    apiFetch(`${API_URL}/setup/profile`, { headers: { Authorization: `Bearer ${token}` } })
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
    { to: '/decision-evaluation', label: '⚖ ' + (locale === 'AR' ? 'القرار والتقييم' : 'Decision & Evaluation'), icon: '', permission: 'DecisionEvaluation.ViewAssessments' },
    { to: '/my-surveys', label: '📝 ' + (locale === 'AR' ? 'استبياناتي' : 'My Surveys'), icon: '', permission: 'Surveys.Respond' },
    { to: '/business-capabilities', label: '🧱 ' + (locale === 'AR' ? 'قدرات الأعمال' : 'Business Capabilities'), icon: '', permission: 'BusinessCapability.View' },
    { to: '/strategy', label: '🎯 ' + t('strategy.refresh.heading'), icon: '', permission: 'Strategy.View' },
    { to: '/ea-planning', label: '🗓 EA Planning', icon: '', permission: 'Repository.View' },
    { to: '/innovation', label: '🔭 ' + t('nav.innovation'), icon: '', permission: 'Innovation.View' },
    { to: '/notifications', label: '🔔 ' + t('nav.notifications'), icon: '', permission: null },
    { to: '/meta-model', label: '🧩 Meta-Model', icon: '', permission: 'MetaModel.View' },
    { to: '/ea-views', label: '🗺 EA Views', icon: '', permission: 'Views.View' },
    { to: '/connector-hub', label: '🔌 Connectors', icon: '', permission: 'Connector.View' },
    { to: '/reports', label: '📊 ' + (locale === 'AR' ? 'التقارير' : 'Reports'), icon: '', permission: 'Repository.View' },
    { to: '/repository', label: '🗄 ' + t('nav.repository'), icon: '', permission: 'Repository.View' },
    { to: '/reference-architectures', label: '🧭 ' + t('nav.refarch'), icon: '', permission: 'ReferenceArchitecture.View' },
    { to: '/architecture-health', label: '🩺 ' + t('nav.health'), icon: '', permission: 'ArchitectureHealth.View' },
    { to: '/knowledge', label: '📚 ' + t('nav.knowledge'), icon: '', permission: 'Repository.View' },
    { to: '/glossary', label: '📖 Glossary', icon: '', permission: 'Repository.View' },
    { to: '/access-governance', label: '🔐 Access Governance', icon: '', permission: 'Roles.View' },
    // Settings category (restructured, explicit direction): a single
    // expandable nav group replacing the old flat, crowded /settings
    // (11 tabs in one page) and the Setup Assistant's Profile &
    // Framework step (folded into Organization below, including the
    // domains-in-scope setting). Users & Access and API & Billing reuse
    // the existing, fuller standalone UsersPage/BillingPage content
    // rather than duplicating it under a second, thinner implementation.
    { to: '/settings', label: '⚙ Settings', icon: '', permission: 'Settings.Manage', children: SETTINGS_CHILDREN },
    { to: '/getting-started', label: '🏛 Getting Started', icon: '', permission: 'Settings.Manage' },
  ]

  const visibleNav = navItems.filter(item => {
    if (item.superadminOnly && user?.role !== 'SUPERADMIN') return false
    if (item.permission === null) return true
    return hasPermission(item.permission)
  })

  const mainNav = visibleNav.filter(n => !['/repository', '/reference-architectures', '/architecture-health', '/knowledge', '/glossary', '/access-governance', '/settings', '/getting-started'].includes(n.to))
  const repoNav = visibleNav.filter(n => ['/repository', '/reference-architectures', '/architecture-health', '/knowledge', '/glossary'].includes(n.to))
  const adminNav = visibleNav.filter(n => ['/access-governance', '/settings', '/getting-started'].includes(n.to))

  return (
    <div className="layout" dir={locale === 'AR' ? 'rtl' : 'ltr'}>
      <button ref={menuButton} type="button" className="mobile-menu-btn" aria-label={menuLabel} title={locale === 'AR' ? 'افتح القائمة للوصول إلى وحدات المنصة' : 'Open the menu to access platform modules'} aria-expanded={sidebarOpen} aria-controls="platform-modules" onClick={() => setSidebarOpen(o => !o)}><span aria-hidden="true">☰</span><span>{locale === 'AR' ? 'الوحدات' : 'Modules'}</span></button>
      <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} aria-hidden="true" onClick={() => setSidebarOpen(false)} />
      <div ref={sidebar} id="platform-modules" role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen || undefined} aria-label={menuLabel} className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <button type="button" className="sidebar-close" aria-label={locale === 'AR' ? 'إغلاق قائمة الوحدات' : 'Close modules menu'} onClick={() => setSidebarOpen(false)}>×</button>
        <div className="sidebar-logo">
          {logoUrl && !logoFailed
            ? <img src={logoUrl} alt={orgName || 'Logo'} style={{ maxHeight: 32, maxWidth: 160, objectFit: 'contain' }} onError={() => setLogoFailed(true)} />
            : <div className="logo-text">{orgName || 'EA Platform'}</div>}
          <div className="logo-sub">{locale === 'AR' ? 'هندسة المؤسسات' : 'Enterprise Architecture'}</div>
        </div>
        <nav className="sidebar-nav" aria-label={menuLabel} onClick={e => { if ((e.target as HTMLElement).closest('a')) setSidebarOpen(false) }}>
          {user?.platformRole === 'PLATFORM_OWNER' && !user?.delegatedAccess && (
            <NavLink to="/owner/dashboard" className="nav-item" style={{ background: '#0B1F33', color: '#FBBF24', fontWeight: 600, marginBottom: 6 }}>
              🛡 {t('owner.nav.open_console')}
            </NavLink>
          )}
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
          <NavLink to="/account/password" className="nav-item" style={{ marginBottom: 6 }}>{locale === 'AR' ? 'تغيير كلمة المرور' : 'Change password'}</NavLink>
          <button className="logout-btn" onClick={()=>{logout();nav('/login')}}>{t('auth.signout')}</button>
        </div>
      </div>
      <div ref={content} className="main-content"><DelegatedAccessBanner /><Outlet /><NotificationBell /></div>
      {showSetupModal && <SetupAssistantPage modal onClose={() => setShowSetupModal(false)} />}
    </div>
  )
}
