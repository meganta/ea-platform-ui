import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LangProvider } from '../../contexts/LangContext'
import LandingPage from '../LandingPage'

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => <a href={to} {...props}>{children}</a>,
}), { virtual: true })

function renderLanding(locale: 'EN' | 'AR' = 'EN') {
  localStorage.setItem('ea_locale', locale)
  return render(
    <LangProvider>
      <LandingPage />
    </LangProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  global.fetch = jest.fn()
  document.documentElement.removeAttribute('dir')
  document.documentElement.removeAttribute('lang')
})

describe('ArchMind landing page', () => {
  it('renders the English customer proposition in LTR mode', () => {
    renderLanding('EN')

    expect(screen.getByRole('heading', { level: 1, name: 'Operate Enterprise Architecture with Clarity, Control, and Intelligence' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.title).toBe('ArchMind | Enterprise Architecture Operations Platform')
  })

  it('switches to Arabic, applies RTL, and persists the language preference', () => {
    const view = renderLanding('EN')
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Arabic' }))

    expect(screen.getByRole('heading', { level: 1, name: 'تشغيل البنية المؤسسية بوضوح وحوكمة وذكاء' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(document.documentElement).toHaveAttribute('lang', 'ar')
    expect(localStorage.getItem('ea_locale')).toBe('AR')

    view.unmount()
    render(
      <LangProvider>
        <LandingPage />
      </LangProvider>,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'تشغيل البنية المؤسسية بوضوح وحوكمة وذكاء' })).toBeInTheDocument()
  })

  it('exposes in-page navigation and the existing sign-in route', () => {
    renderLanding()

    expect(screen.getAllByRole('link', { name: 'Platform' })[0]).toHaveAttribute('href', '#platform')
    expect(screen.getAllByRole('link', { name: 'Capabilities' })[0]).toHaveAttribute('href', '#capabilities')
    expect(screen.getAllByRole('link', { name: 'Frameworks' })[0]).toHaveAttribute('href', '#frameworks')
    screen.getAllByRole('link', { name: 'Sign In' }).forEach((link) => expect(link).toHaveAttribute('href', '/login'))
  })

  it('provides an accessible responsive navigation toggle', () => {
    renderLanding()
    const toggle = screen.getByRole('button', { name: 'Open navigation' })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getAllByRole('link', { name: 'Platform' })[0])
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('validates required demo-request fields without transmitting data', () => {
    renderLanding()
    const submitButtons = screen.getAllByRole('button', { name: /Request a Demo/ })
    fireEvent.click(submitButtons[submitButtons.length - 1])

    expect(screen.getAllByText('This field is required')).toHaveLength(5)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('submits a valid demo request to the backend and shows a thank-you state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200, json: async () => ({ received: true }) })
    renderLanding()

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Aisha Al Saud' } })
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Example Authority' } })
    fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'Enterprise Architect' } })
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'aisha@example.gov.sa' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'We would like an architecture governance demonstration.' } })
    const submitButtons = screen.getAllByRole('button', { name: /Request a Demo/ })
    fireEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Thank you' })).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/public/demo-requests')
    expect(JSON.parse(options.body)).toMatchObject({ fullName: 'Aisha Al Saud', organization: 'Example Authority', email: 'aisha@example.gov.sa' })
  })

  it('falls back to a local copy-to-clipboard state when submission fails', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
    renderLanding()

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Aisha Al Saud' } })
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Example Authority' } })
    fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'Enterprise Architect' } })
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'aisha@example.gov.sa' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'We would like an architecture governance demonstration.' } })
    const submitButtons = screen.getAllByRole('button', { name: /Request a Demo/ })
    fireEvent.click(submitButtons[submitButtons.length - 1])

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your request is ready' })).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('ArchMind landing page — brand', () => {
  it('shows the ArchMind brand in header and footer, and the legal name in the copyright', () => {
    renderLanding()
    expect(screen.getAllByRole('link', { name: 'ArchMind home' })).toHaveLength(2)
    expect(screen.getByText(new RegExp(`© ${new Date().getFullYear()} ArchMindWorks`))).toBeInTheDocument()
  })

  it('keeps social metadata in sync with the language', () => {
    const meta = document.createElement('meta'); meta.setAttribute('name', 'twitter:title'); document.head.appendChild(meta)
    renderLanding('AR')
    expect(meta.getAttribute('content')).toBe('ArchMind | منصة تشغيل البنية المؤسسية')
    meta.remove()
  })
})

describe('ArchMind landing page — customers', () => {
  it('lists HRDF with its official logo and bilingual name', () => {
    renderLanding()
    const section = screen.getByRole('heading', { level: 2, name: 'Organizations operating enterprise architecture with ArchMind' }).closest('section')!
    expect(section).toHaveAttribute('id', 'customers')
    expect(screen.getByRole('heading', { level: 3, name: /Human Resources Development Fund \(HRDF\)/ })).toBeInTheDocument()
    expect(screen.getByAltText('Human Resources Development Fund logo')).toHaveAttribute('src', '/customers/hrdf.svg')
    expect(screen.getAllByRole('link', { name: 'Customers' })[0]).toHaveAttribute('href', '#customers')
  })

  it('shows the Arabic name in Arabic', () => {
    renderLanding('AR')
    expect(screen.getByRole('heading', { level: 3, name: /صندوق تنمية الموارد البشرية \(هدف\)/ })).toBeInTheDocument()
  })

  it('falls back to the short name if the logo file cannot load', () => {
    renderLanding()
    const logo = screen.getByAltText('Human Resources Development Fund logo')
    act(() => { logo.dispatchEvent(new Event('error')) })
    expect(screen.queryByAltText('Human Resources Development Fund logo')).toBeNull()
    expect(document.querySelector('.lp-customer-mark')).toHaveTextContent('HRDF')
  })
})
