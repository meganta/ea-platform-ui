import { useCallback, useEffect, useMemo, useState } from 'react'
import HelpTip from '../../components/HelpTip'
import { useLang } from '../../contexts/LangContext'
import { useAuth } from '../../contexts/AuthContext'
import { Chip } from './RoadmapChip'
import { ChangesPanel, DomainsPanel, AsAtPanel, MeasuresPanel, SegmentsPanel, WorkPackagesPanel } from './RoadmapPanels'
import { LineState, day, fill, insertByDate, makeRoadmapApi, measureCounts, move, stateLabel, stateStatus, STATUS_TONE, warningText } from './roadmapModel'
import './Roadmap.css'

type Sub = 'changes' | 'packages' | 'segments' | 'measures' | 'domains' | 'asat'
const SUBS: Sub[] = ['changes', 'packages', 'segments', 'measures', 'domains', 'asat']

/**
 * EA Planning > Target architecture: the enterprise roadmap. One line Current
 * -> dated Transitions -> enterprise Target; programmes, work packages,
 * target measures. Every figure comes from /architecture-roadmap.
 */
export default function ArchitectureRoadmap() {
  const { t, isAR } = useLang()
  const { hasPermission, user } = useAuth() as any
  const api = useMemo(() => makeRoadmapApi(), [])
  const can = useMemo(() => ({
    view: hasPermission('Roadmap.View'),
    manage: hasPermission('Roadmap.Manage'),
    deliver: hasPermission('Roadmap.Deliver'),
    admin: ['TENANT_ADMIN', 'SUPERADMIN'].includes(String(user?.role)),
  }), [hasPermission, user])
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [sub, setSub] = useState<Sub>('changes')
  const [changeFilter, setChangeFilter] = useState<{ workPackageId?: string; stateId?: string; domain?: string }>({})

  const load = useCallback(() => {
    setError('')
    return api.get('/architecture-roadmap').then(setData).catch((e: any) => setError(e.message || 'error'))
  }, [api])
  useEffect(() => { if (can.view) load() }, [load, can.view])

  if (!can.view) return <p className="rm-muted">{t('roadmap.no_access')}</p>
  if (error && !data) return <p className="rm-error" role="alert">{t('roadmap.error')} {error}</p>
  if (!data) return <p className="rm-muted" aria-busy="true">{t('roadmap.loading')}</p>

  const dir = isAR ? 'rtl' : 'ltr'
  if (!data.roadmap) return <div className="rm" dir={dir}><SetupCard data={data} canManage={can.manage} onDone={setData} /></div>

  const showChanges = (f: typeof changeFilter) => { setChangeFilter(f); setSub('changes') }
  const p = data.progress
  const mc = measureCounts(data.measures || [])
  return (
    <div className="rm" dir={dir}>
      <div className="rm-card">
        <div className="rm-head">
          <div>
            <h2 className="rm-title">{data.roadmap.name}<HelpTip text={t('roadmap.help')} /></h2>
            <div className="rm-sub">
              {fill(t('roadmap.horizon'), { start: day(data.roadmap.startDate), target: day(data.roadmap.targetDate) })} · {t(`roadmap.step.${data.roadmap.stepSize}`)}
              {data.inEffect?.state && <> · {fill(t('roadmap.in_effect'), { state: data.inEffect.state.name })}</>}
              {data.inEffect?.next && <> · {fill(t('roadmap.next'), { state: data.inEffect.next.name, date: day(data.inEffect.next.horizonDate) || t('roadmap.not_set') })}</>}
            </div>
          </div>
        </div>
      </div>

      <section className="rm-tiles" aria-label={t('roadmap.title')}>
        <Tile label={t('roadmap.kpi.delivered')} help={t('roadmap.kpi.delivered_help')} value={p.deliveredShare == null ? '—' : `${p.deliveredShare}%`} bar={p.deliveredShare}
          sub={fill(t('roadmap.kpi.delivered_sub'), { delivered: p.changes.delivered, remaining: p.changes.remaining })} />
        <Tile label={t('roadmap.kpi.packages')} value={String(p.workPackages.total)} sub={fill(t('roadmap.kpi.packages_sub'), p.workPackages)} />
        <Tile label={t('roadmap.kpi.unplanned')} value={String(p.changes.unplanned)} sub={t('roadmap.kpi.unplanned_sub')} />
        <Tile label={t('roadmap.kpi.measures')} value={mc.total ? `${mc.met}/${mc.total}` : '—'} sub={fill(t('roadmap.kpi.measures_sub'), { below: mc.below, unmeasured: mc.unmeasured })} />
      </section>

      {data.warnings?.length > 0 && (
        <div className="rm-card" role="status">
          <h3 className="rm-h3">{t('roadmap.warnings.title')}</h3>
          <ul className="rm-warn-list">{data.warnings.slice(0, 12).map((w: any, i: number) => <li key={i}>{warningText(w, t)}</li>)}</ul>
        </div>
      )}

      <LineCard data={data} can={can} api={api} reload={load} onShowChanges={stateId => showChanges({ stateId })} />
      {data.offLine?.length > 0 && <OffLineCard data={data} can={can} api={api} reload={load} />}

      <div className="rm-card">
        <div className="rm-tabs" role="tablist">
          {SUBS.map(s => <button key={s} type="button" role="tab" aria-selected={sub === s} className="rm-tab" onClick={() => setSub(s)}>{t(`roadmap.sub.${s}`)}</button>)}
        </div>
        <div style={{ paddingTop: 14 }}>
          {sub === 'changes' && <ChangesPanel data={data} api={api} canManage={can.manage} filter={changeFilter} onChanged={load} />}
          {sub === 'packages' && <WorkPackagesPanel data={data} api={api} canManage={can.manage} canDeliver={can.deliver} onChanged={load} onShowChanges={workPackageId => showChanges({ workPackageId })} />}
          {sub === 'segments' && <SegmentsPanel data={data} api={api} canManage={can.manage} onChanged={load} />}
          {sub === 'measures' && <MeasuresPanel data={data} api={api} canManage={can.manage} onChanged={load} />}
          {sub === 'domains' && <DomainsPanel data={data} onShowChanges={domain => showChanges({ domain })} />}
          {sub === 'asat' && <AsAtPanel api={api} />}
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, sub, help, bar }: { label: string; value: string; sub?: string; help?: string; bar?: number | null }) {
  return (
    <div className="rm-tile">
      <div className="rm-tile-label">{label}{help && <HelpTip text={help} />}</div>
      <div className="rm-tile-value">{value}</div>
      {bar != null && <span className="rm-bar" aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></span>}
      {sub && <div className="rm-tile-sub">{sub}</div>}
    </div>
  )
}

