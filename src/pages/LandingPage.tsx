import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LangContext'
import './LandingPage.css'

type Copy = { EN: string; AR: string }
type LocalizedItem = { title: Copy; body: Copy }

const c = (EN: string, AR: string): Copy => ({ EN, AR })

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

const navItems = [
  { href: '#platform', label: c('Platform', 'المنصة') },
  { href: '#capabilities', label: c('Capabilities', 'القدرات') },
  { href: '#ai-architects', label: c('AI Architects', 'المعماريون الأذكياء') },
  { href: '#frameworks', label: c('Frameworks', 'الأطر') },
  { href: '#resources', label: c('Resources', 'الموارد') },
]

const labels = {
  heroTitle: c('Operate Enterprise Architecture with Clarity, Control, and Intelligence', 'تشغيل البنية المؤسسية بوضوح وحوكمة وذكاء'),
  heroBody: c('ArqOps brings enterprise architecture modeling, repository management, architecture views, governance, planning, assessments, and AI-assisted architecture into one integrated platform.', 'تجمع ArqOps نمذجة البنية المؤسسية، وإدارة مستودع الأصول المعمارية، والمشاهد المعمارية، والحوكمة، والتخطيط، والتقييمات، والمساعدة الذكية في منصة متكاملة واحدة.'),
  requestDemo: c('Request a Demo', 'اطلب عرضاً توضيحياً'),
  explore: c('Explore ArqOps', 'استكشف ArqOps'),
  signIn: c('Sign In', 'تسجيل الدخول'),
}

function Arrow() { return <span className="arq-arrow" aria-hidden="true">→</span> }

