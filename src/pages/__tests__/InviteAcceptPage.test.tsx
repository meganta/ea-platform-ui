import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import InviteAcceptPage from '../InviteAcceptPage'

const mockAccept = jest.fn()
const mockLogin = jest.fn()
const mockNav = jest.fn()
jest.mock('react-router-dom', () => ({ useParams: () => ({ token: 'tok-1' }), useNavigate: () => mockNav }), { virtual: true })
jest.mock('../../lib/api', () => ({ api: { acceptInvitation: (...args: any[]) => mockAccept(...args), login: (...args: any[]) => mockLogin(...args) }, setToken: jest.fn() }))

beforeEach(() => { mockAccept.mockReset(); mockLogin.mockReset(); mockNav.mockReset() })

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

  describe('after the account is created', () => {
    const realLocation = window.location
    let assign: jest.Mock
    beforeEach(() => {
      jest.useFakeTimers()
      assign = jest.fn()
      delete (window as any).location
      ;(window as any).location = { ...realLocation, hostname: 'ea-platform-ui-1.run.app', origin: 'https://ea-platform-ui-1.run.app', assign }
    })
    afterEach(() => { jest.useRealTimers(); (window as any).location = realLocation })

    const createAccount = async (slug: string) => {
      mockAccept.mockResolvedValue({ userId: 'u1', email: 'a@x.gov.sa' })
      ;(global as any).fetch = jest.fn(async () => ({ ok: true, json: async () => ({ slug }) }))
      render(<InviteAcceptPage />)
      fireEvent.change(screen.getByLabelText('Full Name *'), { target: { value: 'Aisha' } })
      fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'password-1' } })
      fireEvent.change(screen.getByLabelText('Confirm Password *'), { target: { value: 'password-1' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create Account' }))
      await screen.findByRole('heading', { name: 'Account Created!' })
      await act(async () => { jest.advanceTimersByTime(2000) })
    }

    it("takes the person to their tenant's own address to sign in, not the shared platform URL", async () => {
      await createAccount('test-tenant')
      await waitFor(() => expect(assign).toHaveBeenCalledWith('https://hrdf.archmindworks.com/login?org=test-tenant&email=a%40x.gov.sa'))
      expect(mockLogin).not.toHaveBeenCalled()
      expect(screen.getByText(/Taking you to hrdf\.archmindworks\.com/)).toBeInTheDocument()
    })

    it('signs in right here for a tenant without its own address', async () => {
      mockLogin.mockResolvedValue({ accessToken: 'jwt' })
      await createAccount('acme')
      await waitFor(() => expect(mockNav).toHaveBeenCalledWith('/app'))
      expect(mockLogin).toHaveBeenCalledWith('a@x.gov.sa', 'password-1', 'acme')
      expect(assign).not.toHaveBeenCalled()
    })

    it('falls back to the sign-in page with the organization filled in', async () => {
      mockLogin.mockRejectedValue(new Error('nope'))
      await createAccount('acme')
      await waitFor(() => expect(mockNav).toHaveBeenCalledWith('/login?org=acme&email=a%40x.gov.sa'))
    })
  })
})
