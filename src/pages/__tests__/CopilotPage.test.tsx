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

// Phase 1: evidence-grounded Copilot's evidence drawer. No prior test in
// this file exercised the streaming send() flow at all (streamSse() reads
// a real ReadableStream via res.body.getReader(), which the plain
// {ok, json} shape mockFetch() returns cannot satisfy) - this is the
// first coverage for that path, built around a minimal fake reader
// emitting the same `data: {...}\n\n` SSE framing the real backend sends.
function makeSseBody(events: any[]) {
  const chunks = events.map(e => `data: ${JSON.stringify(e)}\n\n`);
  let i = 0;
  return {
    getReader: () => ({
      read: () => {
        if (i < chunks.length) {
          const chunk = new TextEncoder().encode(chunks[i]);
          i += 1;
          return Promise.resolve({ done: false, value: chunk });
        }
        return Promise.resolve({ done: true, value: undefined });
      },
    }),
  };
}

function mockFetchWithSse(jsonRoutes: Record<string, any>, sseRoutes: Record<string, any[]>) {
  const sortedJsonPatterns = Object.keys(jsonRoutes).sort((a, b) => b.length - a.length);
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    for (const pattern of Object.keys(sseRoutes)) {
      if (url.includes(pattern)) return Promise.resolve({ ok: true, body: makeSseBody(sseRoutes[pattern]) });
    }
    for (const pattern of sortedJsonPatterns) {
      if (url.includes(pattern)) {
        const value = typeof jsonRoutes[pattern] === 'function' ? jsonRoutes[pattern](options) : jsonRoutes[pattern];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(value) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as any;
}

const AUTHORITATIVE_EVIDENCE = [
  { sourceType: 'EA_ASSET', sourceId: 'asset-1', title: 'Payment Gateway', excerpt: 'Core payment processing service', assetType: 'APPLICATION', domain: 'APPLICATION', version: '1.0', status: 'APPROVED', validityClassification: 'CURRENT', sourceAuthorityLevel: 'AUTHORITATIVE', effectiveFrom: null, effectiveUntil: null, retrievalReason: 'EXACT_NAME_MATCH', score: 1.0, targetRef: { type: 'EA_ASSET', id: 'asset-1' } },
];

describe('CopilotPage - evidence drawer (Copilot Phase 1)', () => {
  const openSpy = jest.fn();
  beforeEach(() => { window.open = openSpy; openSpy.mockClear(); });

  it('shows a sources toggle after a single-architect chat response arrives with evidence, and none when there is no evidence', async () => {
    mockFetchWithSse(
      { '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] },
      { '/copilot/chat': [
        { type: 'meta', conversationId: 'conv-1' },
        { type: 'text', content: 'The payment gateway is our core service.' },
        { type: 'done', conversationId: 'conv-1', evidence: AUTHORITATIVE_EVIDENCE },
      ] },
    );
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    const input = screen.getByPlaceholderText(/Enter to send/);
    fireEvent.change(input, { target: { value: 'Tell me about the payment gateway' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('🔍 1 source ▼')).toBeInTheDocument();
  });

  it('expands the drawer on click to show the evidence item, its authority label, and a working source link', async () => {
    mockFetchWithSse(
      { '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] },
      { '/copilot/chat': [
        { type: 'meta', conversationId: 'conv-1' },
        { type: 'text', content: 'answer' },
        { type: 'done', conversationId: 'conv-1', evidence: AUTHORITATIVE_EVIDENCE },
      ] },
    );
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    const input = screen.getByPlaceholderText(/Enter to send/);
    fireEvent.change(input, { target: { value: 'Tell me about the payment gateway' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.click(await screen.findByText('🔍 1 source ▼'));
    expect(await screen.findByText('Payment Gateway')).toBeInTheDocument();
    expect(screen.getByText('Authoritative')).toBeInTheDocument();
    expect(screen.getByText('Core payment processing service')).toBeInTheDocument();

    fireEvent.click(screen.getByText('View source →'));
    expect(openSpy).toHaveBeenCalledWith('/repository?assetId=asset-1', '_blank');
  });

  it('shows no sources toggle at all when the response has no evidence (most generic questions)', async () => {
    mockFetchWithSse(
      { '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] },
      { '/copilot/chat': [
        { type: 'meta', conversationId: 'conv-1' },
        { type: 'text', content: 'A generic best-practice answer.' },
        { type: 'done', conversationId: 'conv-1', evidence: [] },
      ] },
    );
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    const input = screen.getByPlaceholderText(/Enter to send/);
    fireEvent.change(input, { target: { value: 'What is TOGAF?' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await screen.findByText('A generic best-practice answer.');
    expect(screen.queryByText(/🔍.*source/)).not.toBeInTheDocument();
  });

  it('shows a sources toggle per architect response in consult mode', async () => {
    mockFetchWithSse(
      { '/copilot/architects': ARCHITECTS, '/copilot/conversations': [] },
      { '/copilot/consult': [
        { type: 'meta', conversationId: 'conv-1' },
        { type: 'architect_response', architectCode: 'BUSINESS', architectName: 'Business Architect', content: 'Business perspective.', evidence: AUTHORITATIVE_EVIDENCE },
        { type: 'done', conversationId: 'conv-1' },
      ] },
    );
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    fireEvent.click(screen.getByText('Consult'));
    const input = screen.getByPlaceholderText(/Ask all selected architects/);
    fireEvent.change(input, { target: { value: 'Compare our options' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(await screen.findByText('🔍 1 source ▼')).toBeInTheDocument();
  });
});

describe('CopilotPage - Task Playbooks (Copilot Phase 2)', () => {
  const PLAYBOOKS = [
    { id: 'ARCHITECTURE_IMPACT_ANALYSIS', name: 'Architecture Impact Analysis', description: 'Assess ripple effects.', requiredInputs: ['subject'], optionalInputs: ['scopeRefId'] },
    { id: 'DUPLICATION_REUSE_ANALYSIS', name: 'Application/Technology Duplication and Reuse Analysis', description: 'Find overlap.', requiredInputs: ['subject'], optionalInputs: [] },
  ];

  it('lists available playbooks and lets the user pick one, showing its input form', async () => {
    mockFetch({ '/copilot/architects': ARCHITECTS, '/copilot/conversations': [], '/copilot/playbooks': PLAYBOOKS });
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    fireEvent.click(screen.getByText('🧭 Playbooks'));

    expect(await screen.findByText('Architecture Impact Analysis')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Architecture Impact Analysis'));

    expect(await screen.findByText(/subject \*/)).toBeInTheDocument();
    expect(screen.getByText(/scopeRefId \(optional\)/)).toBeInTheDocument();
  });

  it('previews the resolved architects and evidence before running, without spending an AI call', async () => {
    mockFetch({
      '/copilot/architects': ARCHITECTS, '/copilot/conversations': [], '/copilot/playbooks': PLAYBOOKS,
      '/copilot/playbooks/ARCHITECTURE_IMPACT_ANALYSIS/preview': (opts: any) => ({
        missingInputs: [], resolvedArchitects: [{ code: 'BUSINESS', name: 'Business Architect', avatar: '💼' }],
        missingArchitects: [], willRunChiefSynthesis: false,
        evidencePreview: { items: [{ sourceType: 'EA_ASSET', sourceId: 'a1', title: 'Payment Gateway', excerpt: 'Core service', sourceAuthorityLevel: 'AUTHORITATIVE' }], conflicts: [] },
      }),
    });
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    fireEvent.click(screen.getByText('🧭 Playbooks'));
    fireEvent.click(await screen.findByText('Architecture Impact Analysis'));

    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'migrating core banking' } });
    fireEvent.click(screen.getByText('Preview'));

    expect(await screen.findByText('💼 Business Architect')).toBeInTheDocument();
    expect(await screen.findByText('🔍 1 source ▼')).toBeInTheDocument();

    const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/copilot/playbooks/ARCHITECTURE_IMPACT_ANALYSIS/preview'));
    expect(JSON.parse(postCall[1].body).inputs.subject).toBe('migrating core banking');
  });

  it('runs the playbook and renders each domain response plus the Chief synthesis and suggested next step', async () => {
    mockFetch({
      '/copilot/architects': ARCHITECTS, '/copilot/conversations': [], '/copilot/playbooks': PLAYBOOKS,
      '/copilot/playbooks/ARCHITECTURE_IMPACT_ANALYSIS/preview': { missingInputs: [], resolvedArchitects: [{ code: 'BUSINESS', name: 'Business Architect', avatar: '💼' }], missingArchitects: [], willRunChiefSynthesis: true, evidencePreview: null },
      '/copilot/playbooks/ARCHITECTURE_IMPACT_ANALYSIS/run': {
        playbookId: 'ARCHITECTURE_IMPACT_ANALYSIS', conversationId: 'conv-1',
        domainResponses: [{ architectCode: 'BUSINESS', architectName: '💼 Business Architect', content: 'Business impact analysis text.', evidence: [] }],
        chiefResponse: { architectCode: 'CHIEF', architectName: '🏛 Chief Architect', content: 'Consolidated recommendation text.' },
        targetModule: 'GOVERNANCE_REVIEW',
      },
    });
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    fireEvent.click(screen.getByText('🧭 Playbooks'));
    fireEvent.click(await screen.findByText('Architecture Impact Analysis'));
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'x' } });
    fireEvent.click(screen.getByText('Preview'));
    fireEvent.click(await screen.findByText('Run Playbook'));

    expect(await screen.findByText('Business impact analysis text.')).toBeInTheDocument();
    expect(await screen.findByText('Consolidated recommendation text.')).toBeInTheDocument();
    expect(await screen.findByText(/Suggested next step.*governance review/i)).toBeInTheDocument();
  });

  it('disables the Run button while any required input is still missing', async () => {
    mockFetch({
      '/copilot/architects': ARCHITECTS, '/copilot/conversations': [], '/copilot/playbooks': PLAYBOOKS,
      '/copilot/playbooks/ARCHITECTURE_IMPACT_ANALYSIS/preview': { missingInputs: ['subject'], resolvedArchitects: [], missingArchitects: [], willRunChiefSynthesis: false, evidencePreview: null },
    });
    render(<CopilotPage />);
    await screen.findByText('Business Architect');
    fireEvent.click(screen.getByText('🧭 Playbooks'));
    fireEvent.click(await screen.findByText('Architecture Impact Analysis'));
    fireEvent.click(screen.getByText('Preview'));

    const runButton = await screen.findByText('Run Playbook');
    expect(runButton).toBeDisabled();
  });
});
