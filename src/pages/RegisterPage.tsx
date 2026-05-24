import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'

const API_BASE = process.env.REACT_APP_API_URL || 'https://ea-platform-api-7omywjptqq-ww.a.run.app/api/v1'

type Step = 'org' | 'admin' | 'done'

export default function RegisterPage() {
  const { locale, setLocale } = useLang()
  const nav = useNavigate()
  const isAR = locale === 'AR'

  const [step, setStep] = useState<Step>('org')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [slugStatus, setSlugStatus] = useState<'idle'|'checking'|'available'|'taken'>('idle')
  const [result, setResult] = useState<any>(null)

  const [org, setOrg] = useState({
    name: '', nameAr: '', slug: '', locale: 'EN', frameworkType: 'NORA',
  })
  const [admin, setAdmin] = useState({
    fullName: '', fullNameAr: '', email: '', password: '', confirmPassword: '',
  })

  const setO = (k: string) => (e: any) => setOrg(o => ({...o, [k]: e.target.value}))
  const setA = (k: string) => (e: any) => setAdmin(a => ({...a, [k]: e.target.value}))

  // Auto-generate slug from org name
  const handleNameChange = (e: any) => {
    const name = e.target.value
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    setOrg(o => ({...o, name, slug}))
    setSlugStatus('idle')
  }

  const checkSlug = async () => {
    if (!org.slug || org.slug.length < 3) return
    setSlugStatus('checking')
    try {
      const r = await fetch(`${API_BASE}/registration/check-slug?slug=${org.slug}`)
      const data = await r.json()
      setSlugStatus(data.available ? 'available' : 'taken')
    } catch {
      setSlugStatus('idle')
    }
  }

  const submitOrg = (e: FormEvent) => {
    e.preventDefault()
    if (!org.name || !org.slug) return
    if (slugStatus === 'taken') { setError(isAR ? 'معرف المنظمة محجوز' : 'Organization ID is already taken'); return }
    setError('')
    setStep('admin')
  }

  const submitAdmin = async (e: FormEvent) => {
    e.preventDefault()
    if (admin.password !== admin.confirmPassword) {
      setError(isAR ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
      return
    }
    if (admin.password.length < 8) {
      setError(isAR ? 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' : 'Password must be at least 8 characters')
      return
    }
    setError(''); setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: org.name,
          organizationNameAr: org.nameAr,
          slug: org.slug,
          locale: org.locale,
          frameworkType: org.frameworkType,
          adminEmail: admin.email,
          adminPassword: admin.password,
          adminFullName: admin.fullName,
          adminFullNameAr: admin.fullNameAr,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Registration failed')
      setResult(data)
      setStep('done')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const slugColor = slugStatus === 'available' ? 'var(--success)' : slugStatus === 'taken' ? 'var(--danger)' : 'var(--text-dim)'
  const slugMsg = slugStatus === 'available' ? (isAR ? '✓ متاح' : '✓ Available') : slugStatus === 'taken' ? (isAR ? '✗ محجوز' : '✗ Already taken') : slugStatus === 'checking' ? (isAR ? 'جارٍ التحقق...' : 'Checking...') : ''

  return (
    <div className="login-page" style={{alignItems:'flex-start',paddingTop:40,paddingBottom:40}}>
      <div className="login-card" style={{width:520,maxWidth:'95vw'}}>
        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:4}}>
          <div className="login-logo">EA Platform</div>
          <button onClick={()=>setLocale(locale==='EN'?'AR':'EN')} style={{background:'none',border:'1px solid var(--border)',borderRadius:'var(--radius)',color:'var(--text-dim)',padding:'4px 10px',fontSize:11,cursor:'pointer'}}>
            {locale==='EN'?'🌐 العربية':'🌐 English'}
          </button>
        </div>
        <div className="login-tagline">{isAR?'منصة ذكاء هندسة المؤسسات':'ENTERPRISE ARCHITECTURE INTELLIGENCE PLATFORM'}</div>

        {step !== 'done' && (
          <>
            <div style={{display:'flex',gap:8,marginBottom:24,marginTop:16}}>
              {[['org', isAR?'المنظمة':'Organization'],['admin',isAR?'المسؤول':'Admin']].map(([s,l],i)=>(
                <div key={s} style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{width:24,height:24,borderRadius:'50%',background:step===s?'var(--accent)':step==='admin'&&s==='org'?'var(--success)':'var(--navy-mid)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:step===s?'var(--navy)':'var(--text-dim)',border:`1px solid ${step===s?'var(--accent)':step==='admin'&&s==='org'?'var(--success)':'var(--border)'}`}}>
                    {step==='admin'&&s==='org'?'✓':i+1}
                  </div>
                  <span style={{fontSize:12,color:step===s?'var(--accent)':'var(--text-dim)'}}>{l}</span>
                  {i===0&&<span style={{color:'var(--border)',fontSize:16}}>→</span>}
                </div>
              ))}
            </div>

            {error && <div className="login-error">{error}</div>}
          </>
        )}

        {/* Step 1 — Organization */}
        {step==='org' && (
          <form onSubmit={submitOrg}>
            <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,marginBottom:20}}>
              {isAR?'معلومات المنظمة':'Organization Details'}
            </div>
            <div className="form-group">
              <label className="form-label">{isAR?'اسم المنظمة':'Organization Name'} *</label>
              <input className="form-input" value={org.name} onChange={handleNameChange} placeholder={isAR?'وزارة الصحة':'Ministry of Health'} required/>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR?'الاسم بالعربية':'Arabic Name'}</label>
              <input className="form-input" value={org.nameAr} onChange={setO('nameAr')} dir="rtl" placeholder="وزارة الصحة"/>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR?'معرف المنظمة':'Organization ID'} *</label>
              <div style={{display:'flex',gap:8}}>
                <input className="form-input" value={org.slug} onChange={e=>{setO('slug')(e);setSlugStatus('idle')}} onBlur={checkSlug} placeholder="ministry-of-health" style={{flex:1}} required/>
                <button type="button" onClick={checkSlug} className="btn btn-secondary btn-sm" style={{flexShrink:0}}>
                  {isAR?'تحقق':'Check'}
                </button>
              </div>
              <div style={{fontSize:11,marginTop:4,color:slugColor}}>{slugMsg}</div>
              <div style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>
                {isAR?'يستخدم لتسجيل الدخول — أحرف صغيرة وأرقام وشرطات فقط':'Used for login — lowercase letters, numbers, and hyphens only'}
              </div>
            </div>
            <div className="grid-2" style={{gap:12}}>
              <div className="form-group">
                <label className="form-label">{isAR?'اللغة الافتراضية':'Default Language'}</label>
                <select className="form-input" value={org.locale} onChange={setO('locale')}>
                  <option value="EN">English</option>
                  <option value="AR">العربية</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{isAR?'الإطار المرجعي':'EA Framework'}</label>
                <select className="form-input" value={org.frameworkType} onChange={setO('frameworkType')}>
                  <option value="NORA">NORA</option>
                  <option value="CUSTOM">{isAR?'مخصص':'Custom'}</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary" type="submit" style={{width:'100%',justifyContent:'center',marginTop:8}}>
              {isAR?'التالي →':'Next →'}
            </button>
            <div style={{textAlign:'center',marginTop:16,fontSize:12,color:'var(--text-dim)'}}>
              {isAR?'لديك حساب؟':'Already have an account?'}{' '}
              <Link to='/login' style={{color:'var(--accent)'}}>{isAR?'تسجيل الدخول':'Sign In'}</Link>
            </div>
          </form>
        )}

        {/* Step 2 — Admin User */}
        {step==='admin' && (
          <form onSubmit={submitAdmin}>
            <div style={{fontFamily:'var(--font-display)',fontSize:16,fontWeight:600,marginBottom:20}}>
              {isAR?'حساب المسؤول':'Admin Account'}
            </div>
            <div className="grid-2" style={{gap:12}}>
              <div className="form-group">
                <label className="form-label">{isAR?'الاسم الكامل':'Full Name'} *</label>
                <input className="form-input" value={admin.fullName} onChange={setA('fullName')} placeholder="Ahmed Al-Rashid" required/>
              </div>
              <div className="form-group">
                <label className="form-label">{isAR?'الاسم بالعربية':'Arabic Name'}</label>
                <input className="form-input" value={admin.fullNameAr} onChange={setA('fullNameAr')} dir="rtl" placeholder="أحمد الراشد"/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR?'البريد الإلكتروني':'Email Address'} *</label>
              <input className="form-input" type="email" value={admin.email} onChange={setA('email')} placeholder="admin@organization.gov" required/>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR?'كلمة المرور':'Password'} *</label>
              <input className="form-input" type="password" value={admin.password} onChange={setA('password')} placeholder="••••••••" required/>
            </div>
            <div className="form-group">
              <label className="form-label">{isAR?'تأكيد كلمة المرور':'Confirm Password'} *</label>
              <input className="form-input" type="password" value={admin.confirmPassword} onChange={setA('confirmPassword')} placeholder="••••••••" required/>
            </div>
            <div style={{display:'flex',gap:10,marginTop:8}}>
              <button type="button" className="btn btn-secondary" style={{flex:1,justifyContent:'center'}} onClick={()=>{setStep('org');setError('')}}>
                {isAR?'← رجوع':'← Back'}
              </button>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{flex:2,justifyContent:'center'}}>
                {loading?(isAR?'جارٍ التسجيل...':'Creating account...'):(isAR?'إنشاء الحساب':'Create Account')}
              </button>
            </div>
          </form>
        )}

        {/* Step 3 — Success */}
        {step==='done' && result && (
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:48,marginBottom:16}}>🎉</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:700,color:'var(--accent)',marginBottom:8}}>
              {isAR?'تم إنشاء حسابك!':'Account Created!'}
            </div>
            <div style={{fontSize:13,color:'var(--text-dim)',marginBottom:24}}>
              {isAR
                ? `مرحباً بمنظمة ${result.tenant.name} في منصة EA`
                : `Welcome, ${result.tenant.name} — your EA Platform is ready`}
            </div>
            <div className="card" style={{textAlign:'start',marginBottom:20}}>
              <div style={{fontSize:11,color:'var(--text-dim)',fontFamily:'var(--font-mono)',marginBottom:8}}>
                {isAR?'بيانات تسجيل الدخول':'YOUR LOGIN DETAILS'}
              </div>
              <div style={{fontSize:13,marginBottom:6}}><span style={{color:'var(--text-dim)'}}>Organization: </span><span style={{fontFamily:'var(--font-mono)',color:'var(--accent)'}}>{result.tenant.slug}</span></div>
              <div style={{fontSize:13,marginBottom:6}}><span style={{color:'var(--text-dim)'}}>Email: </span><span>{result.admin.email}</span></div>
              <div style={{fontSize:13}}><span style={{color:'var(--text-dim)'}}>Role: </span><span style={{fontFamily:'var(--font-mono)'}}>{result.admin.role}</span></div>
            </div>
            <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={()=>nav('/login')}>
              {isAR?'تسجيل الدخول الآن':'Sign In Now →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
