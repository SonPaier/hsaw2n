import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { normalizeSearchQuery } from '@/lib/textUtils';

interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

export interface ClientSearchValue {
  id: string;
  name: string;
  phone: string;
}

interface ClientSearchAutocompleteProps {
  instanceId: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (customer: ClientSearchValue) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** When true, disables auto-search on mount/value change (used in edit mode) */
  suppressAutoSearch?: boolean;
}

const ClientSearchAutocomplete = ({
  instanceId,
  value,
  onChange,
  onSelect,
  onClear,
  placeholder,
  className,
  disabled = false,
  suppressAutoSearch = false,
}: ClientSearchAutocompleteProps) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState(value || '');
  const [searching, setSearching] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [justSelected, setJustSelected] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const internalUpdateRef = useRef(false);
  const suppressNextSearchRef = useRef(false);

  // Sync external value changes
  useEffect(() => {
    const next = value || '';

    if (next === inputValue) {
      internalUpdateRef.current = false;
      return;
    }

    setInputValue(next);

    // If value was set programmatically (e.g. from phone field), close dropdown and skip one search
    if (!internalUpdateRef.current) {
      suppressNextSearchRef.current = true;
      setFoundCustomers([]);
      setDropdownOpen(false);
      setActiveIndex(-1);
    }

    internalUpdateRef.current = false;
  }, [value, inputValue]);

  // Search customers with debounce
  const searchCustomers = useCallback(async (searchValue: string) => {
    if (searchValue.length < 2) {
      setFoundCustomers([]);
      setDropdownOpen(false);
      return;
    }

    setSearching(true);
    try {
      // Normalize search value for space-agnostic phone matching
      const normalizedSearch = normalizeSearchQuery(searchValue);
      
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, name, email')
        .eq('instance_id', instanceId)
        .or(`name.ilike.%${searchValue}%,phone.ilike.%${normalizedSearch}%`)
        .order('updated_at', { ascending: false })
        .limit(8);

      if (!error && data) {
        setFoundCustomers(data);
        setDropdownOpen(data.length > 0);
        setActiveIndex(-1);
      }
    } finally {
      setSearching(false);
    }
  }, [instanceId]);

  // Debounced search - only if user has interacted or not suppressed
  useEffect(() => {
    if (justSelected) return;

    if (suppressNextSearchRef.current) {
      suppressNextSearchRef.current = false;
      return;
    }

    // Skip auto-search in edit mode until user interacts
    if (suppressAutoSearch && !hasUserInteracted) return;

    const query = inputValue.trim();
    const timer = setTimeout(() => {
      searchCustomers(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue, searchCustomers, suppressAutoSearch, hasUserInteracted, justSelected]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    internalUpdateRef.current = true;
    setInputValue(newValue);
    setHasUserInteracted(true);
    onChange(newValue);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setJustSelected(true);
    suppressNextSearchRef.current = true;
    internalUpdateRef.current = true;

    setInputValue(customer.name);
    onChange(customer.name);

    setDropdownOpen(false);
    setFoundCustomers([]);
    setActiveIndex(-1);

    onSelect?.({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
    });

    // Prevent re-opening dropdown/search for a short period after selection
    setTimeout(() => setJustSelected(false), 200);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('');
    setFoundCustomers([]);
    setDropdownOpen(false);
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || foundCustomers.length === 0) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, foundCustomers.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < foundCustomers.length) {
          handleSelectCustomer(foundCustomers[activeIndex]);
        }
        break;
      case 'Escape':
        setDropdownOpen(false);
        break;
      case 'Tab':
        setDropdownOpen(false);
        break;
    }
  };

  // Highlight matching parts
  const highlightMatch = (text: string, query: string) => {
    if (!query || query.length < 2) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="font-semibold text-primary">{part}</span>
      ) : (
        part
      )
    );
  };

  // Format phone number - remove +48 prefix, format as 666 610 222
  const formatPhone = (phone: string) => {
    // Check if it starts with +48 or 0048
    const isPolish = /^(\+48|0048|48)/.test(phone.replace(/\s/g, ''));
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');
    // Remove Polish prefix if present
    if (digits.startsWith('48') && digits.length > 9) {
      digits = digits.slice(2);
    }
    // Format 9-digit number with spaces
    if (digits.length === 9) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    // For non-Polish numbers, show country code
    if (!isPolish && phone.startsWith('+')) {
      return phone;
    }
    return digits;
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            // Don't open if just selected or if suppressed and no interaction
            if (justSelected) return;
            if (!suppressAutoSearch || hasUserInteracted) {
              foundCustomers.length > 0 && setDropdownOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn("pr-10", className)}
          autoComplete="off"
          disabled={disabled}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searching && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {inputValue && !searching && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {dropdownOpen && foundCustomers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
          {foundCustomers.map((customer, index) => (
            <button
              key={customer.id}
              type="button"
              className={cn(
                "w-full p-4 text-left transition-colors flex flex-col border-b border-border last:border-0",
                index === activeIndex ? "bg-accent" : "hover:bg-muted/30"
              )}
              onClick={() => handleSelectCustomer(customer)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <div className="font-semibold text-base text-foreground">
                {highlightMatch(customer.name, inputValue)}
              </div>
              <div className="text-sm">
                <span className="text-primary font-medium">
                  {formatPhone(customer.phone)}
                </span>
                {customer.email && <span className="text-muted-foreground"> • {customer.email}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientSearchAutocomplete;
