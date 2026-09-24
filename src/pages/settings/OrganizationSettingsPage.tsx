import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import { useBranding } from '../../contexts/BrandingContext'
import HelpTip from '../../components/HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

// The legacy "Sector" selector was removed (BCM Phase 1.1): it mixed
// organization type with industry and silently saved GOVERNMENT for any
// tenant that never chose a value. The authoritative classification is
// Organization type -> Industry -> Sub-sector -> Jurisdiction, confirmed by
// an administrator under Business Capabilities > Organization Context.
const ORG_TYPE_LABELS: Record<string, [string, string]> = { GOVERNMENT: ['Government', 'حكومية'], SEMI_GOVERNMENT: ['Semi-government', 'شبه حكومية'], PRIVATE: ['Private sector', 'قطاع خاص'] }
const ENTITY_TYPES = [['MINISTRY', 'وزارة', 'Ministry'], ['AUTHORITY', 'هيئة', 'Authority'], ['ENTERPRISE', 'مؤسسة', 'Enterprise'], ['SME', 'شركة', 'Company']]
const MATURITY_LABELS_AR = ['', 'بدائي', 'متطور', 'محدد', 'مُدار', 'مُحسَّن']
const MATURITY_LABELS_EN = ['', 'Initial', 'Developing', 'Defined', 'Managed', 'Optimized']

// Bug fix + refinement (root cause investigated and explicit direction to
// fix properly rather than dropping the feature): this previously offered
// a hardcoded ALL_DOMAINS list (NORA: fixed 6 codes, CUSTOM: fixed 3) that
// had no relationship to the tenant's actual Meta Model - confirmed live
// that this is exactly how a tenant's frameworkConfig.enabledDomains ends
// up storing domain codes ("BENEFICIARY_EXPERIENCE") that don't match any
// real Meta Model domain code ("BENEFICIARY") once a Meta Model is later
// published. This now fetches the tenant's real, live Meta Model domains
// (via the same /ea-repository/framework-config the Repository page uses)
// and offers those instead, whenever one is published - falling back to
// the old hardcoded list only pre-Meta-Model, matching the same fallback
// logic used elsewhere (RepositoryPage.getRepositoryDomains).
const FALLBACK_DOMAINS: Record<string, string[]> = {
  NORA: ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
  CUSTOM: ['BUSINESS', 'DATA', 'TECHNOLOGY'],
}

function DomainChip({ code, active, onClick }: { code: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontSize: 12, padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        background: active ? 'var(--accent)' : 'var(--navy-light)',
        color: active ? '#fff' : 'var(--text-dim)',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
      }}
    >
      {active ? '✓ ' : ''}{code.replace(/_/g, ' ')}
    </button>
  )
}

