import { layoutByQuestion, layoutByDomain, COLUMN_WIDTH } from '../canvasLayout'

const n = (id: string, assetType: string, domain = 'APPLICATION') => ({ id, name: id, assetType, domain })
const nodes = [n('app2', 'Application'), n('app1', 'Application'), n('cap1', 'GovCapability', 'BUSINESS'), n('if1', 'Interface'), n('dc1', 'DataCenter', 'TECHNOLOGY')]

describe('layoutByQuestion()', () => {
  it('puts primary objects in the first column and related groups to the right, by type', () => {
    const objects = [{ id: 'app1', role: 'PRIMARY' as const }, { id: 'app2', role: 'PRIMARY' as const }, { id: 'cap1', role: 'RELATED' as const }, { id: 'if1', role: 'RELATED' as const }, { id: 'dc1', role: 'RELATED' as const }]
    const pos = layoutByQuestion(nodes, objects)
    expect(pos.app1.x).toBe(pos.app2.x)
    expect(pos.app1.y).toBeLessThan(pos.app2.y) // sorted by name within a column
    const relatedXs = new Set([pos.cap1.x, pos.if1.x, pos.dc1.x])
    expect(relatedXs.size).toBe(3)
    expect(Math.min(...relatedXs)).toBe(pos.app1.x + COLUMN_WIDTH)
  })

  it('follows path hop order when the view walks a path', () => {
    const objects = [{ id: 'app1', role: 'PRIMARY' as const }, { id: 'if1', role: 'RELATED' as const }, { id: 'app2', role: 'RELATED' as const }]
    const pos = layoutByQuestion(nodes.filter(x => ['app1', 'if1', 'app2'].includes(x.id)), objects, [{ id: 'p', objectIds: ['app1', 'if1', 'app2'] }])
    expect(pos.if1.x).toBe(pos.app1.x + COLUMN_WIDTH)
    expect(pos.app2.x).toBe(pos.app1.x + 2 * COLUMN_WIDTH)
  })
})

describe('layoutByDomain()', () => {
  it('one column per domain', () => {
    const pos = layoutByDomain(nodes)
    expect(pos.app1.x).toBe(pos.if1.x)
    expect(new Set([pos.app1.x, pos.cap1.x, pos.dc1.x]).size).toBe(3)
  })
})
