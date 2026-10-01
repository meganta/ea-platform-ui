import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopilotViewAttachments from '../CopilotViewAttachments';
import { attachmentFileName, isViewAttachment, svgDataUrl } from '../copilotViewExport';

let mockIsAR = false;
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (k: string) => k, isAR: mockIsAR }),
}));

jest.mock('pptxgenjs', () => {
  const slide = { addText: jest.fn(), addImage: jest.fn(), addTable: jest.fn() };
  // Plain functions (not jest.fn) survive CRA's resetMocks.
  const instance: any = { defineLayout: () => {}, layout: '', slides: 0, addSlide: () => { instance.slides++; return slide }, writeFile: jest.fn() };
  class MockPptx { constructor() { return instance } }
  return { __esModule: true, default: MockPptx, __slide: slide, __instance: instance };
});
const mockSlide = (jest.requireMock('pptxgenjs') as any).__slide;
const mockPptx = (jest.requireMock('pptxgenjs') as any).__instance;

const ATTACHMENT = {
  kind: 'VIEW_RENDER', id: 'att-1', source: 'SAVED_VIEW', viewId: 'v1', viewpointId: null,
  title: 'Application Integration', titleAr: 'تكامل التطبيقات', visualization: 'GRAPH', architectureState: 'CURRENT', scenario: 'Current',
  preferredFormat: 'IMAGE', generatedAt: '2026-10-01T10:00:00.000Z',
  image: { mimeType: 'image/svg+xml', svg: '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="260"><text>Payroll</text></svg>', width: 720, height: 260 },
  stats: { objects: 2, relationships: 1, shownObjects: 2, shownRelationships: 1, truncated: false },
  table: { headers: ['Name', 'Type'], rows: [['Payroll', 'Application'], ['Employee', 'DataEntity']], totalRows: 2, relationshipHeaders: ['From', 'Relationship', 'To'], relationshipRows: [['Payroll', 'uses', 'Employee']] },
};

let imageShouldFail = false;
let anchor: any;
beforeEach(() => {
  mockIsAR = false;
  imageShouldFail = false;
  mockPptx.slides = 0;
  mockPptx.writeFile.mockResolvedValue(undefined);
  // jsdom never loads images or draws on canvas - stand in for both.
  (global as any).Image = class {
    onload: any; onerror: any;
    set src(_v: string) { setTimeout(() => (imageShouldFail ? this.onerror() : this.onload()), 0) }
  };
  (global as any).URL.createObjectURL = jest.fn(() => 'blob:x');
  (global as any).URL.revokeObjectURL = jest.fn();
  const create = document.createElement.bind(document);
  anchor = null;
  jest.spyOn(document, 'createElement').mockImplementation((tag: string, opts?: any) => {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => ({ fillRect: () => {}, drawImage: () => {}, fillStyle: '' }), toDataURL: () => 'data:image/png;base64,x', toBlob: (cb: any) => cb(new Blob(['png'])) } as any;
    }
    const el = create(tag, opts);
    if (tag === 'a') { anchor = el; (el as any).click = jest.fn(); }
    return el;
  });
});
afterEach(() => { (document.createElement as any).mockRestore?.(); });

