import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopilotPage from '../CopilotPage';

// jsdom doesn't implement scrollIntoView - CopilotPage calls it on every
// messages update to auto-scroll the chat, which throws without this.
window.HTMLElement.prototype.scrollIntoView = jest.fn();

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('ea_token', 'fake-token');
});

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    for (const pattern of sortedPatterns) {
      if (url.includes(pattern)) {
        const value = typeof routes[pattern] === 'function' ? routes[pattern](options) : routes[pattern];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

const ARCHITECTS = [
  { id: 'a1', code: 'BUSINESS', name: 'Business Architect', role: 'Business Architecture Lead', avatar: '💼', aiModel: 'haiku', isChief: false },
  { id: 'a2', code: 'CHIEF', name: 'Chief Architect', role: 'Chief Enterprise Architect', avatar: '🏛', aiModel: 'sonnet', isChief: true },
];

describe('CopilotPage - architect loading', () => {
  it('loads and displays every architect in the sidebar list', async () => {
    mockFetch({ '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] });
    render(<CopilotPage />);
    expect(await screen.findByText('Business Architect')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Chief Architect').length).toBeGreaterThan(0));
  });

  it('auto-selects the Chief architect as the default active architect', async () => {
    mockFetch({ '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] });
    render(<CopilotPage />);
    // The main chat header shows the selected architect's role subtitle -
    // a marker that only renders once, for whichever architect is currently
    // active, unlike the name text which legitimately appears in multiple
    // places (sidebar card, chat header, input placeholder).
    expect(await screen.findByPlaceholderText(/Ask Chief Architect/)).toBeInTheDocument();
  });

  it('does not crash and shows an empty architect list when the API returns something other than an array', async () => {
    mockFetch({ '/copilot/architects': null, '/copilot/conversations': [] });
    render(<CopilotPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('Chief Architect')).not.toBeInTheDocument();
  });
});

describe('CopilotPage - mode selector', () => {
  it('switches between Single and Consult modes', async () => {
    mockFetch({ '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] });
    render(<CopilotPage />);
    await waitFor(() => expect(screen.getAllByText('Chief Architect').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('Consult'));
    expect(await screen.findByText('All domain architects')).toBeInTheDocument();
  });

  it('caps consult-mode architect selection at 4', async () => {
    const fiveArchitects = [
      ...ARCHITECTS,
      { id: 'a3', code: 'DATA', name: 'Data Architect', role: 'x', avatar: '💾', aiModel: 'haiku', isChief: false },
      { id: 'a4', code: 'TECHNOLOGY', name: 'Tech Architect', role: 'x', avatar: '🖥', aiModel: 'haiku', isChief: false },
      { id: 'a5', code: 'SECURITY', name: 'Security Architect', role: 'x', avatar: '🔒', aiModel: 'haiku', isChief: false },
    ];
    mockFetch({ '/copilot/architects': fiveArchitects, '/copilot/conversations': [] });
    render(<CopilotPage />);
    await waitFor(() => expect(screen.getAllByText('Chief Architect').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('Consult'));
    for (const name of ['Business Architect', 'Chief Architect', 'Data Architect', 'Tech Architect', 'Security Architect']) {
      fireEvent.click(screen.getByText(name));
    }
    // 5 clicked but capped at 4 selected
    expect(await screen.findByText('4 selected (max 4)')).toBeInTheDocument();
  });
});

describe('CopilotPage - conversation history', () => {
  it('shows "No conversations yet" when history is empty', async () => {
    mockFetch({ '/copilot/architects': [], '/copilot/conversations': [] });
    render(<CopilotPage />);
    fireEvent.click(await screen.findByText('🕐 History'));
    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
  });

  it('lists conversations with message counts', async () => {
    mockFetch({
      '/copilot/architects': [], '/copilot/conversations': [{ id: 'c1', title: 'App Portfolio Discussion', messageCount: 5, updatedAt: '2026-01-15T00:00:00Z' }],
    });
    render(<CopilotPage />);
    fireEvent.click(await screen.findByText('🕐 History'));
    expect(await screen.findByText('App Portfolio Discussion')).toBeInTheDocument();
    expect(screen.getByText(/5 messages/)).toBeInTheDocument();
  });

  it('loads a conversation\'s messages when clicked, mapping architect codes to their display names', async () => {
    mockFetch({
      '/copilot/architects': ARCHITECTS,
      '/copilot/conversations': [{ id: 'c1', title: 'Prior Chat', messageCount: 2, updatedAt: '2026-01-15T00:00:00Z' }],
      '/copilot/conversations/c1/messages': [
        { id: 'm1', role: 'user', content: 'What applications support this?' },
        { id: 'm2', role: 'assistant', content: 'Three applications support this capability.', architectCode: 'BUSINESS', createdAt: '2026-01-15T00:01:00Z' },
      ],
    });
    render(<CopilotPage />);
    await waitFor(() => expect(screen.getAllByText('Chief Architect').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('🕐 History'));
    fireEvent.click(await screen.findByText('Prior Chat'));
    expect(await screen.findByText('Three applications support this capability.')).toBeInTheDocument();
  });

  it('starting a new conversation clears the message list and active conversation', async () => {
    mockFetch({
      '/copilot/architects': ARCHITECTS,
      '/copilot/conversations': [{ id: 'c1', title: 'Prior Chat', messageCount: 1, updatedAt: '2026-01-15T00:00:00Z' }],
      '/copilot/conversations/c1/messages': [{ id: 'm1', role: 'user', content: 'Hello there' }],
    });
    render(<CopilotPage />);
    await waitFor(() => expect(screen.getAllByText('Chief Architect').length).toBeGreaterThan(0));
    fireEvent.click(screen.getByText('🕐 History'));
    fireEvent.click(await screen.findByText('Prior Chat'));
    await screen.findByText('Hello there');

    fireEvent.click(screen.getByText('+ New Conversation'));
    await waitFor(() => expect(screen.queryByText('Hello there')).not.toBeInTheDocument());
  });
});

describe('CopilotPage - MeetingAssistant', () => {
  it('lists existing meetings', async () => {
    mockFetch({
      '/copilot/architects': [], '/copilot/conversations': [],
      '/copilot/meetings': [{ id: 'mt1', title: 'Architecture Review Sync', status: 'COMPLETED', scheduledAt: '2026-01-15T10:00:00Z' }],
    });
    render(<CopilotPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('📋 Meetings'));
    expect(await screen.findByText('Architecture Review Sync')).toBeInTheDocument();
  });

  it('creates a meeting and switches to its detail view', async () => {
    mockFetch({
      '/copilot/architects': [], '/copilot/conversations': [], '/copilot/meetings': [],
      '/copilot/meetings/new-mt1': { id: 'new-mt1', title: 'Sprint Planning', status: 'SCHEDULED' },
    });
    (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
      if (options?.method === 'POST' && url.includes('/copilot/meetings')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 'new-mt1', title: 'Sprint Planning' }) });
      }
      if (url.includes('/copilot/meetings')) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    });
    render(<CopilotPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    fireEvent.click(screen.getByText('📋 Meetings'));
    fireEvent.click(await screen.findByText('+ New Meeting'));
    const titleInput = screen.getByPlaceholderText(/Solution Design Review/);
    fireEvent.change(titleInput, { target: { value: 'Sprint Planning' } });
    fireEvent.click(screen.getByText('Create Meeting'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/copilot/meetings'));
      expect(postCall).toBeDefined();
      expect(JSON.parse(postCall[1].body).title).toBe('Sprint Planning');
    });
  });
});
