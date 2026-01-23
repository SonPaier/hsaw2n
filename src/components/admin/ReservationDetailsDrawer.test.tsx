import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import ReservationDetailsDrawer, { HallConfig } from './ReservationDetailsDrawer';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { public_token: 'test-token-123' } }),
          }),
        }),
      }),
    }),
  },
}));

// Mock mobile hook
vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock SendSmsDialog
vi.mock('@/components/admin/SendSmsDialog', () => ({
  default: ({ open }: { open: boolean }) => 
    open ? <div data-testid="sms-dialog">SMS Dialog</div> : null,
}));

// Mock ReservationHistoryDrawer
vi.mock('./history/ReservationHistoryDrawer', () => ({
  ReservationHistoryDrawer: ({ open }: { open: boolean }) => 
    open ? <div data-testid="history-drawer">History Drawer</div> : null,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    <MemoryRouter>{children}</MemoryRouter>
  </I18nextProvider>
);

const mockBaseReservation = {
  id: 'res-123',
  instance_id: 'inst-456',
  customer_name: 'Jan Kowalski',
  customer_phone: '+48733854184',
  customer_email: 'jan@example.com',
  vehicle_plate: 'BMW X5 WA12345',
  car_size: 'medium' as const,
  reservation_date: '2025-01-25',
  start_time: '10:00:00',
  end_time: '12:00:00',
  station_id: 'station-1',
  status: 'confirmed',
  confirmation_code: 'ABC123',
  price: 150,
  customer_notes: 'Proszę o dokładne mycie felg',
  admin_notes: 'Stały klient VIP',
  source: 'admin',
  created_by_username: 'admin_user',
  services_data: [
    { id: 'svc-1', name: 'Mycie zewnętrzne', shortcut: 'MZ', price_small: 50, price_medium: 70, price_large: 90 },
    { id: 'svc-2', name: 'Czyszczenie wnętrza', shortcut: 'CW', price_small: 60, price_medium: 80, price_large: 100 },
  ],
  service_items: [
    { service_id: 'svc-1', custom_price: 75 },
    { service_id: 'svc-2', custom_price: null },
  ],
};

const renderDrawer = (props: Partial<Parameters<typeof ReservationDetailsDrawer>[0]> = {}) => {
  const defaultProps = {
    reservation: mockBaseReservation,
    open: true,
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onNoShow: vi.fn(),
    onConfirm: vi.fn(),
    onStartWork: vi.fn(),
    onEndWork: vi.fn(),
    onRelease: vi.fn(),
    onRevertToConfirmed: vi.fn(),
    onRevertToInProgress: vi.fn(),
    onStatusChange: vi.fn(),
    onSendPickupSms: vi.fn(),
    onSendConfirmationSms: vi.fn(),
  };
  
  return render(
    <TestWrapper>
      <ReservationDetailsDrawer {...defaultProps} {...props} />
    </TestWrapper>
  );
};

describe('ReservationDetailsDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering - Basic Info', () => {
    it('RDD-U-001: wyświetla czas i datę rezerwacji w nagłówku', () => {
      renderDrawer();
      
      expect(screen.getByText(/10:00 - 12:00/)).toBeInTheDocument();
      expect(screen.getByText(/25 stycznia 2025/)).toBeInTheDocument();
    });

    it('RDD-U-002: wyświetla status confirmed jako badge', () => {
      renderDrawer();
      
      // Translation is "Potwierdzone" (neuter form)
      expect(screen.getByText('Potwierdzone')).toBeInTheDocument();
    });

    it('RDD-U-003: wyświetla imię i nazwisko klienta', () => {
      renderDrawer();
      
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    });

    it('RDD-U-004: wyświetla numer telefonu w formacie display', () => {
      renderDrawer();
      
      // formatPhoneDisplay strips +48 and formats as XXX XXX XXX
      expect(screen.getByText('733 854 184')).toBeInTheDocument();
    });

    it('RDD-U-005: wyświetla kod potwierdzenia rezerwacji', () => {
      renderDrawer();
      
      expect(screen.getByText('ABC123')).toBeInTheDocument();
    });

    it('RDD-U-006: wyświetla model pojazdu', () => {
      renderDrawer();
      
      expect(screen.getByText('BMW X5 WA12345')).toBeInTheDocument();
    });

    it('RDD-U-007: wyświetla listę usług jako badges', () => {
      renderDrawer();
      
      expect(screen.getByText('Mycie zewnętrzne')).toBeInTheDocument();
      expect(screen.getByText('Czyszczenie wnętrza')).toBeInTheDocument();
    });

    it('RDD-U-008: wyświetla cenę łączną', () => {
      renderDrawer();
      
      expect(screen.getByText('150 zł')).toBeInTheDocument();
    });

    it('RDD-U-009: wyświetla notatki klienta', () => {
      renderDrawer();
      
      expect(screen.getByText('Proszę o dokładne mycie felg')).toBeInTheDocument();
    });

    it('RDD-U-010: wyświetla notatki admina', () => {
      renderDrawer();
      
      expect(screen.getByText('Stały klient VIP')).toBeInTheDocument();
    });

    it('RDD-U-011: wyświetla źródło rezerwacji z username', () => {
      renderDrawer();
      
      expect(screen.getByText(/admin_user/)).toBeInTheDocument();
    });

    it('RDD-U-012: wyświetla zakres dat dla rezerwacji wielodniowej', () => {
      renderDrawer({
        reservation: {
          ...mockBaseReservation,
          end_date: '2025-01-27',
        },
      });
      
      expect(screen.getByText(/25 sty - 27 sty 2025/)).toBeInTheDocument();
    });
  });

  describe('Rendering - Status Badges', () => {
    it('RDD-U-020: wyświetla badge pending', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'pending' },
      });
      
      // Translation: "Oczekujące" (neuter form)
      expect(screen.getByText('Oczekujące')).toBeInTheDocument();
    });

    it('RDD-U-021: wyświetla badge in_progress', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'in_progress' },
      });
      
      expect(screen.getByText('W trakcie')).toBeInTheDocument();
    });

    it('RDD-U-022: wyświetla badge completed', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'completed' },
      });
      
      // Translation: "Zakończone" (neuter form)
      expect(screen.getByText('Zakończone')).toBeInTheDocument();
    });

    it('RDD-U-023: wyświetla badge released', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'released' },
      });
      
      // Translation: "Pojazd wydany" - appears twice (badge and button), use getAllBy
      const elements = screen.getAllByText('Pojazd wydany');
      expect(elements.length).toBeGreaterThan(0);
    });

    it('RDD-U-024: wyświetla badge cancelled', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'cancelled' },
      });
      
      // Translation: "Anulowane" (neuter form)
      expect(screen.getByText('Anulowane')).toBeInTheDocument();
    });

    it('RDD-U-025: wyświetla badge no_show', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'no_show' },
      });
      
      // Translation: "Nieobecność"
      expect(screen.getByText('Nieobecność')).toBeInTheDocument();
    });

    it('RDD-U-026: wyświetla badge change_requested', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'change_requested' },
      });
      
      expect(screen.getByText('Prośba o zmianę')).toBeInTheDocument();
    });
  });

  describe('Actions - Confirmed Status', () => {
    it('RDD-U-030: wyświetla przycisk Edytuj dla confirmed', () => {
      renderDrawer();
      
      expect(screen.getByRole('button', { name: /edytuj/i })).toBeInTheDocument();
    });

    it('RDD-U-031: wyświetla przycisk Usuń dla confirmed', () => {
      renderDrawer();
      
      expect(screen.getByRole('button', { name: /usuń/i })).toBeInTheDocument();
    });

    it('RDD-U-032: wyświetla przycisk Rozpocznij pracę dla confirmed', () => {
      renderDrawer();
      
      expect(screen.getByRole('button', { name: /rozpocznij pracę/i })).toBeInTheDocument();
    });

    it('RDD-U-033: wyświetla przycisk Historia dla confirmed', () => {
      renderDrawer();
      
      const historyButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-history') !== null
      );
      expect(historyButtons.length).toBeGreaterThan(0);
    });

    it('RDD-U-034: kliknięcie Edytuj wywołuje onEdit', async () => {
      const onEdit = vi.fn();
      renderDrawer({ onEdit });
      
      await userEvent.click(screen.getByRole('button', { name: /edytuj/i }));
      
      expect(onEdit).toHaveBeenCalledWith(mockBaseReservation);
    });

    it('RDD-U-035: kliknięcie Usuń otwiera dialog potwierdzenia', async () => {
      renderDrawer();
      
      await userEvent.click(screen.getByRole('button', { name: /usuń/i }));
      
      // The translation is "Czy na pewno chcesz usunąć rezerwację?"
      await waitFor(() => {
        expect(screen.getByText(/usunąć rezerwację/i)).toBeInTheDocument();
      });
    });

    it('RDD-U-036: dialog usuwania zawiera opcję "Oznacz jako nieobecność"', async () => {
      renderDrawer();
      
      await userEvent.click(screen.getByRole('button', { name: /usuń/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /oznacz jako nieobecność/i })).toBeInTheDocument();
      });
    });

    it('RDD-U-037: kliknięcie Rozpocznij pracę wywołuje onStartWork', async () => {
      const onStartWork = vi.fn();
      renderDrawer({ onStartWork });
      
      await userEvent.click(screen.getByRole('button', { name: /rozpocznij pracę/i }));
      
      expect(onStartWork).toHaveBeenCalledWith('res-123');
    });
  });

  describe('Actions - In Progress Status', () => {
    const inProgressReservation = { ...mockBaseReservation, status: 'in_progress' };

    it('RDD-U-040: wyświetla przycisk Zakończ pracę dla in_progress', () => {
      renderDrawer({ reservation: inProgressReservation });
      
      expect(screen.getByRole('button', { name: /zakończ pracę/i })).toBeInTheDocument();
    });

    it('RDD-U-041: wyświetla przycisk Edytuj dla in_progress', () => {
      renderDrawer({ reservation: inProgressReservation });
      
      expect(screen.getByRole('button', { name: /edytuj/i })).toBeInTheDocument();
    });

    it('RDD-U-042: NIE wyświetla przycisku Usuń dla in_progress', () => {
      renderDrawer({ reservation: inProgressReservation });
      
      expect(screen.queryByRole('button', { name: /usuń/i })).not.toBeInTheDocument();
    });

    it('RDD-U-043: kliknięcie Zakończ pracę wywołuje onEndWork', async () => {
      const onEndWork = vi.fn();
      renderDrawer({ reservation: inProgressReservation, onEndWork });
      
      await userEvent.click(screen.getByRole('button', { name: /zakończ pracę/i }));
      
      expect(onEndWork).toHaveBeenCalledWith('res-123');
    });
  });

  describe('Actions - Completed Status', () => {
    const completedReservation = { ...mockBaseReservation, status: 'completed' };

    it('RDD-U-050: wyświetla przycisk Wydaj pojazd dla completed', () => {
      renderDrawer({ reservation: completedReservation });
      
      expect(screen.getByRole('button', { name: /wydaj pojazd/i })).toBeInTheDocument();
    });

    it('RDD-U-051: kliknięcie Wydaj pojazd wywołuje onRelease', async () => {
      const onRelease = vi.fn();
      renderDrawer({ reservation: completedReservation, onRelease });
      
      await userEvent.click(screen.getByRole('button', { name: /wydaj pojazd/i }));
      
      expect(onRelease).toHaveBeenCalledWith('res-123');
    });
  });

  describe('Actions - Pending Status', () => {
    const pendingReservation = { ...mockBaseReservation, status: 'pending' };

    it('RDD-U-060: wyświetla przycisk Potwierdź dla pending', () => {
      renderDrawer({ reservation: pendingReservation });
      
      expect(screen.getByRole('button', { name: /potwierdź/i })).toBeInTheDocument();
    });

    it('RDD-U-061: wyświetla przycisk Odrzuć dla pending', () => {
      renderDrawer({ reservation: pendingReservation });
      
      expect(screen.getByRole('button', { name: /odrzuć/i })).toBeInTheDocument();
    });

    it('RDD-U-062: kliknięcie Potwierdź wywołuje onConfirm', async () => {
      const onConfirm = vi.fn();
      renderDrawer({ reservation: pendingReservation, onConfirm });
      
      await userEvent.click(screen.getByRole('button', { name: /potwierdź/i }));
      
      expect(onConfirm).toHaveBeenCalledWith('res-123');
    });

    it('RDD-U-063: wyświetla ostrzeżenie gdy brak car_size', () => {
      renderDrawer({ 
        reservation: { ...pendingReservation, car_size: null },
      });
      
      // Uses carSizeRequiredWarning translation - check for car icon warning element
      const warningElement = document.querySelector('.bg-warning\\/10');
      expect(warningElement).toBeInTheDocument();
    });
  });

  describe('Actions - Change Requested Status', () => {
    const changeRequestedReservation = {
      ...mockBaseReservation,
      status: 'change_requested',
      original_reservation: {
        reservation_date: '2025-01-20',
        start_time: '09:00:00',
        confirmation_code: 'OLD123',
      },
    };

    it('RDD-U-070: wyświetla przycisk Zatwierdź zmianę', () => {
      renderDrawer({ 
        reservation: changeRequestedReservation,
        onApproveChangeRequest: vi.fn(),
      });
      
      expect(screen.getByRole('button', { name: /zatwierdź/i })).toBeInTheDocument();
    });

    it('RDD-U-071: wyświetla przycisk Odrzuć zmianę', () => {
      renderDrawer({ 
        reservation: changeRequestedReservation,
        onRejectChangeRequest: vi.fn(),
      });
      
      expect(screen.getByRole('button', { name: /odrzuć/i })).toBeInTheDocument();
    });

    it('RDD-U-072: wyświetla informacje o oryginalnej rezerwacji', () => {
      renderDrawer({ 
        reservation: changeRequestedReservation,
        onApproveChangeRequest: vi.fn(),
      });
      
      expect(screen.getByText('OLD123')).toBeInTheDocument();
      expect(screen.getByText(/20 stycznia 2025/)).toBeInTheDocument();
    });
  });

  describe('SMS Actions', () => {
    it('RDD-U-080: footer z akcjami SMS renderuje się dla confirmed', () => {
      renderDrawer();
      
      // Check that the footer actions area exists
      const footer = document.querySelector('.border-t.pt-4');
      expect(footer).toBeInTheDocument();
    });

    it('RDD-U-081: footer z akcjami renderuje się dla in_progress', () => {
      renderDrawer({ 
        reservation: { ...mockBaseReservation, status: 'in_progress' },
      });
      
      const footer = document.querySelector('.border-t.pt-4');
      expect(footer).toBeInTheDocument();
    });

    it('RDD-U-082: komponent renderuje się poprawnie z confirmation_sms_sent_at', () => {
      renderDrawer({ 
        reservation: { 
          ...mockBaseReservation, 
          confirmation_sms_sent_at: '2025-01-24T15:30:00Z',
        },
      });
      
      // Component renders without error
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    });
  });

  describe('Contact Buttons', () => {
    it('RDD-U-090: wyświetla przycisk telefonu', () => {
      renderDrawer();
      
      const phoneButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-phone-call') !== null
      );
      expect(phoneButtons.length).toBeGreaterThan(0);
    });

    it('RDD-U-091: wyświetla przycisk SMS', () => {
      renderDrawer();
      
      const smsButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-message-square') !== null
      );
      expect(smsButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Price Details', () => {
    it('RDD-U-100: wyświetla przycisk "Zobacz szczegóły" dla wielu usług', () => {
      renderDrawer();
      
      expect(screen.getByText(/zobacz szczegóły/i)).toBeInTheDocument();
    });

    it('RDD-U-101: rozwija szczegóły cen po kliknięciu', async () => {
      renderDrawer();
      
      await userEvent.click(screen.getByText(/zobacz szczegóły/i));
      
      // Should show individual prices
      await waitFor(() => {
        expect(screen.getByText('Razem')).toBeInTheDocument();
      });
    });

    it('RDD-U-102: NIE wyświetla "Zobacz szczegóły" dla jednej usługi', () => {
      renderDrawer({
        reservation: {
          ...mockBaseReservation,
          services_data: [mockBaseReservation.services_data![0]],
          service_items: [mockBaseReservation.service_items![0]],
        },
      });
      
      expect(screen.queryByText(/zobacz szczegóły/i)).not.toBeInTheDocument();
    });
  });

  describe('Offer Link', () => {
    it('RDD-U-110: wyświetla link do oferty gdy offer_number istnieje', async () => {
      renderDrawer({
        reservation: {
          ...mockBaseReservation,
          offer_number: 'OF-2025-001',
        },
      });
      
      await waitFor(() => {
        expect(screen.getByText('#OF-2025-001')).toBeInTheDocument();
      });
    });

    it('RDD-U-111: NIE wyświetla sekcji oferty gdy brak offer_number', () => {
      renderDrawer();
      
      expect(screen.queryByText(/oferta/i)).not.toBeInTheDocument();
    });
  });

  describe('History Drawer', () => {
    it('RDD-U-120: kliknięcie Historia otwiera drawer historii', async () => {
      renderDrawer();
      
      const historyButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg.lucide-history') !== null
      );
      
      if (historyButton) {
        await userEvent.click(historyButton);
        
        await waitFor(() => {
          expect(screen.getByTestId('history-drawer')).toBeInTheDocument();
        });
      }
    });
  });

  describe('Hall Mode', () => {
    const hallConfig: HallConfig = {
      visible_fields: {
        customer_name: true,
        customer_phone: false,
        vehicle_plate: true,
        services: true,
        admin_notes: false,
      },
      allowed_actions: {
        add_services: true,
        change_time: false,
        change_station: false,
        edit_reservation: true,
        delete_reservation: false,
      },
    };

    it('RDD-U-130: ukrywa telefon w trybie hall gdy disabled', () => {
      renderDrawer({
        mode: 'hall',
        hallConfig,
      });
      
      expect(screen.queryByText('733 854 184')).not.toBeInTheDocument();
    });

    it('RDD-U-131: ukrywa notatki admina w trybie hall gdy disabled', () => {
      renderDrawer({
        mode: 'hall',
        hallConfig,
      });
      
      expect(screen.queryByText('Stały klient VIP')).not.toBeInTheDocument();
    });

    it('RDD-U-132: wyświetla przycisk Edytuj gdy dozwolony w hall', () => {
      renderDrawer({
        mode: 'hall',
        hallConfig,
      });
      
      expect(screen.getByRole('button', { name: /edytuj/i })).toBeInTheDocument();
    });

    it('RDD-U-133: ukrywa przycisk Usuń gdy niedozwolony w hall', () => {
      renderDrawer({
        mode: 'hall',
        hallConfig,
      });
      
      expect(screen.queryByRole('button', { name: /usuń/i })).not.toBeInTheDocument();
    });

    it('RDD-U-134: ukrywa kod potwierdzenia w trybie hall', () => {
      renderDrawer({
        mode: 'hall',
        hallConfig,
      });
      
      expect(screen.queryByText('ABC123')).not.toBeInTheDocument();
    });

    it('RDD-U-135: ukrywa przycisk Historia w trybie hall', () => {
      renderDrawer({
        mode: 'hall',
        hallConfig,
      });
      
      const historyButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-history') !== null
      );
      expect(historyButtons.length).toBe(0);
    });
  });

  describe('Close Button', () => {
    it('RDD-U-140: wyświetla przycisk X do zamknięcia', () => {
      renderDrawer();
      
      const closeButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-x') !== null
      );
      expect(closeButtons.length).toBeGreaterThan(0);
    });

    it('RDD-U-141: kliknięcie X wywołuje onClose', async () => {
      const onClose = vi.fn();
      renderDrawer({ onClose });
      
      const closeButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg.lucide-x') !== null
      );
      
      if (closeButton) {
        await userEvent.click(closeButton);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Source Labels', () => {
    it('RDD-U-150: wyświetla źródło admin z username', () => {
      renderDrawer();
      
      expect(screen.getByText(/admin_user/)).toBeInTheDocument();
    });

    it('RDD-U-151: wyświetla źródło customer jako System', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, source: 'customer', created_by_username: null },
      });
      
      expect(screen.getByText(/System/)).toBeInTheDocument();
    });

    it('RDD-U-152: wyświetla źródło booksy', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, source: 'booksy' },
      });
      
      expect(screen.getByText(/Booksy/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('RDD-U-160: zwraca null gdy brak reservation', () => {
      const { container } = render(
        <TestWrapper>
          <ReservationDetailsDrawer 
            reservation={null}
            open={true}
            onClose={vi.fn()}
          />
        </TestWrapper>
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('RDD-U-161: wyświetla "Brak notatek" gdy brak admin_notes', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, admin_notes: null },
      });
      
      expect(screen.getByText('Brak notatek wewnętrznych')).toBeInTheDocument();
    });

    it('RDD-U-162: obsługuje brak services_data', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, services_data: undefined },
      });
      
      // Should still render without crashing
      expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    });

    it('RDD-U-163: wyświetla legacy service.name gdy brak services_data', () => {
      renderDrawer({
        reservation: { 
          ...mockBaseReservation, 
          services_data: undefined,
          service: { name: 'Legacy Service' },
        },
      });
      
      expect(screen.getByText('Legacy Service')).toBeInTheDocument();
    });
  });

  describe('Status Dropdown Actions', () => {
    it('RDD-U-170: confirmed ma przycisk dropdown statusu', () => {
      renderDrawer();
      
      // Find the dropdown trigger (ChevronDown button)
      const dropdownButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-chevron-down') !== null
      );
      
      expect(dropdownButtons.length).toBeGreaterThan(0);
    });

    it('RDD-U-171: in_progress ma przycisk dropdown statusu', () => {
      renderDrawer({ 
        reservation: { ...mockBaseReservation, status: 'in_progress' },
      });
      
      const dropdownButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-chevron-down') !== null
      );
      
      expect(dropdownButtons.length).toBeGreaterThan(0);
    });

    it('RDD-U-172: completed ma przycisk dropdown statusu', () => {
      renderDrawer({ 
        reservation: { ...mockBaseReservation, status: 'completed' },
      });
      
      const dropdownButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-chevron-down') !== null
      );
      
      expect(dropdownButtons.length).toBeGreaterThan(0);
    });

    it('RDD-U-173: released ma przycisk dropdown statusu', () => {
      renderDrawer({ 
        reservation: { ...mockBaseReservation, status: 'released' },
      });
      
      const dropdownButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-chevron-down') !== null
      );
      
      expect(dropdownButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Actions - Released Status', () => {
    const releasedReservation = { ...mockBaseReservation, status: 'released' };

    it('RDD-U-052: wyświetla przycisk Edytuj dla released', () => {
      renderDrawer({ reservation: releasedReservation });
      
      expect(screen.getByRole('button', { name: /edytuj/i })).toBeInTheDocument();
    });

    it('RDD-U-053: NIE wyświetla przycisku Usuń dla released', () => {
      renderDrawer({ reservation: releasedReservation });
      
      expect(screen.queryByRole('button', { name: /usuń/i })).not.toBeInTheDocument();
    });
  });

  describe('Actions - Cancelled Status', () => {
    const cancelledReservation = { ...mockBaseReservation, status: 'cancelled' };

    it('RDD-U-064: NIE wyświetla akcji dla cancelled', () => {
      renderDrawer({ reservation: cancelledReservation });
      
      // Should not have action buttons like Edit, Delete, Start Work
      expect(screen.queryByRole('button', { name: /rozpocznij pracę/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /zakończ pracę/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /potwierdź/i })).not.toBeInTheDocument();
    });
  });

  describe('Actions - No Show Status', () => {
    const noShowReservation = { ...mockBaseReservation, status: 'no_show' };

    it('RDD-U-065: NIE wyświetla akcji dla no_show', () => {
      renderDrawer({ reservation: noShowReservation });
      
      // Should not have action buttons
      expect(screen.queryByRole('button', { name: /rozpocznij pracę/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /zakończ pracę/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /potwierdź/i })).not.toBeInTheDocument();
    });
  });

  describe('SMS Links', () => {
    it('RDD-U-083: wyświetla link SMS potwierdzenie dla confirmed', () => {
      const onSendConfirmationSms = vi.fn();
      renderDrawer({ 
        reservation: mockBaseReservation,
        onSendConfirmationSms,
      });
      
      // Should show send confirmation SMS link - translation: "Wyślij SMS o potwierdzeniu wizyty"
      expect(screen.getByText(/wyślij sms o potwierdzeniu/i)).toBeInTheDocument();
    });

    it('RDD-U-084: wyświetla link SMS odbiór dla in_progress', () => {
      const onSendPickupSms = vi.fn();
      renderDrawer({ 
        reservation: { ...mockBaseReservation, status: 'in_progress' },
        onSendPickupSms,
      });
      
      // Should show send pickup SMS link - translation: "Wyślij SMS o odbiorze"
      expect(screen.getByText(/wyślij.*sms.*odbior/i)).toBeInTheDocument();
    });

    it('RDD-U-085: wyświetla timestamp pickup_sms_sent_at', () => {
      const onSendPickupSms = vi.fn();
      renderDrawer({ 
        reservation: { 
          ...mockBaseReservation, 
          status: 'in_progress',
          pickup_sms_sent_at: '2025-01-24T15:30:00Z',
        },
        onSendPickupSms,
      });
      
      // Should show "SMS wysłany" with timestamp - translation: "SMS wysłany: {{datetime}}"
      expect(screen.getByText(/sms wysłany/i)).toBeInTheDocument();
    });
  });

  describe('Hall Mode - Extended', () => {
    it('RDD-U-136: ukrywa imię klienta gdy customer_name: false', () => {
      const hallConfigHideName: HallConfig = {
        visible_fields: {
          customer_name: false,
          customer_phone: false,
          vehicle_plate: true,
          services: true,
          admin_notes: false,
        },
        allowed_actions: {
          add_services: false,
          change_time: false,
          change_station: false,
          edit_reservation: false,
          delete_reservation: false,
        },
      };

      renderDrawer({
        mode: 'hall',
        hallConfig: hallConfigHideName,
      });
      
      expect(screen.queryByText('Jan Kowalski')).not.toBeInTheDocument();
    });

    it('RDD-U-137: ukrywa przycisk Edytuj gdy edit_reservation: false', () => {
      const hallConfigNoEdit: HallConfig = {
        visible_fields: {
          customer_name: true,
          customer_phone: true,
          vehicle_plate: true,
          services: true,
          admin_notes: true,
        },
        allowed_actions: {
          add_services: true,
          change_time: false,
          change_station: false,
          edit_reservation: false,
          delete_reservation: false,
        },
      };

      renderDrawer({
        mode: 'hall',
        hallConfig: hallConfigNoEdit,
      });
      
      expect(screen.queryByRole('button', { name: /edytuj/i })).not.toBeInTheDocument();
    });

    it('RDD-U-138: wyświetla przycisk Usuń gdy delete_reservation: true', () => {
      const hallConfigWithDelete: HallConfig = {
        visible_fields: {
          customer_name: true,
          customer_phone: true,
          vehicle_plate: true,
          services: true,
          admin_notes: true,
        },
        allowed_actions: {
          add_services: true,
          change_time: false,
          change_station: false,
          edit_reservation: true,
          delete_reservation: true,
        },
      };

      renderDrawer({
        mode: 'hall',
        hallConfig: hallConfigWithDelete,
      });
      
      expect(screen.getByRole('button', { name: /usuń/i })).toBeInTheDocument();
    });
  });

  describe('Default Status Badge', () => {
    it('RDD-U-027: wyświetla badge dla nieznanego statusu', () => {
      renderDrawer({
        reservation: { ...mockBaseReservation, status: 'unknown_status' },
      });
      
      expect(screen.getByText('unknown_status')).toBeInTheDocument();
    });
  });
});
