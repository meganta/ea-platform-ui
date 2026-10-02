/**
 * Test helper: finds UI text in the wrong language.
 *
 * An English UI must show no Arabic and an Arabic UI no English, except for
 * the strings a test explicitly allows (tenant data such as names, and
 * acronyms/product names like NORA, TOGAF, PDF). Visible text, option labels
 * and the placeholder / title / aria-label attributes are all checked.
 */
const ARABIC = /[؀-ۿ]/
const LATIN_WORD = /[A-Za-z]{2,}/

export function findLanguageLeaks(root: HTMLElement, uiLanguage: 'en' | 'ar', allow: (string | RegExp)[] = []): string[] {
  const leaks = new Set<string>()
  // Longest strings first, so 'Cloud first' is removed before 'Cloud'.
  const ordered = [...allow].sort((a, b) => (typeof b === 'string' ? b.length : 0) - (typeof a === 'string' ? a.length : 0))
  const strip = (text: string) => ordered.reduce<string>((acc, a) => (typeof a === 'string' ? acc.split(a).join(' ') : acc.replace(new RegExp(a.source, a.flags.includes('g') ? a.flags : a.flags + 'g'), ' ')), text)
  const wrong = (text: string) => {
    const rest = strip(text)
    return uiLanguage === 'en' ? ARABIC.test(rest) : LATIN_WORD.test(rest)
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = (node.textContent || '').trim()
    const parent = node.parentElement
    const hidden = parent?.closest('script,style')
    if (text && !hidden && wrong(text)) leaks.add(text)
    node = walker.nextNode()
  }
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(el => {
    for (const attr of ['placeholder', 'title', 'aria-label']) {
      const v = el.getAttribute(attr)
      if (v && wrong(v)) leaks.add(`${attr}="${v}"`)
    }
  })
  return Array.from(leaks)
}

/** Acronyms and product names that are written the same in both UIs. */
export const SHARED_TERMS: RegExp[] = [/\b(NORA|TOGAF|HLD|LLD|CAB|ARB|RFP|SOW|NCA|ECC|NDMO|SDAIA|DGA|OCR|Docling|API|IAM|KPI|SLA|SAR|PDF|DOCX|PPTX|XLSX|PNG|JPG|JSON|YAML|SVG|Word|PowerPoint|AI|EA|ID|URL|PoC|Gartner|Cloud Run)\b/g]

/**
 * Every free-text string in a fixture (tenant data a page shows as stored).
 * Codes such as IN_PROGRESS are left out on purpose: a code shown raw is a leak.
 */
export function fixtureText(...fixtures: unknown[]): string[] {
  const out = new Set<string>()
  const visit = (v: unknown) => {
    if (typeof v === 'string') { if (v.trim().length > 1 && !/^[A-Z0-9_]+$/.test(v) && !/^\d{4}-\d{2}-\d{2}/.test(v)) out.add(v.trim()) }
    else if (Array.isArray(v)) v.forEach(visit)
    else if (v && typeof v === 'object') Object.values(v as Record<string, unknown>).forEach(visit)
  }
  fixtures.forEach(visit)
  return Array.from(out)
}
