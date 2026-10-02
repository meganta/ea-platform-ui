// Innovation study status and recommendation names (EN/AR), shared by the
// Innovation module and the Copilot study card.
export const STUDY_STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  DRAFT: { en: 'Draft', ar: 'مسودة' }, AI_RESEARCH: { en: 'AI Research…', ar: 'بحث الذكاء الاصطناعي…' },
  UNDER_REVIEW: { en: 'Under Review', ar: 'قيد المراجعة' }, REWORK: { en: 'Rework', ar: 'إعادة عمل' },
  APPROVED: { en: 'Approved', ar: 'معتمدة' }, RECOMMENDED: { en: 'Recommended', ar: 'موصى بها' },
  PILOT_INITIATIVE: { en: 'Pilot / Initiative', ar: 'تجريبية / مبادرة' }, IMPLEMENTED: { en: 'Implemented', ar: 'منفَّذة' },
  CLOSED_ARCHIVED: { en: 'Closed / Archived', ar: 'مغلقة / مؤرشفة' },
}
export const RECOMMENDATION_LABEL: Record<string, { en: string; ar: string }> = {
  PROCEED: { en: 'Proceed', ar: 'المضي قدمًا' }, PROCEED_WITH_CONDITIONS: { en: 'Proceed with Conditions', ar: 'المضي قدمًا بشروط' },
  POC_FIRST: { en: 'PoC First', ar: 'إثبات مفهوم أولاً' }, PILOT: { en: 'Pilot', ar: 'تجريب' },
  DEFER: { en: 'Defer', ar: 'تأجيل' }, WATCH: { en: 'Watch', ar: 'متابعة' }, REJECT: { en: 'Reject', ar: 'رفض' },
}
