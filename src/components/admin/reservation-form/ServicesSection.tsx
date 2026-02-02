import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import ServiceSelectionDrawer, { ServiceWithCategory } from '../ServiceSelectionDrawer';
import SelectedServicesList, { ServiceItem as SelectedServiceItem } from '../SelectedServicesList';
import { CarSize, Service, ServiceItem } from './types';
import { RefObject } from 'react';

interface ServicesSectionProps {
  instanceId: string;
  carSize: CarSize;
  services: Service[];
  selectedServices: string[];
  setSelectedServices: React.Dispatch<React.SetStateAction<string[]>>;
  serviceItems: ServiceItem[];
  setServiceItems: React.Dispatch<React.SetStateAction<ServiceItem[]>>;
  servicesWithCategory: ServiceWithCategory[];
  setServicesWithCategory: React.Dispatch<React.SetStateAction<ServiceWithCategory[]>>;
  servicesError?: string;
  onClearServicesError: () => void;
  serviceDrawerOpen: boolean;
  setServiceDrawerOpen: (open: boolean) => void;
  onTotalPriceChange: (total: number) => void;
  finalPrice: string;
  isYardMode: boolean;
  isEditMode: boolean;
  markUserEditing: () => void;
  servicesRef: RefObject<HTMLDivElement>;
}

export const ServicesSection = ({
  instanceId,
  carSize,
  services,
  selectedServices,
  setSelectedServices,
  serviceItems,
  setServiceItems,
  servicesWithCategory,
  setServicesWithCategory,
  servicesError,
  onClearServicesError,
  serviceDrawerOpen,
  setServiceDrawerOpen,
  onTotalPriceChange,
  finalPrice,
  isYardMode,
  isEditMode,
  markUserEditing,
  servicesRef,
}: ServicesSectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2" ref={servicesRef}>
      <Label>{t('navigation.products')}</Label>
      {servicesError && <p className="text-sm text-destructive">{servicesError}</p>}

      {/* Popular service shortcuts - shown in all modes */}
      {services.filter((s) => s.is_popular && !selectedServices.includes(s.id)).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {services
            .filter((s) => s.is_popular && !selectedServices.includes(s.id))
            .map((service) => (
              <button
                key={service.id}
                type="button"
                onClick={() => {
                  markUserEditing();
                  setSelectedServices((prev) => [...prev, service.id]);
                }}
                className="px-3 py-1.5 text-sm rounded-full transition-colors font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {service.short_name || service.name}
              </button>
            ))}
        </div>
      )}

      {/* Services list with inline price edit */}
      <SelectedServicesList
        services={servicesWithCategory}
        selectedServiceIds={selectedServices}
        serviceItems={serviceItems as SelectedServiceItem[]}
        carSize={carSize}
        onRemoveService={(serviceId) => {
          markUserEditing();
          setSelectedServices((prev) => prev.filter((id) => id !== serviceId));
          setServiceItems((prev) => prev.filter((si) => si.service_id !== serviceId));
          setServicesWithCategory((prev) => prev.filter((s) => s.id !== serviceId));
        }}
        onPriceChange={(serviceId, price) => {
          markUserEditing();
          setServiceItems((prev) => {
            const existing = prev.find((si) => si.service_id === serviceId);
            if (existing) {
              return prev.map((si) =>
                si.service_id === serviceId ? { ...si, custom_price: price } : si
              );
            }
            return [...prev, { service_id: serviceId, custom_price: price }];
          });
        }}
        onTotalPriceChange={(newTotal) => {
          // Only update finalPrice if it wasn't manually set
          if (!finalPrice) {
            onTotalPriceChange(newTotal);
          }
        }}
        onAddMore={() => setServiceDrawerOpen(true)}
      />

      {/* Service Selection Drawer */}
      <ServiceSelectionDrawer
        open={serviceDrawerOpen}
        onClose={() => setServiceDrawerOpen(false)}
        instanceId={instanceId}
        carSize={carSize}
        selectedServiceIds={selectedServices}
        stationType="universal"
        hasUnifiedServices={!isEditMode}
        hideSelectedSection={true}
        onConfirm={(serviceIds, duration, servicesData) => {
          markUserEditing();
          setSelectedServices(serviceIds);

          // Clear validation error when user selects services
          onClearServicesError();

          // Merge new services with existing ones, preserving custom prices
          const newServicesWithCategory = servicesData.filter(
            (s) => !servicesWithCategory.some((existing) => existing.id === s.id)
          );
          setServicesWithCategory((prev) => {
            // Keep existing services that are still selected
            const kept = prev.filter((s) => serviceIds.includes(s.id));
            return [...kept, ...newServicesWithCategory];
          });

          // Initialize serviceItems for new services
          const existingItemIds = serviceItems.map((si) => si.service_id);
          const newItems = serviceIds
            .filter((id) => !existingItemIds.includes(id))
            .map((id) => ({ service_id: id, custom_price: null }));

          setServiceItems((prev) => {
            // Keep only items for selected services
            const kept = prev.filter((si) => serviceIds.includes(si.service_id));
            return [...kept, ...newItems];
          });
        }}
      />
    </div>
  );
};

export default ServicesSection;
