import { useLang } from '../../contexts/LangContext'
import { useState, useEffect } from 'react'
import { authFetch } from './shared'

export default function KnowledgeBaseSettingsPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('Knowledge Base', 'قاعدة المعرفة')}</div>
        <div className="page-subtitle">{L('RAG RETRIEVAL CONFIGURATION', 'إعدادات الاسترجاع (RAG)')}</div>
      </div>
      <div className="page-body" style={{ maxWidth: 720 }}>
        <div className="card">
          <RagKbSection />
        </div>
      </div>
    </div>
  )
}

function RagKbSection() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ragEnabled, setRagEnabled] = useState(false)
  const [retrievalLimit, setRetrievalLimit] = useState(8)
  const [minRelevanceScore, setMinRelevanceScore] = useState(0.3)
  const [includeRepoAssets, setIncludeRepoAssets] = useState(true)
  const [includeKbDocs, setIncludeKbDocs] = useState(true)
  const [excludeAdmOutputs, setExcludeAdmOutputs] = useState(false)

  const load = () => {
    setLoading(true)
    authFetch('/config').then(c => {
      const ai = c.ai || {}
      setRagEnabled(!!ai.RAG_GENERATION)
      const rag = ai.ragConfig || {}
      setRetrievalLimit(rag.retrievalLimit || 8)
      setMinRelevanceScore(rag.minRelevanceScore || 0.3)
      setIncludeRepoAssets(rag.includeRepoAssets !== false)
      setIncludeKbDocs(rag.includeKbDocs !== false)
      setExcludeAdmOutputs(!!rag.excludeAdmOutputs)
    }).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/rag', {
        method: 'PUT',
        body: JSON.stringify({
          ragEnabled,
          ragConfig: { retrievalLimit, minRelevanceScore, includeRepoAssets, includeKbDocs, excludeAdmOutputs },
        }),
      })
      if (res.message) setMsg({ type: 'success', text: L('Knowledge Base settings saved', 'تم حفظ إعدادات قاعدة المعرفة') })
      else setMsg({ type: 'error', text: res.message || L('Failed to save', 'تعذّر الحفظ') })
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{L('Loading...', 'جارٍ التحميل...')}</div>

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>{L('🧠 Knowledge Base & RAG Settings', '🧠 إعدادات قاعدة المعرفة والاسترجاع المعزز (RAG)')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>
        {L('Configure how the AI uses the Knowledge Base during architecture generation. RAG (Retrieval-Augmented Generation) pulls relevant content from uploaded documents and EA repository assets.', 'حدّد كيف يستخدم الذكاء الاصطناعي قاعدة المعرفة أثناء إنشاء مخرجات البنية. يجلب الإنشاء المعزز بالاسترجاع (RAG) المحتوى ذا الصلة من الوثائق المرفوعة وأصول مستودع البنية المؤسسية.')}
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}

      {/* RAG Toggle */}
      <div style={{ padding: 16, background: 'var(--navy)', border: `1px solid ${ragEnabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{L('RAG Generation', 'الإنشاء المعزز بالاسترجاع')}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{L('When enabled, the AI retrieves relevant content from your Knowledge Base before generating each output section', 'عند التفعيل، يسترجع الذكاء الاصطناعي المحتوى ذا الصلة من قاعدة معرفتك قبل إنشاء كل قسم من المخرجات')}</div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexShrink: 0 }}>
            <div style={{ position: 'relative', width: 44, height: 24 }} onClick={() => setRagEnabled(r => !r)}>
              <div style={{ position: 'absolute', inset: 0, background: ragEnabled ? 'var(--accent)' : 'var(--border)', borderRadius: 12, transition: 'background 0.2s' }} />
              <div style={{ position: 'absolute', top: 3, left: ragEnabled ? 22 : 3, width: 18, height: 18, background: 'white', borderRadius: 9, transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: ragEnabled ? 'var(--accent)' : 'var(--text-dim)' }}>{ragEnabled ? L('Enabled', 'مفعّل') : L('Disabled', 'معطّل')}</span>
          </label>
        </div>
      </div>

      {/* Retrieval params */}
      <div style={{ padding: 16, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 12, opacity: ragEnabled ? 1 : 0.5, pointerEvents: ragEnabled ? 'all' : 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{L('Retrieval Parameters', 'معايير الاسترجاع')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>{L('Retrieval Limit', 'حد الاسترجاع')} <span style={{ color: 'var(--text-dim)' }}>{L('(chunks per generation)', '(أجزاء لكل عملية إنشاء)')}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={1} max={20} value={retrievalLimit} onChange={e => setRetrievalLimit(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 24, textAlign: 'center' }}>{retrievalLimit}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{L('Higher = more context, slower generation. Recommended: 6–10', 'القيمة الأعلى = سياق أكثر وإنشاء أبطأ. الموصى به: 6–10')}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 4 }}>{L('Minimum Relevance Score', 'الحد الأدنى لدرجة الصلة')} <span style={{ color: 'var(--text-dim)' }}>(0.0–1.0)</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="range" min={0} max={1} step={0.05} value={minRelevanceScore} onChange={e => setMinRelevanceScore(Number(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', width: 32, textAlign: 'center' }}>{minRelevanceScore.toFixed(2)}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{L('Higher = stricter matching, fewer but more relevant chunks. Recommended: 0.25–0.40', 'القيمة الأعلى = مطابقة أدق وأجزاء أقل لكنها أكثر صلة. الموصى به: 0.25–0.40')}</div>
          </div>
        </div>
      </div>

      {/* Source filters */}
      <div style={{ padding: 16, background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, opacity: ragEnabled ? 1 : 0.5, pointerEvents: ragEnabled ? 'all' : 'none' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{L('Retrieval Sources', 'مصادر الاسترجاع')}</div>
        {[
          { label: L('Include Knowledge Base Documents', 'تضمين وثائق قاعدة المعرفة'), desc: L('Uploaded files and documents indexed in the KB', 'الملفات والوثائق المرفوعة والمفهرسة في قاعدة المعرفة'), val: includeKbDocs, set: setIncludeKbDocs },
          { label: L('Include EA Repository Assets', 'تضمين أصول مستودع البنية المؤسسية'), desc: L('Architecture assets promoted to the EA repository', 'أصول البنية التي رُفعت إلى مستودع البنية المؤسسية'), val: includeRepoAssets, set: setIncludeRepoAssets },
          { label: L('Exclude ADM Outputs', 'استبعاد مخرجات ADM'), desc: L('Prevent previously generated outputs from being retrieved (avoids circular references)', 'منع استرجاع المخرجات المُنشأة سابقاً (لتجنب المراجع الدائرية)'), val: excludeAdmOutputs, set: setExcludeAdmOutputs },
        ].map(({ label, desc, val, set }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{desc}</div>
            </div>
            <label style={{ cursor: 'pointer', flexShrink: 0, marginLeft: 12 }}>
              <div style={{ position: 'relative', width: 36, height: 20 }} onClick={() => set((s: boolean) => !s)}>
                <div style={{ position: 'absolute', inset: 0, background: val ? 'var(--accent)' : 'var(--border)', borderRadius: 10, transition: 'background 0.2s' }} />
                <div style={{ position: 'absolute', top: 2, left: val ? 18 : 2, width: 16, height: 16, background: 'white', borderRadius: 8, transition: 'left 0.2s' }} />
              </div>
            </label>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ fontSize: 12 }} disabled={saving} onClick={save}>
        {saving ? L('Saving...', 'جارٍ الحفظ...') : L('💾 Save Knowledge Base Settings', '💾 حفظ إعدادات قاعدة المعرفة')}
      </button>
    </div>
  )
}
