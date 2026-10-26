import { governanceExportReadiness } from './governanceExportReadiness'

test('Word and PowerPoint export once the review has completed with a saved report', () => {
  expect(governanceExportReadiness('COMPLETED', true)).toEqual({ available: true, held: false })
  expect(governanceExportReadiness('READY_FOR_REVIEW', true)).toEqual({ available: true, held: true })
})

test('a running, unfinished or report-less review cannot be exported', () => {
  for (const status of ['PROCESSING', 'DRAFT', 'GAP_DETECTION', 'CANCELLED', undefined]) expect(governanceExportReadiness(status, true).available).toBe(false)
  expect(governanceExportReadiness('COMPLETED', false)).toEqual({ available: false, held: false })
})
