// EA Deliverables strings (EN/AR), merged into LangContext's TRANSLATIONS.
// Deliverable titles and summaries come from the backend catalogue in both languages.

type Entry = { EN: string; AR: string }
const e = (EN: string, AR: string): Entry => ({ EN, AR })

export const DELIVERABLE_FORMATS = ['XLSX', 'DOCX', 'PPTX', 'ZIP'] as const
export const VIEW_STATES = ['CURRENT', 'TRANSITION', 'TARGET'] as const

export const DELIVERABLES_TRANSLATIONS: Record<string, Entry> = {
  'nav.deliverables': e('EA Deliverables', 'مخرجات البنية المؤسسية'),
  'deliv.title': e('EA Deliverables', 'مخرجات البنية المؤسسية'),
  'deliv.subtitle': e('Catalogues, documents and decks prepared from your organization\'s records', 'أدلة ووثائق وعروض تُعد من سجلات جهتك'),
  'deliv.help': e('Each deliverable is prepared on request from the module that owns the records - the Repository, Capability Management, Strategy, EA Views and Reference Architectures - in English or Arabic. Nothing is written by AI: values are the recorded ones, and anything not recorded is shown as not recorded. Some deliverables need a choice first, such as the views for the deck or the units that own the policies.', 'تُعد كل وثيقة عند الطلب من الوحدة التي تملك السجلات - المستودع وإدارة القدرات والاستراتيجية ومناظير البنية والبنى المرجعية - بالعربية أو الإنجليزية. لا يكتب الذكاء الاصطناعي أي محتوى: القيم هي المسجلة، وما لم يُسجل يُعرض على أنه غير مسجل. وتحتاج بعض الوثائق إلى اختيار أولاً، مثل المناظير في العرض أو الوحدات المالكة للسياسات.'),
  'deliv.language': e('Language of the documents', 'لغة الوثائق'),
  'deliv.lang.EN': e('English', 'الإنجليزية'),
  'deliv.lang.AR': e('Arabic', 'العربية'),
  'deliv.download': e('Download', 'تنزيل'),
  'deliv.preparing': e('Preparing…', 'جارٍ الإعداد…'),
  'deliv.download_all': e('Download all', 'تنزيل الكل'),
  'deliv.download_all_help': e('One ZIP with every deliverable that can be prepared with the choices on this page; a note inside names any that could not be prepared and why.', 'ملف مضغوط واحد بكل الوثائق التي يمكن إعدادها بالاختيارات في هذه الصفحة، وبداخله ملاحظة بما تعذر إعداده وسببه.'),
  'deliv.records': e('{n} records', '{n} سجل'),
  'deliv.sources': e('From', 'المصدر'),
  'deliv.loading': e('Loading the deliverables…', 'جارٍ تحميل المخرجات…'),
  'deliv.load_failed': e('The deliverables could not be loaded', 'تعذر تحميل المخرجات'),
  'deliv.failed': e('Could not prepare it', 'تعذر الإعداد'),
  'deliv.ready': e('Downloaded {name}', 'تم تنزيل {name}'),
  'deliv.format.XLSX': e('Excel', 'إكسل'),
  'deliv.format.DOCX': e('Word', 'وورد'),
  'deliv.format.PPTX': e('PowerPoint', 'باوربوينت'),
  'deliv.format.ZIP': e('ZIP', 'ملف مضغوط'),
  // Options
  'deliv.opt.subject': e('Subject with its own KPI sheet (optional)', 'موضوع بورقة مؤشرات خاصة (اختياري)'),
  'deliv.opt.subject_help': e('For example a platform: its KPIs - those whose name or description names it - get their own sheet.', 'مثل منصة: تُخصص لمؤشراتها - التي يذكرها اسمها أو وصفها - ورقة مستقلة.'),
  'deliv.opt.subject_search': e('Search the Repository by name', 'ابحث في المستودع بالاسم'),
  'deliv.opt.clear': e('Remove', 'إزالة'),
  'deliv.opt.views': e('Views in the deck', 'المناظير في العرض'),
  'deliv.opt.views_help': e('The deck orders them by architecture state: Current, then transitions by date, then Target.', 'يرتبها العرض حسب حالة البنية: الحالية ثم الانتقالية حسب التاريخ ثم المستهدفة.'),
  'deliv.opt.views_filter': e('Filter views by name', 'تصفية المناظير بالاسم'),
  'deliv.opt.views_none': e('Choose at least one view.', 'اختر منظوراً واحداً على الأقل.'),
  'deliv.opt.selected': e('{n} selected', 'تم اختيار {n}'),
  'deliv.opt.architectures': e('Architectures to include', 'البنى المضمنة'),
  'deliv.opt.architectures_help': e('None chosen means all of this kind.', 'عدم الاختيار يعني جميع البنى من هذا النوع.'),
  'deliv.opt.owners': e('Units that own the policies', 'الوحدات المالكة للسياسات'),
  'deliv.opt.owners_help': e('The policies recorded with these owners are included; for processes, units recorded under them count too.', 'تُضمن السياسات المسجلة بهؤلاء المالكين، وتُحتسب للإجراءات الوحدات المسجلة تحتهم أيضاً.'),
  'deliv.opt.owners_none': e('Choose at least one owning unit.', 'اختر وحدة مالكة واحدة على الأقل.'),
  'deliv.opt.policies': e('{n} policies', '{n} سياسة'),
  'deliv.state.CURRENT': e('Current', 'الحالية'),
  'deliv.state.TRANSITION': e('Transition', 'انتقالية'),
  'deliv.state.TARGET': e('Target', 'المستهدفة'),
}
