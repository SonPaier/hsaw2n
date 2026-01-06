import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Building2, Car, Search, Loader2 } from 'lucide-react';
import { CustomerData, VehicleData } from '@/hooks/useOffer';
import { toast } from 'sonner';
import { CarSearchAutocomplete, CarSearchValue } from '@/components/ui/car-search-autocomplete';

interface CustomerDataStepProps {
  customerData: CustomerData;
  vehicleData: VehicleData;
  onCustomerChange: (data: Partial<CustomerData>) => void;
  onVehicleChange: (data: Partial<VehicleData>) => void;
}

// Parse address from API format: "ULICA NR, KOD MIASTO" or "ULICA NR/LOKAL, KOD MIASTO"
const parseAddress = (fullAddress: string) => {
  if (!fullAddress) return { street: '', postalCode: '', city: '' };
  
  // Try to match pattern: "STREET, POSTAL_CODE CITY"
  const match = fullAddress.match(/^(.+),\s*(\d{2}-\d{3})\s+(.+)$/);
  if (match) {
    return {
      street: match[1].trim(),
      postalCode: match[2].trim(),
      city: match[3].trim(),
    };
  }
  
  // Fallback - just return the full address as street
  return { street: fullAddress, postalCode: '', city: '' };
};

const paintTypes = [
  { value: 'matte', label: 'Mat' },
  { value: 'dark', label: 'Ciemny' },
  { value: 'other', label: 'Inny' },
];

export const CustomerDataStep = ({
  customerData,
  vehicleData,
  onCustomerChange,
  onVehicleChange,
}: CustomerDataStepProps) => {
  const { t } = useTranslation();
  const [nipLoading, setNipLoading] = useState(false);
  const [showManualCompany, setShowManualCompany] = useState(
    !!customerData.company || !!customerData.nip || !!customerData.companyAddress
  );

  const lookupNip = async () => {
    const nip = customerData.nip?.replace(/[^0-9]/g, '');
    if (!nip || nip.length !== 10) {
      toast.error('Wprowadź poprawny NIP (10 cyfr)');
      return;
    }

    setNipLoading(true);
    try {
      // Use White List API from Polish Ministry of Finance
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(
        `https://wl-api.mf.gov.pl/api/search/nip/${nip}?date=${today}`
      );
      
      if (!response.ok) {
        throw new Error('Nie znaleziono firmy');
      }

      const data = await response.json();
      
      if (data.result?.subject) {
        const subject = data.result.subject;
        const addressStr = subject.workingAddress || subject.residenceAddress || '';
        const parsed = parseAddress(addressStr);
        
        onCustomerChange({
          company: subject.name,
          companyAddress: parsed.street,
          companyPostalCode: parsed.postalCode,
          companyCity: parsed.city,
        });
        setShowManualCompany(true);
        toast.success('Pobrano dane firmy');
      } else {
        toast.error('Nie znaleziono firmy o podanym NIP');
      }
    } catch (error) {
      console.error('NIP lookup error:', error);
      toast.error('Nie udało się pobrać danych firmy');
    } finally {
      setNipLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Customer Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <User className="w-5 h-5 text-primary" />
          Dane klienta
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Imię i nazwisko *</Label>
            <Input
              id="customerName"
              value={customerData.name}
              onChange={(e) => onCustomerChange({ name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerEmail">Email *</Label>
            <Input
              id="customerEmail"
              type="email"
              value={customerData.email}
              onChange={(e) => onCustomerChange({ email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customerPhone">Telefon</Label>
            <Input
              id="customerPhone"
              value={customerData.phone}
              onChange={(e) => onCustomerChange({ phone: e.target.value })}
            />
          </div>
        </div>
        
        {/* Notes and Inquiry Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="customerNotes">Notatki</Label>
            <Textarea
              id="customerNotes"
              value={customerData.notes || ''}
              onChange={(e) => onCustomerChange({ notes: e.target.value })}
              rows={3}
              placeholder="Notatki wewnętrzne..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inquiryContent">Treść zapytania</Label>
            <Textarea
              id="inquiryContent"
              value={customerData.inquiryContent || ''}
              onChange={(e) => onCustomerChange({ inquiryContent: e.target.value })}
              rows={3}
              placeholder="Treść zapytania od klienta..."
            />
          </div>
        </div>
      </div>

      {/* Company Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Building2 className="w-5 h-5 text-primary" />
          Dane firmy (opcjonalne)
        </div>
        {!showManualCompany ? (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="companyNipSearch">NIP</Label>
                <Input
                  id="companyNipSearch"
                  value={customerData.nip}
                  onChange={(e) => onCustomerChange({ nip: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={lookupNip}
                  disabled={nipLoading}
                  className="gap-2"
                >
                  {nipLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Pobierz dane
                </Button>
              </div>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                onClick={() => setShowManualCompany(true)}
              >
                Wprowadź ręcznie
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nazwa firmy</Label>
                <Input
                  id="companyName"
                  value={customerData.company}
                  onChange={(e) => onCustomerChange({ company: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyNip">NIP</Label>
                <div className="flex gap-2">
                  <Input
                    id="companyNip"
                    value={customerData.nip}
                    onChange={(e) => onCustomerChange({ nip: e.target.value })}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={lookupNip}
                    disabled={nipLoading}
                    title="Pobierz dane z NIP"
                  >
                    {nipLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyAddress">Adres (ulica i numer)</Label>
              <Input
                id="companyAddress"
                value={customerData.companyAddress}
                onChange={(e) => onCustomerChange({ companyAddress: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyPostalCode">Kod pocztowy</Label>
                <Input
                  id="companyPostalCode"
                  value={customerData.companyPostalCode}
                  onChange={(e) => onCustomerChange({ companyPostalCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyCity">Miejscowość</Label>
                <Input
                  id="companyCity"
                  value={customerData.companyCity}
                  onChange={(e) => onCustomerChange({ companyCity: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Vehicle Info Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Car className="w-5 h-5 text-primary" />
          Dane pojazdu
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicleBrandModel">Marka i model *</Label>
          <CarSearchAutocomplete
            value={vehicleData.brandModel || ''}
            onChange={(val: CarSearchValue) => {
              if (val === null) {
                onVehicleChange({ brandModel: '' });
              } else if ('type' in val && val.type === 'custom') {
                onVehicleChange({ brandModel: val.label });
              } else {
                onVehicleChange({ brandModel: val.label });
              }
            }}
          />
        </div>
        
        {/* Paint Color and Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="paintColor">Kolor lakieru</Label>
            <Input
              id="paintColor"
              value={vehicleData.paintColor || ''}
              onChange={(e) => onVehicleChange({ paintColor: e.target.value })}
              placeholder="np. Czarny, Biały perłowy..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="paintType">Typ lakieru</Label>
            <Select
              value={vehicleData.paintType || ''}
              onValueChange={(value) => onVehicleChange({ paintType: value })}
            >
              <SelectTrigger id="paintType">
                <SelectValue placeholder="Wybierz typ lakieru" />
              </SelectTrigger>
              <SelectContent>
                {paintTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
};
