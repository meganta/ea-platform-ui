import { CSSProperties } from 'react'
import { BRAND_DESCRIPTOR, BRAND_NAME, logoAsset, LogoTone, LogoVariant } from './assets'

interface BrandLogoProps {
  variant?: LogoVariant
  tone?: LogoTone
  /** Wordmark cap size in px; image logos scale from it. */
  size?: number
  /** Renders as a link when set. */
  href?: string
  /** Accessible label for the link (defaults to the brand name). */
  label?: string
  className?: string
}

/**
 * The ArchMind logo. Renders the approved vector file for the requested
 * variant/tone when it is registered in brand/assets.ts; otherwise the brand
 * name as text (never an invented symbol). The clear-space padding is built in.
 */
export default function BrandLogo({ variant = 'horizontal', tone = 'color', size = 22, href, label, className = '' }: BrandLogoProps) {
  const asset = logoAsset(variant, tone)
  const classes = ['am-logo', variant === 'horizontal' ? '' : variant, `tone-${tone === 'dark' ? 'mono' : tone === 'reverse' ? 'white' : tone}`, className].filter(Boolean).join(' ')
  const style = { '--am-logo-size': `${size}px` } as CSSProperties
  // Without an approved file, a symbol request falls back to the name alone — never a drawn mark.
  const content = asset
    ? <img src={asset} alt={href ? '' : BRAND_NAME} />
    : <span className="am-wordmark" aria-hidden="true">
        <span className="am-wordmark-primary">{BRAND_NAME}</span>
        {variant !== 'symbol' && <span className="am-wordmark-secondary">{BRAND_DESCRIPTOR}</span>}
      </span>
  if (href) return <a className={classes} style={style} href={href} aria-label={label || BRAND_NAME}>{content}</a>
  return <span className={classes} style={style} role={asset ? undefined : 'img'} aria-label={asset ? undefined : BRAND_NAME}>{content}</span>
}
