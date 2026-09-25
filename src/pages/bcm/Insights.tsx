import { useCallback, useEffect, useState } from 'react'
import { bcm } from './ReferenceModels'

// BCM Phase 3 UI: executive insights (summary -> filter -> drill-down),
// capability insight (health PROFILE, gap lenses, materiality, trend),
// improvement actions and the governed Capability Advisor. All figures come
// from deterministic server rules; the UI never computes a score.

type LFn = (en: string, ar: string) => string
const box: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: 12, background: 'var(--navy-light)' }
const small: React.CSSProperties = { fontSize: 12, color: 'var(--text-dim)' }
const BAND_COLOR: Record<string, string> = { CONCERN: 'var(--danger)', WATCH: 'var(--warning)', OK: 'var(--success)', STRONG: 'var(--success)', HIGH: 'var(--danger)', MEDIUM: 'var(--warning)', LOW: 'var(--success)' }
const LENS: Record<string, [string, string]> = {
  MATURITY: ['Maturity gap', 'فجوة النضج'], REFERENCE: ['Reference gap', 'فجوة مرجعية'], STRATEGIC: ['Strategic gap', 'فجوة استراتيجية'], INVESTMENT: ['Investment gap', 'فجوة استثمارية'],
  PERFORMANCE: ['Performance gap', 'فجوة الأداء'], ARCHITECTURE: ['Architecture gap', 'فجوة البنية'], RISK: ['Risk gap', 'فجوة المخاطر'], EVIDENCE: ['Evidence gap', 'فجوة الأدلة'],
}
const ITEM: Record<string, [string, string]> = {
  maturity: ['Maturity', 'النضج'], targetMaturity: ['Target Maturity', 'النضج المستهدف'], performance: ['Performance', 'الأداء'], strategicImportance: ['Strategic Importance', 'الأهمية الاستراتيجية'],
  businessCriticality: ['Business Criticality', 'الأهمية التشغيلية'], architectureHealth: ['Architecture Health', 'سلامة البنية'], riskExposure: ['Risk Exposure', 'التعرض للمخاطر'],
  investmentPriority: ['Investment Priority', 'أولوية الاستثمار'], evidenceConfidence: ['Evidence Confidence', 'موثوقية الأدلة'],
}
const NA = (L: LFn) => <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>{L('Data not available', 'البيانات غير متاحة')}</span>

