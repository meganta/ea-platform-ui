import React, { useState, useEffect } from 'react'

const S_LOCAL = {
  card: { background: 'var(--navy-mid)', borderRadius: 10, padding: 16, marginBottom: 16 },
  btn: (v: 'primary'|'secondary'|'danger' = 'secondary') => ({ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', background: v === 'primary' ? 'var(--accent)' : v === 'danger' ? '#e74c3c22' : 'var(--navy-light)', color: v === 'primary' ? '#fff' : v === 'danger' ? '#e74c3c' : 'var(--text)' }),
  input: { width: '100%', padding: '7px 10px', background: 'var(--navy)', border: '1px solid var(--navy-light)', borderRadius: 8, color: 'var(--text)', fontSize: 12, outline: 'none' },
}

// Spec section 71: "Architecture Reviews should be able to embed or
// reference Views... Saved snapshot can preserve evidence at review
// time." Attaches at the review level (not per-finding in this round -
// the backend supports findingId scoping, a per-finding UI is a natural
// follow-up but a separate, smaller addition once this base flow is in
// place). Uses this page's own raw fetch(apiUrl, token) convention
// rather than the shared api helper used elsewhere in this app, to stay
// consistent with the rest of GovernancePage.tsx/ReportView, which
// already does the same.
export function AttachedViewsPanel({ reviewId, apiUrl, token, isAR }: { reviewId: string; apiUrl: string; token: () => string; isAR: boolean }) {
  const [attachments, setAttachments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPicker, setShowPicker] = useState(false)
  const [availableViews, setAvailableViews] = useState<any[]>([])
  const [selectedViewId, setSelectedViewId] = useState('')
  const [note, setNote] = useState('')
  const [attaching, setAttaching] = useState(false)

  const load = () => {
    setLoading(true)
    fetch(`${apiUrl}/governance/reviews/${reviewId}/attached-views`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((d: any) => setAttachments(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [reviewId]) // eslint-disable-line react-hooks/exhaustive-deps

  const openPicker = () => {
    setShowPicker(true)
    fetch(`${apiUrl}/ea-views`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((d: any) => setAvailableViews(Array.isArray(d) ? d : []))
  }

  const attach = async () => {
    if (!selectedViewId) return
    setAttaching(true)
    try {
      await fetch(`${apiUrl}/governance/reviews/${reviewId}/attached-views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ viewId: selectedViewId, note: note.trim() || undefined }),
      })
      setShowPicker(false)
      setSelectedViewId('')
      setNote('')
      load()
    } finally {
      setAttaching(false)
    }
  }

  const detach = async (attachmentId: string) => {
    if (!window.confirm(isAR ? 'إزالة هذا المرفق؟' : 'Remove this attached view?')) return
    await fetch(`${apiUrl}/governance/reviews/${reviewId}/attached-views/${attachmentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token()}` } })
    load()
  }

  if (loading) return null // avoids a flash of an empty-state card on initial load - the section simply appears once data is ready, same as this page's other sections

  return (
    <div style={S_LOCAL.card}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>🗺 {isAR ? 'عروض العمارة المرفقة' : 'Attached Architecture Views'}</div>
        <button style={{ ...S_LOCAL.btn('primary'), marginLeft: 'auto' }} onClick={openPicker}>+ {isAR ? 'إرفاق عرض' : 'Attach View'}</button>
      </div>

      {showPicker && (
        <div style={{ background: 'var(--navy)', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <select style={{ ...S_LOCAL.input, marginBottom: 8 }} value={selectedViewId} onChange={e => setSelectedViewId(e.target.value)}>
            <option value="">{isAR ? 'اختر عرضاً...' : 'Select a view...'}</option>
            {availableViews.map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <input style={{ ...S_LOCAL.input, marginBottom: 8 }} value={note} onChange={e => setNote(e.target.value)} placeholder={isAR ? 'ملاحظة اختيارية' : 'Optional note'} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S_LOCAL.btn('primary')} disabled={!selectedViewId || attaching} onClick={attach}>{attaching ? '...' : (isAR ? 'إرفاق' : 'Attach')}</button>
            <button style={S_LOCAL.btn()} onClick={() => setShowPicker(false)}>{isAR ? 'إلغاء' : 'Cancel'}</button>
          </div>
        </div>
      )}

      {attachments.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{isAR ? 'لا توجد عروض مرفقة بعد.' : 'No architecture views attached yet.'}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
          {attachments.map((a: any) => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 6, background: 'var(--navy)' }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: a.snapshotId ? '#9b59b622' : '#3498db22', color: a.snapshotId ? '#9b59b6' : '#3498db' }}>
                {a.snapshotId ? (isAR ? 'لقطة' : 'Snapshot') : (isAR ? 'حي' : 'Live')}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12 }}>{a.view?.name || a.snapshot?.name || '(deleted)'}</div>
                {a.note && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.note}</div>}
              </div>
              <button style={S_LOCAL.btn('danger')} onClick={() => detach(a.id)}>{isAR ? 'إزالة' : 'Remove'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
