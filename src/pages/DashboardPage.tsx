import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'

export default function DashboardPage() {
  const nav = useNavigate()
  const { t } = useLang()
  const [cycles, setCycles] = useState<any[]>([])
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  useEffect(()=>{ api.getCycles().then(setCycles).catch(()=>{}); api.getCapabilities().then(setCapabilities).catch(()=>{}); api.getDocuments().then(setDocs).catch(()=>{}) },[])
  const activeCycles = cycles.filter(c=>c.status==='ACTIVE').length
  const readyDocs = docs.filter(d=>d.status==='READY').length
  return (
    <div>
      <div className="page-header" style={{paddingBottom:24}}>
        <div className="flex items-center justify-between">
          <div><div className="page-title">{t('dash.title')}</div><div className="page-subtitle">{t('dash.subtitle')}</div></div>
          <div style={{fontSize:11,color:'var(--success)',fontFamily:'var(--font-mono)'}}>{t('dash.status')}</div>
        </div>
      </div>
      <div className="page-body">
        <div className="grid-4 mb-6">
          <div className="stat-card"><div className="stat-value">{cycles.length}</div><div className="stat-label">{t('dash.adm_cycles')}</div><div className="stat-delta">{activeCycles} {t('dash.active')}</div></div>
          <div className="stat-card"><div className="stat-value">{capabilities.length}</div><div className="stat-label">{t('dash.capabilities')}</div></div>
          <div className="stat-card"><div className="stat-value">{docs.length}</div><div className="stat-label">{t('dash.documents')}</div><div className="stat-delta">{readyDocs} {t('dash.indexed')}</div></div>
          <div className="stat-card"><div className="stat-value">—</div><div className="stat-label">{t('dash.ai_sessions')}</div></div>
        </div>
        <div className="grid-2 mb-6">
          <div className="card">
            <div className="section-title">⚙ {t('dash.active_cycles')}</div>
            {cycles.length===0?<div className="empty" style={{padding:'24px 0'}}><div className="empty-title">{t('dash.no_cycles')}</div><button className="btn btn-primary btn-sm mt-4" onClick={()=>nav('/adm')}>{t('dash.create_cycle')}</button></div>
            :cycles.slice(0,4).map(c=>(
              <div key={c.id} className="flex items-center justify-between" style={{padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                <div><div style={{fontSize:13,fontWeight:500}}>{c.name}</div><div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'var(--font-mono)',marginTop:2}}>Phase {c.currentPhase} · {c.frameworkType}</div></div>
                <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-title">{t('dash.quick_actions')}</div>
            {[
              {icon:'⚙',label:t('qa.adm'),sub:t('qa.adm_sub'),path:'/adm'},
              {icon:'💬',label:t('qa.copilot'),sub:t('qa.copilot_sub'),path:'/copilot'},
              {icon:'🗄',label:t('qa.repo'),sub:t('qa.repo_sub'),path:'/repository'},
              {icon:'📚',label:t('qa.knowledge'),sub:t('qa.knowledge_sub'),path:'/knowledge'},
            ].map(a=>(
              <button key={a.path} onClick={()=>nav(a.path)} style={{width:'100%',background:'none',border:'none',padding:'10px 0',borderBottom:'1px solid var(--border)',cursor:'pointer',textAlign:'start',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:20}}>{a.icon}</span>
                <div><div style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>{a.label}</div><div style={{fontSize:11,color:'var(--text-dim)'}}>{a.sub}</div></div>
              </button>
            ))}
          </div>
        </div>
        {cycles[0] && cycles[0].frameworkType === 'NORA' && (
          <div className="card">
            <div className="section-title">{t('dash.latest_cycle')} — {cycles[0].name}</div>
            <div className="phase-track">
              {['1','2','3','4','5','6','7'].map(p=>{
                const ph=cycles[0].phases?.find((x:any)=>x.phase===p); const s=ph?.status||'NOT_STARTED'
                return <div key={p} className="phase-step"><div className={`phase-dot${s==='COMPLETE'?' done':s==='IN_PROGRESS'?' active':''}`}>{p}</div><div className="phase-label">{s==='COMPLETE'?'✓':s==='IN_PROGRESS'?'→':'·'}</div></div>
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
