// Access Governance - built-in role updates (EN/AR), merged into LangContext.
type Entry = { EN: string; AR: string }
const e = (EN: string, AR: string): Entry => ({ EN, AR })

export const ROLE_UPDATE_TRANSLATIONS: Record<string, Entry> = {
  'ag.tpl.title': e('Built-in roles can be updated', 'يمكن تحديث الأدوار المضمّنة'),
  'ag.tpl.help': e('Modules added after your organization\'s roles were created (for example Financial Value) bring new permissions. Your built-in roles do not get them automatically. Applying adds only the listed permissions and creates missing built-in roles; nothing is removed and roles you created are not changed.', 'تضيف الوحدات التي أُطلقت بعد إنشاء أدوار جهتكم (مثل القيمة المالية) صلاحيات جديدة، ولا تحصل عليها الأدوار المضمّنة تلقائياً. يضيف التطبيق الصلاحيات المدرجة فقط وينشئ الأدوار المضمّنة الناقصة، دون حذف أي شيء أو تغيير الأدوار التي أنشأتموها.'),
  'ag.tpl.intro': e('Choose the roles to update. People with these roles will see the new modules after they sign in again.', 'اختر الأدوار المراد تحديثها. سيرى أصحاب هذه الأدوار الوحدات الجديدة بعد تسجيل الدخول مجدداً.'),
  'ag.tpl.create': e('create this built-in role', 'إنشاء هذا الدور المضمّن'),
  'ag.tpl.add': e('add {n} permission(s) · {users} user(s) have this role', 'إضافة {n} صلاحية · {users} مستخدماً لديهم هذا الدور'),
  'ag.tpl.apply': e('Apply to selected roles', 'التطبيق على الأدوار المحددة'),
  'ag.tpl.applying': e('Applying…', 'جارٍ التطبيق…'),
  'ag.tpl.done': e('{n} role(s) updated.', 'حُدِّث {n} دوراً.'),
}
