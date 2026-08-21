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
  // Strategy module
  'strategy.title':          { EN: 'Strategy', AR: 'الاستراتيجية' },
  'strategy.subtitle':       { EN: 'Strategic goals, capability alignment, and gap analysis', AR: 'الأهداف الاستراتيجية، مواءمة القدرات، وتحليل الفجوات' },
  'strategy.new':            { EN: '+ New Strategy', AR: '+ استراتيجية جديدة' },
  'strategy.name_en':        { EN: 'Name (EN)', AR: 'الاسم (إنجليزي)' },
  'strategy.name_ar':        { EN: 'Name (AR)', AR: 'الاسم (عربي)' },
  'strategy.type':           { EN: 'Type', AR: 'النوع' },
  'strategy.timeframe':      { EN: 'Timeframe', AR: 'الإطار الزمني' },
  'strategy.vision':         { EN: 'Vision', AR: 'الرؤية' },
  'strategy.description':    { EN: 'Description', AR: 'الوصف' },
  'strategy.create':         { EN: 'Create', AR: 'إنشاء' },
  'strategy.creating':       { EN: 'Creating…', AR: 'جارٍ الإنشاء…' },
  'strategy.cancel':         { EN: 'Cancel', AR: 'إلغاء' },
  'strategy.delete':         { EN: 'Delete', AR: 'حذف' },
  'strategy.no_strategies':  { EN: 'No strategies yet. Create one to start mapping goals to EA capabilities.', AR: 'لا توجد استراتيجيات بعد. أنشئ واحدة لبدء ربط الأهداف بقدرات البنية المؤسسية.' },
  'strategy.tab_overview':   { EN: '📋 Overview', AR: '📋 نظرة عامة' },
  'strategy.tab_goals':      { EN: '🎯 Goals', AR: '🎯 الأهداف' },
  'strategy.tab_gap':        { EN: '📊 Gap Score', AR: '📊 تقييم الفجوة' },
  'strategy.tab_matrix':     { EN: '🗺 Alignment Matrix', AR: '🗺 مصفوفة المواءمة' },
  'strategy.add_goal':       { EN: '+ Add Goal', AR: '+ إضافة هدف' },
  'strategy.goal_title':     { EN: 'Title', AR: 'العنوان' },
  'strategy.goal_title_ar':  { EN: 'Title (AR)', AR: 'العنوان (عربي)' },
  'strategy.saving':         { EN: 'Saving…', AR: 'جارٍ الحفظ…' },
  'strategy.no_pillar':      { EN: 'No pillar', AR: 'بدون محور' },
  'strategy.target':         { EN: 'Target', AR: 'الهدف' },
  'strategy.cap_alignments': { EN: 'capability alignment(s)', AR: 'مواءمة قدرة (قدرات)' },
  'strategy.pillar':         { EN: 'Pillar', AR: 'المحور' },
  'strategy.target_year':    { EN: 'Target Year', AR: 'السنة المستهدفة' },
  'strategy.kpis':           { EN: 'KPIs (comma-separated)', AR: 'مؤشرات الأداء (مفصولة بفواصل)' },
  'strategy.no_goals':       { EN: 'No goals defined yet.', AR: 'لم يتم تحديد أهداف بعد.' },
  'strategy.manage_align':   { EN: 'Manage Alignments', AR: 'إدارة المواءمات' },
  'strategy.collapse':       { EN: 'Collapse', AR: 'طي' },
  'strategy.current_align':  { EN: 'Current Alignments', AR: 'المواءمات الحالية' },
  'strategy.no_align':       { EN: 'No capabilities aligned yet.', AR: 'لم يتم مواءمة أي قدرات بعد.' },
  'strategy.add_manual':     { EN: 'Add capability manually…', AR: 'إضافة قدرة يدويًا…' },
  'strategy.add':            { EN: 'Add', AR: 'إضافة' },
  'strategy.remove':         { EN: 'Remove', AR: 'إزالة' },
  'strategy.suggest_ai':     { EN: '✨ AI-Suggest Alignments', AR: '✨ اقتراح المواءمات بالذكاء الاصطناعي' },
  'strategy.analyzing':      { EN: '⏳ Analyzing…', AR: '⏳ جارٍ التحليل…' },
  'strategy.confirm':        { EN: 'Confirm', AR: 'تأكيد' },
  'strategy.recalculate':    { EN: '🔄 Recalculate', AR: '🔄 إعادة الحساب' },
  'strategy.overall_score':  { EN: 'Overall Score', AR: 'النتيجة الإجمالية' },
  'strategy.strong_goals':   { EN: 'Strong Goals', AR: 'أهداف قوية' },
  'strategy.goals_gaps':     { EN: 'Goals with Gaps', AR: 'أهداف بها فجوات' },
  'nav.settings':       { EN: 'Settings', AR: 'الإعدادات' },
  'setup.org_name_en':  { EN: 'Organization Name (EN)', AR: 'اسم المنظمة (إنجليزي)' },
  'setup.sector':       { EN: 'Sector', AR: 'القطاع' },
  'setup.entity_type':  { EN: 'Entity Type', AR: 'نوع الجهة' },
  'setup.language':     { EN: 'Platform Language', AR: 'لغة المنصة' },
  'setup.maturity':     { EN: 'EA Maturity Level (1-5)', AR: 'مستوى نضج البنية المؤسسية (1-5)' },
  'setup.framework':    { EN: 'Reference Framework', AR: 'الإطار المرجعي' },
  'setup.domains':      { EN: 'Architecture Domains in Scope', AR: 'المجالات المعمارية في النطاق' },
  'adm.title':          { EN: 'ADM Cycles', AR: 'دورات تطوير البنية المؤسسية' },
  'adm.new':            { EN: '+ New Cycle', AR: '+ دورة جديدة' },
  'auth.tagline':       { EN: 'Enterprise Architecture Platform', AR: 'منصة البنية المؤسسية' },
  'auth.organization':  { EN: 'Organization ID', AR: 'معرف المنظمة' },
  'dash.status':        { EN: 'System Operational', AR: 'النظام يعمل' },
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

  // ── Governance ────────────────────────────────────────────────────────────
  'gov.dashboard':            { EN: 'Governance Reviews', AR: 'مراجعات الحوكمة' },
  'gov.reviews':              { EN: 'Reviews', AR: 'المراجعات' },
  'gov.new_review':           { EN: '+ New Review', AR: '+ مراجعة جديدة' },
  'gov.start_review':         { EN: 'Start an architecture governance review', AR: 'ابدأ مراجعة حوكمة البنية المؤسسية' },
  'gov.review_now':           { EN: 'Review Now', AR: 'راجع الآن' },
  'gov.view_all':             { EN: 'View All', AR: 'عرض الكل' },
  'gov.pending':              { EN: 'Pending', AR: 'معلّقة' },
  'gov.completed':            { EN: 'Completed', AR: 'مكتملة' },
  'gov.total_reviews':        { EN: 'Total Reviews', AR: 'إجمالي المراجعات' },
  'gov.avg_score':            { EN: 'Avg Score', AR: 'متوسط النتيجة' },
  'gov.decision_breakdown':   { EN: 'Decision Breakdown', AR: 'توزيع القرارات' },
  'gov.score_trend':          { EN: 'Score Trend', AR: 'اتجاه النتائج' },
  'gov.last_n':               { EN: 'Last {n}', AR: 'آخر {n}' },
  'gov.recent_reviews':       { EN: 'Recent Reviews', AR: 'المراجعات الأخيرة' },
  'gov.reviews_pending_action': { EN: 'reviews pending action', AR: 'مراجعات تنتظر الإجراء' },
  // Report sections
  'gov.summary':              { EN: 'Summary', AR: 'الملخص' },
  'gov.findings':             { EN: 'Findings', AR: 'الملاحظات' },
  'gov.domains':              { EN: 'Domains', AR: 'المجالات' },
  'gov.strategic':            { EN: 'Strategic', AR: 'الاستراتيجي' },
  'gov.compliance':           { EN: 'Compliance', AR: 'الامتثال' },
  'gov.risk_register':        { EN: 'Risk Register', AR: 'سجل المخاطر' },
  'gov.future_state':         { EN: 'Future State', AR: 'الحالة المستقبلية' },
  'gov.financial':            { EN: 'Financial', AR: 'المالي' },
  'gov.executive_summary':    { EN: 'Executive Summary', AR: 'الملخص التنفيذي' },
  'gov.mandatory_actions':    { EN: 'Mandatory Actions', AR: 'الإجراءات الإلزامية' },
  'gov.recommended_actions':  { EN: 'Recommended Actions', AR: 'الإجراءات الموصى بها' },
  'gov.immediate_blockers':   { EN: 'Immediate Blockers', AR: 'العوائق الفورية' },
  'gov.score_tips':           { EN: 'Score Improvement Tips', AR: 'نصائح تحسين النتيجة' },
  'gov.group_by':             { EN: 'Group by:', AR: 'تجميع حسب:' },
  'gov.domain':               { EN: 'Domain', AR: 'المجال' },
  'gov.severity':             { EN: 'Severity', AR: 'الخطورة' },
  'gov.clear_filters':        { EN: '✕ Clear filters', AR: '✕ مسح التصفية' },
  'gov.no_findings':          { EN: 'No findings', AR: 'لا توجد ملاحظات' },
  'gov.total_findings':       { EN: 'total findings', AR: 'إجمالي الملاحظات' },
  // Decisions
  'gov.approved':             { EN: 'Approved', AR: 'معتمد' },
  'gov.rejected':             { EN: 'Rejected', AR: 'مرفوض' },
  'gov.conditional':          { EN: 'Approved with Conditions', AR: 'معتمد بشروط' },
  'gov.requires_changes':     { EN: 'Requires Changes', AR: 'يتطلب تعديلات' },
  'gov.requires_exception':   { EN: 'Requires Exception', AR: 'يتطلب استثناء' },
  // Review types
  'gov.hld_review':           { EN: 'HLD Review', AR: 'مراجعة التصميم رفيع المستوى' },
  'gov.lld_review':           { EN: 'LLD Review', AR: 'مراجعة التصميم تفصيلي المستوى' },
  // Compliance
  'gov.compliant':            { EN: '✓ Compliant', AR: '✓ ممتثل' },
  'gov.non_compliant':        { EN: '✗ Non-Compliant', AR: '✗ غير ممتثل' },
  'gov.partial':              { EN: '⚠ Partial', AR: '⚠ جزئي' },
  'gov.exception':            { EN: '⚡ Exception', AR: '⚡ استثناء' },
  'gov.na':                   { EN: '— N/A', AR: '— غير منطبق' },
  'gov.evidence':             { EN: 'Evidence', AR: 'الدليل' },
  'gov.gap':                  { EN: 'Gap', AR: 'الفجوة' },
  'gov.recommendation':       { EN: 'Recommendation', AR: 'التوصية' },
  'gov.items_assessed':       { EN: 'items assessed', AR: 'عنصر تم تقييمه' },

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
  // Copilot
  'copilot.title':       { EN: 'AI Copilot', AR: 'المساعد الذكي' },
  'copilot.subtitle':    { EN: 'Architecture Intelligence Assistant', AR: 'مساعد ذكاء البنية المؤسسية' },
  'copilot.ready':       { EN: 'Ready to assist', AR: 'جاهز للمساعدة' },
  'copilot.hint':        { EN: 'Ask about your architecture, frameworks, or best practices', AR: 'اسأل عن بنيتك المؤسسية أو الأطر المرجعية أو أفضل الممارسات' },
  'copilot.placeholder': { EN: 'Ask anything about your architecture...', AR: 'اسأل أي سؤال عن بنيتك المؤسسية...' },
  'copilot.q1':          { EN: 'What is NORA 2.0?', AR: 'ما هو إطار نورا 2.0؟' },
  'copilot.q2':          { EN: 'How to start an ADM cycle?', AR: 'كيف أبدأ دورة ADM؟' },
  'copilot.q3':          { EN: 'What are EA principles?', AR: 'ما هي مبادئ البنية المؤسسية؟' },
  'copilot.send':        { EN: 'Send', AR: 'إرسال' },
  // ADM Phase names — NORA
  'phase.nora.1':        { EN: 'Scope Definition', AR: 'تحديد النطاق' },
  'phase.nora.2':        { EN: 'Current State', AR: 'تشخيص الراهن' },
  'phase.nora.3':        { EN: 'Strategic Direction', AR: 'التوجهات' },
  'phase.nora.4':        { EN: 'Future Design', AR: 'تصميم المستقبل' },
  'phase.nora.5':        { EN: 'Gap Analysis', AR: 'تحليل الفجوات' },
  'phase.nora.6':        { EN: 'Roadmap', AR: 'خارطة الطريق' },
  'phase.nora.7':        { EN: 'Requirements Mgmt', AR: 'إدارة المتطلبات' },
  // ADM Phase names — TOGAF
  'phase.togaf.PRELIM':  { EN: 'Preliminary', AR: 'التمهيد' },
  'phase.togaf.A':       { EN: 'Architecture Vision', AR: 'رؤية البنية' },
  'phase.togaf.B':       { EN: 'Business Architecture', AR: 'بنية الأعمال' },
  'phase.togaf.C':       { EN: 'Information Systems', AR: 'نظم المعلومات' },
  'phase.togaf.D':       { EN: 'Technology Architecture', AR: 'البنية التقنية' },
  'phase.togaf.E':       { EN: 'Opportunities & Solutions', AR: 'الفرص والحلول' },
  'phase.togaf.F':       { EN: 'Migration Planning', AR: 'تخطيط الترحيل' },
  'phase.togaf.G':       { EN: 'Implementation Governance', AR: 'حوكمة التنفيذ' },
  'phase.togaf.H':       { EN: 'Architecture Change Mgmt', AR: 'إدارة تغيير البنية' },
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
  // Innovation & Technology Advisory
  'nav.innovation':         { EN: 'Innovation', AR: 'الابتكار' },
  'innov.title':            { EN: 'Digital Innovation & Technology Advisory', AR: 'الابتكار الرقمي والاستشارات التقنية' },
  'innov.subtitle':         { EN: 'Track emerging technology and your organization\'s own adoption journey', AR: 'تتبّع التقنيات الناشئة ومسار تبنّي مؤسستك لها' },
  'innov.tab_radar':        { EN: '📡 Technology Radar', AR: '📡 رادار التقنيات' },
  'innov.tab_favorites':    { EN: '⭐ My Watchlist', AR: '⭐ قائمة المتابعة' },
  'innov.tab_profile':      { EN: '🏢 Organization Profile', AR: '🏢 الملف التعريفي للمؤسسة' },
  'innov.filter_category':  { EN: 'Category', AR: 'الفئة' },
  'innov.filter_market':    { EN: 'Market Position', AR: 'الموقع في السوق' },
  'innov.all_categories':   { EN: 'All categories', AR: 'جميع الفئات' },
  'innov.all_positions':    { EN: 'All positions', AR: 'جميع المواقع' },
  'innov.add_tech':         { EN: '+ Add Technology', AR: '+ إضافة تقنية' },
  'innov.seed':             { EN: '🌱 Load Starter Content', AR: '🌱 تحميل محتوى تمهيدي' },
  'innov.seeding':          { EN: 'Loading…', AR: 'جارٍ التحميل…' },
  'innov.no_items':         { EN: 'No technologies match these filters yet.', AR: 'لا توجد تقنيات مطابقة لهذه الفلاتر بعد.' },
  'innov.no_radar':         { EN: 'The Technology Radar is empty. Load the starter set to begin, or add your own.', AR: 'رادار التقنيات فارغ. حمّل المجموعة التمهيدية للبدء، أو أضف تقنياتك الخاصة.' },
  'innov.no_favorites':     { EN: 'You haven\'t marked any technologies as favorites yet. Star one from the radar to track it here.', AR: 'لم تقم بتمييز أي تقنية كمفضلة بعد. ضع نجمة على تقنية من الرادار لمتابعتها هنا.' },
  'innov.back':             { EN: '← Back to Radar', AR: '→ العودة إلى الرادار' },
  'innov.maturity':         { EN: 'Maturity', AR: 'مستوى النضج' },
  'innov.market_position':  { EN: 'Market Position', AR: 'الموقع في السوق' },
  'innov.my_status':        { EN: 'My Organization\'s Status', AR: 'حالة مؤسستي' },
  'innov.tenant_status':    { EN: 'Adoption Status', AR: 'حالة التبنّي' },
  'innov.favorite':         { EN: 'Favorite', AR: 'مفضلة' },
  'innov.watching':         { EN: 'Watching', AR: 'قيد المتابعة' },
  'innov.notes':            { EN: 'Notes', AR: 'ملاحظات' },
  'innov.save_status':      { EN: 'Save My Status', AR: 'حفظ الحالة' },
  'innov.saving':           { EN: 'Saving…', AR: 'جارٍ الحفظ…' },
  'innov.not_assessed':     { EN: 'Not assessed yet', AR: 'لم يتم التقييم بعد' },
  'innov.description':      { EN: 'Description', AR: 'الوصف' },
  'innov.use_cases':        { EN: 'Typical Use Cases', AR: 'حالات الاستخدام النموذجية' },
  'innov.benefits':         { EN: 'Benefits', AR: 'الفوائد' },
  'innov.risks':            { EN: 'Key Risks', AR: 'المخاطر الرئيسية' },
  'innov.capabilities':     { EN: 'Required Capabilities', AR: 'القدرات المطلوبة' },
  'innov.evidence':         { EN: 'Source', AR: 'المصدر' },
  'innov.edit':             { EN: 'Edit', AR: 'تعديل' },
  'innov.deactivate':       { EN: 'Deactivate', AR: 'إلغاء التفعيل' },
  'innov.deactivate_confirm': { EN: 'Hide this technology from the radar? Your organization\'s history for it will be kept.', AR: 'إخفاء هذه التقنية من الرادار؟ سيتم الاحتفاظ بسجل مؤسستك الخاص بها.' },
  'innov.name_en':          { EN: 'Name (EN)', AR: 'الاسم (إنجليزي)' },
  'innov.name_ar':          { EN: 'Name (AR)', AR: 'الاسم (عربي)' },
  'innov.code':             { EN: 'Code', AR: 'الرمز' },
  'innov.create':           { EN: 'Create', AR: 'إنشاء' },
  'innov.save':             { EN: 'Save', AR: 'حفظ' },
  'innov.cancel':           { EN: 'Cancel', AR: 'إلغاء' },
  'innov.profile_title':    { EN: 'Organization Context', AR: 'سياق المؤسسة' },
  'innov.profile_desc':     { EN: 'This context helps ground future AI-generated consultation studies in your organization\'s real sector, size, and priorities — instead of generic advice.', AR: 'يساعد هذا السياق في تأسيس دراسات الاستشارة المستقبلية المُولّدة بالذكاء الاصطناعي على واقع قطاع مؤسستك وحجمها وأولوياتها، بدلاً من نصائح عامة.' },
  'innov.industry':         { EN: 'Industry', AR: 'القطاع' },
  'innov.org_size':         { EN: 'Organization Size', AR: 'حجم المؤسسة' },
  'innov.mandate':          { EN: 'Primary Mandate', AR: 'المهمة الرئيسية' },
  'innov.short_desc':       { EN: 'Short Description', AR: 'وصف مختصر' },
  'innov.domains':          { EN: 'Domains in Scope (comma-separated)', AR: 'المجالات ضمن النطاق (مفصولة بفواصل)' },
  'innov.constraints':      { EN: 'Constraints (one per line, key: value)', AR: 'القيود (سطر واحد لكل عنصر، المفتاح: القيمة)' },
  'innov.save_profile':     { EN: 'Save Profile', AR: 'حفظ الملف التعريفي' },
  'innov.readonly_notice':  { EN: 'Only a Tenant Admin can edit the organization profile.', AR: 'يمكن لمسؤول المؤسسة فقط تعديل الملف التعريفي.' },
  'innov.saved':            { EN: 'Saved', AR: 'تم الحفظ' },
  'innov.tab_ideas':        { EN: '💡 Ideas', AR: '💡 الأفكار' },
  'innov.submit_idea':      { EN: '+ Submit Idea', AR: '+ تقديم فكرة' },
  'innov.all_statuses':     { EN: 'All statuses', AR: 'جميع الحالات' },
  'innov.no_ideas':         { EN: 'No ideas submitted yet. Be the first to suggest one.', AR: 'لم تُقدَّم أي أفكار بعد. كن أول من يقترح فكرة.' },
  'innov.idea_title':       { EN: 'Title (EN)', AR: 'العنوان (إنجليزي)' },
  'innov.idea_title_ar':    { EN: 'Title (AR)', AR: 'العنوان (عربي)' },
  'innov.idea_description': { EN: 'Description', AR: 'الوصف' },
  'innov.related_tech':     { EN: 'Related Technology (optional)', AR: 'التقنية ذات الصلة (اختياري)' },
  'innov.none':             { EN: 'None', AR: 'لا يوجد' },
  'innov.tags':             { EN: 'Tags (comma-separated)', AR: 'الوسوم (مفصولة بفواصل)' },
  'innov.submit':           { EN: 'Submit', AR: 'تقديم' },
  'innov.back_to_ideas':    { EN: '← Back to Ideas', AR: '→ العودة إلى الأفكار' },
  'innov.ai_qualification': { EN: 'AI Qualification', AR: 'تقييم الذكاء الاصطناعي' },
  'innov.qualify':          { EN: 'Qualify with AI', AR: 'تقييم بالذكاء الاصطناعي' },
  'innov.requalify':        { EN: 'Re-qualify', AR: 'إعادة التقييم' },
  'innov.qualifying':       { EN: 'AI is qualifying this idea…', AR: 'الذكاء الاصطناعي يقيّم هذه الفكرة…' },
  'innov.not_qualified_yet':{ EN: 'Not yet qualified by AI.', AR: 'لم يتم تقييمها بالذكاء الاصطناعي بعد.' },
  'innov.feasibility':      { EN: 'Feasibility', AR: 'قابلية التنفيذ' },
  'innov.impact':           { EN: 'Impact', AR: 'الأثر' },
  'innov.alignment':        { EN: 'Alignment', AR: 'التوافق' },
  'innov.overall':          { EN: 'Overall', AR: 'الإجمالي' },
  'innov.rationale':        { EN: 'AI Rationale', AR: 'تبرير الذكاء الاصطناعي' },
  'innov.decision':         { EN: 'Decision', AR: 'القرار' },
  'innov.move_in_review':   { EN: 'Move to In Review', AR: 'نقل إلى قيد المراجعة' },
  'innov.decision_notes':   { EN: 'Decision Notes (optional)', AR: 'ملاحظات القرار (اختياري)' },
  'innov.approve':          { EN: 'Approve', AR: 'اعتماد' },
  'innov.reject':           { EN: 'Reject', AR: 'رفض' },
  'innov.archive':          { EN: 'Archive', AR: 'أرشفة' },
  'innov.decision_restricted': { EN: 'Only a Tenant Admin or Reviewer can approve, reject, or archive an idea.', AR: 'يمكن لمسؤول المؤسسة أو المراجع فقط اعتماد الفكرة أو رفضها أو أرشفتها.' },
  'innov.tab_studies':       { EN: '📑 Studies', AR: '📑 الدراسات' },
  'innov.new_study':         { EN: '+ New Study', AR: '+ دراسة جديدة' },
  'innov.no_studies':        { EN: 'No studies yet. Request one from a technology, an idea, or a business problem.', AR: 'لا توجد دراسات بعد. اطلب واحدة من تقنية أو فكرة أو مشكلة تجارية.' },
  'innov.study_title':       { EN: 'Study Title', AR: 'عنوان الدراسة' },
  'innov.study_title_ar':    { EN: 'Study Title (AR)', AR: 'عنوان الدراسة (عربي)' },
  'innov.objective':         { EN: 'Objective — what decision should this study support?', AR: 'الهدف — ما القرار الذي يجب أن تدعمه هذه الدراسة؟' },
  'innov.origin_type':       { EN: 'Study Subject', AR: 'موضوع الدراسة' },
  'innov.origin_radar':      { EN: 'A Technology Radar item', AR: 'عنصر من رادار التقنيات' },
  'innov.origin_idea':       { EN: 'An Innovation Idea', AR: 'فكرة ابتكارية' },
  'innov.origin_manual':     { EN: 'A technology I\'ll describe', AR: 'تقنية سأصفها' },
  'innov.origin_business_problem': { EN: 'A business problem/opportunity', AR: 'مشكلة/فرصة تجارية' },
  'innov.origin_ea_recommendation': { EN: 'An EA recommendation', AR: 'توصية من البنية المؤسسية' },
  'innov.origin_architecture_gap': { EN: 'An existing architecture gap', AR: 'فجوة معمارية قائمة' },
  'innov.select_radar_item': { EN: 'Select a technology…', AR: 'اختر تقنية…' },
  'innov.select_idea':       { EN: 'Select an idea…', AR: 'اختر فكرة…' },
  'innov.origin_description': { EN: 'Describe the subject', AR: 'صِف الموضوع' },
  'innov.scope':             { EN: 'Scope', AR: 'النطاق' },
  'innov.scope_standard':    { EN: 'Standard', AR: 'قياسي' },
  'innov.scope_executive':   { EN: 'Executive Summary Only', AR: 'ملخص تنفيذي فقط' },
  'innov.scope_detailed':    { EN: 'Detailed', AR: 'مفصّل' },
  'innov.create_study':      { EN: 'Create Study', AR: 'إنشاء الدراسة' },
  'innov.back_to_studies':   { EN: '← Back to Studies', AR: '→ رجوع إلى الدراسات' },
  'innov.generate_study':    { EN: '✨ Generate Study with AI', AR: '✨ إنشاء الدراسة بالذكاء الاصطناعي' },
  'innov.regenerate_study':  { EN: '🔄 Regenerate', AR: '🔄 إعادة الإنشاء' },
  'innov.generating':        { EN: 'Generating study content — this runs 5 staged AI passes and may take a minute…', AR: 'جارٍ إنشاء محتوى الدراسة — تعمل هذه العملية على 5 مراحل بالذكاء الاصطناعي وقد تستغرق دقيقة…' },
  'innov.not_generated_yet': { EN: 'This study has not been generated yet.', AR: 'لم يتم إنشاء هذه الدراسة بعد.' },
  'innov.generation_failed': { EN: 'Generation failed. You can try again.', AR: 'فشل الإنشاء. يمكنك المحاولة مرة أخرى.' },
  'innov.quality_score':     { EN: 'Quality Score', AR: 'درجة الجودة' },
  'innov.recommendation':    { EN: 'Recommendation', AR: 'التوصية' },
  'innov.assumptions':       { EN: 'Assumptions', AR: 'الافتراضات' },
  'innov.add_assumption':    { EN: '+ Add Assumption', AR: '+ إضافة افتراض' },
  'innov.assumption_label':  { EN: 'Label', AR: 'التسمية' },
  'innov.assumption_value':  { EN: 'Value', AR: 'القيمة' },
  'innov.no_assumptions':    { EN: 'No assumptions recorded yet.', AR: 'لا توجد افتراضات مسجلة بعد.' },
  'innov.study_status':      { EN: 'Status', AR: 'الحالة' },
  'innov.move_to_review':    { EN: 'Move to Under Review', AR: 'نقل إلى قيد المراجعة' },
  'innov.approve_study':     { EN: 'Approve', AR: 'اعتماد' },
  'innov.request_rework':    { EN: 'Request Rework', AR: 'طلب إعادة عمل' },
  'innov.delete_study':      { EN: 'Delete Study', AR: 'حذف الدراسة' },
  'innov.confirm_delete_study': { EN: 'Delete this study permanently?', AR: 'هل تريد حذف هذه الدراسة نهائيًا؟' },
  'innov.export_docx':        { EN: '⬇ Export Word', AR: '⬇ تصدير Word' },
  'innov.exporting':          { EN: 'Exporting…', AR: 'جارٍ التصدير…' },
  'innov.export_failed':      { EN: 'Export failed — the study may not be generated yet.', AR: 'فشل التصدير — قد لا تكون الدراسة قد أُنشئت بعد.' },
  'innov.convert_to_initiative': { EN: '🚀 Convert to Initiative', AR: '🚀 تحويل إلى مبادرة' },
  'innov.converting':         { EN: 'Converting…', AR: 'جارٍ التحويل…' },
  'innov.convert_confirm':    { EN: 'Convert this study into a real EA Plan initiative? This will move the study to Pilot/Initiative status.', AR: 'هل تريد تحويل هذه الدراسة إلى مبادرة حقيقية في خطط البنية المؤسسية؟ سينقل هذا الدراسة إلى حالة تجريبية/مبادرة.' },
  'innov.convert_success':    { EN: 'Converted — a new EA Plan was created from this study.', AR: 'تم التحويل — تم إنشاء خطة بنية مؤسسية جديدة من هذه الدراسة.' },
  'innov.convert_failed':     { EN: 'Conversion failed.', AR: 'فشل التحويل.' },
  'innov.related_objects':    { EN: 'Linked EA Objects', AR: 'كائنات البنية المؤسسية المرتبطة' },
  'innov.link_object':        { EN: '+ Link Object', AR: '+ ربط كائن' },
  'innov.no_relationships':   { EN: 'No linked EA objects yet.', AR: 'لا توجد كائنات مرتبطة بعد.' },
  'innov.related_object_type': { EN: 'Object Type', AR: 'نوع الكائن' },
  'innov.related_ea_asset':   { EN: 'EA Asset (capability, application, technology…)', AR: 'أصل في البنية المؤسسية (قدرة، تطبيق، تقنية…)' },
  'innov.related_adm_cycle':  { EN: 'ADM Cycle', AR: 'دورة تطوير البنية' },
  'innov.related_review':     { EN: 'Governance Review', AR: 'مراجعة الحوكمة' },
  'innov.related_plan':       { EN: 'EA Plan', AR: 'خطة البنية المؤسسية' },
  'innov.related_strategy':   { EN: 'Strategy', AR: 'استراتيجية' },
  'innov.select_ea_asset':    { EN: 'Select an asset…', AR: 'اختر أصلاً…' },
  'innov.object_id':          { EN: 'Object ID', AR: 'معرّف الكائن' },
  'innov.link':               { EN: 'Link', AR: 'ربط' },
  'innov.confirm_unlink':     { EN: 'Remove this link?', AR: 'هل تريد إزالة هذا الرابط؟' },
  'innov.portfolio':          { EN: 'Innovation Portfolio', AR: 'محفظة الابتكار' },
  'innov.portfolio_ideas':    { EN: 'Ideas', AR: 'الأفكار' },
  'innov.portfolio_studies':  { EN: 'Studies', AR: 'الدراسات' },
  'innov.portfolio_avg_quality': { EN: 'Avg. Quality', AR: 'متوسط الجودة' },
  'innov.portfolio_funnel':   { EN: 'Innovation Funnel', AR: 'قمع الابتكار' },
  'innov.funnel_submitted':   { EN: 'Ideas Submitted', AR: 'أفكار مُقدَّمة' },
  'innov.funnel_qualified':   { EN: 'Qualified', AR: 'مؤهَّلة' },
  'innov.funnel_studies':     { EN: 'Studies Generated', AR: 'دراسات مُنشأة' },
  'innov.funnel_approved':    { EN: 'Approved', AR: 'معتمدة' },
  'innov.funnel_initiatives': { EN: 'Converted to Initiative', AR: 'حُوِّلت إلى مبادرة' },
  // Notifications
  'nav.notifications':      { EN: 'Notifications', AR: 'الإشعارات' },
  'notif.title':            { EN: 'Notifications', AR: 'الإشعارات' },
  'notif.subtitle':         { EN: 'Alerts and updates from across the platform, and the rules that generate them', AR: 'التنبيهات والتحديثات من جميع أنحاء المنصة، والقواعد التي تُنشئها' },
  'notif.bell_label':       { EN: 'Notifications', AR: 'الإشعارات' },
  'notif.no_notifications': { EN: 'No notifications yet', AR: 'لا توجد إشعارات بعد' },
  'notif.mark_all_read':    { EN: 'Mark all as read', AR: 'تحديد الكل كمقروء' },
  'notif.view_all':         { EN: 'View all', AR: 'عرض الكل' },
  'notif.tab_inbox':        { EN: '📥 Inbox', AR: '📥 الوارد' },
  'notif.tab_preferences':  { EN: '🔔 Preferences', AR: '🔔 التفضيلات' },
  'notif.tab_rules':        { EN: '⚙ Rules', AR: '⚙ القواعد' },
  'notif.tab_templates':    { EN: '📝 Templates', AR: '📝 القوالب' },
  'notif.tab_announce':     { EN: '📣 Send Announcement', AR: '📣 إرسال إعلان' },
  'notif.unread_only':      { EN: 'Unread only', AR: 'غير المقروء فقط' },
  'notif.all':              { EN: 'All', AR: 'الكل' },
  'notif.severity':         { EN: 'Severity', AR: 'الخطورة' },
  'notif.new_rule':         { EN: '+ New Rule', AR: '+ قاعدة جديدة' },
  'notif.rule_name':        { EN: 'Rule Name (EN)', AR: 'اسم القاعدة (إنجليزي)' },
  'notif.rule_name_ar':     { EN: 'Rule Name (AR)', AR: 'اسم القاعدة (عربي)' },
  'notif.event_type':       { EN: 'Event Type', AR: 'نوع الحدث' },
  'notif.event_type_hint':  { EN: 'e.g. governance.review.completed, or governance.* for all governance events', AR: 'مثال: governance.review.completed، أو governance.* لجميع أحداث الحوكمة' },
  'notif.recipient_type':   { EN: 'Recipient Type', AR: 'نوع المستلم' },
  'notif.recipient_individual': { EN: 'Specific Person', AR: 'شخص محدد' },
  'notif.recipient_role':   { EN: 'Everyone with a Role', AR: 'كل من لديه دور' },
  'notif.recipient':        { EN: 'Recipient', AR: 'المستلم' },
  'notif.channels':         { EN: 'Channels', AR: 'القنوات' },
  'notif.template_optional':{ EN: 'Template (optional)', AR: 'القالب (اختياري)' },
  'notif.no_template':      { EN: 'Default formatting', AR: 'التنسيق الافتراضي' },
  'notif.active':           { EN: 'Active', AR: 'مفعّلة' },
  'notif.inactive':         { EN: 'Inactive', AR: 'غير مفعّلة' },
  'notif.no_rules':         { EN: 'No notification rules yet. Create one so future platform events reach the right people.', AR: 'لا توجد قواعد إشعارات بعد. أنشئ واحدة لتصل أحداث المنصة المستقبلية إلى الأشخاص المناسبين.' },
  'notif.delete_rule_confirm': { EN: 'Delete this notification rule?', AR: 'حذف قاعدة الإشعار هذه؟' },
  'notif.new_template':     { EN: '+ New Template', AR: '+ قالب جديد' },
  'notif.template_name':    { EN: 'Template Name', AR: 'اسم القالب' },
  'notif.channel':          { EN: 'Channel', AR: 'القناة' },
  'notif.language':         { EN: 'Language', AR: 'اللغة' },
  'notif.title_template':   { EN: 'Title Template', AR: 'قالب العنوان' },
  'notif.body_template':    { EN: 'Body Template', AR: 'قالب النص' },
  'notif.template_hint':    { EN: 'Use {{VariableName}} for placeholders filled in from the event.', AR: 'استخدم {{VariableName}} لعناصر نائبة تُملأ من بيانات الحدث.' },
  'notif.no_templates':     { EN: 'No templates yet. Rules without a template use default formatting.', AR: 'لا توجد قوالب بعد. القواعد بدون قالب تستخدم التنسيق الافتراضي.' },
  'notif.announce_recipients': { EN: 'Recipients', AR: 'المستلمون' },
  'notif.announce_title':   { EN: 'Title', AR: 'العنوان' },
  'notif.announce_body':    { EN: 'Message', AR: 'الرسالة' },
  'notif.send':             { EN: 'Send Announcement', AR: 'إرسال الإعلان' },
  'notif.sending':          { EN: 'Sending…', AR: 'جارٍ الإرسال…' },
  'notif.sent':             { EN: 'Announcement sent', AR: 'تم إرسال الإعلان' },
  'notif.pref_intro':       { EN: 'Choose which channels you want to hear from for each severity level. Some severities may be required by your organization and cannot be turned off.', AR: 'اختر القنوات التي ترغب في تلقي التنبيهات عبرها لكل مستوى خطورة. قد تكون بعض المستويات إلزامية من قبل مؤسستك ولا يمكن إيقافها.' },
  'notif.muted_categories': { EN: 'Muted Categories (comma-separated event-type prefixes, e.g. adm.)', AR: 'الفئات المكتومة (بادئات أنواع الأحداث مفصولة بفواصل، مثال: adm.)' },
  'notif.save_preferences': { EN: 'Save Preferences', AR: 'حفظ التفضيلات' },
  'notif.create':           { EN: 'Create', AR: 'إنشاء' },
  'notif.save':             { EN: 'Save', AR: 'حفظ' },
  'notif.saving':           { EN: 'Saving…', AR: 'جارٍ الحفظ…' },
  'notif.cancel':           { EN: 'Cancel', AR: 'إلغاء' },
  'notif.delete':           { EN: 'Delete', AR: 'حذف' },
  'notif.edit':             { EN: 'Edit', AR: 'تعديل' },
  'notif.recipient_object_owner': { EN: 'Object Owner (dynamic)', AR: 'مالك الكائن (ديناميكي)' },
  'notif.object_owner_hint': { EN: 'The recipient is resolved automatically — whoever submitted/created the object this event is about.', AR: 'يتم تحديد المستلم تلقائيًا — الشخص الذي قدّم/أنشأ الكائن الذي يتعلق به هذا الحدث.' },
  'notif.template_library': { EN: '📚 Predefined Rule Templates', AR: '📚 قوالب القواعد الجاهزة' },
  'notif.activate':         { EN: 'Activate', AR: 'تفعيل' },
  'notif.activating':       { EN: 'Activating…', AR: 'جارٍ التفعيل…' },
  'notif.activated':        { EN: '✓ Activated', AR: '✓ مُفعَّل' },
  'notif.no_live_publisher': { EN: '(not yet wired)', AR: '(غير مُفعَّل بعد)' },
  'notif.no_live_publisher_hint': { EN: 'No ArchMind module publishes this event type yet — activating this template now means it will start working automatically once one does.', AR: 'لا توجد وحدة في archmind تنشر هذا النوع من الأحداث بعد — تفعيل هذا القالب الآن يعني أنه سيبدأ العمل تلقائيًا بمجرد إضافته.' },
  // Commercial / Billing
  'nav.billing':            { EN: 'Billing', AR: 'الفوترة' },
  'bill.title':             { EN: 'Billing & Subscription', AR: 'الفوترة والاشتراك' },
  'bill.subtitle':          { EN: 'Your organization\'s plan, usage allowances, and billing history', AR: 'خطة مؤسستك وحدود الاستخدام وسجل الفوترة' },
  'bill.tab_subscription':  { EN: '📦 My Subscription', AR: '📦 اشتراكي' },
  'bill.tab_plans':         { EN: '📋 Plans', AR: '📋 الخطط' },
  'bill.tab_invoices':      { EN: '🧾 Invoices', AR: '🧾 الفواتير' },
  'bill.tab_payments':      { EN: '💰 Payments', AR: '💰 المدفوعات' },
  'bill.tab_contracts':     { EN: '📄 Contracts', AR: '📄 العقود' },
  'bill.tab_catalog':       { EN: '🗂 Catalog', AR: '🗂 الكتالوج' },
  'bill.tab_admin_subs':    { EN: '🏢 Tenant Subscriptions', AR: '🏢 اشتراكات المستأجرين' },
  'bill.tab_admin_contracts': { EN: '📄 All Contracts', AR: '📄 جميع العقود' },
  'bill.tab_admin_payments': { EN: '💰 All Payments', AR: '💰 جميع المدفوعات' },
  'bill.tab_admin_invoices': { EN: '🧾 All Invoices', AR: '🧾 جميع الفواتير' },
  'bill.current_plan':      { EN: 'Current Plan', AR: 'الخطة الحالية' },
  'bill.status':            { EN: 'Status', AR: 'الحالة' },
  'bill.trial_ends':        { EN: 'Trial ends', AR: 'ينتهي التجريب في' },
  'bill.period_ends':       { EN: 'Current period ends', AR: 'تنتهي الفترة الحالية في' },
  'bill.no_subscription':   { EN: 'No subscription record yet for this organization.', AR: 'لا يوجد سجل اشتراك بعد لهذه المؤسسة.' },
  'bill.user_allowance':    { EN: 'User Allowance', AR: 'حد المستخدمين' },
  'bill.ai_credit_allowance': { EN: 'AI Credit Allowance', AR: 'حد رصيد الذكاء الاصطناعي' },
  'bill.unlimited':         { EN: 'Unlimited', AR: 'غير محدود' },
  'bill.enabled_modules':   { EN: 'Enabled Modules', AR: 'الوحدات المفعّلة' },
  'bill.no_modules':        { EN: 'No modules enabled — the subscription is not currently active.', AR: 'لا توجد وحدات مفعّلة — الاشتراك غير نشط حاليًا.' },
  'bill.auto_renew':        { EN: 'Auto-renews', AR: 'تجديد تلقائي' },
  'bill.no_plans':          { EN: 'No plans published yet.', AR: 'لا توجد خطط منشورة بعد.' },
  'bill.per_month':         { EN: '/month', AR: '/شهريًا' },
  'bill.per_year':          { EN: '/year', AR: '/سنويًا' },
  'bill.custom_pricing':    { EN: 'Custom pricing', AR: 'تسعير مخصص' },
  'bill.users_label':       { EN: 'users', AR: 'مستخدم' },
  'bill.ai_credits_label':  { EN: 'AI credits/mo', AR: 'رصيد ذكاء اصطناعي/شهريًا' },
  'bill.no_invoices':       { EN: 'No invoices yet.', AR: 'لا توجد فواتير بعد.' },
  'bill.no_payments':       { EN: 'No payments recorded yet.', AR: 'لا توجد مدفوعات مسجلة بعد.' },
  'bill.no_contracts':      { EN: 'No contracts yet.', AR: 'لا توجد عقود بعد.' },
  'bill.due':               { EN: 'Due', AR: 'الاستحقاق' },
  'bill.issued':            { EN: 'Issued', AR: 'صدرت في' },
  'bill.paid_on':           { EN: 'Paid on', AR: 'دُفعت في' },
  'bill.reference':         { EN: 'Reference', AR: 'المرجع' },
  'bill.po_number':         { EN: 'PO Number', AR: 'رقم أمر الشراء' },
  'bill.contract_value':    { EN: 'Value', AR: 'القيمة' },
  'bill.select_tenant':     { EN: 'Select a tenant', AR: 'اختر مستأجرًا' },
  'bill.choose_tenant':     { EN: 'Choose a tenant to manage its subscription…', AR: 'اختر مستأجرًا لإدارة اشتراكه…' },
  'bill.assign_plan':       { EN: 'Assign Plan', AR: 'تعيين خطة' },
  'bill.cancel_subscription': { EN: 'Cancel Subscription', AR: 'إلغاء الاشتراك' },
  'bill.reactivate':        { EN: 'Reactivate', AR: 'إعادة التفعيل' },
  'bill.cancel_reason':     { EN: 'Cancellation reason (optional)', AR: 'سبب الإلغاء (اختياري)' },
  'bill.confirm_cancel':    { EN: 'Cancel this tenant\'s subscription?', AR: 'هل تريد إلغاء اشتراك هذا المستأجر؟' },
  'bill.new_product':       { EN: '+ New Product', AR: '+ منتج جديد' },
  'bill.new_plan':          { EN: '+ New Plan', AR: '+ خطة جديدة' },
  'bill.code':              { EN: 'Code', AR: 'الرمز' },
  'bill.name_en':           { EN: 'Name (EN)', AR: 'الاسم (إنجليزي)' },
  'bill.name_ar':           { EN: 'Name (AR)', AR: 'الاسم (عربي)' },
  'bill.description':       { EN: 'Description', AR: 'الوصف' },
  'bill.category':          { EN: 'Category', AR: 'الفئة' },
  'bill.is_core':           { EN: 'Core (always included)', AR: 'أساسية (مضمّنة دائمًا)' },
  'bill.price_monthly':     { EN: 'Price / Month', AR: 'السعر / شهريًا' },
  'bill.price_yearly':      { EN: 'Price / Year', AR: 'السعر / سنويًا' },
  'bill.currency':          { EN: 'Currency', AR: 'العملة' },
  'bill.included_modules':  { EN: 'Included Modules (comma-separated codes)', AR: 'الوحدات المضمّنة (رموز مفصولة بفواصل)' },
  'bill.is_custom':         { EN: 'Custom / negotiated plan', AR: 'خطة مخصصة / متفاوض عليها' },
  'bill.new_contract':      { EN: '+ New Contract', AR: '+ عقد جديد' },
  'bill.contract_number':   { EN: 'Contract Number', AR: 'رقم العقد' },
  'bill.start_date':        { EN: 'Start Date', AR: 'تاريخ البدء' },
  'bill.end_date':          { EN: 'End Date', AR: 'تاريخ الانتهاء' },
  'bill.payment_terms':     { EN: 'Payment Terms', AR: 'شروط الدفع' },
  'bill.sla_tier':          { EN: 'SLA Tier', AR: 'مستوى اتفاقية الخدمة' },
  'bill.notes':             { EN: 'Notes', AR: 'ملاحظات' },
  'bill.activate':          { EN: 'Activate', AR: 'تفعيل' },
  'bill.terminate':         { EN: 'Terminate', AR: 'إنهاء' },
  'bill.record_payment':    { EN: '+ Record Payment', AR: '+ تسجيل دفعة' },
  'bill.amount':            { EN: 'Amount', AR: 'المبلغ' },
  'bill.method':            { EN: 'Method', AR: 'الطريقة' },
  'bill.paid_at':           { EN: 'Paid At', AR: 'تاريخ الدفع' },
  'bill.new_invoice':       { EN: '+ New Invoice', AR: '+ فاتورة جديدة' },
  'bill.invoice_number':    { EN: 'Invoice Number', AR: 'رقم الفاتورة' },
  'bill.due_date':          { EN: 'Due Date', AR: 'تاريخ الاستحقاق' },
  'bill.issue':             { EN: 'Issue', AR: 'إصدار' },
  'bill.void':              { EN: 'Void', AR: 'إلغاء' },
  'bill.tenant':             { EN: 'Tenant', AR: 'المستأجر' },
  'bill.create':            { EN: 'Create', AR: 'إنشاء' },
  'bill.save':              { EN: 'Save', AR: 'حفظ' },
  'bill.saving':            { EN: 'Saving…', AR: 'جارٍ الحفظ…' },
  'bill.cancel':            { EN: 'Cancel', AR: 'إلغاء' },
  'bill.filter_status':     { EN: 'Filter by status', AR: 'تصفية حسب الحالة' },
  'bill.all_statuses':      { EN: 'All statuses', AR: 'جميع الحالات' },
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


