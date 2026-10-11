import fs from 'fs'
import path from 'path'
import { assignable, day, fill, insertByDate, measureCounts, move, stateLabel, stateStatus, warningText } from '../roadmapModel'
import { ROADMAP_TRANSLATIONS } from '../roadmapStrings'

const t = (k: string) => ROADMAP_TRANSLATIONS[k]?.EN ?? k

describe('roadmapModel', () => {
  it('formats dates and fills placeholders', () => {
    expect(day('2027-06-30T00:00:00.000Z')).toBe('2027-06-30')
    expect(day(null)).toBe('')
    expect(fill('{a} of {b}', { a: 1, b: null })).toBe('1 of ')
  })

  it('labels states and gives achieved priority over approval', () => {
    expect(stateLabel({ label: 'TRANSITION', transitionNumber: 2 }, t)).toBe('Transition 2')
    expect(stateLabel({ label: 'TARGET' }, t)).toBe('Target')
    expect(stateStatus({ status: 'APPROVED', achievedAt: '2027-01-01' })).toBe('ACHIEVED')
    expect(stateStatus({ status: 'APPROVED', achievedAt: null })).toBe('APPROVED')
    expect(stateStatus({ status: 'DRAFT', achievedAt: null })).toBe('DRAFT')
  })

  it('words backend warnings', () => {
    expect(warningText({ code: 'UNPLANNED_CHANGES', count: 4 }, t)).toBe('4 changes are not in any work package.')
    expect(warningText({ code: 'WP_OVERDUE', name: 'CRM', date: '2026-06-01T00:00:00.000Z' }, t)).toBe('Work package "CRM" was due 2026-06-01 and is not delivered.')
  })

  it('moves and inserts states by date', () => {
    expect(move([1, 2, 3], 0, 1)).toEqual([2, 1, 3])
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3])
    const list = [{ id: 'a', horizonDate: '2027-06-30' }, { id: 'b', horizonDate: '2028-06-30' }]
    expect(insertByDate(list, { id: 'x', horizonDate: '2027-12-31' }).map(s => s.id)).toEqual(['a', 'x', 'b'])
    expect(insertByDate(list, { id: 'y', horizonDate: null }).map(s => s.id)).toEqual(['a', 'b', 'y'])
  })

  it('assigns only a selection from one state, split by kind', () => {
    const items: any[] = [
      { id: 'o1', kind: 'OBJECT', stateId: 's1', workPackageId: null },
      { id: 'r1', kind: 'RELATIONSHIP', stateId: 's1', workPackageId: 'wp' },
      { id: 'o2', kind: 'OBJECT', stateId: 's2', workPackageId: null },
    ]
    expect(assignable(items, new Set(['o1', 'r1']))).toEqual({ stateId: 's1', objectChangeIds: ['o1'], linkChangeIds: ['r1'], assigned: 1 })
    expect(assignable(items, new Set(['o1', 'o2']))).toBeNull()
    expect(assignable(items, new Set())).toBeNull()
  })

  it('counts target measures by status', () => {
    expect(measureCounts([{ status: 'MET' }, { status: 'BELOW' }, { status: 'NOT_MEASURED' }, { status: 'MET' }])).toEqual({ total: 4, met: 2, below: 1, unmeasured: 1 })
  })
})

describe('roadmap strings', () => {
  it('every string has English and Arabic text', () => {
    for (const [k, v] of Object.entries(ROADMAP_TRANSLATIONS)) {
      expect(v.EN.trim()).not.toBe('')
      if (/[A-Za-z]/.test(v.EN.replace(/\{\w+\}/g, ''))) expect(/[\u0600-\u06FF]/.test(v.AR)).toBe(true)
      // Placeholders match between languages.
      expect((v.AR.match(/\{\w+\}/g) || []).sort()).toEqual((v.EN.match(/\{\w+\}/g) || []).sort())
      expect(k.startsWith('roadmap.')).toBe(true)
    }
  })

  it('every static roadmap.* key used in the code exists', () => {
    const files = ['../ArchitectureRoadmap.tsx', '../RoadmapPanels.tsx', '../../../components/RoadmapContextPanels.tsx', '../../EaPlanningPage.tsx'].map(f => fs.readFileSync(path.join(__dirname, f), 'utf8'))
    const used = new Set(files.flatMap(src => [...src.matchAll(/t\('(roadmap\.[\w.]+)'\)/g)].map(m => m[1])))
    const missing = [...used].filter(k => !ROADMAP_TRANSLATIONS[k])
    expect(missing).toEqual([])
  })

  it('every dynamic key family is complete', () => {
    const families: Record<string, string[]> = {
      'roadmap.change.': ['INTRODUCE', 'RETIRE', 'RESTORE', 'MODIFY', 'LINK_ADD', 'LINK_REMOVE'],
      'roadmap.warn.': ['LINE_BROKEN', 'STATE_NO_HORIZON', 'STATE_ORDER', 'STATE_OVERDUE', 'STATE_NOT_APPROVED', 'UNPLANNED_CHANGES', 'WP_NO_END_DATE', 'WP_OVERDUE', 'WP_AFTER_STATE', 'WP_EMPTY'],
      'roadmap.wp.status.': ['PLANNED', 'COMMITTED', 'DELIVERED', 'CANCELLED'],
      'roadmap.m.kind.': ['CAPABILITY_MATURITY', 'DOMAIN_MATURITY', 'REFERENCE_COVERAGE', 'KPI'],
      'roadmap.m.status.': ['MET', 'BELOW', 'NOT_MEASURED'],
      'roadmap.status.': ['DRAFT', 'APPROVED', 'ACHIEVED'],
      'roadmap.label.': ['CURRENT', 'TRANSITION', 'TARGET'],
      'roadmap.align.class.': ['RETIRING', 'PLANNED_NEW', 'CHANGING', 'STAYS'],
      'roadmap.sub.': ['changes', 'packages', 'segments', 'measures', 'domains', 'asat'],
      'roadmap.step.': ['ANNUAL', 'HALF_YEAR'],
    }
    for (const [prefix, keys] of Object.entries(families)) for (const k of keys) expect(ROADMAP_TRANSLATIONS[prefix + k]).toBeDefined()
  })
})
