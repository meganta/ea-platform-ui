import { useCallback, useEffect, useMemo, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useLang } from '../../contexts/LangContext'
import { Chip } from './RoadmapChip'
import { ChangeItem, MEASURE_KINDS, RoadmapApi, STATUS_TONE, assignable, day, fill } from './roadmapModel'

type PanelProps = { data: any; api: RoadmapApi; canManage: boolean; onChanged: () => void }
const transitionsAndTarget = (data: any) => data.line.filter((s: any) => s.label !== 'CURRENT')

function useRun(onChanged: () => void) {
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const run = useCallback(async (fn: () => Promise<any>, ok?: (r: any) => string) => {
    setErr(''); setMsg('')
    try { const r = await fn(); if (ok) setMsg(ok(r)); onChanged(); return r } catch (e: any) { setErr(e.message) }
  }, [onChanged])
  return { err, msg, run }
}

// ── Changes ────────────────────────────────────────────────────────────────
export function ChangesPanel({ data, api, canManage, filter, onChanged }: PanelProps & { filter: { workPackageId?: string; stateId?: string; domain?: string } }) {
  const { t } = useLang()
  const [f, setF] = useState({ stateId: filter.stateId || '', domain: filter.domain || '', segmentId: '', workPackageId: filter.workPackageId || '', unplanned: false, search: '' })
  const [res, setRes] = useState<{ total: number; truncated: boolean; items: ChangeItem[] } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const { err, msg, run } = useRun(onChanged)
  // A filter chosen elsewhere (a state, a domain, a work package) replaces those three fields; an unchanged one keeps the list as it is.
  useEffect(() => {
    setF(x => (x.stateId === (filter.stateId || '') && x.domain === (filter.domain || '') && x.workPackageId === (filter.workPackageId || '')
      ? x : { ...x, stateId: filter.stateId || '', domain: filter.domain || '', workPackageId: filter.workPackageId || '' }))
  }, [filter])

  const load = useCallback(() => {
    const q = new URLSearchParams()
    if (f.stateId) q.set('stateId', f.stateId)
    if (f.domain) q.set('domain', f.domain)
    if (f.segmentId) q.set('segmentId', f.segmentId)
    if (f.workPackageId) q.set('workPackageId', f.workPackageId)
    if (f.unplanned) q.set('unplanned', 'true')
    if (f.search) q.set('search', f.search)
    api.get(`/architecture-roadmap/changes?${q.toString()}`).then(setRes).catch(() => setRes({ total: 0, truncated: false, items: [] }))
    setSelected(new Set())
  }, [api, f])
  useEffect(() => { load() }, [load, data])

  const sel = res ? assignable(res.items, selected) : null
  const wpsOfState = sel ? data.workPackages.filter((w: any) => w.scenarioId === sel.stateId && w.status === 'PLANNED') : []
  const toggle = (id: string) => setSelected(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const assign = (remove: boolean) => sel && run(async () => {
    const byWp = remove ? [...new Set(res!.items.filter(i => selected.has(i.id) && i.workPackageId).map(i => i.workPackageId!))] : [target]
    for (const wp of byWp) {
      const mine = remove ? res!.items.filter(i => selected.has(i.id) && i.workPackageId === wp) : res!.items.filter(i => selected.has(i.id))
      await api.post(`/architecture-roadmap/work-packages/${wp}/changes`, { objectChangeIds: mine.filter(i => i.kind === 'OBJECT').map(i => i.id), linkChangeIds: mine.filter(i => i.kind === 'RELATIONSHIP').map(i => i.id), remove })
    }
  }, () => t('roadmap.saved'))

  return (
    <div>
      <p className="rm-sub" style={{ marginTop: 0 }}>{t('roadmap.changes.help')}</p>
      <div className="rm-filters">
        <div className="rm-field"><label htmlFor="rm-f-state">{t('roadmap.changes.filter_state')}</label>
          <select id="rm-f-state" className="rm-input" value={f.stateId} onChange={e => setF({ ...f, stateId: e.target.value })}>
            <option value="">{t('roadmap.changes.all')}</option>{transitionsAndTarget(data).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="rm-field"><label htmlFor="rm-f-domain">{t('roadmap.changes.filter_domain')}</label>
          <select id="rm-f-domain" className="rm-input" value={f.domain} onChange={e => setF({ ...f, domain: e.target.value })}>
            <option value="">{t('roadmap.changes.all')}</option>{data.domains.map((d: any) => <option key={d.domain} value={d.domain}>{d.domainName || d.domain}</option>)}
          </select></div>
        <div className="rm-field"><label htmlFor="rm-f-seg">{t('roadmap.changes.filter_segment')}</label>
          <select id="rm-f-seg" className="rm-input" value={f.segmentId} onChange={e => setF({ ...f, segmentId: e.target.value })}>
            <option value="">{t('roadmap.changes.all')}</option>{data.segments.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
        <div className="rm-field"><label htmlFor="rm-f-search">{t('roadmap.changes.search')}</label><input id="rm-f-search" className="rm-input" value={f.search} onChange={e => setF({ ...f, search: e.target.value })} /></div>
        <label className="rm-row" style={{ fontSize: 13 }}><input type="checkbox" checked={f.unplanned} onChange={e => setF({ ...f, unplanned: e.target.checked })} />{t('roadmap.changes.unplanned_only')}</label>
        {f.workPackageId && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setF({ ...f, workPackageId: '' })}>✕ {data.workPackages.find((w: any) => w.id === f.workPackageId)?.name}</button>}
      </div>

      {canManage && selected.size > 0 && (
        <div className="rm-selbar" role="region" aria-label={fill(t('roadmap.changes.selected'), { n: selected.size })}>
          <strong>{fill(t('roadmap.changes.selected'), { n: selected.size })}</strong>
          {!sel ? <span>{t('roadmap.changes.one_state')}</span> : <>
            <label htmlFor="rm-assign-wp">{t('roadmap.changes.assign_to')}</label>
            <select id="rm-assign-wp" className="rm-input" value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">—</option>{wpsOfState.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button type="button" className="btn btn-primary btn-sm" disabled={!target} onClick={() => assign(false)}>{t('roadmap.changes.assign')}</button>
            {sel.assigned > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => assign(true)}>{t('roadmap.changes.unassign')}</button>}
          </>}
        </div>
      )}
      {err && <p className="rm-error" role="alert">{err}</p>}{msg && <p className="rm-ok">{msg}</p>}

      {!res ? <p className="rm-muted">{t('roadmap.loading')}</p> : res.items.length === 0 ? <p className="rm-muted">{t('roadmap.changes.empty')}</p> : (
        <div className="rm-table-wrap">
          <table className="rm-table">
            <thead><tr>
              {canManage && <th scope="col"><span className="sr-only">✓</span></th>}
              <th scope="col">{t('roadmap.changes.object')}</th><th scope="col">{t('roadmap.changes.change')}</th><th scope="col">{t('roadmap.changes.state')}</th><th scope="col">{t('roadmap.changes.filter_domain')}</th><th scope="col">{t('roadmap.changes.package')}</th>
            </tr></thead>
            <tbody>
              {res.items.map(i => (
                <tr key={i.id}>
                  {canManage && <td><input type="checkbox" aria-label={i.objectName} checked={selected.has(i.id)} onChange={() => toggle(i.id)} /></td>}
                  <td><a href={`/repository?asset=${i.objectId}`}>{i.objectName}</a> <span className="rm-muted">{i.objectType}</span>
                    {i.related && <div className="rm-muted">{i.relationshipType} → <a href={`/repository?asset=${i.related.id}`}>{i.related.name}</a></div>}
                    {i.properties && <div className="rm-muted">{i.properties.join(', ')}</div>}</td>
                  <td><Chip tone={i.change === 'RETIRE' || i.change === 'LINK_REMOVE' ? 'warn' : 'info'}>{t(`roadmap.change.${i.change}`)}</Chip></td>
                  <td>{i.stateName}<div className="rm-muted">{day(i.horizonDate)}</div></td>
                  <td>{i.domainName || i.domain}</td>
                  <td>{i.workPackageName || <span className="rm-muted">{t('roadmap.changes.unplanned')}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.truncated && <p className="rm-muted">{fill(t('roadmap.changes.truncated'), { n: res.items.length, total: res.total })}</p>}
        </div>
      )}
    </div>
  )
}

// ── Work packages ──────────────────────────────────────────────────────────
export function WorkPackagesPanel({ data, api, canManage, canDeliver, onChanged, onShowChanges }: PanelProps & { canDeliver: boolean; onShowChanges: (wpId: string) => void }) {
  const { t } = useLang()
  const { err, msg, run } = useRun(onChanged)
  const [form, setForm] = useState<any>(null)
  const states = transitionsAndTarget(data)
  const save = () => run(async () => {
    const body = { name: form.name, scenarioId: form.scenarioId, segmentId: form.segmentId || null, startDate: form.startDate || null, endDate: form.endDate || null, owner: form.owner || undefined, description: form.description || undefined }
    if (form.id) { const { scenarioId, ...rest } = body; await api.put(`/architecture-roadmap/work-packages/${form.id}`, form.status === 'PLANNED' ? body : rest) } else await api.post('/architecture-roadmap/work-packages', body)
    setForm(null)
  })
  const action = (w: any, kind: 'commit' | 'uncommit' | 'deliver' | 'cancel') => {
    if (kind === 'commit' && !window.confirm(fill(t('roadmap.wp.confirm_commit'), { name: w.name, date: day(w.endDate) }))) return
    if (kind === 'deliver' && !window.confirm(fill(t('roadmap.wp.confirm_deliver'), { name: w.name }))) return
    run(() => api.post(`/architecture-roadmap/work-packages/${w.id}/${kind}`), (r: any) => {
      if (kind === 'commit') return fill(t('roadmap.wp.committed_result'), { n: r.objectsDated })
      if (kind === 'deliver') return [fill(t('roadmap.wp.delivered_result'), { objects: r.counts.objects, props: r.counts.properties, added: r.counts.linksAdded, removed: r.counts.linksRemoved }), r.counts.skipped ? fill(t('roadmap.wp.skipped_result'), { n: r.counts.skipped }) : '', r.stateAchieved ? t('roadmap.wp.achieved_result') : ''].filter(Boolean).join(' ')
      return t('roadmap.saved')
    })
  }
  const remove = (w: any) => { if (window.confirm(fill(t('roadmap.confirm_delete'), { name: w.name }))) run(() => api.del(`/architecture-roadmap/work-packages/${w.id}`)) }

  return (
    <div>
      <div className="rm-head"><p className="rm-sub" style={{ marginTop: 0, flex: 1 }}>{t('roadmap.wp.help')}</p>
        {canManage && !form && <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ name: '', scenarioId: states[0]?.id || '', segmentId: '', startDate: '', endDate: '', owner: '', description: '', status: 'PLANNED' })}>{t('roadmap.wp.new')}</button>}
      </div>
      {form && (
        <div className="rm-form rm-item" style={{ marginBottom: 12 }}>
          <div className="rm-field rm-wide"><label htmlFor="rm-wp-name">{t('roadmap.name')}</label><input id="rm-wp-name" className="rm-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-wp-state">{t('roadmap.wp.state')}</label>
            <select id="rm-wp-state" className="rm-input" value={form.scenarioId} disabled={form.id && form.status !== 'PLANNED'} onChange={e => setForm({ ...form, scenarioId: e.target.value })}>{states.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="rm-field"><label htmlFor="rm-wp-seg">{t('roadmap.wp.segment')}</label>
            <select id="rm-wp-seg" className="rm-input" value={form.segmentId} onChange={e => setForm({ ...form, segmentId: e.target.value })}><option value="">—</option>{data.segments.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="rm-field"><label htmlFor="rm-wp-start">{t('roadmap.wp.start')}</label><input id="rm-wp-start" type="date" className="rm-input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-wp-end">{t('roadmap.wp.end')}</label><input id="rm-wp-end" type="date" className="rm-input" value={form.endDate} disabled={form.status === 'COMMITTED'} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-wp-owner">{t('roadmap.owner')}</label><input id="rm-wp-owner" className="rm-input" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></div>
          <div className="rm-field rm-wide"><label htmlFor="rm-wp-desc">{t('roadmap.description')}</label><input id="rm-wp-desc" className="rm-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="rm-actions rm-wide"><button type="button" className="btn btn-primary btn-sm" disabled={!form.name || !form.scenarioId} onClick={save}>{t('roadmap.save')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>{t('roadmap.cancel')}</button></div>
        </div>
      )}
      {err && <p className="rm-error" role="alert">{err}</p>}{msg && <p className="rm-ok" role="status">{msg}</p>}
      {data.workPackages.length === 0 ? <p className="rm-muted">{t('roadmap.wp.empty')}</p> : states.map((s: any) => {
        const wps = data.workPackages.filter((w: any) => w.scenarioId === s.id)
        if (!wps.length) return null
        return (
          <section key={s.id} style={{ marginTop: 12 }}>
            <h4 className="rm-h3">{s.name} <span className="rm-muted">{day(s.horizonDate)}</span></h4>
            <ul className="rm-list">
              {wps.map((w: any) => (
                <li key={w.id} className="rm-item">
                  <div className="rm-item-head">
                    <span className="rm-item-name">{w.name}</span>
                    <Chip tone={STATUS_TONE[w.status]}>{t(`roadmap.wp.status.${w.status}`)}</Chip>
                  </div>
                  <div className="rm-muted" style={{ marginTop: 4 }}>
                    {day(w.startDate) || '…'} → {day(w.endDate) || t('roadmap.not_set')}
                    {w.segmentId && ` · ${data.segments.find((x: any) => x.id === w.segmentId)?.name || ''}`}{w.owner ? ` · ${w.owner}` : ''}
                    {' · '}{w.status === 'DELIVERED' ? fill(t('roadmap.wp.delivered_changes'), { n: w.deliveredChanges }) : fill(t('roadmap.wp.changes'), { n: w.changes })}
                  </div>
                  <div className="rm-actions" style={{ marginTop: 8 }}>
                    {w.changes > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onShowChanges(w.id)}>{t('roadmap.wp.show_changes')}</button>}
                    {canManage && (w.status === 'PLANNED' || w.status === 'COMMITTED') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...w, segmentId: w.segmentId || '', startDate: day(w.startDate), endDate: day(w.endDate), owner: w.owner || '', description: w.description || '' })}>{t('roadmap.edit')}</button>}
                    {canDeliver && w.status === 'PLANNED' && <button type="button" className="btn btn-primary btn-sm" onClick={() => action(w, 'commit')}>{t('roadmap.wp.commit')}</button>}
                    {canDeliver && w.status === 'COMMITTED' && <><button type="button" className="btn btn-primary btn-sm" onClick={() => action(w, 'deliver')}>{t('roadmap.wp.deliver')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => action(w, 'uncommit')}>{t('roadmap.wp.uncommit')}</button></>}
                    {canManage && (w.status === 'PLANNED' || w.status === 'COMMITTED') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => action(w, 'cancel')}>{t('roadmap.wp.cancel')}</button>}
                    {canManage && (w.status === 'PLANNED' || w.status === 'CANCELLED') && <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(w)}>{t('roadmap.delete')}</button>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

// ── Programmes (segments) ──────────────────────────────────────────────────
export function SegmentsPanel({ data, api, canManage, onChanged }: PanelProps) {
  const { t } = useLang()
  const { err, run } = useRun(onChanged)
  const [form, setForm] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  useEffect(() => { api.get('/ea-planning/plans').then((d: any) => setPlans(Array.isArray(d) ? d : d?.items || d?.data || [])).catch(() => setPlans([])) }, [api])
  const save = () => run(async () => {
    const body = { name: form.name, owner: form.owner || undefined, description: form.description || undefined, planId: form.planId || null, domains: form.domains ? String(form.domains).split(',').map((x: string) => x.trim()).filter(Boolean) : [] }
    if (form.id) await api.put(`/architecture-roadmap/segments/${form.id}`, body); else await api.post('/architecture-roadmap/segments', body)
    setForm(null)
  })
  const remove = (s: any) => { if (window.confirm(fill(t('roadmap.confirm_delete'), { name: s.name }))) run(() => api.del(`/architecture-roadmap/segments/${s.id}`)) }
  return (
    <div>
      <div className="rm-head"><p className="rm-sub" style={{ marginTop: 0, flex: 1 }}>{t('roadmap.seg.help')}</p>
        {canManage && !form && <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ name: '', owner: '', description: '', planId: '', domains: '' })}>{t('roadmap.seg.new')}</button>}
      </div>
      {form && (
        <div className="rm-form rm-item" style={{ marginBottom: 12 }}>
          <div className="rm-field"><label htmlFor="rm-seg-name">{t('roadmap.name')}</label><input id="rm-seg-name" className="rm-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-seg-owner">{t('roadmap.owner')}</label><input id="rm-seg-owner" className="rm-input" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-seg-plan">{t('roadmap.seg.plan')}</label>
            <select id="rm-seg-plan" className="rm-input" value={form.planId} onChange={e => setForm({ ...form, planId: e.target.value })}><option value="">{t('roadmap.seg.no_plan')}</option>{plans.map(p => <option key={p.id} value={p.id}>{p.nameEn}</option>)}</select></div>
          <div className="rm-field"><label htmlFor="rm-seg-domains">{t('roadmap.seg.domains')}</label><input id="rm-seg-domains" className="rm-input" value={form.domains} onChange={e => setForm({ ...form, domains: e.target.value })} placeholder="APP, DATA" /></div>
          <div className="rm-field rm-wide"><label htmlFor="rm-seg-desc">{t('roadmap.description')}</label><input id="rm-seg-desc" className="rm-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="rm-actions rm-wide"><button type="button" className="btn btn-primary btn-sm" disabled={!form.name} onClick={save}>{t('roadmap.save')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>{t('roadmap.cancel')}</button></div>
        </div>
      )}
      {err && <p className="rm-error" role="alert">{err}</p>}
      {data.segments.length === 0 ? <p className="rm-muted">{t('roadmap.seg.empty')}</p> : (
        <ul className="rm-list">
          {data.segments.map((s: any) => (
            <li key={s.id} className="rm-item">
              <div className="rm-item-head"><span className="rm-item-name">{s.name}</span>
                {canManage && <span className="rm-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm({ ...s, owner: s.owner || '', description: s.description || '', planId: s.planId || '', domains: (s.domains || []).join(', ') })}>{t('roadmap.edit')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(s)}>{t('roadmap.delete')}</button></span>}
              </div>
              <div className="rm-muted" style={{ marginTop: 4 }}>
                {s.owner ? `${s.owner} · ` : ''}{plans.find(p => p.id === s.planId)?.nameEn || (s.planId ? '' : t('roadmap.seg.no_plan'))}{(s.domains || []).length ? ` · ${s.domains.join(', ')}` : ''}
              </div>
              <div className="rm-muted">{fill(t('roadmap.seg.summary'), { packages: s.workPackages, delivered: s.delivered, changes: s.changes })}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Target measures ────────────────────────────────────────────────────────
export function MeasuresPanel({ data, api, canManage, onChanged }: PanelProps) {
  const { t } = useLang()
  const { err, msg, run } = useRun(onChanged)
  const states = transitionsAndTarget(data)
  const [form, setForm] = useState<any>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [search, setSearch] = useState('')
  useEffect(() => {
    if (!form?.kind) return
    const id = setTimeout(() => api.get(`/architecture-roadmap/measure-subjects?kind=${form.kind}${search ? `&search=${encodeURIComponent(search)}` : ''}`).then((d: any) => setSubjects(Array.isArray(d) ? d : [])).catch(() => setSubjects([])), 250)
    return () => clearTimeout(id)
  }, [api, form?.kind, search])
  const save = () => run(async () => { await api.post('/architecture-roadmap/measures', { kind: form.kind, subjectId: form.subjectId, scenarioId: form.scenarioId, targetValue: Number(form.targetValue), unit: form.unit || null, note: form.note || null }); setForm(null) })
  const remove = (m: any) => { if (window.confirm(fill(t('roadmap.confirm_delete'), { name: m.subjectName }))) run(() => api.del(`/architecture-roadmap/measures/${m.id}`)) }
  const toWp = (m: any) => run(() => api.post(`/architecture-roadmap/measures/${m.id}/work-package`), () => t('roadmap.saved'))
  const fmt = (v: number | null | undefined, unit?: string | null) => (v == null ? '—' : `${v}${unit ? ` ${unit}` : ''}`)
  return (
    <div>
      <div className="rm-head"><p className="rm-sub" style={{ marginTop: 0, flex: 1 }}>{t('roadmap.m.help')}</p>
        {canManage && !form && <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ kind: 'DOMAIN_MATURITY', subjectId: '', scenarioId: states[states.length - 1]?.id || '', targetValue: '', unit: '', note: '' })}>{t('roadmap.m.new')}</button>}
      </div>
      {form && (
        <div className="rm-form rm-item" style={{ marginBottom: 12 }}>
          <div className="rm-field"><label htmlFor="rm-m-kind">{t('roadmap.m.kind')}</label>
            <select id="rm-m-kind" className="rm-input" value={form.kind} onChange={e => { setForm({ ...form, kind: e.target.value, subjectId: '' }); setSearch('') }}>{MEASURE_KINDS.map(k => <option key={k} value={k}>{t(`roadmap.m.kind.${k}`)}</option>)}</select></div>
          <div className="rm-field"><label htmlFor="rm-m-state">{t('roadmap.m.by')}</label>
            <select id="rm-m-state" className="rm-input" value={form.scenarioId} onChange={e => setForm({ ...form, scenarioId: e.target.value })}>{states.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          {form.kind !== 'DOMAIN_MATURITY' && <div className="rm-field"><label htmlFor="rm-m-search">{t('roadmap.m.search')}</label><input id="rm-m-search" className="rm-input" value={search} onChange={e => setSearch(e.target.value)} /></div>}
          <div className="rm-field"><label htmlFor="rm-m-subject">{t('roadmap.m.subject')}</label>
            <select id="rm-m-subject" className="rm-input" value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })}><option value="">—</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div className="rm-field"><label htmlFor="rm-m-target">{t('roadmap.m.target')}</label><input id="rm-m-target" type="number" step="any" className="rm-input" value={form.targetValue} onChange={e => setForm({ ...form, targetValue: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-m-unit">{t('roadmap.m.unit')}</label><input id="rm-m-unit" className="rm-input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
          <div className="rm-field rm-wide"><label htmlFor="rm-m-note">{t('roadmap.m.note')}</label><input id="rm-m-note" className="rm-input" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
          <div className="rm-actions rm-wide"><button type="button" className="btn btn-primary btn-sm" disabled={!form.subjectId || form.targetValue === '' || !form.scenarioId} onClick={save}>{t('roadmap.save')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setForm(null)}>{t('roadmap.cancel')}</button></div>
        </div>
      )}
      {err && <p className="rm-error" role="alert">{err}</p>}{msg && <p className="rm-ok">{msg}</p>}
      {data.measures.length === 0 ? <p className="rm-muted">{t('roadmap.m.empty')}</p> : (
        <div className="rm-table-wrap">
          <table className="rm-table">
            <thead><tr><th scope="col">{t('roadmap.m.subject')}</th><th scope="col">{t('roadmap.m.kind')}</th><th scope="col" className="num">{t('roadmap.m.target')}</th><th scope="col" className="num">{t('roadmap.m.current')}</th><th scope="col">{t('roadmap.m.by')}</th><th scope="col" /></tr></thead>
            <tbody>
              {data.measures.map((m: any) => (
                <tr key={m.id}>
                  <td><strong>{m.subjectName}</strong>{m.note && <div className="rm-muted">{m.note}</div>}</td>
                  <td>{t(`roadmap.m.kind.${m.kind}`)}</td>
                  <td className="num">{fmt(m.targetValue, m.unit)}</td>
                  <td className="num">{fmt(m.current, m.unit)}{m.projected != null && <div className="rm-muted">{t('roadmap.m.projected')}: {m.projected}</div>}<div className="rm-muted" style={{ textAlign: 'start' }}>{m.currentDetail}</div></td>
                  <td>{m.stateName}<div className="rm-muted">{day(m.dueDate)}</div><div className="rm-row"><Chip tone={STATUS_TONE[m.status]}>{t(`roadmap.m.status.${m.status}`)}</Chip>{m.overdue && <Chip tone="bad">{t('roadmap.m.overdue')}</Chip>}</div></td>
                  <td>{canManage && <span className="rm-actions">{m.status !== 'MET' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => toWp(m)}>{t('roadmap.m.to_wp')}</button>}<button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(m)}>{t('roadmap.delete')}</button></span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── By domain ──────────────────────────────────────────────────────────────
export function DomainsPanel({ data, onShowChanges }: { data: any; onShowChanges: (domain: string) => void }) {
  const { t } = useLang()
  if (!data.domains.length) return <p className="rm-muted">{t('roadmap.d.empty')}</p>
  return (
    <div>
      <p className="rm-sub" style={{ marginTop: 0 }}>{t('roadmap.d.help')}</p>
      <div className="rm-table-wrap">
        <table className="rm-table">
          <thead><tr>{['domain', 'total', 'introduce', 'retire', 'modify', 'links', 'planned'].map(k => <th key={k} scope="col" className={k === 'domain' ? '' : 'num'}>{t(`roadmap.d.${k}`)}</th>)}</tr></thead>
          <tbody>
            {data.domains.map((d: any) => (
              <tr key={d.domain}>
                <th scope="row"><button type="button" className="btn btn-secondary btn-sm" onClick={() => onShowChanges(d.domain)}>{d.domainName || d.domain}</button></th>
                <td className="num">{d.total}</td><td className="num">{d.introduce}</td><td className="num">{d.retire}</td><td className="num">{d.modify}</td><td className="num">{d.links}</td><td className="num">{d.planned}/{d.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── As at a date ───────────────────────────────────────────────────────────
export function AsAtPanel({ api }: { api: RoadmapApi }) {
  const { t } = useLang()
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [res, setRes] = useState<any>(null)
  const [err, setErr] = useState('')
  const show = useMemo(() => () => { setErr(''); api.get(`/architecture-roadmap/as-at?date=${date}`).then(setRes).catch((e: any) => setErr(e.message)) }, [api, date])
  return (
    <div>
      <p className="rm-sub" style={{ marginTop: 0 }}>{t('roadmap.asat.help')}<HelpTip text={t('roadmap.asat.help')} /></p>
      <div className="rm-filters">
        <div className="rm-field"><label htmlFor="rm-asat">{t('roadmap.date')}</label><input id="rm-asat" type="date" className="rm-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={show}>{t('roadmap.asat.show')}</button>
      </div>
      {err && <p className="rm-error" role="alert">{err}</p>}
      {res && (
        <div className="rm-item">
          <div className="rm-item-name">{fill(t('roadmap.asat.state'), { state: res.state?.name || '—' })}</div>
          <div className="rm-muted">{fill(t('roadmap.asat.counts'), { by: res.changesByThen, after: res.changesAfter })}</div>
          {res.workPackagesDue.length > 0 && <>
            <h4 className="rm-h3" style={{ marginTop: 10 }}>{t('roadmap.asat.due')} <span className="rm-muted">{fill(t('roadmap.asat.not_delivered'), { n: res.notDeliveredYet })}</span></h4>
            <ul className="rm-warn-list">{res.workPackagesDue.map((w: any) => <li key={w.id}>{w.name} · {day(w.endDate)} · {t(`roadmap.wp.status.${w.status}`)}</li>)}</ul>
          </>}
        </div>
      )}
    </div>
  )
}
