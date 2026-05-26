import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

export default function Layout() {
  const { user, logout } = useAuth()
  const { t, locale, isAR, setLocale } = useLang()
  const nav = useNavigate()

  const switchLanguage = async (newLocale: 'EN' | 'AR') => {
    setLocale(newLocale)
    // Persist to backend: AI config language + setup profile language
    const token = localStorage.getItem('ea_token')
    if (token) {
      Promise.all([
        fetch(`${API_URL}/config/ai`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ language: newLocale }) }),
        fetch(`${API_URL}/setup/profile`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ language: newLocale }) }),
      ]).catch(() => {})
    }
  }

  return (
    <div className="layout">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">EA Platform</div>
          <div className="logo-sub">{locale === 'AR' ? 'هندسة المؤسسات' : 'Enterprise Architecture'}</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">{t('nav.main')}</div>
          <NavLink to="/" end className={({isActive})=>`nav-item${isActive?' active':''}`}>⬛ {t('nav.dashboard')}</NavLink>
          <NavLink to="/adm" className={({isActive})=>`nav-item${isActive?' active':''}`}>⚙ {t('nav.adm')}</NavLink>
          <NavLink to="/governance" className={({isActive})=>`nav-item${isActive?' active':''}`}>🏛 {t('nav.governance')}</NavLink>
          <NavLink to="/copilot" className={({isActive})=>`nav-item${isActive?' active':''}`}>💬 {t('nav.copilot')}</NavLink>
          <div className="nav-label" style={{marginTop:8}}>{t('nav.repo_section')}</div>
          <NavLink to="/repository" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗄 {t('nav.repository')}</NavLink>
          <NavLink to="/knowledge" className={({isActive})=>`nav-item${isActive?' active':''}`}>📚 {t('nav.knowledge')}</NavLink>
          <div className="nav-label" style={{marginTop:8}}>{t('nav.admin')}</div>
          <NavLink to="/setup" className={({isActive})=>`nav-item${isActive?' active':''}`}>🚀 {t('nav.setup')}</NavLink>
          <NavLink to="/settings" className={({isActive})=>`nav-item${isActive?' active':''}`}>⚙ {t('nav.settings')}</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-2" style={{marginBottom:8}}>
            <div className="user-avatar">{user?.email?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name truncate" style={{maxWidth:140}}>{user?.email}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button onClick={() => switchLanguage(locale === 'EN' ? 'AR' : 'EN')} style={{width:'100%',padding:'6px',background:'rgba(0,180,216,0.1)',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--accent)',fontSize:12,marginBottom:6,cursor:'pointer'}}>
            🌐 {locale === 'EN' ? 'العربية' : 'English'}
          </button>
          <button className="logout-btn" onClick={()=>{logout();nav('/login')}}>{t('auth.signout')}</button>
        </div>
      </div>
      <div className="main-content"><Outlet /></div>
    </div>
  )
}
