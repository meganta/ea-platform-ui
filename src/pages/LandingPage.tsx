import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import { api } from '../lib/api'
import BrandLogo from '../brand/BrandLogo'
import BrandPattern from '../brand/BrandPattern'
import Icon, { IconName } from '../brand/icons'
import { BRAND_LEGAL_NAME } from '../brand/assets'
import '../brand/brand.css'
import './LandingPage.css'

type Copy = { EN: string; AR: string }
type LocalizedItem = { title: Copy; body: Copy }

const c = (EN: string, AR: string): Copy => ({ EN, AR })

const problemIcons: IconName[] = ['fragmented', 'manual', 'visibility', 'framework']
const capabilityIcons: IconName[] = ['layers', 'review', 'planning', 'decision', 'architects', 'radar']

const problems: LocalizedItem[] = [
  { title: c('Fragmented Architecture Information', 'تشتت معلومات البنية المؤسسية'), body: c('Architecture information is distributed across documents, spreadsheets, and disconnected tools.', 'تتوزع معلومات البنية المؤسسية بين المستندات وجداول البيانات والأدوات غير المترابطة.') },
  { title: c('Manual Architecture Governance', 'حوكمة معمارية تعتمد على الجهد اليدوي'), body: c('Architecture reviews demand significant expert effort and may produce inconsistent outcomes.', 'تتطلب المراجعات المعمارية جهداً كبيراً من الخبراء، وقد تؤدي إلى نتائج غير متسقة.') },
  { title: c('Limited Architecture Visibility', 'محدودية الرؤية المعمارية'), body: c('Dependencies, current-state architecture, and transformation impact are difficult to understand.', 'يصعب فهم الاعتماديات والبنية الحالية وتأثير مبادرات التحول بصورة متكاملة.') },
  { title: c('Framework Operationalization', 'تفعيل الأطر المعمارية'), body: c('Organizations adopt EA frameworks but struggle to apply them consistently in daily operations.', 'تتبنى الجهات أطر البنية المؤسسية، لكنها تواجه تحديات في تطبيقها بصورة متسقة ضمن العمل اليومي.') },
]

const operatingModel: LocalizedItem[] = [
  { title: c('MODEL', 'نمذج'), body: c('Define architecture language, standards, and structure.', 'حدّد اللغة المعمارية والمعايير والهيكل المنظم.') },
  { title: c('BUILD', 'وثّق'), body: c("Maintain the organization's actual architecture assets.", 'وثّق أصول البنية المؤسسية الفعلية وحافظ على حداثتها.') },
  { title: c('UNDERSTAND', 'افهم'), body: c('Explore relationships, dependencies, and architecture perspectives.', 'استكشف العلاقات والاعتماديات والمشاهد المعمارية المختلفة.') },
  { title: c('GOVERN', 'احكم'), body: c('Review solutions, assess alignment, and manage architecture decisions.', 'راجع الحلول وقيّم المواءمة وأدر القرارات المعمارية.') },
  { title: c('TRANSFORM', 'طوّر'), body: c('Plan target states, scenarios, and architecture evolution.', 'خطّط للحالات المستهدفة والسيناريوهات وتطور البنية المؤسسية.') },
]

const capabilityGroups = [
  { eyebrow: c('Architecture Foundation', 'الأساس المعماري'), items: [
    { title: c('Meta Model Studio', 'استوديو النموذج الوصفي'), body: c('Define framework-aligned domains, building blocks, attributes, and relationships.', 'عرّف المجالات واللبنات والخصائص والعلاقات بما يتوافق مع الإطار المعماري.') },
    { title: c('EA Repository', 'مستودع البنية المؤسسية'), body: c("Maintain the organization's architecture assets in a structured repository.", 'أدر أصول البنية المؤسسية للجهة ضمن مستودع منظم.') },
    { title: c('EA Views', 'المشاهد المعمارية'), body: c('Visualize relationships, dependencies, and architecture perspectives.', 'اعرض العلاقات والاعتماديات والمنظورات المعمارية بصرياً.') },
  ]},
  { eyebrow: c('Architecture Governance', 'الحوكمة المعمارية'), items: [
    { title: c('Architecture Reviews', 'المراجعات المعمارية'), body: c('Conduct structured reviews of solution designs, HLDs, RFPs, and architecture requests.', 'نفّذ مراجعات منهجية لتصاميم الحلول والتصاميم عالية المستوى وكراسات الشروط والطلبات المعمارية.') },
    { title: c('Evidence-Based Findings', 'نتائج مستندة إلى الأدلة'), body: c('Connect findings and recommendations to architecture evidence and organizational context.', 'اربط النتائج والتوصيات بالأدلة المعمارية وسياق الجهة.') },
  ]},
  { eyebrow: c('Architecture Planning', 'التخطيط المعماري'), items: [
    { title: c('ADM Cycle Management', 'إدارة دورات ADM'), body: c('Support structured enterprise architecture planning cycles.', 'ادعم دورات تخطيط البنية المؤسسية ضمن مسار منظم.') },
    { title: c('Architecture Scenarios', 'السيناريوهات المعمارية'), body: c('Model Current, Transition, and Target states and compare architecture evolution.', 'نمذج الحالات الحالية والانتقالية والمستهدفة وقارن تطور البنية المؤسسية.') },
  ]},
  { eyebrow: c('Decision & Assessment', 'القرار والتقييم'), items: [
    { title: c('Decision & Evaluation Studio', 'استوديو القرار والتقييم'), body: c('Compare technologies, solutions, and proposals using configurable criteria and weighted evaluation.', 'قارن التقنيات والحلول والعروض باستخدام معايير قابلة للتهيئة وتقييمات موزونة.') },
  ]},
  { eyebrow: c('AI-Assisted Architecture', 'البنية المؤسسية بمساعدة الذكاء الاصطناعي'), items: [
    { title: c('Chief Architect & Domain Architects', 'المعماري الرئيسي ومعماريو المجالات'), body: c('Explore and analyze architecture with AI assistance grounded in tenant architecture information.', 'استكشف البنية المؤسسية وحللها بمساعدة ذكية تستند إلى معلومات الجهة المعمارية.') },
  ]},
  { eyebrow: c('Innovation', 'الابتكار'), items: [
    { title: c('Technology Radar & Innovation Studies', 'رادار التقنية ودراسات الابتكار'), body: c('Explore emerging technologies and evaluate their relevance to architecture and strategy.', 'استكشف التقنيات الناشئة وقيّم ارتباطها بالبنية المؤسسية والاستراتيجية.') },
  ]},
]

