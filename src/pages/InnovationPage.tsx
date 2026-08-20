import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import HelpTip from '../components/HelpTip'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  return useMemo(() => {
    const token = () => localStorage.getItem('ea_token')
    const get = (p: string) => fetch(`${API}${p}`, { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json())
    const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    const put = (p: string, b: any) => fetch(`${API}${p}`, { method: 'PUT', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(b) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`); return d })
    return { get, post, put }
  }, [])
}

const S = {
  page: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' as const, background: 'var(--navy)' },
  header: { padding: '20px 28px 16px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--border)' },
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)' },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary' | 'secondary' | 'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? 'var(--navy)' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

// ── Domain constants ────────────────────────────────────────────────────────
// Category taxonomy mirrors apps/api/src/innovation/technology-radar.service.ts's
// VALID_CATEGORIES (a service-layer configurable list, not a schema enum) —
// keep in sync if that list grows.
const CATEGORIES: Record<string, { icon: string; en: string; ar: string }> = {
  AI:                     { icon: '🤖', en: 'Artificial Intelligence', ar: 'الذكاء الاصطناعي' },
  GENERATIVE_AI:          { icon: '✨', en: 'Generative AI', ar: 'الذكاء الاصطناعي التوليدي' },
  AGENTIC_AI:             { icon: '🕹', en: 'Agentic AI', ar: 'الذكاء الاصطناعي الوكيل' },
  DATA_ANALYTICS:         { icon: '📊', en: 'Data & Analytics', ar: 'البيانات والتحليلات' },
  INTEGRATION:            { icon: '🔗', en: 'Integration', ar: 'التكامل' },
  CLOUD:                  { icon: '☁️', en: 'Cloud', ar: 'الحوسبة السحابية' },
  INFRASTRUCTURE:         { icon: '🏗', en: 'Infrastructure', ar: 'البنية التحتية' },
  CYBERSECURITY:          { icon: '🛡', en: 'Cybersecurity', ar: 'الأمن السيبراني' },
  DIGITAL_EXPERIENCE:     { icon: '🖥', en: 'Digital Experience', ar: 'التجربة الرقمية' },
  AUTOMATION:             { icon: '⚙', en: 'Automation', ar: 'الأتمتة' },
  SOFTWARE_ENGINEERING:   { icon: '💻', en: 'Software Engineering', ar: 'هندسة البرمجيات' },
  DEVSECOPS:              { icon: '🔁', en: 'DevSecOps', ar: 'DevSecOps' },
  ENTERPRISE_ARCHITECTURE:{ icon: '🧩', en: 'Enterprise Architecture', ar: 'هندسة المؤسسات' },
  IOT:                    { icon: '📡', en: 'Internet of Things', ar: 'إنترنت الأشياء' },
  EDGE_COMPUTING:         { icon: '📶', en: 'Edge Computing', ar: 'الحوسبة الطرفية' },
  BLOCKCHAIN_DLT:         { icon: '⛓', en: 'Blockchain / DLT', ar: 'البلوك تشين' },
  SPATIAL_COMPUTING:      { icon: '🥽', en: 'Spatial Computing', ar: 'الحوسبة المكانية' },
  QUANTUM:                { icon: '⚛', en: 'Quantum', ar: 'الحوسبة الكمومية' },
  ROBOTICS:               { icon: '🦾', en: 'Robotics', ar: 'الروبوتات' },
  EMERGING_PLATFORMS:     { icon: '🚀', en: 'Emerging Platforms', ar: 'المنصات الناشئة' },
}
const MATURITY_COLOR: Record<string, string> = { EMERGING: '#9b59b6', GROWING: '#3498db', MATURE: '#2ecc71', DECLINING: '#7f8c8d' }
const MATURITY_LABEL: Record<string, { en: string; ar: string }> = {
  EMERGING: { en: 'Emerging', ar: 'ناشئة' }, GROWING: { en: 'Growing', ar: 'في نمو' },
  MATURE: { en: 'Mature', ar: 'ناضجة' }, DECLINING: { en: 'Declining', ar: 'في تراجع' },
}
const MARKET_POSITION_COLOR: Record<string, string> = { EXPLORE: '#7f8c8d', ASSESS: '#f39c12', TRIAL: '#3498db', ADOPT: '#2ecc71', HOLD: '#e74c3c' }
const MARKET_POSITION_LABEL: Record<string, { en: string; ar: string }> = {
  EXPLORE: { en: 'Explore', ar: 'استكشاف' }, ASSESS: { en: 'Assess', ar: 'تقييم' },
  TRIAL: { en: 'Trial', ar: 'تجربة' }, ADOPT: { en: 'Adopt', ar: 'تبنّي' }, HOLD: { en: 'Hold', ar: 'إيقاف' },
}
const TENANT_STATUS_OPTIONS = ['NOT_RELEVANT', 'WATCH', 'EXPLORE', 'ASSESS', 'PILOT', 'ADOPT', 'SCALE', 'HOLD', 'RETIRE']
const TENANT_STATUS_COLOR: Record<string, string> = {
  NOT_RELEVANT: '#7f8c8d', WATCH: '#95a5a6', EXPLORE: '#3498db', ASSESS: '#f39c12', PILOT: '#e67e22',
  ADOPT: '#2ecc71', SCALE: '#27ae60', HOLD: '#e74c3c', RETIRE: '#c0392b',
}
const TENANT_STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  NOT_RELEVANT: { en: 'Not Relevant', ar: 'غير ذات صلة' }, WATCH: { en: 'Watch', ar: 'متابعة' },
  EXPLORE: { en: 'Explore', ar: 'استكشاف' }, ASSESS: { en: 'Assess', ar: 'تقييم' }, PILOT: { en: 'Pilot', ar: 'تجريب' },
  ADOPT: { en: 'Adopt', ar: 'تبنّي' }, SCALE: { en: 'Scale', ar: 'توسّع' }, HOLD: { en: 'Hold', ar: 'إيقاف' }, RETIRE: { en: 'Retire', ar: 'إيقاف نهائي' },
}
const categoryLabel = (code: string, isAR: boolean) => { const c = CATEGORIES[code]; return c ? (isAR ? c.ar : c.en) : code }
const categoryIcon = (code: string) => CATEGORIES[code]?.icon || '🔷'

export default function InnovationPage() {
  const api = useApi()
  const { t, isAR } = useLang()
  const { user } = useAuth() as any
  const isAdmin = user?.role === 'TENANT_ADMIN'
  const [tab, setTab] = useState<'radar' | 'favorites' | 'ideas' | 'studies' | 'profile'>('radar')
  const [selected, setSelected] = useState<any>(null)

  return (
    <div style={S.page} dir={isAR ? 'rtl' : 'ltr'}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            🔭 {t('innov.title')}
            <HelpTip text={isAR
              ? 'رادار التقنيات يعرض التقنيات الناشئة والمتاحة في السوق، بينما حالتك الخاصة تُظهر أين تقف مؤسستك من كل تقنية — استكشاف، تجريب، تبنّي، أو غير ذات صلة.'
              : 'The radar shows technologies available in the wider market. Your own status shows where your organization actually stands on each one — exploring, piloting, adopting, or not relevant.'} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('innov.subtitle')}</div>
        </div>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'radar')} onClick={() => { setTab('radar'); setSelected(null) }}>{t('innov.tab_radar')}</button>
        <button style={S.tab(tab === 'favorites')} onClick={() => { setTab('favorites'); setSelected(null) }}>{t('innov.tab_favorites')}</button>
        <button style={S.tab(tab === 'ideas')} onClick={() => { setTab('ideas'); setSelected(null) }}>{t('innov.tab_ideas')}</button>
        <button style={S.tab(tab === 'studies')} onClick={() => { setTab('studies'); setSelected(null) }}>{t('innov.tab_studies')}</button>
        <button style={S.tab(tab === 'profile')} onClick={() => { setTab('profile'); setSelected(null) }}>{t('innov.tab_profile')}</button>
      </div>
      <div style={S.content}>
        {tab === 'radar' && <RadarTab api={api} isAdmin={isAdmin} isAR={isAR} t={t} selected={selected} setSelected={setSelected} />}
        {tab === 'favorites' && <FavoritesTab api={api} isAdmin={isAdmin} isAR={isAR} t={t} selected={selected} setSelected={setSelected} />}
        {tab === 'ideas' && <IdeasTab api={api} isAR={isAR} t={t} userRole={user?.role} />}
        {tab === 'studies' && <StudiesTab api={api} isAR={isAR} t={t} />}
        {tab === 'profile' && <ProfileTab api={api} isAdmin={isAdmin} isAR={isAR} t={t} />}
      </div>
    </div>
  )
}

// ── Radar Tab ────────────────────────────────────────────────────────────────
function RadarTab({ api, isAdmin, isAR, t, selected, setSelected }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [marketPosition, setMarketPosition] = useState('')
  const [creating, setCreating] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (marketPosition) params.set('marketPosition', marketPosition)
    const qs = params.toString()
    api.get(`/innovation/radar${qs ? `?${qs}` : ''}`).then((d: any) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [api, category, marketPosition])
  useEffect(() => { load() }, [load])

  const openItem = async (id: string) => { const full = await api.get(`/innovation/radar/${id}`); setSelected(full) }
  const refreshSelected = async () => { if (selected) await openItem(selected.id) }

  const seed = async () => { setSeeding(true); try { await api.post('/innovation/radar/seed'); await load() } finally { setSeeding(false) } }

  if (selected) return <RadarDetail api={api} item={selected} isAdmin={isAdmin} isAR={isAR} t={t} onBack={() => { setSelected(null); load() }} onRefresh={refreshSelected} />

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <select style={{ ...S.input, marginBottom: 0, width: 220 }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">{t('innov.all_categories')}</option>
          {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{categoryIcon(c)} {categoryLabel(c, isAR)}</option>)}
        </select>
        <select style={{ ...S.input, marginBottom: 0, width: 180 }} value={marketPosition} onChange={e => setMarketPosition(e.target.value)}>
          <option value="">{t('innov.all_positions')}</option>
          {Object.keys(MARKET_POSITION_LABEL).map(p => <option key={p} value={p}>{isAR ? MARKET_POSITION_LABEL[p].ar : MARKET_POSITION_LABEL[p].en}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {isAdmin && <button style={S.btn()} onClick={seed} disabled={seeding}>{seeding ? t('innov.seeding') : t('innov.seed')}</button>}
        {isAdmin && <button style={S.btn('primary')} onClick={() => setCreating(true)}>{t('innov.add_tech')}</button>}
      </div>

      {creating && <RadarCreateForm api={api} isAR={isAR} t={t} onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}

      {loading ? (
        <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
      ) : items.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>
          {category || marketPosition ? t('innov.no_items') : t('innov.no_radar')}
        </div>
      ) : (
        <div className="stat-grid-3" style={{ alignItems: 'start' }}>
          {items.map((item: any) => <RadarCard key={item.id} item={item} isAR={isAR} t={t} onClick={() => openItem(item.id)} />)}
        </div>
      )}
    </div>
  )
}

function RadarCard({ item, isAR, t, onClick }: any) {
  const interest = item.tenantInterest
  return (
    <div style={{ ...S.card, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }} onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 22 }}>{categoryIcon(item.category)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isAR && item.nameAr ? item.nameAr : item.name}
            {interest?.isFavorite && <span title={t('innov.favorite')}>⭐</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{categoryLabel(item.category, isAR)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
        <span style={S.badge(MATURITY_COLOR[item.maturity] || '#7f8c8d')}>{isAR ? MATURITY_LABEL[item.maturity]?.ar : MATURITY_LABEL[item.maturity]?.en}</span>
        <span style={S.badge(MARKET_POSITION_COLOR[item.marketPosition] || '#7f8c8d')}>{isAR ? MARKET_POSITION_LABEL[item.marketPosition]?.ar : MARKET_POSITION_LABEL[item.marketPosition]?.en}</span>
        {interest?.tenantStatus && interest.tenantStatus !== 'NOT_RELEVANT' && (
          <span style={S.badge(TENANT_STATUS_COLOR[interest.tenantStatus])}>{isAR ? TENANT_STATUS_LABEL[interest.tenantStatus]?.ar : TENANT_STATUS_LABEL[interest.tenantStatus]?.en}</span>
        )}
      </div>
    </div>
  )
}

function RadarCreateForm({ api, isAR, t, onDone, onCancel }: any) {
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', description: '', category: 'AI', maturity: 'EMERGING' })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!form.code || !form.name || !form.description) return alert(isAR ? 'الرمز والاسم والوصف مطلوبة' : 'Code, name, and description are required')
    setSaving(true)
    try { await api.post('/innovation/radar', form); onDone() } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('innov.code')} *</div><input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} /></div>
        <div>
          <div style={S.label}>{t('innov.filter_category')} *</div>
          <select style={S.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{categoryLabel(c, isAR)}</option>)}
          </select>
        </div>
        <div><div style={S.label}>{t('innov.name_en')} *</div><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><div style={S.label}>{t('innov.name_ar')}</div><input style={S.input} dir="rtl" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
        <div>
          <div style={S.label}>{t('innov.maturity')} *</div>
          <select style={S.input} value={form.maturity} onChange={e => setForm(f => ({ ...f, maturity: e.target.value }))}>
            {Object.keys(MATURITY_LABEL).map(m => <option key={m} value={m}>{isAR ? MATURITY_LABEL[m].ar : MATURITY_LABEL[m].en}</option>)}
          </select>
        </div>
      </div>
      <div style={S.label}>{t('innov.description')} *</div>
      <input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={create} disabled={saving}>{saving ? t('innov.saving') : t('innov.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('innov.cancel')}</button>
      </div>
    </div>
  )
}

// ── Radar Detail ─────────────────────────────────────────────────────────────
function RadarDetail({ api, item, isAdmin, isAR, t, onBack, onRefresh }: any) {
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState(item.tenantInterest?.tenantStatus || 'NOT_RELEVANT')
  const [isFavorite, setIsFavorite] = useState(!!item.tenantInterest?.isFavorite)
  const [isWatching, setIsWatching] = useState(!!item.tenantInterest?.isWatching)
  const [notes, setNotes] = useState(item.tenantInterest?.notes || '')
  const [saving, setSaving] = useState(false)

  const saveStatus = async () => {
    setSaving(true)
    try { await api.put(`/innovation/radar/${item.id}/my-status`, { tenantStatus: status, isFavorite, isWatching, notes }); onRefresh() }
    catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const deactivate = async () => { if (!window.confirm(t('innov.deactivate_confirm'))) return; await api.post(`/innovation/radar/${item.id}/deactivate`); onBack() }

  const name = isAR && item.nameAr ? item.nameAr : item.name
  const description = isAR && item.descriptionAr ? item.descriptionAr : item.description

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>{t('innov.back')}</button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>{categoryIcon(item.category)} {name}</div>
        {isAdmin && (
          <>
            <button style={S.btn()} onClick={() => setEditing(e => !e)}>{t('innov.edit')}</button>
            <button style={S.btn('danger')} onClick={deactivate}>{t('innov.deactivate')}</button>
          </>
        )}
      </div>

      {editing ? (
        <RadarEditForm api={api} item={item} isAR={isAR} t={t} onDone={() => { setEditing(false); onRefresh() }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' as const }}>
            <span style={S.badge(MATURITY_COLOR[item.maturity])}>{isAR ? MATURITY_LABEL[item.maturity]?.ar : MATURITY_LABEL[item.maturity]?.en}</span>
            <span style={S.badge(MARKET_POSITION_COLOR[item.marketPosition])}>{isAR ? MARKET_POSITION_LABEL[item.marketPosition]?.ar : MARKET_POSITION_LABEL[item.marketPosition]?.en}</span>
            <span style={S.badge('#7f8c8d')}>{categoryLabel(item.category, isAR)}</span>
          </div>

          <div style={{ ...S.card, marginBottom: 16 }}>
            <div style={S.label}>{t('innov.description')}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{description}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <InfoList title={t('innov.use_cases')} items={item.typicalUseCases} />
            <InfoList title={t('innov.benefits')} items={item.benefits} />
            <InfoList title={t('innov.risks')} items={item.keyRisks} />
          </div>

          {item.requiredCapabilities?.length > 0 && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <div style={S.label}>{t('innov.capabilities')}</div>
              <div style={{ fontSize: 13 }}>{item.requiredCapabilities.join(', ')}</div>
            </div>
          )}

          {item.evidenceSource && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 16 }}>
              {t('innov.evidence')}: {item.evidenceSourceUrl ? <a href={item.evidenceSourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{item.evidenceSource}</a> : item.evidenceSource}
            </div>
          )}

          <div style={S.card}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center' }}>
              {t('innov.my_status')}
              <HelpTip text={isAR ? 'حالة السوق تصفها الجهة المشغّلة للمنصة، بينما هذه الحالة خاصة بمؤسستك فقط ولا يراها أحد غيرك.' : "The market position above is set by the platform; this status is specific to your organization and only visible to you."} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={S.label}>{t('innov.tenant_status')}</div>
                <select style={S.input} value={status} onChange={e => setStatus(e.target.value)}>
                  {TENANT_STATUS_OPTIONS.map(s => <option key={s} value={s}>{isAR ? TENANT_STATUS_LABEL[s].ar : TENANT_STATUS_LABEL[s].en}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 18 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isFavorite} onChange={e => setIsFavorite(e.target.checked)} /> ⭐ {t('innov.favorite')}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isWatching} onChange={e => setIsWatching(e.target.checked)} /> 👁 {t('innov.watching')}
                </label>
              </div>
            </div>
            <div style={S.label}>{t('innov.notes')}</div>
            <input style={S.input} value={notes} onChange={e => setNotes(e.target.value)} />
            <button style={S.btn('primary')} onClick={saveStatus} disabled={saving}>{saving ? t('innov.saving') : t('innov.save_status')}</button>
          </div>
        </>
      )}
    </div>
  )
}

function InfoList({ title, items }: { title: string; items?: string[] }) {
  return (
    <div style={S.card}>
      <div style={S.label}>{title}</div>
      {!items || items.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>—</div>
      ) : (
        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12, lineHeight: 1.7 }}>
          {items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      )}
    </div>
  )
}

function RadarEditForm({ api, item, isAR, t, onDone, onCancel }: any) {
  const [form, setForm] = useState({
    name: item.name || '', nameAr: item.nameAr || '', description: item.description || '', descriptionAr: item.descriptionAr || '',
    category: item.category, maturity: item.maturity, marketPosition: item.marketPosition,
    typicalUseCases: (item.typicalUseCases || []).join(', '), benefits: (item.benefits || []).join(', '), keyRisks: (item.keyRisks || []).join(', '),
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/innovation/radar/${item.id}`, {
        ...form,
        typicalUseCases: form.typicalUseCases.split(',').map((s: string) => s.trim()).filter(Boolean),
        benefits: form.benefits.split(',').map((s: string) => s.trim()).filter(Boolean),
        keyRisks: form.keyRisks.split(',').map((s: string) => s.trim()).filter(Boolean),
      })
      onDone()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('innov.name_en')}</div><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><div style={S.label}>{t('innov.name_ar')}</div><input style={S.input} dir="rtl" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
        <div>
          <div style={S.label}>{t('innov.maturity')}</div>
          <select style={S.input} value={form.maturity} onChange={e => setForm(f => ({ ...f, maturity: e.target.value }))}>
            {Object.keys(MATURITY_LABEL).map(m => <option key={m} value={m}>{isAR ? MATURITY_LABEL[m].ar : MATURITY_LABEL[m].en}</option>)}
          </select>
        </div>
        <div>
          <div style={S.label}>{t('innov.market_position')}</div>
          <select style={S.input} value={form.marketPosition} onChange={e => setForm(f => ({ ...f, marketPosition: e.target.value }))}>
            {Object.keys(MARKET_POSITION_LABEL).map(p => <option key={p} value={p}>{isAR ? MARKET_POSITION_LABEL[p].ar : MARKET_POSITION_LABEL[p].en}</option>)}
          </select>
        </div>
      </div>
      <div style={S.label}>{t('innov.description')}</div>
      <input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <div style={S.label}>{t('innov.use_cases')}</div>
      <input style={S.input} value={form.typicalUseCases} onChange={e => setForm(f => ({ ...f, typicalUseCases: e.target.value }))} />
      <div style={S.label}>{t('innov.benefits')}</div>
      <input style={S.input} value={form.benefits} onChange={e => setForm(f => ({ ...f, benefits: e.target.value }))} />
      <div style={S.label}>{t('innov.risks')}</div>
      <input style={S.input} value={form.keyRisks} onChange={e => setForm(f => ({ ...f, keyRisks: e.target.value }))} />
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('innov.saving') : t('innov.save')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('innov.cancel')}</button>
      </div>
    </div>
  )
}

