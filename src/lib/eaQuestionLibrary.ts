/**
 * Approved Enterprise Architecture business questions - the Copilot
 * suggested-question library (53 questions in 9 categories).
 *
 * Content only: a question is an entry point into the normal Copilot chat,
 * never special handling. `id` keeps the approved numbering (ea-q01..ea-q53)
 * so a question can be traced back to the approved list.
 */

export interface EaQuestion {
  id: string;
  text: string;
  textAr: string;
}

export interface EaQuestionCategory {
  id: string;
  label: string;
  labelAr: string;
  questions: EaQuestion[];
}

const q = (n: number, text: string, textAr: string): EaQuestion => ({ id: `ea-q${String(n).padStart(2, '0')}`, text, textAr });

export const EA_QUESTION_LIBRARY: EaQuestionCategory[] = [
  {
    id: 'transparency', label: 'Transparency', labelAr: 'الشفافية', questions: [
      q(1, 'What is our application portfolio?', 'ما هي محفظة التطبيقات لدينا؟'),
      q(2, 'What is our technical debt?', 'ما هو الدين التقني لدينا؟'),
      q(3, 'Who are our vendors?', 'من هم مورّدونا؟'),
      q(4, 'What are our architectural dependencies?', 'ما هي الاعتماديات المعمارية لدينا؟'),
      q(5, 'Which process areas require the most IT support?', 'ما مجالات الإجراءات التي تتطلب أكبر دعم من تقنية المعلومات؟'),
      q(6, 'What are our middleware integrations?', 'ما هي تكاملات البرمجيات الوسيطة لدينا؟'),
      q(7, 'Where are our applications deployed?', 'أين تُنشر تطبيقاتنا؟'),
      q(8, 'What is our service catalog?', 'ما هو كتالوج الخدمات لدينا؟'),
      q(9, 'What is our Technology Portfolio?', 'ما هي محفظة التقنيات لدينا؟'),
      q(10, 'Which contracts should we review?', 'ما العقود التي ينبغي أن نراجعها؟'),
      q(11, 'What is our data landscape?', 'ما هو مشهد البيانات لدينا؟'),
      q(12, 'What is our enterprise resource model?', 'ما هو نموذج موارد المؤسسة لدينا؟'),
    ],
  },
  {
    id: 'governance', label: 'Governance', labelAr: 'الحوكمة', questions: [
      q(13, 'Who is responsible for our assets?', 'من المسؤول عن أصولنا؟'),
      q(14, 'Who owns which applications?', 'من يملك أي التطبيقات؟'),
      q(15, 'What is our standards catalog?', 'ما هو كتالوج المعايير لدينا؟'),
      q(16, 'What should we be focusing on?', 'على ماذا ينبغي أن نركز؟'),
      q(17, 'Who owns our technologies?', 'من يملك تقنياتنا؟'),
    ],
  },
  {
    id: 'rationalization', label: 'Rationalization', labelAr: 'الترشيد', questions: [
      q(18, 'What are our investment / retirement candidates?', 'ما هي المرشحات للاستثمار أو الإيقاف؟'),
      q(19, 'What is the status of our rationalization plan?', 'ما حالة خطة الترشيد لدينا؟'),
      q(20, 'Where do we have functional redundancies?', 'أين يوجد لدينا تكرار وظيفي؟'),
      q(21, 'What are our service overlaps?', 'ما هي تداخلات الخدمات لدينا؟'),
    ],
  },
  {
    id: 'roadmapping', label: 'Roadmapping', labelAr: 'خرائط الطريق', questions: [
      q(22, 'What is our application roadmap?', 'ما هي خارطة طريق التطبيقات لدينا؟'),
      q(23, 'What is our application landscape?', 'ما هو مشهد التطبيقات لدينا؟'),
      q(24, 'What is our target architecture?', 'ما هي البنية المستهدفة لدينا؟'),
      q(25, 'What is our vendor roadmap?', 'ما هي خارطة طريق المورّدين لدينا؟'),
      q(26, 'What is our service roadmap?', 'ما هي خارطة طريق الخدمات لدينا؟'),
      q(27, 'What is our service landscape?', 'ما هو مشهد الخدمات لدينا؟'),
      q(28, 'What is our technology roadmap?', 'ما هي خارطة طريق التقنية لدينا؟'),
    ],
  },
  {
    id: 'transformation', label: 'Transformation', labelAr: 'التحول', questions: [
      q(29, 'What are our most important projects?', 'ما هي أهم مشاريعنا؟'),
      q(30, 'What is the status of our project portfolio?', 'ما حالة محفظة المشاريع لدينا؟'),
      q(31, 'What are our project overlaps?', 'ما هي تداخلات المشاريع لدينا؟'),
      q(32, 'Where are our project dependencies?', 'أين توجد اعتماديات المشاريع لدينا؟'),
      q(33, 'Where can we expect resource constraints?', 'أين نتوقع قيوداً في الموارد؟'),
      q(34, 'How are we progressing with our strategy?', 'كيف نتقدم في تنفيذ استراتيجيتنا؟'),
    ],
  },
  {
    id: 'business-relationship', label: 'Business Relationship', labelAr: 'العلاقة مع الأعمال', questions: [
      q(35, 'What is our demand pipeline?', 'ما هو مسار الطلبات لدينا؟'),
      q(36, 'Which demands should be realized?', 'ما الطلبات التي ينبغي تنفيذها؟'),
      q(37, 'What is our business-IT alignment?', 'ما مدى المواءمة بين الأعمال وتقنية المعلومات لدينا؟'),
      q(38, 'Where are our applications used?', 'أين تُستخدم تطبيقاتنا؟'),
      q(39, 'What is our technology usage?', 'ما هو استخدامنا للتقنية؟'),
      q(40, 'Where are our business priorities?', 'أين تكمن أولويات أعمالنا؟'),
      q(41, 'Who are our service providers and consumers?', 'من هم مقدمو الخدمات ومستهلكوها لدينا؟'),
    ],
  },
  {
    id: 'finance', label: 'Finance', labelAr: 'المالية', questions: [
      q(42, 'What is our OPEX distribution?', 'ما هو توزيع النفقات التشغيلية لدينا؟'),
      q(43, 'What is our CAPEX distribution?', 'ما هو توزيع النفقات الرأسمالية لدينا؟'),
      q(44, 'What are our cost drivers?', 'ما هي محركات التكلفة لدينا؟'),
      q(45, 'What are our service costs?', 'ما هي تكاليف خدماتنا؟'),
    ],
  },
  {
    id: 'cloud-migration', label: 'Cloud Migration', labelAr: 'الانتقال إلى السحابة', questions: [
      q(46, 'What are our cloud focus areas?', 'ما هي مجالات التركيز السحابي لدينا؟'),
      q(47, 'What is our cloud migration strategy?', 'ما هي استراتيجية الانتقال إلى السحابة لدينا؟'),
    ],
  },
  {
    id: 'risk', label: 'Risk', labelAr: 'المخاطر', questions: [
      q(48, 'How will IT failure impact our business?', 'كيف سيؤثر تعطل تقنية المعلومات على أعمالنا؟'),
      q(49, 'What is our security score?', 'ما هي درجة الأمن لدينا؟'),
      q(50, 'Where do we have SLA violations?', 'أين توجد لدينا مخالفات لاتفاقيات مستوى الخدمة؟'),
      q(51, 'Where do we use sensitive data?', 'أين نستخدم البيانات الحساسة؟'),
      q(52, 'Where do we have technology risk?', 'أين توجد لدينا مخاطر تقنية؟'),
      q(53, 'Where is our data processed?', 'أين تُعالج بياناتنا؟'),
    ],
  },
];

export const ALL_EA_QUESTIONS: EaQuestion[] = EA_QUESTION_LIBRARY.flatMap(c => c.questions);

/**
 * The few questions shown when Copilot opens - one each from five different
 * categories, so the first screen stays uncluttered but shows the breadth of
 * the library. Stable (not randomised) so the opening screen is predictable.
 */
export const FEATURED_EA_QUESTION_IDS = ['ea-q01', 'ea-q14', 'ea-q24', 'ea-q30', 'ea-q52'];

export const FEATURED_EA_QUESTIONS: EaQuestion[] = FEATURED_EA_QUESTION_IDS
  .map(id => ALL_EA_QUESTIONS.find(question => question.id === id))
  .filter((question): question is EaQuestion => Boolean(question));
