import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'
import { Choices, Deliverable, DeliverablesCatalogue, deliverablesApi } from './deliverables/deliverablesApi'
import './deliverables/Deliverables.css'

type Lang = 'EN' | 'AR'
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_m, k) => String(vars[k] ?? ''))

/** EA deliverables prepared on request from the modules' records (EN/AR). */
export default function EaDeliverablesPage() {
  const { t, isAR } = useLang()
  const [catalogue, setCatalogue] = useState<DeliverablesCatalogue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<Lang>(isAR ? 'AR' : 'EN')
  const [choices, setChoices] = useState<Record<string, Choices>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState<Record<string, { ok: boolean; text: string }>>({})

  useEffect(() => { deliverablesApi.catalogue().then(setCatalogue).catch(e => setError(e.message)) }, [])

  const setChoice = useCallback((code: string, patch: Choices) => setChoices(c => ({ ...c, [code]: { ...c[code], ...patch } })), [])

  const run = async (key: string, task: () => Promise<string>) => {
    setBusy(key)
    try {
      const name = await task()
      setStatus(s => ({ ...s, [key]: { ok: true, text: fill(t('deliv.ready'), { name }) } }))
    } catch (e: any) {
      setStatus(s => ({ ...s, [key]: { ok: false, text: `${t('deliv.failed')}: ${e.message}` } }))
    } finally { setBusy(null) }
  }

  if (error) return <div className="dl-page" dir={isAR ? 'rtl' : 'ltr'}><div role="alert" className="dl-error">{t('deliv.load_failed')}: {error}</div></div>
  if (!catalogue) return <div className="dl-page" dir={isAR ? 'rtl' : 'ltr'}>{t('deliv.loading')}</div>

  return (
    <div className="dl-page" dir={isAR ? 'rtl' : 'ltr'}>
      <header className="dl-header">
        <div>
          <h1 className="dl-title">{t('deliv.title')} <HelpTip text={t('deliv.help')} /></h1>
          <p className="dl-subtitle">{t('deliv.subtitle')}</p>
        </div>
        <div className="dl-actions">
          <label className="form-label" htmlFor="dl-language">{t('deliv.language')}</label>
          <select id="dl-language" className="form-input" value={language} onChange={e => setLanguage(e.target.value as Lang)}>
            <option value="EN">{t('deliv.lang.EN')}</option>
            <option value="AR">{t('deliv.lang.AR')}</option>
          </select>
          <button className="btn btn-primary" disabled={!!busy} onClick={() => run('ALL', () => deliverablesApi.downloadAll(language, choices))}>
            {busy === 'ALL' ? t('deliv.preparing') : t('deliv.download_all')}
          </button>
          <HelpTip text={t('deliv.download_all_help')} />
        </div>
      </header>
      {status.ALL && <div role="status" className={status.ALL.ok ? 'dl-ok' : 'dl-error'}>{status.ALL.text}</div>}

      <div className="dl-grid">
        {catalogue.deliverables.map(d => (
          <DeliverableCard key={d.code} d={d} catalogue={catalogue} choices={choices[d.code] || {}} onChoice={p => setChoice(d.code, p)}
            busy={busy} status={status[d.code]} onDownload={() => run(d.code, () => deliverablesApi.download(d.code, language, choices[d.code] || {}))} />
        ))}
      </div>
    </div>
  )
}

function DeliverableCard({ d, catalogue, choices, onChoice, busy, status, onDownload }: {
  d: Deliverable; catalogue: DeliverablesCatalogue; choices: Choices; onChoice: (p: Choices) => void
  busy: string | null; status?: { ok: boolean; text: string }; onDownload: () => void
}) {
  const { t, isAR } = useLang()
  const i = isAR ? 1 : 0
  const missing = d.options.includes('views') && !(choices.viewIds?.length) ? t('deliv.opt.views_none')
    : d.options.includes('policyOwners') && d.code !== 'NCA_CHECKLIST' && !(choices.policyOwners?.length) ? t('deliv.opt.owners_none') : null
  return (
    <section className="dl-card" aria-labelledby={`dl-${d.code}`} data-testid={`deliverable-${d.code}`}>
      <div className="dl-card-head">
        <span className="dl-number">{d.number}</span>
        <h2 id={`dl-${d.code}`} className="dl-card-title">{d.title[i]}</h2>
        <span className={`dl-format dl-format-${d.format.toLowerCase()}`}>{t(`deliv.format.${d.format}`)}</span>
      </div>
      <p className="dl-summary">{d.summary[i]}</p>
      <div className="dl-meta">
        <span>{t('deliv.sources')}: {d.sources.join(' · ')}</span>
        <span>{fill(t('deliv.records'), { n: d.records })}</span>
      </div>
      {d.options.includes('subject') && <SubjectChoice id={`dl-subject-${d.code}`} value={choices.subjectId} onChange={subjectId => onChoice({ subjectId })} />}
      {d.options.includes('views') && <ViewsChoice id={`dl-views-${d.code}`} catalogue={catalogue} value={choices.viewIds || []} onChange={viewIds => onChoice({ viewIds })} />}
      {(d.options.includes('architectures') || d.options.includes('patterns')) && (
        <ArchitecturesChoice id={`dl-arch-${d.code}`} kind={d.options.includes('patterns') ? 'REFERENCE_PATTERN' : 'REFERENCE_ARCHITECTURE'} catalogue={catalogue} value={choices.architectureIds || []} onChange={architectureIds => onChoice({ architectureIds })} />
      )}
      {d.options.includes('policyOwners') && <OwnersChoice id={`dl-owners-${d.code}`} catalogue={catalogue} value={choices.policyOwners || []} onChange={policyOwners => onChoice({ policyOwners })} />}
      <div className="dl-card-foot">
        <button className="btn btn-secondary" disabled={!!busy || !!missing} title={missing || undefined} onClick={onDownload}>
          {busy === d.code ? t('deliv.preparing') : t('deliv.download')}
        </button>
        {missing && <span className="dl-hint">{missing}</span>}
      </div>
      {status && <div role="status" className={status.ok ? 'dl-ok' : 'dl-error'}>{status.text}</div>}
    </section>
  )
}