export default function LandingPage() {
  const { locale, setLocale } = useLang()
  const L = (value: Copy) => value[locale]
  const [menuOpen, setMenuOpen] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [requestDraft, setRequestDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const seo = useMemo(() => locale === 'AR' ? {
    title: 'ArqOps | منصة تشغيل البنية المؤسسية',
    description: 'شغّل البنية المؤسسية من خلال نمذجة متكاملة، ومستودع معماري، ومشاهد، وحوكمة، وتخطيط، وتقييمات، ومساعدة ذكية.',
    ogLocale: 'ar_SA',
  } : {
    title: 'ArqOps | Enterprise Architecture Operations Platform',
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
  }, [seo])

  const submitDemo = (event: FormEvent<HTMLFormElement>) => {
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
    setRequestDraft([
      'ArqOps demo request',
      `Name: ${data.get('fullName')}`,
      `Organization: ${data.get('organization')}`,
      `Job title: ${data.get('jobTitle')}`,
      `Work email: ${data.get('email')}`,
      `Phone: ${data.get('phone') || '—'}`,
      `Country: ${data.get('country')}`,
      `Preferred language: ${data.get('preferredLanguage')}`,
      `Message: ${data.get('message')}`,
    ].join('\n'))
  }

  const copyRequest = async () => {
    await navigator.clipboard.writeText(requestDraft)
    setCopied(true)
  }

  return (
    <div className="arq-site" data-locale={locale}>
      <a className="arq-skip" href="#main">{L(c('Skip to content', 'انتقل إلى المحتوى'))}</a>
      <header className="arq-nav-wrap">
        <nav className="arq-nav" aria-label={L(c('Primary navigation', 'التنقل الرئيسي'))}>
          <a className="arq-brand" href="#top" aria-label="ArqOps home"><span className="arq-mark">A</span><span>ArqOps</span></a>
          <button className="arq-menu-button" aria-label={L(c('Open navigation', 'فتح قائمة التنقل'))} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
          <div className={`arq-nav-panel${menuOpen ? ' open' : ''}`}>
            <div className="arq-nav-links">
              {navItems.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{L(item.label)}</a>)}
            </div>
            <div className="arq-nav-actions">
              <button className="arq-lang" onClick={() => setLocale(locale === 'EN' ? 'AR' : 'EN')} aria-label={L(c('Switch to Arabic', 'التبديل إلى الإنجليزية'))}><span className={locale === 'EN' ? 'active' : ''}>EN</span><i /> <span className={locale === 'AR' ? 'active' : ''}>العربية</span></button>
              <Link className="arq-signin" to="/login">{L(labels.signIn)}</Link>
              <a className="arq-button small" href="#demo">{L(labels.requestDemo)}</a>
            </div>
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="arq-hero" id="top">
          <div className="arq-orbit arq-orbit-one" /><div className="arq-orbit arq-orbit-two" />
          <div className="arq-container arq-hero-grid">
            <div className="arq-hero-copy">
              <div className="arq-kicker"><span />{L(c('ENTERPRISE ARCHITECTURE OPERATIONS', 'تشغيل البنية المؤسسية'))}</div>
              <h1>{L(labels.heroTitle)}</h1>
              <p>{L(labels.heroBody)}</p>
              <div className="arq-hero-actions"><a className="arq-button" href="#demo">{L(labels.requestDemo)} <Arrow /></a><a className="arq-text-link" href="#platform">{L(labels.explore)} <Arrow /></a></div>
              <div className="arq-trust-line"><span>{L(c('Built for complex organizations', 'مصممة للجهات ذات البيئات المعقدة'))}</span><span>{L(c('Bilingual by design', 'ثنائية اللغة من الأساس'))}</span></div>
            </div>
            <ProductComposition locale={locale} />
          </div>
        </section>

        <section className="arq-section arq-problems" aria-labelledby="problems-title">
          <div className="arq-container">
            <SectionHeading eyebrow={c('THE OPERATING CHALLENGE', 'تحديات التشغيل')} title={c('Move beyond disconnected architecture work', 'تجاوز العمل المعماري المتفرق')} body={c('Enterprise architecture creates value when information, governance, and transformation planning operate as one system.', 'تتحقق قيمة البنية المؤسسية عندما تعمل المعلومات والحوكمة وتخطيط التحول ضمن منظومة واحدة.')} L={L} id="problems-title" />
            <div className="arq-problem-grid">{problems.map((item, index) => <article key={item.title.EN}><span>0{index + 1}</span><h3>{L(item.title)}</h3><p>{L(item.body)}</p></article>)}</div>
            <div className="arq-answer"><strong>ArqOps</strong><span>{L(c('connects architecture definition, evidence, analysis, governance, and change in one operational environment.', 'تربط تعريف البنية المؤسسية وأدلتها وتحليلها وحوكمتها وتغييرها ضمن بيئة تشغيلية واحدة.'))}</span></div>
          </div>
        </section>

        <section className="arq-section arq-model-section" id="platform" aria-labelledby="model-title">
          <div className="arq-container">
            <SectionHeading eyebrow={c('PLATFORM OPERATING MODEL', 'نموذج تشغيل المنصة')} title={c('From architecture language to measurable transformation', 'من اللغة المعمارية إلى تحول قابل للقياس')} body={c('A continuous operating rhythm for the enterprise architecture office.', 'مسار تشغيلي متكامل ومستمر لمكتب البنية المؤسسية.')} L={L} id="model-title" />
            <div className="arq-operating-flow">{operatingModel.map((item, index) => <div className="arq-flow-step" key={item.title.EN}><div><span>{index + 1}</span></div><h3>{L(item.title)}</h3><p>{L(item.body)}</p>{index < operatingModel.length - 1 && <Arrow />}</div>)}</div>
          </div>
        </section>

        <section className="arq-section" id="capabilities" aria-labelledby="capabilities-title">
          <div className="arq-container">
            <SectionHeading eyebrow={c('CONNECTED CAPABILITIES', 'قدرات مترابطة')} title={c('One platform for the architecture lifecycle', 'منصة واحدة لدورة حياة البنية المؤسسية')} body={c('Purpose-built capabilities connect architecture knowledge to governance and transformation work.', 'قدرات متخصصة تربط المعرفة المعمارية بأعمال الحوكمة والتحول.')} L={L} id="capabilities-title" />
            <div className="arq-capability-grid">{capabilityGroups.map((group, index) => <article className="arq-capability" key={group.eyebrow.EN}><div className="arq-capability-top"><span>0{index + 1}</span><p>{L(group.eyebrow)}</p></div>{group.items.map((item) => <div className="arq-capability-item" key={item.title.EN}><h3>{L(item.title)}</h3><p>{L(item.body)}</p></div>)}</article>)}</div>
          </div>
        </section>

        <section className="arq-section arq-ai-section" id="ai-architects" aria-labelledby="ai-title">
          <div className="arq-container arq-ai-grid">
            <div><SectionHeading eyebrow={c('AI-ASSISTED ARCHITECTURE', 'البنية المؤسسية بمساعدة الذكاء الاصطناعي')} title={c('Architecture Expertise, Augmented by AI', 'خبرة معمارية معززة بالذكاء الاصطناعي')} body={c('ArqOps helps architects explore information, analyze relationships, review designs, evaluate alternatives, and accelerate architecture activities—grounded in organizational architecture context and under human direction.', 'تساعد ArqOps المعماريين على استكشاف المعلومات وتحليل العلاقات ومراجعة التصاميم وتقييم البدائل وتسريع الأنشطة المعمارية، استناداً إلى السياق المعماري للجهة وتحت إشراف بشري.')} L={L} id="ai-title" align="start" /></div>
            <div className="arq-architect-panel"><div className="arq-chief"><span>A</span><div><small>{L(c('COORDINATING ROLE', 'دور تنسيقي'))}</small><strong>{L(architectRoles[0])}</strong></div></div><div className="arq-role-grid">{architectRoles.slice(1).map((role) => <div key={role.EN}><i />{L(role)}</div>)}</div><p>{L(c('AI assistance supports professional judgment; architecture decisions remain with authorized people.', 'تدعم المساعدة الذكية الحكم المهني، بينما تبقى القرارات المعمارية بيد أصحاب الصلاحية.'))}</p></div>
          </div>
        </section>

        <section className="arq-section arq-language-section" aria-labelledby="language-title">
          <div className="arq-container"><SectionHeading eyebrow={c('CONNECTED ARCHITECTURE', 'بنية مؤسسية مترابطة')} title={c('One Architecture Language. One Repository. Multiple Perspectives.', 'لغة معمارية موحدة، مستودع واحد، ومشاهد متعددة')} body={c('A governed chain from definition to insight.', 'سلسلة محكومة تبدأ بالتعريف وتنتهي بالرؤية المعمارية.')} L={L} id="language-title" />
            <div className="arq-stack-flow"><FlowCard index="01" title={c('Meta Model', 'النموذج الوصفي')} body={c('Defines architecture building blocks, attributes, and relationships.', 'يعرّف اللبنات المعمارية والخصائص والعلاقات.')} L={L} /><Arrow /><FlowCard index="02" title={c('EA Repository', 'مستودع البنية المؤسسية')} body={c("Stores the organization's actual architecture instances.", 'يحفظ النسخ الفعلية لأصول البنية المؤسسية في الجهة.')} L={L} /><Arrow /><FlowCard index="03" title={c('EA Views', 'المشاهد المعمارية')} body={c('Visualizes how objects relate, depend on one another, and evolve.', 'يُظهر ترابط العناصر واعتمادها على بعضها وكيفية تطورها.')} L={L} /></div>
          </div>
        </section>

        <section className="arq-section arq-governance-section" aria-labelledby="governance-title">
          <div className="arq-container arq-split"><div><SectionHeading eyebrow={c('ARCHITECTURE GOVERNANCE', 'حوكمة البنية المؤسسية')} title={c('From Architecture Documents to Architecture Decisions', 'من الوثائق المعمارية إلى القرارات المعمارية')} body={c('Bring requests, organizational context, structured review, and evidence-based findings into a traceable decision flow.', 'اربط الطلبات والسياق المؤسسي والمراجعة المنظمة والنتائج المستندة إلى الأدلة ضمن مسار قرار قابل للتتبع.')} L={L} id="governance-title" align="start" /></div><ProcessRail items={[c('Architecture Request / Design', 'طلب أو تصميم معماري'), c('Architecture Context', 'السياق المعماري'), c('Structured Review', 'مراجعة منظمة'), c('Evidence-Based Findings', 'نتائج مستندة إلى الأدلة'), c('Architecture Decision', 'قرار معماري')]} L={L} /></div>
        </section>

        <section className="arq-section arq-transform-section" aria-labelledby="transform-title">
          <div className="arq-container"><SectionHeading eyebrow={c('PLANNING & TRANSFORMATION', 'التخطيط والتحول')} title={c('Make architecture evolution visible', 'اجعل تطور البنية المؤسسية واضحاً')} body={c('Use scenarios and ADM planning to understand the path from today’s architecture to an intentional target state.', 'استخدم السيناريوهات وتخطيط ADM لفهم المسار من البنية الحالية إلى حالة مستهدفة مدروسة.')} L={L} id="transform-title" />
            <div className="arq-state-track"><State label={c('Current State', 'الحالة الحالية')} note={c('Document the architecture baseline', 'وثّق خط الأساس المعماري')} L={L} /><Arrow /><State label={c('Transition', 'الحالة الانتقالية')} note={c('Sequence controlled change', 'رتّب التغيير بصورة محكومة')} L={L} /><Arrow /><State label={c('Target State', 'الحالة المستهدفة')} note={c('Align toward intended outcomes', 'وجّه البنية نحو النتائج المستهدفة')} L={L} /></div>
          </div>
        </section>

        <section className="arq-section arq-framework-section" id="frameworks" aria-labelledby="framework-title">
          <div className="arq-container arq-framework-grid"><div><SectionHeading eyebrow={c('FRAMEWORK-DRIVEN', 'منهجية قائمة على الأطر')} title={c('Designed for Framework-Driven Enterprise Architecture', 'مصممة لتطبيق أطر البنية المؤسسية عملياً')} body={c('ArqOps supports configurable enterprise architecture meta models and is being developed with NORA 2.0 as a primary framework for Saudi government architecture environments.', 'تدعم ArqOps نماذج وصفية قابلة للتخصيص، ويتم تطويرها مع اعتماد NORA 2.0 كأحد الأطر الرئيسية لبيئات البنية المؤسسية في الجهات الحكومية السعودية.')} L={L} id="framework-title" align="start" /><p className="arq-framework-note">{L(c('Framework configuration supports NORA 2.0, TOGAF-oriented, and custom meta-model structures. No certification claim is implied.', 'تدعم تهيئة الأطر هياكل NORA 2.0 والهياكل الموجهة بمنهجية TOGAF والنماذج الوصفية المخصصة، دون الإشارة إلى أي اعتماد رسمي.'))}</p></div><div className="arq-framework-visual"><span>NORA 2.0</span><span>TOGAF</span><span>{L(c('CUSTOM', 'مخصص'))}</span><div>{L(c('Configurable architecture language', 'لغة معمارية قابلة للتهيئة'))}</div></div></div>
        </section>

        <section className="arq-section arq-readiness" id="resources" aria-labelledby="readiness-title">
          <div className="arq-container"><SectionHeading eyebrow={c('ENTERPRISE READINESS', 'الجاهزية المؤسسية')} title={c('Designed for governed enterprise environments', 'مصممة لبيئات مؤسسية محكومة')} body={c('Platform controls support accountable architecture operations without making unsupported certification claims.', 'تدعم ضوابط المنصة تشغيل البنية المؤسسية بمساءلة ووضوح دون ادعاءات اعتماد غير مثبتة.')} L={L} id="readiness-title" />
            <div className="arq-readiness-grid">{[c('Multi-tenant architecture', 'بنية متعددة المستأجرين'), c('Tenant isolation', 'عزل بيانات الجهات'), c('Role-based access', 'وصول قائم على الأدوار'), c('Configurable AI provider and model', 'مزود ونموذج ذكاء اصطناعي قابلان للتهيئة'), c('Architecture-context-aware AI', 'ذكاء مدرك للسياق المعماري'), c('Structured architecture governance', 'حوكمة معمارية منظمة')].map((item) => <div key={item.EN}><span>✓</span>{L(item)}</div>)}</div>
          </div>
        </section>

        <section className="arq-demo" id="demo" aria-labelledby="demo-title">
          <div className="arq-container arq-demo-grid"><div><div className="arq-kicker light"><span />{L(c('REQUEST A DEMONSTRATION', 'اطلب عرضاً توضيحياً'))}</div><h2 id="demo-title">{L(c('Ready to Operationalize Enterprise Architecture?', 'هل أنت مستعد لتفعيل البنية المؤسسية بشكل عملي؟'))}</h2><p>{L(c('Tell us about your architecture environment and the outcomes you want to enable.', 'عرّفنا ببيئة البنية المؤسسية لديكم والنتائج التي تسعون إلى تحقيقها.'))}</p><div className="arq-demo-assurance">{L(c('This MVP form prepares your request locally. It does not transmit or store your information.', 'يجهّز هذا النموذج الأولي طلبك محلياً، ولا يرسل معلوماتك أو يخزنها.'))}</div></div><DemoForm locale={locale} errors={formErrors} requestDraft={requestDraft} copied={copied} onSubmit={submitDemo} onCopy={copyRequest} /></div>
        </section>
      </main>

      <footer className="arq-footer"><div className="arq-container arq-footer-grid"><div><a className="arq-brand footer" href="#top"><span className="arq-mark">A</span><span>ArqOps</span></a><p>{L(c('Enterprise architecture, operated with intent.', 'تشغيل البنية المؤسسية بوضوح وفاعلية.'))}</p></div><div className="arq-footer-links"><a href="#platform">{L(c('Platform', 'المنصة'))}</a><a href="#capabilities">{L(c('Capabilities', 'القدرات'))}</a><a href="#frameworks">{L(c('Frameworks', 'الأطر'))}</a><span title={L(c('Legal page not yet published', 'الصفحة القانونية غير منشورة بعد'))}>{L(c('Privacy · Coming soon', 'الخصوصية · قريباً'))}</span><span title={L(c('Legal page not yet published', 'الصفحة القانونية غير منشورة بعد'))}>{L(c('Terms · Coming soon', 'الشروط · قريباً'))}</span><a href="#demo">{L(c('Contact', 'تواصل معنا'))}</a><Link to="/login">{L(labels.signIn)}</Link></div><button className="arq-lang footer" onClick={() => setLocale(locale === 'EN' ? 'AR' : 'EN')}><span className={locale === 'EN' ? 'active' : ''}>EN</span><i /><span className={locale === 'AR' ? 'active' : ''}>العربية</span></button></div><div className="arq-container arq-copyright">© {new Date().getFullYear()} ArqOps</div></footer>
    </div>
  )
}