const architectRoles: Copy[] = [
  c('Chief Architect', 'المعماري الرئيسي'), c('Business Architect', 'معماري الأعمال'),
  c('Application Architect', 'معماري التطبيقات'), c('Data Architect', 'معماري البيانات'),
  c('Integration Architect', 'معماري التكامل'), c('Technology / Infrastructure Architect', 'معماري التقنية والبنية التحتية'),
  c('Security Architect', 'معماري الأمن السيبراني'),
]

/**
 * Customers shown on the public portal. Add an entry per customer who has agreed to be listed.
 * `logo`: the customer's official logo file under public/customers/ (from the customer's own
 * published material — never redrawn). With a logo the name is kept for assistive technology only
 * (official logos already carry the name); without one the card shows the name.
 */
type Customer = { id: string; name: Copy; shortName?: Copy; sector: Copy; logo?: string }
const customers: Customer[] = [
  {
    id: 'hrdf',
    name: c('Human Resources Development Fund', 'صندوق تنمية الموارد البشرية'),
    shortName: c('HRDF', 'هدف'),
    sector: c('Government · Kingdom of Saudi Arabia', 'جهة حكومية · المملكة العربية السعودية'),
    logo: '/customers/hrdf.png',
  },
]

const navItems = [
  { href: '#platform', label: c('Platform', 'المنصة') },
  { href: '#capabilities', label: c('Capabilities', 'القدرات') },
  { href: '#ai-architects', label: c('AI Architects', 'المعماريون الأذكياء') },
  { href: '#frameworks', label: c('Frameworks', 'الأطر') },
  { href: '#customers', label: c('Customers', 'عملاؤنا') },
  { href: '#resources', label: c('Resources', 'الموارد') },
]

const labels = {
  heroTitle: c('Operate Enterprise Architecture with Clarity, Control, and Intelligence', 'تشغيل البنية المؤسسية بوضوح وحوكمة وذكاء'),
  heroBody: c('ArchMind brings enterprise architecture modeling, repository management, architecture views, governance, planning, assessments, and AI-assisted architecture into one integrated platform.', 'تجمع ArchMind نمذجة البنية المؤسسية، وإدارة مستودع الأصول المعمارية، والمشاهد المعمارية، والحوكمة، والتخطيط، والتقييمات، والمساعدة الذكية في منصة متكاملة واحدة.'),
  requestDemo: c('Request a Demo', 'اطلب عرضاً توضيحياً'),
  explore: c('Explore ArchMind', 'استكشف ArchMind'),
  signIn: c('Sign In', 'تسجيل الدخول'),
}

