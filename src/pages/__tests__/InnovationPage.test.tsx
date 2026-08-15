import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InnovationPage from '../InnovationPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false }),
}));

let mockRole = 'TENANT_ADMIN';
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: mockRole } }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'TENANT_ADMIN';
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

const RADAR_ITEM = {
  id: 'tech-1', code: 'AGENTIC_AI', name: 'AutoArchitect Agents', nameAr: 'وكلاء الهندسة الآلية',
  description: 'AI systems that can autonomously plan and execute multi-step tasks.',
  category: 'AGENTIC_AI', maturity: 'EMERGING', marketPosition: 'TRIAL',
  typicalUseCases: ['Autonomous workflows'], benefits: ['Reduced manual effort'], keyRisks: ['Unpredictable outputs'],
  requiredCapabilities: [], tenantInterest: null,
};

describe('InnovationPage - Radar tab', () => {
  it('loads and displays radar items', async () => {
    mockFetch({ '/innovation/radar/favorites': [], '/innovation/radar': [RADAR_ITEM] });
    render(<InnovationPage />);
    expect(await screen.findByText('AutoArchitect Agents')).toBeInTheDocument();
  });

  it('shows the empty state prompting to seed when the radar is empty', async () => {
    mockFetch({ '/innovation/radar': [] });
    render(<InnovationPage />);
    expect(await screen.findByText('innov.no_radar')).toBeInTheDocument();
  });

  it('shows the Add Technology and seed buttons for a TENANT_ADMIN', async () => {
    mockFetch({ '/innovation/radar': [] });
    render(<InnovationPage />);
    expect(await screen.findByText('innov.add_tech')).toBeInTheDocument();
    expect(screen.getByText('innov.seed')).toBeInTheDocument();
  });

  it('hides the Add Technology and seed buttons for a non-admin', async () => {
    mockRole = 'ARCHITECT';
    mockFetch({ '/innovation/radar': [] });
    render(<InnovationPage />);
    await screen.findByText('innov.no_radar');
    expect(screen.queryByText('innov.add_tech')).not.toBeInTheDocument();
    expect(screen.queryByText('innov.seed')).not.toBeInTheDocument();
  });

  it('calls the seed endpoint when the seed button is clicked', async () => {
    mockFetch({ '/innovation/radar/seed': { created: 5, updated: 0, total: 5 }, '/innovation/radar': [] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.seed'));
    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/innovation/radar/seed'));
      expect(postCall).toBeDefined();
    });
  });

  it('re-fetches the radar with category and marketPosition query params when filters change', async () => {
    mockFetch({ '/innovation/radar': [RADAR_ITEM] });
    render(<InnovationPage />);
    await screen.findByText('AutoArchitect Agents');
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'AGENTIC_AI' } });
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('category=AGENTIC_AI'));
      expect(call).toBeDefined();
    });
  });
});