// ── Favorites Tab ────────────────────────────────────────────────────────────
function FavoritesTab({ api, isAdmin, isAR, t, selected, setSelected }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get('/innovation/radar/favorites').then((d: any) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [api])
  useEffect(() => { load() }, [load])

  const openItem = async (id: string) => { const full = await api.get(`/innovation/radar/${id}`); setSelected(full) }
  const refreshSelected = async () => { if (selected) await openItem(selected.id) }

  if (selected) return <RadarDetail api={api} item={selected} isAdmin={isAdmin} isAR={isAR} t={t} onBack={() => { setSelected(null); load() }} onRefresh={refreshSelected} />

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
  if (items.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('innov.no_favorites')}</div>

  return (
    <div className="stat-grid-3" style={{ alignItems: 'start' }}>
      {items.map((item: any) => <RadarCard key={item.id} item={item} isAR={isAR} t={t} onClick={() => openItem(item.id)} />)}
    </div>
  )
}

// ── Organization Profile Tab ─────────────────────────────────────────────────
function ProfileTab({ api, isAdmin, isAR, t }: any) {
  const [profile, setProfile] = useState<any>(null)
  const [form, setForm] = useState({ industry: '', organizationSize: '', primaryMandate: '', orgDescriptionShort: '', domainsInScope: '', constraints: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get('/innovation/context-profile').then((p: any) => {
      setProfile(p)
      setForm({
        industry: p?.industry || '', organizationSize: p?.organizationSize || '', primaryMandate: p?.primaryMandate || '',
        orgDescriptionShort: p?.orgDescriptionShort || '', domainsInScope: (p?.domainsInScope || []).join(', '),
        constraints: p?.constraints && typeof p.constraints === 'object' ? Object.entries(p.constraints).map(([k, v]) => `${k}: ${v}`).join('\n') : '',
      })
    })
  }, [api])

  const save = async () => {
    setSaving(true); setSaved(false)
    const constraintsObj: Record<string, string> = {}
    form.constraints.split('\n').forEach(line => {
      const idx = line.indexOf(':')
      if (idx > 0) constraintsObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    })
    try {
      await api.put('/innovation/context-profile', {
        industry: form.industry || undefined,
        organizationSize: form.organizationSize || undefined,
        primaryMandate: form.primaryMandate || undefined,
        orgDescriptionShort: form.orgDescriptionShort || undefined,
        domainsInScope: form.domainsInScope ? form.domainsInScope.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
        constraints: constraintsObj,
      })
      setSaved(true)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  if (!profile) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{t('innov.profile_title')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6 }}>{t('innov.profile_desc')}</div>
      </div>

      {!isAdmin && <div style={{ ...S.badge('#f39c12'), display: 'block', marginBottom: 16, padding: '8px 12px' }}>{t('innov.readonly_notice')}</div>}

      <div style={S.card}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div><div style={S.label}>{t('innov.industry')}</div><input style={S.input} disabled={!isAdmin} value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} /></div>
          <div>
            <div style={S.label}>{t('innov.org_size')}</div>
            <select style={S.input} disabled={!isAdmin} value={form.organizationSize} onChange={e => setForm(f => ({ ...f, organizationSize: e.target.value }))}>
              <option value="">—</option>
              <option value="SMALL">{isAR ? 'صغيرة' : 'Small'}</option>
              <option value="MEDIUM">{isAR ? 'متوسطة' : 'Medium'}</option>
              <option value="LARGE">{isAR ? 'كبيرة' : 'Large'}</option>
              <option value="ENTERPRISE">{isAR ? 'مؤسسية كبرى' : 'Enterprise'}</option>
            </select>
          </div>
        </div>
        <div style={S.label}>{t('innov.mandate')}</div>
        <input style={S.input} disabled={!isAdmin} value={form.primaryMandate} onChange={e => setForm(f => ({ ...f, primaryMandate: e.target.value }))} />
        <div style={S.label}>{t('innov.short_desc')}</div>
        <input style={S.input} disabled={!isAdmin} value={form.orgDescriptionShort} onChange={e => setForm(f => ({ ...f, orgDescriptionShort: e.target.value }))} />
        <div style={S.label}>{t('innov.domains')}</div>
        <input style={S.input} disabled={!isAdmin} value={form.domainsInScope} onChange={e => setForm(f => ({ ...f, domainsInScope: e.target.value }))} />
        <div style={S.label}>{t('innov.constraints')}</div>
        <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' as const, fontFamily: 'inherit' }} disabled={!isAdmin} value={form.constraints} onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))} />
        {isAdmin && (
          <div style={S.row}>
            <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('innov.saving') : t('innov.save_profile')}</button>
            {saved && <span style={{ color: '#2ecc71', fontSize: 12 }}>✓ {t('innov.saved')}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Ideas Tab (Innovation-P2) ─────────────────────────────────────────────────
const IDEA_STATUS_COLOR: Record<string, string> = {
  SUBMITTED: '#7f8c8d', QUALIFYING: '#f39c12', QUALIFIED: '#2ecc71', IN_REVIEW: '#3498db',
  APPROVED: '#27ae60', REJECTED: '#e74c3c', ARCHIVED: '#7f8c8d',
}
const IDEA_STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  SUBMITTED: { en: 'Submitted', ar: 'مُقدَّمة' }, QUALIFYING: { en: 'Qualifying…', ar: 'قيد التقييم…' },
  QUALIFIED: { en: 'Qualified', ar: 'مؤهّلة' }, IN_REVIEW: { en: 'In Review', ar: 'قيد المراجعة' },
  APPROVED: { en: 'Approved', ar: 'معتمدة' }, REJECTED: { en: 'Rejected', ar: 'مرفوضة' }, ARCHIVED: { en: 'Archived', ar: 'مؤرشفة' },
}
const DECISION_ROLES = ['TENANT_ADMIN', 'REVIEWER']

const STUDY_STATUS_COLOR: Record<string, string> = {
  DRAFT: '#7f8c8d', AI_RESEARCH: '#f39c12', UNDER_REVIEW: '#3498db', REWORK: '#e67e22',
  APPROVED: '#27ae60', RECOMMENDED: '#2ecc71', PILOT_INITIATIVE: '#9b59b6', IMPLEMENTED: '#16a085', CLOSED_ARCHIVED: '#7f8c8d',
}
const STUDY_STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  DRAFT: { en: 'Draft', ar: 'مسودة' }, AI_RESEARCH: { en: 'AI Research…', ar: 'بحث الذكاء الاصطناعي…' },
  UNDER_REVIEW: { en: 'Under Review', ar: 'قيد المراجعة' }, REWORK: { en: 'Rework', ar: 'إعادة عمل' },
  APPROVED: { en: 'Approved', ar: 'معتمدة' }, RECOMMENDED: { en: 'Recommended', ar: 'موصى بها' },
  PILOT_INITIATIVE: { en: 'Pilot / Initiative', ar: 'تجريبية / مبادرة' }, IMPLEMENTED: { en: 'Implemented', ar: 'منفَّذة' },
  CLOSED_ARCHIVED: { en: 'Closed / Archived', ar: 'مغلقة / مؤرشفة' },
}
const RECOMMENDATION_LABEL: Record<string, { en: string; ar: string }> = {
  PROCEED: { en: 'Proceed', ar: 'المضي قدمًا' }, PROCEED_WITH_CONDITIONS: { en: 'Proceed with Conditions', ar: 'المضي قدمًا بشروط' },
  POC_FIRST: { en: 'PoC First', ar: 'إثبات مفهوم أولاً' }, PILOT: { en: 'Pilot', ar: 'تجريب' },
  DEFER: { en: 'Defer', ar: 'تأجيل' }, WATCH: { en: 'Watch', ar: 'متابعة' }, REJECT: { en: 'Reject', ar: 'رفض' },
}
// Mirrors apps/api/src/innovation/study.service.ts's STUDY_SECTION_DEFS - keep in sync if that list changes.
const STUDY_SECTIONS: { key: string; en: string; ar: string; shape: 'text' | 'list' | 'recommendation' }[] = [
  { key: 'EXECUTIVE_SUMMARY', en: 'Executive Summary', ar: 'الملخص التنفيذي', shape: 'text' },
  { key: 'BUSINESS_PROBLEM', en: 'Business Problem / Opportunity', ar: 'المشكلة/الفرصة التجارية', shape: 'text' },
  { key: 'STRATEGIC_ALIGNMENT', en: 'Strategic Alignment', ar: 'التوافق الاستراتيجي', shape: 'text' },
  { key: 'CAPABILITY_IMPACT', en: 'Business Capability Impact', ar: 'أثر القدرات المؤسسية', shape: 'list' },
  { key: 'USE_CASES', en: 'Potential Use Cases', ar: 'حالات الاستخدام المحتملة', shape: 'list' },
  { key: 'ARCHITECTURE_FIT', en: 'Architecture Fit Assessment', ar: 'تقييم توافق البنية', shape: 'text' },
  { key: 'TECHNOLOGY_OPTIONS', en: 'Recommended Technology Options', ar: 'خيارات التقنية الموصى بها', shape: 'list' },
  { key: 'RISKS_MITIGATION', en: 'Risks & Mitigation', ar: 'المخاطر والتخفيف', shape: 'list' },
  { key: 'FINANCIAL_ASSESSMENT', en: 'Financial Assessment', ar: 'التقييم المالي', shape: 'text' },
  { key: 'RECOMMENDATION', en: 'Recommendation', ar: 'التوصية', shape: 'recommendation' },
]

function ScoreRing({ score, label }: { score: number | null; label: string }) {
  const color = score == null ? '#7f8c8d' : score >= 70 ? '#2ecc71' : score >= 50 ? '#f39c12' : '#e74c3c'
  return (
    <div style={{ textAlign: 'center' as const }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, margin: '0 auto' }}>
        {score == null ? '—' : score}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{label}</div>
    </div>
  )
}

