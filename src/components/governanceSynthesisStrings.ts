// Cross-domain view and remediation roadmap strings (EN/AR), merged into
// LangContext's TRANSLATIONS. Used by GovernanceSynthesis.tsx.

type Entry = { EN: string; AR: string }
const e = (EN: string, AR: string): Entry => ({ EN, AR })

export const SYNTHESIS_HORIZONS = ['BEFORE_APPROVAL', 'BEFORE_GO_LIVE', 'AFTER_GO_LIVE'] as const

export const SYNTHESIS_TRANSLATIONS: Record<string, Entry> = {
  'gov.synthesis.title': e('Cross-domain view and remediation roadmap', 'الرؤية عبر المجالات وخارطة المعالجة'),
  'gov.synthesis.help': e(
    'Read across all of this review\'s findings together: how they connect across architecture domains, and the order in which to fix them. It is written only from the review\'s own findings — every step names the findings it closes, and every open critical or high finding has a step. The same view is in the Word and PowerPoint exports.',
    'قراءة لجميع ملاحظات هذه المراجعة معاً: كيف ترتبط عبر مجالات البنية المؤسسية، وبأي ترتيب تُعالَج. تُكتب من ملاحظات المراجعة نفسها فقط، فكل خطوة تذكر الملاحظات التي تغلقها، ولكل ملاحظة حرجة أو عالية مفتوحة خطوة. تظهر الرؤية نفسها في ملفي Word وPowerPoint.'),
  'gov.synthesis.themes': e('Themes across domains', 'محاور مشتركة بين المجالات'),
  'gov.synthesis.roadmap': e('Remediation roadmap', 'خارطة المعالجة'),
  'gov.synthesis.closes': e('Closes', 'تغلق'),
  'gov.synthesis.platform': e('Added by the platform', 'أضافتها المنصة'),
  'gov.synthesis.platform_help': e('A critical or high finding the roadmap did not cover, added in severity order.', 'ملاحظة حرجة أو عالية لم تشملها الخارطة، أُضيفت حسب درجة الخطورة.'),
  'gov.synthesis.roadmap_only': e('Ordered from the findings by severity.', 'مرتبة من الملاحظات حسب درجة الخطورة.'),
  'gov.synthesis.horizon.BEFORE_APPROVAL': e('Before approval', 'قبل الموافقة'),
  'gov.synthesis.horizon.BEFORE_GO_LIVE': e('Before go-live', 'قبل الإطلاق'),
  'gov.synthesis.horizon.AFTER_GO_LIVE': e('After go-live', 'بعد الإطلاق'),
}
