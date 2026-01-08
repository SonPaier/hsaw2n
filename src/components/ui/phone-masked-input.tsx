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
    // Format for display: XXX XXX XXX
    const formatPhone = (digits: string): string => {
      if (!digits) return '';
      const cleaned = digits.replace(/\D/g, '');
      const parts: string[] = [];
      for (let i = 0; i < cleaned.length; i += 3) {
        parts.push(cleaned.slice(i, i + 3));
      }
      return parts.join(' ');
    };

    // Extract raw digits from value
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
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
