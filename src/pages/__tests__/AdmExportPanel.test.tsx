import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TemplatePanel } from '../AdmPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false, resolveText: (value: string) => value }),
}));
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }), { virtual: true });
jest.mock('../../components/DiagramViewer', () => ({ DiagramViewer: () => <div /> }));
jest.mock('../../components/Phase7Workspace', () => ({ Phase7Workspace: () => <div /> }));
jest.mock('../../components/DesignPicker', () => ({ __esModule: true, default: () => <div data-testid="design-picker" /> }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }), { virtual: true });

const calls: string[] = [];
beforeEach(() => {
  calls.length = 0;
  localStorage.setItem('ea_token', 'fake-token');
  (URL as any).createObjectURL = jest.fn(() => 'blob:x');
  (URL as any).revokeObjectURL = jest.fn();
  global.fetch = jest.fn().mockImplementation((url: string) => {
    calls.push(url);
    if (url.includes('/mapping')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ outputNameEn: 'EA Drivers', purposeEn: 'Drivers' }) });
    if (url.includes('/output-studio/templates')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ gallery: [], templates: [], defaults: {} }) });
    return Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['pptx'])) });
  }) as any;
});

async function openPanel() {
  render(<TemplatePanel phase="1" outputKey="drivers_list" outputId="output-1" cycle={{ id: 'c1' }} />);
  fireEvent.click(await screen.findByText('📤 Export'));
  await screen.findByTestId('design-picker');
}

describe('ADM export panel', () => {
  it('shows only the controls that change the PowerPoint: format, detail, views, evidence and design', async () => {
    await openPanel();
    expect(screen.getByLabelText('studio.format')).toBeInTheDocument();
    expect(screen.getByLabelText('studio.detail')).toBeInTheDocument();
    expect(screen.getByText('studio.include_views')).toBeInTheDocument();
    expect(screen.getByText('studio.include_evidence')).toBeInTheDocument();
    expect(screen.queryByText(/^Language/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Audience/)).not.toBeInTheDocument();
    expect(screen.queryByText('ArchMind Output Studio')).not.toBeInTheDocument();
  });

  it('never sends a language, so the export follows the output language (Arabic stays RTL)', async () => {
    await openPanel();
    fireEvent.click(screen.getByText('studio.generate_pptx'));
    await waitFor(() => expect(calls.some(url => url.includes('/export/pptx'))).toBe(true));
    const exportUrl = calls.find(url => url.includes('/export/pptx'))!;
    expect(exportUrl).not.toMatch(/[?&]language=/);
    expect(exportUrl).not.toMatch(/[?&]audience=/);
    expect(exportUrl).toContain('detail=STANDARD');
  });
});
