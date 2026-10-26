import { render, screen, within } from '@testing-library/react'
import GovernanceSynthesis from '../GovernanceSynthesis'
import { SYNTHESIS_HORIZONS, SYNTHESIS_TRANSLATIONS } from '../governanceSynthesisStrings'

let mockArabic = false
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ t: (k: string) => k, isAR: mockArabic }) }))
jest.mock('../HelpTip', () => () => <span>?</span>)

const enc = { title: 'Missing encryption at rest', domain: 'SECURITY_ARCHITECTURE', severity: 'CRITICAL' }
const lock = { title: 'Vendor lock-in risk', domain: 'APPLICATION_INTEGRATION', severity: 'HIGH' }
const record: any = {
  status: 'COMPLETED',
  narrative: 'Both gaps come from one vendor choice.',
  themes: [{ title: 'Unprotected payment data', explanation: 'Both expose cardholder data.', findings: [enc, lock] }],
  roadmap: [
    { order: 1, action: 'Encrypt cardholder data', rationale: 'Blocks approval.', horizon: 'BEFORE_APPROVAL', findings: [enc], source: 'AI' },
    { order: 2, action: 'Add a provider abstraction', rationale: 'Add a provider abstraction', horizon: 'BEFORE_GO_LIVE', findings: [lock], source: 'PLATFORM' },
  ],
  limitations: ['1 CRITICAL or HIGH finding(s) the roadmap did not cover were added by the platform.'],
}

beforeEach(() => { mockArabic = false })

describe('GovernanceSynthesis', () => {
  it('shows the narrative, cross-domain themes and the roadmap grouped by when each step is due', () => {
    render(<GovernanceSynthesis record={record} />)
    expect(screen.getByText('gov.synthesis.title')).toBeInTheDocument()
    expect(screen.getByText('Both gaps come from one vendor choice.')).toBeInTheDocument()
    expect(screen.getByText('Unprotected payment data')).toBeInTheDocument()
    expect(screen.getByText('gov.synthesis.horizon.BEFORE_APPROVAL')).toBeInTheDocument()
    expect(screen.getByText('gov.synthesis.horizon.BEFORE_GO_LIVE')).toBeInTheDocument()
    expect(screen.queryByText('gov.synthesis.horizon.AFTER_GO_LIVE')).toBeNull()
    const step = screen.getByText('Encrypt cardholder data').closest('li')!
    expect(within(step).getByText('Blocks approval.')).toBeInTheDocument()
    expect(within(step).getByText('Missing encryption at rest')).toBeInTheDocument()
    // a platform-added step is marked; a rationale equal to the action is not repeated
    const added = screen.getByText('Add a provider abstraction').closest('li')!
    expect(within(added).getByText('gov.synthesis.platform')).toBeInTheDocument()
    expect(within(added).getAllByText('Add a provider abstraction')).toHaveLength(1)
    expect(screen.getByText(/did not cover were added/)).toBeInTheDocument()
  })

  it('a roadmap-only record says it is ordered by severity; an empty record renders nothing; Arabic is right-to-left', () => {
    mockArabic = true
    const { rerender, container } = render(<GovernanceSynthesis record={{ status: 'ROADMAP_ONLY', narrative: null, themes: [], roadmap: [record.roadmap[0]], limitations: [] }} />)
    expect(screen.getByText('gov.synthesis.roadmap_only')).toBeInTheDocument()
    expect(screen.getByTestId('gov-synthesis')).toHaveAttribute('dir', 'rtl')
    rerender(<GovernanceSynthesis record={{ status: 'ROADMAP_ONLY', narrative: null, themes: [], roadmap: [], limitations: [] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('every string has English and Arabic, every horizon has a label', () => {
    for (const [key, v] of Object.entries(SYNTHESIS_TRANSLATIONS)) {
      expect({ key, en: !!v.EN.trim(), ar: /[؀-ۿ]/.test(v.AR) }).toEqual({ key, en: true, ar: true })
    }
    for (const h of SYNTHESIS_HORIZONS) expect(SYNTHESIS_TRANSLATIONS[`gov.synthesis.horizon.${h}`]).toBeDefined()
  })
})
