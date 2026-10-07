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
import ReferenceArchitecturesPage from './pages/ReferenceArchitecturesPage'
import ArchitectureHealthPage from './pages/ArchitectureHealthPage'
import KnowledgePage from './pages/KnowledgePage'
import OrganizationSettingsPage from './pages/settings/OrganizationSettingsPage'
import AiSettingsPage from './pages/settings/AiSettingsPage'
import KnowledgeBaseSettingsPage from './pages/settings/KnowledgeBaseSettingsPage'
import GovernanceSettingsPage from './pages/settings/GovernanceSettingsPage'
import OutputSettingsPage from './pages/settings/OutputSettingsPage'
import NotificationsSettingsPage from './pages/settings/NotificationsSettingsPage'
import ApiBillingSettingsPage from './pages/settings/ApiBillingSettingsPage'
import GovernancePage from './pages/GovernancePage'
import MetaModelPage from './pages/MetaModelPage'
import EaViewsPage from './pages/EaViewsPage'
import ConnectorHubPage from './pages/ConnectorHubPage'
import ReportsPage from './pages/ReportsPage'
import SharedViewPage from './pages/SharedViewPage'
import AccessGovernancePage from './pages/AccessGovernancePage'
import SetupAssistantPage from './pages/SetupAssistantPage'
import StrategyPage from './pages/StrategyRefreshPage'
import BusinessCapabilitiesPage from './pages/BusinessCapabilitiesPage'
import MySurveysPage from './pages/MySurveysPage'
import InnovationPage from './pages/InnovationPage'
import NotificationsPage from './pages/NotificationsPage'
import BillingPage from './pages/BillingPage'
import DecisionEvaluationPage from './pages/DecisionEvaluationPage'
import EaPlanningPage from './pages/EaPlanningPage'
import GlossaryPage from './pages/GlossaryPage'
import LandingPage from './pages/LandingPage'
import OwnerLayout, { OwnerRoute } from './pages/owner/OwnerLayout'
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage'
import OwnerTenantsPage from './pages/owner/OwnerTenantsPage'
import OwnerTenantDetailPage from './pages/owner/OwnerTenantDetailPage'
import OwnerAuditPage from './pages/owner/OwnerAuditPage'
import OwnerDemoRequestsPage from './pages/owner/OwnerDemoRequestsPage'
import OwnerSettingsPage from './pages/owner/OwnerSettingsPage'
import OutreachDashboardPage from './pages/owner/outreach/OutreachDashboardPage'
import OutreachEntitiesPage from './pages/owner/outreach/OutreachEntitiesPage'
import OutreachEntityPage from './pages/owner/outreach/OutreachEntityPage'
import OutreachProspectsPage from './pages/owner/outreach/OutreachProspectsPage'
import OutreachCampaignsPage, { OutreachCampaignPage } from './pages/owner/outreach/OutreachCampaignsPage'
import OutreachSettingsPage from './pages/owner/outreach/OutreachSettingsPage'
import OutreachPagePage, { LinkedInCallbackPage } from './pages/owner/outreach/OutreachPagePage'
import './styles.css'

function ProtectedRoute({ children, permission, superadminOnly }: { children: React.ReactNode; permission?: string; superadminOnly?: boolean }) {
  const { user, loading, hasPermission } = useAuth()
  if (loading) return <div className="loading-screen"><div className="spinner"/></div>
  if (!user) return <Navigate to="/login" replace />
  if (superadminOnly && user.role !== 'SUPERADMIN') return <Navigate to="/app" replace />
  if (permission && !hasPermission(permission)) return <Navigate to="/app" replace />
  return <>{children}</>
}

const PUBLIC_LANDING_HOSTS = new Set(['archmindworks.com', 'www.archmindworks.com', 'localhost', '127.0.0.1'])

export function isPublicLandingHost(hostname = window.location.hostname): boolean {
  return PUBLIC_LANDING_HOSTS.has(hostname.toLowerCase())
}

