/**
 * English / Arabic labels for the Innovation idea assessment. Codes mirror
 * apps/api/src/innovation/idea-assessment.ts (criteria, recommendations,
 * quadrants, risk categories, benefit types) - keep in sync if those change.
 */
export interface Bi { en: string; ar: string }

export const pickBi = (v: Bi | string | null | undefined, isAR: boolean): string => {
  if (!v) return ''
  if (typeof v === 'string') return v
  return (isAR ? v.ar || v.en : v.en || v.ar) || ''
}

export const label = (map: Record<string, Bi>, code: string | null | undefined, isAR: boolean): string =>
  code ? (map[code] ? (isAR ? map[code].ar : map[code].en) : code) : ''

export const IDEA_STATUS_LABEL: Record<string, Bi> = {
  SUBMITTED: { en: 'Submitted', ar: 'مُقدَّمة' }, QUALIFYING: { en: 'Being assessed…', ar: 'قيد التقييم…' },
  QUALIFIED: { en: 'Qualified', ar: 'مؤهّلة' }, IN_REVIEW: { en: 'In Review', ar: 'قيد المراجعة' },
  APPROVED: { en: 'Approved', ar: 'معتمدة' }, REJECTED: { en: 'Rejected', ar: 'مرفوضة' }, ARCHIVED: { en: 'Archived', ar: 'مؤرشفة' },
}

export const IDEA_STATUS_COLOR: Record<string, string> = {
  SUBMITTED: '#7f8c8d', QUALIFYING: '#f39c12', QUALIFIED: '#2ecc71', IN_REVIEW: '#3498db',
  APPROVED: '#27ae60', REJECTED: '#e74c3c', ARCHIVED: '#7f8c8d',
}

export const CRITERION_LABEL: Record<string, Bi> = {
  STRATEGIC_ALIGNMENT: { en: 'Strategic alignment', ar: 'التوافق الاستراتيجي' },
  BUSINESS_VALUE: { en: 'Business value', ar: 'القيمة المؤسسية' },
  BENEFICIARY_IMPACT: { en: 'Beneficiary impact', ar: 'الأثر على المستفيدين' },
  TECHNICAL_FEASIBILITY: { en: 'Technical feasibility', ar: 'الجدوى التقنية' },
  ORGANIZATIONAL_READINESS: { en: 'Organizational readiness', ar: 'الجاهزية المؤسسية' },
  COST_EFFORT: { en: 'Cost and effort', ar: 'التكلفة والجهد' },
  RISK_COMPLIANCE: { en: 'Risk and compliance', ar: 'المخاطر والامتثال' },
  TIME_TO_VALUE: { en: 'Time to value', ar: 'سرعة تحقيق القيمة' },
}

export const RECOMMENDATION: Record<string, Bi & { color: string; icon: string }> = {
  FAST_TRACK: { en: 'Fast-track to pilot', ar: 'تسريع إلى التجربة', color: '#27ae60', icon: '🚀' },
  PROCEED_TO_STUDY: { en: 'Proceed to a detailed study', ar: 'المضي إلى دراسة تفصيلية', color: '#2ecc71', icon: '📑' },
  REFINE: { en: 'Refine - more information needed', ar: 'تحسين - يلزم مزيد من المعلومات', color: '#f39c12', icon: '✏️' },
  MERGE: { en: 'Merge with an existing item', ar: 'الدمج مع عنصر قائم', color: '#3498db', icon: '🔗' },
  PARK: { en: 'Park for later', ar: 'تأجيل لوقت لاحق', color: '#7f8c8d', icon: '⏸' },
  REJECT: { en: 'Do not pursue', ar: 'عدم المضي', color: '#e74c3c', icon: '✖' },
}

