import {
  exportAsJSON,
  exportNodesAsCSV,
  exportMatrixAsCSV,
  exportRoadmapAsCSV,
  exportGraphAsSVG,
  exportGraphAsPNG,
  renderGraphToCanvas,
  exportGraphAsPDF,
  exportNodesAsPDF,
  exportMatrixAsPDF,
  exportRoadmapAsPDF,
  exportGraphAsPPTX,
  exportNodesAsPPTX,
  exportMatrixAsPPTX,
  exportRoadmapAsPPTX,
} from '../exportUtils';

// jsPDF and pptxgenjs are heavy third-party rendering/layout libraries -
// these tests verify THIS file's code calls the right methods with
// sensible arguments (title text, image data, table rows), not that the
// libraries themselves produce correct binary PDF/PPTX output - parsing
// real binary output isn't reasonable for a unit test, and isn't this
// file's responsibility to verify anyway.
const mockJsPdfDoc = {
  setFontSize: jest.fn(), setTextColor: jest.fn(), setDrawColor: jest.fn(),
  text: jest.fn(), line: jest.fn(), setFont: jest.fn(), addImage: jest.fn(),
  addPage: jest.fn(), save: jest.fn(),
  internal: { pageSize: { getWidth: () => 800, getHeight: () => 600 } },
};
jest.mock('jspdf', () => ({ jsPDF: jest.fn(() => mockJsPdfDoc) }));

const mockPptxSlide = { addText: jest.fn(), addImage: jest.fn(), addTable: jest.fn() };
const mockPptxInstance = { defineLayout: jest.fn(), layout: '', addSlide: jest.fn(() => mockPptxSlide), writeFile: jest.fn().mockResolvedValue(undefined) };
jest.mock('pptxgenjs', () => ({ __esModule: true, default: jest.fn(() => mockPptxInstance) }));

