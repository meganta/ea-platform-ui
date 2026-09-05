import { useState, useRef, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'

export default function HelpTip({ text, placement = 'bottom' }: { text: string; placement?: 'top' | 'bottom' }) {
  const { t } = useLang()
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
        aria-label={t('common.more_info')}
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
