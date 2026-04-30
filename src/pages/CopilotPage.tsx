import { useState, useRef, useEffect } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'
interface Msg{role:'user'|'assistant';content:string}
export default function CopilotPage() {
  const { t, locale, setLocale } = useLang()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const sessionId = useRef(`session-${Date.now()}`)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:'smooth'})},[messages])
  const send=async()=>{
    if(!input.trim()||loading)return
    const msg=input.trim();setInput('');setLoading(true)
    setMessages(m=>[...m,{role:'user',content:msg}])
    try{const r=await api.chatSync(msg,sessionId.current,locale);setMessages(m=>[...m,{role:'assistant',content:r.response}])}
    catch(e:any){setMessages(m=>[...m,{role:'assistant',content:`Error: ${e.message}`}])}
    finally{setLoading(false)}
  }
  return (
    <div className="copilot-wrap">
      <div className="copilot-header">
        <span style={{fontSize:20}}>🤖</span>
        <div style={{flex:1}}><div style={{fontFamily:'var(--font-display)',fontWeight:600,fontSize:15}}>{t('copilot.title')}</div><div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'var(--font-mono)'}}>{t('copilot.subtitle')}</div></div>
        <button onClick={()=>setLocale(locale==='EN'?'AR':'EN')} className="btn btn-secondary btn-sm">🌐 {locale==='EN'?'العربية':'English'}</button>
      </div>
      <div className="copilot-messages">
        {messages.length===0&&(
          <div className="empty" style={{marginTop:60}}>
            <div style={{fontSize:48}}>🤖</div>
            <div className="empty-title">{t('copilot.ready')}</div>
            <div className="empty-sub">{t('copilot.hint')}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,justifyContent:'center',marginTop:20}}>
              {['copilot.q1','copilot.q2','copilot.q3','copilot.q4'].map(k=>(
                <button key={k} onClick={()=>setInput(t(k))} style={{padding:'6px 12px',background:'var(--navy-light)',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:12,color:'var(--text-dim)',cursor:'pointer'}}>{t(k)}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} className={`msg ${m.role}`}>
            <div className="msg-avatar">{m.role==='user'?'U':'AI'}</div>
            <div className="msg-bubble" dir={locale==='AR'?'rtl':'ltr'}>{m.content}</div>
          </div>
        ))}
        {loading&&<div className="msg assistant"><div className="msg-avatar">AI</div><div className="msg-bubble"><div className="typing"><span/><span/><span/></div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="copilot-input-wrap">
        <div className="copilot-input-row">
          <textarea className="copilot-input" value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={t('copilot.placeholder')} rows={1} dir={locale==='AR'?'rtl':'ltr'}/>
          <button className="btn btn-primary" onClick={send} disabled={loading||!input.trim()}>{t('copilot.send')}</button>
        </div>
      </div>
    </div>
  )
}
