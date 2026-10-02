import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import CopilotStudyCard, { isStudyAttachment, studyPhase, STUDY_POLL_MS } from '../CopilotStudyCard';
import CopilotViewAttachments from '../CopilotViewAttachments';

let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (k: string) => k, isAR: mockIsAR }),
}));

const STARTED = {
  kind: 'STUDY', id: 'att-1', studyId: 's1', title: 'Cloud data platform', titleAr: 'منصة البيانات السحابية', action: 'STARTED',
  status: 'AI_RESEARCH', recommendation: null, includeImpactAnalysis: true, authorType: 'COPILOT', createdAt: '2026-10-02T09:00:00Z',
} as const;

const sections = (done: number, total = 4) => Array.from({ length: total }, (_, i) => ({ sectionKey: `S${i}`, status: i < done ? 'AI_DRAFT' : 'PENDING' }));
let studyResponses: any[] = [];
let exportCalls: string[] = [];
let anchor: any;

beforeEach(() => {
  mockIsAR = false;
  studyResponses = [];
  exportCalls = [];
  localStorage.setItem('ea_token', 'tok');
  (global as any).fetch = jest.fn(async (url: string) => {
    if (url.includes('/export/')) {
      exportCalls.push(url);
      return { ok: true, blob: async () => new Blob(['x']) };
    }
    const next = studyResponses.length > 1 ? studyResponses.shift() : studyResponses[0];
    return { ok: true, json: async () => next };
  });
  (global as any).URL.createObjectURL = jest.fn(() => 'blob:x');
  (global as any).URL.revokeObjectURL = jest.fn();
  const create = document.createElement.bind(document);
  anchor = null;
  jest.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: any) => {
    const el = create(tag, opts);
    if (tag === 'a') { anchor = el; (el as any).click = jest.fn(); }
    return el;
  });
});
afterEach(() => { (document.createElement as any).mockRestore?.(); jest.useRealTimers(); });

