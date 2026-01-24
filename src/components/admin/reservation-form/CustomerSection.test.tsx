import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { CustomerSection } from './CustomerSection';
import { createRef } from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
}));

const renderComponent = (props: Partial<React.ComponentProps<typeof CustomerSection>> = {}) => {
  const defaultProps = {
    instanceId: 'test-instance',
    customerName: '',
    onCustomerNameChange: vi.fn(),
    phone: '',
    onPhoneChange: vi.fn(),
    searchingCustomer: false,
    foundVehicles: [],
    showPhoneDropdown: false,
    onSelectVehicle: vi.fn(),
    onCustomerSelect: vi.fn(),
    onClearCustomer: vi.fn(),
    phoneInputRef: createRef<HTMLDivElement>(),
    setCarModel: vi.fn(),
    setCarSize: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <CustomerSection {...defaultProps} {...props} />
    </I18nextProvider>
  );
};

describe('CustomerSection', () => {
  describe('Renderowanie', () => {
    it('CS-U-001: wyświetla pole imienia klienta', () => {
      renderComponent();
      expect(screen.getByText(/Imię \/ Alias klienta/i)).toBeInTheDocument();
    });

    it('CS-U-002: wyświetla pole telefonu z wymaganą gwiazdką', () => {
      renderComponent();
      expect(screen.getByText(/Telefon/i)).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('CS-U-003: wyświetla loader podczas wyszukiwania klienta', () => {
      renderComponent({ searchingCustomer: true });
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    it('CS-U-004: wyświetla błąd walidacji telefonu', () => {
      renderComponent({ phoneError: 'Telefon jest wymagany' });
      expect(screen.getByText('Telefon jest wymagany')).toBeInTheDocument();
    });
  });

  describe('Interakcje', () => {
    it('CS-U-010: wywołuje onPhoneChange przy wpisywaniu', async () => {
      const onPhoneChange = vi.fn();
      const user = userEvent.setup();
      renderComponent({ onPhoneChange });

      const phoneInput = screen.getByTestId('phone-input');
      await user.type(phoneInput, '123');
      
      expect(onPhoneChange).toHaveBeenCalled();
    });

    it('CS-U-011: wyświetla dropdown z wynikami wyszukiwania', () => {
      const mockVehicles = [
        { id: 'v1', phone: '123456789', model: 'BMW X5', plate: 'WA123', customer_id: null },
      ];
      
      renderComponent({
        showPhoneDropdown: true,
        foundVehicles: mockVehicles,
      });

      // Model is inside nested span with "text-muted-foreground" class
      expect(screen.getByText(/BMW X5/)).toBeInTheDocument();
    });

    it('CS-U-012: wywołuje onSelectVehicle przy kliknięciu pojazdu z dropdown', async () => {
      const onSelectVehicle = vi.fn();
      const user = userEvent.setup();
      const mockVehicles = [
        { id: 'v1', phone: '123456789', model: 'Audi A4', plate: 'WA999', customer_id: null },
      ];

      renderComponent({
        showPhoneDropdown: true,
        foundVehicles: mockVehicles,
        onSelectVehicle,
      });

      // Click the button containing the vehicle info
      const vehicleButton = screen.getByRole('button', { name: /Audi A4/i });
      await user.click(vehicleButton);
      expect(onSelectVehicle).toHaveBeenCalledWith(mockVehicles[0]);
    });
  });

  describe('Formatowanie telefonu', () => {
    it('CS-U-020: formatuje numer z dropdownu jako XXX XXX XXX', () => {
      const mockVehicles = [
        { id: 'v1', phone: '+48123456789', model: 'VW Golf', plate: null, customer_id: null },
      ];

      renderComponent({
        showPhoneDropdown: true,
        foundVehicles: mockVehicles,
      });

      // Phone should be formatted without +48 prefix - use getAllByText for multiple matches
      const phoneElements = screen.getAllByText('123 456 789');
      expect(phoneElements.length).toBeGreaterThan(0);
    });
  });
});
