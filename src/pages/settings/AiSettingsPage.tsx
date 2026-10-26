import { useLang } from '../../contexts/LangContext'
import AiPolicySettingsCard from './AiPolicySettingsCard'

/**
 * Settings > AI & Copilot: one panel holds every AI setting of the organization (main model and
 * answer language, depth per module, model per depth, SAR budgets, internet research).
 */
export default function AiSettingsPage() {
  const { t, setLocale, isAR } = useLang()
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <div className="page-header">
        <div className="page-title">{t('aipolicy.page.title')}</div>
        <div className="page-subtitle">{t('aipolicy.page.subtitle')}</div>
      </div>
      <div className="page-body" style={{ maxWidth: 900 }}>
        <AiPolicySettingsCard onLanguageSaved={l => { if (l === 'AR' || l === 'EN') setLocale(l) }} />
      </div>
    </div>
  )
}