describe('CopilotViewAttachments', () => {
  it('renders nothing when the answer has no rendered view (or something that is not one)', () => {
    const { container } = render(<CopilotViewAttachments attachments={[{ kind: 'OTHER' }, { kind: 'VIEW_RENDER', image: { svg: '<script>' } }]} />);
    expect(container.firstChild).toBeNull();
    expect(render(<CopilotViewAttachments />).container.firstChild).toBeNull();
  });

  it('shows the view picture inline with what it shows, a help tip and a link to the saved view', () => {
    render(<CopilotViewAttachments attachments={[ATTACHMENT]} />);
    const img = screen.getByAltText('Application Integration') as HTMLImageElement;
    expect(img.src).toBe(svgDataUrl(ATTACHMENT.image.svg));
    expect(screen.getByText(/GRAPH · CURRENT · Current · 2 copilot.view.objects · 1 copilot.view.relationships/)).toBeInTheDocument();
    expect(screen.getByLabelText('common.more_info')).toBeInTheDocument();
    expect(screen.getByText(/copilot.view.open/).closest('a')!.getAttribute('href')).toBe('/ea-views?viewId=v1');
  });

  it('has no "open" link for a View Library viewpoint (it is not a saved view)', () => {
    render(<CopilotViewAttachments attachments={[{ ...ATTACHMENT, source: 'VIEW_LIBRARY', viewId: null, viewpointId: 'vp1' }]} />);
    expect(screen.queryByText(/copilot.view.open/)).toBeNull();
    expect(screen.getByText(/copilot.view.from_library/)).toBeInTheDocument();
  });

  it('uses the Arabic view name and right-to-left layout in Arabic', () => {
    mockIsAR = true;
    render(<CopilotViewAttachments attachments={[ATTACHMENT]} />);
    expect(screen.getByAltText('تكامل التطبيقات')).toBeInTheDocument();
    expect(screen.getByTestId('copilot-view-attachments').getAttribute('dir')).toBe('rtl');
  });

  it('downloads the picture as a PNG', async () => {
    render(<CopilotViewAttachments attachments={[ATTACHMENT]} />);
    fireEvent.click(screen.getByText(/copilot.view.download_png/));
    await waitFor(() => expect(anchor?.click).toHaveBeenCalled());
    expect(anchor.download).toBe('Application-Integration.png');
  });

  it('builds a deck with the picture, the question and the objects and relationships behind it', async () => {
    render(<CopilotViewAttachments attachments={[ATTACHMENT]} question="Which applications use employee data?" />);
    fireEvent.click(screen.getByText(/copilot.view.download_deck/));
    await waitFor(() => expect(mockPptx.writeFile).toHaveBeenCalledWith({ fileName: 'Application-Integration.pptx' }));
    expect(mockPptx.slides).toBe(3); // picture, objects, relationships
    expect(mockSlide.addImage).toHaveBeenCalledWith(expect.objectContaining({ data: 'data:image/png;base64,x' }));
    expect(mockSlide.addText.mock.calls.map((c: any[]) => c[0])).toContain('Which applications use employee data?');
    const objectRows = mockSlide.addTable.mock.calls[0][0];
    expect(objectRows[1].map((c: any) => c.text)).toEqual(['Payroll', 'Application']);
    expect(mockSlide.addTable.mock.calls[1][0][1].map((c: any) => c.text)).toEqual(['Payroll', 'uses', 'Employee']);
  });

  it('leads with the deck when the person asked for slides', () => {
    render(<CopilotViewAttachments attachments={[{ ...ATTACHMENT, preferredFormat: 'DECK' }]} />);
    const deck = screen.getByText(/copilot.view.download_deck/) as HTMLElement;
    const png = screen.getByText(/copilot.view.download_png/) as HTMLElement;
    expect(deck.style.fontWeight).toBe('600');
    expect(png.style.fontWeight).toBe('400');
  });

  it('tells the person when the file could not be created', async () => {
    imageShouldFail = true;
    render(<CopilotViewAttachments attachments={[ATTACHMENT]} />);
    fireEvent.click(screen.getByText(/copilot.view.download_png/));
    expect(await screen.findByRole('alert')).toHaveTextContent('copilot.view.export_failed');
  });
});

describe('copilotViewExport helpers', () => {
  it('accepts only real view renders whose image is an SVG', () => {
    expect(isViewAttachment(ATTACHMENT)).toBe(true);
    expect(isViewAttachment({ ...ATTACHMENT, image: { svg: '<img onerror=x>' } })).toBe(false);
    expect(isViewAttachment(null)).toBe(false);
  });

  it('makes safe file names and keeps Arabic names readable', () => {
    expect(attachmentFileName({ title: 'A/B: <C>?' }, 'png')).toBe('AB-C.png');
    expect(attachmentFileName({ title: 'تكامل التطبيقات' }, 'pptx')).toBe('تكامل-التطبيقات.pptx');
    expect(attachmentFileName({ title: '' }, 'png')).toBe('view.png');
  });
});
