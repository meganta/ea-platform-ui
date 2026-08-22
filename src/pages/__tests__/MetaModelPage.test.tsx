import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MetaModelPage from '../MetaModelPage';

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'fake-token' }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function mockFetch(routes: Record<string, any>) {
  const sortedPatterns = Object.keys(routes).sort((a, b) => b.length - a.length); // most specific first
  global.fetch = jest.fn().mockImplementation((url: string, options?: any) => {
    for (const pattern of sortedPatterns) {
      if (url.includes(pattern)) {
        const routeValue = routes[pattern];
        // A route can be marked as a failure with { __fail: true, status }
        // to exercise error-handling paths, rather than always resolving ok.
        if (routeValue && typeof routeValue === 'object' && routeValue.__fail) {
          return Promise.resolve({ ok: false, status: routeValue.status ?? 500, statusText: 'Error', json: () => Promise.resolve({}), text: () => Promise.resolve('{}') });
        }
        const value = typeof routeValue === 'function' ? routeValue(options) : routeValue;
        return Promise.resolve({ ok: true, json: () => Promise.resolve(value), text: () => Promise.resolve(JSON.stringify(value)) });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}), text: () => Promise.resolve('{}') });
  }) as any;
}

const STATS_WITH_MODEL = { model: { name: 'NORA 2.0 Meta-Model' } };

describe('MetaModelPage - setup gate', () => {
  it('shows the Setup Wizard when no meta-model exists yet for this tenant', async () => {
    mockFetch({ '/meta-model/stats': { model: null } });
    render(<MetaModelPage />);
    expect(await screen.findByText('🏛 EA Meta-Model Studio')).toBeInTheDocument();
    // Tab strip should not render since there's no model yet
    await waitFor(() => expect(screen.queryByText('🗂 Domains')).not.toBeInTheDocument());
  });

  it('shows the full tabbed studio once a meta-model exists', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL });
    render(<MetaModelPage />);
    expect(await screen.findByText('🗂 Domains')).toBeInTheDocument();
    // The model name legitimately renders in two places on a real page load -
    // the header subtitle and the dashboard's own model info card.
    expect(screen.getAllByText('NORA 2.0 Meta-Model').length).toBeGreaterThan(0);
  });
});

describe('MetaModelPage - DomainsManager', () => {
  const SAMPLE_DOMAIN = { id: 'd1', code: 'BUSINESS', name: 'Business Architecture', color: '#3498db', icon: '🏢', _count: { objectTypes: 5 } };

  it('lists domains with their object type counts', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [SAMPLE_DOMAIN] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    expect(await screen.findByText('Business Architecture')).toBeInTheDocument();
    expect(screen.getByText('5 object types')).toBeInTheDocument();
  });

  it('shows the empty state when there are no domains', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    expect(await screen.findByText(/No domains yet/)).toBeInTheDocument();
  });

  it('auto-uppercases and underscores the code field as the user types', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    await screen.findByText(/No domains yet/);
    fireEvent.click(screen.getByText('+ Add Domain'));
    const codeInput = screen.getByPlaceholderText('BUSINESS');
    fireEvent.change(codeInput, { target: { value: 'data architecture' } });
    expect(codeInput).toHaveValue('DATA_ARCHITECTURE');
  });

  it('POSTs a new domain with the entered form data', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    await screen.findByText(/No domains yet/);
    fireEvent.click(screen.getByText('+ Add Domain'));
    fireEvent.change(screen.getByPlaceholderText('BUSINESS'), { target: { value: 'SECURITY' } });
    fireEvent.change(screen.getByPlaceholderText('Business Architecture'), { target: { value: 'Security Architecture' } });
    fireEvent.click(screen.getByText('Create Domain'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/meta-model/domains'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.code).toBe('SECURITY');
      expect(body.name).toBe('Security Architecture');
    });
  });

  it('disables the code field when editing an existing domain (code is immutable after creation)', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [SAMPLE_DOMAIN] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    await screen.findByText('Business Architecture');
    fireEvent.click(screen.getByText('Edit'));
    expect(await screen.findByText('Edit Domain')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BUSINESS')).toBeDisabled();
  });

  it('PUTs to the specific domain id when saving an edit (not POSTing a duplicate)', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [SAMPLE_DOMAIN] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    await screen.findByText('Business Architecture');
    fireEvent.click(screen.getByText('Edit'));
    await screen.findByText('Edit Domain');
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT');
      expect(putCall).toBeDefined();
      expect(putCall[0]).toContain('/meta-model/domains/d1');
    });
  });

  it('does not delete when the user cancels the confirmation dialog', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': [SAMPLE_DOMAIN] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    await screen.findByText('Business Architecture');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('Delete'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });

  it('stops the loading spinner instead of hanging forever when the domains request fails - the actual reported bug (all four Meta-Model Studio tabs stuck on "Loading..." with no visible error, since none of their fetch chains had a .catch())', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/domains': { __fail: true, status: 500 } });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🗂 Domains'));
    // Falls through to the same empty-state UI as a genuinely-empty
    // domains list, rather than leaving a spinner on screen forever -
    // matches this page's established pattern elsewhere in the codebase
    // for turning a fetch failure into a safe, inert empty state.
    expect(await screen.findByText(/No domains yet/)).toBeInTheDocument();
  });
});