export default function OrganizationSettingsPage() {
  const { isAR, setLocale } = useLang()
  const [repoConfig, setRepoConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [classification, setClassification] = useState<any>(null)
  const [form, setForm] = useState({
    entityType: 'AUTHORITY', language: 'AR', eaMaturityLevel: 1,
    preferredFramework: 'NORA', domainsInScope: [] as string[],
    // Organizational Context fields — consolidated in from the Innovation
    // module's former "Organization Profile" tab (see InnovationPage.tsx),
    // which edited this exact same tenant-level SetupProfile record through
    // a second, disconnected UI. Centralized here since this page is the
    // one place tenant/org-level attributes belong; Innovation now only
    // displays this context read-only with a link back to this page.
    industry: '', organizationSize: '', primaryMandate: '', orgDescriptionShort: '', constraints: '',
  })

  useEffect(() => {
    Promise.all([authFetch('/setup/profile'), authFetch('/ea-repository/framework-config')])
      .then(([p, rc]) => {
        setRepoConfig(rc)
        const liveDomains = rc?.metaModelDriven ? Object.keys(rc?.allDomains || {}) : (FALLBACK_DOMAINS[p?.preferredFramework || 'NORA'] || FALLBACK_DOMAINS.NORA)
        setForm(f => ({
          ...f,
          entityType: p?.entityType || 'AUTHORITY',
          language: p?.language || 'AR',
          eaMaturityLevel: p?.eaMaturityLevel || 1,
          preferredFramework: p?.preferredFramework || 'NORA',
          domainsInScope: p?.domainsInScope?.length ? p.domainsInScope : liveDomains,
          industry: p?.industry || '',
          organizationSize: p?.organizationSize || '',
          primaryMandate: p?.primaryMandate || '',
          orgDescriptionShort: p?.orgDescriptionShort || '',
          constraints: p?.constraints && typeof p.constraints === 'object' ? Object.entries(p.constraints).map(([k, v]) => `${k}: ${v}`).join('\n') : '',
        }))
      })
      .finally(() => setLoading(false))
    authFetch('/business-capabilities/organization-context').then(c => setClassification(c && !c.statusCode ? c : null)).catch(() => setClassification(null))
  }, [])

  const [subTab, setSubTab] = useState<'profile' | 'branding' | 'terminology'>('profile')

  const toggleDomain = (d: string) => setForm(f => ({ ...f, domainsInScope: f.domainsInScope.includes(d) ? f.domainsInScope.filter(x => x !== d) : [...f.domainsInScope, d] }))

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const constraintsObj: Record<string, string> = {}
      form.constraints.split('\n').forEach(line => {
        const idx = line.indexOf(':')
        if (idx > 0) constraintsObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
      })
      const r1 = await authFetch('/setup/profile', {
        method: 'PUT',
        body: JSON.stringify({
          entityType: form.entityType, language: form.language, eaMaturityLevel: form.eaMaturityLevel,
          preferredFramework: form.preferredFramework, domainsInScope: form.domainsInScope,
          industry: form.industry || undefined, organizationSize: form.organizationSize || undefined,
          primaryMandate: form.primaryMandate || undefined, orgDescriptionShort: form.orgDescriptionShort || undefined,
          constraints: constraintsObj,
        }),
      })
      const r2 = await authFetch('/config/framework', { method: 'PUT', body: JSON.stringify({ frameworkType: form.preferredFramework, enabledDomains: form.domainsInScope }) })
      if ((r1.id || r1.tenantId) && r2) setMsg({ type: 'success', text: isAR ? '✓ تم الحفظ بنجاح' : '✓ Saved successfully' })
      else setMsg({ type: 'error', text: isAR ? 'حدث خطأ أثناء الحفظ' : 'Something went wrong while saving' })
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  // Whenever a Meta Model is published, the domain toggle list is the
  // tenant's real, current domains - never the hardcoded fallback, and
  // never a stale set the tenant chose before the Meta Model existed.
  const availableDomains = repoConfig?.metaModelDriven
    ? Object.keys(repoConfig?.allDomains || {})
    : (FALLBACK_DOMAINS[form.preferredFramework] || FALLBACK_DOMAINS.NORA)

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{isAR ? 'المنظمة' : 'Organization'}</div>
        <div className="page-subtitle">{isAR ? 'الملف التعريفي والإطار المرجعي والهوية والمصطلحات' : 'PROFILE, FRAMEWORK, IDENTITY & TERMINOLOGY'}</div>
        <div className="page-tabs">
          {[['profile', isAR ? 'الملف والمجالات' : 'Profile & Domains'], ['branding', isAR ? 'الهوية البصرية' : 'Branding'], ['terminology', isAR ? 'المصطلحات' : 'Terminology']].map(([k, l]) => (
            <button key={k} className={`tab-btn${subTab === k ? ' active' : ''}`} onClick={() => setSubTab(k as any)}>{l}</button>
          ))}
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 720 }}>
        {msg && subTab === 'profile' && (
          <div style={{ padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', border: `1px solid ${msg.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}

        {subTab === 'profile' && <>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title">{isAR ? 'ملف المنظمة' : 'Organization Profile'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
            {isAR ? 'اسم المنظمة والشعار متاحان في تبويب "الهوية البصرية".' : 'Organization name and logo live under the "Branding" tab.'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group" data-testid="org-classification-summary">
              <label className="form-label">{isAR ? 'تصنيف الجهة' : 'Organization Classification'}</label>
              <div style={{ fontSize: 13, padding: '8px 0' }}>
                {classification?.classificationStatus === 'CONFIRMED'
                  ? [classification.organizationType && (isAR ? ORG_TYPE_LABELS[classification.organizationType]?.[1] : ORG_TYPE_LABELS[classification.organizationType]?.[0]),
                     classification.industry && (isAR ? (classification.industry.labelAr || classification.industry.labelEn) : classification.industry.labelEn),
                     classification.subSector && (isAR ? (classification.subSector.labelAr || classification.subSector.labelEn) : classification.subSector.labelEn),
                     classification.jurisdiction].filter(Boolean).join(' · ')
                  : <span style={{ color: 'var(--warning)' }}>{isAR ? 'غير مؤكد' : 'Not confirmed'}</span>}
                {' '}<a href="/business-capabilities?tab=context" style={{ color: 'var(--accent)', fontSize: 12 }}>{isAR ? 'إدارة' : 'Manage'}</a>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR ? 'نوع الجهة' : 'Entity Type'}</label>
              <select className="form-input" value={form.entityType} onChange={e => setForm(f => ({ ...f, entityType: e.target.value }))}>
                {ENTITY_TYPES.map(([v, ar, en]) => <option key={v} value={v}>{isAR ? ar : en}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR ? 'لغة المنصة' : 'Platform Language'}</label>
              <select className="form-input" value={form.language} onChange={e => { const lang = e.target.value as 'AR' | 'EN'; setForm(f => ({ ...f, language: lang })); setLocale(lang) }}>
                <option value="AR">العربية</option>
                <option value="EN">English</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>{isAR ? 'مستوى نضج البنية المؤسسية' : 'EA Maturity Level'}<HelpTip text={isAR ? 'تقييمك الذاتي لمدى نضج ممارسة البنية المؤسسية في منظمتك، من 1 (بدائي) إلى 5 (مُحسَّن).' : 'Your own assessment of how mature your organization\'s EA practice is, from 1 (Initial) to 5 (Optimized).'} /></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="range" min={1} max={5} value={form.eaMaturityLevel} onChange={e => setForm(f => ({ ...f, eaMaturityLevel: Number(e.target.value) }))} style={{ flex: 1 }} />
                <span style={{ fontSize: 12, width: 70, color: 'var(--text-dim)', textAlign: 'end' }}>{(isAR ? MATURITY_LABELS_AR : MATURITY_LABELS_EN)[form.eaMaturityLevel]}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
            {isAR ? 'السياق التنظيمي' : 'Organizational Context'}
            <HelpTip text={isAR
              ? 'يُستخدم هذا السياق لتأسيس دراسات الاستشارة المُولّدة بالذكاء الاصطناعي (وحدة الابتكار) ووثائق البنية المؤسسية على واقع مؤسستك بدلاً من نصائح عامة. كان يُحرَّر سابقًا من داخل وحدة الابتكار بشكل منفصل - تم دمجه هنا مع بقية إعدادات المنظمة.'
              : 'This context grounds AI-generated consultation studies (Innovation module) and EA documents in your organization\'s real situation instead of generic advice. Previously edited from a separate tab inside the Innovation module - now consolidated here with the rest of your organization settings.'} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">{isAR ? 'الصناعة/القطاع (وصف حر)' : 'Industry'}</label>
              <input className="form-input" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{isAR ? 'حجم المنظمة' : 'Organization Size'}</label>
              <select className="form-input" value={form.organizationSize} onChange={e => setForm(f => ({ ...f, organizationSize: e.target.value }))}>
                <option value="">—</option>
                <option value="SMALL">{isAR ? 'صغيرة' : 'Small'}</option>
                <option value="MEDIUM">{isAR ? 'متوسطة' : 'Medium'}</option>
                <option value="LARGE">{isAR ? 'كبيرة' : 'Large'}</option>
                <option value="ENTERPRISE">{isAR ? 'مؤسسية كبرى' : 'Enterprise'}</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{isAR ? 'المهمة الرئيسية' : 'Primary Mandate'}</label>
            <input className="form-input" value={form.primaryMandate} onChange={e => setForm(f => ({ ...f, primaryMandate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">{isAR ? 'وصف مختصر' : 'Short Description'}</label>
            <input className="form-input" value={form.orgDescriptionShort} onChange={e => setForm(f => ({ ...f, orgDescriptionShort: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center' }}>{isAR ? 'القيود' : 'Constraints'}<HelpTip text={isAR ? 'سطر واحد لكل قيد بصيغة "النوع: الوصف" - مثال: dataResidency: يجب أن تبقى البيانات داخل المملكة' : 'One constraint per line, as "type: description" - e.g. dataResidency: Must remain within KSA'} /></label>
            <textarea className="form-input" style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }} value={form.constraints} onChange={e => setForm(f => ({ ...f, constraints: e.target.value }))} />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>{isAR ? 'الإطار المرجعي ومجالات العمل' : 'Framework & Domains in Scope'}<HelpTip text={isAR ? 'الإطار المرجعي يحدد منهجية البنية المؤسسية المعتمدة. مجالات العمل تتيح لك التركيز على المجالات التي تستخدمها فعليًا وإخفاء الباقي من عوامل التصفية في المستودع.' : 'The framework sets which EA methodology you follow. Domains in scope let you focus on what you actually use - anything unchecked here is hidden from filters in the Repository.'} /></div>
          <div className="form-group">
            <label className="form-label">{isAR ? 'الإطار المرجعي' : 'Framework'}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['NORA', 'CUSTOM'].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm(fm => ({ ...fm, preferredFramework: f, domainsInScope: repoConfig?.metaModelDriven ? fm.domainsInScope : (FALLBACK_DOMAINS[f] || []) }))}
                  style={{ flex: 1, fontSize: 13, padding: '8px', borderRadius: 6, border: `1px solid ${form.preferredFramework === f ? 'var(--accent)' : 'var(--border)'}`, background: form.preferredFramework === f ? 'rgba(3,105,161,0.1)' : 'var(--navy-light)', color: form.preferredFramework === f ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer', fontWeight: form.preferredFramework === f ? 600 : 400 }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 4 }}>
            <label className="form-label">{isAR ? 'المجالات المعمارية في النطاق' : 'Architecture Domains in Scope'}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {availableDomains.map(d => (
                <DomainChip key={d} code={d} active={form.domainsInScope.includes(d)} onClick={() => toggleDomain(d)} />
              ))}
            </div>
            {repoConfig?.metaModelDriven && (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                {isAR ? `${availableDomains.length} مجالًا من نموذجك المعتمد الحالي.` : `${availableDomains.length} domains from your current published Meta Model.`}
              </div>
            )}
          </div>
        </div>

        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saving ? (isAR ? '⟳ جارٍ الحفظ...' : '⟳ Saving...') : (isAR ? 'حفظ التغييرات' : 'Save changes')}
        </button>
        </>}

        {subTab === 'branding' && <div className="card"><OrgBrandingSection /></div>}
        {subTab === 'terminology' && <div className="card"><OrgTerminologySection /></div>}
      </div>
    </div>
  )
}
function OrgBrandingSection() {
  const { t } = useLang()
  const { previewAccentColor, reload: reloadGlobalBranding } = useBranding()
  const [form, setForm] = useState({ organizationNameEn: '', organizationNameAr: '', primaryColor: '#00b4d8', secondaryColor: '#1a2332', accentColor: '#f39c12', fontFamily: '' })
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingFavicon, setUploadingFavicon] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [hasLogo, setHasLogo] = useState(false)
  const [hasFavicon, setHasFavicon] = useState(false)
  const [logoCacheBust, setLogoCacheBust] = useState(Date.now())
  const [faviconCacheBust, setFaviconCacheBust] = useState(Date.now())

  useEffect(() => {
    authFetch('/branding').then(b => {
      if (b) {
        setForm(f => ({ ...f, ...b }))
        setHasLogo(!!b.logoStorageKey)
        setHasFavicon(!!b.faviconStorageKey)
      }
    })
    // Revert any unsaved live-preview color when leaving this tab.
    return () => previewAccentColor(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const updateAccentColor = (color: string) => {
    setForm(f => ({ ...f, accentColor: color }))
    previewAccentColor(color) // live preview across the real app shell, not persisted until Save
  }

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const updated = await authFetch('/branding', { method: 'PUT', body: JSON.stringify(form) })
      if (updated?.id) {
        setMsg({ type: 'success', text: 'Branding saved' })
        reloadGlobalBranding() // pulls the now-persisted color as the new baseline
      } else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  const uploadAsset = async (kind: 'logo' | 'favicon', file: File) => {
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingFavicon
    setUploading(true); setMsg(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${API_URL}/branding/${kind}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` }, // no Content-Type — browser sets multipart boundary itself
        body,
      })
      const data = await res.json()
      if (res.ok) {
        setMsg({ type: 'success', text: `${kind === 'logo' ? 'Logo' : 'Favicon'} uploaded` })
        if (kind === 'logo') { setHasLogo(true); setLogoCacheBust(Date.now()) }
        else { setHasFavicon(true); setFaviconCacheBust(Date.now()) }
      } else {
        setMsg({ type: 'error', text: data?.message || `Failed to upload ${kind}` })
      }
    } catch (e) {
      setMsg({ type: 'error', text: `Upload failed: ${(e as Error).message}` })
    } finally { setUploading(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🎨 Branding</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Customize the platform appearance for your organization</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['organizationNameEn', 'Organization Name (EN)', false], ['organizationNameAr', 'Organization Name (AR)', true]].map(([k, l, rtl]) => (
            <div key={k as string}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{l as string}</div>
              <input className="form-input" type="text" value={(form as any)[k as string] || ''} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ width: '100%', fontSize: 11, direction: rtl ? 'rtl' : 'ltr' }} />
            </div>
          ))}
        </div>

        {/* Logo & Favicon upload */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Logo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {hasLogo
                ? <img src={`${API_URL}/branding/logo?t=${logoCacheBust}`} alt={t("settings.logo")} style={{ maxHeight: 40, maxWidth: 100, objectFit: 'contain' }} />
                : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No logo uploaded</div>}
              <label className="btn btn-secondary" style={{ fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                {uploadingLogo ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" style={{ display: 'none' }} disabled={uploadingLogo}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset('logo', f); e.target.value = '' }} />
              </label>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Favicon</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              {hasFavicon
                ? <img src={`${API_URL}/branding/favicon?t=${faviconCacheBust}`} alt={t("settings.favicon")} style={{ maxHeight: 24, maxWidth: 24, objectFit: 'contain' }} />
                : <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>No favicon uploaded</div>}
              <label className="btn btn-secondary" style={{ fontSize: 11, cursor: 'pointer', marginLeft: 'auto' }}>
                {uploadingFavicon ? 'Uploading…' : 'Upload'}
                <input type="file" accept="image/png,image/x-icon,image/svg+xml" style={{ display: 'none' }} disabled={uploadingFavicon}
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadAsset('favicon', f); e.target.value = '' }} />
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[['primaryColor', 'Primary Color'], ['secondaryColor', 'Secondary Color'], ['accentColor', 'Accent Color (live preview)']].map(([k, l]) => (
            <div key={k}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{l}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={(form as any)[k]} onChange={e => k === 'accentColor' ? updateAccentColor(e.target.value) : setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ width: 36, height: 30, border: 'none', background: 'none', cursor: 'pointer' }} />
                <input className="form-input" value={(form as any)[k]} onChange={e => k === 'accentColor' ? updateAccentColor(e.target.value) : setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 11, marginBottom: 3 }}>Font Family (optional — CSS font-family value)</div>
          <input className="form-input" placeholder="e.g. 'Inter', 'IBM Plex Sans Arabic', sans-serif" value={form.fontFamily || ''} onChange={e => setForm(f => ({ ...f, fontFamily: e.target.value }))} style={{ width: '100%', fontSize: 11 }} />
        </div>

        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Branding'}</button>
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  EA_CORE: '🏛 EA Core', BUSINESS: '💼 Business', BENEFICIARY_EXPERIENCE: '👤 Beneficiary Experience',
  APPLICATIONS: '📱 Applications', DATA: '🗄 Data', TECHNOLOGY: '⚙ Technology',
  SECURITY: '🔒 Security', GOVERNANCE: '📋 Governance', WORKFLOW: '🔄 Workflow', ADM: '🔁 ADM Phases',
}

function OrgTerminologySection() {
  const [terms, setTerms] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingTerm, setEditingTerm] = useState<any>(null)
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [overrideForm, setOverrideForm] = useState({ termKey: '', category: '', arabic: '', arabicNormalized: '', aiPreferred: true, uiPreferred: true, notes: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showGlobalOnly, setShowGlobalOnly] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([
      authFetch('/localization/terms'),
      authFetch('/localization/categories'),
    ]).then(([t, c]) => {
      setTerms(Array.isArray(t) ? t : [])
      setCategories(Array.isArray(c) ? c : [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filteredTerms = terms.filter(t => {
    if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false
    if (showGlobalOnly && t.tenantId) return false
    if (search) {
      const s = search.toLowerCase()
      return t.english?.toLowerCase().includes(s) || t.arabic?.includes(search) || t.termKey?.includes(s)
    }
    return true
  })

  const saveOverride = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/localization/terms/override', { method: 'POST', body: JSON.stringify(overrideForm) })
      if (res.id) { setMsg({ type: 'success', text: 'Override saved' }); setShowOverrideForm(false); load() }
      else setMsg({ type: 'error', text: res.message || 'Failed to save' })
    } finally { setSaving(false) }
  }

  const disableTerm = async (termKey: string, category: string) => {
    if (!window.confirm(`Disable "${termKey}" for this tenant?`)) return
    await authFetch(`/localization/terms/${termKey}/${category}/disable`, { method: 'PUT' })
    setMsg({ type: 'success', text: 'Term disabled for this tenant' }); load()
  }

  const startOverride = (term: any) => {
    setOverrideForm({ termKey: term.termKey, category: term.category, arabic: term.arabic, arabicNormalized: term.arabicNormalized || term.arabic, aiPreferred: term.aiPreferred, uiPreferred: term.uiPreferred, notes: term.notes || '' })
    setShowOverrideForm(true); setEditingTerm(term)
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>🌐 EA Terminology Management</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        Manage NORA/DGA standard terminology. Global terms are platform defaults. Create tenant-specific overrides to customize Arabic terminology for your organization.
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-input" placeholder="Search terms..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: 200, fontSize: 11 }} />
        <select className="form-input" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={{ fontSize: 11 }}>
          <option value="ALL">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
        </select>
        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={showGlobalOnly} onChange={e => setShowGlobalOnly(e.target.checked)} />
          Global only
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={load}>↻ Refresh</button>
          <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => { setEditingTerm(null); setOverrideForm({ termKey: '', category: '', arabic: '', arabicNormalized: '', aiPreferred: true, uiPreferred: true, notes: '' }); setShowOverrideForm(true) }}>
            + Add Override
          </button>
        </div>
      </div>

      {/* Override form */}
      {showOverrideForm && (
        <div style={{ marginBottom: 16, padding: 16, background: 'var(--navy)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{editingTerm ? `Override: ${editingTerm.english}` : 'New Terminology Override'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {!editingTerm && <>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Term Key</div>
                <input className="form-input" value={overrideForm.termKey} onChange={e => setOverrideForm(f => ({ ...f, termKey: e.target.value }))} placeholder="e.g. enterprise_architecture" style={{ fontSize: 11, width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, marginBottom: 3 }}>Category</div>
                <select className="form-input" value={overrideForm.category} onChange={e => setOverrideForm(f => ({ ...f, category: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
                </select>
              </div>
            </>}
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Arabic Term</div>
              <input className="form-input" value={overrideForm.arabic} onChange={e => setOverrideForm(f => ({ ...f, arabic: e.target.value }))} placeholder="Arabic translation" style={{ fontSize: 11, width: '100%', direction: 'rtl' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Normalized Form (used in AI)</div>
              <input className="form-input" value={overrideForm.arabicNormalized} onChange={e => setOverrideForm(f => ({ ...f, arabicNormalized: e.target.value }))} placeholder="Preferred AI form" style={{ fontSize: 11, width: '100%', direction: 'rtl' }} />
            </div>
            <div>
              <div style={{ fontSize: 11, marginBottom: 3 }}>Notes</div>
              <input className="form-input" value={overrideForm.notes} onChange={e => setOverrideForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={{ fontSize: 11, width: '100%' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingTop: 18 }}>
              <label style={{ fontSize: 11, display: 'flex', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={overrideForm.aiPreferred} onChange={e => setOverrideForm(f => ({ ...f, aiPreferred: e.target.checked }))} /> AI preferred
              </label>
              <label style={{ fontSize: 11, display: 'flex', gap: 4, cursor: 'pointer' }}>
                <input type="checkbox" checked={overrideForm.uiPreferred} onChange={e => setOverrideForm(f => ({ ...f, uiPreferred: e.target.checked }))} /> UI preferred
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} disabled={saving} onClick={saveOverride}>{saving ? 'Saving...' : '💾 Save Override'}</button>
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => setShowOverrideForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Terms table */}
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Loading terminology...</div> : (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>{filteredTerms.length} terms</div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 80px 80px', background: 'var(--navy-mid)', padding: '8px 12px', fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', gap: 8 }}>
              <div>ENGLISH</div><div>ARABIC</div><div>NORMALIZED (AI)</div><div>CATEGORY</div><div>FLAGS</div><div>ACTIONS</div>
            </div>
            {filteredTerms.slice(0, 100).map(term => (
              <div key={`${term.termKey}-${term.category}-${term.tenantId || 'global'}`}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr 0.8fr 80px 80px', padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11, gap: 8, alignItems: 'center', background: term.tenantId ? 'rgba(3,105,161,0.04)' : 'transparent', opacity: term.isActive === false ? 0.4 : 1 }}>
                <div>
                  <div style={{ fontWeight: 500 }}>{term.english}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{term.termKey}</div>
                </div>
                <div style={{ direction: 'rtl', textAlign: 'right' }}>{term.arabic}</div>
                <div style={{ direction: 'rtl', textAlign: 'right', color: term.arabicNormalized !== term.arabic ? 'var(--accent)' : 'var(--text)' }}>{term.arabicNormalized}</div>
                <div>
                  <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 2, background: 'var(--navy-mid)', fontFamily: 'var(--font-mono)' }}>{CATEGORY_LABELS[term.category]?.replace(/^[^ ]+ /, '') || term.category}</span>
                  {term.tenantId && <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 2 }}>● tenant override</div>}
                  {term.isGlobal && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>◉ global</div>}
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {term.aiPreferred && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(3,105,161,0.15)', color: 'var(--accent)' }}>AI</span>}
                  {term.uiPreferred && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(100,200,100,0.15)', color: '#4caf50' }}>UI</span>}
                  {term.isActive === false && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(255,0,0,0.1)', color: '#f44' }}>OFF</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => startOverride(term)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: 'var(--text)' }}>✏</button>
                  {!term.tenantId && <button onClick={() => disableTerm(term.termKey, term.category)} style={{ fontSize: 9, padding: '2px 6px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: '#f44' }}>✕</button>}
                </div>
              </div>
            ))}
          </div>
          {filteredTerms.length > 100 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>Showing first 100 — use search or category filter to narrow results</div>}
        </div>
      )}

      {/* Resolution info */}
      <div style={{ marginTop: 16, padding: 12, background: 'rgba(3,105,161,0.05)', border: '1px solid rgba(3,105,161,0.15)', borderRadius: 'var(--radius)', fontSize: 11, color: 'var(--text-dim)' }}>
        <strong style={{ color: 'var(--text)' }}>Resolution order:</strong> Tenant override → Global NORA/DGA baseline → Raw key<br />
        <span style={{ color: 'var(--accent)' }}>● Tenant overrides</span> are shown with a blue indicator. They take precedence over global terms in AI generation and UI display.
      </div>
    </div>
  )
}

