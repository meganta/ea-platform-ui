import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { fill } from '../pages/owner/ownerUi'
import '../pages/owner/OwnerConsole.css'

/**
 * Persistent banner while a platform owner manages a tenant through a
 * delegated access session. Exit ends the session on the server and returns
 * to the Owner Console.
 */
export default function DelegatedAccessBanner() {
  const { user, exitTenant } = useAuth()
  const { t, isAR } = useLang()
  const nav = useNavigate()
  if (!user?.delegatedAccess) return null
  const tenantId = user.tenantId
  const expires = new Date(user.delegatedAccess.expiresAt)
  const time = isNaN(expires.getTime()) ? '—' : expires.toLocaleTimeString(isAR ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit' })
  const exit = async () => {
    await exitTenant()
    nav(`/owner/tenants/${tenantId}/activity`)
  }
  return (
    <div className="owner-access-banner" role="status" dir={isAR ? 'rtl' : 'ltr'}>
      <span>
        {fill(t('owner.access.banner'), { tenant: user.tenantName || user.tenantSlug || '' })}
        <HelpTip text={t('owner.access.help')} />
        <span style={{ fontWeight: 400, marginInlineStart: 10 }}>{fill(t('owner.access.expires'), { time })}</span>
      </span>
      <button type="button" onClick={exit}>{t('owner.access.exit')}</button>
    </div>
  )
}
