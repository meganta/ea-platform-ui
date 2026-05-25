import { useEffect, useState, useCallback } from 'react'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'
const authFetch = (path: string, opts: any = {}) =>
  fetch(`${API_URL}${path}`, { ...opts, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } }).then(r => r.json())

const STEPS = [
  { id: 1, icon: '🏢', titleAr: 'ملف المنظمة', titleEn: 'Organization Profile' },
  { id: 2, icon: '📚', titleAr: 'قاعدة المعرفة', titleEn: 'Knowledge Base Setup' },
  { id: 3, icon: '🗄', titleAr: 'مستودع البنية المؤسسية', titleEn: 'EA Repository Setup' },
  { id: 4, icon: '🤖', titleAr: 'تصنيف المحتوى', titleEn: 'AI Classification' },
  { id: 5, icon: '🔍', titleAr: 'اكتشاف الفجوات', titleEn: 'Gap Detection' },
  { id: 6, icon: '⚡', titleAr: 'توليد الوثائق التأسيسية', titleEn: 'Foundation Generation' },
  { id: 7, icon: '📊', titleAr: 'مؤشر الجاهزية', titleEn: 'Readiness Score' },
  { id: 8, icon: '🚀', titleAr: 'الخطوات التالية', titleEn: 'Next Actions' },
]

const SCORE_COLOR = (s: number) => s >= 80 ? '#2ecc71' : s >= 60 ? '#3498db' : s >= 40 ? '#f39c12' : s >= 20 ? '#e67e22' : '#e74c3c'
const SCORE_BG = (s: number) => `${SCORE_COLOR(s)}18`

