import { governanceExportError } from './governanceExportError'

test('an export refused because the review has not completed says so, the same for Word and PowerPoint, without raw details', () => {
  const body = JSON.stringify({ message: 'x', code: 'EXPORT_NOT_RUN', path: '/internal/export', statusCode: 400 })
  expect(governanceExportError(body, 400, false)).toContain('export it when it has completed')
  expect(governanceExportError(body, 400, true)).toContain('بعد اكتمالها')
  expect(governanceExportError(body, 400, false)).not.toContain('/internal/export')
  expect(governanceExportError(JSON.stringify({ code: 'EXPORT_RUNNING' }), 400, false)).toContain('still running')
  expect(governanceExportError(JSON.stringify({ code: 'EXPORT_CANCELLED' }), 400, true)).toContain('أُلغيت')
})
test('HTML and server exceptions do not leak into the export alert', () => {
  expect(governanceExportError('<html>stack trace</html>', 500, false)).not.toContain('stack trace')
  expect(governanceExportError(JSON.stringify({message:'Database credentials and stack'}),500,false)).not.toContain('Database')
})
test('expired sign-in has an actionable explanation', () => {
  expect(governanceExportError('', 401, false)).toContain('sign-in')
})
