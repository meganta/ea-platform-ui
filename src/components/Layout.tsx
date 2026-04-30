import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const handleLogout = () => { logout(); nav('/login') }
  return (
    <div className="layout">
      <div className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-text">EA Platform</div>
          <div className="logo-sub">Enterprise Architecture</div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-label">Main</div>
          <NavLink to="/" end className={({isActive})=>`nav-item${isActive?' active':''}`}>⬛ Dashboard</NavLink>
          <NavLink to="/adm" className={({isActive})=>`nav-item${isActive?' active':''}`}>⚙ ADM Cycles</NavLink>
          <NavLink to="/copilot" className={({isActive})=>`nav-item${isActive?' active':''}`}>💬 EA Copilot</NavLink>
          <div className="nav-label" style={{marginTop:8}}>Repository</div>
          <NavLink to="/repository" className={({isActive})=>`nav-item${isActive?' active':''}`}>🗄 EA Repository</NavLink>
          <NavLink to="/knowledge" className={({isActive})=>`nav-item${isActive?' active':''}`}>📚 Knowledge Base</NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="flex items-center gap-2">
            <div className="user-avatar">{user?.email?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name truncate" style={{maxWidth:140}}>{user?.email}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
        </div>
      </div>
      <div className="main-content"><Outlet /></div>
    </div>
  )
}
