import React, { useState } from 'react'
import HelpTip from './HelpTip'
const API_URL = process.env.REACT_APP_API_URL || 'https://archmindworks.com/api/v1'

export default function GovernanceReviewActions({ reviewId, title, canDelete, isAR, onDeleted }: { reviewId: string; title: string; canDelete: boolean; isAR: boolean; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const text = (en: string, ar: string) => isAR ? ar : en
  const request = async (path: string, method = 'GET') => {
    const response = await fetch(`${API_URL}/governance/reviews/${encodeURIComponent(reviewId)}${path}`, { method, headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` } })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || text('The request failed. Please retry.', 'تعذر تنفيذ الطلب. يرجى المحاولة مجددًا.'))
    }
    return response
  }
  const showFiles = async () => {
    setOpen(!open)
    if (open || files !== null) return
    setBusy(true); setError('')
    try { setFiles((await (await request('/inputs')).json()).filter((file: any) => file.inputType === 'FILE_UPLOAD')) }
    catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }
  const remove = async () => {
    if (!window.confirm(text(`Delete review "${title}" and its saved results? This cannot be undone.`, `حذف المراجعة «${title}» ونتائجها المحفوظة؟ لا يمكن التراجع عن الحذف.`))) return
    setBusy(true); setError('')
    try { await request('', 'DELETE'); onDeleted() }
    catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }
  const download = async (file: any) => {
    setBusy(true); setError('')
    try {
      const blob = await (await request(`/inputs/${encodeURIComponent(file.id)}/download`)).blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = file.fileName || file.label || 'document'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e: any) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <div onClick={e => e.stopPropagation()} style={{ flexBasis: '100%', minWidth: 0 }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-secondary" disabled={busy} aria-expanded={open} onClick={showFiles}>{text('Uploaded documents', 'المستندات المرفوعة')}</button>
      {canDelete && <button className="btn btn-secondary" disabled={busy} aria-label={text('Delete review: ', 'حذف المراجعة: ') + title} onClick={remove}>{text('Delete review', 'حذف المراجعة')}</button>}
      <HelpTip text={text('Download the original uploaded files. Administrators can delete a review and its saved results after confirmation.', 'تنزيل الملفات الأصلية المرفوعة. يمكن لمسؤولي المنظمة حذف المراجعة ونتائجها المحفوظة بعد التأكيد.')} />
    </div>
    {busy && <div role="status">{text('Please wait…', 'يرجى الانتظار…')}</div>}
    {error && <div role="alert">{error}</div>}
    {open && files && <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
      {files.length === 0 && <div>{text('No uploaded documents.', 'لا توجد مستندات مرفوعة.')}</div>}
      {files.map(file => <div key={file.id} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <span style={{ overflowWrap: 'anywhere', flex: '1 1 180px' }}>{file.fileName || file.label}</span>
        <button className="btn btn-secondary" disabled={busy} onClick={() => download(file)} aria-label={text('Download ', 'تنزيل ') + (file.fileName || file.label)}>{text('Download original', 'تنزيل الملف الأصلي')}</button>
      </div>)}
    </div>}
  </div>
}
