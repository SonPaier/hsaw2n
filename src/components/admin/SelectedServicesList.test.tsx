import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SelectedServicesList, { ServiceItem } from './SelectedServicesList';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Mock services with category info
const mockServices = [
  {
    id: 'svc-1',
    name: 'Mycie podstawowe',
    shortcut: 'MP',
    duration_minutes: 30,
    duration_small: 25,
    duration_medium: 30,
    duration_large: 40,
    price_from: 50,
    price_small: 40,
    price_medium: 50,
    price_large: 70,
    category_id: 'cat-1',
    category_prices_are_net: false,
  },
  {
    id: 'svc-2',
    name: 'Polerowanie',
    shortcut: 'POL',
    duration_minutes: 120,
    duration_small: 100,
    duration_medium: 120,
    duration_large: 150,
    price_from: 300,
    price_small: 250,
    price_medium: 300,
    price_large: 400,
    category_id: 'cat-2',
    category_prices_are_net: true, // Net prices - should convert to brutto
  },
  {
    id: 'svc-3',
    name: 'Woskowanie',
    shortcut: 'WOS',
    duration_minutes: 45,
    duration_small: 35,
    duration_medium: 45,
    duration_large: 60,
    price_from: 80,
    price_small: 60,
    price_medium: 80,
    price_large: 120,
    category_id: 'cat-1',
    category_prices_are_net: false,
  },
];

const renderComponent = (props: Partial<React.ComponentProps<typeof SelectedServicesList>> = {}) => {
  const defaultProps = {
    services: mockServices,
    selectedServiceIds: ['svc-1'],
    serviceItems: [],
    carSize: 'medium' as const,
    onRemoveService: vi.fn(),
    onPriceChange: vi.fn(),
    onAddMore: vi.fn(),
    onTotalPriceChange: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <SelectedServicesList {...defaultProps} {...props} />
    </I18nextProvider>
  );
};