// ── Executive insights ─────────────────────────────────────────────────────
export function ExecutiveInsights({ L, onOpenCapability }: { L: LFn; onOpenCapability: (id: string) => void }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  useEffect(() => { bcm('GET', '/insights/executive').then(setD).catch(e => setError(e.message)) }, [])
  if (error) return <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>
  if (!d) return <div>{L('Loading…', 'جارٍ التحميل…')}</div>
  const tiles: Array<[string, string, string, any[] | number | null]> = [
    ['criticalBelowTarget', 'Critical below target', 'حرجة دون المستهدف', d.criticalBelowTarget],
    ['highestMaterialGaps', 'Highest material gaps', 'أعلى الفجوات الجوهرية', d.highestMaterialGaps],
    ['largestMaturityGaps', 'Largest maturity gaps', 'أكبر فجوات النضج', d.largestMaturityGaps],
    ['weakEvidenceHighClaim', 'Weak evidence, high claim', 'أدلة ضعيفة ونضج مرتفع', d.weakEvidenceHighClaim],
    ['deteriorating', 'Deteriorating', 'متراجعة', d.deteriorating],
    ['materialGapsWithoutActions', 'Material gaps without actions', 'فجوات جوهرية بلا إجراءات', d.materialGapsWithoutActions],
    ['objectivesAtRisk', 'Objectives relying on weak capabilities', 'أهداف تعتمد على قدرات ضعيفة', d.objectivesAtRisk],
  ]
  const list = filter ? (d[filter] as any[]) : null
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, marginBottom: 12 }}>
        {tiles.map(([k, en, ar, v]) => (
          <button key={k} data-testid={`tile-${k}`} onClick={() => setFilter(filter === k ? null : k)} aria-pressed={filter === k} style={{ ...box, textAlign: 'start', cursor: 'pointer', color: 'var(--text)', outline: filter === k ? '2px solid var(--accent)' : 'none' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{Array.isArray(v) ? v.length : v ?? '—'}</div>
            <div style={small}>{L(en, ar)}</div>
          </button>
        ))}
        <div style={box}><div style={{ fontSize: 22, fontWeight: 700 }} data-testid="actions-without-initiative">{d.actionsWithoutInitiative}</div><div style={small}>{L('Accepted actions without an initiative', 'إجراءات معتمدة بلا مبادرة')}</div></div>
        <div style={box}><div style={{ fontSize: 22, fontWeight: 700 }}>{d.referenceGaps ?? '—'}</div><div style={small}>{d.referenceGaps == null ? L('No reference model compared yet', 'لم تتم مقارنة نموذج مرجعي بعد') : L('Unresolved reference gaps (not automatically deficiencies)', 'فجوات مرجعية غير محسومة (ليست قصوراً بالضرورة)')}</div></div>
      </div>
      <div style={{ ...box, marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{L('Maturity distribution', 'توزيع النضج')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 70 }} aria-label={L('Maturity distribution', 'توزيع النضج')}>
          {['1', '2', '3', '4', '5', 'NOT_ASSESSED'].map(k => {
            const n = d.maturityDistribution[k] || 0, max = Math.max(1, ...Object.values(d.maturityDistribution) as number[])
            return <div key={k} style={{ flex: 1, textAlign: 'center', fontSize: 11 }}><div style={{ height: (n / max) * 50, background: k === 'NOT_ASSESSED' ? 'var(--border)' : 'var(--accent)', borderRadius: 3 }} /><div>{k === 'NOT_ASSESSED' ? L('Not assessed', 'غير مقيّمة') : `L${k}`} ({n})</div></div>
          })}
        </div>
        {d.insufficientData > 0 && <div style={{ ...small, marginTop: 6 }}>{L(`${d.insufficientData} capability(ies) lack enough data for a materiality judgement - this is missing data, not low priority.`, `${d.insufficientData} قدرة تفتقر لبيانات كافية لتقدير الأهمية - وهذا نقص بيانات وليس أولوية منخفضة.`)}</div>}
      </div>
      {list && (
        <div style={box} data-testid="insight-list">
          {!list.length ? <div style={small}>{L('Nothing here.', 'لا شيء هنا.')}</div> : list.map((r: any) => (
            filter === 'objectivesAtRisk'
              ? <div key={r.goalId} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}><strong>{r.title}</strong><div style={small}>{r.capabilities.map((c: any) => c.name).join(', ')}</div></div>
              : <button key={r.id} onClick={() => onOpenCapability(r.id)} style={{ display: 'flex', gap: 8, width: '100%', textAlign: 'start', padding: '6px 0', border: 'none', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>
                  <span style={{ flex: 1 }}>{r.name}</span>{r.gap != null && <span>{L('gap', 'فجوة')} {r.gap}</span>}{r.materiality != null && <span>{L('materiality', 'الأهمية')} {r.materiality}</span>}
                </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Capability insight drill-down ─────────────────────────────────────────
export function CapabilityInsight({ id, L, isAR, onClose }: { id: string; L: LFn; isAR: boolean; onClose: () => void }) {
  const [d, setD] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setD(null); bcm('GET', `/insights/capabilities/${id}`).then(setD).catch(e => setError(e.message)) }, [id])
  if (error) return <div role="alert" style={{ color: 'var(--danger)' }}>{error}</div>
  if (!d) return <div>{L('Loading…', 'جارٍ التحميل…')}</div>
  const t = d.trend
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 16 }}>{(isAR && d.capability.nameAr) || d.capability.name}</strong>
        <button className="btn btn-secondary btn-sm" onClick={onClose}>{L('Back', 'رجوع')}</button>
      </div>
      <section style={box} aria-label={L('Capability health profile', 'ملف سلامة القدرة')}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{L('Capability health profile', 'ملف سلامة القدرة')}</div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}><tbody>
          {d.healthProfile.items.map((i: any) => (
            <tr key={i.key} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 0' }}>{ITEM[i.key] ? L(ITEM[i.key][0], ITEM[i.key][1]) : i.key}</td>
              <td data-testid={`health-${i.key}`} style={{ padding: '4px 0', color: i.band ? BAND_COLOR[i.band] : undefined, fontWeight: 600 }}>{i.availability === 'DATA_NOT_AVAILABLE' ? NA(L) : `${i.value}${typeof i.value === 'number' ? ' / 5' : ''}`}</td>
            </tr>
          ))}
        </tbody></table>
        {d.healthProfile.contradictions.length > 0 && (
          <div data-testid="contradictions" style={{ marginTop: 8, fontSize: 12, color: 'var(--warning)' }}>
            {L('Contradictory signals (shown, not averaged):', 'إشارات متعارضة (معروضة دون حساب متوسط):')}
            <ul style={{ margin: '4px 0 0', paddingInlineStart: 18 }}>{d.healthProfile.contradictions.map((c: any) => <li key={c.code}>{c.message}</li>)}</ul>
          </div>
        )}
        {d.healthIndicator?.enabled && (
          <details style={{ marginTop: 8, fontSize: 12 }} data-testid="health-indicator">
            <summary>{L('Secondary composite indicator', 'مؤشر مركب ثانوي')}: {d.healthIndicator.value ?? '—'}</summary>
            <div style={small}>{d.healthIndicator.formula}</div>
            {d.healthIndicator.components.map((c: any) => <div key={c.key} style={small}>{c.key}: {c.raw ?? L('n/a', 'غير متاح')} → {c.normalized == null ? '—' : Math.round(c.normalized)} × {c.weight}</div>)}
            <div style={small}>{d.healthIndicator.note}</div>
          </details>
        )}
      </section>
      <section style={box} aria-label={L('Gap analysis', 'تحليل الفجوات')}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{L('Gap analysis', 'تحليل الفجوات')}</div>
        {d.gaps.map((g: any) => (
          <div key={g.lens} data-testid={`gap-${g.lens}`} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid var(--border)' }}>
            <strong>{LENS[g.lens] ? L(LENS[g.lens][0], LENS[g.lens][1]) : g.lens}</strong>{' '}
            <span style={{ color: g.status === 'GAP' ? 'var(--danger)' : g.status === 'NO_GAP' ? 'var(--success)' : 'var(--text-dim)' }}>{g.status === 'GAP' ? L('Gap', 'فجوة') : g.status === 'NO_GAP' ? L('No gap', 'لا فجوة') : L('Data not available', 'البيانات غير متاحة')}</span>
            <div style={small}>{g.explanation}{g.missing?.length ? ` (${L('missing', 'ناقص')}: ${g.missing.join(', ')})` : ''}</div>
          </div>
        ))}
      </section>
      <section style={box} aria-label={L('Materiality', 'الأهمية الجوهرية')}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{L('Materiality', 'الأهمية الجوهرية')}: <span data-testid="materiality-band" style={{ color: BAND_COLOR[d.materiality.band] }}>{d.materiality.band === 'INSUFFICIENT_DATA' ? L('Insufficient data', 'بيانات غير كافية') : `${d.materiality.band} (${d.materiality.score}/100)`}</span></div>
        <div style={small}>{d.materiality.explanation}</div>
        <details style={{ fontSize: 12, marginTop: 4 }}><summary>{L('How this was calculated', 'طريقة الحساب')}</summary>
          {d.materiality.factors.map((f: any) => <div key={f.key} style={small}>{f.key}: {f.availability === 'DATA_NOT_AVAILABLE' ? L('not available (excluded)', 'غير متاح (مستبعد)') : `${f.value} → ${f.contribution} × ${f.weight}`} - {f.explanation}</div>)}
        </details>
      </section>
      <section style={box} aria-label={L('Trend', 'الاتجاه')}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{L('Assessment history', 'تاريخ التقييم')}</div>
        {!t.observed.length ? <div style={small}>{L('No published assessments yet.', 'لا توجد تقييمات منشورة بعد.')}</div> : (
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead><tr><th style={{ textAlign: 'start' }}>{L('Assessed', 'تاريخ التقييم')}</th><th style={{ textAlign: 'start' }}>{L('Maturity', 'النضج')}</th><th style={{ textAlign: 'start' }}>{L('Evidence', 'الأدلة')}</th><th style={{ textAlign: 'start' }}>{L('Gap', 'الفجوة')}</th></tr></thead>
            <tbody>{t.observed.map((o: any) => <tr key={o.assessmentId}><td>{o.assessedAt.slice(0, 10)}</td><td>{o.finalScore}</td><td>{o.evidenceConfidence ?? '—'}</td><td>{o.gap ?? '—'}</td></tr>)}</tbody>
          </table>
        )}
        <div style={{ ...small, marginTop: 6 }} data-testid="trend-target">{L('Target', 'المستهدف')}: {t.target.value ?? '—'} · {L('The target is a goal, not a forecast.', 'المستهدف هدف وليس توقعاً.')}{t.direction ? ` · ${L('Observed direction', 'الاتجاه المرصود')}: ${t.direction}` : ''}</div>
      </section>
      <section style={box} aria-label={L('Strategy and actions', 'الاستراتيجية والإجراءات')}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>{L('Supports strategic objectives', 'يدعم الأهداف الاستراتيجية')}</div>
        {!d.strategy.length ? <div style={small}>{L('Not aligned to any objective in Strategy.', 'غير مرتبطة بأي هدف في الاستراتيجية.')}</div> : d.strategy.map((s: any) => <div key={s.goalId} style={{ fontSize: 13 }}>{(isAR && s.titleAr) || s.title} <span style={small}>({s.strategy?.name})</span></div>)}
        <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>{L('Improvement actions', 'إجراءات التحسين')} ({d.actions.length})</div>
        {d.actions.map((a: any) => <div key={a.id} style={{ fontSize: 13 }}>{a.recommendedAction} <span className="badge badge-draft">{a.status}</span>{a.initiativeAssetId ? ` · ${d.initiatives.find((i: any) => i.id === a.initiativeAssetId)?.name ?? ''}` : ''}</div>)}
        <div style={{ fontWeight: 600, fontSize: 13, marginTop: 8 }}>{L('Advisor recommendations', 'توصيات المستشار')} ({d.recommendations.length})</div>
        {d.recommendations.map((r: any) => <div key={r.id} style={{ fontSize: 13 }}>{r.what} <span className="badge badge-draft">{r.status}</span></div>)}
      </section>
    </div>
  )
}

// ── Improvement actions ───────────────────────────────────────────────────
const NEXT: Record<string, string[]> = { ACCEPTED: ['PLANNED', 'CANCELLED'], PLANNED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['COMPLETED', 'CANCELLED'] }
export function ImprovementActions({ L, can, userId }: { L: LFn; can: { manage: boolean; approve: boolean; link: boolean }; userId?: string }) {
  const [list, setList] = useState<any[] | null>(null)
  const [open, setOpen] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [iniQ, setIniQ] = useState('')
  const [iniOpts, setIniOpts] = useState<any[]>([])
  const load = useCallback(() => bcm('GET', `/insights/actions${status ? `?status=${status}` : ''}`).then(setList).catch(e => setMsg({ kind: 'err', text: e.message })), [status])
  useEffect(() => { load() }, [load])
  const reopen = async (id: string) => setOpen(await bcm('GET', `/insights/actions/${id}`))
  const act = async (fn: () => Promise<any>) => { setMsg(null); try { await fn(); await load(); if (open) await reopen(open.id) } catch (e: any) { setMsg({ kind: 'err', text: e.message }) } }
  useEffect(() => { if (open && can.link) bcm('GET', `/insights/actions/initiative-options?q=${encodeURIComponent(iniQ)}`).then(setIniOpts).catch(() => setIniOpts([])) }, [open, iniQ, can.link])

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 380px' }}>
        <select aria-label={L('Status', 'الحالة')} className="form-input" style={{ width: 200, marginBottom: 8 }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">{L('All statuses', 'كل الحالات')}</option>
          {['PROPOSED', 'ACCEPTED', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 13, color: msg.kind === 'err' ? 'var(--danger)' : 'var(--success)' }}>{msg.text}</div>}
        {!list ? L('Loading…', 'جارٍ التحميل…') : !list.length ? <div style={small}>{L('No improvement actions yet.', 'لا توجد إجراءات تحسين بعد.')}</div> : list.map(a => (
          <button key={a.id} onClick={() => reopen(a.id)} style={{ ...box, display: 'block', width: '100%', textAlign: 'start', marginBottom: 6, cursor: 'pointer', color: 'var(--text)' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{a.recommendedAction}</div>
            <div style={small}>{a.gapType} · {a.priority} · <span className="badge badge-draft">{a.status}</span>{a.origin === 'ADVISOR' ? ` · ${L('from advisor', 'من المستشار')}` : ''}{!a.initiativeAssetId && ['ACCEPTED', 'PLANNED', 'IN_PROGRESS'].includes(a.status) ? ` · ${L('no initiative', 'بلا مبادرة')}` : ''}</div>
          </button>
        ))}
      </div>
      {open && (
        <section style={{ ...box, flex: '1 1 380px' }} aria-label={L('Improvement action', 'إجراء التحسين')}>
          <div style={{ fontWeight: 700 }}>{open.recommendedAction}</div>
          <div style={small}>{open.gapDescription}</div>
          <div style={{ fontSize: 13, margin: '6px 0' }}><span className="badge badge-draft" data-testid="action-status">{open.status}</span> · {open.priority}</div>
          {open.originalRecommendation && <details style={{ fontSize: 12 }}><summary>{L('Original advisor recommendation', 'التوصية الأصلية من المستشار')}</summary><div>{open.originalRecommendation.what}</div><div style={small}>{open.originalRecommendation.why}</div></details>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {open.status === 'PROPOSED' && can.approve && (open.createdBy === userId
              ? <span data-testid="action-needs-other-approver" style={small}>{L('You created this action, so another approver must decide.', 'أنشأت هذا الإجراء، لذا يجب أن يقرر معتمد آخر.')}</span>
              : <>
                  <button className="btn btn-primary btn-sm" onClick={() => act(() => bcm('POST', `/insights/actions/${open.id}/decision`, { decision: 'ACCEPTED' }))}>{L('Accept', 'قبول')}</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { const r = window.prompt(L('Reason for rejecting', 'سبب الرفض')); if (r) act(() => bcm('POST', `/insights/actions/${open.id}/decision`, { decision: 'REJECTED', rationale: r })) }}>{L('Reject', 'رفض')}</button>
                </>)}
            {can.manage && (NEXT[open.status] || []).map(to => <button key={to} className="btn btn-secondary btn-sm" onClick={() => { const r = to === 'CANCELLED' ? window.prompt(L('Reason for cancelling', 'سبب الإلغاء')) : ''; if (to !== 'CANCELLED' || r) act(() => bcm('POST', `/insights/actions/${open.id}/progress`, { to, rationale: r || undefined })) }}>{to.replace('_', ' ')}</button>)}
          </div>
          {can.link && !['REJECTED', 'CANCELLED'].includes(open.status) && (
            <div style={{ fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>{L('Initiative', 'المبادرة')}: {open.initiativeAssetId ? (iniOpts.find(i => i.id === open.initiativeAssetId)?.name ?? open.initiativeAssetId) : L('none', 'لا يوجد')}</div>
              <input aria-label={L('Search initiatives', 'بحث المبادرات')} className="form-input" placeholder={L('Search existing initiatives…', 'ابحث في المبادرات الحالية…')} value={iniQ} onChange={e => setIniQ(e.target.value)} />
              {iniOpts.map(i => <button key={i.id} className="btn btn-secondary btn-sm" style={{ margin: 2 }} onClick={() => act(() => bcm('POST', `/insights/actions/${open.id}/initiative`, { id: i.id }))}>{i.name}</button>)}
              {['ACCEPTED', 'PLANNED'].includes(open.status) && !open.initiativeAssetId && <button className="btn btn-secondary btn-sm" onClick={() => { const n = window.prompt(L('Proposed initiative name', 'اسم المبادرة المقترحة')); if (n) act(() => bcm('POST', `/insights/actions/${open.id}/propose-initiative`, { name: n })) }}>{L('Propose a new initiative', 'اقتراح مبادرة جديدة')}</button>}
              {open.proposedInitiative && (
                <div data-testid="initiative-proposal" style={{ ...small, marginTop: 4 }}>
                  {L('Initiative proposal', 'مقترح مبادرة')}: <strong>{open.proposedInitiative.name}</strong> · {open.proposedInitiative.status}
                  {open.proposedInitiative.possibleDuplicates?.length > 0 && <div style={{ color: 'var(--warning)' }}>{L('Possible existing initiatives', 'مبادرات قائمة محتملة')}: {open.proposedInitiative.possibleDuplicates.map((x: any) => x.name).join(', ')}</div>}
                  {open.proposedInitiative.status === 'PROPOSED' && can.approve && (open.proposedInitiative.proposedBy === userId
                    ? <div>{L('You proposed it, so another approver must decide.', 'أنت من اقترحها، لذا يجب أن يقرر معتمد آخر.')}</div>
                    : <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => act(() => bcm('POST', `/insights/actions/${open.id}/initiative-proposal/decision`, { decision: 'APPROVED' }))}>{L('Approve proposal', 'اعتماد المقترح')}</button>
                        <button className="btn btn-secondary btn-sm" onClick={() => { const r = window.prompt(L('Reason for rejecting', 'سبب الرفض')); if (r) act(() => bcm('POST', `/insights/actions/${open.id}/initiative-proposal/decision`, { decision: 'REJECTED', rationale: r })) }}>{L('Reject proposal', 'رفض المقترح')}</button>
                      </div>)}
                  {open.proposedInitiative.status === 'APPROVED' && can.link && (
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 4 }} onClick={() => {
                      const dup = open.proposedInitiative.possibleDuplicates?.length > 0
                      if (!window.confirm(dup ? L('Similar initiatives exist. Create a NEW initiative in the repository anyway?', 'توجد مبادرات مشابهة. إنشاء مبادرة جديدة في المستودع رغم ذلك؟') : L('Create this approved initiative in the architecture repository?', 'إنشاء هذه المبادرة المعتمدة في مستودع البنية؟'))) return
                      act(() => bcm('POST', `/insights/actions/${open.id}/initiative-proposal/create`, { acknowledgeDuplicates: dup }))
                    }}>{L('Create in repository', 'إنشاء في المستودع')}</button>
                  )}
                </div>
              )}
            </div>
          )}
          <details style={{ fontSize: 12, marginTop: 8 }}><summary>{L('Decision history', 'سجل القرارات')} ({open.events?.length ?? 0})</summary>
            {(open.events || []).map((e: any, i: number) => <div key={i} style={small}>{String(e.createdAt).slice(0, 16)} · {e.eventType}{e.fromStatus ? ` ${e.fromStatus}→${e.toStatus}` : ''}{e.rationale ? ` · ${e.rationale}` : ''}</div>)}
          </details>
        </section>
      )}
    </div>
  )
}

// ── Advisor ───────────────────────────────────────────────────────────────
export function CapabilityAdvisor({ L, can }: { L: LFn; can: { run: boolean; decide: boolean } }) {
  const [list, setList] = useState<any[] | null>(null)
  const [ai, setAi] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => bcm('GET', '/insights/advisor/recommendations?status=PROPOSED').then(setList).catch(e => setMsg({ kind: 'err', text: e.message })), [])
  useEffect(() => { load() }, [load])
  const run = async () => { setBusy(true); setMsg(null); try { const r = await bcm('POST', '/insights/advisor/run', { includeAiExplanation: ai }); setMsg({ kind: 'ok', text: L(`${r.created} new recommendation(s); ${r.skipped} unchanged or already decided.`, `${r.created} توصية جديدة؛ ${r.skipped} دون تغيير أو سبق البت فيها.`) }); await load() } catch (e: any) { setMsg({ kind: 'err', text: e.message }) } finally { setBusy(false) } }
  const decide = async (id: string, body: any) => { setMsg(null); try { await bcm('POST', `/insights/advisor/recommendations/${id}/decision`, body); await load() } catch (e: any) { setMsg({ kind: 'err', text: e.message }) } }
  return (
    <div style={{ maxWidth: 900 }}>
      {can.run && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={run}>{L('Run advisor', 'تشغيل المستشار')}</button>
          <label style={{ fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={ai} onChange={e => setAi(e.target.checked)} />{L('Add AI explanations (facts are never changed)', 'إضافة شروحات آلية (لا تتغير الحقائق)')}</label>
        </div>
      )}
      <div style={{ ...small, marginBottom: 8 }}>{L('Recommendations come from deterministic rules on your actual data. Nothing changes until you decide.', 'تنتج التوصيات من قواعد ثابتة على بياناتك الفعلية، ولا يتغير شيء حتى تقرر.')}</div>
      {msg && <div role={msg.kind === 'err' ? 'alert' : 'status'} style={{ fontSize: 13, color: msg.kind === 'err' ? 'var(--danger)' : 'var(--success)', marginBottom: 8 }}>{msg.text}</div>}
      {!list ? L('Loading…', 'جارٍ التحميل…') : !list.length ? <div style={small}>{L('No open recommendations.', 'لا توجد توصيات مفتوحة.')}</div> : list.map(r => (
        <section key={r.id} aria-label={r.what} style={{ ...box, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.what}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}><strong>{L('Why', 'السبب')}:</strong> {r.why}</div>
          <div style={small}>{L('Type', 'النوع')}: {r.signalType} · {L('Confidence', 'الثقة')}: {r.confidence} · {L('Provenance', 'المصدر')}: {r.provenance === 'RULE' ? L('Rule', 'قاعدة') : L('Rule + AI explanation', 'قاعدة + شرح آلي')}{r.materiality?.band ? ` · ${L('Materiality', 'الأهمية')}: ${r.materiality.band}` : ''}</div>
          <details style={{ fontSize: 12 }}><summary>{L('Supporting facts', 'الحقائق الداعمة')}</summary><pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(r.supportingFacts, null, 1)}</pre></details>
          {r.dataLimitations?.length > 0 && <div style={small}>{L('Data limitations', 'قيود البيانات')}: {r.dataLimitations.join('; ')}</div>}
          {r.aiExplanation && <div data-testid="ai-explanation" style={{ fontSize: 12, marginTop: 4, padding: 6, borderInlineStart: '3px solid var(--accent)' }}>{L('AI explanation', 'شرح آلي')}: {r.aiExplanation}</div>}
          {can.decide && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-sm" onClick={() => decide(r.id, { decision: 'ACCEPT' })}>{L('Accept', 'قبول')}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { const t = window.prompt(L('Modified recommendation', 'التوصية المعدلة'), r.what); const why = t && window.prompt(L('Why modify?', 'سبب التعديل؟')); if (t && why) decide(r.id, { decision: 'MODIFY', modifiedText: t, rationale: why }) }}>{L('Modify', 'تعديل')}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { const why = window.prompt(L('Reason for rejecting', 'سبب الرفض')); if (why) decide(r.id, { decision: 'REJECT', rationale: why }) }}>{L('Reject', 'رفض')}</button>
              <button className="btn btn-secondary btn-sm" onClick={() => { const until = window.prompt(L('Review again on (YYYY-MM-DD)', 'المراجعة مجدداً في (YYYY-MM-DD)')); const why = until && window.prompt(L('Reason for deferring', 'سبب التأجيل')); if (until && why) decide(r.id, { decision: 'DEFER', deferUntil: until, rationale: why }) }}>{L('Defer', 'تأجيل')}</button>
            </div>
          )}
        </section>
      ))}
    </div>
  )
}

// ── Phase 4: Executive overview (KPIs -> drill-down) + reports ─────────────
const API_BASE = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
export async function downloadReport(type: string, format: 'csv' | 'xlsx' | 'docx', assessmentId?: string) {
  const res = await fetch(`${API_BASE}/business-capabilities/insights/reports/${type}?format=${format}${assessmentId ? `&assessmentId=${assessmentId}` : ''}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || `${type.toLowerCase()}.${format}`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
}

const REPORTS: Array<[string, string, string]> = [
  ['EXECUTIVE', 'Executive capability report', 'تقرير القدرات التنفيذي'], ['CAPABILITY_MODEL', 'Business capability model', 'نموذج قدرات الأعمال'],
  ['HEALTH_GAP', 'Capability health & gaps', 'سلامة القدرات والفجوات'], ['IMPROVEMENT_PLAN', 'Improvement plan', 'خطة التحسين'],
]

export function ReportsPanel({ L, assessmentId }: { L: LFn; assessmentId?: string }) {
  const [view, setView] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const list = assessmentId ? [['MATURITY_ASSESSMENT', 'Maturity assessment report', 'تقرير تقييم النضج'] as [string, string, string]] : REPORTS
  const run = async (fn: () => Promise<any>) => { setErr(null); try { await fn() } catch (e: any) { setErr(e.message) } }
  return (
    <section aria-label={L('Reports', 'التقارير')} style={{ ...box, marginTop: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{L('Reports', 'التقارير')}</div>
      {err && <div role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>{err}</div>}
      {list.map(([type, en, ar]) => (
        <div key={type} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
          <span style={{ flex: 1, minWidth: 200, fontSize: 13 }}>{L(en, ar)}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => run(async () => setView(await bcm('GET', `/insights/reports/${type}?format=json${assessmentId ? `&assessmentId=${assessmentId}` : ''}`)))}>{L('View / PDF', 'عرض / PDF')}</button>
          <button className="btn btn-secondary btn-sm" onClick={() => run(() => downloadReport(type, 'xlsx', assessmentId))}>Excel</button>
          <button className="btn btn-secondary btn-sm" onClick={() => run(() => downloadReport(type, 'docx', assessmentId))}>Word</button>
          <button className="btn btn-secondary btn-sm" onClick={() => run(() => downloadReport(type, 'csv', assessmentId))}>CSV</button>
        </div>
      ))}
      {view && (
        <div data-testid="report-view" className="bcm-report-print" style={{ marginTop: 10 }}>
          <style>{'@media print { body * { visibility: hidden !important; } .bcm-report-print, .bcm-report-print * { visibility: visible !important; } .bcm-report-print { position: absolute; inset-inline-start: 0; top: 0; width: 100%; } .no-print { display: none !important; } }'}</style>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }} className="no-print">
            <button className="btn btn-primary btn-sm" onClick={() => window.print()}>{L('Print / save as PDF', 'طباعة / حفظ PDF')}</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setView(null)}>{L('Close', 'إغلاق')}</button>
          </div>
          <h2 style={{ fontSize: 16 }}>{view.title}</h2>
          <div style={small}>{L('Generated', 'تاريخ الإنشاء')} {String(view.generatedAt).slice(0, 10)} · {Object.entries(view.provenance || {}).filter(([k]) => k !== 'tenantId').map(([k, v]) => `${k}: ${v ?? '—'}`).join(' · ')}</div>
          <table style={{ fontSize: 12, margin: '8px 0' }}><tbody>{(view.summary || []).map((s: any) => <tr key={s.label}><td style={{ paddingInlineEnd: 12 }}>{s.label}</td><td><strong>{s.value ?? '—'}</strong></td></tr>)}</tbody></table>
          {(view.sections || []).map((s: any) => (
            <div key={s.title} style={{ marginBottom: 10, overflowX: 'auto' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.title}</div>
              {s.note && <div style={small}>{s.note}</div>}
              <table style={{ fontSize: 11, borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{s.columns.map((c: string) => <th key={c} style={{ textAlign: 'start', borderBottom: '1px solid var(--border)', padding: 3 }}>{c}</th>)}</tr></thead>
                <tbody>{s.rows.map((r: any[], i: number) => <tr key={i}>{r.map((c, j) => <td key={j} style={{ padding: 3, borderBottom: '1px solid var(--border)' }}>{c ?? '—'}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const KPI_LIST: Array<[string, string, string]> = [
  ['assessedCapabilities', 'Assessed capabilities', 'القدرات المقيّمة'], ['materialGaps', 'Material maturity gaps', 'فجوات نضج جوهرية'],
  ['criticalBelowTarget', 'Critical capabilities below target', 'قدرات حرجة دون المستهدف'], ['lowEvidenceConfidence', 'Low evidence confidence', 'موثوقية أدلة منخفضة'],
  ['deteriorating', 'Deteriorating capabilities', 'قدرات متراجعة'], ['assessmentsDue', 'Assessments due soon', 'تقييمات مستحقة قريباً'],
  ['assessmentsOverdue', 'Assessments overdue', 'تقييمات متأخرة'], ['neverAssessed', 'Never assessed', 'لم تُقيَّم'],
]
export function ExecutiveOverview({ L, onOpenCapability }: { L: LFn; onOpenCapability: (id: string) => void }) {
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const [drill, setDrill] = useState<string | null>(null)
  useEffect(() => { bcm('GET', '/insights/executive').then(setD).catch(e => setErr(e.message)) }, [])
  if (err) return <div role="alert" style={{ color: 'var(--danger)' }}>{err}</div>
  if (!d) return <div>{L('Loading…', 'جارٍ التحميل…')}</div>
  const k = d.kpis
  if (!k) return <div role="alert" style={{ color: 'var(--danger)' }}>{L('Overview is unavailable right now.', 'النظرة العامة غير متاحة حالياً.')}</div>
  if (!k.totalCapabilities) return <div style={{ ...box, textAlign: 'center', ...small }}>{L('No capabilities yet. Start in Capabilities or adopt from a reference model.', 'لا توجد قدرات بعد. ابدأ من القدرات أو اعتمد من نموذج مرجعي.')}</div>
  const head: Array<[string, any, string]> = [
    [L('Total capabilities', 'إجمالي القدرات'), k.totalCapabilities, 'total'], [L('Assessment coverage', 'تغطية التقييم'), k.assessmentCoverage == null ? '—' : `${k.assessmentCoverage}%`, 'coverage'],
    [L('Median maturity', 'وسيط النضج'), k.medianMaturity ?? '—', 'median'], [L('Average target maturity', 'متوسط النضج المستهدف'), k.averageTargetMaturity ?? '—', 'target'],
    [L('Open improvement actions', 'إجراءات تحسين مفتوحة'), k.openImprovementActions, 'open'], [L('Actions without initiative', 'إجراءات بلا مبادرة'), k.actionsWithoutInitiative, 'noini'],
  ]
  const ids: string[] = drill ? k[drill]?.ids ?? [] : []
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 10 }}>
        {head.map(([label, value, key]) => <div key={key} style={box} data-testid={`kpi-${key}`}><div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div><div style={small}>{label}</div></div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 8 }}>
        {KPI_LIST.map(([key, en, ar]) => (
          <button key={key} data-testid={`kpi-${key}`} aria-pressed={drill === key} onClick={() => setDrill(drill === key ? null : key)} style={{ ...box, textAlign: 'start', cursor: 'pointer', color: 'var(--text)', outline: drill === key ? '2px solid var(--accent)' : 'none' }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{k[key]?.value ?? 0}</div><div style={small}>{L(en, ar)}</div>
          </button>
        ))}
      </div>
      {drill && (
        <div style={{ ...box, marginTop: 10 }} data-testid="kpi-drill">
          {!ids.length ? <div style={small}>{L('Nothing here.', 'لا شيء هنا.')}</div> : ids.slice(0, 200).map(id => <button key={id} onClick={() => onOpenCapability(id)} style={{ display: 'block', width: '100%', textAlign: 'start', padding: '5px 0', border: 'none', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 13 }}>{d.names?.[id] ?? L('Capability', 'قدرة')}</button>)}
        </div>
      )}
      <details style={{ ...box, marginTop: 12, fontSize: 12 }} data-testid="about-measures">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{L('About these measures', 'حول هذه المؤشرات')}</summary>
        <p>{L('Maturity uses the ArchMind Capability Maturity Model (five levels, inspired by CMMI - not an official CMMI appraisal). Equal dimension weights, median of respondents, evidence rules, materiality bands (HIGH ≥ 60, MEDIUM ≥ 35) and the 12-month reassessment cycle are ArchMind defaults that your organization can change - not requirements of NORA, CMMI or TOGAF.', 'يُستخدم نموذج ArchMind لنضج القدرات (خمسة مستويات مستوحاة من CMMI - وليس تقييماً رسمياً لـ CMMI). الأوزان المتساوية ووسيط المستجيبين وقواعد الأدلة وحدود الأهمية (مرتفعة ≥ 60، متوسطة ≥ 35) ودورة إعادة التقييم كل 12 شهراً إعدادات افتراضية في ArchMind يمكن لجهتك تغييرها - وليست متطلبات من NORA أو CMMI أو TOGAF.')}</p>
        <p>{L('"Insufficient data" means information is missing - not that the capability is low priority. Targets are goals, not forecasts.', '"بيانات غير كافية" تعني نقص المعلومات - وليس أن القدرة منخفضة الأولوية. المستهدفات أهداف وليست توقعات.')}</p>
      </details>
      <ReportsPanel L={L} />
    </div>
  )
}

// ── Phase 4: cross-domain traceability & initiative coverage ──────────────
export function TraceabilityPanel({ L, onOpenCapability }: { L: LFn; onOpenCapability: (id: string) => void }) {
  const [d, setD] = useState<any>(null)
  useEffect(() => { bcm('GET', '/insights/traceability').then(setD).catch(() => setD({})) }, [])
  if (!d) return null
  const q = (title: string, items: any[] | undefined, render: (x: any) => any) => (
    <details style={{ ...box, marginTop: 8 }}><summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{title} ({items?.length ?? 0})</summary>{(items || []).map(render)}</details>
  )
  return (
    <section aria-label={L('Cross-domain traceability', 'التتبع عبر المجالات')} data-testid="traceability" style={{ marginTop: 12 }}>
      {q(L('Applications supporting low-maturity critical capabilities', 'تطبيقات تدعم قدرات حرجة منخفضة النضج'), d.applicationsSupportingLowMaturityCriticalCapabilities, (x: any) => <div key={x.capability.id} style={{ fontSize: 12, padding: '3px 0' }}><button className="btn btn-link btn-sm" onClick={() => onOpenCapability(x.capability.id)}>{x.capability.name}</button> ({x.capability.maturity}): {x.applications.map((a: any) => a.name).join(', ') || L('no linked applications', 'لا تطبيقات مرتبطة')}</div>)}
      {q(L('Strategic objectives depending on material gaps', 'أهداف استراتيجية تعتمد على فجوات جوهرية'), d.objectivesDependingOnMaterialGaps, (x: any, i?: number) => <div key={`${x.objective.id}-${x.capability.id}`} style={{ fontSize: 12, padding: '3px 0' }}>{x.objective.name} ← {x.capability.name}</div>)}
      {q(L('Capability gaps without initiative coverage', 'فجوات بلا تغطية بمبادرة'), d.gapsWithoutInitiativeCoverage, (x: any) => <div key={x.id} style={{ fontSize: 12, padding: '3px 0' }}><button className="btn btn-link btn-sm" onClick={() => onOpenCapability(x.id)}>{x.name}</button> {x.gaps.join(', ')}</div>)}
      {q(L('Capabilities on unhealthy or obsolete architecture', 'قدرات على بنية غير سليمة أو متقادمة'), d.capabilitiesOnUnhealthyArchitecture, (x: any) => <div key={x.id} style={{ fontSize: 12, padding: '3px 0' }}>{x.name}{x.architectureHealth ? ` · ${x.architectureHealth}` : ''}{x.obsoleteComponents?.length ? ` · ${x.obsoleteComponents.map((c: any) => `${c.name} (${c.status})`).join(', ')}` : ''}</div>)}
      <div style={{ ...small, marginTop: 6 }}>{L('Based only on repository relationships, strategy alignments and recorded attributes.', 'مبني فقط على علاقات المستودع ومواءمات الاستراتيجية والسمات المسجلة.')}</div>
    </section>
  )
}

export function InitiativeCoverage({ L }: { L: LFn }) {
  const [d, setD] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { bcm('GET', '/insights/initiative-coverage').then(setD).catch(e => setErr(e.message)) }, [])
  if (err) return <div role="alert" style={{ color: 'var(--danger)' }}>{err}</div>
  if (!d) return <div>{L('Loading…', 'جارٍ التحميل…')}</div>
  const sec = (key: string, title: string, render: (x: any) => any) => (
    <section key={key} style={{ ...box, marginBottom: 8 }} data-testid={`coverage-${key}`}><div style={{ fontWeight: 600, fontSize: 13 }}>{title} ({(d[key] || []).length})</div>{(d[key] || []).map(render)}</section>
  )
  return (
    <div>
      {sec('gapsWithInitiativeCoverage', L('Gaps covered by an initiative', 'فجوات مغطاة بمبادرة'), (x: any) => <div key={x.actionId} style={{ fontSize: 12 }}>{x.capability.name}: {x.action} → <strong>{x.initiative?.name}</strong></div>)}
      {sec('acceptedActionsWithoutInitiative', L('Accepted actions without an initiative', 'إجراءات معتمدة بلا مبادرة'), (x: any) => <div key={x.actionId} style={{ fontSize: 12 }}>{x.capability.name}: {x.action} <span className="badge badge-draft">{x.status}</span></div>)}
      {sec('initiativesAddressingMultipleCapabilities', L('Initiatives addressing several capabilities', 'مبادرات تعالج عدة قدرات'), (x: any) => <div key={x.initiative.id} style={{ fontSize: 12 }}><strong>{x.initiative.name}</strong>: {x.capabilities.map((c: any) => c.name).join(', ')}</div>)}
      {sec('improvementsNotYetPlanned', L('Improvements not yet planned', 'تحسينات لم تُخطط بعد'), (x: any) => <div key={x.actionId} style={{ fontSize: 12 }}>{x.capability.name}: {x.action} <span className="badge badge-draft">{x.status}</span></div>)}
      <div style={small}>{L('Schedule initiatives on the roadmap in EA Planning.', 'جدولة المبادرات على خارطة الطريق تتم في تخطيط البنية المؤسسية.')}</div>
    </div>
  )
}
