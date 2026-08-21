import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationsPage from '../NotificationsPage';

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

const SAMPLE_NOTIFICATION = { id: 'n1', title: 'Review completed', body: 'Governance review is ready', severity: 'SUCCESS', isRead: false, createdAt: new Date().toISOString() };
const SAMPLE_RULE = { id: 'r1', name: 'Notify on completed reviews', eventType: 'governance.review.completed', severity: 'SUCCESS', recipientType: 'ROLE', recipientValue: 'ARCHITECT', channels: ['IN_APP'], isActive: true };
const SAMPLE_TEMPLATE = { id: 't1', name: 'Review Complete Template', eventType: 'governance.review.completed', channel: 'IN_APP', language: 'EN', titleTemplate: 'Review {{ReviewName}} done' };
const SAMPLE_USER = { id: 'u1', email: 'architect@test.com', fullName: 'Ahmed Architect' };

describe('NotificationsPage - tab visibility', () => {
  it('shows all admin tabs for a TENANT_ADMIN', async () => {
    mockFetch({ '/notifications?limit=100': [] });
    render(<NotificationsPage />);
    await screen.findByText('notif.tab_inbox');
    expect(screen.getByText('notif.tab_rules')).toBeInTheDocument();
    expect(screen.getByText('notif.tab_templates')).toBeInTheDocument();
    expect(screen.getByText('notif.tab_announce')).toBeInTheDocument();
  });

  it('hides admin tabs for a non-admin', async () => {
    mockRole = 'ARCHITECT';
    mockFetch({ '/notifications?limit=100': [] });
    render(<NotificationsPage />);
    await screen.findByText('notif.tab_inbox');
    expect(screen.queryByText('notif.tab_rules')).not.toBeInTheDocument();
    expect(screen.queryByText('notif.tab_templates')).not.toBeInTheDocument();
    expect(screen.queryByText('notif.tab_announce')).not.toBeInTheDocument();
  });
});

describe('NotificationsPage - Inbox tab', () => {
  it('loads and displays notifications', async () => {
    mockFetch({ '/notifications?limit=100': [SAMPLE_NOTIFICATION] });
    render(<NotificationsPage />);
    expect(await screen.findByText('Review completed')).toBeInTheDocument();
  });

  it('shows the empty state when there are none', async () => {
    mockFetch({ '/notifications?limit=100': [] });
    render(<NotificationsPage />);
    expect(await screen.findByText('notif.no_notifications')).toBeInTheDocument();
  });

  it('re-fetches with unreadOnly=true when the checkbox is toggled', async () => {
    mockFetch({ '/notifications?limit=100': [SAMPLE_NOTIFICATION] });
    render(<NotificationsPage />);
    await screen.findByText('Review completed');
    fireEvent.click(screen.getByLabelText(/notif.unread_only/));
    await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('unreadOnly=true'));
      expect(call).toBeDefined();
    });
  });

  it('marks a notification as read when clicked', async () => {
    mockFetch({ '/notifications?limit=100': [SAMPLE_NOTIFICATION], '/notifications/n1/read': {} });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('Review completed'));
    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/notifications/n1/read'));
      expect(postCall).toBeDefined();
    });
  });
});

describe('NotificationsPage - Preferences tab', () => {
  it('loads preferences and toggles a channel checkbox', async () => {
    mockFetch({
      '/notifications?limit=100': [],
      '/notifications/preferences': { channelsBySeverity: { CRITICAL: ['IN_APP'] }, mutedCategories: [] },
    });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_preferences'));
    await screen.findByText('notif.pref_intro');
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('saves preferences with parsed muted categories', async () => {
    mockFetch({
      '/notifications?limit=100': [],
      '/notifications/preferences': { channelsBySeverity: {}, mutedCategories: [] },
    });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_preferences'));
    await screen.findByText('notif.pref_intro');

    const mutedInput = screen.getByDisplayValue('');
    fireEvent.change(mutedInput, { target: { value: 'adm., copilot.' } });
    fireEvent.click(screen.getByText('notif.save_preferences'));

    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/notifications/preferences'));
      expect(putCall).toBeDefined();
      const body = JSON.parse(putCall[1].body);
      expect(body.mutedCategories).toEqual(['adm.', 'copilot.']);
    });
  });
});

