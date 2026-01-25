import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { NotesAndPriceSection } from './NotesAndPriceSection';

const renderComponent = (props: Partial<React.ComponentProps<typeof NotesAndPriceSection>> = {}) => {
  const defaultProps = {
    adminNotes: '',
    setAdminNotes: vi.fn(),
    showPrice: true,
    finalPrice: '',
    setFinalPrice: vi.fn(),
    discountedPrice: 100,
    totalPrice: 100,
    customerDiscountPercent: null,
    markUserEditing: vi.fn(),
    onFinalPriceUserEdit: vi.fn(),
  };

  return render(
    <I18nextProvider i18n={i18n}>
      <NotesAndPriceSection {...defaultProps} {...props} />
    </I18nextProvider>
  );
};

describe('NotesAndPriceSection', () => {
  describe('Notatki', () => {
    it('NP-U-001: wyświetla pole notatek', () => {
      renderComponent();
      expect(screen.getByLabelText(/Notatki wewnętrzne/i)).toBeInTheDocument();
    });

    it('NP-U-002: wywołuje setAdminNotes przy wpisywaniu', async () => {
      const setAdminNotes = vi.fn();
      const user = userEvent.setup();
      renderComponent({ setAdminNotes });

      const textarea = screen.getByLabelText(/Notatki wewnętrzne/i);
      await user.type(textarea, 'Test note');
      
      expect(setAdminNotes).toHaveBeenCalled();
    });

    it('NP-U-003: wyświetla istniejące notatki', () => {
      renderComponent({ adminNotes: 'Existing note' });
      expect(screen.getByDisplayValue('Existing note')).toBeInTheDocument();
    });
  });

  describe('Cena', () => {
    it('NP-U-010: wyświetla pole ceny gdy showPrice=true', () => {
      renderComponent({ showPrice: true });
      expect(screen.getByLabelText(/Kwota razem brutto/i)).toBeInTheDocument();
    });

    it('NP-U-011: ukrywa pole ceny gdy showPrice=false', () => {
      renderComponent({ showPrice: false });
      expect(screen.queryByLabelText(/Kwota razem brutto/i)).not.toBeInTheDocument();
    });

    it('NP-U-012: wyświetla discountedPrice gdy finalPrice jest pusty', () => {
      renderComponent({ 
        showPrice: true, 
        finalPrice: '', 
        discountedPrice: 150 
      });
      
      const input = screen.getByLabelText(/Kwota razem brutto/i);
      expect(input).toHaveValue(150);
    });

    it('NP-U-013: wyświetla finalPrice gdy jest ustawiony', () => {
      renderComponent({ 
        showPrice: true, 
        finalPrice: '200', 
        discountedPrice: 150 
      });
      
      const input = screen.getByLabelText(/Kwota razem brutto/i);
      expect(input).toHaveValue(200);
    });

    it('NP-U-014: wywołuje setFinalPrice przy zmianie', async () => {
      const setFinalPrice = vi.fn();
      const user = userEvent.setup();
      renderComponent({ showPrice: true, setFinalPrice });

      const input = screen.getByLabelText(/Kwota razem brutto/i);
      await user.clear(input);
      await user.type(input, '250');
      
      expect(setFinalPrice).toHaveBeenCalled();
    });
  });

  describe('Rabat klienta', () => {
    it('NP-U-020: wyświetla informacje o rabacie', () => {
      renderComponent({
        showPrice: true,
        totalPrice: 200,
        discountedPrice: 180,
        customerDiscountPercent: 10,
      });

      expect(screen.getByText('200 zł')).toBeInTheDocument();
      expect(screen.getByText('-10%')).toBeInTheDocument();
    });

    it('NP-U-021: nie wyświetla rabatu gdy customerDiscountPercent=null', () => {
      renderComponent({
        showPrice: true,
        totalPrice: 200,
        discountedPrice: 200,
        customerDiscountPercent: null,
      });

      expect(screen.queryByText('-10%')).not.toBeInTheDocument();
    });

    it('NP-U-022: nie wyświetla rabatu gdy totalPrice=0', () => {
      renderComponent({
        showPrice: true,
        totalPrice: 0,
        discountedPrice: 0,
        customerDiscountPercent: 10,
      });

      expect(screen.queryByText('-10%')).not.toBeInTheDocument();
    });
  });

  describe('markUserEditing', () => {
    it('NP-U-030: wywołuje markUserEditing przy zmianie notatek', async () => {
      const markUserEditing = vi.fn();
      const user = userEvent.setup();
      renderComponent({ markUserEditing });

      const textarea = screen.getByLabelText(/Notatki wewnętrzne/i);
      await user.type(textarea, 'x');
      
      expect(markUserEditing).toHaveBeenCalled();
    });

    it('NP-U-031: wywołuje markUserEditing przy zmianie ceny', async () => {
      const markUserEditing = vi.fn();
      const user = userEvent.setup();
      renderComponent({ showPrice: true, markUserEditing });

      const input = screen.getByLabelText(/Kwota razem brutto/i);
      await user.clear(input);
      await user.type(input, '100');
      
      expect(markUserEditing).toHaveBeenCalled();
    });

    it('NP-U-032: wywołuje onFinalPriceUserEdit przy ręcznej zmianie ceny', async () => {
      const onFinalPriceUserEdit = vi.fn();
      const user = userEvent.setup();
      renderComponent({ showPrice: true, onFinalPriceUserEdit });

      const input = screen.getByLabelText(/Kwota razem brutto/i);
      await user.clear(input);
      await user.type(input, '200');
      
      expect(onFinalPriceUserEdit).toHaveBeenCalled();
    });
  });
});
