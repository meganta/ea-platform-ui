import { useState, useRef, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'

const API = process.env.REACT_APP_API_URL || 'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'

function useApi() {
  const { token } = useAuth() as any
  return useMemo(() => {
    const h = () => ({ Authorization: `Bearer ${token || localStorage.getItem('ea_token') || ''}`, 'Content-Type': 'application/json' })
    const get = (p: string) => fetch(`${API}${p}`, { headers: h() }).then(r => r.json())
    const post = (p: string, b?: any) => fetch(`${API}${p}`, { method: 'POST', headers: h(), body: b ? JSON.stringify(b) : undefined }).then(r => r.json())
    const del = (p: string) => fetch(`${API}${p}`, { method: 'DELETE', headers: h() })
    return { get, post, del, token: token || localStorage.getItem('ea_token') || '' }
  }, [token])
}

interface EvidenceItem {
  sourceType: 'EA_ASSET' | 'GOVERNANCE_REVIEW'
  sourceId: string
  title: string
  excerpt: string
  assetType?: string
  domain?: string | null
  version: string | null
  status: string
  validityClassification: 'CURRENT' | 'FUTURE' | 'EXPIRED' | 'SUPERSEDED' | 'UNKNOWN'
  sourceAuthorityLevel: 'AUTHORITATIVE' | 'ADVISORY' | 'HISTORICAL' | 'UNVALIDATED'
  effectiveFrom: string | null
  effectiveUntil: string | null
  retrievalReason: string
  score: number
  targetRef: { type: string; id: string }
}
interface Msg { id: string; role: 'user' | 'architect' | 'system'; content: string; architectCode?: string; architectName?: string; architectAvatar?: string; timestamp: Date; evidence?: EvidenceItem[]; remainingSpeech?: string | null; failed?: boolean }
interface Architect { id: string; code: string; name: string; role: string; domain?: string; avatar: string; description?: string; isChief: boolean; aiModel: string; isActive: boolean }

// Phase 1: authority-level color coding, matching the same caveat
// language ArchitectEngineService's evidence-validity.ts reuse already
// produces server-side (an item with no bracketed caveat is
// AUTHORITATIVE) — colors are purely a visual echo of that same
// classification, not a separate judgment made in the frontend.
const AUTHORITY_STYLE: Record<EvidenceItem['sourceAuthorityLevel'], { bg: string; fg: string; label: string }> = {
  AUTHORITATIVE: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e', label: 'Authoritative' },
  ADVISORY: { bg: 'rgba(234,179,8,0.15)', fg: '#eab308', label: 'Advisory / Draft' },
  HISTORICAL: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8', label: 'Historical' },
  UNVALIDATED: { bg: 'rgba(249,115,22,0.15)', fg: '#f97316', label: 'Validity Unknown' },
}

function openEvidenceSource(item: EvidenceItem) {
  // Real deep link for EA_ASSET (RepositoryPage reads ?assetId= and opens
  // the actual asset detail modal - see that page's own change). No
  // equivalent query-param handling exists yet on GovernancePage, so a
  // GOVERNANCE_REVIEW item opens the review list rather than a fake/
  // non-functional deep link to the specific review - a real follow-up,
  // not silently pretended to already work.
  if (item.sourceType === 'EA_ASSET') window.open(`/repository?assetId=${item.sourceId}`, '_blank')
  else window.open('/governance', '_blank')
}

// Escapes regex special characters in an evidence title before building a
// match pattern from it - titles are tenant-controlled free text (an
// asset name), not something safe to interpolate into a RegExp as-is.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Phase 1 follow-up: connects an architect's response TEXT to the
 * evidence that grounded it, rather than leaving the drawer as the only
 * link between the two. Purely a frontend text-match against each
 * evidence item's title (no model behavior change, no new backend data) -
 * genuinely simpler than asking the model to emit citation markers, and
 * still gives a real, clickable connection: any place in the response
 * where an evidence item's title appears verbatim becomes a dotted-
 * underline link back to that source. Titles under 3 characters are
 * skipped (too likely to match unrelated substrings); longer titles are
 * matched before shorter ones so a more specific title isn't shadowed by
 * a shorter one that happens to be a substring of it.
 */
function renderContentWithCitations(content: string, evidence?: EvidenceItem[]): ReactNode {
  if (!evidence || evidence.length === 0) return content
  const candidates = [...evidence]
    .filter(e => e.title && e.title.trim().length >= 3)
    .sort((a, b) => b.title.length - a.title.length)
  if (candidates.length === 0) return content

  const pattern = new RegExp(`(${candidates.map(e => escapeRegExp(e.title)).join('|')})`, 'gi')
  const parts = content.split(pattern)
  if (parts.length <= 1) return content // no match found at all

  return parts.map((part, i) => {
    const matched = candidates.find(e => e.title.toLowerCase() === part.toLowerCase())
    if (!matched) return part
    return (
      <span
        key={i}
        onClick={() => openEvidenceSource(matched)}
        title={`Source: ${matched.title}`}
        style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: 2, cursor: 'pointer', color: 'inherit', fontWeight: 500 }}
      >
        {part}
      </span>
    )
  })
}