function ScoreRing({ score, label }: { score: number; label: string }) {
  const r = 28; const c = 2 * Math.PI * r
  const dash = (score / 100) * c
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={36} cy={36} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
        <circle cx={36} cy={36} r={r} fill="none" stroke={SCORE_COLOR(score)} strokeWidth={6}
          strokeDasharray={`${dash} ${c}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.5s' }} />
        <text x={36} y={40} textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: '36px 36px', fill: SCORE_COLOR(score), fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{score}%</text>
      </svg>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>{label}</div>
    </div>
  )
}

// ── Step 1: Organization Profile ─────────────────────────────────────────────
function Step1Profile({ profile, onSave }: any) {
  const [form, setForm] = useState({
    organizationName: '', organizationNameAr: '', sector: 'GOVERNMENT',
    entityType: 'AUTHORITY', language: 'AR', eaMaturityLevel: 1,
    preferredFramework: 'NORA', domainsInScope: ['BUSINESS', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY'],
    ...profile,
  })
  const [saving, setSaving] = useState(false)
  const domains = ['BUSINESS', 'BENEFICIARY_EXPERIENCE', 'APPLICATIONS', 'DATA', 'TECHNOLOGY', 'SECURITY']
  const toggle = (d: string) => setForm((f: any) => ({ ...f, domainsInScope: f.domainsInScope.includes(d) ? f.domainsInScope.filter((x: string) => x !== d) : [...f.domainsInScope, d] }))

  const save = async () => {
    setSaving(true)
    await authFetch('/setup/profile', { method: 'PUT', body: JSON.stringify({ ...form, setupStep: 2 }) })
    setSaving(false); onSave()
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>أدخل معلومات المنظمة لتخصيص مساعد الإعداد وفقاً لسياقكم</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {[['organizationNameAr', 'اسم المنظمة (عربي)', 'text', true], ['organizationName', 'Organization Name (EN)', 'text', false]].map(([k, l, t, rtl]) => (
          <div key={k as string}>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{l as string}</div>
            <input className="form-input" value={(form as any)[k as string]} onChange={e => setForm((f: any) => ({ ...f, [k as string]: e.target.value }))}
              style={{ width: '100%', fontSize: 11, direction: rtl ? 'rtl' : 'ltr' }} />
          </div>
        ))}
        <div>
          <div style={{ fontSize: 11, marginBottom: 3 }}>القطاع</div>
          <select className="form-input" value={form.sector} onChange={e => setForm((f: any) => ({ ...f, sector: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            {[['GOVERNMENT', 'حكومي'], ['HEALTH', 'صحة'], ['EDUCATION', 'تعليم'], ['FINANCE', 'مالية'], ['UTILITIES', 'خدمات عامة'], ['OTHER', 'أخرى']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3 }}>نوع الجهة</div>
          <select className="form-input" value={form.entityType} onChange={e => setForm((f: any) => ({ ...f, entityType: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            {[['MINISTRY', 'وزارة'], ['AUTHORITY', 'هيئة'], ['ENTERPRISE', 'مؤسسة'], ['SME', 'شركة']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3 }}>مستوى نضج البنية المؤسسية (1-5)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="range" min={1} max={5} value={form.eaMaturityLevel} onChange={e => setForm((f: any) => ({ ...f, eaMaturityLevel: Number(e.target.value) }))} style={{ flex: 1 }} />
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 16 }}>{form.eaMaturityLevel}</span>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{['', 'بدائي', 'متطور', 'محدد', 'مُدار', 'مُحسَّن'][form.eaMaturityLevel]}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, marginBottom: 3 }}>الإطار المرجعي المفضل</div>
          <select className="form-input" value={form.preferredFramework} onChange={e => setForm((f: any) => ({ ...f, preferredFramework: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
            <option value="NORA">NORA 2.0 — المعيار الوطني</option>
            <option value="CUSTOM">مخصص</option>
          </select>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 11, marginBottom: 6 }}>المجالات المعمارية في النطاق</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {domains.map(d => (
            <button key={d} onClick={() => toggle(d)} style={{ fontSize: 10, padding: '4px 10px', borderRadius: 'var(--radius)', border: `1px solid ${form.domainsInScope.includes(d) ? 'var(--accent)' : 'var(--border)'}`, background: form.domainsInScope.includes(d) ? 'rgba(0,180,216,0.12)' : 'transparent', color: form.domainsInScope.includes(d) ? 'var(--accent)' : 'var(--text-dim)', cursor: 'pointer' }}>
              {d.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" style={{ marginTop: 16, fontSize: 12 }} disabled={saving} onClick={save}>{saving ? 'جاري الحفظ...' : 'حفظ والمتابعة →'}</button>
    </div>
  )
}

// ── Step 2: KB Setup ──────────────────────────────────────────────────────────
function Step2KB({ config, onNext }: any) {
  return (
    <div>
      <div style={{ padding: 12, background: 'rgba(0,180,216,0.06)', border: '1px solid rgba(0,180,216,0.2)', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 12 }}>
        <strong>📚 قاعدة المعرفة:</strong> تخزين المعرفة المرجعية المشتركة — منهجيات، معايير، لوائح تنظيمية. <strong>ليست</strong> وثائق خاصة بالمنظمة.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {(config?.requiredKbDocs || []).map((doc: any) => (
          <div key={doc.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <span style={{ fontSize: 16 }}>{doc.required ? '⭐' : '📄'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{doc.labelAr}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{doc.label} · {doc.category}</div>
            </div>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: doc.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: doc.required ? '#e74c3c' : 'var(--text-dim)' }}>{doc.required ? 'مطلوب' : 'اختياري'}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>ارفع هذه الوثائق عبر صفحة <strong>قاعدة المعرفة</strong> ثم عد للمتابعة.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/knowledge', '_blank')}>🔗 الانتقال إلى قاعدة المعرفة</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// ── Step 3: Repo Setup ────────────────────────────────────────────────────────
function Step3Repo({ config, onNext }: any) {
  return (
    <div>
      <div style={{ padding: 12, background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 'var(--radius)', marginBottom: 14, fontSize: 12 }}>
        <strong>🗄 مستودع البنية المؤسسية:</strong> تخزين الأصول المعمارية الخاصة بمنظمتك — الاستراتيجية، الخرائط، الأنظمة. <strong>خاص بمنظمتك فقط.</strong>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {(config?.requiredRepoAssets || []).map((asset: any) => (
          <div key={asset.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <span style={{ fontSize: 16 }}>{asset.required ? '⭐' : '📋'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{asset.labelAr}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{asset.label} · {asset.domain}</div>
            </div>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 2, background: asset.required ? 'rgba(231,76,60,0.1)' : 'rgba(100,100,100,0.1)', color: asset.required ? '#e74c3c' : 'var(--text-dim)' }}>{asset.required ? 'مطلوب' : 'اختياري'}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>ارفع هذه الأصول عبر صفحة <strong>المستودع</strong> ثم عد للمتابعة.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={() => window.open('/repository', '_blank')}>🔗 الانتقال إلى المستودع</button>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
      </div>
    </div>
  )
}

// ── Step 4: AI Classification ─────────────────────────────────────────────────
function Step4Classification({ onNext }: any) {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16 }}>يقوم الذكاء الاصطناعي بتحليل الوثائق المرفوعة وتصنيفها تلقائياً</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
        {[
          ['تصنيف المحتوى', 'تحديد نوع كل وثيقة وفئتها المعمارية', '🏷'],
          ['تحديد الوجهة', 'قاعدة المعرفة أم مستودع البنية المؤسسية؟', '🎯'],
          ['تحديد المجال', 'أعمال، تطبيقات، بيانات، تقنية، أمن', '🗂'],
          ['درجة الثقة', 'مؤشر دقة التصنيف لكل وثيقة', '📊'],
        ].map(([title, desc, icon]) => (
          <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: 12, background: 'rgba(39,174,96,0.06)', border: '1px solid rgba(39,174,96,0.2)', borderRadius: 'var(--radius)', fontSize: 11, marginBottom: 14 }}>
        التصنيف يحدث تلقائياً عند رفع الوثائق — يمكنك مراجعته وتعديله في صفحتي قاعدة المعرفة والمستودع.
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
    </div>
  )
}

// ── Step 5: Gap Detection ─────────────────────────────────────────────────────
function Step5Gaps({ onNext }: any) {
  const [gaps, setGaps] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch('/setup/gaps').then(setGaps).finally(() => setLoading(false))
  }, [])

  const importanceColor = (i: string) => i === 'CRITICAL' ? '#e74c3c' : i === 'HIGH' ? '#f39c12' : '#3498db'

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>تحليل الفجوات في وثائق البنية المؤسسية التأسيسية</div>
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>جاري الفحص...</div> : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ padding: '8px 14px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>إجمالي الفجوات</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{gaps?.total || 0}</div>
            </div>
            <div style={{ padding: '8px 14px', background: 'var(--navy)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 'var(--radius)', fontSize: 12 }}>
              <div style={{ color: 'var(--text-dim)', fontSize: 10 }}>حرجة</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#e74c3c' }}>{gaps?.critical || 0}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, maxHeight: 280, overflowY: 'auto' }}>
            {(gaps?.gaps || []).map((g: any) => (
              <div key={g.key} style={{ padding: '10px 12px', background: 'var(--navy)', border: `1px solid ${importanceColor(g.importance)}22`, borderLeft: `3px solid ${importanceColor(g.importance)}`, borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{g.titleAr}</div>
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 2, background: `${importanceColor(g.importance)}18`, color: importanceColor(g.importance) }}>{g.importance === 'CRITICAL' ? 'حرجة' : 'عالية'}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{g.whyItMatters}</div>
                <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 3 }}>✓ قابلة للتوليد بالذكاء الاصطناعي</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>توليد الوثائق المفقودة →</button>
        </>
      )}
    </div>
  )
}

// ── Step 6: Foundation Generation ────────────────────────────────────────────
function Step6Generation({ onNext }: any) {
  const [gaps, setGaps] = useState<any[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [generated, setGenerated] = useState<Record<string, any>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: string; text: string } | null>(null)

  useEffect(() => {
    authFetch('/setup/gaps').then(d => setGaps(d?.gaps || []))
  }, [])

  const generate = async (docKey: string) => {
    setGenerating(docKey); setMsg(null)
    try {
      const res = await authFetch(`/setup/generate/${docKey}`, { method: 'POST' })
      if (res.asset) {
        setGenerated((g: Record<string, any>) => ({ ...g, [docKey]: res }))
        setMsg({ type: 'success', text: `تم توليد "${res.asset.nameAr}" وحفظه في مستودع البنية المؤسسية` })
      } else setMsg({ type: 'error', text: res.message || 'فشل التوليد' })
    } finally { setGenerating(null) }
  }

  return (
    <div>
      <div style={{ padding: 12, background: 'rgba(243,156,18,0.06)', border: '1px solid rgba(243,156,18,0.2)', borderRadius: 'var(--radius)', fontSize: 11, marginBottom: 14 }}>
        <strong>⚠ ملاحظة مهمة:</strong> الوثائق المولّدة هي أصول معمارية خاصة بمنظمتك — يتم حفظها في <strong>مستودع البنية المؤسسية</strong> وليس قاعدة المعرفة.
      </div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 10, fontSize: 11 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, maxHeight: 320, overflowY: 'auto' }}>
        {gaps.map((g: any) => {
          const done = !!generated[g.key]
          return (
            <div key={g.key} style={{ padding: '10px 12px', background: 'var(--navy)', border: `1px solid ${done ? 'rgba(46,204,113,0.3)' : 'var(--border)'}`, borderRadius: 'var(--radius)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{done ? '✅' : '📄'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{g.titleAr}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{g.domain} · {g.assetType?.replace('_', ' ')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {done && <button onClick={() => setPreview(generated[g.key]?.content)} style={{ fontSize: 9, padding: '2px 8px', background: 'var(--navy-mid)', border: '1px solid var(--border)', borderRadius: 2, cursor: 'pointer', color: 'var(--text)' }}>معاينة</button>}
                  {!done && <button onClick={() => generate(g.key)} disabled={generating === g.key} style={{ fontSize: 9, padding: '2px 8px', background: 'rgba(0,180,216,0.12)', border: '1px solid var(--accent)', borderRadius: 2, cursor: 'pointer', color: 'var(--accent)' }}>
                    {generating === g.key ? '⟳ جاري التوليد...' : '⚡ توليد'}
                  </button>}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, width: '80%', maxHeight: '80vh', overflow: 'auto', direction: 'rtl' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>معاينة الوثيقة</div>
              <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-dim)' }}>✕</button>
            </div>
            <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', lineHeight: 1.8, fontFamily: 'var(--font-arabic, Arial)', color: 'var(--text)' }}>{preview}</pre>
          </div>
        </div>
      )}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>المتابعة →</button>
    </div>
  )
}

// ── Step 7: Readiness Scores ──────────────────────────────────────────────────
function Step7Readiness({ onNext }: any) {
  const [readiness, setReadiness] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch('/setup/readiness').then(setReadiness).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>جاري الحساب...</div>

  const scores = [
    { key: 'kbReadiness', label: 'قاعدة المعرفة', icon: '📚', data: readiness?.kbReadiness },
    { key: 'repoReadiness', label: 'المستودع', icon: '🗄', data: readiness?.repoReadiness },
    { key: 'admReadiness', label: 'دورة ADM', icon: '⚙', data: readiness?.admReadiness },
    { key: 'governanceReadiness', label: 'الحوكمة', icon: '⚖', data: readiness?.governanceReadiness },
  ]

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: SCORE_COLOR(readiness?.overall || 0) }}>{readiness?.overall || 0}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>مؤشر الجاهزية الإجمالي</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {scores.map(({ key, label, icon, data }) => (
          <div key={key} style={{ padding: 14, background: 'var(--navy)', border: `1px solid ${SCORE_BG(data?.score || 0)}`, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <ScoreRing score={data?.score || 0} label={data?.label || ''} />
            <div>
              <div style={{ fontSize: 13 }}>{icon} {label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>
                {data?.docs !== undefined && `${data.docs} وثيقة`}
                {data?.assets !== undefined && `${data.assets} أصل`}
                {data?.cycles !== undefined && `${data.cycles} دورة`}
                {data?.govAssets !== undefined && `${data.govAssets} أصل`}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onNext}>عرض الخطوات التالية →</button>
    </div>
  )
}

// ── Step 8: Next Actions ──────────────────────────────────────────────────────
function Step8Actions({ onComplete }: any) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch('/setup/actions').then(setData).finally(() => setLoading(false))
  }, [])

  const actionRoute: Record<string, string> = {
    UPLOAD_KB: '/knowledge', UPLOAD_REPO: '/repository',
    GENERATE_FOUNDATION: '/setup', START_ADM: '/adm', SETUP_GOVERNANCE: '/settings',
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 14 }}>إليك الخطوات المقترحة لتطوير منظومة البنية المؤسسية</div>
      {loading ? <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>جاري التحليل...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {(data?.actions || []).map((action: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{action.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{action.titleAr}</div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{action.titleEn}</div>
              </div>
              <button onClick={() => window.location.href = actionRoute[action.type] || '/'} style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(0,180,216,0.1)', border: '1px solid var(--accent)', borderRadius: 2, cursor: 'pointer', color: 'var(--accent)' }}>
                انتقال
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onComplete}>إتمام الإعداد ✓</button>
    </div>
  )
}

// ── Main Setup Assistant Page ─────────────────────────────────────────────────
export default function SetupAssistantPage({ modal = false, onClose }: { modal?: boolean; onClose?: () => void }) {
  const [step, setStep] = useState(1)
  const [profile, setProfile] = useState<any>(null)
  const [config, setConfig] = useState<any>(null)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    Promise.all([authFetch('/setup/profile'), authFetch('/setup/config')]).then(([p, c]) => {
      setProfile(p); setConfig(c)
      if (p?.setupStep > 1) setStep(p.setupStep)
      if (p?.setupCompleted) setCompleted(true)
    })
  }, [])

  const complete = async () => {
    await authFetch('/setup/complete', { method: 'PUT' })
    setCompleted(true)
    if (onClose) onClose()
    else window.location.href = '/'
  }

  const wrapper = modal
    ? { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }
    : {}
  const inner = modal
    ? { width: '90%', maxWidth: 680, maxHeight: '90vh', overflow: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24 }
    : { padding: 24, maxWidth: 720 }

  return (
    <div style={wrapper}>
      <div style={inner}>
        {modal && onClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: 16, left: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-dim)' }}>✕</button>
        )}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>🏛 مساعد إعداد البنية المؤسسية</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>EA Readiness Setup Assistant</div>
        </div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
          {STEPS.map(s => (
            <button key={s.id} onClick={() => setStep(s.id)}
              style={{ flexShrink: 0, padding: '6px 10px', borderRadius: 'var(--radius)', border: `1px solid ${step === s.id ? 'var(--accent)' : 'var(--border)'}`, background: step === s.id ? 'rgba(0,180,216,0.12)' : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 64 }}>
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ fontSize: 8, color: step === s.id ? 'var(--accent)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>{s.titleAr}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div style={{ padding: 16, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{STEPS[step - 1]?.icon}</span>
            <span>{STEPS[step - 1]?.titleAr}</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 400 }}>— {STEPS[step - 1]?.titleEn}</span>
          </div>
          {step === 1 && <Step1Profile profile={profile} onSave={() => setStep(2)} />}
          {step === 2 && <Step2KB config={config} onNext={() => setStep(3)} />}
          {step === 3 && <Step3Repo config={config} onNext={() => setStep(4)} />}
          {step === 4 && <Step4Classification onNext={() => setStep(5)} />}
          {step === 5 && <Step5Gaps onNext={() => setStep(6)} />}
          {step === 6 && <Step6Generation onNext={() => setStep(7)} />}
          {step === 7 && <Step7Readiness onNext={() => setStep(8)} />}
          {step === 8 && <Step8Actions onComplete={complete} />}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text-dim)' }}>
          <span>الخطوة {step} من {STEPS.length}</span>
          {completed && <span style={{ color: '#2ecc71' }}>✓ تم الإعداد</span>}
        </div>
      </div>
    </div>
  )
}
