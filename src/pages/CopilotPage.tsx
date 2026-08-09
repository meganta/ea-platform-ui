import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  const { token } = useAuth() as any
  const h = () => ({ Authorization: `Bearer ${token || localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' })
  const get = (p: string) => fetch(`${API}${p}`, { headers: h() }).then(r => r.json())
  const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: h(), body: b ? JSON.stringify(b) : undefined }).then(r => r.json())
  const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: h() })
  return { get, post, del, token: token || localStorage.getItem('ea_token') || '' }
}

interface Msg { id: string; role: 'user' | 'architect' | 'system'; content: string; architectCode?: string; architectName?: string; architectAvatar?: string; timestamp: Date }
interface Architect { id: string; code: string; name: string; role: string; domain?: string; avatar: string; description?: string; isChief: boolean; aiModel: string; isActive: boolean }

const MODEL_LABEL: Record<string, string> = { haiku: '⚡ Fast', sonnet: '🧠 Smart' }
const DOMAIN_COLOR: Record<string, string> = { CHIEF: '#f39c12', BUSINESS: '#3498db', APPLICATION: '#e67e22', INTEGRATION: '#16a085', DATA: '#1abc9c', TECHNOLOGY: '#e74c3c', SECURITY: '#9b59b6' }

export default function CopilotPage() {
  const api = useApi()
  const [architects, setArchitects] = useState<Architect[]>([])
  const [selectedArchitect, setSelectedArchitect] = useState<Architect | null>(null)
  const [consultArchitects, setConsultArchitects] = useState<string[]>([])
  const [mode, setMode] = useState<'single' | 'consult'>('single')
  const [messages, setMessages] = useState<Msg[]>([])
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [includeChief, setIncludeChief] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'architects' | 'history'>('architects')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Voice state ───────────────────────────────────────────────────────────
  const [voiceMode, setVoiceMode] = useState(false)
  const [recording, setRecording] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [voiceLanguage, setVoiceLanguage] = useState<'en'|'ar'|''>('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Load architects
  useEffect(() => {
    api.get('/copilot/architects').then((d: any) => {
      const archs = Array.isArray(d) ? d : []
      setArchitects(archs)
      // Default to Chief
      const chief = archs.find((a: Architect) => a.isChief)
      if (chief) setSelectedArchitect(chief)
    })
    api.get('/copilot/conversations').then((d: any) => setConversations(Array.isArray(d) ? d : []))
  }, [])

  const loadConversation = async (convId: string) => {
    const msgs = await api.get(`/copilot/conversations/${convId}/messages`)
    if (Array.isArray(msgs)) {
      const archMap = Object.fromEntries(architects.map(a => [a.code, a]))
      setMessages(msgs.map((m: any) => ({
        id: m.id, role: m.role, content: m.content,
        architectCode: m.architectCode,
        architectName: m.architectCode ? (archMap[m.architectCode]?.name || m.architectCode) : undefined,
        architectAvatar: m.architectCode ? (archMap[m.architectCode]?.avatar || '🤖') : undefined,
        timestamp: new Date(m.createdAt),
      })))
      setActiveConvId(convId)
    }
  }

  const newConversation = () => {
    setMessages([])
    setActiveConvId(null)
  }

  // ── Stream SSE helper ─────────────────────────────────────────────────────
  const streamSse = useCallback(async (endpoint: string, body: any, onChunk: (d: any) => void) => {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${api.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try { onChunk(JSON.parse(line.slice(6))) } catch {}
        }
      }
    }
  }, [api.token])

  // ── Voice functions ──────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const mr = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        await processVoiceTurn(blob, mimeType)
      }
      mr.start(100) // collect in 100ms chunks
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch (e: any) {
      alert('Microphone access denied. Please allow microphone access to use voice mode.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  const processVoiceTurn = async (blob: Blob, mimeType: string) => {
    setVoiceLoading(true)
    try {
      // Add a "processing" indicator
      const processingId = Date.now() + 'v'
      setMessages(m => [...m, { id: processingId + 'u', role: 'user', content: '🎤 Processing audio...', timestamp: new Date() }])

      const fd = new FormData()
      fd.append('audio', blob, 'recording.' + (mimeType.includes('webm') ? 'webm' : 'ogg'))
      fd.append('architectCode', selectedArchitect?.code || 'CHIEF')
      if (activeConvId) fd.append('conversationId', activeConvId)
      if (voiceLanguage) fd.append('language', voiceLanguage)
      fd.append('ttsEnabled', ttsEnabled ? 'true' : 'false')

      const res = await fetch(`${API}/copilot/voice/turn`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${api.token}` },
        body: fd,
      })
      const data = await res.json()

      if (data.error || !data.userText) {
        setMessages(m => m.map(msg => msg.id === processingId + 'u' ? { ...msg, content: '🎤 ' + (data.message || 'Could not transcribe audio') } : msg))
        return
      }

      // Update user message with transcription
      setMessages(m => m.map(msg => msg.id === processingId + 'u' ? { ...msg, content: '🎤 ' + data.userText } : msg))

      // Add architect response
      const arch = selectedArchitect
      setMessages(m => [...m, {
        id: processingId + 'a', role: 'architect', content: data.architectText,
        architectCode: arch?.code, architectName: arch?.name, architectAvatar: arch?.avatar,
        timestamp: new Date(),
      }])

      if (data.conversationId) setActiveConvId(data.conversationId)

      // Play TTS audio if available
      if (data.audioBase64 && ttsEnabled) {
        const audioData = `data:audio/mpeg;base64,${data.audioBase64}`
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = audioData
          audioPlayerRef.current.play().catch(() => {})
        }
      }

      refreshConversations()
    } catch (e: any) {
      console.error('Voice turn error:', e)
      setMessages(m => [...m, { id: Date.now() + 'err', role: 'system', content: 'Voice processing failed: ' + e.message, timestamp: new Date() }])
    } finally {
      setVoiceLoading(false)
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || loading) return
    const msg = input.trim(); setInput(''); setLoading(true)
    const userMsg: Msg = { id: Date.now() + 'u', role: 'user', content: msg, timestamp: new Date() }
    setMessages(m => [...m, userMsg])

    if (mode === 'single' && selectedArchitect) {
      // Single architect — streaming
      const streamingId = Date.now() + 'a'
      setMessages(m => [...m, { id: streamingId, role: 'architect', content: '', architectCode: selectedArchitect.code, architectName: selectedArchitect.name, architectAvatar: selectedArchitect.avatar, timestamp: new Date() }])

      await streamSse('/copilot/chat', { message: msg, architectCode: selectedArchitect.code, conversationId: activeConvId }, (d) => {
        if (d.type === 'meta') setActiveConvId(d.conversationId)
        if (d.type === 'text') setMessages(m => m.map(msg2 => msg2.id === streamingId ? { ...msg2, content: msg2.content + d.content } : msg2))
        if (d.type === 'done') { setActiveConvId(d.conversationId); refreshConversations() }
      })
    } else {
      // Multi-architect consultation
      const codes = consultArchitects.length > 0 ? consultArchitects : architects.filter(a => !a.isChief).map(a => a.code).slice(0, 3)

      await streamSse('/copilot/consult', { message: msg, architectCodes: codes, includeChief, conversationId: activeConvId }, (d) => {
        if (d.type === 'meta') setActiveConvId(d.conversationId)
        if (d.type === 'architect_response') {
          const arch = architects.find(a => a.code === d.architectCode)
          setMessages(m => [...m, { id: Date.now() + d.architectCode, role: 'architect', content: d.content, architectCode: d.architectCode, architectName: d.architectName || arch?.name, architectAvatar: arch?.avatar || '🤖', timestamp: new Date() }])
        }
        if (d.type === 'chief_start') {
          const chief = architects.find(a => a.isChief)
          setMessages(m => [...m, { id: 'chief_' + Date.now(), role: 'architect', content: '', architectCode: 'CHIEF', architectName: chief?.name || 'Chief Architect', architectAvatar: chief?.avatar || '🏛', timestamp: new Date() }])
        }
        if (d.type === 'chief_chunk') setMessages(m => {
          const last = [...m].reverse().find(msg2 => msg2.architectCode === 'CHIEF')
          if (last) return m.map(msg2 => msg2.id === last.id ? { ...msg2, content: msg2.content + d.content } : msg2)
          return m
        })
        if (d.type === 'done') { setActiveConvId(d.conversationId); refreshConversations() }
      })
    }
    setLoading(false)
  }

  const refreshConversations = () => {
    api.get('/copilot/conversations').then((d: any) => setConversations(Array.isArray(d) ? d : []))
  }

  const QUICK_QUESTIONS = [
    'What are the major architectural risks in our current application portfolio?',
    'Review our data architecture from a governance perspective',
    'What capabilities are not supported by any application?',
    'What technology components are approaching end of life?',
  ]

  const archColor = (code?: string) => DOMAIN_COLOR[code || 'CHIEF'] || '#7f8c8d'

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--navy)', overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div style={{ width: 260, background: 'var(--navy-light)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🤖 EA Copilot</div>
          <button onClick={newConversation} style={{ width: '100%', padding: '7px 0', borderRadius: 8, background: 'var(--accent)', color: '#0B1929', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ New Conversation</button>
        </div>

        {/* Sidebar tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['architects', 'history'] as const).map(t => (
            <button key={t} style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: sidebarTab === t ? 600 : 400, color: sidebarTab === t ? 'var(--accent)' : 'var(--text-dim)', background: 'none', border: 'none', borderBottom: `2px solid ${sidebarTab === t ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer' }} onClick={() => setSidebarTab(t)}>
              {t === 'architects' ? '👥 Architects' : '🕐 History'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          {sidebarTab === 'architects' ? (
            <>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'var(--navy)', borderRadius: 8, padding: 3 }}>
                <button onClick={() => setMode('single')} style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: mode === 'single' ? 600 : 400, background: mode === 'single' ? 'var(--accent)' : 'none', color: mode === 'single' ? '#0B1929' : 'var(--text-dim)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Single</button>
                <button onClick={() => setMode('consult')} style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: mode === 'consult' ? 600 : 400, background: mode === 'consult' ? 'var(--accent)' : 'none', color: mode === 'consult' ? '#0B1929' : 'var(--text-dim)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Consult</button>
              </div>

              {/* Architect list */}
              {architects.map(a => {
                const isSelected = mode === 'single' ? selectedArchitect?.code === a.code : consultArchitects.includes(a.code)
                const color = archColor(a.code)
                return (
                  <div key={a.id} onClick={() => {
                    if (mode === 'single') setSelectedArchitect(a)
                    else setConsultArchitects(prev => prev.includes(a.code) ? prev.filter(c => c !== a.code) : [...prev, a.code].slice(0, 4))
                  }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: isSelected ? color + '22' : 'none', border: `1px solid ${isSelected ? color + '55' : 'transparent'}`, transition: 'all 0.15s' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{a.avatar}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? color : 'var(--text)' }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.role}</div>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>{MODEL_LABEL[a.aiModel]}</div>
                  </div>
                )
              })}

              {/* Consult options */}
              {mode === 'consult' && (
                <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--navy)', borderRadius: 8, fontSize: 11, color: 'var(--text-dim)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={includeChief} onChange={e => setIncludeChief(e.target.checked)} />
                    Chief Architect synthesis
                  </label>
                  <div style={{ marginTop: 6 }}>{consultArchitects.length === 0 ? 'All domain architects' : `${consultArchitects.length} selected (max 4)`}</div>
                </div>
              )}
            </>
          ) : (
            // History
            <>
              {conversations.length === 0 && <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', padding: 20 }}>No conversations yet</div>}
              {conversations.map(c => (
                <div key={c.id} onClick={() => loadConversation(c.id)} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: activeConvId === c.id ? 'rgba(0,180,216,0.1)' : 'none', border: `1px solid ${activeConvId === c.id ? 'var(--accent)44' : 'transparent'}` }}
                  onMouseEnter={e => { if (activeConvId !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  onMouseLeave={e => { if (activeConvId !== c.id) e.currentTarget.style.background = 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || 'Untitled'}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{c.messageCount} messages · {new Date(c.updatedAt).toLocaleDateString()}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main chat area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Chat header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--navy-light)' }}>
          {mode === 'single' && selectedArchitect ? (
            <>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: archColor(selectedArchitect.code) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{selectedArchitect.avatar}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedArchitect.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{selectedArchitect.role} · {MODEL_LABEL[selectedArchitect.aiModel]}</div>
              </div>
            </>
          ) : (
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Multi-Architect Consultation</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {consultArchitects.length === 0 ? 'All domain architects' : consultArchitects.map(c => architects.find(a => a.code === c)?.name).join(', ')}
                {includeChief ? ' + Chief Synthesis' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
              <div style={{ fontSize: 56 }}>{selectedArchitect?.avatar || '🤖'}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{mode === 'single' ? (selectedArchitect?.name || 'EA Copilot') : 'Multi-Architect Consultation'}</div>
              <div style={{ fontSize: 14, color: 'var(--text-dim)', maxWidth: 400, textAlign: 'center' }}>
                {mode === 'single' ? (selectedArchitect?.description || 'Ask me anything about enterprise architecture') : 'Multiple domain architects will analyze your question from different perspectives'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 500 }}>
                {QUICK_QUESTIONS.map(q => (
                  <button key={q} onClick={() => setInput(q)} style={{ padding: '10px 14px', background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-dim)', cursor: 'pointer', fontSize: 13, textAlign: 'left', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div key={m.id} style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: m.role === 'user' ? 'var(--accent)33' : archColor(m.architectCode) + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                {m.role === 'user' ? '👤' : (m.architectAvatar || '🤖')}
              </div>

              {/* Bubble */}
              <div style={{ maxWidth: '75%' }}>
                {m.role !== 'user' && m.architectName && (
                  <div style={{ fontSize: 11, fontWeight: 600, color: archColor(m.architectCode), marginBottom: 4 }}>{m.architectName}</div>
                )}
                <div style={{ padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px', background: m.role === 'user' ? 'var(--accent)' : 'var(--navy-light)', color: m.role === 'user' ? '#0B1929' : 'var(--text)', fontSize: 13, lineHeight: 1.7, border: m.role !== 'user' ? `1px solid ${archColor(m.architectCode)}33` : 'none', whiteSpace: 'pre-wrap' }}>
                  {m.content || <span style={{ opacity: 0.5 }}><span className="typing-dot" style={{ animation: 'blink 1s infinite' }}>•</span><span style={{ animationDelay: '0.2s', animation: 'blink 1s infinite' }}> •</span><span style={{ animationDelay: '0.4s', animation: 'blink 1s infinite' }}> •</span></span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {loading && messages[messages.length-1]?.role !== 'architect' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,180,216,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div style={{ padding: '10px 14px', borderRadius: '4px 12px 12px 12px', background: 'var(--navy-light)', border: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text-dim)' }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--navy-light)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={mode === 'single' ? `Ask ${selectedArchitect?.name || 'the architect'}... (Enter to send, Shift+Enter for newline)` : 'Ask all selected architects...'}
              rows={2} style={{ flex: 1, padding: '10px 14px', background: 'var(--navy)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5 }} />
            <button onClick={() => setVoiceMode(v => !v)} title="Toggle voice mode"
            style={{ padding: '10px 14px', borderRadius: 10, background: voiceMode ? '#e74c3c22' : 'var(--navy-mid)', color: voiceMode ? '#e74c3c' : 'var(--text-dim)', border: `1px solid ${voiceMode ? '#e74c3c44' : 'var(--border)'}`, cursor: 'pointer', fontSize: 18 }}>
            🎤
          </button>
          <button onClick={send} disabled={loading || !input.trim()}
              style={{ padding: '10px 20px', borderRadius: 10, background: loading || !input.trim() ? 'var(--navy-mid)' : 'var(--accent)', color: loading || !input.trim() ? 'var(--text-dim)' : '#0B1929', border: 'none', cursor: loading || !input.trim() ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
              {loading ? '...' : 'Send ↵'}
            </button>
          </div>
          {/* Hidden audio player for TTS */}
        <audio ref={audioPlayerRef} style={{ display: 'none' }} />

        {/* Voice controls */}
        {voiceMode && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10, padding: '10px 14px', background: 'var(--navy)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={e => { e.preventDefault(); startRecording() }}
              onTouchEnd={e => { e.preventDefault(); stopRecording() }}
              disabled={voiceLoading}
              style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: recording ? '#e74c3c' : voiceLoading ? 'var(--navy-mid)' : 'var(--accent)', color: recording ? '#fff' : '#0B1929', cursor: voiceLoading ? 'default' : 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: recording ? '0 0 0 8px #e74c3c33' : 'none', flexShrink: 0 }}>
              {voiceLoading ? '⏳' : recording ? '⏹' : '🎤'}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: recording ? '#e74c3c' : voiceLoading ? 'var(--text-dim)' : 'var(--text)' }}>
                {voiceLoading ? 'Processing...' : recording ? 'Recording — release to send' : 'Hold 🎤 to record'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                Speaking to: {selectedArchitect?.avatar} {selectedArchitect?.name || 'Chief Architect'}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)', cursor: 'pointer' }}>
                <input type="checkbox" checked={ttsEnabled} onChange={e => setTtsEnabled(e.target.checked)} style={{ width: 12, height: 12 }} />
                Voice reply
              </label>
              <select value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value as any)} style={{ fontSize: 11, padding: '2px 6px', background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)' }}>
                <option value="">Auto detect</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 6, display: 'flex', gap: 16 }}>
            <span>Domain architects use ⚡ Haiku (low cost)</span>
            <span>Chief Architect uses 🧠 Sonnet (synthesis only)</span>
            <span>Context cached 5 min</span>
            {voiceMode && <span>🎤 Whisper STT + TTS-1 (low cost)</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