/** Expandable "N sources" panel shown under an architect message that has evidence — the Phase 1 evidence-grounded Copilot's one visible surface so far (inline citation markers in the response text itself are a further follow-up). */
function EvidenceDrawer({ evidence }: { evidence?: EvidenceItem[] }) {
  const [open, setOpen] = useState(false)
  if (!evidence || evidence.length === 0) return null
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setOpen(o => !o)} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
        🔍 {evidence.length} source{evidence.length === 1 ? '' : 's'} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 }}>
          {evidence.map((item, i) => {
            const style = AUTHORITY_STYLE[item.sourceAuthorityLevel] || AUTHORITY_STYLE.UNVALIDATED
            return (
              <div key={item.sourceId + i} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--navy-light)', border: '1px solid var(--border)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                  <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 999, background: style.bg, color: style.fg }}>{style.label}</span>
                </div>
                <div style={{ color: 'var(--text-dim)', marginTop: 3, fontSize: 11.5, lineHeight: 1.5 }}>{item.excerpt}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', opacity: 0.7 }}>{item.sourceType === 'EA_ASSET' ? (item.assetType || 'Asset') : 'Governance Review'}</span>
                  <button onClick={() => openEvidenceSource(item)} style={{ fontSize: 10.5, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>View source →</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const MODEL_LABEL: Record<string, string> = { haiku: '⚡ Fast', sonnet: '🧠 Smart' }
const DOMAIN_COLOR: Record<string, string> = { CHIEF: '#f39c12', BUSINESS: '#3498db', BENEFICIARY: '#2980b9', APPLICATION: '#e67e22', INTEGRATION: '#16a085', DATA: '#1abc9c', TECHNOLOGY: '#e74c3c', SECURITY: '#9b59b6' }

// ── Meeting Assistant ─────────────────────────────────────────────────────────
function MeetingAssistant({ api, architects }: { api: any, architects: any[] }) {
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [view, setView] = useState<'list'|'create'|'detail'>('list')
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '', architectCodes: ['CHIEF','BUSINESS','APPLICATION','DATA'] })
  const [transcriptText, setTranscriptText] = useState('')
  const [transcriptLang, setTranscriptLang] = useState('en')
  const [analyzing, setAnalyzing] = useState(false)
  const [uploadMode, setUploadMode] = useState<'text'|'audio'>('text')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<any>(null)

  const DOMAIN_COLOR: Record<string,string> = { CHIEF:'#f39c12', BUSINESS:'#3498db', BENEFICIARY:'#2980b9', APPLICATION:'#e67e22', INTEGRATION:'#16a085', DATA:'#1abc9c', TECHNOLOGY:'#e74c3c', SECURITY:'#9b59b6' }
  const STATUS_COLOR: Record<string,string> = { COMPLETED:'#2ecc71', PROCESSING:'#f39c12', SCHEDULED:'#3498db', ACTIVE:'#e67e22', CANCELLED:'#7f8c8d' }

  const load = useCallback(() => {
    setLoading(true)
    api.get('/copilot/meetings').then((d: any) => { setMeetings(Array.isArray(d)?d:[]); setLoading(false) })
  }, [api])

  useEffect(() => { load() }, [load])

  const createMeeting = async () => {
    if (!form.title) return
    const m = await api.post('/copilot/meetings', form)
    if (m?.id) { setSelected(m); setView('detail'); load() }
  }

  const ingestText = async () => {
    if (!transcriptText.trim() || !selected) return
    await api.post(`/copilot/meetings/${selected.id}/transcript/text`, { content: transcriptText, language: transcriptLang })
    const updated = await api.get(`/copilot/meetings/${selected.id}`)
    setSelected(updated)
    setTranscriptText('')
  }

  const ingestAudio = async (file: File) => {
    if (!selected) return
    const fd = new FormData()
    fd.append('audio', file)
    fd.append('language', transcriptLang)
    setAnalyzing(true)
    const token = localStorage.getItem('ea_token') || ''
    const res = await fetch(`${process.env.REACT_APP_API_URL||'https://ea-platform-api-693660680541.me-central1.run.app/api/v1'}/copilot/meetings/${selected.id}/transcript/audio`, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd })
    const data = await res.json()
    if (data?.content) {
      const updated = await api.get(`/copilot/meetings/${selected.id}`)
      setSelected(updated)
    }
    setAnalyzing(false)
  }

  const startAnalysis = async () => {
    if (!selected) return
    setAnalyzing(true)
    await api.post(`/copilot/meetings/${selected.id}/analyze`)
    // Poll for completion
    pollRef.current = setInterval(async () => {
      const updated = await api.get(`/copilot/meetings/${selected.id}`)
      setSelected(updated)
      if (updated.status !== 'PROCESSING') {
        clearInterval(pollRef.current)
        setAnalyzing(false)
      }
    }, 3000)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const toggleArchitect = (code: string) => {
    setForm(f => ({ ...f, architectCodes: f.architectCodes.includes(code) ? f.architectCodes.filter(c=>c!==code) : [...f.architectCodes, code] }))
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  const renderDetail = () => {
    if (!selected) return null
    const hasTranscript = selected.transcripts?.length > 0
    const hasAnalyses = selected.analyses?.length > 0
    const transcript = selected.transcripts?.[selected.transcripts.length-1]

    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button style={{ padding:'6px 12px', borderRadius:8, background:'var(--navy-mid)', border:'none', color:'var(--text)', cursor:'pointer', fontSize:13 }} onClick={()=>{ setView('list'); setSelected(null) }}>← Back</button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:18, fontWeight:700 }}>{selected.title}</div>
            <div style={{ display:'flex', gap:8, marginTop:3 }}>
              <span style={{ padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:600, background:(STATUS_COLOR[selected.status]||'#7f8c8d')+'22', color:STATUS_COLOR[selected.status]||'#7f8c8d' }}>{selected.status}</span>
              {selected.scheduledAt && <span style={{ fontSize:11, color:'var(--text-dim)' }}>{new Date(selected.scheduledAt).toLocaleDateString()}</span>}
            </div>
          </div>
          {hasTranscript && !hasAnalyses && (
            <button onClick={startAnalysis} disabled={analyzing} style={{ padding:'8px 16px', borderRadius:8, background:'var(--accent)', color:'var(--navy)', border:'none', cursor:analyzing?'default':'pointer', fontSize:13, fontWeight:600 }}>
              {analyzing ? '⏳ Analyzing...' : '▶ Analyze with Architects'}
            </button>
          )}
          {hasAnalyses && (
            <button onClick={startAnalysis} disabled={analyzing} style={{ padding:'8px 16px', borderRadius:8, background:'var(--navy-mid)', border:'none', color:'var(--text)', cursor:analyzing?'default':'pointer', fontSize:13 }}>
              {analyzing ? '⏳ Re-analyzing...' : '↻ Re-analyze'}
            </button>
          )}
        </div>

        {/* Transcript section */}
        <div style={{ background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, padding:20, marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:12 }}>📝 Transcript</div>
          {hasTranscript ? (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:10, fontSize:12, color:'var(--text-dim)' }}>
                <span>📄 {transcript.wordCount?.toLocaleString()} words</span>
                <span>🌐 {transcript.language}</span>
                <span>📅 {new Date(transcript.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ background:'var(--navy)', borderRadius:8, padding:12, maxHeight:200, overflowY:'auto', fontSize:12, lineHeight:1.7, color:'var(--text-dim)', fontFamily:'monospace' }}>
                {transcript.content.slice(0, 1000)}{transcript.content.length > 1000 ? '...' : ''}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <button onClick={()=>setUploadMode('text')} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`2px solid ${uploadMode==='text'?'var(--accent)':'var(--border)'}`, background:uploadMode==='text'?'rgba(3,105,161,0.08)':'transparent', color:'var(--text)', cursor:'pointer', fontSize:13 }}>📝 Paste Text</button>
                <button onClick={()=>setUploadMode('audio')} style={{ flex:1, padding:'8px 0', borderRadius:8, border:`2px solid ${uploadMode==='audio'?'var(--accent)':'var(--border)'}`, background:uploadMode==='audio'?'rgba(3,105,161,0.08)':'transparent', color:'var(--text)', cursor:'pointer', fontSize:13 }}>🎵 Upload Audio</button>
              </div>
              <div style={{ marginBottom:10, display:'flex', gap:8, alignItems:'center' }}>
                <label style={{ fontSize:12, color:'var(--text-dim)' }}>Language:</label>
                <select value={transcriptLang} onChange={e=>setTranscriptLang(e.target.value)} style={{ padding:'4px 8px', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text)', fontSize:12 }}>
                  <option value="en">English</option>
                  <option value="ar">Arabic</option>
                </select>
              </div>
              {uploadMode === 'text' ? (
                <div>
                  <textarea value={transcriptText} onChange={e=>setTranscriptText(e.target.value)}
                    style={{ width:'100%', minHeight:140, padding:'10px 12px', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:12, resize:'vertical', fontFamily:'monospace', lineHeight:1.6 }}
                    placeholder="Paste meeting transcript here...&#10;&#10;You can include speaker names like:&#10;John: Let's discuss the API architecture...&#10;Sarah: I have concerns about the data model..." />
                  <button onClick={ingestText} disabled={!transcriptText.trim()} style={{ marginTop:8, padding:'8px 16px', borderRadius:8, background:transcriptText.trim()?'var(--accent)':'var(--navy-mid)', color:transcriptText.trim()?'var(--navy)':'var(--text-dim)', border:'none', cursor:transcriptText.trim()?'pointer':'default', fontSize:13, fontWeight:600 }}>
                    Upload Transcript
                  </button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept="audio/*" style={{ display:'none' }} onChange={e=>{ if(e.target.files?.[0]) ingestAudio(e.target.files[0]) }} />
                  <div onClick={()=>fileInputRef.current?.click()} style={{ border:'2px dashed var(--border)', borderRadius:8, padding:'30px 20px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--accent)')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                    <div style={{ fontSize:30, marginBottom:8 }}>{analyzing?'⏳':'🎵'}</div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{analyzing?'Transcribing with Whisper...':'Click to upload audio recording'}</div>
                    <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4 }}>MP3, WAV, MP4, WebM — Whisper AI transcribes automatically</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analyses section */}
        {hasAnalyses && (
          <div>
            <div style={{ fontSize:15, fontWeight:600, marginBottom:12 }}>🏛 Architect Analyses</div>
            <div style={{ display:'flex', flexDirection:'column' as const, gap:12 }}>
              {selected.analyses.map((analysis: any) => {
                const code = analysis.architectCode
                const color = DOMAIN_COLOR[code] || '#7f8c8d'
                const findings = Array.isArray(analysis.findings) ? analysis.findings : []
                const risks = Array.isArray(analysis.risks) ? analysis.risks : []
                const actions = Array.isArray(analysis.actions) ? analysis.actions : []
                return (
                  <details key={analysis.id} style={{ background:'var(--navy-light)', border:`1px solid ${color}33`, borderRadius:10, overflow:'hidden' }}>
                    <summary style={{ padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:10, listStyle:'none' }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background:color+'33', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                        {architects.find(a=>a.code===code)?.avatar || '🏛'}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, color }}>{analysis.architectName}</div>
                        <div style={{ fontSize:11, color:'var(--text-dim)' }}>{findings.length} findings · {risks.length} risks · {actions.length} actions</div>
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-dim)' }}>{new Date(analysis.createdAt).toLocaleTimeString()}</div>
                    </summary>
                    <div style={{ padding:'0 16px 16px', borderTop:`1px solid ${color}22` }}>
                      {/* Quick stats */}
                      <div style={{ display:'flex', gap:10, margin:'12px 0', flexWrap:'wrap' as const }}>
                        {[{l:'Findings',v:findings.length,c:'#e74c3c'},{l:'Risks',v:risks.length,c:'#f39c12'},{l:'Actions',v:actions.length,c:'#3498db'}].map(s=>(
                          <div key={s.l} style={{ padding:'6px 12px', borderRadius:8, background:s.c+'11', border:`1px solid ${s.c}33`, fontSize:11, fontWeight:600, color:s.c }}>
                            {s.v} {s.l}
                          </div>
                        ))}
                      </div>
                      {/* Full report */}
                      <div style={{ background:'var(--navy)', borderRadius:8, padding:14, fontSize:12, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap', maxHeight:400, overflowY:'auto' }}>
                        {analysis.report}
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
          </div>
        )}

        {!hasTranscript && !hasAnalyses && (
          <div style={{ background:'rgba(3,105,161,0.05)', border:'1px solid var(--border)', borderRadius:10, padding:24, textAlign:'center', color:'var(--text-dim)', fontSize:13 }}>
            Upload a transcript above, then click "Analyze with Architects"
          </div>
        )}
      </div>
    )
  }

  // ── Create form ───────────────────────────────────────────────────────────
  const renderCreate = () => (
    <div style={{ maxWidth:560 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button style={{ padding:'6px 12px', borderRadius:8, background:'var(--navy-mid)', border:'none', color:'var(--text)', cursor:'pointer', fontSize:13 }} onClick={()=>setView('list')}>← Back</button>
        <div style={{ fontSize:18, fontWeight:700 }}>New Meeting</div>
      </div>
      <div style={{ background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, padding:20, display:'flex', flexDirection:'column' as const, gap:14 }}>
        <div><label style={{ fontSize:11, color:'var(--text-dim)', fontWeight:600, display:'block', marginBottom:4 }}>Meeting Title *</label><input style={{ width:'100%', padding:'8px 12px', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13 }} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Solution Design Review — HR System" /></div>
        <div><label style={{ fontSize:11, color:'var(--text-dim)', fontWeight:600, display:'block', marginBottom:4 }}>Description</label><input style={{ width:'100%', padding:'8px 12px', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13 }} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} /></div>
        <div><label style={{ fontSize:11, color:'var(--text-dim)', fontWeight:600, display:'block', marginBottom:4 }}>Meeting Date</label><input type="datetime-local" style={{ width:'100%', padding:'8px 12px', background:'var(--navy)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontSize:13 }} value={form.scheduledAt} onChange={e=>setForm(f=>({...f,scheduledAt:e.target.value}))} /></div>
        <div>
          <label style={{ fontSize:11, color:'var(--text-dim)', fontWeight:600, display:'block', marginBottom:8 }}>Architects to Analyze ({form.architectCodes.length} selected)</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' as const }}>
            {architects.map(a => {
              const sel = form.architectCodes.includes(a.code)
              const color = DOMAIN_COLOR[a.code]||'#7f8c8d'
              return <span key={a.code} onClick={()=>toggleArchitect(a.code)} style={{ padding:'6px 12px', borderRadius:20, fontSize:12, fontWeight:600, background:sel?color+'22':'transparent', border:`1px solid ${sel?color:' var(--border)'}`, color:sel?color:'var(--text-dim)', cursor:'pointer' }}>{a.avatar} {a.name}</span>
            })}
          </div>
        </div>
        <button onClick={createMeeting} disabled={!form.title} style={{ padding:'10px 0', borderRadius:8, background:form.title?'var(--accent)':'var(--navy-mid)', color:form.title?'var(--navy)':'var(--text-dim)', border:'none', cursor:form.title?'pointer':'default', fontSize:13, fontWeight:600 }}>
          Create Meeting
        </button>
      </div>
    </div>
  )

  // ── List view ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'24px 28px' }}>
      {view === 'list' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:700 }}>📋 Meeting Assistant</div>
              <div style={{ fontSize:13, color:'var(--text-dim)' }}>Upload meeting transcripts and get domain-specific architect analyses</div>
            </div>
            <button onClick={()=>setView('create')} style={{ padding:'8px 16px', borderRadius:8, background:'var(--accent)', color:'var(--navy)', border:'none', cursor:'pointer', fontSize:13, fontWeight:600 }}>+ New Meeting</button>
          </div>

          {loading ? <div style={{ color:'var(--text-dim)', textAlign:'center', padding:40 }}>Loading...</div> : meetings.length === 0 ? (
            <div style={{ background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, padding:60, textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
              <div style={{ fontSize:15, fontWeight:600, marginBottom:8 }}>No meetings yet</div>
              <div style={{ fontSize:13, color:'var(--text-dim)', marginBottom:16 }}>Create a meeting, upload its transcript, and get analysis from multiple EA architects</div>
              <button onClick={()=>setView('create')} style={{ padding:'8px 20px', borderRadius:8, background:'var(--accent)', color:'var(--navy)', border:'none', cursor:'pointer', fontSize:13, fontWeight:600 }}>Create First Meeting</button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
              {meetings.map(m => (
                <div key={m.id} onClick={async()=>{ const d=await api.get(`/copilot/meetings/${m.id}`); setSelected(d); setView('detail') }}
                  style={{ background:'var(--navy-light)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor='var(--accent)')}
                  onMouseLeave={e=>(e.currentTarget.style.borderColor='var(--border)')}>
                  <div style={{ width:40, height:40, borderRadius:10, background:'rgba(3,105,161,0.12)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>📋</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:600 }}>{m.title}</div>
                    <div style={{ fontSize:12, color:'var(--text-dim)', display:'flex', gap:8, marginTop:2 }}>
                      <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                      <span>{m._count?.transcripts||0} transcript</span>
                      <span>{m._count?.analyses||0} analyses</span>
                    </div>
                  </div>
                  <span style={{ padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:600, background:(STATUS_COLOR[m.status]||'#7f8c8d')+'22', color:STATUS_COLOR[m.status]||'#7f8c8d' }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {view === 'create' && renderCreate()}
      {view === 'detail' && renderDetail()}
    </div>
  )
}

/** Phase 2: Task-mode UI — playbook picker, input form, a read-only preview step (spec requires reviewing the auto-selected architects/sources before execution), and structured run results. Mirrors MeetingAssistant's pattern (a self-contained sidebar-tab view, not folded into the Single/Consult chat toggle, since a playbook run is form-driven rather than a chat turn). */
function PlaybookRunner({ api }: { api: any }) {
  const [playbooks, setPlaybooks] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<any | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [result, setResult] = useState<any | null>(null)
  const [running, setRunning] = useState(false)
  const [architectOverride, setArchitectOverride] = useState<string[] | null>(null)

  useEffect(() => { api.get('/copilot/playbooks').then((d: any) => setPlaybooks(Array.isArray(d) ? d : [])) }, [api])

  const selected = playbooks.find(p => p.id === selectedId)
  const allFields = selected ? [...selected.requiredInputs, ...selected.optionalInputs] : []

  function selectPlaybook(p: any) {
    setSelectedId(p.id); setInputs({}); setPreview(null); setResult(null); setArchitectOverride(null)
  }

  async function runPreview() {
    if (!selected) return
    setPreviewLoading(true)
    try {
      const p = await api.post(`/copilot/playbooks/${selected.id}/preview`, { inputs })
      setPreview(p)
      setArchitectOverride(p.resolvedArchitects?.map((a: any) => a.code) ?? null)
    } finally {
      setPreviewLoading(false)
    }
  }

  async function runPlaybook() {
    if (!selected) return
    setRunning(true)
    try {
      const r = await api.post(`/copilot/playbooks/${selected.id}/run`, { inputs, architectOverride })
      setResult(r)
    } finally {
      setRunning(false)
    }
  }

  function toggleOverride(code: string) {
    setArchitectOverride(prev => {
      const cur = prev ?? []
      return cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code]
    })
  }

  return (
    <div style={{ padding: 20, maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 16 }}>🧭 Task Playbooks</div>

      {!selected ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {playbooks.map(p => (
            <div key={p.id} onClick={() => selectPlaybook(p)} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', background: 'var(--navy-light)' }}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-dim)', marginTop: 2 }}>{p.description}</div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <button onClick={() => setSelectedId(null)} style={{ alignSelf: 'flex-start', fontSize: 11, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: 0 }}>← Back to playbooks</button>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{selected.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{selected.description}</div>

          {allFields.map(key => (
            <div key={key}>
              <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                {key}{selected.requiredInputs.includes(key) ? ' *' : ' (optional)'}
              </label>
              <textarea
                value={inputs[key] || ''}
                onChange={e => { setInputs(prev => ({ ...prev, [key]: e.target.value })); setPreview(null); setResult(null) }}
                rows={key === 'subject' ? 3 : 1}
                style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, resize: 'vertical' }}
              />
            </div>
          ))}

          <button onClick={runPreview} disabled={previewLoading} style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: previewLoading ? 'default' : 'pointer' }}>
            {previewLoading ? 'Loading preview...' : 'Preview'}
          </button>

          {preview && (
            <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {preview.missingInputs.length > 0 && (
                <div style={{ fontSize: 12, color: '#f97316' }}>Missing required input(s): {preview.missingInputs.join(', ')}</div>
              )}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 5 }}>Architects that will run — click to include/exclude:</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {preview.resolvedArchitects.map((a: any) => {
                    const on = (architectOverride ?? []).includes(a.code)
                    return (
                      <span key={a.code} onClick={() => toggleOverride(a.code)} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer', background: on ? 'var(--accent)' : 'var(--navy-light)', color: on ? 'var(--navy)' : 'var(--text-dim)', border: '1px solid var(--border)' }}>
                        {a.avatar} {a.name}
                      </span>
                    )
                  })}
                </div>
                {preview.missingArchitects.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>Not available for this tenant: {preview.missingArchitects.join(', ')}</div>
                )}
                {preview.willRunChiefSynthesis && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>🏛 Chief Architect will synthesize these responses</div>}
              </div>
              {preview.evidencePreview && preview.evidencePreview.items.length > 0 && (
                <EvidenceDrawer evidence={preview.evidencePreview.items} />
              )}
              <button onClick={runPlaybook} disabled={running || preview.missingInputs.length > 0} style={{ padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: (running || preview.missingInputs.length > 0) ? 'default' : 'pointer', opacity: (running || preview.missingInputs.length > 0) ? 0.6 : 1 }}>
                {running ? 'Running...' : 'Run Playbook'}
              </button>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {result.domainResponses.map((r: any) => (
                <div key={r.architectCode} style={{ padding: 12, borderRadius: 8, border: r.failed ? '1px solid #f97316' : '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {r.architectName}
                    {r.failed && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                        ⚠️ did not complete
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{renderContentWithCitations(r.content, r.evidence)}</div>
                  <EvidenceDrawer evidence={r.evidence} />
                </div>
              ))}
              {result.chiefResponse && (
                <div style={{ padding: 12, borderRadius: 8, border: result.chiefResponse.failed ? '1px solid #f97316' : '1px solid var(--accent)' }}>
                  <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    🏛 {result.chiefResponse.architectName} — Synthesis
                    {result.chiefResponse.failed && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                        ⚠️ did not complete
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{renderContentWithCitations(result.chiefResponse.content, result.chiefResponse.evidence)}</div>
                </div>
              )}
              {result.targetModule && (
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
                  Suggested next step: take this to {result.targetModule.replace(/_/g, ' ').toLowerCase()} for a formal assessment. This is a preparatory analysis only — nothing has been submitted or decided automatically.
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const ACTION_DRAFT_STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  DRAFT: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  PENDING_APPROVAL: { bg: 'rgba(234,179,8,0.15)', fg: '#eab308' },
  APPROVED: { bg: 'rgba(59,130,246,0.15)', fg: '#3b82f6' },
  REJECTED: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
  EXPIRED: { bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  EXECUTED: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
}

/** Phase 3: review/approval UI for Copilot Action Drafts — the human side of the create(DRAFT)->submit(PENDING_APPROVAL)->approve(APPROVED)->execute(EXECUTED) lifecycle the backend already enforces. No draft can move forward without an explicit click here; this component never auto-advances anything. */
function ActionDraftReview({ api }: { api: any }) {
  const [drafts, setDrafts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = () => {
    setLoading(true)
    api.get('/copilot/action-drafts').then((d: any) => setDrafts(Array.isArray(d) ? d : [])).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function act(id: string, action: string, body?: any) {
    setBusyId(id)
    try {
      await api.post(`/copilot/action-drafts/${id}/${action}`, body)
      load()
    } finally {
      setBusyId(null)
    }
  }

  function confirmReject(id: string) {
    act(id, 'reject', { reason: rejectReason || undefined })
    setRejectingId(null)
    setRejectReason('')
  }

  return (
    <div style={{ padding: 20, maxWidth: 720 }}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>📝 Action Drafts</div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading...</div>
      ) : drafts.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>No action drafts yet. An architect can propose one while helping with a task.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {drafts.map(d => {
            const style = ACTION_DRAFT_STATUS_STYLE[d.status] || ACTION_DRAFT_STATUS_STYLE.DRAFT
            const busy = busyId === d.id
            return (
              <div key={d.id} style={{ padding: 14, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--navy-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{d.targetModule} · {d.targetEntityType} · {d.proposedActionType}</div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: style.bg, color: style.fg, whiteSpace: 'nowrap' }}>{d.status.replace(/_/g, ' ')}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  Proposed by {d.proposingArchitectCode}{d.confidence != null && ` · confidence ${Math.round(d.confidence * 100)}%`}
                </div>
                <pre style={{ fontSize: 11.5, background: 'var(--navy)', padding: 8, borderRadius: 6, marginTop: 8, overflow: 'auto', maxHeight: 160 }}>{JSON.stringify(d.payload, null, 2)}</pre>
                {d.assumptions?.length > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6 }}>Assumptions: {d.assumptions.join('; ')}</div>}
                {d.missingInformation?.length > 0 && <div style={{ fontSize: 11, color: '#eab308', marginTop: 4 }}>Missing information: {d.missingInformation.join('; ')}</div>}

                <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {d.status === 'DRAFT' && (
                    <button onClick={() => act(d.id, 'submit')} disabled={busy} style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: busy ? 'default' : 'pointer' }}>
                      Submit for Approval
                    </button>
                  )}
                  {d.status === 'PENDING_APPROVAL' && (
                    <>
                      <button onClick={() => act(d.id, 'approve')} disabled={busy} style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, background: 'var(--accent)', color: 'var(--navy)', border: 'none', cursor: busy ? 'default' : 'pointer' }}>
                        Approve
                      </button>
                      <button onClick={() => setRejectingId(d.id)} disabled={busy} style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 600, fontSize: 12, background: 'none', border: '1px solid #ef4444', color: '#ef4444', cursor: busy ? 'default' : 'pointer' }}>
                        Reject
                      </button>
                    </>
                  )}
                  {d.status === 'APPROVED' && (
                    <button onClick={() => act(d.id, 'execute')} disabled={busy} style={{ padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 12, background: '#3b82f6', color: 'white', border: 'none', cursor: busy ? 'default' : 'pointer' }}>
                      {busy ? 'Executing...' : 'Execute'}
                    </button>
                  )}
                  {d.status === 'EXECUTED' && (
                    <div style={{ fontSize: 12, color: '#22c55e' }}>✅ Executed{d.executionResult?.entityId ? ` — created ${d.executionResult.entityId}` : ''}</div>
                  )}
                  {d.status === 'REJECTED' && (
                    <div style={{ fontSize: 12, color: '#ef4444' }}>❌ Rejected{d.rejectionReason ? `: ${d.rejectionReason}` : ''}</div>
                  )}
                </div>

                {rejectingId === d.id && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason (optional)" style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12 }} />
                    <button onClick={() => confirmReject(d.id)} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}>Confirm Reject</button>
                    <button onClick={() => { setRejectingId(null); setRejectReason('') }} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 12, background: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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
  const [sidebarTab, setSidebarTab] = useState<'architects' | 'history' | 'meetings' | 'playbooks' | 'actiondrafts'>('architects')
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // Phase 6: the spoken audio may be a sentence-boundary-aware
        // excerpt of a long answer (never mid-word) — remainingText is
        // whatever wasn't spoken, so "Speak more" can pick up exactly
        // where the audio left off.
        remainingSpeech: data.remainingText ?? null,
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

  // Phase 6: continues speaking a message's held-back remainder (see
  // voice.service.ts's sentence-boundary splitting) by calling the same
  // synthesize endpoint again with just that text. Chains correctly if
  // the remainder is itself still too long to speak in one go - each
  // response's own remainingText replaces the message's, so repeated
  // clicks work through the whole answer in order.
  const speakMore = async (msg: Msg) => {
    if (!msg.remainingSpeech) return
    try {
      const res = await api.post('/copilot/voice/synthesize', { text: msg.remainingSpeech, architectCode: msg.architectCode || 'CHIEF' })
      if (res.audioBase64 && audioPlayerRef.current) {
        audioPlayerRef.current.src = `data:audio/mpeg;base64,${res.audioBase64}`
        audioPlayerRef.current.play().catch(() => {})
      }
      setMessages(m => m.map(x => x.id === msg.id ? { ...x, remainingSpeech: res.remainingText ?? null } : x))
    } catch (e) {
      console.error('Speak more failed:', e)
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
        if (d.type === 'done') { setActiveConvId(d.conversationId); refreshConversations(); setMessages(m => m.map(msg2 => msg2.id === streamingId ? { ...msg2, evidence: d.evidence } : msg2)) }
      })
    } else {
      // Multi-architect consultation
      const codes = consultArchitects.length > 0 ? consultArchitects : architects.filter(a => !a.isChief).map(a => a.code).slice(0, 3)

      await streamSse('/copilot/consult', { message: msg, architectCodes: codes, includeChief, conversationId: activeConvId }, (d) => {
        if (d.type === 'meta') setActiveConvId(d.conversationId)
        if (d.type === 'architect_response') {
          const arch = architects.find(a => a.code === d.architectCode)
          setMessages(m => [...m, { id: Date.now() + d.architectCode, role: 'architect', content: d.content, architectCode: d.architectCode, architectName: d.architectName || arch?.name, architectAvatar: arch?.avatar || '🤖', timestamp: new Date(), evidence: d.evidence, failed: !!d.failed }])
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
    <div className="side-panel-parent" style={{ display: 'flex', height: '100%', background: 'var(--navy)', overflow: 'hidden' }}>

      {/* ── Left sidebar ─────────────────────────────────────────────────── */}
      <div className="side-panel-260" style={{ background: 'var(--navy-light)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>🤖 EA Copilot</div>
          <button onClick={newConversation} style={{ width: '100%', padding: '7px 0', borderRadius: 8, background: 'var(--accent)', color: 'var(--navy)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+ New Conversation</button>
        </div>

        {/* Sidebar tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
          {(['architects', 'history', 'meetings', 'playbooks', 'actiondrafts'] as const).map(t => (
            <button key={t} style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: sidebarTab === t ? 600 : 400, color: sidebarTab === t ? 'var(--accent)' : 'var(--text-dim)', background: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderBottom: `2px solid ${sidebarTab === t ? 'var(--accent)' : 'transparent'}`, cursor: 'pointer' }} onClick={() => setSidebarTab(t)}>
              {t === 'architects' ? '👥 Architects' : t === 'history' ? '🕐 History' : t === 'meetings' ? '📋 Meetings' : t === 'playbooks' ? '🧭 Playbooks' : '📝 Drafts'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          {sidebarTab === 'architects' ? (
            <>
              {/* Mode selector */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'var(--navy)', borderRadius: 8, padding: 3 }}>
                <button onClick={() => setMode('single')} style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: mode === 'single' ? 600 : 400, background: mode === 'single' ? 'var(--accent)' : 'none', color: mode === 'single' ? 'var(--navy)' : 'var(--text-dim)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Single</button>
                <button onClick={() => setMode('consult')} style={{ flex: 1, padding: '4px 0', fontSize: 11, fontWeight: mode === 'consult' ? 600 : 400, background: mode === 'consult' ? 'var(--accent)' : 'none', color: mode === 'consult' ? 'var(--navy)' : 'var(--text-dim)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Consult</button>
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
                <div key={c.id} onClick={() => loadConversation(c.id)} style={{ padding: '8px 10px', borderRadius: 8, marginBottom: 4, cursor: 'pointer', background: activeConvId === c.id ? 'rgba(3,105,161,0.1)' : 'none', border: `1px solid ${activeConvId === c.id ? 'var(--accent)44' : 'transparent'}` }}
                  onMouseEnter={e => { if (activeConvId !== c.id) e.currentTarget.style.background = 'rgba(15,23,42,0.04)' }}
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
      {sidebarTab === 'meetings' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <MeetingAssistant api={api} architects={architects} />
        </div>
      ) : sidebarTab === 'playbooks' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <PlaybookRunner api={api} />
        </div>
      ) : sidebarTab === 'actiondrafts' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ActionDraftReview api={api} />
        </div>
      ) : (
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
                  <div style={{ fontSize: 11, fontWeight: 600, color: archColor(m.architectCode), marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {m.architectName}
                    {m.failed && (
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                        ⚠️ did not complete
                      </span>
                    )}
                  </div>
                )}
                <div style={{ padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px', background: m.role === 'user' ? 'var(--accent)' : 'var(--navy-light)', color: m.role === 'user' ? 'var(--navy)' : 'var(--text)', fontSize: 13, lineHeight: 1.7, border: m.failed ? '1px solid #f97316' : (m.role !== 'user' ? `1px solid ${archColor(m.architectCode)}33` : 'none'), whiteSpace: 'pre-wrap' }}>
                  {m.content ? (m.role === 'architect' ? renderContentWithCitations(m.content, m.evidence) : m.content) : <span style={{ opacity: 0.5 }}><span className="typing-dot" style={{ animation: 'blink 1s infinite' }}>•</span><span style={{ animationDelay: '0.2s', animation: 'blink 1s infinite' }}> •</span><span style={{ animationDelay: '0.4s', animation: 'blink 1s infinite' }}> •</span></span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, textAlign: m.role === 'user' ? 'right' : 'left' }}>
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                {m.role === 'architect' && <EvidenceDrawer evidence={m.evidence} />}
                {m.role === 'architect' && m.remainingSpeech && (
                  <button onClick={() => speakMore(m)} style={{ marginTop: 6, fontSize: 11, color: 'var(--text-dim)', background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '3px 9px', cursor: 'pointer' }}>
                    🔊 Speak more
                  </button>
                )}
              </div>
            </div>
          ))}

          {loading && messages[messages.length-1]?.role !== 'architect' && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(3,105,161,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
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
              style={{ padding: '10px 20px', borderRadius: 10, background: loading || !input.trim() ? 'var(--navy-mid)' : 'var(--accent)', color: loading || !input.trim() ? 'var(--text-dim)' : 'var(--navy)', border: 'none', cursor: loading || !input.trim() ? 'default' : 'pointer', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
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
              style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', background: recording ? '#e74c3c' : voiceLoading ? 'var(--navy-mid)' : 'var(--accent)', color: recording ? '#fff' : 'var(--navy)', cursor: voiceLoading ? 'default' : 'pointer', fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: recording ? '0 0 0 8px #e74c3c33' : 'none', flexShrink: 0 }}>
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
      )}
    </div>
  )
}
