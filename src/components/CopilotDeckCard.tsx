import { useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { exportFileName } from '../lib/exportFileName'
import { saveBlob } from '../lib/studyExport'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

/** An answer Copilot turned into a PowerPoint deck (the outline is stored with the message; the file is rendered on download). */
export interface CopilotDeckAttachment {
  kind: 'DECK'
  id: string
  title: string
  language: 'AR' | 'EN'
  slideCount: number
  slideTitles: string[]
  notes?: string[]
  generatedAt: string
}

export function isDeckAttachment(a: any): a is CopilotDeckAttachment {
  return !!a && a.kind === 'DECK' && typeof a.id === 'string' && typeof a.title === 'string' && Array.isArray(a.slideTitles)
}

/**
 * The deck card under an answer: what the deck holds (slide titles) and its
 * PowerPoint download, rendered by the platform in the organization's branding.
 */
export default function CopilotDeckCard({ attachment: a, conversationId }: { attachment: CopilotDeckAttachment; conversationId?: string | null }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const download = async () => {
    if (!conversationId) { setError(t('copilot.deck.no_conversation')); return }
    setBusy(true); setError(null)
    try {
      const res = await fetch(`${API}/copilot/conversations/${encodeURIComponent(conversationId)}/decks/${encodeURIComponent(a.id)}`, { headers: { Authorization: `Bearer ${localStorage.getItem('ea_token') || ''}` } })
      if (!res.ok) throw new Error(String(res.status))
      saveBlob(await res.blob(), exportFileName(a.title, 'ArchMind_deck', a.language === 'AR' ? 'ar' : 'en', 'pptx'))
    } catch {
      setError(t('copilot.deck.download_failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section data-testid="copilot-deck-card" className="copilot-deck-card" style={{ margin: '8px 0 0', padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--navy-light)', maxWidth: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, overflowWrap: 'anywhere' }}>📊 {a.title}</span>
        <HelpTip text={t('copilot.deck.help')} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{t('copilot.deck.slides').replace('{count}', String(a.slideCount))} · {a.language === 'AR' ? t('copilot.deck.arabic') : t('copilot.deck.english')}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" onClick={download} disabled={busy}
          style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: busy ? 'default' : 'pointer', background: 'var(--accent)', color: 'var(--navy)', border: '1px solid var(--accent)', fontWeight: 600 }}>
          {busy ? t('copilot.deck.preparing') : `⬇ ${t('copilot.deck.download')}`}
        </button>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
          style={{ fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
          {open ? t('copilot.deck.hide_outline') : t('copilot.deck.show_outline')}
        </button>
      </div>
      {open && <ol style={{ margin: '8px 0 0', paddingInlineStart: 20, fontSize: 11.5, color: 'var(--text)' }}>{a.slideTitles.map((title, i) => <li key={i} style={{ overflowWrap: 'anywhere' }}>{title}</li>)}</ol>}
      {!!a.notes?.length && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 6 }}>{t('copilot.deck.notes')}: {a.notes.join(' ')}</div>}
      {error && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>{error}</div>}
    </section>
  )
}
