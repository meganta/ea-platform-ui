// Exports for an EA View that Copilot rendered to illustrate an answer.
//
// The server sends a static SVG of the view's result plus the bounded rows
// behind it (CopilotViewAttachment). Everything here works on that payload
// only - no re-query - so the PNG/deck is exactly what the answer showed,
// matching the EA Views export pipeline's rule (pages/eaviews/exportUtils.ts):
// an export never fetches anything the viewer was not already shown.
import PptxGenJS from 'pptxgenjs'

export interface CopilotViewAttachment {
  kind: 'VIEW_RENDER'
  id: string
  source: 'SAVED_VIEW' | 'VIEW_LIBRARY'
  viewId: string | null
  viewpointId: string | null
  title: string
  titleAr: string | null
  visualization: string
  architectureState: string | null
  scenario: string | null
  preferredFormat: 'IMAGE' | 'DECK'
  generatedAt: string
  image: { mimeType: 'image/svg+xml'; svg: string; width: number; height: number }
  stats: { objects: number; relationships: number; shownObjects: number; shownRelationships: number; truncated: boolean }
  table: { headers: string[]; rows: string[][]; totalRows: number; relationshipHeaders?: string[]; relationshipRows?: string[][] }
}

export function isViewAttachment(a: any): a is CopilotViewAttachment {
  return !!a && a.kind === 'VIEW_RENDER' && typeof a?.image?.svg === 'string' && a.image.svg.startsWith('<svg')
}

/** A data: URL for <img>. SVG loaded as an image never runs script, and the server escapes all tenant text. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function attachmentFileName(a: Pick<CopilotViewAttachment, 'title'>, ext: string): string {
  const base = (a.title || 'view').trim().split('').filter(ch => ch.charCodeAt(0) >= 32 && !'<>:"/\\|?*.'.includes(ch)).join('').replace(/\s+/g, '-').slice(0, 60) || 'view'
  return `${base}.${ext}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a) }, 2000)
}

/** SVG -> canvas at 2x (same fixed scale as the EA Views PNG export). */
export function renderAttachmentToCanvas(a: CopilotViewAttachment): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = a.image.width * scale
      canvas.height = a.image.height * scale
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas)
    }
    img.onerror = () => reject(new Error('Failed to rasterize the view image'))
    img.src = svgDataUrl(a.image.svg)
  })
}

export async function downloadAttachmentPng(a: CopilotViewAttachment): Promise<void> {
  const canvas = await renderAttachmentToCanvas(a)
  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Failed to create PNG')); return }
      downloadBlob(blob, attachmentFileName(a, 'png'))
      resolve()
    }, 'image/png')
  })
}

const SLIDE_W = 13.33
const TABLE_OPTS = { fontSize: 10, border: { type: 'solid', color: 'CCCCCC', pt: 0.5 }, autoPage: true } as const

/**
 * Deck: a title + picture slide, then the objects (and relationships) behind
 * the picture as native PowerPoint tables, so the deck stays readable when a
 * large view had to be summarised in the image.
 */
export async function downloadAttachmentDeck(a: CopilotViewAttachment, opts: { question?: string; isAR?: boolean } = {}): Promise<void> {
  const canvas = await renderAttachmentToCanvas(a)
  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'EA_WIDE', width: SLIDE_W, height: 7.5 })
  pptx.layout = 'EA_WIDE'
  const title = (opts.isAR && a.titleAr) || a.title
  const align = opts.isAR ? 'right' : 'left'
  const subtitle = [a.visualization, a.architectureState, a.scenario, `${a.stats.objects} objects`, `${a.stats.relationships} relationships`, a.generatedAt.slice(0, 10)].filter(Boolean).join('  ·  ')

  const cover = pptx.addSlide()
  cover.addText(title, { x: 0.4, y: 0.3, w: 12.5, h: 0.6, fontSize: 22, bold: true, color: '141414', align, rtlMode: !!opts.isAR })
  cover.addText(subtitle, { x: 0.4, y: 0.85, w: 12.5, h: 0.35, fontSize: 11, color: '787878', align })
  const ratio = canvas.width / canvas.height
  const maxW = 12.5, maxH = opts.question ? 5.3 : 5.8
  const w = ratio > maxW / maxH ? maxW : maxH * ratio
  const h = ratio > maxW / maxH ? maxW / ratio : maxH
  cover.addImage({ data: canvas.toDataURL('image/png'), x: (SLIDE_W - w) / 2, y: 1.35, w, h })
  if (opts.question) cover.addText(opts.question, { x: 0.4, y: 6.8, w: 12.5, h: 0.4, fontSize: 10, italic: true, color: '5A5A5A', align, rtlMode: !!opts.isAR })

  const tableSlide = (heading: string, headers: string[], rows: string[][]) => {
    if (rows.length === 0) return
    const s = pptx.addSlide()
    s.addText(heading, { x: 0.4, y: 0.3, w: 12.5, h: 0.5, fontSize: 18, bold: true, color: '141414', align })
    const data = [headers.map(t => ({ text: t, options: { bold: true, fill: { color: 'F0F0F0' } } })), ...rows.map(r => r.map(c => ({ text: String(c ?? '') })))]
    s.addTable(data as any, { x: 0.4, y: 1.0, w: 12.5, ...TABLE_OPTS } as any)
  }
  const more = a.table.totalRows > a.table.rows.length ? ` (first ${a.table.rows.length} of ${a.table.totalRows})` : ''
  tableSlide(`${title} - objects${more}`, a.table.headers, a.table.rows)
  if (a.table.relationshipHeaders && a.table.relationshipRows) tableSlide(`${title} - relationships`, a.table.relationshipHeaders, a.table.relationshipRows)

  await pptx.writeFile({ fileName: attachmentFileName(a, 'pptx') })
}
