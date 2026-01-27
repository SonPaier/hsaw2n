import { useTranslation } from 'react-i18next';
import { Phone, MessageSquare, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  source?: string;
  company?: string | null;
  nip?: string | null;
}

export interface CustomerVehicle {
  phone: string;
  model: string;
  plate: string | null;
}

interface CustomersListProps {
  customers: CustomerListItem[];
  vehicles?: CustomerVehicle[];
  onCustomerClick: (customer: CustomerListItem) => void;
  emptyMessage?: string;
  showActions?: boolean;
  onCall?: (phone: string, e: React.MouseEvent) => void;
  onSms?: (customer: CustomerListItem, e: React.MouseEvent) => void;
  onDelete?: (customer: CustomerListItem, e: React.MouseEvent) => void;
}

/**
 * Reusable customer list component extracted from CustomersView.
 * Displays customers with name, phone, and vehicle chips.
 */
export const CustomersList = ({
  customers,
  vehicles = [],
  onCustomerClick,
  emptyMessage,
  showActions = false,
  onCall,
  onSms,
  onDelete,
}: CustomersListProps) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const getVehiclesForCustomer = (phone: string) => {
    return vehicles.filter(v => v.phone === phone);
  };

  const handleCall = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCall) {
      onCall(phone, e);
    } else {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleSms = (customer: CustomerListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSms) {
      onSms(customer, e);
    } else if (isMobile) {
      window.location.href = `sms:${customer.phone}`;
    }
  };

  const handleDelete = (customer: CustomerListItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(customer, e);
    }
  };

  if (customers.length === 0) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        {emptyMessage || t('common.noResults')}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="divide-y divide-border/50">
        {customers.map(customer => {
          const customerVehicles = getVehiclesForCustomer(customer.phone);
          return (
            <div
              key={customer.id || customer.phone}
              onClick={() => onCustomerClick(customer)}
              className="p-4 flex items-center justify-between gap-4 transition-colors cursor-pointer bg-primary-foreground hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                {/* Line 1: Name */}
                <div className="font-medium text-foreground">
                  {customer.name}
                </div>
                {/* Line 2: Phone */}
                <div className="text-sm text-muted-foreground">
                  {customer.phone}
                </div>
                {/* Line 3: Vehicles */}
                {customerVehicles.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {customerVehicles.slice(0, 3).map((v, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-foreground/80 text-background rounded-full text-xs"
                      >
                        {v.model}
                      </span>
                    ))}
                    {customerVehicles.length > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{customerVehicles.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {showActions && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={e => handleSms(customer, e)}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-8 h-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={e => handleCall(customer.phone, e)}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-muted"
                      onClick={e => handleDelete(customer, e)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
