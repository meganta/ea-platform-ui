import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LangProvider } from './contexts/LangContext'
import { BrandingProvider } from './contexts/BrandingContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import InviteAcceptPage from './pages/InviteAcceptPage'
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
import UsersPage from './pages/UsersPage'
import StrategyPage from './pages/StrategyPage'
import InnovationPage from './pages/InnovationPage'
import NotificationsPage from './pages/NotificationsPage'
import BillingPage from './pages/BillingPage'
import DecisionEvaluationPage from './pages/DecisionEvaluationPage'
import EaPlanningPage from './pages/EaPlanningPage'
import GlossaryPage from './pages/GlossaryPage'
import LandingPage from './pages/LandingPage'
import './styles.css'

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { user, loading, hasPermission } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace />
  if (permission && !hasPermission(permission)) return <Navigate to="/app" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrandingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/shared/:token" element={<SharedViewPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/app" element={<DashboardPage />} />
              <Route path="adm" element={<ProtectedRoute permission="Repository.View"><AdmPage /></ProtectedRoute>} />
              <Route path="copilot" element={<ProtectedRoute permission="AIArchitect.Use"><CopilotPage /></ProtectedRoute>} />
              <Route path="repository" element={<ProtectedRoute permission="Repository.View"><RepositoryPage /></ProtectedRoute>} />
              <Route path="knowledge" element={<ProtectedRoute permission="Repository.View"><KnowledgePage /></ProtectedRoute>} />
              <Route path="glossary" element={<ProtectedRoute permission="Repository.View"><GlossaryPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute permission="Users.View"><SettingsPage /></ProtectedRoute>} />
              <Route path="governance" element={<ProtectedRoute permission="Reviews.View"><GovernancePage /></ProtectedRoute>} />
              <Route path="meta-model" element={<ProtectedRoute permission="MetaModel.View"><MetaModelPage /></ProtectedRoute>} />
              <Route path="ea-views" element={<ProtectedRoute permission="Views.View"><EaViewsPage /></ProtectedRoute>} />
              <Route path="connector-hub" element={<ProtectedRoute permission="Repository.View"><ConnectorHubPage /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute permission="Repository.View"><ReportsPage /></ProtectedRoute>} />
              <Route path="access-governance" element={<ProtectedRoute permission="Roles.View"><AccessGovernancePage /></ProtectedRoute>} />
              <Route path="users" element={<ProtectedRoute permission="Users.View"><UsersPage /></ProtectedRoute>} />
              <Route path="setup" element={<SetupAssistantPage />} />
              <Route path="setup-assistant" element={<SetupAssistantPage />} />
              <Route path="strategy" element={<ProtectedRoute permission="Repository.View"><StrategyPage /></ProtectedRoute>} />
              <Route path="innovation" element={<ProtectedRoute permission="Repository.View"><InnovationPage /></ProtectedRoute>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="billing" element={<ProtectedRoute permission="Users.View"><BillingPage /></ProtectedRoute>} />
              <Route path="decision-evaluation" element={<ProtectedRoute permission="Reviews.View"><DecisionEvaluationPage /></ProtectedRoute>} />
              <Route path="ea-planning" element={<ProtectedRoute permission="Repository.View"><EaPlanningPage /></ProtectedRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
        </BrandingProvider>
      </AuthProvider>
    </LangProvider>
  )
}
