import { render, screen, fireEvent } from '@testing-library/react';
import HelpTip from '../HelpTip';

// HelpTip.tsx now looks up its aria-label via t('common.more_info')
// (previously a hardcoded 'More information' string) - mocked the same
// way every other test file in this codebase mocks useLang, returning
// the raw key rather than a translated phrase.
jest.mock('../../contexts/LangContext', () => ({
  useLang: () => ({ t: (k: string) => k }),
}));

describe('HelpTip', () => {
  it('does not show the explanation text until clicked', () => {
    render(<HelpTip text="This explains something." />);
    expect(screen.queryByText('This explains something.')).not.toBeInTheDocument();
  });

  it('shows the explanation text after the icon is clicked', () => {
    render(<HelpTip text="This explains something." />);
    fireEvent.click(screen.getByRole('button', { name: 'common.more_info' }));
    expect(screen.getByText('This explains something.')).toBeInTheDocument();
  });

  it('hides the explanation again when the icon is clicked a second time', () => {
    render(<HelpTip text="This explains something." />);
    const icon = screen.getByRole('button', { name: 'common.more_info' });
    fireEvent.click(icon);
    expect(screen.getByText('This explains something.')).toBeInTheDocument();
    fireEvent.click(icon);
    expect(screen.queryByText('This explains something.')).not.toBeInTheDocument();
  });

  it('closes when clicking outside the component', () => {
    render(
      <div>
        <div data-testid="outside">Outside area</div>
        <HelpTip text="This explains something." />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'common.more_info' }));
    expect(screen.getByText('This explains something.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByText('This explains something.')).not.toBeInTheDocument();
  });

  it('closes when the Escape key is pressed', () => {
    render(<HelpTip text="This explains something." />);
    fireEvent.click(screen.getByRole('button', { name: 'common.more_info' }));
    expect(screen.getByText('This explains something.')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('This explains something.')).not.toBeInTheDocument();
  });

  it('does not close when clicking inside the tooltip itself', () => {
    render(<HelpTip text="This explains something." />);
    fireEvent.click(screen.getByRole('button', { name: 'common.more_info' }));
    const tooltipText = screen.getByText('This explains something.');
    fireEvent.mouseDown(tooltipText);
    expect(screen.getByText('This explains something.')).toBeInTheDocument();
  });

  it('renders different text for different instances independently', () => {
    render(
      <div>
        <HelpTip text="First tip." />
        <HelpTip text="Second tip." />
      </div>
    );
    const buttons = screen.getAllByRole('button', { name: 'common.more_info' });
    fireEvent.click(buttons[0]);
    expect(screen.getByText('First tip.')).toBeInTheDocument();
    expect(screen.queryByText('Second tip.')).not.toBeInTheDocument();
  });
});
