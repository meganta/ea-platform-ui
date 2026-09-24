import { fireEvent, render, screen } from '@testing-library/react'
import DesignPicker, { GalleryDesign } from '../DesignPicker'

let mockIsAR = false
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: mockIsAR }),
}))

const gallery: GalleryDesign[] = ['executive-consulting', 'government-executive', 'architecture-professional', 'executive-minimal'].map(id => ({
  id, name: `${id} EN`, nameAr: `${id} AR`, description: `${id} description`, descriptionAr: `${id} وصف`, audience: { EN: 'Boards', AR: 'المجالس' }, formats: ['PPTX'],
  previews: { EN: ['cover', 'summary', 'exhibit', 'architecture', 'roadmap'].map(k => `/presentation-previews/${id}/en-${k}.png`), AR: ['cover', 'summary', 'exhibit', 'architecture', 'roadmap'].map(k => `/presentation-previews/${id}/ar-${k}.png`) },
}))
const docx: GalleryDesign = { id: 'archmind-document', name: 'ArchMind Document', description: 'Word', formats: ['DOCX'] }

function setup(overrides: Partial<Parameters<typeof DesignPicker>[0]> = {}) {
  const onChange = jest.fn()
  render(<DesignPicker gallery={[...gallery, docx]} templates={[{ id: 'tpl-1', name: 'Brand', version: 2, format: 'PPTX' }, { id: 'tpl-doc', name: 'Word brand', version: 1, format: 'DOCX' }]} defaultTemplateId="tpl-1" value={{ templateId: '', baseDesign: 'architecture-professional' }} onChange={onChange} previewLanguage="EN" {...overrides} />)
  return onChange
}

describe('DesignPicker', () => {
  beforeEach(() => { mockIsAR = false })

  it('lists the organization options and exactly the four built-in PowerPoint designs', () => {
    setup()
    expect(screen.getByText('studio.your_org')).toBeInTheDocument()
    expect(screen.getByText('studio.org_default')).toBeInTheDocument()
    expect(screen.getByText(/Brand · v2 · studio.default_badge/)).toBeInTheDocument()
    expect(screen.queryByText(/Word brand/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /EN$/ }).filter(el => el.className.includes('design-card'))).toHaveLength(4)
    expect(screen.queryByText('ArchMind Document')).not.toBeInTheDocument()
  })

  it('shows five real preview slides per design in the export language', () => {
    setup()
    const images = screen.getAllByRole('img').filter(img => img.getAttribute('src')!.includes('/executive-minimal/'))
    expect(images.map(img => img.getAttribute('src'))).toEqual(['cover', 'summary', 'exhibit', 'architecture', 'roadmap'].map(k => `/presentation-previews/executive-minimal/en-${k}.png`))
  })

  it('switches previews to Arabic for an Arabic export and renders RTL with Arabic names', () => {
    mockIsAR = true
    const { container } = render(<DesignPicker gallery={gallery} templates={[]} value={{ templateId: '', baseDesign: 'architecture-professional' }} onChange={jest.fn()} previewLanguage="AR" />)
    expect(container.firstChild).toHaveAttribute('dir', 'rtl')
    expect(screen.getByText('government-executive AR')).toBeInTheDocument()
    expect(screen.getAllByRole('img')[0].getAttribute('src')).toContain('/ar-cover.png')
  })

  it('selects a built-in design by click or keyboard', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: 'government-executive EN' }))
    expect(onChange).toHaveBeenCalledWith({ templateId: 'government-executive', baseDesign: 'architecture-professional' })
    fireEvent.keyDown(screen.getByRole('button', { name: 'executive-minimal EN' }), { key: 'Enter' })
    expect(onChange).toHaveBeenLastCalledWith({ templateId: 'executive-minimal', baseDesign: 'architecture-professional' })
  })

  it('asks for a base ArchMind design when a tenant template is selected', () => {
    const onChange = jest.fn()
    render(<DesignPicker gallery={gallery} templates={[{ id: 'tpl-1', name: 'Brand', version: 2, format: 'PPTX' }]} value={{ templateId: 'tpl-1', baseDesign: 'architecture-professional' }} onChange={onChange} previewLanguage="EN" />)
    const select = screen.getByLabelText(/studio.base_design/)
    fireEvent.change(select, { target: { value: 'executive-consulting' } })
    expect(onChange).toHaveBeenCalledWith({ templateId: 'tpl-1', baseDesign: 'executive-consulting' })
  })

  it('opens an enlarged preview dialog and closes it', () => {
    setup()
    fireEvent.click(screen.getAllByText('studio.preview')[1])
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'studio.preview — government-executive EN')
    fireEvent.click(screen.getByText('studio.close'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explains that the design never changes content (help tip)', () => {
    setup()
    expect(screen.getAllByRole('button', { name: 'common.more_info' }).length).toBeGreaterThan(0)
  })
})
