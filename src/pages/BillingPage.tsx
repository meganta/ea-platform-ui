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
  tabs: { display: 'flex', gap: 2, padding: '0 28px', borderBottom: '1px solid var(--border)', background: 'var(--navy-light)', flexWrap: 'wrap' as const },
  tab: (a: boolean) => ({ padding: '10px 16px', fontSize: 13, fontWeight: a ? 600 : 400, color: a ? 'var(--accent)' : 'var(--text-dim)', borderBottom: a ? '2px solid var(--accent)' : '2px solid transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', background: 'none' }),
  content: { flex: 1, overflow: 'auto', padding: '24px 28px' },
  card: { background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 },
  btn: (v: 'primary' | 'secondary' | 'danger' = 'secondary') => ({ padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-mid)', color: v === 'primary' ? '#0B1929' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '8px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 },
  label: { fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, marginBottom: 4, display: 'block' },
  badge: (c: string) => ({ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: c + '22', color: c }),
  row: { display: 'flex', alignItems: 'center', gap: 12 },
}

const SUB_STATUS_COLOR: Record<string, string> = { TRIAL: '#3498db', ACTIVE: '#2ecc71', PAST_DUE: '#f39c12', SUSPENDED: '#e67e22', CANCELED: '#e74c3c', EXPIRED: '#7f8c8d' }
const CONTRACT_STATUS_COLOR: Record<string, string> = { DRAFT: '#7f8c8d', ACTIVE: '#2ecc71', EXPIRED: '#7f8c8d', TERMINATED: '#e74c3c' }
const INVOICE_STATUS_COLOR: Record<string, string> = { DRAFT: '#7f8c8d', ISSUED: '#3498db', PAID: '#2ecc71', OVERDUE: '#e74c3c', VOID: '#7f8c8d' }
const PAYMENT_METHODS = ['ONLINE', 'BANK_TRANSFER', 'PURCHASE_ORDER', 'INVOICE', 'MANUAL']
const money = (amount: number | null | undefined, currency: string, isAR: boolean) => amount == null ? '—' : `${amount.toLocaleString(isAR ? 'ar' : 'en')} ${currency}`

export default function BillingPage() {
  const api = useApi()
  const { t, isAR } = useLang()
  const { user } = useAuth() as any
  const isAdmin = user?.isPlatformAdmin === true
  const [tab, setTab] = useState('subscription')

  return (
    <div style={S.page} dir={isAR ? 'rtl' : 'ltr'}>
      <div style={S.header}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            💳 {t('bill.title')}
            <HelpTip text={isAR
              ? 'يعرض هذا القسم خطة اشتراك مؤسستك والوحدات المفعّلة وسجل الفوترة. الترقية أو التعاقد الجديد تتم حاليًا عبر فريق ArchMind.'
              : 'This section shows your organization\'s plan, enabled modules, and billing history. Upgrades and new contracts currently go through the ArchMind team.'} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('bill.subtitle')}</div>
        </div>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'subscription')} onClick={() => setTab('subscription')}>{t('bill.tab_subscription')}</button>
        <button style={S.tab(tab === 'plans')} onClick={() => setTab('plans')}>{t('bill.tab_plans')}</button>
        <button style={S.tab(tab === 'invoices')} onClick={() => setTab('invoices')}>{t('bill.tab_invoices')}</button>
        <button style={S.tab(tab === 'payments')} onClick={() => setTab('payments')}>{t('bill.tab_payments')}</button>
        <button style={S.tab(tab === 'contracts')} onClick={() => setTab('contracts')}>{t('bill.tab_contracts')}</button>
        {isAdmin && <button style={S.tab(tab === 'catalog')} onClick={() => setTab('catalog')}>{t('bill.tab_catalog')}</button>}
        {isAdmin && <button style={S.tab(tab === 'admin_subs')} onClick={() => setTab('admin_subs')}>{t('bill.tab_admin_subs')}</button>}
        {isAdmin && <button style={S.tab(tab === 'admin_contracts')} onClick={() => setTab('admin_contracts')}>{t('bill.tab_admin_contracts')}</button>}
        {isAdmin && <button style={S.tab(tab === 'admin_payments')} onClick={() => setTab('admin_payments')}>{t('bill.tab_admin_payments')}</button>}
        {isAdmin && <button style={S.tab(tab === 'admin_invoices')} onClick={() => setTab('admin_invoices')}>{t('bill.tab_admin_invoices')}</button>}
      </div>
      <div style={S.content}>
        {tab === 'subscription' && <SubscriptionTab api={api} isAR={isAR} t={t} />}
        {tab === 'plans' && <PlansTab api={api} isAR={isAR} t={t} />}
        {tab === 'invoices' && <InvoicesTab api={api} isAR={isAR} t={t} />}
        {tab === 'payments' && <PaymentsTab api={api} isAR={isAR} t={t} />}
        {tab === 'contracts' && <ContractsTab api={api} isAR={isAR} t={t} />}
        {tab === 'catalog' && isAdmin && <CatalogTab api={api} isAR={isAR} t={t} />}
        {tab === 'admin_subs' && isAdmin && <AdminSubscriptionsTab api={api} isAR={isAR} t={t} />}
        {tab === 'admin_contracts' && isAdmin && <AdminContractsTab api={api} isAR={isAR} t={t} />}
        {tab === 'admin_payments' && isAdmin && <AdminPaymentsTab api={api} isAR={isAR} t={t} />}
        {tab === 'admin_invoices' && isAdmin && <AdminInvoicesTab api={api} isAR={isAR} t={t} />}
      </div>
    </div>
  )
}