export default function LandingPage() {
  const { locale, setLocale } = useLang()
  const L = (value: Copy) => value[locale]
  const [menuOpen, setMenuOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [requestDraft, setRequestDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const seo = useMemo(() => locale === 'AR' ? {
    title: 'ArchMind | منصة تشغيل البنية المؤسسية',
    description: 'شغّل البنية المؤسسية من خلال نمذجة متكاملة، ومستودع معماري، ومشاهد، وحوكمة، وتخطيط، وتقييمات، ومساعدة ذكية.',
    ogLocale: 'ar_SA',
  } : {
    title: 'ArchMind | Enterprise Architecture Operations Platform',
    description: 'Operate enterprise architecture through integrated modeling, repository management, architecture views, governance, planning, assessments and AI-assisted architecture.',
    ogLocale: 'en_US',
  }, [locale])

  useEffect(() => {
    document.title = seo.title
    const setMeta = (selector: string, attribute: string, value: string) => {
      const element = document.querySelector<HTMLMetaElement>(selector)
      if (element) element.setAttribute(attribute, value)
    }
    setMeta('meta[name="description"]', 'content', seo.description)
    setMeta('meta[property="og:title"]', 'content', seo.title)
    setMeta('meta[property="og:description"]', 'content', seo.description)
    setMeta('meta[property="og:locale"]', 'content', seo.ogLocale)
    setMeta('meta[name="twitter:title"]', 'content', seo.title)
    setMeta('meta[name="twitter:description"]', 'content', seo.description)
  }, [seo])

  const submitDemo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const required = ['fullName', 'organization', 'jobTitle', 'email', 'country', 'message', 'preferredLanguage']
    const errors: Record<string, string> = {}
    required.forEach((field) => { if (!String(data.get(field) || '').trim()) errors[field] = locale === 'AR' ? 'هذا الحقل مطلوب' : 'This field is required' })
    const email = String(data.get('email') || '')
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = locale === 'AR' ? 'أدخل بريداً إلكترونياً صحيحاً' : 'Enter a valid work email'
    setFormErrors(errors)
    setCopied(false)
    if (Object.keys(errors).length) return
    const payload = {
      fullName: String(data.get('fullName')),
      organization: String(data.get('organization')),
      jobTitle: String(data.get('jobTitle')),
      email: String(data.get('email')),
      phone: String(data.get('phone') || '') || undefined,
      country: String(data.get('country')),
      preferredLanguage: String(data.get('preferredLanguage')),
      message: String(data.get('message')),
    }
    setSubmitting(true)
    try {
      await api.submitDemoRequest(payload)
      setSubmitted(true)
    } catch {
      // Network/server issue - fall back to the local copy-to-clipboard
      // flow so the visitor's filled-in details aren't lost even if
      // submission itself failed.
      setRequestDraft([
        'ArchMind demo request',
        `Name: ${payload.fullName}`,
        `Organization: ${payload.organization}`,
        `Job title: ${payload.jobTitle}`,
        `Work email: ${payload.email}`,
        `Phone: ${payload.phone || '—'}`,
        `Country: ${payload.country}`,
        `Preferred language: ${payload.preferredLanguage}`,
        `Message: ${payload.message}`,
      ].join('\n'))
    } finally {
      setSubmitting(false)
    }
  }

  const copyRequest = async () => {
    await navigator.clipboard.writeText(requestDraft)
    setCopied(true)
  }


  return (
    <div className="am-root lp" data-locale={locale}>
      <a className="lp-skip" href="#main">{L(c('Skip to content', 'انتقل إلى المحتوى'))}</a>
      <header className="lp-header">
        <nav className="lp-nav am-container wide" aria-label={L(c('Primary navigation', 'التنقل الرئيسي'))}>
          <BrandLogo href="#top" tone="reverse" size={21} label="ArchMind home" />
          <button className="lp-menu-button" aria-label={L(c('Open navigation', 'فتح قائمة التنقل'))} aria-expanded={menuOpen} aria-controls="lp-nav-panel" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
          <div id="lp-nav-panel" className={`lp-nav-panel${menuOpen ? ' open' : ''}`}>
            <div className="lp-nav-links">
              {navItems.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{L(item.label)}</a>)}
            </div>
            <div className="lp-nav-actions">
              <LanguageToggle locale={locale} onToggle={() => setLocale(locale === 'EN' ? 'AR' : 'EN')} label={L(c('Switch to Arabic', 'التبديل إلى الإنجليزية'))} />
              <Link className="lp-signin" to="/login">{L(labels.signIn)}</Link>
              <a className="am-btn am-btn-primary sm" href="#demo">{L(labels.requestDemo)}</a>
            </div>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="lp-hero am-on-dark" id="top">
          <BrandPattern variant="flow" intensity={0.55} />
          <div className="am-container wide lp-hero-grid">
            <div className="lp-hero-copy">
              <div className="am-eyebrow am-label">{L(c('ENTERPRISE ARCHITECTURE OPERATIONS', 'تشغيل البنية المؤسسية'))}</div>
              <h1 className="am-h1 lp-hero-title">{L(labels.heroTitle)}</h1>
              <p className="am-body-lg">{L(labels.heroBody)}</p>
              <div className="lp-hero-actions">
                <a className="am-btn am-btn-brand" href="#demo">{L(labels.requestDemo)} <Arrow /></a>
                <a className="am-btn am-btn-on-dark" href="#platform">{L(labels.explore)} <Arrow /></a>
              </div>
              <ul className="lp-trust-line">
                <li><Icon name="check" size={16} />{L(c('Built for complex organizations', 'مصممة للجهات ذات البيئات المعقدة'))}</li>
                <li><Icon name="check" size={16} />{L(c('Bilingual by design', 'ثنائية اللغة من الأساس'))}</li>
              </ul>
            </div>
            <ProductComposition locale={locale} />
          </div>
        </section>

        <section className="am-section lp-surface" aria-labelledby="problems-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('THE OPERATING CHALLENGE', 'تحديات التشغيل')} title={c('Move beyond disconnected architecture work', 'تجاوز العمل المعماري المتفرق')} body={c('Enterprise architecture creates value when information, governance, and transformation planning operate as one system.', 'تتحقق قيمة البنية المؤسسية عندما تعمل المعلومات والحوكمة وتخطيط التحول ضمن منظومة واحدة.')} L={L} id="problems-title" />
            <div className="lp-grid-4">{problems.map((item, index) => <article className="am-card" key={item.title.EN}><div className="lp-card-top"><span className="am-icon-tile"><Icon name={problemIcons[index]} /></span><span className="am-index">0{index + 1}</span></div><h3 className="am-h4">{L(item.title)}</h3><p className="am-body-sm">{L(item.body)}</p></article>)}</div>
            <div className="lp-answer"><BrandLogo size={20} /><p className="am-body-lg">{L(c('connects architecture definition, evidence, analysis, governance, and change in one operational environment.', 'تربط تعريف البنية المؤسسية وأدلتها وتحليلها وحوكمتها وتغييرها ضمن بيئة تشغيلية واحدة.'))}</p></div>
          </div>
        </section>

        <section className="am-section lp-subtle" id="platform" aria-labelledby="model-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('PLATFORM OPERATING MODEL', 'نموذج تشغيل المنصة')} title={c('From architecture language to measurable transformation', 'من اللغة المعمارية إلى تحول قابل للقياس')} body={c('A continuous operating rhythm for the enterprise architecture office.', 'مسار تشغيلي متكامل ومستمر لمكتب البنية المؤسسية.')} L={L} id="model-title" />
            <ol className="lp-flow">{operatingModel.map((item, index) => <li className="lp-flow-step" key={item.title.EN}><span className="lp-flow-num">{index + 1}</span><h3 className="am-h4">{L(item.title)}</h3><p className="am-body-sm">{L(item.body)}</p></li>)}</ol>
          </div>
        </section>

        <section className="am-section lp-surface" id="capabilities" aria-labelledby="capabilities-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('CONNECTED CAPABILITIES', 'قدرات مترابطة')} title={c('One platform for the architecture lifecycle', 'منصة واحدة لدورة حياة البنية المؤسسية')} body={c('Purpose-built capabilities connect architecture knowledge to governance and transformation work.', 'قدرات متخصصة تربط المعرفة المعمارية بأعمال الحوكمة والتحول.')} L={L} id="capabilities-title" />
            <div className="lp-grid-3">{capabilityGroups.map((group, index) => <article className="am-card interactive lp-capability" key={group.eyebrow.EN}><div className="lp-card-top"><span className="am-icon-tile"><Icon name={capabilityIcons[index]} /></span><span className="am-index">0{index + 1}</span></div><div className="am-label lp-capability-eyebrow">{L(group.eyebrow)}</div>{group.items.map((item) => <div className="lp-capability-item" key={item.title.EN}><h3 className="am-h5">{L(item.title)}</h3><p className="am-body-sm">{L(item.body)}</p></div>)}</article>)}</div>
          </div>
        </section>

        <section className="am-section lp-dark am-on-dark" id="ai-architects" aria-labelledby="ai-title">
          <BrandPattern variant="topology" intensity={0.28} />
          <div className="am-container lp-split">
            <SectionHeading eyebrow={c('AI-ASSISTED ARCHITECTURE', 'البنية المؤسسية بمساعدة الذكاء الاصطناعي')} title={c('Architecture Expertise, Augmented by AI', 'خبرة معمارية معززة بالذكاء الاصطناعي')} body={c('ArchMind helps architects explore information, analyze relationships, review designs, evaluate alternatives, and accelerate architecture activities—grounded in organizational architecture context and under human direction.', 'تساعد ArchMind المعماريين على استكشاف المعلومات وتحليل العلاقات ومراجعة التصاميم وتقييم البدائل وتسريع الأنشطة المعمارية، استناداً إلى السياق المعماري للجهة وتحت إشراف بشري.')} L={L} id="ai-title" align="start" />
            <div className="am-card am-card-dark lp-architects">
              <div className="lp-chief"><span className="am-icon-tile"><Icon name="architects" /></span><div><small className="am-label">{L(c('COORDINATING ROLE', 'دور تنسيقي'))}</small><strong className="am-h4">{L(architectRoles[0])}</strong></div></div>
              <ul className="lp-roles">{architectRoles.slice(1).map((role) => <li key={role.EN}><i aria-hidden="true" />{L(role)}</li>)}</ul>
              <p className="am-body-sm">{L(c('AI assistance supports professional judgment; architecture decisions remain with authorized people.', 'تدعم المساعدة الذكية الحكم المهني، بينما تبقى القرارات المعمارية بيد أصحاب الصلاحية.'))}</p>
            </div>
          </div>
        </section>

        <section className="am-section lp-surface" aria-labelledby="language-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('CONNECTED ARCHITECTURE', 'بنية مؤسسية مترابطة')} title={c('One Architecture Language. One Repository. Multiple Perspectives.', 'لغة معمارية موحدة، مستودع واحد، ومشاهد متعددة')} body={c('A governed chain from definition to insight.', 'سلسلة محكومة تبدأ بالتعريف وتنتهي بالرؤية المعمارية.')} L={L} id="language-title" />
            <div className="lp-chain">
              <FlowCard icon="framework" index="01" title={c('Meta Model', 'النموذج الوصفي')} body={c('Defines architecture building blocks, attributes, and relationships.', 'يعرّف اللبنات المعمارية والخصائص والعلاقات.')} L={L} />
              <ChainLink />
              <FlowCard icon="repository" index="02" title={c('EA Repository', 'مستودع البنية المؤسسية')} body={c("Stores the organization's actual architecture instances.", 'يحفظ النسخ الفعلية لأصول البنية المؤسسية في الجهة.')} L={L} />
              <ChainLink />
              <FlowCard icon="views" index="03" title={c('EA Views', 'المشاهد المعمارية')} body={c('Visualizes how objects relate, depend on one another, and evolve.', 'يُظهر ترابط العناصر واعتمادها على بعضها وكيفية تطورها.')} L={L} />
            </div>
          </div>
        </section>

        <section className="am-section lp-subtle" aria-labelledby="governance-title">
          <div className="am-container lp-split">
            <SectionHeading eyebrow={c('ARCHITECTURE GOVERNANCE', 'حوكمة البنية المؤسسية')} title={c('From Architecture Documents to Architecture Decisions', 'من الوثائق المعمارية إلى القرارات المعمارية')} body={c('Bring requests, organizational context, structured review, and evidence-based findings into a traceable decision flow.', 'اربط الطلبات والسياق المؤسسي والمراجعة المنظمة والنتائج المستندة إلى الأدلة ضمن مسار قرار قابل للتتبع.')} L={L} id="governance-title" align="start" />
            <ProcessRail items={[c('Architecture Request / Design', 'طلب أو تصميم معماري'), c('Architecture Context', 'السياق المعماري'), c('Structured Review', 'مراجعة منظمة'), c('Evidence-Based Findings', 'نتائج مستندة إلى الأدلة'), c('Architecture Decision', 'قرار معماري')]} L={L} />
          </div>
        </section>

        <section className="am-section lp-surface" aria-labelledby="transform-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('PLANNING & TRANSFORMATION', 'التخطيط والتحول')} title={c('Make architecture evolution visible', 'اجعل تطور البنية المؤسسية واضحاً')} body={c('Use scenarios and ADM planning to understand the path from today’s architecture to an intentional target state.', 'استخدم السيناريوهات وتخطيط ADM لفهم المسار من البنية الحالية إلى حالة مستهدفة مدروسة.')} L={L} id="transform-title" />
            <div className="lp-states">
              <State step={1} label={c('Current State', 'الحالة الحالية')} note={c('Document the architecture baseline', 'وثّق خط الأساس المعماري')} L={L} />
              <State step={2} label={c('Transition', 'الحالة الانتقالية')} note={c('Sequence controlled change', 'رتّب التغيير بصورة محكومة')} L={L} />
              <State step={3} label={c('Target State', 'الحالة المستهدفة')} note={c('Align toward intended outcomes', 'وجّه البنية نحو النتائج المستهدفة')} L={L} />
            </div>
          </div>
        </section>

        <section className="am-section lp-dark am-on-dark" id="frameworks" aria-labelledby="framework-title">
          <div className="am-container lp-split lp-framework">
            <div>
              <SectionHeading eyebrow={c('FRAMEWORK-DRIVEN', 'منهجية قائمة على الأطر')} title={c('Designed for Framework-Driven Enterprise Architecture', 'مصممة لتطبيق أطر البنية المؤسسية عملياً')} body={c('ArchMind supports configurable enterprise architecture meta models and is being developed with NORA 2.0 as a primary framework for Saudi government architecture environments.', 'تدعم ArchMind نماذج وصفية قابلة للتخصيص، ويتم تطويرها مع اعتماد NORA 2.0 كأحد الأطر الرئيسية لبيئات البنية المؤسسية في الجهات الحكومية السعودية.')} L={L} id="framework-title" align="start" />
              <p className="am-caption lp-framework-note">{L(c('Framework configuration supports NORA 2.0, TOGAF-oriented, and custom meta-model structures. No certification claim is implied.', 'تدعم تهيئة الأطر هياكل NORA 2.0 والهياكل الموجهة بمنهجية TOGAF والنماذج الوصفية المخصصة، دون الإشارة إلى أي اعتماد رسمي.'))}</p>
            </div>
            <div className="lp-framework-visual">
              <div className="lp-framework-row"><span>NORA 2.0</span><span>TOGAF</span><span>{L(c('CUSTOM', 'مخصص'))}</span></div>
              <div className="lp-framework-base">{L(c('Configurable architecture language', 'لغة معمارية قابلة للتهيئة'))}</div>
            </div>
          </div>
        </section>

        <section className="am-section lp-subtle" id="resources" aria-labelledby="readiness-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('ENTERPRISE READINESS', 'الجاهزية المؤسسية')} title={c('Designed for governed enterprise environments', 'مصممة لبيئات مؤسسية محكومة')} body={c('Platform controls support accountable architecture operations without making unsupported certification claims.', 'تدعم ضوابط المنصة تشغيل البنية المؤسسية بمساءلة ووضوح دون ادعاءات اعتماد غير مثبتة.')} L={L} id="readiness-title" />
            <ul className="lp-readiness">{[c('Multi-tenant architecture', 'بنية متعددة المستأجرين'), c('Tenant isolation', 'عزل بيانات الجهات'), c('Role-based access', 'وصول قائم على الأدوار'), c('Configurable AI provider and model', 'مزود ونموذج ذكاء اصطناعي قابلان للتهيئة'), c('Architecture-context-aware AI', 'ذكاء مدرك للسياق المعماري'), c('Structured architecture governance', 'حوكمة معمارية منظمة')].map((item) => <li key={item.EN}><span className="lp-check"><Icon name="check" size={16} /></span>{L(item)}</li>)}</ul>
          </div>
        </section>

        <section className="am-section lp-surface" id="customers" aria-labelledby="customers-title">
          <div className="am-container">
            <SectionHeading eyebrow={c('OUR CUSTOMERS', 'عملاؤنا')} title={c('Organizations operating enterprise architecture with ArchMind', 'جهات تشغّل بنيتها المؤسسية مع ArchMind')} body={c('Public-sector and enterprise architecture teams use ArchMind to run their architecture practice.', 'تعتمد فرق البنية المؤسسية في القطاع الحكومي والمؤسسات على ArchMind في تشغيل ممارساتها المعمارية.')} L={L} id="customers-title" />
            <ul className="lp-customers">{customers.map((customer) => <CustomerCard key={customer.id} customer={customer} L={L} />)}</ul>
          </div>
        </section>

        <section className="am-section lp-demo am-on-dark" id="demo" aria-labelledby="demo-title">
          <BrandPattern variant="flow" intensity={0.3} />
          <div className="am-container lp-demo-grid">
            <div>
              <div className="am-eyebrow am-label">{L(c('REQUEST A DEMONSTRATION', 'اطلب عرضاً توضيحياً'))}</div>
              <h2 className="am-h2" id="demo-title">{L(c('Ready to Operationalize Enterprise Architecture?', 'هل أنت مستعد لتفعيل البنية المؤسسية بشكل عملي؟'))}</h2>
              <p className="am-body-lg">{L(c('Tell us about your architecture environment and the outcomes you want to enable.', 'عرّفنا ببيئة البنية المؤسسية لديكم والنتائج التي تسعون إلى تحقيقها.'))}</p>
              <div className="lp-assurance"><Icon name="shield" size={20} /><span>{L(c('Your details are sent directly to the ArchMind team - no account required.', 'تُرسل بياناتك مباشرة إلى فريق ArchMind، دون الحاجة إلى إنشاء حساب.'))}</span></div>
            </div>
            <DemoForm locale={locale} errors={formErrors} requestDraft={requestDraft} copied={copied} submitting={submitting} submitted={submitted} onSubmit={submitDemo} onCopy={copyRequest} />
          </div>
        </section>
      </main>

      <footer className="lp-footer am-on-dark">
        <div className="am-container lp-footer-grid">
          <div className="lp-footer-brand">
            <BrandLogo href="#top" tone="reverse" size={22} label="ArchMind home" />
            <p className="am-body-sm">{L(c('Enterprise architecture, operated with intent.', 'تشغيل البنية المؤسسية بوضوح وفاعلية.'))}</p>
          </div>
          <nav className="lp-footer-col" aria-label={L(c('Product', 'المنتج'))}>
            <h2 className="am-label">{L(c('Product', 'المنتج'))}</h2>
            <a href="#platform">{L(c('Platform', 'المنصة'))}</a>
            <a href="#capabilities">{L(c('Capabilities', 'القدرات'))}</a>
            <a href="#frameworks">{L(c('Frameworks', 'الأطر'))}</a>
          </nav>
          <nav className="lp-footer-col" aria-label={L(c('Company', 'الشركة'))}>
            <h2 className="am-label">{L(c('Company', 'الشركة'))}</h2>
            <a href="#customers">{L(c('Customers', 'عملاؤنا'))}</a>
            <a href="#demo">{L(c('Contact', 'تواصل معنا'))}</a>
            <Link to="/login">{L(labels.signIn)}</Link>
          </nav>
          <div className="lp-footer-col">
            <h2 className="am-label">{L(c('Legal', 'قانوني'))}</h2>
            <span title={L(c('Legal page not yet published', 'الصفحة القانونية غير منشورة بعد'))}>{L(c('Privacy · Coming soon', 'الخصوصية · قريباً'))}</span>
            <span title={L(c('Legal page not yet published', 'الصفحة القانونية غير منشورة بعد'))}>{L(c('Terms · Coming soon', 'الشروط · قريباً'))}</span>
          </div>
        </div>
        <div className="am-container lp-footer-bottom">
          <span className="am-caption">© {new Date().getFullYear()} {BRAND_LEGAL_NAME}</span>
          <LanguageToggle locale={locale} onToggle={() => setLocale(locale === 'EN' ? 'AR' : 'EN')} />
        </div>
      </footer>
    </div>
  )
}

