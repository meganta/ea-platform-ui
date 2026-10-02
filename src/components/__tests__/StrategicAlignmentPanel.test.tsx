import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import StrategicAlignmentPanel from '../StrategicAlignmentPanel'
import KpiMeasurementPanel from '../KpiMeasurementPanel'
import { alignmentApi } from '../../lib/strategy-alignment'

jest.mock('../../lib/strategy-alignment', () => ({
  ...jest.requireActual('../../lib/strategy-alignment'),
  alignmentApi: { latest: jest.fn(), start: jest.fn(), decide: jest.fn(), addLink: jest.fn(), setValue: jest.fn(), export: jest.fn(), units: jest.fn(), kpis: jest.fn(), tracking: jest.fn(), measure: jest.fn(), report: jest.fn(), exportReport: jest.fn(), setStrategyType: jest.fn() },
}))
const api = alignmentApi as jest.Mocked<typeof alignmentApi>
const t = (key: string) => key

const node = (level: string, title: string, extra: any = {}) => ({ key: `${level}:${title.toLowerCase()}`, id: title, level, title, source: { kind: 'STRATEGY_FACT' }, ...extra })
const ready: any = {
  run: { id: 'run1', status: 'READY', trigger: 'MANUAL', sources: { DIGITAL: { kind: 'STRATEGY', strategyName: 'Digital Strategy 2030', provisional: true }, BUSINESS: { kind: 'REPOSITORY' } }, summary: { kept: 2, flagged: 1, added: 3, rejectedKept: 0 }, warnings: ['No EA operating model is analysed.'], createdAt: '' },
  nodes: [node('BUSINESS_GOAL', 'Grow employment'), node('DT_GOAL', 'Digital services'), node('EA_GOAL', 'Integrated architecture'), node('EA_KPI', 'Reuse rate', { formula: 'reused / built' }), node('DT_INITIATIVE', 'Portal 2.0')],
  links: [
    { id: 'l1', fromKey: 'DT_GOAL:digital services', toKey: 'BUSINESS_GOAL:grow employment', fromLevel: 'DT_GOAL', toLevel: 'BUSINESS_GOAL', rationale: 'Digital services grow employment.', confidence: 0.82, status: 'PROPOSED' },
    { id: 'l2', fromKey: 'EA_GOAL:old goal', toKey: 'DT_GOAL:digital services', fromLevel: 'EA_GOAL', toLevel: 'DT_GOAL', rationale: 'earlier', confidence: 1, status: 'FLAGGED', flagReason: 'FROM_REMOVED', fromTitle: 'Old goal' },
  ],
  gaps: [{ code: 'GOAL_WITHOUT_KPI', key: 'BUSINESS_GOAL:grow employment', level: 'BUSINESS_GOAL', title: 'Grow employment' }],
  rows: [{ BUSINESS_GOAL: 'Grow employment', DT_GOAL: 'Digital services' }],
  results: [{ nodeKey: 'EA_KPI:reuse rate', period: 'Q1', value: '40' }], year: 2026,
}
beforeEach(() => { jest.clearAllMocks(); api.latest.mockResolvedValue(ready); api.decide.mockResolvedValue({}); api.addLink.mockResolvedValue({}); api.setValue.mockResolvedValue({}); api.start.mockResolvedValue({ id: 'r2', status: 'QUEUED' }) })

