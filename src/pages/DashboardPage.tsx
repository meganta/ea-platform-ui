import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
export default function DashboardPage() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [cycles, setCycles] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  useEffect(() => {
    api.getCycles().then(setCycles).catch(()=>{})
    api.getCapabilities().then(setCapabilities).catch(()=>{})
    api.getDocuments().then(setDocs).catch(()=>{})
  }, [])
  const activeCycles = cycles.filter(c=>c.status==='ACTIVE').length
  const readyDocs = docs.filter(d=>d.status==='READY').length
  return (
    <div>
      <div className="page-header" style={{paddingBottom:24}}>
        <div className="flex items-center justify-between">
          <div><div className="page-title">Command Center</div><div className="page-subtitle">EA PLATFORM — OPERATIONAL OVERVIEW</div></div>
          <div style={{fontSize:11,color:'var(--success)',fontFamily:'var(--font-mono)'}}>● SYSTEM OPERATIONAL</div>
        </div>
      </div>
      <div className="page-body">
        <div className="grid-4 mb-6">
          <div className="stat-card"><div className="stat-value">{cycles.length}</div><div className="stat-label">ADM Cycles</div><div className="stat-delta">{activeCycles} active</div></div>
          <div className="stat-card"><div className="stat-value">{capabilities.length}</div><div className="stat-label">Capabilities</div></div>
          <div className="stat-card"><div className="stat-value">{docs.length}</div><div className="stat-label">Documents</div><div className="stat-delta">{readyDocs} indexed</div></div>
          <div className="stat-card"><div className="stat-value">—</div><div className="stat-label">AI Sessions</div></div>
        </div>
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="section-title">⚙ Active ADM Cycles</div>
            {cycles.length===0 ? <div className="empty" style={{padding:'24px 0'}}><div className="empty-title">No cycles yet</div><button className="btn btn-primary btn-sm mt-4" onClick={()=>nav('/adm')}>Create Cycle</button></div>
            : cycles.slice(0,4).map(c=>(
              <div key={c.id} className="flex items-center justify-between" style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div><div style={{fontSize:13,fontWeight:500}}>{c.name}</div><div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'var(--font-mono)',marginTop:2}}>Phase {c.currentPhase} · {c.frameworkType}</div></div>
                <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-title">Quick Actions</div>
            {[
              {icon:'⚙',label:'Start new ADM cycle',sub:'Plan and execute EA transformation',path:'/adm'},
              {icon:'💬',label:'Ask EA Copilot',sub:'Get AI-powered architecture guidance',path:'/copilot'},
              {icon:'🗄',label:'Update EA Repository',sub:'Manage capabilities and applications',path:'/repository'},
              {icon:'📚',label:'Upload Knowledge',sub:'Add strategy docs and policies',path:'/knowledge'},
            ].map(a=>(
              <button key={a.path} onClick={()=>nav(a.path)} style={{width:'100%',background:'none',border:'none',padding:'10px 0',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:20}}>{a.icon}</span>
                <div><div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{a.label}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{a.sub}</div></div>
              </button>
            ))}
          </div>
        </div>
        {cycles[0] && (
          <div className="card">
            <div className="section-title">Latest Cycle — {cycles[0].name}</div>
            <div className="phase-track">
              {['PRELIM','A','B','C','D','E','F','G','H'].map(p=>{
                const ph = cycles[0].phases?.find((x:any)=>x.phase===p)
                const s = ph?.status||'NOT_STARTED'
                return <div key={p} className="phase-step"><div className={`phase-dot${s==='COMPLETE'?' done':s==='IN_PROGRESS'?' active':''}`}>{p}</div><div className="phase-label">{s==='COMPLETE'?'✓':s==='IN_PROGRESS'?'→':'·'}</div></div>
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
