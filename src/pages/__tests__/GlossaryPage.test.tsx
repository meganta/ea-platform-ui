import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GlossaryPage from '../GlossaryPage';

const SAMPLE_TERMS = [
  { id: 't1', termEn: 'Enterprise Architecture', termAr: 'هندسة المؤسسة', definition: 'The overall structure and design of an organization\'s IT systems.', domain: 'GOVERNANCE' },
  { id: 't2', termEn: 'API Gateway', termAr: 'بوابة API', definition: 'A single entry point for managing API traffic.', domain: 'TECHNOLOGY' },
];

function mockFetchSequence(responses: any[]) {
  let call = 0;
  global.fetch = jest.fn().mockImplementation(() => {
    const response = responses[Math.min(call, responses.length - 1)];
    call++;
    return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
  }) as any;
}

beforeEach(() => {
  localStorage.setItem('ea_token', 'fake-token');
  jest.clearAllMocks();
});

describe('GlossaryPage', () => {
  it('loads and displays terms from the API on mount', async () => {
    mockFetchSequence([SAMPLE_TERMS]);
    render(<GlossaryPage />);

    expect(await screen.findByText('Enterprise Architecture')).toBeInTheDocument();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.getByText(/single entry point for managing API traffic/)).toBeInTheDocument();
  });

  it('shows an empty state message when there are no terms yet', async () => {
    mockFetchSequence([[]]);
    render(<GlossaryPage />);
    expect(await screen.findByText(/No glossary terms yet/i)).toBeInTheDocument();
  });

  it('filters the visible terms as the user types in the search box', async () => {
    mockFetchSequence([SAMPLE_TERMS]);
    render(<GlossaryPage />);
    await screen.findByText('Enterprise Architecture');

    const search = screen.getByPlaceholderText(/Search terms or definitions/i);
    fireEvent.change(search, { target: { value: 'API' } });

    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.queryByText('Enterprise Architecture')).not.toBeInTheDocument();
  });

  it('filters by domain using the dropdown', async () => {
    mockFetchSequence([SAMPLE_TERMS]);
    render(<GlossaryPage />);
    await screen.findByText('Enterprise Architecture');

    const domainSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(domainSelect, { target: { value: 'TECHNOLOGY' } });

    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.queryByText('Enterprise Architecture')).not.toBeInTheDocument();
  });

  it('opens the new-term form when "New Term" is clicked, and requires both English and Arabic terms before saving', async () => {
    mockFetchSequence([[]]);
    render(<GlossaryPage />);
    await screen.findByText(/No glossary terms yet/i);

    fireEvent.click(screen.getByText('+ New Term'));
    expect(screen.getByText('New Term')).toBeInTheDocument();

    // Mock window.alert since the component calls it directly for validation
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    fireEvent.click(screen.getByText('💾 Save'));
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('required'));
    alertSpy.mockRestore();
  });

  it('creates a new term and refreshes the list after a successful save', async () => {
    mockFetchSequence([[], { id: 't3' }, [...SAMPLE_TERMS, { id: 't3', termEn: 'New Term', termAr: 'مصطلح جديد', definition: '', domain: '' }]]);
    render(<GlossaryPage />);
    await screen.findByText(/No glossary terms yet/i);

    fireEvent.click(screen.getByText('+ New Term'));

    const enInput = screen.getByText('Term (EN) *').parentElement!.querySelector('input')!;
    fireEvent.change(enInput, { target: { value: 'New Term' } });
    const arInput = screen.getByText('Term (AR) *').parentElement!.querySelector('input')!;
    fireEvent.change(arInput, { target: { value: 'مصطلح جديد' } });

    fireEvent.click(screen.getByText('💾 Save'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/glossary'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('deletes a term after confirmation', async () => {
    mockFetchSequence([SAMPLE_TERMS, true, []]);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<GlossaryPage />);
    await screen.findByText('Enterprise Architecture');

    const deleteButtons = screen.getAllByText('Delete');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/glossary/t1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    confirmSpy.mockRestore();
  });

  it('does not delete when the user cancels the confirmation dialog', async () => {
    mockFetchSequence([SAMPLE_TERMS]);
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<GlossaryPage />);
    await screen.findByText('Enterprise Architecture');

    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;
    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore); // no new fetch call
    confirmSpy.mockRestore();
  });
});