describe('CopilotStudyCard', () => {
  it('follows a study being generated - progress by sections - until it is ready, then offers Word and PowerPoint', async () => {
    jest.useFakeTimers();
    studyResponses = [
      { id: 's1', title: 'Cloud data platform', status: 'AI_RESEARCH', sections: sections(1) },
      { id: 's1', title: 'Cloud data platform', status: 'UNDER_REVIEW', recommendation: 'PILOT', sections: sections(4) },
    ];
    render(<CopilotStudyCard attachment={STARTED as any} />);
    expect(await screen.findByText('1 / 4 copilot.study.sections_ready')).toBeInTheDocument();
    expect(screen.getByText('copilot.study.generating')).toBeInTheDocument();
    expect(screen.queryByText(/copilot.study.download_word/)).toBeNull();
    await act(async () => { jest.advanceTimersByTime(STUDY_POLL_MS); });
    expect(await screen.findByText(/copilot.study.download_word/)).toBeInTheDocument();
    expect(screen.getByText(/copilot.study.recommendation: Pilot/)).toBeInTheDocument();
    expect(screen.getByText('copilot.study.by_copilot')).toBeInTheDocument();
    expect(screen.getByText(/copilot.study.open/).closest('a')!.getAttribute('href')).toBe('/innovation?study=s1');
  });

  it('downloads the stored study\'s Word report and PowerPoint in the reader\'s language', async () => {
    mockIsAR = true;
    studyResponses = [{ id: 's1', title: 'Cloud data platform', titleAr: 'منصة البيانات السحابية', status: 'UNDER_REVIEW', recommendation: 'PROCEED', sections: sections(4) }];
    render(<CopilotStudyCard attachment={{ ...STARTED, action: 'EXISTING', status: 'UNDER_REVIEW' } as any} />);
    fireEvent.click(await screen.findByText(/copilot.study.download_word/));
    await waitFor(() => expect(exportCalls[0]).toMatch(/\/innovation\/studies\/s1\/export\/docx\?lang=ar$/));
    await waitFor(() => expect(anchor?.download).toBe('منصة_البيانات_السحابية_AR.docx'));
    fireEvent.click(screen.getByText(/copilot.study.download_pptx/));
    await waitFor(() => expect(exportCalls[1]).toMatch(/export\/pptx\?lang=ar$/));
    expect(screen.getByText(/منصة البيانات السحابية/)).toBeInTheDocument();
    expect(screen.getByTestId('copilot-study-card').getAttribute('dir')).toBe('rtl');
  });

  it('a large study\'s export shows that it is being prepared and downloads once ready', async () => {
    jest.useFakeTimers();
    let attempts = 0;
    (global as any).fetch = jest.fn(async (url: string) => {
      if (url.includes('/export/')) {
        exportCalls.push(url);
        return ++attempts < 3
          ? { status: 202, ok: true, json: async () => ({ status: 'PREPARING', translated: attempts * 10, total: 30 }) }
          : { status: 200, ok: true, blob: async () => new Blob(['x']) };
      }
      return { ok: true, json: async () => ({ id: 's1', title: 'Cloud data platform', status: 'UNDER_REVIEW', sections: sections(4) }) };
    });
    render(<CopilotStudyCard attachment={{ ...STARTED, action: 'EXISTING', status: 'UNDER_REVIEW' } as any} />);
    fireEvent.click(await screen.findByText(/copilot.study.download_pptx/));
    expect(await screen.findByText(/copilot.study.export_preparing \(10\/30\)/)).toBeInTheDocument();
    await act(async () => { jest.advanceTimersByTime(3000); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    await waitFor(() => expect(anchor?.download).toBe('Cloud_data_platform_EN.pptx'));
    expect(exportCalls).toHaveLength(3);
    expect(screen.queryByText(/copilot.study.export_preparing/)).toBeNull();
  });

  it('shows the API\'s reason when an export fails', async () => {
    (global as any).fetch = jest.fn(async (url: string) => url.includes('/export/')
      ? { status: 400, ok: false, json: async () => ({ message: 'The translation provider is temporarily rate limited. Please retry shortly.' }) }
      : { ok: true, json: async () => ({ id: 's1', title: 'Cloud data platform', status: 'UNDER_REVIEW', sections: sections(4) }) });
    render(<CopilotStudyCard attachment={{ ...STARTED, action: 'EXISTING', status: 'UNDER_REVIEW' } as any} />);
    fireEvent.click(await screen.findByText(/copilot.study.download_word/));
    expect(await screen.findByRole('alert')).toHaveTextContent('rate limited');
  });

  it('says plainly when generation stopped, and asks to refresh it', async () => {
    studyResponses = [{ id: 's1', title: 'Cloud data platform', status: 'DRAFT', sections: sections(2) }];
    render(<CopilotStudyCard attachment={STARTED as any} />);
    expect(await screen.findByText('copilot.study.failed')).toBeInTheDocument();
    expect(screen.queryByText(/copilot.study.download_word/)).toBeNull();
  });

  it('is rendered by the answer\'s attachment list alongside view pictures', async () => {
    studyResponses = [{ id: 's1', title: 'Cloud data platform', status: 'AI_RESEARCH', sections: [] }];
    render(<CopilotViewAttachments attachments={[STARTED, { kind: 'OTHER' }]} />);
    expect(await screen.findByTestId('copilot-study-card')).toBeInTheDocument();
  });
});

describe('studyPhase / isStudyAttachment', () => {
  const a = STARTED as any;
  it('treats a just-requested study still reading DRAFT as starting, then as stopped after the grace period', () => {
    expect(studyPhase({ status: 'DRAFT', sections: [] }, a, 5_000)).toBe('generating');
    expect(studyPhase({ status: 'DRAFT', sections: [] }, a, 120_000)).toBe('failed');
    expect(studyPhase({ status: 'AI_RESEARCH' }, a, 999_999)).toBe('generating');
    expect(studyPhase({ status: 'UNDER_REVIEW', sections: sections(4) }, a, 0)).toBe('ready');
    expect(studyPhase({ status: 'APPROVED', sections: sections(4) }, { ...a, action: 'EXISTING' }, 0)).toBe('ready');
    expect(studyPhase({ status: 'DRAFT', sections: [] }, { ...a, action: 'EXISTING' }, 0)).toBe('failed');
  });
  it('recognises study attachments only', () => {
    expect(isStudyAttachment(STARTED)).toBe(true);
    expect(isStudyAttachment({ kind: 'STUDY' })).toBe(false);
    expect(isStudyAttachment({ kind: 'VIEW_RENDER', studyId: 'x' })).toBe(false);
  });
});
