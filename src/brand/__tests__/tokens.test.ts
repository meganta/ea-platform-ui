import { readFileSync } from 'fs'
import { join } from 'path'

const css = readFileSync(join(__dirname, '..', 'tokens.css'), 'utf8')
const token = (name: string) => css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim()

describe('ArchMind design tokens', () => {
  it('carries the approved palette exactly', () => {
    expect(token('--am-navy')).toMatch(/^#081F3B/i)
    expect(token('--am-blue')).toMatch(/^#2563EB/i)
    expect(token('--am-cyan')).toMatch(/^#06B6D4/i)
    expect(token('--am-teal')).toMatch(/^#14B8A6/i)
    expect(token('--am-neutral-light')).toMatch(/^#E6F0FF/i)
    expect(token('--am-gradient')).toMatch(/#2563EB.*#06B6D4.*#14B8A6/i)
  })

  it('defines every token family the portal relies on', () => {
    const required = [
      '--am-text-primary', '--am-text-secondary', '--am-text-muted', '--am-border', '--am-disabled-bg', '--am-focus', '--am-success', '--am-warning', '--am-error',
      '--am-font-latin', '--am-font-arabic', '--am-display-size', '--am-h1-size', '--am-h2-size', '--am-h3-size', '--am-h4-size', '--am-h5-size', '--am-body-lg-size', '--am-body-size', '--am-body-sm-size', '--am-label-size', '--am-caption-size', '--am-button-size', '--am-nav-size',
      '--am-space-4', '--am-space-8', '--am-space-16', '--am-radius-sm', '--am-radius-md', '--am-radius-lg', '--am-radius-card', '--am-radius-pill',
      '--am-shadow-subtle', '--am-shadow-card', '--am-shadow-elevated', '--am-shadow-modal', '--am-border-default',
      '--am-content-max', '--am-section-y', '--am-gutter', '--am-duration-fast', '--am-duration-normal', '--am-duration-slow',
    ]
    required.forEach((name) => expect(token(name)).toBeTruthy())
  })

  it('uses Manrope for Latin text and keeps an Arabic face for Arabic', () => {
    expect(token('--am-font-latin')).toMatch(/^'Manrope'/)
    expect(token('--am-font-arabic')).toMatch(/^'IBM Plex Sans Arabic'/)
  })

  it('removes motion for users who prefer reduced motion', () => {
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*--am-duration-normal: 0ms/)
  })
})

describe('ArchMind button contrast', () => {
  it('keeps white text on the action gradient readable at both ends (WCAG AA 4.5:1)', () => {
    const lum = (hex: string) => { const c = [0, 2, 4].map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] }
    const stops = token('--am-gradient-action')!.match(/#[0-9A-F]{6}/gi)!
    stops.forEach((stop) => expect(1.05 / (lum(stop) + 0.05)).toBeGreaterThanOrEqual(4.5))
    const brandCss = readFileSync(join(__dirname, '..', 'brand.css'), 'utf8')
    expect(brandCss).toMatch(/\.am-btn-brand \{ background: var\(--am-gradient-action\)/)
  })
})