describe('Strategic alignment panel', () => {
  it('invites preparing the alignment when there is none', async () => {
    api.latest.mockResolvedValue({ run: null })
    render(<StrategicAlignmentPanel t={t} canPrepare canReview />)
    expect(await screen.findByText('strategy.align.empty')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'strategy.align.prepare' }))
    await waitFor(() => expect(api.start).toHaveBeenCalled())
  })

  it('shows where each level came from, the carried-over decisions and the matrix', async () => {
    render(<StrategicAlignmentPanel t={t} canPrepare canReview />)
    expect(await screen.findByText('Digital Strategy 2030')).toBeInTheDocument()
    expect(screen.getByText('strategy.align.provisional')).toBeInTheDocument()
    expect(screen.getByText('strategy.align.source.repository')).toBeInTheDocument()
    expect(screen.getByText('strategy.align.carried')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'strategy.align.level.OP_KPI' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Grow employment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'strategy.align.export' })).toBeInTheDocument()
  })

  it('lets people confirm a proposed link and explains a flagged one', async () => {
    render(<StrategicAlignmentPanel t={t} canPrepare canReview />)
    fireEvent.click(await screen.findByRole('button', { name: /strategy.align.view.links/ }))
    const proposed = screen.getByTestId('link-l1')
    expect(proposed).toHaveTextContent('82%')
    fireEvent.click(within(proposed).getByRole('button', { name: 'strategy.align.confirm' }))
    await waitFor(() => expect(api.decide).toHaveBeenCalledWith('l1', 'CONFIRMED'))
    expect(screen.getByTestId('link-l2')).toHaveTextContent('strategy.align.flag.FROM_REMOVED')
    expect(screen.getByTestId('link-l2')).toHaveTextContent('Old goal')
  })

  it('adds a link only between elements that may serve each other', async () => {
    render(<StrategicAlignmentPanel t={t} canPrepare canReview />)
    fireEvent.click(await screen.findByRole('button', { name: /strategy.align.view.links/ }))
    fireEvent.change(screen.getByLabelText('strategy.align.add_from'), { target: { value: 'EA_GOAL:integrated architecture' } })
    const to = screen.getByLabelText('strategy.align.add_to') as HTMLSelectElement
    expect(Array.from(to.options).map(o => o.value)).toEqual(['', 'DT_GOAL:digital services'])
    fireEvent.change(to, { target: { value: 'DT_GOAL:digital services' } })
    fireEvent.click(screen.getByRole('button', { name: 'strategy.align.add_button' }))
    await waitFor(() => expect(api.addLink).toHaveBeenCalledWith('EA_GOAL:integrated architecture', 'DT_GOAL:digital services', undefined))
  })

  it('lists gaps and saves strategic KPI results and initiative progress', async () => {
    render(<StrategicAlignmentPanel t={t} canPrepare canReview />)
    fireEvent.click(await screen.findByRole('button', { name: /strategy.align.view.gaps/ }))
    expect(screen.getByText(/strategy.align.gap.GOAL_WITHOUT_KPI/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'strategy.align.view.results' }))
    expect(screen.getByLabelText('Reuse rate strategy.align.period.Q1')).toHaveValue('40')
    expect(screen.getByLabelText('Reuse rate strategy.align.period.FORMULA')).toHaveValue('reused / built')
    const q2 = screen.getByLabelText('Reuse rate strategy.align.period.Q2')
    fireEvent.change(q2, { target: { value: '55' } }); fireEvent.blur(q2)
    await waitFor(() => expect(api.setValue).toHaveBeenCalledWith('EA_KPI:reuse rate', expect.any(Number), 'Q2', '55'))
    const progress = screen.getByLabelText('Portal 2.0 strategy.align.period.PROGRESS')
    fireEvent.change(progress, { target: { value: '60' } }); fireEvent.blur(progress)
    await waitFor(() => expect(api.setValue).toHaveBeenCalledWith('DT_INITIATIVE:portal 2.0', expect.any(Number), 'PROGRESS', '60'))
  })

  it('follows a run in progress and offers nothing to change while it runs', async () => {
    jest.useFakeTimers()
    api.latest.mockResolvedValueOnce({ run: { ...ready.run, status: 'PROCESSING' } }).mockResolvedValue(ready)
    render(<StrategicAlignmentPanel t={t} canPrepare canReview={false} />)
    expect(await screen.findByText('strategy.align.working')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'strategy.align.regenerate' })).toBeDisabled()
    await act(async () => { jest.advanceTimersByTime(5000) })
    jest.useRealTimers()
    expect(await screen.findByText('Digital Strategy 2030')).toBeInTheDocument()
  })
})