// ── Set-up ─────────────────────────────────────────────────────────────────
function SetupCard({ data, canManage, onDone }: { data: any; canManage: boolean; onDone: (d: any) => void }) {
  const { t } = useLang()
  const api = useMemo(() => makeRoadmapApi(), [])
  const s = data.suggestion || {}
  const [form, setForm] = useState({ name: '', startDate: s.startDate || '', years: s.years || 3, stepSize: s.stepSize || 'ANNUAL', targetScenarioId: '', createTransitions: false })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const submit = async () => {
    setBusy(true); setErr('')
    try {
      onDone(await api.post('/architecture-roadmap', { ...form, name: form.name || undefined, targetScenarioId: form.targetScenarioId || undefined, years: Number(form.years) }))
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="rm-card">
      <h2 className="rm-title">{t('roadmap.setup.title')}<HelpTip text={t('roadmap.help')} /></h2>
      <p className="rm-sub">{t('roadmap.setup.intro')}</p>
      {canManage ? (
        <div className="rm-form">
          <div className="rm-field rm-wide"><label htmlFor="rm-setup-name">{t('roadmap.setup.name')}</label><input id="rm-setup-name" className="rm-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Enterprise Architecture Roadmap" /></div>
          <div className="rm-field"><label htmlFor="rm-setup-start">{t('roadmap.setup.start')}</label><input id="rm-setup-start" type="date" className="rm-input" value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
          <div className="rm-field"><label htmlFor="rm-setup-years">{t('roadmap.setup.years')}</label><input id="rm-setup-years" type="number" min={1} max={10} className="rm-input" value={form.years} onChange={e => set('years', e.target.value)} /></div>
          <div className="rm-field"><label htmlFor="rm-setup-step">{t('roadmap.setup.step')}</label>
            <select id="rm-setup-step" className="rm-input" value={form.stepSize} onChange={e => set('stepSize', e.target.value)}>
              <option value="ANNUAL">{t('roadmap.step.ANNUAL')}</option><option value="HALF_YEAR">{t('roadmap.step.HALF_YEAR')}</option>
            </select></div>
          <div className="rm-field"><label htmlFor="rm-setup-target">{t('roadmap.setup.target')}</label>
            <select id="rm-setup-target" className="rm-input" value={form.targetScenarioId} onChange={e => set('targetScenarioId', e.target.value)}>
              <option value="">{t('roadmap.setup.target_new')}</option>
              {(data.candidates || []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
            </select></div>
          <label className="rm-row rm-wide" style={{ fontSize: 13 }}><input type="checkbox" checked={form.createTransitions} onChange={e => set('createTransitions', e.target.checked)} />{t('roadmap.setup.transitions')}</label>
          <div className="rm-wide"><button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>{t('roadmap.setup.submit')}</button></div>
          {err && <p className="rm-error rm-wide" role="alert">{err}</p>}
        </div>
      ) : <p className="rm-muted">{t('roadmap.no_access')}</p>}
    </div>
  )
}

// ── The line ───────────────────────────────────────────────────────────────
function LineCard({ data, can, api, reload, onShowChanges }: { data: any; can: any; api: any; reload: () => void; onShowChanges: (stateId: string) => void }) {
  const { t } = useLang()
  const line: LineState[] = data.line
  const [arranging, setArranging] = useState(false)
  const [order, setOrder] = useState<any[]>([])
  const [editing, setEditing] = useState<any>(null)
  const [adding, setAdding] = useState<{ name: string; horizonDate: string } | null>(null)
  const [err, setErr] = useState('')
  const today = Date.now()

  const run = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); await reload() } catch (e: any) { setErr(e.message) } }
  const startArrange = () => { setOrder(line.filter(s => s.label === 'TRANSITION')); setArranging(true) }
  const saveOrder = () => run(async () => { await api.put('/architecture-roadmap/line', { transitions: order.map(s => ({ id: s.id })) }); setArranging(false) })
  const setStatus = (s: LineState, status: 'DRAFT' | 'APPROVED') => run(() => api.patch(`/ea-views/scenarios/${s.id}/status`, { status }))
  const saveEdit = () => run(async () => { await api.put(`/architecture-roadmap/states/${editing.id}`, { name: editing.name, horizonDate: editing.horizonDate || null, owner: editing.owner || null }); setEditing(null) })
  const addState = () => run(async () => { await api.post('/architecture-roadmap/states', adding); setAdding(null) })
  const remove = (s: LineState) => { if (window.confirm(fill(t('roadmap.confirm_delete'), { name: s.name }))) run(() => api.del(`/architecture-roadmap/states/${s.id}`)) }

  return (
    <div className="rm-card">
      <div className="rm-head">
        <h3 className="rm-h3">{t('roadmap.line.title')}<HelpTip text={t('roadmap.line.help')} /></h3>
        {can.manage && !arranging && (
          <div className="rm-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding({ name: '', horizonDate: '' })}>{t('roadmap.state.add')}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={startArrange}>{t('roadmap.state.arrange')}</button>
          </div>
        )}
      </div>

      {adding && (
        <div className="rm-form">
          <div className="rm-field"><label htmlFor="rm-add-name">{t('roadmap.name')}</label><input id="rm-add-name" className="rm-input" value={adding.name} onChange={e => setAdding({ ...adding, name: e.target.value })} /></div>
          <div className="rm-field"><label htmlFor="rm-add-date">{t('roadmap.date')}</label><input id="rm-add-date" type="date" className="rm-input" value={adding.horizonDate} onChange={e => setAdding({ ...adding, horizonDate: e.target.value })} /></div>
          <div className="rm-actions rm-wide"><button type="button" className="btn btn-primary btn-sm" disabled={!adding.name || !adding.horizonDate} onClick={addState}>{t('roadmap.add')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(null)}>{t('roadmap.cancel')}</button></div>
        </div>
      )}

      {arranging ? (
        <div>
          <p className="rm-sub">{t('roadmap.state.arrange_help')}</p>
          <ol className="rm-list" style={{ marginTop: 10 }}>
            {order.map((s, i) => (
              <li key={s.id} className="rm-item rm-item-head">
                <span><strong>{i + 1}.</strong> {s.name} <span className="rm-muted">{day(s.horizonDate) || t('roadmap.not_set')}</span></span>
                <span className="rm-actions">
                  <button type="button" className="btn btn-secondary btn-sm" aria-label={`${t('roadmap.state.up')}: ${s.name}`} disabled={i === 0} onClick={() => setOrder(move(order, i, -1))}>↑</button>
                  <button type="button" className="btn btn-secondary btn-sm" aria-label={`${t('roadmap.state.down')}: ${s.name}`} disabled={i === order.length - 1} onClick={() => setOrder(move(order, i, 1))}>↓</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOrder(order.filter(x => x.id !== s.id))}>{t('roadmap.state.remove_from_line')}</button>
                </span>
              </li>
            ))}
          </ol>
          {(data.offLine || []).filter((o: any) => !order.some(x => x.id === o.id)).length > 0 && (
            <div className="rm-row" style={{ marginTop: 10 }}>
              {(data.offLine || []).filter((o: any) => !order.some(x => x.id === o.id)).map((o: any) => (
                <button key={o.id} type="button" className="btn btn-secondary btn-sm" onClick={() => setOrder(insertByDate(order, o))}>+ {o.name}</button>
              ))}
            </div>
          )}
          <div className="rm-actions" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={saveOrder}>{t('roadmap.state.save_order')}</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setArranging(false)}>{t('roadmap.cancel')}</button>
          </div>
        </div>
      ) : (
        <div className="rm-line" role="list">
          {line.map((s, i) => {
            const status = stateStatus(s)
            const overdue = s.label !== 'CURRENT' && !s.achievedAt && !!s.horizonDate && new Date(s.horizonDate).getTime() < today && (s.changes ?? 0) > 0
            return [
              i > 0 && <span key={`a${s.id}`} className="rm-arrow" aria-hidden="true">→</span>,
              <div key={s.id} role="listitem" className={`rm-state ${s.label}${overdue ? ' overdue' : ''}`}>
                <div className="rm-state-kicker">{stateLabel(s, t)}</div>
                {editing?.id === s.id ? (
                  <>
                    <label className="rm-field"><span>{t('roadmap.name')}</span><input className="rm-input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label>
                    {s.label !== 'CURRENT' && <label className="rm-field"><span>{t('roadmap.date')}</span><input type="date" className="rm-input" value={editing.horizonDate} onChange={e => setEditing({ ...editing, horizonDate: e.target.value })} /></label>}
                    <label className="rm-field"><span>{t('roadmap.owner')}</span><input className="rm-input" value={editing.owner} onChange={e => setEditing({ ...editing, owner: e.target.value })} /></label>
                    <div className="rm-actions"><button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>{t('roadmap.save')}</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>{t('roadmap.cancel')}</button></div>
                  </>
                ) : (
                  <>
                    <div className="rm-state-name">{s.name}</div>
                    <div className="rm-row"><Chip tone={STATUS_TONE[status]}>{t(`roadmap.status.${status}`)}</Chip>{overdue && <Chip tone="bad">{t('roadmap.m.overdue')}</Chip>}</div>
                    {s.label !== 'CURRENT' && (
                      <div className="rm-state-meta">
                        {day(s.horizonDate) || t('roadmap.not_set')}
                        {s.owner ? ` · ${s.owner}` : ''}<br />
                        {fill(t('roadmap.state.changes'), { n: s.changes ?? 0 })}{(s.unplanned ?? 0) > 0 && <> · {fill(t('roadmap.state.unplanned'), { n: s.unplanned })}</>}<br />
                        {(s.workPackages ?? 0) > 0 && fill(t('roadmap.state.packages'), { delivered: s.delivered ?? 0, n: s.workPackages })}
                      </div>
                    )}
                    <div className="rm-actions">
                      <a className="btn btn-secondary btn-sm" href={`/ea-views?scenarioId=${s.id}`}>{t('roadmap.state.open_views')}</a>
                      {s.label !== 'CURRENT' && (s.changes ?? 0) > 0 && <button type="button" className="btn btn-secondary btn-sm" onClick={() => onShowChanges(s.id)}>{t('roadmap.sub.changes')}</button>}
                      {can.manage && s.label !== 'CURRENT' && !s.achievedAt && (s.status === 'APPROVED'
                        ? <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(s, 'DRAFT')}>{t('roadmap.state.to_draft')}</button>
                        : <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(s, 'APPROVED')}>{t('roadmap.state.approve')}</button>)}
                      {can.manage && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing({ id: s.id, name: s.name, horizonDate: day(s.horizonDate), owner: s.owner || '' })}>{t('roadmap.edit')}</button>}
                      {can.admin && s.label === 'TRANSITION' && <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(s)}>{t('roadmap.delete')}</button>}
                    </div>
                  </>
                )}
              </div>,
            ]
          })}
        </div>
      )}
      {err && <p className="rm-error" role="alert">{err}</p>}
    </div>
  )
}

