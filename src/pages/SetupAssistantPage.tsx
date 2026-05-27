import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

const STEPS = [
  { id: 1, icon: '🏢', titleAr: 'ملف المنظمة والإطار', titleEn: 'Profile & Framework' },
  { id: 2, icon: '📚', titleAr: 'قاعدة المعرفة', titleEn: 'Knowledge Base' },
  { id: 3, icon: '🗄', titleAr: 'مستودع البنية المؤسسية', titleEn: 'EA Repository' },
  { id: 4, icon: '📊', titleAr: 'مؤشر الجاهزية', titleEn: 'Readiness Score' },
  { id: 5, icon: '🚀', titleAr: 'الخطوات التالية', titleEn: 'Next Actions' },
]

const ALL_DOMAINS: Record<string, string[]> = {
  NORA: ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
  CUSTOM: ['BUSINESS', 'DATA', 'TECHNOLOGY'],
}

// KB-related foundation docs
const KB_FOUNDATION_DOCS = [
  { key: 'nora_methodology', title: 'NORA 2.0 Methodology', titleAr: 'منهجية نورا 2.0', category: 'METHODOLOGY', required: true, whyItMatters: 'Core national framework for enterprise architecture development' },
  { key: 'dga_standards', title: 'DGA Standards', titleAr: 'معايير هيئة الحكومة الرقمية', category: 'REGULATION', required: true, whyItMatters: 'Mandatory digital government transformation standards' },
  { key: 'nca_requirements', title: 'NCA Cybersecurity Requirements', titleAr: 'متطلبات الأمن السيبراني (هيئة الأمن السيبراني)', category: 'REGULATION', required: true, whyItMatters: 'Mandatory cybersecurity requirements' },
  { key: 'sdaia_documents', title: 'SDAIA Documents', titleAr: 'وثائق هيئة البيانات والذكاء الاصطناعي', category: 'REGULATION', required: false, whyItMatters: 'Data and AI governance' },
  { key: 'internal_ea_policy', title: 'Internal EA Policy', titleAr: 'سياسة البنية المؤسسية الداخلية', category: 'POLICY', required: false, whyItMatters: 'Approved internal policies' },
]

// Repo-related foundation docs
const REPO_FOUNDATION_DOCS = [
  { key: 'ea_principles', title: 'EA Principles', titleAr: 'مبادئ البنية المؤسسية', assetType: 'EA_PRINCIPLE', domain: 'CROSS_CUTTING', importance: 'CRITICAL', whyItMatters: 'Governing rules for all architecture decisions' },
  { key: 'ea_standards', title: 'EA Standards', titleAr: 'معايير البنية المؤسسية', assetType: 'EA_STANDARD', domain: 'CROSS_CUTTING', importance: 'CRITICAL', whyItMatters: 'Ensures consistency and compliance across all domains' },
  { key: 'ea_governance_model', title: 'EA Governance Model', titleAr: 'نموذج حوكمة البنية المؤسسية', assetType: 'GOVERNANCE_MODEL', domain: 'CROSS_CUTTING', importance: 'CRITICAL', whyItMatters: 'Defines architecture decision-making mechanisms' },
  { key: 'ea_charter', title: 'EA Charter', titleAr: 'ميثاق البنية المؤسسية', assetType: 'EA_CHARTER', domain: 'CROSS_CUTTING', importance: 'CRITICAL', whyItMatters: 'Formal mandate for the EA function' },
  { key: 'ea_operating_model', title: 'EA Operating Model', titleAr: 'النموذج التشغيلي للبنية المؤسسية', assetType: 'OPERATING_MODEL', domain: 'CROSS_CUTTING', importance: 'HIGH', whyItMatters: 'Defines how the EA function operates' },
  { key: 'architecture_review_procedure', title: 'Architecture Review Procedure', titleAr: 'إجراءات مراجعة الهندسة المعمارية', assetType: 'PROCEDURE', domain: 'CROSS_CUTTING', importance: 'HIGH', whyItMatters: 'Standardizes architecture review and approval process' },
  { key: 'technology_standards_catalog', title: 'Technology Standards Catalog', titleAr: 'فهرس المعايير التقنية', assetType: 'STANDARDS_CATALOG', domain: 'TECHNOLOGY', importance: 'HIGH', whyItMatters: 'Approved technologies and platforms in the organization' },
  { key: 'integration_standards', title: 'Integration Standards', titleAr: 'معايير التكامل', assetType: 'INTEGRATION_STANDARD', domain: 'APPLICATIONS', importance: 'HIGH', whyItMatters: 'Secure and standardized integration patterns' },
  { key: 'data_governance_principles', title: 'Data Governance Principles', titleAr: 'مبادئ حوكمة البيانات', assetType: 'DATA_PRINCIPLE', domain: 'DATA', importance: 'HIGH', whyItMatters: 'Data ownership, quality and lifecycle governance' },
  { key: 'security_architecture_principles', title: 'Security Architecture Principles', titleAr: 'مبادئ هندسة الأمن', assetType: 'SECURITY_PRINCIPLE', domain: 'SECURITY', importance: 'HIGH', whyItMatters: 'Security-by-design requirements aligned with NCA standards' },
  { key: 'architecture_compliance_policy', title: 'Architecture Compliance Policy', titleAr: 'سياسة الامتثال المعماري', assetType: 'POLICY', domain: 'CROSS_CUTTING', importance: 'HIGH', whyItMatters: 'Mandates project compliance with approved EA standards' },
]