function Arrow() { return <span className="am-arrow" aria-hidden="true">→</span> }

function LanguageToggle({ locale, onToggle, label }: { locale: 'EN' | 'AR'; onToggle: () => void; label?: string }) {
  return <button type="button" className="lp-lang" onClick={onToggle} aria-label={label}><Icon name="globe" size={16} /><span className={locale === 'EN' ? 'active' : ''} lang="en">EN</span><i aria-hidden="true" /><span className={locale === 'AR' ? 'active' : ''} lang="ar">العربية</span></button>
}

function SectionHeading({ eyebrow, title, body, L, id, align = 'center' }: { eyebrow: Copy; title: Copy; body: Copy; L: (copy: Copy) => string; id: string; align?: 'center' | 'start' }) {
  return <div className={`am-section-header ${align === 'center' ? 'center' : ''}`}><div className="am-eyebrow am-label">{L(eyebrow)}</div><h2 className="am-h2" id={id}>{L(title)}</h2><p>{L(body)}</p></div>
}

function ProductComposition({ locale }: { locale: 'EN' | 'AR' }) {
  const L = (copy: Copy) => copy[locale]
  return <div className="lp-product" role="img" aria-label={L(c('ArchMind platform interface composition', 'تصور لواجهة منصة ArchMind'))}>
    <div className="lp-product-bar" aria-hidden="true"><BrandLogo size={10} /><i /><i /><i /></div>
    <div className="lp-product-body" aria-hidden="true">
      <aside><b /><b /><b className="active" /><b /><b /></aside>
      <div className="lp-product-canvas">
        <div className="lp-canvas-head"><div><small>{L(c('ARCHITECTURE OVERVIEW', 'نظرة عامة على البنية'))}</small><strong>{L(c('Operational architecture workspace', 'مساحة العمل المعمارية'))}</strong></div><span>{L(c('Current state', 'الحالة الحالية'))}</span></div>
        <div className="lp-metrics"><div><small>{L(c('Repository', 'المستودع'))}</small><strong>248</strong><em>+12</em></div><div><small>{L(c('Views', 'المشاهد'))}</small><strong>36</strong><em>Live</em></div><div><small>{L(c('Reviews', 'المراجعات'))}</small><strong>08</strong><em>Active</em></div></div>
        <div className="lp-canvas-lower">
          <div className="lp-map"><div className="lp-card-label">{L(c('EA VIEW · DEPENDENCY MAP', 'مشهد الاعتماديات'))}</div><div className="lp-node n1">B</div><div className="lp-node n2">A</div><div className="lp-node n3">D</div><div className="lp-node n4">T</div><svg viewBox="0 0 300 150"><path d="M52 38 C100 30 115 70 155 74 M155 74 C200 75 210 35 255 43 M155 74 C180 105 205 118 252 116" /></svg></div>
          <div className="lp-ai"><div className="lp-ai-head"><span>AI</span><div><small>{L(c('CHIEF ARCHITECT', 'المعماري الرئيسي'))}</small><strong>{L(c('Architecture insight', 'رؤية معمارية'))}</strong></div></div><p>{L(c('Three applications support overlapping capabilities. Review consolidation options before the target-state transition.', 'تدعم ثلاثة تطبيقات قدرات متداخلة. راجع خيارات التوحيد قبل الانتقال إلى الحالة المستهدفة.'))}</p><div className="lp-ai-source">{L(c('Grounded in 14 architecture records', 'مستند إلى 14 سجلاً معمارياً'))}</div></div>
        </div>
      </div>
    </div>
  </div>
}

