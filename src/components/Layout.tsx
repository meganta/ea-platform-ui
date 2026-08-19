import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useBranding } from '../contexts/BrandingContext'
import SetupAssistantPage from '../pages/SetupAssistantPage'
import NotificationBell from './NotificationBell'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

export default function Layout() {
  const { user, logout } = useAuth()
  const { t, locale, setLocale } = useLang()
  const { branding, logoUrl } = useBranding()
  const [logoFailed, setLogoFailed] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [setupChecked, setSetupChecked] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const nav = useNavigate()
  const location = useLocation()
  const orgName = locale === 'AR' ? (branding?.organizationNameAr || branding?.organizationNameEn) : (branding?.organizationNameEn || branding?.organizationNameAr)

  // Auto-show the onboarding assistant once per session for tenants that
  // haven't completed setup - checked once on mount (not per navigation),
  // and skipped entirely if the user is already on the full-page /setup
  // route to avoid a modal stacked on top of the same content. Dismissing
  // (✕) hides it for the rest of this session without marking setup
  // complete server-side - it reappears on the next login if still
  // incomplete, rather than being permanently silenced by one dismissal.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          <NavLink to="/" end className={({isActive})=>`nav-item${isActive?' active':''}`}>⬛ {t('nav.dashboard')}</NavLink>
          <NavLink to="/adm" className={({isActive})=>`nav-item${isActive?' active':''}`}>⚙ {t('nav.adm')}</NavLink>
          <NavLink to="/copilot" className={({isActive})=>`nav-item${isActive?' active':''}`}>💬 {t('nav.copilot')}</NavLink>
          <NavLink to="/governance" className={({isActive})=>`nav-item${isActive?' active':''}`}>🏛 Governance</NavLink>
          <NavLink to="/strategy" className={({isActive})=>`nav-item${isActive?' active':''}`}>🎯 Strategy</NavLink>
          <NavLink to="/ea-planning" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗓 EA Planning</NavLink>
          <NavLink to="/innovation" className={({isActive})=>`nav-item${isActive?' active':''}`}>🔭 {t('nav.innovation')}</NavLink>
          <NavLink to="/notifications" className={({isActive})=>`nav-item${isActive?' active':''}`}>🔔 {t('nav.notifications')}</NavLink>
          <NavLink to="/billing" className={({isActive})=>`nav-item${isActive?' active':''}`}>💳 {t('nav.billing')}</NavLink>
          <NavLink to="/meta-model" className={({isActive})=>`nav-item${isActive?' active':''}`}>🧩 Meta-Model</NavLink>
          <NavLink to="/ea-views" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗺 EA Views</NavLink>
          <NavLink to="/connector-hub" className={({isActive})=>`nav-item${isActive?' active':''}`}>🔌 Connectors</NavLink>
          <NavLink to="/reports" className={({isActive})=>`nav-item${isActive?' active':''}`}>📊 {locale === 'AR' ? 'التقارير' : 'Reports'}</NavLink>
          <div className="nav-label" style={{marginTop:8}}>{t('nav.repo_section')}</div>
          <NavLink to="/repository" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗄 {t('nav.repository')}</NavLink>
          <NavLink to="/knowledge" className={({isActive})=>`nav-item${isActive?' active':''}`}>📚 {t('nav.knowledge')}</NavLink>
          <NavLink to="/glossary" className={({isActive})=>`nav-item${isActive?' active':''}`}>📖 Glossary</NavLink>
          <div className="nav-label" style={{marginTop:8}}>Admin</div>
          <NavLink to="/access-governance" className={({isActive})=>`nav-item${isActive?' active':''}`}>🔐 Access Governance</NavLink>
          <NavLink to="/settings" className={({isActive})=>`nav-item${isActive?' active':''}`}>⚙ Settings</NavLink>
          <NavLink to="/setup" className={({isActive})=>`nav-item${isActive?' active':''}`}>🏛 Setup Assistant</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-2" style={{marginBottom:8}}>
            <div className="user-avatar">{user?.email?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name truncate" style={{maxWidth:140}}>{user?.email}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button onClick={()=>setLocale(locale==='EN'?'AR':'EN')} style={{width:'100%',padding:'6px',background:'rgba(0,180,216,0.1)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--accent)',fontSize:12,marginBottom:6,cursor:'pointer'}}>
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