const SCORE_COLOR = (s: number) => s >= 80 ? '#2ecc71' : s >= 60 ? '#3498db' : s >= 40 ? '#f39c12' : '#e74c3c'

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 28; const c = 2 * Math.PI * r; const dash = (score / 100) * c
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={SCORE_COLOR(score)} strokeWidth={6} strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        <text x={36} y={40} textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px', fill: SCORE_COLOR(score), fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{score}%</text>
      </svg>
      <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// ── Step 1: Profile + Framework ───────────────────────────────────────────────
function Step1Profile({ profile, config, onSave }: any) {
  const { setLocale, isAR, t } = useLang()
  const [form, setForm] = useState({
    organizationName: '', organizationNameAr: '', sector: 'GOVERNMENT',
    entityType: 'AUTHORITY', language: 'AR', eaMaturityLevel: 1,
    preferredFramework: 'NORA', domainsInScope: ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (profile) {
      setForm((f: any) => ({
        ...f,
        organizationName: profile.organizationName || '',
        organizationNameAr: profile.organizationNameAr || '',
        sector: profile.sector || 'GOVERNMENT',
        entityType: profile.entityType || 'AUTHORITY',
        language: profile.language || 'AR',
        eaMaturityLevel: profile.eaMaturityLevel || 1,
        preferredFramework: profile.preferredFramework || config?.framework?.type || 'NORA',
        domainsInScope: profile.domainsInScope?.length ? profile.domainsInScope : config?.framework?.enabledDomains || ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
      }))
    }
  }, [profile, config])

  const toggle = (d: string) => setForm((f: any) => ({ ...f, domainsInScope: f.domainsInScope.includes(d) ? f.domainsInScope.filter((x: string) => x !== d) : [...f.domainsInScope, d] }))

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      // Save setup profile
      const r1 = await authFetch('/setup/profile', { method: 'PUT', body: JSON.stringify({ ...form, setupStep: 2 }) })
      // Save framework config to platform config
      const r2 = await authFetch('/config/framework', { method: 'PUT', body: JSON.stringify({ frameworkType: form.preferredFramework, enabledDomains: form.domainsInScope }) })
      if ((r1.id || r1.tenantId) && r2) { setMsg('✓ تم الحفظ بنجاح'); setTimeout(() => onSave(), 700) }
      else setMsg('خطأ في الحفظ')
    } catch (e: any) { setMsg('خطأ: ' + e.message) }
    finally { setSaving(false) }
  }

  const tenant = config?.tenant
  const domains = ALL_DOMAINS[form.preferredFramework] || ALL_DOMAINS.NORA

  return (
    <div>
      {/* Tenant info cards */}
      {tenant && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[[(t('settings.org_id')), tenant.slug, '#00b4d8'], [(t('settings.subscription')), tenant.subscriptionTier, '#f39c12'], [(t('common.status')), tenant.status, '#2ecc71']].map(([l, v, c]) => (
            <div key={l as string} style={{ flex: 1, padding: '8px 10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${c as string}22`, borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: '#888', fontFamily: 'monospace', marginBottom: 2 }}>{l as string}</div>
              <div style={{ fontSize: 11, color: c as string, fontFamily: 'monospace', fontWeight: 600 }}>{(v as string) || '—'}</div>
            </div>
          ))}
        </div>
      )}

      {msg && <div style={{ padding: '6px 10px', borderRadius: 4, background: msg.startsWith('✓') ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)', color: msg.startsWith('✓') ? '#2ecc71' : '#e74c3c', fontSize: 11, marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 12 }}>
        {([['organizationNameAr', 'اسم المنظمة (عربي)', true], ['organizationName', isAR ? t('setup.org_name_en') : 'Organization Name (EN)', false]] as [string,string,boolean][]).map(([k, l, rtl]) => (
          <div key={k}>
            <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>{l}</div>
            <input className="form-input" value={(form as any)[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))} style={{ width: '100%', fontSize: 11, direction: rtl ? 'rtl' : 'ltr' }} />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>القطاع</div>
          <select className="form-input" value={form.sector} onChange={e => setForm((f: any) => ({ ...f, sector: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            {[['GOVERNMENT',isAR ? 'حكومي' : 'Government'],['HEALTH',isAR ? 'صحة' : 'Health'],['EDUCATION',isAR ? 'تعليم' : 'Education'],['FINANCE',isAR ? 'مالية' : 'Finance'],['UTILITIES',isAR ? 'خدمات عامة' : 'Utilities'],['OTHER',isAR ? 'أخرى' : 'Other']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>نوع الجهة</div>
          <select className="form-input" value={form.entityType} onChange={e => setForm((f: any) => ({ ...f, entityType: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            {[['MINISTRY',isAR ? 'وزارة' : 'Ministry'],['AUTHORITY',isAR ? 'هيئة' : 'Authority'],['ENTERPRISE',isAR ? 'مؤسسة' : 'Enterprise'],['SME',isAR ? 'شركة' : 'Company']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>لغة المنصة</div>
          <select className="form-input" value={form.language} onChange={e => {
            const lang = e.target.value as 'AR' | 'EN'
            setForm((f: any) => ({ ...f, language: lang }))
            setLocale(lang)
          }} style={{ fontSize: 11, width: '100%' }}>
            <option value="AR">العربية</option><option value="EN">English</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>{isAR ? 'مستوى نضج البنية المؤسسية (1-5)' : 'EA Maturity Level (1-5)'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={5} value={form.eaMaturityLevel} onChange={e => setForm((f: any) => ({ ...f, eaMaturityLevel: Number(e.target.value) }))} style={{ flex: 1 }} />
            <span style={{ fontSize: 12, width: 50, color: '#ccc' }}>{['',isAR ? 'بدائي' : 'Initial',isAR ? 'متطور' : 'Developing',isAR ? 'محدد' : 'Defined',isAR ? 'مُدار' : 'Managed',isAR ? 'مُحسَّن' : 'Optimized'][form.eaMaturityLevel]}</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>الإطار المرجعي</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['NORA', 'CUSTOM'].map(f => (
              <button key={f} onClick={() => setForm((fm: any) => ({ ...fm, preferredFramework: f, domainsInScope: ALL_DOMAINS[f] || [] }))}
                style={{ flex: 1, fontSize: 11, padding: '6px', borderRadius: 4, border: `1px solid ${form.preferredFramework === f ? '#00b4d8' : '#333'}`, background: form.preferredFramework === f ? 'rgba(0,180,216,0.15)' : 'transparent', color: form.preferredFramework === f ? '#00b4d8' : '#888', cursor: 'pointer' }}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Domains */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, marginBottom: 6, color: '#ccc' }}>المجالات المعمارية في النطاق</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {domains.map((d: string) => (
            <button key={d} onClick={() => toggle(d)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: `1px solid ${form.domainsInScope.includes(d) ? '#00b4d8' : '#333'}`, background: form.domainsInScope.includes(d) ? 'rgba(0,180,216,0.18)' : 'transparent', color: form.domainsInScope.includes(d) ? '#00b4d8' : '#888', cursor: 'pointer' }}>
              {form.domainsInScope.includes(d) ? '✓ ' : ''}{d.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={saving} onClick={save}>{saving ? isAR ? '⟳ جاري الحفظ...' : '⟳ Saving...' : isAR ? '💾 حفظ والمتابعة →' : '💾 Save & Continue →'}</button>
    </div>
  )
}

// ── Step 2: KB Setup + KB Gap Detection + KB Generation ───────────────────────
function Step2KB({ onNext }: any) {
  const { isAR } = useLang()
  const [kbDocs, setKbDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    authFetch('/knowledge/documents?limit=100').then(d => {
      setKbDocs(Array.isArray(d) ? d : d?.documents || d?.items || [])
    }).finally(() => setLoading(false))
  }, [])

  const isKbDocAvailable = (docKey: string, titleAr: string) => {
    const keywords = titleAr.split(/\s+/).filter((w: string) => w.length > 3)
    return kbDocs.some(d => keywords.some((kw: string) => (d.name || d.title || '').includes(kw)))
  }

  // Note: KB docs are uploaded by user, not AI-generated
  // Foundation docs that go in KB are reference documents

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: 4, marginBottom: 14, fontSize: 12, color: '#ddd' }}>
        <strong style={{ color: '#00b4d8' }}>{isAR ? '📚 قاعدة المعرفة:' : '📚 Knowledge Base:'}</strong> {isAR ? 'وثائق مرجعية مشتركة — منهجيات وطنية، معايير، لوائح تنظيمية.' : 'Shared reference documents — national methodologies, standards, regulations.'} <span style={{ color: '#f39c12' }}>{isAR ? 'ليست أصولاً خاصة بمنظمتك.' : 'Not your organization-specific assets.'}</span>
      </div>

      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>{isAR ? '⟳ جاري التحقق...' : '⟳ Checking...'}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {KB_FOUNDATION_DOCS.map(doc => {
            const available = isKbDocAvailable(doc.key, doc.titleAr)
            return (
              <div key={doc.key} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${available ? 'rgba(46,204,113,0.3)' : '#333'}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{available ? '✅' : doc.required ? '⭐' : '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#eee', fontWeight: 500 }}>{isAR ? doc.titleAr : doc.title}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{doc.whyItMatters}</div>
                  </div>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, flexShrink: 0, background: available ? 'rgba(46,204,113,0.12)' : doc.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: available ? '#2ecc71' : doc.required ? '#e74c3c' : '#888' }}>
                    {available ? isAR ? 'متاح ✓' : 'Available ✓' : doc.required ? isAR ? 'مطلوب' : 'Required' : isAR ? 'اختياري' : 'Optional'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/knowledge', '_blank')}>🔗 رفع وثائق المرجعية</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// ── Step 3: Repo Setup + Repo Gap Detection + Repo Generation ─────────────────
function Step3Repo({ onNext }: any) {
  const { isAR } = useLang()
  const [repoAssets, setRepoAssets] = useState<any[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState<Record<string, any>>({})
  const [msg, setMsg] = useState<{type:string;text:string} | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<string|null>(null)

  const load = () => {
    setLoading(true)
    authFetch('/ea-repository/assets?limit=100').then(d => {
      setRepoAssets(Array.isArray(d) ? d : d?.assets || d?.items || [])
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  // Smarter availability check — check assetType, name, nameAr, description
  const isRepoDocAvailable = (doc: any) => {
    return repoAssets.some(a => {
      // Exact assetType match
      if (a.assetType === doc.assetType) return true
      // Name contains Arabic title keywords
      const arKeywords = doc.titleAr.split(/\s+/).filter((w: string) => w.length > 3)
      const nameAr = (a.nameAr || a.name || '').toLowerCase()
      const desc = (a.description || '').toLowerCase()
      if (arKeywords.some((kw: string) => nameAr.includes(kw) || desc.includes(kw))) return true
      // Check tags
      if (a.tags?.some((t: string) => doc.key.includes(t) || t.includes(doc.assetType?.toLowerCase()))) return true
      return false
    })
  }

  const generate = async (docKey: string) => {
    setGenerating(docKey); setMsg(null)
    try {
      const res = await authFetch(`/setup/generate/${docKey}`, { method: 'POST' })
      if (res.asset) {
        setGeneratedContent((g: Record<string,any>) => ({ ...g, [docKey]: res.content }))
        setMsg({ type: 'success', text: isAR ? `✓ تم توليد "${res.asset.nameAr}" وحفظه في المستودع` : `✓ "${res.asset.name || res.asset.nameAr}" generated and saved to repository` })
        load() // refresh asset list
      } else setMsg({ type: 'error', text: res.message || isAR ? 'فشل التوليد' : 'Generation failed' })
    } finally { setGenerating(null) }
  }

  const impColor = (i: string) => i === 'CRITICAL' ? '#e74c3c' : '#f39c12'

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(243,156,18,0.07)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 4, marginBottom: 14, fontSize: 12, color: '#ddd' }}>
        <strong style={{ color: '#f39c12' }}>{isAR ? '🗄 مستودع البنية المؤسسية:' : '🗄 EA Repository:'}</strong> {isAR ? 'الأصول المعمارية الخاصة بمنظمتك.' : 'Your organization-specific architecture assets.'} <span style={{ color: '#00b4d8' }}>{isAR ? 'يمكن توليد الوثائق المفقودة بالذكاء الاصطناعي.' : 'Missing documents can be AI-generated.'}</span>
      </div>

      {msg && <div style={{ padding: '6px 10px', borderRadius: 4, background: msg.type === 'success' ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)', color: msg.type === 'success' ? '#2ecc71' : '#e74c3c', fontSize: 11, marginBottom: 10 }}>{msg.text}</div>}

      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>{isAR ? '⟳ جاري التحقق...' : '⟳ Checking...'}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 380, overflowY: 'auto' }}>
          {REPO_FOUNDATION_DOCS.map(doc => {
            const available = isRepoDocAvailable(doc)
            const done = !!generatedContent[doc.key]
            return (
              <div key={doc.key} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${available || done ? 'rgba(46,204,113,0.3)' : impColor(doc.importance) + '22'}`, borderLeft: `3px solid ${available || done ? '#2ecc71' : impColor(doc.importance)}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{available || done ? '✅' : '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#eee' }}>{isAR ? doc.titleAr : doc.title}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{doc.whyItMatters}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
                    {(available || done) ? (
                      <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: 'rgba(46,204,113,0.12)', color: '#2ecc71' }}>{isAR ? 'متاح ✓' : 'Available ✓'}</span>
                    ) : (
                      <>
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: `${impColor(doc.importance)}18`, color: impColor(doc.importance) }}>{doc.importance === 'CRITICAL' ? isAR ? 'حرجة' : 'Critical' : isAR ? 'عالية' : 'High'}</span>
                        <button onClick={() => generate(doc.key)} disabled={generating === doc.key} style={{ fontSize: 9, padding: '2px 10px', background: 'rgba(0,180,216,0.12)', border: '1px solid #00b4d8', borderRadius: 2, cursor: 'pointer', color: '#00b4d8', whiteSpace: 'nowrap' }}>
                          {generating === doc.key ? isAR ? '⟳ جاري...' : '⟳ Generating...' : isAR ? '⚡ توليد' : '⚡ Generate'}
                        </button>
                      </>
                    )}
                    {done && !available && (
                      <button onClick={() => setPreview(generatedContent[doc.key])} style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #444', borderRadius: 2, cursor: 'pointer', color: '#ccc' }}>معاينة</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ fontSize: 10, color: '#666', marginBottom: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
        {isAR ? '⚠ الوثائق المولّدة تُحفظ تلقائياً في مستودع البنية المؤسسية بصفة مسودة — بانتظار المراجعة والاعتماد' : '⚠ Generated documents are auto-saved to the EA Repository as drafts — pending review and approval'}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/repository', '_blank')}>{isAR ? '🔗 المستودع' : '🔗 Repository'}</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>

      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#0f1623', border: '1px solid #1e2d45', borderRadius: 8, padding: 20, width: '80%', maxHeight: '80vh', overflow: 'auto', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>معاينة الوثيقة المولّدة</div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
            </div>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#ddd' }}>{preview}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 4: Readiness ─────────────────────────────────────────────────────────
function Step4Readiness({ onNext }: any) {
  const { isAR } = useLang()
  const [r, setR] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { authFetch('/setup/readiness').then(setR).finally(() => setLoading(false)) }, [])
  if (loading) return <div style={{ fontSize: 12, color: '#aaa' }}>{isAR ? '⟳ جاري الحساب...' : '⟳ Calculating...'}</div>
  const scores = [
    { label: isAR ? 'قاعدة المعرفة' : 'Knowledge Base', icon: '📚', data: r?.kbReadiness },
    { label: isAR ? 'المستودع' : 'Repository', icon: '🗄', data: r?.repoReadiness },
    { label: isAR ? 'دورة ADM' : 'ADM Cycle', icon: '⚙', data: r?.admReadiness },
    { label: isAR ? 'الحوكمة' : 'Governance', icon: '⚖', data: r?.governanceReadiness },
  ]
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 42, fontWeight: 700, color: SCORE_COLOR(r?.overall || 0) }}>{r?.overall || 0}%</div>
        <div style={{ fontSize: 13, color: '#aaa' }}>{isAR ? 'مؤشر الجاهزية الإجمالي' : 'Overall Readiness Score'}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {scores.map(({ label, icon, data }) => (
          <div key={label} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid #1e2d45', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScoreRing score={data?.score || 0} label={data?.label || ''} />
            <div><div style={{ fontSize: 13, color: '#eee' }}>{icon} {label}</div></div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>{isAR ? 'الخطوات التالية →' : 'Next Steps →'}</button>
    </div>
  )
}

// ── Step 5: Next Actions ──────────────────────────────────────────────────────
function Step5Actions({ onComplete }: any) {
  const { isAR } = useLang()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { authFetch('/setup/actions').then(setData).finally(() => setLoading(false)) }, [])
  const routes: Record<string, string> = { UPLOAD_KB: '/knowledge', UPLOAD_REPO: '/repository', GENERATE_FOUNDATION: '/setup', START_ADM: '/adm', SETUP_GOVERNANCE: '/settings' }
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>{isAR ? 'الخطوات المقترحة لتطوير منظومة البنية المؤسسية' : 'Recommended steps for developing your EA practice'}</div>
      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>{isAR ? '⟳ جاري التحليل...' : '⟳ Analyzing...'}</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
          {(data?.actions || []).map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #1e2d45', borderRadius: 6 }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#eee' }}>{isAR ? a.titleAr : a.titleEn}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{isAR ? a.titleEn : a.titleAr}</div>
              </div>
              <button onClick={() => window.location.href = routes[a.type] || '/'} style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(0,180,216,0.1)', border: '1px solid #00b4d8', borderRadius: 2, cursor: 'pointer', color: '#00b4d8' }}>{isAR ? 'انتقال' : 'Go'}</button>
            </div>
          ))}
          {(!data?.actions || data.actions.length === 0) && (
            <div style={{ padding: '12px 14px', background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: 6, color: '#2ecc71', fontSize: 12 }}>
              ✓ المنصة جاهزة — يمكنك البدء بأول دورة ADM
            </div>
          )}
        </div>
      )}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onComplete}>{isAR ? '✓ إتمام الإعداد' : '✓ Complete Setup'}</button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
function SetupAssistantPageInner({ modal = false, onClose }: { modal?: boolean; onClose?: () => void }) {
  const { isAR } = useLang()
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    Promise.all([authFetch('/setup/profile'), authFetch('/config')]).then(([p, c]) => {
      setProfile(p); setConfig(c)
      if (p?.setupStep > 1 && !p?.setupCompleted) setStep(Math.min(p.setupStep, STEPS.length))
      if (p?.setupCompleted) setCompleted(true)
    })
  }, [])

  const complete = async () => {
    await authFetch('/setup/complete', { method: 'PUT' })
    setCompleted(true)
    if (onClose) onClose()
    else window.location.href = '/'
  }

  const containerStyle = modal ? {
    position: 'fixed' as const, inset: 0,
    background: 'rgba(0,0,0,0.93)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
  } : {}

  const innerStyle = modal ? {
    width: '92%', maxWidth: 720, maxHeight: '93vh', overflow: 'auto',
    background: '#0f1623', border: '1px solid #1e2d45', borderRadius: 12, padding: 28,
    boxShadow: '0 30px 70px rgba(0,0,0,0.9)',
  } : { padding: 24, maxWidth: 720 }

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        {modal && onClose && (
          <button onClick={onClose} style={{ position: 'absolute' as const, top: 14, left: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid #1e2d45', borderRadius: 4, cursor: 'pointer', fontSize: 14, color: '#888', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        )}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#eee', marginBottom: 4 }}>{isAR ? '🏛 مساعد إعداد البنية المؤسسية' : '🏛 EA Readiness Setup Assistant'}</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
          {STEPS.map(s => (
            <button key={s.id} onClick={() => setStep(s.id)} style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 6, border: `1px solid ${step === s.id ? '#00b4d8' : '#1e2d45'}`, background: step === s.id ? 'rgba(0,180,216,0.15)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 80 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontSize: 8, color: step === s.id ? '#00b4d8' : '#555', whiteSpace: 'nowrap' }}>{isAR ? s.titleAr : s.titleEn}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2d45', borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#eee' }}>
            <span>{STEPS[step - 1]?.icon}</span>
            <span>{isAR ? STEPS[step - 1]?.titleAr : STEPS[step - 1]?.titleEn}</span>
            
          </div>
          {step === 1 && <Step1Profile profile={profile} config={config} onSave={() => setStep(2)} />}
          {step === 2 && <Step2KB onNext={() => setStep(3)} />}
          {step === 3 && <Step3Repo onNext={() => setStep(4)} />}
          {step === 4 && <Step4Readiness onNext={() => setStep(5)} />}
          {step === 5 && <Step5Actions onComplete={complete} />}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: '#444' }}>
          <span>{isAR ? `الخطوة ${step} من ${STEPS.length}` : `Step ${step} of ${STEPS.length}`}</span>
          {completed && <span style={{ color: '#2ecc71' }}>{isAR ? '✓ تم الإعداد' : '✓ Setup Complete'}</span>}
        </div>
      </div>
    </div>
  )
}

export default function SetupAssistantPage({ modal = false, onClose }: { modal?: boolean; onClose?: () => void }) {
  return <SetupAssistantPageInner modal={modal} onClose={onClose} />
}
