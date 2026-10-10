import React, { useEffect, useRef, useState } from 'react'
import { useLang } from '../contexts/LangContext'

export type GovernanceExportFormat = 'word' | 'powerpoint'
export default function GovernanceExportDialog({ onClose, onExport, subject = 'governance', powerpointAvailable = true }: { onClose: () => void; onExport: (language: 'en'|'ar', format: GovernanceExportFormat) => void; subject?: 'governance'|'study'; powerpointAvailable?: boolean }) {
 const { isAR } = useLang()
 const [format, setFormat] = useState<GovernanceExportFormat>(powerpointAvailable ? 'powerpoint' : 'word')
 const [language, setLanguage] = useState<'en'|'ar'>(isAR ? 'ar' : 'en')
 const dialog = useRef<HTMLDivElement>(null)
 useEffect(() => {
  const previous = document.activeElement as HTMLElement
  dialog.current?.focus()
  return () => previous?.focus()
 }, [])
 const text = (en: string, ar: string) => isAR ? ar : en
 return <div style={{ position:'fixed', inset:0, zIndex:1000, background:'rgba(0,0,0,.7)', display:'grid', placeItems:'center', padding:16 }}>
  <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="governance-export-title" dir={isAR?'rtl':'ltr'}
   onKeyDown={e => {
    if(e.key==='Escape')onClose()
    if(e.key==='Tab') {
     const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>('select,button') || [])
     const first=focusable[0], last=focusable[focusable.length-1]
     if(e.shiftKey && (document.activeElement===first || document.activeElement===dialog.current)){e.preventDefault();last?.focus()}
     else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus()}
    }
   }} style={{ width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', background:'var(--navy-mid)', color:'var(--text-primary)', border:'1px solid var(--navy-light)', borderRadius:14, padding:24, boxSizing:'border-box' }}>
   <h2 id="governance-export-title" style={{ marginTop:0 }}>{subject === 'study' ? text('Export Innovation Study','تصدير دراسة الابتكار') : text('Export Governance Review','تصدير مراجعة الحوكمة')}</h2>
   <label htmlFor="governance-export-format">{text('Export format','صيغة التصدير')}</label>
   <select id="governance-export-format" className="form-input" value={format} onChange={e=>setFormat(e.target.value as GovernanceExportFormat)} style={{ width:'100%', margin:'8px 0 20px' }}>
    <option value="word">{text('Word Report','تقرير Word')}</option>
    <option value="powerpoint" disabled={!powerpointAvailable}>{text('PowerPoint — Executive Presentation','PowerPoint — العرض التنفيذي')}</option>
   </select>
   <label htmlFor="governance-export-language">{text('Language','اللغة')}</label>
   <select id="governance-export-language" className="form-input" value={language} onChange={e=>setLanguage(e.target.value as 'en'|'ar')} style={{ width:'100%', margin:'8px 0 12px' }}>
    <option value="en">English</option><option value="ar">العربية</option>
   </select>
   <p role="note" style={{ fontSize:13, lineHeight:1.6, color:'var(--text-muted)' }}>{text('The executive presentation preserves the saved results. Evidence quotations remain in their original language.','يحافظ العرض التنفيذي على النتائج المحفوظة وتبقى الاقتباسات بلغتها الأصلية.')}</p>
   {!powerpointAvailable && <p role="status" style={{ fontSize:13, lineHeight:1.6 }}>{text('PowerPoint is available after the review is finalized. Resolve the manual-review warnings first. You can download the current saved report as Word.','يتاح تصدير PowerPoint بعد اكتمال المراجعة. عالج تنبيهات المراجعة اليدوية أولاً. يمكنك تنزيل التقرير المحفوظ الحالي بصيغة Word.')}</p>}
   <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'flex-end', marginTop:24 }}>
    <button className="btn btn-secondary" onClick={onClose}>{text('Cancel','إلغاء')}</button>
    <button className="btn btn-primary" onClick={()=>onExport(language,!powerpointAvailable && format==='powerpoint' ? 'word' : format)}>{text('Generate and Download','إنشاء وتنزيل')}</button>
   </div>
  </div>
 </div>
}
