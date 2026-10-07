import { useState } from 'react'
import { useLang } from '../contexts/LangContext'
import HelpTip from './HelpTip'
import { CopilotViewAttachment, downloadAttachmentDeck, downloadAttachmentPng, isViewAttachment, svgDataUrl } from './copilotViewExport'
import CopilotStudyCard, { isStudyAttachment } from './CopilotStudyCard'
import CopilotDeckCard, { isDeckAttachment } from './CopilotDeckCard'
import CopilotHealthCard, { isHealthAttachment } from './CopilotHealthCard'

/**
 * EA Views that Copilot ran to illustrate an answer, shown under the answer:
 * the picture inline, and PNG / PowerPoint downloads built from that same
 * picture and its rows (no re-query). A saved view also links to EA Views.
 */
function ViewCard({ attachment: a, question }: { attachment: CopilotViewAttachment; question?: string }) {
  const { t, isAR } = useLang()
  const [busy, setBusy] = useState<'png' | 'deck' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const title = (isAR && a.titleAr) || a.title

  const run = async (kind: 'png' | 'deck') => {
    setBusy(kind); setError(null)
    try {
      if (kind === 'png') await downloadAttachmentPng(a)
      else await downloadAttachmentDeck(a, { question, isAR })
    } catch {
      setError(t('copilot.view.export_failed'))
    } finally {
      setBusy(null)
    }
  }

  const btn = (primary: boolean) => ({
    fontSize: 11.5, padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
    background: primary ? 'var(--accent)' : 'transparent', color: primary ? 'var(--navy)' : 'var(--text)',
    border: primary ? '1px solid var(--accent)' : '1px solid var(--border)', fontWeight: primary ? 600 : 400,
  })
  const deckFirst = a.preferredFormat === 'DECK'
  const meta = [a.visualization, a.architectureState, a.scenario].filter(Boolean).join(' · ')

  return (
    <figure data-testid="copilot-view-attachment" style={{ margin: '8px 0 0', padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--navy-light)', maxWidth: '100%' }}>
      <figcaption style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>🖼 {title}</span>
        <HelpTip text={t('copilot.view.help')} />
        <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>
          {meta}{meta ? ' · ' : ''}{a.stats.objects} {t('copilot.view.objects')} · {a.stats.relationships} {t('copilot.view.relationships')}
          {' · '}{a.source === 'VIEW_LIBRARY' ? t('copilot.view.from_library') : t('copilot.view.from_saved')}
        </span>
      </figcaption>
      <img src={svgDataUrl(a.image.svg)} alt={title} width={a.image.width} height={a.image.height}
        style={{ display: 'block', width: '100%', maxWidth: a.image.width, height: 'auto', borderRadius: 6, background: '#fff' }} />
      {a.stats.truncated && <div style={{ fontSize: 10.5, color: 'var(--text-dim)', marginTop: 4 }}>{t('copilot.view.truncated')}</div>}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, flexDirection: deckFirst ? 'row-reverse' : 'row', justifyContent: deckFirst ? 'flex-end' : 'flex-start' }}>
        <button type="button" style={btn(!deckFirst)} disabled={busy !== null} onClick={() => run('png')}>
          {busy === 'png' ? t('copilot.view.preparing') : `⬇ ${t('copilot.view.download_png')}`}
        </button>
        <button type="button" style={btn(deckFirst)} disabled={busy !== null} onClick={() => run('deck')}>
          {busy === 'deck' ? t('copilot.view.preparing') : `📊 ${t('copilot.view.download_deck')}`}
        </button>
        {a.viewId && (
          <a href={`/ea-views?viewId=${encodeURIComponent(a.viewId)}`} target="_blank" rel="noopener noreferrer" style={{ ...btn(false), textDecoration: 'none', display: 'inline-block' }}>
            ↗ {t('copilot.view.open')}
          </a>
        )}
      </div>
      {error && <div role="alert" style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>{error}</div>}
    </figure>
  )
}

export default function CopilotViewAttachments({ attachments, question, conversationId }: { attachments?: unknown[] | null; question?: string; conversationId?: string | null }) {
  const { isAR } = useLang()
  const valid = (attachments || []).filter(a => isViewAttachment(a) || isStudyAttachment(a) || isDeckAttachment(a) || isHealthAttachment(a))
  if (valid.length === 0) return null
  return (
    <div dir={isAR ? 'rtl' : 'ltr'} data-testid="copilot-view-attachments">
      {valid.map((a: any) => (isStudyAttachment(a)
        ? <CopilotStudyCard key={a.id} attachment={a} />
        : isDeckAttachment(a)
          ? <CopilotDeckCard key={a.id} attachment={a} conversationId={conversationId} />
          : isHealthAttachment(a)
            ? <CopilotHealthCard key={a.id} attachment={a} />
            : <ViewCard key={a.id} attachment={a} question={question} />))}
    </div>
  )
}
