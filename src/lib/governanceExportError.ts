export function governanceExportError(body: string, status: number, isAR: boolean): string {
  let code = ''
  try {
    const error = JSON.parse(body)
    code = typeof error.code === 'string' ? error.code : ''
  } catch { /* Do not expose HTML, stack traces, or raw response bodies. */ }
  // The backend's export rule (governance-export-readiness.ts), the same for Word and PowerPoint.
  if (code === 'EXPORT_RUNNING') return isAR ? 'المراجعة قيد التشغيل. صدّرها بعد اكتمالها.' : 'The review is still running. Export it when it has completed.'
  if (code === 'EXPORT_CANCELLED') return isAR ? 'أُلغيت المراجعة ولا يوجد تقرير لتصديره.' : 'The review was cancelled and has no report to export.'
  if (code === 'EXPORT_NOT_RUN') return isAR ? 'لم تكتمل المراجعة بعد، فلا يوجد تقرير لتصديره. شغّل المراجعة وصدّرها بعد اكتمالها.' : 'The review has not completed yet, so there is no report to export. Run the review and export it when it has completed.'
  if (status === 401 || status === 403) return isAR ? 'تعذّر التصدير. تحقق من تسجيل الدخول وصلاحية الوصول إلى التقرير.' : 'Export unavailable. Check your sign-in and permission to access this report.'
  return isAR ? 'تعذّر إنشاء ملف التصدير. حاول مرة أخرى. إذا استمرت المشكلة، تواصل مع الدعم.' : 'The export file could not be generated. Please retry. If the problem persists, contact support.'
}
