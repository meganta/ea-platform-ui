import { governanceExportError } from './governanceExportError'

test('held report failure explains the Word alternative without raw exception details', () => {
  const body = JSON.stringify({ message: 'This review is not finalized.', path: '/internal/export', statusCode: 400 })
  expect(governanceExportError(body, 400, false)).toContain('download the current report as Word')
  expect(governanceExportError(body, 400, true)).toContain('بصيغة Word')
  expect(governanceExportError(body, 400, false)).not.toContain('/internal/export')
})
test('HTML and server exceptions do not leak into the export alert', () => {
  expect(governanceExportError('<html>stack trace</html>', 500, false)).not.toContain('stack trace')
  expect(governanceExportError(JSON.stringify({message:'Database credentials and stack'}),500,false)).not.toContain('Database')
})
test('expired sign-in has an actionable explanation', () => {
  expect(governanceExportError('', 401, false)).toContain('sign-in')
})