describe('SelectedServicesList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Renderowanie listy', () => {
    it('SVC-U-001: wyświetla przycisk "Dodaj usługi" gdy lista jest pusta', () => {
      renderComponent({ selectedServiceIds: [] });
      
      expect(screen.getByRole('button', { name: /dodaj/i })).toBeInTheDocument();
    });

    it('SVC-U-002: wyświetla wybrane usługi z nazwami i skrótami', () => {
      renderComponent({ selectedServiceIds: ['svc-1', 'svc-3'] });
      
      expect(screen.getByText('MP')).toBeInTheDocument();
      expect(screen.getByText('Mycie podstawowe')).toBeInTheDocument();
      expect(screen.getByText('WOS')).toBeInTheDocument();
      expect(screen.getByText('Woskowanie')).toBeInTheDocument();
    });

    it('SVC-U-003: wyświetla czas trwania dla każdej usługi', () => {
      renderComponent({ selectedServiceIds: ['svc-1'] });
      
      // Duration is shown both in service row AND in total - use getAllBy
      const durations = screen.getAllByText('30min');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('SVC-U-004: wyświetla sumę czasów i cen', () => {
      renderComponent({ selectedServiceIds: ['svc-1', 'svc-3'] });
      
      // Total duration: 30 + 45 = 75min = 1h 15min
      expect(screen.getByText(/1h 15min/)).toBeInTheDocument();
      // Total price: 50 + 80 = 130 zł
      expect(screen.getByText('130 zł')).toBeInTheDocument();
    });
  });

  describe('Ceny wg rozmiaru auta', () => {
    it('SVC-U-024: używa price_small dla carSize=small', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1'], 
        carSize: 'small' 
      });
      
      // price_small = 40
      expect(screen.getByRole('button', { name: '40' })).toBeInTheDocument();
    });

    it('SVC-U-025: używa price_medium dla carSize=medium', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1'], 
        carSize: 'medium' 
      });
      
      // price_medium = 50
      expect(screen.getByRole('button', { name: '50' })).toBeInTheDocument();
    });

    it('SVC-U-026: używa price_large dla carSize=large', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1'], 
        carSize: 'large' 
      });
      
      // price_large = 70
      expect(screen.getByRole('button', { name: '70' })).toBeInTheDocument();
    });
  });

  describe('Czas trwania wg rozmiaru auta', () => {
    it('SVC-U-027: używa duration_small dla carSize=small', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1'], 
        carSize: 'small',
      });
      
      // duration_small = 25min
      const durations = screen.getAllByText('25min');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('SVC-U-028: używa duration_medium dla carSize=medium', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1'], 
        carSize: 'medium',
      });
      
      // duration_medium = 30min
      const durations = screen.getAllByText('30min');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('SVC-U-029: używa duration_large dla carSize=large', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1'], 
        carSize: 'large',
      });
      
      // duration_large = 40min
      const durations = screen.getAllByText('40min');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('SVC-U-030: sumuje czas trwania wielu usług wg rozmiaru', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-1', 'svc-3'], // MP + WOS
        carSize: 'small',
      });
      
      // duration_small: 25 + 35 = 60min = 1h
      expect(screen.getByText('1h')).toBeInTheDocument();
    });
  });

  describe('Konwersja net-to-brutto', () => {
    it('SVC-U-023: konwertuje cenę netto na brutto (x1.23, zaokrąglone do 5)', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-2'], // Polerowanie - category_prices_are_net: true
        carSize: 'medium' 
      });
      
      // price_medium = 300 netto
      // 300 * 1.23 = 369 -> zaokrąglone do 5 = 370
      expect(screen.getByRole('button', { name: '370' })).toBeInTheDocument();
    });

    it('SVC-U-023b: wyświetla znacznik (netto→brutto) dla usług z ceną netto', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-2'],
        carSize: 'medium' 
      });
      
      expect(screen.getByText(/netto→brutto/)).toBeInTheDocument();
    });
  });

  describe('Inline edit ceny', () => {
    it('SVC-U-022: kliknięcie na cenę pokazuje input do edycji', async () => {
      const user = userEvent.setup();
      renderComponent({ selectedServiceIds: ['svc-1'] });
      
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('SVC-U-022b: wpisanie nowej ceny wywołuje onPriceChange', async () => {
      const user = userEvent.setup();
      const onPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onPriceChange,
      });
      
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      const input = screen.getByRole('spinbutton');
      // Use fireEvent for number input to avoid userEvent issues
      fireEvent.change(input, { target: { value: '75' } });
      
      expect(onPriceChange).toHaveBeenCalledWith('svc-1', 75);
    });

    it('SVC-U-027: zmiana ceny wywołuje onTotalPriceChange z nową sumą', async () => {
      const user = userEvent.setup();
      const onTotalPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1', 'svc-3'],
        onTotalPriceChange,
      });
      
      // Initial total: 50 + 80 = 130
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      const input = screen.getByRole('spinbutton');
      // Use fireEvent for number input
      fireEvent.change(input, { target: { value: '100' } });
      
      // New total should be 100 + 80 = 180
      expect(onTotalPriceChange).toHaveBeenLastCalledWith(180);
    });

    it('SVC-U-022c: wyświetla custom_price zamiast ceny bazowej gdy ustawione', () => {
      const serviceItems: ServiceItem[] = [
        { service_id: 'svc-1', custom_price: 99 },
      ];
      
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        serviceItems,
      });
      
      expect(screen.getByRole('button', { name: '99' })).toBeInTheDocument();
    });
  });

  describe('Usuwanie usług', () => {
    it('SVC-U-021: kliknięcie ikony kosza wywołuje onRemoveService', async () => {
      const user = userEvent.setup();
      const onRemoveService = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onRemoveService,
      });
      
      // Find the remove button (Trash2 icon)
      const removeButtons = screen.getAllByRole('button');
      const trashButton = removeButtons.find(btn => 
        btn.querySelector('svg.lucide-trash2') || 
        btn.classList.contains('text-destructive')
      );
      
      expect(trashButton).toBeDefined();
      if (trashButton) {
        await user.click(trashButton);
        expect(onRemoveService).toHaveBeenCalledWith('svc-1');
      }
    });
  });

  describe('Dodawanie usług', () => {
    it('SVC-U-020: kliknięcie przycisku "Dodaj" wywołuje onAddMore', async () => {
      const user = userEvent.setup();
      const onAddMore = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onAddMore,
      });
      
      const addButton = screen.getByRole('button', { name: /dodaj/i });
      await user.click(addButton);
      
      expect(onAddMore).toHaveBeenCalled();
    });
  });

  describe('Format czasu', () => {
    it('wyświetla minuty dla krótkich usług', () => {
      renderComponent({ selectedServiceIds: ['svc-1'] }); // 30min
      // Duration shown multiple times (in row and total)
      const durations = screen.getAllByText('30min');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('wyświetla godziny i minuty dla dłuższych usług', () => {
      renderComponent({ 
        selectedServiceIds: ['svc-2'], // 120min = 2h
        carSize: 'medium' 
      });
      // Duration shown multiple times (in row and total)
      const durations = screen.getAllByText('2h');
      expect(durations.length).toBeGreaterThanOrEqual(1);
    });

    it('wyświetla mieszany format (Xh Ymin) gdy potrzebne', () => {
      renderComponent({ selectedServiceIds: ['svc-1', 'svc-3'] }); // 30 + 45 = 75min = 1h 15min
      expect(screen.getByText(/1h 15min/)).toBeInTheDocument();
    });
  });

  describe('Inline price editing - local state', () => {
    it('SVC-U-030: pozwala usunąć wszystkie cyfry w trybie edycji', async () => {
      const user = userEvent.setup();
      const onPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onPriceChange,
      });
      
      // Click on price to start editing
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      // Find the input
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(50);
      
      // Clear the input
      await user.clear(input);
      
      // Input should be empty now (local state)
      expect(input).toHaveValue(null);
      
      // onPriceChange should be called with null
      expect(onPriceChange).toHaveBeenCalledWith('svc-1', null);
    });

    it('SVC-U-031: pozwala wpisać nową wartość po usunięciu', async () => {
      const user = userEvent.setup();
      const onPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onPriceChange,
      });
      
      // Click on price to start editing
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      // Find and clear the input
      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      
      // Type new value
      await user.type(input, '75');
      
      // onPriceChange should be called with 75
      expect(onPriceChange).toHaveBeenCalledWith('svc-1', 75);
    });

    it('SVC-U-032: resetuje do ceny bazowej przy blur z pustą wartością', async () => {
      const user = userEvent.setup();
      const onPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onPriceChange,
      });
      
      // Click on price to start editing
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      // Clear the input
      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      
      // Blur (click outside)
      fireEvent.blur(input);
      
      // Should call onPriceChange with null to reset
      expect(onPriceChange).toHaveBeenLastCalledWith('svc-1', null);
    });
  });

  describe('onTotalPriceChange callback', () => {
    it('SVC-U-040: wywołuje onTotalPriceChange z nową sumą przy zmianie ceny', async () => {
      const user = userEvent.setup();
      const onTotalPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1', 'svc-3'], // 50 + 80 = 130
        onTotalPriceChange,
      });
      
      // Click on first price to start editing
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      // Clear and type new value
      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      await user.type(input, '100');
      
      // Should call with updated total: 100 + 80 = 180
      expect(onTotalPriceChange).toHaveBeenCalledWith(180);
    });

    it('SVC-U-041: oblicza sumę jako 0 dla pustych cen', async () => {
      const user = userEvent.setup();
      const onTotalPriceChange = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'], // 50
        onTotalPriceChange,
      });
      
      // Click on price to start editing
      const priceButton = screen.getByRole('button', { name: '50' });
      await user.click(priceButton);
      
      // Clear the input (price = 0)
      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      
      // Should call with 0
      expect(onTotalPriceChange).toHaveBeenCalledWith(0);
    });
  });
});
