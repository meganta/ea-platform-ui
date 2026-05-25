import { useEffect, useState } from 'react'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

// Reordered: 1=Profile, 2=Gap Detection, 3=Foundation Generation, 4=KB Setup, 5=Repo Setup, 6=Classification, 7=Readiness, 8=Next Actions
const STEPS = [
  { id: 1, icon: '🏢', titleAr: 'ملف المنظمة', titleEn: 'Organization Profile' },
  { id: 2, icon: '🔍', titleAr: 'اكتشاف الفجوات', titleEn: 'Gap Detection' },
  { id: 3, icon: '⚡', titleAr: 'توليد الوثائق التأسيسية', titleEn: 'Foundation Generation' },
  { id: 4, icon: '📚', titleAr: 'قاعدة المعرفة', titleEn: 'Knowledge Base Setup' },
  { id: 5, icon: '🗄', titleAr: 'مستودع البنية المؤسسية', titleEn: 'EA Repository Setup' },
  { id: 6, icon: '🤖', titleAr: 'تصنيف المحتوى', titleEn: 'AI Classification' },
  { id: 7, icon: '📊', titleAr: 'مؤشر الجاهزية', titleEn: 'Readiness Score' },
  { id: 8, icon: '🚀', titleAr: 'الخطوات التالية', titleEn: 'Next Actions' },
]

const SCORE_COLOR = (s: number) => s >= 80 ? '#2ecc71' : s >= 60 ? '#3498db' : s >= 40 ? '#f39c12' : s >= 20 ? '#e67e22' : '#e74c3c'

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 28; const c = 2 * Math.PI * r; const dash = (score / 100) * c
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={SCORE_COLOR(score)} strokeWidth={6}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" />
        <text x={36} y={40} textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px', fill: SCORE_COLOR(score), fontSize: 14, fontWeight: 700, fontFamily: 'monospace' }}>{score}%</text>
      </svg>
      <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// Step 1: Organization Profile
