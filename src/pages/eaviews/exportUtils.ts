// ── Export Pipeline (Tier 5, scoped V1) ─────────────────────────────────────
//
// Deliberately scoped to JSON, CSV, and SVG for this round - all three are
// pure client-side transformations of data the browser has already fetched
// through an authorized endpoint, so there is no new backend surface and no
// new way to leak data beyond what the viewer could already see on screen.
// PDF, PPTX, PNG, and true XLSX are NOT included here - PDF/PPTX need a
// rendering/layout library this project doesn't have installed yet, PNG
// needs canvas-based SVG rasterization (real cross-browser quirks), and
// XLSX needs a binary-format library (SheetJS or similar) - each is a
// meaningfully bigger, riskier addition than a single review round should
// take on at once, so they're left for a following round rather than
// attempted alongside everything else here.
//
// Every exported file's content only ever comes from data already present
// in the calling component's state (never a fresh fetch triggered by the
// export itself), which is what keeps export security straightforward for
// this scope: if the viewer was authorized to see it on screen, exporting
// it doesn't grant anything new.

function downloadBlob(blob: Blob, filename: string) {
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(objUrl); document.body.removeChild(a) }, 2000)
}

function safeFilenamePart(name: string): string {
  return (name || 'view').trim().replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-').slice(0, 60) || 'view'
}

export interface ExportMetadata {
  viewName: string
  architectureState?: string
  generatedAt?: string // ISO string; defaults to now if omitted
}

// ── JSON ──────────────────────────────────────────────────────────────────
//
// Works for any view type - wraps whatever data the caller already has
// (nodes/edges, matrix rows, roadmap items, dashboard results) alongside
// the same export-metadata block (spec section 45: title, state, generated
// date) every export format in this pipeline includes.
export function exportAsJSON(data: any, meta: ExportMetadata) {
  const payload = {
    exportMetadata: {
      viewName: meta.viewName,
      architectureState: meta.architectureState,
      generatedAt: meta.generatedAt || new Date().toISOString(),
    },
    data,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${safeFilenamePart(meta.viewName)}.json`)
}

// ── CSV ───────────────────────────────────────────────────────────────────
//
// A minimal, dependency-free CSV writer - RFC 4180 quoting (wrap in quotes,
// double up any embedded quote) is enough for this use case; no external
// library needed for something this small.
function csvEscape(value: any): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) lines.push(row.map(csvEscape).join(','))
  return lines.join('\r\n')
}

// Flat node list - used for Table/Heatmap/Tree/Cards/Graph's underlying
// data (one row per object), since all of those visualization modes share
// the same node shape even though they render it differently.
export function exportNodesAsCSV(nodes: any[], meta: ExportMetadata) {
  const headers = ['Name', 'Type', 'Domain', 'Status', 'Owner', 'Description']
  const rows = nodes.map(n => [n.name, n.assetType, n.domain, n.status, n.owner || '', n.description || ''])
  const csv = `# ${meta.viewName}${meta.architectureState ? ` (${meta.architectureState})` : ''} - exported ${meta.generatedAt || new Date().toISOString()}\r\n` + buildCsv(headers, rows)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeFilenamePart(meta.viewName)}.csv`)
}

// Matrix grid - rows=sources, columns=targets, cell=relationship presence.
// Genuinely different shape from a flat node list (spec section 25 asks
// for Excel/CSV export specifically for the Matrix engine), so this is a
// separate exporter rather than reusing exportNodesAsCSV on one side of
// the matrix.
//
// hasRel checks BOTH directions (source->target OR target->source) to
// match the in-viewer interactive Matrix mode's own on-screen logic
// exactly - that's the only current caller. The backend's
// executeMatrixQuery (used by Dashboard matrix widgets) is intentionally
// unidirectional-only, a separate, pre-existing design choice - if this
// exporter is later reused for a Dashboard widget's matrix data, that
// caller's relationships are already one-directional going in, so the
// OR here is simply a no-op for that shape rather than a mismatch.
export function exportMatrixAsCSV(sources: any[], targets: any[], relationships: any[], meta: ExportMetadata) {
  const hasRel = (sId: string, tId: string) => relationships.some((r: any) => (r.sourceId === sId && r.targetId === tId) || (r.sourceId === tId && r.targetId === sId))
  const headers = ['', ...targets.map(t => t.name)]
  const rows = sources.map(s => [s.name, ...targets.map(t => (hasRel(s.id, t.id) ? 'X' : ''))])
  const csv = `# ${meta.viewName} - Matrix export - ${meta.generatedAt || new Date().toISOString()}\r\n` + buildCsv(headers, rows)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeFilenamePart(meta.viewName)}-matrix.csv`)
}

// Roadmap items - one row per timeline item.
export function exportRoadmapAsCSV(items: any[], meta: ExportMetadata) {
  const headers = ['Name', 'Start', 'End', 'Group', 'Status']
  const rows = items.map(it => [it.name, it.start || '', it.end || '', it.group, it.status])
  const csv = `# ${meta.viewName} - Roadmap export - ${meta.generatedAt || new Date().toISOString()}\r\n` + buildCsv(headers, rows)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${safeFilenamePart(meta.viewName)}-roadmap.csv`)
}

// ── SVG (Graph view) ──────────────────────────────────────────────────────
//
// Serializes the live, on-screen <svg> element as-is - what the user sees
// is exactly what gets exported, no separate re-render step to keep in
// sync. Inlines a minimal style reset so the file renders correctly when
// opened standalone (outside this app's CSS custom properties, which the
// live graph relies on via var(--navy-light) etc. - those wouldn't resolve
// to anything in a standalone SVG viewer).
const SVG_STANDALONE_STYLE = `
  text { font-family: -apple-system, Segoe UI, Roboto, sans-serif; }
`
export function exportGraphAsSVG(svgElement: SVGSVGElement, meta: ExportMetadata) {
  const clone = svgElement.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style') // drop the live element's cursor/etc. inline styles - not meaningful in a static export
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleEl.textContent = SVG_STANDALONE_STYLE
  clone.insertBefore(styleEl, clone.firstChild)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const serialized = new XMLSerializer().serializeToString(clone)
  const withHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${meta.viewName}${meta.architectureState ? ` (${meta.architectureState})` : ''} - exported ${meta.generatedAt || new Date().toISOString()} -->\n${serialized}`
  downloadBlob(new Blob([withHeader], { type: 'image/svg+xml;charset=utf-8;' }), `${safeFilenamePart(meta.viewName)}.svg`)
}