function SubjectChoice({ id, value, onChange }: { id: string; value?: string; onChange: (id?: string) => void }) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string; assetType: string }>>([])
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    if (query.trim().length < 2) { setResults([]); return }
    const h = setTimeout(() => { deliverablesApi.searchObjects(query.trim()).then(setResults).catch(() => setResults([])) }, 250)
    return () => clearTimeout(h)
  }, [query])
  return (
    <div className="form-group dl-option">
      <label className="form-label" htmlFor={id}>{t('deliv.opt.subject')} <HelpTip text={t('deliv.opt.subject_help')} /></label>
      {value && picked ? (
        <div className="dl-chip">{picked.name} <button type="button" className="dl-link" onClick={() => { setPicked(null); onChange(undefined) }}>{t('deliv.opt.clear')}</button></div>
      ) : (
        <>
          <input id={id} className="form-input" value={query} placeholder={t('deliv.opt.subject_search')} onChange={e => setQuery(e.target.value)} />
          {results.length > 0 && (
            <ul className="dl-results">
              {results.map(r => <li key={r.id}><button type="button" className="dl-link" onClick={() => { setPicked(r); onChange(r.id); setQuery(''); setResults([]) }}>{r.name}</button> <span className="dl-dim">{r.assetType}</span></li>)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function ViewsChoice({ id, catalogue, value, onChange }: { id: string; catalogue: DeliverablesCatalogue; value: string[]; onChange: (ids: string[]) => void }) {
  const { t } = useLang()
  const [filter, setFilter] = useState('')
  const views = useMemo(() => catalogue.options.views.filter(v => v.name.toLowerCase().includes(filter.trim().toLowerCase())), [catalogue, filter])
  const toggle = (vid: string) => onChange(value.includes(vid) ? value.filter(x => x !== vid) : [...value, vid])
  return (
    <fieldset className="dl-option">
      <legend className="form-label">{t('deliv.opt.views')} <HelpTip text={t('deliv.opt.views_help')} /> <span className="dl-dim">{fill(t('deliv.opt.selected'), { n: value.length })}</span></legend>
      <label className="sr-only" htmlFor={id}>{t('deliv.opt.views_filter')}</label>
      <input id={id} className="form-input" value={filter} placeholder={t('deliv.opt.views_filter')} onChange={e => setFilter(e.target.value)} />
      <ul className="dl-checks">
        {views.map(v => (
          <li key={v.id}>
            <input type="checkbox" id={`${id}-${v.id}`} checked={value.includes(v.id)} onChange={() => toggle(v.id)} />
            <label htmlFor={`${id}-${v.id}`}>{v.name}</label>
            {v.state && <span className={`dl-state dl-state-${v.state.type.toLowerCase()}`}>{t(`deliv.state.${v.state.type}`)}{v.state.name && v.state.name.toUpperCase() !== v.state.type ? ` · ${v.state.name}` : ''}</span>}
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

function ArchitecturesChoice({ id, kind, catalogue, value, onChange }: { id: string; kind: string; catalogue: DeliverablesCatalogue; value: string[]; onChange: (ids: string[]) => void }) {
  const { t, isAR } = useLang()
  const items = catalogue.options.architectures.filter(a => a.kind === kind)
  const toggle = (aid: string) => onChange(value.includes(aid) ? value.filter(x => x !== aid) : [...value, aid])
  return (
    <fieldset className="dl-option">
      <legend className="form-label">{t('deliv.opt.architectures')} <HelpTip text={t('deliv.opt.architectures_help')} /></legend>
      <ul className="dl-checks">
        {items.map(a => (
          <li key={a.id}>
            <input type="checkbox" id={`${id}-${a.id}`} checked={value.includes(a.id)} onChange={() => toggle(a.id)} />
            <label htmlFor={`${id}-${a.id}`}>{isAR ? a.nameAr || a.name : a.name}</label>
            {a.domainCode && <span className="dl-dim">{a.domainCode}</span>}
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

function OwnersChoice({ id, catalogue, value, onChange }: { id: string; catalogue: DeliverablesCatalogue; value: string[]; onChange: (owners: string[]) => void }) {
  const { t } = useLang()
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])
  return (
    <fieldset className="dl-option">
      <legend className="form-label">{t('deliv.opt.owners')} <HelpTip text={t('deliv.opt.owners_help')} /> <span className="dl-dim">{fill(t('deliv.opt.selected'), { n: value.length })}</span></legend>
      <ul className="dl-checks dl-checks-tall">
        {catalogue.options.policyOwners.map((o, n) => (
          <li key={o.owner}>
            <input type="checkbox" id={`${id}-${n}`} checked={value.includes(o.owner)} onChange={() => toggle(o.owner)} />
            <label htmlFor={`${id}-${n}`}>{o.owner}</label>
            <span className="dl-dim">{fill(t('deliv.opt.policies'), { n: o.policies })}</span>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
