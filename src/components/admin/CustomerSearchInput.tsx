import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Customer {
  id: string;
  phone: string;
  name: string;
  email: string | null;
}

interface CustomerSearchInputProps {
  instanceId: string;
  value: string;
  onChange: (value: string) => void;
  onSelectCustomer: (customer: Customer) => void;
  placeholder?: string;
  className?: string;
}

const CustomerSearchInput = ({
  instanceId,
  value,
  onChange,
  onSelectCustomer,
  placeholder,
  className,
}: CustomerSearchInputProps) => {
  const { t } = useTranslation();
  const [searching, setSearching] = useState(false);
  const [foundCustomers, setFoundCustomers] = useState<Customer[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Search customers
  const searchCustomers = useCallback(async (searchValue: string) => {
    if (searchValue.length < 2) {
      setFoundCustomers([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, phone, name, email')
        .eq('instance_id', instanceId)
        .or(`name.ilike.%${searchValue}%,phone.ilike.%${searchValue}%`)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!error && data) {
        setFoundCustomers(data);
        setShowDropdown(data.length > 0);
        setSelectedIndex(-1);
      }
    } finally {
      setSearching(false);
    }
  }, [instanceId]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCustomers(value);
    }, 300);
    return () => clearTimeout(timer);
  }, [value, searchCustomers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || foundCustomers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, foundCustomers.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < foundCustomers.length) {
          handleSelectCustomer(foundCustomers[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    onSelectCustomer(customer);
    setShowDropdown(false);
    setFoundCustomers([]);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => foundCustomers.length > 0 && setShowDropdown(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {searching && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
      )}

      {showDropdown && foundCustomers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded-lg overflow-hidden bg-card shadow-lg z-[9999]">
          {foundCustomers.map((customer, index) => (
            <button
              key={customer.id}
              type="button"
              className={cn(
                "w-full p-4 text-left transition-colors flex flex-col border-b border-border last:border-0",
                index === selectedIndex ? "bg-accent" : "hover:bg-muted/30"
              )}
              onClick={() => handleSelectCustomer(customer)}
            >
              <div className="font-semibold text-base text-foreground">{customer.name}</div>
              <div className="text-sm">
                <span className="text-primary font-medium">
                  {customer.phone.replace(/^\+48/, '').replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}
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

export default CustomerSearchInput;