function OffLineCard({ data, can, api, reload }: { data: any; can: any; api: any; reload: () => void }) {
  const { t } = useLang()
  const [err, setErr] = useState('')
  const transitions = data.line.filter((s: LineState) => s.label === 'TRANSITION')
  const run = async (fn: () => Promise<any>) => { setErr(''); try { await fn(); await reload() } catch (e: any) { setErr(e.message) } }
  const place = (o: any) => run(() => api.put('/architecture-roadmap/line', { transitions: insertByDate(transitions, o).map((s: any) => ({ id: s.id })) }))
  const remove = (o: any) => { if (window.confirm(fill(t('roadmap.confirm_delete'), { name: o.name }))) run(() => api.del(`/architecture-roadmap/states/${o.id}`)) }
  return (
    <div className="rm-card">
      <h3 className="rm-h3">{t('roadmap.offline.title')}<HelpTip text={t('roadmap.offline.help')} /></h3>
      <ul className="rm-list">
        {data.offLine.map((o: any) => (
          <li key={o.id} className="rm-item rm-item-head">
            <span><span className="rm-item-name">{o.name}</span> <span className="rm-muted">{o.type} · {t(`roadmap.status.${o.status === 'APPROVED' ? 'APPROVED' : 'DRAFT'}`)}{o.branchesFrom ? ` · ${fill(t('roadmap.offline.branches'), { state: o.branchesFrom })}` : ''}{o.horizonDate ? ` · ${day(o.horizonDate)}` : ''}</span></span>
            <span className="rm-actions">
              <a className="btn btn-secondary btn-sm" href={`/ea-views?scenarioId=${o.id}`}>{t('roadmap.state.open_views')}</a>
              {can.manage && <button type="button" className="btn btn-secondary btn-sm" onClick={() => place(o)}>{t('roadmap.offline.add_to_line')}</button>}
              {can.admin && <button type="button" className="btn btn-secondary btn-sm" onClick={() => remove(o)}>{t('roadmap.delete')}</button>}
            </span>
          </li>
        ))}
      </ul>
      {err && <p className="rm-error" role="alert">{err}</p>}
    </div>
  )
}
