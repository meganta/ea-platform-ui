// Presentation style strings (EN/AR), merged into LangContext's TRANSLATIONS.
// Used by Settings > Organization > Branding (presentation style card) and the
// deep-work deck download.

type Entry = { EN: string; AR: string }
const e = (EN: string, AR: string): Entry => ({ EN, AR })

export const PS_COVERS = ['EDITORIAL', 'INSTITUTIONAL', 'BLUEPRINT', 'MONUMENTAL'] as const
export const PS_HEADERS = ['EDITORIAL', 'FORMAL', 'TECHNICAL', 'MINIMAL'] as const
export const PS_TABLES = ['RULED', 'GRID', 'COMPACT', 'OPEN'] as const
export const PS_POINTS = ['NUMERAL', 'BADGE', 'SQUARE', 'DASH'] as const
export const PS_TONES = ['FORMAL', 'CONCISE', 'NARRATIVE'] as const
export const PS_LOGO = ['START', 'END'] as const
export const PS_MEASURED = ['Calibri', 'Cambria', 'Arial'] as const
export const PS_PALETTE = ['primary', 'accent', 'ink', 'surface'] as const

export const PRESENTATION_STYLE_TRANSLATIONS: Record<string, Entry> = {
  'pstyle.title': e('Presentation style', 'نمط العروض التقديمية'),
  'pstyle.help': e('How the decks ArchMind prepares for your organization look: your fonts, colours, the style of covers, headings, tables and lists, where the logo sits, and the tone and guidelines AI follows when it words slides. Edit a draft, download a sample deck to check it, then publish. Only the published style is used, and only for your organization.', 'كيف تبدو العروض التي يعدّها ArchMind لجهتك: خطوطكم وألوانكم، ونمط الغلاف والعناوين والجداول والقوائم، وموضع الشعار، والأسلوب والإرشادات التي يتبعها الذكاء الاصطناعي عند صياغة الشرائح. عدّل مسودة، ونزّل عرضاً نموذجياً للتحقق منها، ثم انشرها. لا يُستخدم إلا النمط المنشور، ولجهتك فقط.'),
  'pstyle.loading': e('Loading the presentation style…', 'جارٍ تحميل نمط العروض…'),
  'pstyle.load_failed': e('The presentation style could not be loaded', 'تعذّر تحميل نمط العروض'),
  'pstyle.state.published': e('Published {date}', 'منشور بتاريخ {date}'),
  'pstyle.state.builtin': e('Using the platform\'s built-in designs', 'تُستخدم التصاميم المدمجة في المنصة'),
  'pstyle.state.draft': e('You are editing a draft that is not used yet', 'تعدّل مسودة لم تُستخدم بعد'),
  'pstyle.fonts': e('Fonts', 'الخطوط'),
  'pstyle.fonts_help': e('Type the exact font names your organization uses. Decks name these fonts; whoever opens a deck needs them installed, otherwise a similar font is shown. Text is fitted using the measured font, so choose the one closest in width to yours.', 'اكتب أسماء الخطوط التي تستخدمها جهتك كما هي. تُذكر هذه الخطوط في العروض، ويحتاج من يفتح العرض إلى تثبيتها وإلا ظهر خط مشابه. يُضبط النص وفق خط القياس، فاختر الأقرب في عرضه إلى خطكم.'),
  'pstyle.font.latinHeading': e('Latin headings font', 'خط العناوين اللاتينية'),
  'pstyle.font.latinBody': e('Latin body font', 'خط النص اللاتيني'),
  'pstyle.font.arabic': e('Arabic font', 'الخط العربي'),
  'pstyle.font.measure': e('Measured as', 'خط القياس'),
  'pstyle.font_placeholder': e('Design default', 'افتراضي التصميم'),
  'pstyle.colours': e('Colours', 'الألوان'),
  'pstyle.colours_help': e('Leave a colour empty to keep the design\'s own. A text colour must contrast with the page at least 7:1; colours that would make text hard to read are refused or used only for shapes.', 'اترك اللون فارغاً للإبقاء على لون التصميم. يجب أن يكون تباين لون النص مع الصفحة 7:1 على الأقل، والألوان التي تُصعّب القراءة تُرفض أو تُستخدم للأشكال فقط.'),
  'pstyle.colour.primary': e('Primary', 'اللون الأساسي'),
  'pstyle.colour.accent': e('Accent', 'لون التمييز'),
  'pstyle.colour.ink': e('Text', 'لون النص'),
  'pstyle.colour.surface': e('Page', 'لون الصفحة'),
  'pstyle.layout': e('Layout', 'التنسيق'),
  'pstyle.cover': e('Cover', 'الغلاف'),
  'pstyle.header': e('Slide heading', 'عنوان الشريحة'),
  'pstyle.table': e('Tables', 'الجداول'),
  'pstyle.points': e('Lists', 'القوائم'),
  'pstyle.logo': e('Logo position', 'موضع الشعار'),
  'pstyle.design_default': e('Design default', 'افتراضي التصميم'),
  'pstyle.cover.EDITORIAL': e('Editorial', 'تحريري'),
  'pstyle.cover.INSTITUTIONAL': e('Institutional', 'مؤسسي'),
  'pstyle.cover.BLUEPRINT': e('Blueprint', 'مخطط هندسي'),
  'pstyle.cover.MONUMENTAL': e('Bold', 'بارز'),
  'pstyle.header.EDITORIAL': e('Editorial', 'تحريري'),
  'pstyle.header.FORMAL': e('Formal', 'رسمي'),
  'pstyle.header.TECHNICAL': e('Technical', 'تقني'),
  'pstyle.header.MINIMAL': e('Minimal', 'بسيط'),
  'pstyle.table.RULED': e('Ruled lines', 'خطوط أفقية'),
  'pstyle.table.GRID': e('Grid with header row', 'شبكة بصف عناوين'),
  'pstyle.table.COMPACT': e('Compact', 'مضغوط'),
  'pstyle.table.OPEN': e('Open', 'مفتوح'),
  'pstyle.points.NUMERAL': e('Numbers', 'أرقام'),
  'pstyle.points.BADGE': e('Badges', 'شارات'),
  'pstyle.points.SQUARE': e('Squares', 'مربعات'),
  'pstyle.points.DASH': e('Dashes', 'شرطات'),
  'pstyle.logo.START': e('Start of the reading direction', 'بداية اتجاه القراءة'),
  'pstyle.logo.END': e('End of the reading direction', 'نهاية اتجاه القراءة'),
  'pstyle.writing': e('Wording', 'الصياغة'),
  'pstyle.tone': e('Tone', 'الأسلوب'),
  'pstyle.tone.FORMAL': e('Formal and institutional', 'رسمي ومؤسسي'),
  'pstyle.tone.CONCISE': e('Concise and direct', 'موجز ومباشر'),
  'pstyle.tone.NARRATIVE': e('Narrative, explaining the reasoning', 'سردي يشرح المبررات'),
  'pstyle.guidelines': e('Presentation guidelines', 'إرشادات العروض'),
  'pstyle.guidelines_help': e('Your organization\'s own rules for slides, for example "titles state the conclusion" or "no more than five points". AI follows them for wording and structure only; they are never treated as facts.', 'قواعد جهتك الخاصة بالشرائح، مثل "العنوان يذكر الخلاصة" أو "خمس نقاط بحد أقصى". يتبعها الذكاء الاصطناعي في الصياغة والبنية فقط، ولا تُعامل كحقائق.'),
  'pstyle.save': e('Save draft', 'حفظ المسودة'),
  'pstyle.saving': e('Saving…', 'جارٍ الحفظ…'),
  'pstyle.saved': e('Draft saved', 'حُفظت المسودة'),
  'pstyle.preview_en': e('Sample deck (English)', 'عرض نموذجي (إنجليزي)'),
  'pstyle.preview_ar': e('Sample deck (Arabic)', 'عرض نموذجي (عربي)'),
  'pstyle.preview_help': e('Downloads a short sample deck in the style shown on this screen, including changes you have not saved.', 'ينزّل عرضاً نموذجياً قصيراً بالنمط المعروض في هذه الشاشة، بما في ذلك التغييرات غير المحفوظة.'),
  'pstyle.publish': e('Publish', 'نشر'),
  'pstyle.published_ok': e('Published. New decks use this style.', 'تم النشر. ستستخدم العروض الجديدة هذا النمط.'),
  'pstyle.discard': e('Discard draft', 'تجاهل المسودة'),
  'pstyle.reset': e('Back to built-in designs', 'العودة إلى التصاميم المدمجة'),
  'pstyle.reset_confirm': e('Stop using your organization\'s style in decks and go back to the platform\'s built-in designs? Your draft is kept.', 'إيقاف استخدام نمط جهتك في العروض والعودة إلى التصاميم المدمجة في المنصة؟ ستبقى المسودة محفوظة.'),
  'pstyle.admin_only': e('Only tenant administrators can publish or reset the style.', 'يقتصر نشر النمط أو إعادة ضبطه على مسؤولي الجهة.'),
  'pstyle.warnings': e('Good to know', 'معلومات مفيدة'),
  'pstyle.unsaved': e('Unsaved changes', 'تغييرات غير محفوظة'),
}
