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
}

export default function Layout() {
  const { user, logout, hasPermission } = useAuth()
  const { t, locale, setLocale } = useLang()
  const { branding, logoUrl } = useBranding()
  const [logoFailed, setLogoFailed] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [setupChecked, setSetupChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const nav = useNavigate()
  const location = useLocation()
  const orgName = locale === 'AR' ? (branding?.organizationNameAr || branding?.organizationNameEn) : (branding?.organizationNameEn || branding?.organizationNameAr)

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  useEffect(() => {
    if (setupChecked || location.pathname === '/setup') return
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
    { to: '/', label: t('nav.dashboard'), icon: '⬛', permission: null },
    { to: '/adm', label: t('nav.adm'), icon: '⚙', permission: 'Repository.View' },
    { to: '/copilot', label: t('nav.copilot'), icon: '💬', permission: 'AIArchitect.Use' },
    { to: '/governance', label: '🏛 Governance', icon: '', permission: 'Reviews.View' },
    { to: '/decision-evaluation', label: '⚖ ' + (locale === 'AR' ? 'القرار والتقييم' : 'Decision & Evaluation'), icon: '', permission: 'Reviews.View' },
    { to: '/strategy', label: '🎯 Strategy', icon: '', permission: 'Repository.View' },
    { to: '/ea-planning', label: '🗓 EA Planning', icon: '', permission: 'Repository.View' },
    { to: '/innovation', label: '🔭 ' + t('nav.innovation'), icon: '', permission: 'Repository.View' },
    { to: '/notifications', label: '🔔 ' + t('nav.notifications'), icon: '', permission: null },
    { to: '/billing', label: '💳 ' + t('nav.billing'), icon: '', permission: 'Users.View' },
    { to: '/meta-model', label: '🧩 Meta-Model', icon: '', permission: 'MetaModel.View' },
    { to: '/ea-views', label: '🗺 EA Views', icon: '', permission: 'Views.View' },
    { to: '/connector-hub', label: '🔌 Connectors', icon: '', permission: 'Repository.View' },
    { to: '/reports', label: '📊 ' + (locale === 'AR' ? 'التقارير' : 'Reports'), icon: '', permission: 'Repository.View' },
    { to: '/repository', label: '🗄 ' + t('nav.repository'), icon: '', permission: 'Repository.View' },
    { to: '/knowledge', label: '📚 ' + t('nav.knowledge'), icon: '', permission: 'Repository.View' },
    { to: '/glossary', label: '📖 Glossary', icon: '', permission: 'Repository.View' },
    { to: '/users', label: '👥 Users', icon: '', permission: 'Users.View' },
    { to: '/access-governance', label: '🔐 Access Governance', icon: '', permission: 'Roles.View' },
    { to: '/settings', label: '⚙ Settings', icon: '', permission: 'Users.View' },
    { to: '/setup', label: '🏛 Setup Assistant', icon: '', permission: null },
  ]

  const visibleNav = navItems.filter(item => {
    if (item.permission === null) return true
    return hasPermission(item.permission)
  })

  const mainNav = visibleNav.filter(n => !['/repository', '/knowledge', '/glossary', '/users', '/access-governance', '/settings', '/setup'].includes(n.to))
  const repoNav = visibleNav.filter(n => ['/repository', '/knowledge', '/glossary'].includes(n.to))
  const adminNav = visibleNav.filter(n => ['/users', '/access-governance', '/settings', '/setup'].includes(n.to))

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
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({isActive})=>`nav-item${isActive?' active':''}`}>
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
              {adminNav.map(item => (
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
