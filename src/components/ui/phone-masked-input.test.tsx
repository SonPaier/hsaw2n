import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneMaskedInput } from './phone-masked-input';

describe('PhoneMaskedInput', () => {
  describe('Rendering', () => {
    it('PHN-U-001: renders input with tel type', () => {
      render(<PhoneMaskedInput value="" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'tel');
    });

    it('PHN-U-002: renders with numeric inputMode', () => {
      render(<PhoneMaskedInput value="" onChange={vi.fn()} />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('inputMode', 'numeric');
    });

    it('PHN-U-003: applies custom className', () => {
      render(<PhoneMaskedInput value="" onChange={vi.fn()} className="custom-input" />);
      
      expect(screen.getByRole('textbox')).toHaveClass('custom-input');
    });

    it('PHN-U-004: forwards additional props', () => {
      render(<PhoneMaskedInput value="" onChange={vi.fn()} placeholder="Wprowadź numer" disabled />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', 'Wprowadź numer');
      expect(input).toBeDisabled();
    });
  });

  describe('Display formatting', () => {
    it('PHN-U-005: displays empty string for empty value', () => {
      render(<PhoneMaskedInput value="" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('PHN-U-006: formats 9-digit number as XXX XXX XXX', () => {
      render(<PhoneMaskedInput value="733854184" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('733 854 184');
    });

    it('PHN-U-007: strips +48 prefix for display', () => {
      render(<PhoneMaskedInput value="+48733854184" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('733 854 184');
    });

    it('PHN-U-008: strips 0048 prefix for display', () => {
      render(<PhoneMaskedInput value="0048733854184" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('733 854 184');
    });

    it('PHN-U-009: strips 48 prefix when followed by 9 digits (11 total)', () => {
      render(<PhoneMaskedInput value="48733854184" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('733 854 184');
    });

    it('PHN-U-010: does not strip 48 when not Polish prefix', () => {
      // 48123456 is only 8 digits, so 48 is not a country code here
      render(<PhoneMaskedInput value="48123456" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('481 234 56');
    });

    it('PHN-U-011: handles partial number correctly', () => {
      render(<PhoneMaskedInput value="733" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('733');
    });

    it('PHN-U-012: formats longer international numbers', () => {
      render(<PhoneMaskedInput value="491711234567" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('491 711 234 567');
    });
  });

  describe('Input handling with fireEvent', () => {
    it('PHN-U-013: extracts only digits from input change', () => {
      const onChange = vi.fn();
      render(<PhoneMaskedInput value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '733-854-184' } });
      
      expect(onChange).toHaveBeenCalledWith('733854184');
    });

    it('PHN-U-014: ignores non-digit characters', () => {
      const onChange = vi.fn();
      render(<PhoneMaskedInput value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'abc123def' } });
      
      expect(onChange).toHaveBeenCalledWith('123');
    });

    it('PHN-U-015: limits input to 15 digits', () => {
      const onChange = vi.fn();
      render(<PhoneMaskedInput value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '123456789012345678' } });
      
      expect(onChange).toHaveBeenCalledWith('123456789012345');
    });

    it('PHN-U-016: handles paste with formatting', () => {
      const onChange = vi.fn();
      render(<PhoneMaskedInput value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '+48 733 854 184' } });
      
      expect(onChange).toHaveBeenCalledWith('48733854184');
    });

    it('PHN-U-017: handles clearing input', () => {
      const onChange = vi.fn();
      render(<PhoneMaskedInput value="733854184" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith('');
    });
  });

  describe('Edge cases', () => {
    it('PHN-U-018: handles value with only non-digit characters', () => {
      render(<PhoneMaskedInput value="+++---" onChange={vi.fn()} />);
      
      expect(screen.getByRole('textbox')).toHaveValue('');
    });

    it('PHN-U-019: handles mixed valid/invalid input', () => {
      render(<PhoneMaskedInput value="+48 (733) 854-184" onChange={vi.fn()} />);
      
      // Strips +48 and formats
      expect(screen.getByRole('textbox')).toHaveValue('733 854 184');
    });

    it('PHN-U-020: handles incremental input via fireEvent', () => {
      const onChange = vi.fn();
      const { rerender } = render(<PhoneMaskedInput value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      
      // Simulate typing "7"
      fireEvent.change(input, { target: { value: '7' } });
      expect(onChange).toHaveBeenLastCalledWith('7');
      
      // Update value and simulate typing "73"
      rerender(<PhoneMaskedInput value="7" onChange={onChange} />);
      fireEvent.change(input, { target: { value: '73' } });
      expect(onChange).toHaveBeenLastCalledWith('73');
      
      // Update value and simulate typing "733"
      rerender(<PhoneMaskedInput value="73" onChange={onChange} />);
      fireEvent.change(input, { target: { value: '733' } });
      expect(onChange).toHaveBeenLastCalledWith('733');
    });

    it('PHN-U-021: handles empty string after non-digit input', () => {
      const onChange = vi.fn();
      render(<PhoneMaskedInput value="" onChange={onChange} />);
      
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'abc' } });
      
      expect(onChange).toHaveBeenLastCalledWith('');
    });
  });

  describe('Accessibility', () => {
    it('PHN-U-022: supports aria-label', () => {
      render(<PhoneMaskedInput value="" onChange={vi.fn()} aria-label="Numer telefonu" />);
      
      expect(screen.getByLabelText('Numer telefonu')).toBeInTheDocument();
    });

    it('PHN-U-023: supports aria-describedby', () => {
      const { container } = render(
        <>
          <PhoneMaskedInput value="" onChange={vi.fn()} aria-describedby="help-text" />
          <span id="help-text">Format: XXX XXX XXX</span>
        </>
      );
      
      const input = container.querySelector('input');
      expect(input).toHaveAttribute('aria-describedby', 'help-text');
    });
  });
});
