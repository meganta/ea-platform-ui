import {
  exportAsJSON,
  exportNodesAsCSV,
  exportMatrixAsCSV,
  exportRoadmapAsCSV,
  exportGraphAsSVG,
} from '../exportUtils';

// JSDOM does not implement URL.createObjectURL/revokeObjectURL at all -
// every exporter in this file goes through them via the shared
// downloadBlob() helper, so every test here needs this mocked or the call
// throws "URL.createObjectURL is not a function".
describe('exportUtils', () => {
  let clickSpy: jest.Mock;
  let createdAnchor: Partial<HTMLAnchorElement>;

  beforeEach(() => {
    (global as any).URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    (global as any).URL.revokeObjectURL = jest.fn();
    clickSpy = jest.fn();
    createdAnchor = { href: '', download: '', click: clickSpy, style: {} as any };
    const originalCreateElement = document.createElement.bind(document);
    jest.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return createdAnchor as HTMLAnchorElement;
      return originalCreateElement(tag);
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((n: any) => n);
    jest.spyOn(document.body, 'removeChild').mockImplementation((n: any) => n);
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
});