describe('NotificationsPage - Rules tab', () => {
  it('lists existing rules with their event type and recipient', async () => {
    mockFetch({
      '/notifications?limit=100': [], '/notifications/rules': [SAMPLE_RULE], '/notifications/templates': [], '/users': [SAMPLE_USER],
    });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    expect(await screen.findByText('Notify on completed reviews')).toBeInTheDocument();
    expect(screen.getByText(/governance.review.completed/)).toBeInTheDocument();
  });

  it('shows the empty state when there are no rules', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    expect(await screen.findByText('notif.no_rules')).toBeInTheDocument();
  });

  it('creates a rule targeting a role', async () => {
    mockFetch({
      '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [SAMPLE_USER],
    });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    fireEvent.click(await screen.findByText('notif.new_rule'));
    await screen.findByText('notif.rule_name_ar');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'New Rule' } }); // name
    fireEvent.change(textboxes[2], { target: { value: 'governance.review.completed' } }); // event type

    fireEvent.click(screen.getByText('notif.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/notifications/rules'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.name).toBe('New Rule');
      expect(body.eventType).toBe('governance.review.completed');
      expect(body.recipientType).toBe('ROLE');
    });
  });

  it('does not delete a rule when the confirmation dialog is cancelled', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [SAMPLE_RULE], '/notifications/templates': [], '/users': [SAMPLE_USER] });
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    await screen.findByText('Notify on completed reviews');
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('notif.delete'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    confirmSpy.mockRestore();
  });

  it('toggles a rule active/inactive', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [SAMPLE_RULE], '/notifications/templates': [], '/users': [SAMPLE_USER], '/notifications/rules/r1': {} });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    fireEvent.click(await screen.findByText('notif.active'));
    await waitFor(() => {
      const putCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'PUT' && c[0].includes('/notifications/rules/r1'));
      expect(putCall).toBeDefined();
      expect(JSON.parse(putCall[1].body).isActive).toBe(false);
    });
  });

  it('displays an OBJECT_OWNER rule with a clear recipient label instead of a broken user lookup', async () => {
    const ownerRule = { ...SAMPLE_RULE, recipientType: 'OBJECT_OWNER', recipientValue: '' };
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [ownerRule], '/notifications/templates': [], '/users': [] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    expect(await screen.findByText(/notif.recipient_object_owner/)).toBeInTheDocument();
  });

  it('selecting OBJECT_OWNER hides the recipient picker and shows the dynamic-resolution hint', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [SAMPLE_USER] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    fireEvent.click(await screen.findByText('notif.new_rule'));
    await screen.findByText('notif.rule_name_ar');

    const recipientTypeSelect = screen.getAllByRole('combobox')[1]; // [0] is severity, [1] is recipientType
    fireEvent.change(recipientTypeSelect, { target: { value: 'OBJECT_OWNER' } });
    expect(await screen.findByText('notif.object_owner_hint')).toBeInTheDocument();
  });

  it('saves an OBJECT_OWNER rule without requiring a recipientValue', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [SAMPLE_USER] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    fireEvent.click(await screen.findByText('notif.new_rule'));
    await screen.findByText('notif.rule_name_ar');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Owner Rule' } });
    fireEvent.change(textboxes[2], { target: { value: 'innovation.study.generated' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'OBJECT_OWNER' } });
    fireEvent.click(screen.getByText('notif.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/notifications/rules'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.recipientType).toBe('OBJECT_OWNER');
      expect(body.recipientValue).toBe('');
    });
  });
});

