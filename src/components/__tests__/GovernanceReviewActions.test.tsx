import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import GovernanceReviewActions from '../GovernanceReviewActions'
jest.mock('../HelpTip', () => ({ __esModule: true, default: ({ text }: any) => <span>{text}</span> }))
const props = { reviewId: 'review-a', title: 'HLD design', canDelete: true, isAR: false, onDeleted: jest.fn() }
beforeEach(() => { jest.clearAllMocks(); global.fetch = jest.fn() })
it('keeps a review when deletion is cancelled', () => {
  jest.spyOn(window, 'confirm').mockReturnValue(false)
  render(<GovernanceReviewActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete review: HLD design' }))
  expect(fetch).not.toHaveBeenCalled(); expect(props.onDeleted).not.toHaveBeenCalled()
})
it('accepts a successful empty 204 delete response', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true)
  ;(fetch as jest.Mock).mockResolvedValue({ ok: true, status: 204 })
  render(<GovernanceReviewActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete review: HLD design' }))
  await waitFor(() => expect(props.onDeleted).toHaveBeenCalledTimes(1))
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/reviews/review-a'), expect.objectContaining({ method: 'DELETE' }))
})
it('keeps the review and shows deletion errors', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true)
  ;(fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ message: 'Not permitted' }) })
  render(<GovernanceReviewActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Delete review: HLD design' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Not permitted')
  expect(props.onDeleted).not.toHaveBeenCalled()
})
it('downloads only uploaded originals using authenticated requests', async () => {
  localStorage.setItem('ea_token', 'test-token')
  ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'file-a', inputType: 'FILE_UPLOAD', fileName: 'design.docx' }, { id: 'kb', inputType: 'KB_ASSET', label: 'Reference' }] }).mockResolvedValue({ ok: true, blob: async () => new Blob(['original']) })
  URL.createObjectURL = jest.fn().mockReturnValue('blob:original'); URL.revokeObjectURL = jest.fn()
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  render(<GovernanceReviewActions {...props} />)
  fireEvent.click(screen.getByRole('button', { name: 'Uploaded documents' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Download design.docx' }))
  await waitFor(() => expect(click).toHaveBeenCalled())
  expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('/reviews/review-a/inputs/file-a/download'), expect.objectContaining({ headers: { Authorization: 'Bearer test-token' } }))
  expect(screen.queryByText('Reference')).not.toBeInTheDocument(); click.mockRestore()
})
it('hides admin deletion for reviewers and provides Arabic labels', () => {
  render(<GovernanceReviewActions {...props} canDelete={false} isAR />)
  expect(screen.queryByRole('button', { name: /حذف المراجعة/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'المستندات المرفوعة' })).toBeInTheDocument()
})
