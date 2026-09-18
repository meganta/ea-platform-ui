import { useState, useEffect } from 'react'
import HelpTip from '../../components/HelpTip'
import { authFetch } from './shared'

export default function GovernanceSettingsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="page-title">Governance</div>
        <div className="page-subtitle">REVIEW WORKFLOW & APPROVAL SETTINGS</div>
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
      if (res.message) setMsg({ type: 'success', text: 'Governance settings saved' })
      else setMsg({ type: 'error', text: 'Failed to save' })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center' }}>⚖ Governance Settings<HelpTip text="Controls who needs to approve changes to your organization's architecture before they become official, and how many reviewers are required." /></div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>Configure architecture governance workflows and approval thresholds</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Governance Mode</div>
            <select className="form-input" value={form.governanceMode} onChange={e => setForm(f => ({ ...f, governanceMode: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="OPEN">Open — No approval required</option>
              <option value="STANDARD">Standard — Architect approval</option>
              <option value="STRICT">Strict — Admin approval required</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Minimum Reviewers</div>
            <input type="number" className="form-input" min={1} max={5} value={form.minReviewers} onChange={e => setForm(f => ({ ...f, minReviewers: Number(e.target.value) }))} style={{ fontSize: 11, width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Auto-approve After (days, 0 = disabled)</div>
            <input type="number" className="form-input" min={0} max={30} value={form.autoApproveAfterDays} onChange={e => setForm(f => ({ ...f, autoApproveAfterDays: Number(e.target.value) }))} style={{ fontSize: 11, width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>Governance Notification Email</div>
            <input type="email" className="form-input" value={form.approvalNotifyEmail} onChange={e => setForm(f => ({ ...f, approvalNotifyEmail: e.target.value }))} placeholder="governance@organization.gov.sa" style={{ fontSize: 11, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['requireApprovalForPublish', 'Require approval before publishing outputs'], ['reviewerApprovalRequired', 'Require reviewer sign-off in addition to architect']].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? 'Saving...' : '💾 Save Governance Settings'}</button>
      </div>
    </div>
  )
}

