import { useEffect, useState, useRef } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'
import HelpTip from '../components/HelpTip'

const API_URL = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

export default function KnowledgePage() {
  const { t } = useLang()
  const [docs, setDocs] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{type:'success'|'error', text:string}|null>(null)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [tab, setTab] = useState('documents')
  const [docType, setDocType] = useState('STRATEGY')
  const [showTypeSelect, setShowTypeSelect] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = () => api.getDocuments().then(setDocs).catch(()=>{})
  useEffect(()=>{ load() },[])

  const upload = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('type', docType)
    try {
      const token = localStorage.getItem('ea_token')
      if (!token) throw new Error('Not authenticated — please log in again')
      const res = await fetch(`${API_URL}/knowledge/documents/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: fd,
      })
      if (!res.ok) {
        const err = await res.json().catch(()=>({}))
        throw new Error(err.message || `Upload failed (${res.status})`)
      }
      const data = await res.json()
      setUploadMsg({ type: 'success', text: `✓ Uploaded — ${data.chunkCount || 1} chunk(s) indexed` })
      await load()
    } catch (err: any) {
      setUploadMsg({ type: 'error', text: `✗ ${err.message}` })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const deleteDoc = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    setDeleting(id)
    try {
      const token = localStorage.getItem('ea_token')
      await fetch(`${API_URL}/knowledge/documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      })
      await load()
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`)
    } finally {
      setDeleting(null)
    }
  }

  const search = async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try { const r = await api.searchKnowledge(query); setResults(r) }
    finally { setSearching(false) }
  }

  // Fix Arabic/Unicode filename display
  const displayName = (name: string) => {
    try { return decodeURIComponent(name) } catch { return name }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title" style={{ display: 'flex', alignItems: 'center' }}>{t('know.title')}<HelpTip text="Upload documents here (like policies, past reviews, or strategy papers) so the AI can reference them when answering questions or reviewing new proposals - instead of only relying on general knowledge." /></div><div className="page-subtitle">{t('know.subtitle')}</div></div>
          <div style={{position:'relative',display:'inline-block'}}>
            <button className="btn btn-primary" disabled={uploading} onClick={()=>setShowTypeSelect(s=>!s)}>
              ⬆ {uploading ? t('know.uploading') : t('know.upload')} ▾
            </button>
            {showTypeSelect && (
              <div style={{position:'absolute',top:'100%',right:0,marginTop:4,background:'var(--navy-light)',border:'1px solid var(--border)',borderRadius:'var(--radius)',zIndex:100,minWidth:220,boxShadow:'0 8px 24px rgba(0,0,0,0.3)'}}>
                {['STRATEGY','POLICY','REGULATION','REFERENCE_ARCHITECTURE','OPERATING_MODEL','CUSTOM'].map(type => (
                  <button key={type} onClick={()=>{setDocType(type);setShowTypeSelect(false);fileRef.current?.click()}}
                    style={{display:'block',width:'100%',padding:'9px 16px',background:'none',border:'none',color:docType===type?'var(--accent)':'var(--text)',fontSize:12,fontFamily:'var(--font-mono)',cursor:'pointer',textAlign:'start',letterSpacing:'0.05em',borderBottom:'1px solid var(--border)'}}>
                    {docType===type?'✓ ':''}{type.replace(/_/g,' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.txt" style={{display:'none'}} onChange={upload}/>
        <div className="page-tabs">
          {[['documents',t('know.documents')],['search',t('know.search')]].map(([k,l])=>(
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="page-body">
        {uploadMsg && (
          <div style={{padding:'10px 16px',borderRadius:'var(--radius)',marginBottom:16,fontSize:13,
            background: uploadMsg.type==='success'?'rgba(46,204,113,0.1)':'rgba(231,76,60,0.1)',
            border: `1px solid ${uploadMsg.type==='success'?'rgba(46,204,113,0.3)':'rgba(231,76,60,0.3)'}`,
            color: uploadMsg.type==='success'?'var(--success)':'var(--danger)',
            display:'flex',justifyContent:'space-between',alignItems:'center',
          }}>
            <span>{uploadMsg.text}</span>
            <button onClick={()=>setUploadMsg(null)} style={{background:'none',border:'none',color:'inherit',cursor:'pointer',fontSize:16}}>×</button>
          </div>
        )}
        {tab==='documents' && (
          docs.length===0
            ? <div className="empty"><div className="empty-title">{t('know.no_docs')}</div><button className="btn btn-primary mt-4" onClick={()=>fileRef.current?.click()}>{t('know.upload_first')}</button></div>
            : <div style={{ overflowX: 'auto' }}><table>
                <thead><tr>
                  <th>{t('know.col_name')}</th>
                  <th>{t('know.col_type')}</th>
                  <th>{t('know.col_lang')}</th>
                  <th>{t('know.col_chunks')}</th>
                  <th>{t('know.col_status')}</th>
                  <th></th>
                </tr></thead>
                <tbody>{docs.map((d:any)=>(
                  <tr key={d.id}>
                    <td style={{fontWeight:500}}>📄 {displayName(d.name)}</td>
                    <td style={{fontSize:11,color:'var(--text-dim)'}}>{d.type}</td>
                    <td style={{fontSize:11}}>{d.language}</td>
                    <td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{d.chunkCount||'—'}</td>
                    <td><span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span></td>
                    <td>
                      <button
                        onClick={()=>deleteDoc(d.id, displayName(d.name))}
                        disabled={deleting===d.id}
                        style={{background:'none',border:'1px solid rgba(231,76,60,0.3)',borderRadius:'var(--radius)',color:'var(--danger)',padding:'3px 8px',fontSize:11,cursor:'pointer',opacity:deleting===d.id?0.5:1}}
                      >
                        {deleting===d.id?'...':'🗑'}
                      </button>
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
        )}
        {tab==='search' && (
          <div>
            <div className="flex gap-2 mb-6">
              <input className="form-input" style={{flex:1}} value={query} onChange={e=>setQuery(e.target.value)}
                placeholder={t('know.placeholder')} onKeyDown={e=>e.key==='Enter'&&search()}/>
              <button className="btn btn-primary" onClick={search} disabled={searching}>
                🔍 {searching ? t('know.searching') : t('know.search_btn')}
              </button>
            </div>
            {results.map((r,i)=>(
              <div key={i} className="card mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div style={{fontSize:12,color:'var(--text-dim)'}}>{displayName(r.documentName)}</div>
                  <div style={{fontSize:11,color:'var(--accent)'}}>{t('know.score')}: {(r.score*100).toFixed(1)}%</div>
                </div>
                <div style={{fontSize:13,lineHeight:1.7}}>{r.content}</div>
              </div>
            ))}
            {results.length===0 && query && !searching && (
              <div className="empty"><div className="empty-title">{t('know.no_results')}</div></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
