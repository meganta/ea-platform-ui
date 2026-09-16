import { render, screen } from '@testing-library/react'
import Layout from '../Layout'
import { LangProvider } from '../../contexts/LangContext'

// Deliberately NOT mocking LangContext here — this test renders the real
// LangProvider + real translation dictionary so it catches the actual bug
// class this test exists for: a nav item hardcoded to a literal English
// string that bypasses t() entirely and never switches to Arabic, no
// matter what the real dictionary contains.

jest.mock('react-router-dom', () => ({
  Outlet: () => null,
  NavLink: ({ children, to }: any) => <a href={to}>{children}</a>,
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/app' }),
}), { virtual: true })

const mockHasPermission = jest.fn(() => true)
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'SUPERADMIN', email: 'admin@test.local' },
    logout: jest.fn(),
    hasPermission: (code: string) => mockHasPermission(code),
  }),
}))

jest.mock('../../contexts/BrandingContext', () => ({
  useBranding: () => ({ branding: null, logoUrl: null }),
}))

jest.mock('../../pages/SetupAssistantPage', () => () => null)
jest.mock('../NotificationBell', () => () => null)

beforeEach(() => {
  jest.clearAllMocks()
  mockHasPermission.mockReturnValue(true)
  localStorage.clear()
  localStorage.setItem('ea_locale', 'AR') // force Arabic, matching the platform's own AR-by-default
  global.fetch = jest.fn().mockResolvedValue({ ok: false }) // setup/profile check — irrelevant here
})

function renderLayoutInArabic() {
  render(
    <LangProvider>
      <Layout />
    </LangProvider>
  )
}

// Every nav item's label text as it should read in Arabic once its
// translation key is actually wired up. This is exactly the set of items
// that were previously hardcoded to literal English and silently never
// switched languages.
const EXPECTED_ARABIC_LABELS = [
  'الحوكمة',        // Governance
  'الاستراتيجية',    // Strategy
  'تخطيط البنية المؤسسية', // EA Planning
  'النموذج الفوقي',  // Meta-Model
  'مخططات البنية المؤسسية', // EA Views
  'الموصلات',        // Connectors
  'مسرد المصطلحات',  // Glossary
  'المستخدمون',       // Users
  'حوكمة الوصول',    // Access Governance
  'الإعدادات',        // Settings
  'مساعد الإعداد',    // Setup Assistant
  'طلبات العرض التجريبي', // Demo Requests
]

describe('Layout nav menu — Arabic localization', () => {
  it('renders every nav item in Arabic (not literal English) once locale is AR', () => {
    renderLayoutInArabic()
    for (const label of EXPECTED_ARABIC_LABELS) {
      expect(screen.getByText((content) => content.includes(label))).toBeInTheDocument()
    }
  })

  it('never shows the previously-hardcoded literal English nav labels once locale is AR', () => {
    renderLayoutInArabic()
    const hardcodedEnglishThatShouldBeGone = [
      'Governance', 'Strategy', 'EA Planning', 'Meta-Model', 'EA Views',
      'Connectors', 'Glossary', 'Users', 'Access Governance', 'Settings',
      'Setup Assistant', 'Demo Requests',
    ]
    for (const literal of hardcodedEnglishThatShouldBeGone) {
      expect(screen.queryByText((content) => content.trim() === literal)).not.toBeInTheDocument()
    }
  })
})
