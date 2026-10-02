import { useLang } from '../contexts/LangContext'
import { useState, CSSProperties } from 'react'
import HelpTip from './HelpTip'
import { EA_QUESTION_LIBRARY, ALL_EA_QUESTIONS, FEATURED_EA_QUESTIONS } from '../lib/eaQuestionLibrary'

/**
 * Copilot's suggested questions: a few featured EA questions on the opening
 * screen, plus an inline, collapsible browser for the whole approved library
 * (category chips -> that category's questions). Choosing a question only
 * hands its text to the caller, which puts it in the normal Copilot composer
 * exactly as if the person had typed it.
 */

const questionButton: CSSProperties = {
  padding: '10px 14px', background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10,
  color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all 0.15s', width: '100%',
}

function QuestionButton({ text, onSelect }: { text: string; onSelect: (text: string) => void }) {
  return (
    <button type="button" onClick={() => onSelect(text)} style={questionButton}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}>
      {text}
    </button>
  )
}

export default function EaQuestionExplorer({ onSelect }: { onSelect: (text: string) => void }) {
  const { isAR } = useLang()
  const L = (en: string, ar: string) => (isAR ? ar : en)
  const [open, setOpen] = useState(false)
  const [categoryId, setCategoryId] = useState(EA_QUESTION_LIBRARY[0].id)
  const category = EA_QUESTION_LIBRARY.find(c => c.id === categoryId) || EA_QUESTION_LIBRARY[0]

  const choose = (text: string) => { setOpen(false); onSelect(text) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 500 }}>
      {!open && FEATURED_EA_QUESTIONS.map(question => (
        <QuestionButton key={question.id} text={question.text} onSelect={choose} />
      ))}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="ea-question-library"
          style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '4px 6px' }}>
          {open ? L('← Back to suggested questions', '→ العودة إلى الأسئلة المقترحة') : L(`Explore EA Questions (${ALL_EA_QUESTIONS.length})`, `استكشف أسئلة البنية المؤسسية (${ALL_EA_QUESTIONS.length})`)}
        </button>
        <HelpTip text={L('A library of common Enterprise Architecture business questions, grouped by category. Choosing one puts it in the message box - review or adjust it, then press Send. Copilot answers it from your organization\'s data like any other question.', 'مكتبة لأسئلة الأعمال الشائعة في البنية المؤسسية مصنّفة حسب الفئة. اختيار سؤال يضعه في مربع الرسالة؛ راجعه أو عدّله ثم اضغط إرسال، ويجيب عنه المساعد من بيانات جهتك كأي سؤال آخر.')} />
      </div>

      {open && (
        <div id="ea-question-library" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div role="group" aria-label={L('EA question categories', 'فئات أسئلة البنية المؤسسية')} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {EA_QUESTION_LIBRARY.map(c => {
              const active = c.id === category.id
              return (
                <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(c.id)}
                  style={{
                    padding: '5px 11px', borderRadius: 999, fontSize: 12, fontWeight: active ? 700 : 500, cursor: 'pointer',
                    background: active ? 'var(--accent)' : 'var(--navy-light)', color: active ? 'var(--navy)' : 'var(--text-dim)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  }}>
                  {c.label} <span style={{ opacity: 0.75 }}>({c.questions.length})</span>
                </button>
              )
            })}
          </div>
          <div role="list" aria-label={`${category.label} questions`} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
            {category.questions.map(question => (
              <div role="listitem" key={question.id}>
                <QuestionButton text={question.text} onSelect={choose} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
