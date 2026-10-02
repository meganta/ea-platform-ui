import { useLang } from '../../contexts/LangContext'
import { useState, useEffect } from 'react'
import { authFetch, SETTINGS_API_URL } from './shared'

export default function OutputSettingsPage() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [subTab, setSubTab] = useState<'diagrams' | 'export' | 'templates'>('diagrams')
  return (
    <div>
      <div className="page-header">
        <div className="page-title">{L('Output Preferences', 'تفضيلات المخرجات')}</div>
        <div className="page-subtitle">{L('HOW DIAGRAMS AND DOCUMENTS ARE PRODUCED', 'كيفية إنتاج المخططات والوثائق')}</div>
        <div className="page-tabs">
          {[['diagrams', L('Diagrams', 'المخططات')], ['export', L('Export', 'التصدير')], ['templates', L('Document & Presentation Templates', 'قوالب الوثائق والعروض')]].map(([k, l]) => (
            <button key={k} className={`tab-btn${subTab === k ? ' active' : ''}`} onClick={() => setSubTab(k as any)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="page-body" style={{ maxWidth: 720 }}>
        <div className="card">
          {subTab === 'diagrams' ? <DiagramSection /> : subTab === 'export' ? <ExportSection /> : <TemplateSection />}
        </div>
      </div>
    </div>
  )
}

function TemplateSection() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [data, setData] = useState<any>(null)
  const [format, setFormat] = useState<'PPTX' | 'DOCX'>('PPTX')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const load = () => authFetch('/output-studio/templates').then(setData)
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async () => {
    if (!file) return
    setBusy(true); setMsg('')
    try {
      const body = new FormData(); body.append('file', file); body.append('format', format); body.append('name', file.name.replace(/\.(pptx|docx)$/i, ''))
      const res = await fetch(`${SETTINGS_API_URL}/output-studio/templates/upload`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('ea_token')}` }, body })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || L('Upload failed', 'فشل الرفع'))
      setFile(null); setMsg(L('Template uploaded and set as the tenant default.', 'تم رفع القالب وتعيينه افتراضياً للجهة.')); await load()
    } catch (e: any) { setMsg(e.message) } finally { setBusy(false) }
  }
  const setDefault = async (targetFormat: string, kind: 'TENANT' | 'GALLERY', id: string) => {
    await authFetch(`/output-studio/templates/default/${targetFormat}`, { method: 'POST', body: JSON.stringify(kind === 'TENANT' ? { kind, templateId: id } : { kind, galleryId: id }) }); await load()
  }
  const remove = async (id: string) => { await authFetch(`/output-studio/templates/${id}`, { method: 'DELETE' }); await load() }
  const selected = (targetFormat: string, kind: string, id: string) => {
    const value = data?.defaults?.[targetFormat]
    return value?.kind === kind && (value.templateId === id || value.galleryId === id)
  }
  return <div>
    <div className="section-title" style={{ fontSize: 15 }}>{L('Document & Presentation Templates', 'قوالب الوثائق والعروض')}</div>
    <div style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 16px' }}>{L('Tenant-scoped Office templates are validated, versioned and profiled. ArchMind gallery templates remain available as fallback.', 'يتم التحقق من قوالب Office الخاصة بالجهة وإصدارها وتحليلها، وتبقى قوالب معرض ArchMind متاحة كبديل.')}</div>
    {msg && <div className="alert" style={{ marginBottom: 10 }}>{msg}</div>}
    <div style={{ display: 'flex', gap: 8, alignItems: 'end', padding: 12, border: '1px solid var(--border)', borderRadius: 5 }}>
      <label style={{ fontSize: 11 }}>{L('Type', 'النوع')}<select className="form-input" value={format} onChange={e => { setFormat(e.target.value as any); setFile(null) }} style={{ display: 'block', marginTop: 4 }}><option value="PPTX">PowerPoint (.pptx)</option><option value="DOCX">Word (.docx)</option></select></label>
      <label style={{ fontSize: 11, flex: 1 }}>{L('Template', 'القالب')}<input type="file" accept={format === 'PPTX' ? '.pptx' : '.docx'} onChange={e => setFile(e.target.files?.[0] || null)} style={{ display: 'block', marginTop: 7 }} /></label>
      <button className="btn btn-primary btn-sm" disabled={!file || busy} onClick={upload}>{busy ? L('Validating…', 'جارٍ التحقق…') : L('Upload', 'رفع')}</button>
    </div>
    {(['PPTX', 'DOCX'] as const).map(targetFormat => <div key={targetFormat} style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 7 }}>{targetFormat === 'PPTX' ? 'PowerPoint' : 'Word'}</div>
      {(data?.templates || []).filter((item: any) => item.format === targetFormat).map((item: any) => <div key={item.id} style={{ padding: 9, border: `1px solid ${selected(targetFormat, 'TENANT', item.id) ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, marginBottom: 5, fontSize: 11 }}>
        <strong>{item.name}</strong> · v{item.version} · {(item.sizeBytes / 1024).toFixed(0)} {L('KB', 'كيلوبايت')}
        <div style={{ color: 'var(--text-dim)', marginTop: 3 }}>{L('Fonts:', 'الخطوط:')} {item.profile?.fonts?.slice(0, 4).join(', ') || L('not declared', 'غير محددة')} {L('· Layouts/styles:', '· التخطيطات/الأنماط:')} {item.profile?.layouts?.length || 0} {L('· Media:', '· الوسائط:')} {item.profile?.media?.length || 0}</div>
        <div className="flex gap-2" style={{ marginTop: 5 }}><button className="btn btn-secondary btn-sm" onClick={() => setDefault(targetFormat, 'TENANT', item.id)}>{selected(targetFormat, 'TENANT', item.id) ? L('Default', 'افتراضي') : L('Set Default', 'تعيين كافتراضي')}</button><button className="btn btn-secondary btn-sm" onClick={() => remove(item.id)}>{L('Remove', 'إزالة')}</button></div>
      </div>)}
      <div style={{ fontSize: 10, color: 'var(--text-dim)', margin: '9px 0 5px' }}>{L('ArchMind Template Gallery', 'معرض قوالب ArchMind')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: targetFormat === 'PPTX' ? 'repeat(3, minmax(0, 1fr))' : '1fr', gap: 8 }}>{(data?.gallery || []).filter((item: any) => item.formats.includes(targetFormat)).map((item: any) => <button key={item.id} className="btn btn-secondary" onClick={() => setDefault(targetFormat, 'GALLERY', item.id)} style={{ textAlign: 'left', padding: 0, overflow: 'hidden', borderColor: selected(targetFormat, 'GALLERY', item.id) ? 'var(--accent)' : undefined }}>{targetFormat === 'PPTX' && <DesignSystemPreview id={item.id} />}<div style={{ padding: 9 }}><strong>{item.name}</strong><div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 3, whiteSpace: 'normal' }}>{item.description}</div></div></button>)}</div>
    </div>)}
  </div>
}

