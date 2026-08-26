// ── Export Pipeline (Tier 5) ─────────────────────────────────────────────────
//
// First round: JSON, CSV, SVG - pure client-side transformations of data
// the browser has already fetched through an authorized endpoint. This
// round adds PNG (canvas rasterization, no new dependency), PDF (jspdf),
// and PPTX (pptxgenjs) - two new client-side libraries, still no new
// backend surface. True binary XLSX (vs. the CSV already shipped, which
// opens fine in Excel) remains deferred - it needs a binary spreadsheet
// library (SheetJS or similar), a separate addition from either of the
// two brought in here.
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

// Shared by exportGraphAsSVG and every raster format below (PNG, PDF,
// PPTX all need to rasterize this same graph) - builds a standalone SVG
// markup string from the live element. Explicitly sets width/height
// attributes from the element's actual rendered size: the live SVG only
// has CSS width:100%/height:100% (fine inside this app's layout), which
// gives a standalone copy no intrinsic size - it can render as 0x0 (or
// unpredictably) both in a plain SVG viewer and, critically, when loaded
// into an Image element for canvas rasterization, which is exactly what
// every raster export below needs to do.
function buildStandaloneSvgMarkup(svgElement: SVGSVGElement, meta: ExportMetadata): { markup: string; width: number; height: number } {
  const rect = svgElement.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width) || 1200)
  const height = Math.max(1, Math.round(rect.height) || 800)

  const clone = svgElement.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style') // drop the live element's cursor/etc. inline styles - not meaningful in a static export
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('viewBox', `0 0 ${width} ${height}`)
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  styleEl.textContent = SVG_STANDALONE_STYLE
  clone.insertBefore(styleEl, clone.firstChild)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const serialized = new XMLSerializer().serializeToString(clone)
  const withHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- ${meta.viewName}${meta.architectureState ? ` (${meta.architectureState})` : ''} - exported ${meta.generatedAt || new Date().toISOString()} -->\n${serialized}`
  return { markup: withHeader, width, height }
}

export function exportGraphAsSVG(svgElement: SVGSVGElement, meta: ExportMetadata) {
  const { markup } = buildStandaloneSvgMarkup(svgElement, meta)
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8;' }), `${safeFilenamePart(meta.viewName)}.svg`)
}

// ── PNG (Graph view) ─────────────────────────────────────────────────────
//
// SVG -> canvas -> PNG, the standard browser-native technique (no new
// dependency needed): load the standalone SVG markup as an Image, draw it
// onto a canvas sized to match, then read the canvas back out as a PNG
// blob. Async because image loading is inherently async - every caller
// needs to await this or handle the returned promise.
//
// renderGraphToCanvas is exported separately (not just used internally)
// because exportGraphAsPDF/exportGraphAsPPTX below need the same
// rasterized canvas to embed as an image in their own document formats -
// they call this directly rather than going through exportGraphAsPNG's
// download step.
export function renderGraphToCanvas(svgElement: SVGSVGElement, meta: ExportMetadata): Promise<HTMLCanvasElement> {
  const { markup, width, height } = buildStandaloneSvgMarkup(svgElement, meta)
  const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8;' })
  const svgUrl = URL.createObjectURL(svgBlob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(svgUrl)
      const canvas = document.createElement('canvas')
      // 2x scale for a reasonably crisp export on high-DPI displays,
      // without the file size exploding the way a much higher multiple
      // would - a fixed middle ground rather than reading the actual
      // devicePixelRatio, so exports are consistent across machines.
      const scale = 2
      canvas.width = width * scale
      canvas.height = height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return }
      ctx.fillStyle = '#0f172a' // matches --navy - a transparent PNG would show as harsh white/black depending on the viewer otherwise
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas)
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('Failed to rasterize graph SVG for export')) }
    img.src = svgUrl
  })
}

export async function exportGraphAsPNG(svgElement: SVGSVGElement, meta: ExportMetadata): Promise<void> {
  const canvas = await renderGraphToCanvas(svgElement, meta)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Failed to convert graph canvas to PNG')); return }
      downloadBlob(blob, `${safeFilenamePart(meta.viewName)}.png`)
      resolve()
    }, 'image/png')
  })
}

// ── Shared table-row shaping (used by both PDF and PPTX table exports) ─────
//
// Both formats need the same {headers, rows} shape - one place to define
// what a "row" of node/matrix/roadmap data means, rather than deriving it
// separately (and risking drift) in the PDF and PPTX renderers below.
function nodesToTableRows(nodes: any[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Name', 'Type', 'Domain', 'Status', 'Owner'],
    rows: nodes.map(n => [n.name || '', n.assetType || '', n.domain || '', n.status || '', n.owner || '']),
  }
}
function matrixToTableRows(sources: any[], targets: any[], relationships: any[]): { headers: string[]; rows: string[][] } {
  const hasRel = (sId: string, tId: string) => relationships.some((r: any) => (r.sourceId === sId && r.targetId === tId) || (r.sourceId === tId && r.targetId === sId))
  return {
    headers: ['', ...targets.map(t => t.name)],
    rows: sources.map(s => [s.name, ...targets.map(t => (hasRel(s.id, t.id) ? 'X' : ''))]),
  }
}
function roadmapToTableRows(items: any[]): { headers: string[]; rows: string[][] } {
  return {
    headers: ['Name', 'Start', 'End', 'Group', 'Status'],
    rows: items.map(it => [it.name || '', it.start || '', it.end || '', it.group || '', it.status || '']),
  }
}

// ── PDF ───────────────────────────────────────────────────────────────────
//
// jsPDF is loaded via a dynamic import rather than a top-level one - it's
// a meaningfully large library that only a user who actually clicks
// "Export as PDF" ever needs, so keeping it out of the main bundle (CRA/
// webpack code-splits a dynamic import() automatically) means everyone
// else's page load isn't paying for it.
function writePdfHeader(doc: any, meta: ExportMetadata, pageWidth: number): number {
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  doc.text(meta.viewName, 40, 40)
  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  const subtitle = [meta.architectureState, `Generated ${meta.generatedAt || new Date().toISOString()}`].filter(Boolean).join(' · ')
  doc.text(subtitle, 40, 56)
  doc.setDrawColor(200, 200, 200)
  doc.line(40, 66, pageWidth - 40, 66)
  return 90 // y-coordinate content should start at, below the header
}

// A hand-rolled table drawer (no autotable plugin dependency) - text +
// ruled lines only, but that's sufficient for a data export and avoids
// pulling in a third library on top of jspdf itself. Paginates by adding
// a new page (with its own header re-drawn) whenever a row would run
// past the bottom margin, so a long node list or roadmap doesn't silently
// clip off the page.
function drawPdfTable(doc: any, headers: string[], rows: string[][], meta: ExportMetadata, pageWidth: number, pageHeight: number) {
  const margin = 40
  const usableWidth = pageWidth - margin * 2
  const colWidth = usableWidth / Math.max(1, headers.length)
  const rowHeight = 18
  const maxCellChars = Math.max(6, Math.floor(colWidth / 5)) // rough width-to-character-count budget, not exact metrics - good enough to avoid gross overlap between columns

  let y = writePdfHeader(doc, meta, pageWidth)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  headers.forEach((h, i) => doc.text(String(h).slice(0, maxCellChars), margin + i * colWidth + 2, y))
  y += 4
  doc.setDrawColor(180, 180, 180)
  doc.line(margin, y, pageWidth - margin, y)
  y += rowHeight - 4
  doc.setFont('helvetica', 'normal')

  for (const row of rows) {
    if (y > pageHeight - 40) {
      doc.addPage()
      y = writePdfHeader(doc, meta, pageWidth)
      doc.setFontSize(9)
    }
    row.forEach((cell, i) => doc.text(String(cell ?? '').slice(0, maxCellChars), margin + i * colWidth + 2, y))
    y += rowHeight
  }
}

export async function exportGraphAsPDF(svgElement: SVGSVGElement, meta: ExportMetadata): Promise<void> {
  const canvas = await renderGraphToCanvas(svgElement, meta)
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const startY = writePdfHeader(doc, meta, pageWidth)
  const margin = 40
  const availW = pageWidth - margin * 2
  const availH = pageHeight - startY - margin
  const scale = Math.min(availW / canvas.width, availH / canvas.height, 1) // never upscale beyond the canvas's own rendered size
  const imgW = canvas.width * scale
  const imgH = canvas.height * scale
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, startY, imgW, imgH)
  doc.save(`${safeFilenamePart(meta.viewName)}.pdf`)
}

async function exportTableAsPDF(headers: string[], rows: string[][], meta: ExportMetadata, filenameSuffix: string) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  drawPdfTable(doc, headers, rows, meta, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight())
  doc.save(`${safeFilenamePart(meta.viewName)}${filenameSuffix}.pdf`)
}
export function exportNodesAsPDF(nodes: any[], meta: ExportMetadata): Promise<void> {
  const { headers, rows } = nodesToTableRows(nodes)
  return exportTableAsPDF(headers, rows, meta, '')
}
export function exportMatrixAsPDF(sources: any[], targets: any[], relationships: any[], meta: ExportMetadata): Promise<void> {
  const { headers, rows } = matrixToTableRows(sources, targets, relationships)
  return exportTableAsPDF(headers, rows, meta, '-matrix')
}
export function exportRoadmapAsPDF(items: any[], meta: ExportMetadata): Promise<void> {
  const { headers, rows } = roadmapToTableRows(items)
  return exportTableAsPDF(headers, rows, meta, '-roadmap')
}

// ── PPTX ──────────────────────────────────────────────────────────────────
//
// Same dynamic-import reasoning as jsPDF above. pptxgenjs's addTable()
// supports real native tables (unlike jsPDF, which needed the hand-rolled
// drawPdfTable above), so table exports here are genuinely native PPTX
// tables, not an image of one.
const PPTX_TABLE_OPTS = { fontSize: 10, border: { type: 'solid', color: 'CCCCCC', pt: 0.5 }, autoPage: true } as const

async function newPptxWithTitleSlide(meta: ExportMetadata) {
  const PptxGenJS = (await import('pptxgenjs')).default
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'EA_WIDE', width: 13.33, height: 7.5 })
  pptx.layout = 'EA_WIDE'
  const slide = pptx.addSlide()
  slide.addText(meta.viewName, { x: 0.4, y: 0.3, w: 12.5, h: 0.6, fontSize: 22, bold: true, color: '141414' })
  const subtitle = [meta.architectureState, `Generated ${meta.generatedAt || new Date().toISOString()}`].filter(Boolean).join('  ·  ')
  slide.addText(subtitle, { x: 0.4, y: 0.85, w: 12.5, h: 0.35, fontSize: 11, color: '787878' })
  return { pptx, slide }
}

export async function exportGraphAsPPTX(svgElement: SVGSVGElement, meta: ExportMetadata): Promise<void> {
  const canvas = await renderGraphToCanvas(svgElement, meta)
  const { pptx, slide } = await newPptxWithTitleSlide(meta)
  const aspectRatio = canvas.width / canvas.height
  const maxW = 12.5, maxH = 5.8
  const w = aspectRatio > maxW / maxH ? maxW : maxH * aspectRatio
  const h = aspectRatio > maxW / maxH ? maxW / aspectRatio : maxH
  slide.addImage({ data: canvas.toDataURL('image/png'), x: (13.33 - w) / 2, y: 1.4, w, h })
  await pptx.writeFile({ fileName: `${safeFilenamePart(meta.viewName)}.pptx` })
}

async function exportTableAsPPTX(headers: string[], rows: string[][], meta: ExportMetadata, filenameSuffix: string) {
  const { pptx, slide } = await newPptxWithTitleSlide(meta)
  const tableRows = [headers.map(h => ({ text: h, options: { bold: true, fill: { color: 'F0F0F0' } } })), ...rows.map(r => r.map(c => ({ text: c })))]
  slide.addTable(tableRows, { x: 0.4, y: 1.4, w: 12.5, h: 5.6, ...PPTX_TABLE_OPTS })
  await pptx.writeFile({ fileName: `${safeFilenamePart(meta.viewName)}${filenameSuffix}.pptx` })
}
export function exportNodesAsPPTX(nodes: any[], meta: ExportMetadata): Promise<void> {
  const { headers, rows } = nodesToTableRows(nodes)
  return exportTableAsPPTX(headers, rows, meta, '')
}
export function exportMatrixAsPPTX(sources: any[], targets: any[], relationships: any[], meta: ExportMetadata): Promise<void> {
  const { headers, rows } = matrixToTableRows(sources, targets, relationships)
  return exportTableAsPPTX(headers, rows, meta, '-matrix')
}
export function exportRoadmapAsPPTX(items: any[], meta: ExportMetadata): Promise<void> {
  const { headers, rows } = roadmapToTableRows(items)
  return exportTableAsPPTX(headers, rows, meta, '-roadmap')
}
