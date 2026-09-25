import { fireEvent, render, screen } from '@testing-library/react'
import InviteAcceptPage from '../InviteAcceptPage'

const mockAccept = jest.fn()
jest.mock('react-router-dom', () => ({ useParams: () => ({ token: 'tok-1' }), useNavigate: () => jest.fn() }), { virtual: true })
jest.mock('../../lib/api', () => ({ api: { acceptInvitation: (...args: any[]) => mockAccept(...args), login: jest.fn() }, setToken: jest.fn() }))

beforeEach(() => mockAccept.mockReset())

describe('InviteAcceptPage', () => {
  it('shows the ArchMind brand and labelled fields', () => {
    render(<InviteAcceptPage />)
    expect(screen.getByRole('img', { name: 'ArchMind' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: "You're Invited!" })).toBeInTheDocument()
    expect(screen.getByLabelText('Full Name *')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Password *')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Confirm Password *')).toHaveAttribute('type', 'password')
  })

  it('validates matching passwords before calling the API', () => {
    render(<InviteAcceptPage />)
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Aisha' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password-1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password-2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(mockAccept).not.toHaveBeenCalled()
  })

  it('accepts the invitation and confirms account creation', async () => {
    mockAccept.mockResolvedValue({ userId: 'u1', email: 'a@x.gov.sa' })
    render(<InviteAcceptPage />)
    fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Aisha' } })
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password-1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))
    expect(await screen.findByRole('heading', { name: 'Account Created!' })).toBeInTheDocument()
    expect(mockAccept).toHaveBeenCalledWith('tok-1', { fullName: 'Aisha', password: 'password-1' })
  })
})
