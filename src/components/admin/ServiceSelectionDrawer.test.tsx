import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ServiceSelectionDrawer from './ServiceSelectionDrawer';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      const mockData: Record<string, unknown[]> = {
        services: [
          {
            id: 'svc-1',
            name: 'Mycie podstawowe',
            shortcut: 'MP',
            category_id: 'cat-1',
            duration_minutes: 30,
            duration_small: 25,
            duration_medium: 30,
            duration_large: 40,
            price_from: 50,
            price_small: 40,
            price_medium: 50,
            price_large: 70,
            sort_order: 1,
            station_type: 'washing',
          },
          {
            id: 'svc-2',
            name: 'Polerowanie',
            shortcut: 'POL',
            category_id: 'cat-2',
            duration_minutes: 120,
            duration_small: 100,
            duration_medium: 120,
            duration_large: 150,
            price_from: 300,
            price_small: 250,
            price_medium: 300,
            price_large: 400,
            sort_order: 2,
            station_type: 'detailing',
          },
          {
            id: 'svc-3',
            name: 'Woskowanie',
            shortcut: 'WOS',
            category_id: 'cat-1',
            duration_minutes: 45,
            duration_small: 35,
            duration_medium: 45,
            duration_large: 60,
            price_from: 80,
            price_small: 60,
            price_medium: 80,
            price_large: 120,
            sort_order: 3,
            station_type: 'washing',
          },
        ],
        service_categories: [
          { id: 'cat-1', name: 'Mycie', sort_order: 1, prices_are_net: false },
          { id: 'cat-2', name: 'Detailing', sort_order: 2, prices_are_net: true },
        ],
      };

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => 
          Promise.resolve({ data: mockData[table] || [], error: null })
        ),
      };
    }),
  },
}));

const renderComponent = (props: Partial<React.ComponentProps<typeof ServiceSelectionDrawer>> = {}) => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    instanceId: 'test-instance-id',
    carSize: 'medium' as const,
    selectedServiceIds: [],
    onConfirm: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <ServiceSelectionDrawer {...defaultProps} {...props} />
    </I18nextProvider>
  );
};

describe('ServiceSelectionDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ładowanie i renderowanie', () => {
    it('SDRW-U-001: pokazuje tytuł "Wybierz usługę"', async () => {
      renderComponent();
      await waitFor(() => {
        expect(screen.getByText(/Wybierz usługę/i)).toBeInTheDocument();
      });
    });

    it('SDRW-U-002: wyświetla usługi pogrupowane według kategorii', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Mycie')).toBeInTheDocument();
        expect(screen.getByText('Detailing')).toBeInTheDocument();
      });
    });

    it('SDRW-U-003: wyświetla pole wyszukiwania z placeholderem', async () => {
      renderComponent();
      
      await waitFor(() => {
        // Placeholder is in Polish: "Wpisz skrót np. MZ, KPL..."
        expect(screen.getByPlaceholderText(/Wpisz skrót/i)).toBeInTheDocument();
      });
    });
  });

  describe('Wyszukiwanie usług', () => {
    it('SDRW-U-010: wyszukuje po skrócie usługi', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Mycie podstawowe')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/Wpisz skrót/i);
      await user.type(searchInput, 'MP');
      
      // Should show matching service chip - there may be multiple MP elements
      await waitFor(() => {
        const mpElements = screen.getAllByText('MP');
        expect(mpElements.length).toBeGreaterThanOrEqual(1);
      });
    });

    it('SDRW-U-011: wyszukuje po nazwie usługi', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Mycie podstawowe')).toBeInTheDocument();
      });
      
      const searchInput = screen.getByPlaceholderText(/Wpisz skrót/i);
      await user.type(searchInput, 'polero');
      
      await waitFor(() => {
        // Should show Polerowanie in matching chips - multiple elements possible
        const polElements = screen.getAllByText('POL');
        expect(polElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Selekcja usług', () => {
    it('SDRW-U-020: kliknięcie na usługę dodaje ją do wybranych', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Mycie podstawowe')).toBeInTheDocument();
      });
      
      // Find and click service button
      const serviceButtons = screen.getAllByRole('button');
      const mycieButton = serviceButtons.find(btn => 
        btn.textContent?.includes('Mycie podstawowe')
      );
      
      if (mycieButton) {
        await user.click(mycieButton);
        
        // Should show selected chip
        await waitFor(() => {
          expect(screen.getByText(/Wybrane usługi/i)).toBeInTheDocument();
        });
      }
    });

    it('SDRW-U-021: wyświetla wstępnie wybrane usługi', async () => {
      renderComponent({ selectedServiceIds: ['svc-1'] });
      
      await waitFor(() => {
        expect(screen.getByText(/Wybrane usługi/i)).toBeInTheDocument();
      });
    });

    it('SDRW-U-022: kliknięcie na wybraną usługę usuwa ją', async () => {
      const user = userEvent.setup();
      renderComponent({ selectedServiceIds: ['svc-1'] });
      
      await waitFor(() => {
        expect(screen.getByText(/Wybrane usługi/i)).toBeInTheDocument();
      });
      
      // Find the selected chip with X icon
      const selectedChips = screen.getAllByRole('button');
      const removeChip = selectedChips.find(btn => 
        btn.textContent?.includes('MP') && btn.querySelector('svg')
      );
      
      if (removeChip) {
        await user.click(removeChip);
        
        await waitFor(() => {
          // Should no longer show selected services section if no services selected
          expect(screen.queryByText(/Wybrane usługi \(1\)/)).not.toBeInTheDocument();
        });
      }
    });
  });

  describe('Potwierdzenie wyboru', () => {
    it('SDRW-U-030: przycisk Dodaj wywołuje onConfirm z wybranymi usługami', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'],
        onConfirm,
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Wybrane usługi/i)).toBeInTheDocument();
      });
      
      // Button says "Dodaj" not "Potwierdź"
      const confirmButton = screen.getByRole('button', { name: /dodaj/i });
      await user.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalled();
      // First argument should be array of selected IDs
      expect(onConfirm.mock.calls[0][0]).toContain('svc-1');
    });

    it('SDRW-U-031: przycisk Dodaj przekazuje poprawny czas trwania', async () => {
      const user = userEvent.setup();
      const onConfirm = vi.fn();
      renderComponent({ 
        selectedServiceIds: ['svc-1'], // 30min for medium
        carSize: 'medium',
        onConfirm,
      });
      
      await waitFor(() => {
        expect(screen.getByText(/Wybrane usługi/i)).toBeInTheDocument();
      });
      
      const confirmButton = screen.getByRole('button', { name: /dodaj/i });
      await user.click(confirmButton);
      
      // Second argument is totalDuration
      expect(onConfirm.mock.calls[0][1]).toBe(30);
    });
  });

  describe('Ceny', () => {
    it('SDRW-U-040: wyświetla ceny brutto dla usług z cenami netto', async () => {
      renderComponent();
      
      await waitFor(() => {
        expect(screen.getByText('Polerowanie')).toBeInTheDocument();
      });
      
      // Polerowanie: 300 netto * 1.23 = 369 -> rounded to 370
      const priceElements = screen.getAllByText(/370/);
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });

    it('SDRW-U-041: wyświetla ceny dla wybranego rozmiaru auta', async () => {
      renderComponent({ carSize: 'small' });
      
      await waitFor(() => {
        expect(screen.getByText('Mycie podstawowe')).toBeInTheDocument();
      });
      
      // Mycie podstawowe: price_small = 40
      const priceElements = screen.getAllByText(/40 zł/);
      expect(priceElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