function CustomerCard({ customer, L }: { customer: Customer; L: (copy: Copy) => string }) {
  const [logoFailed, setLogoFailed] = useState(false)
  const showLogo = !!customer.logo && !logoFailed
  const name = <>{L(customer.name)}{customer.shortName && <span className="lp-customer-short"> ({L(customer.shortName)})</span>}</>
  return <li className={`am-card lp-customer${showLogo ? ' has-logo' : ''}`}>
    {showLogo
      ? <img className="lp-customer-logo" src={customer.logo} alt={`${L(customer.name)} logo`} onError={() => setLogoFailed(true)} />
      : <span className="lp-customer-mark" aria-hidden="true">{customer.shortName ? L(customer.shortName) : ''}</span>}
    <div className="lp-customer-body">
      <h3 className={showLogo ? 'am-visually-hidden' : 'am-h5'}>{name}</h3>
      <p className="am-body-sm">{L(customer.sector)}</p>
    </div>
  </li>
}

function ChainLink() { return <div className="lp-chain-link" aria-hidden="true"><i className="lp-chain-line" /><Arrow /></div> }
function FlowCard({ icon, index, title, body, L }: { icon: IconName; index: string; title: Copy; body: Copy; L: (copy: Copy) => string }) { return <article className="am-card am-card-accent"><div className="lp-card-top"><span className="am-icon-tile"><Icon name={icon} /></span><span className="am-index">{index}</span></div><h3 className="am-h3">{L(title)}</h3><p>{L(body)}</p></article> }
function State({ step, label, note, L }: { step: number; label: Copy; note: Copy; L: (copy: Copy) => string }) { return <div className={`lp-state s${step}`}><div className="lp-state-bars" aria-hidden="true"><i /><i /><i /></div><strong className="am-h4">{L(label)}</strong><span className="am-body-sm">{L(note)}</span></div> }
function ProcessRail({ items, L }: { items: Copy[]; L: (copy: Copy) => string }) { return <ol className="lp-rail">{items.map((item, index) => <li key={item.EN}><span>{index + 1}</span><strong>{L(item)}</strong></li>)}</ol> }

