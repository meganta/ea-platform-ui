import { useState, useRef, useEffect } from 'react'
import { api } from '../lib/api'
interface Msg { role: 'user'|'assistant'; content: string }
export default function CopilotPage() {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [locale, setLocale] = useState<'EN'|'AR'>('EN')
  const sessionId = useRef(`session-${Date.now()}`)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:'smooth'}) },[messages])
  const send = async () => {
    if (!input.trim()||loading) return
    const msg = input.trim(); setInput(''); setLoading(true)
    setMessages(m=>[...m,{role:'user',content:msg}])
    try { const r = await api.chatSync(msg, sessionId.current, locale); setMessages(m=>[...m,{role:'assistant',content:r.response}]) }
    catch(e:any) { setMessages(m=>[...m,{role:'assistant',content:`Error: ${e.message}`}]) }
    finally { setLoading(false) }
  }
  return (
    <div className="copilot-wrap">
      <div className="copilot-header">
        <span style={{fontSize:20}}>🤖</span>
        <div style={{flex:1}}><div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15}}>EA Copilot</div><div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'var(--font-mono)'}}>AI-POWERED ARCHITECTURE ASSISTANT</div></div>
        <button onClick={()=>setLocale(l=>l==='EN'?'AR':'EN')} className="btn btn-secondary btn-sm">{locale}</button>
      </div>
      <div className="copilot-messages">
        {messages.length===0 && (
          <div className="empty" style={{marginTop:60}}>
            <div style={{fontSize:48}}>🤖</div>
            <div className="empty-title">EA Copilot Ready</div>
            <div className="empty-sub">Ask about ADM phases, capabilities, gap analysis, or architecture strategy</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:20}}>
              {['What is Enterprise Architecture?','Help me plan Phase A','Analyse capability gaps','Explain TOGAF ADM'].map(q=>(
                <button key={q} onClick={()=>setInput(q)} style={{padding:'6px 12px',background:'var(--navy-light)',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:12,color:'var(--text-dim)',cursor:'pointer'}}>{q}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-avatar">{m.role==='user'?'U':'AI'}</div>
            <div className="msg-bubble">{m.content}</div>
          </div>
        ))}
        {loading && <div className="msg assistant"><div className="msg-avatar">AI</div><div className="msg-bubble"><div className="typing"><span/><span/><span/></div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="copilot-input-wrap">
        <div className="copilot-input-row">
          <textarea className="copilot-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={locale==='AR'?'اسأل المساعد...':'Ask about your enterprise architecture...'} rows={1}/>
          <button className="btn btn-primary" onClick={send} disabled={loading||!input.trim()}>Send</button>
        </div>
      </div>
    </div>
  )
}
