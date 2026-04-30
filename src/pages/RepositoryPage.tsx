import { useEffect, useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'
export default function RepositoryPage() {
  const { t } = useLang()
  const [tab, setTab] = useState('capabilities')
  const [capabilities, setCapabilities] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [decisions, setDecisions] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<any>({})
  const set=(k:string)=>(e:any)=>setForm((f:any)=>({...f,[k]:e.target.value}))
  useEffect(()=>{api.getCapabilities().then(setCapabilities).catch(()=>{})},[])
  useEffect(()=>{api.getApplications().then(setApplications).catch(()=>{})},[])
  useEffect(()=>{api.getDecisions().then(setDecisions).catch(()=>{})},[])
  const addCap=async(e:any)=>{e.preventDefault();await api.createCapability({...form,level:parseInt(form.level)||1});setShowAdd(false);setForm({});api.getCapabilities().then(setCapabilities)}
  const addApp=async(e:any)=>{e.preventDefault();await api.createApplication(form);setShowAdd(false);setForm({});api.getApplications().then(setApplications)}
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div><div className="page-title">{t('repo.title')}</div><div className="page-subtitle">{t('repo.subtitle')}</div></div>
          <button className="btn btn-primary" onClick={()=>setShowAdd(true)}>{t('repo.add')}</button>
        </div>
        <div className="page-tabs">
          {[['capabilities',t('repo.capabilities')],['applications',t('repo.applications')],['decisions',t('repo.decisions')]].map(([k,l])=>(
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>
      </div>
      <div className="page-body">
        {tab==='capabilities'&&(capabilities.length===0?<div className="empty"><div className="empty-title">{t('repo.no_capabilities')}</div><button className="btn btn-primary mt-4" onClick={()=>setShowAdd(true)}>{t('repo.add_cap')}</button></div>:
          <table><thead><tr><th>{t('repo.col_name')}</th><th>{t('repo.col_arabic')}</th><th>{t('repo.col_domain')}</th><th>{t('repo.col_level')}</th></tr></thead><tbody>{capabilities.map(c=>(
            <tr key={c.id}><td style={{fontWeight:500}}>{c.name}</td><td dir="rtl" style={{fontFamily:'var(--font-body)'}}>{c.nameAr||'—'}</td><td><span style={{fontSize:11,padding:'2px 8px',background:'rgba(0,180,216,0.1)',borderRadius:2,color:'var(--accent)'}}>{c.domain}</span></td><td style={{fontFamily:'var(--font-mono)',fontSize:12}}>L{c.level}</td></tr>
          ))}</tbody></table>
        )}
        {tab==='applications'&&(applications.length===0?<div className="empty"><div className="empty-title">{t('repo.no_applications')}</div><button className="btn btn-primary mt-4" onClick={()=>setShowAdd(true)}>{t('repo.add_app')}</button></div>:
          <table><thead><tr><th>{t('repo.col_name')}</th><th>{t('repo.col_type')}</th><th>{t('repo.col_owner')}</th></tr></thead><tbody>{applications.map(a=>(
            <tr key={a.id}><td style={{fontWeight:500}}>{a.name}</td><td style={{fontSize:11,color:'var(--text-dim)'}}>{a.type}</td><td>{a.owner||'—'}</td></tr>
          ))}</tbody></table>
        )}
        {tab==='decisions'&&(decisions.length===0?<div className="empty"><div className="empty-title">{t('repo.no_decisions')}</div></div>:
          <table><thead><tr><th>{t('repo.col_adc')}</th><th>{t('repo.col_title')}</th><th>{t('repo.col_status')}</th></tr></thead><tbody>{(decisions as any[]).map(d=>(
            <tr key={d.id}><td style={{fontFamily:'var(--font-mono)',fontSize:12}}>{d.adcNumber}</td><td style={{fontWeight:500}}>{d.title}</td><td><span className="badge badge-draft">{d.status}</span></td></tr>
          ))}</tbody></table>
        )}
      </div>
      {showAdd&&(
        <div className="modal-overlay" onClick={()=>setShowAdd(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-title">{tab==='capabilities'?t('repo.add_cap'):t('repo.add_app')}</div>
            <form onSubmit={tab==='capabilities'?addCap:addApp}>
              <div className="form-group"><label className="form-label">{t('repo.name_en')}</label><input className="form-input" value={form.name||''} onChange={set('name')} required/></div>
              <div className="form-group"><label className="form-label">{t('repo.name_ar')}</label><input className="form-input" value={form.nameAr||''} onChange={set('nameAr')} dir="rtl"/></div>
              {tab==='capabilities'&&<><div className="form-group"><label className="form-label">{t('repo.domain')}</label><input className="form-input" value={form.domain||''} onChange={set('domain')} required/></div><div className="form-group"><label className="form-label">{t('repo.level')}</label><select className="form-input" value={form.level||'1'} onChange={set('level')}><option value="1">Level 1</option><option value="2">Level 2</option><option value="3">Level 3</option></select></div></>}
              {tab==='applications'&&<><div className="form-group"><label className="form-label">{t('repo.type')}</label><input className="form-input" value={form.type||''} onChange={set('type')} required/></div><div className="form-group"><label className="form-label">{t('repo.owner')}</label><input className="form-input" value={form.owner||''} onChange={set('owner')}/></div></>}
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setShowAdd(false)}>{t('common.cancel')}</button><button type="submit" className="btn btn-primary">{t('common.add')}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