// JSDOM does not implement URL.createObjectURL/revokeObjectURL at all -
// every exporter in this file goes through them via the shared
// downloadBlob() helper, so every test here needs this mocked or the call
// throws "URL.createObjectURL is not a function".
describe('exportUtils', () => {
  let clickSpy: jest.Mock;
  let createdAnchor: Partial<HTMLAnchorElement>;
  let mockCanvasContext: any;
  let mockCanvas: Partial<HTMLCanvasElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    (global as any).URL.revokeObjectURL = jest.fn();
    clickSpy = jest.fn();
    createdAnchor = { href: '', download: '', click: clickSpy, style: {} as any };

    // JSDOM's canvas is a no-op stub without the separate `canvas` npm
    // package (not installed in this project) - getContext('2d') returns
    // null, toBlob/toDataURL do nothing meaningful. Mocked here so
    // renderGraphToCanvas (and everything built on it: PNG/PDF/PPTX graph
    // export) has something real to call.
    mockCanvasContext = { fillStyle: '', fillRect: jest.fn(), drawImage: jest.fn() };
    mockCanvas = {
      width: 0, height: 0,
      getContext: jest.fn(() => mockCanvasContext) as any,
      toDataURL: jest.fn(() => 'data:image/png;base64,mockdata'),
      toBlob: jest.fn((cb: BlobCallback) => cb(new Blob(['fake-png-bytes'], { type: 'image/png' }))),
    };

    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return createdAnchor as HTMLAnchorElement;
      if (tag === 'canvas') return mockCanvas as HTMLCanvasElement;
      return originalCreateElement(tag);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);

    // JSDOM's Image never actually decodes a blob: URL (no real image
    // pipeline), so onload never fires on its own - this mock simulates a
    // successful load via a microtask, which flushes naturally on the
    // next `await` without needing fake-timer advancement (a macrotask/
    // setTimeout approach would need that, and mixing it with the async
    // Promise chains under test here is more fragile than it's worth).
    class MockImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) { Promise.resolve().then(() => this.onload?.()); }
    }
    (global as any).Image = MockImage;

    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  const META = { viewName: 'App Landscape', architectureState: 'CURRENT', generatedAt: '2026-01-01T00:00:00.000Z' };

  describe('exportAsJSON', () => {
    it('creates a Blob, triggers a download with a sanitized filename, and includes an export-metadata block', () => {
      exportAsJSON({ nodes: [{ id: 'a1', name: 'App A' }] }, META);
      expect((global as any).URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(createdAnchor.download).toBe('App-Landscape.json');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('embeds the actual data payload and metadata inside the exported JSON content', async () => {
      exportAsJSON({ nodes: ['x'] }, META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      const parsed = JSON.parse(text);
      expect(parsed.exportMetadata.viewName).toBe('App Landscape');
      expect(parsed.exportMetadata.architectureState).toBe('CURRENT');
      expect(parsed.data.nodes).toEqual(['x']);
    });

    it('sanitizes special characters out of the filename', () => {
      exportAsJSON({}, { viewName: 'Q4 2026: App/Tech "Portfolio"!' });
      expect(createdAnchor.download).toMatch(/^[a-zA-Z0-9-]+\.json$/);
    });
  });

  describe('exportNodesAsCSV', () => {
    it('writes one row per node with the expected columns', async () => {
      exportNodesAsCSV([{ name: 'App A', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', owner: 'IT Team', description: 'Core system' }], META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('App A,Application,APPLICATION,APPROVED,IT Team,Core system');
      expect(createdAnchor.download).toBe('App-Landscape.csv');
    });

    it('quotes and escapes a field containing a comma', async () => {
      exportNodesAsCSV([{ name: 'App, Inc.', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED' }], META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('"App, Inc."');
    });

    it('doubles up an embedded quote character rather than breaking the CSV', async () => {
      exportNodesAsCSV([{ name: 'The "Best" App', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED' }], META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('"The ""Best"" App"');
    });

    it('handles a node with no owner/description without crashing or writing "undefined"', async () => {
      exportNodesAsCSV([{ name: 'App A', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED' }], META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).not.toContain('undefined');
    });
  });

  describe('exportMatrixAsCSV', () => {
    it('marks a cell with X when a relationship exists in either direction', async () => {
      const sources = [{ id: 's1', name: 'Capability A' }];
      const targets = [{ id: 't1', name: 'Application B' }];
      const forward = [{ sourceId: 's1', targetId: 't1' }];
      exportMatrixAsCSV(sources, targets, forward, META);
      let blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      let text = await blob.text();
      expect(text).toContain('Capability A,X');

      jest.clearAllMocks();
      (global as any).URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      const reverse = [{ sourceId: 't1', targetId: 's1' }]; // reversed direction - matches the interactive in-viewer matrix's own bidirectional check
      exportMatrixAsCSV(sources, targets, reverse, META);
      blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      text = await blob.text();
      expect(text).toContain('Capability A,X');
    });

    it('leaves the cell blank when no relationship exists', async () => {
      exportMatrixAsCSV([{ id: 's1', name: 'Capability A' }], [{ id: 't1', name: 'Application B' }], [], META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text.trim().endsWith('Capability A,')).toBe(true);
    });

    it('uses a distinct filename suffix from the plain node export', () => {
      exportMatrixAsCSV([], [], [], META);
      expect(createdAnchor.download).toBe('App-Landscape-matrix.csv');
    });
  });

  describe('exportRoadmapAsCSV', () => {
    it('writes one row per timeline item', async () => {
      exportRoadmapAsCSV([{ name: 'Phase 1', start: '2026-01-01', end: '2026-06-01', group: 'PMO', status: 'ACTIVE' }], META);
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const text = await blob.text();
      expect(text).toContain('Phase 1,2026-01-01,2026-06-01,PMO,ACTIVE');
      expect(createdAnchor.download).toBe('App-Landscape-roadmap.csv');
    });
  });

  describe('exportGraphAsSVG', () => {
    it('serializes the given SVG element and triggers a download with the .svg extension', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.textContent = 'App A';
      svg.appendChild(text);
      exportGraphAsSVG(svg, META);
      expect((global as any).URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
      expect(createdAnchor.download).toBe('App-Landscape.svg');
      const blob = ((global as any).URL.createObjectURL as jest.Mock).mock.calls[0][0] as Blob;
      const content = await blob.text();
      expect(content).toContain('App A');
      expect(content).toContain('<?xml version="1.0"');
    });

    it('does not mutate the original, still-live SVG element on screen', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
      svg.setAttribute('style', 'cursor: grab');
      exportGraphAsSVG(svg, META);
      expect(svg.getAttribute('style')).toBe('cursor: grab'); // untouched - only the clone was stripped
    });
  });

  describe('renderGraphToCanvas / exportGraphAsPNG', () => {
    function makeSvg(): SVGSVGElement {
      return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
    }

    it('rasterizes the SVG onto a canvas sized to (a fallback of) the element\'s rendered dimensions', async () => {
      const canvas = await renderGraphToCanvas(makeSvg(), META);
      // JSDOM never returns real layout dimensions from getBoundingClientRect
      // (always 0), so this exercises buildStandaloneSvgMarkup's fallback -
      // 1200x800 at the fixed 2x export scale.
      expect(canvas.width).toBe(2400);
      expect(canvas.height).toBe(1600);
    });

    it('fills the background before drawing the graph, so a transparent PNG does not show as harsh white/black depending on the viewer', async () => {
      await renderGraphToCanvas(makeSvg(), META);
      expect(mockCanvasContext.fillRect).toHaveBeenCalled();
      expect(mockCanvasContext.drawImage).toHaveBeenCalled();
    });

    it('rejects rather than hangs when the canvas 2D context is unavailable', async () => {
      (mockCanvas.getContext as jest.Mock).mockReturnValue(null);
      await expect(renderGraphToCanvas(makeSvg(), META)).rejects.toThrow('Canvas 2D context unavailable');
    });

    it('exportGraphAsPNG downloads the rasterized canvas as a .png file', async () => {
      await exportGraphAsPNG(makeSvg(), META);
      expect(mockCanvas.toBlob).toHaveBeenCalled();
      expect(createdAnchor.download).toBe('App-Landscape.png');
      expect(clickSpy).toHaveBeenCalled();
    });
  });

  describe('exportGraphAsPDF', () => {
    it('writes the view title and generated-date subtitle as the PDF header', async () => {
      await exportGraphAsPDF(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement, META);
      expect(mockJsPdfDoc.text).toHaveBeenCalledWith('App Landscape', 40, 40);
      expect(mockJsPdfDoc.text).toHaveBeenCalledWith(expect.stringContaining('2026-01-01'), 40, 56);
    });

    it('embeds the rasterized graph image and saves with a .pdf extension', async () => {
      await exportGraphAsPDF(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement, META);
      expect(mockJsPdfDoc.addImage).toHaveBeenCalledWith('data:image/png;base64,mockdata', 'PNG', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number));
      expect(mockJsPdfDoc.save).toHaveBeenCalledWith('App-Landscape.pdf');
    });

    it('never scales the embedded image up beyond its own rasterized size', async () => {
      // canvas ends up 2400x1600 (see renderGraphToCanvas test above), far
      // larger than the mocked 800x600 page - the image must be scaled
      // DOWN to fit, and the scale factor itself must never exceed 1.
      await exportGraphAsPDF(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement, META);
      const [, , , , w, h] = mockJsPdfDoc.addImage.mock.calls[0];
      expect(w).toBeLessThanOrEqual(2400);
      expect(h).toBeLessThanOrEqual(1600);
    });
  });

  describe('exportNodesAsPDF / exportMatrixAsPDF / exportRoadmapAsPDF', () => {
    it('draws the node table headers and saves with the plain view filename', async () => {
      await exportNodesAsPDF([{ name: 'App A', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED', owner: 'IT' }], META);
      expect(mockJsPdfDoc.text).toHaveBeenCalledWith('Name', expect.any(Number), expect.any(Number));
      expect(mockJsPdfDoc.text).toHaveBeenCalledWith(expect.stringContaining('App A'), expect.any(Number), expect.any(Number));
      expect(mockJsPdfDoc.save).toHaveBeenCalledWith('App-Landscape.pdf');
    });

    it('paginates when rows would run past the bottom margin', async () => {
      // page height mocked to 600pt, row height 18pt, header ~90pt - well
      // under 30 rows needed to force a second page.
      const manyNodes = Array.from({ length: 60 }, (_, i) => ({ name: `App ${i}`, assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED' }));
      await exportNodesAsPDF(manyNodes, META);
      expect(mockJsPdfDoc.addPage).toHaveBeenCalled();
    });

    it('exportMatrixAsPDF saves with the -matrix filename suffix', async () => {
      await exportMatrixAsPDF([{ id: 's1', name: 'Cap A' }], [{ id: 't1', name: 'App B' }], [], META);
      expect(mockJsPdfDoc.save).toHaveBeenCalledWith('App-Landscape-matrix.pdf');
    });

    it('exportRoadmapAsPDF saves with the -roadmap filename suffix', async () => {
      await exportRoadmapAsPDF([{ name: 'Phase 1', start: '2026-01-01', end: '2026-06-01', group: 'PMO', status: 'ACTIVE' }], META);
      expect(mockJsPdfDoc.save).toHaveBeenCalledWith('App-Landscape-roadmap.pdf');
    });
  });

  describe('exportGraphAsPPTX', () => {
    it('adds a title slide with the view name and metadata subtitle', async () => {
      await exportGraphAsPPTX(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement, META);
      expect(mockPptxSlide.addText).toHaveBeenCalledWith('App Landscape', expect.objectContaining({ bold: true }));
      expect(mockPptxSlide.addText).toHaveBeenCalledWith(expect.stringContaining('CURRENT'), expect.anything());
    });

    it('embeds the rasterized graph image and writes a .pptx file', async () => {
      await exportGraphAsPPTX(document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement, META);
      expect(mockPptxSlide.addImage).toHaveBeenCalledWith(expect.objectContaining({ data: 'data:image/png;base64,mockdata' }));
      expect(mockPptxInstance.writeFile).toHaveBeenCalledWith({ fileName: 'App-Landscape.pptx' });
    });
  });

  describe('exportNodesAsPPTX / exportMatrixAsPPTX / exportRoadmapAsPPTX', () => {
    it('builds a native table with a bold header row and one row per node', async () => {
      await exportNodesAsPPTX([{ name: 'App A', assetType: 'Application', domain: 'APPLICATION', status: 'APPROVED' }], META);
      const [tableRows] = mockPptxSlide.addTable.mock.calls[0];
      expect(tableRows[0][0]).toEqual(expect.objectContaining({ text: 'Name', options: expect.objectContaining({ bold: true }) }));
      expect(tableRows[1][0]).toEqual({ text: 'App A' });
    });

    it('exportMatrixAsPPTX writes with the -matrix filename suffix', async () => {
      await exportMatrixAsPPTX([{ id: 's1', name: 'Cap A' }], [{ id: 't1', name: 'App B' }], [], META);
      expect(mockPptxInstance.writeFile).toHaveBeenCalledWith({ fileName: 'App-Landscape-matrix.pptx' });
    });

    it('exportRoadmapAsPPTX writes with the -roadmap filename suffix', async () => {
      await exportRoadmapAsPPTX([{ name: 'Phase 1', start: '2026-01-01', end: '2026-06-01', group: 'PMO', status: 'ACTIVE' }], META);
      expect(mockPptxInstance.writeFile).toHaveBeenCalledWith({ fileName: 'App-Landscape-roadmap.pptx' });
    });
  });
});