describe('NotificationsPage - Rule template library (Notif-P2)', () => {
  const TEMPLATE_ACTIVE = { key: 'GOVERNANCE_REVIEW_COMPLETED', name: 'Architecture Review Completed', nameAr: 'x', eventType: 'governance.review.completed', severity: 'INFORMATIONAL', hasLivePublisher: true, isActivated: false };
  const TEMPLATE_UNWIRED = { key: 'TECHNOLOGY_END_OF_SUPPORT', name: 'Technology Approaching End of Support', nameAr: 'x', eventType: 'ea-repository.technology.end_of_support', severity: 'HIGH', hasLivePublisher: false, isActivated: false };

  it('lists predefined templates', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [], '/notifications/rule-templates': [TEMPLATE_ACTIVE] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    expect(await screen.findByText('Architecture Review Completed')).toBeInTheDocument();
  });

  it('does not render the library section at all when there are no templates', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [], '/notifications/rule-templates': [] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    await screen.findByText('notif.no_rules');
    expect(screen.queryByText('notif.template_library')).not.toBeInTheDocument();
  });

  it('shows a "not yet wired" hint for a template with no live publisher', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [], '/notifications/rule-templates': [TEMPLATE_UNWIRED] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    expect(await screen.findByText('notif.no_live_publisher')).toBeInTheDocument();
  });

  it('does not show the "not yet wired" hint for a template with a live publisher', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [], '/notifications/rule-templates': [TEMPLATE_ACTIVE] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    await screen.findByText('Architecture Review Completed');
    expect(screen.queryByText('notif.no_live_publisher')).not.toBeInTheDocument();
  });

  it('shows an Activated badge instead of the button for an already-activated template', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [], '/notifications/rule-templates': [{ ...TEMPLATE_ACTIVE, isActivated: true }] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    expect(await screen.findByText('notif.activated')).toBeInTheDocument();
    expect(screen.queryByText('notif.activate')).not.toBeInTheDocument();
  });

  it('activates a template and refreshes both the template list and the manual rules list', async () => {
    mockFetch({
      '/notifications?limit=100': [], '/notifications/templates': [], '/users': [],
      '/notifications/rule-templates': [TEMPLATE_ACTIVE],
      '/notifications/rule-templates/GOVERNANCE_REVIEW_COMPLETED/activate': {},
      '/notifications/rules': [],
    });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    fireEvent.click(await screen.findByText('notif.activate'));

    await waitFor(() => {
      const activateCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[0].includes('/rule-templates/GOVERNANCE_REVIEW_COMPLETED/activate'));
      expect(activateCall).toBeDefined();
      expect(activateCall[1].method).toBe('POST');
    });
  });

  it('collapses and expands the template library on header click', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/rules': [], '/notifications/templates': [], '/users': [], '/notifications/rule-templates': [TEMPLATE_ACTIVE] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_rules'));
    await screen.findByText('Architecture Review Completed');
    fireEvent.click(screen.getByText('notif.template_library'));
    expect(screen.queryByText('Architecture Review Completed')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('notif.template_library'));
    expect(await screen.findByText('Architecture Review Completed')).toBeInTheDocument();
  });
});

describe('NotificationsPage - Templates tab', () => {
  it('lists templates', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/templates': [SAMPLE_TEMPLATE] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_templates'));
    expect(await screen.findByText('Review Complete Template')).toBeInTheDocument();
  });

  it('creates a template', async () => {
    mockFetch({ '/notifications?limit=100': [], '/notifications/templates': [] });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_templates'));
    fireEvent.click(await screen.findByText('notif.new_template'));
    await screen.findByText('notif.channel');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'My Template' } }); // name
    fireEvent.change(textboxes[1], { target: { value: 'governance.review.completed' } }); // event type
    fireEvent.change(textboxes[2], { target: { value: 'Title {{X}}' } }); // title template
    fireEvent.change(textboxes[3], { target: { value: 'Body {{X}}' } }); // body template

    fireEvent.click(screen.getByText('notif.create'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].endsWith('/notifications/templates'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.name).toBe('My Template');
    });
  });
});

describe('NotificationsPage - Send Announcement tab', () => {
  it('sends an announcement to selected recipients', async () => {
    mockFetch({ '/notifications?limit=100': [], '/users': [SAMPLE_USER], '/notifications/announcements': {} });
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_announce'));
    fireEvent.click(await screen.findByText('Ahmed Architect'));

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'System Maintenance' } });
    fireEvent.change(textboxes[1], { target: { value: 'Downtime tonight at 10pm' } });

    fireEvent.click(screen.getByText('notif.send'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/notifications/announcements'));
      expect(postCall).toBeDefined();
      const body = JSON.parse(postCall[1].body);
      expect(body.recipientUserIds).toEqual(['u1']);
      expect(body.title).toBe('System Maintenance');
    });
  });

  it('does not send when no recipient is selected', async () => {
    mockFetch({ '/notifications?limit=100': [], '/users': [SAMPLE_USER] });
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<NotificationsPage />);
    fireEvent.click(await screen.findByText('notif.tab_announce'));
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Title' } });
    fireEvent.change(textboxes[1], { target: { value: 'Body' } });
    const callsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getByText('notif.send'));
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsBefore);
    expect(alertSpy).toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
