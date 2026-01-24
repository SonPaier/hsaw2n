import { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Loader2, Search, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

type CarSize = 'small' | 'medium' | 'large';

interface Service {
  id: string;
  name: string;
  short_name?: string | null;
  category_id: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  sort_order: number | null;
  category_prices_are_net?: boolean;
  station_type?: string | null;
}

interface ServiceCategory {
  id: string;
  name: string;
  sort_order: number | null;
  prices_are_net: boolean;
}

export interface ServiceWithCategory {
  id: string;
  name: string;
  short_name?: string | null;
  category_id: string | null;
  duration_minutes: number | null;
  duration_small: number | null;
  duration_medium: number | null;
  duration_large: number | null;
  price_from: number | null;
  price_small: number | null;
  price_medium: number | null;
  price_large: number | null;
  category_prices_are_net?: boolean;
}

interface ServiceSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  carSize: CarSize;
  selectedServiceIds: string[];
  onConfirm: (serviceIds: string[], totalDuration: number, services: ServiceWithCategory[]) => void;
  /** Optional station type to filter services */
  stationType?: 'washing' | 'ppf' | 'detailing' | 'universal';
  /** When true, filter by service_type='both'. When false/undefined, filter by 'reservation' (legacy). */
  hasUnifiedServices?: boolean;
}