describe('KPI measurement panel', () => {
  const kpi = (id: string, extra: any = {}) => ({ id, name: `KPI ${id}`, formula: 'a / b', polarity: 'Ascending', repositoryFrequency: 'PerQuarter', frequency: 'QUARTERLY', reported: true, target: '80', unit: '%', measures: { Q1: { value: '70' } }, schedule: [{ period: 'Q1', dueDate: '2026-03-31', status: 'RECORDED' }, { period: 'Q2', dueDate: '2026-06-30', status: 'OVERDUE' }, { period: 'Q3', dueDate: '2026-09-30', status: 'DUE' }, { period: 'Q4', dueDate: '2026-12-31', status: 'UPCOMING' }], ...extra })
  beforeEach(() => {
    api.units.mockResolvedValue([{ id: 'ea', name: 'Enterprise Architecture - إدارة البنية المؤسسية', kpis: 2, enterpriseArchitecture: true }, { id: 'cloud', name: 'Cloud', kpis: 1, enterpriseArchitecture: false }])
    api.kpis.mockResolvedValue([kpi('k1'), kpi('k2', { reported: false, frequency: 'ANNUAL', schedule: [{ period: 'Y', dueDate: '2026-12-31', status: 'UPCOMING' }], measures: {} })] as any)
    api.measure.mockResolvedValue({}); api.tracking.mockResolvedValue({})
  })

  it('opens on the EA department\'s KPIs with what is due and overdue', async () => {
    render(<KpiMeasurementPanel t={t} canEdit />)
    expect(await screen.findByTestId('kpi-k1')).toHaveTextContent('a / b')
    expect(api.kpis).toHaveBeenCalledWith('ea', expect.any(Number))
    expect(screen.getByText('strategy.kpi.due_count').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('strategy.kpi.overdue_count').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('strategy.kpi.reported_count').previousSibling).toHaveTextContent('1')
  })

  it('records a period measure and a monthly one, and changes what is reported', async () => {
    render(<KpiMeasurementPanel t={t} canEdit />)
    const q2 = await screen.findByLabelText('KPI k1 strategy.align.period.Q2')
    fireEvent.change(q2, { target: { value: '78' } }); fireEvent.blur(q2)
    await waitFor(() => expect(api.measure).toHaveBeenCalledWith('k1', expect.any(Number), 'Q2', '78'))
    fireEvent.click(within(screen.getByTestId('kpi-k1')).getByRole('button', { name: 'strategy.kpi.monthly' }))
    const may = screen.getByLabelText('KPI k1 strategy.align.period.M05')
    fireEvent.change(may, { target: { value: '76' } }); fireEvent.blur(may)
    await waitFor(() => expect(api.measure).toHaveBeenCalledWith('k1', expect.any(Number), 'M05', '76'))
    fireEvent.click(within(screen.getByTestId('kpi-k2')).getByRole('checkbox'))
    await waitFor(() => expect(api.tracking).toHaveBeenCalledWith('k2', { reported: true }))
  })

  it('shows a period report and exports it', async () => {
    api.report.mockResolvedValue({ year: 2026, period: 'Q1', measured: 1, missing: 0, rows: [{ id: 'k1', name: 'KPI k1', formula: '', frequency: 'QUARTERLY', target: '80', unit: '%', value: '70', derived: false, previous: '', trend: '', onTarget: false, status: 'MEASURED' }] })
    render(<KpiMeasurementPanel t={t} canEdit />)
    await screen.findByTestId('kpi-k1')
    fireEvent.change(screen.getByLabelText('strategy.kpi.period'), { target: { value: 'Q1' } })
    fireEvent.click(screen.getByRole('button', { name: 'strategy.kpi.show_report' }))
    expect(await screen.findByText('strategy.kpi.report_summary')).toBeInTheDocument()
    expect(screen.getByText('strategy.kpi.off_target')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'strategy.kpi.export_report' }))
    await waitFor(() => expect(api.exportReport).toHaveBeenCalledWith('ea', expect.any(Number), 'Q1'))
  })

  it('is read-only without review rights', async () => {
    render(<KpiMeasurementPanel t={t} canEdit={false} />)
    expect(await screen.findByLabelText('KPI k1 strategy.align.period.Q2')).toBeDisabled()
  })
})
