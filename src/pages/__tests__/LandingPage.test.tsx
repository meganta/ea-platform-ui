import { fireEvent, render, screen } from '@testing-library/react'
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

describe('ArqOps landing page', () => {
  it('renders the English customer proposition in LTR mode', () => {
    renderLanding('EN')

    expect(screen.getByRole('heading', { level: 1, name: 'Operate Enterprise Architecture with Clarity, Control, and Intelligence' })).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'ltr')
    expect(document.documentElement).toHaveAttribute('lang', 'en')
    expect(document.title).toBe('ArqOps | Enterprise Architecture Operations Platform')
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

  it('prepares a valid demo request locally and explains the submission limitation', () => {
    renderLanding()

    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Aisha Al Saud' } })
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'Example Authority' } })
    fireEvent.change(screen.getByLabelText('Job Title'), { target: { value: 'Enterprise Architect' } })
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'aisha@example.gov.sa' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'We would like an architecture governance demonstration.' } })
    const submitButtons = screen.getAllByRole('button', { name: /Request a Demo/ })
    fireEvent.click(submitButtons[submitButtons.length - 1])

    expect(screen.getByRole('heading', { name: 'Your request is ready' })).toBeInTheDocument()
    expect(screen.getByText(/Online submission is not connected yet/)).toBeInTheDocument()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
