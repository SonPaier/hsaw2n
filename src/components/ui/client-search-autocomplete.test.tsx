import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClientSearchAutocomplete from './client-search-autocomplete';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';

// Mock Supabase - simplified version for unit tests
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          or: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      }),
    }),
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
    ...render(
      <TestWrapper>
        <ClientSearchAutocomplete {...defaultProps} {...props} />
      </TestWrapper>
    ),
    onChange: props.onChange ?? defaultProps.onChange,
  };
};

describe('ClientSearchAutocomplete', () => {
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

    it('CLI-U-005: renders with autocomplete off', () => {
      renderComponent();
      
      expect(screen.getByRole('textbox')).toHaveAttribute('autocomplete', 'off');
    });

    it('CLI-U-006: renders with correct base styling', () => {
      renderComponent();
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10'); // Has right padding for icons
    });
  });
});
