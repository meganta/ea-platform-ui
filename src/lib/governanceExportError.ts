export function governanceExportError(body: string, status: number, isAR: boolean): string {
  let message = ''
  try {
    const error = JSON.parse(body)
    message = typeof error.message === 'string' ? error.message : ''
  } catch { /* Do not expose HTML, stack traces, or raw response bodies. */ }
  if (message.includes('This review is not finalized')) return isAR
    ? 'يتاح تصدير PowerPoint بعد اكتمال المراجعة. عالج تنبيهات المراجعة اليدوية أولاً، أو نزّل التقرير الحالي بصيغة Word.'
    : 'PowerPoint is available after the review is finalized. Resolve the manual-review warnings first, or download the current report as Word.'
  if (status === 401 || status === 403) return isAR ? 'تعذّر التصدير. تحقق من تسجيل الدخول وصلاحية الوصول إلى التقرير.' : 'Export unavailable. Check your sign-in and permission to access this report.'
  return isAR ? 'تعذّر إنشاء ملف التصدير. حاول مرة أخرى. إذا استمرت المشكلة، تواصل مع الدعم.' : 'The export file could not be generated. Please retry. If the problem persists, contact support.'
}