describe('MetaModelPage - ValidationPanel', () => {
  it('shows the initial prompt before validation is run', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('✅ Validation'));
    expect(await screen.findByText(/Click "Run Validation"/)).toBeInTheDocument();
  });

  it('shows a success message when validation finds zero issues', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/validate': [] });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('✅ Validation'));
    await screen.findByText(/Click "Run Validation"/);
    fireEvent.click(screen.getByText('▶ Run Validation'));
    expect(await screen.findByText(/No issues found/)).toBeInTheDocument();
  });

  it('correctly categorizes and counts issues by severity', async () => {
    mockFetch({
      '/meta-model/stats': STATS_WITH_MODEL,
      '/meta-model/validate': [
        { severity: 'ERROR', message: 'Missing required attribute', code: 'ERR001' },
        { severity: 'ERROR', message: 'Duplicate code', code: 'ERR002' },
        { severity: 'WARNING', message: 'Unused relationship', code: 'WARN001' },
      ],
    });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('✅ Validation'));
    await screen.findByText(/Click "Run Validation"/);
    fireEvent.click(screen.getByText('▶ Run Validation'));
    expect(await screen.findByText('Missing required attribute')).toBeInTheDocument();
    // 2 errors, 1 warning, 0 info - verified via the stat card counts
    const errorsCard = screen.getByText('Errors').closest('div')!.parentElement!;
    expect(errorsCard).toHaveTextContent('2');
  });
});

describe('MetaModelPage - ObjectTypesList navigation', () => {
  it('opens the ObjectTypeEditor when an object type is selected', async () => {
    mockFetch({
      '/meta-model/stats': STATS_WITH_MODEL,
      '/meta-model/object-types': [{ id: 'ot1', code: 'APPLICATION', name: 'Application', domain: { name: 'Application Architecture', color: '#3498db' } }],
    });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('⬛ Object Types'));
    const otCard = await screen.findByText('Application');
    fireEvent.click(otCard);
    // Editor view shows a Back button that the list view doesn't have
    await waitFor(() => expect(screen.getAllByText(/Back/).length).toBeGreaterThan(0));
  });

  it('stops the loading spinner instead of hanging forever when the object-types request fails', async () => {
    mockFetch({ '/meta-model/stats': STATS_WITH_MODEL, '/meta-model/object-types': { __fail: true, status: 500 } });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('⬛ Object Types'));
    // No spinner left on screen - the tab strip itself remains interactive,
    // which is enough to prove loading resolved rather than hanging.
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });
});

describe('MetaModelPage - EnumDesigner draft/published fallback', () => {
  it("falls back to the published version's enums when there's no pending draft - the actual reported bug: EnumDesigner's load() threw on its very first line (fetching /meta-model/draft) whenever no draft existed, with no error handling anywhere in the chain, leaving the Enums tab stuck on Loading forever", async () => {
    mockFetch({
      '/meta-model/stats': STATS_WITH_MODEL,
      '/meta-model/draft': { __fail: true, status: 404 },
      '/meta-model/published': { id: 'published-version-1' },
      '/meta-model/enums?versionId=published-version-1': [{ id: 'e1', code: 'STATUS', name: 'Status' }],
    });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🏷 Enums'));
    expect(await screen.findByText('Status')).toBeInTheDocument();
  });

  it('shows an empty state rather than hanging when neither a draft nor a published version exists', async () => {
    mockFetch({
      '/meta-model/stats': STATS_WITH_MODEL,
      '/meta-model/draft': { __fail: true, status: 404 },
      '/meta-model/published': { __fail: true, status: 404 },
    });
    render(<MetaModelPage />);
    fireEvent.click(await screen.findByText('🏷 Enums'));
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });
});