// ── Tenant self-service: My Subscription ─────────────────────────────────────
function SubscriptionTab({ api, isAR, t }: any) {
  const [entitlements, setEntitlements] = useState<any>(null)
  const [subscription, setSubscription] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.get('/commercial/my-entitlements'), api.get('/commercial/my-subscription')])
      .then(([e, s]) => { setEntitlements(e); setSubscription(s) })
      .finally(() => setLoading(false))
  }, [api])

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
  if (!entitlements || !subscription) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_subscription')}</div>

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ ...S.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={S.label}>{t('bill.current_plan')}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{entitlements.planName}</div>
          </div>
          <span style={S.badge(SUB_STATUS_COLOR[entitlements.status] || '#7f8c8d')}>{entitlements.status}</span>
        </div>
        <div className="stat-grid-3">
          <div>
            <div style={S.label}>{t('bill.user_allowance')}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{entitlements.userAllowance == null ? t('bill.unlimited') : entitlements.userAllowance}</div>
          </div>
          <div>
            <div style={S.label}>{t('bill.ai_credit_allowance')}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{entitlements.aiCreditAllowance == null ? t('bill.unlimited') : entitlements.aiCreditAllowance}</div>
          </div>
          <div>
            <div style={S.label}>{subscription.status === 'TRIAL' ? t('bill.trial_ends') : t('bill.period_ends')}</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {subscription.status === 'TRIAL'
                ? (entitlements.trialEndsAt ? new Date(entitlements.trialEndsAt).toLocaleDateString(isAR ? 'ar' : 'en') : '—')
                : (entitlements.currentPeriodEnd ? new Date(entitlements.currentPeriodEnd).toLocaleDateString(isAR ? 'ar' : 'en') : '—')}
            </div>
          </div>
        </div>
        {subscription.autoRenew && <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>🔄 {t('bill.auto_renew')}</div>}
      </div>

      <div style={S.card}>
        <div style={S.label}>{t('bill.enabled_modules')}</div>
        {entitlements.enabledModules.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{t('bill.no_modules')}</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 8 }}>
            {entitlements.enabledModules.map((m: string) => <span key={m} style={S.badge('#3498db')}>{m}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tenant self-service: Plans (read-only) ────────────────────────────────────
function PlansTab({ api, isAR, t }: any) {
  const [plans, setPlans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/commercial/plans').then((d: any) => setPlans(Array.isArray(d) ? d : [])).finally(() => setLoading(false)) }, [api])

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
  if (plans.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_plans')}</div>

  return (
    <div className="stat-grid-3" style={{ alignItems: 'start' }}>
      {plans.map((p: any) => (
        <div key={p.id} style={S.card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{isAR && p.nameAr ? p.nameAr : p.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 12 }}>{isAR && p.descriptionAr ? p.descriptionAr : p.description}</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            {p.isCustom || p.priceMonthly == null ? t('bill.custom_pricing') : `${money(p.priceMonthly, p.currency, isAR)}${t('bill.per_month')}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
            {p.userAllowance == null ? t('bill.unlimited') : p.userAllowance} {t('bill.users_label')} · {p.aiCreditAllowance == null ? t('bill.unlimited') : p.aiCreditAllowance} {t('bill.ai_credits_label')}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
            {p.includedModules.map((m: string) => <span key={m} style={S.badge('#7f8c8d')}>{m}</span>)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tenant self-service: Invoices / Payments / Contracts ────────────────────
function InvoicesTab({ api, isAR, t }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/commercial/my-invoices').then((d: any) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false)) }, [api])

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
  if (items.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_invoices')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((inv: any) => (
        <div key={inv.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.invoiceNumber}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {inv.dueDate && `${t('bill.due')}: ${new Date(inv.dueDate).toLocaleDateString(isAR ? 'ar' : 'en')}`}
              {inv.paidAt && ` · ${t('bill.paid_on')}: ${new Date(inv.paidAt).toLocaleDateString(isAR ? 'ar' : 'en')}`}
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{money(inv.amount, inv.currency, isAR)}</div>
          <span style={S.badge(INVOICE_STATUS_COLOR[inv.status] || '#7f8c8d')}>{inv.status}</span>
        </div>
      ))}
    </div>
  )
}

function PaymentsTab({ api, isAR, t }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/commercial/my-payments').then((d: any) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false)) }, [api])

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
  if (items.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_payments')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((p: any) => (
        <div key={p.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.method}{p.reference ? ` · ${t('bill.reference')}: ${p.reference}` : ''}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{p.paidAt && new Date(p.paidAt).toLocaleDateString(isAR ? 'ar' : 'en')}</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{money(p.amount, p.currency, isAR)}</div>
          <span style={S.badge('#2ecc71')}>{p.status}</span>
        </div>
      ))}
    </div>
  )
}

function ContractsTab({ api, isAR, t }: any) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { api.get('/commercial/my-contracts').then((d: any) => setItems(Array.isArray(d) ? d : [])).finally(() => setLoading(false)) }, [api])

  if (loading) return <div style={{ color: 'var(--text-dim)' }}>{isAR ? 'جارٍ التحميل…' : 'Loading…'}</div>
  if (items.length === 0) return <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_contracts')}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((c: any) => (
        <div key={c.id} style={{ ...S.card, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.contractNumber}</div>
            <span style={S.badge(CONTRACT_STATUS_COLOR[c.status] || '#7f8c8d')}>{c.status}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
            {c.poNumber && `${t('bill.po_number')}: ${c.poNumber} · `}
            {c.value != null && `${t('bill.contract_value')}: ${money(c.value, c.currency, isAR)} · `}
            {new Date(c.startDate).toLocaleDateString(isAR ? 'ar' : 'en')} {c.endDate ? `– ${new Date(c.endDate).toLocaleDateString(isAR ? 'ar' : 'en')}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shared: tenant picker for admin tabs ─────────────────────────────────────
function useTenantPicker(api: any) {
  const [tenants, setTenants] = useState<any[]>([])
  const [tenantId, setTenantId] = useState('')
  useEffect(() => { api.get('/commercial/admin/tenants').then((d: any) => setTenants(Array.isArray(d) ? d : [])) }, [api])
  return { tenants, tenantId, setTenantId }
}

function TenantPicker({ tenants, tenantId, setTenantId, t }: any) {
  return (
    <select style={{ ...S.input, marginBottom: 16, maxWidth: 320 }} value={tenantId} onChange={e => setTenantId(e.target.value)}>
      <option value="">{t('bill.select_tenant')}</option>
      {tenants.map((tn: any) => <option key={tn.id} value={tn.id}>{tn.name} ({tn.slug})</option>)}
    </select>
  )
}

// ── Admin: Catalog (Products + Plans) ─────────────────────────────────────────
function CatalogTab({ api, isAR, t }: any) {
  const [products, setProducts] = useState<any[]>([])
  const [plans, setPlans] = useState<any[]>([])
  const [addingProduct, setAddingProduct] = useState(false)
  const [addingPlan, setAddingPlan] = useState(false)

  const load = useCallback(() => {
    api.get('/commercial/admin/products').then((d: any) => setProducts(Array.isArray(d) ? d : []))
    api.get('/commercial/admin/plans').then((d: any) => setPlans(Array.isArray(d) ? d : []))
  }, [api])
  useEffect(() => { load() }, [load])

  const toggleProductActive = async (p: any) => { await api.put(`/commercial/admin/products/${p.id}`, { isActive: !p.isActive }); load() }
  const togglePlanActive = async (p: any) => { await api.put(`/commercial/admin/plans/${p.id}`, { isActive: !p.isActive }); load() }

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t('bill.tab_catalog')} — Products</div>
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setAddingProduct(true)}>{t('bill.new_product')}</button>
      {addingProduct && <ProductForm api={api} isAR={isAR} t={t} onDone={() => { setAddingProduct(false); load() }} onCancel={() => setAddingProduct(false)} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
        {products.map((p: any) => (
          <div key={p.id} style={{ ...S.card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13 }}><strong>{p.code}</strong> — {isAR && p.nameAr ? p.nameAr : p.name}</div>
            {p.isCore && <span style={S.badge('#3498db')}>{t('bill.is_core')}</span>}
            <button style={{ ...S.btn(p.isActive ? 'secondary' : 'danger'), fontSize: 11 }} onClick={() => toggleProductActive(p)}>{p.isActive ? 'Active' : 'Inactive'}</button>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>{t('bill.tab_catalog')} — Plans</div>
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setAddingPlan(true)}>{t('bill.new_plan')}</button>
      {addingPlan && <PlanForm api={api} isAR={isAR} t={t} onDone={() => { setAddingPlan(false); load() }} onCancel={() => setAddingPlan(false)} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {plans.map((p: any) => (
          <div key={p.id} style={{ ...S.card, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13 }}><strong>{p.code}</strong> — {isAR && p.nameAr ? p.nameAr : p.name} · {p.isCustom || p.priceMonthly == null ? t('bill.custom_pricing') : money(p.priceMonthly, p.currency, isAR)}</div>
            <button style={{ ...S.btn(p.isActive ? 'secondary' : 'danger'), fontSize: 11 }} onClick={() => togglePlanActive(p)}>{p.isActive ? 'Active' : 'Inactive'}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductForm({ api, isAR, t, onDone, onCancel }: any) {
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', description: '', category: 'OTHER', isCore: false })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.code || !form.name) return alert(isAR ? 'الرمز والاسم مطلوبان' : 'Code and name are required')
    setSaving(true)
    try { await api.post('/commercial/admin/products', form); onDone() } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('bill.code')} *</div><input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} /></div>
        <div><div style={S.label}>{t('bill.name_en')} *</div><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.name_ar')}</div><input style={S.input} dir="rtl" value={form.nameAr} onChange={e => setForm(f => ({ ...f, nameAr: e.target.value }))} /></div>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isCore} onChange={e => setForm(f => ({ ...f, isCore: e.target.checked }))} /> {t('bill.is_core')}
          </label>
        </div>
      </div>
      <div style={S.label}>{t('bill.description')}</div>
      <input style={S.input} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('bill.saving') : t('bill.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('bill.cancel')}</button>
      </div>
    </div>
  )
}

function PlanForm({ api, isAR, t, onDone, onCancel }: any) {
  const [form, setForm] = useState({ code: '', name: '', nameAr: '', description: '', priceMonthly: '', priceYearly: '', currency: 'SAR', userAllowance: '', aiCreditAllowance: '', includedModules: '', isCustom: false })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.code || !form.name) return alert(isAR ? 'الرمز والاسم مطلوبان' : 'Code and name are required')
    setSaving(true)
    try {
      await api.post('/commercial/admin/plans', {
        ...form,
        priceMonthly: form.priceMonthly === '' ? undefined : Number(form.priceMonthly),
        priceYearly: form.priceYearly === '' ? undefined : Number(form.priceYearly),
        userAllowance: form.userAllowance === '' ? undefined : Number(form.userAllowance),
        aiCreditAllowance: form.aiCreditAllowance === '' ? undefined : Number(form.aiCreditAllowance),
        includedModules: form.includedModules.split(',').map((s: string) => s.trim()).filter(Boolean),
      })
      onDone()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('bill.code')} *</div><input style={S.input} value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s+/g, '_') }))} /></div>
        <div><div style={S.label}>{t('bill.name_en')} *</div><input style={S.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.price_monthly')}</div><input style={S.input} type="number" value={form.priceMonthly} onChange={e => setForm(f => ({ ...f, priceMonthly: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.price_yearly')}</div><input style={S.input} type="number" value={form.priceYearly} onChange={e => setForm(f => ({ ...f, priceYearly: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.user_allowance')}</div><input style={S.input} type="number" value={form.userAllowance} onChange={e => setForm(f => ({ ...f, userAllowance: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.ai_credit_allowance')}</div><input style={S.input} type="number" value={form.aiCreditAllowance} onChange={e => setForm(f => ({ ...f, aiCreditAllowance: e.target.value }))} /></div>
      </div>
      <div style={S.label}>{t('bill.included_modules')}</div>
      <input style={S.input} value={form.includedModules} onChange={e => setForm(f => ({ ...f, includedModules: e.target.value }))} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginBottom: 10 }}>
        <input type="checkbox" checked={form.isCustom} onChange={e => setForm(f => ({ ...f, isCustom: e.target.checked }))} /> {t('bill.is_custom')}
      </label>
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('bill.saving') : t('bill.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('bill.cancel')}</button>
      </div>
    </div>
  )
}

// ── Admin: Tenant Subscriptions ───────────────────────────────────────────────
function AdminSubscriptionsTab({ api, isAR, t }: any) {
  const { tenants, tenantId, setTenantId } = useTenantPicker(api)
  const [subscription, setSubscription] = useState<any>(null)
  const [plans, setPlans] = useState<any[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => { api.get('/commercial/admin/plans').then((d: any) => setPlans(Array.isArray(d) ? d : [])) }, [api])

  const load = useCallback(() => {
    if (!tenantId) { setSubscription(null); return }
    setNotFound(false)
    api.get(`/commercial/admin/subscriptions/${tenantId}`).then((d: any) => {
      if (d?.message) { setSubscription(null); setNotFound(true) } else { setSubscription(d); setSelectedPlanId(d?.planId || '') }
    })
  }, [api, tenantId])
  useEffect(() => { load() }, [load])

  const assignPlan = async () => {
    if (!selectedPlanId) return
    setSaving(true)
    try { await api.post(`/commercial/admin/subscriptions/${tenantId}/assign-plan`, { planId: selectedPlanId }); load() } finally { setSaving(false) }
  }
  const cancel = async () => {
    if (!window.confirm(t('bill.confirm_cancel'))) return
    setSaving(true)
    try { await api.post(`/commercial/admin/subscriptions/${tenantId}/cancel`, { reason: cancelReason || undefined }); load() } finally { setSaving(false) }
  }
  const reactivate = async () => { setSaving(true); try { await api.post(`/commercial/admin/subscriptions/${tenantId}/reactivate`); load() } finally { setSaving(false) } }

  return (
    <div style={{ maxWidth: 640 }}>
      <TenantPicker tenants={tenants} tenantId={tenantId} setTenantId={setTenantId} t={t} />
      {!tenantId ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.choose_tenant')}</div>
      ) : notFound ? (
        <div style={S.card}>
          <div style={{ ...S.badge('#f39c12'), display: 'inline-block', marginBottom: 12 }}>{t('bill.no_subscription')}</div>
          <div style={S.label}>{t('bill.assign_plan')}</div>
          <select style={S.input} value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}>
            <option value="">—</option>
            {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button style={S.btn('primary')} onClick={assignPlan} disabled={saving || !selectedPlanId}>{saving ? t('bill.saving') : t('bill.assign_plan')}</button>
        </div>
      ) : subscription ? (
        <div style={S.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{subscription.plan?.name}</div>
            <span style={S.badge(SUB_STATUS_COLOR[subscription.status] || '#7f8c8d')}>{subscription.status}</span>
          </div>

          <div style={S.label}>{t('bill.assign_plan')}</div>
          <select style={S.input} value={selectedPlanId} onChange={e => setSelectedPlanId(e.target.value)}>
            {plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button style={S.btn('primary')} onClick={assignPlan} disabled={saving}>{saving ? t('bill.saving') : t('bill.assign_plan')}</button>

          <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 16 }}>
            {subscription.status === 'CANCELED' || subscription.status === 'SUSPENDED' || subscription.status === 'PAST_DUE' || subscription.status === 'EXPIRED' ? (
              <button style={S.btn('primary')} onClick={reactivate} disabled={saving}>{t('bill.reactivate')}</button>
            ) : (
              <>
                <div style={S.label}>{t('bill.cancel_reason')}</div>
                <input style={S.input} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                <button style={S.btn('danger')} onClick={cancel} disabled={saving}>{t('bill.cancel_subscription')}</button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Admin: Contracts ─────────────────────────────────────────────────────────
function AdminContractsTab({ api, isAR, t }: any) {
  const { tenants, tenantId, setTenantId } = useTenantPicker(api)
  const [contracts, setContracts] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => { api.get('/commercial/admin/contracts').then((d: any) => setContracts(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { load() }, [load])

  const visibleContracts = tenantId ? contracts.filter((c: any) => c.tenantId === tenantId) : contracts
  const tenantName = (id: string) => tenants.find((tn: any) => tn.id === id)?.name || id
  const activate = async (id: string) => { await api.post(`/commercial/admin/contracts/${id}/activate`); load() }
  const terminate = async (id: string) => { await api.post(`/commercial/admin/contracts/${id}/terminate`); load() }

  return (
    <div>
      <TenantPicker tenants={tenants} tenantId={tenantId} setTenantId={setTenantId} t={t} />
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setCreating(true)}>{t('bill.new_contract')}</button>
      {creating && <ContractForm api={api} isAR={isAR} t={t} tenants={tenants} onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}
      {visibleContracts.length === 0 && !creating ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_contracts')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleContracts.map((c: any) => (
            <div key={c.id} style={{ ...S.card, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{c.contractNumber} — {tenantName(c.tenantId)}</div>
                <span style={S.badge(CONTRACT_STATUS_COLOR[c.status] || '#7f8c8d')}>{c.status}</span>
                {c.status === 'DRAFT' && <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => activate(c.id)}>{t('bill.activate')}</button>}
                {c.status === 'ACTIVE' && <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => terminate(c.id)}>{t('bill.terminate')}</button>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{c.value != null && money(c.value, c.currency, isAR)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ContractForm({ api, isAR, t, tenants, onDone, onCancel }: any) {
  const [form, setForm] = useState({ tenantId: '', contractNumber: '', poNumber: '', value: '', currency: 'SAR', startDate: '', endDate: '', paymentTerms: '', slaTier: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.tenantId || !form.contractNumber || !form.startDate) return alert(isAR ? 'المستأجر ورقم العقد وتاريخ البدء مطلوبة' : 'Tenant, contract number, and start date are required')
    setSaving(true)
    try { await api.post('/commercial/admin/contracts', { ...form, value: form.value === '' ? undefined : Number(form.value) }); onDone() } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={S.label}>{t('bill.tenant')} *</div>
      <select style={S.input} value={form.tenantId} onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}>
        <option value="">—</option>
        {tenants.map((tn: any) => <option key={tn.id} value={tn.id}>{tn.name}</option>)}
      </select>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('bill.contract_number')} *</div><input style={S.input} value={form.contractNumber} onChange={e => setForm(f => ({ ...f, contractNumber: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.po_number')}</div><input style={S.input} value={form.poNumber} onChange={e => setForm(f => ({ ...f, poNumber: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.contract_value')}</div><input style={S.input} type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.payment_terms')}</div><input style={S.input} value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.start_date')} *</div><input style={S.input} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.end_date')}</div><input style={S.input} type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
      </div>
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('bill.saving') : t('bill.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('bill.cancel')}</button>
      </div>
    </div>
  )
}

// ── Admin: Payments ──────────────────────────────────────────────────────────
function AdminPaymentsTab({ api, isAR, t }: any) {
  const { tenants, tenantId, setTenantId } = useTenantPicker(api)
  const [payments, setPayments] = useState<any[]>([])
  const [recording, setRecording] = useState(false)

  const load = useCallback(() => { if (tenantId) api.get(`/commercial/admin/payments?tenantId=${tenantId}`).then((d: any) => setPayments(Array.isArray(d) ? d : [])) }, [api, tenantId])
  useEffect(() => { load() }, [load])

  return (
    <div>
      <TenantPicker tenants={tenants} tenantId={tenantId} setTenantId={setTenantId} t={t} />
      {!tenantId ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.choose_tenant')}</div>
      ) : (
        <>
          <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setRecording(true)}>{t('bill.record_payment')}</button>
          {recording && <PaymentForm api={api} isAR={isAR} t={t} tenantId={tenantId} onDone={() => { setRecording(false); load() }} onCancel={() => setRecording(false)} />}
          {payments.length === 0 && !recording ? (
            <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_payments')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map((p: any) => (
                <div key={p.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1, fontSize: 13 }}>{p.method}{p.reference ? ` · ${p.reference}` : ''}</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{money(p.amount, p.currency, isAR)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PaymentForm({ api, isAR, t, tenantId, onDone, onCancel }: any) {
  const [form, setForm] = useState({ amount: '', currency: 'SAR', method: 'BANK_TRANSFER', reference: '', paidAt: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.amount) return alert(isAR ? 'المبلغ مطلوب' : 'Amount is required')
    setSaving(true)
    try { await api.post('/commercial/admin/payments', { ...form, tenantId, amount: Number(form.amount) }); onDone() } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('bill.amount')} *</div><input style={S.input} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
        <div>
          <div style={S.label}>{t('bill.method')}</div>
          <select style={S.input} value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div><div style={S.label}>{t('bill.reference')}</div><input style={S.input} value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.paid_at')}</div><input style={S.input} type="date" value={form.paidAt} onChange={e => setForm(f => ({ ...f, paidAt: e.target.value }))} /></div>
      </div>
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('bill.saving') : t('bill.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('bill.cancel')}</button>
      </div>
    </div>
  )
}

// ── Admin: Invoices ──────────────────────────────────────────────────────────
function AdminInvoicesTab({ api, isAR, t }: any) {
  const { tenants, tenantId, setTenantId } = useTenantPicker(api)
  const [invoices, setInvoices] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => { api.get('/commercial/admin/invoices').then((d: any) => setInvoices(Array.isArray(d) ? d : [])) }, [api])
  useEffect(() => { load() }, [load])

  const tenantName = (id: string) => tenants.find((tn: any) => tn.id === id)?.name || id
  const issue = async (id: string) => { await api.post(`/commercial/admin/invoices/${id}/issue`); load() }
  const voidInv = async (id: string) => { await api.post(`/commercial/admin/invoices/${id}/void`); load() }

  return (
    <div>
      <TenantPicker tenants={tenants} tenantId={tenantId} setTenantId={setTenantId} t={t} />
      <button style={{ ...S.btn('primary'), marginBottom: 16 }} onClick={() => setCreating(true)} disabled={!tenantId}>{t('bill.new_invoice')}</button>
      {creating && tenantId && <InvoiceForm api={api} isAR={isAR} t={t} tenantId={tenantId} onDone={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}
      {invoices.length === 0 && !creating ? (
        <div style={{ ...S.card, textAlign: 'center', color: 'var(--text-dim)', padding: 40 }}>{t('bill.no_invoices')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {invoices.map((inv: any) => (
            <div key={inv.id} style={{ ...S.card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1, fontSize: 13 }}><strong>{inv.invoiceNumber}</strong> — {tenantName(inv.tenantId)}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{money(inv.amount, inv.currency, isAR)}</div>
              <span style={S.badge(INVOICE_STATUS_COLOR[inv.status] || '#7f8c8d')}>{inv.status}</span>
              {inv.status === 'DRAFT' && <button style={{ ...S.btn(), fontSize: 11 }} onClick={() => issue(inv.id)}>{t('bill.issue')}</button>}
              {inv.status !== 'PAID' && inv.status !== 'VOID' && <button style={{ ...S.btn('danger'), fontSize: 11 }} onClick={() => voidInv(inv.id)}>{t('bill.void')}</button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function InvoiceForm({ api, isAR, t, tenantId, onDone, onCancel }: any) {
  const [form, setForm] = useState({ invoiceNumber: '', amount: '', currency: 'SAR', dueDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const save = async () => {
    if (!form.invoiceNumber || !form.amount) return alert(isAR ? 'رقم الفاتورة والمبلغ مطلوبان' : 'Invoice number and amount are required')
    setSaving(true)
    try { await api.post('/commercial/admin/invoices', { ...form, tenantId, amount: Number(form.amount) }); onDone() } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }
  return (
    <div style={{ ...S.card, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div><div style={S.label}>{t('bill.invoice_number')} *</div><input style={S.input} value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.amount')} *</div><input style={S.input} type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
        <div><div style={S.label}>{t('bill.due_date')}</div><input style={S.input} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
      </div>
      <div style={S.row}>
        <button style={S.btn('primary')} onClick={save} disabled={saving}>{saving ? t('bill.saving') : t('bill.create')}</button>
        <button style={S.btn()} onClick={onCancel}>{t('bill.cancel')}</button>
      </div>
    </div>
  )
}