function DemoForm({ locale, errors, requestDraft, copied, submitting, submitted, onSubmit, onCopy }: { locale: 'EN' | 'AR'; errors: Record<string, string>; requestDraft: string; copied: boolean; submitting: boolean; submitted: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCopy: () => void }) {
  const L = (copy: Copy) => copy[locale]
  const field = (name: string, label: Copy, type = 'text', optional = false, autoComplete?: string) => <label className="am-field"><span>{L(label)}{optional && <small> {L(c('(optional)', '(اختياري)'))}</small>}</span><input className="am-input" name={name} type={type} autoComplete={autoComplete} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />{errors[name] && <em className="am-field-error" id={`${name}-error`}>{errors[name]}</em>}</label>
  if (submitted) return <div className="lp-form lp-form-done" role="status"><span className="lp-done-mark"><Icon name="check" size={26} /></span><h3 className="am-h3">{L(c('Thank you', 'شكراً لك'))}</h3><p>{L(c('Your request has been received. An ArchMind representative will be in touch shortly.', 'تم استلام طلبك. سيتواصل معك أحد ممثلي ArchMind قريباً.'))}</p></div>
  if (requestDraft) return <div className="lp-form lp-form-done" role="status"><span className="lp-done-mark"><Icon name="check" size={26} /></span><h3 className="am-h3">{L(c('Your request is ready', 'طلبك جاهز'))}</h3><p>{L(c("We couldn't submit this automatically. Copy the prepared details and share them with your ArchMind representative.", 'تعذّر إرسال الطلب تلقائياً. انسخ تفاصيل الطلب وشاركها مع ممثل ArchMind.'))}</p><button className="am-btn am-btn-primary" type="button" onClick={onCopy}>{copied ? L(c('Copied', 'تم النسخ')) : L(c('Copy request details', 'نسخ تفاصيل الطلب'))}</button></div>
  return <form className="lp-form" noValidate onSubmit={onSubmit}>
    <div className="lp-form-grid">{field('fullName', c('Full Name', 'الاسم الكامل'), 'text', false, 'name')}{field('organization', c('Organization', 'الجهة'), 'text', false, 'organization')}{field('jobTitle', c('Job Title', 'المسمى الوظيفي'), 'text', false, 'organization-title')}{field('email', c('Work Email', 'البريد الإلكتروني للعمل'), 'email', false, 'email')}{field('phone', c('Phone', 'رقم الهاتف'), 'tel', true, 'tel')}<label className="am-field"><span>{L(c('Country', 'الدولة'))}</span><select className="am-input" name="country" defaultValue="Saudi Arabia" aria-invalid={!!errors.country}><option>Saudi Arabia</option><option>United Arab Emirates</option><option>Bahrain</option><option>Kuwait</option><option>Oman</option><option>Qatar</option><option>{L(c('Other', 'أخرى'))}</option></select>{errors.country && <em className="am-field-error">{errors.country}</em>}</label></div>
    <label className="am-field"><span>{L(c('Message', 'الرسالة'))}</span><textarea className="am-input" name="message" rows={4} aria-invalid={!!errors.message} aria-describedby={errors.message ? 'message-error' : undefined} placeholder={L(c('Tell us about your architecture priorities…', 'حدثنا عن أولويات البنية المؤسسية لديكم…'))} />{errors.message && <em className="am-field-error" id="message-error">{errors.message}</em>}</label>
    <fieldset className="lp-fieldset"><legend className="am-field-label">{L(c('Preferred Language', 'اللغة المفضلة'))}</legend><label className="lp-radio"><input type="radio" name="preferredLanguage" value="English" defaultChecked={locale === 'EN'} /> English</label><label className="lp-radio"><input type="radio" name="preferredLanguage" value="Arabic" defaultChecked={locale === 'AR'} /> العربية</label>{errors.preferredLanguage && <em className="am-field-error">{errors.preferredLanguage}</em>}</fieldset>
    <button className="am-btn am-btn-primary block" type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? L(c('Sending…', 'جارٍ الإرسال…')) : <>{L(labels.requestDemo)} <Arrow /></>}</button>
  </form>
}