function SectionHeading({ eyebrow, title, body, L, id, align = 'center' }: { eyebrow: Copy; title: Copy; body: Copy; L: (copy: Copy) => string; id: string; align?: 'center' | 'start' }) {
  return <div className={`arq-section-heading ${align}`}><div className="arq-kicker"><span />{L(eyebrow)}</div><h2 id={id}>{L(title)}</h2><p>{L(body)}</p></div>
}

function ProductComposition({ locale }: { locale: 'EN' | 'AR' }) {
  const L = (copy: Copy) => copy[locale]
  return <div className="arq-product" aria-label={L(c('ArqOps platform interface composition', 'تصور لواجهة منصة ArqOps'))}><div className="arq-product-bar"><div className="arq-mini-mark">A</div><span>ArqOps</span><i /><i /><i /></div><div className="arq-product-body"><aside><b /><b /><b className="active" /><b /><b /></aside><div className="arq-product-canvas"><div className="arq-canvas-head"><div><small>{L(c('ARCHITECTURE OVERVIEW', 'نظرة عامة على البنية'))}</small><strong>{L(c('Operational architecture workspace', 'مساحة العمل المعمارية'))}</strong></div><span>{L(c('Current state', 'الحالة الحالية'))}</span></div><div className="arq-metric-row"><div><small>{L(c('Repository', 'المستودع'))}</small><strong>248</strong><em>+12</em></div><div><small>{L(c('Views', 'المشاهد'))}</small><strong>36</strong><em>Live</em></div><div><small>{L(c('Reviews', 'المراجعات'))}</small><strong>08</strong><em>Active</em></div></div><div className="arq-canvas-lower"><div className="arq-map-card"><div className="arq-card-label">{L(c('EA VIEW · DEPENDENCY MAP', 'مشهد الاعتماديات'))}</div><div className="arq-node n1">B</div><div className="arq-node n2">A</div><div className="arq-node n3">D</div><div className="arq-node n4">T</div><svg viewBox="0 0 300 150" aria-hidden="true"><path d="M52 38 C100 30 115 70 155 74 M155 74 C200 75 210 35 255 43 M155 74 C180 105 205 118 252 116" /></svg></div><div className="arq-ai-card"><div className="arq-ai-head"><span>AI</span><div><small>{L(c('CHIEF ARCHITECT', 'المعماري الرئيسي'))}</small><strong>{L(c('Architecture insight', 'رؤية معمارية'))}</strong></div></div><p>{L(c('Three applications support overlapping capabilities. Review consolidation options before the target-state transition.', 'تدعم ثلاثة تطبيقات قدرات متداخلة. راجع خيارات التوحيد قبل الانتقال إلى الحالة المستهدفة.'))}</p><div className="arq-ai-source">{L(c('Grounded in 14 architecture records', 'مستند إلى 14 سجلاً معمارياً'))}</div></div></div></div></div></div>
}

