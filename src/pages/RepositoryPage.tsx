import { useEffect, useState } from 'react'
import { api } from '../lib/api'
export default function RepositoryPage() {
  const [tab, setTab] = useState('capabilities')
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>({})
  const set = (k:string) => (e:any) => setForm((f:any)=>({...f,[k]:e.target.value}))
  useEffect(()=>{ api.getCapabilities().then(setCapabilities).catch(()=>{}) },[])
  useEffect(()=>{ api.getApplications().then(setApplications).catch(()=>{}) },[])
  useEffect(()=>{ api.getDecisions().then(setDecisions).catch(()=>{}) },[])
  const addCapability = async (e:any) => { e.preventDefault(); await api.createCapability({...form,level:parseInt(form.level)||1}); setShowAdd(false); setForm({}); api.getCapabilities().then(setCapabilities) }
  const addApp = async (e:any) => { e.preventDefault(); await api.createApplication(form); setShowAdd(false); setForm({}); api.getApplications().then(setApplications) }
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">EA Repository</div><div className="page-subtitle">ARCHITECTURE ARTIFACTS & COMPONENTS</div></div>
          <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>+ Add</button>
        </div>
        <div className="page-tabs">
          {[['capabilities','Capabilities'],['applications','Applications'],['decisions','Decisions']].map(([k,l])=>(
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="page-body">
        {tab==='capabilities' && (capabilities.length===0 ? <div className="empty"><div className="empty-title">No capabilities</div><button className="btn btn-primary mt-4" onClick={()=>setShowAdd(true)}>Add Capability</button></div> :
          <table><thead><tr><th>Name</th><th>Arabic</th><th>Domain</th><th>Level</th></tr></thead><tbody>{capabilities.map(c=>(
            <tr key={c.id}><td style={{fontWeight:500}}>{c.name}</td><td dir="rtl">{c.nameAr||'—'}</td><td><span style={{fontSize:11,padding:'2px 8px',background:'rgba(0,180,216,0.1)',borderRadius:2,color:'var(--accent)'}}>{c.domain}</span></td><td style={{fontFamily:'var(--font-mono)',fontSize:12}}>L{c.level}</td></tr>
          ))}</tbody></table>
        )}
        {tab==='applications' && (applications.length===0 ? <div className="empty"><div className="empty-title">No applications</div><button className="btn btn-primary mt-4" onClick={()=>setShowAdd(true)}>Add Application</button></div> :
          <table><thead><tr><th>Name</th><th>Type</th><th>Owner</th></tr></thead><tbody>{applications.map(a=>(
            <tr key={a.id}><td style={{fontWeight:500}}>{a.name}</td><td style={{fontSize:11,color:'var(--text-dim)'}}>{a.type}</td><td>{a.owner||'—'}</td></tr>
          ))}</tbody></table>
        )}
        {tab==='decisions' && (decisions.length===0 ? <div className="empty"><div className="empty-title">No decisions</div></div> :
          <table><thead><tr><th>ADC #</th><th>Title</th><th>Status</th></tr></thead><tbody>{decisions.map((d:any)=>(
            <tr key={d.id}><td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{d.adcNumber}</td><td style={{fontWeight:500}}>{d.title}</td><td><span className="badge badge-draft">{d.status}</span></td></tr>
          ))}</tbody></table>
        )}
      </div>
      {showAdd && (
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">Add {tab==='capabilities'?'Capability':'Application'}</div>
            <form onSubmit={tab==='capabilities'?addCapability:addApp}>
              <div className="form-group"><label className="form-label">Name (English)</label><input className="form-input" value={form.name||''} onChange={set('name')} required/></div>
              <div className="form-group"><label className="form-label">Name (Arabic)</label><input className="form-input" value={form.nameAr||''} onChange={set('nameAr')} dir="rtl"/></div>
              {tab==='capabilities'&&<><div className="form-group"><label className="form-label">Domain</label><input className="form-input" value={form.domain||''} onChange={set('domain')} required/></div><div className="form-group"><label className="form-label">Level</label><select className="form-input" value={form.level||'1'} onChange={set('level')}><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></div></>}
              {tab==='applications'&&<><div className="form-group"><label className="form-label">Type</label><input className="form-input" value={form.type||''} onChange={set('type')} required/></div><div className="form-group"><label className="form-label">Owner</label><input className="form-input" value={form.owner||''} onChange={set('owner')}/></div></>}
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Add</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
