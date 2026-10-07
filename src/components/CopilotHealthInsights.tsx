import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { InsightsPanel } from '../pages/health/ArchitectPanels'
import { makeApi } from '../pages/health/health'
import '../pages/health/ArchitectureHealth.css'

const API = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

/**
 * Copilot start screen: what the selected architect would raise without being
 * asked (proactive insights from the stored assessments, backlog and
 * collections). A domain architect shows its own domain; the Chief every
 * domain. Hidden when there is nothing to raise or the person cannot view
 * Architecture Health.
 */
export default function CopilotHealthInsights({ architect }: { architect: { domain?: string; isChief?: boolean } | null }) {
  const { hasPermission } = useAuth()
  const { t } = useLang()
  const api = useMemo(() => makeApi(API), [])
  if (typeof hasPermission !== 'function' || !hasPermission('ArchitectureHealth.View')) return null
  const domains = architect && !architect.isChief && architect.domain ? [architect.domain] : undefined
  return <InsightsPanel api={api} t={t} domains={domains} compact limit={4} />
}
