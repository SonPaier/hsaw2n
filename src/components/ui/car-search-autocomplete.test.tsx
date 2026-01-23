import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CarSearchAutocomplete } from './car-search-autocomplete';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Mock car models context
const mockSearchModels = vi.fn();

vi.mock('@/contexts/CarModelsContext', async () => {
  const actual = await vi.importActual('@/contexts/CarModelsContext');
  return {
    ...actual,
    useCarModels: () => ({
      searchModels: mockSearchModels,
      models: [],
      isLoading: false,
    }),
  };
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    {children}
  </I18nextProvider>
);

const renderComponent = (props: Partial<Parameters<typeof CarSearchAutocomplete>[0]> = {}) => {
  const defaultProps = {
    onChange: vi.fn(),
  };
  return {
    user: userEvent.setup(),
    ...render(
      <TestWrapper>
        <CarSearchAutocomplete {...defaultProps} {...props} />
      </TestWrapper>
    ),
    onChange: props.onChange ?? defaultProps.onChange,
  };
};

describe('CarSearchAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchModels.mockReturnValue([]);
  });

  describe('Rendering', () => {
    it('CAR-U-001: renders input with correct aria attributes', () => {
      renderComponent();
      
      const input = screen.getByRole('combobox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('CAR-U-002: displays initial value', () => {
      renderComponent({ value: 'Volkswagen Passat' });
      
      expect(screen.getByRole('combobox')).toHaveValue('Volkswagen Passat');
    });

    it('CAR-U-003: shows helper text when provided', () => {
      renderComponent({ helperText: 'Wybierz model auta' });
      
      expect(screen.getByText('Wybierz model auta')).toBeInTheDocument();
    });

    it('CAR-U-004: shows error styling when error prop is true', () => {
      renderComponent({ error: true, helperText: 'Pole wymagane' });
      
      const helperText = screen.getByText('Pole wymagane');
      expect(helperText).toHaveClass('text-destructive');
    });

    it('CAR-U-005: disables input when disabled prop is true', () => {
      renderComponent({ disabled: true });
      
      expect(screen.getByRole('combobox')).toBeDisabled();
    });
  });

  describe('Search and dropdown', () => {
    it('CAR-U-006: opens dropdown when typing at least 1 character', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent();
      const input = screen.getByRole('combobox');
      
      await user.type(input, 'B');
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('CAR-U-007: displays search results grouped by brand', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
        { id: '2', brand: 'BMW', name: '520d', size: 'L' },
      ]);
      
      const { user } = renderComponent();
      const input = screen.getByRole('combobox');
      
      await user.type(input, 'BMW');
      
      await waitFor(() => {
        // Check for brand group
        expect(screen.getByRole('group', { name: 'BMW' })).toBeInTheDocument();
        // Check for options
        expect(screen.getAllByRole('option')).toHaveLength(2);
      });
    });

    it('CAR-U-008: displays car size badge for each result', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'Audi', name: 'A3', size: 'S' },
        { id: '2', brand: 'Audi', name: 'A6', size: 'L' },
      ]);
      
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('combobox'), 'Audi');
      
      await waitFor(() => {
        expect(screen.getByText('S')).toBeInTheDocument();
        expect(screen.getByText('L')).toBeInTheDocument();
      });
    });

    it('CAR-U-009: shows custom option when no results found', async () => {
      mockSearchModels.mockReturnValue([]);
      
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('combobox'), 'Nieznany Model');
      
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument();
        expect(screen.getByText(/"Nieznany Model"/)).toBeInTheDocument();
      });
    });

    it('CAR-U-010: closes dropdown when clicking outside', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('combobox'), 'BMW');
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      await user.click(document.body);
      
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      });
    });
  });

  describe('Selection', () => {
    it('CAR-U-011: selects model on click and calls onChange', async () => {
      const onChange = vi.fn();
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent({ onChange });
      
      await user.type(screen.getByRole('combobox'), 'BMW');
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('option'));
      
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '1',
          brand: 'BMW',
          name: '320i',
          size: 'M',
          label: 'BMW 320i',
        })
      );
    });

    it('CAR-U-012: calls onSelect callback when model is selected', async () => {
      const onSelect = vi.fn();
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'Volkswagen', name: 'Golf', size: 'M' },
      ]);
      
      const { user } = renderComponent({ onSelect });
      
      await user.type(screen.getByRole('combobox'), 'Golf');
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('option'));
      
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: 'Volkswagen',
          name: 'Golf',
        })
      );
    });

    it('CAR-U-013: selects custom value when clicking custom option', async () => {
      const onChange = vi.fn();
      mockSearchModels.mockReturnValue([]);
      
      const { user } = renderComponent({ onChange });
      
      await user.type(screen.getByRole('combobox'), 'Custom Car');
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('option'));
      
      expect(onChange).toHaveBeenCalledWith({
        type: 'custom',
        label: 'Custom Car',
      });
    });

    it('CAR-U-014: updates input value after selection', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'Audi', name: 'A4', size: 'M' },
      ]);
      
      const { user } = renderComponent();
      const input = screen.getByRole('combobox');
      
      await user.type(input, 'Audi');
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument();
      });
      
      await user.click(screen.getByRole('option'));
      
      expect(input).toHaveValue('Audi A4');
    });
  });

  describe('Clear functionality', () => {
    it('CAR-U-015: shows clear button when input has value', async () => {
      const { user } = renderComponent();
      
      await user.type(screen.getByRole('combobox'), 'Test');
      
      expect(screen.getByLabelText(/wyczyść/i)).toBeInTheDocument();
    });

    it('CAR-U-016: clears input and calls onChange with null on clear', async () => {
      const onChange = vi.fn();
      const onClear = vi.fn();
      
      const { user } = renderComponent({ onChange, onClear });
      
      await user.type(screen.getByRole('combobox'), 'Test');
      await user.click(screen.getByLabelText(/wyczyść/i));
      
      expect(screen.getByRole('combobox')).toHaveValue('');
      expect(onChange).toHaveBeenLastCalledWith(null);
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe('Keyboard navigation', () => {
    it('CAR-U-017: navigates down with ArrowDown', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
        { id: '2', brand: 'BMW', name: '520d', size: 'L' },
      ]);
      
      const { user } = renderComponent();
      const input = screen.getByRole('combobox');
      
      await user.type(input, 'BMW');
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(2);
      });
      
      await user.keyboard('{ArrowDown}');
      
      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('CAR-U-018: selects with Enter key', async () => {
      const onChange = vi.fn();
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent({ onChange });
      const input = screen.getByRole('combobox');
      
      await user.type(input, 'BMW');
      await waitFor(() => {
        expect(screen.getByRole('option')).toBeInTheDocument();
      });
      
      await user.keyboard('{ArrowDown}{Enter}');
      
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ brand: 'BMW', name: '320i' })
      );
    });

    it('CAR-U-019: closes dropdown with Escape', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent();
      const input = screen.getByRole('combobox');
      
      await user.type(input, 'BMW');
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      await user.keyboard('{Escape}');
      
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('CAR-U-020: selects first result on Enter without navigation', async () => {
      const onChange = vi.fn();
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'Audi', name: 'A3', size: 'S' },
        { id: '2', brand: 'Audi', name: 'A4', size: 'M' },
      ]);
      
      const { user } = renderComponent({ onChange });
      
      await user.type(screen.getByRole('combobox'), 'Audi');
      await waitFor(() => {
        expect(screen.getAllByRole('option')).toHaveLength(2);
      });
      
      await user.keyboard('{Enter}');
      
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'A3' })
      );
    });
  });

  describe('SuppressAutoOpen', () => {
    it('CAR-U-021: does not open dropdown on focus when suppressAutoOpen is true', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent({ 
        value: 'BMW 320i',
        suppressAutoOpen: true,
      });
      
      const input = screen.getByRole('combobox');
      await user.click(input);
      
      // Dropdown should not open automatically
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('CAR-U-022: opens dropdown after user interaction even with suppressAutoOpen', async () => {
      mockSearchModels.mockReturnValue([
        { id: '1', brand: 'BMW', name: '320i', size: 'M' },
      ]);
      
      const { user } = renderComponent({ suppressAutoOpen: true });
      
      await user.type(screen.getByRole('combobox'), 'BMW');
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });
  });
});