const ServiceSelectionDrawer = ({
  open,
  onClose,
  instanceId,
  carSize,
  selectedServiceIds: initialSelectedIds,
  onConfirm,
  stationType,
  hasUnifiedServices = false,
}: ServiceSelectionDrawerProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset selected and search when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIds);
      setSearchQuery('');
      // Focus search input after drawer animation
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 300);
    }
  }, [open, initialSelectedIds]);

  // Fetch services and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;
      
      setLoading(true);
      
      // Filter by service_type based on hasUnifiedServices flag:
      // - hasUnifiedServices=true (new records) → show only 'both'
      // - hasUnifiedServices=false (legacy) → show 'reservation' for backward compatibility
      const serviceTypeFilter = hasUnifiedServices ? 'both' : 'reservation';
      
      let servicesQuery = supabase
        .from('unified_services')
        .select('id, name, short_name, category_id, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, sort_order, station_type')
        .eq('instance_id', instanceId)
        .eq('service_type', serviceTypeFilter)
        .eq('active', true);
      
      // Fetch categories - for hasUnifiedServices=true use 'both', otherwise 'reservation' for legacy
      const categoryTypeFilter = hasUnifiedServices ? 'both' : 'reservation';
      
      const [servicesRes, categoriesRes] = await Promise.all([
        servicesQuery.order('sort_order'),
        supabase
          .from('unified_categories')
          .select('id, name, sort_order, prices_are_net')
          .eq('instance_id', instanceId)
          .eq('category_type', categoryTypeFilter)
          .eq('active', true)
          .order('sort_order'),
      ]);

      if (servicesRes.data && categoriesRes.data) {
        // Create a map of category prices_are_net
        const categoryNetMap = new Map<string, boolean>();
        categoriesRes.data.forEach(cat => {
          categoryNetMap.set(cat.id, cat.prices_are_net || false);
        });

        // Enrich services with category_prices_are_net
        const enrichedServices = servicesRes.data.map(s => ({
          ...s,
          category_prices_are_net: s.category_id ? categoryNetMap.get(s.category_id) || false : false,
        }));

        setServices(enrichedServices);
        setCategories(categoriesRes.data);
      } else {
        if (servicesRes.data) setServices(servicesRes.data);
        if (categoriesRes.data) setCategories(categoriesRes.data);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [open, instanceId, stationType, hasUnifiedServices]);

  // Parse search tokens and find matching services
  const { matchingServices, searchTokens } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { matchingServices: [], searchTokens: [] };
    }

    const tokens = searchQuery.toUpperCase().split(/\s+/).filter(Boolean);
    const matched: { service: Service; token: string }[] = [];

    tokens.forEach(token => {
      // First try exact short_name match
      let found = services.find(s => 
        s.short_name?.toUpperCase() === token && 
        !selectedIds.includes(s.id) &&
        !matched.some(m => m.service.id === s.id)
      );
      
      // Fallback to partial short_name match
      if (!found) {
        found = services.find(s => 
          s.short_name?.toUpperCase().startsWith(token) && 
          !selectedIds.includes(s.id) &&
          !matched.some(m => m.service.id === s.id)
        );
      }
      
      // Fallback to name match
      if (!found) {
        found = services.find(s => 
          s.name.toUpperCase().includes(token) && 
          !selectedIds.includes(s.id) &&
          !matched.some(m => m.service.id === s.id)
        );
      }

      if (found) {
        matched.push({ service: found, token });
      }
    });

    return { matchingServices: matched, searchTokens: tokens };
  }, [searchQuery, services, selectedIds]);

  // Get selected services with details
  const selectedServices = useMemo(() => {
    return selectedIds
      .map(id => services.find(s => s.id === id))
      .filter((s): s is Service => s !== undefined);
  }, [selectedIds, services]);

  // Group services by category - filter based on search
  const groupedServices = useMemo(() => {
    const groups: { category: ServiceCategory; services: Service[] }[] = [];
    
    // All categories with their services
    categories.forEach(category => {
      let categoryServices = services.filter(s => s.category_id === category.id);
      
      // Filter by search if there's a query
      if (searchQuery.trim()) {
        const query = searchQuery.toUpperCase();
        categoryServices = categoryServices.filter(s => 
          s.short_name?.toUpperCase().includes(query) ||
          s.name.toUpperCase().includes(query)
        );
      }
      
      groups.push({ category, services: categoryServices });
    });
    
    return groups;
  }, [services, categories, searchQuery]);

  // Round to nearest 5 PLN
  const roundToNearest5 = (value: number): number => {
    return Math.round(value / 5) * 5;
  };

  // Convert net price to brutto (gross) and round
  const netToBrutto = (netPrice: number): number => {
    const brutto = netPrice * 1.23;
    return roundToNearest5(brutto);
  };

  // Get price for service based on car size (always returns brutto, rounded to 5)
  const getPrice = (service: Service): number | null => {
    let price: number | null = null;
    
    if (carSize === 'small' && service.price_small !== null) {
      price = service.price_small;
    } else if (carSize === 'medium' && service.price_medium !== null) {
      price = service.price_medium;
    } else if (carSize === 'large' && service.price_large !== null) {
      price = service.price_large;
    } else {
      price = service.price_from;
    }
    
    if (price === null) return null;
    
    // If category prices are net, convert to brutto
    if (service.category_prices_are_net) {
      price = netToBrutto(price);
    }
    
    return price;
  };

  // Get duration for service based on car size
  const getDuration = (service: Service): number => {
    if (carSize === 'small' && service.duration_small) return service.duration_small;
    if (carSize === 'medium' && service.duration_medium) return service.duration_medium;
    if (carSize === 'large' && service.duration_large) return service.duration_large;
    return service.duration_minutes || 60;
  };

  // Format duration - always show hours and minutes
  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}min`;
    } else if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}min`;
  };

  // Format price
  const formatPrice = (price: number | null): string => {
    if (price === null) return t('serviceDrawer.variablePrice');
    return `${price.toFixed(0)} zł`;
  };

  // Toggle service selection
  const toggleService = (serviceId: string) => {
    setSelectedIds(prev => 
      prev.includes(serviceId) 
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  // Add service from matching chips
  const addFromMatch = (service: Service, token: string) => {
    setSelectedIds(prev => [...prev, service.id]);
    // Remove the matched token from search query
    const newQuery = searchQuery
      .toUpperCase()
      .split(/\s+/)
      .filter(t => t !== token)
      .join(' ');
    setSearchQuery(newQuery);
    searchInputRef.current?.focus();
  };

  // Remove selected service
  const removeService = (serviceId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== serviceId));
  };

  // Calculate total duration
  const totalDuration = useMemo(() => {
    return selectedIds.reduce((total, id) => {
      const service = services.find(s => s.id === id);
      return total + (service ? getDuration(service) : 0);
    }, 0);
  }, [selectedIds, services, carSize]);

  // Calculate total price
  const totalPrice = useMemo(() => {
    let total = 0;
    let hasVariablePrice = false;
    
    selectedIds.forEach(id => {
      const service = services.find(s => s.id === id);
      if (service) {
        const price = getPrice(service);
        if (price !== null) {
          total += price;
        } else {
          hasVariablePrice = true;
        }
      }
    });
    
    return { total, hasVariablePrice };
  }, [selectedIds, services, carSize]);

  // Handle confirm
  const handleConfirm = () => {
    // Build services with category info
    const selectedWithCategory: ServiceWithCategory[] = selectedIds
      .map(id => services.find(s => s.id === id))
      .filter((s): s is Service => s !== undefined)
      .map(s => ({
        id: s.id,
        name: s.name,
        short_name: s.short_name,
        category_id: s.category_id,
        duration_minutes: s.duration_minutes,
        duration_small: s.duration_small,
        duration_medium: s.duration_medium,
        duration_large: s.duration_large,
        price_from: s.price_from,
        price_small: s.price_small,
        price_medium: s.price_medium,
        price_large: s.price_large,
        category_prices_are_net: s.category_prices_are_net,
      }));
    
    onConfirm(selectedIds, totalDuration, selectedWithCategory);
    onClose();
  };

  // Get display label for service chip
  const getChipLabel = (service: Service): string => {
    if (service.short_name) {
      return service.short_name;
    }
    // Truncate long names
    return service.name.length > 12 ? service.name.substring(0, 10) + '...' : service.name;
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        hideOverlay
        hideCloseButton
        className="w-full sm:max-w-lg p-0 flex flex-col shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
        onFocusOutside={(e) => e.preventDefault()}
      >
        {/* Header - clicking closes drawer */}
        <SheetHeader 
          className="border-b px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
          onClick={onClose}
        >
          <SheetTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            {t('serviceDrawer.selectService')}
          </SheetTitle>
        </SheetHeader>

        {/* Search Section */}
        <div className="px-4 py-3 border-b space-y-3 shrink-0">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="search"
              inputMode="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('serviceDrawer.searchPlaceholder')}
              className="pl-9 pr-9 h-11"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Matching Services Chips */}
          {matchingServices.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">{t('serviceDrawer.matchingServices')}</p>
              <div className="flex flex-wrap gap-2">
                {matchingServices.map(({ service, token }) => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => addFromMatch(service, token)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors min-h-[36px]"
                  >
                    <span className="font-bold">{service.short_name || service.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No matches message */}
          {searchQuery.trim() && matchingServices.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('serviceDrawer.noMatches')}</p>
          )}

          {/* Selected Services Chips */}
          {selectedServices.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground font-medium">
                {t('serviceDrawer.selectedServices')} ({selectedServices.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedServices.map(service => (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => removeService(service.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors min-h-[36px]"
                  >
                    <span>{getChipLabel(service)}</span>
                    <X className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="pb-4">
              {groupedServices.map(({ category, services: categoryServices }) => {
                const serviceCount = categoryServices.length;
                
                // Hide empty categories when searching
                if (searchQuery.trim() && serviceCount === 0) {
                  return null;
                }
                
                return (
                  <div key={category.id}>
                    {/* Category header - centered, white bg, black text */}
                    <div className="py-2 px-4 bg-white">
                      <p className="text-sm font-semibold text-foreground text-center uppercase tracking-wide">
                        {category.name}
                      </p>
                    </div>
                    
                    {/* Services list - flat */}
                    {categoryServices.map((service) => {
                      const isSelected = selectedIds.includes(service.id);
                      const price = getPrice(service);
                      const duration = getDuration(service);
                      
                      return (
                        <button
                          key={service.id}
                          type="button"
                          data-testid="service-item"
                          data-service-id={service.id}
                          onClick={() => toggleService(service.id)}
                          className={cn(
                            "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                            isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                          )}
                        >
                          {/* Service info */}
                          <div className="flex-1 text-left">
                            <p className="font-medium text-foreground">
                              {service.short_name && (
                                <span className="text-primary font-bold mr-2">{service.short_name}</span>
                              )}
                              {service.name}
                            </p>
                          </div>
                          
                          {/* Price & Duration */}
                          <div className="text-right mr-4">
                            <p className="font-semibold text-foreground">{formatPrice(price)}</p>
                            <p className="text-xs text-muted-foreground">{formatDuration(duration)}</p>
                          </div>
                          
                          {/* Checkmark */}
                          <div className={cn(
                            "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            isSelected 
                              ? "bg-primary border-primary" 
                              : "border-muted-foreground/40"
                          )}>
                            {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="border-t px-4 py-4 shrink-0 bg-background">
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-foreground">
                {t('serviceDrawer.selectedCount', { count: selectedIds.length })}
              </span>
              {totalDuration > 0 && (
                <span className="text-lg font-bold text-foreground">
                  {formatDuration(totalDuration)}
                </span>
              )}
            </div>
            {selectedIds.length > 0 && (
              <div className="text-right">
                <span className="text-xl font-bold text-foreground">
                  {totalPrice.hasVariablePrice ? 'od ' : ''}
                  {totalPrice.total.toFixed(0)} zł
                </span>
              </div>
            )}
          </div>
          <Button 
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="w-full"
            size="lg"
            data-testid="service-confirm-button"
          >
            {t('serviceDrawer.addButton')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ServiceSelectionDrawer;
