import { useLang } from '../../contexts/LangContext'
import { useState, useEffect } from 'react'
import HelpTip from '../../components/HelpTip'
import { authFetch } from './shared'

export default function GovernanceSettingsPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('Governance', 'الحوكمة')}</div>
        <div className="page-subtitle">{L('REVIEW WORKFLOW & APPROVAL SETTINGS', 'سير عمل المراجعة وإعدادات الاعتماد')}</div>
      </div>
      <div className="page-body" style={{ maxWidth: 720 }}>
        <div className="card">
          <GovernanceSection />
        </div>
      </div>
    </div>
  )
}

function GovernanceSection() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [form, setForm] = useState({ requireApprovalForPublish: true, reviewerApprovalRequired: false, minReviewers: 1, autoApproveAfterDays: 0, approvalNotifyEmail: '', governanceMode: 'STANDARD' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const g = c.ai?.governance || {}; setForm(f => ({ ...f, ...g })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/governance-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: L('Governance settings saved', 'تم حفظ إعدادات الحوكمة') })
      else setMsg({ type: 'error', text: L('Failed to save', 'تعذّر الحفظ') })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center' }}>{L('⚖ Governance Settings', '⚖ إعدادات الحوكمة')}<HelpTip text={L('Controls who needs to approve changes to your organization\'s architecture before they become official, and how many reviewers are required.', 'يحدد من يلزم اعتماده للتغييرات على بنية جهتك قبل أن تصبح رسمية، وعدد المراجعين المطلوب.')} /></div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{L('Configure architecture governance workflows and approval thresholds', 'تكوين سير عمل حوكمة البنية وحدود الاعتماد')}</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Governance Mode', 'وضع الحوكمة')}</div>
            <select className="form-input" value={form.governanceMode} onChange={e => setForm(f => ({ ...f, governanceMode: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="OPEN">{L('Open — No approval required', 'مفتوح — لا يلزم اعتماد')}</option>
              <option value="STANDARD">{L('Standard — Architect approval', 'قياسي — اعتماد المعماري')}</option>
              <option value="STRICT">{L('Strict — Admin approval required', 'صارم — يلزم اعتماد المدير')}</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Minimum Reviewers', 'الحد الأدنى للمراجعين')}</div>
            <input type="number" className="form-input" min={1} max={5} value={form.minReviewers} onChange={e => setForm(f => ({ ...f, minReviewers: Number(e.target.value) }))} style={{ fontSize: 11, width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Auto-approve After (days, 0 = disabled)', 'الاعتماد التلقائي بعد (أيام، 0 = معطّل)')}</div>
            <input type="number" className="form-input" min={0} max={30} value={form.autoApproveAfterDays} onChange={e => setForm(f => ({ ...f, autoApproveAfterDays: Number(e.target.value) }))} style={{ fontSize: 11, width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Governance Notification Email', 'بريد إشعارات الحوكمة')}</div>
            <input type="email" className="form-input" value={form.approvalNotifyEmail} onChange={e => setForm(f => ({ ...f, approvalNotifyEmail: e.target.value }))} placeholder="governance@organization.gov.sa" style={{ fontSize: 11, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['requireApprovalForPublish', L('Require approval before publishing outputs', 'اشتراط الاعتماد قبل نشر المخرجات')], ['reviewerApprovalRequired', L('Require reviewer sign-off in addition to architect', 'اشتراط اعتماد المراجع إضافة إلى المعماري')]].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? L('Saving...', 'جارٍ الحفظ...') : L('💾 Save Governance Settings', '💾 حفظ إعدادات الحوكمة')}</button>
      </div>
    </div>
  )
}

