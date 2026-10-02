import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopilotDeckCard, { isDeckAttachment } from '../CopilotDeckCard';
import CopilotViewAttachments from '../CopilotViewAttachments';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (k: string) => k, isAR: false }),
}));

const DECK = {
  kind: 'DECK', id: 'deck-1', title: 'Application landscape', language: 'EN', slideCount: 5,
  slideTitles: ['Application landscape', 'We run 42 applications', 'Key findings'], notes: ['Slides beyond 20 were left out.'], generatedAt: '2026-10-02T10:00:00Z',
} as const;

let anchor: any;
beforeEach(() => {
  localStorage.setItem('ea_token', 'tok');
  (global as any).fetch = jest.fn(async () => ({ ok: true, blob: async () => new Blob(['PK']) }));
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
afterEach(() => jest.restoreAllMocks());

test('recognises deck attachments only', () => {
  expect(isDeckAttachment(DECK)).toBe(true);
  expect(isDeckAttachment({ kind: 'STUDY', id: 'x' })).toBe(false);
  expect(isDeckAttachment(null)).toBe(false);
});

test('shows the deck, its slide count and outline, and a help tip', () => {
  render(<CopilotDeckCard attachment={DECK as any} conversationId="c1" />);
  expect(screen.getByText(/Application landscape/)).toBeInTheDocument();
  expect(screen.getByText(/copilot\.deck\.slides/)).toBeInTheDocument();
  expect(screen.getByText(/Slides beyond 20/)).toBeInTheDocument();
  const toggle = screen.getByRole('button', { name: 'copilot.deck.show_outline' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getByText('Key findings')).toBeInTheDocument();
});

test('downloads the PowerPoint from the conversation\'s deck endpoint with the person\'s token', async () => {
  render(<CopilotDeckCard attachment={DECK as any} conversationId="c 1" />);
  fireEvent.click(screen.getByRole('button', { name: /copilot\.deck\.download/ }));
  await waitFor(() => expect(anchor?.click).toHaveBeenCalled());
  const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).toMatch(/\/copilot\/conversations\/c%201\/decks\/deck-1$/);
  expect(init.headers.Authorization).toBe('Bearer tok');
  expect(anchor.download).toBe('Application_landscape_EN.pptx');
});

test('says so when the download fails or the conversation is not open', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });
  const { unmount } = render(<CopilotDeckCard attachment={DECK as any} conversationId="c1" />);
  fireEvent.click(screen.getByRole('button', { name: /copilot\.deck\.download/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('copilot.deck.download_failed');
  unmount();
  render(<CopilotDeckCard attachment={DECK as any} conversationId={null} />);
  fireEvent.click(screen.getByRole('button', { name: /copilot\.deck\.download/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent('copilot.deck.no_conversation');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('appears under the answer among the other attachments', () => {
  render(<CopilotViewAttachments attachments={[DECK, { kind: 'UNKNOWN' }]} conversationId="c1" />);
  expect(screen.getByTestId('copilot-deck-card')).toBeInTheDocument();
});