function Step1Profile({ profile, onSave }: any) {
  const [form, setForm] = useState({
    organizationName: '', organizationNameAr: '', sector: 'GOVERNMENT',
    entityType: 'AUTHORITY', language: 'AR', eaMaturityLevel: 1,
    preferredFramework: 'NORA', domainsInScope: ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const domains = ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY']

  // Issue 5 fix: load profile on mount
  useEffect(() => {
    if (profile && (profile.organizationName || profile.organizationNameAr || profile.sector)) {
      setForm(f => ({
        ...f,
        organizationName: profile.organizationName || '',
        organizationNameAr: profile.organizationNameAr || '',
        sector: profile.sector || 'GOVERNMENT',
        entityType: profile.entityType || 'AUTHORITY',
        language: profile.language || 'AR',
        eaMaturityLevel: profile.eaMaturityLevel || 1,
        preferredFramework: profile.preferredFramework || 'NORA',
        domainsInScope: profile.domainsInScope?.length ? profile.domainsInScope : ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
      }))
    }
  }, [profile])

  const toggle = (d: string) => setForm((f: any) => ({ ...f, domainsInScope: f.domainsInScope.includes(d) ? f.domainsInScope.filter((x: string) => x !== d) : [...f.domainsInScope, d] }))

  const save = async () => {
    setSaving(true); setMsg('')
    try {
      const res = await authFetch('/setup/profile', { method: 'PUT', body: JSON.stringify({ ...form, setupStep: 2 }) })
      if (res.id || res.tenantId) { setMsg('✓ تم الحفظ'); onSave() }
      else setMsg('خطأ في الحفظ: ' + (res.message || JSON.stringify(res)))
    } catch (e: any) { setMsg('خطأ: ' + e.message) }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>أدخل معلومات المنظمة لتخصيص مساعد الإعداد وفقاً لسياقكم</div>
      {msg && <div style={{ padding: '6px 10px', borderRadius: 4, background: msg.startsWith('✓') ? 'rgba(46,204,113,0.15)' : 'rgba(231,76,60,0.15)', color: msg.startsWith('✓') ? '#2ecc71' : '#e74c3c', fontSize: 11, marginBottom: 10 }}>{msg}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {([['organizationNameAr', 'اسم المنظمة (عربي)', true], ['organizationName', 'Organization Name (EN)', false]] as [string,string,boolean][]).map(([k, l, rtl]) => (
          <div key={k}>
            <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>{l}</div>
            <input className="form-input" value={(form as any)[k]} onChange={e => setForm((f: any) => ({ ...f, [k]: e.target.value }))}
              style={{ width: '100%', fontSize: 11, direction: rtl ? 'rtl' : 'ltr' }} />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>القطاع</div>
          <select className="form-input" value={form.sector} onChange={e => setForm((f: any) => ({ ...f, sector: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            {[['GOVERNMENT','حكومي'],['HEALTH','صحة'],['EDUCATION','تعليم'],['FINANCE','مالية'],['UTILITIES','خدمات عامة'],['OTHER','أخرى']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>نوع الجهة</div>
          <select className="form-input" value={form.entityType} onChange={e => setForm((f: any) => ({ ...f, entityType: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            {[['MINISTRY','وزارة'],['AUTHORITY','هيئة'],['ENTERPRISE','مؤسسة'],['SME','شركة']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>مستوى نضج البنية المؤسسية (1-5)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={5} value={form.eaMaturityLevel} onChange={e => setForm((f: any) => ({ ...f, eaMaturityLevel: Number(e.target.value) }))} style={{ flex: 1 }} />
            <span style={{ fontSize: 12, width: 20, color: '#ccc' }}>{form.eaMaturityLevel}</span>
          </div>
          <div style={{ fontSize: 10, color: '#888' }}>{['','بدائي','متطور','محدد','مُدار','مُحسَّن'][form.eaMaturityLevel]}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>الإطار المرجعي</div>
          <select className="form-input" value={form.preferredFramework} onChange={e => setForm((f: any) => ({ ...f, preferredFramework: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            <option value="NORA">NORA 2.0 — المعيار الوطني</option>
            <option value="CUSTOM">مخصص</option>
          </select>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, marginBottom: 6, color: '#ccc' }}>المجالات المعمارية في النطاق</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {domains.map(d => (
            <button key={d} onClick={() => toggle(d)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 4, border: `1px solid ${form.domainsInScope.includes(d) ? '#00b4d8' : '#333'}`, background: form.domainsInScope.includes(d) ? 'rgba(0,180,216,0.18)' : 'transparent', color: form.domainsInScope.includes(d) ? '#00b4d8' : '#888', cursor: 'pointer' }}>
              {d.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16, fontSize: 12 }} disabled={saving} onClick={save}>{saving ? 'جاري الحفظ...' : '💾 حفظ والمتابعة →'}</button>
    </div>
  )
}

// Step 2: Gap Detection (moved to step 2 - issue 4)
function Step2Gaps({ onNext }: any) {
  const [gaps, setGaps] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const impColor = (i: string) => i === 'CRITICAL' ? '#e74c3c' : '#f39c12'

  useEffect(() => { authFetch('/setup/gaps').then(setGaps).finally(() => setLoading(false)) }, [])

  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>فحص الوثائق التأسيسية المفقودة بناءً على ما هو موجود في المستودع</div>
      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>⟳ جاري الفحص...</div> : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', borderRadius: 4, fontSize: 12 }}>
              <div style={{ color: '#888', fontSize: 10 }}>إجمالي الفجوات</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#00b4d8' }}>{gaps?.total || 0}</div>
            </div>
            <div style={{ padding: '8px 14px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 4, fontSize: 12 }}>
              <div style={{ color: '#888', fontSize: 10 }}>حرجة</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#e74c3c' }}>{gaps?.critical || 0}</div>
            </div>
            {gaps?.total === 0 && <div style={{ padding: '8px 14px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 4, fontSize: 12, color: '#2ecc71', display: 'flex', alignItems: 'center' }}>✓ جميع الوثائق التأسيسية موجودة</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 300, overflowY: 'auto' }}>
            {(gaps?.gaps || []).map((g: any) => (
              <div key={g.key} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${impColor(g.importance)}33`, borderLeft: `3px solid ${impColor(g.importance)}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#eee' }}>{g.titleAr}</div>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${impColor(g.importance)}18`, color: impColor(g.importance) }}>{g.importance === 'CRITICAL' ? 'حرجة' : 'عالية'}</span>
                </div>
                <div style={{ fontSize: 10, color: '#888' }}>{g.whyItMatters}</div>
                <div style={{ fontSize: 9, color: '#00b4d8', marginTop: 2 }}>✓ قابلة للتوليد</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>
            {gaps?.total > 0 ? `توليد ${gaps.total} وثيقة مفقودة →` : 'المتابعة →'}
          </button>
        </>
      )}
    </div>
  )
}

// Step 3: Foundation Generation
function Step3Generation({ onNext }: any) {
  const [gaps, setGaps] = useState<any[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [generated, setGenerated] = useState<Record<string, any>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)

  useEffect(() => { authFetch('/setup/gaps').then(d => setGaps(d?.gaps || [])) }, [])

  const generate = async (docKey: string) => {
    setGenerating(docKey); setMsg(null)
    try {
      const res = await authFetch(`/setup/generate/${docKey}`, { method: 'POST' })
      if (res.asset) { setGenerated((g: Record<string,any>) => ({ ...g, [docKey]: res })); setMsg({ type: 'success', text: `تم توليد "${res.asset.nameAr}" وحفظه في مستودع البنية المؤسسية` }) }
      else setMsg({ type: 'error', text: res.message || 'فشل التوليد' })
    } finally { setGenerating(null) }
  }

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(243,156,18,0.08)', border: '1px solid rgba(243,156,18,0.25)', borderRadius: 4, fontSize: 11, marginBottom: 12, color: '#ddd' }}>
        <strong style={{ color: '#f39c12' }}>⚠ ملاحظة:</strong> الوثائق المولّدة تُحفظ في <strong>مستودع البنية المؤسسية</strong> — وليس قاعدة المعرفة.
      </div>
      {msg && <div style={{ padding: '6px 10px', borderRadius: 4, background: msg.type === 'success' ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)', color: msg.type === 'success' ? '#2ecc71' : '#e74c3c', fontSize: 11, marginBottom: 10 }}>{msg.text}</div>}
      {gaps.length === 0 ? <div style={{ fontSize: 12, color: '#2ecc71', marginBottom: 14 }}>✓ لا توجد فجوات — جميع الوثائق التأسيسية موجودة</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14, maxHeight: 340, overflowY: 'auto' }}>
          {gaps.map((g: any) => {
            const done = !!generated[g.key]
            return (
              <div key={g.key} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(46,204,113,0.3)' : '#333'}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 15 }}>{done ? '✅' : '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#eee' }}>{g.titleAr}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{g.domain} · {g.assetType?.replace(/_/g, ' ')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {done && <button onClick={() => setPreview(generated[g.key]?.content)} style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #444', borderRadius: 2, cursor: 'pointer', color: '#ccc' }}>معاينة</button>}
                    {!done && <button onClick={() => generate(g.key)} disabled={generating === g.key} style={{ fontSize: 9, padding: '2px 10px', background: 'rgba(0,180,216,0.12)', border: '1px solid #00b4d8', borderRadius: 2, cursor: 'pointer', color: '#00b4d8' }}>
                      {generating === g.key ? '⟳ جاري التوليد...' : '⚡ توليد'}
                    </button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#1a2035', border: '1px solid #333', borderRadius: 8, padding: 20, width: '80%', maxHeight: '80vh', overflow: 'auto', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>معاينة الوثيقة</div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
            </div>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#ddd' }}>{preview}</pre>
          </div>
        </div>
      )}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
    </div>
  )
}

// Step 4: KB Setup
function Step4KB({ config, onNext }: any) {
  const [localConfig, setLocalConfig] = useState<any>(config)
  useEffect(() => {
    if (!config?.requiredKbDocs) {
      authFetch('/setup/config').then(c => setLocalConfig(c))
    } else {
      setLocalConfig(config)
    }
  }, [config])

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#ddd' }}>
        <strong style={{ color: '#00b4d8' }}>📚 قاعدة المعرفة:</strong> وثائق مرجعية مشتركة — منهجيات، معايير، لوائح. <strong>ليست</strong> خاصة بمنظمتك.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {(localConfig?.requiredKbDocs || []).map((doc: any) => (
          <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: 4 }}>
            <span style={{ fontSize: 15 }}>{doc.required ? '⭐' : '📄'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#eee' }}>{doc.labelAr}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{doc.label} · {doc.category}</div>
            </div>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: doc.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: doc.required ? '#e74c3c' : '#888' }}>{doc.required ? 'مطلوب' : 'اختياري'}</span>
          </div>
        ))}
        {!localConfig?.requiredKbDocs && <div style={{ fontSize: 12, color: '#888' }}>⟳ جاري التحميل...</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/knowledge', '_blank')}>🔗 قاعدة المعرفة</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// Step 5: Repo Setup
function Step5Repo({ config, onNext }: any) {
  const [localConfig, setLocalConfig] = useState<any>(config)
  useEffect(() => {
    if (!config?.requiredRepoAssets) {
      authFetch('/setup/config').then(c => setLocalConfig(c))
    } else {
      setLocalConfig(config)
    }
  }, [config])

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(243,156,18,0.07)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#ddd' }}>
        <strong style={{ color: '#f39c12' }}>🗄 مستودع البنية المؤسسية:</strong> أصول معمارية خاصة بمنظمتك — استراتيجية، خرائط، أنظمة.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
        {(localConfig?.requiredRepoAssets || []).map((asset: any) => (
          <div key={asset.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: 4 }}>
            <span style={{ fontSize: 15 }}>{asset.required ? '⭐' : '📋'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: '#eee' }}>{asset.labelAr}</div>
              <div style={{ fontSize: 10, color: '#888' }}>{asset.label} · {asset.domain}</div>
            </div>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: asset.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: asset.required ? '#e74c3c' : '#888' }}>{asset.required ? 'مطلوب' : 'اختياري'}</span>
          </div>
        ))}
        {!localConfig?.requiredRepoAssets && <div style={{ fontSize: 12, color: '#888' }}>⟳ جاري التحميل...</div>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/repository', '_blank')}>🔗 المستودع</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// Step 6: Classification info
function Step6Classification({ onNext }: any) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>التصنيف يحدث تلقائياً عند رفع الوثائق</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {[['تصنيف المحتوى','تحديد نوع كل وثيقة وفئتها المعمارية','🏷'],['تحديد الوجهة','قاعدة المعرفة أم مستودع البنية المؤسسية؟','🎯'],['تحديد المجال','أعمال، تطبيقات، بيانات، تقنية، أمن','🗂'],['درجة الثقة','مؤشر دقة التصنيف لكل وثيقة','📊']].map(([t,d,i]) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: 4 }}>
            <span style={{ fontSize: 18 }}>{i}</span>
            <div><div style={{ fontSize: 12, fontWeight: 600, color: '#eee' }}>{t}</div><div style={{ fontSize: 11, color: '#888' }}>{d}</div></div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
    </div>
  )
}

// Step 7: Readiness
function Step7Readiness({ onNext }: any) {
  const [r, setR] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { authFetch('/setup/readiness').then(setR).finally(() => setLoading(false)) }, [])
  if (loading) return <div style={{ fontSize: 12, color: '#aaa' }}>⟳ جاري الحساب...</div>
  const scores = [
    { label: 'قاعدة المعرفة', icon: '📚', data: r?.kbReadiness },
    { label: 'المستودع', icon: '🗄', data: r?.repoReadiness },
    { label: 'دورة ADM', icon: '⚙', data: r?.admReadiness },
    { label: 'الحوكمة', icon: '⚖', data: r?.governanceReadiness },
  ]
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 38, fontWeight: 700, color: SCORE_COLOR(r?.overall || 0) }}>{r?.overall || 0}%</div>
        <div style={{ fontSize: 13, color: '#aaa' }}>مؤشر الجاهزية الإجمالي</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {scores.map(({ label, icon, data }) => (
          <div key={label} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScoreRing score={data?.score || 0} label={data?.label || ''} />
            <div><div style={{ fontSize: 13, color: '#eee' }}>{icon} {label}</div></div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>الخطوات التالية →</button>
    </div>
  )
}

// Step 8: Next Actions
function Step8Actions({ onComplete }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { authFetch('/setup/actions').then(setData).finally(() => setLoading(false)) }, [])
  const routes: Record<string, string> = { UPLOAD_KB: '/knowledge', UPLOAD_REPO: '/repository', GENERATE_FOUNDATION: '/setup', START_ADM: '/adm', SETUP_GOVERNANCE: '/settings' }
  return (
    <div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>إليك الخطوات المقترحة لتطوير منظومة البنية المؤسسية</div>
      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>⟳ جاري التحليل...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 16 }}>
          {(data?.actions || []).map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #333', borderRadius: 4 }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#eee' }}>{a.titleAr}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{a.titleEn}</div>
              </div>
              <button onClick={() => window.location.href = routes[a.type] || '/'} style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(0,180,216,0.1)', border: '1px solid #00b4d8', borderRadius: 2, cursor: 'pointer', color: '#00b4d8' }}>انتقال</button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onComplete}>✓ إتمام الإعداد</button>
    </div>
  )
}

// Main Component
export default function SetupAssistantPage({ modal = false, onClose }: { modal?: boolean; onClose?: () => void }) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    Promise.all([authFetch('/setup/profile'), authFetch('/setup/config')]).then(([p, c]) => {
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
    background: 'rgba(0,0,0,0.92)',  // Issue 1 fix: much more opaque
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
  } : {}

  const innerStyle = modal ? {
    width: '90%', maxWidth: 700, maxHeight: '92vh', overflow: 'auto',
    background: '#111827',  // Issue 1 fix: solid dark background
    border: '1px solid #2a3550', borderRadius: 12, padding: 28,
    boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
  } : { padding: 24, maxWidth: 720 }

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        {modal && onClose && (
          <button onClick={onClose} style={{ position: 'absolute' as const, top: 14, left: 14, background: 'rgba(255,255,255,0.08)', border: '1px solid #333', borderRadius: 4, cursor: 'pointer', fontSize: 14, color: '#aaa', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        )}

        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#eee', marginBottom: 4 }}>🏛 مساعد إعداد البنية المؤسسية</div>
          <div style={{ fontSize: 12, color: '#888' }}>EA Readiness Setup Assistant</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
          {STEPS.map(s => (
            <button key={s.id} onClick={() => setStep(s.id)} style={{ flexShrink: 0, padding: '5px 8px', borderRadius: 6, border: `1px solid ${step === s.id ? '#00b4d8' : '#2a3550'}`, background: step === s.id ? 'rgba(0,180,216,0.15)' : 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 58 }}>
              <span style={{ fontSize: 15 }}>{s.icon}</span>
              <span style={{ fontSize: 7, color: step === s.id ? '#00b4d8' : '#666', whiteSpace: 'nowrap' }}>{s.titleAr}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid #2a3550', borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#eee' }}>
            <span>{STEPS[step - 1]?.icon}</span>
            <span>{STEPS[step - 1]?.titleAr}</span>
            <span style={{ fontSize: 11, color: '#666', fontWeight: 400 }}>— {STEPS[step - 1]?.titleEn}</span>
          </div>
          {step === 1 && <Step1Profile profile={profile} onSave={() => setStep(2)} />}
          {step === 2 && <Step2Gaps onNext={() => setStep(3)} />}
          {step === 3 && <Step3Generation onNext={() => setStep(4)} />}
          {step === 4 && <Step4KB config={config} onNext={() => setStep(5)} />}
          {step === 5 && <Step5Repo config={config} onNext={() => setStep(6)} />}
          {step === 6 && <Step6Classification onNext={() => setStep(7)} />}
          {step === 7 && <Step7Readiness onNext={() => setStep(8)} />}
          {step === 8 && <Step8Actions onComplete={complete} />}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: '#555' }}>
          <span>الخطوة {step} من {STEPS.length}</span>
          {completed && <span style={{ color: '#2ecc71' }}>✓ تم الإعداد</span>}
        </div>
      </div>
    </div>
  )
}
