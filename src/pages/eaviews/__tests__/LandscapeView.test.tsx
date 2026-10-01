import { render, screen, fireEvent } from '@testing-library/react'
import { buildLandscape, LandscapeView, UNLINKED_KEY } from '../LandscapeView'

const apps = [
  { id: 'a1', name: 'Payroll', assetType: 'Application', status: 'ACTIVE', metadata: { lifecycleStatus: 'ACTIVE' } },
  { id: 'a2', name: 'HR Portal', assetType: 'Application', status: 'ACTIVE', metadata: { lifecycleStatus: 'PHASE_OUT' } },
  { id: 'a3', name: 'Orphan App', assetType: 'Application', status: 'ACTIVE', metadata: {} },
]
const caps = [
  { id: 'c1', name: 'Workforce Management', assetType: 'GovCapability' },
  { id: 'c2', name: 'Compensation', assetType: 'GovCapability' },
]
const primary = new Set(['a1', 'a2', 'a3'])

describe('buildLandscape()', () => {
  it('groups primary objects under every related object they are linked to, and keeps unlinked ones visible', () => {
    const edges = [{ sourceId: 'a1', targetId: 'c1' }, { sourceId: 'a2', targetId: 'c1' }, { sourceId: 'c2', targetId: 'a1' }]
    const { groupedBy, groups } = buildLandscape([...apps, ...caps], edges, primary)
    expect(groupedBy).toBe('RELATED')
    expect(groups.map(g => [g.label, g.items.map(i => i.name)])).toEqual([
      ['Workforce Management', ['HR Portal', 'Payroll']],
      ['Compensation', ['Payroll']],
      ['', ['Orphan App']],
    ])
    expect(groups[2].key).toBe(UNLINKED_KEY)
  })

  it('falls back to lifecycle groups when there are no relationships', () => {
    const { groupedBy, groups } = buildLandscape(apps, [], primary)
    expect(groupedBy).toBe('LIFECYCLE')
    expect(groups.map(g => g.key).sort()).toEqual(['ACTIVE', 'PHASE_OUT'])
    expect(groups.find(g => g.key === 'ACTIVE')!.items.map(i => i.name)).toEqual(['Orphan App', 'Payroll'])
  })

  it('ignores relationships between two primary objects (they are not groups)', () => {
    const { groupedBy } = buildLandscape(apps, [{ sourceId: 'a1', targetId: 'a2' }], primary)
    expect(groupedBy).toBe('LIFECYCLE')
  })
})

describe('<LandscapeView>', () => {
  it('renders groups with counts, an unlinked group, a help tip, and selects an object on click', () => {
    const onSelect = jest.fn()
    render(<LandscapeView nodes={[...apps, ...caps]} edges={[{ sourceId: 'a1', targetId: 'c1' }]} primaryIds={primary} onSelect={onSelect} />)
    expect(screen.getByLabelText('Workforce Management')).toHaveTextContent('Payroll')
    expect(screen.getByLabelText('eaviews.landscape_unlinked')).toHaveTextContent('HR Portal')
    expect(screen.getByText('eaviews.landscape_by_related')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Payroll'))
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
  })
})
