import { useEffect, useState, useRef } from 'react'
import { api } from '../lib/api'
export default function KnowledgePage() {
  const [docs, setDocs] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [tab, setTab] = useState('documents')
  const fileRef = useRef<HTMLInputElement>(null)
  const load = () => api.getDocuments().then(setDocs).catch(()=>{})
  useEffect(()=>{ load() },[])
  const upload = async (e:any) => {
    const file = e.target.files?.[0]; if(!file) return; setUploading(true)
    const fd = new FormData(); fd.append('file', file); fd.append('type', 'STRATEGY')
    try {
      const token = localStorage.getItem('ea_token')
      await fetch(`https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1/knowledge/documents/upload`, { method:'POST', headers:{'Authorization':`Bearer ${token}`}, body:fd })
      await load()
    } finally { setUploading(false); e.target.value='' }
  }
  const search = async () => { if(!query.trim()) return; setSearching(true); setResults([]); try { const r = await api.searchKnowledge(query); setResults(r) } finally { setSearching(false) } }
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">Knowledge Base</div><div className="page-subtitle">DOCUMENTS & SEMANTIC SEARCH</div></div>
          <button className="btn btn-primary" disabled={uploading} onClick={()=>fileRef.current?.click()}>⬆ {uploading?'Uploading...':'Upload Document'}</button>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.txt" style={{display:'none'}} onChange={upload}/>
        <div className="page-tabs">
          {[['documents','Documents'],['search','Semantic Search']].map(([k,l])=>(
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="page-body">
        {tab==='documents' && (docs.length===0 ? <div className="empty"><div className="empty-title">No documents</div><button className="btn btn-primary mt-4" onClick={()=>fileRef.current?.click()}>Upload First Document</button></div> :
          <table><thead><tr><th>Name</th><th>Type</th><th>Language</th><th>Chunks</th><th>Status</th></tr></thead><tbody>{docs.map((d:any)=>(
            <tr key={d.id}><td style={{fontWeight:500}}>📄 {d.name}</td><td style={{fontSize:11,color:'var(--text-dim)'}}>{d.type}</td><td style={{fontSize:11}}>{d.language}</td><td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{d.chunkCount||'—'}</td><td><span className={`badge badge-${d.status.toLowerCase()}`}>{d.status}</span></td></tr>
          ))}</tbody></table>
        )}
        {tab==='search' && (
          <div>
            <div className="flex gap-2 mb-6">
              <input className="form-input" style={{flex:1}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your knowledge base..." onKeyDown={e=>e.key==='Enter'&&search()}/>
              <button className="btn btn-primary" onClick={search} disabled={searching}>🔍 {searching?'Searching...':'Search'}</button>
            </div>
            {results.map((r,i)=>(
              <div key={i} className="card mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div style={{fontSize:12,color:'var(--text-dim)'}}>{r.documentName}</div>
                  <div style={{fontSize:11,color:'var(--accent)'}}>Score: {(r.score*100).toFixed(1)}%</div>
                </div>
                <div style={{fontSize:13,lineHeight:1.7}}>{r.content}</div>
              </div>
            ))}
            {results.length===0&&query&&!searching&&<div className="empty"><div className="empty-title">No results</div></div>}
          </div>
        )}
      </div>
    </div>
  )
}
