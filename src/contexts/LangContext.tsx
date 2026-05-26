/**
 * LOCALIZATION PROVIDER
 * =====================
 * Single source of truth for all UI text rendering.
 *
 * Resolution pipeline:
 *   key → terminology dictionary (tenant-specific) → static translation table → log missing → NEVER cross-language fallback
 *
 * Usage:
 *   const { t, locale, isAR, setLocale, resolveText } = useLang()
 *   t('target_architecture')  → 'البنية المستهدفة' (AR) | 'Target Architecture' (EN)
 *   resolveText(rawAiOutput)  → terminology-normalized string
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

export type Locale = 'AR' | 'EN'

// ── Static translation table ─────────────────────────────────────────────────
// Keys map to both locales. NEVER use English as fallback for Arabic.
const TRANSLATIONS: Record<string, { EN: string; AR: string }> = {
  // Navigation
  'nav.main':          { EN: 'Main', AR: 'الرئيسية' },
  'nav.dashboard':     { EN: 'Dashboard', AR: 'لوحة التحكم' },
  'nav.adm':           { EN: 'ADM Cycles', AR: 'دورات ADM' },
  'nav.copilot':       { EN: 'AI Copilot', AR: 'المساعد الذكي' },
  'nav.repo_section':  { EN: 'Repository', AR: 'المستودعات' },
  'nav.repository':    { EN: 'EA Repository', AR: 'مستودع البنية المؤسسية' },
  'nav.knowledge':     { EN: 'Knowledge Base', AR: 'قاعدة المعرفة' },
  'nav.governance':    { EN: 'Governance', AR: 'الحوكمة' },
  'nav.setup':         { EN: 'Setup Assistant', AR: 'مساعد الإعداد' },
  'nav.settings':      { EN: 'Settings', AR: 'الإعدادات' },
  'nav.admin':         { EN: 'Admin', AR: 'الإدارة' },
  // Auth
  'auth.email':        { EN: 'Email', AR: 'البريد الإلكتروني' },
  'auth.password':     { EN: 'Password', AR: 'كلمة المرور' },
  'auth.signin':       { EN: 'Sign In', AR: 'تسجيل الدخول' },
  'auth.signout':      { EN: 'Sign Out', AR: 'تسجيل الخروج' },
  'auth.register':     { EN: 'Register', AR: 'إنشاء حساب' },
  'auth.org':          { EN: 'Organization', AR: 'المنظمة' },
  // Common actions
  'common.save':       { EN: 'Save', AR: 'حفظ' },
  'common.saving':     { EN: 'Saving...', AR: 'جارٍ الحفظ...' },
  'common.cancel':     { EN: 'Cancel', AR: 'إلغاء' },
  'common.create':     { EN: 'Create', AR: 'إنشاء' },
  'common.creating':   { EN: 'Creating...', AR: 'جارٍ الإنشاء...' },
  'common.delete':     { EN: 'Delete', AR: 'حذف' },
  'common.edit':       { EN: 'Edit', AR: 'تعديل' },
  'common.back':       { EN: 'Back', AR: 'رجوع' },
  'common.next':       { EN: 'Next', AR: 'التالي' },
  'common.close':      { EN: 'Close', AR: 'إغلاق' },
  'common.search':     { EN: 'Search', AR: 'بحث' },
  'common.filter':     { EN: 'Filter', AR: 'تصفية' },
  'common.upload':     { EN: 'Upload', AR: 'رفع' },
  'common.uploading':  { EN: 'Uploading...', AR: 'جارٍ الرفع...' },
  'common.download':   { EN: 'Download', AR: 'تحميل' },
  'common.generate':   { EN: 'Generate', AR: 'توليد' },
  'common.generating': { EN: 'Generating...', AR: 'جارٍ التوليد...' },
  'common.approve':    { EN: 'Approve', AR: 'اعتماد' },
  'common.reject':     { EN: 'Reject', AR: 'رفض' },
  'common.refresh':    { EN: 'Refresh', AR: 'تحديث' },
  'common.export':     { EN: 'Export', AR: 'تصدير' },
  'common.loading':    { EN: 'Loading...', AR: 'جارٍ التحميل...' },
  'common.error':      { EN: 'Error', AR: 'خطأ' },
  'common.success':    { EN: 'Success', AR: 'نجاح' },
  'common.status':     { EN: 'Status', AR: 'الحالة' },
  'common.name':       { EN: 'Name', AR: 'الاسم' },
  'common.type':       { EN: 'Type', AR: 'النوع' },
  'common.domain':     { EN: 'Domain', AR: 'المجال' },
  'common.date':       { EN: 'Date', AR: 'التاريخ' },
  'common.version':    { EN: 'Version', AR: 'الإصدار' },
  'common.description':{ EN: 'Description', AR: 'الوصف' },
  'common.actions':    { EN: 'Actions', AR: 'الإجراءات' },
  'common.all':        { EN: 'All', AR: 'الكل' },
  'common.none':       { EN: 'None', AR: 'لا شيء' },
  'common.yes':        { EN: 'Yes', AR: 'نعم' },
  'common.no':         { EN: 'No', AR: 'لا' },
  'common.add':        { EN: 'Add', AR: 'إضافة' },
  'common.hide':       { EN: 'Hide', AR: 'إخفاء' },
  'common.show':       { EN: 'Show', AR: 'عرض' },
  'common.new':        { EN: 'New', AR: 'جديد' },
  'common.view':       { EN: 'View', AR: 'عرض' },
  'common.preview':    { EN: 'Preview', AR: 'معاينة' },
  'common.required':   { EN: 'Required', AR: 'مطلوب' },
  'common.optional':   { EN: 'Optional', AR: 'اختياري' },
  'common.approved':   { EN: 'Approved', AR: 'معتمد' },
  'common.draft':      { EN: 'Draft', AR: 'مسودة' },
  'common.pending':    { EN: 'Pending', AR: 'قيد الانتظار' },
  'common.rejected':   { EN: 'Rejected', AR: 'مرفوض' },
  'common.deprecated': { EN: 'Deprecated', AR: 'مهمل' },
  'common.available':  { EN: 'Available', AR: 'متاح' },
  'common.missing':    { EN: 'Missing', AR: 'مفقود' },
  'common.critical':   { EN: 'Critical', AR: 'حرجة' },
  'common.high':       { EN: 'High', AR: 'عالية' },
  'common.medium':     { EN: 'Medium', AR: 'متوسطة' },
  'common.low':        { EN: 'Low', AR: 'منخفضة' },
  // ADM — missing keys
  'adm.new':            { EN: '+ New Cycle', AR: '+ دورة جديدة' },
  'adm.subtitle':       { EN: 'Architecture Development Method', AR: 'منهجية تطوير البنية المؤسسية' },
  'adm.modal_title':    { EN: 'New ADM Cycle', AR: 'دورة ADM جديدة' },
  'adm.no_cycles':      { EN: 'No cycles yet', AR: 'لا توجد دورات بعد' },
  'adm.name':           { EN: 'Cycle Name', AR: 'اسم الدورة' },
  'adm.description':    { EN: 'Description', AR: 'الوصف' },
  'adm.framework':      { EN: 'Framework', AR: 'الإطار المرجعي' },
  'adm.download_word':  { EN: 'Download Filled Word', AR: 'تحميل Word معبأ' },
  'adm.download_ppt':   { EN: 'Download Filled PPT', AR: 'تحميل PPT معبأ' },
  'adm.word_template':  { EN: 'Word Template', AR: 'قالب Word' },
  'adm.ppt_template':   { EN: 'PPT Template', AR: 'قالب PPT' },
  'adm.no_assets':      { EN: 'No assets found', AR: 'لا توجد أصول' },
  'adm.approved_only':  { EN: 'Approved outputs only', AR: 'المخرجات المعتمدة فقط' },
  'adm.latest_only':    { EN: 'Latest versions only', AR: 'الإصدارات الأخيرة فقط' },
  'adm.include_exports':{ EN: 'Include Word / PPT Exports', AR: 'تضمين ملفات التصدير' },
  'adm.export_package': { EN: '📦 Export Package', AR: '📦 تصدير الحزمة' },
  'adm.download_zip':   { EN: '⬇ Download ZIP', AR: '⬇ تحميل الحزمة' },
  // Dashboard — missing keys
  'dash.active':        { EN: 'Active', AR: 'نشط' },
  'dash.adm_cycles':    { EN: 'ADM Cycles', AR: 'دورات ADM' },
  'dash.ai_sessions':   { EN: 'AI Sessions', AR: 'جلسات الذكاء الاصطناعي' },
  'dash.capabilities':  { EN: 'Capabilities', AR: 'القدرات' },
  'dash.create_cycle':  { EN: 'Create Cycle', AR: 'إنشاء دورة' },
  'dash.documents':     { EN: 'Documents', AR: 'الوثائق' },
  'dash.indexed':       { EN: 'Indexed', AR: 'مفهرسة' },
  'dash.latest_cycle':  { EN: 'Latest Cycle', AR: 'آخر دورة' },
  'dash.no_cycles':     { EN: 'No cycles yet', AR: 'لا توجد دورات بعد' },
  'dash.quick_actions': { EN: 'Quick Actions', AR: 'إجراءات سريعة' },
  'dash.status':        { EN: 'Status', AR: 'الحالة' },
  'dash.subtitle':      { EN: 'Enterprise Architecture Platform', AR: 'منصة البنية المؤسسية' },
  'dash.adm':           { EN: 'ADM Cycles', AR: 'دورات ADM' },
  // Knowledge Base — missing keys
  'know.col_chunks':    { EN: 'Chunks', AR: 'المقاطع' },
  'know.col_lang':      { EN: 'Language', AR: 'اللغة' },
  'know.col_name':      { EN: 'Document Name', AR: 'اسم الوثيقة' },
  'know.col_status':    { EN: 'Status', AR: 'الحالة' },
  'know.col_type':      { EN: 'Type', AR: 'النوع' },
  'know.documents':     { EN: 'Documents', AR: 'الوثائق' },
  'know.no_docs':       { EN: 'No documents yet', AR: 'لا توجد وثائق بعد' },
  'know.no_results':    { EN: 'No results found', AR: 'لا توجد نتائج' },
  'know.placeholder':   { EN: 'Ask anything about your architecture...', AR: 'اسأل أي سؤال عن بنيتك المؤسسية...' },
  'know.score':         { EN: 'Score', AR: 'النتيجة' },
  'know.search':        { EN: 'Search knowledge base...', AR: 'ابحث في قاعدة المعرفة...' },
  'know.search_btn':    { EN: 'Search', AR: 'بحث' },
  'know.searching':     { EN: 'Searching...', AR: 'جارٍ البحث...' },
  'know.subtitle':      { EN: 'Reference documents and standards', AR: 'الوثائق المرجعية والمعايير' },
  'know.upload':        { EN: 'Upload Document', AR: 'رفع وثيقة' },
  'know.upload_first':  { EN: 'Upload documents to get started', AR: 'ارفع وثائق للبدء' },
  'know.uploading':     { EN: 'Uploading...', AR: 'جارٍ الرفع...' },
  // Quick Actions
  'qa.adm':             { EN: 'Start ADM Cycle', AR: 'بدء دورة ADM' },
  'qa.adm_sub':         { EN: 'Begin architecture development', AR: 'ابدأ تطوير البنية المؤسسية' },
  'qa.copilot':         { EN: 'AI Copilot', AR: 'المساعد الذكي' },
  'qa.copilot_sub':     { EN: 'Ask architecture questions', AR: 'اسأل أسئلة معمارية' },
  'qa.knowledge':       { EN: 'Knowledge Base', AR: 'قاعدة المعرفة' },
  'qa.knowledge_sub':   { EN: 'Upload reference documents', AR: 'ارفع وثائق مرجعية' },
  'qa.repo':            { EN: 'EA Repository', AR: 'مستودع البنية المؤسسية' },
  'qa.repo_sub':        { EN: 'Manage architecture assets', AR: 'إدارة الأصول المعمارية' },
  // Repository — missing keys
  'repo.col_name':      { EN: 'Asset Name', AR: 'اسم الأصل' },
  'adm.new_cycle':          { EN: '+ New Cycle', AR: '+ دورة جديدة' },
  'adm.phase':              { EN: 'Phase', AR: 'المرحلة' },
  'adm.step':               { EN: 'Step', AR: 'الخطوة' },
  'adm.inputs':             { EN: 'Inputs', AR: 'المدخلات' },
  'adm.outputs':            { EN: 'Outputs', AR: 'المخرجات' },
  'adm.generate':           { EN: 'AI Generate', AR: 'توليد ذكي' },
  'adm.analyze':            { EN: 'Analyze & Structure', AR: 'تحليل وهيكلة' },
  'adm.design':             { EN: 'AI Design', AR: 'تصميم ذكي' },
  'adm.plan':               { EN: 'AI Plan', AR: 'تخطيط ذكي' },
  'adm.analyzing':          { EN: 'Analyzing...', AR: 'جارٍ التحليل...' },
  'adm.click_phase':        { EN: 'Click a phase to open its workspace', AR: 'اضغط على مرحلة لفتح مساحة العمل' },
  'adm.browse_assets':      { EN: 'Browse Assets', AR: 'استعراض الأصول' },
  'adm.show_all':           { EN: 'Show All', AR: 'عرض الكل' },
  'adm.this_cycle':         { EN: 'This Cycle Only', AR: 'هذه الدورة فقط' },
  'adm.all_domains':        { EN: 'All Domains', AR: 'كل المجالات' },
  'adm.all_phases':         { EN: 'All Phases', AR: 'كل المراحل' },
  'adm.all_types':          { EN: 'All Types', AR: 'كل الأنواع' },
  'adm.all_statuses':       { EN: 'All Statuses', AR: 'كل الحالات' },
  'adm.upload_use':         { EN: 'Upload & Use', AR: 'رفع واستخدام' },
  'adm.save_evidence':      { EN: 'Save Evidence', AR: 'حفظ الدليل' },
  'adm.in_repo':            { EN: '✓ In Repo', AR: '✓ في المستودع' },
  'adm.to_repo':            { EN: '→ Repository', AR: '→ المستودع' },
  'adm.in_kb':              { EN: '✓ In KB', AR: '✓ في قاعدة المعرفة' },
  'adm.to_kb':              { EN: '→ Knowledge Base', AR: '→ قاعدة المعرفة' },
  'adm.cycle_repo':         { EN: '📦 Cycle Repository', AR: '📦 مستودع الدورة' },
  'adm.phases_tab':         { EN: '🗺 Phases', AR: '🗺 المراحل' },
  'adm.sync_outputs':       { EN: '⟳ Sync Outputs', AR: '⟳ مزامنة المخرجات' },
  'adm.syncing':            { EN: '⟳ Syncing...', AR: '⟳ جارٍ المزامنة...' },
  'adm.cycle_assets_only':  { EN: '📍 This cycle assets only', AR: '📍 أصول هذه الدورة فقط' },
  'adm.all_repo_assets':    { EN: '🌐 All repository assets', AR: '🌐 كل أصول المستودع' },
  'adm.auto_adm':           { EN: '⚡ Auto — ADM Output', AR: '⚡ تلقائي — مخرج ADM' },
  'adm.auto_repo':          { EN: '🗄 Auto — Repository', AR: '🗄 تلقائي — المستودع' },
  // Settings
  'settings.title':         { EN: '⚙ Settings', AR: '⚙ الإعدادات' },
  'settings.ai':            { EN: 'AI Configuration', AR: 'إعداد الذكاء الاصطناعي' },
  'settings.apikeys':       { EN: '🔑 API Keys', AR: '🔑 مفاتيح API' },
  'settings.kb':            { EN: '🧠 Knowledge Base', AR: '🧠 قاعدة المعرفة' },
  'settings.branding':      { EN: '🎨 Branding', AR: '🎨 الهوية البصرية' },
  'settings.export':        { EN: '📤 Export', AR: '📤 التصدير' },
  'settings.governance':    { EN: '⚖ Governance', AR: '⚖ الحوكمة' },
  'settings.diagrams':      { EN: '📐 Diagrams', AR: '📐 المخططات' },
  'settings.notifications': { EN: '🔔 Notifications', AR: '🔔 الإشعارات' },
  'settings.users':         { EN: '👥 Users', AR: '👥 المستخدمون' },
  'settings.terminology':   { EN: '🌐 Terminology', AR: '🌐 المصطلحات' },
  'settings.billing':       { EN: 'Subscription', AR: 'الاشتراك' },
  'settings.saved':         { EN: 'Saved successfully', AR: 'تم الحفظ بنجاح' },
  'settings.save_ai':       { EN: 'Save AI Configuration', AR: 'حفظ إعدادات الذكاء الاصطناعي' },
  'settings.save_kb':       { EN: 'Save Knowledge Base Settings', AR: 'حفظ إعدادات قاعدة المعرفة' },
  'settings.save_branding': { EN: 'Save Branding', AR: 'حفظ الهوية البصرية' },
  'settings.save_export':   { EN: 'Save Export Settings', AR: 'حفظ إعدادات التصدير' },
  'settings.save_gov':      { EN: 'Save Governance Settings', AR: 'حفظ إعدادات الحوكمة' },
  'settings.save_diag':     { EN: 'Save Diagram Settings', AR: 'حفظ إعدادات المخططات' },
  'settings.save_notif':    { EN: 'Save Notification Settings', AR: 'حفظ إعدادات الإشعارات' },
  'settings.org_id':        { EN: 'ORGANIZATION ID', AR: 'معرف المنظمة' },
  'settings.subscription':  { EN: 'SUBSCRIPTION', AR: 'الاشتراك' },
  // Governance
  'gov.title':              { EN: 'Governance Reviews', AR: 'مراجعات الحوكمة' },
  'gov.subtitle':           { EN: 'EA Governance & Compliance Review Service', AR: 'خدمة مراجعة حوكمة البنية المؤسسية' },
  'gov.new':                { EN: '+ New Review', AR: '+ مراجعة جديدة' },
  'gov.no_reviews':         { EN: 'No reviews yet', AR: 'لا توجد مراجعات بعد' },
  'gov.start_first':        { EN: 'Start your first EA governance review', AR: 'ابدأ أول مراجعة حوكمة للبنية المؤسسية' },
  'gov.create':             { EN: 'Create Review', AR: 'إنشاء مراجعة' },
  'gov.back':               { EN: 'Back to Reviews', AR: 'العودة إلى المراجعات' },
  'gov.detect_gaps':        { EN: 'Detect Gaps', AR: 'فحص الفجوات' },
  'gov.run_review':         { EN: 'Run AI Review', AR: 'تشغيل المراجعة' },
  'gov.upload_inputs':      { EN: 'Upload Inputs', AR: 'رفع المدخلات' },
  'gov.report':             { EN: 'Report', AR: 'التقرير' },
  'gov.review_type':        { EN: 'Review Type', AR: 'نوع المراجعة' },
  'gov.review_title':       { EN: 'Review Title', AR: 'عنوان المراجعة' },
  'gov.project_name':       { EN: 'Project Name', AR: 'اسم المشروع' },
  'gov.completeness':       { EN: 'Completeness Score', AR: 'درجة الاكتمال' },
  'gov.gaps_found':         { EN: 'Gaps Found', AR: 'الفجوات المكتشفة' },
  'gov.findings':           { EN: 'Findings', AR: 'النتائج' },
  // Repository
  'repo.title':             { EN: 'EA Repository', AR: 'مستودع البنية المؤسسية' },
  'repo.new_asset':         { EN: '+ New Asset', AR: '+ أصل جديد' },
  'repo.asset_name':        { EN: 'Asset Name', AR: 'اسم الأصل' },
  'repo.asset_type':        { EN: 'Asset Type', AR: 'نوع الأصل' },
  'repo.no_assets':         { EN: 'No assets found', AR: 'لا توجد أصول' },
  'repo.upload':            { EN: 'Upload Document', AR: 'رفع وثيقة' },
  // Knowledge Base
  'kb.title':               { EN: 'Knowledge Base', AR: 'قاعدة المعرفة' },
  'kb.upload':              { EN: 'Upload Document', AR: 'رفع وثيقة' },
  'kb.no_docs':             { EN: 'No documents yet', AR: 'لا توجد وثائق بعد' },
  'kb.processing':          { EN: 'Processing...', AR: 'جارٍ المعالجة...' },
  // Dashboard
  'dash.title':             { EN: 'Dashboard', AR: 'لوحة التحكم' },
  'dash.welcome':           { EN: 'Welcome back', AR: 'مرحباً بعودتك' },
  'dash.active_cycles':     { EN: 'Active Cycles', AR: 'الدورات النشطة' },
  'dash.kb_documents':      { EN: 'KB Documents', AR: 'وثائق قاعدة المعرفة' },
  'dash.repo_assets':       { EN: 'Repository Assets', AR: 'أصول المستودع' },
  'dash.governance_reviews':{ EN: 'Governance Reviews', AR: 'مراجعات الحوكمة' },
  // Setup Assistant
  'setup.title':            { EN: '🏛 EA Readiness Setup Assistant', AR: '🏛 مساعد إعداد البنية المؤسسية' },
  'setup.step_of':          { EN: 'Step {n} of {total}', AR: 'الخطوة {n} من {total}' },
  'setup.complete':         { EN: '✓ Setup Complete', AR: '✓ تم الإعداد' },
  'setup.save_continue':    { EN: '💾 Save & Continue →', AR: '💾 حفظ والمتابعة →' },
}

// ── Missing key log (dev only) ───────────────────────────────────────────────
const missingKeys = new Set<string>()
const logMissing = (key: string, locale: Locale) => {
  if (process.env.NODE_ENV === 'development' && !missingKeys.has(key)) {
    missingKeys.add(key)
    console.warn(`[i18n] Missing key "${key}" for locale ${locale}`)
  }
}

// ── Terminology dictionary (loaded from API) ─────────────────────────────────
type TermDict = Record<string, { en: string; ar: string; arNorm: string }>

interface LangCtx {
  locale: Locale
  isAR: boolean
  setLocale: (l: Locale) => void
  t: (key: string) => string
  term: (termKey: string) => string   // resolve from terminology dictionary
  resolveText: (text: string) => string  // normalize raw text (AI output etc)
  termDict: TermDict
}

const Ctx = createContext<LangCtx>({
  locale: 'AR',
  isAR: true,
  setLocale: () => {},
  t: (k) => k,
  term: (k) => k,
  resolveText: (t) => t,
  termDict: {},
})

export const useLang = () => useContext(Ctx)

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => (localStorage.getItem('ea_locale') as Locale) || 'AR')
  const [termDict, setTermDict] = useState<TermDict>({})
  const termDictRef = useRef<TermDict>({})

  // ── Apply document direction + font ────────────────────────────────────────
  const applyDirection = useCallback((l: Locale) => {
    const isAr = l === 'AR'
    document.documentElement.dir = isAr ? 'rtl' : 'ltr'
    document.documentElement.lang = isAr ? 'ar' : 'en'
    document.documentElement.style.setProperty('--doc-direction', isAr ? 'rtl' : 'ltr')
    document.documentElement.style.setProperty('--text-align-start', isAr ? 'right' : 'left')
    document.documentElement.style.setProperty('--text-align-end', isAr ? 'left' : 'right')
  }, [])

  // ── Load terminology dictionary from API ────────────────────────────────────
  const loadTermDict = useCallback(async () => {
    try {
      const token = localStorage.getItem('ea_token')
      if (!token) return
      const res = await fetch(`${API_URL}/localization/ui-dictionary`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.ok) {
        const dict = await res.json()
        setTermDict(dict)
        termDictRef.current = dict
      }
    } catch { /* silent */ }
  }, [])

  // ── On mount: apply direction + load terminology ────────────────────────────
  useEffect(() => {
    applyDirection(locale)
    loadTermDict()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── On locale change: re-apply direction ───────────────────────────────────
  useEffect(() => {
    applyDirection(locale)
  }, [locale, applyDirection])

  // ── Listen for token availability (login) ─────────────────────────────────
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'ea_token' && e.newValue) loadTermDict()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [loadTermDict])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('ea_locale', l)
    applyDirection(l)
  }, [applyDirection])

  // ── t(): resolve translation key ───────────────────────────────────────────
  // Priority: terminology dict → static table → log missing → NEVER cross-language
  const t = useCallback((key: string): string => {
    // 1. Check terminology dictionary (termKey format)
    const dictEntry = termDictRef.current[key]
    if (dictEntry) return locale === 'AR' ? (dictEntry.arNorm || dictEntry.ar) : dictEntry.en

    // 2. Check static translation table
    const entry = TRANSLATIONS[key]
    if (entry) return entry[locale]

    // 3. Log missing — return key as placeholder (never cross-language)
    logMissing(key, locale)
    return `[${key}]`
  }, [locale])

  // ── term(): resolve EA terminology by termKey ──────────────────────────────
  const term = useCallback((termKey: string): string => {
    const entry = termDictRef.current[termKey]
    if (!entry) return `[term:${termKey}]`
    return locale === 'AR' ? (entry.arNorm || entry.ar) : entry.en
  }, [locale])

  // ── resolveText(): normalize raw text (AI output, metadata) ───────────────
  // Replaces known English EA terms with preferred terminology in current locale
  const resolveText = useCallback((text: string): string => {
    if (!text) return text
    let resolved = text
    const dict = termDictRef.current
    if (locale === 'AR') {
      // Replace English terms with Arabic normalized terms
      for (const [, entry] of Object.entries(dict)) {
        if (entry.en && entry.arNorm) {
          resolved = resolved.replace(new RegExp(entry.en, 'gi'), entry.arNorm)
        }
      }
    }
    return resolved
  }, [locale])

  const isAR = locale === 'AR'

  return (
    <Ctx.Provider value={{ locale, isAR, setLocale, t, term, resolveText, termDict }}>
      {children}
    </Ctx.Provider>
  )
}
