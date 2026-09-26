import { render, screen, fireEvent } from '@testing-library/react';
import CopilotProvenance, { evidenceKind, evidenceModule } from '../CopilotProvenance';

let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (k: string) => k, isAR: mockIsAR }),
}));

const ADM_TRACE = {
  intent: 'ADM_CYCLE_STATUS', primaryModule: 'ADM', temporal: 'LATEST', modulesExecuted: ['ADM'],
  steps: [{ id: 's1', module: 'ADM', capability: 'adm_get_cycle_status', status: 'OK' as const }],
  conflictCount: 0, missingCount: 1, answerQuality: 'MEDIUM' as const,
};
const evidence = [
  { sourceType: 'ADM_CYCLE', sourceId: 'c2', title: 'ADM Cycle: EA Cycle H1 2026', module: 'ADM', evidenceType: 'ADM_FACT' },
  { sourceType: 'ADM_OUTPUT', sourceId: 'o1', title: 'Output', module: 'ADM', evidenceType: 'ADM_FACT' },
  { sourceType: 'DERIVED_PATH', sourceId: 'p1', title: 'Path', groundingType: 'DERIVED_PATH' },
  { sourceType: 'DOCUMENT', sourceId: 'd1', title: 'Policy', groundingType: 'DOCUMENT_EVIDENCE' },
];

beforeEach(() => { mockIsAR = false; });

describe('CopilotProvenance', () => {
  it('renders nothing for a general answer with no evidence and no module routing', () => {
    const { container } = render(<CopilotProvenance evidence={[]} trace={{ ...ADM_TRACE, intent: 'NONE', primaryModule: null }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('groups sources by module with the system of record first, and counts recorded / derived / document evidence', () => {
    render(<CopilotProvenance evidence={evidence} trace={ADM_TRACE} />);
    const chips = screen.getAllByText(/copilot\.prov\.module\./).map(el => el.textContent);
    expect(chips[0]).toBe('copilot.prov.module.ADM · 2');
    expect(chips).toEqual(expect.arrayContaining(['copilot.prov.module.REPOSITORY · 1', 'copilot.prov.module.KNOWLEDGE · 1']));
    expect(screen.getByText('copilot.prov.kind.recorded · 2')).toBeInTheDocument();
    expect(screen.getByText('copilot.prov.kind.derived · 1')).toBeInTheDocument();
    expect(screen.getByText('copilot.prov.kind.document · 1')).toBeInTheDocument();
  });

  it('shows the evidence-derived answer basis from the trace', () => {
    render(<CopilotProvenance evidence={evidence} trace={ADM_TRACE} />);
    expect(screen.getByTestId('copilot-provenance-quality')).toHaveTextContent('copilot.prov.basis: copilot.prov.basis.MEDIUM');
  });

  it('expands "How this was answered" with question type, time reference, per-module status and not-recorded count - never reasoning text', () => {
    render(<CopilotProvenance evidence={evidence} trace={{ ...ADM_TRACE, steps: [...ADM_TRACE.steps, { id: 's2', module: 'GOVERNANCE', capability: 'x', status: 'DENIED' as const }] }} />);
    const toggle = screen.getByRole('button', { name: /copilot\.prov\.how_answered/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('copilot.prov.intent.ADM_CYCLE_STATUS')).toBeInTheDocument();
    expect(screen.getByText('copilot.prov.temporal.LATEST')).toBeInTheDocument();
    expect(screen.getByText('(copilot.prov.step.DENIED)')).toBeInTheDocument();
    expect(screen.getByText('copilot.prov.not_recorded')).toBeInTheDocument();
  });

  it('shows the panel for a module-routed answer even when nothing was found (so "not recorded" is visible)', () => {
    render(<CopilotProvenance evidence={[]} trace={ADM_TRACE} />);
    expect(screen.getByTestId('copilot-provenance')).toBeInTheDocument();
  });

  it('offers a help tip explaining the panel', () => {
    render(<CopilotProvenance evidence={evidence} trace={ADM_TRACE} />);
    expect(screen.getByRole('button', { name: 'common.more_info' })).toBeInTheDocument();
  });

  it('renders right-to-left in Arabic', () => {
    mockIsAR = true;
    render(<CopilotProvenance evidence={evidence} trace={ADM_TRACE} />);
    expect(screen.getByTestId('copilot-provenance')).toHaveAttribute('dir', 'rtl');
  });

  it('maps legacy evidence without a module label to the right module and kind', () => {
    expect(evidenceModule({ sourceType: 'GOVERNANCE_REVIEW', sourceId: 'r', title: 'r' })).toBe('GOVERNANCE');
    expect(evidenceModule({ sourceType: 'DOCUMENT', sourceId: 'd', title: 'd' })).toBe('KNOWLEDGE');
    expect(evidenceModule({ sourceType: 'EA_RELATIONSHIP', sourceId: 'x', title: 'x' })).toBe('REPOSITORY');
    expect(evidenceKind({ sourceType: 'EA_ASSET', sourceId: 'a', title: 'a', groundingType: 'REPOSITORY_FACT' })).toBe('recorded');
    expect(evidenceKind({ sourceType: 'ADM_OUTPUT', sourceId: 'o', title: 'o', evidenceType: 'ADM_DERIVED' })).toBe('derived');
  });
});
