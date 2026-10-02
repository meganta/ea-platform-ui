/**
 * ADM no longer draws diagrams with AI: architecture pictures come from the
 * EA Views linked to an output. Older outputs may still carry AI diagram code
 * blocks (```ea-diagram JSON, Mermaid/flowchart text); they are not shown.
 * Mirrors the backend's adm-intelligence/diagram-blocks.ts.
 */
const DIAGRAM_LANGS = new Set(['ea-diagram', 'mermaid', 'flowchart', 'graph', 'mindmap', 'quadrantchart', 'sequencediagram', 'classdiagram', 'gitgraph', 'timeline'])
const DIAGRAM_BODY = /^\s*(flowchart|graph\s+(TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|quadrantChart|mindmap|gitGraph|timeline)\b/

export function isDiagramBlock(lang: string, body: string): boolean {
  const l = (lang || '').trim().toLowerCase()
  if (DIAGRAM_LANGS.has(l)) return true
  if (DIAGRAM_BODY.test(body)) return true
  if (!l || l === 'json') {
    try { const o = JSON.parse(body); return !!o && typeof o === 'object' && 'diagramType' in o && Array.isArray(o.nodes) } catch { return false }
  }
  return false
}

export function stripDiagramBlocks(markdown: string | null | undefined): string {
  if (!markdown) return markdown || ''
  return markdown
    .replace(/```([^\n`]*)\n([\s\S]*?)```[ \t]*\n?/g, (block, lang: string, body: string) => (isDiagramBlock(lang, body) ? '' : block))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
