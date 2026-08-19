import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KnowledgePage from '../KnowledgePage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key }),
}));

const mockGetDocuments = jest.fn();
const mockSearchKnowledge = jest.fn();
jest.mock('../../lib/api', () => ({
  api: {
    getDocuments: () => mockGetDocuments(),
    searchKnowledge: (q: string) => mockSearchKnowledge(q),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('ea_token', 'fake-token');
  mockGetDocuments.mockResolvedValue([]);
});

const SAMPLE_DOC = { id: 'd1', name: 'EA Strategy 2027.pdf', type: 'STRATEGY', language: 'EN', chunkCount: 12, status: 'READY' };

describe('KnowledgePage - documents tab', () => {
  it('shows the empty state when there are no documents', async () => {
    render(<KnowledgePage />);
    expect(await screen.findByText('know.no_docs')).toBeInTheDocument();
  });

  it('lists uploaded documents with their metadata', async () => {
    mockGetDocuments.mockResolvedValue([SAMPLE_DOC]);
    render(<KnowledgePage />);
    expect(await screen.findByText(/EA Strategy 2027.pdf/)).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
  });

  it('decodes a URL-encoded (e.g. Arabic) filename for display', async () => {
    mockGetDocuments.mockResolvedValue([{ ...SAMPLE_DOC, name: encodeURIComponent('استراتيجية البنية المؤسسية.pdf') }]);
    render(<KnowledgePage />);
    expect(await screen.findByText(/استراتيجية البنية المؤسسية.pdf/)).toBeInTheDocument();
  });

  it('does not crash on a filename that is not actually URL-encoded (malformed %)', async () => {
    mockGetDocuments.mockResolvedValue([{ ...SAMPLE_DOC, name: '100% Complete Report.pdf' }]);
    render(<KnowledgePage />);
    expect(await screen.findByText(/100% Complete Report.pdf/)).toBeInTheDocument();
  });

  it('gracefully shows the empty state (not a crash) when loading documents fails', async () => {
    mockGetDocuments.mockRejectedValue(new Error('network error'));
    render(<KnowledgePage />);
    expect(await screen.findByText('know.no_docs')).toBeInTheDocument();
  });

  it('deletes a document after confirmation', async () => {
    mockGetDocuments.mockResolvedValue([SAMPLE_DOC]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByText('🗑'));

    await waitFor(() => {
      const deleteCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'DELETE');
      expect(deleteCall).toBeDefined();
      expect(deleteCall[0]).toContain('/knowledge/documents/d1');
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when the confirmation dialog is cancelled', async () => {
    mockGetDocuments.mockResolvedValue([SAMPLE_DOC]);
    global.fetch = jest.fn();
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByText('🗑'));
    expect(global.fetch).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe('KnowledgePage - upload', () => {
  it('shows a success message with the chunk count after a successful upload', async () => {
    mockGetDocuments.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ chunkCount: 8 }) });
    render(<KnowledgePage />);
    await screen.findByText('know.no_docs');
    fireEvent.click(screen.getByText(/⬆ /));
    fireEvent.click(screen.getByText(/STRATEGY/));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'strategy.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/8 chunk\(s\) indexed/)).toBeInTheDocument();
  });

  it('shows an error message when upload fails', async () => {
    mockGetDocuments.mockResolvedValue([]);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 413, json: () => Promise.resolve({ message: 'File too large' }) });
    render(<KnowledgePage />);
    await screen.findByText('know.no_docs');
    fireEvent.click(screen.getByText(/⬆ /));
    fireEvent.click(screen.getByText('POLICY'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'huge.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText(/File too large/)).toBeInTheDocument();
  });

  it('sends the selected document type in the upload form data', async () => {
    mockGetDocuments.mockResolvedValue([]);
    let capturedFormData: FormData | null = null;
    global.fetch = jest.fn().mockImplementation((url: string, opts: any) => {
      if (opts?.body instanceof FormData) capturedFormData = opts.body;
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ chunkCount: 1 }) });
    });
    render(<KnowledgePage />);
    await screen.findByText('know.no_docs');
    fireEvent.click(screen.getByText(/⬆ /));
    fireEvent.click(screen.getByText('REGULATION'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'reg.pdf')] } });

    await waitFor(() => expect(capturedFormData).not.toBeNull());
    expect(capturedFormData!.get('type')).toBe('REGULATION');
  });

  it('errors clearly when there is no auth token, without attempting the upload request', async () => {
    localStorage.removeItem('ea_token');
    mockGetDocuments.mockResolvedValue([]);
    global.fetch = jest.fn();
    render(<KnowledgePage />);
    await screen.findByText('know.no_docs');
    fireEvent.click(screen.getByText(/⬆ /));
    fireEvent.click(screen.getByText('CUSTOM'));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'x.pdf')] } });

    expect(await screen.findByText(/Not authenticated/)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('KnowledgePage - search tab', () => {
  it('does not search on an empty/whitespace-only query', async () => {
    mockGetDocuments.mockResolvedValue([]);
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByText('know.search'));
    fireEvent.change(screen.getByPlaceholderText('know.placeholder'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText(/know.search_btn/));
    expect(mockSearchKnowledge).not.toHaveBeenCalled();
  });

  it('displays search results with a formatted relevance score', async () => {
    mockGetDocuments.mockResolvedValue([]);
    mockSearchKnowledge.mockResolvedValue([{ documentName: 'Policy.pdf', score: 0.873, content: 'Relevant excerpt text.' }]);
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByText('know.search'));
    fireEvent.change(screen.getByPlaceholderText('know.placeholder'), { target: { value: 'data governance' } });
    fireEvent.click(screen.getByText(/know.search_btn/));

    expect(await screen.findByText('Relevant excerpt text.')).toBeInTheDocument();
    expect(screen.getByText(/87.3%/)).toBeInTheDocument();
  });

  it('triggers search on Enter key press, not only the button click', async () => {
    mockGetDocuments.mockResolvedValue([]);
    mockSearchKnowledge.mockResolvedValue([]);
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByText('know.search'));
    const input = screen.getByPlaceholderText('know.placeholder');
    fireEvent.change(input, { target: { value: 'test query' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(mockSearchKnowledge).toHaveBeenCalledWith('test query'));
  });

  it('shows the no-results message only after a real search with zero matches', async () => {
    mockGetDocuments.mockResolvedValue([]);
    mockSearchKnowledge.mockResolvedValue([]);
    render(<KnowledgePage />);
    fireEvent.click(await screen.findByText('know.search'));
    expect(screen.queryByText('know.no_results')).not.toBeInTheDocument(); // not shown before any search
    fireEvent.change(screen.getByPlaceholderText('know.placeholder'), { target: { value: 'nothing matches' } });
    fireEvent.click(screen.getByText(/know.search_btn/));
    expect(await screen.findByText('know.no_results')).toBeInTheDocument();
  });
});