function FlowCard({ index, title, body, L }: { index: string; title: Copy; body: Copy; L: (copy: Copy) => string }) { return <article><span>{index}</span><h3>{L(title)}</h3><p>{L(body)}</p></article> }
function State({ label, note, L }: { label: Copy; note: Copy; L: (copy: Copy) => string }) { return <div className="arq-state"><div><i /><i /><i /></div><strong>{L(label)}</strong><span>{L(note)}</span></div> }
function ProcessRail({ items, L }: { items: Copy[]; L: (copy: Copy) => string }) { return <div className="arq-process-rail">{items.map((item, index) => <div key={item.EN}><span>{index + 1}</span><strong>{L(item)}</strong></div>)}</div> }

function DemoForm({ locale, errors, requestDraft, copied, onSubmit, onCopy }: { locale: 'EN' | 'AR'; errors: Record<string, string>; requestDraft: string; copied: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCopy: () => void }) {
  const L = (copy: Copy) => copy[locale]
  const field = (name: string, label: Copy, type = 'text', optional = false) => <label><span>{L(label)}{optional && <small> {L(c('(optional)', '(اختياري)'))}</small>}</span><input name={name} type={type} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${name}-error` : undefined} />{errors[name] && <em id={`${name}-error`}>{errors[name]}</em>}</label>
  if (requestDraft) return <div className="arq-demo-form arq-demo-ready"><span className="arq-ready-mark">✓</span><h3>{L(c('Your request is ready', 'طلبك جاهز'))}</h3><p>{L(c('Online submission is not connected yet. Copy the prepared details and share them with your ArqOps representative.', 'الإرسال الإلكتروني غير متصل حالياً. انسخ تفاصيل الطلب وشاركها مع ممثل ArqOps.'))}</p><button className="arq-button" type="button" onClick={onCopy}>{copied ? L(c('Copied', 'تم النسخ')) : L(c('Copy request details', 'نسخ تفاصيل الطلب'))}</button></div>
  return <form className="arq-demo-form" noValidate onSubmit={onSubmit}>
    <div className="arq-form-grid">{field('fullName', c('Full Name', 'الاسم الكامل'))}{field('organization', c('Organization', 'الجهة'))}{field('jobTitle', c('Job Title', 'المسمى الوظيفي'))}{field('email', c('Work Email', 'البريد الإلكتروني للعمل'), 'email')}{field('phone', c('Phone', 'رقم الهاتف'), 'tel', true)}<label><span>{L(c('Country', 'الدولة'))}</span><select name="country" defaultValue="Saudi Arabia" aria-invalid={!!errors.country}><option>Saudi Arabia</option><option>United Arab Emirates</option><option>Bahrain</option><option>Kuwait</option><option>Oman</option><option>Qatar</option><option>{L(c('Other', 'أخرى'))}</option></select>{errors.country && <em>{errors.country}</em>}</label></div>
    <label><span>{L(c('Message', 'الرسالة'))}</span><textarea name="message" rows={4} aria-invalid={!!errors.message} placeholder={L(c('Tell us about your architecture priorities…', 'حدثنا عن أولويات البنية المؤسسية لديكم…'))} />{errors.message && <em>{errors.message}</em>}</label>
    <fieldset><legend>{L(c('Preferred Language', 'اللغة المفضلة'))}</legend><label className="arq-radio"><input type="radio" name="preferredLanguage" value="English" defaultChecked={locale === 'EN'} /> English</label><label className="arq-radio"><input type="radio" name="preferredLanguage" value="Arabic" defaultChecked={locale === 'AR'} /> العربية</label>{errors.preferredLanguage && <em>{errors.preferredLanguage}</em>}</fieldset>
    <button className="arq-button form-submit" type="submit">{L(labels.requestDemo)} <Arrow /></button>
  </form>
}
