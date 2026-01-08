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
    // Strip Polish prefix for display (+48, 0048, or 48 followed by 9 digits)
    const stripPolishPrefix = (digits: string): string => {
      if (!digits) return '';
      // Remove +48 prefix
      if (digits.startsWith('+48')) {
        return digits.slice(3);
      }
      // Remove 0048 prefix
      if (digits.startsWith('0048')) {
        return digits.slice(4);
      }
      // Remove 48 only if followed by exactly 9 digits (total 11 digits)
      if (digits.startsWith('48') && digits.length === 11) {
        return digits.slice(2);
      }
      return digits;
    };

    // Format for display: XXX XXX XXX
    const formatPhone = (digits: string): string => {
      if (!digits) return '';
      const cleaned = digits.replace(/\D/g, '');
      // Strip Polish prefix before formatting
      const withoutPrefix = stripPolishPrefix(cleaned);
      const parts: string[] = [];
      for (let i = 0; i < withoutPrefix.length; i += 3) {
        parts.push(withoutPrefix.slice(i, i + 3));
      }
      return parts.join(' ');
    };

    // Extract raw digits from value (keep original for storage)
    const rawValue = value.replace(/\D/g, '');
    const displayValue = formatPhone(rawValue);

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