function RootEntry() {
  return isPublicLandingHost() ? <LandingPage /> : <Navigate to="/app" replace />
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrandingProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootEntry />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
            <Route path="/shared/:token" element={<SharedViewPage />} />
            {/* Owner Console: its own shell and route space, platform owners only (the API enforces the same). */}
            <Route path="/owner" element={<OwnerRoute><OwnerLayout /></OwnerRoute>}>
              <Route index element={<Navigate to="/owner/dashboard" replace />} />
              <Route path="dashboard" element={<OwnerDashboardPage />} />
              <Route path="tenants" element={<OwnerTenantsPage />} />
              <Route path="tenants/:tenantId" element={<OwnerTenantDetailPage />} />
              <Route path="tenants/:tenantId/:tab" element={<OwnerTenantDetailPage />} />
              <Route path="audit" element={<OwnerAuditPage />} />
              <Route path="demo-requests" element={<OwnerDemoRequestsPage />} />
              <Route path="settings" element={<OwnerSettingsPage />} />
              <Route path="outreach" element={<OutreachDashboardPage />} />
              <Route path="outreach/entities" element={<OutreachEntitiesPage />} />
              <Route path="outreach/entities/:id" element={<OutreachEntityPage />} />
              <Route path="outreach/prospects" element={<OutreachProspectsPage />} />
              <Route path="outreach/campaigns" element={<OutreachCampaignsPage />} />
              <Route path="outreach/campaigns/:id" element={<OutreachCampaignPage />} />
              <Route path="outreach/settings" element={<OutreachSettingsPage />} />
              <Route path="outreach/page" element={<OutreachPagePage />} />
              <Route path="outreach/linkedin/callback" element={<LinkedInCallbackPage />} />
            </Route>
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/app" element={<DashboardPage />} />
              <Route path="adm" element={<ProtectedRoute permission="Repository.View"><AdmPage /></ProtectedRoute>} />
              <Route path="copilot" element={<ProtectedRoute permission="AIArchitect.Use"><CopilotPage /></ProtectedRoute>} />
              <Route path="reference-architectures" element={<ProtectedRoute permission="ReferenceArchitecture.View"><ReferenceArchitecturesPage /></ProtectedRoute>} />
              <Route path="architecture-health" element={<ProtectedRoute permission="ArchitectureHealth.View"><ArchitectureHealthPage /></ProtectedRoute>} />
              <Route path="repository" element={<ProtectedRoute permission="Repository.View"><RepositoryPage /></ProtectedRoute>} />
              <Route path="knowledge" element={<ProtectedRoute permission="Repository.View"><KnowledgePage /></ProtectedRoute>} />
              <Route path="glossary" element={<ProtectedRoute permission="Repository.View"><GlossaryPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute permission="Settings.Manage"><Navigate to="/settings/organization" replace /></ProtectedRoute>} />
              <Route path="settings/organization" element={<ProtectedRoute permission="Settings.Manage"><OrganizationSettingsPage /></ProtectedRoute>} />
              <Route path="settings/ai" element={<ProtectedRoute permission="Settings.Manage"><AiSettingsPage /></ProtectedRoute>} />
              <Route path="settings/knowledge-base" element={<ProtectedRoute permission="Settings.Manage"><KnowledgeBaseSettingsPage /></ProtectedRoute>} />
              <Route path="settings/governance" element={<ProtectedRoute permission="Settings.Manage"><GovernanceSettingsPage /></ProtectedRoute>} />
              <Route path="settings/output" element={<ProtectedRoute permission="Settings.Manage"><OutputSettingsPage /></ProtectedRoute>} />
              <Route path="settings/notifications" element={<ProtectedRoute permission="Settings.Manage"><NotificationsSettingsPage /></ProtectedRoute>} />
              <Route path="settings/users" element={<Navigate to="/access-governance?tab=users" replace />} />
              <Route path="settings/api-billing" element={<ProtectedRoute permission="Settings.Manage"><ApiBillingSettingsPage /></ProtectedRoute>} />
              <Route path="governance" element={<ProtectedRoute permission="Reviews.View"><GovernancePage /></ProtectedRoute>} />
              <Route path="meta-model" element={<ProtectedRoute permission="MetaModel.View"><MetaModelPage /></ProtectedRoute>} />
              <Route path="ea-views" element={<ProtectedRoute permission="Views.View"><EaViewsPage /></ProtectedRoute>} />
              <Route path="connector-hub" element={<ProtectedRoute permission="Connector.View"><ConnectorHubPage /></ProtectedRoute>} />
              <Route path="reports" element={<ProtectedRoute permission="Repository.View"><ReportsPage /></ProtectedRoute>} />
              <Route path="access-governance" element={<ProtectedRoute permission="Roles.View"><AccessGovernancePage /></ProtectedRoute>} />
              <Route path="users" element={<Navigate to="/access-governance?tab=users" replace />} />
              <Route path="getting-started" element={<ProtectedRoute permission="Settings.Manage"><SetupAssistantPage /></ProtectedRoute>} />
              <Route path="my-surveys" element={<ProtectedRoute permission="Surveys.Respond"><MySurveysPage /></ProtectedRoute>} />
              <Route path="business-capabilities" element={<ProtectedRoute permission="BusinessCapability.View"><BusinessCapabilitiesPage /></ProtectedRoute>} />
              <Route path="strategy" element={<ProtectedRoute permission="Strategy.View"><StrategyPage /></ProtectedRoute>} />
              <Route path="innovation" element={<ProtectedRoute permission="Innovation.View"><InnovationPage /></ProtectedRoute>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="billing" element={<ProtectedRoute permission="Settings.Manage"><BillingPage /></ProtectedRoute>} />
              <Route path="decision-evaluation" element={<ProtectedRoute permission="DecisionEvaluation.ViewAssessments"><DecisionEvaluationPage /></ProtectedRoute>} />
              <Route path="ea-planning" element={<ProtectedRoute permission="Repository.View"><EaPlanningPage /></ProtectedRoute>} />
              <Route path="demo-requests" element={<Navigate to="/app" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </BrandingProvider>
      </AuthProvider>
    </LangProvider>
  )
}
