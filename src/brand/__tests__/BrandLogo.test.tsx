import { render, screen } from '@testing-library/react'
import BrandLogo from '../BrandLogo'
import BrandPattern from '../BrandPattern'
import { BRAND_LOGO_ASSETS } from '../assets'

afterEach(() => { Object.keys(BRAND_LOGO_ASSETS).forEach((key) => delete (BRAND_LOGO_ASSETS as any)[key]) })

describe('BrandLogo', () => {
  it('without approved vector files, renders the brand name with ArchMind dominant and WORKS secondary — no invented symbol', () => {
    const { container } = render(<BrandLogo />)
    expect(screen.getByRole('img', { name: 'ArchMind' })).toBeInTheDocument()
    expect(container.querySelector('.am-wordmark-primary')).toHaveTextContent('ArchMind')
    expect(container.querySelector('.am-wordmark-secondary')).toHaveTextContent('WORKS')
    expect(container.querySelector('svg, img')).toBeNull()
  })

  it('uses the registered approved file for the requested variant and tone', () => {
    ;(BRAND_LOGO_ASSETS as any)['horizontal-white'] = '/brand/logos/archmind-horizontal-white.svg'
    const { container } = render(<BrandLogo tone="white" />)
    expect(screen.getByRole('img', { name: 'ArchMind' })).toHaveAttribute('src', '/brand/logos/archmind-horizontal-white.svg')
    expect(container.querySelector('.am-wordmark')).toBeNull()
  })

  it('renders as a labelled link without duplicating the accessible name', () => {
    render(<BrandLogo href="#top" label="ArchMind home" />)
    const link = screen.getByRole('link', { name: 'ArchMind home' })
    expect(link).toHaveAttribute('href', '#top')
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('symbol requests without an approved symbol file fall back to the name only', () => {
    const { container } = render(<BrandLogo variant="symbol" />)
    expect(container.querySelector('.am-wordmark-primary')).toHaveTextContent('ArchMind')
    expect(container.querySelector('.am-wordmark-secondary')).toBeNull()
  })
})

describe('BrandPattern', () => {
  it('is decorative and hidden from assistive technology', () => {
    const { container } = render(<><BrandPattern /><BrandPattern variant="topology" /></>)
    container.querySelectorAll('.am-pattern').forEach((node) => expect(node).toHaveAttribute('aria-hidden', 'true'))
    expect(container.querySelectorAll('.am-pattern svg path').length).toBeGreaterThan(10)
  })
})
