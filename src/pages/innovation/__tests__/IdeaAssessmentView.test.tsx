import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IdeaAssessmentView from '../IdeaAssessmentView';
import IdeaMatrix from '../IdeaMatrix';
import { pickBi, riskExposure, label, QUADRANT } from '../ideaLabels';

const KEYS = ['STRATEGIC_ALIGNMENT', 'BUSINESS_VALUE', 'BENEFICIARY_IMPACT', 'TECHNICAL_FEASIBILITY', 'ORGANIZATIONAL_READINESS', 'COST_EFFORT', 'RISK_COMPLIANCE', 'TIME_TO_VALUE'];
const assessment = (over: Record<string, any> = {}) => ({
  assessedAt: '2026-10-02T08:00:00Z',
  summary: { en: 'English summary', ar: 'ملخص عربي' },
  problem: { en: 'Problem', ar: 'المشكلة' }, targetBeneficiaries: { en: 'Citizens', ar: 'المواطنون' },
  criteria: KEYS.map((key, i) => ({ key, weight: 10, group: i < 3 ? 'VALUE' : 'EASE', aiScore: 60, score: key === 'BUSINESS_VALUE' ? 90 : 60, reviewerScore: key === 'BUSINESS_VALUE' ? 90 : null, reviewerNote: key === 'BUSINESS_VALUE' ? 'Checked with finance' : null, confidence: 'HIGH', rationale: { en: `why ${key}`, ar: `سبب ${key}` } })),
  scores: { overall: 64, aiOverall: 60, value: 70, ease: 60, quadrant: 'QUICK_WIN' },
  recommendation: { decision: 'MERGE', rationale: { en: 'Same as an existing idea', ar: 'مماثلة لفكرة قائمة' }, conditions: [], mergeWith: { kind: 'IDEA', id: 'idea-9', title: 'Older idea', status: 'SUBMITTED', overlap: 80 } },
  swot: { strengths: [{ en: 'Strong demand', ar: 'طلب قوي' }], weaknesses: [], opportunities: [], threats: [] },
  benefits: [], kpis: [],
  risks: [
    { category: 'VENDOR', likelihood: 'LOW', impact: 'LOW', text: { en: 'Minor vendor risk', ar: 'خطر مورّد بسيط' }, mitigation: { en: 'Contract', ar: 'عقد' } },
    { category: 'SECURITY', likelihood: 'HIGH', impact: 'HIGH', text: { en: 'Major security risk', ar: 'خطر أمني كبير' }, mitigation: { en: 'Controls', ar: 'ضوابط' } },
  ],
  effort: { size: 'L', costBand: 'HIGH', timeframe: { en: '6-9 months', ar: '6-9 أشهر' }, skills: [] },
  strategicLinks: [], eaImpact: [], assumptions: [], openQuestions: [], nextSteps: [],
  confidence: 'LOW', dataGaps: [{ en: 'No strategy goals recorded', ar: 'لا توجد أهداف استراتيجية مسجلة' }], similar: [],
  context: { orgProfile: false, strategyGoals: 0, repositoryObjects: 12, relatedTechnology: 'Conversational AI', similarItems: 1 },
  ...over,
});