describe('InnovationPage - Radar detail and my-status', () => {
  it('opens the detail view when a radar card is clicked, fetching the full record', async () => {
    mockFetch({ '/innovation/radar/tech-1': RADAR_ITEM, '/innovation/radar': [RADAR_ITEM] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('AutoArchitect Agents'));
    expect(await screen.findByText(/autonomously plan and execute/)).toBeInTheDocument();
  });

  it('saves the tenant status, favorite, and watching flags via PUT my-status', async () => {
    mockFetch({ '/innovation/radar/tech-1/my-status': {}, '/innovation/radar/tech-1': RADAR_ITEM, '/innovation/radar': [RADAR_ITEM] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('AutoArchitect Agents'));
    await screen.findByText(/autonomously plan and execute/); // wait for detail to render

    const favoriteCheckbox = screen.getByLabelText(/favorite/i) || screen.getAllByRole('checkbox')[0];
    fireEvent.click(favoriteCheckbox);
    fireEvent.click(screen.getByText('innov.save_status'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/my-status'));
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall[1].body);
      expect(body.isFavorite).toBe(true);
    });
  });

  it('shows Edit and Deactivate actions only for a TENANT_ADMIN', async () => {
    mockFetch({ '/innovation/radar/tech-1': RADAR_ITEM, '/innovation/radar': [RADAR_ITEM] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('AutoArchitect Agents'));
    await screen.findByText(/autonomously plan and execute/);
    expect(screen.getByText('innov.edit')).toBeInTheDocument();
    expect(screen.getByText('innov.deactivate')).toBeInTheDocument();
  });

  it('hides Edit and Deactivate actions for a non-admin', async () => {
    mockRole = 'ARCHITECT';
    mockFetch({ '/innovation/radar/tech-1': RADAR_ITEM, '/innovation/radar': [RADAR_ITEM] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('AutoArchitect Agents'));
    await screen.findByText(/autonomously plan and execute/);
    expect(screen.queryByText('innov.edit')).not.toBeInTheDocument();
    expect(screen.queryByText('innov.deactivate')).not.toBeInTheDocument();
  });

  it('does not deactivate when the confirmation dialog is cancelled', async () => {
    mockFetch({ '/innovation/radar/tech-1': RADAR_ITEM, '/innovation/radar': [RADAR_ITEM] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('AutoArchitect Agents'));
    await screen.findByText(/autonomously plan and execute/);
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('innov.deactivate'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });
});

describe('InnovationPage - Add Technology form', () => {
  it('creates a technology with the entered fields', async () => {
    mockFetch({ '/innovation/radar': [] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.add_tech'));
    await screen.findByText('innov.name_ar');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'quantum_sensing' } }); // code
    fireEvent.change(textboxes[1], { target: { value: 'Quantum Sensing' } }); // name
    fireEvent.change(textboxes[3], { target: { value: 'Ultra-precise measurement using quantum effects.' } }); // description

    fireEvent.click(screen.getByText('innov.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/innovation/radar'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.code).toBe('QUANTUM_SENSING'); // uppercased and underscored
      expect(body.name).toBe('Quantum Sensing');
    });
  });

  it('does not submit when required fields are missing', async () => {
    mockFetch({ '/innovation/radar': [] });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.add_tech'));
    await screen.findByText('innov.name_ar');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('innov.create'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('InnovationPage - Favorites tab', () => {
  it('shows the empty state when there are no favorites', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/radar/favorites': [] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_favorites'));
    expect(await screen.findByText('innov.no_favorites')).toBeInTheDocument();
  });

  it('lists favorited technologies', async () => {
    const favorited = { ...RADAR_ITEM, tenantInterest: { isFavorite: true, tenantStatus: 'PILOT' } };
    mockFetch({ '/innovation/radar/favorites': [favorited], '/innovation/radar': [] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_favorites'));
    expect(await screen.findByText('AutoArchitect Agents')).toBeInTheDocument();
  });
});

describe('InnovationPage - Organization Profile tab', () => {
  it('loads and displays the existing profile fields', async () => {
    mockFetch({
      '/innovation/radar': [],
      '/innovation/context-profile': { industry: 'Public Sector', organizationSize: 'ENTERPRISE', domainsInScope: ['Finance', 'HR'] },
    });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_profile'));
    expect(await screen.findByDisplayValue('Public Sector')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Finance, HR')).toBeInTheDocument();
  });

  it('saves the profile with parsed domains and constraints on submit, for a TENANT_ADMIN', async () => {
    mockFetch({
      '/innovation/radar': [],
      '/innovation/context-profile': { industry: '', organizationSize: '', domainsInScope: [] },
    });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_profile'));
    await screen.findByText('innov.profile_title');

    const industryInput = screen.getAllByRole('textbox')[0];
    fireEvent.change(industryInput, { target: { value: 'Healthcare' } });
    fireEvent.click(screen.getByText('innov.save_profile'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/innovation/context-profile'));
      expect(putCall).toBeDefined();
    });
  });

  it('shows a read-only notice and no save button for a non-admin', async () => {
    mockRole = 'ARCHITECT';
    mockFetch({ '/innovation/radar': [], '/innovation/context-profile': { industry: '', domainsInScope: [] } });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_profile'));
    expect(await screen.findByText('innov.readonly_notice')).toBeInTheDocument();
    expect(screen.queryByText('innov.save_profile')).not.toBeInTheDocument();
  });
});

const IDEA = {
  id: 'idea-1', title: 'Automate invoice matching', titleAr: 'أتمتة مطابقة الفواتير',
  description: 'Use AI to match invoices to POs automatically.', category: 'AUTOMATION', tags: ['finance'],
  status: 'SUBMITTED', relatedRadarItemId: null, overallScore: null, qualifiedAt: null,
};

describe('InnovationPage - Ideas tab: list and submission', () => {
  it('loads and displays submitted ideas', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [IDEA] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    expect(await screen.findByText('Automate invoice matching')).toBeInTheDocument();
  });

  it('shows the empty state when there are no ideas', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    expect(await screen.findByText('innov.no_ideas')).toBeInTheDocument();
  });

  it('re-fetches with a status query param when the filter changes', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [IDEA] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    await screen.findByText('Automate invoice matching');
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: 'QUALIFIED' } });
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('status=QUALIFIED'));
      expect(call).toBeDefined();
    });
  });

  it('submits a new idea', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [] });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('innov.submit_idea'));
    await screen.findByText('innov.idea_title_ar');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'New idea title' } }); // title
    const textarea = document.querySelector('textarea')!;
    fireEvent.change(textarea, { target: { value: 'A description of the idea.' } });

    fireEvent.click(screen.getByText('innov.submit'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/innovation/ideas'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.title).toBe('New idea title');
      expect(body.description).toBe('A description of the idea.');
    });
  });

  it('does not submit when required fields are missing', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [] });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('innov.submit_idea'));
    await screen.findByText('innov.idea_title_ar');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('innov.submit'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('InnovationPage - Ideas tab: detail, qualification, decisions', () => {
  it('opens the detail view and shows the not-yet-qualified state', async () => {
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [IDEA], '/innovation/ideas/idea-1': IDEA });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    expect(await screen.findByText('innov.not_qualified_yet')).toBeInTheDocument();
    expect(screen.getByText('innov.qualify')).toBeInTheDocument();
  });

  it('displays scores and rationale for an already-qualified idea', async () => {
    const qualified = { ...IDEA, status: 'QUALIFIED', feasibilityScore: 70, impactScore: 60, alignmentScore: 80, overallScore: 70, qualificationRationale: 'Solid fit', qualifiedAt: '2026-08-01T00:00:00Z' };
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [qualified], '/innovation/ideas/idea-1': qualified });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    expect(await screen.findByText('Solid fit')).toBeInTheDocument();
    expect(screen.getAllByText('70').length).toBeGreaterThan(0);
  });

  it('runs AI qualification when the qualify button is clicked', async () => {
    mockFetch({
      '/innovation/radar': [], '/innovation/ideas': [IDEA],
      '/innovation/ideas/idea-1/qualify': {},
      '/innovation/ideas/idea-1': IDEA,
    });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    await screen.findByText('innov.qualify');
    fireEvent.click(screen.getByText('innov.qualify'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/innovation/ideas/idea-1/qualify'));
      expect(postCall).toBeDefined();
    });
  });

  it('allows any user to move an idea to In Review', async () => {
    mockRole = 'ARCHITECT';
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [IDEA], '/innovation/ideas/idea-1': IDEA, '/innovation/ideas/idea-1/status': {} });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    fireEvent.click(await screen.findByText('innov.move_in_review'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/innovation/ideas/idea-1/status'));
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body).status).toBe('IN_REVIEW');
    });
  });

  it('shows the decision-restricted notice instead of approve/reject/archive for a non-decision role', async () => {
    mockRole = 'ARCHITECT';
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [IDEA], '/innovation/ideas/idea-1': IDEA });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    await screen.findByText('innov.decision_restricted');
    expect(screen.queryByText('innov.approve')).not.toBeInTheDocument();
  });

  it('shows approve/reject/archive actions for a TENANT_ADMIN and submits a decision', async () => {
    mockRole = 'TENANT_ADMIN';
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [IDEA], '/innovation/ideas/idea-1': IDEA, '/innovation/ideas/idea-1/status': {} });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    fireEvent.click(await screen.findByText('innov.approve'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/innovation/ideas/idea-1/status'));
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body).status).toBe('APPROVED');
    });
  });

  it('hides the decision section entirely once an idea reaches a terminal status', async () => {
    const approved = { ...IDEA, status: 'APPROVED' };
    mockFetch({ '/innovation/radar': [], '/innovation/ideas': [approved], '/innovation/ideas/idea-1': approved });
    render(<InnovationPage />);
    fireEvent.click(await screen.findByText('innov.tab_ideas'));
    fireEvent.click(await screen.findByText('Automate invoice matching'));
    await screen.findByText('innov.not_qualified_yet');
    expect(screen.queryByText('innov.decision')).not.toBeInTheDocument();
  });
});