function IdeasTab({ api, isAR, t, userRole }: any) {
  const [ideas, setIdeas] = useState<any[]>([])
  const [radarItems, setRadarItems] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/innovation/ideas${statusFilter ? `?status=${statusFilter}` : ''}`).then((d: any) => setIdeas(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [api, statusFilter])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.get('/innovation/radar').then((d: any) => setRadarItems(Array.isArray(d) ? d : [])) }, [api])

  const openIdea = async (id: string) => { const full = await api.get(`/innovation/ideas/${id}`); setSelected(full) }
  const refreshSelected = async () => { if (selected) await openIdea(selected.id) }

  if (selected) return <IdeaDetail api={api} idea={selected} isAR={isAR} t={t} userRole={userRole} radarItems={radarItems} onBack={() => { setSelected(null); load() }} onRefresh={refreshSelected} />

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <select style={{ ...S.input, marginBottom: 0, width: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('innov.all_statuses')}</option>
          {Object.keys(IDEA_STATUS_LABEL).map(s => <option key={s} value={s}>{isAR ? IDEA_STATUS_LABEL[s].ar : IDEA_STATUS_LABEL[s].en}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={S.btn('primary')} onClick={() => setCreating(true)}>{t('innov.submit_idea')}</button>
      </div>

      {creating && <IdeaCreateForm api={api} isAR={isAR} t={t} radarItems={radarItems} onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}

      {loading ? (
        <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
      ) : ideas.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('innov.no_ideas')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ideas.map((idea: any) => (
            <div key={idea.id} style={{ ...S.card, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }} onClick={() => openIdea(idea.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{isAR && idea.titleAr ? idea.titleAr : idea.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{idea.category && categoryLabel(idea.category, isAR)}</div>
              </div>
              {idea.overallScore != null && <div style={{ fontSize: 15, fontWeight: 700 }}>{idea.overallScore}</div>}
              <span style={S.badge(IDEA_STATUS_COLOR[idea.status])}>{isAR ? IDEA_STATUS_LABEL[idea.status]?.ar : IDEA_STATUS_LABEL[idea.status]?.en}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IdeaCreateForm({ api, isAR, t, radarItems, onDone, onCancel }: any) {
  const [form, setForm] = useState({ title: '', titleAr: '', description: '', descriptionAr: '', category: '', tags: '', relatedRadarItemId: '' })
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (!form.title || !form.description) return alert(isAR ? 'العنوان والوصف مطلوبان' : 'Title and description are required')
    setSaving(true)
    try {
      await api.post('/innovation/ideas', { ...form, tags: form.tags.split(',').map((s: string) => s.trim()).filter(Boolean), relatedRadarItemId: form.relatedRadarItemId || undefined })
      onDone()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('innov.idea_title')} *</div><input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div><div style={S.label}>{t('innov.idea_title_ar')}</div><input style={S.input} dir="rtl" value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} /></div>
        <div>
          <div style={S.label}>{t('innov.filter_category')}</div>
          <select style={S.input} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="">—</option>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{categoryLabel(c, isAR)}</option>)}
          </select>
        </div>
        <div>
          <div style={S.label}>{t('innov.related_tech')}</div>
          <select style={S.input} value={form.relatedRadarItemId} onChange={e => setForm(f => ({ ...f, relatedRadarItemId: e.target.value }))}>
            <option value="">{t('innov.none')}</option>
            {radarItems.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>
      <div style={S.label}>{t('innov.idea_description')} *</div>
      <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical' as const, fontFamily: 'inherit' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <div style={S.label}>{t('innov.tags')}</div>
      <input style={S.input} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={create} disabled={saving}>{saving ? t('innov.saving') : t('innov.submit')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('innov.cancel')}</button>
      </div>
    </div>
  )
}

function IdeaDetail({ api, idea, isAR, t, userRole, radarItems, onBack, onRefresh }: any) {
  const [qualifying, setQualifying] = useState(false)
  const [decisionNotes, setDecisionNotes] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const canDecide = DECISION_ROLES.includes(userRole)
  const relatedTech = idea.relatedRadarItemId ? radarItems.find((r: any) => r.id === idea.relatedRadarItemId) : null

  const qualify = async () => {
    setQualifying(true)
    try { await api.post(`/innovation/ideas/${idea.id}/qualify`); await onRefresh() }
    catch (e: any) { alert(e.message); await onRefresh() }
    finally { setQualifying(false) }
  }

  const moveTo = async (status: string) => {
    setTransitioning(true)
    try { await api.put(`/innovation/ideas/${idea.id}/status`, { status, decisionNotes: decisionNotes || undefined }); await onRefresh() }
    catch (e: any) { alert(e.message) } finally { setTransitioning(false) }
  }

  const title = isAR && idea.titleAr ? idea.titleAr : idea.title
  const description = isAR && idea.descriptionAr ? idea.descriptionAr : idea.description
  const rationale = isAR && idea.qualificationRationaleAr ? idea.qualificationRationaleAr : idea.qualificationRationale

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>{t('innov.back_to_ideas')}</button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{title}</div>
        <span style={S.badge(IDEA_STATUS_COLOR[idea.status])}>{isAR ? IDEA_STATUS_LABEL[idea.status]?.ar : IDEA_STATUS_LABEL[idea.status]?.en}</span>
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.label}>{t('innov.idea_description')}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{description}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {idea.category && <span style={S.badge('#7f8c8d')}>{categoryLabel(idea.category, isAR)}</span>}
          {(idea.tags || []).map((tag: string) => <span key={tag} style={S.badge('#3498db')}>{tag}</span>)}
        </div>
        {relatedTech && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>{t('innov.related_tech')}: {relatedTech.name}</div>}
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center' }}>
            {t('innov.ai_qualification')}
            <HelpTip text={isAR
              ? 'يقيّم الذكاء الاصطناعي الفكرة من حيث قابلية التنفيذ والأثر ومدى توافقها مع سياق مؤسستك، ثم يوصي بحالة تالية. القرار النهائي يبقى بيد فريقك.'
              : 'AI scores the idea for feasibility, impact, and fit with your organization\'s context, then recommends a next status. The final call stays with your team.'} />
          </div>
          {idea.status !== 'QUALIFYING' && (
            <button style={S.btn('primary')} onClick={qualify} disabled={qualifying}>{qualifying ? t('innov.qualifying') : idea.qualifiedAt ? t('innov.requalify') : t('innov.qualify')}</button>
          )}
        </div>

        {idea.status === 'QUALIFYING' || qualifying ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('innov.qualifying')}</div>
        ) : idea.qualifiedAt ? (
          <>
            <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginBottom: 16 }}>
              <ScoreRing score={idea.feasibilityScore} label={t('innov.feasibility')} />
              <ScoreRing score={idea.impactScore} label={t('innov.impact')} />
              <ScoreRing score={idea.alignmentScore} label={t('innov.alignment')} />
              <ScoreRing score={idea.overallScore} label={t('innov.overall')} />
            </div>
            <div style={S.label}>{t('innov.rationale')}</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{rationale}</div>
          </>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('innov.not_qualified_yet')}</div>
        )}
      </div>

      {idea.status !== 'APPROVED' && idea.status !== 'REJECTED' && idea.status !== 'ARCHIVED' && (
        <div style={S.card}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{t('innov.decision')}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 12 }}>
            {idea.status !== 'IN_REVIEW' && <button style={S.btn()} onClick={() => moveTo('IN_REVIEW')} disabled={transitioning}>{t('innov.move_in_review')}</button>}
          </div>
          {canDecide ? (
            <>
              <div style={S.label}>{t('innov.decision_notes')}</div>
              <input style={S.input} value={decisionNotes} onChange={e => setDecisionNotes(e.target.value)} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.btn('primary')} onClick={() => moveTo('APPROVED')} disabled={transitioning}>{t('innov.approve')}</button>
                <button style={S.btn('danger')} onClick={() => moveTo('REJECTED')} disabled={transitioning}>{t('innov.reject')}</button>
                <button style={S.btn()} onClick={() => moveTo('ARCHIVED')} disabled={transitioning}>{t('innov.archive')}</button>
              </div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{t('innov.decision_restricted')}</div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Studies Tab (Innovation-P3) ─────────────────────────────────────────────

function PortfolioSummary({ api, isAR, t }: any) {
  const [portfolio, setPortfolio] = useState<any>(null)

  useEffect(() => { api.get('/innovation/portfolio').then(setPortfolio) }, [api])

  if (!portfolio || !portfolio.funnel) return null

  return (
    <div className="stat-grid-5" style={{ marginBottom: 20 }}>
      <div style={S.card}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('innov.funnel_submitted')}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{portfolio.funnel.ideasSubmitted}</div>
      </div>
      <div style={S.card}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('innov.funnel_qualified')}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{portfolio.funnel.ideasQualified}</div>
      </div>
      <div style={S.card}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('innov.funnel_studies')}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{portfolio.funnel.studiesGenerated}</div>
      </div>
      <div style={S.card}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('innov.funnel_approved')}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{portfolio.funnel.studiesApproved}</div>
      </div>
      <div style={S.card}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>{t('innov.funnel_initiatives')}</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{portfolio.funnel.convertedToInitiative}</div>
      </div>
    </div>
  )
}

function StudiesTab({ api, isAR, t }: any) {
  const [studies, setStudies] = useState<any[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/innovation/studies${statusFilter ? `?status=${statusFilter}` : ''}`).then((d: any) => setStudies(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }, [api, statusFilter])
  useEffect(() => { load() }, [load])

  if (selectedId) return <StudyDetail api={api} studyId={selectedId} isAR={isAR} t={t} onBack={() => { setSelectedId(null); load() }} />

  return (
    <div>
      <PortfolioSummary api={api} isAR={isAR} t={t} />
      <div style={{ ...S.row, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <select style={{ ...S.input, marginBottom: 0, width: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">{t('innov.all_statuses')}</option>
          {Object.keys(STUDY_STATUS_LABEL).map(s => <option key={s} value={s}>{isAR ? STUDY_STATUS_LABEL[s].ar : STUDY_STATUS_LABEL[s].en}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button style={S.btn('primary')} onClick={() => setCreating(true)}>{t('innov.new_study')}</button>
      </div>

      {creating && <StudyCreateForm api={api} isAR={isAR} t={t} onDone={(id: string) => { setCreating(false); setSelectedId(id) }} onCancel={() => setCreating(false)} />}

      {loading ? (
        <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
      ) : studies.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('innov.no_studies')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {studies.map((s: any) => (
            <div key={s.id} style={{ ...S.card, padding: '14px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }} onClick={() => setSelectedId(s.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{isAR && s.titleAr ? s.titleAr : s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{s.objective}</div>
              </div>
              {s.qualityScore != null && <div style={{ fontSize: 15, fontWeight: 700 }}>{s.qualityScore}</div>}
              {s.recommendation && <span style={S.badge('#3498db')}>{isAR ? RECOMMENDATION_LABEL[s.recommendation]?.ar : RECOMMENDATION_LABEL[s.recommendation]?.en}</span>}
              <span style={S.badge(STUDY_STATUS_COLOR[s.status])}>{isAR ? STUDY_STATUS_LABEL[s.status]?.ar : STUDY_STATUS_LABEL[s.status]?.en}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StudyCreateForm({ api, isAR, t, onDone, onCancel }: any) {
  const [form, setForm] = useState({ title: '', titleAr: '', objective: '', originType: 'MANUAL', originRadarItemId: '', originIdeaId: '', originDescription: '', scope: 'STANDARD' })
  const [radarItems, setRadarItems] = useState<any[]>([])
  const [ideas, setIdeas] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (form.originType === 'RADAR_ITEM' && radarItems.length === 0) api.get('/innovation/radar').then((d: any) => setRadarItems(Array.isArray(d) ? d : []))
    if (form.originType === 'IDEA' && ideas.length === 0) api.get('/innovation/ideas').then((d: any) => setIdeas(Array.isArray(d) ? d : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.originType])

  const create = async () => {
    if (!form.title || !form.objective) return alert(isAR ? 'العنوان والهدف مطلوبان' : 'Title and objective are required')
    if (form.originType === 'RADAR_ITEM' && !form.originRadarItemId) return alert(isAR ? 'يرجى اختيار تقنية' : 'Please select a technology')
    if (form.originType === 'IDEA' && !form.originIdeaId) return alert(isAR ? 'يرجى اختيار فكرة' : 'Please select an idea')
    setSaving(true)
    try {
      const created = await api.post('/innovation/studies', {
        title: form.title, titleAr: form.titleAr || undefined, objective: form.objective, originType: form.originType, scope: form.scope,
        originRadarItemId: form.originType === 'RADAR_ITEM' ? form.originRadarItemId : undefined,
        originIdeaId: form.originType === 'IDEA' ? form.originIdeaId : undefined,
        originDescription: form.originType !== 'RADAR_ITEM' && form.originType !== 'IDEA' ? form.originDescription : undefined,
      })
      onDone(created.id)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('innov.study_title')} *</div><input style={S.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div><div style={S.label}>{t('innov.study_title_ar')}</div><input style={S.input} dir="rtl" value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} /></div>
      </div>
      <div style={S.label}>{t('innov.objective')} *</div>
      <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' as const, fontFamily: 'inherit' }} value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <div style={S.label}>{t('innov.origin_type')}</div>
          <select style={S.input} value={form.originType} onChange={e => setForm(f => ({ ...f, originType: e.target.value }))}>
            <option value="MANUAL">{t('innov.origin_manual')}</option>
            <option value="RADAR_ITEM">{t('innov.origin_radar')}</option>
            <option value="IDEA">{t('innov.origin_idea')}</option>
            <option value="BUSINESS_PROBLEM">{t('innov.origin_business_problem')}</option>
            <option value="EA_RECOMMENDATION">{t('innov.origin_ea_recommendation')}</option>
            <option value="ARCHITECTURE_GAP">{t('innov.origin_architecture_gap')}</option>
          </select>
        </div>
        <div>
          <div style={S.label}>{t('innov.scope')}</div>
          <select style={S.input} value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
            <option value="STANDARD">{t('innov.scope_standard')}</option>
            <option value="EXECUTIVE">{t('innov.scope_executive')}</option>
            <option value="DETAILED">{t('innov.scope_detailed')}</option>
          </select>
        </div>
      </div>
      {form.originType === 'RADAR_ITEM' && (
        <><div style={S.label}>{t('innov.origin_radar')}</div>
        <select style={S.input} value={form.originRadarItemId} onChange={e => setForm(f => ({ ...f, originRadarItemId: e.target.value }))}>
          <option value="">{t('innov.select_radar_item')}</option>
          {radarItems.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select></>
      )}
      {form.originType === 'IDEA' && (
        <><div style={S.label}>{t('innov.origin_idea')}</div>
        <select style={S.input} value={form.originIdeaId} onChange={e => setForm(f => ({ ...f, originIdeaId: e.target.value }))}>
          <option value="">{t('innov.select_idea')}</option>
          {ideas.map((i: any) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select></>
      )}
      {form.originType !== 'RADAR_ITEM' && form.originType !== 'IDEA' && (
        <><div style={S.label}>{t('innov.origin_description')}</div>
        <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' as const, fontFamily: 'inherit' }} value={form.originDescription} onChange={e => setForm(f => ({ ...f, originDescription: e.target.value }))} /></>
      )}
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={create} disabled={saving}>{saving ? t('innov.saving') : t('innov.create_study')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('innov.cancel')}</button>
      </div>
    </div>
  )
}

function StudySectionCard({ section, isAR }: any) {
  const def = STUDY_SECTIONS.find(d => d.key === section.sectionKey)
  const title = def ? (isAR ? def.ar : def.en) : section.title
  const content = section.content

  return (
    <div style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{title}</div>
      {content == null ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isAR ? 'لم يتم إنشاء هذا القسم بعد' : 'Not yet generated'}</div>
      ) : def?.shape === 'text' ? (
        <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' as const }}>{content}</div>
      ) : def?.shape === 'recommendation' ? (
        <div>
          <span style={S.badge('#2ecc71')}>{isAR ? RECOMMENDATION_LABEL[content.recommendation]?.ar : RECOMMENDATION_LABEL[content.recommendation]?.en}</span>
          <div style={{ fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>{content.rationale}</div>
        </div>
      ) : Array.isArray(content) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {content.map((item: any, i: number) => (
            <div key={i} style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              {Object.entries(item).map(([k, v]) => (
                <div key={k} style={{ fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{k}: </span>
                  <span>{String(v)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13 }}>{JSON.stringify(content)}</div>
      )}
    </div>
  )
}

function StudyDetail({ api, studyId, isAR, t, onBack }: any) {
  const [study, setStudy] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [converting, setConverting] = useState(false)
  const [addingAssumption, setAddingAssumption] = useState(false)
  const [assumptionForm, setAssumptionForm] = useState({ label: '', value: '' })

  const load = useCallback(() => { api.get(`/innovation/studies/${studyId}`).then(setStudy) }, [api, studyId])
  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true); setGenError('')
    try { await api.post(`/innovation/studies/${studyId}/generate`); await load() }
    catch (e: any) { setGenError(e.message); await load() }
    finally { setGenerating(false) }
  }

  const moveTo = async (status: string) => { await api.put(`/innovation/studies/${studyId}/status`, { status }); await load() }

  const deleteStudy = async () => {
    if (!window.confirm(t('innov.confirm_delete_study'))) return
    await api.post(`/innovation/studies/${studyId}/delete`); onBack()
  }

  const addAssumption = async () => {
    if (!assumptionForm.label || !assumptionForm.value) return
    await api.post(`/innovation/studies/${studyId}/assumptions`, assumptionForm)
    setAssumptionForm({ label: '', value: '' }); setAddingAssumption(false); await load()
  }

  const exportDocx = async () => {
    setExporting(true)
    try {
      const token = localStorage.getItem('ea_token')
      const res = await fetch(`${API}/innovation/studies/${studyId}/export/docx`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `study-${studyId}.docx`
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(t('innov.export_failed'))
    } finally {
      setExporting(false)
    }
  }

  const convertToInitiative = async () => {
    if (!window.confirm(t('innov.convert_confirm'))) return
    setConverting(true)
    try {
      await api.post(`/innovation/studies/${studyId}/convert-to-initiative`, {})
      alert(t('innov.convert_success'))
      await load()
    } catch (e: any) {
      alert(`${t('innov.convert_failed')} ${e.message || ''}`)
    } finally {
      setConverting(false)
    }
  }

  if (!study) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>

  const title = isAR && study.titleAr ? study.titleAr : study.title
  const hasGeneratedContent = (study.sections || []).some((s: any) => s.content != null)
  const sortedSections = [...(study.sections || [])].sort((a: any, b: any) => a.orderIndex - b.orderIndex)

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16, flexWrap: 'wrap' as const }}>
        <button style={{ ...S.btn(), padding: '6px 12px' }} onClick={onBack}>{t('innov.back_to_studies')}</button>
        <div style={{ flex: 1, fontSize: 18, fontWeight: 700 }}>{title}</div>
        <span style={S.badge(STUDY_STATUS_COLOR[study.status])}>{isAR ? STUDY_STATUS_LABEL[study.status]?.ar : STUDY_STATUS_LABEL[study.status]?.en}</span>
        {hasGeneratedContent && (
          <button style={S.btn()} onClick={exportDocx} disabled={exporting}>{exporting ? t('innov.exporting') : t('innov.export_docx')}</button>
        )}
        {hasGeneratedContent && study.status !== 'PILOT_INITIATIVE' && study.status !== 'IMPLEMENTED' && (
          <button style={S.btn('primary')} onClick={convertToInitiative} disabled={converting}>{converting ? t('innov.converting') : t('innov.convert_to_initiative')}</button>
        )}
      </div>

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={S.label}>{t('innov.objective')}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>{study.objective}</div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' as const, alignItems: 'center' }}>
          {study.qualityScore != null && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-dim)' }}>{t('innov.quality_score')}: </span><b>{study.qualityScore}</b></div>}
          {study.recommendation && <div style={{ fontSize: 13 }}><span style={{ color: 'var(--text-dim)' }}>{t('innov.recommendation')}: </span><span style={S.badge('#2ecc71')}>{isAR ? RECOMMENDATION_LABEL[study.recommendation]?.ar : RECOMMENDATION_LABEL[study.recommendation]?.en}</span></div>}
          <div style={{ flex: 1 }} />
          <button style={S.btn('primary')} onClick={generate} disabled={generating || study.status === 'AI_RESEARCH'}>
            {generating || study.status === 'AI_RESEARCH' ? t('innov.generating') : hasGeneratedContent ? t('innov.regenerate_study') : t('innov.generate_study')}
          </button>
        </div>
        {genError && <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 10 }}>{t('innov.generation_failed')}: {genError}</div>}
      </div>

      {!hasGeneratedContent && !generating && study.status !== 'AI_RESEARCH' && (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 30, marginBottom: 16 }}>{t('innov.not_generated_yet')}</div>
      )}

      {hasGeneratedContent && sortedSections.map((s: any) => <StudySectionCard key={s.id} section={s} isAR={isAR} />)}

      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ flex: 1, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center' }}>
            {t('innov.assumptions')}
            <HelpTip text={isAR
              ? 'سجّل الافتراضات الأساسية التي استندت إليها الدراسة (مثل عدد المستخدمين المتوقع أو مدة التنفيذ)، حتى يمكن مراجعتها لاحقًا إذا تغيّرت.'
              : 'Record the key assumptions this study relies on (e.g. expected user count, implementation duration), so they can be revisited later if they change.'} />
          </div>
          <button style={S.btn()} onClick={() => setAddingAssumption(true)}>{t('innov.add_assumption')}</button>
        </div>
        {addingAssumption && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' as const }}>
            <input style={{ ...S.input, marginBottom: 0, flex: 1 }} placeholder={t('innov.assumption_label')} value={assumptionForm.label} onChange={e => setAssumptionForm(f => ({ ...f, label: e.target.value }))} />
            <input style={{ ...S.input, marginBottom: 0, flex: 1 }} placeholder={t('innov.assumption_value')} value={assumptionForm.value} onChange={e => setAssumptionForm(f => ({ ...f, value: e.target.value }))} />
            <button style={S.btn('primary')} onClick={addAssumption}>{t('innov.submit')}</button>
            <button style={S.btn()} onClick={() => setAddingAssumption(false)}>{t('innov.cancel')}</button>
          </div>
        )}
        {(study.assumptions || []).length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('innov.no_assumptions')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {study.assumptions.map((a: any) => (
              <div key={a.id} style={{ fontSize: 12, display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{a.label}:</span><span>{a.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <RelatedObjectsPanel api={api} studyId={studyId} isAR={isAR} t={t} />

      <div style={S.card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>{t('innov.study_status')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
          {study.status === 'UNDER_REVIEW' && <button style={S.btn('primary')} onClick={() => moveTo('APPROVED')}>{t('innov.approve_study')}</button>}
          {study.status === 'UNDER_REVIEW' && <button style={S.btn()} onClick={() => moveTo('REWORK')}>{t('innov.request_rework')}</button>}
          {study.status === 'DRAFT' && hasGeneratedContent && <button style={S.btn('primary')} onClick={() => moveTo('UNDER_REVIEW')}>{t('innov.move_to_review')}</button>}
          <div style={{ flex: 1 }} />
          <button style={S.btn('danger')} onClick={deleteStudy}>{t('innov.delete_study')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Related EA Objects (Innovation-P5 traceability) ─────────────────────────

const RELATED_OBJECT_TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  EA_ASSET: { en: 'EA Asset', ar: 'أصل بنية مؤسسية' },
  ADM_CYCLE: { en: 'ADM Cycle', ar: 'دورة تطوير البنية' },
  GOVERNANCE_REVIEW: { en: 'Governance Review', ar: 'مراجعة الحوكمة' },
  EA_PLAN: { en: 'EA Plan', ar: 'خطة البنية المؤسسية' },
  STRATEGY: { en: 'Strategy', ar: 'استراتيجية' },
}

function RelatedObjectsPanel({ api, studyId, isAR, t }: any) {
  const [relationships, setRelationships] = useState<any[]>([])
  const [linking, setLinking] = useState(false)
  const [form, setForm] = useState({ relatedObjectType: 'EA_ASSET', relatedObjectId: '', notes: '' })
  const [assets, setAssets] = useState<any[]>([])
  const [error, setError] = useState('')

  const load = useCallback(() => { api.get(`/innovation/studies/${studyId}/relationships`).then((d: any) => setRelationships(Array.isArray(d) ? d : [])) }, [api, studyId])
  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (form.relatedObjectType === 'EA_ASSET' && assets.length === 0) api.get('/ea-repository/assets').then((d: any) => setAssets(Array.isArray(d) ? d : []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.relatedObjectType])

  const link = async () => {
    if (!form.relatedObjectId) return
    setError('')
    try {
      await api.post(`/innovation/studies/${studyId}/relationships`, form)
      setForm({ relatedObjectType: 'EA_ASSET', relatedObjectId: '', notes: '' })
      setLinking(false); await load()
    } catch (e: any) { setError(e.message) }
  }

  const unlink = async (relationshipId: string) => {
    if (!window.confirm(t('innov.confirm_unlink'))) return
    await api.post(`/innovation/studies/${studyId}/relationships/${relationshipId}/delete`); await load()
  }

  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center' }}>
          {t('innov.related_objects')}
          <HelpTip text={isAR
            ? 'اربط هذه الدراسة بكائنات حقيقية في البنية المؤسسية (قدرات، تطبيقات، تقنيات، دورات، مراجعات، خطط، استراتيجيات) لمعرفة أي الدراسات تؤثر على أي جزء من البنية.'
            : 'Link this study to real EA repository objects (capabilities, applications, technologies, ADM cycles, reviews, plans, strategies) so it\'s traceable which studies affect which part of the architecture.'} />
        </div>
        <button style={S.btn()} onClick={() => setLinking(true)}>{t('innov.link_object')}</button>
      </div>

      {linking && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, padding: 12, background: 'var(--navy)', borderRadius: 8 }}>
          <select style={S.input} value={form.relatedObjectType} onChange={e => setForm(f => ({ ...f, relatedObjectType: e.target.value, relatedObjectId: '' }))}>
            <option value="EA_ASSET">{t('innov.related_ea_asset')}</option>
            <option value="ADM_CYCLE">{t('innov.related_adm_cycle')}</option>
            <option value="GOVERNANCE_REVIEW">{t('innov.related_review')}</option>
            <option value="EA_PLAN">{t('innov.related_plan')}</option>
            <option value="STRATEGY">{t('innov.related_strategy')}</option>
          </select>
          {form.relatedObjectType === 'EA_ASSET' ? (
            <select style={S.input} value={form.relatedObjectId} onChange={e => setForm(f => ({ ...f, relatedObjectId: e.target.value }))}>
              <option value="">{t('innov.select_ea_asset')}</option>
              {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name} [{a.assetType}]</option>)}
            </select>
          ) : (
            <input style={S.input} placeholder={t('innov.object_id')} value={form.relatedObjectId} onChange={e => setForm(f => ({ ...f, relatedObjectId: e.target.value }))} />
          )}
          {error && <div style={{ fontSize: 11, color: '#e74c3c' }}>{error}</div>}
          <div style={S.row}>
            <button style={S.btn('primary')} onClick={link}>{t('innov.link')}</button>
            <button style={S.btn()} onClick={() => { setLinking(false); setError('') }}>{t('innov.cancel')}</button>
          </div>
        </div>
      )}

      {relationships.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('innov.no_relationships')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {relationships.map((r: any) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={S.badge('#8e44ad')}>{isAR ? RELATED_OBJECT_TYPE_LABEL[r.relatedObjectType]?.ar : RELATED_OBJECT_TYPE_LABEL[r.relatedObjectType]?.en}</span>
              <span style={{ flex: 1, fontFamily: 'monospace', color: 'var(--text-dim)' }}>{r.relatedObjectId}</span>
              <span style={{ color: 'var(--text-dim)' }}>{r.relationshipType}</span>
              <button style={{ ...S.btn('danger'), padding: '2px 8px', fontSize: 11 }} onClick={() => unlink(r.id)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
