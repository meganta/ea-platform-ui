import { useEffect, useState } from 'react'
import { api } from '../lib/api'
const PHASES = ['PRELIM','A','B','C','D','E','F','G','H']
function Modal({ onClose, onCreate }: any) {
  const [form, setForm] = useState({ name:'', description:'', frameworkType:'TOGAF' })
  const [loading, setLoading] = useState(false)
  const set = (k:string) => (e:any) => setForm(f=>({...f,[k]:e.target.value}))
  const submit = async (e:any) => { e.preventDefault(); setLoading(true); try { await onCreate(form) } finally { setLoading(false) } }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-title">New ADM Cycle</div>
        <form onSubmit={submit}>
          <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={form.name} onChange={set('name')} required/></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={set('description')}/></div>
          <div className="form-group"><label className="form-label">Framework</label>
            <select className="form-input" value={form.frameworkType} onChange={set('frameworkType')}>
              <option value="TOGAF">TOGAF</option><option value="NORA">NORA</option><option value="CUSTOM">Custom</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Creating...':'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default function AdmPage() {
  const [cycles, setCycles] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gapResult, setGapResult] = useState('')
  const load = async () => { const c = await api.getCycles(); setCycles(c); if(selected) setSelected(c.find((x:any)=>x.id===selected.id)||null) }
  useEffect(()=>{ load() },[])
  useEffect(()=>{ if(cycles.length&&!selected) setSelected(cycles[0]) },[cycles])
  const create = async (data:any) => { await api.createCycle(data); setShowCreate(false); await load() }
  const startPhase = async (phase:string) => { setLoading(true); try { await api.startPhase(selected.id, phase); await load() } finally { setLoading(false) } }
  const runGap = async () => { setLoading(true); setGapResult(''); try { const r = await api.runGapAnalysis(selected.id); setGapResult(r.analysis); await load() } finally { setLoading(false) } }
  const getPhase = (p:string) => selected?.phases?.find((ph:any)=>ph.phase===p)
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">ADM Cycles</div><div className="page-subtitle">ARCHITECTURE DEVELOPMENT METHOD</div></div>
          <button className="btn btn-primary" onClick={()=>setShowCreate(true)}>+ New Cycle</button>
        </div>
      </div>
      <div className="page-body">
        {cycles.length===0 ? <div className="empty"><div className="empty-title">No ADM cycles</div><button className="btn btn-primary mt-4" onClick={()=>setShowCreate(true)}>Create Cycle</button></div> : (
          <div style={{display:'grid',gridTemplateColumns:'260px 1fr',gap:20}}>
            <div>
              {cycles.map(c=>(
                <div key={c.id} onClick={()=>setSelected(c)} style={{padding:'12px 14px',marginBottom:6,background:selected?.id===c.id?'var(--navy-mid)':'var(--navy-light)',border:`1px solid ${selected?.id===c.id?'var(--accent)':'var(--border)'}`,borderRadius:'var(--radius)',cursor:'pointer'}}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{c.name}</div>
                  <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                </div>
              ))}
            </div>
            {selected && (
              <div>
                <div className="card mb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div><div className="card-title">{selected.name}</div><div className="card-subtitle">{selected.frameworkType} · Phase {selected.currentPhase}</div></div>
                    <span className={`badge badge-${selected.status.toLowerCase()}`}>{selected.status}</span>
                  </div>
                  <div className="phase-track">
                    {PHASES.map(p=>{const s=getPhase(p)?.status||'NOT_STARTED'; return <div key={p} className="phase-step"><div className={`phase-dot${s==='COMPLETE'?' done':s==='IN_PROGRESS'?' active':''}`}>{p}</div><div className="phase-label">{s==='COMPLETE'?'✓':s==='IN_PROGRESS'?'→':'·'}</div></div>})}
                  </div>
                  <div className="divider"/>
                  <div className="flex gap-2">
                    {PHASES.filter(p=>!getPhase(p)||getPhase(p).status==='NOT_STARTED').slice(0,1).map(p=>(
                      <button key={p} className="btn btn-primary btn-sm" disabled={loading} onClick={()=>startPhase(p)}>▶ Start Phase {p}</button>
                    ))}
                    <button className="btn btn-secondary btn-sm" disabled={loading} onClick={runGap}>⚡ {loading?'Analysing...':'Run Gap Analysis'}</button>
                  </div>
                </div>
                {selected.deliverables?.length>0 && (
                  <div className="card mb-4">
                    <div className="section-title">📄 Deliverables</div>
                    <table><thead><tr><th>Title</th><th>Type</th><th>Phase</th><th>Status</th></tr></thead>
                    <tbody>{selected.deliverables.map((d:any)=>(
                      <tr key={d.id}><td style={{fontWeight:500}}>{d.title}</td><td style={{fontSize:11,color:'var(--text-dim)'}}>{d.type.replace(/_/g,' ')}</td><td style={{fontSize:11,fontFamily:'var(--font-mono)'}}>{d.phase}</td><td><span className={`badge badge-${d.status.toLowerCase().replace('_','-')}`}>{d.status.replace('_',' ')}</span></td></tr>
                    ))}</tbody></table>
                  </div>
                )}
                {gapResult && <div className="card"><div className="section-title">⚡ Gap Analysis</div><div style={{fontSize:12,lineHeight:1.8,whiteSpace:'pre-wrap',color:'var(--text-dim)',maxHeight:400,overflow:'auto',fontFamily:'var(--font-mono)'}}>{gapResult}</div></div>}
              </div>
            )}
          </div>
        )}
      </div>
      {showCreate && <Modal onClose={()=>setShowCreate(false)} onCreate={create}/>}
    </div>
  )
}
