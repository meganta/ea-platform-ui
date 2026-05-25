import { useEffect, useState } from 'react'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

// New step order: 1=Profile, 2=Gap+Generation, 3=KB, 4=Repo, 5=Readiness, 6=Actions
const STEPS = [
  { id: 1, icon: '🏢', titleAr: 'ملف المنظمة', titleEn: 'Organization Profile' },
  { id: 2, icon: '🔍⚡', titleAr: 'الفجوات والتوليد', titleEn: 'Gaps & Generation' },
  { id: 3, icon: '📚', titleAr: 'قاعدة المعرفة', titleEn: 'Knowledge Base Setup' },
  { id: 4, icon: '🗄', titleAr: 'مستودع البنية المؤسسية', titleEn: 'EA Repository Setup' },
  { id: 5, icon: '📊', titleAr: 'مؤشر الجاهزية', titleEn: 'Readiness Score' },
  { id: 6, icon: '🚀', titleAr: 'الخطوات التالية', titleEn: 'Next Actions' },
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

// ── Step 1: Organization Profile + Language + Org Info ────────────────────────
function Step1Profile({ profile, config, onSave }: any) {
  const [form, setForm] = useState({
    organizationName: '', organizationNameAr: '', sector: 'GOVERNMENT',
    entityType: 'AUTHORITY', language: 'AR', eaMaturityLevel: 1,
    preferredFramework: 'NORA', domainsInScope: ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const domains = ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY']

  useEffect(() => {
    if (profile && (profile.organizationName || profile.organizationNameAr || profile.sector !== undefined)) {
      setForm((f: any) => ({
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
      if (res.id || res.tenantId) { setMsg('✓ تم الحفظ بنجاح'); setTimeout(() => onSave(), 800) }
      else setMsg('خطأ: ' + (res.message || JSON.stringify(res)))
    } catch (e: any) { setMsg('خطأ: ' + e.message) }
    finally { setSaving(false) }
  }

  const tenant = config?.tenant

  return (
    <div>
      {/* Org info cards from tenant */}
      {tenant && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['ORGANIZATION ID', tenant.slug, '#00b4d8'], ['SUBSCRIPTION', tenant.subscriptionTier, '#f39c12'], ['STATUS', tenant.status, '#2ecc71']].map(([label, value, color]) => (
            <div key={label as string} style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${color as string}22`, borderRadius: 6 }}>
              <div style={{ fontSize: 9, color: '#888', fontFamily: 'monospace', marginBottom: 3 }}>{label as string}</div>
              <div style={{ fontSize: 11, color: color as string, fontFamily: 'monospace', fontWeight: 600 }}>{(value as string) || '—'}</div>
            </div>
          ))}
        </div>
      )}

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
          <div style={{ fontSize: 11, marginBottom: 3, color: '#ccc' }}>لغة المنصة الافتراضية</div>
          <select className="form-input" value={form.language} onChange={e => setForm((f: any) => ({ ...f, language: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            <option value="AR">العربية</option>
            <option value="EN">English</option>
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
              {d.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16, fontSize: 12 }} disabled={saving} onClick={save}>{saving ? '⟳ جاري الحفظ...' : '💾 حفظ والمتابعة →'}</button>
    </div>
  )
}

// ── Step 2: Gap Detection + Foundation Generation (combined) ──────────────────
function Step2GapsAndGeneration({ onNext }: any) {
  const [gaps, setGaps] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generated, setGenerated] = useState<Record<string, any>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)
  const impColor = (i: string) => i === 'CRITICAL' ? '#e74c3c' : '#f39c12'

  useEffect(() => { authFetch('/setup/gaps').then(d => { setGaps(d); setLoading(false) }) }, [])

  const generate = async (docKey: string) => {
    setGenerating(docKey); setMsg(null)
    try {
      const res = await authFetch(`/setup/generate/${docKey}`, { method: 'POST' })
      if (res.asset) { setGenerated((g: Record<string,any>) => ({ ...g, [docKey]: res })); setMsg({ type: 'success', text: `✓ تم توليد "${res.asset.nameAr}" وحفظه في المستودع` }) }
      else setMsg({ type: 'error', text: res.message || 'فشل التوليد' })
    } finally { setGenerating(null) }
  }

  if (loading) return <div style={{ fontSize: 12, color: '#aaa' }}>⟳ جاري فحص الفجوات...</div>

  return (
    <div>
      {/* Gap summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', borderRadius: 4 }}>
          <div style={{ color: '#888', fontSize: 10 }}>إجمالي الفجوات</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#00b4d8' }}>{gaps?.total || 0}</div>
        </div>
        <div style={{ padding: '8px 14px', background: 'rgba(231,76,60,0.08)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 4 }}>
          <div style={{ color: '#888', fontSize: 10 }}>حرجة</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e74c3c' }}>{gaps?.critical || 0}</div>
        </div>
        <div style={{ padding: '8px 14px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 4 }}>
          <div style={{ color: '#888', fontSize: 10 }}>تم التوليد</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2ecc71' }}>{Object.keys(generated).length}</div>
        </div>
      </div>

      {gaps?.total === 0 && <div style={{ padding: '10px 14px', background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 4, fontSize: 12, color: '#2ecc71', marginBottom: 14 }}>✓ جميع الوثائق التأسيسية موجودة في المستودع</div>}

      {msg && <div style={{ padding: '6px 10px', borderRadius: 4, background: msg.type === 'success' ? 'rgba(46,204,113,0.12)' : 'rgba(231,76,60,0.12)', color: msg.type === 'success' ? '#2ecc71' : '#e74c3c', fontSize: 11, marginBottom: 10 }}>{msg.text}</div>}

      {/* Gap list */}
      {(gaps?.gaps || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 280, overflowY: 'auto' }}>
          {(gaps.gaps).map((g: any) => {
            const done = !!generated[g.key]
            return (
              <div key={g.key} style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${done ? 'rgba(46,204,113,0.3)' : impColor(g.importance) + '22'}`, borderLeft: `3px solid ${done ? '#2ecc71' : impColor(g.importance)}`, borderRadius: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{done ? '✅' : '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#eee' }}>{g.titleAr}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{g.whyItMatters}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    {done && <button onClick={() => setPreview(generated[g.key]?.content)} style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid #444', borderRadius: 2, cursor: 'pointer', color: '#ccc' }}>معاينة</button>}
                    {!done && <button onClick={() => generate(g.key)} disabled={generating === g.key} style={{ fontSize: 9, padding: '2px 10px', background: 'rgba(0,180,216,0.12)', border: '1px solid #00b4d8', borderRadius: 2, cursor: 'pointer', color: '#00b4d8' }}>
                      {generating === g.key ? '⟳ جاري...' : '⚡ توليد'}
                    </button>}
                    {!done && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${impColor(g.importance)}18`, color: impColor(g.importance) }}>{g.importance === 'CRITICAL' ? 'حرجة' : 'عالية'}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ padding: 10, background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 4, fontSize: 10, color: '#aaa', marginBottom: 14 }}>
        ⚠ الوثائق المولّدة تُحفظ في <strong style={{ color: '#f39c12' }}>مستودع البنية المؤسسية</strong> وليس قاعدة المعرفة
      </div>

      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>

      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: '#1a2035', border: '1px solid #333', borderRadius: 8, padding: 20, width: '80%', maxHeight: '80vh', overflow: 'auto', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#eee' }}>معاينة الوثيقة</div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#888' }}>✕</button>
            </div>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.8, color: '#ddd' }}>{preview}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Step 3: KB Setup with availability ───────────────────────────────────────
function Step3KB({ onNext }: any) {
  const [config, setConfig] = useState<any>(null)
  const [kbDocs, setKbDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([authFetch('/setup/config'), authFetch('/knowledge/documents?limit=50')]).then(([c, docs]) => {
      setConfig(c)
      setKbDocs(Array.isArray(docs) ? docs : docs?.documents || docs?.items || [])
    }).finally(() => setLoading(false))
  }, [])

  const isAvailable = (docKey: string, docLabel: string) => {
    const keywords = docLabel.toLowerCase().split(' ').filter(w => w.length > 3)
    return kbDocs.some(d => keywords.some(kw => (d.name || d.title || '').toLowerCase().includes(kw)))
  }

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(0,180,216,0.07)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#ddd' }}>
        <strong style={{ color: '#00b4d8' }}>📚 قاعدة المعرفة:</strong> وثائق مرجعية مشتركة — منهجيات، معايير، لوائح تنظيمية. <strong>ليست</strong> خاصة بمنظمتك.
      </div>
      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>⟳ جاري التحقق...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {(config?.requiredKbDocs || []).map((doc: any) => {
            const available = isAvailable(doc.key, doc.label)
            return (
              <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${available ? 'rgba(46,204,113,0.3)' : '#333'}`, borderRadius: 4 }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{available ? '✅' : doc.required ? '⭐' : '📄'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#eee' }}>{doc.labelAr}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{doc.label} · {doc.category}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: available ? 'rgba(46,204,113,0.12)' : doc.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: available ? '#2ecc71' : doc.required ? '#e74c3c' : '#888' }}>
                    {available ? 'متاح ✓' : doc.required ? 'مطلوب' : 'اختياري'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/knowledge', '_blank')}>🔗 رفع وثائق المرجعية</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// ── Step 4: Repo Setup with availability ─────────────────────────────────────
function Step4Repo({ onNext }: any) {
  const [config, setConfig] = useState<any>(null)
  const [repoAssets, setRepoAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([authFetch('/setup/config'), authFetch('/ea-repository/assets?limit=50')]).then(([c, assets]) => {
      setConfig(c)
      setRepoAssets(Array.isArray(assets) ? assets : assets?.assets || assets?.items || [])
    }).finally(() => setLoading(false))
  }, [])

  const isAvailable = (assetKey: string, label: string, domain: string) => {
    const keywords = label.toLowerCase().split(' ').filter(w => w.length > 3)
    return repoAssets.some(a => {
      const nameMatch = keywords.some(kw => (a.name || a.nameAr || '').toLowerCase().includes(kw))
      const domainMatch = a.domain === domain
      return nameMatch || (domainMatch && keywords.some(kw => (a.assetType || '').toLowerCase().includes(kw)))
    })
  }

  return (
    <div>
      <div style={{ padding: 10, background: 'rgba(243,156,18,0.07)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#ddd' }}>
        <strong style={{ color: '#f39c12' }}>🗄 مستودع البنية المؤسسية:</strong> أصول معمارية خاصة بمنظمتك — استراتيجية، خرائط، أنظمة، بيانات.
      </div>
      {loading ? <div style={{ fontSize: 12, color: '#aaa' }}>⟳ جاري التحقق...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
          {(config?.requiredRepoAssets || []).map((asset: any) => {
            const available = isAvailable(asset.key, asset.label, asset.domain)
            return (
              <div key={asset.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${available ? 'rgba(46,204,113,0.3)' : '#333'}`, borderRadius: 4 }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{available ? '✅' : asset.required ? '⭐' : '📋'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#eee' }}>{asset.labelAr}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{asset.label} · {asset.domain}</div>
                </div>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, flexShrink: 0, background: available ? 'rgba(46,204,113,0.12)' : asset.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: available ? '#2ecc71' : asset.required ? '#e74c3c' : '#888' }}>
                  {available ? 'متاح ✓' : asset.required ? 'مطلوب' : 'اختياري'}
                </span>
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/repository', '_blank')}>🔗 رفع أصول المنظمة</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// ── Step 5: Readiness Scores ──────────────────────────────────────────────────
function Step5Readiness({ onNext }: any) {
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
        <div style={{ fontSize: 42, fontWeight: 700, color: SCORE_COLOR(r?.overall || 0) }}>{r?.overall || 0}%</div>
        <div style={{ fontSize: 13, color: '#aaa' }}>مؤشر الجاهزية الإجمالي</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {scores.map(({ label, icon, data }) => (
          <div key={label} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid #2a3550', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScoreRing score={data?.score || 0} label={data?.label || ''} />
            <div>
              <div style={{ fontSize: 13, color: '#eee' }}>{icon} {label}</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>
                {data?.docs !== undefined && `${data.docs} وثيقة`}
                {data?.assets !== undefined && `${data.assets} أصل`}
                {data?.cycles !== undefined && `${data.cycles} دورة`}
                {data?.govAssets !== undefined && `${data.govAssets} أصل`}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>الخطوات التالية →</button>
    </div>
  )
}

// ── Step 6: Next Actions ──────────────────────────────────────────────────────
function Step6Actions({ onComplete }: any) {
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
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid #2a3550', borderRadius: 6 }}>
              <span style={{ fontSize: 20 }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#eee' }}>{a.titleAr}</div>
                <div style={{ fontSize: 10, color: '#888' }}>{a.titleEn}</div>
              </div>
              <button onClick={() => window.location.href = routes[a.type] || '/'} style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(0,180,216,0.1)', border: '1px solid #00b4d8', borderRadius: 2, cursor: 'pointer', color: '#00b4d8' }}>انتقال</button>
            </div>
          ))}
          {(!data?.actions || data.actions.length === 0) && (
            <div style={{ padding: '12px 14px', background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.2)', borderRadius: 6, color: '#2ecc71', fontSize: 12 }}>
              ✓ المنصة جاهزة — يمكنك البدء بأول دورة ADM
            </div>
          )}
        </div>
      )}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onComplete}>✓ إتمام الإعداد</button>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SetupAssistantPage({ modal = false, onClose }: { modal?: boolean; onClose?: () => void }) {
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
    background: '#0f1623',
    border: '1px solid #1e2d45', borderRadius: 12, padding: 28,
    boxShadow: '0 30px 70px rgba(0,0,0,0.9)',
  } : { padding: 24, maxWidth: 720 }

  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        {modal && onClose && (
          <button onClick={onClose} style={{ position: 'absolute' as const, top: 14, left: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid #2a3550', borderRadius: 4, cursor: 'pointer', fontSize: 14, color: '#888', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        )}
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#eee', marginBottom: 4 }}>🏛 مساعد إعداد البنية المؤسسية</div>
          <div style={{ fontSize: 11, color: '#666' }}>EA Readiness Setup Assistant</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 22, overflowX: 'auto', paddingBottom: 4 }}>
          {STEPS.map(s => (
            <button key={s.id} onClick={() => setStep(s.id)} style={{ flexShrink: 0, padding: '5px 8px', borderRadius: 6, border: `1px solid ${step === s.id ? '#00b4d8' : '#1e2d45'}`, background: step === s.id ? 'rgba(0,180,216,0.15)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 60 }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <span style={{ fontSize: 7, color: step === s.id ? '#00b4d8' : '#555', whiteSpace: 'nowrap' }}>{s.titleAr}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid #1e2d45', borderRadius: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, color: '#eee' }}>
            <span>{STEPS[step - 1]?.icon}</span>
            <span>{STEPS[step - 1]?.titleAr}</span>
            <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>— {STEPS[step - 1]?.titleEn}</span>
          </div>
          {step === 1 && <Step1Profile profile={profile} config={config} onSave={() => setStep(2)} />}
          {step === 2 && <Step2GapsAndGeneration onNext={() => setStep(3)} />}
          {step === 3 && <Step3KB onNext={() => setStep(4)} />}
          {step === 4 && <Step4Repo onNext={() => setStep(5)} />}
          {step === 5 && <Step5Readiness onNext={() => setStep(6)} />}
          {step === 6 && <Step6Actions onComplete={complete} />}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11, color: '#444' }}>
          <span>الخطوة {step} من {STEPS.length}</span>
          {completed && <span style={{ color: '#2ecc71' }}>✓ تم الإعداد</span>}
        </div>
      </div>
    </div>
  )
}
