import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ChangePasswordPage from '../ChangePasswordPage'
import { api } from '../../lib/api'

let mockLocale = 'EN'
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ locale: mockLocale, t: () => 'More information' }) }))
jest.mock('../../lib/api', () => ({ api: { changeMyPassword: jest.fn() } }))

function fill(confirm = 'new-password') {
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-password' } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
}

beforeEach(() => { jest.clearAllMocks(); mockLocale = 'EN' })

it('changes the signed-in password and clears sensitive fields', async () => {
  (api.changeMyPassword as jest.Mock).mockResolvedValue({ success: true })
  render(<ChangePasswordPage />)
  fill()
  await screen.findByRole('status')
  expect(api.changeMyPassword).toHaveBeenCalledWith({ currentPassword: 'old-password', newPassword: 'new-password' })
  expect(screen.getByLabelText('Current password')).toHaveValue('')
  expect(screen.getByLabelText('New password')).toHaveValue('')
  expect(screen.getByLabelText('Confirm new password')).toHaveValue('')
})

it('rejects mismatched confirmation before calling the API', () => {
  render(<ChangePasswordPage />)
  fill('different-password')
  expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
  expect(api.changeMyPassword).not.toHaveBeenCalled()
})

it('reports an incorrect current password and allows retry', async () => {
  (api.changeMyPassword as jest.Mock).mockRejectedValue(new Error('Current password is incorrect'))
  render(<ChangePasswordPage />)
  fill()
  expect(await screen.findByRole('alert')).toHaveTextContent('Current password is incorrect')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Change password' })).toBeEnabled())
})

it('disables submission while saving', async () => {
  let resolve!: (value: unknown) => void
  ;(api.changeMyPassword as jest.Mock).mockReturnValue(new Promise(r => { resolve = r }))
  render(<ChangePasswordPage />)
  fill()
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
  expect(screen.getByLabelText('Current password')).toBeDisabled()
  resolve({ success: true })
  await screen.findByRole('status')
})

it('renders Arabic labels and right-to-left content', () => {
  mockLocale = 'AR'
  render(<ChangePasswordPage />)
  expect(screen.getByLabelText('كلمة المرور الحالية')).toBeInTheDocument()
  expect(screen.getByRole('heading').parentElement).toHaveAttribute('dir', 'rtl')
})

it('rejects a password exceeding the bcrypt byte limit', () => {
  render(<ChangePasswordPage />)
  fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'old-password' } })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'ع'.repeat(37) } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'ع'.repeat(37) } })
  fireEvent.click(screen.getByRole('button', { name: 'Change password' }))
  expect(screen.getByRole('alert')).toHaveTextContent('72 UTF-8 bytes')
  expect(api.changeMyPassword).not.toHaveBeenCalled()
})