describe('IdeaAssessmentView', () => {
  it('renders in English with the AI score kept next to a reviewer adjustment', () => {
    render(<IdeaAssessmentView assessment={assessment()} isAR={false} canAdjust={false} />);
    expect(screen.getByTestId('idea-recommendation')).toHaveTextContent('Merge with an existing item');
    expect(screen.getByText('English summary')).toBeInTheDocument();
    expect(screen.getByTestId('criterion-BUSINESS_VALUE')).toHaveTextContent('(AI 60)');
    expect(screen.getByText(/Checked with finance/)).toBeInTheDocument();
    expect(screen.getByText(/AI score before reviewer adjustments: 60/)).toBeInTheDocument();
    expect(screen.getByText('No strategy goals recorded')).toBeInTheDocument();
    expect(screen.getByText(/Conversational AI/)).toBeInTheDocument();
  });

  it('renders the Arabic text and labels when the reader uses Arabic', () => {
    render(<IdeaAssessmentView assessment={assessment()} isAR canAdjust={false} />);
    expect(screen.getByText('ملخص عربي')).toBeInTheDocument();
    expect(screen.getByTestId('idea-recommendation')).toHaveTextContent('الدمج مع عنصر قائم');
    expect(screen.getByText('بطاقة التقييم')).toBeInTheDocument();
    expect(screen.getByText('طلب قوي')).toBeInTheDocument();
    expect(screen.getByText('لا توجد أهداف استراتيجية مسجلة')).toBeInTheDocument();
    expect(screen.getByTestId('idea-quadrant')).toHaveTextContent('مكسب سريع');
  });

  it('lists the highest-exposure risk first', () => {
    render(<IdeaAssessmentView assessment={assessment()} isAR={false} canAdjust={false} />);
    const rows = screen.getByTestId('idea-risks').querySelectorAll('tbody tr');
    expect(rows[0]).toHaveTextContent('Major security risk');
    expect(rows[1]).toHaveTextContent('Minor vendor risk');
  });

  it('opens the idea to merge with', () => {
    const onOpenIdea = jest.fn();
    render(<IdeaAssessmentView assessment={assessment()} isAR={false} canAdjust={false} onOpenIdea={onOpenIdea} />);
    fireEvent.click(screen.getByText('Older idea'));
    expect(onOpenIdea).toHaveBeenCalledWith('idea-9');
  });

  it('requires a score in range and a note before saving an adjustment', async () => {
    const onAdjust = jest.fn().mockResolvedValue(undefined);
    render(<IdeaAssessmentView assessment={assessment()} isAR={false} canAdjust onAdjust={onAdjust} />);
    fireEvent.click(screen.getByTestId('criterion-COST_EFFORT').querySelector('button')!);
    fireEvent.change(screen.getByLabelText('Reviewer score (0-100)'), { target: { value: '150' } });
    fireEvent.click(screen.getByText('Save'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/between 0 and 100/);
    fireEvent.change(screen.getByLabelText('Reviewer score (0-100)'), { target: { value: '40' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onAdjust).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Why (required)'), { target: { value: 'Licence cost is higher' } });
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onAdjust).toHaveBeenCalledWith('COST_EFFORT', 40, 'Licence cost is higher'));
  });

  it('restores the AI score of an adjusted criterion', async () => {
    const onAdjust = jest.fn().mockResolvedValue(undefined);
    render(<IdeaAssessmentView assessment={assessment()} isAR={false} canAdjust onAdjust={onAdjust} />);
    fireEvent.click(screen.getByTestId('criterion-BUSINESS_VALUE').querySelector('button')!);
    fireEvent.click(screen.getByText('Restore AI score'));
    await waitFor(() => expect(onAdjust).toHaveBeenCalledWith('BUSINESS_VALUE', null, undefined));
  });

  it('shows the adjust controls only when allowed', () => {
    render(<IdeaAssessmentView assessment={assessment()} isAR={false} canAdjust={false} onAdjust={jest.fn()} />);
    expect(screen.queryByText('Adjust')).not.toBeInTheDocument();
  });
});

describe('IdeaMatrix', () => {
  it('places each idea and opens it by click or keyboard', () => {
    const onSelect = jest.fn();
    render(<IdeaMatrix isAR={false} onSelect={onSelect} points={[{ id: 'a', title: 'Alpha', value: 80, ease: 30 }]} />);
    const point = screen.getByRole('button', { name: 'Alpha: Value 80, Ease of delivery 30' });
    fireEvent.click(point);
    fireEvent.keyDown(point, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Strategic bet')).toBeInTheDocument();
  });

  it('labels the quadrants in Arabic', () => {
    render(<IdeaMatrix isAR points={[]} />);
    expect(screen.getByText('مكسب سريع')).toBeInTheDocument();
    expect(screen.getByText('أولوية منخفضة')).toBeInTheDocument();
  });
});

describe('ideaLabels helpers', () => {
  it('pick the reader\'s language, falling back to the other one', () => {
    expect(pickBi({ en: 'Hello', ar: '' }, true)).toBe('Hello');
    expect(pickBi({ en: '', ar: 'مرحبا' }, false)).toBe('مرحبا');
    expect(pickBi(null, false)).toBe('');
    expect(label(QUADRANT, 'UNKNOWN', false)).toBe('UNKNOWN');
    expect(riskExposure('HIGH', 'MEDIUM')).toBe(6);
  });
});
