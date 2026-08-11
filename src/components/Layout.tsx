import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { useBranding } from '../contexts/BrandingContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const { t, locale, setLocale } = useLang()
  const { branding, logoUrl } = useBranding()
  const [logoFailed, setLogoFailed] = useState(false)
  const nav = useNavigate()
  const orgName = locale === 'AR' ? (branding?.organizationNameAr || branding?.organizationNameEn) : (branding?.organizationNameEn || branding?.organizationNameAr)
  return (
    <div className="layout">
      <div className="sidebar">
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
          <NavLink to="/meta-model" className={({isActive})=>`nav-item${isActive?' active':''}`}>🧩 Meta-Model</NavLink>
          <NavLink to="/ea-views" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗺 EA Views</NavLink>
          <NavLink to="/connector-hub" className={({isActive})=>`nav-item${isActive?' active':''}`}>🔌 Connectors</NavLink>
          <NavLink to="/reports" className={({isActive})=>`nav-item${isActive?' active':''}`}>📊 {locale === 'AR' ? 'التقارير' : 'Reports'}</NavLink>
          <div className="nav-label" style={{marginTop:8}}>{t('nav.repo_section')}</div>
          <NavLink to="/repository" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗄 {t('nav.repository')}</NavLink>
          <NavLink to="/knowledge" className={({isActive})=>`nav-item${isActive?' active':''}`}>📚 {t('nav.knowledge')}</NavLink>
          <div className="nav-label" style={{marginTop:8}}>Admin</div>
          <NavLink to="/access-governance" className={({isActive})=>`nav-item${isActive?' active':''}`}>🔐 Access Governance</NavLink>
          <NavLink to="/settings" className={({isActive})=>`nav-item${isActive?' active':''}`}>⚙ Settings</NavLink>
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
    </div>
  )
}