function DesignSystemPreview({ id }: { id: string }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const designs: Record<string, { bg: string; ink: string; accent: string; mode: 'editorial' | 'institutional' | 'technical' }> = {
    'executive-consulting': { bg: '#f7f5f0', ink: '#152a3a', accent: '#e05a47', mode: 'editorial' },
    'government-executive': { bg: '#f4f7f5', ink: '#153f36', accent: '#b69a5b', mode: 'institutional' },
    'architecture-professional': { bg: '#f3f7fa', ink: '#102a43', accent: '#00a6c8', mode: 'technical' },
  }
  const d = designs[id] || designs['architecture-professional']
  return <div aria-label={L(`${id} representative slide preview`, `معاينة شريحة تمثيلية لـ ${id}`)} style={{ height: 112, background: d.bg, position: 'relative', borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
    {d.mode === 'editorial' && <><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '31%', background: d.accent }} /><div style={{ position: 'absolute', left: '39%', top: 20, width: '48%', height: 7, background: d.ink }} /><div style={{ position: 'absolute', left: '39%', top: 34, width: '36%', height: 4, background: '#89959d' }} /><div style={{ position: 'absolute', left: '39%', top: 58, display: 'flex', gap: 5 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 31, height: 31, background: i === 0 ? d.ink : '#fff', border: '1px solid #e7e2d9' }} />)}</div></>}
    {d.mode === 'institutional' && <><div style={{ height: 8, background: d.accent }} /><div style={{ position: 'absolute', right: 0, top: 8, bottom: 0, width: 10, background: d.ink }} /><div style={{ position: 'absolute', right: 22, top: 23, width: '62%', height: 7, background: d.ink }} /><div style={{ position: 'absolute', right: 22, top: 43, width: '75%', height: 1, background: '#dce6e1' }} /><div style={{ position: 'absolute', right: 22, top: 58, display: 'flex', gap: 5 }}>{[0, 1, 2].map(i => <div key={i} style={{ width: 34, height: 30, background: '#fff', borderTop: `3px solid ${d.accent}`, borderInlineEnd: '1px solid #dce6e1' }} />)}</div></>}
    {d.mode === 'technical' && <><div style={{ height: 5, background: d.accent }} />{[1, 2, 3, 4].map(i => <div key={i} style={{ position: 'absolute', left: 8 + i * 29, top: 12, bottom: 8, borderLeft: '1px solid #d9eaf0' }} />)}<div style={{ position: 'absolute', left: 14, top: 20, width: '68%', height: 7, background: d.ink }} /><div style={{ position: 'absolute', left: 18, top: 51, display: 'flex', gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 31, height: 25, background: '#fff', border: `1px solid ${d.accent}`, borderRadius: 2 }} />)}</div><div style={{ position: 'absolute', left: 48, top: 62, width: 12, borderTop: `2px solid ${d.accent}` }} /><div style={{ position: 'absolute', left: 91, top: 62, width: 12, borderTop: `2px solid ${d.accent}` }} /></>}
  </div>
}

