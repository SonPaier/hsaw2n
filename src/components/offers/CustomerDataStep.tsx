import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Building2, Car } from 'lucide-react';
import { CustomerData, VehicleData } from '@/hooks/useOffer';

interface CustomerDataStepProps {
  customerData: CustomerData;
  vehicleData: VehicleData;
  onCustomerChange: (data: Partial<CustomerData>) => void;
  onVehicleChange: (data: Partial<VehicleData>) => void;
}

export const CustomerDataStep = ({
  customerData,
  vehicleData,
  onCustomerChange,
  onVehicleChange,
}: CustomerDataStepProps) => {
  return (
    <div className="space-y-6">
      {/* Customer Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5 text-primary" />
            Dane klienta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Imię i nazwisko *</Label>
              <Input
                id="customerName"
                placeholder="Jan Kowalski"
                value={customerData.name}
                onChange={(e) => onCustomerChange({ name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email *</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="jan@example.com"
                value={customerData.email}
                onChange={(e) => onCustomerChange({ email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Telefon</Label>
              <Input
                id="customerPhone"
                placeholder="+48 123 456 789"
                value={customerData.phone}
                onChange={(e) => onCustomerChange({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerAddress">Adres</Label>
              <Input
                id="customerAddress"
                placeholder="ul. Przykładowa 1, 00-000 Warszawa"
                value={customerData.address}
                onChange={(e) => onCustomerChange({ address: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="w-5 h-5 text-primary" />
            Dane firmy (opcjonalne)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nazwa firmy</Label>
              <Input
                id="companyName"
                placeholder="Firma Sp. z o.o."
                value={customerData.company}
                onChange={(e) => onCustomerChange({ company: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyNip">NIP</Label>
              <Input
                id="companyNip"
                placeholder="1234567890"
                value={customerData.nip}
                onChange={(e) => onCustomerChange({ nip: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle Info */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="w-5 h-5 text-primary" />
            Dane pojazdu (opcjonalne)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicleBrand">Marka</Label>
              <Input
                id="vehicleBrand"
                placeholder="BMW"
                value={vehicleData.brand}
                onChange={(e) => onVehicleChange({ brand: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleModel">Model</Label>
              <Input
                id="vehicleModel"
                placeholder="M5"
                value={vehicleData.model}
                onChange={(e) => onVehicleChange({ model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehiclePlate">Nr rejestracyjny</Label>
              <Input
                id="vehiclePlate"
                placeholder="WA 12345"
                value={vehicleData.plate}
                onChange={(e) => onVehicleChange({ plate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleYear">Rok produkcji</Label>
              <Input
                id="vehicleYear"
                type="number"
                placeholder="2024"
                value={vehicleData.year || ''}
                onChange={(e) => onVehicleChange({ year: e.target.value ? parseInt(e.target.value) : undefined })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="vehicleVin">VIN</Label>
            <Input
              id="vehicleVin"
              placeholder="WBAPH5C55BA123456"
              value={vehicleData.vin}
              onChange={(e) => onVehicleChange({ vin: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
