import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { VehicleSection } from './VehicleSection';
import { CarModelsProvider } from '@/contexts/CarModelsContext';
import { createRef } from 'react';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (cb: (res: { data: unknown[] }) => void) => {
        cb({ data: [] });
        return Promise.resolve({ data: [] });
      },
    }),
  },
}));

const renderComponent = (props: Partial<React.ComponentProps<typeof VehicleSection>> = {}) => {
  const defaultProps = {
    carModel: '',
    onCarModelChange: vi.fn(),
    carSize: 'medium' as const,
    onCarSizeChange: vi.fn(),
    customerVehicles: [],
    selectedVehicleId: null,
    onVehicleSelect: vi.fn(),
    carModelRef: createRef<HTMLDivElement>(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <CarModelsProvider>
        <VehicleSection {...defaultProps} {...props} />
      </CarModelsProvider>
    </I18nextProvider>
  );
};

describe('VehicleSection', () => {
  describe('Renderowanie', () => {
    it('VS-U-001: wyświetla pole modelu auta z wymaganą gwiazdką', () => {
      renderComponent();
      expect(screen.getByText(/Marka i model/i)).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('VS-U-002: wyświetla przyciski rozmiaru S, M, L', () => {
      renderComponent();
      expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument();
    });

    it('VS-U-003: M jest domyślnie aktywny', () => {
      renderComponent({ carSize: 'medium' });
      const buttonM = screen.getByRole('button', { name: 'M' });
      expect(buttonM.className).toContain('bg-primary');
    });

    it('VS-U-004: wyświetla błąd walidacji modelu', () => {
      renderComponent({ carModelError: 'Model jest wymagany' });
      expect(screen.getByText('Model jest wymagany')).toBeInTheDocument();
    });
  });

  describe('Interakcje rozmiaru', () => {
    it('VS-U-010: kliknięcie L wywołuje onCarSizeChange', async () => {
      const onCarSizeChange = vi.fn();
      const user = userEvent.setup();
      renderComponent({ onCarSizeChange });

      await user.click(screen.getByRole('button', { name: 'L' }));
      expect(onCarSizeChange).toHaveBeenCalledWith('large');
    });

    it('VS-U-011: kliknięcie S wywołuje onCarSizeChange', async () => {
      const onCarSizeChange = vi.fn();
      const user = userEvent.setup();
      renderComponent({ onCarSizeChange });

      await user.click(screen.getByRole('button', { name: 'S' }));
      expect(onCarSizeChange).toHaveBeenCalledWith('small');
    });
  });

  describe('Pojazdy klienta (pills)', () => {
    const mockVehicles = [
      { id: 'v1', phone: '123456789', model: 'BMW X5', plate: 'WA1', customer_id: null, car_size: 'L' },
      { id: 'v2', phone: '123456789', model: 'Audi A4', plate: 'WA2', customer_id: null, car_size: 'M' },
    ];

    it('VS-U-020: wyświetla pills gdy klient ma wiele pojazdów', () => {
      renderComponent({ customerVehicles: mockVehicles });
      expect(screen.getByText('BMW X5')).toBeInTheDocument();
      expect(screen.getByText('Audi A4')).toBeInTheDocument();
    });

    it('VS-U-021: nie wyświetla pills gdy klient ma tylko 1 pojazd', () => {
      renderComponent({ customerVehicles: [mockVehicles[0]] });
      // Pills should not be visible with just one vehicle
      const pillButtons = screen.queryAllByRole('button').filter(btn => 
        btn.textContent === 'BMW X5' || btn.textContent === 'Audi A4'
      );
      expect(pillButtons.length).toBe(0);
    });

    it('VS-U-022: kliknięcie pill wywołuje onVehicleSelect', async () => {
      const onVehicleSelect = vi.fn();
      const user = userEvent.setup();
      renderComponent({ customerVehicles: mockVehicles, onVehicleSelect });

      await user.click(screen.getByText('Audi A4'));
      expect(onVehicleSelect).toHaveBeenCalledWith(mockVehicles[1]);
    });

    it('VS-U-023: wybrany pill ma aktywny styl', () => {
      renderComponent({ 
        customerVehicles: mockVehicles, 
        selectedVehicleId: 'v1' 
      });
      
      const bmwPill = screen.getByText('BMW X5');
      expect(bmwPill.className).toContain('bg-primary');
    });
  });
});
