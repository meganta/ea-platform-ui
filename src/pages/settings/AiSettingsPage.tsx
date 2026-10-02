import { useEffect, useState } from 'react'
import { useLang } from '../../contexts/LangContext'
import HelpTip from '../../components/HelpTip'
import { authFetch } from './shared'

export default function AiSettingsPage() {
  const { setLocale, isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ai, setAi] = useState({ provider: 'openai', model: 'gpt-4o', language: 'EN' })

  useEffect(() => {
    authFetch('/config').then(c => setAi(c.ai || { provider: 'openai', model: 'gpt-4o', language: 'EN' })).finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      await authFetch('/config/ai', { method: 'PUT', body: JSON.stringify(ai) })
      setMsg({ type: 'success', text: L('AI configuration saved', 'تم حفظ إعدادات الذكاء الاصطناعي') })
      if (ai.language === 'AR' || ai.language === 'EN') setLocale(ai.language as 'AR' | 'EN')
    } catch (e: any) {
      setMsg({ type: 'error', text: e.message || L('Failed to save', 'تعذّر الحفظ') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('AI & Copilot', 'الذكاء الاصطناعي والمساعد')}</div>
        <div className="page-subtitle">{L('PROVIDER, MODEL & RESPONSE LANGUAGE', 'المزوّد والنموذج ولغة الرد')}</div>
      </div>
      <div className="page-body" style={{ maxWidth: 720 }}>
        {msg && (
          <div style={{ padding: '10px 16px', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 13, background: msg.type === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', border: `1px solid ${msg.type === 'success' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <button onClick={() => setMsg(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
          </div>
        )}
        <div className="card">
          <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>{L('🤖 AI Configuration', '🤖 إعدادات الذكاء الاصطناعي')}<HelpTip text={L('Controls which AI service powers features like governance reviews and the copilot. Unless you have a specific reason to change this, the default setting works well - this is mainly for administrators.', 'يحدد خدمة الذكاء الاصطناعي التي تشغّل ميزات مثل مراجعات الحوكمة والمساعد الذكي. ما لم يكن لديك سبب محدد لتغييره، فالإعداد الافتراضي مناسب — وهذا مخصص أساساً للمسؤولين.')} /></div>
          <div className="form-group">
            <label className="form-label">{L('AI Provider', 'مزوّد الذكاء الاصطناعي')}</label>
            <select className="form-input" value={ai.provider} onChange={e => setAi(a => ({ ...a, provider: e.target.value }))}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic Claude</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Language Model', 'النموذج اللغوي')}</label>
            <select className="form-input" value={ai.model} onChange={e => setAi(a => ({ ...a, model: e.target.value }))}>
              <option value="gpt-4o">{L('GPT-4o (Recommended)', 'GPT-4o (موصى به)')}</option>
              <option value="gpt-4o-mini">{L('GPT-4o Mini (Faster)', 'GPT-4o Mini (أسرع)')}</option>
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">{L('Preferred Response Language', 'لغة الرد المفضلة')}</label>
            <select className="form-input" value={ai.language} onChange={e => setAi(a => ({ ...a, language: e.target.value }))}>
              <option value="EN">{L('English', 'الإنجليزية')}</option>
              <option value="AR">{L('Arabic', 'العربية')}</option>
              <option value="BILINGUAL">{L('Bilingual (EN + AR)', 'ثنائي اللغة (الإنجليزية والعربية)')}</option>
            </select>
          </div>
          <div className="alert alert-info" style={{ marginTop: 16 }}>
            {ai.language === 'AR'
              ? L('AI responses will be in Arabic by default. Users can still switch language in the Copilot.', 'ستكون ردود الذكاء الاصطناعي بالعربية افتراضياً، ويمكن للمستخدمين تغيير اللغة في المساعد الذكي.')
              : ai.language === 'BILINGUAL'
                ? L('AI responses will be in both Arabic and English by default. Users can still switch language in the Copilot.', 'ستكون ردود الذكاء الاصطناعي بالعربية والإنجليزية افتراضياً، ويمكن للمستخدمين تغيير اللغة في المساعد الذكي.')
                : L('AI responses will be in English by default. Users can still switch language in the Copilot.', 'ستكون ردود الذكاء الاصطناعي بالإنجليزية افتراضياً، ويمكن للمستخدمين تغيير اللغة في المساعد الذكي.')}
          </div>
          <button className="btn btn-primary mt-4" disabled={saving} onClick={save}>
            {saving ? L('Saving...', 'جارٍ الحفظ...') : L('Save AI Configuration', 'حفظ إعدادات الذكاء الاصطناعي')}
          </button>
        </div>
      </div>
    </div>
  )
}
