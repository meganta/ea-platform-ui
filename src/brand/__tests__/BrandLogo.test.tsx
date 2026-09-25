import { existsSync } from 'fs'
import { join } from 'path'
import { render, screen } from '@testing-library/react'
import BrandLogo from '../BrandLogo'
import BrandPattern from '../BrandPattern'
import { BRAND_LOGO_ASSETS } from '../assets'

const registry = { ...BRAND_LOGO_ASSETS }
afterEach(() => { Object.keys(BRAND_LOGO_ASSETS).forEach((key) => delete (BRAND_LOGO_ASSETS as any)[key]); Object.assign(BRAND_LOGO_ASSETS, registry) })

describe('Logo assets', () => {
  it('registers every variant × tone and each file exists in public/', () => {
    const keys = ['horizontal', 'stacked', 'symbol'].flatMap((v) => ['color', 'reverse', 'white', 'dark'].map((t) => `${v}-${t}`))
    expect(Object.keys(BRAND_LOGO_ASSETS).sort()).toEqual(keys.sort())
    Object.values(BRAND_LOGO_ASSETS).forEach((src) => expect(existsSync(join(__dirname, '..', '..', '..', 'public', src!))).toBe(true))
  })

  it('ships the favicon, touch icon, PWA icons and social image the page metadata references', () => {
    const pub = (p: string) => existsSync(join(__dirname, '..', '..', '..', 'public', p))
    ;['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'brand/social/archmind-og-1200x630.png'].forEach((p) => expect(pub(p)).toBe(true))
    ;[16, 32, 48].forEach((n) => expect(pub(`brand/icons/favicon-${n}x${n}.png`)).toBe(true))
    ;[72, 96, 128, 144, 152, 192, 256, 384, 512, 1024].forEach((n) => expect(pub(`brand/icons/icon-${n}x${n}.png`)).toBe(true))
  })
})

describe('BrandLogo', () => {
  it('renders the approved file for the requested variant and tone', () => {
    render(<BrandLogo tone="reverse" />)
    expect(screen.getByRole('img', { name: 'ArchMind' })).toHaveAttribute('src', '/brand/logos/archmind-horizontal-reverse.svg')
  })

  it('renders as a labelled link without duplicating the accessible name', () => {
    render(<BrandLogo href="#top" label="ArchMind home" variant="stacked" />)
    const link = screen.getByRole('link', { name: 'ArchMind home' })
    expect(link).toHaveAttribute('href', '#top')
    expect(link.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('falls back to the name as text — ArchMind dominant, WORKS secondary, no improvised mark — if a file is missing', () => {
    delete (BRAND_LOGO_ASSETS as any)['horizontal-color']
    const { container } = render(<BrandLogo />)
    expect(screen.getByRole('img', { name: 'ArchMind' })).toBeInTheDocument()
    expect(container.querySelector('.am-wordmark-primary')).toHaveTextContent('ArchMind')
    expect(container.querySelector('.am-wordmark-secondary')).toHaveTextContent('WORKS')
    expect(container.querySelector('svg, img')).toBeNull()
  })
})

describe('BrandPattern', () => {
  it('is decorative and hidden from assistive technology', () => {
    const { container } = render(<><BrandPattern /><BrandPattern variant="topology" /></>)
    container.querySelectorAll('.am-pattern').forEach((node) => expect(node).toHaveAttribute('aria-hidden', 'true'))
    expect(container.querySelectorAll('.am-pattern svg path').length).toBeGreaterThan(10)
  })
})
