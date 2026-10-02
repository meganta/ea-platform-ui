import { fetchStudyExport } from '../studyExport';

const respond = (status: number, body: any = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body, blob: async () => new Blob(['file']) });

describe('fetchStudyExport', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  it('keeps asking while the API is preparing a large study, reporting progress, then returns the file', async () => {
    const calls: number[] = [];
    (global as any).fetch = jest.fn()
      .mockResolvedValueOnce(respond(202, { status: 'PREPARING', translated: 8, total: 40 }))
      .mockResolvedValueOnce(respond(202, { status: 'PREPARING', translated: 32, total: 40 }))
      .mockResolvedValueOnce(respond(200));
    const blob = await fetchStudyExport('/x', 'tok', { retryMs: 1, onPreparing: p => calls.push(p.translated) });
    expect(blob).toBeInstanceOf(Blob);
    expect(calls).toEqual([8, 32]);
    expect((global as any).fetch).toHaveBeenCalledTimes(3);
    expect((global as any).fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
  });

  it('surfaces the API\'s own error message', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(respond(400, { message: 'The translation provider has no available quota or credit.' }));
    await expect(fetchStudyExport('/x', 'tok')).rejects.toThrow('no available quota');
  });

  it('falls back to the given message when the error has none', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({ status: 504, ok: false, json: async () => { throw new Error('html'); } });
    await expect(fetchStudyExport('/x', 'tok', { fallbackMessage: 'Could not export' })).rejects.toThrow('Could not export');
  });

  it('stops waiting after the maximum time, saying the work so far is kept', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue(respond(202, { translated: 1, total: 9 }));
    await expect(fetchStudyExport('/x', 'tok', { retryMs: 1, maxWaitMs: 0 })).rejects.toThrow(/kept/);
  });
});