export const QUADRANT: Record<string, Bi & { color: string; hint: Bi }> = {
  QUICK_WIN: { en: 'Quick win', ar: 'مكسب سريع', color: '#27ae60', hint: { en: 'High value, easy to deliver - do first.', ar: 'قيمة عالية وسهولة في التنفيذ - تُنفَّذ أولاً.' } },
  STRATEGIC_BET: { en: 'Strategic bet', ar: 'رهان استراتيجي', color: '#3498db', hint: { en: 'High value but hard - plan and invest deliberately.', ar: 'قيمة عالية لكنها صعبة - تتطلب تخطيطاً واستثماراً مدروساً.' } },
  INCREMENTAL: { en: 'Incremental', ar: 'تحسين تدريجي', color: '#f39c12', hint: { en: 'Easy but modest value - do when capacity allows.', ar: 'سهلة لكن قيمتها محدودة - تُنفَّذ عند توفر السعة.' } },
  DEPRIORITIZE: { en: 'Deprioritize', ar: 'أولوية منخفضة', color: '#e74c3c', hint: { en: 'Low value and hard - avoid for now.', ar: 'قيمة منخفضة وصعوبة عالية - تُتجنَّب حالياً.' } },
}

export const RISK_CATEGORY: Record<string, Bi> = {
  TECHNICAL: { en: 'Technical', ar: 'تقنية' }, SECURITY: { en: 'Cybersecurity', ar: 'الأمن السيبراني' },
  DATA_PRIVACY: { en: 'Data privacy', ar: 'خصوصية البيانات' }, REGULATORY: { en: 'Regulatory', ar: 'تنظيمية' },
  FINANCIAL: { en: 'Financial', ar: 'مالية' }, ORGANIZATIONAL: { en: 'Organizational', ar: 'مؤسسية' },
  DELIVERY: { en: 'Delivery', ar: 'التنفيذ' }, VENDOR: { en: 'Vendor', ar: 'المورّد' },
}

export const BENEFIT_TYPE: Record<string, Bi> = {
  EFFICIENCY: { en: 'Efficiency', ar: 'الكفاءة' }, COST_SAVING: { en: 'Cost saving', ar: 'خفض التكاليف' },
  REVENUE: { en: 'Revenue', ar: 'الإيرادات' }, BENEFICIARY_EXPERIENCE: { en: 'Beneficiary experience', ar: 'تجربة المستفيد' },
  COMPLIANCE: { en: 'Compliance', ar: 'الامتثال' }, RISK_REDUCTION: { en: 'Risk reduction', ar: 'خفض المخاطر' },
  STRATEGIC: { en: 'Strategic', ar: 'استراتيجية' },
}

export const LEVEL: Record<string, Bi> = {
  HIGH: { en: 'High', ar: 'مرتفع' }, MEDIUM: { en: 'Medium', ar: 'متوسط' }, LOW: { en: 'Low', ar: 'منخفض' },
}

export const SIZE: Record<string, Bi> = {
  S: { en: 'Small', ar: 'صغير' }, M: { en: 'Medium', ar: 'متوسط' }, L: { en: 'Large', ar: 'كبير' }, XL: { en: 'Very large', ar: 'كبير جداً' },
}

export const COST_BAND: Record<string, Bi> = {
  LOW: { en: 'Low', ar: 'منخفضة' }, MEDIUM: { en: 'Medium', ar: 'متوسطة' }, HIGH: { en: 'High', ar: 'مرتفعة' }, VERY_HIGH: { en: 'Very high', ar: 'مرتفعة جداً' },
}

export const SIMILAR_KIND: Record<string, Bi> = {
  IDEA: { en: 'Idea', ar: 'فكرة' }, STUDY: { en: 'Study', ar: 'دراسة' }, RADAR_ITEM: { en: 'Radar technology', ar: 'تقنية في الرادار' },
}

export const scoreColor = (score: number | null | undefined) =>
  score == null ? '#7f8c8d' : score >= 70 ? '#2ecc71' : score >= 50 ? '#f39c12' : '#e74c3c'

/** Likelihood x impact to a 1-9 exposure used to sort and colour the risk register. */
export const riskExposure = (likelihood: string, impact: string) => {
  const n = (l: string) => (l === 'HIGH' ? 3 : l === 'MEDIUM' ? 2 : 1)
  return n(likelihood) * n(impact)
}
export const exposureColor = (e: number) => (e >= 6 ? '#e74c3c' : e >= 3 ? '#f39c12' : '#2ecc71')
