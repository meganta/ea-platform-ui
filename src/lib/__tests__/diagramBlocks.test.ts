import { stripDiagramBlocks } from '../diagramBlocks'

describe('stripDiagramBlocks (ADM shows no AI diagrams)', () => {
  it('drops ea-diagram, Mermaid and diagram-JSON blocks; keeps text, tables and ordinary code', () => {
    const md = 'Intro text.\n```ea-diagram\n{"diagramType":"x","nodes":[]}\n```\n```mermaid\ngraph TD; A-->B\n```\n```json\n{"a":1}\n```\n| A |\n|---|\n| 1 |'
    const out = stripDiagramBlocks(md)
    expect(out).not.toMatch(/ea-diagram|mermaid|diagramType|A-->B/)
    expect(out).toContain('Intro text.')
    expect(out).toContain('{"a":1}')
    expect(out).toContain('| 1 |')
  })
})
