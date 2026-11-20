// Deck template strings (EN/AR), merged into LangContext's TRANSLATIONS.
// Used by Settings > Organization > Branding (deck templates card).

type Entry = { EN: string; AR: string }
const e = (EN: string, AR: string): Entry => ({ EN, AR })

export const DT_LANGUAGES = ['AR', 'EN'] as const

export const DECK_TEMPLATE_TRANSLATIONS: Record<string, Entry> = {
  'dtpl.title': e('Deck templates', 'قوالب العروض التقديمية'),
  'dtpl.help': e('Upload your organization\'s own PowerPoint template, one for Arabic and one for English. The template\'s first slide must be a cover and the next ones content slides: ArchMind reads where they place the titles, their colours and fonts, and what the layouts draw (logo, bands, footer). When a template is the default for a language, every deck ArchMind prepares in that language - Copilot answers, reviews, studies, deep work - is built on it, with the template\'s own master and layouts. The presentation style below is then used only where the template does not decide.',
    'ارفع قالب PowerPoint الخاص بجهتك، قالبا للعربية وآخر للإنجليزية. يجب أن تكون الشريحة الأولى في القالب شريحة غلاف والشرائح التالية شرائح محتوى: يقرأ ArchMind مواضع العناوين فيها وألوانها وخطوطها، وما ترسمه التخطيطات (الشعار والأشرطة والتذييل). وعندما يكون القالب هو الافتراضي للغة ما، تُبنى عليه كل العروض التي يعدها ArchMind بتلك اللغة - إجابات المساعد والمراجعات والدراسات والعمل المعمق - بشريحتها الرئيسية وتخطيطاتها الأصلية. ويُستخدم نمط العرض أدناه فيما لا يحدده القالب فقط.'),
  'dtpl.lang.AR': e('Arabic decks', 'العروض العربية'),
  'dtpl.lang.EN': e('English decks', 'العروض الإنجليزية'),
  'dtpl.none': e('No template: the built-in design is used.', 'لا يوجد قالب: يُستخدم التصميم المدمج.'),
  'dtpl.file': e('File', 'الملف'),
  'dtpl.uploaded': e('Uploaded', 'تاريخ الرفع'),
  'dtpl.layouts': e('Layouts used', 'التخطيطات المستخدمة'),
  'dtpl.layout_cover': e('cover', 'الغلاف'),
  'dtpl.layout_content': e('content', 'المحتوى'),
  'dtpl.colours': e('Colours', 'الألوان'),
  'dtpl.fonts': e('Font', 'الخط'),
  'dtpl.samples': e('{n} sample slides read', 'قُرئت {n} شرائح نموذجية'),
  'dtpl.default': e('Default for these decks', 'القالب الافتراضي لهذه العروض'),
  'dtpl.default_on': e('Default', 'افتراضي'),
  'dtpl.default_off': e('Not used', 'غير مستخدم'),
  'dtpl.upload': e('Upload template', 'رفع قالب'),
  'dtpl.replace': e('Replace', 'استبدال'),
  'dtpl.upload_label': e('PowerPoint template (.pptx or .potx) for {lang}', 'قالب PowerPoint (.pptx أو .potx) لـ{lang}'),
  'dtpl.uploading': e('Reading the template…', 'جارٍ قراءة القالب…'),
  'dtpl.uploaded_ok': e('Template saved and set as the default.', 'حُفظ القالب وعُيّن افتراضيا.'),
  'dtpl.download': e('Download', 'تنزيل'),
  'dtpl.sample': e('Sample deck', 'عرض نموذجي'),
  'dtpl.remove': e('Remove', 'إزالة'),
  'dtpl.remove_confirm': e('Remove this template? Decks in this language go back to the built-in design.', 'إزالة هذا القالب؟ ستعود العروض بهذه اللغة إلى التصميم المدمج.'),
  'dtpl.admin_only': e('Only a tenant administrator can change the templates.', 'يستطيع مدير الجهة فقط تغيير القوالب.'),
  'dtpl.load_failed': e('The templates could not be loaded', 'تعذر تحميل القوالب'),
}
