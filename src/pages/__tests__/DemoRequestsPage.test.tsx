import { render, screen, waitFor } from '@testing-library/react';
import DemoRequestsPage from '../DemoRequestsPage';

jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (key: string) => key }),
}));

const mockListDemoRequests = jest.fn();
jest.mock('../../lib/api', () => ({
  api: {
    listDemoRequests: () => mockListDemoRequests(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const REQUESTS = [
  { id: 'r2', fullName: 'Aisha Al Saud', organization: 'Example Authority', jobTitle: 'Enterprise Architect', email: 'aisha@example.gov.sa', phone: null, country: 'Saudi Arabia', preferredLanguage: 'English', message: 'We would like a demo.', createdAt: '2026-09-14T10:00:00.000Z' },
  { id: 'r1', fullName: 'Omar Khalid', organization: 'Another Org', jobTitle: 'CIO', email: 'omar@another.org', phone: '+966500000000', country: 'United Arab Emirates', preferredLanguage: 'Arabic', message: 'Interested in governance.', createdAt: '2026-09-13T09:00:00.000Z' },
];

describe('DemoRequestsPage', () => {
  it('shows the empty state when there are no demo requests', async () => {
    mockListDemoRequests.mockResolvedValue([]);
    render(<DemoRequestsPage />);
    expect(await screen.findByText('demoRequests.empty')).toBeInTheDocument();
  });

  it('renders requests in the order the backend returns them (newest first, per its own orderBy)', async () => {
    mockListDemoRequests.mockResolvedValue(REQUESTS);
    render(<DemoRequestsPage />);

    await waitFor(() => expect(screen.getByText('Aisha Al Saud')).toBeInTheDocument());
    const rows = screen.getAllByRole('row').slice(1); // skip header row
    expect(rows[0]).toHaveTextContent('Aisha Al Saud');
    expect(rows[1]).toHaveTextContent('Omar Khalid');
  });

  it('shows an error message when the request fails', async () => {
    mockListDemoRequests.mockRejectedValue(new Error('Network error'));
    render(<DemoRequestsPage />);
    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });
});
