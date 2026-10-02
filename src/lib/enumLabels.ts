/**
 * Display labels for status / type codes the API returns (HIGH, IN_PROGRESS, ...).
 *
 * A code is never shown raw: an English UI shows the English label and an
 * Arabic UI the Arabic one. Pages pass their own dictionary first when a code
 * means something specific to them; COMMON_ENUM_LABELS covers codes shared
 * across modules.
 */
export type BiLabel = { en: string; ar: string }

export const COMMON_ENUM_LABELS: Record<string, BiLabel> = {
  // Severity / level / confidence
  CRITICAL: { en: 'Critical', ar: 'حرج' },
  HIGH: { en: 'High', ar: 'عالٍ' },
  MEDIUM: { en: 'Medium', ar: 'متوسط' },
  LOW: { en: 'Low', ar: 'منخفض' },
  INFO: { en: 'Info', ar: 'معلومة' },
  NONE: { en: 'None', ar: 'لا يوجد' },
  // Work status
  DRAFT: { en: 'Draft', ar: 'مسودة' },
  PENDING: { en: 'Pending', ar: 'قيد الانتظار' },
  PLANNED: { en: 'Planned', ar: 'مخطط' },
  IN_PROGRESS: { en: 'In Progress', ar: 'قيد التنفيذ' },
  RUNNING: { en: 'Running', ar: 'قيد التشغيل' },
  PROCESSING: { en: 'Processing', ar: 'قيد المعالجة' },
  COMPLETED: { en: 'Completed', ar: 'مكتمل' },
  DONE: { en: 'Done', ar: 'منجز' },
  FAILED: { en: 'Failed', ar: 'فشل' },
  CANCELLED: { en: 'Cancelled', ar: 'ملغى' },
  ACTIVE: { en: 'Active', ar: 'نشط' },
  INACTIVE: { en: 'Inactive', ar: 'غير نشط' },
  ARCHIVED: { en: 'Archived', ar: 'مؤرشف' },
  OPEN: { en: 'Open', ar: 'مفتوح' },
  CLOSED: { en: 'Closed', ar: 'مغلق' },
  RESOLVED: { en: 'Resolved', ar: 'تمت المعالجة' },
  ACCEPTED: { en: 'Accepted', ar: 'مقبول' },
  SUBMITTED: { en: 'Submitted', ar: 'مُقدَّم' },
  UNDER_REVIEW: { en: 'Under Review', ar: 'قيد المراجعة' },
  IN_REVIEW: { en: 'In Review', ar: 'قيد المراجعة' },
  APPROVED: { en: 'Approved', ar: 'معتمد' },
  REJECTED: { en: 'Rejected', ar: 'مرفوض' },
  CONFIRMED: { en: 'Confirmed', ar: 'مؤكَّد' },
  SUGGESTED: { en: 'Suggested', ar: 'مقترح' },
  EDITED: { en: 'Edited', ar: 'معدَّل' },
  PUBLISHED: { en: 'Published', ar: 'منشور' },
  GENERATING: { en: 'Generating', ar: 'قيد الإنشاء' },
  AI_DRAFT: { en: 'AI Draft', ar: 'مسودة الذكاء الاصطناعي' },
  // Compliance
  COMPLIANT: { en: 'Compliant', ar: 'ممتثل' },
  PARTIALLY_COMPLIANT: { en: 'Partially Compliant', ar: 'ممتثل جزئياً' },
  NON_COMPLIANT: { en: 'Non-Compliant', ar: 'غير ممتثل' },
  REQUIRES_EXCEPTION: { en: 'Requires Exception', ar: 'يتطلب استثناء' },
  NOT_APPLICABLE: { en: 'Not Applicable', ar: 'غير منطبق' },
  RECOMMENDED: { en: 'Recommended', ar: 'موصى به' },
  EXCEPTION: { en: 'Exception', ar: 'استثناء' },
  EXCEPTION_REQUESTED: { en: 'Exception Requested', ar: 'طُلب استثناء' },
  PENDING_APPROVAL: { en: 'Pending Approval', ar: 'بانتظار الاعتماد' },
  EXECUTED: { en: 'Executed', ar: 'منفَّذ' },
  GOVERNANCE_REVIEW: { en: 'Governance Review', ar: 'مراجعة الحوكمة' },
  DECISION_EVALUATION: { en: 'Decision & Evaluation', ar: 'القرار والتقييم' },
  INNOVATION: { en: 'Innovation', ar: 'الابتكار' },
  ADM: { en: 'ADM', ar: 'ADM' },
  BLOCKING: { en: 'Blocking', ar: 'مانع' },
  WARNING: { en: 'Warning', ar: 'تحذير' },
  KEEP: { en: 'Keep', ar: 'إبقاء' },
  REVOKE: { en: 'Revoke', ar: 'سحب' },
  // Governance decisions
  APPROVED_WITH_CONDITIONS: { en: 'Approved with Conditions', ar: 'معتمد بشروط' },
  REQUIRES_CHANGES: { en: 'Requires Changes', ar: 'يتطلب تعديلات' },
  // Pilot outcomes
  ADOPT: { en: 'Adopt', ar: 'تبنّي' },
  SCALE: { en: 'Scale', ar: 'توسّع' },
  REASSESS: { en: 'Reassess', ar: 'إعادة التقييم' },
  HOLD: { en: 'Hold', ar: 'إيقاف مؤقت' },
  STOP: { en: 'Stop', ar: 'إيقاف' },
  // Evidence signal types
  RESEARCH: { en: 'Research', ar: 'بحث' },
  MARKET: { en: 'Market', ar: 'السوق' },
  ADOPTION: { en: 'Adoption', ar: 'التبنّي' },
  REGULATORY: { en: 'Regulatory', ar: 'تنظيمي' },
  STANDARD: { en: 'Standard', ar: 'معيار' },
  VENDOR: { en: 'Vendor', ar: 'مورّد' },
  ACADEMIC: { en: 'Academic', ar: 'أكاديمي' },
  GOVERNMENT: { en: 'Government', ar: 'حكومي' },
  IMPLEMENTATION: { en: 'Implementation', ar: 'تنفيذ' },
  INTERNAL: { en: 'Internal', ar: 'داخلي' },
  // Requirement / work-item types
  STRATEGIC: { en: 'Strategic', ar: 'استراتيجي' },
  BUSINESS: { en: 'Business', ar: 'أعمال' },
  ARCHITECTURE: { en: 'Architecture', ar: 'معماري' },
  INTEGRATION: { en: 'Integration', ar: 'تكامل' },
  DATA: { en: 'Data', ar: 'بيانات' },
  SECURITY: { en: 'Security', ar: 'أمن' },
  TECHNOLOGY: { en: 'Technology', ar: 'تقنية' },
  GOVERNANCE: { en: 'Governance', ar: 'حوكمة' },
  COMPLIANCE: { en: 'Compliance', ar: 'امتثال' },
  TRANSFORMATION: { en: 'Transformation', ar: 'تحول' },
  OPERATIONAL: { en: 'Operational', ar: 'تشغيلي' },
  APPLICATION: { en: 'Application', ar: 'تطبيقات' },
  INFRASTRUCTURE: { en: 'Infrastructure', ar: 'البنية التحتية' },
  PROPOSED: { en: 'Proposed', ar: 'مقترح' },
  IMPLEMENTED: { en: 'Implemented', ar: 'منفَّذ' },
  DEFERRED: { en: 'Deferred', ar: 'مؤجَّل' },
  RETIRED: { en: 'Retired', ar: 'متقاعد' },
  // NORA architecture domains
  BUSINESS_ARCHITECTURE: { en: 'Business Architecture', ar: 'معمارية الأعمال' },
  BENEFICIARY_EXPERIENCE: { en: 'Beneficiary Experience', ar: 'تجربة المستفيد' },
  APPLICATION_INTEGRATION: { en: 'Application & Integration', ar: 'التطبيقات والتكامل' },
  DATA_ARCHITECTURE: { en: 'Data Architecture', ar: 'معمارية البيانات' },
  SECURITY_ARCHITECTURE: { en: 'Security Architecture', ar: 'معمارية الأمن' },
  // Governance review types
  HLD_REVIEW: { en: 'HLD Review', ar: 'مراجعة التصميم رفيع المستوى' },
  LLD_REVIEW: { en: 'LLD Review', ar: 'مراجعة التصميم التفصيلي' },
  SOLUTION_DESIGN: { en: 'Solution Design Review', ar: 'مراجعة تصميم الحل' },
  NEW_PROJECT: { en: 'New Project Review', ar: 'مراجعة مشروع جديد' },
  RFP_SOW: { en: 'RFP / SOW Review', ar: 'مراجعة كراسة الشروط / نطاق العمل' },
  CHANGE_REQUEST: { en: 'Change Request Review', ar: 'مراجعة طلب تغيير' },
  CAB_REVIEW: { en: 'CAB Review', ar: 'مراجعة مجلس استشارات التغيير' },
  DIGITAL_INITIATIVE: { en: 'Digital Initiative Review', ar: 'مراجعة مبادرة رقمية' },
  TECHNICAL_PROPOSAL: { en: 'Technical Proposal Review', ar: 'مراجعة عرض فني' },
  BUSINESS_DEMAND: { en: 'Business Demand Review', ar: 'مراجعة طلب أعمال' },
  READY_FOR_REVIEW: { en: 'Ready for Review', ar: 'جاهزة للمراجعة' },
  // Frameworks
  NORA: { en: 'NORA', ar: 'نورة' },
  NORA_2_0: { en: 'NORA 2.0', ar: 'نورة 2.0' },
  TOGAF: { en: 'TOGAF', ar: 'TOGAF' },
  TOGAF_10: { en: 'TOGAF 10', ar: 'TOGAF 10' },
  CUSTOM: { en: 'Custom', ar: 'مخصص' },
  // Platform roles
  SUPERADMIN: { en: 'Super Admin', ar: 'مدير المنصة' },
  TENANT_ADMIN: { en: 'Tenant Admin', ar: 'مدير الجهة' },
  ARCHITECT: { en: 'Architect', ar: 'معماري' },
  REVIEWER: { en: 'Reviewer', ar: 'مراجع' },
  // Relationship verbs
  RELATED_TO: { en: 'Related to', ar: 'مرتبط بـ' },
  CONVERTED_TO: { en: 'Converted to', ar: 'تحوّل إلى' },
}

/** Humanize an unknown code for the English UI: IN_PROGRESS -> In Progress. */
export function humanizeCode(code: string): string {
  return String(code)
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Label for a code in the UI language. Looks in `dict` first, then the common
 * labels. An unknown code is humanized in English; in Arabic it is shown as the
 * code itself (an identifier from the data, not English UI text).
 */
export function enumLabel(code: string | null | undefined, isAR: boolean, dict?: Record<string, BiLabel>): string {
  if (code === null || code === undefined || code === '') return ''
  const entry = dict?.[code] || COMMON_ENUM_LABELS[code]
  if (entry) return isAR ? entry.ar : entry.en
  return isAR ? String(code) : humanizeCode(code)
}
