import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientSearchAutocomplete from './client-search-autocomplete';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Mock Supabase with proper chain
const mockCustomers = [
  { id: 'c1', name: 'Jan Kowalski', phone: '+48733854184', email: 'jan@example.com' },
  { id: 'c2', name: 'Anna Nowak', phone: '+48666610222', email: null },
  { id: 'c3', name: 'Piotr Wiśniewski', phone: '+49171234567', email: 'piotr@example.de' },
];

let mockQueryResult = { data: mockCustomers, error: null };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          or: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve(mockQueryResult)),
            })),
          })),
        })),
      })),
    })),
  },
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
);

const renderComponent = (props: Partial<Parameters<typeof ClientSearchAutocomplete>[0]> = {}) => {
  const defaultProps = {
    instanceId: 'test-instance',
    value: '',
    onChange: vi.fn(),
  };
  return {
    user: userEvent.setup(),
    ...render(
      <TestWrapper>
        <ClientSearchAutocomplete {...defaultProps} {...props} />
      </TestWrapper>
    ),
    onChange: props.onChange ?? defaultProps.onChange,
  };
};

describe('ClientSearchAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQueryResult = { data: mockCustomers, error: null };
  });

  describe('Rendering', () => {
    it('CLI-U-001: renders input with placeholder', () => {
      renderComponent({ placeholder: 'Szukaj klienta...' });
      
      expect(screen.getByPlaceholderText('Szukaj klienta...')).toBeInTheDocument();
    });

    it('CLI-U-002: displays initial value', () => {
      renderComponent({ value: 'Jan Kowalski' });
      
      expect(screen.getByDisplayValue('Jan Kowalski')).toBeInTheDocument();
    });

    it('CLI-U-003: disables input when disabled prop is true', () => {
      renderComponent({ disabled: true });
      
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('CLI-U-004: applies custom className', () => {
      renderComponent({ className: 'custom-class' });
      
      expect(screen.getByRole('textbox')).toHaveClass('custom-class');
    });
  });

  describe('Search behavior', () => {
    it('CLI-U-005: does not show results for less than 2 characters', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'J');
      
      // Wait for debounce + verify no dropdown
      await act(async () => {
        await new Promise(r => setTimeout(r, 400));
      });
      
      expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
    });

    it('CLI-U-006: displays search results in dropdown after typing 2+ chars', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('CLI-U-007: displays formatted phone number without +48 prefix', async () => {
      mockQueryResult = { data: [mockCustomers[0]], error: null };
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('733 854 184')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('CLI-U-008: displays email when available', async () => {
      mockQueryResult = { data: [mockCustomers[0]], error: null };
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText(/jan@example.com/)).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('CLI-U-009: keeps international prefix for non-Polish numbers', async () => {
      mockQueryResult = { data: [mockCustomers[2]], error: null };
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Piotr');
      
      await waitFor(() => {
        expect(screen.getByText(/\+49/)).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Selection', () => {
    it('CLI-U-010: selects customer on click', async () => {
      const onSelect = vi.fn();
      const { user } = renderComponent({ onSelect });
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.click(screen.getByText('Jan Kowalski'));
      
      expect(onSelect).toHaveBeenCalledWith({
        id: 'c1',
        name: 'Jan Kowalski',
        phone: '+48733854184',
      });
    });

    it('CLI-U-011: updates input value with customer name after selection', async () => {
      const { user } = renderComponent();
      const input = screen.getByRole('textbox');
      
      await user.type(input, 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.click(screen.getByText('Jan Kowalski'));
      
      expect(input).toHaveValue('Jan Kowalski');
    });

    it('CLI-U-012: calls onChange with customer name after selection', async () => {
      const onChange = vi.fn();
      const { user } = renderComponent({ onChange });
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.click(screen.getByText('Jan Kowalski'));
      
      expect(onChange).toHaveBeenLastCalledWith('Jan Kowalski');
    });

    it('CLI-U-013: closes dropdown after selection', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.click(screen.getByText('Jan Kowalski'));
      
      await waitFor(() => {
        expect(screen.queryByText('Anna Nowak')).not.toBeInTheDocument();
      });
    });
  });

  describe('Clear functionality', () => {
    it('CLI-U-014: shows clear button when input has value', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Test');
      
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('Test');
      });
      
      // X button should be visible (inside the button)
      const clearButton = document.querySelector('button svg.lucide-x');
      expect(clearButton).toBeInTheDocument();
    });

    it('CLI-U-015: clears input and calls onClear', async () => {
      const onClear = vi.fn();
      const onChange = vi.fn();
      const { user } = renderComponent({ onClear, onChange });
      
      await user.type(screen.getByRole('textbox'), 'Test');
      
      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveValue('Test');
      });
      
      // Find and click clear button
      const clearButton = document.querySelector('button');
      if (clearButton) {
        await user.click(clearButton);
      }
      
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('Keyboard navigation', () => {
    it('CLI-U-016: navigates with ArrowDown', async () => {
      mockQueryResult = { data: [mockCustomers[0], mockCustomers[1]], error: null };
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Ko');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.keyboard('{ArrowDown}');
      
      // First item should be highlighted
      const firstButton = screen.getByText('Jan Kowalski').closest('button');
      expect(firstButton).toHaveClass('bg-accent');
    });

    it('CLI-U-017: selects with Enter key', async () => {
      const onSelect = vi.fn();
      mockQueryResult = { data: [mockCustomers[0]], error: null };
      const { user } = renderComponent({ onSelect });
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.keyboard('{ArrowDown}{Enter}');
      
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Jan Kowalski' })
      );
    });

    it('CLI-U-018: closes dropdown with Escape', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.keyboard('{Escape}');
      
      await waitFor(() => {
        expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
      });
    });

    it('CLI-U-019: closes dropdown with Tab', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.keyboard('{Tab}');
      
      await waitFor(() => {
        expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
      });
    });
  });

  describe('SuppressAutoSearch', () => {
    it('CLI-U-020: does not search on mount with suppressAutoSearch', async () => {
      renderComponent({ 
        value: 'Jan',
        suppressAutoSearch: true,
      });
      
      // Wait a bit to ensure no dropdown appears
      await act(async () => {
        await new Promise(r => setTimeout(r, 400));
      });
      
      expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
    });

    it('CLI-U-021: searches after user interaction with suppressAutoSearch', async () => {
      const { user } = renderComponent({ suppressAutoSearch: true });
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });

  describe('Outside click', () => {
    it('CLI-U-022: closes dropdown on outside click', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
      }, { timeout: 1000 });
      
      await user.click(document.body);
      
      await waitFor(() => {
        expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
      });
    });
  });

  describe('Highlight matching', () => {
    it('CLI-U-023: highlights matching text in results', async () => {
      mockQueryResult = { data: [mockCustomers[0]], error: null };
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('textbox'), 'Jan');
      
      await waitFor(() => {
        const highlightedSpan = document.querySelector('.text-primary.font-semibold');
        expect(highlightedSpan).toBeInTheDocument();
        expect(highlightedSpan?.textContent).toBe('Jan');
      }, { timeout: 1000 });
    });
  });
});
