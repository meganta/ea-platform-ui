import { useState, useRef, useEffect } from 'react'

/**
 * A small "ⓘ" icon that, when clicked, shows a short, plain-language
 * explanation of whatever it's attached to - a page, a section, a button,
 * a setting. Written for a non-technical end user, not for developers or
 * architects: explain what something does and why it matters in everyday
 * language, not in the platform's internal terminology.
 *
 * Deliberately click-to-open rather than hover-only: hover tooltips don't
 * work on touch devices at all, and this platform is used on mobile too.
 *
 * Usage:
 *   <HelpTip text="This shows how healthy your review is overall. Green means things look good; red means something needs fixing before this can move forward." />
 *
 * Keep `text` to 1-3 short sentences. If something genuinely needs more
 * explanation than that, the UI itself probably needs simplifying, not a
 * longer tooltip.
 */
export default function HelpTip({ text, placement = 'bottom' }: { text: string; placement?: 'top' | 'bottom' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label="More information"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
        style={{
          width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--text-dim)',
          background: open ? 'var(--accent)' : 'transparent', color: open ? 'var(--navy)' : 'var(--text-dim)',
          fontSize: 10, lineHeight: '14px', fontWeight: 700, cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          marginLeft: 5, transition: 'all 0.15s',
        }}
      >
        i
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 200, [placement === 'top' ? 'bottom' : 'top']: 22, left: 0,
            width: 240, maxWidth: '70vw', background: 'var(--navy-mid)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.5, color: 'var(--text)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)', fontWeight: 400,
          }}
        >
          {text}
        </div>
      )}
    </span>
  )
}
