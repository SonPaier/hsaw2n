import * as React from "react";
import { cn } from "@/lib/utils";

export interface PhoneMaskedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Phone input with visual mask (XXX XXX XXX format)
 * Stores and returns raw digits, displays formatted value
 */
const PhoneMaskedInput = React.forwardRef<HTMLInputElement, PhoneMaskedInputProps>(
  ({ className, value, onChange, ...props }, ref) => {
    /**
     * Format phone for display based on country code:
     * - Polish (+48): show 9 digits without prefix (XXX XXX XXX)
     * - International: show all digits with prefix (+XX XXX XXX XXX)
     */
    const formatPhoneForDisplay = (rawDigits: string): string => {
      if (!rawDigits) return '';
      
      // Clean to digits only (remove +, spaces, etc.)
      const digits = rawDigits.replace(/\D/g, '');
      if (!digits) return '';
      
      // Check if Polish number: starts with 48 and total is 11 digits
      const isPolish = digits.startsWith('48') && digits.length === 11;
      
      if (isPolish) {
        // Strip 48 prefix, show 9 digits as XXX XXX XXX
        const local = digits.slice(2);
        return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6, 9)}`.trim();
      }
      
      // For exactly 9 digits without prefix, assume Polish - format as XXX XXX XXX
      if (digits.length === 9) {
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
      }
      
      // International number: show with + prefix
      // Format: +XX XXX XXX XXX (groups of 3 after country code)
      if (digits.length >= 10) {
        // Assume 2-digit country code for display
        const countryCode = digits.slice(0, 2);
        const rest = digits.slice(2);
        const parts: string[] = [];
        for (let i = 0; i < rest.length; i += 3) {
          parts.push(rest.slice(i, i + 3));
        }
        return `+${countryCode} ${parts.join(' ')}`.trim();
      }
      
      // Fallback: just group by 3
      const parts: string[] = [];
      for (let i = 0; i < digits.length; i += 3) {
        parts.push(digits.slice(i, i + 3));
      }
      return parts.join(' ');
    };

    // Extract raw digits from value (keep original for storage)
    const rawValue = value.replace(/\D/g, '');
    const displayValue = formatPhoneForDisplay(rawValue);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      const digits = inputValue.replace(/\D/g, '');
      // Limit to reasonable phone length (15 digits max for international)
      onChange(digits.slice(0, 15));
    };

    return (
      <input
        type="tel"
        inputMode="numeric"
        data-testid="phone-input"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

PhoneMaskedInput.displayName = "PhoneMaskedInput";

export { PhoneMaskedInput };
