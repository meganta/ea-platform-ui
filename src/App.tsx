import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import AdmPage from './pages/AdmPage'
import CopilotPage from './pages/CopilotPage'
import RepositoryPage from './pages/RepositoryPage'
import KnowledgePage from './pages/KnowledgePage'
import SettingsPage from './pages/SettingsPage'
import GovernancePage from './pages/GovernancePage'
import SetupAssistantPage from './pages/SetupAssistantPage'
import './styles.css'

import { useState, useEffect } from 'react'
import { useLang } from './contexts/LangContext'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const { setLocale } = useLang()
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    if (!user) return
    const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
    // Load preferred language from tenant config
    fetch(`${API_URL}/config`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` } })
      .then(r => r.json())
      .then(c => {
        const lang = c?.ai?.language || c?.tenant?.locale
        if (lang === 'AR' || lang === 'EN') {
          // Only update if different from current to avoid flicker
          const current = localStorage.getItem('ea_locale')
          if (!current) setLocale(lang as 'AR' | 'EN')
        }
      })
      .catch(() => {})
    // Check setup status for new tenants
    fetch(`${API_URL}/setup/profile`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` } })
      .then(r => r.json())
      .then(p => {
        const isNewTenant = !p?.organizationName && !p?.organizationNameAr && !p?.setupCompleted && p?.setupStep <= 1
        if (isNewTenant) setShowSetup(true)
      })
      .catch(() => {})
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <>
      {children}
      {showSetup && <SetupAssistantPage modal={true} onClose={() => setShowSetup(false)} />}
    </>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="adm" element={<AdmPage />} />
              <Route path="copilot" element={<CopilotPage />} />
              <Route path="repository" element={<RepositoryPage />} />
              <Route path="knowledge" element={<KnowledgePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="governance" element={<GovernancePage />} />
              <Route path="setup" element={<SetupAssistantPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  )
}
