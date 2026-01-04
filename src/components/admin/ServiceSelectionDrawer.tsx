import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type CarSize = 'small' | 'medium' | 'large';

interface Service {
  id: string;
  name: string;
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
}

interface ServiceCategory {
  id: string;
  name: string;
  sort_order: number | null;
}

interface ServiceSelectionDrawerProps {
  open: boolean;
  onClose: () => void;
  instanceId: string;
  carSize: CarSize;
  selectedServiceIds: string[];
  onConfirm: (serviceIds: string[], totalDuration: number) => void;
}

const ServiceSelectionDrawer = ({
  open,
  onClose,
  instanceId,
  carSize,
  selectedServiceIds: initialSelectedIds,
  onConfirm,
}: ServiceSelectionDrawerProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Reset selected when drawer opens
  useEffect(() => {
    if (open) {
      setSelectedIds(initialSelectedIds);
    }
  }, [open, initialSelectedIds]);

  // Fetch services and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!open || !instanceId) return;
      
      setLoading(true);
      
      const [servicesRes, categoriesRes] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, category_id, duration_minutes, duration_small, duration_medium, duration_large, price_from, price_small, price_medium, price_large, sort_order')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('service_categories')
          .select('id, name, sort_order')
          .eq('instance_id', instanceId)
          .eq('active', true)
          .order('sort_order'),
      ]);

      if (servicesRes.data) {
        setServices(servicesRes.data);
      }
      
      if (categoriesRes.data) {
        setCategories(categoriesRes.data);
        // Expand first category by default
        if (categoriesRes.data.length > 0) {
          setExpandedCategories(new Set([categoriesRes.data[0].id]));
        }
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [open, instanceId]);

  // Group services by category - show all categories even with 0 services
  const groupedServices = useMemo(() => {
    const groups: { category: ServiceCategory; services: Service[] }[] = [];
    
    // All categories with their services
    categories.forEach(category => {
      const categoryServices = services.filter(s => s.category_id === category.id);
      groups.push({ category, services: categoryServices });
    });
    
    return groups;
  }, [services, categories]);

  // Get price for service based on car size
  const getPrice = (service: Service): number | null => {
    if (carSize === 'small' && service.price_small !== null) return service.price_small;
    if (carSize === 'medium' && service.price_medium !== null) return service.price_medium;
    if (carSize === 'large' && service.price_large !== null) return service.price_large;
    return service.price_from;
  };

  // Get duration for service based on car size
  const getDuration = (service: Service): number => {
    if (carSize === 'small' && service.duration_small) return service.duration_small;
    if (carSize === 'medium' && service.duration_medium) return service.duration_medium;
    if (carSize === 'large' && service.duration_large) return service.duration_large;
    return service.duration_minutes || 60;
  };

  // Format duration
  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
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

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
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
    onConfirm(selectedIds, totalDuration);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent 
        side="right" 
        hideOverlay 
        className="w-full sm:max-w-lg p-0 flex flex-col shadow-[-8px_0_30px_-12px_rgba(0,0,0,0.15)]"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="pb-4">
              {groupedServices.map(({ category, services: categoryServices }) => {
                const isExpanded = expandedCategories.has(category.id);
                const serviceCount = categoryServices.length;
                
                return (
                  <Collapsible
                    key={category.id}
                    open={isExpanded}
                    onOpenChange={() => toggleCategory(category.id)}
                  >
                    {/* Category header */}
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center gap-3 px-4 py-3 bg-slate-200/70 hover:bg-slate-200 transition-colors">
                        <ChevronRight 
                          className={cn(
                            "w-5 h-5 text-slate-600 transition-transform duration-200",
                            isExpanded && "rotate-90"
                          )} 
                        />
                        <span className="text-base font-semibold text-slate-800">
                          {category.name}
                        </span>
                        <span className="text-sm text-slate-500">
                          ({serviceCount} usług)
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    
                    {/* Services list */}
                    <CollapsibleContent>
                      {categoryServices.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground italic">
                          Brak usług w tej kategorii
                        </div>
                      ) : (
                        categoryServices.map((service) => {
                          const isSelected = selectedIds.includes(service.id);
                          const price = getPrice(service);
                          const duration = getDuration(service);
                          
                          return (
                            <button
                              key={service.id}
                              type="button"
                              onClick={() => toggleService(service.id)}
                              className={cn(
                                "w-full flex items-center px-4 py-3 border-b border-border/50 transition-colors",
                                isSelected ? "bg-primary/5" : "hover:bg-muted/30"
                              )}
                            >
                              {/* Service info */}
                              <div className="flex-1 text-left">
                                <p className="font-medium text-foreground">{service.name}</p>
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
                        })
                      )}
                    </CollapsibleContent>
                  </Collapsible>
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
          >
            {t('serviceDrawer.addButton')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ServiceSelectionDrawer;
