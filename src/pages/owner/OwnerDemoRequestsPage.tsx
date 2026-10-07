import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { ownerApi, fmtDate } from './ownerApi'
import { ErrorBox, Header, Loading, fill } from './ownerUi'

interface DemoRequest {
  id: string
  fullName: string
  organization: string
  jobTitle: string
  email: string
  phone: string | null
  country: string
  preferredLanguage: string
  message: string
  createdAt: string
}

/** Demo requests sent from the public landing page: platform pre-sales data, visible to platform owners only. */
export default function OwnerDemoRequestsPage() {
  const { t, isAR } = useLang()
  const [rows, setRows] = useState<DemoRequest[] | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setError('')
    ownerApi.demoRequests().then((r: DemoRequest[]) => setRows(r || [])).catch((e: any) => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!rows || !q) return rows || []
    return rows.filter(r => [r.fullName, r.organization, r.jobTitle, r.email, r.country, r.message].some(v => (v || '').toLowerCase().includes(q)))
  }, [rows, search])

  return (
    <div dir={isAR ? 'rtl' : 'ltr'}>
      <Header
        title={t('owner.demo.title')}
        subtitle={rows ? fill(t('owner.demo.count'), { n: rows.length }) : undefined}
        help={t('owner.demo.help')}
        actions={<button type="button" className="btn btn-secondary btn-sm" onClick={load}>↻ {t('owner.demo.refresh')}</button>}
      />
      {error && <ErrorBox error={error} onRetry={load} />}
      {!rows ? (!error && <Loading />) : rows.length === 0 ? (
        <div className="oc-muted" data-testid="owner-demo-empty">{t('owner.demo.empty')}</div>
      ) : (
        <>
          <div className="oc-toolbar">
            <label htmlFor="owner-demo-search" className="oc-muted">{t('owner.demo.search')}</label>
            <input id="owner-demo-search" className="form-input" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="oc-table-wrap">
            <table className="oc-table">
              <thead>
                <tr>
                  <th>{t('owner.demo.col.date')}</th><th>{t('owner.demo.col.name')}</th><th>{t('owner.demo.col.organization')}</th>
                  <th>{t('owner.demo.col.job')}</th><th>{t('owner.demo.col.email')}</th><th>{t('owner.demo.col.phone')}</th>
                  <th>{t('owner.demo.col.country')}</th><th>{t('owner.demo.col.language')}</th><th>{t('owner.demo.col.message')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.createdAt, isAR)}</td>
                    <td>{r.fullName}</td>
                    <td>{r.organization}</td>
                    <td>{r.jobTitle}</td>
                    <td><a href={`mailto:${r.email}`} style={{ color: 'var(--accent)' }}>{r.email}</a></td>
                    <td dir="ltr">{r.phone || '—'}</td>
                    <td>{r.country}</td>
                    <td>{r.preferredLanguage}</td>
                    <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
