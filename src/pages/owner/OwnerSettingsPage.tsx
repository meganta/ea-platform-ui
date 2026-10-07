import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { ownerApi } from './ownerApi'
import { ErrorBox, fill, Header, Loading, Pill } from './ownerUi'

export default function OwnerSettingsPage() {
  const { t, isAR } = useLang()
  const [me, setMe] = useState<any>(null)
  const [error, setError] = useState('')
  useEffect(() => { ownerApi.me().then(setMe).catch((e: any) => setError(e.message)) }, [])
  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header title={t('owner.settings.title')} help={t('owner.settings.help')} />
      {error && <ErrorBox error={error} />}
      {!me && !error && <Loading />}
      {me && (
        <div className="oc-grid-2">
          <div className="oc-card">
            <h3>{t('owner.settings.identity')}</h3>
            <dl className="oc-kv">
              <dt>{t('owner.settings.email')}</dt><dd>{me.email}</dd>
              <dt>{t('owner.settings.home')}</dt><dd>{me.homeTenantName}</dd>
              <dt>{t('owner.brand')}</dt><dd>{me.platformRole}</dd>
            </dl>
            <p className="oc-muted" style={{ marginTop: 10 }}>{t('owner.settings.grant')}</p>
          </div>
          <div className="oc-card">
            <h3>{t('owner.enrich.title')}</h3>
            <dl className="oc-kv">
              <dt>{t('owner.settings.web_search')}</dt>
              <dd><Pill text={me.capabilities.webSearch ? t('owner.settings.enabled') : t('owner.settings.disabled')} color={me.capabilities.webSearch ? 'var(--success)' : 'var(--text-dim)'} /></dd>
              <dt>{t('owner.settings.ttl')}</dt><dd>{fill(t('owner.settings.minutes'), { n: me.capabilities.accessTtlMinutes })}</dd>
              <dt>{t('owner.enrich.scopes')}</dt><dd>{me.capabilities.enrichmentScopes.map((s: string) => t(`owner.enrich.scope.${s}`)).join(', ')}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  )
}
