import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NotificationBell from '../NotificationBell';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key, isAR: false }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem('ea_token', 'fake-token');
});

afterEach(() => {
  localStorage.clear();
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

describe('NotificationBell', () => {
  it('shows the unread count badge', async () => {
    mockFetch({ '/notifications/unread-count': { count: 3 } });
    render(<NotificationBell />);
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('hides the badge when there are no unread notifications', async () => {
    mockFetch({ '/notifications/unread-count': { count: 0 } });
    render(<NotificationBell />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('caps the badge display at 99+', async () => {
    mockFetch({ '/notifications/unread-count': { count: 150 } });
    render(<NotificationBell />);
    expect(await screen.findByText('99+')).toBeInTheDocument();
  });

  it('loads and displays recent notifications when opened', async () => {
    mockFetch({ '/notifications/unread-count': { count: 1 }, '/notifications?limit=8': [SAMPLE_NOTIFICATION] });
    render(<NotificationBell />);
    await screen.findByText('1');
    fireEvent.click(screen.getByLabelText('notif.bell_label'));
    expect(await screen.findByText('Review completed')).toBeInTheDocument();
  });

  it('marks a notification as read and navigates when an item with actionUrl is clicked', async () => {
    const withAction = { ...SAMPLE_NOTIFICATION, actionUrl: '/governance/reports/r1' };
    mockFetch({ '/notifications/unread-count': { count: 1 }, '/notifications?limit=8': [withAction], '/notifications/n1/read': {} });
    render(<NotificationBell />);
    await screen.findByText('1');
    fireEvent.click(screen.getByLabelText('notif.bell_label'));
    fireEvent.click(await screen.findByText('Review completed'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/notifications/n1/read'));
      expect(postCall).toBeDefined();
    });
    expect(mockNavigate).toHaveBeenCalledWith('/governance/reports/r1');
  });

  it('marks all as read and clears the badge', async () => {
    mockFetch({ '/notifications/unread-count': { count: 2 }, '/notifications?limit=8': [SAMPLE_NOTIFICATION], '/notifications/read-all': { markedRead: 2 } });
    render(<NotificationBell />);
    await screen.findByText('2');
    fireEvent.click(screen.getByLabelText('notif.bell_label'));
    await screen.findByText('Review completed');
    fireEvent.click(screen.getByText('notif.mark_all_read'));

    await waitFor(() => {
      const postCall = (global.fetch as jest.Mock).mock.calls.find((c: any) => c[1]?.method === 'POST' && c[0].includes('/notifications/read-all'));
      expect(postCall).toBeDefined();
    });
    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument());
  });

  it('navigates to the full notifications page via View all', async () => {
    mockFetch({ '/notifications/unread-count': { count: 0 }, '/notifications?limit=8': [] });
    render(<NotificationBell />);
    fireEvent.click(screen.getByLabelText('notif.bell_label'));
    fireEvent.click(await screen.findByText('notif.view_all'));
    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });
});
