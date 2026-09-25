/**
 * Approved ArchMind logo assets.
 *
 * Only register files exported from the approved vector master (never a
 * screenshot of the brand board, never a redrawn approximation). Drop each
 * SVG into public/brand/logos/ with the file name below and add the entry.
 *
 * Expected production files (designer export):
 *   archmind-horizontal-color.svg   archmind-horizontal-white.svg   archmind-horizontal-dark.svg
 *   archmind-stacked-color.svg      archmind-stacked-white.svg      archmind-stacked-dark.svg
 *   archmind-symbol-color.svg       archmind-symbol-white.svg       archmind-symbol-dark.svg
 *
 * Until an entry exists, BrandLogo renders the brand name as accessible text
 * with the approved hierarchy (ArchMind dominant, WORKS secondary) and no symbol.
 */
export type LogoVariant = 'horizontal' | 'stacked' | 'symbol'
/** color = full colour (light backgrounds); white = on dark backgrounds; dark = monochrome on light backgrounds */
export type LogoTone = 'color' | 'white' | 'dark'

export const BRAND_LOGO_ASSETS: Partial<Record<`${LogoVariant}-${LogoTone}`, string>> = {
  // 'horizontal-color': '/brand/logos/archmind-horizontal-color.svg',
}

export const BRAND_NAME = 'ArchMind'
export const BRAND_DESCRIPTOR = 'WORKS'
/** Legal / company identity — use where the legal name is required (copyright, legal pages). */
export const BRAND_LEGAL_NAME = 'ArchMindWorks'

export function logoAsset(variant: LogoVariant, tone: LogoTone): string | undefined {
  return BRAND_LOGO_ASSETS[`${variant}-${tone}`]
}
