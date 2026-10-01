import { render, screen, fireEvent } from '@testing-library/react'
import { allStates, comparableWith, stateTitle, StateMenu, EvolutionSummary, StateLine } from '../ArchitectureStates'

const st = (scenarioId: string, label: any, name = scenarioId, transitionNumber?: number) => ({ scenarioId, name, label, transitionNumber, status: 'APPROVED', horizonDate: null })
const lines: StateLine[] = [
  { id: 'geo', programme: 'Geo Address', states: [st('cur', 'CURRENT', 'Current'), st('geo', 'TARGET', 'Geo Address')] },
  { id: 'tgt', programme: '1HRDF', states: [st('cur', 'CURRENT', 'Current'), st('hrdf', 'TRANSITION', '1HRDF', 1), st('t1', 'TRANSITION', 'Jadarat T1', 2), st('tgt', 'TARGET', 'Jadarat Target')] },
]
const t = (k: string) => k

describe('architecture state helpers', () => {
  it('names states as Current / Transition N / Target', () => {
    expect(lines[1].states.map(s => stateTitle(s as any, t))).toEqual(['eaviews.state_current', 'eaviews.state_transition 1', 'eaviews.state_transition 2', 'eaviews.state_target'])
  })
  it('lists each state once even though Current is on every line', () => {
    expect(allStates(lines).map(s => s.scenarioId)).toEqual(['cur', 'geo', 'hrdf', 't1', 'tgt'])
  })
  it('only offers later states on the same line as comparison targets - never another programme', () => {
    expect(comparableWith(lines, 'hrdf').map(s => s.scenarioId)).toEqual(['t1', 'tgt'])
    expect(comparableWith(lines, 'geo')).toEqual([])
    expect(comparableWith(lines, 'cur').map(s => s.scenarioId)).toEqual(['geo', 'hrdf', 't1', 'tgt'])
  })
})

describe('<StateMenu>', () => {
  it('groups states by programme, marks the active one, and picks a state', () => {
    const onPick = jest.fn()
    render(<StateMenu lines={lines} activeId="cur" onPick={onPick} />)
    expect(screen.getByText('1HRDF', { selector: 'div' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { current: true }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Jadarat Target'))
    expect(onPick).toHaveBeenCalledWith('tgt')
  })
})

describe('<EvolutionSummary>', () => {
  const evolution = {
    from: st('cur', 'CURRENT') as any, to: st('tgt', 'TARGET') as any, programme: '1HRDF',
    summary: { introduced: 1, retired: 1, restored: 0, modified: 1, unchanged: 5, relationshipsAdded: 2, relationshipsRemoved: 1 },
    items: [
      { objectId: 'n', name: 'New Portal', assetType: 'Application', change: 'INTRODUCED' as const },
      { objectId: 'o', name: 'Legacy HR', assetType: 'Application', change: 'RETIRED' as const },
      { objectId: 'm', name: 'Payroll', assetType: 'Application', change: 'MODIFIED' as const, propertyChanges: [{ property: 'metadata.hostingModel', before: 'ON_PREM', after: 'CLOUD' }] },
    ],
  }
  it('shows counts and reveals the objects behind a count', () => {
    render(<EvolutionSummary evolution={evolution} />)
    expect(screen.getByTestId('evolution')).toHaveTextContent('+2 / −1')
    expect(screen.queryByTestId('evolution-items')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('eaviews.evo_modified'))
    expect(screen.getByTestId('evolution-items')).toHaveTextContent('Payroll')
    expect(screen.getByTestId('evolution-items')).toHaveTextContent('hostingModel: ON_PREM → CLOUD')
    expect(screen.getByTestId('evolution-items')).not.toHaveTextContent('Legacy HR')
  })
})
