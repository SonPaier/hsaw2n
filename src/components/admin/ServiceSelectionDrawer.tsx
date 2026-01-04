import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';

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

  // Group services by category
  const groupedServices = useMemo(() => {
    const groups: { category: ServiceCategory | null; services: Service[] }[] = [];
    
    // Services with categories
    categories.forEach(category => {
      const categoryServices = services.filter(s => s.category_id === category.id);
      if (categoryServices.length > 0) {
        groups.push({ category, services: categoryServices });
      }
    });
    
    // Services without category (at the end)
    const uncategorized = services.filter(s => !s.category_id);
    if (uncategorized.length > 0) {
      groups.push({ category: null, services: uncategorized });
    }
    
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

  // Handle confirm
  const handleConfirm = () => {
    onConfirm(selectedIds, totalDuration);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[90vh] flex flex-col" hideOverlay>
        {/* Header - clicking closes drawer */}
        <DrawerHeader 
          className="border-b px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors shrink-0"
          onClick={onClose}
        >
          <DrawerTitle className="flex items-center gap-3 text-lg font-semibold">
            <ArrowLeft className="w-5 h-5" />
            {t('serviceDrawer.selectService')}
          </DrawerTitle>
        </DrawerHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="pb-4">
              {groupedServices.map(({ category, services: categoryServices }) => {
                const categoryId = category?.id || 'uncategorized';
                const isExpanded = expandedCategories.has(categoryId);
                
                return (
                  <div key={categoryId}>
                    {/* Category header */}
                    <button
                      type="button"
                      onClick={() => toggleCategory(categoryId)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                        {category?.name || t('serviceDrawer.otherServices')}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    
                    {/* Services list */}
                    {isExpanded && (
                      <div>
                        {categoryServices.map((service) => {
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
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <DrawerFooter className="border-t px-4 py-3 shrink-0 bg-background">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {t('serviceDrawer.selectedCount', { count: selectedIds.length })}
            </span>
            {totalDuration > 0 && (
              <span className="text-sm font-medium">
                {t('serviceDrawer.totalTime')}: {formatDuration(totalDuration)}
              </span>
            )}
          </div>
          <Button 
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="w-full"
          >
            {t('serviceDrawer.addButton')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ServiceSelectionDrawer;
