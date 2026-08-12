import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { BrandingProvider } from './contexts/BrandingContext'
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
import MetaModelPage from './pages/MetaModelPage'
import EaViewsPage from './pages/EaViewsPage'
import ConnectorHubPage from './pages/ConnectorHubPage'
import ReportsPage from './pages/ReportsPage'
import SharedViewPage from './pages/SharedViewPage'
import AccessGovernancePage from './pages/AccessGovernancePage'
import SetupAssistantPage from './pages/SetupAssistantPage'
import StrategyPage from './pages/StrategyPage'
import './styles.css'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrandingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/shared/:token" element={<SharedViewPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<DashboardPage />} />
              <Route path="adm" element={<AdmPage />} />
              <Route path="copilot" element={<CopilotPage />} />
              <Route path="repository" element={<RepositoryPage />} />
              <Route path="knowledge" element={<KnowledgePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="governance" element={<GovernancePage />} />
              <Route path="meta-model" element={<MetaModelPage />} />
              <Route path="ea-views" element={<EaViewsPage />} />
              <Route path="connector-hub" element={<ConnectorHubPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="access-governance" element={<AccessGovernancePage />} />
              <Route path="setup" element={<SetupAssistantPage />} />
              <Route path="strategy" element={<StrategyPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </BrandingProvider>
      </AuthProvider>
    </LangProvider>
  )
}