function DiagramSection() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [form, setForm] = useState({ defaultStyle: 'PROFESSIONAL', colorScheme: 'BLUE', autoGenerateDiagrams: true, diagramDensity: 'MEDIUM', showLegend: true, showRelationships: true, arabicLabels: true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const d = c.ai?.diagramSettings || {}; setForm(f => ({ ...f, ...d })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/diagram-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: L('Diagram settings saved', 'تم حفظ إعدادات المخططات') })
      else setMsg({ type: 'error', text: L('Failed to save', 'تعذّر الحفظ') })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>{L('📐 Diagram Settings', '📐 إعدادات المخططات')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{L('Configure architecture diagram generation preferences', 'تكوين تفضيلات إنشاء مخططات البنية')}</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[['defaultStyle', L('Diagram Style', 'نمط المخطط'), [['PROFESSIONAL', L('Professional', 'احترافي')], ['MINIMAL', L('Minimal', 'بسيط')], ['DETAILED', L('Detailed', 'تفصيلي')]]], ['colorScheme', L('Color Scheme', 'نظام الألوان'), [['BLUE', L('Blue (Default)', 'أزرق (افتراضي)')], ['GREEN', L('Green', 'أخضر')], ['MONOCHROME', L('Monochrome', 'أحادي اللون')], ['GOVERNMENT', L('Government', 'حكومي')]]], ['diagramDensity', L('Information Density', 'كثافة المعلومات'), [['LOW', 'Low — Key elements only'], ['MEDIUM', 'Medium — Balanced'], ['HIGH', 'High — Full detail']]]].map(([k, l, opts]) => (
            <div key={k as string}>
              <div style={{ fontSize: 11, marginBottom: 3 }}>{l as string}</div>
              <select className="form-input" value={(form as any)[k as string]} onChange={e => setForm(f => ({ ...f, [k as string]: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
                {(opts as string[][]).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['autoGenerateDiagrams', L('Auto-generate diagrams during output generation', 'إنشاء المخططات تلقائياً أثناء إنشاء المخرجات')], ['showLegend', L('Include legend in diagrams', 'تضمين مفتاح الرموز في المخططات')], ['showRelationships', L('Show relationship lines between components', 'إظهار خطوط العلاقات بين المكونات')], ['arabicLabels', L('Use Arabic labels in diagrams (NORA outputs)', 'استخدام تسميات عربية في المخططات (مخرجات نورة)')]].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? L('Saving...', 'جارٍ الحفظ...') : L('💾 Save Diagram Settings', '💾 حفظ إعدادات المخططات')}</button>
      </div>
    </div>
  )
}

function ExportSection() {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [form, setForm] = useState({ defaultLanguage: 'AR', includeCharts: true, includeTableOfContents: true, includePageNumbers: true, templateStyle: 'PROFESSIONAL', footerText: '', headerLogoEnabled: true })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    authFetch('/config').then(c => { const s = c.ai?.exportSettings || {}; setForm(f => ({ ...f, ...s })) })
  }, [])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await authFetch('/config/export-settings', { method: 'PUT', body: JSON.stringify(form) })
      if (res.message) setMsg({ type: 'success', text: L('Export settings saved', 'تم حفظ إعدادات التصدير') })
      else setMsg({ type: 'error', text: L('Failed to save', 'تعذّر الحفظ') })
    } finally { setSaving(false) }
  }

  return (
    <div>
      <div className="section-title" style={{ fontSize: 15, marginBottom: 4 }}>{L('📤 Export Settings', '📤 إعدادات التصدير')}</div>
      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16 }}>{L('Configure default behavior for Word and PowerPoint exports', 'تكوين السلوك الافتراضي لتصدير Word وPowerPoint')}</div>
      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{msg.text}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Default Export Language', 'لغة التصدير الافتراضية')}</div>
            <select className="form-input" value={form.defaultLanguage} onChange={e => setForm(f => ({ ...f, defaultLanguage: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="AR">{L('Arabic', 'العربية')}</option>
              <option value="EN">{L('English', 'الإنجليزية')}</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Template Style', 'نمط القالب')}</div>
            <select className="form-input" value={form.templateStyle} onChange={e => setForm(f => ({ ...f, templateStyle: e.target.value }))} style={{ fontSize: 11, width: '100%' }}>
              <option value="PROFESSIONAL">{L('Professional', 'احترافي')}</option>
              <option value="GOVERNMENT">{L('Government', 'حكومي')}</option>
              <option value="MINIMAL">{L('Minimal', 'بسيط')}</option>
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 11, marginBottom: 3 }}>{L('Footer Text', 'نص التذييل')}</div>
            <input className="form-input" value={form.footerText} onChange={e => setForm(f => ({ ...f, footerText: e.target.value }))} placeholder={L('e.g. Confidential — For internal use only', 'مثال: سري — للاستخدام الداخلي فقط')} style={{ fontSize: 11, width: '100%' }} />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[['includeCharts', L('Include Charts & Diagrams', 'تضمين الرسوم البيانية والمخططات')], ['includeTableOfContents', L('Include Table of Contents', 'تضمين جدول المحتويات')], ['includePageNumbers', L('Include Page Numbers', 'تضمين أرقام الصفحات')], ['headerLogoEnabled', L('Include Organization Logo in Header', 'تضمين شعار الجهة في الترويسة')]].map(([k, l]) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12 }}>
              <input type="checkbox" checked={(form as any)[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.checked }))} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ fontSize: 12, alignSelf: 'flex-start' }} disabled={saving} onClick={save}>{saving ? L('Saving...', 'جارٍ الحفظ...') : L('💾 Save Export Settings', '💾 حفظ إعدادات التصدير')}</button>
      </div>
    </div>
  )
}

