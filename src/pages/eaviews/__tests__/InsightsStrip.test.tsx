import { render, screen, fireEvent } from '@testing-library/react'
import { InsightsStrip } from '../InsightsStrip'

const insights: any[] = [
  { key: 'count', type: 'COUNT', severity: 'INFO', value: 67, text: '67 applications in this view.', textAr: 'عدد العناصر في هذا المشهد: 67' },
  { key: 'coverage:CAPABILITY', type: 'COVERAGE', severity: 'ATTENTION', value: 50, total: 67, text: '50 of 67 applications are linked to capabilities; 17 are not.', textAr: 'مرتبطة: 50 من 67', objectIds: ['a1', 'a2'] },
]

describe('<InsightsStrip>', () => {
  it('renders each fact (AR by default), with totals, and a help tip', () => {
    render(<InsightsStrip insights={insights} focusKey={null} onFocus={jest.fn()} />)
    expect(screen.getByTestId('insights')).toHaveTextContent('67')
    expect(screen.getByTestId('insights')).toHaveTextContent('/ 67')
    expect(screen.getByText('مرتبطة: 50 من 67')).toBeInTheDocument()
    expect(screen.getByText('eaviews.insights_title')).toBeInTheDocument()
  })

  it('only facts with objects behind them are focusable; clicking toggles focus', () => {
    const onFocus = jest.fn()
    const { rerender } = render(<InsightsStrip insights={insights} focusKey={null} onFocus={onFocus} />)
    expect(screen.getAllByRole('button').filter(b => b.className.includes('insight-tile'))).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { pressed: false }))
    expect(onFocus).toHaveBeenCalledWith(insights[1])
    rerender(<InsightsStrip insights={insights} focusKey="coverage:CAPABILITY" onFocus={onFocus} />)
    fireEvent.click(screen.getByRole('button', { pressed: true }))
    expect(onFocus).toHaveBeenLastCalledWith(null)
  })

  it('shows the change compared with Current when one is given, and nothing at all with no facts', () => {
    const { rerender, container } = render(<InsightsStrip insights={[]} stateChange={{ introduced: 3, retired: 1, modified: 0 }} focusKey={null} onFocus={jest.fn()} />)
    expect(screen.getByTestId('insight-state-change')).toHaveTextContent('+3 / −1')
    rerender(<InsightsStrip insights={[]} stateChange={null} focusKey={null} onFocus={jest.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
