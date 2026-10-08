import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReportView } from '../GovernancePage';

jest.mock('react-router-dom', () => ({ useLocation: () => ({ state: null }) }), { virtual: true });
jest.mock('../../contexts/LangContext', () => ({ useLang: () => ({ isAR: false, t: (key: string) => key, resolveText: (text: string) => text }) }));
jest.mock('../../components/AttachedViewsPanel', () => ({ AttachedViewsPanel: () => null }));

const types = ['HLD_REVIEW', 'RFP_SOW', 'LLD_REVIEW', 'SOLUTION_DESIGN', 'TECHNICAL_PROPOSAL', 'CHANGE_REQUEST', 'CAB_REVIEW', 'BUSINESS_DEMAND', 'NEW_PROJECT', 'DIGITAL_INITIATIVE'];

it('hides unrelated domain dimensions and preserves fractional domain scores', () => {
  render(<ReportView review={{ id: 'r1', reviewType: 'HLD_REVIEW' }} report={{
    overallScore: 50,
    domainSummaries: { DATA_ARCHITECTURE: { score: 42.75, complianceScore: 88.88, strategicScore: 99.99, riskScore: 22.5 } },
    reportView: { sections: ['executiveSummary', 'domainAssessment', 'validatedFindings'], scoringDimensions: ['risk'] },
  }} findings={[]} tab="domains" setTab={jest.fn()} />);
  expect(screen.getByText('42.75')).toBeInTheDocument();
  expect(screen.getByText('22.5')).toBeInTheDocument();
  expect(screen.queryByText('88.88')).not.toBeInTheDocument();
  expect(screen.queryByText('99.99')).not.toBeInTheDocument();
});

it.each(types)('%s follows the export chapter list even when excluded content exists', reviewType => {
  render(<ReportView review={{ id: 'r1', reviewType }} report={{
    overallScore: 42.75, decision: 'REQUIRES_CHANGES', executiveSummary: 'Saved assessment',
    financialOpportunities: { opportunities: [{ title: 'Excluded financial content' }] },
    reportView: { sections: ['executiveSummary', 'validatedFindings'], scoringDimensions: [] },
  }} findings={[]} tab="financial" setTab={jest.fn()} />);
  expect(screen.getByText('Saved assessment')).toBeInTheDocument();
  expect(screen.getByText('42.75')).toBeInTheDocument();
  expect(screen.queryByText('Excluded financial content')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gov.financial' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'gov.strategic' })).not.toBeInTheDocument();
});

it('keeps the new score and decision after closing the rescore notification', async () => {
  global.fetch = jest.fn().mockImplementation((url: string) => Promise.resolve({ ok: true, json: async () =>
    url.endsWith('/rescore') ? { overallScore: 77.5, strategicScore: 80, decision: 'APPROVED' } : {} }));
  function Example() {
    const [report, setReport] = React.useState<any>({
      overallScore: 42.75, strategicScore: 50, decision: 'REQUIRES_CHANGES',
      reportView: { sections: ['executiveSummary', 'strategicAlignment'], scoringDimensions: ['strategic'] },
      strategicAlignment: { objectives: [{ strategyType: 'BUSINESS_STRATEGY', objectiveName: 'Digital services', alignmentStatus: 'PARTIALLY_ALIGNED', alignmentPercentage: 50, isTenantStrategy: true }] },
    });
    return <ReportView review={{ id: 'r1', reviewType: 'SOLUTION_DESIGN' }} report={report} findings={[]} tab="strategic" setTab={jest.fn()} onRescored={scores => setReport((old: any) => ({ ...old, ...scores }))} />;
  }
  render(<Example />);
  fireEvent.change(await screen.findByDisplayValue('PARTIALLY ALIGNED'), { target: { value: 'FULLY_ALIGNED' } });
  await waitFor(() => expect(screen.getAllByText('77.5').length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole('button', { name: '×' }));
  expect(screen.getByText('77.5')).toBeInTheDocument();
  expect(screen.getByText('APPROVED')).toBeInTheDocument();
  expect(screen.queryByText('42.75')).not.toBeInTheDocument();
});
