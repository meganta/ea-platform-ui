import { render, screen, waitFor, act } from '@testing-library/react';
import SharedViewPage from '../SharedViewPage';

let mockToken: string | undefined = 'abc123token';
jest.mock('react-router-dom', () => ({
  useParams: () => ({ token: mockToken }),
  Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}), { virtual: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'abc123token';
});

const SAMPLE_VIEW = {
  id: 'v1', name: 'Application Landscape', description: 'A view of all applications', category: 'APPLICATION',
  visualization: 'GRAPH_LAYOUT', viewCount: 42, tenantSlug: 'acme-corp',
  branding: { organizationNameEn: 'Acme Corp', accentColor: '#00b4d8', hasLogo: false },
};

describe('SharedViewPage', () => {
  it('shows a loading spinner before the fetch resolves', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})); // never resolves
    const { container } = render(<SharedViewPage />);
    expect(container.querySelector('.spinner')).toBeInTheDocument();
  });

  it('displays the view details once loaded', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE_VIEW) });
    render(<SharedViewPage />);
    expect(await screen.findByText('Application Landscape')).toBeInTheDocument();
    expect(screen.getByText('A view of all applications')).toBeInTheDocument();
  });

  it('formats the visualization type by replacing underscores with spaces', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE_VIEW) });
    render(<SharedViewPage />);
    expect(await screen.findByText(/GRAPH LAYOUT/)).toBeInTheDocument();
  });

  it('shows the organization name from branding', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE_VIEW) });
    render(<SharedViewPage />);
    expect(await screen.findByText(/shared view from Acme Corp/)).toBeInTheDocument();
  });

  it('falls back to a generic org name when branding has none', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ...SAMPLE_VIEW, branding: null }) });
    render(<SharedViewPage />);
    expect(await screen.findByText(/shared view from an EA Platform workspace/)).toBeInTheDocument();
  });

  it('shows a fallback error message when the server returns an error without a message field', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    render(<SharedViewPage />);
    expect(await screen.findByText('This share link is invalid or has expired.')).toBeInTheDocument();
    expect(screen.getByText('Link unavailable')).toBeInTheDocument();
  });

  it('shows the server-provided error message when one is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'This view has been unpublished.' }) });
    render(<SharedViewPage />);
    expect(await screen.findByText('This view has been unpublished.')).toBeInTheDocument();
  });

  it('builds the sign-in link with the tenant org query param when tenantSlug is present', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE_VIEW) });
    render(<SharedViewPage />);
    await screen.findByText('Application Landscape');
    const link = screen.getByText('Sign in to view').closest('a')!;
    expect(link).toHaveAttribute('href', '/login?org=acme-corp');
  });

  it('builds a plain sign-in link with no org param when tenantSlug is absent', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ...SAMPLE_VIEW, tenantSlug: null }) });
    render(<SharedViewPage />);
    await screen.findByText('Application Landscape');
    const link = screen.getByText('Sign in to view').closest('a')!;
    expect(link).toHaveAttribute('href', '/login');
  });

  it('never fetches when the token param is missing', () => {
    mockToken = undefined;
    global.fetch = jest.fn();
    render(<SharedViewPage />);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('URL-encodes the token in the fetch request', async () => {
    mockToken = 'token with spaces';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(SAMPLE_VIEW) });
    render(<SharedViewPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain(encodeURIComponent('token with spaces'));
  });

  it('falls back to the placeholder logo text when the image fails to load', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ ...SAMPLE_VIEW, branding: { ...SAMPLE_VIEW.branding, hasLogo: true } }) });
    render(<SharedViewPage />);
    await screen.findByText('Application Landscape');
    const img = document.querySelector('img')!;
    expect(img).toBeInTheDocument();
    act(() => { img.dispatchEvent(new Event('error')); });
    await waitFor(() => expect(screen.getByText('Acme Corp')).toBeInTheDocument());
  });
});
